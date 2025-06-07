<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal-content">
      <h3>Enhanced Vegvisr AI Node Creation</h3>

      <!-- Template Gallery -->
      <div class="form-group">
        <button @click="showTemplates = !showTemplates" class="btn btn-outline-secondary mb-3">
          {{ showTemplates ? 'Hide Templates' : 'Show Templates' }}
        </button>
      </div>

      <!-- Template Gallery (conditionally rendered) -->
      <div v-if="showTemplates" class="template-gallery">
        <div class="gallery-header">
          <h4>Choose a Template</h4>
          <button
            @click="refreshTemplates"
            class="btn btn-sm btn-outline-secondary me-2"
            :disabled="isLoadingTemplates"
          >
            <span v-if="isLoadingTemplates" class="spinner-border spinner-border-sm me-1"></span>
            Refresh
          </button>
        </div>
        <!-- Loading state -->
        <div v-if="isLoadingTemplates" class="template-loading">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading templates...</span>
          </div>
          <p>Loading templates...</p>
        </div>
        <!-- Error state -->
        <div v-else-if="templateError" class="template-error">
          <div class="alert alert-danger">
            <p>{{ templateError }}</p>
            <button @click="refreshTemplates" class="btn btn-sm btn-outline-danger">Retry</button>
          </div>
        </div>
        <!-- Template grid -->
        <div v-else class="template-grid">
          <div
            v-for="template in templates"
            :key="template.id"
            class="template-card"
            :class="{ selected: selectedTemplate?.id === template.id }"
            @click="selectTemplate(template)"
          >
            <div class="template-thumbnail">
              <img
                :src="template.thumbnail_path || '/default-template.png'"
                :alt="template.name"
                @error="handleImageError"
              />
              <div class="template-category">{{ template.category }}</div>
            </div>
            <div class="template-info">
              <h5>{{ template.name }}</h5>
              <p>{{ template.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- History Section -->
      <div v-if="showHistory" class="history-section">
        <div class="history-header">
          <h4>Previous Requests</h4>
          <button @click="showHistory = false" class="btn btn-sm btn-link">Hide History</button>
        </div>
        <div class="history-list">
          <div v-for="item in nodeHistory" :key="item.id" class="history-item">
            <div class="history-content">
              <p class="request-text">{{ item.request_text }}</p>
              <small class="timestamp">{{ formatDate(item.created_at) }}</small>
            </div>
            <button @click="usePreviousRequest(item)" class="btn btn-sm btn-outline-primary">
              Use
            </button>
          </div>
        </div>
      </div>

      <!-- Main Form -->
      <div class="form-group">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <label for="aiNodeRequest">What would you like to create?</label>
          <button v-if="!showHistory" @click="showHistory = true" class="btn btn-sm btn-link">
            Show History
          </button>
        </div>
        <textarea
          id="aiNodeRequest"
          v-model="aiNodeRequest"
          class="form-control"
          rows="3"
          placeholder="Describe what you want to create...."
        ></textarea>
      </div>

      <!-- Save Preferences -->
      <div class="form-group">
        <div class="form-check">
          <input
            type="checkbox"
            id="saveToHistory"
            v-model="saveToHistory"
            class="form-check-input"
          />
          <label class="form-check-label" for="saveToHistory"> Save to History </label>
        </div>
        <div class="form-check">
          <input
            type="checkbox"
            id="rememberPreference"
            v-model="rememberPreference"
            class="form-check-input"
          />
          <label class="form-check-label" for="rememberPreference"> Remember my preference </label>
        </div>
      </div>

      <!-- Share Options (if saved) -->
      <div v-if="saveToHistory" class="form-group">
        <div class="form-check">
          <input
            type="checkbox"
            id="shareWithCommunity"
            v-model="shareWithCommunity"
            class="form-check-input"
          />
          <label class="form-check-label" for="shareWithCommunity"> Share with Community </label>
        </div>
        <div class="form-check">
          <input type="checkbox" id="anonymize" v-model="anonymize" class="form-check-input" />
          <label class="form-check-label" for="anonymize"> Anonymize my request </label>
        </div>
      </div>

      <!-- Preview Section -->
      <div v-if="aiNodePreview" class="node-preview">
        <h4>Preview:</h4>
        <div class="preview-content">
          <textarea v-model="aiNodePreview" class="form-control" rows="10" readonly></textarea>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="modal-actions">
        <button
          v-if="!aiNodePreview"
          @click="generateNode"
          class="btn btn-primary"
          :disabled="!aiNodeRequest || isGenerating"
        >
          <span
            v-if="isGenerating"
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></span>
          {{ isGenerating ? 'Generating...' : 'Generate' }}
        </button>
        <button v-if="aiNodePreview" @click="insertNode" class="btn btn-success">
          Insert Node
        </button>
        <button @click="close" class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  graphContext: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'node-inserted'])
const userStore = useUserStore()

// State
const aiNodeRequest = ref('')
const aiNodePreview = ref(null)
const isGenerating = ref(false)
const saveToHistory = ref(true)
const rememberPreference = ref(false)
const shareWithCommunity = ref(false)
const anonymize = ref(false)
const showHistory = ref(false)
const nodeHistory = ref([])

// Template state
const templates = ref([])
const selectedTemplate = ref(null)
const isLoadingTemplates = ref(false)
const templateError = ref(null)

// Cache for templates
const templateCache = {
  data: null,
  timestamp: null,
  maxAge: 5 * 60 * 1000, // 5 minutes
}

// Load templates with retry mechanism
const loadTemplates = async (retryCount = 0) => {
  try {
    isLoadingTemplates.value = true
    templateError.value = null

    // Check cache first
    if (templateCache.data && templateCache.timestamp) {
      const age = Date.now() - templateCache.timestamp
      if (age < templateCache.maxAge) {
        templates.value = templateCache.data
        isLoadingTemplates.value = false
        return
      }
    }

    console.log('Fetching templates from knowledge worker...')

    const templatesResponse = await fetch('https://knowledge.vegvisr.org/getAITemplates', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
        Accept: 'application/json',
        Origin: window.location.origin,
      },
      mode: 'cors',
      credentials: 'include',
    })

    console.log('Template response status:', templatesResponse.status)

    if (!templatesResponse.ok) {
      const errorText = await templatesResponse.text()
      console.error('Template response error:', errorText)
      throw new Error(`Failed to load templates: ${templatesResponse.status} - ${errorText}`)
    }

    const data = await templatesResponse.json()
    console.log('Template response data:', data)

    if (!data.results) {
      console.error('Invalid template response format:', data)
      throw new Error('Invalid response format: missing results array')
    }

    // Update cache
    templateCache.data = data.results
    templateCache.timestamp = Date.now()

    templates.value = data.results
    console.log('Successfully loaded templates:', templates.value.length)
  } catch (error) {
    console.error('Detailed error loading templates:', error)

    // More specific error messages
    if (error.message.includes('Failed to fetch')) {
      templateError.value =
        'Unable to connect to the template server. Please check if the worker is deployed and running.'
    } else if (error.message.includes('401') || error.message.includes('403')) {
      templateError.value = 'Authentication failed. Please check your API token.'
    } else if (error.message.includes('404')) {
      templateError.value = 'Template endpoint not found. Please check the worker deployment.'
    } else if (error.message.includes('CORS')) {
      templateError.value =
        'CORS error: Unable to access the template server. Please check the server configuration.'
    } else {
      templateError.value = `Failed to load templates: ${error.message}`
    }

    // Retry logic with exponential backoff
    if (retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
      console.log(`Retrying template load (${retryCount + 1}/3) in ${delay}ms...`)
      setTimeout(() => loadTemplates(retryCount + 1), delay)
    } else {
      console.error('Max retries reached. Could not load templates.')
      // Show a more helpful error message
      templateError.value +=
        '\nPlease try:\n1. Checking if the worker is deployed\n2. Verifying your API token\n3. Checking your network connection\n4. Ensuring CORS is properly configured on the server'
    }
  } finally {
    isLoadingTemplates.value = false
  }
}

// Add a manual refresh function
const refreshTemplates = () => {
  templateCache.data = null
  templateCache.timestamp = null
  loadTemplates()
}

// Load templates on mount
onMounted(async () => {
  await loadTemplates()

  try {
    // Load preferences and history
    const prefsResponse = await fetch('https://api.vegvisr.org/user-preferences', {
      headers: {
        'X-API-Token': userStore.emailVerificationToken,
      },
    })
    if (prefsResponse.ok) {
      const prefs = await prefsResponse.json()
      saveToHistory.value = prefs.default_save_history
      shareWithCommunity.value = prefs.default_share_history
    }

    const historyResponse = await fetch('https://api.vegvisr.org/ai-node-history', {
      headers: {
        'X-API-Token': userStore.emailVerificationToken,
      },
    })
    if (historyResponse.ok) {
      const data = await historyResponse.json()
      nodeHistory.value = data.history || []
    }
  } catch (error) {
    console.error('Error loading data:', error)
  }
})

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const usePreviousRequest = (item) => {
  aiNodeRequest.value = item.request_text
  showHistory.value = false
}

const generateNode = async () => {
  try {
    isGenerating.value = true

    const response = await fetch('https://api.vegvisr.org/ai-generate-node', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify({
        userRequest: aiNodeRequest.value,
        graphContext: props.graphContext,
        is_saved: saveToHistory.value,
        share_settings: {
          is_public: shareWithCommunity.value,
          anonymize: anonymize.value,
        },
      }),
    })

    const text = await response.text()
    console.log('API Response:', text)

    if (!response.ok) {
      try {
        const errorData = JSON.parse(text)
        throw new Error(errorData.message || 'Failed to generate AI node')
      } catch (parseError) {
        console.error('Error parsing error response:', parseError)
        throw new Error(`Failed to generate AI node: ${text}`)
      }
    }

    try {
      const data = JSON.parse(text)
      if (!data || !data.node) {
        throw new Error('Invalid response format: missing node data')
      }
      aiNodePreview.value = JSON.stringify(data.node, null, 2)
    } catch (parseError) {
      console.error('Error parsing success response:', parseError)
      throw new Error('Invalid response format from server')
    }

    // Save preferences if requested
    if (rememberPreference.value) {
      await fetch('https://api.vegvisr.org/user-preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Token': userStore.emailVerificationToken,
        },
        body: JSON.stringify({
          default_save_history: saveToHistory.value,
          default_share_history: shareWithCommunity.value,
        }),
      })
    }
  } catch (error) {
    console.error('Error generating node:', error)
    alert(`Error: ${error.message}`)
  } finally {
    isGenerating.value = false
  }
}

const insertNode = () => {
  if (aiNodePreview.value) {
    try {
      const nodeData = JSON.parse(aiNodePreview.value)
      emit('node-inserted', { ...nodeData, visible: true })
      close()
    } catch (error) {
      console.error('Error parsing node data:', error)
      alert('Invalid node data. Please check the preview and try again.')
    }
  }
}

const close = () => {
  aiNodeRequest.value = ''
  aiNodePreview.value = null
  isGenerating.value = false
  showHistory.value = false
  emit('close')
}

// Handle image loading errors
const handleImageError = (event) => {
  event.target.src = '/default-template.png'
}

// Add state for showing/hiding templates
const showTemplates = ref(false)

const selectTemplate = (template) => {
  selectedTemplate.value = template
  if (template.standard_question) {
    aiNodeRequest.value = template.standard_question
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.node-preview {
  margin-top: 20px;
}

.preview-content {
  margin-top: 10px;
}

.history-section {
  margin-bottom: 20px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.history-header h4 {
  margin: 0;
}

.history-list {
  max-height: 300px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.history-content {
  flex: 1;
  margin-right: 10px;
}

.request-text {
  margin: 0;
  font-size: 0.9em;
}

.timestamp {
  color: #666;
  font-size: 0.8em;
}

.gallery-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.gallery-controls .form-select,
.gallery-controls .form-control {
  min-width: 150px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.template-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
  width: 180px;
  margin: 0 auto;
}

.template-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.template-card.selected {
  border-color: #4a90e2;
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
}

.template-thumbnail {
  position: relative;
  width: 120px;
  height: 120px;
  max-width: 120px;
  max-height: 120px;
  overflow: hidden;
  background-color: #f8f9fa;
  margin: 16px auto 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-thumbnail img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  transition: transform 0.3s ease;
}

.template-card:hover .template-thumbnail img {
  transform: scale(1.05);
}

.template-category {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  text-transform: uppercase;
  backdrop-filter: blur(4px);
}

.template-info {
  padding: 12px;
}

.template-info h5 {
  margin: 0 0 8px 0;
  font-size: 1rem;
  color: #333;
}

.template-info p {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
  line-height: 1.4;
}

.gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.gallery-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.gallery-controls .form-select,
.gallery-controls .form-control {
  min-width: 150px;
}

.template-loading,
.template-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.template-loading p {
  margin-top: 1rem;
  color: #666;
}

.template-error .alert {
  max-width: 400px;
  margin: 0 auto;
}

.template-error button {
  margin-top: 1rem;
}
</style>
