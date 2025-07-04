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
                        :value="editingRecording.metadata.tags.join(', ')"
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
                      <audio controls class="w-100" :src="recording.r2Url">
                        Your browser does not support the audio element.
                      </audio>
                    </div>

                    <!-- Recording Info -->
                    <div class="recording-info">
                      <div class="d-flex justify-content-between text-muted small mb-2">
                        <span>🕐 {{ formatDuration(recording.estimatedDuration) }}</span>
                        <span>📁 {{ formatFileSize(recording.fileSize) }}</span>
                      </div>
                      <span class="badge bg-primary">{{ recording.metadata.category }}</span>
                      <span
                        v-for="tag in recording.metadata.tags"
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
                        {{ recording.transcription.excerpt }}
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
                      v-if="recording.metadata.connectedGraphIds.length > 0"
                      class="connected-graphs mt-3"
                    >
                      <h6 class="text-muted">Connected Graphs:</h6>
                      <div class="d-flex flex-wrap gap-1">
                        <span
                          v-for="graphId in recording.metadata.connectedGraphIds"
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
                        📅 Uploaded: {{ formatDate(recording.metadata.uploadedAt) }}<br />
                        🤖 Service: {{ recording.transcription.service }}<br />
                        🎯 Model: {{ recording.transcription.model }}
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
                      selectedRecording?.transcription.service
                    }}</span>
                    <span class="badge bg-info ms-1">{{
                      selectedRecording?.transcription.model
                    }}</span>
                  </div>
                  <button class="btn btn-outline-primary btn-sm" @click="copyTranscription">
                    📋 Copy Text
                  </button>
                </div>
                <div class="transcription-text" style="max-height: 400px; overflow-y: auto">
                  <p class="text-break">{{ selectedRecording?.transcription.text }}</p>
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
    filtered = filtered.filter((r) => r.metadata.category === selectedCategory.value)
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter((recording) => {
      return (
        recording.displayName.toLowerCase().includes(query) ||
        recording.fileName.toLowerCase().includes(query) ||
        recording.transcription.text.toLowerCase().includes(query) ||
        recording.metadata.category.toLowerCase().includes(query) ||
        recording.metadata.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    })
  }

  // Apply sorting
  return filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'date-desc':
        return new Date(b.metadata.uploadedAt) - new Date(a.metadata.uploadedAt)
      case 'date-asc':
        return new Date(a.metadata.uploadedAt) - new Date(b.metadata.uploadedAt)
      case 'name-asc':
        return a.displayName.localeCompare(b.displayName)
      case 'name-desc':
        return b.displayName.localeCompare(a.displayName)
      case 'duration':
        return b.estimatedDuration - a.estimatedDuration
      case 'category':
        return a.metadata.category.localeCompare(b.metadata.category)
      default:
        return 0
    }
  })
})

const availableCategories = computed(() => {
  const categories = new Set()
  recordings.value.forEach((recording) => {
    categories.add(recording.metadata.category)
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
    console.log('Fetched audio recordings:', data)
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
    displayName: recording.displayName,
    metadata: {
      category: recording.metadata.category,
      tags: [...recording.metadata.tags],
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
  selectedRecording.value = recording
  // Bootstrap modal show
  const modal = new bootstrap.Modal(document.getElementById('transcriptionModal'))
  modal.show()
}

const copyTranscription = () => {
  if (selectedRecording.value?.transcription.text) {
    navigator.clipboard
      .writeText(selectedRecording.value.transcription.text)
      .then(() => {
        alert('Transcription copied to clipboard!')
      })
      .catch((err) => {
        console.error('Failed to copy text:', err)
        alert('Failed to copy text to clipboard')
      })
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
