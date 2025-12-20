<template>
  <div class="gnew-network-node">
    <div class="network-card">
      <!-- Network Header -->
      <div class="network-header">
        <h3 class="network-title">
          <span class="title-icon">🔗</span>
          {{ title }}
        </h3>
        <div v-if="degreesOfSeparation !== null" class="separation-badge">
          {{ degreesOfSeparation }} {{ degreesOfSeparation === 1 ? 'grad' : 'grader' }}
        </div>
      </div>

      <!-- Network Visualization -->
      <div class="network-path">
        <div
          v-for="(pathNode, index) in pathNodes"
          :key="index"
          class="path-step"
        >
          <!-- Person Node -->
          <div
            v-if="pathNode.type === 'person'"
            class="path-node person-node"
            :class="{ 'endpoint': index === 0 || index === pathNodes.length - 1 }"
            @click="handleNodeClick(pathNode)"
          >
            <div class="node-avatar" :class="pathNode.gender === 'K' ? 'female' : 'male'">
              {{ pathNode.gender === 'K' ? '👩' : '👨' }}
            </div>
            <div class="node-details">
              <span class="node-name">{{ pathNode.name }}</span>
              <span v-if="pathNode.roles && pathNode.roles.length > 0" class="node-role">
                {{ pathNode.roles[0].role }} i {{ pathNode.roles[0].company }}
              </span>
              <span v-if="pathNode.age" class="node-meta">{{ pathNode.age }} år</span>
            </div>
          </div>

          <!-- Company Node -->
          <div
            v-else-if="pathNode.type === 'company'"
            class="path-node company-node"
            @click="handleNodeClick(pathNode)"
          >
            <div class="node-icon company-icon">🏢</div>
            <div class="node-details">
              <span class="node-name">{{ pathNode.name }}</span>
              <span v-if="pathNode.organisationNumber" class="node-org">
                Org.nr: {{ pathNode.organisationNumber }}
              </span>
            </div>
          </div>

          <!-- Connection Arrow -->
          <div v-if="index < pathNodes.length - 1" class="path-connector">
            <div class="connector-line"></div>
            <div class="connector-arrow">→</div>
          </div>
        </div>
      </div>

      <!-- Network Stats -->
      <div v-if="pathDescription" class="network-summary">
        <div class="summary-icon">📊</div>
        <div class="summary-text" v-html="formattedPathDescription"></div>
      </div>

      <!-- Connection Details -->
      <div v-if="connectionDetails.length > 0" class="connection-details">
        <h4 class="section-title">
          <span class="section-icon">🔍</span> Detaljer
        </h4>
        <div class="details-list">
          <div v-for="(detail, index) in connectionDetails" :key="index" class="detail-item">
            <span class="detail-label">{{ detail.label }}</span>
            <span class="detail-value">{{ detail.value }}</span>
          </div>
        </div>
      </div>

      <!-- Additional Paths (if multiple) -->
      <div v-if="alternatePaths.length > 0" class="alternate-paths">
        <h4 class="section-title">
          <span class="section-icon">🔀</span> Alternative forbindelser
        </h4>
        <div class="alt-path-list">
          <div
            v-for="(altPath, index) in alternatePaths"
            :key="index"
            class="alt-path-item"
            @click="selectAlternatePath(index)"
          >
            <span class="alt-path-summary">{{ altPath.summary }}</span>
            <span class="alt-path-degrees">{{ altPath.degrees }} grader</span>
          </div>
        </div>
      </div>

      <!-- Related Links -->
      <div v-if="relatedLinks.length > 0" class="related-links">
        <h4 class="section-title">
          <span class="section-icon">🔗</span> Relaterte lenker
        </h4>
        <div class="links-list">
          <a
            v-for="(link, index) in relatedLinks"
            :key="index"
            :href="link.url"
            target="_blank"
            class="related-link"
          >
            {{ getLinkIcon(link.type) }} {{ link.label }}
          </a>
        </div>
      </div>

      <!-- Insights -->
      <div v-if="insights" class="insights-section">
        <h4 class="section-title">
          <span class="section-icon">💡</span> Innsikt
        </h4>
        <div class="insights-content" v-html="renderedInsights"></div>
      </div>

      <!-- Node Controls -->
      <div v-if="showControls && !isPreview" class="node-controls">
        <button @click="expandNetwork" class="btn btn-sm btn-outline-primary" title="Utvid nettverk">
          🕸️ Utvid
        </button>
        <button @click="editNode" class="btn btn-sm btn-outline-secondary" title="Rediger">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Slett">
          🗑️
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] })
  },
  isPreview: {
    type: Boolean,
    default: false
  },
  showControls: {
    type: Boolean,
    default: true
  },
  graphId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// State
const selectedPathIndex = ref(0)

// Parse node data
const nodeData = computed(() => {
  if (props.node.data && typeof props.node.data === 'object') {
    return props.node.data
  }
  if (props.node.info) {
    try {
      const parsed = JSON.parse(props.node.info)
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    } catch (e) {
      // Not JSON
    }
  }
  return props.node
})

// Computed
const title = computed(() => {
  const data = nodeData.value
  if (data.fromPerson && data.toPerson) {
    return `${data.fromPerson} ↔ ${data.toPerson}`
  }
  return props.node.label || 'Nettverksforbindelse'
})

const degreesOfSeparation = computed(() => {
  return nodeData.value.degreesOfSeparation ?? nodeData.value.degrees ?? null
})

const pathNodes = computed(() => {
  const data = nodeData.value
  // Support both "path" array and direct "nodes" array
  return data.path || data.nodes || []
})

const pathDescription = computed(() => {
  return nodeData.value.pathDescription || nodeData.value.description
})

const formattedPathDescription = computed(() => {
  if (!pathDescription.value) return ''
  // Convert markdown-style bold to HTML
  return pathDescription.value
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/→/g, '<span class="arrow">→</span>')
})

const connectionDetails = computed(() => {
  const data = nodeData.value
  const details = []

  if (data.fromPersonId) {
    details.push({ label: 'Fra PersonId', value: data.fromPersonId })
  }
  if (data.toPersonId) {
    details.push({ label: 'Til PersonId', value: data.toPersonId })
  }
  if (data.country) {
    details.push({ label: 'Land', value: data.country === 'NO' ? 'Norge' : data.country })
  }
  if (data.pathLength) {
    details.push({ label: 'Sti-lengde', value: data.pathLength })
  }

  return details
})

const alternatePaths = computed(() => {
  return nodeData.value.alternatePaths || []
})

const relatedLinks = computed(() => {
  return nodeData.value.links || []
})

const insights = computed(() => {
  if (props.node.info && typeof props.node.info === 'string') {
    try {
      JSON.parse(props.node.info)
      return nodeData.value.insights
    } catch (e) {
      // If info is not JSON and we already have path data, don't use it as insights
      if (pathNodes.value.length > 0) return null
      return props.node.info
    }
  }
  return nodeData.value.insights
})

const renderedInsights = computed(() => {
  if (!insights.value) return ''
  return marked(insights.value)
})

// Helpers
const getLinkIcon = (type) => {
  const icons = {
    'proff': '📊',
    'linkedin': '💼',
    'article': '📰',
    'document': '📄',
    'website': '🌐'
  }
  return icons[type?.toLowerCase()] || '🔗'
}

// Event handlers
const handleNodeClick = (pathNode) => {
  if (pathNode.type === 'person') {
    emit('node-created', {
      type: 'person-profile',
      label: pathNode.name,
      data: {
        personId: pathNode.personId,
        name: pathNode.name,
        age: pathNode.age,
        gender: pathNode.gender,
        roles: pathNode.roles
      }
    })
  } else if (pathNode.type === 'company') {
    emit('node-created', {
      type: 'company-card',
      label: pathNode.name,
      data: {
        name: pathNode.name,
        organisationNumber: pathNode.organisationNumber,
        email: pathNode.email,
        homePage: pathNode.homePage,
        address: pathNode.address
      }
    })
  }
}

const selectAlternatePath = (index) => {
  selectedPathIndex.value = index
  // Could emit an event to load alternate path data
}

const expandNetwork = () => {
  // Emit event to trigger network expansion in parent
  emit('node-updated', {
    ...props.node,
    _action: 'expand-network',
    _expandParams: {
      personIds: pathNodes.value
        .filter(n => n.type === 'person')
        .map(n => n.personId)
    }
  })
}

const editNode = () => {
  emit('node-updated', { ...props.node, _action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Er du sikker på at du vil slette denne noden?')) {
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-network-node {
  margin: 16px 0;
}

.network-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.network-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.network-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  font-size: 1.5rem;
}

.separation-badge {
  padding: 6px 14px;
  background: rgba(255,255,255,0.2);
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
}

/* Network Path Visualization */
.network-path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 24px;
  gap: 8px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
  overflow-x: auto;
}

.path-step {
  display: flex;
  align-items: center;
  gap: 8px;
}

.path-node {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  min-width: 180px;
}

.path-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}

.path-node.endpoint {
  border: 2px solid #667eea;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
}

.person-node .node-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}

.node-avatar.female {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
}

.node-avatar.male {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
}

.company-node .node-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}

.node-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.node-name {
  font-weight: 600;
  color: #2d3748;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-role {
  font-size: 0.8rem;
  color: #718096;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-org {
  font-size: 0.75rem;
  color: #a0aec0;
  font-family: monospace;
}

.node-meta {
  font-size: 0.75rem;
  color: #a0aec0;
}

/* Path Connector */
.path-connector {
  display: flex;
  align-items: center;
  padding: 0 4px;
}

.connector-line {
  width: 20px;
  height: 2px;
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.connector-arrow {
  font-size: 1.2rem;
  color: #667eea;
  font-weight: bold;
}

/* Network Summary */
.network-summary {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  background: #edf2f7;
  border-bottom: 1px solid #e2e8f0;
  align-items: flex-start;
}

.summary-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.summary-text {
  color: #4a5568;
  line-height: 1.6;
  font-size: 0.9rem;
}

.summary-text :deep(.arrow) {
  color: #667eea;
  font-weight: bold;
  margin: 0 4px;
}

.summary-text :deep(strong) {
  color: #2d3748;
}

/* Sections */
.connection-details,
.alternate-paths,
.related-links,
.insights-section {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #4a5568;
}

.section-icon {
  font-size: 1rem;
}

/* Details List */
.details-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  background: #f7fafc;
  border-radius: 8px;
}

.detail-label {
  font-size: 0.75rem;
  color: #718096;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.detail-value {
  font-weight: 600;
  color: #2d3748;
  font-family: monospace;
}

/* Alternate Paths */
.alt-path-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alt-path-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f7fafc;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.alt-path-item:hover {
  background: #edf2f7;
}

.alt-path-summary {
  color: #4a5568;
  font-size: 0.9rem;
}

.alt-path-degrees {
  padding: 4px 10px;
  background: #667eea;
  color: white;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

/* Related Links */
.links-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.related-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #f7fafc;
  border-radius: 8px;
  color: #4a5568;
  text-decoration: none;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.related-link:hover {
  background: #667eea;
  color: white;
}

/* Insights */
.insights-content {
  color: #4a5568;
  line-height: 1.6;
}

/* Controls */
.node-controls {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f7fafc;
}

/* Responsive */
@media (max-width: 768px) {
  .network-path {
    flex-direction: column;
    align-items: stretch;
  }

  .path-step {
    flex-direction: column;
  }

  .path-connector {
    transform: rotate(90deg);
    padding: 8px 0;
  }

  .path-node {
    min-width: 100%;
  }
}
</style>
