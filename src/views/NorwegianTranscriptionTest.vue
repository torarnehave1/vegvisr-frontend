<template>
  <div class="norwegian-test-view">
    <div class="header">
      <h1>🇳🇴 Norwegian Audio Transcription Test</h1>
      <p>Test the Norwegian transcription service with audio files</p>
      <div class="service-info">
        <span class="service-badge"
          >Worker: <code>norwegian-transcription-worker.torarnehave.workers.dev</code></span
        >
        <span class="language-badge">Language: Norwegian (no)</span>
      </div>
    </div>

    <!-- Health Check Section -->
    <div class="test-section">
      <h2>🏥 Service Health Check</h2>
      <button @click="checkHealth" :disabled="healthLoading" class="btn btn-primary">
        {{ healthLoading ? 'Checking...' : 'Check Norwegian Service Health' }}
      </button>

      <div v-if="healthStatus" class="status-result" :class="healthStatus.type">
        <strong>Status:</strong> {{ healthStatus.message }}
        <div v-if="healthStatus.details" class="health-details">
          <pre>{{ healthStatus.details }}</pre>
        </div>
      </div>
    </div>

    <!-- Audio Upload Section -->
    <div class="test-section">
      <h2>📁 Audio File Upload</h2>

      <!-- File Input with Drag & Drop -->
      <div class="upload-area" @dragover.prevent @drop.prevent="handleFileDrop">
        <input
          ref="fileInput"
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.flac"
          @change="handleFileSelect"
          class="file-input"
          style="display: none"
        />
        <button @click="$refs.fileInput.click()" class="btn btn-secondary">
          📁 Choose Audio File
        </button>
        <div class="upload-hint">or drag & drop audio file here</div>
      </div>

      <!-- File Info -->
      <div v-if="selectedFile" class="file-info">
        <h3>Selected File</h3>
        <p><strong>Name:</strong> {{ selectedFile.name }}</p>
        <p><strong>Type:</strong> {{ selectedFile.type }}</p>
        <p><strong>Size:</strong> {{ formatFileSize(selectedFile.size) }}</p>

        <!-- Audio Preview -->
        <div v-if="audioPreviewUrl" class="audio-preview">
          <audio :src="audioPreviewUrl" controls class="audio-player"></audio>
        </div>
      </div>
    </div>

    <!-- Microphone Recording Section -->
    <div class="test-section">
      <h2>🎤 Microphone Recording</h2>

      <!-- Recording Controls -->
      <div class="recording-controls">
        <button
          @click="startRecording"
          :disabled="recording || !microphoneSupported"
          class="btn btn-primary"
        >
          {{ microphoneSupported ? '🎤 Start Recording' : '❌ Microphone Not Supported' }}
        </button>
        <button @click="stopRecording" :disabled="!recording" class="btn btn-secondary">
          ⏹️ Stop Recording
        </button>

        <!-- Recording Status -->
        <div v-if="recording" class="recording-indicator">
          <div class="recording-dot"></div>
          <span>Recording: {{ recordingDuration }}s</span>
        </div>
      </div>

      <!-- Recorded Audio Preview -->
      <div v-if="recordedBlob" class="recorded-audio">
        <h4>🎵 Recorded Audio</h4>
        <audio :src="recordedUrl" controls class="audio-player"></audio>
        <div class="recorded-info">
          <span>Duration: {{ Math.round(recordingDuration) }}s</span>
          <span>Size: {{ formatFileSize(recordedBlob.size) }}</span>
        </div>
      </div>
    </div>

    <!-- Norwegian Transcription Section -->
    <div class="test-section">
      <h2>🇳🇴 Norwegian Transcription</h2>

      <div class="transcription-info">
        <div class="info-card">
          <h4>🛠️ Service Details</h4>
          <ul>
            <li><strong>Endpoint:</strong> Norwegian Transcription Worker</li>
            <li><strong>Language:</strong> Norwegian (no)</li>
            <li><strong>Processing:</strong> Upload → R2 Storage → Norwegian Service</li>
            <li><strong>Supported Formats:</strong> WAV, MP3, M4A, FLAC</li>
          </ul>
        </div>
      </div>

      <button
        @click="transcribeAudio"
        :disabled="(!selectedFile && !recordedBlob) || transcribing"
        class="btn btn-success transcribe-btn"
      >
        {{ transcribing ? 'Transcribing...' : '🇳🇴 Start Norwegian Transcription' }}
      </button>

      <div v-if="transcribing" class="loading">
        <div class="loading-spinner"></div>
        <p>{{ loadingMessage || 'Processing audio...' }}</p>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="transcriptionResult" class="test-section">
      <h2>📝 Transcription Results</h2>

      <div class="result-card">
        <div class="result-header">
          <h3>🇳🇴 Norwegian Transcription</h3>
          <div class="result-metadata">
            <span class="metadata-item">Service: {{ transcriptionResult.metadata?.service }}</span>
            <span class="metadata-item">Language: {{ transcriptionResult.language }}</span>
            <span class="metadata-item">File: {{ transcriptionResult.metadata?.fileName }}</span>
          </div>
        </div>

        <div class="transcription-text">
          <h4>Transcribed Text:</h4>
          <div class="text-content">{{ transcriptionResult.text }}</div>
        </div>

        <div class="result-details">
          <h4>Processing Details:</h4>
          <pre>{{ JSON.stringify(transcriptionResult.metadata, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-section">
      <div class="alert alert-danger">
        <h4>❌ Error</h4>
        <p>
          <strong>{{ error.message }}</strong>
        </p>
        <div v-if="error.details" class="error-details">
          <pre>{{ error.details }}</pre>
        </div>
        <button @click="clearError" class="btn btn-sm btn-outline-secondary">Clear Error</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// Reactive data
const selectedFile = ref(null)
const recordedBlob = ref(null)
const recording = ref(false)
const recordingDuration = ref(0)
const mediaRecorder = ref(null)
const recordingTimer = ref(null)
const microphoneSupported = ref(false)

const healthLoading = ref(false)
const healthStatus = ref(null)
const transcribing = ref(false)
const loadingMessage = ref('')
const transcriptionResult = ref(null)
const error = ref(null)

// Base URL for Norwegian transcription worker
const NORWEGIAN_BASE_URL = 'https://norwegian-transcription-worker.torarnehave.workers.dev'

// Computed properties
const audioPreviewUrl = computed(() => {
  return selectedFile.value ? URL.createObjectURL(selectedFile.value) : null
})

const recordedUrl = computed(() => {
  return recordedBlob.value ? URL.createObjectURL(recordedBlob.value) : null
})

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
  if (recordedUrl.value) {
    URL.revokeObjectURL(recordedUrl.value)
  }
})

// Methods
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    selectedFile.value = file
    recordedBlob.value = null // Clear any recorded audio
    error.value = null
    transcriptionResult.value = null
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
      error.value = null
      transcriptionResult.value = null
      console.log('File dropped:', file.name, file.size, file.type)
    } else {
      error.value = { message: 'Please drop an audio file' }
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
      error.value = null
      transcriptionResult.value = null
      stream.getTracks().forEach((track) => track.stop()) // Stop microphone
    }

    mediaRecorder.value.start()
    recording.value = true
    recordingDuration.value = 0

    // Start timer
    recordingTimer.value = setInterval(() => {
      recordingDuration.value++
    }, 1000)

    console.log('🎤 Recording started...')
  } catch (err) {
    console.error('Recording failed:', err)
    error.value = {
      message: 'Failed to start recording',
      details: err.message,
    }
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

    console.log('🎤 Recording stopped')
  }
}

const checkHealth = async () => {
  healthLoading.value = true
  healthStatus.value = null

  try {
    console.log('🏥 Checking Norwegian service health...')
    const response = await fetch(`${NORWEGIAN_BASE_URL}/health`)

    if (response.ok) {
      const healthData = await response.json()
      healthStatus.value = {
        type: 'success',
        message: `✅ Norwegian Transcription Service is healthy`,
        details: JSON.stringify(healthData, null, 2),
      }
    } else {
      healthStatus.value = {
        type: 'error',
        message: `❌ Service returned ${response.status}: ${response.statusText}`,
      }
    }
  } catch (err) {
    console.error('Health check failed:', err)
    healthStatus.value = {
      type: 'error',
      message: `❌ Cannot reach Norwegian transcription service: ${err.message}`,
    }
  } finally {
    healthLoading.value = false
  }
}

const transcribeAudio = async () => {
  if (!selectedFile.value && !recordedBlob.value) {
    error.value = { message: 'Please select an audio file or record audio first' }
    return
  }

  transcribing.value = true
  error.value = null
  transcriptionResult.value = null
  loadingMessage.value = 'Transcribing with Norwegian service...'

  try {
    const audioBlob = selectedFile.value || recordedBlob.value
    const fileName = selectedFile.value ? selectedFile.value.name : `recording_${Date.now()}.wav`

    console.log('🇳🇴 Starting Norwegian transcription (direct server call):', {
      fileName,
      size: audioBlob.size,
      type: audioBlob.type,
    })

    // Call server directly
    const formData = new FormData()
    formData.append('audio', audioBlob, fileName)
    formData.append('model', 'nb-whisper-small')

    const transcribeResponse = await fetch('http://46.62.149.157/transcribe', {
      method: 'POST',
      body: formData,
    })

    if (!transcribeResponse.ok) {
      throw new Error(
        `Transcription failed: ${transcribeResponse.status} ${transcribeResponse.statusText}`,
      )
    }

    const result = await transcribeResponse.json()
    console.log('✅ Norwegian transcription result (direct):', result)

    // Format response to match expected structure
    transcriptionResult.value = {
      success: true,
      transcription: {
        raw_text: result.transcription?.text || result.text,
        language: result.transcription?.language || 'no',
        chunks: result.transcription?.chunks || 1,
        processing_time: result.transcription?.processing_time || 0,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        filename: fileName,
        model: result.metadata?.model || 'nb-whisper-small',
        total_processing_time: result.metadata?.total_processing_time || 0,
        transcription_server: 'Hetzner (Direct)',
      },
    }

    loadingMessage.value = ''
  } catch (err) {
    console.error('Norwegian transcription error:', err)
    error.value = {
      message: 'Norwegian transcription failed',
      details: err.message,
    }
  } finally {
    transcribing.value = false
    loadingMessage.value = ''
  }
}

const clearError = () => {
  error.value = null
}
</script>

<style scoped>
.norwegian-test-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #dc143c, #b71c1c);
  color: white;
  border-radius: 12px;
}

.header h1 {
  margin: 0 0 10px 0;
  font-size: 2.5rem;
  font-weight: bold;
}

.header p {
  margin: 0 0 15px 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

.service-info {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

.service-badge,
.language-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
  backdrop-filter: blur(10px);
}

.test-section {
  background: white;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

.test-section h2 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 1.5rem;
  border-bottom: 2px solid #dc143c;
  padding-bottom: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: linear-gradient(135deg, #dc143c, #b71c1c);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #b71c1c, #8b0000);
  transform: translateY(-2px);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
  transform: translateY(-2px);
}

.btn-success {
  background: linear-gradient(135deg, #28a745, #1e7e34);
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: linear-gradient(135deg, #1e7e34, #155724);
  transform: translateY(-2px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.upload-area {
  border: 2px dashed #dc143c;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  background: linear-gradient(135deg, #fff5f5, #ffeef0);
  transition: all 0.3s ease;
}

.upload-area:hover {
  border-color: #b71c1c;
  background: linear-gradient(135deg, #ffeef0, #ffe0e6);
}

.upload-hint {
  margin-top: 10px;
  color: #666;
  font-style: italic;
}

.file-info {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.file-info h3 {
  margin: 0 0 15px 0;
  color: #dc143c;
}

.audio-preview,
.recorded-audio {
  margin-top: 15px;
}

.audio-player {
  width: 100%;
  margin-top: 10px;
}

.recording-controls {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #dc143c;
  font-weight: bold;
}

.recording-dot {
  width: 12px;
  height: 12px;
  background: #dc143c;
  border-radius: 50%;
  animation: pulse 1s infinite;
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

.recorded-info {
  margin-top: 10px;
  display: flex;
  gap: 20px;
  color: #666;
}

.transcription-info {
  margin-bottom: 20px;
}

.info-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  border-left: 4px solid #dc143c;
}

.info-card h4 {
  margin: 0 0 15px 0;
  color: #dc143c;
}

.info-card ul {
  margin: 0;
  padding-left: 20px;
}

.info-card li {
  margin-bottom: 8px;
}

.transcribe-btn {
  font-size: 1.1rem;
  padding: 15px 30px;
}

.loading {
  text-align: center;
  margin-top: 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #dc143c;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.status-result {
  margin-top: 15px;
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid;
}

.status-result.success {
  background: #d4edda;
  border-color: #28a745;
  color: #155724;
}

.status-result.error {
  background: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
}

.health-details {
  margin-top: 10px;
}

.health-details pre {
  background: rgba(0, 0, 0, 0.05);
  padding: 10px;
  border-radius: 4px;
  font-size: 0.9rem;
  overflow-x: auto;
}

.result-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 25px;
  border: 1px solid #e0e0e0;
}

.result-header {
  margin-bottom: 20px;
}

.result-header h3 {
  margin: 0 0 10px 0;
  color: #dc143c;
}

.result-metadata {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.metadata-item {
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #666;
  border: 1px solid #ddd;
}

.transcription-text {
  margin-bottom: 20px;
}

.transcription-text h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.text-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #ddd;
  line-height: 1.6;
  font-size: 1.1rem;
  min-height: 100px;
}

.result-details h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.result-details pre {
  background: white;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #ddd;
  font-size: 0.9rem;
  overflow-x: auto;
}

.error-section {
  margin-top: 20px;
}

.alert {
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid;
}

.alert-danger {
  background: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
}

.alert h4 {
  margin: 0 0 10px 0;
}

.error-details {
  margin-top: 15px;
}

.error-details pre {
  background: rgba(0, 0, 0, 0.05);
  padding: 10px;
  border-radius: 4px;
  font-size: 0.9rem;
  overflow-x: auto;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 0.9rem;
}

.btn-outline-secondary {
  background: transparent;
  color: #6c757d;
  border: 1px solid #6c757d;
}

.btn-outline-secondary:hover {
  background: #6c757d;
  color: white;
}
</style>
