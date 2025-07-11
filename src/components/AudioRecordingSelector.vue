<template>
  <div v-if="isVisible" class="modal-overlay" @click="closeModal">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h4 class="modal-title">
          <span class="modal-icon">🎤</span>
          Select Audio Recording
        </h4>
        <button @click="closeModal" class="btn-close">&times;</button>
      </div>

      <div class="modal-body">
        <!-- Selection Type Info -->
        <div class="selection-info">
          <div class="selection-type-badge" :class="transcriptionTypeClass">
            {{ transcriptionTypeDisplay }}
          </div>
          <p class="selection-description">{{ transcriptionTypeDescription }}</p>
        </div>

        <!-- Search Box -->
        <div class="search-section">
          <div class="search-input-container">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search recordings..."
              class="search-input"
            />
            <span class="search-icon">🔍</span>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="loading-text">Loading your audio recordings...</p>
        </div>

        <!-- Error State -->
        <div v-if="error" class="error-state">
          <div class="error-icon">❌</div>
          <p class="error-text">{{ error }}</p>
          <button @click="fetchRecordings" class="btn btn-outline-primary btn-sm">Try Again</button>
        </div>

        <!-- No Recordings State -->
        <div v-if="!loading && !error && recordings.length === 0" class="empty-state">
          <div class="empty-icon">📼</div>
          <p class="empty-text">No audio recordings found</p>
          <small class="text-muted">Start transcribing audio to see recordings here</small>
        </div>

        <!-- Recordings List -->
        <div v-if="!loading && !error && filteredRecordings.length > 0" class="recordings-list">
          <div
            v-for="recording in filteredRecordings"
            :key="recording.recordingId"
            class="recording-item"
            :class="{
              'recording-selected': selectedRecording?.recordingId === recording.recordingId,
            }"
            @click="selectRecording(recording)"
          >
            <!-- Recording Header -->
            <div class="recording-header">
              <h6 class="recording-title">{{ recording.displayName || recording.fileName }}</h6>
              <div class="recording-meta">
                <span class="duration">{{ formatDuration(recording.duration) }}</span>
                <span class="date">{{ formatDate(recording.metadata?.uploadedAt) }}</span>
              </div>
            </div>

            <!-- Transcription Info -->
            <div v-if="recording.norwegianTranscription" class="transcription-info">
              <div class="transcription-badges">
                <span class="badge bg-danger">🇳🇴 Norwegian</span>
                <span
                  v-if="recording.norwegianTranscription.improved_text"
                  class="badge bg-success"
                >
                  ✨ Enhanced
                </span>
                <span v-if="recording.norwegianTranscription.chunks > 1" class="badge bg-info">
                  {{ recording.norwegianTranscription.chunks }} chunks
                </span>
              </div>

              <div class="preview-text">
                {{ getPreviewText(recording) }}
              </div>

              <!-- Availability Status -->
              <div class="availability-status">
                <span v-if="hasRequiredTranscription(recording)" class="status-available">
                  ✅ {{ transcriptionTypeDisplay }} available
                </span>
                <span v-else class="status-unavailable">
                  ❌ {{ transcriptionTypeDisplay }} not available
                </span>
              </div>
            </div>
            <div v-else class="no-transcription">
              <span class="status-unavailable">❌ No Norwegian transcription available</span>
            </div>
          </div>
        </div>

        <!-- No Search Results -->
        <div
          v-if="!loading && !error && recordings.length > 0 && filteredRecordings.length === 0"
          class="no-results"
        >
          <div class="no-results-icon">🔍</div>
          <p class="no-results-text">No recordings match your search</p>
          <small class="text-muted">Try adjusting your search terms</small>
        </div>
      </div>

      <div class="modal-footer">
        <button
          @click="insertSelectedRecording"
          class="btn btn-primary"
          :disabled="
            !selectedRecording || !hasRequiredTranscription(selectedRecording) || inserting
          "
        >
          <span v-if="inserting" class="spinner-border spinner-border-sm me-2"></span>
          {{ inserting ? 'Creating...' : `Insert ${transcriptionTypeDisplay}` }}
        </button>
        <button @click="closeModal" class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'

// Props
const props = defineProps({
  isVisible: {
    type: Boolean,
    required: true,
  },
  transcriptionType: {
    type: String,
    required: true,
    validator: (value) => ['enhanced', 'raw', 'both'].includes(value),
  },
})

// Emits
const emit = defineEmits(['close', 'node-created'])

// Store
const userStore = useUserStore()

// Reactive state
const recordings = ref([])
const loading = ref(false)
const error = ref(null)
const searchQuery = ref('')
const selectedRecording = ref(null)
const inserting = ref(false)

// Computed properties
const transcriptionTypeDisplay = computed(() => {
  switch (props.transcriptionType) {
    case 'enhanced':
      return 'Enhanced Text'
    case 'raw':
      return 'Raw Text'
    case 'both':
      return 'Both Texts'
    default:
      return 'Transcription'
  }
})

const transcriptionTypeDescription = computed(() => {
  switch (props.transcriptionType) {
    case 'enhanced':
      return 'Insert AI-enhanced, cleaned transcription as a fulltext node'
    case 'raw':
      return 'Insert original, unprocessed transcription as a fulltext node'
    case 'both':
      return 'Insert both enhanced and raw transcriptions as separate fulltext nodes'
    default:
      return 'Insert transcription as fulltext node'
  }
})

const transcriptionTypeClass = computed(() => {
  switch (props.transcriptionType) {
    case 'enhanced':
      return 'type-enhanced'
    case 'raw':
      return 'type-raw'
    case 'both':
      return 'type-both'
    default:
      return 'type-default'
  }
})

const filteredRecordings = computed(() => {
  if (!searchQuery.value.trim()) return recordings.value

  const query = searchQuery.value.toLowerCase()
  return recordings.value.filter((recording) => {
    const displayName = recording.displayName || recording.fileName || ''
    const enhanced = recording.norwegianTranscription?.improved_text || ''
    const raw = recording.norwegianTranscription?.raw_text || ''

    return (
      displayName.toLowerCase().includes(query) ||
      enhanced.toLowerCase().includes(query) ||
      raw.toLowerCase().includes(query)
    )
  })
})

// Methods
const fetchRecordings = async () => {
  if (!userStore.email) {
    error.value = 'User not logged in'
    return
  }

  loading.value = true
  error.value = null

  try {
    console.log('🎤 Fetching audio recordings for modal...')
    const response = await fetch(
      `https://audio-portfolio-worker.torarnehave.workers.dev/list-recordings?userEmail=${encodeURIComponent(userStore.email)}`,
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch recordings: ${response.statusText}`)
    }

    const data = await response.json()
    recordings.value = data.recordings || []

    console.log(`✅ Loaded ${recordings.value.length} recordings for modal`)
  } catch (err) {
    console.error('Error fetching recordings:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const hasRequiredTranscription = (recording) => {
  if (!recording?.norwegianTranscription) return false

  switch (props.transcriptionType) {
    case 'enhanced':
      return !!recording.norwegianTranscription.improved_text
    case 'raw':
      return !!recording.norwegianTranscription.raw_text
    case 'both':
      return (
        !!recording.norwegianTranscription.improved_text &&
        !!recording.norwegianTranscription.raw_text
      )
    default:
      return false
  }
}

const getPreviewText = (recording) => {
  const enhanced = recording.norwegianTranscription?.improved_text
  const raw = recording.norwegianTranscription?.raw_text

  // Show preview based on what will be inserted
  let previewText = ''
  if (props.transcriptionType === 'enhanced' && enhanced) {
    previewText = enhanced
  } else if (props.transcriptionType === 'raw' && raw) {
    previewText = raw
  } else if (props.transcriptionType === 'both' && enhanced) {
    previewText = enhanced // Show enhanced for preview when both
  } else {
    previewText = enhanced || raw || 'No transcription available'
  }

  return previewText.length > 120 ? previewText.substring(0, 120) + '...' : previewText
}

const selectRecording = (recording) => {
  if (hasRequiredTranscription(recording)) {
    selectedRecording.value = recording
  }
}

const createEnhancedTextNode = (recording) => {
  const enhancedText = recording.norwegianTranscription.improved_text

  const nodeContent = `[FANCY | font-family: 'Arial, sans-serif'; font-size: 2.5em; color: #2c3e50; text-align: center]
✨ Enhanced: ${recording.displayName || recording.fileName}
[END FANCY]

${enhancedText}

[WNOTE | Cited='AI Enhanced Norwegian Transcription']
Source: ${recording.fileName} • Enhanced by Cloudflare Workers AI • ${formatDate(recording.metadata?.uploadedAt)}
Audio Duration: ${formatDuration(recording.duration)} • Processing: ${recording.norwegianTranscription.chunks || 1} chunks
[END WNOTE]`

  return {
    id: `enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'fulltext',
    label: `✨ Enhanced: ${recording.displayName || recording.fileName}`,
    info: nodeContent,
    color: '#e8f5e8',
    visible: true,
    position: { x: 100, y: 100 },
    bibl: [`Audio Recording: ${recording.fileName}`],
    metadata: {
      audioRecordingId: recording.recordingId,
      transcriptionType: 'enhanced',
      r2Url: recording.r2Url,
    },
  }
}

const createRawTextNode = (recording) => {
  const rawText = recording.norwegianTranscription.raw_text

  const nodeContent = `[FANCY | font-family: 'Arial, sans-serif'; font-size: 2.5em; color: #2c3e50; text-align: center]
🎤 Raw: ${recording.displayName || recording.fileName}
[END FANCY]

${rawText}

[WNOTE | Cited='Norwegian Transcription System']
Source: ${recording.fileName} • Raw transcription • ${formatDate(recording.metadata?.uploadedAt)}
Audio Duration: ${formatDuration(recording.duration)} • Processing: ${recording.norwegianTranscription.chunks || 1} chunks
[END WNOTE]`

  return {
    id: `raw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'fulltext',
    label: `🎤 Raw: ${recording.displayName || recording.fileName}`,
    info: nodeContent,
    color: '#f8f9fa',
    visible: true,
    position: { x: 100, y: 100 },
    bibl: [`Audio Recording: ${recording.fileName}`],
    metadata: {
      audioRecordingId: recording.recordingId,
      transcriptionType: 'raw',
      r2Url: recording.r2Url,
    },
  }
}

const insertSelectedRecording = async () => {
  if (!selectedRecording.value || !hasRequiredTranscription(selectedRecording.value)) {
    return
  }

  inserting.value = true

  try {
    const recording = selectedRecording.value

    if (props.transcriptionType === 'enhanced') {
      const node = createEnhancedTextNode(recording)
      emit('node-created', node)
    } else if (props.transcriptionType === 'raw') {
      const node = createRawTextNode(recording)
      emit('node-created', node)
    } else if (props.transcriptionType === 'both') {
      // Create enhanced node
      const enhancedNode = createEnhancedTextNode(recording)

      // Create raw node positioned to the right
      const rawNode = createRawTextNode(recording)
      rawNode.position = { x: 400, y: 100 }

      // Emit both nodes
      emit('node-created', enhancedNode)

      // Small delay to ensure first node is processed
      setTimeout(() => {
        emit('node-created', rawNode)
      }, 100)
    }

    // Close modal after successful insertion
    closeModal()
  } catch (err) {
    console.error('Error inserting recording:', err)
    error.value = 'Failed to insert recording. Please try again.'
  } finally {
    inserting.value = false
  }
}

const closeModal = () => {
  selectedRecording.value = null
  searchQuery.value = ''
  error.value = null
  inserting.value = false
  emit('close')
}

const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Watch for visibility changes to fetch recordings
watch(
  () => props.isVisible,
  (newVisible) => {
    if (newVisible && recordings.value.length === 0) {
      fetchRecordings()
    }
  },
)

// Initial fetch if already visible
onMounted(() => {
  if (props.isVisible && recordings.value.length === 0) {
    fetchRecordings()
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  max-width: 800px;
  width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
  border-radius: 12px 12px 0 0;
  background: #f8f9fa;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-icon {
  font-size: 1.5rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.btn-close:hover {
  background: #e9ecef;
  color: #495057;
}

/* Body */
.modal-body {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

/* Selection Info */
.selection-info {
  margin-bottom: 20px;
  padding: 16px;
  border-radius: 8px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
}

.selection-type-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.type-enhanced {
  background: #d4edda;
  color: #155724;
}

.type-raw {
  background: #cce7ff;
  color: #004085;
}

.type-both {
  background: #e7f3ff;
  color: #0056b3;
}

.selection-description {
  margin: 0;
  color: #6c757d;
  font-size: 0.9rem;
}

/* Search */
.search-section {
  margin-bottom: 20px;
}

.search-input-container {
  position: relative;
}

.search-input {
  width: 100%;
  padding: 10px 12px 10px 40px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
}

/* States */
.loading-state,
.error-state,
.empty-state,
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.loading-text,
.error-text,
.empty-text,
.no-results-text {
  margin: 12px 0 0 0;
  color: #6c757d;
}

.error-icon,
.empty-icon,
.no-results-icon {
  font-size: 3rem;
  margin-bottom: 8px;
}

/* Recordings List */
.recordings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.recording-item {
  padding: 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fff;
}

.recording-item:hover {
  border-color: #007bff;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
}

.recording-selected {
  border-color: #007bff !important;
  background: #f8f9ff !important;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1) !important;
}

.recording-header {
  margin-bottom: 8px;
}

.recording-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: #2c3e50;
}

.recording-meta {
  display: flex;
  gap: 12px;
  font-size: 0.8rem;
  color: #6c757d;
}

.duration::before {
  content: '🕐 ';
}

.date::before {
  content: '📅 ';
}

/* Transcription Info */
.transcription-info {
  margin-bottom: 8px;
}

.transcription-badges {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.transcription-badges .badge {
  font-size: 0.7rem;
  padding: 3px 8px;
}

.preview-text {
  font-size: 0.85rem;
  color: #495057;
  line-height: 1.4;
  background: #f8f9fa;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
  margin-bottom: 8px;
}

.availability-status {
  font-size: 0.8rem;
  font-weight: 500;
}

.status-available {
  color: #155724;
}

.status-unavailable {
  color: #721c24;
}

.no-transcription {
  font-size: 0.8rem;
  text-align: center;
  padding: 8px;
}

/* Footer */
.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 20px 24px;
  border-top: 1px solid #e9ecef;
  border-radius: 0 0 12px 12px;
  background: #f8f9fa;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s ease;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-outline-primary {
  background: white;
  color: #007bff;
  border: 1px solid #007bff;
}

.btn-outline-primary:hover {
  background: #007bff;
  color: white;
}

/* Responsive */
@media (max-width: 768px) {
  .modal-container {
    width: 95vw;
    max-height: 90vh;
    margin: 5vh auto;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 16px;
  }

  .recordings-list {
    max-height: 300px;
  }

  .recording-item {
    padding: 12px;
  }

  .modal-footer {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
