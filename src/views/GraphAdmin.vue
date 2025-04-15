<template>
  <div class="admin-page">
    <!-- Dropdown to Select Knowledge Graph -->
    <div class="graph-selector">
      <label for="graphDropdown"><strong>Select Knowledge Graph:</strong></label>
      <select id="graphDropdown" v-model="selectedGraphId" @change="loadSelectedGraph">
        <option value="" disabled>Select a graph</option>
        <option v-for="graph in knowledgeGraphs" :key="graph.id" :value="graph.id">
          {{ graph.title }}
        </option>
      </select>
    </div>

    <!-- Current Graph ID Section -->
    <div class="current-graph-id">
      <p>
        <strong>Current Graph ID:</strong>
        <span>{{ graphStore.currentGraphId || 'Not saved yet' }}</span>
      </p>
    </div>

    <!-- Validation Error Info Box -->
    <div v-if="validationErrors.length" class="alert alert-danger" role="alert">
      <strong>Graph Validation Errors:</strong>
      <ul>
        <li v-for="(error, index) in validationErrors" :key="index">{{ error }}</li>
      </ul>
    </div>

    <!-- Form Section -->
    <div class="form-section">
      <h2>Create New Knowledge Graph</h2>
      <form @submit.prevent="saveGraph">
        <label>
          Title:
          <input v-model="graphStore.graphMetadata.title" type="text" required />
        </label>
        <label>
          Description:
          <textarea v-model="graphStore.graphMetadata.description"></textarea>
        </label>
        <label>
          Created By:
          <input v-model="graphStore.graphMetadata.createdBy" type="text" required />
        </label>
        <button type="submit">Save Knowledge Graph</button>
      </form>
    </div>

    <div class="container-fluid">
      <div class="row">
        <!-- Graph Editor Section -->
        <div class="col-md-8" style="height: 100vh; padding: 20px">
          <div class="row">
            <!-- Search Field -->
            <div class="col-md-6" style="margin-bottom: 10px">
              <label for="searchField"><strong>Search Nodes:</strong></label>
              <input
                id="searchField"
                v-model="searchQuery"
                @input="searchNodes"
                type="text"
                placeholder="Search by node name..."
                style="width: 100%; padding: 5px; margin-bottom: 10px"
              />
            </div>

            <!-- History List -->
            <div class="col-md-6" style="margin-bottom: 10px">
              <label for="historyList"><strong>Graph History:</strong></label>
              <div
                id="historyList"
                style="border: 1px solid #ddd; padding: 10px; max-height: 150px; overflow-y: auto"
              >
                <ul v-if="graphHistory.length > 0">
                  <li
                    v-for="(history, index) in graphHistory"
                    :key="index"
                    @click="loadGraphVersion(history.version)"
                    style="cursor: pointer; display: flex; align-items: center; margin-bottom: 5px"
                  >
                    <span style="margin-right: 10px; font-size: 18px">📜</span>
                    <span>Version {{ history.version }} - {{ history.timestamp }}</span>
                  </li>
                </ul>
                <p v-else>No history found for the current graph ID.</p>
              </div>
            </div>
          </div>
          <textarea
            id="JsonEditor"
            v-model="graphStore.graphJson"
            @input="updateGraphFromJson"
            style="width: 100%; height: 150px; margin-bottom: 10px; font-family: monospace"
          ></textarea>
          <button @click="updateGraphView" style="margin-bottom: 10px">Update Graph</button>
          <button @click="saveCurrentGraph">Save Current Graph</button>
          <button @click="centerAndZoom">Center and Zoom</button>
          <!-- Save Success Info Box -->
          <div v-if="saveMessage" class="alert alert-info" role="alert">
            {{ saveMessage }}
          </div>
          <div
            id="cy"
            style="width: 100%; height: calc(100% - 210px); border: 1px solid #ddd"
          ></div>

          <div style="margin-top: 10px"></div>
        </div>

        <!-- Info Section -->
        <div
          class="col-md-4"
          style="height: 100vh; overflow-y: auto; padding: 20px; border-left: 1px solid #ddd"
        >
          <div v-if="selectedElement">
            <h3>{{ selectedElement.label }}</h3>
            <textarea
              v-if="selectedElement.info"
              readonly
              style="
                width: 100%;
                height: 150px;
                margin-top: 10px;
                font-family: monospace;
                white-space: pre-wrap;
              "
              v-model="selectedElement.info"
            ></textarea>
            <p v-else>No additional information available.</p>

            <!-- Bibliographic References -->
            <div
              v-if="selectedElement.bibl && selectedElement.bibl.length"
              style="margin-top: 20px"
            >
              <h4>Bibliographic References:</h4>
              <ul>
                <li v-for="(reference, index) in selectedElement.bibl" :key="index">
                  {{ reference }}
                </li>
              </ul>
            </div>
          </div>
          <div v-else>
            <p>Select a node or connection to see details.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, watch, nextTick } from 'vue'
import cytoscape from 'cytoscape'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

const cyInstance = ref(null)
const graphStore = useKnowledgeGraphStore()
const selectedElement = ref(null) // Add selectedElement for displaying node info
const searchQuery = ref('') // Search query for nodes
const validationErrors = ref([]) // Store validation errors
const saveMessage = ref('') // Message to display after saving

const graphHistory = ref([]) // Store the history of the current graph

// Function to search and highlight nodes
const searchNodes = () => {
  if (!cyInstance.value) return

  // Clear previous highlights
  cyInstance.value.elements().removeClass('highlighted')

  if (searchQuery.value.trim() === '') return

  // Find and highlight matching nodes
  const matchingNodes = cyInstance.value
    .nodes()
    .filter((node) => node.data('label').toLowerCase().includes(searchQuery.value.toLowerCase()))

  matchingNodes.addClass('highlighted')

  if (matchingNodes.length > 0) {
    cyInstance.value.fit(matchingNodes, 50) // Zoom to the matching nodes

    // Scroll to and select the first matching node in the JSON editor
    const jsonEditor = document.getElementById('JsonEditor') // Select the textarea by its ID
    if (jsonEditor) {
      const jsonText = jsonEditor.value
      const searchText = matchingNodes[0].data('id') // Use the node's ID for searching
      const index = jsonText.indexOf(`"id": "${searchText}"`)

      if (index !== -1) {
        // Calculate the start and end positions of the matching text
        const start = index
        const end =
          jsonText.indexOf('\n', start) !== -1 ? jsonText.indexOf('\n', start) : jsonText.length

        // Scroll to the matching text
        const beforeMatch = jsonText.substring(0, start)
        const lineHeight = 18 // Approximate line height in pixels
        const lines = beforeMatch.split('\n').length
        jsonEditor.scrollTop = (lines - 1) * lineHeight

        // Select the matching text
        nextTick(() => {
          jsonEditor.setSelectionRange(start, end)
        })
      }
    }
  }
}

const initializeStandardGraph = () => {
  const standardGraph = {
    nodes: [
      { id: 'node1', label: 'Node 1', color: 'blue' },
      { id: 'node2', label: 'Node 2', color: 'green' },
      { id: 'node3', label: 'Node 3', color: 'red' },
      {
        id: 'node4',
        label: 'Node 4',
        color: 'red',
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
      color: parseColor(node.color || 'blue'), // Validate color or default to 'blue'
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

  const jsonString = `{
  nodes: [
    ${graphStore.nodes
      .map(
        (node) =>
          `{ id: '${node.data.id}', label: '${node.data.label}', color: '${node.data.color}', type: '${node.data.type}', info: '${node.data.info}' }`,
      )
      .join(',\n    ')}
  ],
  edges: [
    ${graphStore.edges
      .map((edge) => `{ source: '${edge.data.source}', target: '${edge.data.target}' }`)
      .join(',\n    ')}
  ]
}`

  graphJson.value = jsonString
  graphStore.graphJson = jsonString // Synchronize with Pinia store

  if (cyInstance.value) {
    cyInstance.value.elements().remove()
    cyInstance.value.add([...graphStore.nodes, ...graphStore.edges]) // Add all nodes and edges
    cyInstance.value.layout({ name: 'grid' }).run()
  }
}

onMounted(() => {
  console.log('Component mounted. Checking for currentGraphId...')

  cyInstance.value = cytoscape({
    container: document.getElementById('cy'),
    elements: [],
    style: [
      {
        selector: 'node',
        style: {
          label: (ele) =>
            ele.data('type') === 'info' ? ele.data('label') + ' ℹ️' : ele.data('label'),
          'background-color': 'data(color)', // Use the color from node data
          color: '#000', // Text color
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
        selector: '.highlighted', // Style for highlighted nodes
        style: {
          'border-width': 4,
          'border-color': 'yellow',
        },
      },
      {
        selector: 'node:selected', // Add this block for selected nodes
        style: {
          'border-width': 4,
          'border-color': 'blue',
          'background-color': 'lightblue',
        },
      },
    ],
    layout: {
      name: 'cose',
    },
    boxSelectionEnabled: true,
  })

  cyInstance.value.on('tap', 'node, edge', (event) => {
    const element = event.target
    const data = element.data()

    selectedElement.value = {
      label: data.label || `${data.source} → ${data.target}`,
      info: data.info || null,
    }
  })

  cyInstance.value.on('tap', 'node', (event) => {
    const element = event.target
    const data = element.data()

    // Ensure bibl is an array and handle multiple entries
    const biblArray = Array.isArray(data.bibl) ? data.bibl : []

    // Update the selected element details
    selectedElement.value = {
      label: data.label || data.id,
      info: data.info || null,
      bibl: biblArray, // Assign the processed array
    }

    // Scroll the JSON editor to the clicked node
    const jsonEditor = document.getElementById('JsonEditor')
    if (jsonEditor) {
      const jsonText = jsonEditor.value
      const searchText = `"id": "${data.id}"` // Search for the node's ID in the JSON
      const index = jsonText.indexOf(searchText)

      if (index !== -1) {
        // Calculate the line number and scroll position
        const beforeMatch = jsonText.substring(0, index)
        const lineHeight = 18 // Approximate line height in pixels
        const lines = beforeMatch.split('\n').length

        jsonEditor.scrollTop = (lines - 1) * lineHeight

        // Optionally, highlight the matching text
        nextTick(() => {
          jsonEditor.focus()
          jsonEditor.setSelectionRange(index, index + searchText.length)
        })
      }
    }
  })

  cyInstance.value.on('dragfree', 'node', (event) => {
    const node = event.target
    const updatedNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
    if (updatedNode) {
      updatedNode.position = node.position() // Update the node's position in the store
    }
    //  const originalColor = node.data('originalColor') || 'blue' // Default to blue if no original color
    // node.style('background-color', originalColor) // Restore the original color after moving
  })

  cyInstance.value.on('select', 'node', (event) => {
    const node = event.target
    node.addClass('selected') // Add a CSS class for selected nodes
  })

  cyInstance.value.on('unselect', 'node', (event) => {
    const node = event.target
    node.removeClass('selected') // Remove the CSS class when unselected
  })

  if (graphStore.currentGraphId) {
    console.log(
      `currentGraphId found: ${graphStore.currentGraphId}. Loading graph from database...`,
    )
    selectedGraphId.value = graphStore.currentGraphId // Set selectedGraphId to currentGraphId
    loadSelectedGraph() // Load the graph
  } else {
    console.log('No currentGraphId found. Initializing standard preset graph...')
    initializeStandardGraph()
  }

  // Ensure textarea is updated with the initial graph JSON
  graphJson.value = `{
  nodes: [
    ${graphStore.nodes
      .map(
        (node) =>
          `{ id: '${node.data.id}', label: '${node.data.label}', color: '${node.data.color}', type: '${node.data.type}', info: '${node.data.info}' }`,
      )
      .join(',\n    ')}
  ],
  edges: [
    ${graphStore.edges
      .map((edge) => `{ source: '${edge.data.source}', target: '${edge.data.target}' }`)
      .join(',\n    ')}
  ]
}`

  fetchKnowledgeGraphs()
  fetchGraphHistory() // Fetch the history of the current graph
})

const addNode = () => {
  const id = `node${graphStore.nodes.length + 1}`
  const label = `Node ${graphStore.nodes.length + 1}`
  const newNode = { data: { id, label } }
  graphStore.addNode(newNode)
  cyInstance.value.add(newNode)
}

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

      // Update the currentGraphId in the Pinia store
      graphStore.currentGraphId = result.id
    } else {
      alert('Failed to save the Knowledge Graph.')
    }
  } catch (error) {
    console.error('Error saving the Knowledge Graph:', error)
    alert('An error occurred while saving the Knowledge Graph.')
  }
}

const generateUUID = () => {
  // Fallback for generating unique IDs
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const saveCurrentGraph = async () => {
  if (!graphStore.currentGraphId) {
    alert('No graph ID is set. Please save the graph first.')
    return
  }

  try {
    // Update positions in the graph store before saving
    cyInstance.value.nodes().forEach((node) => {
      const updatedNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
      if (updatedNode) {
        updatedNode.position = node.position() // Save the latest position
      }
    })

    // Parse the JSON from the textarea
    const parsedGraph = JSON.parse(graphStore.graphJson)

    // Validate the parsed data
    if (!parsedGraph.nodes || !parsedGraph.edges) {
      alert('Invalid graph data. Please ensure the JSON contains "nodes" and "edges".')
      return
    }

    // Map nodes and edges from the parsed JSON
    const nodesWithPositions = parsedGraph.nodes.map((node) => ({
      id: node.id || generateUUID(), // Ensure each node has a unique ID
      label: node.label,
      color: node.color || 'blue',
      type: node.type || null,
      info: node.info || null,
      bibl: Array.isArray(node.bibl) ? node.bibl : [], // Ensure bibl is an array
      position: graphStore.nodes.find((n) => n.data.id === node.id)?.position || { x: 0, y: 0 },
    }))

    const edgesWithData = parsedGraph.edges.map((edge) => ({
      id: edge.id || `${edge.source}_${edge.target}`, // Generate unique ID if missing
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

    // Log the data being sent for debugging
    console.log('Graph data being sent:', JSON.stringify(graphData, null, 2))

    // Call the saveGraphWithHistory endpoint
    const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: graphStore.currentGraphId,
        graphData,
      }),
    })

    if (response.ok) {
      const result = await response.json()
      saveMessage.value = 'Graph saved successfully with history!'
      console.log('Graph saved with history:', result)

      // Refresh the entire page
      window.location.reload()
    } else {
      const errorText = await response.text()
      console.error('Failed to save the graph with history:', errorText)
      saveMessage.value = 'Failed to save the graph with history.'
    }

    setTimeout(() => {
      saveMessage.value = '' // Clear the message after 3 seconds
    }, 3000)
  } catch (error) {
    console.error('Error saving the graph with history:', error)
    alert('An error occurred while saving the graph. Please check the JSON format.')
  }
}

const centerAndZoom = () => {
  if (cyInstance.value) {
    cyInstance.value.fit() // Centers and zooms to fit all nodes
  }
}

const graphJson = ref(
  `{
  nodes: [
    { id: 'main', label: 'Main Node', color: 'blue' },
    { id: 'first', label: 'First Node', color: 'red' },
    { id: 'node3', label: 'Node 3' },
    { id: 'Asgard', label: 'Asgard', color: 'goldenrod' }
  ],
  edges: [
    { source: 'main', target: 'first' }
  ]
}`,
)

// Utility function to validate natural language color names
const parseColor = (color) => {
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.fillStyle = color
  return ctx.fillStyle === color ? color : color // Keep the original color if invalid
}

const updateGraphFromJson = () => {
  try {
    const parsedGraph = JSON.parse(graphStore.graphJson) // Parse JSON from the editor

    if (parsedGraph.nodes && parsedGraph.edges) {
      graphStore.nodes = parsedGraph.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: parseColor(node.color || 'blue'),
          type: node.type || null,
          info: node.info || null,
        },
        position: node.position || { x: 0, y: 0 }, // Apply saved position or default
      }))
      graphStore.edges = parsedGraph.edges.map((edge) => ({
        data: {
          source: edge.source,
          target: edge.target,
        },
      }))
      cyInstance.value.elements().remove()
      cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
      cyInstance.value.layout({ name: 'preset' }).run() // Use 'preset' layout to apply positions
    }
  } catch (error) {
    console.error('Invalid JSON format:', error)
  }
}

const updateGraphView = () => {
  try {
    const parsedGraph = eval(`(${graphJson.value})`) // Parse JSON with single quotes
    if (parsedGraph.nodes && parsedGraph.edges) {
      graphStore.nodes = parsedGraph.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: parseColor(node.color || 'blue'), // Validate color or default to 'blue'
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
          nodeRepulsion: 10000, // Higher value increases spacing between nodes
          idealEdgeLength: 100,
        })
        .run()
    }
  } catch (error) {
    console.error('Invalid JSON format:', error)
  }
}

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

const knowledgeGraphs = ref([]) // List of knowledge graphs
const selectedGraphId = ref('') // Selected graph ID

// Fetch the list of knowledge graphs from the backend
const fetchKnowledgeGraphs = async () => {
  try {
    const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
    if (response.ok) {
      const data = await response.json()
      knowledgeGraphs.value = data.results // Extract the `results` field
      console.log('Fetched knowledge graphs:', knowledgeGraphs.value)
    } else {
      console.error('Failed to fetch knowledge graphs')
    }
  } catch (error) {
    console.error('Error fetching knowledge graphs:', error)
  }
}

// Load the selected graph and update the graph view
const loadSelectedGraph = async () => {
  const graphIdToLoad = selectedGraphId.value // Use the selected graph ID
  if (!graphIdToLoad) {
    console.warn('No graph ID selected.')
    return
  }

  try {
    const response = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${graphIdToLoad}`)
    if (response.ok) {
      let graphData = await response.json()

      // Handle double-quoted JSON response
      if (typeof graphData === 'string') {
        graphData = JSON.parse(graphData)
      }

      // Validate the response structure
      if (!graphData.nodes || !graphData.edges) {
        console.warn('Invalid graph data structure:', graphData)
        graphStore.graphJson = JSON.stringify(graphData, null, 2) // Load raw data into JSON editor
        return
      }

      // Update the Pinia store
      graphStore.setCurrentGraphId(graphIdToLoad) // Persist the current graph ID
      graphStore.graphMetadata = graphData.metadata || { title: '', description: '', createdBy: '' } // Default metadata if missing
      graphStore.nodes = graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: parseColor(node.color || 'blue'), // Validate color or default to 'blue'
          type: node.type || null,
          info: node.info || null,
          bibl: Array.isArray(node.bibl) ? node.bibl : [], // Deserialize bibl as an array
        },
        position: node.position || { x: 0, y: 0 }, // Apply saved position or default
      }))
      graphStore.edges = graphData.edges.map((edge) => ({
        data: {
          source: edge.source,
          target: edge.target,
        },
      }))

      //Udate the current graph ID in the store
      graphStore.currentGraphId = graphIdToLoad

      // Update the JSON editor with only nodes and edges
      graphStore.graphJson = JSON.stringify(
        {
          nodes: graphStore.nodes.map((node) => ({
            ...node.data,
            position: node.position, // Include position in JSON
          })),
          edges: graphStore.edges.map((edge) => edge.data),
        },
        null,
        2,
      )

      // Update the graph view
      if (cyInstance.value) {
        cyInstance.value.elements().remove()
        cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
        cyInstance.value.layout({ name: 'preset' }).run() // Use 'preset' layout to apply positions
        cyInstance.value.fit() // Fit the graph to the viewport
      }
    } else {
      console.error('Failed to load the selected graph:', response.statusText)
    }
  } catch (error) {
    console.error('Error loading the selected graph:', error)
  }
}

// Fetch the history of the current graph
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

      // Extract the results array from the history object
      if (data.history && data.history.results) {
        graphHistory.value = data.history.results.map((item) => ({
          version: item.version,
          timestamp: item.timestamp,
        }))
        console.log('Fetched graph history:', graphHistory.value)
      } else {
        console.warn('No valid history data found in the response.')
        graphHistory.value = [] // Clear the history list if no valid data
      }
    } else {
      console.error('Failed to fetch graph history:', response.statusText)
      graphHistory.value = [] // Clear the history list if the request fails
    }
  } catch (error) {
    console.error('Error fetching graph history:', error)
    graphHistory.value = [] // Clear the history list on error
  }
}

// Load a specific version of the graph from history
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

      // Update the graph view with the selected version
      graphStore.nodes = graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: parseColor(node.color || 'blue'),
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

      console.log(`Loaded graph version ${version} successfully.`)
    } else {
      console.error('Failed to load graph version:', response.statusText)
    }
  } catch (error) {
    console.error('Error loading graph version:', error)
  }
}

// Fetch the list of graphs on component mount and load the current graph if available
onMounted(() => {
  fetchKnowledgeGraphs()
  if (graphStore.currentGraphId) {
    loadSelectedGraph()
    fetchGraphHistory() // Fetch the history of the current graph
  }
})
</script>

<style>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}
.form-section {
  background: #f9f9f9;
  padding: 20px;
  border: 1px solid #ddd;
}
.graph-editor {
  background: #fff;
  padding: 20px;
  border: 1px solid #ddd;
}
.info-section {
  background: #f9f9f9;
  padding: 20px;
  border: 1px solid #ddd;
  margin-top: 20px;
}
.container-fluid {
  padding: 0;
}
.row {
  margin: 0;
}
.current-graph-id {
  background: #f0f0f0;
  padding: 10px;
  border: 1px solid #ddd;
  margin-bottom: 20px;
}
.graph-selector {
  margin-bottom: 20px;
}
.graph-selector select {
  padding: 5px;
  font-size: 16px;
}
.alert {
  margin-bottom: 20px;
}
</style>
