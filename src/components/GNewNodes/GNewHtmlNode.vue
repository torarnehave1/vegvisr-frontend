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

const userStore = useUserStore()

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
  }
})

const emit = defineEmits(['node-deleted', 'node-updated'])

const htmlUrl = ref('')
const isFullscreen = ref(false)

const isSuperadmin = computed(() => {
  return userStore.role === 'Superadmin'
})

const createHtmlUrl = () => {
  if (!props.node.info) {
    htmlUrl.value = ''
    return
  }

  if (htmlUrl.value && htmlUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(htmlUrl.value)
  }

  const htmlContent =
    typeof props.node.info === 'string' ? props.node.info : String(props.node.info || '')
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
  const htmlContent =
    typeof props.node.info === 'string' ? props.node.info : String(props.node.info || '')
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

const publishHtml = async () => {
  if (!props.node.info) {
    alert('No HTML content to publish.')
    return
  }

  const savedDomain = localStorage.getItem('gnew-html-publish-domain') || ''
  const hostname = prompt('Publish to domain (e.g., test.slowyou.training):', savedDomain)
  if (!hostname || !hostname.trim()) return

  const cleanHostname = hostname.trim().toLowerCase()
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

    const response = await fetch('https://test.slowyou.training/__html/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostname: cleanHostname,
        html: String(props.node.info || ''),
        overwrite
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
            html: String(props.node.info || ''),
            overwrite: true
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

onMounted(() => {
  createHtmlUrl()
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
