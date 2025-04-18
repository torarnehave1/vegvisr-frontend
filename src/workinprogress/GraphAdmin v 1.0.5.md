Changed the hight of the node infor textarea and the heoght of the history list to 600px

<template>
  <div class="admin-page">
    <!-- Top Bar -->
    <div class="top-bar sticky-top bg-light p-3 border-bottom">
      <div class="container-fluid">
        <div class="row align-items-center">
          <!-- Graph Selector -->
          <div class="col-md-4 col-sm-12">
            <label for="graphDropdown" class="form-label"
              ><strong>Select Knowledge Graph:</strong></label
            >
            <select
              id="graphDropdown"
              v-model="selectedGraphId"
              @change="loadSelectedGraph"
              class="form-select"
            >
              <option value="" disabled>Select a graph</option>
              <option v-for="graph in knowledgeGraphs" :key="graph.id" :value="graph.id">
                {{ graph.title }}
              </option>
            </select>
          </div>
          <!-- Current Graph ID -->
          <div class="col-md-4 col-sm-12 text-center">
            <p class="mb-0">
              <strong>Current Graph ID:</strong>
              <span>{{ graphStore.currentGraphId || 'Not saved yet' }}</span>
            </p>
          </div>
          <!-- golValidation Errors -->
          <div class="col-md-4 col-sm-12">
            <div v-if="validationErrors.length" class="alert alert-danger mb-0" role="alert">
              <strong>Graph Validation Errors:</strong>
              <ul class="mb-0">
                <li v-for="(error, index) in validationErrors" :key="index">{{ error }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content container-fluid">
      <div class="row">
        <!-- Sidebar (Collapsible) -->
        <div class="col-md-3 sidebar bg-light border-end" :class="{ collapsed: sidebarCollapsed }">
          <div v-if="!sidebarCollapsed">
            <!-- Tabs for Form, JSON Editor, and Node Info -->
            <ul class="nav nav-tabs">
              <li class="nav-item">
                <button
                  class="nav-link"
                  :class="{ active: activeTab === 'form' }"
                  @click="activeTab = 'form'"
                >
                  New Graph
                </button>
              </li>
              <li class="nav-item">
                <button
                  class="nav-link"
                  :class="{ active: activeTab === 'json' }"
                  @click="activeTab = 'json'"
                >
                  Version
                </button>
              </li>
              <li class="nav-item">
                <button
                  class="nav-link"
                  :class="{ active: activeTab === 'node-info' }"
                  @click="activeTab = 'node-info'"
                >
                  Info
                </button>
              </li>
            </ul>
            <div class="tab-content p-3">
              <!-- Create New Graph Form -->
              <div v-if="activeTab === 'form'" class="form-section">
                <h3>Create New Knowledge Graph</h3>
                <form @submit.prevent="saveGraph">
                  <div class="mb-3">
                    <label for="graphTitle" class="form-label">Title:</label>
                    <input
                      id="graphTitle"
                      v-model="graphStore.graphMetadata.title"
                      type="text"
                      class="form-control"
                      required
                    />
                  </div>
                  <div class="mb-3">
                    <label for="graphDescription" class="form-label">Description:</label>
                    <textarea
                      id="graphDescription"
                      v-model="graphStore.graphMetadata.description"
                      class="form-control"
                      rows="4"
                    ></textarea>
                  </div>
                  <div class="mb-3">
                    <label for="graphCreatedBy" class="form-label">Created By:</label>
                    <input
                      id="graphCreatedBy"
                      v-model="graphStore.graphMetadata.createdBy"
                      type="text"
                      class="form-control"
                      required
                    />
                  </div>
                  <button type="submit" class="btn btn-primary">Save Knowledge Graph</button>
                </form>
              </div>
              <!-- Graph History -->
              <div v-if="activeTab === 'json'" class="form-section">
                <h3>Graph History</h3>
                <div
                  id="historyList"
                  tabindex="0"
                  @keydown="handleHistoryKeydown"
                  class="list-group"
                  style="max-height: 600px; overflow-y: auto; border: 1px solid #ddd; padding: 5px"
                >
                  <button
                    v-for="(history, index) in graphHistory"
                    :key="index"
                    @click="onHistoryItemClick(index)"
                    :class="[
                      'list-group-item',
                      'list-group-item-action',
                      { active: index === selectedHistoryIndex },
                    ]"
                    style="cursor: pointer"
                    :aria-selected="index === selectedHistoryIndex"
                    role="option"
                  >
                    Version {{ history.version }} - {{ history.timestamp }}
                  </button>
                  <p v-if="graphHistory.length === 0" class="list-group-item text-center">
                    No history found for the current graph ID.
                  </p>
                </div>
              </div>
              <!-- Node Info Tab -->
              <div v-if="activeTab === 'node-info'" class="form-section">
                <h3>Node Information</h3>
                <div v-if="selectedElement">
                  <h4>{{ selectedElement.label }}</h4>
                  <textarea
                    v-if="selectedElement.info"
                    readonly
                    class="form-control mb-3"
                    style="height: 600px; font-family: monospace; white-space: pre-wrap"
                    v-model="selectedElement.info"
                  ></textarea>
                  <p v-else class="text-muted">No additional information available.</p>
                  <!-- Bibliographic References -->
                  <div v-if="selectedElement.bibl && selectedElement.bibl.length" class="mt-3">
                    <h5>Bibliographic References:</h5>
                    <ul class="list-unstyled">
                      <li v-for="(reference, index) in selectedElement.bibl" :key="index">
                        {{ reference }}
                      </li>
                    </ul>
                  </div>
                </div>
                <div v-else>
                  <p class="text-muted">Select a node or connection to see details.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Graph Editor -->
        <div class="col-md-9 main-panel">
          <div class="row">
            <!-- Control Panel (Search and History) -->
            <div class="col-12 control-panel bg-light p-3 border-bottom">
              <div class="row align-items-center">
                <!-- Search Field -->
                <div class="col-md-6 mb-2">
                  <label for="searchField" class="form-label"><strong>Search Nodes:</strong></label>
                  <input
                    id="searchField"
                    v-model="searchQuery"
                    @input="searchNodes"
                    type="text"
                    class="form-control"
                    placeholder="Search by node name..."
                  />
                </div>
                <!-- Buttons -->
                <div class="col-md-6 mb-2 text-end">
                  <button @click="centerAndZoom" class="btn btn-outline-secondary me-2">
                    Center and Zoom
                  </button>
                  <button @click="updateGraphView" class="btn btn-outline-primary me-2">
                    Update Graph
                  </button>
                  <button @click="saveCurrentGraph" class="btn btn-primary">
                    Save Current Graph
                  </button>
                </div>
              </div>
            </div>

            <!-- Graph Editor -->
            <div class="col-12 graph-content">
              <div class="row">
                <div class="col-md-12 graph-editor p-3">
                  <div
                    id="cy"
                    style="width: 100%; height: calc(100vh - 300px); border: 1px solid #ddd"
                  ></div>
                </div>
              </div>
            </div>
            <!-- JSON Editor -->
            <div class="col-12">
              <label for="jsoneditor" class="form-label"><strong>Graph Json Editor:</strong></label>
              <textarea
                id="JsonEditor"
                v-model="graphJson"
                class="form-control"
                style="height: 300px; font-family: monospace; white-space: pre-wrap"
              ></textarea>
              <button @click="updateGraphFromJson" class="btn btn-primary mt-3">
                Update Graph from JSON
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import cytoscape from 'cytoscape'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

// State refs
const cyInstance = ref(null)
const graphStore = useKnowledgeGraphStore()
const selectedElement = ref(null)
const searchQuery = ref('')
const validationErrors = ref([])
const saveMessage = ref('')
const graphHistory = ref([])
const selectedHistoryIndex = ref(-1)
const knowledgeGraphs = ref([])
const selectedGraphId = ref('')
const graphJson = ref(`{
  nodes: [
    { id: 'main', label: 'Main Node', color: 'blue' },
    { id: 'first', label: 'First Node', color: 'red' },
    { id: 'node3', label: 'Node 3', color: 'green' },
    { id: 'Asgard', label: 'Asgard', color: 'goldenrod' }
  ],
  edges: [
    { source: 'main', target: 'first' }
  ]
}`)
const sidebarCollapsed = ref(false)
const activeTab = ref('form')

// Toggle sidebar
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// Initialize standard graph
const initializeStandardGraph = () => {
  const standardGraph = {
    nodes: [
      { id: 'node1', label: 'Node 1', color: 'blue' },
      { id: 'node2', label: 'Node 2', color: 'green' },
      { id: 'node3', label: 'Node 3', color: 'red' },
      {
        id: 'node4',
        label: 'Node 4',
        color: 'purple',
        type: 'infonode',
        info: 'This is Node 4, an example of an info node.',
      },
    ],
    edges: [
      { source: 'node1', target: 'node2' },
      { source: 'node2', target: 'node3' },
    ],
  }

  graphStore.nodes = standardGraph.nodes.map((node) => ({
    data: {
      id: node.id,
      label: node.label,
      color: node.color, // Preserve color from standardGraph
      type: node.type || null,
      info: node.info || null,
    },
  }))
  graphStore.edges = standardGraph.edges.map((edge) => ({
    data: {
      source: edge.source,
      target: edge.target,
    },
  }))

  const jsonString = JSON.stringify(
    {
      nodes: graphStore.nodes.map((node) => node.data),
      edges: graphStore.edges.map((edge) => edge.data),
    },
    null,
    2,
  )

  graphJson.value = jsonString
  graphStore.graphJson = jsonString

  if (cyInstance.value) {
    cyInstance.value.elements().remove()
    cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
    cyInstance.value.layout({ name: 'grid' }).run()
  }
}

// Search nodes
const searchNodes = () => {
  if (!cyInstance.value) return

  cyInstance.value.elements().removeClass('highlighted')

  if (searchQuery.value.trim() === '') return

  const matchingNodes = cyInstance.value
    .nodes()
    .filter((node) => node.data('label').toLowerCase().includes(searchQuery.value.toLowerCase()))

  matchingNodes.addClass('highlighted')

  if (matchingNodes.length > 0) {
    cyInstance.value.fit(matchingNodes, 50)
  }
}

// Add node
const addNode = () => {
  const id = `node${graphStore.nodes.length + 1}`
  const label = `Node ${graphStore.nodes.length + 1}`
  const newNode = { data: { id, label, color: 'gray' } } // Default to gray for new nodes
  graphStore.addNode(newNode)
  cyInstance.value.add(newNode)
}

// Add edge
const addEdge = () => {
  if (graphStore.nodes.length < 2) {
    alert('You need at least two nodes to create an edge.')
    return
  }
  const source = graphStore.nodes[graphStore.nodes.length - 2].data.id
  const target = graphStore.nodes[graphStore.nodes.length - 1].data.id
  const newEdge = { data: { id: `${source}_${target}`, source, target } }
  graphStore.addEdge(newEdge)
  cyInstance.value.add(newEdge)
}

// Save graph
const saveGraph = async () => {
  const graphData = {
    metadata: graphStore.graphMetadata,
    nodes: graphStore.nodes,
    edges: graphStore.edges,
  }

  try {
    const response = await fetch('https://knowledge.vegvisr.org/saveknowgraph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(graphData),
    })

    if (response.ok) {
      const result = await response.json()
      alert('Knowledge Graph saved successfully!')
      graphStore.currentGraphId = result.id
      fetchKnowledgeGraphs()
    } else {
      alert('Failed to save the Knowledge Graph.')
    }
  } catch (error) {
    console.error('Error saving the Knowledge Graph:', error)
    alert('An error occurred while saving the Knowledge Graph.')
  }
}

// Generate UUID
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Save current graph
const saveCurrentGraph = async () => {
  if (!graphStore.currentGraphId) {
    alert('No graph ID is set. Please save the graph first.')
    return
  }

  try {
    cyInstance.value.nodes().forEach((node) => {
      const updatedNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
      if (updatedNode) {
        updatedNode.position = node.position()
      }
    })

    const parsedGraph = JSON.parse(graphStore.graphJson)

    if (!parsedGraph.nodes || !parsedGraph.edges) {
      alert('Invalid graph data. Please ensure the JSON contains "nodes" and "edges".')
      return
    }

    const nodesWithPositions = parsedGraph.nodes.map((node) => ({
      id: node.id || generateUUID(),
      label: node.label,
      color: node.color || 'gray', // Use color from JSON or default to gray
      type: node.type || null,
      info: node.info || null,
      bibl: Array.isArray(node.bibl) ? node.bibl : [],
      position: graphStore.nodes.find((n) => n.data.id === node.id)?.position || { x: 0, y: 0 },
    }))

    const edgesWithData = parsedGraph.edges.map((edge) => ({
      id: edge.id || `${edge.source}_${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label || null,
      info: edge.info || null,
    }))

    const graphData = {
      metadata: graphStore.graphMetadata,
      nodes: nodesWithPositions,
      edges: edgesWithData,
    }

    const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: graphStore.currentGraphId,
        graphData,
      }),
    })

    if (response.ok) {
      saveMessage.value = 'Graph saved successfully with history!'
      fetchGraphHistory()
    } else {
      console.error('Failed to save the graph with history:', await response.text())
      saveMessage.value = 'Failed to save the graph with history.'
    }

    setTimeout(() => {
      saveMessage.value = ''
    }, 3000)
  } catch (error) {
    console.error('Error saving the graph with history:', error)
    alert('An error occurred while saving the graph. Please check the JSON format.')
  }
}

// Center and zoom
const centerAndZoom = () => {
  if (cyInstance.value) {
    cyInstance.value.fit()
  }
}

// Parse color (updated to preserve valid colors)
const parseColor = (color) => {
  if (!color) return 'gray' // Default to gray if no color is provided
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.fillStyle = color
  return ctx.fillStyle === color ? color : 'gray' // Return original color if valid, else gray
}

// Update graph from JSON
const updateGraphFromJson = () => {
  try {
    const parsedGraph = JSON.parse(graphStore.graphJson)

    if (parsedGraph.nodes && parsedGraph.edges) {
      graphStore.nodes = parsedGraph.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: node.color, // Use color from JSON
          type: node.type || null,
          info: node.info || null,
        },
        position: node.position || { x: 0, y: 0 },
      }))
      graphStore.edges = parsedGraph.edges.map((edge) => ({
        data: {
          source: edge.source,
          target: edge.target,
        },
      }))
      cyInstance.value.elements().remove()
      cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
      cyInstance.value.layout({ name: 'preset' }).run()
    }
  } catch (error) {
    console.error('Invalid JSON format:', error)
    alert('Invalid JSON format. Please check the input.')
  }
}

// Update graph view
const updateGraphView = () => {
  try {
    const parsedGraph = JSON.parse(graphJson.value)
    if (parsedGraph.nodes && parsedGraph.edges) {
      graphStore.nodes = parsedGraph.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: node.color, // Use color from JSON
          type: node.type || null,
          info: node.info || null,
        },
      }))
      graphStore.edges = parsedGraph.edges.map((edge) => ({
        data: {
          source: edge.source,
          target: edge.target,
        },
      }))
      cyInstance.value.elements().remove()
      cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
      cyInstance.value
        .layout({
          name: 'cose',
          animate: true,
          animationDuration: 1000,
          fit: true,
          nodeRepulsion: 10000,
          idealEdgeLength: 100,
        })
        .run()
    }
  } catch (error) {
    console.error('Invalid JSON format:', error)
    alert('Invalid JSON format. Please check the input.')
  }
}

// Fetch knowledge graphs
const fetchKnowledgeGraphs = async () => {
  try {
    const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
    if (response.ok) {
      const data = await response.json()
      knowledgeGraphs.value = data.results || []
      console.log('Fetched knowledge graphs:', knowledgeGraphs.value)
    } else {
      console.error('Failed to fetch knowledge graphs')
    }
  } catch (error) {
    console.error('Error fetching knowledge graphs:', error)
  }
}

// Load selected graph
const loadSelectedGraph = async () => {
  const graphIdToLoad = selectedGraphId.value
  if (!graphIdToLoad) {
    console.warn('No graph ID selected.')
    return
  }

  try {
    const response = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${graphIdToLoad}`)
    if (response.ok) {
      let graphData = await response.json()

      if (typeof graphData === 'string') {
        graphData = JSON.parse(graphData)
      }

      if (!graphData.nodes || !graphData.edges) {
        console.warn('Invalid graph data structure:', graphData)
        graphStore.graphJson = JSON.stringify(graphData, null, 2)
        return
      }

      graphStore.setCurrentGraphId(graphIdToLoad)
      graphStore.graphMetadata = graphData.metadata || { title: '', description: '', createdBy: '' }
      graphStore.nodes = graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: node.color, // Use color from database
          type: node.type || null,
          info: node.info || null,
          bibl: Array.isArray(node.bibl) ? node.bibl : [],
        },
        position: node.position || { x: 0, y: 0 },
      }))
      graphStore.edges = graphData.edges.map((edge) => ({
        data: {
          source: edge.source,
          target: edge.target,
        },
      }))

      graphStore.graphJson = JSON.stringify(
        {
          nodes: graphStore.nodes.map((node) => ({
            ...node.data,
            position: node.position,
          })),
          edges: graphStore.edges.map((edge) => edge.data),
        },
        null,
        2,
      )

      if (cyInstance.value) {
        cyInstance.value.elements().remove()
        cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
        cyInstance.value.layout({ name: 'preset' }).run()
        cyInstance.value.fit()
      }
    } else {
      console.error('Failed to load the selected graph:', response.statusText)
    }
  } catch (error) {
    console.error('Error loading the selected graph:', error)
  }
}

// Fetch graph history
const fetchGraphHistory = async () => {
  if (!graphStore.currentGraphId) {
    console.warn('No currentGraphId found. Cannot fetch history.')
    return
  }

  try {
    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraphhistory?id=${graphStore.currentGraphId}`,
    )
    if (response.ok) {
      const data = await response.json()
      if (data.history && data.history.results) {
        graphHistory.value = data.history.results.map((item) => ({
          version: item.version,
          timestamp: item.timestamp,
        }))
        console.log('Fetched graph history:', graphHistory.value)
      } else {
        graphHistory.value = []
      }
    } else {
      console.error('Failed to fetch graph history:', response.statusText)
      graphHistory.value = []
    }
  } catch (error) {
    console.error('Error fetching graph history:', error)
    graphHistory.value = []
  }
}

// Load graph version
const loadGraphVersion = async (version) => {
  if (!graphStore.currentGraphId) {
    console.warn('No currentGraphId found. Cannot load version.')
    return
  }

  try {
    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraphversion?id=${graphStore.currentGraphId}&version=${version}`,
    )
    if (response.ok) {
      const graphData = await response.json()

      graphStore.nodes = graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: node.color, // Use color from database
          type: node.type || null,
          info: node.info || null,
        },
        position: node.position || { x: 0, y: 0 },
      }))
      graphStore.edges = graphData.edges.map((edge) => ({
        data: {
          source: edge.source,
          target: edge.target,
        },
      }))
      graphStore.graphJson = JSON.stringify(graphData, null, 2)

      if (cyInstance.value) {
        cyInstance.value.elements().remove()
        cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
        cyInstance.value.layout({ name: 'preset' }).run()
        cyInstance.value.fit()
      }
    } else {
      console.error('Failed to load graph version:', response.statusText)
    }
  } catch (error) {
    console.error('Error loading graph version:', error)
  }
}

// Handle history keyboard navigation
const handleHistoryKeydown = (event) => {
  if (graphHistory.value.length === 0) return

  if (event.key === 'ArrowDown') {
    selectedHistoryIndex.value = (selectedHistoryIndex.value + 1) % graphHistory.value.length
    ensureHistoryItemVisible(selectedHistoryIndex.value)
    selectHistoryVersion(selectedHistoryIndex.value)
    event.preventDefault()
  } else if (event.key === 'ArrowUp') {
    selectedHistoryIndex.value =
      (selectedHistoryIndex.value - 1 + graphHistory.value.length) % graphHistory.value.length
    ensureHistoryItemVisible(selectedHistoryIndex.value)
    selectHistoryVersion(selectedHistoryIndex.value)
    event.preventDefault()
  } else if (event.key === 'Enter') {
    if (selectedHistoryIndex.value >= 0) {
      selectHistoryVersion(selectedHistoryIndex.value)
    }
  }
}

// Ensure history item is visible
const ensureHistoryItemVisible = (index) => {
  const historyList = document.getElementById('historyList')
  const items = historyList?.getElementsByClassName('list-group-item')
  if (items && items[index]) {
    items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

// Select history version
const selectHistoryVersion = (index) => {
  const selectedVersion = graphHistory.value[index]
  if (selectedVersion) {
    loadGraphVersion(selectedVersion.version)
  }
}

// Handle history item click
const onHistoryItemClick = (index) => {
  selectedHistoryIndex.value = index
  selectHistoryVersion(index)
}

// Cytoscape initialization and lifecycle
onMounted(() => {
  console.log('Component mounted. Initializing Cytoscape...')
  const cyContainer = document.getElementById('cy')
  if (!cyContainer) {
    console.error('Cytoscape container #cy not found!')
    return
  }

  try {
    cyInstance.value = cytoscape({
      container: cyContainer,
      elements: [],
      style: [
        {
          selector: 'node',
          style: {
            label: (ele) =>
              ele.data('type') === 'info' ? ele.data('label') + ' ℹ️' : ele.data('label'),
            'background-color': 'data(color)',
            color: '#000',
            'text-valign': 'center',
            'text-halign': 'center',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#999',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#999',
            'curve-style': 'bezier',
          },
        },
        {
          selector: '.highlighted',
          style: {
            'border-width': 4,
            'border-color': 'yellow',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': 'blue',
            'background-color': 'lightblue',
          },
        },
      ],
      layout: {
        name: 'preset',
      },
      boxSelectionEnabled: true,
    })

    const debounce = (func, delay) => {
      let timeout
      return (...args) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), delay)
      }
    }

    const updateLayout = debounce(() => {
      if (cyInstance.value) {
        cyInstance.value.layout({ name: 'preset', fit: true }).run()
      }
    }, 300)

    cyInstance.value.on('tap', 'node, edge', (event) => {
      const element = event.target
      const data = element.data()
      selectedElement.value = {
        label: data.label || `${data.source} → ${data.target}`,
        info: data.info || null,
        bibl: Array.isArray(data.bibl) ? data.bibl : [],
      }
    })

    cyInstance.value.on('dragfree', 'node', (event) => {
      const node = event.target
      const updatedNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
      if (updatedNode) {
        updatedNode.position = node.position()
      }
      updateLayout()
    })

    cyInstance.value.on('select', 'node', (event) => {
      const node = event.target
      node.addClass('selected')
    })

    cyInstance.value.on('unselect', 'node', (event) => {
      const node = event.target
      node.removeClass('selected')
    })

    if (graphStore.currentGraphId) {
      console.log(`Current Graph ID: ${graphStore.currentGraphId}. Loading graph...`)
      selectedGraphId.value = graphStore.currentGraphId
      loadSelectedGraph()
    } else {
      console.log('No currentGraphId. Initializing standard graph...')
      initializeStandardGraph()
    }

    fetchKnowledgeGraphs()
    fetchGraphHistory()
  } catch (error) {
    console.error('Error initializing Cytoscape:', error)
  }
})

// Watch graph changes
watch(
  () => [graphStore.nodes, graphStore.edges],
  () => {
    graphJson.value = JSON.stringify(
      {
        nodes: graphStore.nodes.map((node) => node.data),
        edges: graphStore.edges.map((edge) => edge.data),
      },
      null,
      2,
    )
  },
  { deep: true },
)
</script>

<style scoped>
/* Bootstrap CDN included in index.html or main app */
.admin-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.top-bar {
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.main-content {
  flex: 1;
  overflow: auto;
}

.sidebar {
  transition: width 0.3s;
  width: 25%;
  overflow-y: auto;
  padding: 20px;
}

.sidebar.collapsed {
  width: 0;
  padding: 0;
  overflow: auto;
}

.main-panel {
  height: 100%;
  overflow: auto;
}

.control-panel {
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.graph-editor {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.info-section {
  background: #f8f9fa;
  border-radius: 8px;
  overflow-y: auto;
  max-height: calc(100vh - 300px);
}

.graph-content {
  height: calc(100vh - 200px);
}

.form-section {
  background: transparent;
}

.nav-tabs .nav-link {
  border-radius: 0;
}

.nav-tabs .nav-link.active {
  background: #fff;
  border-bottom: 2px solid #007bff;
}

.btn {
  transition: background-color 0.2s;
}

.list-group-item-action:hover {
  background-color: #e9ecef;
}

.alert {
  border-radius: 8px;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    z-index: 1000;
    height: 100%;
    width: 80%;
    left: 0;
    transform: translateX(-100%);
  }

  .sidebar.collapsed {
    transform: translateX(0);
  }

  .main-panel {
    width: 100%;
  }
}
</style>
