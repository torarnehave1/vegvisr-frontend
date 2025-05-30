<template>
  <div
    class="portfolio-page"
    :class="{ 'bg-dark': props.theme === 'dark', 'text-white': props.theme === 'dark' }"
  >
    <div class="container-fluid">
      <!-- Header -->
      <div class="row mb-4">
        <div class="col-12">
          <h1 class="text-center">Knowledge Graph Portfolio</h1>
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="search-box">
              <input
                type="text"
                v-model="portfolioStore.searchQuery"
                class="form-control"
                placeholder="Search graphs..."
                @input="filterGraphs"
              />
            </div>
            <div class="view-options">
              <select v-model="portfolioStore.sortBy" class="form-select" @change="sortGraphs">
                <option value="title">Sort by Title</option>
                <option value="date">Sort by Date</option>
                <option value="nodes">Sort by Node Count</option>
                <option value="category">Sort by Category</option>
              </select>
            </div>
          </div>
          <!-- View Mode Toggle -->
          <div class="view-toggle mb-3">
            <button
              class="btn btn-outline-primary me-2"
              :class="{ active: portfolioStore.viewMode === 'detailed' }"
              @click="portfolioStore.viewMode = 'detailed'"
            >
              Detailed View
            </button>
            <button
              class="btn btn-outline-secondary me-2"
              :class="{ active: portfolioStore.viewMode === 'simple' }"
              @click="portfolioStore.viewMode = 'simple'"
            >
              Simple View
            </button>
            <button
              class="btn btn-outline-success"
              :class="{ active: portfolioStore.viewMode === 'table' }"
              @click="portfolioStore.viewMode = 'table'"
            >
              Table View
            </button>
          </div>
          <button
            v-if="isViewOnly"
            class="btn btn-success mb-3"
            @click="goToMyPlayground"
            :disabled="!playgroundReady"
          >
            Go to My Playground
          </button>
          <div v-if="isViewOnly && !playgroundReady" class="text-center text-muted mb-2">
            Setting up your playground...
          </div>
        </div>
      </div>

      <!-- Simple View (GraphGallery) -->
      <GraphGallery
        v-if="portfolioStore.viewMode === 'simple'"
        :graphs="galleryGraphs"
        :isViewOnly="isViewOnly"
        @view-graph="handleGalleryViewGraph"
        @edit-graph="editGraph"
      />

      <!-- Table View -->
      <GraphTable
        v-if="portfolioStore.viewMode === 'table'"
        :graphs="filteredGraphs"
        :isViewOnly="isViewOnly"
        @view-graph="viewGraph"
        @edit-graph="editGraph"
      />

      <!-- Detailed View (original card/list) -->
      <div v-if="portfolioStore.viewMode === 'detailed'">
        <!-- Portfolio Grid -->
        <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-4">
          <div v-for="graph in filteredGraphs" :key="graph.id" class="col">
            <div
              class="card h-100"
              :class="{ 'bg-dark': props.theme === 'dark', 'text-white': props.theme === 'dark' }"
              :data-graph-id="graph.id"
            >
              <div class="card-body">
                <!-- Edit Mode -->
                <div v-if="editingGraphId === graph.id" class="edit-form">
                  <div class="mb-3">
                    <label class="form-label">Title</label>
                    <div class="input-group">
                      <input
                        type="text"
                        class="form-control"
                        v-model="editingGraph.metadata.title"
                        placeholder="Enter title"
                      />
                      <button
                        class="btn btn-outline-primary"
                        @click="suggestTitle(graph)"
                        :disabled="isLoadingTitle"
                        title="Get AI title suggestion"
                      >
                        <i
                          class="bi"
                          :class="isLoadingTitle ? 'bi-hourglass-split' : 'bi-magic'"
                        ></i>
                      </button>
                    </div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label"
                      >Categories (use # to separate multiple categories)</label
                    >
                    <div class="input-group">
                      <input
                        type="text"
                        class="form-control"
                        v-model="editingGraph.metadata.category"
                        placeholder="e.g., #Research #Project #Analysis"
                      />
                      <button
                        class="btn btn-outline-primary"
                        @click="suggestCategories(graph)"
                        :disabled="isLoadingCategories"
                        title="Get AI category suggestions"
                      >
                        <i
                          class="bi"
                          :class="isLoadingCategories ? 'bi-hourglass-split' : 'bi-magic'"
                        ></i>
                      </button>
                    </div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Description</label>
                    <div class="input-group">
                      <textarea
                        class="form-control"
                        v-model="editingGraph.metadata.description"
                        rows="3"
                        placeholder="Enter description"
                      ></textarea>
                      <button
                        class="btn btn-outline-primary"
                        @click="suggestDescription(graph)"
                        :disabled="isLoadingDescription"
                        title="Get AI description suggestion"
                      >
                        <i
                          class="bi"
                          :class="isLoadingDescription ? 'bi-hourglass-split' : 'bi-magic'"
                        ></i>
                      </button>
                    </div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Created By</label>
                    <input
                      type="text"
                      class="form-control"
                      v-model="editingGraph.metadata.createdBy"
                      placeholder="Enter creator name"
                    />
                  </div>
                  <div class="d-flex justify-content-end gap-2">
                    <button class="btn btn-secondary btn-sm" @click="cancelEdit">Cancel</button>
                    <button class="btn btn-primary btn-sm" @click="saveEdit(graph)">Save</button>
                  </div>
                </div>

                <!-- View Mode -->
                <template v-else>
                  <div class="d-flex justify-content-between align-items-start">
                    <h5 class="card-title mb-0">{{ graph.metadata?.title || 'Untitled Graph' }}</h5>
                    <button
                      class="btn btn-outline-primary btn-sm share-btn"
                      @click="openShareModal(graph)"
                      title="Share Graph"
                    >
                      <i class="bi bi-share"></i> Share
                    </button>
                  </div>
                  <!-- Add portfolio image display -->
                  <div
                    v-if="getPortfolioImage(graph.nodes)"
                    class="portfolio-image-container mt-2 mb-2"
                  >
                    <img
                      :src="getPortfolioImage(graph.nodes).path"
                      :alt="getPortfolioImage(graph.nodes).label"
                      class="portfolio-image"
                      @error="console.error('Image failed to load:', $event)"
                    />
                  </div>
                  <p class="card-text text-muted" v-if="graph.metadata?.description">
                    {{ truncateText(graph.metadata.description) }}
                  </p>
                  <div class="graph-meta">
                    <span class="badge bg-primary">
                      {{ Array.isArray(graph.nodes) ? graph.nodes.length : 0 }} Nodes
                      <small v-if="Array.isArray(graph.nodes) && graph.nodes.length > 0"
                        >({{ getNodeTypes(graph.nodes) }})</small
                      >
                    </span>
                    <span class="badge bg-secondary ms-2">
                      {{ Array.isArray(graph.edges) ? graph.edges.length : 0 }} Edges
                    </span>
                    <span class="badge bg-info ms-2" v-if="graph.metadata?.version">
                      v{{ graph.metadata.version }}
                    </span>
                    <template v-if="graph.metadata?.category">
                      <span
                        v-for="(cat, index) in getCategories(graph.metadata.category)"
                        :key="index"
                        class="badge bg-success ms-2"
                      >
                        {{ cat }}
                      </span>
                    </template>
                  </div>
                  <div class="graph-info mt-3">
                    <small class="text-muted">
                      Created by: {{ graph.metadata?.createdBy || 'Unknown' }}
                    </small>
                    <br />
                    <small class="text-muted">
                      Last updated: {{ formatDate(graph.metadata?.updatedAt) }}
                    </small>
                    <br />
                    <small class="text-muted"> ID: {{ graph.id }} </small>
                  </div>
                </template>
              </div>
              <div class="card-footer">
                <div class="d-flex justify-content-between">
                  <button class="btn btn-primary btn-sm" @click="viewGraph(graph)">
                    View Graph
                  </button>
                  <div class="btn-group">
                    <button
                      v-if="editingGraphId !== graph.id && canEditGraph(graph.id)"
                      class="btn btn-outline-secondary btn-sm"
                      @click="startEdit(graph)"
                    >
                      Edit Info
                    </button>
                    <button
                      v-if="editingGraphId !== graph.id && canEditGraph(graph.id)"
                      class="btn btn-outline-secondary btn-sm"
                      @click="editGraph(graph)"
                    >
                      Edit Graph
                    </button>
                    <button
                      v-if="editingGraphId !== graph.id && canEditGraph(graph.id)"
                      class="btn btn-danger btn-sm"
                      @click="confirmDelete(graph)"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center mt-5">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>

      <!-- Error State -->
      <div v-if="error" class="alert alert-danger mt-3" role="alert">
        {{ error }}
      </div>

      <!-- No Results State -->
      <div v-if="!loading && !error && filteredGraphs.length === 0" class="text-center mt-5">
        <p class="text-muted">No knowledge graphs found.</p>
      </div>

      <!-- Share Modal -->
      <div
        class="modal fade"
        id="shareModal"
        tabindex="-1"
        aria-labelledby="shareModalLabel"
        aria-hidden="true"
      >
        <div class="modal-dialog">
          <div
            class="modal-content"
            :class="{ 'bg-dark': props.theme === 'dark', 'text-white': props.theme === 'dark' }"
          >
            <div class="modal-header">
              <h5 class="modal-title" id="shareModalLabel">Share Knowledge Graph</h5>
              <button
                type="button"
                class="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label for="shareContent" class="form-label">Share Content</label>
                <textarea
                  class="form-control"
                  id="shareContent"
                  rows="6"
                  v-model="shareContent"
                  readonly
                ></textarea>
              </div>
              <div class="share-buttons d-flex gap-2 justify-content-center flex-wrap">
                <button
                  class="btn btn-outline-primary share-btn instagram-btn"
                  @click="shareToInstagram"
                  title="Share to Instagram"
                >
                  <i class="bi bi-instagram"></i> Instagram
                </button>
                <button
                  class="btn btn-outline-primary share-btn linkedin-btn"
                  @click="shareToLinkedIn"
                  title="Share to LinkedIn"
                >
                  <i class="bi bi-linkedin"></i> LinkedIn
                </button>
                <button
                  class="btn btn-outline-primary share-btn twitter-btn"
                  @click="shareToTwitter"
                  title="Share to Twitter"
                >
                  <i class="bi bi-twitter-x"></i> Twitter
                </button>
                <button
                  class="btn btn-outline-primary share-btn facebook-btn"
                  @click="shareToFacebook"
                  title="Share to Facebook"
                >
                  <i class="bi bi-facebook"></i> Facebook
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useUserStore } from '@/stores/userStore'
import { Modal } from 'bootstrap'
import GraphGallery from './GraphGallery.vue'
import GraphTable from './GraphTable.vue'

const props = defineProps({
  theme: {
    type: String,
    default: 'light',
  },
})

const router = useRouter()
const graphStore = useKnowledgeGraphStore()
const portfolioStore = usePortfolioStore()
const userStore = useUserStore()
const graphs = ref([])
const loading = ref(true)
const error = ref(null)
const editingGraphId = ref(null)
const editingGraph = ref(null)
const shareContent = ref('')
const shareModal = ref(null)
const isLoadingTitle = ref(false)
const isLoadingCategories = ref(false)
const isLoadingDescription = ref(false)
const playgroundReady = ref(false)
const playgroundGraphId = computed(() => (userStore.email ? `playground_${userStore.email}` : ''))
const isViewOnly = computed(() => userStore.role === 'ViewOnly')
const canEditGraph = (graphId) => {
  if (!isViewOnly.value) return true
  return graphId === playgroundGraphId.value
}

// Fetch all knowledge graphs
const fetchGraphs = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
    if (response.ok) {
      const data = await response.json()
      console.log('Raw API response:', JSON.stringify(data, null, 2))

      if (data.results) {
        // Fetch complete data for each graph
        const graphPromises = data.results.map(async (graph) => {
          try {
            const graphResponse = await fetch(
              `https://knowledge.vegvisr.org/getknowgraph?id=${graph.id}`,
            )
            if (graphResponse.ok) {
              const graphData = await graphResponse.json()
              console.log('Fetched complete graph data:', JSON.stringify(graphData, null, 2))

              // Extract nodes and edges, ensuring they are arrays
              const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
              const edges = Array.isArray(graphData.edges) ? graphData.edges : []

              // Create the processed graph object
              return {
                id: graph.id,
                metadata: {
                  title: graphData.metadata?.title || graph.title || 'Untitled Graph',
                  description: graphData.metadata?.description || '',
                  createdBy: graphData.metadata?.createdBy || 'Unknown',
                  version: graphData.metadata?.version || 1,
                  updatedAt: graphData.metadata?.updatedAt || new Date().toISOString(),
                  category: graphData.metadata?.category || '#Uncategorized',
                },
                nodes: nodes.map((node) => ({
                  id: node.id,
                  label: node.label || node.id,
                  type: node.type || 'default',
                  color: node.color || 'gray',
                  info: node.info || null,
                  position: node.position || { x: 0, y: 0 },
                  visible: node.visible !== false,
                  path: node.path || null,
                })),
                edges: edges.map((edge) => ({
                  source: edge.source,
                  target: edge.target,
                  type: edge.type || 'default',
                  label: edge.label || null,
                })),
              }
            }
            return null
          } catch (e) {
            console.error('Error fetching graph data:', e)
            return null
          }
        })

        // Wait for all graph data to be fetched
        const processedGraphs = await Promise.all(graphPromises)
        graphs.value = processedGraphs.filter((graph) => graph !== null)
        console.log('Final processed graphs:', JSON.stringify(graphs.value, null, 2))
      } else {
        console.warn('No results found in API response')
        graphs.value = []
      }
    } else {
      throw new Error('Failed to fetch knowledge graphs')
    }
  } catch (err) {
    error.value = err.message
    console.error('Error fetching graphs:', err)
  } finally {
    loading.value = false
  }
}

const filteredGraphs = computed(() => {
  let filtered = graphs.value

  // Apply search filter
  if (portfolioStore.searchQuery) {
    const query = portfolioStore.searchQuery.toLowerCase()
    filtered = filtered.filter((graph) => {
      const categories = getCategories(graph.metadata?.category || '')
      // Collect all node types as a string
      const nodeTypes = Array.isArray(graph.nodes)
        ? graph.nodes
            .map((node) => node.type || '')
            .join(' ')
            .toLowerCase()
        : ''
      return (
        graph.metadata?.title?.toLowerCase().includes(query) ||
        graph.metadata?.description?.toLowerCase().includes(query) ||
        categories.some((cat) => cat.toLowerCase().includes(query)) ||
        graph.id?.toLowerCase().includes(query) ||
        nodeTypes.includes(query) // Enable node type search
      )
    })
  }

  // Apply sorting
  return filtered.sort((a, b) => {
    let aCategories, bCategories
    switch (portfolioStore.sortBy) {
      case 'title':
        return (a.metadata?.title || '').localeCompare(b.metadata?.title || '')
      case 'date':
        return new Date(b.metadata?.updatedAt || 0) - new Date(a.metadata?.updatedAt || 0)
      case 'nodes':
        return (b.nodes?.length || 0) - (a.nodes?.length || 0)
      case 'category':
        aCategories = getCategories(a.metadata?.category || '')
        bCategories = getCategories(b.metadata?.category || '')
        return (aCategories[0] || 'Uncategorized').localeCompare(bCategories[0] || 'Uncategorized')
      default:
        return 0
    }
  })
})

const truncateText = (text) => {
  if (!text) return ''
  const words = text.split(/\s+/)
  if (words.length <= 100) return text
  return words.slice(0, 100).join(' ') + '...'
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
    second: '2-digit',
    hour12: false,
  })
}

const viewGraph = (graph) => {
  // Set the current graph ID in the store
  graphStore.setCurrentGraphId(graph.id)
  // Update the store with the graph's nodes and edges
  graphStore.updateGraph(graph.nodes, graph.edges)
  // Navigate to the graph viewer
  router.push({ name: 'GraphViewer', query: { graphId: graph.id } })
}

const editGraph = async (graph) => {
  try {
    // Set the current graph ID in the store
    graphStore.setCurrentGraphId(graph.id)

    // Fetch the complete graph data
    const response = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${graph.id}`)
    if (response.ok) {
      const graphData = await response.json()

      // Process nodes with positions
      graphStore.nodes = graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label || node.id,
          color: node.color || 'gray',
          type: node.type || null,
          info: node.info || null,
          bibl: Array.isArray(node.bibl) ? node.bibl : [],
          imageWidth: node.imageWidth || '100%',
          imageHeight: node.imageHeight || '100%',
          visible: node.visible !== false,
          path: node.path || null,
        },
        position: node.position || { x: 0, y: 0 },
      }))

      graphStore.edges = graphData.edges.map((edge) => ({
        data: {
          source: edge.source,
          target: edge.target,
          label: edge.label || null,
          type: edge.type || null,
          info: edge.info || null,
        },
      }))

      // Set the current version
      graphStore.setCurrentVersion(graphData.metadata?.version || 1)

      // Navigate to the graph admin
      router.push({ name: 'GraphAdmin', query: { graphId: graph.id } })
    } else {
      throw new Error('Failed to fetch graph data')
    }
  } catch (err) {
    error.value = err.message
    console.error('Error loading graph for editing:', err)
  }
}

const filterGraphs = () => {
  // The filtering is handled by the computed property
}

const sortGraphs = () => {
  // The sorting is handled by the computed property
}

const getNodeTypes = (nodes) => {
  if (!Array.isArray(nodes)) return ''
  const types = new Set(nodes.map((node) => node?.type || 'default'))
  return Array.from(types).join(', ')
}

const getCategories = (categoryString) => {
  if (!categoryString) return []
  return categoryString
    .split('#')
    .map((cat) => cat.trim())
    .filter((cat) => cat.length > 0)
}

// Start editing a graph
const startEdit = (graph) => {
  editingGraphId.value = graph.id
  editingGraph.value = JSON.parse(JSON.stringify(graph)) // Deep copy
}

// Cancel editing
const cancelEdit = () => {
  editingGraphId.value = null
  editingGraph.value = null
}

// Save edited graph
const saveEdit = async (originalGraph) => {
  try {
    const response = await fetch(`https://knowledge.vegvisr.org/updateknowgraph`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: originalGraph.id,
        graphData: {
          ...originalGraph,
          metadata: editingGraph.value.metadata,
        },
      }),
    })

    if (response.ok) {
      // Update the local graph data
      const index = graphs.value.findIndex((g) => g.id === originalGraph.id)
      if (index !== -1) {
        graphs.value[index] = {
          ...originalGraph,
          metadata: editingGraph.value.metadata,
        }
      }
      editingGraphId.value = null
      editingGraph.value = null

      // Scroll to the card after a short delay to ensure DOM update
      setTimeout(() => {
        const cardElement = document.querySelector(`[data-graph-id="${originalGraph.id}"]`)
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    } else {
      throw new Error('Failed to update graph')
    }
  } catch (err) {
    error.value = err.message
    console.error('Error updating graph:', err)
  }
}

const confirmDelete = async (graph) => {
  if (
    confirm(
      `Are you sure you want to delete the graph "${graph.metadata?.title || 'Untitled Graph'}"? This action cannot be undone.`,
    )
  ) {
    try {
      console.log('[Client] Attempting to delete graph:', graph.id)
      const response = await fetch('https://knowledge.vegvisr.org/deleteknowgraph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: graph.id,
        }),
      })

      if (!response.ok) {
        let errorMessage
        try {
          const errorData = await response.json()
          console.error('[Client] Server error response:', errorData)
          if (response.status === 404) {
            errorMessage = 'Graph not found. It may have been already deleted.'
          } else {
            errorMessage = errorData.error || `Server error (${response.status})`
            if (errorData.details) {
              errorMessage += `\nDetails: ${errorData.details}`
            }
          }
        } catch (parseError) {
          console.error('[Client] Error parsing server response:', parseError)
          errorMessage = `Server error (${response.status})`
        }
        throw new Error(errorMessage)
      }

      // Remove the graph from the local array
      graphs.value = graphs.value.filter((g) => g.id !== graph.id)
      console.log('[Client] Graph removed from local state:', graph.id)

      // Show success message
      alert('Graph deleted successfully')
    } catch (err) {
      error.value = err.message
      console.error('[Client] Error deleting graph:', err)
      alert(
        `Failed to delete graph: ${err.message}\n\nPlease try again later or contact support if the problem persists.`,
      )
    }
  }
}

const openShareModal = (graph) => {
  const nodeCount = Array.isArray(graph.nodes) ? graph.nodes.length : 0
  const edgeCount = Array.isArray(graph.edges) ? graph.edges.length : 0
  const categories = getCategories(graph.metadata?.category || '')
  const categoryText = categories.length > 0 ? `Categories: ${categories.join(', ')}` : ''

  shareContent.value =
    `${graph.metadata?.title || 'Untitled Graph'}\n\n` +
    `${graph.metadata?.description || ''}\n\n` +
    `Nodes: ${nodeCount}\n` +
    `Edges: ${edgeCount}\n` +
    `${categoryText}\n\n` +
    `View this knowledge graph: ${window.location.origin}/graph-viewer?graphId=${graph.id}`

  if (!shareModal.value) {
    shareModal.value = new Modal(document.getElementById('shareModal'))
  }
  shareModal.value.show()
}

const shareToInstagram = () => {
  const instagramUrl = `https://www.instagram.com/create/story`
  window.open(instagramUrl, '_blank', 'width=600,height=400')

  // Show a message to the user
  alert('Please copy the text from the text area above and paste it into your Instagram story.')
}

const shareToLinkedIn = () => {
  const title = encodeURIComponent(shareContent.value.split('\n')[0])
  const summary = encodeURIComponent(shareContent.value)
  const graphId = shareContent.value.match(/graphId=([^&\s]+)/)?.[1] || ''
  const url = encodeURIComponent(window.location.origin + '/graph-viewer?graphId=' + graphId)

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}&summary=${summary}`
  window.open(linkedInUrl, '_blank', 'width=600,height=400')
}

const shareToTwitter = () => {
  const title = shareContent.value.split('\n')[0]
  const graphId = shareContent.value.match(/graphId=([^&\s]+)/)?.[1] || ''
  const url = window.location.origin + '/graph-viewer?graphId=' + graphId

  // Twitter has a 280 character limit, so we'll create a shorter message
  const tweetText = encodeURIComponent(`${title}\n\nView this knowledge graph: ${url}`)
  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`
  window.open(twitterUrl, '_blank', 'width=600,height=400')
}

const shareToFacebook = () => {
  const graphId = shareContent.value.match(/graphId=([^&\s]+)/)?.[1] || ''
  const url = encodeURIComponent(window.location.origin + '/graph-viewer?graphId=' + graphId)

  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`
  window.open(facebookUrl, '_blank', 'width=600,height=400')
}

const suggestTitle = async (graph) => {
  try {
    isLoadingTitle.value = true
    const response = await fetch('https://api.vegvisr.org/suggest-title', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodes: graph.nodes,
        edges: graph.edges,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to get title suggestion: ${response.status}`)
    }

    const data = await response.json()
    editingGraph.value.metadata.title = data.title
  } catch (err) {
    console.error('Error getting title suggestion:', err)
    alert('Failed to get title suggestion: ' + err.message)
  } finally {
    isLoadingTitle.value = false
  }
}

const suggestCategories = async (graph) => {
  try {
    isLoadingCategories.value = true
    const response = await fetch('https://api.vegvisr.org/suggest-categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodes: graph.nodes,
        edges: graph.edges,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to get category suggestions: ${response.status}`)
    }

    const data = await response.json()
    editingGraph.value.metadata.category = data.categories
  } catch (err) {
    console.error('Error getting category suggestions:', err)
    alert('Failed to get category suggestions: ' + err.message)
  } finally {
    isLoadingCategories.value = false
  }
}

const suggestDescription = async (graph) => {
  try {
    isLoadingDescription.value = true
    const response = await fetch('https://api.vegvisr.org/suggest-description', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodes: graph.nodes,
        edges: graph.edges,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to get description suggestion: ${response.status}`)
    }

    const data = await response.json()
    editingGraph.value.metadata.description = data.description
  } catch (err) {
    console.error('Error getting description suggestion:', err)
    alert('Failed to get description suggestion: ' + err.message)
  } finally {
    isLoadingDescription.value = false
  }
}

const getPortfolioImage = (nodes) => {
  if (!Array.isArray(nodes)) return null

  const imageNode = nodes.find((node) => node.type === 'portfolio-image')
  if (!imageNode) return null

  // The path is directly on the node object
  const path = imageNode.path
  if (!path) {
    console.warn('Portfolio image node found but no path specified:', imageNode)
    return null
  }

  return {
    path,
    label: imageNode.label || 'Portfolio Image',
  }
}

// Compute galleryGraphs for the gallery view
const galleryGraphs = computed(() =>
  filteredGraphs.value.map((graph) => {
    let image = null
    if (Array.isArray(graph.nodes)) {
      const imgNode = graph.nodes.find((n) => n.type === 'portfolio-image' && n.path)
      if (imgNode) image = imgNode.path
    }
    if (!image) image = 'https://via.placeholder.com/180x120?text=No+Image'
    return {
      id: graph.id,
      title: graph.metadata?.title || 'Untitled Graph',
      image,
    }
  }),
)

// Handler to map galleryGraph to full graph object
const handleGalleryViewGraph = (galleryGraph) => {
  const fullGraph = filteredGraphs.value.find((g) => g.id === galleryGraph.id)
  if (fullGraph) {
    viewGraph(fullGraph)
  }
}

const goToMyPlayground = () => {
  const playground = graphs.value.find((g) => g.id === playgroundGraphId.value)
  if (playground) {
    // Go to GraphAdmin (edit mode)
    router.push({ name: 'GraphAdmin', query: { graphId: playground.id } })
  } else {
    alert('Your playground graph does not exist yet.')
  }
}

async function ensurePlaygroundGraph(userEmail) {
  if (!userEmail) return
  const playgroundId = `playground_${userEmail}`
  try {
    // Check if playground graph exists
    const response = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${playgroundId}`)
    if (response.ok) {
      playgroundReady.value = true
      await fetchGraphs()
      return
    }
    // If not found, create it
    await fetch('https://knowledge.vegvisr.org/saveknowgraph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: playgroundId,
        metadata: {
          title: 'My Playground',
          description: 'This is your personal playground graph. Feel free to experiment!',
          createdBy: userEmail,
          version: 1,
          updatedAt: new Date().toISOString(),
        },
        nodes: [
          {
            id: 'welcome',
            label: 'Welcome to your Playground!',
            color: 'green',
            info: 'You can add, edit, and experiment here. This graph is just for you.',
            bibl: [],
            imageWidth: '100%',
            imageHeight: '100%',
            visible: true,
            path: null,
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      }),
    })
    playgroundReady.value = true
    await fetchGraphs()
  } catch (err) {
    playgroundReady.value = false
    console.error('Error ensuring playground graph:', err)
  }
}

watch(
  () => userStore.email,
  (email) => {
    if (userStore.role === 'ViewOnly' && email) {
      ensurePlaygroundGraph(email)
    }
  },
  { immediate: true },
)

onMounted(() => {
  fetchGraphs()
})
</script>

<style scoped>
/* ... existing styles ... */
</style>
