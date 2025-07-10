<template>
  <div class="gnew-action-test-node">
    <!-- Node Header -->
    <div class="node-header">
      <div class="node-title">
        <span class="node-icon">⚡</span>
        <span class="node-label">{{ node.label || 'AI Action Node' }}</span>
        <span class="node-type-badge">ACTION_TEST</span>
      </div>
      <div v-if="showControls" class="node-controls">
        <button @click="editNode" class="btn-control edit" title="Edit Node">
          <i class="bi bi-pencil"></i>
        </button>
        <button @click="deleteNode" class="btn-control delete" title="Delete Node">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>

    <!-- AI Provider Section -->
    <div class="control-section ai-provider-section">
      <h6 class="section-title">
        <span class="section-icon">🤖</span>
        AI Provider
      </h6>
      <div class="provider-dropdown">
        <select
          v-model="selectedProvider"
          @change="updateEndpoint"
          class="form-control provider-select"
        >
          <option value="cloudflare">🔥 Cloudflare Workers AI (Fast & Free)</option>
          <option value="claude">🧠 Claude AI (Advanced Reasoning)</option>
          <option value="grok">🤔 Grok AI (Philosophical Insights)</option>
          <option value="gemini">⚡ Google Gemini (Fast Responses)</option>
          <option value="generic">⚙️ Generic AI (Custom Formatting)</option>
        </select>
      </div>
      <div class="endpoint-display">
        <small class="text-muted">Endpoint: {{ currentEndpoint }}</small>
      </div>
    </div>

    <!-- Query Configuration Section -->
    <div class="control-section query-section">
      <h6 class="section-title">
        <span class="section-icon">💭</span>
        AI Query
      </h6>
      <div class="query-preview">
        <div class="query-text">{{ displayQuery }}</div>
        <button
          v-if="hasLongQuery || showFullQuery"
          @click="showFullQuery = !showFullQuery"
          class="btn-expand"
        >
          {{ showFullQuery ? 'Show Less' : 'Show More' }}
        </button>
      </div>
      <div v-if="showFullQuery" class="full-query">
        <textarea
          v-model="localQuery"
          @input="updateQuery"
          @blur="updateQuery"
          class="form-control query-textarea"
          rows="4"
          placeholder="Enter your AI query or prompt here..."
        ></textarea>
      </div>
    </div>

    <!-- Response Configuration Section -->
    <div class="control-section response-config-section">
      <h6 class="section-title">
        <span class="section-icon">⚙️</span>
        Response Configuration
      </h6>
      <div class="config-grid">
        <div class="config-item">
          <label class="config-label">Return Type:</label>
          <select
            v-model="returnType"
            @change="updateReturnType"
            class="form-control config-select"
          >
            <option value="fulltext">📄 Fulltext (Final Answer)</option>
            <option value="action">🔄 Action (Continue Chain)</option>
            <option value="both">📄+🔄 Both (Answer + Follow-up)</option>
          </select>
        </div>
        <div class="config-item">
          <label class="config-label">Graph Context:</label>
          <div class="form-check form-switch">
            <input
              v-model="includeGraphContext"
              @change="updateGraphContext"
              class="form-check-input"
              type="checkbox"
              id="graphContext"
            />
            <label class="form-check-label" for="graphContext">
              Include current graph in AI context
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Buttons Section -->
    <div class="control-section action-section">
      <div class="action-buttons">
        <button
          @click="triggerAIResponse"
          :disabled="isLoading || (!localQuery && !node.info)"
          class="btn btn-primary ai-response-btn"
        >
          <span v-if="isLoading" class="spinner-border spinner-border-sm me-2"></span>
          <span class="btn-icon">🚀</span>
          {{ isLoading ? 'Getting Response...' : 'Get AI Response' }}
        </button>
        <button @click="editQuery" class="btn btn-outline-secondary">
          <span class="btn-icon">✏️</span>
          Edit Query
        </button>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="loading-text">{{ loadingMessage }}</p>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="alert alert-danger error-alert">
      <strong>❌ Error:</strong> {{ error }}
      <button @click="clearError" class="btn-close"></button>
    </div>

    <!-- Success Display -->
    <div v-if="successMessage" class="alert alert-success success-alert">
      <strong>✅ Success:</strong> {{ successMessage }}
      <button @click="clearSuccess" class="btn-close"></button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  showControls: {
    type: Boolean,
    default: true,
  },
})

// Emits
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Reactive data
const selectedProvider = ref('cloudflare') // Default to Cloudflare Workers AI
const returnType = ref('fulltext')
const includeGraphContext = ref(false)
const localQuery = ref('')
const showFullQuery = ref(false)
const isLoading = ref(false)
const loadingMessage = ref('')
const error = ref('')
const successMessage = ref('')

// AI Provider configurations
const aiProviders = {
  cloudflare: {
    name: '🔥 Cloudflare Workers AI',
    endpoint: 'https://knowledge.vegvisr.org/generate-worker-ai',
    description: 'Fast & Free',
  },
  claude: {
    name: '🧠 Claude AI',
    endpoint: 'https://api.vegvisr.org/claude-test',
    description: 'Advanced Reasoning',
  },
  grok: {
    name: '🤔 Grok AI',
    endpoint: 'https://api.vegvisr.org/groktest',
    description: 'Philosophical Insights',
  },
  gemini: {
    name: '⚡ Google Gemini',
    endpoint: 'https://api.vegvisr.org/gemini-test',
    description: 'Fast Responses',
  },
  generic: {
    name: '⚙️ Generic AI',
    endpoint: 'https://api.vegvisr.org/aiaction',
    description: 'Custom Formatting',
  },
}

// Computed properties
const currentEndpoint = computed(() => {
  return aiProviders[selectedProvider.value]?.endpoint || props.node.label
})

const displayQuery = computed(() => {
  const query = localQuery.value || props.node.info
  if (!query || query.trim() === '') {
    return 'No query set - click "Edit Query" to add your AI prompt'
  }
  return query.length > 150 ? query.substring(0, 150) + '...' : query
})

const hasLongQuery = computed(() => {
  const query = localQuery.value || props.node.info
  return query && query.length > 150
})

// Initialize component state
onMounted(() => {
  // Set initial values from node data
  localQuery.value = props.node.info || ''
  returnType.value = props.node.returnType || 'fulltext'
  includeGraphContext.value = props.node.includeGraphContext || false

  // Detect current provider from endpoint
  detectProviderFromEndpoint()
})

// Watch for node changes
watch(
  () => props.node,
  (newNode) => {
    localQuery.value = newNode.info || ''
    returnType.value = newNode.returnType || 'fulltext'
    includeGraphContext.value = newNode.includeGraphContext || false
    detectProviderFromEndpoint()
  },
  { deep: true },
)

// Methods
const detectProviderFromEndpoint = () => {
  const currentEndpoint = props.node.label
  for (const [key, provider] of Object.entries(aiProviders)) {
    if (currentEndpoint === provider.endpoint) {
      selectedProvider.value = key
      return
    }
  }
  // If no match found, default to cloudflare
  selectedProvider.value = 'cloudflare'
}

const updateEndpoint = () => {
  const newEndpoint = aiProviders[selectedProvider.value].endpoint
  const updatedNode = {
    ...props.node,
    label: newEndpoint,
  }
  emit('node-updated', updatedNode)
}

const updateQuery = () => {
  const updatedNode = {
    ...props.node,
    info: localQuery.value.trim(),
  }
  emit('node-updated', updatedNode)
}

const updateReturnType = () => {
  const updatedNode = {
    ...props.node,
    returnType: returnType.value,
  }
  emit('node-updated', updatedNode)
}

const updateGraphContext = () => {
  const updatedNode = {
    ...props.node,
    includeGraphContext: includeGraphContext.value,
  }
  emit('node-updated', updatedNode)
}

const editQuery = () => {
  showFullQuery.value = true
  // Focus on the textarea after it's rendered
  setTimeout(() => {
    const textarea = document.querySelector('.query-textarea')
    if (textarea) {
      textarea.focus()
    }
  }, 100)
}

const editNode = () => {
  // Emit edit event or open edit modal
  console.log('Edit node:', props.node.id)
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this AI action node?')) {
    emit('node-deleted', props.node.id)
  }
}

const clearError = () => {
  error.value = ''
}

const clearSuccess = () => {
  successMessage.value = ''
}

const triggerAIResponse = async () => {
  // Use current localQuery value (user's actual input) instead of potentially stale node.info
  const currentQuery = localQuery.value || props.node.info

  if (!currentQuery || !currentQuery.trim()) {
    error.value = 'Please enter a query before getting AI response'
    return
  }

  try {
    isLoading.value = true
    loadingMessage.value = `Sending query to ${aiProviders[selectedProvider.value].name}...`
    error.value = ''
    successMessage.value = ''

    // Prepare the request payload with current query
    const payload = {
      prompt: currentQuery.trim(),
      returnType: returnType.value,
      includeGraphContext: includeGraphContext.value,
      nodeId: props.node.id,
    }

    // Add graph context if requested
    if (includeGraphContext.value) {
      // Note: Graph context would need to be passed down from parent
      // For now, we'll skip graph context in GNew until it's properly implemented
      console.log('Graph context requested but not yet implemented in GNew')
    }

    loadingMessage.value = 'Processing AI response...'

    // Debug log to verify correct query is being sent
    console.log('🚀 Sending AI Query:', currentQuery.trim())

    // Make API call
    const response = await fetch(currentEndpoint.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    loadingMessage.value = 'Creating response nodes...'

    // Handle different return types based on actual API response format
    if (returnType.value === 'both' && result.type === 'both') {
      // API returns {type: 'both', fulltext: {...}, action: {...}}
      if (result.fulltext) {
        await createResponseNode(result.fulltext.info, 'fulltext', result.fulltext)
      }
      if (result.action) {
        await createResponseNode(result.action.info, 'action_test', result.action)
      }
    } else if (
      returnType.value === 'fulltext' ||
      (returnType.value === 'both' && result.type === 'fulltext')
    ) {
      // API returns direct node object: {id, label, type, info, color, bibl}
      await createResponseNode(result.info, 'fulltext', result)
    } else if (returnType.value === 'action' || result.type === 'action_test') {
      // API returns direct action node object
      await createResponseNode(result.info, 'action_test', result)
    }

    successMessage.value = `AI response generated successfully using ${aiProviders[selectedProvider.value].name}`
  } catch (err) {
    console.error('AI Response Error:', err)
    error.value = err.message || 'Failed to get AI response'
  } finally {
    isLoading.value = false
    loadingMessage.value = ''
  }
}

const createResponseNode = async (content, nodeType, apiNodeData = null) => {
  const newNode = {
    id: apiNodeData?.id || `${nodeType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    label: apiNodeData?.label || (nodeType === 'fulltext' ? 'AI Response' : 'AI Follow-up'),
    info: content,
    type: nodeType,
    color: apiNodeData?.color || (nodeType === 'fulltext' ? '#2ecc71' : '#ff9500'),
    visible: true,
    x: (props.node.x || 0) + 200,
    y: (props.node.y || 0) + 100,
  }

  // Add bibliographic references if available
  if (apiNodeData?.bibl && Array.isArray(apiNodeData.bibl)) {
    newNode.bibl = apiNodeData.bibl
  }

  // Emit the new node to parent component (GNewViewer) for handling
  emit('node-created', newNode)
}
</script>

<style scoped>
.gnew-action-test-node {
  background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
  border: 2px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  margin: 15px 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.gnew-action-test-node:hover {
  border-color: #ff9500;
  box-shadow: 0 6px 12px rgba(255, 149, 0, 0.15);
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e9ecef;
}

.node-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.node-icon {
  font-size: 1.5rem;
  background: linear-gradient(45deg, #ff9500, #ffb347);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.node-label {
  font-weight: 600;
  font-size: 1.1rem;
  color: #2c3e50;
}

.node-type-badge {
  background: linear-gradient(45deg, #ff9500, #ffb347);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.node-controls {
  display: flex;
  gap: 8px;
}

.btn-control {
  background: none;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #6c757d;
}

.btn-control:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.btn-control.edit:hover {
  color: #007bff;
  border-color: #007bff;
}

.btn-control.delete:hover {
  color: #dc3545;
  border-color: #dc3545;
}

.control-section {
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  transition: border-color 0.2s ease;
}

.control-section:hover {
  border-color: #ff9500;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.95rem;
}

.section-icon {
  font-size: 1rem;
}

.ai-provider-section {
  border-left: 4px solid #ff9500;
}

.query-section {
  border-left: 4px solid #3498db;
}

.response-config-section {
  border-left: 4px solid #9b59b6;
}

.action-section {
  border-left: 4px solid #27ae60;
}

.provider-select {
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.9rem;
  transition: border-color 0.2s ease;
}

.provider-select:focus {
  border-color: #ff9500;
  box-shadow: 0 0 0 0.2rem rgba(255, 149, 0, 0.25);
}

.endpoint-display {
  margin-top: 8px;
  padding: 6px;
  background: #f8f9fa;
  border-radius: 4px;
}

.query-preview {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
}

.query-text {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
  color: #2c3e50;
  line-height: 1.4;
}

.btn-expand {
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  font-size: 0.8rem;
  margin-top: 8px;
}

.full-query {
  margin-top: 12px;
}

.query-textarea {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  resize: vertical;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-label {
  font-weight: 500;
  font-size: 0.9rem;
  color: #495057;
}

.config-select {
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.9rem;
}

.form-check {
  margin-top: 4px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
}

.ai-response-btn {
  background: linear-gradient(45deg, #ff9500, #ffb347);
  border: none;
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.ai-response-btn:hover:not(:disabled) {
  background: linear-gradient(45deg, #e8890c, #ff9500);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(255, 149, 0, 0.3);
}

.ai-response-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  margin-right: 6px;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  z-index: 10;
}

.loading-content {
  text-align: center;
}

.loading-text {
  margin-top: 12px;
  font-weight: 500;
  color: #495057;
}

.error-alert,
.success-alert {
  margin-top: 16px;
  border-radius: 6px;
  position: relative;
}

.btn-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  opacity: 0.6;
}

.btn-close:hover {
  opacity: 1;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .config-grid {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
    align-items: stretch;
  }

  .node-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>
