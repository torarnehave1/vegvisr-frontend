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
          <p class="manager-description">
            Create and manage advertisements for this knowledge graph
          </p>
        </div>
      </div>

      <!-- Quick Create New Advertisement -->
      <div class="quick-create-section">
        <div class="quick-create-header">
          <h5>➕ Create New Advertisement</h5>
          <button @click="addNewAd" class="btn btn-sm btn-success">+ Add Advertisement</button>
        </div>
      </div>

      <!-- Advertisements List with Inline Editing -->
      <div v-if="advertisements.length > 0" class="advertisements-list">
        <h5>📋 Current Advertisements</h5>

        <div v-for="(ad, index) in advertisements" :key="ad.id || index" class="advertisement-item">
          <div class="ad-header">
            <div class="ad-status-badge" :class="'status-' + ad.status">{{ ad.status }}</div>
            <div class="ad-controls">
              <button @click="saveAd(ad)" class="btn btn-xs btn-primary" :disabled="ad.saving">
                {{ ad.saving ? '💾 Saving...' : '💾 Save' }}
              </button>
              <button @click="deleteAd(index)" class="btn btn-xs btn-danger">🗑️</button>
            </div>
          </div>

          <!-- Inline Advertisement Editor -->
          <div class="ad-editor">
            <div class="form-row">
              <div class="form-group">
                <label>Campaign Title:</label>
                <input
                  v-model="ad.title"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Enter campaign title..."
                />
              </div>
              <div class="form-group">
                <label>Budget ($):</label>
                <input
                  v-model.number="ad.budget"
                  type="number"
                  class="form-control form-control-sm"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <!-- Content Editor with FANCY support -->
            <div class="form-group">
              <label>Advertisement Content:</label>
              <div class="content-editor-enhanced">
                <textarea
                  v-model="ad.content"
                  class="form-control content-textarea"
                  placeholder="Enter your advertisement content... Use [FANCY] elements for rich formatting!"
                  rows="4"
                ></textarea>
                <div class="content-tools">
                  <button
                    type="button"
                    @click="insertFancyTemplate(index)"
                    class="btn btn-xs btn-outline-primary"
                    title="Insert FANCY element template"
                  >
                    ✨ Add FANCY Element
                  </button>
                  <button
                    type="button"
                    @click="insertImage(index)"
                    class="btn btn-xs btn-outline-secondary"
                    title="Insert image markdown"
                  >
                    🖼️ Add Image
                  </button>
                </div>
              </div>
              <small class="form-text text-muted">
                💡 Tip: Use [FANCY] elements for styled content. Example: [FANCY | font-size: 2em;
                color: #007bff; text-align: center]Your Title[END FANCY]
              </small>
            </div>

            <!-- Additional Fields -->
            <div class="form-row">
              <div class="form-group">
                <label>Target Audience:</label>
                <input
                  v-model="ad.target_audience"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Describe target audience..."
                />
              </div>
              <div class="form-group">
                <label>Status:</label>
                <select v-model="ad.status" class="form-control form-control-sm">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>

            <!-- Live Preview -->
            <div v-if="ad.content" class="ad-preview">
              <label>Live Preview:</label>
              <div class="preview-banner">
                <div class="preview-header">
                  <span class="preview-title">{{ ad.title || 'Advertisement Title' }}</span>
                  <span class="preview-sponsored">Sponsored</span>
                </div>
                <div class="preview-content">
                  <GNewDefaultNode
                    :node="{ info: ad.content }"
                    :showControls="false"
                    class="preview-fancy-content"
                  />
                </div>
                <div class="preview-actions">
                  <button class="preview-cta">Learn More</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-advertisements">
        <div class="empty-icon">📢</div>
        <p>No advertisements created yet</p>
        <p class="empty-hint">Click "Add Advertisement" above to create your first advertisement</p>
      </div>

      <!-- Actions -->
      <div class="manager-actions">
        <button
          @click="refreshAds"
          class="btn btn-sm btn-outline-secondary"
          title="Refresh advertisement list"
        >
          🔄 Refresh from API
        </button>
      </div>
    </div>

    <!-- Node Type Badge -->
    <div v-if="showControls" class="node-type-badge">advertisement_manager</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import GNewDefaultNode from '@/components/GNewNodes/GNewDefaultNode.vue'

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
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Store
const knowledgeGraphStore = useKnowledgeGraphStore()

// State
const advertisements = ref([])
const loading = ref(false)

// Computed
const nodeTitle = computed(() => props.node.label || 'Advertisement Manager')
const nodeTypeClass = computed(() => `node-type-${props.node.type || 'advertisement_manager'}`)
const knowledgeGraphId = computed(() => {
  // Get knowledge graph ID from props first, then store, then URL
  if (props.graphId) return props.graphId

  // Try to get from knowledge graph store
  if (knowledgeGraphStore.currentGraphId) return knowledgeGraphStore.currentGraphId

  // Fallback to URL parsing (for GNewViewer with ?graphId= parameter)
  const urlParams = new URLSearchParams(window.location.search)
  const graphIdFromUrl = urlParams.get('graphId') || urlParams.get('id')
  if (graphIdFromUrl) return graphIdFromUrl

  // Last resort: parse from pathname
  const pathSegments = window.location.pathname.split('/')
  return pathSegments[pathSegments.length - 1]
})

// Methods
const editNode = () => {
  emit('node-updated', props.node)
}

const deleteNode = () => {
  emit('node-deleted', props.node)
}

// Add new advertisement
const addNewAd = () => {
  const newAd = {
    id: null, // Will be set when saved to API
    title: '',
    content: '',
    target_audience: '',
    budget: 0,
    status: 'draft',
    saving: false,
  }
  advertisements.value.push(newAd)
}

// Save advertisement
const saveAd = async (ad) => {
  if (!ad.title || !ad.content) {
    alert('Please fill in title and content')
    return
  }

  ad.saving = true

  try {
    const payload = {
      knowledge_graph_id: knowledgeGraphId.value,
      title: ad.title,
      content: ad.content,
      ad_type: 'banner',
      target_audience: ad.target_audience,
      budget: ad.budget,
      status: ad.status,
    }

    console.log('📢 Saving advertisement:', payload)

    const url = ad.id
      ? `https://advertisement-worker.torarnehave.workers.dev/api/advertisements/${ad.id}`
      : 'https://advertisement-worker.torarnehave.workers.dev/api/advertisements'

    const method = ad.id ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      const result = await response.json()
      console.log('📢 Advertisement saved successfully:', result)

      // Update the ad with the returned ID if it's new
      if (!ad.id && result.id) {
        ad.id = result.id
      }

      alert('Advertisement saved successfully!')
    } else {
      const errorData = await response.json()
      console.error('Failed to save advertisement:', errorData)
      alert(`Failed to save advertisement: ${errorData.error || 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Error saving advertisement:', error)
    alert('Failed to save advertisement. Please try again.')
  } finally {
    ad.saving = false
  }
}

// Delete advertisement
const deleteAd = async (index) => {
  const ad = advertisements.value[index]

  if (!confirm(`Are you sure you want to delete "${ad.title}"?`)) {
    return
  }

  if (ad.id) {
    try {
      const response = await fetch(
        `https://advertisement-worker.torarnehave.workers.dev/api/advertisements/${ad.id}`,
        { method: 'DELETE' },
      )

      if (response.ok) {
        console.log('📢 Advertisement deleted from API')
      } else {
        console.error('Failed to delete from API, removing locally anyway')
      }
    } catch (error) {
      console.error('Error deleting from API:', error)
    }
  }

  // Remove from local array
  advertisements.value.splice(index, 1)
}

// Insert FANCY template
const insertFancyTemplate = (index) => {
  const fancyTemplates = [
    {
      name: 'Header Title',
      template:
        '[FANCY | font-size: 2.5em; color: #007bff; text-align: center; font-weight: bold; margin: 20px 0]\nYour Header Title Here\n[END FANCY]',
    },
    {
      name: 'Call to Action',
      template:
        '[FANCY | font-size: 1.3em; color: white; background: linear-gradient(45deg, #28a745, #20c997); text-align: center; padding: 15px; border-radius: 8px; font-weight: bold]\n🚀 Get Started Today!\n[END FANCY]',
    },
    {
      name: 'Price Tag',
      template:
        '[FANCY | font-size: 1.8em; color: #dc3545; background: #fff3cd; text-align: center; padding: 10px; border-radius: 6px; border: 2px solid #ffc107]\n💰 Starting at $29/month\n[END FANCY]',
    },
    {
      name: 'Feature Highlight',
      template:
        '[FANCY | font-size: 1.2em; color: #6f42c1; background: #f8f9fa; text-align: center; padding: 12px; border-left: 4px solid #6f42c1]\n✨ Premium Feature Available\n[END FANCY]',
    },
  ]

  // Show template selector
  const selectedTemplate = prompt(
    'Select a FANCY template:\n' +
      fancyTemplates.map((t, i) => `${i + 1}. ${t.name}`).join('\n') +
      '\nEnter number (1-' +
      fancyTemplates.length +
      '):',
  )

  const templateIndex = parseInt(selectedTemplate) - 1
  if (templateIndex >= 0 && templateIndex < fancyTemplates.length) {
    const template = fancyTemplates[templateIndex].template
    const ad = advertisements.value[index]

    // Insert template
    if (ad.content) {
      ad.content += '\n\n' + template
    } else {
      ad.content = template
    }
  }
}

// Insert image markdown
const insertImage = (index) => {
  const imageUrl = prompt('Enter image URL:')
  if (imageUrl) {
    const ad = advertisements.value[index]
    const imageMarkdown = `![Advertisement Image](${imageUrl})`

    if (ad.content) {
      ad.content += '\n\n' + imageMarkdown
    } else {
      ad.content = imageMarkdown
    }
  }
}

// Refresh advertisements from API
const refreshAds = async () => {
  if (!knowledgeGraphId.value) return

  loading.value = true
  try {
    const response = await fetch(
      `https://advertisement-worker.torarnehave.workers.dev/api/advertisements?knowledge_graph_id=${knowledgeGraphId.value}`,
    )
    if (response.ok) {
      const result = await response.json()
      console.log('📢 Fetched advertisements:', result)

      // Handle different response formats and add saving state
      let fetchedAds = []
      if (Array.isArray(result)) {
        fetchedAds = result
      } else if (result.data && Array.isArray(result.data)) {
        fetchedAds = result.data
      } else if (result.results && Array.isArray(result.results)) {
        fetchedAds = result.results
      } else {
        console.warn('Unexpected response format for advertisements:', result)
        fetchedAds = []
      }

      // Add saving state to each ad
      advertisements.value = fetchedAds.map((ad) => ({
        ...ad,
        saving: false,
      }))
    }
  } catch (error) {
    console.error('Failed to fetch advertisements:', error)
  } finally {
    loading.value = false
  }
}

// Lifecycle
onMounted(() => {
  refreshAds()
})
</script>

<style scoped>
.gnew-advertisement-manager-node {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  position: relative;
}

/* Node Header Styles */
.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e9ecef;
}

.node-title-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.node-title {
  margin: 0;
  color: #2c3e50;
  font-size: 1.4rem;
  font-weight: 600;
}

.node-title-row {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e9ecef;
}

.node-title-row .node-title {
  margin: 0;
  color: #2c3e50;
  font-size: 1.3rem;
  font-weight: 600;
}

.node-type-badge-inline {
  background: linear-gradient(45deg, #007bff, #6610f2);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.node-controls {
  display: flex;
  gap: 8px;
}

/* Manager Header */
.manager-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 25px;
  padding: 15px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 8px;
  border-left: 4px solid #007bff;
}

.manager-icon {
  font-size: 2rem;
}

.manager-info h4 {
  margin: 0 0 5px 0;
  color: #2c3e50;
  font-size: 1.2rem;
}

.manager-description {
  margin: 0;
  color: #6c757d;
  font-size: 0.9rem;
}

/* Quick Create Section */
.quick-create-section {
  margin-bottom: 25px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.quick-create-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.quick-create-header h5 {
  margin: 0;
  color: #28a745;
  font-size: 1.1rem;
}

/* Advertisements List */
.advertisements-list {
  margin-bottom: 25px;
}

.advertisements-list h5 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.advertisement-item {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  margin-bottom: 20px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.ad-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  border-radius: 8px 8px 0 0;
}

.ad-status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-active {
  background: #d4edda;
  color: #155724;
}

.status-draft {
  background: #fff3cd;
  color: #856404;
}

.status-paused {
  background: #f8d7da;
  color: #721c24;
}

.ad-controls {
  display: flex;
  gap: 8px;
}

/* Advertisement Editor */
.ad-editor {
  padding: 15px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 150px;
  gap: 15px;
  margin-bottom: 15px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #2c3e50;
  font-size: 0.9rem;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: border-color 0.15s ease-in-out;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-control-sm {
  padding: 6px 10px;
  font-size: 0.85rem;
}

/* Content Editor */
.content-editor-enhanced {
  position: relative;
}

.content-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  resize: vertical;
  min-height: 100px;
}

.content-tools {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.form-text {
  font-size: 0.8rem;
  color: #6c757d;
  margin-top: 5px;
}

/* Live Preview */
.ad-preview {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #dee2e6;
}

.ad-preview label {
  display: block;
  margin-bottom: 10px;
  font-weight: 600;
  color: #2c3e50;
}

.preview-banner {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.preview-title {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1.1rem;
}

.preview-sponsored {
  background: #6c757d;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.preview-content {
  margin: 10px 0;
}

.preview-fancy-content {
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

.preview-actions {
  display: flex;
  justify-content: flex-start;
  margin-top: 10px;
}

.preview-cta {
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
}

/* Empty State */
.empty-advertisements {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.empty-hint {
  font-size: 0.9rem;
  margin-top: 10px;
}

/* Manager Actions */
.manager-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding-top: 15px;
  border-top: 1px solid #e9ecef;
}

/* Button Styles */
.btn {
  display: inline-block;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-xs {
  padding: 4px 8px;
  font-size: 0.75rem;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.btn-primary {
  background: #007bff;
  border-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
  border-color: #0056b3;
}

.btn-success {
  background: #28a745;
  border-color: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #218838;
  border-color: #218838;
}

.btn-danger {
  background: #dc3545;
  border-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
  border-color: #c82333;
}

.btn-outline-primary {
  background: transparent;
  border-color: #007bff;
  color: #007bff;
}

.btn-outline-primary:hover:not(:disabled) {
  background: #007bff;
  color: white;
}

.btn-outline-secondary {
  background: transparent;
  border-color: #6c757d;
  color: #6c757d;
}

.btn-outline-secondary:hover:not(:disabled) {
  background: #6c757d;
  color: white;
}

.btn-outline-danger {
  background: transparent;
  border-color: #dc3545;
  color: #dc3545;
}

.btn-outline-danger:hover:not(:disabled) {
  background: #dc3545;
  color: white;
}

/* Node Type Badge */
.node-type-badge {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.1);
  color: #666;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-family: monospace;
}

/* Responsive */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .node-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .quick-create-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .ad-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .content-tools {
    flex-direction: column;
  }
}
</style>
