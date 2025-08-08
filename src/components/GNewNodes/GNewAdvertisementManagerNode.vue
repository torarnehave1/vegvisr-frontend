<template>
  <div class="gnew-advertisement-manager-node" :class="nodeTypeClass">
    <!-- Node Header - Following GNewDefaultNode pattern -->
    <div v-if="showControls && nodeTitle" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ nodeTitle }}</h3>
        <!-- Node Type Badge inline with title -->
        <div class="node-type-badge-inline">📢 Advertisement Manager</div>
      </div>
      <div v-if="!isPreview" class="node-controls">
        <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Node">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Node">
          🗑️
        </button>
      </div>
    </div>

    <!-- Title only (for non-control mode) -->
    <div v-else-if="nodeTitle" class="node-title-row">
      <h3 class="node-title">{{ nodeTitle }}</h3>
    </div>

    <!-- Advertisement Manager Interface -->
    <div class="advertisement-manager-content">
      <div class="manager-header">
        <div class="manager-icon">📢</div>
        <div class="manager-info">
          <h4>Advertisement Manager</h4>
          <p class="manager-description">Manage advertisements for this knowledge graph</p>
        </div>
      </div>

      <!-- Advertisements List -->
      <div v-if="advertisements.length > 0" class="advertisements-list">
        <h5>📋 Current Advertisements</h5>
        <div v-for="ad in advertisements" :key="ad.id" class="advertisement-item">
          <div class="ad-info">
            <strong>{{ ad.title }}</strong>
            <span class="ad-status" :class="'status-' + ad.status">{{ ad.status }}</span>
          </div>
          <div class="ad-content">{{ ad.content?.substring(0, 100) }}...</div>
          <div class="ad-meta">
            <span v-if="ad.target_audience">👥 {{ ad.target_audience }}</span>
            <span v-if="ad.budget">💰 ${{ ad.budget }}</span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-advertisements">
        <div class="empty-icon">📢</div>
        <p>No advertisements created yet</p>
        <p class="empty-hint">Use the worker API to create advertisements bound to this graph</p>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button
          v-if="showControls"
          @click="openCreateModal"
          class="btn btn-sm btn-primary"
          title="Create new advertisement"
        >
          ➕ Create Advertisement
        </button>
        <button
          @click="refreshAds"
          class="btn btn-sm btn-outline-secondary"
          title="Refresh advertisement list"
        >
          🔄 Refresh
        </button>
      </div>
    </div>

    <!-- Node Type Badge -->
    <div v-if="showControls" class="node-type-badge">advertisement_manager</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] }),
  },
  showControls: {
    type: Boolean,
    default: true,
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  graphId: {
    type: String,
    default: '',
  },
})

// Emits
const emit = defineEmits(['node-updated', 'node-deleted'])

// State
const advertisements = ref([])
const loading = ref(false)

// Computed
const nodeTitle = computed(() => props.node.label || 'Advertisement Manager')
const nodeTypeClass = computed(() => `node-type-${props.node.type || 'advertisement_manager'}`)
const knowledgeGraphId = computed(() => {
  // Get knowledge graph ID from current context
  return props.graphId || window.location.pathname.split('/').pop()
})

// Methods
const editNode = () => {
  emit('node-updated', props.node)
}

const deleteNode = () => {
  emit('node-deleted', props.node)
}

const openCreateModal = () => {
  // Simple alert for now - can be enhanced later
  alert(
    'Advertisement creation will open a form to create advertisements bound to this knowledge graph',
  )
}

const refreshAds = async () => {
  if (!knowledgeGraphId.value) return

  loading.value = true
  try {
    // Fetch advertisements from the worker API
    const response = await fetch(
      `https://advertisement-worker.torarnehave.workers.dev/api/advertisements?knowledge_graph_id=${knowledgeGraphId.value}`,
    )
    if (response.ok) {
      advertisements.value = await response.json()
    }
  } catch (error) {
    console.error('Failed to fetch advertisements:', error)
  } finally {
    loading.value = false
  }
}

// Lifecycle
onMounted(() => {
  if (!props.isPreview) {
    refreshAds()
  }
})
</script>

<style scoped>
.gnew-advertisement-manager-node {
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.gnew-advertisement-manager-node:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

/* Node Header - consistent with other nodes */
.node-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
}

.node-title-section {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.node-title {
  margin: 0;
  color: #2c3e50;
  font-size: 1.2rem;
  font-weight: 600;
}

.node-title-row {
  margin-bottom: 15px;
}

.node-type-badge-inline {
  background: #e8f5e9;
  color: #4caf50;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.node-controls {
  display: flex;
  gap: 5px;
}

.node-type-badge {
  position: absolute;
  top: 5px;
  right: 5px;
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 500;
}

/* Advertisement Manager Content */
.advertisement-manager-content {
  position: relative;
}

.manager-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  padding: 15px;
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%);
  border-radius: 8px;
  border-left: 4px solid #4caf50;
}

.manager-icon {
  font-size: 2rem;
  color: #4caf50;
}

.manager-info h4 {
  margin: 0 0 5px 0;
  color: #2e7d32;
  font-weight: 600;
}

.manager-description {
  margin: 0;
  color: #558b2f;
  font-size: 0.9rem;
}

/* Advertisements List */
.advertisements-list h5 {
  color: #333;
  margin-bottom: 15px;
  font-weight: 600;
}

.advertisement-item {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
  transition: all 0.2s ease;
}

.advertisement-item:hover {
  background: #f1f3f4;
  border-color: #4caf50;
}

.ad-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ad-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-draft {
  background: #fff3cd;
  color: #856404;
}

.status-active {
  background: #d4edda;
  color: #155724;
}

.status-paused {
  background: #f8d7da;
  color: #721c24;
}

.ad-content {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 8px;
  line-height: 1.4;
}

.ad-meta {
  display: flex;
  gap: 15px;
  font-size: 0.8rem;
  color: #777;
}

/* Empty State */
.empty-advertisements {
  text-align: center;
  padding: 30px 20px;
  color: #666;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 10px;
  opacity: 0.5;
}

.empty-hint {
  font-size: 0.85rem;
  color: #888;
  font-style: italic;
}

/* Quick Actions */
.quick-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #f0f0f0;
}

/* Responsive */
@media (max-width: 768px) {
  .node-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .manager-header {
    flex-direction: column;
    text-align: center;
  }

  .ad-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }

  .quick-actions {
    flex-direction: column;
  }
}
</style>
