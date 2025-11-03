<template>
  <div>
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
            <div v-for="recording in filteredRecordings" :key="recording.recordingId || recording.id" class="col">
              <div
                class="card h-100"
                :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
              >
                <div class="card-body">
                  <!-- Edit Mode -->
                  <div v-if="editingRecordingId === (recording.recordingId || recording.id)" class="edit-form">
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
                          :id="'dropdownMenuButton' + (recording.recordingId || recording.id)"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                        >
                          ⚙️
                        </button>
                        <ul
                          class="dropdown-menu"
                          :aria-labelledby="'dropdownMenuButton' + (recording.recordingId || recording.id)"
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
                          <li v-if="userStore.role === 'Superadmin'">
                            <hr class="dropdown-divider">
                          </li>
                          <li v-if="userStore.role === 'Superadmin'">
                            <a class="dropdown-item" href="#" @click="showRawData(recording)"
                              >🔍 RAW Data</a
                            >
                          </li>
                          <!-- Debug: Show role for all users temporarily -->
                          <li class="dropdown-item disabled">
                            <small class="text-muted">Role: {{ userStore.role }}</small>
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
                          @loadedmetadata="handleAudioMetadata($event, recording)"
                          @loadeddata="console.log('Audio loaded successfully for:', recording.recordingId || recording.id)"
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
                        <small class="d-block">Recording ID: {{ recording.recordingId || recording.id }}</small>
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
                      <div class="mb-2">
                        <small class="text-muted">
                          <strong>Recording ID:</strong> <code>{{ recording.recordingId || recording.id }}</code>
                        </small>
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

                      <!-- Norwegian Transcription Display -->
                      <div v-if="recording.norwegianTranscription" class="norwegian-transcription">
                        <div class="transcription-badges mb-2">
                          <span class="badge bg-danger">🇳🇴 Norwegian</span>
                          <span
                            v-if="recording.norwegianTranscription.improved_text"
                            class="badge bg-success"
                          >
                            ✨ AI Enhanced
                          </span>
                          <span
                            v-if="recording.norwegianTranscription.chunks"
                            class="badge bg-info"
                          >
                            📊 {{ recording.norwegianTranscription.chunks }} chunks
                          </span>
                          <span
                            v-if="recording.conversationAnalysis"
                            class="badge bg-primary"
                          >
                            🤖 AI Analysis
                          </span>
                        </div>

                        <!-- Show improved text if available, otherwise raw text -->
                        <p class="small transcription-text mb-2">
                          {{
                            recording.norwegianTranscription.improved_text?.substring(0, 200) +
                              (recording.norwegianTranscription.improved_text?.length > 200
                                ? '...'
                                : '') ||
                            recording.norwegianTranscription.raw_text?.substring(0, 200) +
                              (recording.norwegianTranscription.raw_text?.length > 200
                                ? '...'
                                : '') ||
                            'No transcription available'
                          }}
                        </p>
                      </div>

                      <!-- Regular Transcription Display -->
                      <div v-else class="regular-transcription">
                        <p class="small text-muted mb-2">
                          {{
                            recording.transcription?.excerpt ||
                            recording.transcriptionText?.substring(0, 200) + '...' ||
                            'No transcription available'
                          }}
                        </p>
                      </div>

                      <button
                        class="btn btn-outline-info btn-sm"
                        @click="showFullTranscription(recording)"
                      >
                        View Full Transcription
                      </button>
                      <button
                        v-if="recording.conversationAnalysis"
                        class="btn btn-outline-primary btn-sm ms-2"
                        @click="viewAnalysis(recording)"
                      >
                        🤖 View Analysis
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
                    <span
                      v-if="selectedRecording?.norwegianTranscription"
                      class="badge bg-danger ms-1"
                    >
                      🇳🇴 Norwegian
                    </span>
                  </div>
                  <button class="btn btn-outline-primary btn-sm" @click="copyTranscription">
                    📋 Copy Text
                  </button>
                </div>

                <!-- Norwegian Transcription Display -->
                <div v-if="selectedRecording?.norwegianTranscription" class="transcription-text">
                  <div v-if="selectedRecording.norwegianTranscription.improved_text" class="mb-4">
                    <h6 class="text-success">✨ AI Enhanced Text:</h6>
                    <div class="enhanced-text p-3 bg-light border-start border-success border-3">
                      <p class="text-break mb-0">
                        {{ selectedRecording.norwegianTranscription.improved_text }}
                      </p>
                    </div>
                  </div>

                  <div class="mb-3">
                    <h6 class="text-muted">🎤 Raw Transcription:</h6>
                    <div class="raw-text p-3 bg-light border-start border-secondary border-3">
                      <p class="text-break mb-0">
                        {{
                          selectedRecording.norwegianTranscription.raw_text ||
                          'No raw text available'
                        }}
                      </p>
                    </div>
                  </div>

                  <!-- Processing Info -->
                  <div
                    v-if="selectedRecording.norwegianTranscription.processing_time"
                    class="processing-info mt-3"
                  >
                    <small class="text-muted">
                      <strong>Processing Time:</strong>
                      {{ selectedRecording.norwegianTranscription.processing_time }}ms
                      <span v-if="selectedRecording.norwegianTranscription.improvement_time">
                        | <strong>Enhancement Time:</strong>
                        {{ selectedRecording.norwegianTranscription.improvement_time }}ms
                      </span>
                      <span v-if="selectedRecording.norwegianTranscription.chunks">
                        | <strong>Chunks:</strong>
                        {{ selectedRecording.norwegianTranscription.chunks }}
                      </span>
                    </small>
                  </div>
                </div>

                <!-- Regular Transcription Display -->
                <div v-else class="transcription-text" style="max-height: 400px; overflow-y: auto">
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

        <!-- RAW Data Modal (Superadmin only) -->
        <div
          class="modal fade"
          id="rawDataModal"
          tabindex="-1"
          aria-labelledby="rawDataModalLabel"
          aria-hidden="true"
        >
          <div class="modal-dialog modal-xl">
            <div
              class="modal-content"
              :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
            >
              <div class="modal-header">
                <h5 class="modal-title" id="rawDataModalLabel">
                  🔍 RAW KV Data: {{ selectedRecording?.displayName }}
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
                    <span class="badge bg-warning text-dark">🔒 Superadmin Only</span>
                    <span class="badge bg-info ms-1">Cloudflare KV Data</span>
                  </div>
                  <button class="btn btn-outline-primary btn-sm" @click="copyRawData">
                    📋 Copy JSON
                  </button>
                </div>

                <div class="raw-data-container">
                  <pre class="raw-data-pre"><code>{{ formatRawData(selectedRecording) }}</code></pre>
                </div>

                <div class="mt-3">
                  <h6 class="text-muted">Quick Info:</h6>
                  <div class="info-grid">
                    <div><strong>Recording ID:</strong> {{ selectedRecording?.recordingId }}</div>
                    <div><strong>User Email:</strong> {{ selectedRecording?.userEmail }}</div>
                    <div><strong>File Size:</strong> {{ formatFileSize(selectedRecording?.fileSize || 0) }}</div>
                    <div><strong>Duration:</strong> {{ selectedRecording?.duration }} seconds</div>
                    <div><strong>Created At:</strong> {{ selectedRecording?.createdAt }}</div>
                    <div><strong>R2 Key:</strong> {{ selectedRecording?.r2Key }}</div>
                  </div>
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
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore'

// Store reference to Bootstrap load promise
let bootstrapLoadPromise = null

// Ensure Bootstrap is available globally
if (typeof window !== 'undefined') {
  if (typeof window.bootstrap === 'undefined') {
    console.log('📦 Loading Bootstrap dynamically...')
    bootstrapLoadPromise = import('bootstrap/dist/js/bootstrap.bundle.min.js')
      .then((module) => {
        // Attach Bootstrap to window if not already there
        if (!window.bootstrap && module.default) {
          window.bootstrap = module.default
        }
        console.log('✅ Bootstrap loaded successfully')
        return window.bootstrap
      })
      .catch((error) => {
        console.error('❌ Failed to import Bootstrap:', error)
        return null
      })
  } else {
    console.log('✅ Bootstrap already available')
    bootstrapLoadPromise = Promise.resolve(window.bootstrap)
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
const router = useRouter()

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
    console.log('Current User Role:', userStore.role)
    console.log('Is Superadmin?:', userStore.role === 'Superadmin')
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
      console.log('  - ID:', recording.recordingId || recording.id)
      console.log('  - Display Name:', recording.displayName || recording.fileName)
      console.log('  - R2 URL:', recording.r2Url)
      console.log('  - Duration:', recording.duration)
      console.log('  - Estimated Duration:', recording.estimatedDuration)
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
    
    // Reinitialize Bootstrap dropdowns after data loads and DOM updates
    nextTick(() => {
      setTimeout(() => {
        console.log('🔄 Reinitializing dropdowns after data load...')
        initializeBootstrapComponents()
      }, 300)
    })
  }
}

const filterRecordings = () => {
  // Filtering is handled by computed property
}

const sortRecordings = () => {
  // Sorting is handled by computed property
}

const startEdit = (recording) => {
  editingRecordingId.value = recording.recordingId || recording.id
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
          recordingId: recording.recordingId || recording.id,
          updates: editingRecording.value,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to update recording: ${response.statusText}`)
    }

    // Update local data
    const recordingIndex = recordings.value.findIndex((r) => (r.recordingId || r.id) === (recording.recordingId || recording.id))
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
          recordingId: recording.recordingId || recording.id,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to delete recording: ${response.statusText}`)
    }

    // Remove from local data
    recordings.value = recordings.value.filter((r) => (r.recordingId || r.id) !== (recording.recordingId || recording.id))
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

const viewAnalysis = (recording) => {
  // Navigate to the conversation analysis page with this recording
  const recordingId = recording.recordingId || recording.id
  
  console.log('=== VIEW ANALYSIS DEBUG ===')
  console.log('Recording object:', recording)
  console.log('Recording ID:', recordingId)
  console.log('Recording has conversationAnalysis:', !!recording.conversationAnalysis)
  console.log('==========================')
  
  if (!recordingId) {
    alert('Error: Recording ID is missing. Cannot navigate to analysis page.')
    return
  }
  
  router.push({
    name: 'conversation-analysis',
    query: { recordingId: recordingId }
  }).catch(err => {
    console.error('Navigation error:', err)
    alert('Failed to navigate to analysis page. Please check console for details.')
  })
}

const showRawData = (recording) => {
  console.log('=== SHOW RAW DATA (Superadmin) ===')
  console.log('Full recording object:', recording)
  
  selectedRecording.value = recording

  try {
    const Bootstrap = window.bootstrap
    if (typeof Bootstrap !== 'undefined' && Bootstrap.Modal) {
      const modalElement = document.getElementById('rawDataModal')
      if (modalElement) {
        const modal = new Bootstrap.Modal(modalElement)
        modal.show()
        console.log('RAW data modal shown')
      } else {
        console.error('RAW data modal element not found')
      }
    } else {
      // Fallback: copy to clipboard and alert
      const rawJson = JSON.stringify(recording, null, 2)
      navigator.clipboard.writeText(rawJson)
        .then(() => alert('RAW data copied to clipboard!\n\n' + rawJson.substring(0, 500) + '...'))
        .catch(() => alert('RAW data:\n\n' + rawJson.substring(0, 500) + '...'))
    }
  } catch (error) {
    console.error('Error showing RAW data modal:', error)
    alert('Error displaying RAW data. Check console for details.')
  }
}

const formatRawData = (recording) => {
  if (!recording) return '{}'
  return JSON.stringify(recording, null, 2)
}

const copyRawData = () => {
  if (!selectedRecording.value) return
  
  const rawJson = JSON.stringify(selectedRecording.value, null, 2)
  navigator.clipboard.writeText(rawJson)
    .then(() => {
      console.log('RAW data copied to clipboard')
      alert('✅ RAW JSON data copied to clipboard!')
    })
    .catch((err) => {
      console.error('Failed to copy RAW data:', err)
      alert('❌ Failed to copy to clipboard')
    })
}

const copyTranscription = () => {
  if (!selectedRecording.value) return

  let textToCopy = ''

  // Handle Norwegian transcription
  if (selectedRecording.value.norwegianTranscription) {
    const improved = selectedRecording.value.norwegianTranscription.improved_text
    const raw = selectedRecording.value.norwegianTranscription.raw_text

    if (improved) {
      textToCopy = `✨ AI Enhanced Text:\n${improved}\n\n🎤 Raw Transcription:\n${raw || 'No raw text available'}`
    } else {
      textToCopy = raw || 'No transcription available'
    }
  } else {
    // Handle regular transcription
    textToCopy =
      selectedRecording.value.transcription?.text ||
      selectedRecording.value.transcriptionText ||
      'No transcription available'
  }

  navigator.clipboard
    .writeText(textToCopy)
    .then(() => {
      // Could add a toast notification here
      console.log('Transcription copied to clipboard')
    })
    .catch((err) => {
      console.error('Failed to copy transcription:', err)
    })
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
  
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
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

const handleAudioMetadata = async (event, recording) => {
  const audioElement = event.target
  const duration = Math.floor(audioElement.duration)
  
  console.log('=== AUDIO METADATA LOADED ===')
  console.log('Recording:', recording.displayName || recording.fileName)
  console.log('Current duration in data:', recording.duration)
  console.log('Actual audio duration:', duration)
  
  // If duration is missing or 0, update it
  if (!recording.duration || recording.duration === 0) {
    console.log('⚠️ Duration missing or 0, updating...')
    
    try {
      const response = await fetch(
        'https://audio-portfolio-worker.torarnehave.workers.dev/update-recording',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userEmail: userStore.email,
            recordingId: recording.recordingId || recording.id,
            updates: {
              duration: duration
            },
          }),
        },
      )

      if (response.ok) {
        console.log('✅ Duration updated successfully to', duration, 'seconds')
        // Update local data
        recording.duration = duration
        
        // Force re-render by updating the recordings array
        const index = recordings.value.findIndex(r => 
          (r.recordingId || r.id) === (recording.recordingId || recording.id)
        )
        if (index !== -1) {
          recordings.value[index].duration = duration
        }
      } else {
        console.error('❌ Failed to update duration:', response.statusText)
      }
    } catch (err) {
      console.error('❌ Error updating duration:', err)
    }
  } else {
    console.log('✓ Duration already set:', recording.duration, 'seconds')
  }
  console.log('============================')
}

const handleAudioError = (event, recording) => {
  console.error('=== AUDIO ERROR DEBUG ===')
  console.error('Audio error event:', event)
  console.error('Error target:', event.target)
  console.error('Error code:', event.target?.error?.code)
  console.error('Error message:', event.target?.error?.message)
  console.error('Recording r2Url:', recording.r2Url)
  console.error('Recording ID:', recording.recordingId || recording.id)

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
onMounted(async () => {
  await fetchRecordings()
  
  // Wait for DOM to be fully rendered, then initialize Bootstrap
  nextTick(() => {
    // Give a short delay to ensure Bootstrap is loaded
    setTimeout(() => {
      initializeBootstrapComponents()
    }, 500)
  })
})

// Initialize Bootstrap dropdowns
const initializeBootstrapComponents = async () => {
  console.log('🔧 Attempting to initialize Bootstrap dropdowns...')
  
  // Wait for Bootstrap to load if it's still loading
  if (bootstrapLoadPromise) {
    console.log('⏳ Waiting for Bootstrap to load...')
    await bootstrapLoadPromise
  }
  
  console.log('Bootstrap available?', typeof window.bootstrap !== 'undefined')
  
  if (typeof window.bootstrap === 'undefined') {
    console.error('❌ Bootstrap is still not available after loading attempt!')
    return
  }
  
  const dropdownElements = document.querySelectorAll('[data-bs-toggle="dropdown"]')
  console.log(`Found ${dropdownElements.length} dropdown elements`)
  
  if (dropdownElements.length === 0) {
    console.warn('⚠️ No dropdown elements found! DOM may not be ready.')
    return
  }
  
  dropdownElements.forEach((element, index) => {
    try {
      // Dispose of any existing dropdown instance first
      const existingInstance = window.bootstrap.Dropdown.getInstance(element)
      if (existingInstance) {
        existingInstance.dispose()
      }
      
      // Create new dropdown instance
      new window.bootstrap.Dropdown(element)
      console.log(`✅ Dropdown ${index + 1} initialized:`, element.id)
    } catch (error) {
      console.error(`❌ Error initializing dropdown ${index + 1}:`, error)
    }
  })
  
  console.log('✨ Bootstrap dropdown initialization complete')
}
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

/* Norwegian Transcription Styles */
.transcription-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.transcription-badges .badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.norwegian-transcription .transcription-text {
  color: #333;
  line-height: 1.5;
}

.enhanced-text {
  background-color: #f8fff8 !important;
  border-radius: 0.375rem;
}

.raw-text {
  background-color: #f8f9fa !important;
  border-radius: 0.375rem;
}

.processing-info {
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 0.375rem;
  border: 1px solid #e9ecef;
}

.transcription-text h6 {
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.border-start {
  border-left-width: 0.25rem !important;
}

.border-3 {
  border-width: 3px !important;
}

.border-success {
  border-color: #198754 !important;
}

.border-secondary {
  border-color: #6c757d !important;
}

/* RAW Data Modal Styles */
.raw-data-container {
  background-color: #1e1e1e;
  border-radius: 0.5rem;
  padding: 1rem;
  max-height: 500px;
  overflow-y: auto;
}

.raw-data-pre {
  margin: 0;
  color: #d4d4d4;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.raw-data-pre code {
  color: #ce9178;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 0.75rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  border: 1px solid #dee2e6;
}

.bg-dark .info-grid {
  background-color: #343a40;
  border-color: #495057;
  color: #ffffff;
}

.info-grid div {
  padding: 0.5rem;
  border-left: 3px solid #007bff;
  padding-left: 0.75rem;
}
</style>

