<template>
  <div class="gnew-admin">
    <!-- Header Section -->
    <div class="admin-header">
      <div class="header-content">
        <div class="title-section">
          <h1 class="admin-title">
            <span class="title-icon">🧠</span>
            Graph Admin
          </h1>
          <p class="admin-subtitle">
            Create and manage your knowledge graphs
            <span v-if="userStore.role === 'Superadmin'" class="superadmin-badge">
              ⚡ Advanced Mode
            </span>
          </p>
        </div>

        <!-- User Role Indicator -->
        <div class="user-info">
          <span class="user-role">{{ userStore.role || 'User' }}</span>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="admin-content">
      <!-- Action Bar -->
      <div class="action-bar">
        <!-- Primary Actions -->
        <div class="primary-actions">
          <button @click="createNewGraph" class="btn btn-create-graph" :disabled="isCreating">
            <span class="btn-icon">🆕</span>
            <span class="btn-text">Create New Graph</span>
            <span v-if="isCreating" class="spinner-border spinner-border-sm ms-2"></span>
          </button>
        </div>

        <!-- Graph Selection -->
        <div class="graph-selection">
          <div class="current-graph-info">
            <label class="graph-label">Current Graph:</label>
            <div class="graph-display">
              <span v-if="currentGraph" class="graph-name">
                {{ currentGraph.title || 'Untitled Graph' }}
              </span>
              <span v-else class="no-graph">No graph selected</span>
            </div>
          </div>

          <button @click="openGraphSelector" class="btn btn-select-graph" :disabled="loading">
            <span class="btn-icon">📋</span>
            <span class="btn-text">Select Different Graph</span>
          </button>
        </div>

        <!-- Save Actions -->
        <div class="save-actions">
          <button @click="saveGraph" class="btn btn-save" :disabled="!hasChanges || saving">
            <span class="btn-icon">💾</span>
            <span class="btn-text">Save Changes</span>
            <span v-if="saving" class="spinner-border spinner-border-sm ms-2"></span>
          </button>

          <!-- Auto-save indicator -->
          <div v-if="autoSaveEnabled" class="auto-save-indicator">
            <span class="auto-save-text">Auto-save: ON</span>
            <span v-if="lastSaved" class="last-saved">
              Last saved: {{ formatTime(lastSaved) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="loading-text">Loading graph data...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <div class="alert alert-danger">
          <h5>❌ Error</h5>
          <p>{{ error }}</p>
          <button @click="retryLoad" class="btn btn-outline-danger">Retry</button>
        </div>
      </div>

      <!-- Graph Preview -->
      <div v-else-if="currentGraph" class="graph-preview">
        <div class="preview-header">
          <h3 class="preview-title">
            <span class="preview-icon">👁️</span>
            Live Preview
          </h3>
          <div class="graph-stats">
            <span class="stat-item">
              <span class="stat-label">Nodes:</span>
              <span class="stat-value">{{ graphData.nodes.length }}</span>
            </span>
            <span class="stat-item">
              <span class="stat-label">Edges:</span>
              <span class="stat-value">{{ graphData.edges?.length || 0 }}</span>
            </span>
          </div>
        </div>

        <!-- Graph Content -->
        <div class="graph-content">
          <div v-if="graphData.nodes.length > 0" class="nodes-container">
            <GNewNodeRenderer
              v-for="node in graphData.nodes"
              :key="node.id"
              :node="node"
              :showControls="userStore.role === 'Superadmin'"
              @node-updated="handleNodeUpdated"
              @node-deleted="handleNodeDeleted"
              @node-created="handleNodeCreated"
            />
          </div>
          <div v-else class="empty-graph">
            <div class="empty-icon">📝</div>
            <h4>Empty Graph</h4>
            <p>This graph doesn't have any content yet.</p>
            <button
              v-if="userStore.role === 'Superadmin'"
              @click="addFirstNode"
              class="btn btn-primary"
            >
              Add First Node
            </button>
          </div>
        </div>
      </div>

      <!-- No Graph Selected -->
      <div v-else class="no-graph-state">
        <div class="empty-icon">🎯</div>
        <h4>No Graph Selected</h4>
        <p>Create a new graph or select an existing one to get started.</p>
        <div class="quick-actions">
          <button @click="createNewGraph" class="btn btn-primary btn-lg">
            🆕 Create New Graph
          </button>
          <button @click="openGraphSelector" class="btn btn-outline-primary btn-lg">
            📋 Browse Existing Graphs
          </button>
        </div>
      </div>

      <!-- Success Messages -->
      <div v-if="successMessage" class="alert alert-success alert-dismissible fade show">
        {{ successMessage }}
        <button @click="successMessage = ''" type="button" class="btn-close"></button>
      </div>

      <!-- Superadmin Advanced Panel -->
      <div v-if="userStore.role === 'Superadmin' && currentGraph" class="advanced-panel">
        <div class="panel-header">
          <h4>⚡ Advanced Tools</h4>
          <button @click="showAdvanced = !showAdvanced" class="btn btn-sm btn-outline-secondary">
            {{ showAdvanced ? 'Hide' : 'Show' }} Advanced
          </button>
        </div>

        <div v-show="showAdvanced" class="advanced-content">
          <div class="advanced-actions">
            <button @click="openFullAdmin" class="btn btn-outline-primary">
              🔧 Full Admin Interface
            </button>
            <button @click="exportGraph" class="btn btn-outline-secondary">📤 Export Graph</button>
            <button @click="showGraphMetadata" class="btn btn-outline-info">
              ℹ️ Graph Details
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Graph Selector Modal (will be implemented in next phase) -->
    <!-- <GraphSelectorModal v-if="showGraphSelector" @close="closeGraphSelector" @select="selectGraph" /> -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { useUserStore } from '@/stores/userStore'
import GNewNodeRenderer from '@/components/GNewNodeRenderer.vue'

// Router and Stores
const router = useRouter()
const graphStore = useKnowledgeGraphStore()
const userStore = useUserStore()

// State
const loading = ref(false)
const error = ref('')
const isCreating = ref(false)
const saving = ref(false)
const hasChanges = ref(false)
const successMessage = ref('')
const showAdvanced = ref(false)
const lastSaved = ref(null)
const autoSaveEnabled = ref(true)

// Graph data
const currentGraph = ref(null)
const graphData = ref({ nodes: [], edges: [] })

// Computed
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString()
}

// Methods
const createNewGraph = async () => {
  if (isCreating.value) return

  isCreating.value = true
  try {
    // Create new graph with basic structure
    const newGraph = {
      title: `New Graph ${new Date().toLocaleDateString()}`,
      description: 'Created with GnewAdmin',
      createdBy: userStore.user?.email || 'user',
      nodes: [
        {
          id: 'welcome-node',
          type: 'title',
          label: 'Welcome to Your New Graph!',
          info: 'This is your first node. You can edit, delete, or add more nodes.',
          color: '#007bff',
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    }

    // Save to backend and update store
    const savedGraph = await graphStore.saveNewGraph(newGraph)

    if (savedGraph) {
      currentGraph.value = savedGraph
      graphData.value = { nodes: savedGraph.nodes || [], edges: savedGraph.edges || [] }
      successMessage.value = 'New graph created successfully!'

      // Clear success message after 3 seconds
      setTimeout(() => {
        successMessage.value = ''
      }, 3000)
    }
  } catch (err) {
    error.value = 'Failed to create new graph: ' + err.message
  } finally {
    isCreating.value = false
  }
}

const openGraphSelector = () => {
  // TODO: Implement in next phase
  console.log('Graph selector modal will be implemented in Phase 2')
}

const saveGraph = async () => {
  if (saving.value || !currentGraph.value) return

  saving.value = true
  try {
    const updateData = {
      id: currentGraph.value.id,
      graphData: graphData.value,
    }

    await graphStore.saveGraph(updateData)
    hasChanges.value = false
    lastSaved.value = Date.now()
    successMessage.value = 'Graph saved successfully!'

    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    error.value = 'Failed to save graph: ' + err.message
  } finally {
    saving.value = false
  }
}

const retryLoad = () => {
  error.value = ''
  loadCurrentGraph()
}

const loadCurrentGraph = async () => {
  loading.value = true
  try {
    // Load current graph from store
    if (graphStore.currentGraphId) {
      const graph = await graphStore.loadGraph(graphStore.currentGraphId)
      if (graph) {
        currentGraph.value = graph
        graphData.value = {
          nodes: graph.nodes || [],
          edges: graph.edges || [],
        }
      }
    }
  } catch (err) {
    error.value = 'Failed to load graph: ' + err.message
  } finally {
    loading.value = false
  }
}

// Node event handlers
const handleNodeUpdated = (updatedNode) => {
  const nodeIndex = graphData.value.nodes.findIndex((n) => n.id === updatedNode.id)
  if (nodeIndex !== -1) {
    graphData.value.nodes[nodeIndex] = updatedNode
    hasChanges.value = true
  }
}

const handleNodeDeleted = (nodeId) => {
  graphData.value.nodes = graphData.value.nodes.filter((n) => n.id !== nodeId)
  hasChanges.value = true
}

const handleNodeCreated = (newNode) => {
  graphData.value.nodes.push(newNode)
  hasChanges.value = true
}

const addFirstNode = () => {
  const newNode = {
    id: `node-${Date.now()}`,
    type: 'fulltext',
    label: 'New Node',
    info: 'Click edit to add your content here.',
    color: '#28a745',
    position: { x: 0, y: 0 },
  }
  handleNodeCreated(newNode)
}

// Advanced features for Superadmin
const openFullAdmin = () => {
  router.push('/admin')
}

const exportGraph = () => {
  // TODO: Implement export functionality
  console.log('Export functionality will be added later')
}

const showGraphMetadata = () => {
  // TODO: Implement metadata modal
  console.log('Graph metadata modal will be added later')
}

// Lifecycle
onMounted(() => {
  loadCurrentGraph()
})

// Auto-save watcher
watch(
  () => graphData.value,
  (newData) => {
    if (autoSaveEnabled.value && hasChanges.value && currentGraph.value) {
      // Debounced auto-save (implement later)
      // autoSave()
    }
  },
  { deep: true },
)
</script>

<style scoped>
.gnew-admin {
  min-height: 100vh;
  background: #f8f9fa;
  padding: 0;
}

/* Header */
.admin-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem 0;
  margin-bottom: 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-section {
  flex: 1;
}

.admin-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title-icon {
  font-size: 1.8rem;
}

.admin-subtitle {
  margin: 0.5rem 0 0 0;
  font-size: 1.1rem;
  opacity: 0.9;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.superadmin-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.user-info {
  text-align: right;
}

.user-role {
  background: rgba(255, 255, 255, 0.15);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 500;
  font-size: 0.9rem;
}

/* Main Content */
.admin-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

/* Action Bar */
.action-bar {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: grid;
  gap: 1.5rem;
}

.primary-actions .btn-create-graph {
  background: linear-gradient(45deg, #28a745, #20c997);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.btn-create-graph:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.4);
}

.graph-selection {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.current-graph-info {
  flex: 1;
}

.graph-label {
  font-weight: 600;
  color: #495057;
  margin-bottom: 0.25rem;
  display: block;
}

.graph-name {
  font-size: 1.1rem;
  color: #007bff;
  font-weight: 500;
}

.no-graph {
  color: #6c757d;
  font-style: italic;
}

.btn-select-graph {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.btn-select-graph:hover:not(:disabled) {
  background: #0056b3;
  transform: translateY(-1px);
}

.save-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-save {
  background: linear-gradient(45deg, #007bff, #6610f2);
  color: white;
  border: none;
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.btn-save:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auto-save-indicator {
  font-size: 0.875rem;
  color: #28a745;
}

.auto-save-text {
  font-weight: 600;
}

.last-saved {
  color: #6c757d;
  margin-left: 0.5rem;
}

/* States */
.loading-state,
.error-state,
.no-graph-state {
  text-align: center;
  padding: 3rem 1rem;
}

.loading-text {
  margin-top: 1rem;
  color: #6c757d;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.quick-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
}

/* Graph Preview */
.graph-preview {
  background: white;
  border-radius: 12px;
  padding: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.preview-title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #495057;
}

.graph-stats {
  display: flex;
  gap: 1rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.stat-label {
  font-weight: 600;
  color: #6c757d;
  font-size: 0.875rem;
}

.stat-value {
  font-weight: 700;
  color: #007bff;
}

.graph-content {
  padding: 1.5rem;
}

.empty-graph {
  text-align: center;
  padding: 3rem 1rem;
  color: #6c757d;
}

.empty-graph .empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

/* Advanced Panel */
.advanced-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #ffc107;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.panel-header h4 {
  margin: 0;
  color: #495057;
}

.advanced-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

/* Responsive Design */
@media (max-width: 768px) {
  .admin-header {
    padding: 1rem 0;
  }

  .header-content {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .admin-title {
    font-size: 1.5rem;
  }

  .action-bar {
    padding: 1rem;
    grid-template-columns: 1fr;
  }

  .graph-selection {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .quick-actions {
    flex-direction: column;
    align-items: center;
  }

  .quick-actions .btn {
    width: 100%;
    max-width: 300px;
  }

  .save-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .graph-stats {
    flex-direction: column;
    gap: 0.5rem;
  }

  .preview-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .advanced-actions {
    flex-direction: column;
  }

  .advanced-actions .btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .admin-content {
    padding: 0 0.5rem;
  }

  .action-bar {
    margin-bottom: 1rem;
  }

  .btn-create-graph {
    font-size: 1rem;
    padding: 0.65rem 1.25rem;
  }
}

/* Button Icons */
.btn-icon {
  font-size: 1.1em;
}

.btn-text {
  font-weight: 600;
}

/* Alert styling */
.alert {
  border-radius: 8px;
  margin-bottom: 1rem;
}

/* Spinner */
.spinner-border-sm {
  width: 1rem;
  height: 1rem;
}
</style>
