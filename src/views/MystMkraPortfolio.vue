<template>
  <div class="mystmkra-portfolio-container">
    <div v-if="!ready" class="text-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3 text-muted">Preparing your documents...</p>
    </div>

    <div v-else class="container-fluid">
      <div class="row">
        <!-- Main Content -->
        <div class="col-12">
          <div class="portfolio-header">
            <h1 class="text-center mb-4">MystMkra Document Portfolio</h1>
            
            <!-- Search and Filters -->
            <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
              <div class="search-box flex-grow-1 position-relative" style="max-width: 500px">
                <input
                  type="text"
                  v-model="searchQuery"
                  class="form-control"
                  placeholder="🔍 Search by title, content, or #tag..."
                  @input="handleSearch"
                />
                <span
                  v-if="searchLoading"
                  class="spinner-border spinner-border-sm text-primary position-absolute end-0 top-50 translate-middle-y me-3"
                  role="status"
                ></span>
              </div>

              <!-- Current result IDs -->
              <div v-if="documentIds.length" class="small text-muted" style="max-width: 500px; word-break: break-all;">
                IDs: {{ documentIds.join(', ') }}
              </div>

              <div class="d-flex gap-2 align-items-center">
                <select v-model="sortBy" class="form-select" style="width: auto" @change="sortDocuments">
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="title-asc">Title (A-Z)</option>
                  <option value="title-desc">Title (Z-A)</option>
                </select>

                <div class="btn-group" role="group">
                  <button
                    class="btn btn-outline-primary"
                    :class="{ active: viewMode === 'grid' }"
                    @click="viewMode = 'grid'"
                  >
                    <i class="bi bi-grid-3x3-gap"></i>
                  </button>
                  <button
                    class="btn btn-outline-primary"
                    :class="{ active: viewMode === 'list' }"
                    @click="viewMode = 'list'"
                  >
                    <i class="bi bi-list-ul"></i>
                  </button>
                  <button
                    class="btn btn-outline-primary"
                    :class="{ active: viewMode === 'table' }"
                    @click="viewMode = 'table'"
                  >
                    <i class="bi bi-table"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="text-center my-5">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mt-3 text-muted">Loading documents...</p>
            </div>

            <!-- Error State -->
            <div v-if="error" class="alert alert-danger" role="alert">
              {{ error }}
            </div>

            <!-- Empty State -->
            <div v-if="!loading && documents.length === 0" class="text-center my-5">
              <i class="bi bi-file-earmark-text" style="font-size: 4rem; color: #ccc"></i>
              <p class="text-muted mt-3">No documents found</p>
            </div>

            <!-- Grid View -->
            <div v-if="viewMode === 'grid' && !loading && documents.length > 0" class="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-4">
              <div v-for="doc in documents" :key="doc.id" class="col">
                <div class="card h-100 document-card">
                  <div class="card-body">
                    <h5 class="card-title">{{ doc.title || 'Untitled' }}</h5>
                    <p class="card-text text-muted small">{{ truncateText(doc.abs, 100) }}</p>
                    
                    <!-- Tags -->
                    <div v-if="doc.tags && doc.tags.length > 0" class="mb-2">
                      <span v-for="tag in doc.tags.slice(0, 3)" :key="tag" class="badge bg-secondary me-1">
                        {{ tag }}
                      </span>
                      <span v-if="doc.tags.length > 3" class="badge bg-light text-dark">
                        +{{ doc.tags.length - 3 }}
                      </span>
                    </div>

                    <!-- Metadata -->
                    <div class="document-meta small text-muted">
                      <div v-if="doc.id" class="mb-1">
                        <i class="bi bi-fingerprint"></i>
                        <span class="font-monospace" style="font-size: 0.75rem">{{ doc.id }}</span>
                      </div>
                      <div v-if="doc.createdAt">
                        <i class="bi bi-calendar"></i>
                        {{ formatDate(doc.createdAt) }}
                      </div>
                      <div v-if="doc.published !== undefined">
                        <i class="bi bi-eye" :class="doc.published ? 'text-success' : 'text-muted'"></i>
                        {{ doc.published ? 'Published' : 'Draft' }}
                      </div>
                    </div>
                  </div>
                  <div class="card-footer bg-transparent">
                    <div class="d-flex gap-2">
                      <button 
                        class="btn btn-primary btn-sm flex-grow-1" 
                        @click="viewDocument(doc)"
                        :disabled="loadingDocId === doc.id"
                      >
                        <span v-if="loadingDocId === doc.id" class="spinner-border spinner-border-sm me-1" role="status"></span>
                        <i v-else class="bi bi-eye"></i> 
                        {{ loadingDocId === doc.id ? 'Loading...' : 'View' }}
                      </button>
                      <button class="btn btn-outline-secondary btn-sm" @click="shareDocument(doc)" title="Share">
                        <i class="bi bi-share"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- List View -->
            <div v-if="viewMode === 'list' && !loading && documents.length > 0" class="list-view">
              <div v-for="doc in documents" :key="doc.id" class="card mb-3 document-list-item">
                <div class="card-body">
                  <div class="row align-items-center">
                    <div class="col-md-8">
                      <h5 class="mb-2">{{ doc.title || 'Untitled' }}</h5>
                      <p class="text-muted mb-2">{{ truncateText(doc.abs, 200) }}</p>
                      <div v-if="doc.tags && doc.tags.length > 0">
                        <span v-for="tag in doc.tags" :key="tag" class="badge bg-secondary me-1">
                          {{ tag }}
                        </span>
                      </div>
                    </div>
                    <div class="col-md-4 text-end">
                      <div class="small text-muted mb-2">
                        <div v-if="doc.createdAt">{{ formatDate(doc.createdAt) }}</div>
                        <div v-if="doc.published !== undefined">
                          <span :class="doc.published ? 'text-success' : 'text-muted'">
                            {{ doc.published ? '✓ Published' : '○ Draft' }}
                          </span>
                        </div>
                      </div>
                      <div class="d-flex gap-2 justify-content-end">
                        <button 
                          class="btn btn-primary btn-sm" 
                          @click="viewDocument(doc)"
                          :disabled="loadingDocId === doc.id"
                        >
                          <span v-if="loadingDocId === doc.id" class="spinner-border spinner-border-sm me-1" role="status"></span>
                          <i v-else class="bi bi-eye"></i> 
                          {{ loadingDocId === doc.id ? 'Loading...' : 'View' }}
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" @click="shareDocument(doc)">
                          <i class="bi bi-share"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Table View -->
            <div v-if="viewMode === 'table' && !loading && documents.length > 0" class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Tags</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="doc in documents" :key="doc.id">
                    <td>
                      <strong>{{ doc.title || 'Untitled' }}</strong>
                      <br>
                      <small class="text-muted">{{ truncateText(doc.abs, 80) }}</small>
                    </td>
                    <td>
                      <span v-for="tag in doc.tags?.slice(0, 2)" :key="tag" class="badge bg-secondary me-1">
                        {{ tag }}
                      </span>
                      <span v-if="doc.tags && doc.tags.length > 2" class="badge bg-light text-dark">
                        +{{ doc.tags.length - 2 }}
                      </span>
                    </td>
                    <td class="small">{{ formatDate(doc.createdAt) }}</td>
                    <td>
                      <span :class="doc.published ? 'badge bg-success' : 'badge bg-secondary'">
                        {{ doc.published ? 'Published' : 'Draft' }}
                      </span>
                    </td>
                    <td class="text-end">
                      <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" @click="viewDocument(doc)">
                          <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-secondary" @click="shareDocument(doc)">
                          <i class="bi bi-share"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="!loading && documents.length > 0" class="d-flex justify-content-between align-items-center mt-4">
              <div class="text-muted">
                Showing {{ offset + 1 }}-{{ offset + documents.length }} documents
                <span v-if="offset > 0 || documents.length >= limit">(page {{ Math.floor(offset / limit) + 1 }})</span>
              </div>
              <div class="btn-group">
                <button class="btn btn-outline-secondary" :disabled="offset === 0" @click="loadPrevious">
                  <i class="bi bi-chevron-left"></i> Previous
                </button>
                <button class="btn btn-outline-secondary" :disabled="documents.length < limit" @click="loadNext">
                  Next <i class="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Document Viewer Modal -->
    <div class="modal fade" id="documentModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ currentDocument?.title || 'Document' }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div v-if="currentDocument">
              <!-- Tags -->
              <div v-if="currentDocument.tags && currentDocument.tags.length > 0" class="mb-3">
                <span v-for="tag in currentDocument.tags" :key="tag" class="badge bg-secondary me-1">
                  {{ tag }}
                </span>
              </div>

              <!-- Metadata -->
              <div class="row mb-3">
                <div class="col-md-6">
                  <small class="text-muted">
                    <i class="bi bi-calendar"></i>
                    Created: {{ formatDate(currentDocument.createdAt) }}
                  </small>
                </div>
                <div class="col-md-6 text-end">
                  <small class="text-muted">
                    <i class="bi bi-clock"></i>
                    Updated: {{ formatDate(currentDocument.updatedAt) }}
                  </small>
                </div>
              </div>

              <!-- Content -->
              <div class="document-content" v-html="renderMarkdown(currentDocument.content)"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" @click="shareDocument(currentDocument)">
              <i class="bi bi-share"></i> Share
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/userStore'
import { useMystMkraStore } from '@/stores/mystMkraStore'
import { Modal } from 'bootstrap'
import { marked } from 'marked'

const userStore = useUserStore()

// State
const loading = ref(false)
const error = ref(null)
const searchQuery = ref('')
const searchLoading = ref(false)
const sortBy = ref('date-desc')
const viewMode = ref('grid')
const limit = ref(20)
const offset = ref(0)
const loadingDocId = ref(null)

const WORKER_URL = 'https://mystmkra-worker.torarnehave.workers.dev'

const mystStore = useMystMkraStore()
const { documents, currentDocument, ready } = storeToRefs(mystStore)

// Derived: list of ids for current document set (useful for search results)
const documentIds = computed(() => documents.value.map(d => d.id || d._id).filter(Boolean))

// Debounce state for search input
let searchDebounceId = null
let searchAbortController = null

// Fetch documents from mystmkra worker
const fetchDocuments = async (forceRefresh = false) => {
  loading.value = true
  error.value = null

  try {
    // Initialize store if needed (only on first load)
    if (!ready.value) {
      await mystStore.initialize()
      loading.value = false
      return
    }

    // Always fetch when explicitly requested OR when offset > 0
    if (forceRefresh || offset.value > 0) {
      const url = `${WORKER_URL}/files?limit=${limit.value}&offset=${offset.value}`
      const response = await fetch(url, {
        headers: {
          'x-user-email': userStore.email || 'guest@example.com'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch documents')
      }

      const data = await response.json()
      const mapped = (data.files || []).map(f => ({ id: f.id || f._id, _id: f._id || f.id, ...f }))
      mystStore.documents.value = mapped
      console.log(`[Pagination] Loaded ${mapped.length} docs (offset: ${offset.value}, limit: ${limit.value})`)
    }
  } catch (err) {
    console.error('Error fetching documents:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// Small helper to retry with exponential backoff and timeout
const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let timeoutId
    try {
      // Longer timeout on first attempt for cold starts
      const timeout = attempt === 1 ? 20000 : 15000
      const controller = new AbortController()
      timeoutId = setTimeout(() => controller.abort(), timeout)
      
      // Merge abort signals if one exists
      const signal = options.signal 
        ? (() => {
            const parentSignal = options.signal
            if (parentSignal.aborted) throw new DOMException('Aborted', 'AbortError')
            
            const listener = () => controller.abort()
            parentSignal.addEventListener('abort', listener)
            
            return controller.signal
          })()
        : controller.signal

      console.log(`[fetchWithRetry] Attempt ${attempt}/${maxRetries}: ${url}`)
      
      const response = await fetch(url, { ...options, signal })
      clearTimeout(timeoutId)
      
      if (response.ok) {
        console.log(`[fetchWithRetry] Success on attempt ${attempt}`)
        return response
      }
      
      // Don't retry on 4xx errors
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      throw new Error(`HTTP ${response.status}`)
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId)
      
      // Don't retry if parent aborted
      if (options.signal?.aborted || err.name === 'AbortError') {
        throw err
      }
      
      console.warn(`[fetchWithRetry] Attempt ${attempt} failed:`, err.message)
      
      if (attempt === maxRetries) {
        throw err
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      console.log(`[fetchWithRetry] Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// Search documents with debounce and cancellation
const handleSearch = () => {
  if (searchDebounceId) {
    clearTimeout(searchDebounceId)
  }

  // Short debounce so we do not hit the worker on every keystroke
  searchDebounceId = setTimeout(runSearch, 350)
}

const runSearch = async () => {
  if (!ready.value) {
    await mystStore.initialize()
  }
  const query = searchQuery.value.trim()

  // Empty query falls back to regular list
  if (!query) {
    searchLoading.value = false
    loading.value = false
    fetchDocuments()
    return
  }

  // Avoid spamming the worker for 1-char queries
  if (query.length < 2) {
    searchLoading.value = false
    loading.value = false
    return
  }

  // Cancel any in-flight search
  if (searchAbortController) {
    searchAbortController.abort()
  }
  const controller = new AbortController()
  searchAbortController = controller

  loading.value = true
  searchLoading.value = true
  error.value = null

  try {
    const url = `${WORKER_URL}/search?query=${encodeURIComponent(query)}`
    const response = await fetchWithRetry(url, {
      headers: {
        'x-user-email': userStore.email || 'guest@example.com'
      },
      signal: controller.signal
    }, 3) // 3 retries with exponential backoff

    if (!response.ok) {
      throw new Error(`Search failed: HTTP ${response.status}`)
    }

    const data = await response.json()
    // Only apply results if this is still the latest request
    if (searchAbortController === controller) {
      const mapped = (data.results || []).map(f => ({ id: f.id || f._id, _id: f._id || f.id, ...f }))
      mystStore.documents.value = mapped
      console.log(`[Search] Found ${mapped.length} results for "${query}"`)
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return
    }
    console.error('Search error:', err)
    error.value = err.message
  } finally {
    if (searchAbortController === controller) {
      loading.value = false
      searchLoading.value = false
    }
  }
}

// Sort documents
const sortDocuments = () => {
  const docs = [...documents.value]
  
  switch (sortBy.value) {
    case 'date-desc':
      docs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      break
    case 'date-asc':
      docs.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))
      break
    case 'title-asc':
      docs.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      break
    case 'title-desc':
      docs.sort((a, b) => (b.title || '').localeCompare(a.title || ''))
      break
  }
  
  documents.value = docs
}

// View document
const viewDocument = async (doc) => {
  const docId = doc?._id || doc?.id
  if (!docId) {
    console.warn('[viewDocument] Missing document id', doc)
    return
  }

  loadingDocId.value = docId
  try {
    const fetched = await mystStore.fetchDocument(docId)
    if (!fetched) {
      throw new Error('Failed to fetch document content')
    }

    const modal = new Modal(document.getElementById('documentModal'))
    modal.show()
  } catch (err) {
    console.error('Error fetching document:', err)
    alert('Failed to load document: ' + err.message)
  } finally {
    loadingDocId.value = null
  }
}

// Share document
const shareDocument = (doc) => {
  const shareUrl = `${window.location.origin}/mystmkra/${doc.id}`
  const shareText = `${doc.title}\n\n${doc.abs}`

  if (navigator.share) {
    navigator.share({
      title: doc.title,
      text: shareText,
      url: shareUrl
    }).catch(err => console.log('Share failed:', err))
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(`${doc.title}\n${shareUrl}`).then(() => {
      alert('Link copied to clipboard!')
    })
  }
}

// Pagination
const loadNext = () => {
  offset.value += limit.value
  fetchDocuments(true) // Force refresh for pagination
}

const loadPrevious = () => {
  offset.value = Math.max(0, offset.value - limit.value)
  fetchDocuments(true) // Force refresh for pagination
}

// Utility functions
const truncateText = (text, maxLength = 100) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const renderMarkdown = (content) => {
  if (!content) return ''
  return marked(content)
}

// Lifecycle
onMounted(async () => {
  await mystStore.initialize()
})
</script>

<style scoped>
.mystmkra-portfolio-container {
  padding: 2rem 0;
  min-height: 100vh;
}

.portfolio-header {
  margin-bottom: 2rem;
}

.document-card {
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.document-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.document-meta {
  margin-top: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid #eee;
}

.document-list-item {
  transition: box-shadow 0.2s;
}

.document-list-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.document-content {
  line-height: 1.8;
}

.document-content :deep(h1),
.document-content :deep(h2),
.document-content :deep(h3) {
  margin-top: 1.5rem;
  margin-bottom: 1rem;
}

.document-content :deep(p) {
  margin-bottom: 1rem;
}

.document-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1rem 0;
}

.document-content :deep(code) {
  background: #f5f5f5;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.9em;
}

.document-content :deep(pre) {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
}

.search-box input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
}

.btn-group .btn.active {
  background-color: #667eea;
  border-color: #667eea;
  color: white;
}
</style>
