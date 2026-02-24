<template>
  <div class="gnew-html-node">
    <div v-if="showControls || node.label" class="html-header">
      <div class="html-title-wrap">
        <h3 v-if="node.label" class="html-title">{{ node.label }}</h3>
        <a
          v-if="node.publishedDomain"
          class="publish-badge"
          :href="`https://${node.publishedDomain}`"
          target="_blank"
          rel="noopener"
          title="Open published domain"
        >
          ✅ Published · {{ node.publishedDomain }}
        </a>
      </div>
      <div v-if="showControls" class="html-controls">
        <button v-if="!isPreview" @click="editNode" class="btn-control" title="Edit HTML Node">
          ✏️ Edit
        </button>
        <button v-if="isSuperadmin" @click="publishHtml" class="btn-control" title="Publish HTML">
          🚀 Publish
        </button>
        <button @click="toggleFullscreen" class="btn-control" title="Toggle Fullscreen">
          {{ isFullscreen ? '🗗 Exit Fullscreen' : '⛶ Fullscreen' }}
        </button>
        <button @click="refreshHtml" class="btn-control" title="Refresh HTML">
          🔄 Refresh
        </button>
        <button v-if="isSuperadmin" @click="downloadHtml" class="btn-control" title="Download HTML">
          📥 Download
        </button>
        <button @click="extractCss" class="btn-control" title="Extract inline CSS into separate CSS node">
          🎨 Extract CSS
        </button>
        <span v-if="isSuperadmin" class="version-badge" :title="`Current: v${nodeVersion}, Latest: v${latestVersion || '...'}`">v{{ nodeVersion }}</span>
        <button v-if="isSuperadmin && upgradeAvailable" @click="upgradeHtmlNode" class="btn-control btn-upgrade" :disabled="upgrading" :title="`Upgrade template from v${nodeVersion} to v${latestVersion}`">
          {{ upgrading ? 'Upgrading...' : `Upgrade to v${latestVersion}` }}
        </button>
        <button @click="deleteNode" class="btn-control btn-delete" title="Delete HTML Node">
          🗑️ Delete
        </button>
      </div>
    </div>

    <div class="html-container" :class="{ fullscreen: isFullscreen }">
      <button
        v-if="isFullscreen"
        @click="toggleFullscreen"
        class="exit-fullscreen-btn"
        title="Exit Fullscreen (Esc)"
      >
        ✕ Exit Fullscreen
      </button>

      <iframe
        v-if="htmlUrl"
        :src="htmlUrl"
        class="html-iframe"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox allow-presentation"
        :title="node.label || 'HTML Content'"
      ></iframe>

      <div v-else class="html-empty">
        No HTML content available.
      </div>
    </div>

    <div v-if="isFullscreen" class="fullscreen-backdrop" @click="toggleFullscreen"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useUserStore } from '../../stores/userStore'
import { useKnowledgeGraphStore } from '../../stores/knowledgeGraphStore'

const userStore = useUserStore()
const knowledgeGraphStore = useKnowledgeGraphStore()

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  isPreview: {
    type: Boolean,
    default: false
  },
  showControls: {
    type: Boolean,
    default: true
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] })
  }
})

const emit = defineEmits(['node-deleted', 'node-updated'])

const htmlUrl = ref('')
const isFullscreen = ref(false)
const latestVersion = ref('')
const upgrading = ref(false)

// Detect template version and template ID from the html-node's info
const nodeVersion = computed(() => {
  const html = props.node?.info || ''
  const match = html.match(/<meta\s+name="template-version"\s+content="([^"]+)"/)
  return match ? match[1] : 'none'
})

const nodeTemplateId = computed(() => {
  const html = props.node?.info || ''
  const match = html.match(/<meta\s+name="template-id"\s+content="([^"]+)"/)
  return match ? match[1] : 'editable-page'
})

const upgradeAvailable = computed(() => {
  if (!latestVersion.value || !nodeVersion.value) return false
  return latestVersion.value !== nodeVersion.value && nodeVersion.value !== 'none' || (nodeVersion.value === 'none' && latestVersion.value)
})

// Fetch latest template version on mount (template-aware)
const fetchLatestVersion = async () => {
  try {
    const res = await fetch(`https://agent.vegvisr.org/template-version?templateId=${nodeTemplateId.value}`)
    if (res.ok) {
      const data = await res.json()
      latestVersion.value = data.version || ''
    }
  } catch (e) {
    // silently fail
  }
}

const upgradeHtmlNode = async () => {
  const graphId = knowledgeGraphStore.currentGraphId
  if (!graphId || !props.node?.id) return
  if (!confirm(`Upgrade template from v${nodeVersion.value} to v${latestVersion.value}? Content nodes are preserved.`)) return

  upgrading.value = true
  try {
    const res = await fetch('https://agent.vegvisr.org/upgrade-html-node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graphId, nodeId: props.node.id })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Upgrade failed')

    // Emit update to refresh the view
    emit('node-updated', { ...props.node, info: undefined, action: 'upgraded', message: data.message })
    // Force page reload to show new template
    window.location.reload()
  } catch (err) {
    alert('Upgrade failed: ' + err.message)
  } finally {
    upgrading.value = false
  }
}
const GRAPH_ID_DECLARATION_REGEX = /\b((?:const|let|var)\s+GRAPH_ID\s*=\s*)(['"`])[^'"`\r\n]*\2/g
const GRAPH_ID_ANY_DECLARATION_REGEX = /\b((?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*)(['"`])graph_[A-Za-z0-9_:-]+\2/g
const GRAPH_ID_QUERY_PARAM_REGEX = /([?&]id=)(graph_[A-Za-z0-9_:-]+)/g

const isSuperadmin = computed(() => {
  return userStore.role === 'Superadmin'
})

const applyGraphIdBindings = (rawHtml, graphId) => {
  if (typeof rawHtml !== 'string' || !graphId) return rawHtml
  let html = rawHtml.replace(/\{\{GRAPH_ID\}\}/g, graphId)
  html = html.replace(GRAPH_ID_DECLARATION_REGEX, (_, prefix, quote) => `${prefix}${quote}${graphId}${quote}`)
  html = html.replace(GRAPH_ID_ANY_DECLARATION_REGEX, (_, prefix, quote) => `${prefix}${quote}${graphId}${quote}`)
  html = html.replace(GRAPH_ID_QUERY_PARAM_REGEX, (_, prefix) => `${prefix}${graphId}`)
  return html
}

// Storage helper script to inject into HTML content
const getStorageHelperScript = (nodeId) => `
<script>
// Cloud Storage Helper for HTML Node
// Node ID: ${nodeId}
(function() {
  const NODE_ID = '${nodeId}';
  const USER_API_BASE = 'https://api.vegvisr.org/api/user-app/data';
  const STORAGE_TOKEN = window.__VEGVISR_STORAGE_TOKEN || null;
  let requestCounter = 0;

  function unwrapResponse(result) {
    if (!result) return null;
    if (result.data && result.data.data !== undefined) return result.data.data;
    if (result.data !== undefined) return result.data;
    return result;
  }

  function sendToParent(action, payload) {
    if (!window.parent || window.parent === window) {
      return Promise.reject(new Error('No parent storage bridge'));
    }

    return new Promise((resolve, reject) => {
      const requestId = 'storage_' + (++requestCounter) + '_' + Date.now();

      const handler = (event) => {
        if (event.data.type === 'CLOUD_STORAGE_RESPONSE' && event.data.requestId === requestId) {
          window.removeEventListener('message', handler);
          if (event.data.success) {
            resolve(event.data.data);
          } else {
            reject(new Error(event.data.error || 'Request failed'));
          }
        }
      };

      window.addEventListener('message', handler);

      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Storage request timeout'));
      }, 15000);

      window.parent.postMessage({
        type: 'CLOUD_STORAGE_REQUEST',
        requestId,
        payload: { action, appId: NODE_ID, ...payload }
      }, '*');
    });
  }

  async function sendToApi(action, payload) {
    if (!STORAGE_TOKEN) {
      throw new Error('No storage token available');
    }

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + STORAGE_TOKEN
    };

    switch (action) {
      case 'save': {
        const response = await fetch(\`\${USER_API_BASE}/set\`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ appId: NODE_ID, key: payload.key, value: payload.value })
        });
        return await response.json();
      }
      case 'load': {
        const url = new URL(\`\${USER_API_BASE}/get\`);
        url.searchParams.set('appId', NODE_ID);
        url.searchParams.set('key', payload.key);
        const response = await fetch(url.toString(), { headers: authHeaders });
        return await response.json();
      }
      case 'loadAll': {
        const url = new URL(\`\${USER_API_BASE}/list\`);
        url.searchParams.set('appId', NODE_ID);
        const response = await fetch(url.toString(), { headers: authHeaders });
        return await response.json();
      }
      case 'delete': {
        const response = await fetch(\`\${USER_API_BASE}/delete\`, {
          method: 'DELETE',
          headers: authHeaders,
          body: JSON.stringify({ appId: NODE_ID, key: payload.key })
        });
        return await response.json();
      }
      default:
        throw new Error('Unknown action: ' + action);
    }
  }

  async function dispatchStorage(action, payload) {
    try {
      return await sendToParent(action, payload);
    } catch (error) {
      if (!STORAGE_TOKEN) {
        throw error;
      }
      console.warn('Storage parent bridge unavailable, using token API:', error);
      return await sendToApi(action, payload);
    }
  }

  // Save data to cloud storage
  async function saveData(key, value) {
    try {
      const result = await dispatchStorage('save', { key, value });
      return result.success !== false;
    } catch (error) {
      console.error('saveData error:', error);
      return false;
    }
  }

  // Load data from cloud storage
  async function loadData(key) {
    try {
      const result = await dispatchStorage('load', { key });
      const data = unwrapResponse(result);
      if (data && data.value !== undefined) {
        try {
          return JSON.parse(data.value);
        } catch {
          return data.value;
        }
      }
      return null;
    } catch (error) {
      console.error('loadData error:', error);
      return null;
    }
  }

  // Load all data for this node
  async function loadAllData() {
    try {
      const result = await dispatchStorage('loadAll', {});
      const items = unwrapResponse(result);
      if (Array.isArray(items)) {
        return items.map(item => ({
          key: item.key,
          value: (() => { try { return JSON.parse(item.value); } catch { return item.value; } })()
        }));
      }
      return [];
    } catch (error) {
      console.error('loadAllData error:', error);
      return [];
    }
  }

  // Delete data from cloud storage
  async function deleteData(key) {
    try {
      const result = await dispatchStorage('delete', { key });
      return result.success !== false;
    } catch (error) {
      console.error('deleteData error:', error);
      return false;
    }
  }

  // Make functions globally accessible
  window.saveData = saveData;
  window.loadData = loadData;
  window.loadAllData = loadAllData;
  window.deleteData = deleteData;

  console.log('✅ Cloud Storage ready for node:', NODE_ID);
  console.log('📦 Available: saveData(key, value), loadData(key), loadAllData(), deleteData(key)');
})();
</scr` + `ipt>
`

// Collect CSS nodes that apply to this HTML node
const collectCssNodes = (nodeId, graphData) => {
  if (!graphData || !graphData.nodes) return []

  // Find all CSS nodes
  const cssNodes = graphData.nodes.filter(n => n.type === 'css-node')
  const styleEdges = Array.isArray(graphData.edges)
    ? graphData.edges.filter((edge) => {
        const edgeType = String(edge?.label || edge?.type || '').toLowerCase()
        return edgeType === 'styles'
      })
    : []
  const cssNodeIdsFromEdges = new Set(
    styleEdges
      .filter((edge) => edge?.target === nodeId && edge?.source)
      .map((edge) => edge.source)
  )

  // Filter by applicability:
  // 1) styles edge: css-node -> html-node
  // 2) metadata.appliesTo includes this nodeId or '*'
  const applicableCss = cssNodes.filter(node => {
    const appliesTo = node.metadata?.appliesTo || []
    return cssNodeIdsFromEdges.has(node.id) || appliesTo.includes(nodeId) || appliesTo.includes('*')
  })

  // Sort by priority (lower priority value = higher priority = loads first)
  applicableCss.sort((a, b) =>
    (a.metadata?.priority || 999) - (b.metadata?.priority || 999)
  )

  console.log(`🎨 Found ${applicableCss.length} applicable CSS nodes for node ${nodeId}`, applicableCss)
  return applicableCss
}

// Inject CSS nodes as <style> tags into HTML content
const injectCssNodes = (htmlContent, nodeId, graphData) => {
  const cssNodes = collectCssNodes(nodeId, graphData)

  if (cssNodes.length === 0) {
    console.log('ℹ️ No CSS nodes to inject for node:', nodeId)
    return htmlContent
  }

  // Build CSS injection HTML
  let cssInjection = '<!-- CSS Nodes Injected by Vegvisr -->\n'
  for (const cssNode of cssNodes) {
    const priority = cssNode.metadata?.priority || 999
    cssInjection += `<style data-css-node-id="${cssNode.id}" data-css-node-label="${cssNode.label}" data-css-priority="${priority}">\n`
    cssInjection += `/* CSS Node: ${cssNode.label} (Priority: ${priority}) */\n`
    cssInjection += cssNode.info || ''
    cssInjection += `\n</style>\n`
  }

  console.log(`💉 Injecting ${cssNodes.length} CSS nodes into HTML`, cssInjection)

  // Try to inject before </head>
  if (htmlContent.includes('</head>')) {
    return htmlContent.replace('</head>', cssInjection + '</head>')
  }

  // Try to inject after <head>
  if (htmlContent.includes('<head>')) {
    return htmlContent.replace('<head>', '<head>\n' + cssInjection)
  }

  // No head tag, inject at top
  console.warn('⚠️ No <head> tag found in HTML, injecting CSS at top')
  return cssInjection + htmlContent
}

// Inject storage helpers into HTML content
const injectStorageHelpers = (htmlContent, nodeId, publishToken = '') => {
  const tokenScript = publishToken
    ? `<scr` + `ipt>window.__VEGVISR_STORAGE_TOKEN=${JSON.stringify(publishToken)};</scr` + `ipt>`
    : ''
  const hasHelpers =
    htmlContent.includes('window.saveData =') || htmlContent.includes('function saveData(')
  const hasToken = htmlContent.includes('__VEGVISR_STORAGE_TOKEN')

  if (hasHelpers) {
    if (!tokenScript || hasToken) {
      return htmlContent
    }

    if (htmlContent.includes('</body>')) {
      return htmlContent.replace('</body>', tokenScript + '</body>')
    }

    if (htmlContent.includes('</html>')) {
      return htmlContent.replace('</html>', tokenScript + '</html>')
    }

    return htmlContent + tokenScript
  }

  const storageScript = getStorageHelperScript(nodeId)
  const payload = tokenScript + storageScript

  // Try to inject before </body>
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', payload + '</body>')
  }

  // Try to inject before </html>
  if (htmlContent.includes('</html>')) {
    return htmlContent.replace('</html>', payload + '</html>')
  }

  // Just append if no closing tags found
  return htmlContent + payload
}

const createHtmlUrl = () => {
  if (!props.node.info) {
    htmlUrl.value = ''
    return
  }

  if (htmlUrl.value && htmlUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(htmlUrl.value)
  }

  let rawHtml = typeof props.node.info === 'string' ? props.node.info : String(props.node.info || '')

  const graphId = knowledgeGraphStore.currentGraphId
  rawHtml = applyGraphIdBindings(rawHtml, graphId)

  // Inject CSS nodes before storage helpers
  let htmlWithCss = injectCssNodes(rawHtml, props.node.id, props.graphData)

  const htmlContent = injectStorageHelpers(htmlWithCss, props.node.id)
  const blob = new Blob([htmlContent], { type: 'text/html' })
  htmlUrl.value = URL.createObjectURL(blob)
}

const refreshHtml = () => {
  createHtmlUrl()
}

const toggleFullscreen = () => {
  if (!props.showControls) return
  isFullscreen.value = !isFullscreen.value
  document.body.style.overflow = isFullscreen.value ? 'hidden' : ''
}

const downloadHtml = () => {
  if (!props.node.info) return
  let rawHtml = typeof props.node.info === 'string' ? props.node.info : String(props.node.info || '')

  const graphId = knowledgeGraphStore.currentGraphId
  rawHtml = applyGraphIdBindings(rawHtml, graphId)

  // Inject CSS nodes before downloading (Phase 5)
  let htmlWithCss = injectCssNodes(rawHtml, props.node.id, props.graphData)

  const htmlContent = injectStorageHelpers(htmlWithCss, props.node.id)
  const blob = new Blob([htmlContent], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.node.label || 'html-node'}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const deleteNode = () => {
  if (!props.showControls) return
  if (confirm('Are you sure you want to delete this node?')) {
    emit('node-deleted', props.node.id)
  }
}

const editNode = () => {
  if (!props.showControls || props.isPreview) return
  emit('node-updated', { ...props.node, action: 'edit' })
}

// Extract CSS from inline <style> tags in HTML
const extractCssFromHtml = (htmlContent) => {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
  const matches = htmlContent.matchAll(styleRegex)
  let extractedCss = ''

  for (const match of matches) {
    if (match[1]) {
      extractedCss += match[1].trim() + '\n\n'
    }
  }

  return extractedCss.trim()
}

// Remove inline <style> tags from HTML
const removeInlineStyles = (htmlContent) => {
  return htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
}

// Show extraction dialog
const extractCss = () => {
  if (!props.showControls || props.isPreview) return

  const htmlContent = String(props.node.info || '')
  const extractedCss = extractCssFromHtml(htmlContent)

  if (!extractedCss) {
    alert('No <style> tags found in this HTML node.')
    return
  }

  // Show preview and ask for CSS node name
  const cssNodeName = prompt(
    `Found ${extractedCss.split('\n').length} lines of CSS.\n\nEnter a name for the new CSS node:`,
    `${props.node.label || 'HTML'} Styles`
  )

  if (!cssNodeName) return // User cancelled

  // Ask if user wants to remove inline styles
  const removeStyles = confirm(
    'Remove inline <style> tags from HTML node?\n\n(CSS will be managed separately in the new CSS node)'
  )

  // Emit event to create CSS node and optionally update HTML
  emit('node-updated', {
    action: 'extract-css',
    extractedCss,
    cssNodeName,
    removeInlineStyles: removeStyles,
    sourceNodeId: props.node.id
  })
}

const publishHtml = async () => {
  if (!props.node.info) {
    alert('No HTML content to publish.')
    return
  }

  const savedDomain = localStorage.getItem('gnew-html-publish-domain') || ''
  const hostname = prompt('Publish to domain (e.g., test.slowyou.training):', savedDomain)
  if (!hostname || !hostname.trim()) return

  const cleanHostname = hostname.trim().toLowerCase().replace(/\/+$/, '')
  localStorage.setItem('gnew-html-publish-domain', cleanHostname)

  try {
    let overwrite = false
    try {
      const checkRes = await fetch(
        `https://test.slowyou.training/__html/check?hostname=${encodeURIComponent(cleanHostname)}`,
      )
      if (checkRes.ok) {
        const checkData = await checkRes.json()
        if (checkData?.exists) {
          const confirmOverwrite = confirm(
            `"${cleanHostname}" already has published content. Overwrite it?`,
          )
          if (!confirmOverwrite) return
          overwrite = true
        }
      }
    } catch {
      // If check fails, fall back to publish attempt.
    }

    if (!userStore.emailVerificationToken) {
      throw new Error('Missing authentication token')
    }

    let rawHtml = String(props.node.info || '')

    const graphId = knowledgeGraphStore.currentGraphId
    rawHtml = applyGraphIdBindings(rawHtml, graphId)

    // Inject CSS nodes before publishing (Phase 5)
    let htmlWithCss = injectCssNodes(rawHtml, props.node.id, props.graphData)

    const tokenResponse = await fetch('https://api.vegvisr.org/api/html/publish-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken
      },
      body: JSON.stringify({
        appId: props.node.id,
        ttlDays: 30
      })
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to mint publish token')
    }

    const tokenData = await tokenResponse.json()
    if (!tokenData?.token) {
      throw new Error('Missing publish token')
    }

    const htmlContent = injectStorageHelpers(htmlWithCss, props.node.id, tokenData.token)
    const response = await fetch('https://test.slowyou.training/__html/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostname: cleanHostname,
        html: htmlContent,
        overwrite,
        graphId: knowledgeGraphStore.currentGraphId || '',
        nodeId: props.node.id || ''
      }),
    })

    if (!response.ok) {
      if (response.status === 409) {
        const confirmOverwrite = confirm(
          `"${cleanHostname}" already has published content. Overwrite it?`,
        )
        if (!confirmOverwrite) return
        const retry = await fetch('https://test.slowyou.training/__html/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hostname: cleanHostname,
            html: htmlContent,
            overwrite: true,
            graphId: knowledgeGraphStore.currentGraphId || '',
            nodeId: props.node.id || ''
          }),
        })
        if (!retry.ok) {
          throw new Error(`Publish failed (${retry.status})`)
        }
      } else {
        throw new Error(`Publish failed (${response.status})`)
      }
    }

    emit('node-updated', {
      ...props.node,
      publishedDomain: cleanHostname,
      publishedAt: new Date().toISOString(),
    })
    alert(`Published to https://${cleanHostname}/`)
  } catch (error) {
    console.error('Publish HTML error:', error)
    alert('Publish failed. Please try again.')
  }
}

watch(() => props.node.info, () => {
  createHtmlUrl()
})

// Watch graphData changes to re-inject CSS when CSS nodes are added/updated
watch(() => props.graphData, () => {
  createHtmlUrl()
}, { deep: true })

onMounted(() => {
  createHtmlUrl()
  fetchLatestVersion()
})

onBeforeUnmount(() => {
  if (htmlUrl.value && htmlUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(htmlUrl.value)
  }
})
</script>

<style scoped>
.gnew-html-node {
  margin-bottom: 20px;
}

.html-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.html-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.html-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.publish-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  background: #e6f4ea;
  color: #146c2e;
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid #b7e1c2;
}

.publish-badge:hover {
  background: #d7efe0;
  color: #0f5223;
}

.html-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-control {
  background: #f1f3f5;
  border: 1px solid #dee2e6;
  padding: 6px 10px;
  font-size: 0.85rem;
  border-radius: 6px;
  cursor: pointer;
}

.btn-control:hover {
  background: #e9ecef;
}

.btn-delete {
  background: #ffe3e3;
  border-color: #ffa8a8;
}

.version-badge {
  padding: 2px 8px;
  font-size: 11px;
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 4px;
  color: #1565c0;
  font-family: monospace;
}

.btn-upgrade {
  background: #e8f5e9;
  border-color: #81c784;
  color: #2e7d32;
}

.btn-upgrade:hover {
  background: #c8e6c9;
}

.html-container {
  position: relative;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
  min-height: 640px;
}

.html-container.fullscreen {
  position: fixed;
  inset: 20px;
  z-index: 10000;
}

.html-iframe {
  width: 100%;
  height: 100%;
  min-height: 640px;
  border: none;
  display: block;
}

.html-empty {
  padding: 24px;
  color: #6c757d;
  text-align: center;
}

.exit-fullscreen-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.fullscreen-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 9999;
}
</style>
