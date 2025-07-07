<template>
  <div>
    <div v-if="!userStore.loggedIn">
      <div class="alert alert-warning">User not loaded. Please log in.</div>
    </div>

    <div
      class="audio-portfolio-page"
      :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
    >
      <div class="container-fluid">
        <!-- Header -->
        <div class="row mb-4">
          <div class="col-12">
            <h1 class="text-center">🎤 Audio Recording Portfolio</h1>
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div class="search-box">
                <input
                  type="text"
                  v-model="searchQuery"
                  class="form-control"
                  placeholder="Search recordings, transcriptions, tags..."
                  @input="filterRecordings"
                />
              </div>
              <div class="view-options d-flex align-items-center" style="gap: 0.5rem">
                <label class="mb-0">Sort:</label>
                <select v-model="sortBy" class="form-select" @change="sortRecordings">
                  <option value="date-desc">Date (Newest First)</option>
                  <option value="date-asc">Date (Oldest First)</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="duration">Duration</option>
                  <option value="category">Category</option>
                </select>
              </div>
            </div>
            <!-- Category Filter -->
            <div class="category-filter mb-3">
              <div class="btn-group" role="group">
                <button
                  type="button"
                  class="btn btn-outline-primary"
                  :class="{ active: selectedCategory === null }"
                  @click="selectedCategory = null"
                >
                  All Categories
                </button>
                <button
                  v-for="category in availableCategories"
                  :key="category"
                  type="button"
                  class="btn btn-outline-primary"
                  :class="{ active: selectedCategory === category }"
                  @click="selectedCategory = category"
                >
                  {{ category }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center mt-5">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-2">Loading your audio recordings...</p>
        </div>

        <!-- Error State -->
        <div v-if="error" class="alert alert-danger mt-3" role="alert">
          {{ error }}
        </div>

        <!-- No Results State -->
        <div v-if="!loading && !error && filteredRecordings.length === 0" class="text-center mt-5">
          <div v-if="recordings.length === 0">
            <h3>📼 No Audio Recordings Yet</h3>
            <p class="text-muted">
              Start by transcribing some audio in the Audio Transcription node!
            </p>
            <router-link to="/gnew" class="btn btn-primary">
              Go to Audio Transcription
            </router-link>
          </div>
          <div v-else>
            <h3>🔍 No recordings match your search</h3>
            <p class="text-muted">Try adjusting your search terms or category filter.</p>
          </div>
        </div>

        <!-- Recordings Grid -->
        <div v-if="!loading && !error && filteredRecordings.length > 0">
          <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-4">
            <div v-for="recording in filteredRecordings" :key="recording.id" class="col">
              <div
                class="card h-100"
                :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
              >
                <div class="card-body">
                  <!-- Edit Mode -->
                  <div v-if="editingRecordingId === recording.id" class="edit-form">
                    <div class="mb-3">
                      <label class="form-label">Display Name</label>
                      <input
                        type="text"
                        class="form-control"
                        v-model="editingRecording.displayName"
                        placeholder="Enter display name"
                      />
                    </div>
                    <div class="mb-3">
                      <label class="form-label">Category</label>
                      <input
                        type="text"
                        class="form-control"
                        v-model="editingRecording.metadata.category"
                        placeholder="e.g., Meeting, Interview, Notes"
                      />
                    </div>
                    <div class="mb-3">
                      <label class="form-label">Tags (comma-separated)</label>
                      <input
                        type="text"
                        class="form-control"
                        :value="(editingRecording.metadata?.tags || []).join(', ')"
                        @input="updateTags"
                        placeholder="e.g., work, project, important"
                      />
                    </div>
                    <div class="d-flex justify-content-end gap-2">
                      <button class="btn btn-secondary btn-sm" @click="cancelEdit">Cancel</button>
                      <button class="btn btn-primary btn-sm" @click="saveEdit(recording)">
                        Save
                      </button>
                    </div>
                  </div>

                  <!-- View Mode -->
                  <template v-else>
                    <div class="d-flex justify-content-between align-items-start">
                      <h5 class="card-title mb-0">{{ recording.displayName }}</h5>
                      <div class="dropdown">
                        <button
                          class="btn btn-outline-secondary btn-sm dropdown-toggle"
                          type="button"
                          :id="'dropdownMenuButton' + recording.id"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                        >
                          ⚙️
                        </button>
                        <ul
                          class="dropdown-menu"
                          :aria-labelledby="'dropdownMenuButton' + recording.id"
                        >
                          <li>
                            <a class="dropdown-item" href="#" @click="startEdit(recording)"
                              >✏️ Edit</a
                            >
                          </li>
                          <li>
                            <a class="dropdown-item" href="#" @click="confirmDelete(recording)"
                              >🗑️ Delete</a
                            >
                          </li>
                        </ul>
                      </div>
                    </div>

                    <!-- Audio Player -->
                    <div class="audio-player mt-3 mb-3">
                      <div v-if="recording.r2Url" class="audio-container">
                        <audio
                          controls
                          class="w-100"
                          :src="recording.r2Url"
                          @error="handleAudioError($event, recording)"
                          @loadstart="console.log('Audio loading started for:', recording.r2Url)"
                          @loadeddata="console.log('Audio loaded successfully for:', recording.id)"
                          preload="metadata"
                        >
                          Your browser does not support the audio element.
                        </audio>
                        <small class="text-muted d-block mt-1">
                          Audio URL:
                          <a
                            :href="recording.r2Url"
                            target="_blank"
                            class="text-truncate d-inline-block"
                            style="max-width: 200px"
                            >{{ recording.r2Url }}</a
                          >
                        </small>
                      </div>
                      <div v-else class="alert alert-warning">
                        <strong>⚠️ Audio Unavailable:</strong> No audio URL found for this
                        recording.
                        <small class="d-block">Recording ID: {{ recording.id }}</small>
                      </div>
                    </div>

                    <!-- Recording Info -->
                    <div class="recording-info">
                      <div class="d-flex justify-content-between text-muted small mb-2">
                        <span
                          >🕐
                          {{
                            formatDuration(recording.estimatedDuration || recording.duration)
                          }}</span
                        >
                        <span>📁 {{ formatFileSize(recording.fileSize) }}</span>
                      </div>
                      <span class="badge bg-primary">{{
                        recording.metadata?.category || recording.category || 'Uncategorized'
                      }}</span>
                      <span
                        v-for="tag in recording.metadata?.tags || recording.tags || []"
                        :key="tag"
                        class="badge bg-secondary ms-1"
                      >
                        {{ tag }}
                      </span>
                    </div>

                    <!-- Transcription Excerpt -->
                    <div class="transcription-excerpt mt-3">
                      <h6 class="text-muted">Transcription:</h6>
                      <p class="small text-muted mb-2">
                        {{
                          recording.transcription?.excerpt ||
                          recording.transcriptionText?.substring(0, 200) + '...' ||
                          'No transcription available'
                        }}
                      </p>
                      <button
                        class="btn btn-outline-info btn-sm"
                        @click="showFullTranscription(recording)"
                      >
                        View Full Transcription
                      </button>
                    </div>

                    <!-- Connected Graphs -->
                    <div
                      v-if="(recording.metadata?.connectedGraphIds || []).length > 0"
                      class="connected-graphs mt-3"
                    >
                      <h6 class="text-muted">Connected Graphs:</h6>
                      <div class="d-flex flex-wrap gap-1">
                        <span
                          v-for="graphId in recording.metadata?.connectedGraphIds || []"
                          :key="graphId"
                          class="badge bg-success"
                        >
                          📊 {{ graphId }}
                        </span>
                      </div>
                    </div>

                    <!-- Metadata -->
                    <div class="metadata mt-3">
                      <small class="text-muted">
                        📅 Uploaded:
                        {{ formatDate(recording.metadata?.uploadedAt || recording.createdAt)
                        }}<br />
                        🤖 Service:
                        {{ recording.transcription?.service || recording.aiService || 'Unknown'
                        }}<br />
                        🎯 Model:
                        {{ recording.transcription?.model || recording.aiModel || 'Unknown' }}
                      </small>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Full Transcription Modal -->
        <div
          class="modal fade"
          id="transcriptionModal"
          tabindex="-1"
          aria-labelledby="transcriptionModalLabel"
          aria-hidden="true"
        >
          <div class="modal-dialog modal-lg">
            <div
              class="modal-content"
              :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
            >
              <div class="modal-header">
                <h5 class="modal-title" id="transcriptionModalLabel">
                  Full Transcription: {{ selectedRecording?.displayName }}
                </h5>
                <button
                  type="button"
                  class="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                ></button>
              </div>
              <div class="modal-body">
                <div class="d-flex justify-content-between mb-3">
                  <div>
                    <span class="badge bg-info">{{
                      selectedRecording?.transcription?.service ||
                      selectedRecording?.aiService ||
                      'Unknown'
                    }}</span>
                    <span class="badge bg-info ms-1">{{
                      selectedRecording?.transcription?.model ||
                      selectedRecording?.aiModel ||
                      'Unknown'
                    }}</span>
                  </div>
                  <button class="btn btn-outline-primary btn-sm" @click="copyTranscription">
                    📋 Copy Text
                  </button>
                </div>
                <div class="transcription-text" style="max-height: 400px; overflow-y: auto">
                  <p class="text-break">
                    {{
                      selectedRecording?.transcription?.text ||
                      selectedRecording?.transcriptionText ||
                      'No transcription available'
                    }}
                  </p>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'

// Ensure Bootstrap is available globally
if (typeof window !== 'undefined') {
  // Import Bootstrap if not already available
  if (typeof window.bootstrap === 'undefined') {
    import('bootstrap/dist/js/bootstrap.bundle.min.js')
      .then(() => {
        console.log('Bootstrap imported dynamically')
      })
      .catch((error) => {
        console.error('Failed to import Bootstrap:', error)
      })
  } else {
    console.log('Bootstrap already available')
  }
}

// Props
const props = defineProps({
  theme: {
    type: String,
    default: 'light',
  },
})

// Store
const userStore = useUserStore()

// Reactive data
const recordings = ref([])
const loading = ref(false)
const error = ref(null)
const searchQuery = ref('')
const sortBy = ref('date-desc')
const selectedCategory = ref(null)
const editingRecordingId = ref(null)
const editingRecording = ref(null)
const selectedRecording = ref(null)

// Computed properties
const filteredRecordings = computed(() => {
  let filtered = recordings.value

  // Apply category filter
  if (selectedCategory.value) {
    filtered = filtered.filter((r) => {
      const category = r.metadata?.category || r.category || 'Uncategorized'
      return category === selectedCategory.value
    })
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter((recording) => {
      const category = recording.metadata?.category || recording.category || 'Uncategorized'
      const tags = recording.metadata?.tags || recording.tags || []
      const transcriptionText = recording.transcription?.text || recording.transcriptionText || ''
      const displayName = recording.displayName || recording.fileName || ''
      const fileName = recording.fileName || ''

      return (
        displayName.toLowerCase().includes(query) ||
        fileName.toLowerCase().includes(query) ||
        transcriptionText.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query) ||
        tags.some((tag) => tag.toLowerCase().includes(query))
      )
    })
  }

  // Apply sorting
  return filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'date-desc':
        const dateB = new Date(b.metadata?.uploadedAt || b.createdAt || 0)
        const dateA = new Date(a.metadata?.uploadedAt || a.createdAt || 0)
        return dateB - dateA
      case 'date-asc':
        const dateA2 = new Date(a.metadata?.uploadedAt || a.createdAt || 0)
        const dateB2 = new Date(b.metadata?.uploadedAt || b.createdAt || 0)
        return dateA2 - dateB2
      case 'name-asc':
        return (a.displayName || a.fileName || '').localeCompare(b.displayName || b.fileName || '')
      case 'name-desc':
        return (b.displayName || b.fileName || '').localeCompare(a.displayName || a.fileName || '')
      case 'duration':
        return (b.estimatedDuration || b.duration || 0) - (a.estimatedDuration || a.duration || 0)
      case 'category':
        const catA = a.metadata?.category || a.category || 'Uncategorized'
        const catB = b.metadata?.category || b.category || 'Uncategorized'
        return catA.localeCompare(catB)
      default:
        return 0
    }
  })
})

const availableCategories = computed(() => {
  const categories = new Set()
  recordings.value.forEach((recording) => {
    // Add null checks for metadata and category
    const category = recording.metadata?.category || recording.category || 'Uncategorized'
    categories.add(category)
  })
  return Array.from(categories).sort()
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

    // === AUDIO PORTFOLIO DEBUG ANALYSIS ===
    console.log('=== AUDIO PORTFOLIO DATA ANALYSIS ===')
    console.log('Raw API Response:', JSON.stringify(data, null, 2))
    console.log('Number of recordings:', recordings.value.length)

    if (recordings.value.length > 0) {
      console.log('First recording structure:', JSON.stringify(recordings.value[0], null, 2))
      console.log('r2Url check for first recording:', recordings.value[0]?.r2Url)
      console.log('Transcription data for first recording:', recordings.value[0]?.transcription)
      console.log('Alternative transcription field:', recordings.value[0]?.transcriptionText)
    }

    recordings.value.forEach((recording, index) => {
      console.log(`Recording ${index + 1}:`)
      console.log('  - ID:', recording.id)
      console.log('  - Display Name:', recording.displayName || recording.fileName)
      console.log('  - R2 URL:', recording.r2Url)
      console.log('  - Has transcription object:', !!recording.transcription)
      console.log('  - Has transcriptionText:', !!recording.transcriptionText)
      console.log(
        '  - Metadata structure:',
        recording.metadata ? Object.keys(recording.metadata) : 'No metadata',
      )
    })
    console.log('=======================================')
  } catch (err) {
    console.error('Error fetching recordings:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const filterRecordings = () => {
  // Filtering is handled by computed property
}

const sortRecordings = () => {
  // Sorting is handled by computed property
}

const startEdit = (recording) => {
  editingRecordingId.value = recording.id
  editingRecording.value = {
    displayName: recording.displayName || recording.fileName || '',
    metadata: {
      category: recording.metadata?.category || recording.category || 'Uncategorized',
      tags: [...(recording.metadata?.tags || recording.tags || [])],
    },
  }
}

const cancelEdit = () => {
  editingRecordingId.value = null
  editingRecording.value = null
}

const updateTags = (event) => {
  const tagsString = event.target.value
  editingRecording.value.metadata.tags = tagsString
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

const saveEdit = async (recording) => {
  try {
    const response = await fetch(
      `https://audio-portfolio-worker.torarnehave.workers.dev/update-recording`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: userStore.email,
          recordingId: recording.id,
          updates: editingRecording.value,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to update recording: ${response.statusText}`)
    }

    // Update local data
    const recordingIndex = recordings.value.findIndex((r) => r.id === recording.id)
    if (recordingIndex !== -1) {
      recordings.value[recordingIndex].displayName = editingRecording.value.displayName
      // Ensure metadata object exists
      if (!recordings.value[recordingIndex].metadata) {
        recordings.value[recordingIndex].metadata = {}
      }
      recordings.value[recordingIndex].metadata.category = editingRecording.value.metadata.category
      recordings.value[recordingIndex].metadata.tags = editingRecording.value.metadata.tags
    }

    cancelEdit()
    console.log('Recording updated successfully')
  } catch (err) {
    console.error('Error updating recording:', err)
    alert('Failed to update recording: ' + err.message)
  }
}

const confirmDelete = (recording) => {
  if (
    confirm(
      `Are you sure you want to delete "${recording.displayName}"? This action cannot be undone.`,
    )
  ) {
    deleteRecording(recording)
  }
}

const deleteRecording = async (recording) => {
  try {
    const response = await fetch(
      `https://audio-portfolio-worker.torarnehave.workers.dev/delete-recording`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: userStore.email,
          recordingId: recording.id,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to delete recording: ${response.statusText}`)
    }

    // Remove from local data
    recordings.value = recordings.value.filter((r) => r.id !== recording.id)
    console.log('Recording deleted successfully')
  } catch (err) {
    console.error('Error deleting recording:', err)
    alert('Failed to delete recording: ' + err.message)
  }
}

const showFullTranscription = (recording) => {
  console.log('=== MODAL DEBUG: showFullTranscription called ===')
  console.log('Recording data:', JSON.stringify(recording, null, 2))
  console.log('Transcription text:', recording.transcription?.text || recording.transcriptionText)
  console.log('Modal element exists:', !!document.getElementById('transcriptionModal'))

  selectedRecording.value = recording

  try {
    // Check if Bootstrap is available
    const Bootstrap = window.bootstrap || bootstrap
    if (typeof Bootstrap !== 'undefined' && Bootstrap.Modal) {
      console.log('Bootstrap Modal available, attempting to show modal')
      const modalElement = document.getElementById('transcriptionModal')
      if (modalElement) {
        const modal = new Bootstrap.Modal(modalElement)
        modal.show()
        console.log('Bootstrap modal shown successfully')
      } else {
        console.error('Modal element not found in DOM')
        throw new Error('Modal element not found')
      }
    } else {
      console.warn('Bootstrap not available, using fallback')
      throw new Error('Bootstrap not available')
    }
  } catch (error) {
    console.error('Modal error:', error)
    // Fallback: Create a simple alert with transcription text
    const transcriptionText =
      recording.transcription?.text || recording.transcriptionText || 'No transcription available'
    const truncatedText =
      transcriptionText.length > 500
        ? transcriptionText.substring(0, 500) + '...\n\n[Full text copied to clipboard]'
        : transcriptionText

    // Copy full text to clipboard
    if (transcriptionText !== 'No transcription available') {
      navigator.clipboard
        .writeText(transcriptionText)
        .then(() => console.log('Transcription copied to clipboard as fallback'))
        .catch((err) => console.error('Failed to copy to clipboard:', err))
    }

    alert(`Full Transcription: ${recording.displayName || recording.fileName}\n\n${truncatedText}`)
  }

  console.log('=== END MODAL DEBUG ===')
}

const copyTranscription = () => {
  const transcriptionText =
    selectedRecording.value?.transcription?.text || selectedRecording.value?.transcriptionText
  if (transcriptionText) {
    navigator.clipboard
      .writeText(transcriptionText)
      .then(() => {
        alert('Transcription copied to clipboard!')
      })
      .catch((err) => {
        console.error('Failed to copy text:', err)
        alert('Failed to copy text to clipboard')
      })
  } else {
    alert('No transcription text available to copy')
  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const handleAudioError = (event, recording) => {
  console.error('=== AUDIO ERROR DEBUG ===')
  console.error('Audio error event:', event)
  console.error('Error target:', event.target)
  console.error('Error code:', event.target?.error?.code)
  console.error('Error message:', event.target?.error?.message)
  console.error('Recording r2Url:', recording.r2Url)
  console.error('Recording ID:', recording.id)

  // Provide specific error messages based on error code
  let errorMessage = 'Failed to load audio.'
  const errorCode = event.target?.error?.code

  switch (errorCode) {
    case 1: // MEDIA_ERR_ABORTED
      errorMessage = 'Audio loading was aborted.'
      break
    case 2: // MEDIA_ERR_NETWORK
      errorMessage = 'Network error while loading audio. Check your connection.'
      break
    case 3: // MEDIA_ERR_DECODE
      errorMessage = 'Audio file is corrupted or in an unsupported format.'
      break
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
      errorMessage = 'Audio format not supported or file not found.'
      break
    default:
      errorMessage = 'Unknown audio error occurred.'
  }

  console.error('Processed error message:', errorMessage)
  console.error('========================')

  // Show user-friendly error
  alert(
    `${errorMessage}\n\nRecording: ${recording.displayName || recording.fileName}\nPlease try again later or contact support.`,
  )
}

// Lifecycle
onMounted(() => {
  fetchRecordings()
})
</script>

<style scoped>
.audio-portfolio-page {
  min-height: 100vh;
  padding: 20px 0;
}

.search-box {
  min-width: 300px;
}

.card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.audio-player audio {
  border-radius: 8px;
}

.transcription-excerpt {
  border-left: 3px solid #007bff;
  padding-left: 10px;
  background-color: rgba(0, 123, 255, 0.05);
  border-radius: 0 4px 4px 0;
}

.transcription-text {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.bg-dark .transcription-text {
  background-color: #343a40;
  border-color: #495057;
}

.recording-info .badge {
  font-size: 0.75rem;
}

.connected-graphs .badge {
  font-size: 0.7rem;
}

.metadata {
  border-top: 1px solid #dee2e6;
  padding-top: 10px;
}

.bg-dark .metadata {
  border-top-color: #495057;
}

.category-filter .btn {
  font-size: 0.875rem;
}

.edit-form {
  background-color: rgba(0, 123, 255, 0.05);
  padding: 15px;
  border-radius: 8px;
  border: 1px solid rgba(0, 123, 255, 0.2);
}

.bg-dark .edit-form {
  background-color: rgba(0, 123, 255, 0.1);
}
</style>
