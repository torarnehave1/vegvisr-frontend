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
          <!-- Validation Errors -->
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
      <!-- Success Message -->

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
                  <button type="submit" class="btn btn-primary">Create Knowledge Graph</button>
                </form>
              </div>
              <!-- Graph History -->
              <div v-if="activeTab === 'json'" class="form-section">
                <h3>Development Story</h3>
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
                    style="height: 150px; font-family: monospace; white-space: pre-wrap"
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
                </div>
              </div>
            </div>

            <!-- Graph Editor -->
            <div class="col-12 graph-content">
              <div class="row">
                <h2 class="graph-title text-center">Knowledge Story Graph</h2>
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
              <div v-if="saveMessage" class="alert alert-success text-center" role="alert">
                {{ saveMessage }}
              </div>
              <div
                v-if="validationMessage"
                class="alert text-center"
                :class="validationMessageClass"
                role="alert"
              >
                {{ validationMessage }}
              </div>

              <div class="d-flex justify-content-between mb-3">
                <button @click="verifyJson" class="btn btn-secondary">Verify JSON</button>
                <button @click="saveCurrentGraph" class="btn btn-primary">
                  Save Current Graph
                </button>
              </div>

              <label for="jsoneditor" class="form-label"><strong>Graph Json Editor:</strong></label>
              <textarea
                id="JsonEditor"
                v-model="graphJson"
                class="form-control"
                style="height: 300px; font-family: monospace; white-space: pre-wrap"
              ></textarea>
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
const validationMessage = ref('')
const validationMessageClass = ref('alert-danger') // Default to error styling

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
      color: node.color,
      type: node.type || null,
      info: node.info || null,
    },
  }))
  graphStore.edges = standardGraph.edges.map((edge) => ({
    data: {
      id: `${edge.source}_${edge.target}`, // Ensure edge ID is set
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

// Save graph
const saveGraph = async () => {
  // Update node positions from Cytoscape
  if (cyInstance.value) {
    cyInstance.value.nodes().forEach((node) => {
      const graphNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
      if (graphNode) {
        graphNode.position = node.position()
      }
    })
  }

  const graphData = {
    metadata: graphStore.graphMetadata,
    nodes: graphStore.nodes.map((node) => ({
      ...node.data,
      position: node.position,
      type: node.data.type || null,
      info: node.data.info || null,
    })),
    edges: graphStore.edges.map((edge) => ({
      id: edge.data.id, // Preserve edge ID
      source: edge.data.source,
      target: edge.data.target,
      label: edge.data.label || null,
      type: edge.data.type || null,
      info: edge.data.info || null,
    })),
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

// Save current graph
const saveCurrentGraph = async () => {
  if (!graphStore.currentGraphId) {
    alert('No graph ID is set. Please save the graph first.')
    return
  }

  // Update node positions from Cytoscape
  if (cyInstance.value) {
    cyInstance.value.nodes().forEach((node) => {
      const graphNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
      if (graphNode) {
        graphNode.position = node.position()
      }
    })
  }

  try {
    // Parse the JSON Editor content and update the graphStore
    const parsedGraph = JSON.parse(graphJson.value)

    if (!parsedGraph.nodes || !parsedGraph.edges) {
      alert('Invalid graph data. Please ensure the JSON contains "nodes" and "edges".')
      return
    }

    // Check for version mismatch
    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${graphStore.currentGraphId}`,
    )
    if (response.ok) {
      const latestGraph = await response.json()
      const latestVersion = latestGraph.metadata.version

      if (graphStore.currentVersion !== latestVersion) {
        const userConfirmed = confirm(
          `Version mismatch detected. The current version is ${latestVersion}, but you are working on version ${graphStore.currentVersion}. Do you want to overwrite it?`,
        )

        if (!userConfirmed) {
          return // Abort save if the user does not confirm
        }

        // Update the current version to the latest version
        graphStore.setCurrentVersion(latestVersion)
      }
    }

    // Prepare the graph data with metadata
    const graphData = {
      metadata: {
        title: graphStore.graphMetadata.title || 'Untitled Graph',
        description: graphStore.graphMetadata.description || '',
        createdBy: graphStore.graphMetadata.createdBy || 'Unknown',
        version: graphStore.currentVersion || 1,
      },
      nodes: graphStore.nodes.map((node) => ({
        ...node.data,
        position: node.position,
        type: node.data.type || null,
        info: node.data.info || null,
      })),
      edges: graphStore.edges.map((edge) => ({
        id: edge.data.id, // Preserve edge ID
        source: edge.data.source,
        target: edge.data.target,
        label: edge.data.label || null,
        type: edge.data.type || null,
        info: edge.data.info || null,
      })),
    }

    // Save the graph to the backend
    const saveResponse = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: graphStore.currentGraphId,
        graphData,
        override: true,
      }),
    })

    if (saveResponse.ok) {
      const result = await saveResponse.json()
      saveMessage.value = 'Saved successfully!'
      graphStore.setCurrentVersion(result.newVersion)
      setTimeout(() => {
        saveMessage.value = ''
      }, 2000)
      fetchGraphHistory()
    } else {
      alert('Failed to save the graph.')
    }
  } catch (error) {
    console.error('Error saving the graph:', error)
    alert('An error occurred while saving the graph. Please check the JSON format.')
  }
}

// Center and zoom
const centerAndZoom = () => {
  if (cyInstance.value) {
    cyInstance.value.fit()
  }
}

// Update graph from JSON
const updateGraphFromJson = (parsedJson) => {
  graphStore.nodes = parsedJson.nodes.map((node) => ({
    data: {
      id: node.id,
      label: node.label,
      color: node.color || 'gray',
      type: node.type || null,
      info: node.info || null,
      bibl: Array.isArray(node.bibl) ? node.bibl : [],
      imageWidth: node.imageWidth || null,
      imageHeight: node.imageHeight || null,
    },
    position: node.position || null,
  }))

  graphStore.edges = parsedJson.edges.map(({ source, target, type, info }) => ({
    data: {
      id: `${source}_${target}`, // Ensure edge ID is set
      source,
      target,
      type,
      info,
    },
  }))
}

// Verify JSON
const verifyJson = () => {
  try {
    const parsedJson = JSON.parse(graphJson.value)
    console.log('Parsed JSON edges:', parsedJson.edges)

    // Validate structure
    if (!parsedJson.nodes || !parsedJson.edges) {
      validationMessage.value = 'Invalid graph data. Ensure JSON contains "nodes" and "edges".'
      validationMessageClass.value = 'alert-danger'
      setTimeout(() => {
        validationMessage.value = ''
        validationMessageClass.value = ''
      }, 2000)
      return
    }

    // Update nodes in the store
    graphStore.nodes = parsedJson.nodes.map((node) => {
      const existingNode = graphStore.nodes.find((n) => n.data.id === node.id)
      return {
        data: {
          id: node.id,
          label: node.label,
          color: node.color || 'gray',
          type: node.type || null,
          info: node.info || null,
          bibl: Array.isArray(node.bibl) ? node.bibl : [],
          imageWidth: node.imageWidth || null,
          imageHeight: node.imageHeight || null,
        },
        position: existingNode?.position || null,
      }
    })

    // Update edges in the store
    graphStore.edges = parsedJson.edges.map(({ source, target, type, info }) => ({
      data: {
        id: `${source}_${target}`, // Ensure edge ID is set
        source,
        target,
        type,
        info,
      },
    }))

    console.log('Graph store edges after verification:', graphStore.edges)

    // Update the graphJson in the store
    graphStore.graphJson = JSON.stringify(
      {
        nodes: graphStore.nodes.map((node) => node.data),
        edges: graphStore.edges.map((edge) => edge.data),
      },
      null,
      2,
    )

    // Update Cytoscape view
    if (cyInstance.value) {
      cyInstance.value.elements().remove()
      cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])

      // Lock nodes with existing positions
      cyInstance.value.nodes().forEach((node) => {
        const storedNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
        if (storedNode?.position) {
          console.log(`Locking node ${node.data('id')} at position`, storedNode.position)
          node.position(storedNode.position)
          node.lock()
        }
      })

      // Apply the 'cose' layout
      cyInstance.value
        .layout({
          name: 'cose',
          animate: true,
          fit: true,
          padding: 30,
        })
        .run()

      // Unlock all nodes after layout
      cyInstance.value.nodes().forEach((node) => {
        const storedNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
        if (storedNode?.position) {
          console.log(`Restoring position for node ${node.data('id')}`, storedNode.position)
          node.position(storedNode.position)
        }
        node.unlock()
      })

      // Log final positions
      cyInstance.value.nodes().forEach((node) => {
        console.log(`Final position of node ${node.data('id')}:`, node.position())
      })
    }

    // Update validation message
    validationMessage.value = 'JSON is valid!'
    validationMessageClass.value = 'alert-success'
    setTimeout(() => {
      validationMessage.value = ''
      validationMessageClass.value = ''
    }, 2000)
  } catch (error) {
    validationMessage.value = `Invalid JSON: ${error.message}`
    validationMessageClass.value = 'alert-danger'
    setTimeout(() => {
      validationMessage.value = ''
      validationMessageClass.value = ''
    }, 2000)
    console.error('Error parsing JSON:', error)
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
        return
      }

      // Update the graph store
      graphStore.nodes = graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: node.color || 'gray',
          type: node.type || null,
          info: node.info || null,
          bibl: Array.isArray(node.bibl) ? node.bibl : [],
          imageWidth: node.imageWidth || null,
          imageHeight: node.imageHeight || null,
        },
        position: node.position || null,
      }))

      // Explicitly set edge IDs to ${source}_${target}
      graphStore.edges = graphData.edges.map(({ source, target, label, type, info }) => ({
        data: {
          id: `${source}_${target}`,
          source,
          target,
          label: label || null,
          type: type || null,
          info: info || null,
        },
      }))

      // Update Cytoscape view
      if (cyInstance.value) {
        cyInstance.value.elements().remove()
        cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
        cyInstance.value.layout({ name: 'preset' }).run()
        cyInstance.value.fit()
      }

      // Update the current graph ID and version
      graphStore.setCurrentGraphId(graphIdToLoad)
      graphStore.setCurrentVersion(graphData.metadata.version)

      // Update the JSON Editor
      graphJson.value = JSON.stringify(
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

      // Fetch the history for the newly loaded graph
      await fetchGraphHistory()

      console.log('Graph loaded successfully:', graphStore.nodes, graphStore.edges)
      console.log('Current Graph ID updated to:', graphStore.currentGraphId)
      console.log('Current Version updated to:', graphStore.currentVersion)
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

      // Update nodes and edges in the store
      graphStore.nodes = graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: node.color || 'gray',
          type: node.type || null,
          info: node.info || null,
          bibl: Array.isArray(node.bibl) ? node.bibl : [],
          imageWidth: node.imageWidth || 'auto',
          imageHeight: node.imageHeight || 'auto',
        },
        position: node.position || { x: 0, y: 0 },
      }))

      // Explicitly set edge IDs to ${source}_${target}
      graphStore.edges = graphData.edges.map(({ source, target, label, type, info }) => ({
        data: {
          id: `${source}_${target}`,
          source,
          target,
          label: label || null,
          type: type || null,
          info: info || null,
        },
      }))

      // Update the JSON Editor
      graphJson.value = JSON.stringify(
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

      // Update Cytoscape view
      if (cyInstance.value) {
        cyInstance.value.elements().remove()
        cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
        cyInstance.value.layout({ name: 'preset' }).run()
        cyInstance.value.fit()
      }

      // Update the current version in the store
      graphStore.setCurrentVersion(version)
      console.log(`Loaded version ${version} for graph ID: ${graphStore.currentGraphId}`)
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
    selectedElement.value = null // Reset the Info tab
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
            label: (ele) => (ele.data('type') === 'info' ? 'ℹ️' : ''),
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
          selector: 'node[type="notes"]',
          style: {
            shape: 'round-rectangle',
            'background-color': (ele) => ele.data('color') || '#f9f9f9',
            'border-width': 1,
            'border-color': '#ccc',
            label: (ele) => `${ele.data('label')}\n\n${ele.data('info')}`,
            'text-wrap': 'wrap',
            'text-max-width': '250px',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '16px',
            padding: '10px',
            width: '280px',
            height: 'label',
          },
        },
        {
          selector: 'node[type="background"]',
          style: {
            shape: 'rectangle',
            'background-image': (ele) => ele.data('label'),
            'background-fit': 'cover',
            'background-opacity': 1,
            'border-width': 0,
            width: (ele) => ele.data('imageWidth'),
            height: (ele) => ele.data('imageHeight'),
            label: 'data(label)',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'font-size': '0px',
            color: '#000',
            'background-image-crossorigin': 'anonymous',
          },
        },
        {
          selector: 'node[type="title"]',
          style: {
            shape: 'rectangle',
            'background-opacity': 0,
            'border-width': 1,
            'font-size': '24px',
            'font-weight': 'bold',
            color: 'black',
            'text-valign': 'center',
            'text-halign': 'center',
            width: 'label',
            height: 'label',
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
      wheelSensitivity: 0.2,
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
        nodes: graphStore.nodes.map((node) => ({
          ...node.data,
          imageWidth: node.data.imageWidth || null,
          imageHeight: node.data.imageHeight || null,
        })),
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

  .graph-title {
    text-align: center;
    margin-bottom: 10px;
    font-size: 1.5rem;
    color: #333;
  }
}
</style>
