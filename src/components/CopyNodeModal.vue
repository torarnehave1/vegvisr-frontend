<template>
  <div
    class="modal fade"
    id="copyNodeModal"
    tabindex="-1"
    aria-labelledby="copyNodeModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="copyNodeModalLabel">
            Copy Node: {{ nodeData?.label || 'Untitled Node' }}
          </h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <!-- Search -->
          <div class="mb-3">
            <input
              type="text"
              v-model="searchQuery"
              class="form-control form-control-sm"
              placeholder="Search graphs by title, description, category, or node type..."
              @input="filterGraphs"
            />
          </div>

          <!-- Graph Selection Table -->
          <div class="table-container" style="max-height: 320px; overflow-y: auto">
            <table class="table table-hover table-sm">
              <thead class="table-light sticky-top">
                <tr>
                  <th @click="setSort('title')" class="sortable-header col-title">
                    Title
                    <span v-if="sortBy === 'title'">
                      {{ sortDirection === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                  <th @click="setSort('createdBy')" class="sortable-header col-created-by">
                    Created By
                    <span v-if="sortBy === 'createdBy'">
                      {{ sortDirection === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                  <th @click="setSort('nodes')" class="sortable-header col-nodes">
                    Nodes
                    <span v-if="sortBy === 'nodes'">
                      {{ sortDirection === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                  <th @click="setSort('updatedAt')" class="sortable-header col-updated">
                    Last Updated
                    <span v-if="sortBy === 'updatedAt'">
                      {{ sortDirection === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="graph in filteredGraphs"
                  :key="graph.id"
                  class="selectable-row"
                  :class="{ 'table-primary': selectedGraph?.id === graph.id }"
                  @click="selectGraph(graph)"
                  style="cursor: pointer"
                >
                  <td class="col-title">{{ graph.metadata?.title || 'Untitled Graph' }}</td>
                  <td class="col-created-by">{{ graph.metadata?.createdBy || 'Unknown' }}</td>
                  <td class="col-nodes">
                    {{ Array.isArray(graph.nodes) ? graph.nodes.length : 0 }}
                  </td>
                  <td class="col-updated">{{ formatDate(graph.metadata?.updatedAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="text-center my-3">
            <div class="spinner-border spinner-border-sm" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>

          <!-- No Results -->
          <div v-if="!loading && filteredGraphs.length === 0" class="text-center text-muted my-3">
            No graphs found.
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!selectedGraph || copying"
            @click="copyNode"
          >
            <span v-if="copying" class="spinner-border spinner-border-sm me-2" role="status"></span>
            {{ copying ? 'Copying...' : 'Copy Node' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  nodeData: {
    type: Object,
    default: null,
  },
  currentGraphId: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['node-copied'])

// State
const graphs = ref([])
const loading = ref(false)
const copying = ref(false)
const searchQuery = ref('')
const sortBy = ref('title')
const sortDirection = ref('asc')
const selectedGraph = ref(null)

// Computed properties
const filteredGraphs = computed(() => {
  let filtered = graphs.value.filter((g) => g.id !== props.currentGraphId) // Exclude current graph

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
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
  const dir = sortDirection.value === 'desc' ? -1 : 1
  return filtered.slice().sort((a, b) => {
    let cmp = 0
    switch (sortBy.value) {
      case 'title':
        cmp = (a.metadata?.title || '').localeCompare(b.metadata?.title || '')
        break
      case 'createdBy':
        cmp = (a.metadata?.createdBy || '').localeCompare(b.metadata?.createdBy || '')
        break
      case 'nodes':
        cmp = (b.nodes?.length || 0) - (a.nodes?.length || 0)
        break
      case 'updatedAt':
        cmp = new Date(b.metadata?.updatedAt || 0) - new Date(a.metadata?.updatedAt || 0)
        break
      default:
        cmp = 0
    }
    return cmp * dir
  })
})

// Methods
const fetchGraphs = async () => {
  loading.value = true
  try {
    const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
    if (response.ok) {
      const data = await response.json()
      if (data.results) {
        // Fetch complete data for each graph
        const graphPromises = data.results.map(async (graph) => {
          try {
            const graphResponse = await fetch(
              `https://knowledge.vegvisr.org/getknowgraph?id=${graph.id}`,
            )
            if (graphResponse.ok) {
              const graphData = await graphResponse.json()

              return {
                id: graph.id,
                metadata: {
                  title: graphData.metadata?.title || graph.title || 'Untitled Graph',
                  description: graphData.metadata?.description || '',
                  createdBy: graphData.metadata?.createdBy || 'Unknown',
                  updatedAt: graphData.metadata?.updatedAt || new Date().toISOString(),
                  category: graphData.metadata?.category || '',
                },
                nodes: Array.isArray(graphData.nodes) ? graphData.nodes : [],
                edges: Array.isArray(graphData.edges) ? graphData.edges : [],
              }
            }
            return null
          } catch (e) {
            console.error('Error fetching graph data:', e)
            return null
          }
        })

        const processedGraphs = await Promise.all(graphPromises)
        graphs.value = processedGraphs.filter((graph) => graph !== null)
      }
    }
  } catch (error) {
    console.error('Error fetching graphs:', error)
  } finally {
    loading.value = false
  }
}

const selectGraph = (graph) => {
  selectedGraph.value = graph
}

const setSort = (column) => {
  if (sortBy.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortDirection.value = 'asc'
  }
}

const filterGraphs = () => {
  // Filtering is handled by computed property
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
    hour12: false,
  })
}

const getCategories = (categoryString) => {
  if (!categoryString) return []
  return categoryString
    .split('#')
    .map((cat) => cat.trim())
    .filter((cat) => cat.length > 0)
}

const copyNode = async () => {
  if (!selectedGraph.value || !props.nodeData) return

  copying.value = true
  try {
    console.log('=== Copy Node Debug ===')
    console.log('Source node:', props.nodeData)
    console.log('Target graph ID:', selectedGraph.value.id)

    // Create a copy of the node with new ID but same position
    const newNodeId = crypto.randomUUID()
    const copiedNode = {
      ...props.nodeData,
      id: newNodeId,
    }

    console.log('Copied node with new ID:', copiedNode)

    // Get the current graph data
    const currentGraphData = {
      ...selectedGraph.value,
      nodes: [...selectedGraph.value.nodes, copiedNode],
    }

    console.log('Updated graph data:', currentGraphData)

    // Update the target graph with the new node
    const response = await fetch('https://knowledge.vegvisr.org/updateknowgraph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: selectedGraph.value.id,
        graphData: currentGraphData,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to copy node')
    }

    console.log('Node copied successfully')

    // Emit success event
    emit('node-copied', {
      sourceNode: props.nodeData,
      targetGraph: selectedGraph.value,
      newNodeId: newNodeId,
    })

    // Reset selection
    selectedGraph.value = null

    // Close modal
    const modalElement = document.getElementById('copyNodeModal')
    if (modalElement) {
      const modal = window.bootstrap?.Modal?.getInstance(modalElement)
      modal?.hide()
    }
  } catch (error) {
    console.error('Error copying node:', error)
    alert('Failed to copy node: ' + error.message)
  } finally {
    copying.value = false
  }
}

// Expose methods for parent component
defineExpose({
  show: () => {
    fetchGraphs()
    selectedGraph.value = null
  },
})

onMounted(() => {
  fetchGraphs()
})
</script>

<style scoped>
.selectable-row:hover {
  background-color: #f8f9fa;
}

.table-container {
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
}

.sticky-top {
  position: sticky;
  top: 0;
  z-index: 10;
}

.alert {
  font-size: 0.875rem;
}

.modal-body {
  padding: 1rem 1.5rem;
}

.sortable-header {
  cursor: pointer;
  user-select: none;
}

.sortable-header:hover {
  background-color: #e9ecef;
}

.sortable-header span {
  font-size: 0.9em;
  color: #007bff;
  margin-left: 4px;
}

/* Column width constraints */
.col-title {
  width: 45%;
  min-width: 200px;
  max-width: 300px;
}

.col-created-by {
  width: 18%;
  min-width: 100px;
  max-width: 150px;
}

.col-nodes {
  width: 12%;
  min-width: 60px;
  text-align: center;
}

.col-updated {
  width: 25%;
  min-width: 140px;
  font-size: 0.9em;
}

/* Text overflow handling */
.col-title,
.col-created-by {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Make table layout fixed for consistent column widths */
.table {
  table-layout: fixed;
}
</style>
