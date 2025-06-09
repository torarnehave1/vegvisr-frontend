<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal-content">
      <button @click="close" class="close-button">&times;</button>
      <h3>🎙️ Automated Transcript to Knowledge Graph</h3>

      <!-- Upload Section -->
      <div v-if="!transcriptText" class="upload-section">
        <div class="form-group">
          <label>Upload Transcript or Paste Text:</label>
          <div class="upload-area" @drop="handleDrop" @dragover.prevent @dragenter.prevent>
            <input
              type="file"
              ref="fileInput"
              @change="handleFileUpload"
              accept=".txt,.md,.doc,.docx,.pdf"
              class="file-input"
            />
            <div class="upload-content">
              <i class="bi bi-cloud-upload upload-icon"></i>
              <p>Drop transcript file here or click to browse</p>
              <small>Supports: .txt, .md, .doc, .docx, .pdf</small>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>Or paste transcript text directly:</label>
          <textarea
            v-model="transcriptText"
            class="form-control"
            rows="8"
            placeholder="Paste your transcript text here..."
          ></textarea>
        </div>
      </div>

      <!-- Processing Controls -->
      <div
        v-if="transcriptText && !isProcessing && !knowledgeGraphPreview"
        class="processing-controls"
      >
        <div class="form-group">
          <label>Source Language:</label>
          <select v-model="sourceLanguage" class="form-control">
            <option value="auto">Auto-detect</option>
            <option value="turkish">Turkish</option>
            <option value="english">English</option>
            <option value="german">German</option>
            <option value="spanish">Spanish</option>
            <option value="norwegian">Norwegian</option>
          </select>
        </div>

        <div class="transcript-preview">
          <h5>Transcript Preview:</h5>
          <div class="preview-text">{{ transcriptText.substring(0, 500) }}...</div>
          <small>{{ transcriptText.length }} characters total</small>
        </div>
      </div>

      <!-- Processing Status -->
      <div v-if="isProcessing" class="processing-status">
        <div class="progress-container">
          <div class="spinner-border text-primary mb-3" role="status">
            <span class="visually-hidden">Processing...</span>
          </div>
          <h5>{{ processingStage }}</h5>
          <div class="progress mb-3">
            <div
              class="progress-bar"
              :style="{ width: processingProgress + '%' }"
              role="progressbar"
            ></div>
          </div>
          <p class="text-muted">{{ processingMessage }}</p>
        </div>
      </div>

      <!-- Knowledge Graph Preview -->
      <div v-if="knowledgeGraphPreview" class="preview-section">
        <h4>📊 Generated Knowledge Graph Preview</h4>

        <div class="preview-stats">
          <div class="stat-card">
            <strong>{{ knowledgeGraphPreview.nodes?.length || 0 }}</strong>
            <span>Nodes</span>
          </div>
        </div>

        <!-- Node List Preview -->
        <div class="nodes-preview">
          <h5>Content Sections:</h5>
          <div class="node-list">
            <div
              v-for="node in (knowledgeGraphPreview.nodes || []).slice(0, 5)"
              :key="node.id"
              class="node-item"
            >
              <div class="node-header">
                <span class="node-label">{{ node.label }}</span>
                <span class="node-type">{{ node.type }}</span>
              </div>
              <div class="node-preview">{{ (node.info || '').substring(0, 150) }}...</div>
            </div>
          </div>
        </div>

        <!-- Import Options -->
        <div v-if="knowledgeGraphPreview" class="import-options">
          <h5>Choose Import Option:</h5>
          <div v-if="knowledgeGraphPreview?.fallbackMode" class="alert alert-info mb-3">
            <strong>ℹ️ Local Processing Mode:</strong> This content was processed locally due to API
            unavailability. While functional, it lacks AI translation and enhancement features.
          </div>
          <div class="option-cards">
            <div class="option-card">
              <div class="option-icon">📥</div>
              <div class="option-title">Add to Current Graph</div>
              <div class="option-description">Merge these nodes into your currently open graph</div>
            </div>
            <div class="option-card">
              <div class="option-icon">➕</div>
              <div class="option-title">Create New Graph</div>
              <div class="option-description">
                Create a brand new knowledge graph with these nodes
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="modal-actions">
        <button
          v-if="transcriptText && !isProcessing && !knowledgeGraphPreview"
          @click="processTranscript"
          class="btn btn-primary"
          :disabled="!transcriptText.trim()"
        >
          🚀 Generate Knowledge Graph
        </button>

        <button
          v-if="transcriptText && !isProcessing && !knowledgeGraphPreview"
          @click="testApiConnection"
          class="btn btn-outline-info ms-2"
        >
          🔍 Test API
        </button>

        <button v-if="knowledgeGraphPreview" @click="importToGraph" class="btn btn-success me-2">
          📥 Add to Current Graph
        </button>

        <button v-if="knowledgeGraphPreview" @click="createNewGraph" class="btn btn-info">
          ➕ Create New Graph
        </button>

        <button
          v-if="transcriptText && !isProcessing"
          @click="resetProcessor"
          class="btn btn-warning"
        >
          🔄 Start Over
        </button>

        <button @click="close" class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['close', 'graph-imported', 'new-graph-created'])

// Stores
const userStore = useUserStore()
const knowledgeGraphStore = useKnowledgeGraphStore()

// State
const transcriptText = ref('')
const sourceLanguage = ref('auto')
const isProcessing = ref(false)
const processingStage = ref('')
const processingProgress = ref(0)
const processingMessage = ref('')
const knowledgeGraphPreview = ref(null)
const fileInput = ref(null)

// File handling
const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (file) {
    try {
      // Handle different file types
      if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        transcriptText.value = await file.text()
      } else {
        // For other file types (.doc, .docx, .pdf), treat as text for now
        // You could add more sophisticated file parsing here
        transcriptText.value = await file.text()
      }
    } catch (error) {
      console.error('Error reading file:', error)
      alert('Error reading file. Please try a different format or copy-paste the text directly.')
    }
  }
}

const handleDrop = async (event) => {
  event.preventDefault()
  const file = event.dataTransfer.files[0]
  if (file) {
    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        transcriptText.value = await file.text()
      } else {
        transcriptText.value = await file.text()
      }
    } catch (error) {
      console.error('Error reading file:', error)
      alert('Error reading file. Please try a different format or copy-paste the text directly.')
    }
  }
}

// Processing functions
const setProcessingStage = (stage, progress, message = '') => {
  isProcessing.value = true
  processingStage.value = stage
  processingProgress.value = progress
  processingMessage.value = message
}

// Health check function
const checkApiHealth = async () => {
  try {
    console.log('Checking API health...')
    // Try a simple request to see if the API is responding
    const healthResponse = await fetch('https://api.vegvisr.org/blog-posts', {
      method: 'GET',
    })
    console.log('API health check status:', healthResponse.status)
    return healthResponse.ok
  } catch (error) {
    console.error('API health check failed:', error)
    return false
  }
}

// Test API connection with detailed logging
const testApiConnection = async () => {
  console.log('=== TESTING API CONNECTION ===')

  try {
    // Test 1: Basic connectivity
    console.log('Test 1: Basic blog-posts endpoint...')
    const basicResponse = await fetch('https://api.vegvisr.org/blog-posts')
    console.log('Basic test status:', basicResponse.status)

    // Test 2: Process transcript endpoint with OPTIONS
    console.log('Test 2: CORS preflight check...')
    const corsResponse = await fetch('https://api.vegvisr.org/process-transcript', {
      method: 'OPTIONS',
    })
    console.log('CORS test status:', corsResponse.status)
    console.log('CORS headers:', Object.fromEntries(corsResponse.headers.entries()))

    // Test 3: Small test payload to process-transcript
    console.log('Test 3: Small test payload...')
    const testPayload = {
      transcript: 'Test transcript for API connectivity.',
      sourceLanguage: 'auto',
      targetLanguage: 'norwegian',
    }

    const testResponse = await fetch('https://api.vegvisr.org/process-transcript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken || 'test-token',
      },
      body: JSON.stringify(testPayload),
    })

    console.log('Test API Response Status:', testResponse.status)
    console.log('Test API Response Headers:', Object.fromEntries(testResponse.headers.entries()))

    if (!testResponse.ok) {
      const errorText = await testResponse.text()
      console.log('Test API Error Response:', errorText)
    } else {
      const result = await testResponse.json()
      console.log('Test API Success Response:', result)
    }

    alert(
      `API Test Results:\n✅ Basic: ${basicResponse.status}\n✅ CORS: ${corsResponse.status}\n✅ Process: ${testResponse.status}\n\nCheck console for detailed logs.`,
    )
  } catch (error) {
    console.error('API test failed:', error)
    alert(`API Test Failed: ${error.message}\n\nCheck console for details.`)
  }

  console.log('===========================')
}

const processTranscript = async () => {
  try {
    setProcessingStage('🔍 Analyzing transcript...', 20, 'Processing content structure')

    // First, test if the API is accessible
    console.log('Testing API connectivity...')
    const apiHealthy = await checkApiHealth()

    if (!apiHealthy) {
      console.warn('API health check failed, using fallback method immediately')
      throw new Error('API service is currently unavailable')
    }

    // Log detailed request information
    const requestPayload = {
      transcript: transcriptText.value,
      sourceLanguage: sourceLanguage.value,
      targetLanguage: 'norwegian',
    }

    console.log('=== TRANSCRIPT API REQUEST ===')
    console.log('URL:', 'https://api.vegvisr.org/process-transcript')
    console.log('Method:', 'POST')
    console.log('API Token:', userStore.emailVerificationToken ? 'Present' : 'MISSING')
    console.log('API Token Length:', userStore.emailVerificationToken?.length || 0)
    console.log('Transcript Length:', transcriptText.value.length)
    console.log('Source Language:', sourceLanguage.value)
    console.log('Target Language:', 'norwegian')
    console.log('Full Payload:', JSON.stringify(requestPayload, null, 2))
    console.log('===============================')

    const response = await fetch('https://api.vegvisr.org/process-transcript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify(requestPayload),
    })

    setProcessingStage('🧠 Generating knowledge graph...', 80, 'Creating Norwegian content')

    console.log('=== TRANSCRIPT API RESPONSE ===')
    console.log('Status:', response.status)
    console.log('Status Text:', response.statusText)
    console.log('Headers:', Object.fromEntries(response.headers.entries()))
    console.log('================================')

    if (!response.ok) {
      let errorMessage = `Processing failed: ${response.status}`
      let fullErrorDetails = null

      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
        fullErrorDetails = errorData
        console.error('=== API ERROR JSON ===')
        console.error('Error Data:', JSON.stringify(errorData, null, 2))
        console.error('======================')
      } catch (e) {
        const errorText = await response.text()
        console.error('=== API ERROR TEXT ===')
        console.error('Error Text:', errorText)
        console.error('Parse Error:', e.message)
        console.error('======================')
        errorMessage = errorText || errorMessage
        fullErrorDetails = { rawText: errorText, parseError: e.message }
      }

      console.error('=== FULL ERROR CONTEXT ===')
      console.error('Request URL:', 'https://api.vegvisr.org/process-transcript')
      console.error('Request Headers:', {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      })
      console.error('Response Status:', response.status)
      console.error('Response Headers:', Object.fromEntries(response.headers.entries()))
      console.error('Error Details:', fullErrorDetails)
      console.error('==========================')

      throw new Error(errorMessage)
    }

    const result = await response.json()

    setProcessingStage('✅ Complete!', 100, 'Knowledge graph ready')

    console.log('=== PROCESSING COMPLETE ===')
    console.log('API Result:', result)
    console.log('Knowledge Graph:', result.knowledgeGraph)
    console.log('Nodes received:', result.knowledgeGraph?.nodes?.length || 0)
    console.log('Sample node:', result.knowledgeGraph?.nodes?.[0])
    console.log('===========================')

    setTimeout(() => {
      knowledgeGraphPreview.value = result.knowledgeGraph
      console.log('knowledgeGraphPreview.value set to:', knowledgeGraphPreview.value)
      isProcessing.value = false
    }, 1000)
  } catch (error) {
    console.error('Error processing transcript:', error)

    // Fallback: Create nodes locally if API fails
    console.log('API failed, attempting local processing...')
    setProcessingStage('🔄 Using fallback method...', 50, 'Creating nodes locally')

    try {
      const fallbackResult = await createLocalKnowledgeGraph()
      if (fallbackResult) {
        setProcessingStage('✅ Complete!', 100, 'Knowledge graph ready (local)')

        setTimeout(() => {
          knowledgeGraphPreview.value = fallbackResult
          isProcessing.value = false
        }, 1000)
        return
      }
    } catch (fallbackError) {
      console.error('Fallback method also failed:', fallbackError)
    }

    alert(
      `Error: ${error.message}\n\nThe transcript processor is currently unavailable. Please try again later or contact support.`,
    )
    isProcessing.value = false
  }
}

// Fallback method to create knowledge graph locally
const createLocalKnowledgeGraph = async () => {
  try {
    const text = transcriptText.value
    const words = text.split(/\s+/)
    const chunkSize = 500 // words per node
    const chunks = []

    // Split into chunks
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '))
    }

    // Create nodes from chunks
    const nodes = chunks.map((chunk, index) => ({
      id: `transcript_${Date.now()}_${index}`,
      label: `DEL ${index + 1}`,
      color: '#f9f9f9',
      type: 'fulltext',
      info: `## DEL ${index + 1}\n\n${chunk}\n\n*Note: This content was created using local processing. For full AI translation and enhancement, please ensure the API service is available.*`,
      bibl: [],
      imageWidth: '100%',
      imageHeight: '100%',
      visible: true,
      path: null,
    }))

    return {
      nodes,
      edges: [],
      fallbackMode: true,
    }
  } catch (error) {
    console.error('Local processing failed:', error)
    return null
  }
}

const importToGraph = () => {
  if (knowledgeGraphPreview.value) {
    knowledgeGraphPreview.value.nodes.forEach((node) => {
      knowledgeGraphStore.addNode({
        ...node,
        visible: true,
        position: { x: Math.random() * 500, y: Math.random() * 500 },
      })
    })

    emit('graph-imported', knowledgeGraphPreview.value)
    close()
  }
}

const createNewGraph = async () => {
  if (!knowledgeGraphPreview.value) {
    console.error('No knowledge graph preview available!')
    return
  }

  console.log('=== CREATE NEW GRAPH DEBUG ===')
  console.log('knowledgeGraphPreview.value:', JSON.stringify(knowledgeGraphPreview.value, null, 2))
  console.log('Number of nodes:', knowledgeGraphPreview.value.nodes?.length || 0)
  console.log('First node sample:', knowledgeGraphPreview.value.nodes?.[0])
  console.log('==============================')

  try {
    // Create graph metadata
    const graphMetadata = {
      title: `Transcript Graph - ${new Date().toLocaleDateString()}`,
      description: `Automatically generated Norwegian knowledge graph from transcript processed on ${new Date().toLocaleString()}`,
      createdBy: userStore.email || 'Anonymous',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Prepare graph data with positions
    const graphData = {
      metadata: graphMetadata,
      nodes: knowledgeGraphPreview.value.nodes.map((node, index) => ({
        ...node,
        position: { x: 100 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 250 },
        visible: true,
      })),
      edges: knowledgeGraphPreview.value.edges || [],
    }

    console.log('=== GRAPH DATA TO SAVE ===')
    console.log('Metadata:', graphMetadata)
    console.log('Nodes being saved:', graphData.nodes.length)
    console.log('Sample node:', graphData.nodes[0])
    console.log('==========================')

    // Save the new graph
    const response = await fetch('https://knowledge.vegvisr.org/saveknowgraph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify(graphData),
    })

    console.log('=== SAVE RESPONSE ===')
    console.log('Response status:', response.status)
    console.log('Response ok:', response.ok)

    if (response.ok) {
      const result = await response.json()
      console.log('Save result:', result)
      console.log('Created graph ID:', result.id)
      console.log('===================')

      alert('New knowledge graph created successfully!')
      emit('new-graph-created', { graphId: result.id, graphData })
      close()
    } else {
      const errorText = await response.text()
      console.error('Save failed:', errorText)
      throw new Error(`Failed to save new graph: ${response.status} - ${errorText}`)
    }
  } catch (error) {
    console.error('Error creating new graph:', error)
    alert(`Error creating new graph: ${error.message}`)
  }
}

const resetProcessor = () => {
  transcriptText.value = ''
  knowledgeGraphPreview.value = null
  isProcessing.value = false
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const close = () => {
  resetProcessor()
  emit('close')
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
  padding: 30px;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  position: relative;
}

.close-button {
  position: absolute;
  top: 15px;
  right: 20px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.upload-section {
  margin-bottom: 30px;
}

.upload-area {
  border: 2px dashed #007bff;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  background: #f8f9ff;
}

.upload-area:hover {
  border-color: #0056b3;
  background: #f0f4ff;
}

.file-input {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.upload-icon {
  font-size: 48px;
  color: #007bff;
  margin-bottom: 15px;
}

.processing-controls {
  margin-bottom: 20px;
}

.transcript-preview {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-top: 15px;
}

.preview-text {
  background: white;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
  max-height: 150px;
  overflow-y: auto;
}

.processing-status {
  text-align: center;
  padding: 40px 20px;
}

.progress-container {
  max-width: 400px;
  margin: 0 auto;
}

.preview-section {
  margin: 20px 0;
}

.preview-stats {
  display: flex;
  gap: 20px;
  margin: 20px 0;
}

.stat-card {
  background: #e9ecef;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  flex: 1;
}

.stat-card strong {
  display: block;
  font-size: 1.5em;
  color: #007bff;
}

.nodes-preview {
  margin: 20px 0;
}

.node-list {
  max-height: 300px;
  overflow-y: auto;
}

.node-item {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
  background: #f9f9f9;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.node-label {
  font-weight: bold;
  color: #333;
}

.node-type {
  background: #007bff;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
}

.node-preview {
  color: #666;
  font-size: 0.9em;
  line-height: 1.4;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 30px;
  flex-wrap: wrap;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

/* Import Options Styling */
.import-options {
  margin: 20px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.import-options h5 {
  margin-bottom: 15px;
  color: #333;
  text-align: center;
}

.option-cards {
  display: flex;
  gap: 15px;
}

.option-card {
  flex: 1;
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  transition: all 0.3s ease;
}

.option-card:hover {
  border-color: #007bff;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 123, 255, 0.1);
}

.option-icon {
  font-size: 2em;
  margin-bottom: 10px;
}

.option-title {
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
}

.option-description {
  font-size: 0.9em;
  color: #666;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    padding: 20px;
  }

  .modal-actions {
    justify-content: center;
  }

  .preview-stats {
    flex-direction: column;
    gap: 10px;
  }

  .option-cards {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
