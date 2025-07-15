<template>
  <div v-if="isVisible" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-container" @click.stop ref="modalContainer">
      <div class="modal-header">
        <h4 class="modal-title">
          <span class="modal-icon">🎤</span>
          Select Audio from Portfolio
        </h4>
        <button @click="closeModal" class="btn-close">&times;</button>
      </div>

      <div class="modal-body">
        <!-- Search Box -->
        <div class="search-section">
          <div class="search-input-container">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search audio recordings..."
              class="search-input"
            />
            <span class="search-icon">🔍</span>
          </div>
          <button
            @click="fetchRecordings"
            class="btn btn-outline-secondary btn-sm refresh-btn"
            :disabled="loading"
            title="Refresh recordings"
          >
            <span v-if="loading">🔄</span>
            <span v-else>🔄</span>
            {{ loading ? 'Loading...' : 'Refresh' }}
          </button>
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
          <small class="text-muted">Upload audio files to see them here</small>
        </div>

        <!-- Recordings List -->
        <div v-if="!loading && !error && filteredRecordings.length > 0" class="recordings-list">
          <div
            v-for="recording in filteredRecordings"
            :key="recording.id"
            class="recording-item"
            :class="{ 'recording-selected': selectedRecording?.id === recording.id }"
            @click="selectRecording(recording)"
          >
            <div class="recording-info">
              <div class="recording-name">{{ recording.displayName || recording.fileName }}</div>
              <div class="recording-meta">
                <span class="duration">🕐 {{ formatDuration(recording.estimatedDuration) }}</span>
                <span class="file-size">📁 {{ formatFileSize(recording.fileSize) }}</span>
              </div>
              <div class="recording-url">
                <small class="text-muted">{{ recording.r2Url }}</small>
              </div>
            </div>
            <div class="recording-actions">
              <button
                v-if="recording.r2Url"
                @click.stop="playAudio(recording.r2Url)"
                class="btn btn-sm btn-outline-success"
                title="Play audio"
              >
                ▶️
              </button>
            </div>
          </div>
        </div>

        <!-- No Results -->
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
          @click="selectAudio"
          class="btn btn-primary"
          :disabled="!selectedRecording || !selectedRecording.r2Url"
        >
          Select Audio
        </button>
        <button @click="closeModal" class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/userStore'

// Props
const props = defineProps({
  isVisible: {
    type: Boolean,
    required: true,
  },
})

// Emits
const emit = defineEmits(['close', 'audio-selected'])

// Store
const userStore = useUserStore()

// Reactive state
const recordings = ref([])
const loading = ref(false)
const error = ref(null)
const searchQuery = ref('')
const selectedRecording = ref(null)
const modalContainer = ref(null)

// Computed properties
const filteredRecordings = computed(() => {
  if (!searchQuery.value.trim()) return recordings.value
  return recordings.value.filter((recording) =>
    (recording.displayName || recording.fileName || '')
      .toLowerCase()
      .includes(searchQuery.value.toLowerCase()),
  )
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
    const response = await fetch(
      `https://audio-portfolio-worker.torarnehave.workers.dev/list-recordings?userEmail=${encodeURIComponent(userStore.email)}`,
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch recordings: ${response.statusText}`)
    }

    const data = await response.json()
    recordings.value = data.recordings || []

    console.log('📁 Audio Portfolio: Loaded recordings:', recordings.value.length)
  } catch (err) {
    console.error('❌ Audio Portfolio: Error fetching recordings:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const selectRecording = (recording) => {
  selectedRecording.value = recording
  console.log(
    '📁 Audio Portfolio: Selected recording:',
    recording.displayName || recording.fileName,
  )
}

const selectAudio = () => {
  if (selectedRecording.value && selectedRecording.value.r2Url) {
    emit('audio-selected', {
      url: selectedRecording.value.r2Url,
      label: selectedRecording.value.displayName || selectedRecording.value.fileName,
      info: `Audio file: ${selectedRecording.value.fileName}`,
    })
    closeModal()
  }
}

const playAudio = (url) => {
  window.open(url, '_blank')
}

const handleOverlayClick = (event) => {
  // Only close if clicking directly on the overlay, not on child elements
  if (event.target === event.currentTarget) {
    closeModal()
  }
}

const closeModal = () => {
  selectedRecording.value = null
  searchQuery.value = ''
  error.value = null
  emit('close')
}

const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatFileSize = (bytes) => {
  if (!bytes) return '0 KB'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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
  if (props.isVisible) {
    fetchRecordings()
  }
})

// Handle body scroll when modal is open
watch(
  () => props.isVisible,
  (isVisible) => {
    if (isVisible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
)

// Clean up on unmount
onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* Reset and isolate modal styles */
.modal-overlay,
.modal-container,
.modal-header,
.modal-body,
.modal-footer {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.4;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  pointer-events: auto;
  backdrop-filter: blur(2px);
  isolation: isolate;
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  max-width: 700px;
  width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  position: absolute;
  z-index: 10000;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) translateZ(0);
  will-change: transform;
}

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

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
}

.modal-body {
  padding: 20px 24px;
  flex: 1;
  overflow-y: auto;
}

.search-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.search-input-container {
  flex: 1;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 40px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
}

.recordings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recording-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.recording-item:hover {
  border-color: #007bff;
  background: #f8f9ff;
}

.recording-selected {
  border-color: #007bff;
  background: #f8f9ff;
}

.recording-info {
  flex: 1;
}

.recording-name {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.recording-meta {
  display: flex;
  gap: 16px;
  font-size: 0.9rem;
  color: #6c757d;
  margin-bottom: 4px;
}

.recording-url {
  font-size: 0.8rem;
  color: #6c757d;
  word-break: break-all;
}

.recording-actions {
  display: flex;
  gap: 8px;
}

.loading-state,
.error-state,
.empty-state,
.no-results {
  text-align: center;
  padding: 40px 20px;
}

.loading-state .spinner-border {
  color: #007bff;
}

.error-state .error-icon,
.empty-state .empty-icon,
.no-results .no-results-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 20px 24px;
  border-top: 1px solid #e9ecef;
}

.btn {
  padding: 8px 16px;
  border: 1px solid;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border-color: #6c757d;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-outline-secondary {
  background: white;
  color: #6c757d;
  border-color: #6c757d;
}

.btn-outline-primary {
  background: white;
  color: #007bff;
  border-color: #007bff;
}

.btn-outline-success {
  background: white;
  color: #28a745;
  border-color: #28a745;
}
</style>
