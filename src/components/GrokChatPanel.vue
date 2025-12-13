<template>
  <div class="grok-chat-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-title">
        <img :src="providerMeta(provider).icon || grokIcon" :alt="providerMeta(provider).label" class="icon-img" />
        <h3>{{ providerMeta(provider).label }} Assistant</h3>
      </div>
      <div class="header-actions">
        <select v-model="provider" class="provider-select" title="Select AI provider">
          <option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <button
          @click="backgroundImageUrl ? clearBackgroundImage() : openImageSelector()"
          class="btn btn-sm btn-ghost"
          :title="backgroundImageUrl ? 'Clear background image' : 'Change background image'"
        >
          {{ backgroundImageUrl ? '🗑️' : '🎨' }}
        </button>
        <button
          @click="toggleCollapse"
          class="btn btn-sm btn-ghost"
          :title="isCollapsed ? 'Expand' : 'Collapse'"
        >
          {{ isCollapsed ? '◀' : '▶' }}
        </button>
      </div>
    </div>

    <!-- Chat Content -->
    <div
      v-if="!isCollapsed"
      class="chat-content"
      :style="backgroundImageUrl ? { backgroundImage: `url(${backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}"
    >
      <!-- Context Toggle -->
      <div class="context-controls">
        <label class="context-toggle">
          <input type="checkbox" v-model="useGraphContext" />
          <img :src="graphContextIcon" alt="Graph context" class="context-icon" />
          <span>Use Graph Context</span>
        </label>
        <span v-if="useGraphContext" class="context-indicator">
          {{ graphContextSummary }}
        </span>
      </div>

      <!-- Messages -->
      <div class="messages-container" ref="messagesContainer">
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="message"
          :class="message.role"
        >
          <div class="message-header">
            <div v-if="message.role === 'user'" class="message-avatar" :title="userStore.email || 'You'">
              <img
                v-if="userAvatarUrl"
                :src="userAvatarUrl"
                alt="You"
                class="message-avatar-img"
              />
              <span v-else class="message-avatar-initial">{{ userInitial }}</span>
            </div>
            <div v-else class="assistant-avatar" :title="providerMeta(message.provider || provider).label">
              <img
                v-if="providerMeta(message.provider || provider).icon"
                :src="providerMeta(message.provider || provider).icon"
                :alt="providerMeta(message.provider || provider).label"
                class="message-icon-img"
              />
              <span v-else class="assistant-avatar-initial">{{ providerMeta(message.provider || provider).initials }}</span>
            </div>
            <span class="message-role">{{ message.role === 'user' ? 'You' : providerMeta(message.provider || provider).label }}</span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
          <div class="message-content" v-html="renderMarkdown(message.content)"></div>
          <div v-if="message.role === 'assistant'" class="message-actions">
            <button
              class="btn btn-link btn-sm insert-btn"
              type="button"
              @click="insertAsFullText(message.content)"
            >
              Insert as FullText node
            </button>
            <button
              class="btn btn-link btn-sm graph-btn"
              type="button"
              @click="startGraphProcessingFromMessage(message, index)"
              :disabled="isMessageGraphJobProcessing(message)"
            >
              {{ graphJobButtonLabel(message) }}
            </button>
          </div>
        </div>

        <!-- Streaming Message -->
        <div v-if="isStreaming" class="message assistant streaming">
          <div class="message-header">
            <div class="assistant-avatar" :title="providerMeta(streamingProviderOverride || provider).label">
              <img
                v-if="providerMeta(streamingProviderOverride || provider).icon"
                :src="providerMeta(streamingProviderOverride || provider).icon"
                :alt="providerMeta(streamingProviderOverride || provider).label"
                class="message-icon-img"
              />
              <span v-else class="assistant-avatar-initial">{{ providerMeta(streamingProviderOverride || provider).initials }}</span>
            </div>
            <span class="message-role">{{ providerMeta(streamingProviderOverride || provider).label }}</span>
            <span class="streaming-indicator">
              <span class="spinner"></span> Thinking...
            </span>
          </div>
          <div class="message-content" v-html="renderMarkdown(streamingContent)"></div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="message error">
          <div class="message-header">
            <span class="message-icon">⚠️</span>
            <span class="message-role">Error</span>
          </div>
          <div class="message-content">{{ errorMessage }}</div>
        </div>
      </div>

      <!-- Input -->
      <div class="chat-input-container">
        <div v-if="uploadedImage" class="image-preview-container">
          <img :src="uploadedImage.preview" alt="Uploaded image" class="uploaded-image-preview" />
          <button @click="clearUploadedImage" class="clear-image-btn" title="Remove image">×</button>
        </div>
        <div v-if="selectedAudioFile" class="audio-preview-container">
          <div class="audio-preview-header">
            <div>
              <div class="audio-file-name">{{ selectedAudioFile.name }}</div>
              <div class="audio-meta">
                <span>{{ formatFileSize(selectedAudioFile.size) }}</span>
                <span v-if="selectedAudioFile.duration">Duration: {{ formatDuration(selectedAudioFile.duration) }}</span>
              </div>
            </div>
            <button
              class="clear-audio-btn"
              :disabled="audioProcessing"
              @click="clearSelectedAudio"
              title="Remove audio"
            >
              ×
            </button>
          </div>
          <div class="audio-settings">
            <label class="auto-detect-toggle">
              <input type="checkbox" v-model="audioAutoDetect" :disabled="audioProcessing" />
              <span>Auto-detect language</span>
            </label>
            <select
              v-model="audioLanguage"
              :disabled="audioAutoDetect || audioProcessing"
              class="audio-language-select"
            >
              <option v-for="lang in audioLanguageOptions" :key="lang.code" :value="lang.code">
                {{ lang.label }}
              </option>
            </select>
          </div>
          <div class="audio-actions">
            <button class="btn btn-secondary" @click="startAudioTranscription" :disabled="audioProcessing">
              <span v-if="audioProcessing" class="spinner-border spinner-border-sm"></span>
              <span v-else>Transcribe & Insert</span>
            </button>
            <div class="audio-status" v-if="audioTranscriptionStatus">
              {{ audioTranscriptionStatus }}
              <span v-if="audioChunkProgress.total > 0">
                • Chunk {{ audioChunkProgress.current }}/{{ audioChunkProgress.total }}
              </span>
            </div>
          </div>
        </div>
        <div v-if="graphProcessingJobs.length" class="graph-job-panel">
          <div
            v-for="job in graphProcessingJobs"
            :key="job.id"
            class="graph-job-card"
            :class="job.status"
          >
            <div class="graph-job-header">
              <div>
                <div class="graph-job-title-row">
                  <span class="graph-job-title">Knowledge Graph</span>
                  <span class="graph-job-chip" :class="job.status">{{ jobStatusLabel(job) }}</span>
                </div>
                <div class="graph-job-meta">
                  <span>{{ providerMeta(job.provider || provider).label }}</span>
                  <span>• {{ formatTime(job.createdAt) }}</span>
                </div>
              </div>
              <button class="graph-job-remove" @click="removeGraphJob(job.id)" title="Remove job">
                ×
              </button>
            </div>
            <p class="graph-job-preview">{{ job.sourcePreview }}</p>
            <div v-if="job.status !== 'failed'" class="graph-job-progress">
              <div class="graph-job-progress-bar" :style="{ width: job.progress + '%' }"></div>
            </div>
            <div class="graph-job-status-text">
              <span>{{ job.stage }}</span>
              <span v-if="job.result && job.status === 'completed'">
                • {{ job.result.nodeCount || 0 }} nodes · {{ job.result.edgeCount || 0 }} edges
              </span>
            </div>
            <div v-if="job.error" class="graph-job-error">{{ job.error }}</div>
            <div v-if="job.graphSaveState === 'error'" class="graph-job-error">{{ job.graphSaveError }}</div>
            <div class="graph-job-actions">
              <button
                class="btn btn-outline-secondary btn-sm"
                @click="openTranscriptProcessor(job)"
                :disabled="job.status === 'processing'"
              >
                Review in Processor
              </button>
              <button
                v-if="job.graphSaveState !== 'success'"
                class="btn btn-primary btn-sm"
                @click="createGraphFromJob(job)"
                :disabled="job.status !== 'completed' || job.graphSaveState === 'saving' || !canCreateGraph"
              >
                <span v-if="job.graphSaveState === 'saving'">
                  Saving...
                </span>
                <span v-else>
                  Create Graph
                </span>
              </button>
              <button
                v-else
                class="btn btn-success btn-sm"
                @click="openGraphInViewer(job)"
              >
                Open Graph
              </button>
              <button
                class="btn btn-link btn-sm json-btn"
                @click="copyKnowledgeGraphJson(job)"
                :disabled="!job.result"
              >
                {{ job.copyState === 'copied' ? 'Copied!' : 'Copy JSON' }}
              </button>
            </div>
            <p v-if="job.status === 'completed' && !canCreateGraph" class="graph-job-hint">
              Log in to save the generated graph.
            </p>
          </div>
        </div>
        <div class="input-wrapper">
          <div class="input-main">
            <div class="input-toolbar">
              <button
                @click="toggleSpeechRecognition"
                :disabled="isStreaming || !speechSupported"
                class="btn mic-btn"
                :class="{ recording: isRecording }"
                :title="isRecording ? 'Stop recording' : 'Start voice input'"
              >
                <span v-if="isRecording" class="recording-pulse"></span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" x2="12" y1="19" y2="22"/>
                </svg>
              </button>
              <button
                @click="triggerAudioUpload"
                :disabled="isStreaming || audioProcessing"
                class="btn audio-btn"
                title="Upload audio for transcription"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/>
                  <path d="M12 5v13"/>
                  <path d="m8 9 4-4 4 4"/>
                </svg>
              </button>
              <button
                @click="triggerImageUpload"
                :disabled="isStreaming || provider === 'grok'"
                class="btn image-btn"
                :title="provider === 'grok' ? 'Grok does not support image analysis' : 'Upload image for analysis'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
            </div>
            <textarea
              v-model="userInput"
              @keydown.enter.exact.prevent="sendMessage"
              @keydown.shift.enter.exact="handleShiftEnter"
              :placeholder="`Ask ${providerMeta(provider).label} anything about the graph...`"
              class="chat-input"
              rows="3"
              :disabled="isStreaming"
            ></textarea>
            <input
              ref="imageFileInput"
              type="file"
              accept="image/*"
              style="display: none"
              @change="handleImageUpload"
            />
            <input
              ref="audioFileInput"
              type="file"
              accept=".wav,.mp3,.m4a,.aac,.ogg,.opus,.mp4,.webm"
              style="display: none"
              @change="handleAudioFileSelect"
            />
          </div>
          <button
            @click="sendMessage"
            :disabled="!userInput.trim() || isStreaming"
            class="btn btn-primary send-btn"
            title="Send (Enter)"
          >
            <span v-if="isStreaming" class="spinner-border spinner-border-sm"></span>
            <span v-else>Send</span>
          </button>
        </div>
        <div class="input-hint">
          Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line
          <span v-if="speechSupported"> | 🎤 Voice input available</span>
          <span> | 🎧 Audio upload ready</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Image Selector Modal -->
  <ImageSelector
    :isOpen="isImageSelectorOpen"
    :currentImageUrl="backgroundImageUrl"
    :currentImageAlt="'Chat background'"
    :imageType="'Background'"
    :imageContext="'Chat panel background image'"
    :nodeContent="'Chat background customization'"
    @close="closeImageSelector"
    @image-replaced="handleBackgroundImageChange"
  />
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import { useUserStore } from '@/stores/userStore'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import grokIcon from '@/assets/grok.svg'
import openaiIcon from '@/assets/openai.svg'
import perplexityIcon from '@/assets/perplexity.svg'
import claudeIcon from '@/assets/claude.svg'
import geminiIcon from '@/assets/gemini.svg'
import graphContextIcon from '@/assets/graph-context.svg'
import ImageSelector from '@/components/ImageSelector.vue'

const emit = defineEmits(['insert-fulltext'])

const router = useRouter()
const userStore = useUserStore()
const knowledgeGraphStore = useKnowledgeGraphStore()

const props = defineProps({
  graphData: {
    type: Object,
    required: true,
  },
})

// State
const isCollapsed = ref(false)
const useGraphContext = ref(true)
const provider = ref('grok')
const providerOptions = [
  { value: 'grok', label: 'Grok' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'perplexity', label: 'Perplexity' },
]
const messages = ref([])
const userInput = ref('')
const isStreaming = ref(false)
const streamingContent = ref('')
const streamingProviderOverride = ref(null)
const errorMessage = ref('')
const messagesContainer = ref(null)

// Background image state
const backgroundImageUrl = ref(localStorage.getItem('grok-chat-background') || '')
const isImageSelectorOpen = ref(false)

// Speech recognition
const isRecording = ref(false)
const speechSupported = ref(false)
let recognition = null

// Image upload
const uploadedImage = ref(null)
const imageFileInput = ref(null)
const isUploadingImage = ref(false)

// Audio upload/transcription
const audioFileInput = ref(null)
const selectedAudioFile = ref(null)
const audioProcessing = ref(false)
const audioTranscriptionStatus = ref('')
const audioChunkProgress = ref({ current: 0, total: 0 })
const audioAutoDetect = ref(true)
const audioLanguage = ref('no')
const audioLanguageOptions = [
  { code: 'no', label: 'Norwegian' },
  { code: 'en', label: 'English' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' }
]

const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/ogg; codecs=opus',
  'audio/opus',
  'audio/webm',
  'video/mp4',
  'video/webm'
])

const SUPPORTED_AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.opus', '.mp4', '.webm']
const AUDIO_ENDPOINT = 'https://openai.vegvisr.org/audio'
const CHUNK_DURATION_SECONDS = 120
const GRAPH_PROCESS_ENDPOINT = 'https://grok.vegvisr.org/process-transcript'
const KNOWLEDGE_GRAPH_SAVE_ENDPOINT = 'https://knowledge.vegvisr.org/saveGraphWithHistory'
const MAX_GRAPH_JOBS = 4

const graphProcessingJobs = ref([])

// Computed
const graphContextSummary = computed(() => {
  if (!props.graphData || !props.graphData.nodes) return 'No graph data'
  const nodeCount = props.graphData.nodes.length
  const edgeCount = props.graphData.edges?.length || 0
  return `${nodeCount} nodes, ${edgeCount} edges`
})

// Prefer a user-provided profile image; fall back to an initial
const userAvatarUrl = computed(() => userStore.profileimage || null)
const userInitial = computed(() => {
  const source = userStore.email || userStore.user_id || 'You'
  return source.charAt(0).toUpperCase()
})

const canCreateGraph = computed(() => Boolean(userStore.emailVerificationToken))

const providerMeta = (key) => {
  if (key === 'openai') return { label: 'OpenAI', icon: openaiIcon, initials: 'OA' }
  if (key === 'claude') return { label: 'Claude', icon: claudeIcon, initials: 'CL' }
  if (key === 'gemini') return { label: 'Gemini', icon: geminiIcon, initials: 'GM' }
  if (key === 'perplexity') return { label: 'Perplexity', icon: perplexityIcon, initials: 'PP' }
  return { label: 'Grok', icon: grokIcon, initials: 'G' }
}

// Speech Recognition Setup
onMounted(() => {
  // Check for browser support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (SpeechRecognition) {
    speechSupported.value = true
    recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US' // Can be changed to other languages

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      // Append final transcript to user input
      if (finalTranscript) {
        userInput.value += (userInput.value ? ' ' : '') + finalTranscript
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      isRecording.value = false
      if (event.error === 'not-allowed') {
        errorMessage.value = 'Microphone access denied. Please allow microphone access in your browser settings.'
      }
    }

    recognition.onend = () => {
      isRecording.value = false
    }
  }
})

const toggleSpeechRecognition = () => {
  if (!recognition) return

  if (isRecording.value) {
    recognition.stop()
    isRecording.value = false
  } else {
    recognition.start()
    isRecording.value = true
    errorMessage.value = '' // Clear any previous errors
  }
}

// Methods
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const openImageSelector = () => {
  isImageSelectorOpen.value = true
}

const closeImageSelector = () => {
  isImageSelectorOpen.value = false
}

const handleBackgroundImageChange = (imageData) => {
  backgroundImageUrl.value = imageData.newUrl
  localStorage.setItem('grok-chat-background', imageData.newUrl)
  closeImageSelector()
}

const clearBackgroundImage = () => {
  backgroundImageUrl.value = ''
  localStorage.removeItem('grok-chat-background')
}

const triggerImageUpload = () => {
  if (provider.value === 'grok') return
  imageFileInput.value?.click()
}

const handleImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file || !file.type.startsWith('image/')) {
    errorMessage.value = 'Please select a valid image file.'
    return
  }

  isUploadingImage.value = true
  errorMessage.value = ''

  try {
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      uploadedImage.value = {
        file: file,
        preview: e.target.result,
        base64: e.target.result.split(',')[1],
        mimeType: file.type
      }
    }
    reader.readAsDataURL(file)
  } catch (err) {
    console.error('Error uploading image:', err)
    errorMessage.value = 'Failed to upload image. Please try again.'
  } finally {
    isUploadingImage.value = false
    event.target.value = ''
  }
}

const clearUploadedImage = () => {
  uploadedImage.value = null
}

const triggerAudioUpload = () => {
  audioFileInput.value?.click()
}

const isSupportedAudioFile = (file) => {
  if (!file) return false
  if (file.type && SUPPORTED_AUDIO_MIME_TYPES.has(file.type.toLowerCase())) {
    return true
  }

  const extension = file.name?.toLowerCase().substring(file.name.lastIndexOf('.'))
  return extension ? SUPPORTED_AUDIO_EXTENSIONS.includes(extension) : false
}

const inferMimeTypeFromExtension = (fileName = '') => {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  switch (extension) {
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.m4a':
      return 'audio/mp4'
    case '.ogg':
      return 'audio/ogg'
    case '.opus':
      return 'audio/opus'
    case '.aac':
      return 'audio/aac'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    default:
      return 'audio/wav'
  }
}

const getAudioDurationSeconds = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const audio = document.createElement('audio')
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src)
        resolve(audio.duration || 0)
      }
      audio.onerror = (event) => {
        URL.revokeObjectURL(audio.src)
        reject(event.error || new Error('Unable to read audio metadata'))
      }
      audio.src = URL.createObjectURL(file)
    } catch (err) {
      reject(err)
    }
  })
}

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exponent)
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Unknown'
  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const handleAudioFileSelect = async (event) => {
  const file = event.target.files?.[0]
  if (audioFileInput.value) {
    audioFileInput.value.value = ''
  }
  if (!file) return

  if (!isSupportedAudioFile(file)) {
    errorMessage.value = 'Unsupported audio format. Allowed: wav, mp3, m4a, aac, ogg, opus, mp4, webm.'
    return
  }

  errorMessage.value = ''
  audioTranscriptionStatus.value = ''
  audioChunkProgress.value = { current: 0, total: 0 }

  try {
    const duration = await getAudioDurationSeconds(file).catch(() => null)
    selectedAudioFile.value = {
      file,
      name: file.name || 'audio-file',
      size: file.size,
      type: file.type || inferMimeTypeFromExtension(file.name),
      duration: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
    }
    audioAutoDetect.value = true
    audioLanguage.value = 'no'
  } catch (err) {
    console.error('Audio selection error:', err)
    errorMessage.value = 'Failed to read the selected audio file. Please try another file.'
    selectedAudioFile.value = null
  }
}

const clearSelectedAudio = () => {
  selectedAudioFile.value = null
  audioProcessing.value = false
  audioTranscriptionStatus.value = ''
  audioChunkProgress.value = { current: 0, total: 0 }
  if (audioFileInput.value) {
    audioFileInput.value.value = ''
  }
}

const callWhisperTranscription = async (blob, fileName) => {
  const formData = new FormData()
  formData.append('file', blob, fileName)
  formData.append('model', 'whisper-1')
  formData.append('userId', userStore.user_id || 'system')
  if (!audioAutoDetect.value && audioLanguage.value) {
    formData.append('language', audioLanguage.value)
  }

  const response = await fetch(AUDIO_ENDPOINT, {
    method: 'POST',
    body: formData,
  })

  const payloadText = await response.text()
  let parsed
  try {
    parsed = JSON.parse(payloadText)
  } catch (_) {
    parsed = null
  }

  if (!response.ok) {
    const detail = parsed?.error || parsed?.message || payloadText || 'Audio transcription failed'
    throw new Error(typeof detail === 'string' ? detail : 'Audio transcription failed')
  }

  return parsed || { text: payloadText }
}

const transcribeSingleAudio = async (file, fileName) => {
  audioTranscriptionStatus.value = 'Uploading audio...'
  const result = await callWhisperTranscription(file, fileName)
  const transcript = (result.text || '').trim()
  streamingContent.value = transcript
  scrollToBottom()
  return {
    text: transcript,
    language: result.language || (audioAutoDetect.value ? 'auto' : audioLanguage.value)
  }
}

const sanitizeFileBaseName = (name = '') => {
  if (!name.includes('.')) return name
  return name.substring(0, name.lastIndexOf('.'))
}

const formatChunkTimestamp = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const audioBufferToWavBlob = (audioBuffer) => {
  return new Promise((resolve) => {
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const length = audioBuffer.length
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
    const view = new DataView(buffer)

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

    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample * 0x7fff, true)
        offset += 2
      }
    }

    resolve(new Blob([buffer], { type: 'audio/wav' }))
  })
}

const splitAudioIntoChunks = async (file, chunkDurationSeconds = CHUNK_DURATION_SECONDS, onProgress) => {
  if (typeof window === 'undefined') {
    throw new Error('Audio processing is only available in the browser')
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    throw new Error('This browser does not support audio processing APIs')
  }

  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new AudioContextClass()

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    const sampleRate = audioBuffer.sampleRate
    const chunkSamples = chunkDurationSeconds * sampleRate
    const totalSamples = audioBuffer.length
    const totalChunks = Math.max(Math.ceil(totalSamples / chunkSamples), 1)

    onProgress?.({ phase: 'info', total: totalChunks })

    const chunks = []
    for (let i = 0; i < totalChunks; i++) {
      const startSample = i * chunkSamples
      const endSample = Math.min(startSample + chunkSamples, totalSamples)
      const chunkLength = endSample - startSample
      const chunkBuffer = audioContext.createBuffer(audioBuffer.numberOfChannels, chunkLength, sampleRate)

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel)
        const chunkData = chunkBuffer.getChannelData(channel)
        for (let sample = 0; sample < chunkLength; sample++) {
          chunkData[sample] = channelData[startSample + sample]
        }
      }

      const blob = await audioBufferToWavBlob(chunkBuffer)
      chunks.push({
        blob,
        startTime: startSample / sampleRate,
        endTime: endSample / sampleRate,
      })

      onProgress?.({ phase: 'creating', current: i + 1, total: totalChunks })
    }

    return chunks
  } finally {
    await audioContext.close()
  }
}

const transcribeAudioInChunks = async (file, fileName, durationSeconds) => {
  audioTranscriptionStatus.value = 'Splitting audio into chunks...'
  const chunks = await splitAudioIntoChunks(file, CHUNK_DURATION_SECONDS, (progress) => {
    if (progress.phase === 'creating') {
      audioTranscriptionStatus.value = `Preparing chunk ${progress.current}/${progress.total}...`
    }
  })

  if (!chunks.length) {
    throw new Error('Audio could not be chunked for transcription')
  }

  audioChunkProgress.value = { current: 0, total: chunks.length }
  streamingContent.value = ''
  const combinedSegments = []
  const detectedLanguages = new Set()
  const baseName = sanitizeFileBaseName(fileName)

  for (let i = 0; i < chunks.length; i++) {
    audioChunkProgress.value = { current: i + 1, total: chunks.length }
    audioTranscriptionStatus.value = `Processing chunk ${i + 1}/${chunks.length}...`

    try {
      const chunkResult = await callWhisperTranscription(
        chunks[i].blob,
        `${baseName || 'audio'}_chunk_${i + 1}.wav`
      )

      const chunkText = (chunkResult.text || '').trim()
      const chunkLabel = `[${formatChunkTimestamp(chunks[i].startTime)} - ${formatChunkTimestamp(chunks[i].endTime)}]`

      if (chunkText) {
        const formatted = `${chunkLabel} ${chunkText}`
        combinedSegments.push(formatted)
        streamingContent.value += (streamingContent.value ? '\n\n' : '') + formatted
        scrollToBottom()
      }

      if (chunkResult.language) {
        detectedLanguages.add(chunkResult.language)
      }

      audioTranscriptionStatus.value = `Chunk ${i + 1}/${chunks.length} complete`
    } catch (error) {
      console.error(`Chunk ${i + 1} transcription failed:`, error)
      const chunkLabel = `[${formatChunkTimestamp(chunks[i].startTime)} - ${formatChunkTimestamp(chunks[i].endTime)}]`
      const errorText = `${chunkLabel} [Error: ${error.message}]`
      combinedSegments.push(errorText)
      streamingContent.value += (streamingContent.value ? '\n\n' : '') + errorText
      audioTranscriptionStatus.value = `Chunk ${i + 1}/${chunks.length} failed`
      scrollToBottom()
    }
  }

  return {
    text: combinedSegments.join('\n\n'),
    language:
      detectedLanguages.size === 1
        ? Array.from(detectedLanguages)[0]
        : (audioAutoDetect.value ? 'auto' : audioLanguage.value)
  }
}

const finalizeTranscriptionMessage = (result, fileName) => {
  const transcript = (result?.text || '').trim()
  const languageLabel = audioLanguageOptions.find((opt) => opt.code === result?.language)?.label || result?.language
  const content = [
    `🎧 Transcription for **${fileName}**`,
    languageLabel ? `Language: ${languageLabel}` : null,
    transcript || '_No speech detected_'
  ]
    .filter(Boolean)
    .join('\n\n')

  messages.value.push({
    role: 'assistant',
    content,
    timestamp: Date.now(),
    provider: 'openai',
  })
  scrollToBottom()
}

const startAudioTranscription = async () => {
  if (!selectedAudioFile.value || audioProcessing.value) return

  audioProcessing.value = true
  audioTranscriptionStatus.value = 'Preparing audio...'
  audioChunkProgress.value = { current: 0, total: 0 }
  errorMessage.value = ''

  const { file, name } = selectedAudioFile.value

  messages.value.push({
    role: 'user',
    content: `Uploaded audio "${name}" for transcription.`,
    timestamp: Date.now(),
    provider: provider.value,
  })
  scrollToBottom()

  isStreaming.value = true
  streamingContent.value = ''
  streamingProviderOverride.value = 'openai'

  try {
    const duration = selectedAudioFile.value.duration ?? (await getAudioDurationSeconds(file).catch(() => null))
    const hasDuration = typeof duration === 'number' && Number.isFinite(duration)
    const shouldChunk = hasDuration ? duration > CHUNK_DURATION_SECONDS : file.size > 8 * 1024 * 1024

    let result
    try {
      result = shouldChunk
        ? await transcribeAudioInChunks(file, name, duration)
        : await transcribeSingleAudio(file, name)
    } catch (error) {
      if (shouldChunk) {
        console.warn('Chunked transcription failed, falling back to single upload:', error)
        audioTranscriptionStatus.value = 'Chunking failed. Retrying whole file...'
        result = await transcribeSingleAudio(file, name)
      } else {
        throw error
      }
    }

    finalizeTranscriptionMessage(result, name)
    clearSelectedAudio()
  } catch (error) {
    console.error('Audio transcription error:', error)
    errorMessage.value = `Audio transcription failed: ${error.message}`
  } finally {
    audioProcessing.value = false
    audioTranscriptionStatus.value = ''
    audioChunkProgress.value = { current: 0, total: 0 }
    isStreaming.value = false
    streamingContent.value = ''
    streamingProviderOverride.value = null
  }
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const renderMarkdown = (content) => {
  if (!content) return ''
  try {
    return marked(content)
  } catch (error) {
    console.error('Markdown rendering error:', error)
    return content
  }
}

const insertAsFullText = (content) => {
  if (!content) return
  emit('insert-fulltext', content)
}

const generateGraphJobId = () => {
  if (typeof crypto !== 'undefined' && crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  return `graph-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const sanitizeJobPreview = (content = '') => {
  if (!content) return ''
  return content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

const getMessageGraphJob = (message) => {
  if (!message?.graphJobId) return null
  return graphProcessingJobs.value.find((job) => job.id === message.graphJobId) || null
}

const isMessageGraphJobProcessing = (message) => {
  const job = getMessageGraphJob(message)
  return Boolean(job && (job.status === 'processing' || job.status === 'queued'))
}

const graphJobButtonLabel = (message) => {
  const job = getMessageGraphJob(message)
  if (!job) return 'Generate Knowledge Graph'
  if (job.status === 'processing' || job.status === 'queued') return 'Processing graph...'
  if (job.status === 'completed') return 'Graph ready'
  if (job.status === 'failed') return 'Retry graph'
  return 'Generate Knowledge Graph'
}

const jobStatusLabel = (job) => {
  if (!job) return ''
  if (job.status === 'queued' || job.status === 'processing') return 'Processing'
  if (job.status === 'completed') return 'Completed'
  if (job.status === 'failed') return 'Failed'
  return job.status
}

const startGraphProcessingFromMessage = (message, messageIndex) => {
  if (!message || message.role !== 'assistant') return
  if (!userStore.loggedIn) {
    errorMessage.value = 'Please log in to generate knowledge graphs.'
    return
  }

  const existingJob = getMessageGraphJob(message)
  if (existingJob) {
    if (existingJob.status === 'processing' || existingJob.status === 'queued') {
      return
    }
    if (existingJob.status === 'failed') {
      existingJob.status = 'queued'
      existingJob.stage = 'Retrying...'
      existingJob.progress = 5
      existingJob.error = ''
      return processGraphJob(existingJob)
    }
    return
  }

  const transcript = (message.content || '').trim()
  if (!transcript) {
    errorMessage.value = 'Assistant response is empty. Nothing to process.'
    return
  }

  const job = {
    id: generateGraphJobId(),
    messageIndex,
    provider: message.provider || provider.value,
    createdAt: Date.now(),
    status: 'queued',
    stage: 'Queued',
    progress: 5,
    transcript,
    sourcePreview: sanitizeJobPreview(message.content || ''),
    error: '',
    result: null,
    graphSaveState: 'idle',
    graphSaveError: '',
    copyState: 'idle'
  }

  graphProcessingJobs.value = [job, ...graphProcessingJobs.value].slice(0, MAX_GRAPH_JOBS)
  if (messages.value[messageIndex]) {
    messages.value[messageIndex].graphJobId = job.id
  }
  processGraphJob(job)
}

const processGraphJob = async (job) => {
  if (!job) return
  job.status = 'processing'
  job.stage = '🔍 Analyzing transcript...'
  job.progress = 20
  job.error = ''

  try {
    const payload = {
      transcript: job.transcript,
      sourceLanguage: 'auto',
      targetLanguage: 'norwegian',
      userId: userStore.user_id,
    }

    const response = await fetch(GRAPH_PROCESS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    job.stage = '🧠 Generating knowledge graph...'
    job.progress = 70

    if (!response.ok) {
      let detail = `Processing failed (${response.status})`
      try {
        const errJson = await response.json()
        detail = errJson.error || detail
      } catch (_) {
        const errText = await response.text()
        detail = errText || detail
      }
      throw new Error(detail)
    }

    const data = await response.json().catch(() => null)
    const knowledgeGraph = data?.knowledgeGraph || data?.graph

    if (!knowledgeGraph || !Array.isArray(knowledgeGraph.nodes)) {
      throw new Error('Processor returned no knowledge graph data')
    }

    job.result = {
      ...data,
      knowledgeGraph,
      nodeCount: knowledgeGraph.nodes?.length || 0,
      edgeCount: knowledgeGraph.edges?.length || 0,
    }

    job.stage = '✅ Ready for review'
    job.status = 'completed'
    job.progress = 100
  } catch (error) {
    console.error('Graph processing failed:', error)
    job.status = 'failed'
    job.stage = '⚠️ Processing failed'
    job.progress = 100
    job.error = error.message || 'Unknown error'
  }
}

const removeGraphJob = (jobId) => {
  graphProcessingJobs.value = graphProcessingJobs.value.filter((job) => job.id !== jobId)
  messages.value.forEach((msg) => {
    if (msg.graphJobId === jobId) {
      delete msg.graphJobId
    }
  })
}

const openTranscriptProcessor = (job) => {
  if (!job) return
  try {
    sessionStorage.setItem('prefill_transcript', job.transcript || '')
    sessionStorage.setItem('auto_process', job.status === 'completed' ? 'false' : 'true')
    if (typeof window !== 'undefined') {
      window.open('/transcript-processor?prefill=true', '_blank')
    }
  } catch (error) {
    console.error('Failed to open transcript processor:', error)
    errorMessage.value = 'Unable to open transcript processor. Please check popup blockers.'
  }
}

const buildGraphSavePayload = (job) => {
  if (!job?.result?.knowledgeGraph) {
    throw new Error('No knowledge graph available to save')
  }

  const now = new Date()
  const nodeCount = job.result.nodeCount || job.result.knowledgeGraph.nodes?.length || 0
  const graphId = job.createdGraphId || `chat_graph_${Date.now()}`
  const providerLabel = providerMeta(job.provider || provider.value).label

  const metadata = {
    title: job.result?.metadata?.title || `Chat Graph ${now.toLocaleDateString('no-NO')} (${nodeCount} noder)`,
    description:
      job.result?.metadata?.description ||
      `Automatisk generert fra ${providerLabel}-svar ${now.toLocaleDateString('no-NO')} kl. ${now.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}.`,
    createdBy: userStore.email || providerLabel,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    source: 'GrokChatPanel',
  }

  const nodes = (job.result.knowledgeGraph.nodes || []).map((node, index) => ({
    ...node,
    id: node.id || `chat_node_${job.id}_${index}`,
    position: node.position || { x: 150 + (index % 4) * 280, y: 80 + Math.floor(index / 4) * 220 },
    visible: node.visible !== false,
  }))

  const edges = job.result.knowledgeGraph.edges || []

  return {
    id: graphId,
    graphData: {
      metadata,
      nodes,
      edges,
    },
  }
}

const createGraphFromJob = async (job) => {
  if (!job || job.status !== 'completed' || job.graphSaveState === 'saving') return
  if (!userStore.loggedIn || !userStore.emailVerificationToken) {
    errorMessage.value = 'Log in to save generated graphs.'
    return
  }

  job.graphSaveState = 'saving'
  job.graphSaveError = ''

  try {
    const payload = buildGraphSavePayload(job)
    const response = await fetch(KNOWLEDGE_GRAPH_SAVE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify({ id: payload.id, graphData: payload.graphData }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || `Failed with status ${response.status}`)
    }

    const result = await response.json().catch(() => ({}))
    const finalGraphId = result.graphId || payload.id

    knowledgeGraphStore.setCurrentGraphId(finalGraphId)
    knowledgeGraphStore.updateGraphFromJson({
      nodes: payload.graphData.nodes,
      edges: payload.graphData.edges,
      metadata: payload.graphData.metadata,
    })

    job.createdGraphId = finalGraphId
    job.graphSaveState = 'success'
    job.stage = '📦 Graph saved'
  } catch (error) {
    console.error('Failed to save graph:', error)
    job.graphSaveState = 'error'
    job.graphSaveError = error.message || 'Unknown error'
  }
}

const openGraphInViewer = (job) => {
  if (!job?.createdGraphId) return
  try {
    router.push(`/gnew-viewer?graphId=${job.createdGraphId}`)
  } catch (error) {
    console.warn('Router navigation failed, opening new tab.', error)
    if (typeof window !== 'undefined') {
      window.open(`/gnew-viewer?graphId=${job.createdGraphId}`, '_blank')
    }
  }
}

const copyKnowledgeGraphJson = async (job) => {
  if (!job?.result?.knowledgeGraph || typeof navigator === 'undefined' || !navigator.clipboard) return
  try {
    await navigator.clipboard.writeText(JSON.stringify(job.result.knowledgeGraph, null, 2))
    job.copyState = 'copied'
    setTimeout(() => {
      job.copyState = 'idle'
    }, 1500)
  } catch (error) {
    console.error('Clipboard copy failed:', error)
    errorMessage.value = 'Failed to copy knowledge graph JSON. Please try again.'
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const handleShiftEnter = () => {
  // Allow default behavior (new line)
}

onMounted(() => {
  userStore.hydrateProfileImageFromConfig()
})

const buildGraphContext = () => {
  if (!useGraphContext.value || !props.graphData) return null

  const { nodes, edges, metadata } = props.graphData

  const context = {
    metadata: {
      title: metadata?.title || 'Untitled Graph',
      description: metadata?.description || '',
      category: metadata?.category || '',
      nodeCount: nodes?.length || 0,
      edgeCount: edges?.length || 0,
    },
    nodes: nodes?.slice(0, 20).map((node) => {
      const infoString = typeof node.info === 'string' ? node.info : String(node.info || '')
      return {
        id: node.id,
        label: node.label || node.id,
        type: node.type || 'unknown',
        info: infoString ? infoString.substring(0, 500) : '',
      }
    }) || [],
    edges: edges?.slice(0, 30).map((edge) => ({
      from: edge.from,
      to: edge.to,
    })) || [],
  }

  return context
}

const handleImageGeneration = async (imagePrompt, originalMessage) => {
  // Add user message showing the request
  messages.value.push({
    role: 'user',
    content: originalMessage,
    timestamp: Date.now(),
    provider: provider.value,
  })

  userInput.value = ''
  errorMessage.value = ''
  isStreaming.value = true
  streamingContent.value = 'Generating image...'
  scrollToBottom()

  try {
    const response = await fetch('https://openai.vegvisr.org/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userStore.user_id || 'system',
        model: 'gpt-image-1',
        prompt: imagePrompt,
        size: '1024x1024',
        quality: 'standard',
        n: 1,
        response_format: 'url'
      }),
    })

    if (!response.ok) {
      let errorDetail = `Image generation error: ${response.status}`
      try {
        const errJson = await response.json()
        errorDetail = errJson.error?.message || errJson.error || JSON.stringify(errJson)
      } catch (_) {
        errorDetail = await response.text()
      }
      throw new Error(errorDetail)
    }

    const data = await response.json()
    const imageUrl = data.data?.[0]?.url
    const imageB64 = data.data?.[0]?.b64_json
    const revisedPrompt = data.data?.[0]?.revised_prompt

    // Handle both URL and base64 responses
    const finalImageUrl = imageUrl || (imageB64 ? `data:image/png;base64,${imageB64}` : null)

    if (!finalImageUrl) {
      throw new Error('No image in response (neither URL nor base64)')
    }

    // Create markdown with image and revised prompt if available
    let responseContent = `![Generated Image](${finalImageUrl})\n\n`
    if (revisedPrompt && revisedPrompt !== imagePrompt) {
      responseContent += `**Revised prompt:** ${revisedPrompt}\n\n`
    }
    responseContent += `**Original prompt:** ${imagePrompt}`

    // Add assistant message with the image
    messages.value.push({
      role: 'assistant',
      content: responseContent,
      timestamp: Date.now(),
      provider: provider.value,
    })

  } catch (error) {
    console.error('Image generation error:', error)
    errorMessage.value = `Error: ${error.message}`

    // Add error message to chat
    messages.value.push({
      role: 'assistant',
      content: `❌ Image generation failed: ${error.message}`,
      timestamp: Date.now(),
      provider: provider.value,
    })
  } finally {
    isStreaming.value = false
    streamingContent.value = ''
    scrollToBottom()
  }
}

const sendMessage = async () => {
  const message = userInput.value.trim()
  if (!message || isStreaming.value) return

  const currentProvider = provider.value
  const hasImage = uploadedImage.value && currentProvider !== 'grok'

  // Check for natural language image generation commands
  const imageGenPattern = /^(create|generate|make|draw|paint|design|produce)\s+(an?\s+)?(image|picture|photo|illustration|artwork)\s+(of\s+)?(.+)$/i
  const imageGenMatch = message.match(imageGenPattern)

  if (imageGenMatch && currentProvider === 'openai') {
    // Extract the prompt (last capture group)
    const imagePrompt = imageGenMatch[5].trim()
    return await handleImageGeneration(imagePrompt, message)
  }

  // Add user message
  messages.value.push({
    role: 'user',
    content: hasImage ? `${message} [Image attached]` : message,
    timestamp: Date.now(),
    provider: currentProvider,
    hasImage: hasImage
  })

  userInput.value = ''
  errorMessage.value = ''
  isStreaming.value = true
  streamingContent.value = ''
  scrollToBottom()

  try {
    // Build messages array
    let grokMessages = messages.value.map((m) => {
      // For the latest message with image, format according to provider
      if (m === messages.value[messages.value.length - 1] && hasImage && uploadedImage.value) {
        if (currentProvider === 'claude') {
          return {
            role: m.role,
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: uploadedImage.value.mimeType,
                  data: uploadedImage.value.base64
                }
              },
              {
                type: 'text',
                text: message
              }
            ]
          }
        } else if (currentProvider === 'openai' || currentProvider === 'perplexity') {
          return {
            role: m.role,
            content: [
              {
                type: 'text',
                text: message
              },
              {
                type: 'image_url',
                image_url: {
                  url: uploadedImage.value.preview
                }
              }
            ]
          }
        }
      }
      return {
        role: m.role,
        content: m.content,
      }
    })

    // Inject graph context if enabled
    if (useGraphContext.value) {
      const graphContext = buildGraphContext()
      if (graphContext) {
        const contextMessage = {
          role: 'system',
          content: `You are an AI assistant helping analyze a knowledge graph. Here is the current graph context:

Title: ${graphContext.metadata?.title || 'Untitled'}
Description: ${graphContext.metadata?.description || 'No description'}
Category: ${graphContext.metadata?.category || 'Uncategorized'}
Nodes: ${graphContext.metadata?.nodeCount || 0}
Edges: ${graphContext.metadata?.edgeCount || 0}

Sample Nodes (up to 20):
${graphContext.nodes?.map(node => `- ${node.label} (${node.type}): ${node.info || 'No info'}`).join('\n') || 'No nodes'}

Connections (up to 30):
${graphContext.edges?.map(edge => `- ${edge.from} → ${edge.to}`).join('\n') || 'No connections'}

Use this context to provide relevant insights and answers about the knowledge graph.`
        }
        // Insert context before user messages
        grokMessages = [contextMessage, ...grokMessages]
      }
    }

    let endpoint = 'https://grok.vegvisr.org/chat'
    let model = 'grok-3'
    let maxTokens = 32000

    if (currentProvider === 'openai') {
      endpoint = 'https://openai.vegvisr.org/chat'
      model = 'gpt-4o'
      maxTokens = 16384 // OpenAI gpt-4o limit
    } else if (currentProvider === 'claude') {
      endpoint = 'https://anthropic.vegvisr.org/chat'
      model = 'claude-sonnet-4-20250514'
      maxTokens = 8192 // Claude default
    } else if (currentProvider === 'gemini') {
      endpoint = 'https://gemini.vegvisr.org/chat'
      model = undefined // Let the worker pick the default Gemini model
      maxTokens = undefined
    } else if (currentProvider === 'perplexity') {
      endpoint = 'https://perplexity.vegvisr.org/chat'
      model = 'sonar'
      maxTokens = 16384
    }

    // Build request body - Claude needs system message as separate parameter
    let requestBody = {
      userId: userStore.user_id || 'system',
      temperature: 0.7,
      stream: false,
    }

    if (model) {
      requestBody.model = model
    }

    if (typeof maxTokens === 'number') {
      requestBody.max_tokens = maxTokens
    }

    if (currentProvider === 'claude') {
      // Extract system message for Claude (Anthropic API uses top-level system param)
      const systemMsg = grokMessages.find(m => m.role === 'system')
      const nonSystemMessages = grokMessages.filter(m => m.role !== 'system')
      requestBody.messages = nonSystemMessages
      if (systemMsg) {
        requestBody.system = systemMsg.content
      }
    } else {
      requestBody.messages = grokMessages
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      let errorDetail = `API error: ${response.status}`
      try {
        const errJson = await response.json()
        // Handle different error formats: OpenAI uses { error: { message } }, others use { error: "string" }
        if (typeof errJson.error === 'object' && errJson.error?.message) {
          errorDetail = errJson.error.message
        } else if (typeof errJson.error === 'string') {
          errorDetail = errJson.error
        } else {
          errorDetail = JSON.stringify(errJson)
        }
      } catch (_) {
        try {
          errorDetail = await response.text()
        } catch (_) {
          /* ignore */
        }
      }
      throw new Error(errorDetail)
    }

    // Parse response - Claude uses different format than OpenAI/Grok
    const data = await response.json()
    let aiMessage
    if (currentProvider === 'claude') {
      // Anthropic format: data.content[0].text
      aiMessage = data.content?.[0]?.text
    } else {
      // OpenAI/Grok format: data.choices[0].message.content
      aiMessage = data.choices?.[0]?.message?.content
    }

    if (!aiMessage) {
      throw new Error('No response from AI')
    }

    // Simulate streaming effect by displaying word by word
    const words = aiMessage.split(' ')
    for (let i = 0; i < words.length; i++) {
      streamingContent.value += words[i] + (i < words.length - 1 ? ' ' : '')
      scrollToBottom()
      await new Promise(resolve => setTimeout(resolve, 30))
    }

    // Add assistant message
    messages.value.push({
      role: 'assistant',
      content: aiMessage,
      timestamp: Date.now(),
      provider: currentProvider,
    })

    // Clear uploaded image after successful send
    uploadedImage.value = null
  } catch (error) {
    console.error('Chat error:', error)
    errorMessage.value = `Error: ${error.message}`
  } finally {
    isStreaming.value = false
    streamingContent.value = ''
    scrollToBottom()
  }
}

// Watch for graph changes
watch(
  () => props.graphData,
  () => {
    // Optionally notify user if graph context is enabled
  },
  { deep: true }
)
</script>

<style scoped>
.grok-chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  background: white;
  border-left: 1px solid #e0e0e0;
  transition: width 0.3s ease;
  width: 100%;
  min-width: 320px;
  max-width: 100%;
  overflow: hidden;
}

.grok-chat-panel.collapsed {
  width: 72px;
  min-width: 72px;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-title .icon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  display: block;
}

.header-title h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.provider-select {
  height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.15);
  color: white;
  padding: 0 0.5rem;
  font-weight: 600;
}

.provider-select option {
  color: #2c3e50;
}

.btn-ghost {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.2);
}

.collapsed .chat-header h3,
.collapsed .header-title .icon-img {
  display: none;
}

.chat-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  position: relative;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.context-controls {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: rgba(248, 249, 250, 0.95);
  position: relative;
  z-index: 1;
}

.context-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.context-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  display: block;
}

.context-toggle input[type='checkbox'] {
  cursor: pointer;
}

.context-indicator {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: #666;
}

.messages-container {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem;
  padding-bottom: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  z-index: 1;
  min-height: 0;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 8px;
  max-width: 90%;
}

.message-actions {
  display: flex;
  justify-content: flex-start;
}

.insert-btn {
  padding: 0;
  font-weight: 600;
}

.message.user {
  align-self: flex-end;
  background: rgba(227, 242, 253, 0.95);
  border: 1px solid #90caf9;
}

.message.assistant {
  align-self: flex-start;
  background: rgba(245, 245, 245, 0.95);
  border: 1px solid #e0e0e0;
}

.message.error {
  align-self: center;
  background: rgba(255, 235, 238, 0.95);
  border: 1px solid #ef5350;
}

.message.streaming {
  background: rgba(255, 249, 230, 0.95);
  border: 1px solid #ffd54f;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #666;
}

.message-icon {
  font-size: 1.2rem;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: #e5e7eb;
  border: 2px solid #d1d5db;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.message-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.message-avatar-initial {
  font-weight: 700;
  color: #4a5568;
  font-size: 1.1rem;
}

.message-icon-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
  display: block;
}

.assistant-avatar {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #eef2ff;
  border: 1px solid #d7dcff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.assistant-avatar-initial {
  font-size: 0.75rem;
  font-weight: 700;
  color: #4c51bf;
}

.message-role {
  font-weight: 600;
}

.message-time {
  margin-left: auto;
  font-size: 0.75rem;
  color: #999;
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #ff9800;
  font-weight: 600;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #ff9800;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.message-content {
  font-size: 0.95rem;
  line-height: 1.5;
  word-wrap: break-word;
}

.message-content :deep(pre) {
  background: #f5f5f5;
  padding: 0.5rem;
  border-radius: 4px;
  overflow-x: auto;
}

.message-content :deep(code) {
  background: #f5f5f5;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.message-content :deep(pre code) {
  background: transparent;
  padding: 0;
}

.message-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.message-actions .btn-link {
  padding: 0;
  font-weight: 600;
  color: #4c51bf;
}

.message-actions .graph-btn {
  color: #0f766e;
}

.message-actions .btn-link:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-input-container {
  padding: 0.75rem 1rem 1.25rem 1rem;
  border-top: 1px solid #e0e0e0;
  background: rgba(255, 255, 255, 0.95);
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  min-height: 200px;
}

.input-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.input-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-toolbar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.chat-input {
  flex: 1;
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 0.95rem;
  resize: vertical;
  min-height: 60px;
  max-height: 150px;
  font-family: inherit;
}

.chat-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.chat-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.mic-btn,
.image-btn,
.audio-btn {
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  background: #f8f9fa;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mic-btn:hover:not(:disabled),
.image-btn:hover:not(:disabled),
.audio-btn:hover:not(:disabled) {
  background: #e9ecef;
  border-color: #667eea;
  color: #667eea;
}

.mic-btn:disabled,
.image-btn:disabled,
.audio-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mic-btn.recording {
  background: #fee2e2;
  border-color: #ef4444;
  color: #ef4444;
}

.recording-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 12px;
  border: 2px solid #ef4444;
  animation: pulse-ring 1.5s ease-out infinite;
}

@keyframes pulse-ring {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.2);
  }
}

.send-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  white-space: nowrap;
}

.input-hint {
  margin-top: 0.75rem;
  margin-bottom: 0;
  padding: 0 0.5rem;
  font-size: 0.8rem;
  color: #6c757d;
  text-align: center;
  line-height: 1.5;
}

.input-hint kbd {
  background: #f5f5f5;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 0.1rem 0.4rem;
  font-family: monospace;
  font-size: 0.85em;
  font-weight: 700;
  color: #000;
}

.image-preview-container {
  position: relative;
  margin-bottom: 0.75rem;
  display: inline-block;
}

.uploaded-image-preview {
  max-width: 200px;
  max-height: 150px;
  border-radius: 8px;
  border: 2px solid #667eea;
  object-fit: cover;
}

.clear-image-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ef5350;
  color: white;
  border: 2px solid white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  line-height: 1;
  padding: 0;
  transition: all 0.2s;
}

.clear-image-btn:hover {
  background: #d32f2f;
  transform: scale(1.1);
}

.audio-preview-container {
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background: #f9fafb;
}

.audio-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.audio-file-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.audio-meta {
  display: flex;
  gap: 0.5rem;
  color: #666;
  font-size: 0.85rem;
  margin-top: 0.15rem;
}

.audio-settings {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.75rem;
}

.auto-detect-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}

.audio-language-select {
  flex: 0 0 150px;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border: 1px solid #d1d5db;
}

.audio-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.audio-status {
  font-size: 0.9rem;
  color: #555;
}

.clear-audio-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ef5350;
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.clear-audio-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.clear-audio-btn:not(:disabled):hover {
  background: #d32f2f;
}

.input-hint kbd {
  background: #f5f5f5;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 0.1rem 0.4rem;
  font-family: monospace;
  font-size: 0.85em;
}

.graph-job-panel {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.graph-job-card {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 0.85rem;
  background: #f8f9ff;
  box-shadow: 0 4px 12px rgba(18, 24, 40, 0.05);
}

.graph-job-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.graph-job-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #1f2933;
}

.graph-job-chip {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid transparent;
}

.graph-job-chip.processing,
.graph-job-chip.queued {
  background: #fff6e6;
  border-color: #ffd28c;
  color: #b67200;
}

.graph-job-chip.completed {
  background: #ecfdf3;
  border-color: #a7f3d0;
  color: #047857;
}

.graph-job-chip.failed {
  background: #fee2e2;
  border-color: #fecaca;
  color: #b91c1c;
}

.graph-job-meta {
  font-size: 0.8rem;
  color: #6b7280;
  display: flex;
  gap: 0.35rem;
}

.graph-job-remove {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.graph-job-remove:hover {
  color: #6b7280;
}

.graph-job-preview {
  margin: 0.5rem 0;
  font-size: 0.9rem;
  color: #374151;
}

.graph-job-progress {
  height: 6px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
  margin-bottom: 0.35rem;
}

.graph-job-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  transition: width 0.3s ease;
}

.graph-job-status-text {
  font-size: 0.85rem;
  color: #4b5563;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.graph-job-error {
  margin-top: 0.35rem;
  font-size: 0.85rem;
  color: #b91c1c;
}

.graph-job-actions {
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.graph-job-actions .btn-link {
  padding-left: 0;
  padding-right: 0;
}

.graph-job-hint {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: #b45309;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .grok-chat-panel {
    width: 100%;
    max-width: 100%;
    border-left: none;
    border-top: 1px solid #e0e0e0;
  }

  .grok-chat-panel.collapsed {
    width: 100%;
    height: 50px;
  }

  .collapsed .chat-content {
    display: none;
  }

  .message {
    max-width: 95%;
  }
}
</style>
