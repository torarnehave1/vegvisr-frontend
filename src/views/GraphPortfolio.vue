<template>
  <div>
    <div v-if="!userStore.loggedIn">
      <div class="alert alert-warning">User not loaded. Please log in.</div>
    </div>
    <button
      v-if="userStore.role === 'Superadmin'"
      class="btn btn-warning mb-3"
      @click="generateMetaAreas"
    >
      Auto-Generate Meta Areas (GROK AI)
    </button>
    <button
      v-if="userStore.role === 'Superadmin'"
      class="btn btn-danger mb-3 ms-2"
      @click="resetMetaAreas"
    >
      Reset All Meta Areas
    </button>
    <div class="d-flex">
      <MetaAreaSidebar
        :selected="portfolioStore.selectedMetaArea"
        @select="portfolioStore.selectedMetaArea = $event"
      />
      <div class="flex-grow-1">
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
                  <div class="view-options d-flex align-items-center" style="gap: 0.5rem">
                    <label class="mb-0">Sort:</label>
                    <select
                      v-model="portfolioStore.sortBy"
                      class="form-select"
                      @change="sortGraphs"
                    >
                      <option value="title-asc">Name (A-Z)</option>
                      <option value="title-desc">Name (Z-A)</option>
                      <option value="date-desc">Date (Newest First)</option>
                      <option value="date-asc">Date (Oldest First)</option>
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
              </div>
            </div>

            <!-- Simple View (GraphGallery) -->
            <GraphGallery
              v-if="portfolioStore.viewMode === 'simple'"
              :graphs="galleryGraphs"
              :isViewOnly="userStore.role === 'ViewOnly'"
              @view-graph="handleGalleryViewGraph"
              @edit-graph="editGraph"
            />

            <!-- Table View -->
            <GraphTable
              v-if="portfolioStore.viewMode === 'table'"
              :graphs="filteredGraphs"
              :isViewOnly="userStore.role === 'ViewOnly'"
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
                    :class="{
                      'bg-dark': props.theme === 'dark',
                      'text-white': props.theme === 'dark',
                    }"
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
                        <div class="mb-3">
                          <button
                            class="btn btn-outline-primary"
                            @click="openR2ImageModal"
                            :disabled="isLoadingPortfolioImage"
                          >
                            <i
                              class="bi"
                              :class="isLoadingPortfolioImage ? 'bi-hourglass-split' : 'bi-image'"
                            ></i>
                            Insert Portfolio Image
                          </button>
                        </div>
                        <div class="mb-3 position-relative">
                          <label class="form-label"
                            >Meta Areas (use # to separate multiple areas)</label
                          >
                          <input
                            type="text"
                            class="form-control"
                            v-model="editingGraph.metadata.metaArea"
                            placeholder="e.g., #Technology #Management #WebDesign"
                            @input="onMetaAreaInput"
                            @keydown.tab.prevent="selectSuggestion"
                            @keydown.enter.prevent="selectSuggestion"
                            @keydown.down.prevent="moveSuggestion(1)"
                            @keydown.up.prevent="moveSuggestion(-1)"
                            @blur="handleBlur"
                            autocomplete="off"
                          />
                          <ul v-if="showSuggestions" class="autocomplete-list">
                            <li
                              v-for="(suggestion, idx) in filteredSuggestions"
                              :key="suggestion"
                              :class="{ active: idx === suggestionIndex }"
                              @mousedown.prevent="selectSuggestion(idx)"
                            >
                              {{ suggestion }}
                            </li>
                          </ul>
                        </div>
                        <div class="d-flex justify-content-end gap-2">
                          <button class="btn btn-secondary btn-sm" @click="cancelEdit">
                            Cancel
                          </button>
                          <button class="btn btn-primary btn-sm" @click="saveEdit(graph)">
                            Save
                          </button>
                        </div>
                      </div>

                      <!-- View Mode -->
                      <template v-else>
                        <div class="d-flex justify-content-between align-items-start">
                          <h5 class="card-title mb-0">
                            {{ graph.metadata?.title || 'Untitled Graph' }}
                          </h5>
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
                          <template v-if="graph.metadata?.metaArea">
                            <span
                              v-for="(area, idx) in getMetaAreas(graph.metadata.metaArea)"
                              :key="idx"
                              class="badge bg-warning ms-2"
                            >
                              {{ area }}
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
                          <template v-if="graph.metadata?.mystmkraUrl">
                            <br />
                            <small class="text-muted">
                              <a
                                :href="graph.metadata.mystmkraUrl"
                                target="_blank"
                                class="text-info"
                              >
                                <i class="bi bi-link-45deg"></i> View on Mystmkra.io
                              </a>
                            </small>
                          </template>
                        </div>
                      </template>
                    </div>
                    <div class="card-footer">
                      <div class="d-flex justify-content-between">
                        <button class="btn btn-primary btn-sm" @click="viewGraph(graph)">
                          View Graph
                        </button>
                        <div
                          class="btn-group"
                          v-if="userStore.role === 'Admin' || userStore.role === 'Superadmin'"
                        >
                          <button
                            v-if="editingGraphId !== graph.id"
                            class="btn btn-outline-secondary btn-sm"
                            @click="startEdit(graph)"
                          >
                            Edit Info
                          </button>
                          <button
                            v-if="editingGraphId !== graph.id"
                            class="btn btn-outline-secondary btn-sm"
                            @click="editGraph(graph)"
                          >
                            Edit Graph
                          </button>
                          <button
                            v-if="editingGraphId !== graph.id"
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
                  :class="{
                    'bg-dark': props.theme === 'dark',
                    'text-white': props.theme === 'dark',
                  }"
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
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- R2 Image Selection Modal -->
            <div
              class="modal fade"
              id="r2ImageModal"
              tabindex="-1"
              aria-labelledby="r2ImageModalLabel"
              aria-hidden="true"
            >
              <div class="modal-dialog modal-lg" style="max-width: 800px">
                <div
                  class="modal-content"
                  :class="{
                    'bg-dark': props.theme === 'dark',
                    'text-white': props.theme === 'dark',
                  }"
                >
                  <div class="modal-header">
                    <h5 class="modal-title" id="r2ImageModalLabel">Select Portfolio Image</h5>
                    <button
                      type="button"
                      class="btn-close"
                      data-bs-dismiss="modal"
                      aria-label="Close"
                    ></button>
                  </div>
                  <div class="modal-body" style="max-height: 70vh; overflow-y: auto">
                    <div class="portfolio-grid">
                      <div
                        v-for="img in r2Images"
                        :key="img.key"
                        class="portfolio-card"
                        @click="selectR2Image(img)"
                      >
                        <img :src="img.url" :alt="img.key" class="portfolio-thumb" loading="lazy" />
                        <div class="portfolio-caption">{{ img.key }}</div>
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
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useUserStore } from '@/stores/userStore'
import { Modal } from 'bootstrap'
import GraphGallery from './GraphGallery.vue'
import GraphTable from './GraphTable.vue'
import MetaAreaSidebar from '@/components/MetaAreaSidebar.vue'

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
const showSuggestions = ref(false)
const filteredSuggestions = ref([])
const suggestionIndex = ref(0)
const isLoadingPortfolioImage = ref(false)
const r2Images = ref([])
const r2ImageModal = ref(null)
const selectedImage = ref(null)

console.log('User role:', userStore.role)

// Add the allMetaAreas computed property
const allMetaAreas = computed(() => portfolioStore.allMetaAreas)

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
                  metaArea: graphData.metadata?.metaArea || '',
                  mystmkraUrl: graphData.metadata?.mystmkraUrl || null,
                  mystmkraDocumentId: graphData.metadata?.mystmkraDocumentId || null,
                  mystmkraNodeId: graphData.metadata?.mystmkraNodeId || null,
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
                  mystmkraUrl: node.mystmkraUrl || null,
                  mystmkraDocumentId: node.mystmkraDocumentId || null,
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

        // Update meta areas in the store
        portfolioStore.updateMetaAreas(graphs.value)

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
  if (portfolioStore.selectedMetaArea) {
    filtered = filtered.filter((g) =>
      getMetaAreas(g.metadata?.metaArea).includes(portfolioStore.selectedMetaArea),
    )
  }
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
      case 'title-asc':
        return (a.metadata?.title || '').localeCompare(b.metadata?.title || '')
      case 'title-desc':
        return (b.metadata?.title || '').localeCompare(a.metadata?.title || '')
      case 'date-desc':
        return new Date(b.metadata?.updatedAt || 0) - new Date(a.metadata?.updatedAt || 0)
      case 'date-asc':
        return new Date(a.metadata?.updatedAt || 0) - new Date(b.metadata?.updatedAt || 0)
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
          metadata: {
            ...editingGraph.value.metadata,
            metaArea: editingGraph.value.metadata.metaArea || '',
          },
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

      // Update meta areas in the store
      portfolioStore.updateMetaAreas(graphs.value)

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

// Helper to parse meta areas from string
function getMetaAreas(metaAreaString) {
  if (!metaAreaString) return []
  return metaAreaString
    .split('#')
    .map((area) => area.trim())
    .filter((area) => area.length > 0)
}

function onMetaAreaInput() {
  const value = editingGraph.value.metadata.metaArea || ''
  const match = value.match(/#([\w-]*)$/)
  if (match) {
    const search = match[1].toLowerCase()
    filteredSuggestions.value = allMetaAreas.value.filter((area) =>
      area.toLowerCase().includes(search),
    )
    showSuggestions.value = filteredSuggestions.value.length > 0
    suggestionIndex.value = 0
  } else {
    showSuggestions.value = false
  }
}

function selectSuggestion(idx = suggestionIndex.value) {
  if (!showSuggestions.value || !filteredSuggestions.value.length) return

  const value = editingGraph.value.metadata.metaArea || ''
  const match = value.match(/#([\w-]*)$/)

  if (match) {
    const before = value.slice(0, match.index + 1)
    const after = value.slice(match.index + match[0].length)
    const selectedArea = filteredSuggestions.value[idx]

    if (selectedArea) {
      editingGraph.value.metadata.metaArea = before + selectedArea + ' ' + after
    }
  }

  showSuggestions.value = false
}

function moveSuggestion(dir) {
  if (!showSuggestions.value) return
  suggestionIndex.value =
    (suggestionIndex.value + dir + filteredSuggestions.value.length) %
    filteredSuggestions.value.length
}

function handleBlur() {
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

const generateMetaAreas = async () => {
  try {
    loading.value = true
    const response = await fetch('https://api.vegvisr.org/generate-meta-areas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': userStore.role || '',
      },
      body: JSON.stringify({}),
    })
    if (!response.ok) throw new Error('Failed to generate meta areas')
    await fetchGraphs()
    alert('Meta Areas updated!')
  } catch (err) {
    alert('Error: ' + err.message)
  } finally {
    loading.value = false
  }
}

const resetMetaAreas = async () => {
  try {
    loading.value = true
    const response = await fetch('https://knowledge.vegvisr.org/resetMetaAreas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': userStore.role || '',
      },
      body: JSON.stringify({}),
    })
    if (!response.ok) throw new Error('Failed to reset meta areas')
    await fetchGraphs()
    alert('All Meta Areas have been reset!')
  } catch (err) {
    alert('Error: ' + err.message)
  } finally {
    loading.value = false
  }
}

const fetchR2Images = async () => {
  try {
    const res = await fetch('https://api.vegvisr.org/list-r2-images?size=small')
    const data = await res.json()
    r2Images.value = data.images
  } catch (error) {
    console.error('Error fetching R2 images:', error)
  }
}

const selectR2Image = (img) => {
  selectedImage.value = img
  r2ImageModal.value.hide()
  insertPortfolioImage(img.url)
}

const insertPortfolioImage = async (imageUrl = null) => {
  try {
    isLoadingPortfolioImage.value = true

    // Check if there's already a portfolio image node
    const existingPortfolioNode = editingGraph.value.nodes?.find(
      (node) => node.type === 'portfolio-image',
    )

    if (existingPortfolioNode) {
      // Update existing node
      existingPortfolioNode.path = imageUrl
    } else {
      // Create new node if none exists
      const portfolioNode = {
        id: crypto.randomUUID(),
        label: 'My Portfolio Image',
        color: 'white',
        type: 'portfolio-image',
        info: null,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: imageUrl || 'https://vegvisr.imgix.net/tilopa01.jpg',
      }
      editingGraph.value.nodes = [...(editingGraph.value.nodes || []), portfolioNode]
    }

    // Update the graph
    const response = await fetch('https://knowledge.vegvisr.org/updateknowgraph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: editingGraph.value.id,
        graphData: editingGraph.value,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to update portfolio image')
    }

    // Update the main graphs array to reflect the changes
    const graphIndex = graphs.value.findIndex((g) => g.id === editingGraph.value.id)
    if (graphIndex !== -1) {
      graphs.value[graphIndex] = {
        ...graphs.value[graphIndex],
        nodes: editingGraph.value.nodes,
      }
    }

    // Show success message
    alert('Portfolio image updated successfully!')

    // Refresh the graphs data
    await fetchGraphs()
  } catch (error) {
    console.error('Error updating portfolio image:', error)
    alert('Failed to update portfolio image: ' + error.message)
  } finally {
    isLoadingPortfolioImage.value = false
  }
}

const openR2ImageModal = () => {
  if (!r2ImageModal.value) {
    r2ImageModal.value = new Modal(document.getElementById('r2ImageModal'))
  }
  fetchR2Images()
  r2ImageModal.value.show()
}

onMounted(() => {
  console.log('GraphPortfolio mounted, fetching graphs...')
  fetchGraphs()
})
</script>

<style scoped>
.portfolio-image-container {
  width: 100%;
  max-width: 300px;
  height: 200px;
  overflow: hidden;
  border-radius: 4px;
  margin: 0.5rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.portfolio-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.graph-meta .badge {
  max-width: 100%;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: break-word;
  display: inline-block;
  vertical-align: middle;
  margin-bottom: 2px;
}

.graph-meta .badge.bg-primary {
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 95%;
}

@media (max-width: 768px) {
  .portfolio-image-container {
    max-width: 100%;
    height: 150px;
  }
}

@media (max-width: 576px) {
  .portfolio-image-container {
    height: 120px;
  }
}

.autocomplete-list {
  position: absolute;
  z-index: 1000;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.autocomplete-list li {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.autocomplete-list li.active,
.autocomplete-list li:hover {
  background: #007bff;
  color: #fff;
}

.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  padding: 12px;
}

.portfolio-card {
  width: 100%;
  border: 1px solid #eee;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.portfolio-card:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}

.portfolio-thumb {
  width: 100%;
  height: 80px;
  object-fit: cover;
  display: block;
}

.portfolio-caption {
  font-size: 0.8em;
  padding: 4px;
  text-align: center;
  word-break: break-all;
  max-height: 32px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
