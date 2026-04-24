<template>
  <Teleport to="body">
    <div v-if="isVisible" class="modal-overlay" @click="closeModal">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h4 class="modal-title">
            <span class="modal-icon">🎬</span>
            Select Realtime Video
          </h4>
          <button @click="closeModal" class="btn-close">&times;</button>
        </div>

        <div class="modal-body">
          <div class="toolbar">
            <div class="search-input-container">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search videos, meeting titles, or IDs..."
                class="search-input"
              />
              <span class="search-icon">🔍</span>
            </div>

            <div class="toolbar-actions">
              <select v-model="sortOrder" class="filter-select">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title A-Z</option>
                <option value="size">Largest First</option>
              </select>
              <button
                @click="fetchRecordings"
                class="btn btn-outline-secondary btn-sm refresh-btn"
                :disabled="loading"
              >
                {{ loading ? 'Loading...' : 'Refresh' }}
              </button>
            </div>
          </div>

          <div v-if="loading" class="loading-state">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="loading-text">Loading videos from meeting-recordings...</p>
          </div>

          <div v-else-if="error" class="error-state">
            <div class="error-icon">❌</div>
            <p class="error-text">{{ error }}</p>
            <button @click="fetchRecordings" class="btn btn-outline-primary btn-sm">Try Again</button>
          </div>

          <div v-else-if="recordings.length === 0" class="empty-state">
            <div class="empty-icon">📼</div>
            <p class="empty-text">No meeting recordings found</p>
            <small class="text-muted">The bucket is currently empty for this prefix.</small>
          </div>

          <div v-else-if="filteredRecordings.length === 0" class="empty-state">
            <div class="empty-icon">🔍</div>
            <p class="empty-text">No videos match your search</p>
            <small class="text-muted">Try a different meeting title or file name.</small>
          </div>

          <div v-else class="recordings-grid">
            <button
              v-for="recording in filteredRecordings"
              :key="recording.key"
              type="button"
              class="recording-card"
              :class="{ selected: selectedRecording?.key === recording.key }"
              @click="selectRecording(recording)"
            >
              <div class="recording-thumb-shell">
                <video
                  :src="recording.thumbnailUrl || recording.url"
                  class="recording-thumb"
                  preload="metadata"
                  muted
                  playsinline
                ></video>
              </div>

              <div class="recording-copy">
                <div class="recording-title">{{ recording.meetingTitle || recording.title }}</div>
                <div class="recording-subtitle">{{ recording.fileName }}</div>
                <div class="recording-meta">
                  <span v-if="recording.duration">{{ formatDuration(recording.duration) }}</span>
                  <span>{{ formatFileSize(recording.size) }}</span>
                  <span>{{ formatDate(recording.syncedAt || recording.uploadedAt) }}</span>
                </div>
                <div v-if="recording.meetingId" class="recording-id">
                  {{ recording.meetingId }}
                </div>
              </div>
            </button>
          </div>
        </div>

        <div class="modal-footer">
          <div class="selection-summary">
            <small class="text-muted">
              <strong>{{ filteredRecordings.length }}</strong> of <strong>{{ recordings.length }}</strong> videos
            </small>
            <small v-if="selectedRecording" class="selected-path">
              Path: <code>{{ selectedRecording.path }}</code>
            </small>
          </div>
          <div class="footer-actions">
            <button @click="closeModal" class="btn btn-secondary">Cancel</button>
            <button
              @click="confirmSelection"
              class="btn btn-primary"
              :disabled="!selectedRecording"
            >
              Use Selected Video
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  isVisible: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['close', 'video-selected'])

const recordings = ref([])
const loading = ref(false)
const error = ref(null)
const searchQuery = ref('')
const selectedRecording = ref(null)
const sortOrder = ref('newest')

const getSortTimestamp = (recording) => {
  return new Date(recording.syncedAt || recording.uploadedAt || 0).getTime()
}

const filteredRecordings = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  let result = recordings.value

  if (query) {
    result = result.filter((recording) => {
      const haystack = [
        recording.title,
        recording.meetingTitle,
        recording.fileName,
        recording.meetingId,
        recording.key,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }

  return [...result].sort((a, b) => {
    switch (sortOrder.value) {
      case 'oldest':
        return getSortTimestamp(a) - getSortTimestamp(b)
      case 'title':
        return String(a.meetingTitle || a.title || '').localeCompare(String(b.meetingTitle || b.title || ''))
      case 'size':
        return (b.size || 0) - (a.size || 0)
      case 'newest':
      default:
        return getSortTimestamp(b) - getSortTimestamp(a)
    }
  })
})

const fetchRecordings = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await fetch('https://api.vegvisr.org/list-meeting-recordings?prefix=recordings/&limit=200')
    if (!response.ok) {
      throw new Error(`Failed to load videos: ${response.status}`)
    }

    const data = await response.json()
    recordings.value = data.recordings || []
  } catch (err) {
    console.error('Failed to load meeting recordings:', err)
    error.value = err.message || 'Failed to load meeting recordings'
    recordings.value = []
  } finally {
    loading.value = false
  }
}

const selectRecording = (recording) => {
  selectedRecording.value = recording
}

const confirmSelection = () => {
  if (!selectedRecording.value) return
  emit('video-selected', selectedRecording.value)
}

const closeModal = () => {
  emit('close')
}

const formatDuration = (seconds) => {
  const totalSeconds = Number(seconds)
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return ''

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = Math.floor(totalSeconds % 60)

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`
}

const formatFileSize = (bytes) => {
  const size = Number(bytes)
  if (!Number.isFinite(size) || size <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const formatDate = (value) => {
  if (!value) return 'Unknown date'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'

  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

watch(
  () => props.isVisible,
  (visible) => {
    if (!visible) return
    searchQuery.value = ''
    selectedRecording.value = null
    fetchRecordings()
  },
)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 1100;
}

.modal-container {
  width: min(1200px, 100%);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}

.modal-header,
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-footer {
  border-bottom: 0;
  border-top: 1px solid #e5e7eb;
}

.modal-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-close {
  border: 0;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input-container {
  position: relative;
  flex: 1 1 320px;
}

.search-input {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 12px 14px 12px 42px;
  font-size: 0.95rem;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.6;
}

.filter-select {
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 10px 12px;
  min-width: 150px;
}

.recordings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
}

.recording-card {
  border: 1px solid #dbe1ea;
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  padding: 0;
}

.recording-card:hover,
.recording-card.selected {
  transform: translateY(-2px);
  border-color: #2563eb;
  box-shadow: 0 18px 40px rgba(37, 99, 235, 0.12);
}

.recording-thumb-shell {
  aspect-ratio: 16 / 9;
  background: #020617;
}

.recording-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #020617;
}

.recording-copy {
  padding: 14px 14px 16px;
}

.recording-title {
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.35;
}

.recording-subtitle,
.recording-id {
  font-size: 0.85rem;
  color: #64748b;
  margin-top: 4px;
  word-break: break-all;
}

.recording-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  font-size: 0.82rem;
  color: #475569;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 48px 20px;
}

.loading-text,
.error-text,
.empty-text {
  margin-top: 12px;
  margin-bottom: 0;
}

.empty-icon,
.error-icon {
  font-size: 2rem;
}

.selection-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.selected-path code {
  word-break: break-all;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 12px;
  }

  .modal-header,
  .modal-footer,
  .modal-body {
    padding: 16px;
  }

  .recordings-grid {
    grid-template-columns: 1fr;
  }

  .modal-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .footer-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
