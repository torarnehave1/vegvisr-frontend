<template>
  <div class="norwegian-test-view">
    <div class="header">
      <h1>🇳🇴 Norwegian Audio Transcription Test</h1>
      <p>Test the Norwegian transcription service with audio files</p>
      <div class="service-info">
        <span class="service-badge">Worker: <code>norwegian-transcription-worker</code></span>
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
            <li><strong>Endpoint:</strong> Norwegian Transcription Worker (Complete Workflow)</li>
            <li><strong>Language:</strong> Norwegian (no)</li>
            <li>
              <strong>Processing:</strong> Worker → Hetzner Server → Cloudflare AI → Text
              Enhancement
            </li>
            <li><strong>Supported Formats:</strong> WAV, MP3, M4A, FLAC</li>
          </ul>
        </div>
      </div>

      <!-- Context Input for AI Enhancement -->
      <div class="context-section">
        <h4>📝 Context for AI Enhancement (Optional)</h4>
        <p class="context-help">
          Help the AI understand your audio better for improved transcription enhancement:
        </p>
        <textarea
          v-model="transcriptionContext"
          class="context-input"
          placeholder="Example: 'This is a therapy session discussion about somatic therapy and trauma work. Speaker uses Norwegian mixed with English professional terms like trauma-release, biosynthesis, and knowledge elements. The discussion covers therapeutic techniques and workshop reflections.'"
          rows="3"
        ></textarea>
        <div class="context-examples">
          <small><strong>More examples:</strong></small>
          <ul class="example-list">
            <li>💼 Business meeting about software development and agile methods</li>
            <li>🎓 Academic lecture on psychology with research terminology</li>
            <li>🏥 Medical consultation with clinical terms</li>
            <li>🎵 Music lesson with instruments and technique names</li>
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

        <!-- Chunked processing progress -->
        <div v-if="isChunkedProcessing" class="chunk-progress">
          <div class="progress-info">
            <h4>📊 Processing Large Audio File</h4>
            <div class="progress-stats">
              <span class="chunk-counter">Chunk {{ currentChunk }}/{{ totalChunks }}</span>
              <span class="progress-percentage"
                >{{ Math.round((currentChunk / totalChunks) * 100) }}%</span
              >
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: (currentChunk / totalChunks) * 100 + '%' }"
              ></div>
            </div>
          </div>

          <div class="chunk-controls">
            <button @click="abortProcessing" class="btn btn-danger abort-btn">
              🛑 Abort Processing
            </button>
            <div class="context-quick-edit">
              <label>💡 Adjust context for remaining chunks:</label>
              <textarea
                v-model="transcriptionContext"
                class="context-quick-input"
                placeholder="Update context based on results so far..."
                rows="2"
              ></textarea>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Single File Results Section -->
    <div v-if="transcriptionResult && !isChunkedProcessing" class="test-section">
      <h2>📝 Transcription Results</h2>

      <div class="result-card">
        <div class="result-header">
          <h3>🇳🇴 Norwegian Transcription</h3>
          <div class="result-metadata">
            <span class="metadata-item"
              >Service: {{ transcriptionResult.metadata?.transcription_server }}</span
            >
            <span class="metadata-item"
              >Language: {{ transcriptionResult.transcription?.language }}</span
            >
            <span class="metadata-item">File: {{ transcriptionResult.metadata?.filename }}</span>
          </div>
        </div>

        <div class="transcription-text">
          <h4>Transcribed Text:</h4>

          <!-- Show improved text if available -->
          <div v-if="transcriptionResult.transcription?.improved_text" class="improved-text">
            <h5>✨ AI Enhanced Text:</h5>
            <div class="text-content enhanced">
              {{ transcriptionResult.transcription.improved_text }}
            </div>
          </div>

          <!-- Always show raw transcription -->
          <div class="raw-text">
            <h5>🎤 Raw Transcription:</h5>
            <div class="text-content raw">
              {{ transcriptionResult.transcription?.raw_text || transcriptionResult.text }}
            </div>
          </div>
        </div>

        <!-- Save to Portfolio Button -->
        <div class="portfolio-actions">
          <button
            v-if="userStore.loggedIn && !portfolioSaved"
            @click="saveToPortfolio"
            :disabled="savingToPortfolio"
            class="btn btn-success portfolio-btn"
          >
            {{ savingToPortfolio ? 'Saving...' : '💾 Save to Audio Portfolio' }}
          </button>

          <div v-if="portfolioSaved" class="portfolio-success">
            ✅ Saved to your Audio Portfolio!
            <router-link to="/audio-portfolio" class="btn btn-outline-primary btn-sm">
              View Portfolio
            </router-link>
          </div>

          <div v-if="portfolioError" class="portfolio-error">
            ❌ Failed to save to portfolio: {{ portfolioError }}
            <button @click="saveToPortfolio" class="btn btn-outline-danger btn-sm">
              Try Again
            </button>
          </div>
        </div>

        <div class="result-details">
          <h4>Processing Details:</h4>
          <pre>{{ JSON.stringify(transcriptionResult.metadata, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- Chunked Results Section -->
    <div v-if="chunkResults.length > 0" class="test-section">
      <h2>📝 Progressive Transcription Results</h2>

      <div class="chunk-results-container">
        <div v-for="(chunkResult, index) in chunkResults" :key="index" class="chunk-result">
          <div class="chunk-header">
            <h4>
              🎵 Chunk {{ index + 1 }} ({{ formatTime(chunkResult.startTime) }} -
              {{ formatTime(chunkResult.endTime) }})
            </h4>
            <div class="chunk-meta">
              <span class="processing-time">⏱️ {{ chunkResult.processingTime }}s</span>
              <span v-if="chunkResult.improved_text" class="enhancement-indicator"
                >✨ Enhanced</span
              >
            </div>
          </div>

          <!-- Enhanced text if available -->
          <div v-if="chunkResult.improved_text" class="chunk-text enhanced">
            <h5>✨ AI Enhanced:</h5>
            <div class="text-content">{{ chunkResult.improved_text }}</div>
          </div>

          <!-- Raw transcription -->
          <div class="chunk-text raw">
            <h5>🎤 Raw:</h5>
            <div class="text-content">{{ chunkResult.raw_text }}</div>
          </div>
        </div>
      </div>

      <!-- Combined results summary -->
      <div v-if="!isChunkedProcessing && chunkResults.length > 0" class="combined-results">
        <h3>📋 Complete Transcription</h3>
        <div class="combined-text">
          <h4>✨ Full Enhanced Text:</h4>
          <div class="text-content enhanced-combined">
            {{ chunkResults.map((chunk) => chunk.improved_text || chunk.raw_text).join(' ') }}
          </div>

          <h4>🎤 Full Raw Text:</h4>
          <div class="text-content raw-combined">
            {{ chunkResults.map((chunk) => chunk.raw_text).join(' ') }}
          </div>
        </div>

        <!-- Save to Portfolio Button for Chunked Results -->
        <div class="portfolio-actions">
          <button
            v-if="userStore.loggedIn && !portfolioSaved"
            @click="saveChunkedToPortfolio"
            :disabled="savingToPortfolio"
            class="btn btn-success portfolio-btn"
          >
            {{ savingToPortfolio ? 'Saving...' : '💾 Save Complete Transcription to Portfolio' }}
          </button>

          <div v-if="portfolioSaved" class="portfolio-success">
            ✅ Saved to your Audio Portfolio!
            <router-link to="/audio-portfolio" class="btn btn-outline-primary btn-sm">
              View Portfolio
            </router-link>
          </div>

          <div v-if="portfolioError" class="portfolio-error">
            ❌ Failed to save to portfolio: {{ portfolioError }}
            <button @click="saveChunkedToPortfolio" class="btn btn-outline-danger btn-sm">
              Try Again
            </button>
          </div>
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
import { useUserStore } from '@/stores/userStore'

// Store
const userStore = useUserStore()

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
const transcriptionContext = ref('')

// Chunked processing state
const isChunkedProcessing = ref(false)
const currentChunk = ref(0)
const totalChunks = ref(0)
const chunkResults = ref([])
const processingAborted = ref(false)

// Portfolio save state
const savingToPortfolio = ref(false)
const portfolioSaved = ref(false)
const portfolioError = ref(null)

// Base URL for Norwegian transcription worker (complete workflow)
const NORWEGIAN_WORKER_URL = 'https://norwegian-transcription-worker.torarnehave.workers.dev'

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

// Audio chunking utilities
const getAudioDuration = (audioBlob) => {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    audio.onloadedmetadata = () => {
      resolve(audio.duration)
    }
    audio.onerror = reject
    audio.src = URL.createObjectURL(audioBlob)
  })
}

const splitAudioIntoChunks = async (audioBlob, chunkDurationSeconds = 120) => {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const fileReader = new FileReader()

    fileReader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        const sampleRate = audioBuffer.sampleRate
        const chunkSamples = chunkDurationSeconds * sampleRate
        const totalSamples = audioBuffer.length
        const numChunks = Math.ceil(totalSamples / chunkSamples)

        const chunks = []

        console.log(`🔧 Audio info: ${totalSamples} samples, ${sampleRate}Hz, ${numChunks} chunks needed`)

        for (let i = 0; i < numChunks; i++) {
          const startSample = i * chunkSamples
          const endSample = Math.min(startSample + chunkSamples, totalSamples)

          console.log(`🎵 Creating chunk ${i + 1}: samples ${startSample}-${endSample}`)

          // Create new audio buffer for this chunk
          const chunkBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            endSample - startSample,
            sampleRate,
          )

          // Copy audio data to chunk buffer
          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const originalData = audioBuffer.getChannelData(channel)
            const chunkData = chunkBuffer.getChannelData(channel)
            for (let sample = 0; sample < chunkBuffer.length; sample++) {
              chunkData[sample] = originalData[startSample + sample]
            }
          }

          // Convert chunk buffer to blob
          const chunkBlob = await audioBufferToBlob(chunkBuffer)

          console.log(`✅ Chunk ${i + 1} created: ${chunkBlob.size} bytes, ${chunkBuffer.duration.toFixed(2)}s`)

          chunks.push({
            blob: chunkBlob,
            index: i,
            startTime: i * chunkDurationSeconds,
            endTime: Math.min((i + 1) * chunkDurationSeconds, totalSamples / sampleRate),
          })
        }

        resolve(chunks)
      } catch (error) {
        reject(error)
      }
    }

    fileReader.onerror = reject
    fileReader.readAsArrayBuffer(audioBlob)
  })
}

const audioBufferToBlob = (audioBuffer) => {
  return new Promise((resolve) => {
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const length = audioBuffer.length

    // Create WAV file
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
    const view = new DataView(arrayBuffer)

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length * numberOfChannels * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true)
    view.setUint16(32, numberOfChannels * 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, length * numberOfChannels * 2, true)

    // Audio data
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample * 0x7fff, true)
        offset += 2
      }
    }

    resolve(new Blob([arrayBuffer], { type: 'audio/wav' }))
  })
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    selectedFile.value = file
    recordedBlob.value = null // Clear any recorded audio
    error.value = null
    transcriptionResult.value = null

    // Reset portfolio save state for new file
    portfolioSaved.value = false
    portfolioError.value = null

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

      // Reset portfolio save state for new file
      portfolioSaved.value = false
      portfolioError.value = null

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

      // Reset portfolio save state for new recording
      portfolioSaved.value = false
      portfolioError.value = null

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
    console.log('🏥 Checking Norwegian worker health...')
    const response = await fetch(`${NORWEGIAN_WORKER_URL}/health`)

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

  // Reset portfolio save state for new transcription
  portfolioSaved.value = false
  portfolioError.value = null

  resetChunkedState()

  const audioBlob = selectedFile.value || recordedBlob.value
  const fileName = selectedFile.value ? selectedFile.value.name : `recording_${Date.now()}.wav`

  try {
    console.log('🇳🇴 Starting Norwegian transcription analysis:', {
      fileName,
      size: audioBlob.size,
      type: audioBlob.type,
    })

    // Check audio duration to determine if chunking is needed
    loadingMessage.value = 'Analyzing audio file...'
    const audioDuration = await getAudioDuration(audioBlob)
    const CHUNK_THRESHOLD = 300 // 5 minutes

    console.log(`📊 Audio duration: ${Math.round(audioDuration)}s (${formatTime(audioDuration)})`)

    if (audioDuration > CHUNK_THRESHOLD) {
      // Use chunked processing for files > 5 minutes
      await processAudioInChunks(audioBlob, fileName, audioDuration)
    } else {
      // Use single file processing for smaller files
      await processSingleAudioFile(audioBlob, fileName)
    }
  } catch (err) {
    console.error('Norwegian transcription error:', err)
    error.value = {
      message: 'Norwegian transcription failed',
      details: err.message,
    }
  } finally {
    transcribing.value = false
    loadingMessage.value = ''
    isChunkedProcessing.value = false
  }
}

const processSingleAudioFile = async (audioBlob, fileName) => {
  loadingMessage.value = 'Transcribing with Norwegian service...'

  console.log('📄 Processing single file')

  const formData = new FormData()
  formData.append('audio', audioBlob, fileName)
  formData.append('model', 'nb-whisper-small')

  if (transcriptionContext.value.trim()) {
    formData.append('context', transcriptionContext.value.trim())
  }

  const transcribeResponse = await fetch(NORWEGIAN_WORKER_URL, {
    method: 'POST',
    body: formData,
  })

  if (!transcribeResponse.ok) {
    throw new Error(
      `Transcription failed: ${transcribeResponse.status} ${transcribeResponse.statusText}`,
    )
  }

  const result = await transcribeResponse.json()
  console.log('✅ Single file transcription result:', result)

  transcriptionResult.value = {
    success: true,
    transcription: {
      raw_text: result.transcription?.raw_text || result.transcription?.text || result.text,
      improved_text: result.transcription?.improved_text,
      language: result.transcription?.language || 'no',
      chunks: result.transcription?.chunks || 1,
      processing_time: result.transcription?.processing_time || 0,
      improvement_time: result.transcription?.improvement_time || 0,
      timestamp: new Date().toISOString(),
    },
    metadata: {
      filename: fileName,
      model: result.metadata?.model || 'nb-whisper-small',
      total_processing_time: result.metadata?.total_processing_time || 0,
      transcription_server: 'Worker Orchestration (Hetzner + Cloudflare AI)',
      text_improvement: result.metadata?.text_improvement || 'Cloudflare Workers AI',
      cloudflare_ai_available: !!result.transcription?.improved_text,
    },
  }
}

const processAudioInChunks = async (audioBlob, fileName, audioDuration) => {
  loadingMessage.value = 'Splitting audio into 2-minute chunks...'
  isChunkedProcessing.value = true

  console.log('🧩 Processing in chunks - splitting audio...')

  // Split audio into 2-minute chunks
  const chunks = await splitAudioIntoChunks(audioBlob, 120) // 2 minutes
  totalChunks.value = chunks.length

  console.log(`📊 Split into ${chunks.length} chunks of ~2 minutes each`)

  // Process each chunk sequentially
  for (let i = 0; i < chunks.length; i++) {
    if (processingAborted.value) {
      console.log('🛑 Processing aborted by user')
      break
    }

    currentChunk.value = i + 1
    loadingMessage.value = `Processing chunk ${i + 1}/${chunks.length} (${formatTime(chunks[i].startTime)} - ${formatTime(chunks[i].endTime)})...`

    try {
      const chunkStart = performance.now()

      // Validate chunk before processing
      if (!chunks[i].blob || chunks[i].blob.size === 0) {
        throw new Error(`Chunk ${i + 1} is empty or invalid`)
      }

      console.log(`🎯 Processing chunk ${i + 1}: ${chunks[i].blob.size} bytes, ${chunks[i].blob.type}`)

      // Process this chunk
      const formData = new FormData()
      formData.append('audio', chunks[i].blob, `${fileName}_chunk_${i + 1}.wav`)
      formData.append('model', 'nb-whisper-small')

      if (transcriptionContext.value.trim()) {
        formData.append('context', transcriptionContext.value.trim())
      }

      const transcribeResponse = await fetch(NORWEGIAN_WORKER_URL, {
        method: 'POST',
        body: formData,
      })

      console.log(`📡 Chunk ${i + 1} request sent, response status: ${transcribeResponse.status}`)

      // Log response details for debugging 500 errors
      if (!transcribeResponse.ok) {
        const errorText = await transcribeResponse.text()
        console.error(`❌ Chunk ${i + 1} error response:`, errorText)
      }

      if (!transcribeResponse.ok) {
        const errorText = await transcribeResponse.text()
        throw new Error(`Chunk ${i + 1} failed: ${transcribeResponse.status} - ${errorText}`)
      }

      const result = await transcribeResponse.json()
      const chunkProcessingTime = Math.round((performance.now() - chunkStart) / 1000)

      console.log(
        `✅ Chunk ${i + 1} completed in ${chunkProcessingTime}s:`,
        result.transcription?.raw_text?.substring(0, 100),
      )

      // Add to results
      chunkResults.value.push({
        index: i,
        startTime: chunks[i].startTime,
        endTime: chunks[i].endTime,
        raw_text: result.transcription?.raw_text || result.transcription?.text || result.text,
        improved_text: result.transcription?.improved_text,
        processingTime: chunkProcessingTime,
        metadata: result.metadata,
      })
    } catch (err) {
      console.error(`Error processing chunk ${i + 1}:`, err)

      // Add failed chunk to results
      chunkResults.value.push({
        index: i,
        startTime: chunks[i].startTime,
        endTime: chunks[i].endTime,
        raw_text: `[Error processing chunk ${i + 1}: ${err.message}]`,
        improved_text: null,
        processingTime: 0,
        error: true,
      })
    }
  }

  if (!processingAborted.value) {
    loadingMessage.value = `Completed processing ${chunkResults.value.length} chunks!`
    console.log('🎉 All chunks processed successfully')

    setTimeout(() => {
      loadingMessage.value = ''
    }, 3000)
  }
}

const clearError = () => {
  error.value = null
  portfolioError.value = null
}

// Utility functions
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const abortProcessing = () => {
  processingAborted.value = true
  transcribing.value = false
  isChunkedProcessing.value = false
  loadingMessage.value = 'Processing aborted by user'

  setTimeout(() => {
    loadingMessage.value = ''
  }, 3000)
}

const resetChunkedState = () => {
  isChunkedProcessing.value = false
  currentChunk.value = 0
  totalChunks.value = 0
  chunkResults.value = []
  processingAborted.value = false

  // Reset portfolio save state for new transcription
  portfolioSaved.value = false
  portfolioError.value = null
}

// Portfolio saving functions
const saveToPortfolio = async () => {
  if (!transcriptionResult.value || !userStore.loggedIn) {
    return
  }

  savingToPortfolio.value = true
  portfolioError.value = null

  try {
    const audioBlob = selectedFile.value || recordedBlob.value
    const fileName = selectedFile.value ? selectedFile.value.name : `recording_${Date.now()}.wav`

    console.log('=== UPLOADING AUDIO TO R2 ===')
    console.log('Audio file details:', { fileName, size: audioBlob.size, type: audioBlob.type })

    // Step 1: Upload audio file to R2 using Norwegian transcription worker
    const uploadResponse = await fetch(`${NORWEGIAN_WORKER_URL}/upload`, {
      method: 'POST',
      headers: {
        'X-File-Name': fileName,
      },
      body: audioBlob,
    })

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.json()
      throw new Error(uploadError.error || `Upload failed: ${uploadResponse.status}`)
    }

    const uploadResult = await uploadResponse.json()
    console.log('✅ Audio uploaded to R2:', uploadResult)

    // Step 2: Create recording data for the audio-portfolio-worker with R2 URL
    const recordingData = {
      userEmail: userStore.email,
      fileName: fileName,
      displayName: fileName.replace(/\.[^/.]+$/, ''), // Remove extension for display name
      fileSize: audioBlob.size,
      duration: recordingDuration.value || 0,

      // R2 Information from upload
      r2Key: uploadResult.r2Key,
      r2Url: uploadResult.audioUrl,

      // Norwegian transcription data - support both raw and improved text
      transcriptionText:
        transcriptionResult.value.transcription.improved_text ||
        transcriptionResult.value.transcription.raw_text,
      norwegianTranscription: {
        raw_text: transcriptionResult.value.transcription.raw_text,
        improved_text: transcriptionResult.value.transcription.improved_text,
        language: transcriptionResult.value.transcription.language,
        processing_time: transcriptionResult.value.transcription.processing_time,
        improvement_time: transcriptionResult.value.transcription.improvement_time,
      },

      // Organization
      category: 'Norwegian Transcription',
      tags: [
        'norwegian',
        'transcription',
        transcriptionResult.value.transcription.improved_text ? 'ai-enhanced' : 'raw-only',
        'vegvisr-transcription',
      ],

      // Technical metadata
      audioFormat: audioBlob.type.split('/')[1] || 'wav',
      aiService: 'Norwegian Transcription Worker',
      aiModel: transcriptionResult.value.metadata.model || 'nb-whisper-small',
      processingTime: transcriptionResult.value.metadata.total_processing_time || 0,

      // Context information
      transcriptionContext: transcriptionContext.value,

      // Service metadata
      transcriptionServer: transcriptionResult.value.metadata.transcription_server,
      textImprovement: transcriptionResult.value.metadata.text_improvement,
      cloudflareAiAvailable: transcriptionResult.value.metadata.cloudflare_ai_available,
    }

    console.log('=== SAVING TO PORTFOLIO ===')
    console.log('Recording data:', JSON.stringify(recordingData, null, 2))

    // Step 3: Call the audio-portfolio-worker API
    const response = await fetch(
      'https://audio-portfolio-worker.torarnehave.workers.dev/save-recording',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userStore.email,
        },
        body: JSON.stringify(recordingData),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to save to portfolio: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Successfully saved to portfolio:', result)

    portfolioSaved.value = true
  } catch (err) {
    console.error('Failed to save audio to portfolio:', err)
    portfolioError.value = err.message
  } finally {
    savingToPortfolio.value = false
  }
}

const saveChunkedToPortfolio = async () => {
  if (!chunkResults.value.length || !userStore.loggedIn) {
    return
  }

  savingToPortfolio.value = true
  portfolioError.value = null

  try {
    const audioBlob = selectedFile.value || recordedBlob.value
    const fileName = selectedFile.value ? selectedFile.value.name : `recording_${Date.now()}.wav`

    console.log('=== UPLOADING CHUNKED AUDIO TO R2 ===')
    console.log('Audio file details:', { fileName, size: audioBlob.size, type: audioBlob.type })

    // Step 1: Upload audio file to R2 using Norwegian transcription worker
    const uploadResponse = await fetch(`${NORWEGIAN_WORKER_URL}/upload`, {
      method: 'POST',
      headers: {
        'X-File-Name': fileName,
      },
      body: audioBlob,
    })

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.json()
      throw new Error(uploadError.error || `Upload failed: ${uploadResponse.status}`)
    }

    const uploadResult = await uploadResponse.json()
    console.log('✅ Chunked audio uploaded to R2:', uploadResult)

    // Step 2: Combine all chunk results
    const combinedRawText = chunkResults.value.map((chunk) => chunk.raw_text).join(' ')
    const combinedImprovedText = chunkResults.value
      .map((chunk) => chunk.improved_text || chunk.raw_text)
      .join(' ')

    // Calculate total processing time
    const totalProcessingTime = chunkResults.value.reduce(
      (total, chunk) => total + (chunk.processingTime || 0),
      0,
    )

    // Step 3: Create recording data for the audio-portfolio-worker with R2 URL
    const recordingData = {
      userEmail: userStore.email,
      fileName: fileName,
      displayName: fileName.replace(/\.[^/.]+$/, '') + ' (Chunked Processing)', // Add chunked indicator
      fileSize: audioBlob.size,
      duration: recordingDuration.value || 0,

      // R2 Information from upload
      r2Key: uploadResult.r2Key,
      r2Url: uploadResult.audioUrl,

      // Norwegian transcription data - combined from all chunks
      transcriptionText: combinedImprovedText,
      norwegianTranscription: {
        raw_text: combinedRawText,
        improved_text: combinedImprovedText,
        language: 'no',
        processing_time: totalProcessingTime,
        chunks: chunkResults.value.length,
        chunk_details: chunkResults.value.map((chunk) => ({
          index: chunk.index,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          raw_text: chunk.raw_text,
          improved_text: chunk.improved_text,
          processingTime: chunk.processingTime,
        })),
      },

      // Organization
      category: 'Norwegian Transcription (Chunked)',
      tags: [
        'norwegian',
        'transcription',
        'chunked-processing',
        'ai-enhanced',
        'vegvisr-transcription',
        `${chunkResults.value.length}-chunks`,
      ],

      // Technical metadata
      audioFormat: audioBlob.type.split('/')[1] || 'wav',
      aiService: 'Norwegian Transcription Worker (Chunked)',
      aiModel: 'nb-whisper-small',
      processingTime: totalProcessingTime,

      // Context information
      transcriptionContext: transcriptionContext.value,

      // Service metadata
      transcriptionServer: 'Worker Orchestration (Hetzner + Cloudflare AI)',
      textImprovement: 'Cloudflare Workers AI',
      cloudflareAiAvailable: true,
    }

    console.log('=== SAVING CHUNKED TRANSCRIPTION TO PORTFOLIO ===')
    console.log('Recording data:', JSON.stringify(recordingData, null, 2))

    // Step 4: Call the audio-portfolio-worker API
    const response = await fetch(
      'https://audio-portfolio-worker.torarnehave.workers.dev/save-recording',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userStore.email,
        },
        body: JSON.stringify(recordingData),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to save to portfolio: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Successfully saved chunked transcription to portfolio:', result)

    portfolioSaved.value = true
  } catch (err) {
    console.error('Failed to save chunked audio to portfolio:', err)
    portfolioError.value = err.message
  } finally {
    savingToPortfolio.value = false
  }
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

.context-section {
  margin: 20px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #dc143c;
}

.context-section h4 {
  margin: 0 0 10px 0;
  color: #dc143c;
}

.context-help {
  color: #666;
  margin-bottom: 10px;
  font-size: 0.9rem;
}

.context-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.9rem;
  resize: vertical;
  min-height: 80px;
}

.context-input:focus {
  border-color: #dc143c;
  outline: none;
  box-shadow: 0 0 0 3px rgba(220, 20, 60, 0.1);
}

.context-examples {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
}

.example-list {
  margin: 5px 0 0 0;
  padding-left: 20px;
}

.example-list li {
  margin: 2px 0;
  color: #666;
  font-size: 0.85rem;
}

/* Chunked Processing Styles */
.chunk-progress {
  margin-top: 20px;
  padding: 20px;
  background: #f0f8ff;
  border-radius: 8px;
  border: 1px solid #87ceeb;
}

.progress-info h4 {
  margin: 0 0 15px 0;
  color: #1e40af;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.chunk-counter {
  font-weight: bold;
  color: #1e40af;
}

.progress-percentage {
  font-size: 1.2rem;
  font-weight: bold;
  color: #059669;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 15px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  transition: width 0.3s ease;
}

.chunk-controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.abort-btn {
  background: #dc2626;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  align-self: flex-start;
}

.abort-btn:hover {
  background: #b91c1c;
}

.context-quick-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.context-quick-edit label {
  font-weight: 500;
  color: #374151;
}

.context-quick-input {
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  resize: vertical;
  font-family: inherit;
}

/* Chunk Results Styles */
.chunk-results-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.chunk-result {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  background: white;
}

.chunk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f3f4f6;
}

.chunk-header h4 {
  margin: 0;
  color: #1f2937;
}

.chunk-meta {
  display: flex;
  gap: 10px;
  align-items: center;
}

.processing-time {
  color: #6b7280;
  font-size: 0.9rem;
}

.enhancement-indicator {
  background: #10b981;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.chunk-text {
  margin-bottom: 15px;
}

.chunk-text h5 {
  margin: 0 0 8px 0;
  color: #374151;
  font-size: 0.9rem;
}

.chunk-text.enhanced .text-content {
  background: #f0fdf4;
  border-left: 4px solid #10b981;
  padding: 12px;
  border-radius: 4px;
}

.chunk-text.raw .text-content {
  background: #fafafa;
  border-left: 4px solid #6b7280;
  padding: 12px;
  border-radius: 4px;
}

.combined-results {
  margin-top: 30px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.combined-results h3 {
  margin: 0 0 20px 0;
  color: #1f2937;
}

.combined-text h4 {
  margin: 15px 0 10px 0;
  color: #374151;
}

.enhanced-combined {
  background: #ecfdf5;
  border: 1px solid #10b981;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 15px;
  line-height: 1.6;
}

.raw-combined {
  background: #f5f5f5;
  border: 1px solid #6b7280;
  padding: 15px;
  border-radius: 6px;
  line-height: 1.6;
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

/* Portfolio Action Styles */
.portfolio-actions {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.portfolio-btn {
  font-size: 1.1rem;
  padding: 12px 24px;
  margin-bottom: 10px;
}

.portfolio-success {
  background: #d4edda;
  color: #155724;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid #c3e6cb;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.portfolio-success .btn {
  font-size: 0.9rem;
  padding: 6px 12px;
}

.portfolio-error {
  background: #f8d7da;
  color: #721c24;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid #f5c6cb;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.portfolio-error .btn {
  font-size: 0.9rem;
  padding: 6px 12px;
}

.btn-outline-primary {
  background: transparent;
  color: #007bff;
  border: 1px solid #007bff;
}

.btn-outline-primary:hover {
  background: #007bff;
  color: white;
}

.btn-outline-danger {
  background: transparent;
  color: #dc3545;
  border: 1px solid #dc3545;
}

.btn-outline-danger:hover {
  background: #dc3545;
  color: white;
}
</style>
