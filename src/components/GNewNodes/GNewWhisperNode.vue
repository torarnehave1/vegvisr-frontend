<template>
  <div class="gnew-whisper-node">
    <!-- Node Header -->
    <div class="node-header">
      <div class="node-title">
        <span class="node-icon">🎤</span>
        <span class="node-label">{{ node.label || 'Audio Transcription' }}</span>
        <span class="node-type-badge">WHISPER</span>
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

    <!-- OpenAI Configuration Section -->
    <div class="control-section service-section">
      <h6 class="section-title">
        <span class="section-icon">🤖</span>
        OpenAI Configuration
      </h6>

      <div class="openai-options">
        <div class="option-group">
          <label>Model:</label>
          <select v-model="openaiModel" class="option-select">
            <option value="whisper-1">whisper-1 (Open Source Whisper V2)</option>
            <option value="gpt-4o-transcribe">gpt-4o-transcribe (Latest GPT-4o)</option>
            <option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe (Cost-effective)</option>
          </select>
        </div>

        <div class="option-group">
          <label>Language:</label>
          <select v-model="openaiLanguage" class="option-select">
            <option value="nb">Norwegian Bokmål (nb)</option>
            <option value="nn">Norwegian Nynorsk (nn)</option>
            <option value="en">English (en)</option>
            <option value="tr">🇹🇷 Turkish (tr)</option>
            <option value="auto">Auto-detect</option>
          </select>
        </div>

        <div class="option-group">
          <label>Temperature:</label>
          <input
            type="range"
            v-model="openaiTemperature"
            min="0"
            max="1"
            step="0.1"
            class="temperature-slider"
          />
          <span class="temperature-value">{{ openaiTemperature }}</span>
          <div class="temperature-hint">
            Controls transcription focus: 0 = most accurate, 1 = most creative. Recommended: 0-0.3
            for accuracy.
          </div>
        </div>
      </div>
    </div>

    <!-- Audio Input Section -->
    <div class="control-section audio-input-section">
      <h6 class="section-title">
        <span class="section-icon">🎵</span>
        Audio Input
      </h6>

      <!-- File Upload -->
      <div class="upload-area" @dragover.prevent @drop.prevent="handleFileDrop">
        <input
          ref="fileInput"
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.flac,.webm"
          @change="handleFileSelect"
          class="file-input"
          style="display: none"
        />
        <button @click="$refs.fileInput.click()" class="btn btn-outline-primary upload-btn">
          <span class="btn-icon">📁</span>
          Choose Audio File
        </button>
        <div class="upload-hint">or drag & drop audio file here</div>
      </div>

      <!-- Microphone Recording -->
      <div class="recording-section">
        <div class="recording-controls">
          <button
            @click="startRecording"
            :disabled="recording || !microphoneSupported"
            class="btn btn-primary record-btn"
          >
            {{ microphoneSupported ? '🎤 Start Recording' : '❌ Microphone Not Supported' }}
          </button>
          <button @click="stopRecording" :disabled="!recording" class="btn btn-secondary">
            ⏹️ Stop Recording
          </button>
        </div>

        <!-- Recording Status -->
        <div v-if="recording" class="recording-indicator">
          <div class="recording-dot"></div>
          <span>Recording: {{ recordingDuration }}s</span>
        </div>
      </div>
    </div>

    <!-- Audio Preview Section -->
    <div v-if="selectedFile || recordedBlob" class="control-section audio-preview-section">
      <h6 class="section-title">
        <span class="section-icon">🎧</span>
        Audio Preview
      </h6>

      <div class="audio-info">
        <div v-if="selectedFile" class="file-info">
          <p><strong>File:</strong> {{ selectedFile.name }}</p>
          <p><strong>Type:</strong> {{ selectedFile.type }}</p>
          <p><strong>Size:</strong> {{ formatFileSize(selectedFile.size) }}</p>
        </div>
        <div v-if="recordedBlob" class="recorded-info">
          <p><strong>Recording:</strong> {{ Math.round(recordingDuration) }}s</p>
          <p><strong>Size:</strong> {{ formatFileSize(recordedBlob.size) }}</p>
        </div>
      </div>

      <audio v-if="audioPreviewUrl" :src="audioPreviewUrl" controls class="audio-player"></audio>
    </div>

    <!-- Transcription Controls -->
    <div class="control-section transcription-section">
      <h6 class="section-title">
        <span class="section-icon">⚡</span>
        Transcription
      </h6>

      <div class="transcription-options">
        <div class="node-type-selection">
          <label class="option-label-header">🎯 Node Type for Transcript:</label>
          <div class="node-type-options">
            <label
              v-for="nodeType in nodeTypeOptions"
              :key="nodeType.type"
              class="node-type-option"
              :class="{ selected: selectedNodeType === nodeType.type }"
            >
              <input
                type="radio"
                :value="nodeType.type"
                v-model="selectedNodeType"
                @change="saveNodeTypePreference"
              />
              <div class="node-type-info">
                <div class="node-type-header">
                  <span class="node-type-icon">{{ nodeType.icon }}</span>
                  <span class="node-type-title">{{ nodeType.title }}</span>
                </div>
                <div class="node-type-description">{{ nodeType.description }}</div>
              </div>
            </label>
          </div>
        </div>

        <div class="additional-options">
          <label class="option-checkbox">
            <input type="checkbox" v-model="createNodeFromTranscription" />
            <span class="option-label"
              >📝 Create {{ selectedNodeTypeInfo.title.toLowerCase() }} node with transcript</span
            >
          </label>
          <label class="option-checkbox">
            <input type="checkbox" v-model="saveToR2" />
            <span class="option-label">💾 Keep audio file in R2 storage</span>
          </label>
        </div>
      </div>

      <button
        @click="transcribeAudio"
        :disabled="(!selectedFile && !recordedBlob) || transcribing"
        class="btn btn-success transcribe-btn"
      >
        <span v-if="transcribing" class="spinner-border spinner-border-sm me-2"></span>
        <span class="btn-icon">🚀</span>
        {{ transcribing ? 'Transcribing...' : 'Start Transcription' }}
      </button>
    </div>

    <!-- Loading Progress -->
    <div v-if="transcribing" class="loading-section">
      <div class="loading-content">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="loading-text">{{ loadingMessage }}</p>

        <!-- Chunking Progress -->
        <div v-if="isChunking" class="chunking-progress">
          <p>📦 Processing with 30-second chunks...</p>
          <div class="progress-info">
            <span>Chunk {{ chunkProgress.current }} of {{ chunkProgress.total }}</span>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${(chunkProgress.current / chunkProgress.total) * 100}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Results Display -->
    <div v-if="transcriptionResult" class="control-section results-section">
      <h6 class="section-title">
        <span class="section-icon">📝</span>
        Transcription Result
      </h6>

      <div class="transcription-text">
        {{ transcriptionResult.text || 'No text detected' }}
      </div>

      <div class="result-metadata">
        <small class="text-muted">
          Service: {{ transcriptionResult.metadata?.service || 'Unknown' }} | Model:
          {{ transcriptionResult.model || 'Unknown' }} | Duration:
          {{ transcriptionResult.metadata?.processingTime || 'N/A' }}
        </small>
      </div>

      <!-- Portfolio Integration - Optional feature -->
      <div
        v-if="transcriptionResult && !portfolioSaved && userStore.email"
        class="portfolio-section"
      >
        <div class="portfolio-controls">
          <button
            @click="saveToPortfolio"
            :disabled="savingToPortfolio"
            class="btn btn-outline-primary portfolio-btn"
          >
            <span v-if="savingToPortfolio" class="spinner-border spinner-border-sm me-2"></span>
            <span class="btn-icon">📁</span>
            {{ savingToPortfolio ? 'Saving...' : 'Save to Portfolio' }}
          </button>
          <div class="portfolio-hint">
            Save this recording and transcription to your audio portfolio
          </div>
        </div>
      </div>

      <!-- Portfolio Success -->
      <div v-if="portfolioSaved" class="alert alert-success portfolio-success">
        <strong>📁 Saved to Portfolio:</strong> Recording saved successfully!
        <small class="text-muted d-block">Recording ID: {{ portfolioRecordingId }}</small>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/userStore'

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

// Store access
const userStore = useUserStore()

// Reactive data
const openaiModel = ref('whisper-1')
const openaiLanguage = ref('no')
const openaiTemperature = ref(0)

const selectedFile = ref(null)
const recordedBlob = ref(null)

const microphoneSupported = ref(false)
const recording = ref(false)
const recordingDuration = ref(0)
const mediaRecorder = ref(null)
const recordingTimer = ref(null)

const transcribing = ref(false)
const loadingMessage = ref('')
const isChunking = ref(false)
const chunkProgress = ref({ current: 0, total: 0 })

// Node type configuration options
const nodeTypeOptions = ref([
  {
    type: 'fulltext',
    icon: '📄',
    title: 'Fulltext',
    description: 'Rich text content with formatting support',
    color: '#f9f9f9',
    useFormatting: false,
  },
  {
    type: 'notes',
    icon: '📋',
    title: 'Notes',
    description: 'Simple note content for observations and insights',
    color: '#f4e2d8',
    useFormatting: false,
  },
  {
    type: 'worknote',
    icon: '🗒️',
    title: 'Work Note',
    description: 'Structured work notes with attribution and date',
    color: '#FFD580',
    useFormatting: true,
  },
  {
    type: 'action_test',
    icon: '🤖',
    title: 'Action Test',
    description: 'AI action node that can trigger further processing',
    color: '#ffcc00',
    useFormatting: false,
  },
])

// Load user preference from localStorage or default to 'fulltext'
const loadNodeTypePreference = () => {
  try {
    return localStorage.getItem('whisper-node-type-preference') || 'fulltext'
  } catch (error) {
    console.log('Could not load node type preference from localStorage:', error)
    return 'fulltext'
  }
}

const selectedNodeType = ref(loadNodeTypePreference())
const createNodeFromTranscription = ref(true)
const saveToR2 = ref(false)

const transcriptionResult = ref(null)
const uploadResult = ref(null)
const error = ref('')
const successMessage = ref('')

// Portfolio functionality
const savingToPortfolio = ref(false)
const portfolioSaved = ref(false)
const portfolioRecordingId = ref('')

// Computed properties
const audioPreviewUrl = computed(() => {
  if (selectedFile.value) {
    return URL.createObjectURL(selectedFile.value)
  } else if (recordedBlob.value) {
    return URL.createObjectURL(recordedBlob.value)
  }
  return ''
})

const selectedNodeTypeInfo = computed(() => {
  return (
    nodeTypeOptions.value.find((option) => option.type === selectedNodeType.value) ||
    nodeTypeOptions.value[0]
  )
})

// Whisper Worker endpoints
const WHISPER_BASE_URL = 'https://whisper.vegvisr.org'

// Lifecycle
onMounted(async () => {
  // Check microphone support
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      microphoneSupported.value = true
    } catch (err) {
      console.log('Microphone access not available:', err)
      microphoneSupported.value = false
    }
  }
})

onUnmounted(() => {
  // Cleanup
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
  }
  if (audioPreviewUrl.value) {
    URL.revokeObjectURL(audioPreviewUrl.value)
  }
})

// Methods
const saveNodeTypePreference = () => {
  try {
    localStorage.setItem('whisper-node-type-preference', selectedNodeType.value)
    console.log('Node type preference saved:', selectedNodeType.value)
  } catch (error) {
    console.log('Could not save node type preference to localStorage:', error)
  }
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    selectedFile.value = file
    recordedBlob.value = null // Clear any recorded audio
    console.log('File selected:', file.name, file.size, file.type)
  }
}

const handleFileDrop = (event) => {
  const files = event.dataTransfer.files
  if (files.length > 0) {
    const file = files[0]
    if (file.type.startsWith('audio/')) {
      selectedFile.value = file
      recordedBlob.value = null
      console.log('File dropped:', file.name, file.size, file.type)
    } else {
      error.value = 'Please drop an audio file'
    }
  }
}

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)

    const chunks = []
    mediaRecorder.value.ondataavailable = (event) => {
      chunks.push(event.data)
    }

    mediaRecorder.value.onstop = () => {
      recordedBlob.value = new Blob(chunks, { type: 'audio/wav' })
      selectedFile.value = null // Clear any selected file
      stream.getTracks().forEach((track) => track.stop()) // Stop microphone
    }

    mediaRecorder.value.start()
    recording.value = true
    recordingDuration.value = 0

    // Start timer
    recordingTimer.value = setInterval(() => {
      recordingDuration.value++
    }, 1000)

    console.log('Recording started')
  } catch (err) {
    console.error('Recording failed:', err)
    error.value = 'Failed to start recording: ' + err.message
  }
}

const stopRecording = () => {
  if (mediaRecorder.value && recording.value) {
    mediaRecorder.value.stop()
    recording.value = false

    if (recordingTimer.value) {
      clearInterval(recordingTimer.value)
      recordingTimer.value = null
    }

    console.log('Recording stopped, duration:', recordingDuration.value + 's')
  }
}

const transcribeAudio = async () => {
  if (!selectedFile.value && !recordedBlob.value) {
    error.value = 'Please select an audio file or record audio first'
    return
  }

  transcribing.value = true
  error.value = ''
  successMessage.value = ''
  transcriptionResult.value = null

  // Reset portfolio state for new transcription
  portfolioSaved.value = false
  portfolioRecordingId.value = ''
  uploadResult.value = null

  try {
    console.log('Starting transcription process...')
    loadingMessage.value = 'Preparing audio file...'

    const audioBlob = selectedFile.value || recordedBlob.value
    const fileName = selectedFile.value ? selectedFile.value.name : `recording_${Date.now()}.wav`

    // Step 1: Upload to R2 using working direct file method
    const uploadResponse = await fetch(`${WHISPER_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': audioBlob.type || 'audio/wav',
        'X-File-Name': fileName,
      },
      body: audioBlob,
    })

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`)
    }

    const uploadData = await uploadResponse.json()
    console.log('Upload result:', uploadData)

    // Store upload result for portfolio save
    uploadResult.value = uploadData

    // Step 2: Transcribe from R2 URL using OpenAI
    loadingMessage.value = 'Starting transcription...'

    let transcribeUrl = `${WHISPER_BASE_URL}/transcribe?url=${encodeURIComponent(uploadData.audioUrl)}&service=openai&model=${openaiModel.value}&temperature=${openaiTemperature.value}`

    if (openaiLanguage.value !== 'auto') {
      transcribeUrl += `&language=${openaiLanguage.value}`
    }

    const transcribeResponse = await fetch(transcribeUrl)

    if (!transcribeResponse.ok) {
      throw new Error(`Transcription failed: ${transcribeResponse.statusText}`)
    }

    const result = await transcribeResponse.json()
    console.log('Transcription result:', result)

    // No metadata enhancement needed - keeping it simple

    transcriptionResult.value = result
    loadingMessage.value = 'Creating nodes...'

    // Create node if requested
    if (createNodeFromTranscription.value && result.text) {
      await createTranscriptionNode(result.text, result)
    }

    successMessage.value = `Audio transcribed successfully using OpenAI API`
  } catch (err) {
    console.error('Transcription Error:', err)
    error.value = err.message || 'Failed to transcribe audio'
  } finally {
    transcribing.value = false
    loadingMessage.value = ''
    isChunking.value = false
  }
}

const createTranscriptionNode = async (transcriptText, apiResult) => {
  const nodeTypeInfo = selectedNodeTypeInfo.value
  let formattedContent = transcriptText

  // Get filename from either uploaded file or recorded blob
  const filename = selectedFile.value?.name || apiResult.metadata?.fileName || 'Recording'

  // Apply special formatting based on node type
  if (nodeTypeInfo.useFormatting && nodeTypeInfo.type === 'worknote') {
    const currentDate = new Date().toISOString().split('T')[0]

    // Extract username from user's email, fallback to 'user' if not available
    let username = 'user'
    if (userStore.email) {
      username = userStore.email.split('@')[0]
    }

    formattedContent = `${currentDate}: @${username} - Audio transcription from ${filename}\n\n${transcriptText}`
  }

  const newNode = {
    id: `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    label: `${nodeTypeInfo.title}: ${filename}`,
    info: formattedContent,
    type: nodeTypeInfo.type,
    color: nodeTypeInfo.color,
    visible: true,
    x: (props.node.x || 0) + 250,
    y: (props.node.y || 0) + 50,
    bibl: [
      `Transcribed using ${apiResult.metadata?.service || 'AI'} - ${apiResult.model || 'Unknown model'}`,
    ],
  }

  // Create and emit the node directly

  // Emit the new node to parent component
  emit('node-created', newNode)
}

// Save to Portfolio - Optional feature (separate service)
const saveToPortfolio = async () => {
  if (!transcriptionResult.value || !userStore.email) {
    error.value = 'Cannot save to portfolio: missing transcription or user not logged in'
    return
  }

  try {
    savingToPortfolio.value = true
    error.value = ''

    // Get file information
    const audioFile = selectedFile.value || recordedBlob.value
    const fileName = selectedFile.value ? selectedFile.value.name : `recording_${Date.now()}.wav`

    // Prepare portfolio data
    const portfolioData = {
      userEmail: userStore.email,
      fileName: fileName,
      displayName: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
      transcriptionText: transcriptionResult.value.text,
      fileSize: audioFile ? audioFile.size : 0,
      duration: recordingDuration.value || 0,
      tags: ['transcription', 'whisper'],
      category: 'general',
      aiService: transcriptionResult.value.metadata?.service || 'openai',
      aiModel: openaiModel.value,
      processingTime: transcriptionResult.value.metadata?.processingTime || 0,
      // R2 information from upload result
      r2Key: uploadResult.value?.r2Key || null,
      r2Url: uploadResult.value?.audioUrl || null,
    }

    console.log('🎵 Saving to audio portfolio:', portfolioData)

    // Call the separate audio-portfolio-worker
    const response = await fetch(
      'https://audio-portfolio-worker.torarnehave.workers.dev/save-recording',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(portfolioData),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const result = await response.json()
    console.log('📁 Portfolio save result:', result)

    // Show success
    portfolioSaved.value = true
    portfolioRecordingId.value = result.recordingId
    successMessage.value = `Recording saved to portfolio with ID: ${result.recordingId}`
  } catch (err) {
    console.error('❌ Portfolio save failed:', err)
    error.value = `Failed to save to portfolio: ${err.message}`
  } finally {
    savingToPortfolio.value = false
  }
}

const editNode = () => {
  // Trigger edit mode - could open a modal or make fields editable
  console.log('Edit node:', props.node.id)
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this audio transcription node?')) {
    emit('node-deleted', props.node.id)
  }
}

const clearError = () => {
  error.value = ''
}

const clearSuccess = () => {
  successMessage.value = ''
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
.gnew-whisper-node {
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

.gnew-whisper-node:hover {
  border-color: #6f42c1;
  box-shadow: 0 6px 12px rgba(111, 66, 193, 0.15);
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
  background: linear-gradient(45deg, #6f42c1, #8e44ad);
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
  background: linear-gradient(45deg, #6f42c1, #8e44ad);
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
  border-color: #6f42c1;
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

.service-section {
  border-left: 4px solid #6f42c1;
}

.audio-input-section {
  border-left: 4px solid #17a2b8;
}

.audio-preview-section {
  border-left: 4px solid #28a745;
}

.transcription-section {
  border-left: 4px solid #ffc107;
}

.results-section {
  border-left: 4px solid #20c997;
}

.portfolio-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e9ecef;
}

.portfolio-controls {
  text-align: center;
}

.portfolio-btn {
  background: linear-gradient(45deg, #6f42c1, #8e44ad);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.portfolio-btn:hover:not(:disabled) {
  background: linear-gradient(45deg, #5a36a1, #7d3c98);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(111, 66, 193, 0.3);
}

.portfolio-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.portfolio-hint {
  font-size: 0.85rem;
  color: #6c757d;
  margin-top: 8px;
}

.portfolio-success {
  margin-top: 12px;
  border-left: 4px solid #20c997;
}

.service-select,
.option-select {
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.9rem;
  transition: border-color 0.2s ease;
  width: 100%;
  margin-bottom: 8px;
}

.openai-options {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e9ecef;
}

.option-group {
  margin-bottom: 10px;
}

.option-group label {
  display: inline-block;
  width: 80px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #6c757d;
}

.temperature-slider {
  width: 120px;
  margin-right: 8px;
}

.temperature-value {
  font-size: 0.85rem;
  color: #6c757d;
  font-weight: 600;
}

.upload-area {
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  transition: border-color 0.2s ease;
  margin-bottom: 16px;
}

.upload-area:hover {
  border-color: #6f42c1;
}

.upload-btn {
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 0.85rem;
  color: #6c757d;
}

.temperature-hint {
  font-size: 0.85rem;
  color: #6c757d;
  margin-top: 4px;
}

.recording-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
}

.record-btn {
  background: linear-gradient(45deg, #dc3545, #e74c3c);
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #dc3545;
  font-weight: 600;
}

.recording-dot {
  width: 12px;
  height: 12px;
  background: #dc3545;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

.audio-info {
  margin-bottom: 12px;
}

.file-info,
.recorded-info {
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
}

.audio-player {
  width: 100%;
  margin-top: 8px;
}

.transcription-options {
  margin-bottom: 16px;
}

.node-type-selection {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.option-label-header {
  display: block;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 12px;
  font-size: 0.95rem;
}

.node-type-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.node-type-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: white;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.node-type-option:hover {
  border-color: #6f42c1;
  box-shadow: 0 2px 4px rgba(111, 66, 193, 0.1);
}

.node-type-option.selected {
  border-color: #6f42c1;
  background: linear-gradient(135deg, #f8f4ff 0%, #fff 100%);
  box-shadow: 0 2px 8px rgba(111, 66, 193, 0.15);
}

.node-type-option input[type='radio'] {
  margin: 4px 0 0 0;
  accent-color: #6f42c1;
}

.node-type-info {
  flex: 1;
}

.node-type-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.node-type-icon {
  font-size: 1.1rem;
}

.node-type-title {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.95rem;
}

.node-type-description {
  font-size: 0.85rem;
  color: #6c757d;
  line-height: 1.4;
}

.additional-options {
  margin-top: 16px;
}

.option-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}

.option-label {
  font-size: 0.9rem;
  color: #495057;
}

.transcribe-btn {
  background: linear-gradient(45deg, #28a745, #20c997);
  width: 100%;
  padding: 12px;
  font-weight: 600;
}

.loading-section {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  margin-bottom: 16px;
}

.loading-text {
  margin-top: 12px;
  color: #6c757d;
  font-weight: 500;
}

.chunking-progress {
  margin-top: 16px;
}

.progress-bar {
  background: #e9ecef;
  border-radius: 4px;
  height: 8px;
  overflow: hidden;
  margin: 8px 0;
}

.progress-fill {
  background: linear-gradient(45deg, #007bff, #0056b3);
  height: 100%;
  transition: width 0.3s ease;
}

.transcription-text {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 16px;
  white-space: pre-wrap;
  font-family: Georgia, serif;
  line-height: 1.6;
  margin-bottom: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.result-metadata {
  text-align: center;
}

.error-alert,
.success-alert {
  position: relative;
  margin-bottom: 16px;
}

.btn-close {
  position: absolute;
  top: 8px;
  right: 12px;
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  opacity: 0.7;
}

.btn-close:hover {
  opacity: 1;
}

.btn-icon {
  margin-right: 6px;
}

/* Responsive design */
@media (max-width: 768px) {
  .recording-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .option-group {
    flex-direction: column;
  }

  .option-group label {
    width: auto;
    margin-bottom: 4px;
  }
}
</style>
