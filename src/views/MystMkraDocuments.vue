<template>
  <div class="mystmkra-documents-container">
    <div v-if="loading && documents.length === 0" class="text-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3 text-muted">Loading documents...</p>
    </div>

    <div v-else class="container-fluid">
      <div class="row">
        <div class="col-12">
          <div class="portfolio-header">
            <h1 class="text-center mb-4">MystMkra Documents</h1>

            <!-- Search Box and Filters -->
            <div class="mb-4">
              <div class="row g-2" style="max-width: 900px; margin: 0 auto">
                <div class="col-md-6">
                  <div class="search-box position-relative">
                    <input
                      type="text"
                      v-model="searchQuery"
                      class="form-control form-control-lg"
                      placeholder="🔍 Search by title, content, or #tag..."
                      @input="handleSearch"
                    />
                    <span
                      v-if="searchLoading"
                      class="spinner-border spinner-border-sm text-primary position-absolute end-0 top-50 translate-middle-y me-3"
                      role="status"
                    ></span>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="input-group input-group-lg">
                    <span class="input-group-text"><i class="bi bi-person"></i></span>
                    <input
                      v-model="userIdFilter"
                      @input="handleUserIdFilter"
                      type="text"
                      class="form-control"
                      placeholder="Filter by User ID..."
                    />
                    <button
                      v-if="userIdFilter"
                      @click="clearUserIdFilter"
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Clear filter"
                    >
                      <i class="bi bi-x-lg"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- View Controls -->
            <div class="d-flex justify-content-between align-items-center mb-4">
              <div class="text-muted">
                <span v-if="searchQuery">Search results: {{ documents.length }} documents</span>
                <span v-else-if="userIdFilter">
                  Filtered: Showing {{ offset + 1 }}-{{ offset + documents.length }}
                  <span v-if="filteredTotalCount > 0">of {{ filteredTotalCount }}</span>
                  documents for User ID: <code>{{ userIdFilter }}</code>
                </span>
                <span v-else>Showing {{ offset + 1 }}-{{ offset + documents.length }} of {{ totalCount }} documents</span>
              </div>

              <div class="d-flex gap-2 align-items-center">
                <button
                  class="btn btn-outline-warning"
                  @click="analyzeDuplicates"
                  :disabled="analyzingDuplicates"
                >
                  <span v-if="analyzingDuplicates" class="spinner-border spinner-border-sm me-1"></span>
                  <i v-else class="bi bi-layers"></i>
                  Analyze Duplicates
                </button>

                <div class="input-group" style="max-width: 180px;">
                  <span class="input-group-text"><i class="bi bi-card-list"></i></span>
                  <select
                    v-model.number="limit"
                    @change="handleLimitChange"
                    class="form-select"
                  >
                    <option :value="10">10 per page</option>
                    <option :value="20">20 per page</option>
                    <option :value="50">50 per page</option>
                    <option :value="100">100 per page</option>
                    <option :value="200">200 per page</option>
                  </select>
                </div>

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
                </div>
              </div>
            </div>

            <!-- Bulk Actions Toolbar -->
            <div v-if="selectedDocs.size > 0" class="alert alert-info d-flex justify-content-between align-items-center mb-4">
              <div>
                <i class="bi bi-check-square"></i>
                <strong>{{ selectedDocs.size }}</strong> document(s) selected
                <div class="form-check form-check-inline ms-3">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="aiMetadataToggle" 
                    v-model="generateAIMetadata"
                  >
                  <label class="form-check-label small" for="aiMetadataToggle">
                    <i class="bi bi-robot"></i> AI metadata
                  </label>
                </div>
              </div>
              <div class="btn-group">
                <button class="btn btn-sm btn-outline-secondary" @click="selectAll">
                  <i class="bi bi-check-all"></i> Select All
                </button>
                <button class="btn btn-sm btn-outline-secondary" @click="clearSelection">
                  <i class="bi bi-x-circle"></i> Clear Selection
                </button>
                <button 
                  class="btn btn-sm btn-primary" 
                  @click="convertSelectionToGraph"
                  :disabled="selectedDocs.size === 0 || convertingToGraph"
                  title="Convert selected documents to Knowledge Graph"
                >
                  <span v-if="convertingToGraph" class="spinner-border spinner-border-sm me-1"></span>
                  <i v-else class="bi bi-diagram-3"></i>
                  Create Graph
                </button>
                <button class="btn btn-sm btn-danger" @click="confirmBulkDelete">
                  <i class="bi bi-trash"></i> Delete Selected
                </button>
              </div>
            </div>

            <!-- Duplicate Analysis Results -->
            <div v-if="duplicateGroups.length > 0" class="alert alert-warning mb-4">
              <h5 class="alert-heading">
                <i class="bi bi-exclamation-triangle"></i>
                Found {{ duplicateGroups.length }} duplicate groups ({{ totalDuplicates }} total duplicates)
              </h5>
              <div class="duplicate-groups mt-3">
                <div v-for="(group, idx) in duplicateGroups" :key="idx" class="mb-3 p-3 border rounded bg-light">
                  <h6 class="mb-2">
                    <span class="badge bg-danger">{{ group.docs.length }} duplicates</span>
                    {{ group.title || 'Untitled' }}
                  </h6>
                  <div class="small">
                    <div><strong>Similarity:</strong> {{ group.similarity }}</div>
                    <div><strong>IDs:</strong> {{ group.docs.map(d => d.id.substring(0, 8)).join(', ') }}</div>
                    <div><strong>Dates:</strong> {{ group.docs.map(d => formatDate(d.updatedAt)).join(', ') }}</div>
                  </div>
                  <button class="btn btn-sm btn-outline-primary mt-2" @click="viewDuplicateGroup(group)">
                    View Group
                  </button>
                </div>
              </div>
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
            <div v-if="viewMode === 'grid' && documents.length > 0" class="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-4">
              <div v-for="doc in documents" :key="doc.id" class="col">
                <div class="card h-100 document-card" :class="{ 'border-primary border-3': selectedDocs.has(doc.id) }">
                  <div class="position-absolute top-0 start-0 m-2" style="z-index: 10;" @click.stop>
                    <input
                      type="checkbox"
                      class="form-check-input"
                      :checked="selectedDocs.has(doc.id)"
                      @change="toggleSelection(doc.id)"
                      style="width: 1.5rem; height: 1.5rem; cursor: pointer;"
                    />
                  </div>
                  <div @click="viewDocument(doc)" style="cursor: pointer;">
                    <img v-if="doc.firstImage" :src="doc.firstImage" class="card-img-top" alt="Document image" style="height: 200px; object-fit: cover;" />
                  <div class="card-body">
                    <h5 class="card-title">{{ doc.title || 'Untitled' }}</h5>
                    <h6 v-if="doc.firstHeading && doc.firstHeading !== doc.title" class="card-subtitle mb-2 text-muted small">
                      {{ doc.firstHeading }}
                    </h6>
                    <p class="card-text text-muted small">{{ doc.preview || doc.abs || 'No description' }}</p>

                    <div v-if="doc.tags && doc.tags.length > 0" class="mb-2">
                      <span v-for="tag in doc.tags.slice(0, 3)" :key="tag" class="badge bg-secondary me-1">
                        {{ tag }}
                      </span>
                    </div>

                    <div class="document-meta small text-muted">
                      <div v-if="doc.updatedAt">
                        <i class="bi bi-calendar"></i>
                        {{ formatDate(doc.updatedAt) }}
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- List View -->
            <div v-if="viewMode === 'list' && documents.length > 0" class="list-view">
              <div v-for="doc in documents" :key="doc.id" class="card mb-3 document-list-item" :class="{ 'border-primary border-3': selectedDocs.has(doc.id) }">
                <div class="card-body">
                  <div class="row align-items-center">
                    <div class="col-auto" @click.stop>
                      <input
                        type="checkbox"
                        class="form-check-input"
                        :checked="selectedDocs.has(doc.id)"
                        @change="toggleSelection(doc.id)"
                        style="width: 1.5rem; height: 1.5rem; cursor: pointer;"
                      />
                    </div>
                    <div v-if="doc.firstImage" class="col-md-2" @click="viewDocument(doc)" style="cursor: pointer;">
                      <img :src="doc.firstImage" class="img-fluid rounded" alt="Document preview" style="max-height: 100px; object-fit: cover; width: 100%;" />
                    </div>
                    <div :class="doc.firstImage ? 'col-md-7' : 'col-md-8'" @click="viewDocument(doc)" style="cursor: pointer;">
                      <h5 class="mb-2">{{ doc.title || 'Untitled' }}</h5>
                      <h6 v-if="doc.firstHeading && doc.firstHeading !== doc.title" class="text-muted small mb-1">
                        {{ doc.firstHeading }}
                      </h6>
                      <p class="text-muted mb-2 small">{{ doc.preview || doc.abs || 'No description' }}</p>
                      <div v-if="doc.tags && doc.tags.length > 0">
                        <span v-for="tag in doc.tags" :key="tag" class="badge bg-secondary me-1">
                          {{ tag }}
                        </span>
                      </div>
                    </div>
                    <div class="col-md-2 text-end">
                      <div class="small text-muted">
                        {{ formatDate(doc.updatedAt) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div v-if="!loading && !searchQuery && documents.length > 0" class="d-flex justify-content-between align-items-center mt-4">
              <div class="text-muted">
                Page {{ currentPage }} of {{ totalPages }}
              </div>
              <div class="btn-group">
                <button class="btn btn-outline-secondary" :disabled="offset === 0" @click="loadPrevious">
                  <i class="bi bi-chevron-left"></i> Previous
                </button>
                <button class="btn btn-outline-secondary" :disabled="offset + limit >= totalCount" @click="loadNext">
                  Next <i class="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal fade" id="deleteModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title">
              <i class="bi bi-exclamation-triangle"></i>
              Confirm Delete
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p class="mb-0">
              Are you sure you want to permanently delete <strong>{{ selectedDocs.size }}</strong> document(s)?
            </p>
            <p class="text-muted small mt-2 mb-0">
              <i class="bi bi-info-circle"></i> This action cannot be undone.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" @click="bulkDelete" :disabled="deleting">
              <span v-if="deleting" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-trash"></i>
              {{ deleting ? 'Deleting...' : 'Delete Permanently' }}
            </button>
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
            <div v-if="loadingDoc" class="text-center py-5">
              <div class="spinner-border text-primary" role="status"></div>
            </div>
            <div v-else-if="currentDocument">
              <div v-if="currentDocument.tags && currentDocument.tags.length > 0" class="mb-3">
                <span v-for="tag in currentDocument.tags" :key="tag" class="badge bg-secondary me-1">
                  {{ tag }}
                </span>
              </div>

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

              <div v-if="currentDocument.userId" class="mb-3">
                <small class="text-muted">
                  <i class="bi bi-person-badge"></i>
                  User ID: <code class="bg-light px-2 py-1">{{ currentDocument.userId }}</code>
                </small>
              </div>

              <div class="document-content" v-html="renderMarkdown(currentDocument.content)"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Modal } from 'bootstrap'
import { marked } from 'marked'
import { useUserStore } from '@/stores/userStore'

const WORKER_URL = 'https://mystmkra-worker.torarnehave.workers.dev'
const userStore = useUserStore()

// State
const loading = ref(false)
const loadingDoc = ref(false)
const error = ref(null)
const documents = ref([])
const currentDocument = ref(null)
const searchQuery = ref('')
const convertingToGraph = ref(false)
const generateAIMetadata = ref(true)
const searchLoading = ref(false)
const userIdFilter = ref('')
const viewMode = ref('grid')
const limit = ref(20)
const offset = ref(0)
const totalCount = ref(459) // Update after first fetch
const filteredTotalCount = ref(0) // For user_id filtered results
const analyzingDuplicates = ref(false)
const duplicateGroups = ref([])
const allDocuments = ref([]) // For duplicate analysis
const selectedDocs = ref(new Set()) // Selected document IDs
const deleting = ref(false)

// Computed
const currentPage = computed(() => Math.floor(offset.value / limit.value) + 1)
const totalPages = computed(() => Math.ceil(totalCount.value / limit.value))
const totalDuplicates = computed(() => {
  return duplicateGroups.value.reduce((sum, group) => sum + group.docs.length - 1, 0)
})

// Debounce
let searchDebounceId = null

// Selection functions
const toggleSelection = (docId) => {
  if (selectedDocs.value.has(docId)) {
    selectedDocs.value.delete(docId)
  } else {
    selectedDocs.value.add(docId)
  }
  // Trigger reactivity
  selectedDocs.value = new Set(selectedDocs.value)
}

const selectAll = () => {
  documents.value.forEach(doc => selectedDocs.value.add(doc.id))
  selectedDocs.value = new Set(selectedDocs.value)
}

const clearSelection = () => {
  selectedDocs.value.clear()
  selectedDocs.value = new Set(selectedDocs.value)
}

const confirmBulkDelete = () => {
  const modal = new Modal(document.getElementById('deleteModal'))
  modal.show()
}

const bulkDelete = async () => {
  if (selectedDocs.value.size === 0) return

  deleting.value = true

  try {
    const idsToDelete = Array.from(selectedDocs.value)
    const response = await fetch(`${WORKER_URL}/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: idsToDelete })
    })

    if (!response.ok) {
      throw new Error('Failed to delete documents')
    }

    const data = await response.json()

    // Close modal
    const modalEl = document.getElementById('deleteModal')
    const modal = Modal.getInstance(modalEl)
    if (modal) modal.hide()

    // Clear selection
    clearSelection()

    // Refresh total count and documents
    await fetchTotalCount()
    await fetchDocuments(true)

    // Show success message
    alert(`Successfully deleted ${data.deleted} document(s)`)
  } catch (err) {
    console.error('Delete error:', err)
    alert('Failed to delete documents: ' + err.message)
  } finally {
    deleting.value = false
  }
}

// Convert selected documents to Knowledge Graph
const convertSelectionToGraph = async () => {
  if (selectedDocs.value.size === 0) {
    alert('Please select at least one document to convert')
    return
  }

  if (!userStore.email) {
    alert('User email not found. Please log in.')
    return
  }

  const selectedCount = selectedDocs.value.size
  const confirmMessage = selectedCount === 1 
    ? `Convert this document to a Knowledge Graph?${generateAIMetadata.value ? '\n\nAI will generate title, description, and categories.' : ''}`
    : `Convert ${selectedCount} documents to Knowledge Graphs?${generateAIMetadata.value ? '\n\nAI will generate metadata for each graph.' : ''}`

  if (!confirm(confirmMessage)) {
    return
  }

  convertingToGraph.value = true
  const results = { success: [], failed: [] }

  try {
    const idsToConvert = Array.from(selectedDocs.value)

    // Convert documents sequentially to avoid overwhelming the AI API
    for (const docId of idsToConvert) {
      try {
        const response = await fetch(`${WORKER_URL}/convert-to-graph`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            documentId: docId,
            userEmail: userStore.email,
            generateAIMetadata: generateAIMetadata.value
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Conversion failed')
        }

        const data = await response.json()
        results.success.push({
          docId,
          graphId: data.graphId,
          viewUrl: data.viewUrl,
          editUrl: data.editUrl,
          metadata: data.metadata
        })

        console.log(`✓ Converted document ${docId} to graph ${data.graphId}`)
      } catch (err) {
        console.error(`✗ Failed to convert document ${docId}:`, err)
        results.failed.push({ docId, error: err.message })
      }
    }

    // Show results
    const successCount = results.success.length
    const failedCount = results.failed.length

    if (successCount > 0) {
      const firstGraph = results.success[0]
      const message = successCount === 1
        ? `✓ Knowledge Graph created!\n\nTitle: ${firstGraph.metadata.title}\nView: ${firstGraph.viewUrl}\n\nOpen in new tab?`
        : `✓ Created ${successCount} Knowledge Graph(s)!\n${failedCount > 0 ? `✗ ${failedCount} failed\n\n` : '\n'}Open first graph in new tab?`

      if (confirm(message)) {
        window.open(firstGraph.viewUrl, '_blank')
      }

      // Clear selection after successful conversion
      clearSelection()
    } else {
      alert(`✗ All conversions failed:\n\n${results.failed.map(f => `${f.docId}: ${f.error}`).join('\n')}`)
    }
  } catch (err) {
    console.error('Conversion error:', err)
    alert('Failed to convert documents: ' + err.message)
  } finally {
    convertingToGraph.value = false
  }
}

// Fetch documents
const fetchDocuments = async (forceRefresh = false) => {
  if (forceRefresh) {
    offset.value = 0
  }

  loading.value = true
  error.value = null

  try {
    let url = `${WORKER_URL}/files?limit=${limit.value}&offset=${offset.value}`
    const isFiltering = userIdFilter.value.trim()
    if (isFiltering) {
      url += `&user_id=${encodeURIComponent(userIdFilter.value.trim())}`
    }
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error('Failed to fetch documents')
    }

    const data = await response.json()
    documents.value = data.files || []

    // Fetch counts on first page
    if (offset.value === 0) {
      if (isFiltering) {
        fetchFilteredCount(userIdFilter.value.trim())
      } else {
        fetchTotalCount()
      }
    }
  } catch (err) {
    console.error('Fetch error:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// Fetch filtered count
const fetchFilteredCount = async (userId) => {
  try {
    const response = await fetch(`${WORKER_URL}/count?user_id=${encodeURIComponent(userId)}`)
    if (response.ok) {
      const data = await response.json()
      filteredTotalCount.value = data.count || 0
    }
  } catch (err) {
    console.error('Failed to fetch filtered count:', err)
  }
}

// Fetch total count (no filter)
const fetchTotalCount = async () => {
  try {
    const response = await fetch(`${WORKER_URL}/count`)
    if (response.ok) {
      const data = await response.json()
      totalCount.value = data.count || 0
    }
  } catch (err) {
    console.error('Failed to fetch total count:', err)
  }
}

// User ID Filter
const handleUserIdFilter = () => {
  fetchDocuments(true)
}

const clearUserIdFilter = () => {
  userIdFilter.value = ''
  filteredTotalCount.value = 0
  fetchDocuments(true)
}

// Limit Change
const handleLimitChange = () => {
  offset.value = 0
  fetchDocuments(true)
}

// Search
const handleSearch = () => {
  if (searchDebounceId) {
    clearTimeout(searchDebounceId)
  }
  searchDebounceId = setTimeout(runSearch, 350)
}

const runSearch = async () => {
  const query = searchQuery.value.trim()

  if (!query) {
    offset.value = 0
    fetchDocuments()
    return
  }

  if (query.length < 2) {
    return
  }

  searchLoading.value = true
  error.value = null

  try {
    const url = `${WORKER_URL}/search?query=${encodeURIComponent(query)}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error('Search failed')
    }

    const data = await response.json()
    documents.value = data.results || []
  } catch (err) {
    console.error('Search error:', err)
    error.value = err.message
  } finally {
    searchLoading.value = false
  }
}

// View document
const viewDocument = async (doc) => {
  loadingDoc.value = true
  currentDocument.value = null

  try {
    const response = await fetch(`${WORKER_URL}/file/${doc.id}`)
    if (!response.ok) {
      throw new Error('Failed to load document')
    }

    const data = await response.json()
    currentDocument.value = data.file

    const modal = new Modal(document.getElementById('documentModal'))
    modal.show()
  } catch (err) {
    console.error('Error loading document:', err)
    alert('Failed to load document: ' + err.message)
  } finally {
    loadingDoc.value = false
  }
}

// Pagination
const loadNext = () => {
  offset.value += limit.value
  fetchDocuments()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const loadPrevious = () => {
  offset.value = Math.max(0, offset.value - limit.value)
  fetchDocuments()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Duplicate Analysis - Content-based similarity
const analyzeDuplicates = async () => {
  analyzingDuplicates.value = true
  duplicateGroups.value = []

  try {
    // Fetch ALL documents WITH CONTENT for analysis (respecting user_id filter)
    let url = `${WORKER_URL}/files-with-content?limit=1000&offset=0`
    if (userIdFilter.value.trim()) {
      url += `&user_id=${encodeURIComponent(userIdFilter.value.trim())}`
      console.log(`[Duplicate Analysis] Fetching documents for user ${userIdFilter.value.trim()}...`)
    } else {
      console.log('[Duplicate Analysis] Fetching all documents with content...')
    }
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch all documents')

    const data = await response.json()
    allDocuments.value = data.files || []
    console.log(`[Duplicate Analysis] Analyzing ${allDocuments.value.length} documents for content similarity...`)

    // Content similarity detection
    const contentGroups = []
    const processed = new Set()

    allDocuments.value.forEach((doc, i) => {
      if (processed.has(doc.id)) return

      const group = [doc]
      const content1 = doc.content || ''

      // Skip if content is too short
      if (content1.trim().length < 100) {
        return
      }

      // Compare with remaining documents
      allDocuments.value.slice(i + 1).forEach(otherDoc => {
        if (processed.has(otherDoc.id)) return

        const content2 = otherDoc.content || ''
        if (content2.trim().length < 100) return

        // Calculate similarity
        const similarity = calculateContentSimilarity(content1, content2)

        // If 85% or more similar, consider duplicate
        if (similarity >= 0.85) {
          group.push({
            ...otherDoc,
            similarityScore: similarity
          })
          processed.add(otherDoc.id)
        }
      })

      if (group.length > 1) {
        processed.add(doc.id)
        const avgSimilarity = group.reduce((sum, d) => sum + (d.similarityScore || 1), 0) / group.length
        contentGroups.push({
          title: doc.title || 'Untitled',
          similarity: `${Math.round(avgSimilarity * 100)}% similar content`,
          docs: group.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        })
      }
    })

    duplicateGroups.value = contentGroups.sort((a, b) => b.docs.length - a.docs.length)
    console.log(`[Duplicate Analysis] Found ${contentGroups.length} content duplicate groups`)

    if (contentGroups.length === 0) {
      alert('No duplicate content found (85%+ similarity threshold)')
    } else {
      const totalDocs = contentGroups.reduce((sum, g) => sum + g.docs.length, 0)
      alert(`Found ${contentGroups.length} duplicate groups containing ${totalDocs} documents`)
    }
  } catch (err) {
    console.error('Duplicate analysis error:', err)
    error.value = err.message
    alert('Failed to analyze duplicates: ' + err.message)
  } finally {
    analyzingDuplicates.value = false
  }
}

// Calculate content similarity using multiple strategies
const calculateContentSimilarity = (content1, content2) => {
  // Normalize content
  const normalize = (str) => str.toLowerCase().trim().replace(/\s+/g, ' ')
  const c1 = normalize(content1)
  const c2 = normalize(content2)

  // Exact match
  if (c1 === c2) return 1.0

  // Length-based quick filter - if lengths differ significantly, not similar
  const lengthRatio = Math.min(c1.length, c2.length) / Math.max(c1.length, c2.length)
  if (lengthRatio < 0.7) return 0

  // Compare first 3000 characters for efficiency (most duplicates are identical at start)
  const sample1 = c1.substring(0, 3000)
  const sample2 = c2.substring(0, 3000)

  if (sample1 === sample2) return 0.99 // Very high similarity

  // Calculate Jaccard similarity using word sets
  const words1 = new Set(sample1.split(/\s+/).filter(w => w.length > 2))
  const words2 = new Set(sample2.split(/\s+/).filter(w => w.length > 2))

  const intersection = new Set([...words1].filter(w => words2.has(w)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

const viewDuplicateGroup = (group) => {
  // Show all documents in the group
  documents.value = group.docs
  searchQuery.value = '' // Clear search
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Utilities
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
onMounted(() => {
  fetchDocuments()
})
</script>

<style scoped>
.mystmkra-documents-container {
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

.document-list-item {
  transition: box-shadow 0.2s;
  cursor: pointer;
}

.document-list-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.document-meta {
  margin-top: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid #eee;
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
