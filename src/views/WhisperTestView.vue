<template>
  <div class="whisper-test-view">
    <div class="header">
      <h1>🎵 Whisper AI Transcription Test</h1>
      <p>Test the whisper transcription service with audio files</p>
    </div>

    <!-- Health Check Section -->
    <div class="test-section">
      <h2>Service Health Check</h2>
      <button @click="checkHealth" :disabled="healthLoading" class="btn btn-primary">
        {{ healthLoading ? 'Checking...' : 'Check Service Health' }}
      </button>

      <div v-if="healthStatus" class="status-result" :class="healthStatus.type">
        <strong>Status:</strong> {{ healthStatus.message }}
      </div>
    </div>

    <!-- Audio Upload Section -->
    <div class="test-section">
      <h2>Audio File Upload</h2>

      <!-- File Input -->
      <div class="upload-area">
        <input
          ref="fileInput"
          type="file"
          accept="audio/*,.wav,.mp3"
          @change="handleFileSelect"
          class="file-input"
        />
        <button @click="$refs.fileInput.click()" class="btn btn-secondary">
          Choose Audio File
        </button>
      </div>

      <!-- File Info -->
      <div v-if="selectedFile" class="file-info">
        <h3>Selected File</h3>
        <p><strong>Name:</strong> {{ selectedFile.name }}</p>
        <p><strong>Type:</strong> {{ selectedFile.type }}</p>
        <p><strong>Size:</strong> {{ formatFileSize(selectedFile.size) }}</p>
      </div>
    </div>

    <!-- Microphone Recording Section -->
    <div class="test-section">
      <h2>🎤 Microphone Recording</h2>

      <!-- Storage Toggle -->
      <div class="recording-options">
        <label class="toggle-option">
          <input type="checkbox" v-model="saveRecording" />
          <span class="toggle-label">💾 Keep recording permanently in R2</span>
        </label>
        <div class="toggle-description">
          <small v-if="saveRecording"
            >💾 Recording stored permanently in R2 for future re-transcription</small
          >
          <small v-else>⚡ Recording transcribed via R2 but not kept permanently</small>
        </div>
      </div>

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
        <audio :src="recordedUrl" controls></audio>
        <div class="recorded-info">
          <span>Duration: {{ Math.round(recordingDuration) }}s</span>
          <span>Size: {{ formatFileSize(recordedBlob.size) }}</span>
        </div>
      </div>
    </div>

    <!-- URL Input Section -->
    <div class="test-section">
      <h2>Audio URL Input</h2>
      <div class="url-input-group">
        <input
          v-model="audioUrl"
          type="url"
          placeholder="Enter audio file URL (e.g., https://example.com/audio.wav)"
          class="url-input"
        />
        <button @click="loadFromUrl" class="btn btn-secondary">Load URL</button>
      </div>
    </div>

    <!-- Transcription Section -->
    <div class="test-section">
      <h2>Transcription Test</h2>

      <!-- Service Selection -->
      <div class="service-selection">
        <h3>Choose Transcription Service</h3>
        <div class="service-options">
          <label class="service-option">
            <input type="radio" v-model="selectedService" value="cloudflare" name="service" />
            <span class="service-label">
              🔥 Cloudflare Workers AI
              <small>@cf/openai/whisper - Fast & integrated</small>
            </span>
          </label>
          <label class="service-option">
            <input type="radio" v-model="selectedService" value="openai" name="service" />
            <span class="service-label">
              🤖 OpenAI Direct API
              <small>Multiple models available</small>
            </span>
          </label>
        </div>
      </div>

      <!-- OpenAI Model Selection -->
      <div v-if="selectedService === 'openai'" class="model-selection">
        <h3>OpenAI Model Selection</h3>
        <select v-model="selectedOpenAIModel" class="model-select">
          <option value="whisper-1">whisper-1 (Open Source Whisper V2)</option>
          <option value="gpt-4o-transcribe">gpt-4o-transcribe (Latest GPT-4o)</option>
          <option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe (Cost-effective)</option>
        </select>

        <div class="openai-options">
          <div class="option-group">
            <label>Language:</label>
            <select v-model="openaiLanguage" class="option-select">
              <option value="nb">Norwegian Bokmål (nb)</option>
              <option value="nn">Norwegian Nynorsk (nn)</option>
              <option value="en">English (en)</option>
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
          </div>
        </div>
      </div>

      <!-- File Processing Info -->
      <div v-if="selectedFile" class="processing-info">
        <div class="info-badge" :class="getFileSizeClass(selectedFile.size)">
          {{ getFileSizeInfo(selectedFile.size) }}
        </div>
      </div>

      <button
        @click="transcribeAudio"
        :disabled="(!selectedFile && !recordedBlob) || transcribing"
        class="btn btn-success"
      >
        {{ transcribing ? 'Transcribing...' : 'Start Transcription' }}
      </button>

      <div v-if="transcribing" class="loading">
        <div class="loading-spinner"></div>

        <!-- Chunking Progress -->
        <div v-if="isChunking" class="chunking-progress">
          <p>📦 Processing audio with 30-second chunks...</p>
          <div class="progress-info">
            <span>Audio Chunk {{ chunkProgress.current }} of {{ chunkProgress.total }}</span>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${(chunkProgress.current / chunkProgress.total) * 100}%` }"
              ></div>
            </div>
          </div>
          <div class="rate-limit-info">
            <small>⏱️ 2-second delays between chunks to respect OpenAI rate limits</small><br />
            <small>🔄 Automatic retry with exponential backoff for failed chunks</small>
          </div>
        </div>

        <!-- Single File Progress -->
        <div v-else>
          <p>🎵 Processing audio file... Please wait.</p>
        </div>
      </div>

      <!-- Streaming Results -->
      <div v-if="isChunking && streamingResult" class="streaming-results">
        <h3>🌊 Live Transcription (Streaming)</h3>
        <div class="streaming-text">
          {{ streamingResult }}
          <span class="cursor-blink">|</span>
        </div>
      </div>

      <!-- Results -->
      <div v-if="transcriptionResult" class="result-section">
        <h3>Transcription Result</h3>
        <div class="transcription-text">
          {{ transcriptionResult.text || 'No text detected' }}
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="error-section">
        <h3>Error</h3>
        <p>{{ error.message }}</p>
        <pre v-if="error.details">{{ error.details }}</pre>
      </div>
    </div>

    <!-- Debug Information -->
    <div class="test-section debug-section">
      <h2>Debug Information</h2>
      <div class="debug-content">
        <div class="debug-item">
          <strong>Architecture:</strong> R2-First Cloud Storage + Transcription
        </div>
        <div class="debug-item">
          <strong>Upload Endpoint:</strong> https://whisper.vegvisr.org/upload
        </div>
        <div class="debug-item">
          <strong>R2 Transcription:</strong> https://whisper.vegvisr.org/transcribe?url=...
        </div>
        <div class="debug-item">
          <strong>Health Endpoint:</strong> https://whisper.vegvisr.org/health
        </div>
        <div class="debug-item"><strong>Supported Formats:</strong> WAV, MP3, M4A, FLAC</div>
        <div class="debug-item">
          <strong>File Processing:</strong> All files stored in R2, then transcribed with selected
          model
        </div>
        <div class="debug-item">
          <strong>Chunking:</strong> 30-second chunks for long files, each stored separately in R2
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// Reactive state
const healthLoading = ref(false)
const healthStatus = ref(null)
const selectedFile = ref(null)
const audioUrl = ref('')
const isDragOver = ref(false)
const transcribing = ref(false)
const transcriptionResult = ref(null)
const error = ref(null)

// Chunking state
const isChunking = ref(false)
const chunkProgress = ref({ current: 0, total: 0 })
const streamingResult = ref('')

// Service selection state
const selectedService = ref('cloudflare')
const selectedOpenAIModel = ref('whisper-1')
const openaiLanguage = ref('no')
const openaiTemperature = ref('0')

// Recording state
const recording = ref(false)
const recordedBlob = ref(null)
const recordedUrl = ref('')
const recordingDuration = ref(0)
const saveRecording = ref(false)
const microphoneSupported = ref(false)
const mediaRecorder = ref(null)
const recordingTimer = ref(null)

// Refs for DOM elements
const fileInput = ref(null)
const audioPlayer = ref(null)

// Recording functions
const checkMicrophoneSupport = async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    microphoneSupported.value = false
    return false
  }

  try {
    // Test microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop()) // Stop test stream
    microphoneSupported.value = true
    return true
  } catch (error) {
    console.warn('Microphone access denied or not available:', error)
    microphoneSupported.value = false
    return false
  }
}

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // Create MediaRecorder with WAV format if supported, fallback to default
    const options = MediaRecorder.isTypeSupported('audio/wav')
      ? { mimeType: 'audio/wav' }
      : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : {}

    mediaRecorder.value = new MediaRecorder(stream, options)
    const audioChunks = []

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.value.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
      recordedBlob.value = audioBlob
      recordedUrl.value = URL.createObjectURL(audioBlob)

      // Stop all tracks to release microphone
      stream.getTracks().forEach((track) => track.stop())

      console.log('🎤 Recording completed:', {
        size: audioBlob.size,
        duration: recordingDuration.value,
        saveToStorage: saveRecording.value,
      })
    }

    // Start recording
    mediaRecorder.value.start()
    recording.value = true
    recordingDuration.value = 0

    // Start timer
    recordingTimer.value = setInterval(() => {
      recordingDuration.value += 1
    }, 1000)

    console.log('🎤 Recording started...')
  } catch (error) {
    console.error('Failed to start recording:', error)
    alert('Failed to access microphone. Please ensure microphone permissions are granted.')
  }
}

const stopRecording = () => {
  if (mediaRecorder.value && recording.value) {
    mediaRecorder.value.stop()
    recording.value = false

    // Clear timer
    if (recordingTimer.value) {
      clearInterval(recordingTimer.value)
      recordingTimer.value = null
    }

    console.log('🎤 Recording stopped')
  }
}

const transcribeRecording = async () => {
  if (!recordedBlob.value) {
    throw new Error('No recording available')
  }

  const recordingFile = new File(
    [recordedBlob.value],
    `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`,
    { type: 'audio/wav' },
  )

  if (saveRecording.value) {
    // Path 1: Upload to R2 then transcribe
    console.log('📤 Uploading recording to R2 storage...')
    return await transcribeRecordingViaR2(recordingFile)
  } else {
    // Path 2: Direct transcription
    console.log('⚡ Transcribing recording directly...')
    return await transcribeRecordingDirect(recordingFile)
  }
}

const uploadFileToR2 = async (file) => {
  console.log('📤 Uploading to R2:', file.name)

  const uploadResponse = await fetch('https://whisper.vegvisr.org/upload', {
    method: 'POST',
    headers: {
      'Content-Type': file.type,
      'X-File-Name': file.name,
    },
    body: file,
  })

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`)
  }

  const uploadResult = await uploadResponse.json()
  console.log('✅ File uploaded to R2:', uploadResult.r2Key)
  return uploadResult
}

const transcribeFromR2 = async (audioUrl, service, model, language, temperature) => {
  // Build transcription URL with service and model parameters
  const params = new URLSearchParams({
    url: audioUrl,
    service: service,
    model: model,
    temperature: temperature,
  })

  // Only add language for whisper-1 model
  if (language && language !== 'auto' && model === 'whisper-1') {
    params.append('language', language)
  }

  const transcribeUrl = `https://whisper.vegvisr.org/transcribe?${params.toString()}`
  console.log('🔗 R2 transcription URL:', transcribeUrl)

  const transcribeResponse = await fetch(transcribeUrl)

  if (!transcribeResponse.ok) {
    const errorText = await transcribeResponse.text()
    throw new Error(
      `R2 transcription failed: ${transcribeResponse.status} ${transcribeResponse.statusText}: ${errorText}`,
    )
  }

  return await transcribeResponse.json()
}

const transcribeRecordingViaR2 = async (recordingFile) => {
  // Upload to R2 first
  const uploadResult = await uploadFileToR2(recordingFile)

  // Transcribe from R2 with user's selected service/model
  return await transcribeFromR2(
    uploadResult.audioUrl,
    selectedService.value,
    selectedService.value === 'openai' ? selectedOpenAIModel.value : '@cf/openai/whisper',
    openaiLanguage.value,
    openaiTemperature.value,
  )
}

const transcribeFileViaR2 = async () => {
  // Upload file to R2 first
  const uploadResult = await uploadFileToR2(selectedFile.value)

  // Transcribe from R2 with user's selected service/model
  const result = await transcribeFromR2(
    uploadResult.audioUrl,
    selectedService.value,
    selectedService.value === 'openai' ? selectedOpenAIModel.value : '@cf/openai/whisper',
    openaiLanguage.value,
    openaiTemperature.value,
  )

  transcriptionResult.value = result
  console.log('✅ File transcription from R2 completed')
}

const transcribeRecordingDirect = async (recordingFile) => {
  if (selectedService.value === 'openai') {
    const params = new URLSearchParams({
      model: selectedOpenAIModel.value,
      temperature: openaiTemperature.value,
      response_format: 'json',
    })

    if (openaiLanguage.value !== 'auto' && selectedOpenAIModel.value === 'whisper-1') {
      params.append('language', openaiLanguage.value)
    }

    const endpoint = `https://whisper.vegvisr.org/transcribe-openai?${params.toString()}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': recordingFile.type,
        'X-File-Name': recordingFile.name,
      },
      body: recordingFile,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `OpenAI transcription failed: ${response.status} ${response.statusText}: ${errorText}`,
      )
    }

    return await response.json()
  } else {
    // Cloudflare Workers AI
    const response = await fetch('https://whisper.vegvisr.org/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': recordingFile.type,
        'X-File-Name': recordingFile.name,
      },
      body: recordingFile,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Cloudflare transcription failed: ${response.status} ${response.statusText}: ${errorText}`,
      )
    }

    return await response.json()
  }
}

// Computed properties
const canTranscribe = computed(() => {
  return selectedFile.value || audioUrl.value || recordedBlob.value
})

// Health check function
const checkHealth = async () => {
  healthLoading.value = true
  healthStatus.value = null

  try {
    const response = await fetch('https://whisper.vegvisr.org/health')

    if (response.ok) {
      const text = await response.text()
      healthStatus.value = {
        type: 'success',
        message: `✅ Service is healthy: ${text}`,
      }
    } else {
      healthStatus.value = {
        type: 'error',
        message: `❌ Service error: ${response.status} ${response.statusText}`,
      }
    }
  } catch (err) {
    healthStatus.value = {
      type: 'error',
      message: `❌ Connection failed: ${err.message}`,
    }
  } finally {
    healthLoading.value = false
  }
}

// File handling functions
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    setSelectedFile(file)
  }
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragOver.value = false

  const files = event.dataTransfer.files
  if (files.length > 0) {
    setSelectedFile(files[0])
  }
}

const setSelectedFile = (file) => {
  // Validate file type
  const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/flac']
  const validExtensions = ['.wav', '.mp3', '.m4a', '.flac']

  const isValidType =
    validTypes.includes(file.type) ||
    validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))

  if (!isValidType) {
    error.value = {
      message: 'Invalid file type. Please select a WAV, MP3, M4A, or FLAC file.',
      details: `File type: ${file.type}, Name: ${file.name}`,
    }
    return
  }

  // File size info (audio chunking enabled for long files)
  console.log(`📁 File selected: ${file.name} (${formatFileSize(file.size)})`)

  // Set file immediately
  selectedFile.value = file
  audioUrl.value = URL.createObjectURL(file)
  error.value = null
  transcriptionResult.value = null
  streamingResult.value = ''
  isChunking.value = false
  chunkProgress.value = { current: 0, total: 0 }

  // Try to get duration for better info (non-blocking)
  getAudioDuration(file)
    .then((duration) => {
      console.log(`⏱️ Audio duration: ${duration.toFixed(1)}s`)
      if (duration > 60) {
        console.log(`📦 Long audio detected - will use 30-second audio chunking`)
      }
    })
    .catch((err) => {
      console.log(`⚠️ Could not determine audio duration: ${err.message}`)
    })
}

const loadFromUrl = async () => {
  if (!audioUrl.value) return

  try {
    const response = await fetch(audioUrl.value)
    if (!response.ok) {
      throw new Error(`Failed to load audio: ${response.status} ${response.statusText}`)
    }

    const blob = await response.blob()
    const file = new File([blob], 'audio-from-url.wav', { type: blob.type })
    setSelectedFile(file)
  } catch (err) {
    error.value = {
      message: 'Failed to load audio from URL',
      details: err.message,
    }
  }
}

// Smart transcription function with service selection
const transcribeAudio = async () => {
  if (!selectedFile.value && !recordedBlob.value) return

  transcribing.value = true
  error.value = null
  transcriptionResult.value = null
  streamingResult.value = ''

  try {
    if (recordedBlob.value) {
      // Transcribe recording
      console.log(
        `🎤 Processing recording: ${recordingDuration.value}s (${(recordedBlob.value.size / 1024).toFixed(1)}KB)`,
      )
      console.log(`💾 Save to storage: ${saveRecording.value}`)
      console.log(`🔧 Using service: ${selectedService.value}`)

      const result = await transcribeRecording()
      transcriptionResult.value = result
      console.log('✅ Recording transcription completed')
    } else if (selectedFile.value) {
      const fileSize = selectedFile.value.size
      const fileSizeMB = fileSize / (1024 * 1024)

      console.log(`🎵 Processing file: ${selectedFile.value.name} (${fileSizeMB.toFixed(2)} MB)`)
      console.log(`🔧 Using service: ${selectedService.value}`)

      // Check if chunking is needed based on duration (estimate > 60 seconds)
      const estimatedDuration = await getAudioDuration(selectedFile.value)
      console.log(`⏱️ Estimated audio duration: ${estimatedDuration.toFixed(1)}s`)

      if (estimatedDuration > 60) {
        console.log('📦 Long audio detected, using 30-second audio chunking...')
        await transcribeChunkedFile()
      } else {
        // Short audio - use R2-first processing
        console.log('📤 Using R2-first workflow for file upload...')
        await transcribeFileViaR2()
      }
    }
  } catch (err) {
    error.value = {
      message: 'Transcription failed',
      details: err.message,
    }
  } finally {
    transcribing.value = false
    isChunking.value = false
  }
}

// Direct transcription for small files (≤5MB)
const transcribeSmallFile = async () => {
  const response = await fetch('https://whisper.vegvisr.org/transcribe', {
    method: 'POST',
    headers: {
      'Content-Type': selectedFile.value.type || 'audio/wav',
      'X-File-Name': selectedFile.value.name,
    },
    body: selectedFile.value,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Direct transcription failed: ${response.status} ${response.statusText}: ${errorText}`,
    )
  }

  const result = await response.json()
  transcriptionResult.value = result
  console.log('✅ Direct transcription completed')
}

// Legacy function removed - replaced with chunking approach

// OpenAI Direct API transcription
const transcribeWithOpenAI = async () => {
  // Build query parameters
  const params = new URLSearchParams({
    model: selectedOpenAIModel.value,
    temperature: openaiTemperature.value,
    response_format: 'json',
  })

  // Add language if not auto-detect
  if (openaiLanguage.value !== 'auto') {
    params.append('language', openaiLanguage.value)
  }

  const endpoint = `https://whisper.vegvisr.org/transcribe-openai?${params.toString()}`
  console.log('🔥 OpenAI endpoint:', endpoint)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': selectedFile.value.type || 'audio/wav',
      'X-File-Name': selectedFile.value.name,
    },
    body: selectedFile.value,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `OpenAI transcription failed: ${response.status} ${response.statusText}: ${errorText}`,
    )
  }

  const result = await response.json()
  transcriptionResult.value = result
  console.log('✅ OpenAI transcription completed:', result)
}

// Audio-aware chunking functions
const splitFileIntoAudioChunks = async (file, chunkDurationSeconds = 30) => {
  try {
    console.log('🎵 Starting audio-aware chunking...')

    // Create AudioContext
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    console.log('📁 File loaded as ArrayBuffer:', arrayBuffer.byteLength, 'bytes')

    // Decode audio data
    console.log('🔄 Decoding audio...')
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    console.log('✅ Audio decoded:', {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      length: audioBuffer.length,
    })

    // Calculate chunk parameters
    const totalDuration = audioBuffer.duration
    const numChunks = Math.ceil(totalDuration / chunkDurationSeconds)
    const samplesPerChunk = audioBuffer.sampleRate * chunkDurationSeconds

    console.log(`📦 Will create ${numChunks} chunks of ${chunkDurationSeconds}s each`)

    const chunks = []

    for (let i = 0; i < numChunks; i++) {
      const startSample = i * samplesPerChunk
      const endSample = Math.min((i + 1) * samplesPerChunk, audioBuffer.length)
      const chunkLength = endSample - startSample

      console.log(
        `🔧 Creating chunk ${i + 1}: samples ${startSample}-${endSample} (${chunkLength} samples)`,
      )

      // Create new AudioBuffer for this chunk
      const chunkBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        chunkLength,
        audioBuffer.sampleRate,
      )

      // Copy audio data for each channel
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel)
        const chunkData = chunkBuffer.getChannelData(channel)

        for (let sample = 0; sample < chunkLength; sample++) {
          chunkData[sample] = originalData[startSample + sample]
        }
      }

      // Convert AudioBuffer to WAV Blob
      const wavBlob = audioBufferToWav(chunkBuffer)
      chunks.push({
        blob: wavBlob,
        index: i,
        startTime: startSample / audioBuffer.sampleRate,
        endTime: endSample / audioBuffer.sampleRate,
        duration: chunkLength / audioBuffer.sampleRate,
      })

      console.log(`✅ Chunk ${i + 1} created: ${(wavBlob.size / 1024).toFixed(1)}KB`)
    }

    return chunks
  } catch (error) {
    console.error('❌ Audio chunking failed:', error)
    throw new Error(`Audio chunking failed: ${error.message}`)
  }
}

// Convert AudioBuffer to WAV format
const audioBufferToWav = (audioBuffer) => {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length
  const buffer = new ArrayBuffer(44 + length * numChannels * 2)
  const view = new DataView(buffer)

  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length * numChannels * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, length * numChannels * 2, true)

  // Convert float samples to 16-bit PCM
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i]
      const intSample = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, intSample < 0 ? intSample * 0x8000 : intSample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

// Get audio duration without full decoding
const getAudioDuration = (file) => {
  return new Promise((resolve, reject) => {
    const audio = new Audio()

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src)
      resolve(audio.duration)
    }

    audio.onerror = () => {
      URL.revokeObjectURL(audio.src)
      reject(new Error('Could not load audio file'))
    }

    audio.src = URL.createObjectURL(file)
  })
}

const transcribeChunkedFile = async () => {
  isChunking.value = true
  streamingResult.value = ''

  try {
    // Use audio-aware chunking (30-second chunks)
    const chunks = await splitFileIntoAudioChunks(selectedFile.value, 30)
    chunkProgress.value = { current: 0, total: chunks.length }

    console.log(`📦 Split file into ${chunks.length} audio chunks of ~30s each`)

    let combinedTranscript = ''

    for (let i = 0; i < chunks.length; i++) {
      chunkProgress.value.current = i + 1
      const chunk = chunks[i]

      console.log(
        `🔄 Processing chunk ${i + 1}/${chunks.length} (${chunk.startTime.toFixed(1)}s - ${chunk.endTime.toFixed(1)}s)...`,
      )

      try {
        const chunkResult = await transcribeAudioChunkWithRetry(chunk, i)
        const chunkText = chunkResult.text || chunkResult.transcription?.text || ''

        if (chunkText) {
          combinedTranscript += (combinedTranscript ? ' ' : '') + chunkText
          streamingResult.value = combinedTranscript
          console.log(`✅ Chunk ${i + 1} completed: "${chunkText.substring(0, 50)}..."`)
        }

        // Add delay between chunks to respect rate limits (except for last chunk)
        if (i < chunks.length - 1) {
          console.log(`⏱️ Waiting 2 seconds before next chunk to respect rate limits...`)
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      } catch (err) {
        console.error(`❌ Chunk ${i + 1} failed after retries:`, err.message)
        throw new Error(`Chunk ${i + 1} processing failed: ${err.message}`)
      }
    }

    // Set final result
    transcriptionResult.value = {
      success: true,
      text: combinedTranscript,
      metadata: {
        chunked: true,
        totalChunks: chunks.length,
        chunkDuration: 30,
        service: selectedService.value,
        processedAt: new Date().toISOString(),
      },
    }

    console.log('✅ All audio chunks processed successfully')
  } catch (error) {
    console.error('❌ Audio chunking failed:', error)
    throw error
  }
}

const transcribeAudioChunk = async (audioChunk, chunkIndex) => {
  // Create a file from the audio chunk blob (already a valid WAV file)
  const chunkFile = new File(
    [audioChunk.blob],
    `chunk-${chunkIndex}-${audioChunk.startTime.toFixed(1)}s-${audioChunk.endTime.toFixed(1)}s.wav`,
    {
      type: 'audio/wav',
    },
  )

  console.log(
    `📡 Processing audio chunk ${chunkIndex + 1}: ${(audioChunk.blob.size / 1024).toFixed(1)}KB WAV file`,
  )

  // Use R2-first approach for chunks
  return await transcribeChunkViaR2(chunkFile)
}

const transcribeChunkViaR2 = async (chunkFile) => {
  // Upload chunk to R2 first
  const uploadResult = await uploadFileToR2(chunkFile)

  // Transcribe chunk from R2 with user's selected service/model
  return await transcribeFromR2(
    uploadResult.audioUrl,
    selectedService.value,
    selectedService.value === 'openai' ? selectedOpenAIModel.value : '@cf/openai/whisper',
    openaiLanguage.value,
    openaiTemperature.value,
  )
}

// Enhanced chunk transcription with retry logic for rate limits
const transcribeAudioChunkWithRetry = async (audioChunk, chunkIndex, maxRetries = 3) => {
  let lastError = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await transcribeAudioChunk(audioChunk, chunkIndex)
    } catch (error) {
      lastError = error
      const isRateLimit =
        error.message.includes('400') ||
        error.message.includes('429') ||
        error.message.includes('Bad Request')

      if (isRateLimit && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // Exponential backoff: 2s, 4s, 8s
        console.log(
          `⚠️ Rate limit detected for chunk ${chunkIndex + 1}, attempt ${attempt}/${maxRetries}. Retrying in ${delay / 1000}s...`,
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      } else {
        console.error(`❌ Chunk ${chunkIndex + 1} failed on attempt ${attempt}:`, error.message)
        if (attempt === maxRetries) {
          throw lastError
        }
      }
    }
  }

  throw lastError
}

const transcribeChunkWithOpenAI = async (chunkFile) => {
  const params = new URLSearchParams({
    model: selectedOpenAIModel.value,
    temperature: openaiTemperature.value,
    response_format: 'json',
  })

  if (openaiLanguage.value !== 'auto') {
    params.append('language', openaiLanguage.value)
  }

  const endpoint = `https://whisper.vegvisr.org/transcribe-openai?${params.toString()}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': chunkFile.type || 'audio/wav',
      'X-File-Name': chunkFile.name,
    },
    body: chunkFile,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `OpenAI chunk transcription failed: ${response.status} ${response.statusText}: ${errorText}`,
    )
  }

  return await response.json()
}

const transcribeChunkWithCloudflare = async (chunkFile) => {
  const response = await fetch('https://whisper.vegvisr.org/transcribe', {
    method: 'POST',
    headers: {
      'Content-Type': chunkFile.type || 'audio/wav',
      'X-File-Name': chunkFile.name,
    },
    body: chunkFile,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Cloudflare chunk transcription failed: ${response.status} ${response.statusText}: ${errorText}`,
    )
  }

  return await response.json()
}

// Utility functions
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getFileSizeInfo = (bytes) => {
  return `📁 File size: ${formatFileSize(bytes)} - Will be stored in R2 cloud storage for transcription`
}

const getFileSizeClass = (bytes) => {
  const sizeMB = bytes / (1024 * 1024)
  return sizeMB <= 5 ? 'small-file' : 'large-file'
}

// Cleanup
onUnmounted(() => {
  if (audioUrl.value && audioUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(audioUrl.value)
  }
  if (recordedUrl.value && recordedUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(recordedUrl.value)
  }
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
  }
})

// Auto health check on mount
onMounted(() => {
  checkHealth()
  checkMicrophoneSupport()
})
</script>

<style scoped>
.whisper-test-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 3rem;
}

.header h1 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.header p {
  color: #7f8c8d;
  font-size: 1.1rem;
}

.test-section {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.test-section h2 {
  color: #34495e;
  margin-bottom: 1.5rem;
  font-size: 1.4rem;
}

/* Buttons */
.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-block;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #7f8c8d;
}

.btn-success {
  background: #27ae60;
  color: white;
  font-size: 1.1rem;
  padding: 1rem 2rem;
}

.btn-success:hover:not(:disabled) {
  background: #219a52;
}

/* Drop Zone */
.drop-zone {
  border: 3px dashed #bdc3c7;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  background: #ecf0f1;
  transition: all 0.3s ease;
  cursor: pointer;
}

.drop-zone.drag-over {
  border-color: #3498db;
  background: #e8f4f8;
}

.drop-zone:hover {
  border-color: #3498db;
  background: #e8f4f8;
}

.drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.drop-icon {
  font-size: 3rem;
  opacity: 0.7;
}

.drop-hint {
  color: #7f8c8d;
  font-size: 0.9rem;
}

.file-input {
  display: none;
}

/* File Info */
.file-info {
  margin-top: 2rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.file-details {
  margin-bottom: 1.5rem;
}

.file-details p {
  margin: 0.5rem 0;
  color: #555;
}

.audio-preview h4 {
  margin-bottom: 1rem;
  color: #34495e;
}

.audio-player {
  width: 100%;
  max-width: 400px;
}

/* URL Input */
.url-input-group {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.url-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
}

.url-input:focus {
  outline: none;
  border-color: #3498db;
}

/* Status and Results */
.status-result {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 8px;
  font-weight: 500;
}

.status-result.success {
  background: #d5edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-result.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.result-section {
  margin-top: 2rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.transcription-text {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid #27ae60;
  font-size: 1.1rem;
  line-height: 1.6;
  margin-bottom: 1rem;
  font-family: Georgia, serif;
}

.result-metadata {
  color: #666;
  font-size: 0.9rem;
}

.result-metadata p {
  margin: 0.25rem 0;
}

/* Error Handling */
.error-section {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f8d7da;
  border-radius: 8px;
  border: 1px solid #f5c6cb;
}

.error-content {
  color: #721c24;
}

.error-details {
  margin-top: 1rem;
}

.error-details pre {
  background: #fff;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.9rem;
}

/* Loading */
.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.loading-spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading small {
  color: #999;
  font-size: 0.9em;
}

/* Chunking Progress */
.chunking-progress {
  margin-top: 1rem;
}

.progress-info {
  margin-top: 0.5rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.rate-limit-info {
  margin-top: 0.75rem;
  color: #6c757d;
  font-style: italic;
  font-size: 0.85rem;
}

/* Streaming Results */
.streaming-results {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.streaming-text {
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  line-height: 1.6;
  color: #2c3e50;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.cursor-blink {
  animation: blink 1s infinite;
  color: #3498db;
  font-weight: bold;
}

@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}

/* Processing Info */
.processing-info {
  margin-bottom: 1.5rem;
}

.info-badge {
  display: inline-block;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.info-badge.small-file {
  background: #e8f5e8;
  color: #2d6a2d;
  border: 1px solid #4caf50;
}

.info-badge.large-file {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffc107;
}

/* Debug Section */
.debug-section {
  background: #2c3e50;
  color: white;
}

.debug-section h2 {
  color: #ecf0f1;
}

.debug-content {
  display: grid;
  gap: 1rem;
}

.debug-item {
  background: #34495e;
  padding: 1rem;
  border-radius: 6px;
}

.debug-item strong {
  color: #3498db;
}

/* Responsive Design */
@media (max-width: 768px) {
  .whisper-test-view {
    padding: 1rem;
  }

  .test-section {
    padding: 1.5rem;
  }

  .url-input-group {
    flex-direction: column;
  }

  .url-input {
    width: 100%;
  }

  .drop-zone {
    padding: 2rem 1rem;
  }
}

/* Service Selection Styles */
.service-selection {
  margin-bottom: 2rem;
}

.service-selection h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.service-options {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.service-option {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  flex: 1;
  min-width: 250px;
}

.service-option:hover {
  border-color: #3498db;
  background-color: #f8f9fa;
}

.service-option input[type='radio']:checked + .service-label {
  color: #2c3e50;
  font-weight: 600;
}

.service-option input[type='radio']:checked {
  accent-color: #3498db;
}

.service-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.service-label small {
  color: #7f8c8d;
  font-size: 0.85rem;
}

/* Model Selection Styles */
.model-selection {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f1f3f4;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.model-selection h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.model-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  margin-bottom: 1rem;
  background: white;
}

.openai-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.option-group label {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
}

.option-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.temperature-slider {
  width: 100%;
}

.temperature-value {
  font-weight: 600;
  color: #3498db;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .service-options {
    flex-direction: column;
  }

  .service-option {
    min-width: unset;
  }

  .openai-options {
    grid-template-columns: 1fr;
  }
}

/* Recording Styles */
.recording-options {
  margin-bottom: 1.5rem;
}

.toggle-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px solid #e9ecef;
  transition: all 0.3s ease;
}

.toggle-option:hover {
  border-color: #3498db;
  background: #f1f8ff;
}

.toggle-option input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: #3498db;
}

.toggle-label {
  font-weight: 500;
  color: #2c3e50;
}

.toggle-description {
  margin-top: 0.5rem;
  padding-left: 2.25rem;
}

.toggle-description small {
  color: #6c757d;
  font-style: italic;
}

.recording-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #dc3545;
  font-weight: 600;
  background: #fff5f5;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #f5c6cb;
}

.recording-dot {
  width: 12px;
  height: 12px;
  background: #dc3545;
  border-radius: 50%;
  animation: recording-pulse 1.5s infinite;
}

@keyframes recording-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}

.recorded-audio {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.recorded-audio h4 {
  color: #2c3e50;
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.recorded-audio audio {
  width: 100%;
  margin-bottom: 1rem;
}

.recorded-info {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  color: #6c757d;
}

.recorded-info span {
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .recording-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .recording-controls .btn {
    width: 100%;
  }

  .recording-indicator {
    justify-content: center;
  }

  .recorded-info {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
