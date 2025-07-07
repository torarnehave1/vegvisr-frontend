<template>
  <div class="search-view">
    <div class="container-fluid">
      <!-- Search Header -->
      <div class="row mb-4">
        <div class="col-12">
          <div class="search-header">
            <h2 class="mb-3">Knowledge Graph Discovery</h2>

            <!-- Main Search Input -->
            <div class="search-input-container mb-3">
              <div class="input-group input-group-lg">
                <input
                  type="text"
                  class="form-control"
                  v-model="searchQuery"
                  placeholder="Search across all knowledge graphs..."
                  @keyup.enter="performSearch"
                  @input="onSearchInput"
                />
                <button class="btn btn-primary" @click="performSearch" :disabled="isSearching">
                  <i class="bi bi-search" v-if="!isSearching"></i>
                  <i class="bi bi-hourglass-split" v-else></i>
                  Search
                </button>
              </div>
            </div>

            <!-- Search Options -->
            <div class="search-options d-flex flex-wrap gap-3 mb-3">
              <div class="search-type-selector">
                <label class="form-label">Search Type:</label>
                <select v-model="searchType" class="form-select" @change="onSearchTypeChange">
                  <option value="hybrid">🔀 Hybrid (Vector + Keyword)</option>
                  <option value="vector">🧠 Vector Search (Semantic)</option>
                  <option value="keyword">🔍 Keyword Search</option>
                </select>
              </div>

              <div class="result-limit">
                <label class="form-label">Results:</label>
                <select v-model="resultLimit" class="form-select">
                  <option value="5">5 results</option>
                  <option value="10">10 results</option>
                  <option value="20">20 results</option>
                  <option value="50">50 results</option>
                </select>
              </div>
            </div>

            <!-- Search Stats -->
            <div v-if="searchResults" class="search-stats mb-3">
              <small class="text-muted">
                Found {{ searchResults.totalResults }} results in {{ searchResults.responseTime }}ms
                <span v-if="searchResults.searchType === 'hybrid'">
                  • Using {{ searchResults.searchType }} search
                </span>
                <span v-if="searchResults.suggestions?.length">
                  • {{ searchResults.suggestions.join(', ') }}
                </span>
              </small>
            </div>
          </div>
        </div>
      </div>

      <!-- Search Results -->
      <div class="row">
        <div class="col-12">
          <!-- Loading State -->
          <div v-if="isSearching" class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Searching...</span>
            </div>
            <p class="mt-3">Searching knowledge graphs...</p>
          </div>

          <!-- No Results -->
          <div
            v-else-if="searchResults && searchResults.results.length === 0"
            class="text-center py-5"
          >
            <i class="bi bi-search display-1 text-muted"></i>
            <h4 class="mt-3">No results found</h4>
            <p class="text-muted">Try different keywords or search terms</p>

            <!-- Debug Information -->
            <div v-if="searchResults.error" class="alert alert-warning mt-4 text-start">
              <h6><i class="bi bi-exclamation-triangle"></i> Error Details:</h6>
              <p><strong>Error:</strong> {{ searchResults.error }}</p>
              <details class="mt-2">
                <summary>Debug Information</summary>
                <pre class="mt-2 text-start small">{{
                  JSON.stringify(searchResults.debugInfo, null, 2)
                }}</pre>
              </details>
            </div>

            <!-- Helpful suggestions -->
            <div class="alert alert-info mt-4 text-start">
              <h6><i class="bi bi-info-circle"></i> Troubleshooting Tips:</h6>
              <ul class="mb-0 text-start">
                <li>
                  <strong>Vector Search:</strong> Only {{ vectorizedGraphCount || '7' }}/90 graphs
                  are currently vectorized
                </li>
                <li>
                  <strong>Try different search types:</strong> Switch to "Keyword Search" to search
                  all graphs
                </li>
                <li>
                  <strong>Broader terms:</strong> Try "mythology" instead of "Norse mythology"
                </li>
                <li>
                  <strong>Check portfolio:</strong> Go to Portfolio and use "Vectorize" buttons on
                  relevant graphs
                </li>
              </ul>
            </div>
          </div>

          <!-- Search Results -->
          <div v-else-if="searchResults" class="search-results">
            <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
              <div v-for="result in searchResults.results" :key="result.graphId" class="col">
                <div class="card h-100 search-result-card">
                  <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                      <h5 class="card-title">{{ getGraphTitle(result) }}</h5>
                      <div class="search-badges">
                        <span class="badge bg-secondary">{{ result.matchType }}</span>
                        <span class="badge bg-success"
                          >{{ Math.round(result.relevanceScore * 100) }}%</span
                        >
                      </div>
                    </div>

                    <p class="card-text text-muted">{{ getGraphDescription(result) }}</p>

                    <!-- Matched Content -->
                    <div v-if="result.matchedContent?.length" class="matched-content mb-3">
                      <h6 class="small text-muted mb-2">Matched Content:</h6>
                      <div class="matched-snippets">
                        <div
                          v-for="match in result.matchedContent.slice(0, 3)"
                          :key="match.nodeId"
                          class="snippet mb-2"
                        >
                          <small class="text-primary">{{ match.contentType }}: </small>
                          <small class="text-dark">{{ truncateText(match.snippet, 100) }}</small>
                          <span class="badge badge-sm bg-light text-dark ms-1">
                            {{ Math.round(match.score * 100) }}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="action-buttons">
                      <button
                        class="btn btn-primary btn-sm me-2"
                        @click="viewGraph(result.graphId)"
                      >
                        <i class="bi bi-eye"></i> View
                      </button>
                      <button
                        class="btn btn-outline-secondary btn-sm"
                        @click="editGraph(result.graphId)"
                      >
                        <i class="bi bi-pencil"></i> Edit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Initial State -->
          <div v-else class="text-center py-5">
            <i class="bi bi-search display-1 text-muted"></i>
            <h4 class="mt-3">Search Your Knowledge Graphs</h4>
            <p class="text-muted">
              Use semantic search to discover content across your entire knowledge base
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// Reactive data
const searchQuery = ref('')
const searchType = ref('hybrid')
const resultLimit = ref(10)
const isSearching = ref(false)
const searchResults = ref(null)
const searchHistory = ref([])
const vectorizedGraphCount = ref(7) // Track vectorized graphs

// Initialize with route query
onMounted(() => {
  if (route.query.q) {
    searchQuery.value = route.query.q
    performSearch()
  }
})

// Watch for route changes (back/forward navigation)
watch(
  () => route.query.q,
  (newQuery) => {
    if (newQuery && newQuery !== searchQuery.value) {
      searchQuery.value = newQuery
      performSearch()
    }
  },
)

// Search functionality
const performSearch = async () => {
  if (!searchQuery.value.trim()) return

  isSearching.value = true
  console.log('[Search] Starting search:', {
    query: searchQuery.value,
    searchType: searchType.value,
    limit: resultLimit.value,
    userEmail: userStore.email,
  })

  try {
    // Update URL
    router.push({
      name: 'search',
      query: { q: searchQuery.value, type: searchType.value, limit: resultLimit.value },
    })

    // Call vector search API
    const apiUrl = 'https://vector-search-worker.torarnehave.workers.dev/search'
    const requestBody = {
      query: searchQuery.value,
      searchType: searchType.value,
      limit: parseInt(resultLimit.value),
    }

    console.log('[Search] API Request:', {
      url: apiUrl,
      body: requestBody,
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': userStore.email || 'guest',
      },
    })

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': userStore.email || 'guest',
      },
      body: JSON.stringify(requestBody),
    })

    console.log('[Search] API Response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Search] API Error Response:', errorText)
      throw new Error(`Search API failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('[Search] API Success Response:', data)

    searchResults.value = data

    // Add to search history
    addToSearchHistory(searchQuery.value, data.totalResults)
  } catch (error) {
    console.error('[Search] Search error:', error)
    searchResults.value = {
      results: [],
      totalResults: 0,
      responseTime: 0,
      error: error.message,
      debugInfo: {
        query: searchQuery.value,
        searchType: searchType.value,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        apiUrl: 'https://vector-search-worker.torarnehave.workers.dev/search',
      },
    }
  } finally {
    isSearching.value = false
  }
}

const onSearchInput = () => {
  // Could add debounced search here for real-time results
}

const onSearchTypeChange = () => {
  if (searchQuery.value.trim()) {
    performSearch()
  }
}

const addToSearchHistory = (query, resultCount) => {
  const historyItem = {
    query,
    resultCount,
    timestamp: new Date().toISOString(),
    searchType: searchType.value,
  }

  searchHistory.value.unshift(historyItem)

  // Keep only last 10 searches
  if (searchHistory.value.length > 10) {
    searchHistory.value.pop()
  }
}

// Helper functions
const getGraphTitle = (result) => {
  if (result.graph?.metadata?.title) {
    return result.graph.metadata.title
  }
  return `Graph ${result.graphId}`
}

const getGraphDescription = (result) => {
  if (result.graph?.metadata?.description) {
    return result.graph.metadata.description
  }
  return 'Knowledge graph with semantic content'
}

const truncateText = (text, maxLength) => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

const viewGraph = (graphId) => {
  router.push({ name: 'GraphViewer', query: { graphId } })
}

const editGraph = (graphId) => {
  router.push({ name: 'GraphAdmin', query: { graphId } })
}
</script>

<style scoped>
.search-view {
  min-height: 100vh;
  padding: 2rem 0;
}

.search-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  border-radius: 15px;
  margin-bottom: 2rem;
}

.search-input-container .form-control {
  border: none;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.search-options {
  background: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 10px;
}

.search-options .form-label {
  color: white;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.search-options .form-select {
  border: none;
  background: rgba(255, 255, 255, 0.9);
}

.search-stats {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.75rem;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
}

.search-result-card {
  border: none;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.search-result-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.15);
}

.search-badges {
  display: flex;
  gap: 0.5rem;
}

.matched-content {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  border-left: 4px solid #007bff;
}

.snippet {
  background: white;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.badge-sm {
  font-size: 0.7rem;
}

@media (max-width: 768px) {
  .search-options {
    flex-direction: column;
    gap: 1rem !important;
  }

  .search-badges {
    flex-direction: column;
    align-items: flex-end;
  }
}
</style>
