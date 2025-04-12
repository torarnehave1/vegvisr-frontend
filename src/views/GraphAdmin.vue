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
          <textarea
            v-model="graphStore.graphJson"
            @input="updateGraphFromJson"
            style="width: 100%; height: 150px; margin-bottom: 10px; font-family: monospace"
          ></textarea>
          <button @click="updateGraphView" style="margin-bottom: 10px">Update Graph</button>
          <div
            id="cy"
            style="width: 100%; height: calc(100% - 210px); border: 1px solid #ddd"
          ></div>
          <div style="margin-top: 10px">
            <button @click="addNode">Add Node</button>
            <button @click="addEdge">Add Edge</button>
            <button @click="centerAndZoom">Center and Zoom</button>
            <button @click="saveCurrentGraph">Save Current Graph</button>
          </div>
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
  cyInstance.value = cytoscape({
    container: document.getElementById('cy'),
    elements: [],
    style: [
      {
        selector: 'node',
        style: {
          label: (ele) =>
            ele.data('type') === 'infonode' ? ele.data('label') + ' ℹ️' : ele.data('label'),
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
    ],
    layout: {
      name: 'grid',
    },
  })

  cyInstance.value.on('tap', 'node, edge', (event) => {
    const element = event.target
    const data = element.data()

    selectedElement.value = {
      label: data.label || `${data.source} → ${data.target}`,
      info: data.info || null,
    }
  })

  initializeStandardGraph()

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

const saveCurrentGraph = async () => {
  if (!graphStore.currentGraphId) {
    alert('No graph ID is set. Please save the graph first.')
    return
  }

  const graphData = {
    nodes: graphStore.nodes,
    edges: graphStore.edges,
  }

  const response = await fetch('https://knowledge.vegvisr.org/updateknowgraph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: graphStore.currentGraphId,
      graphData,
    }),
  })

  if (response.ok) {
    alert('Graph updated successfully!')
  } else {
    alert('Failed to update the graph.')
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
    const textarea = document.querySelector('textarea[v-model="graphStore.graphJson"]')
    const cursorPosition = textarea ? textarea.selectionStart : null // Safely get cursor position

    const parsedGraph = eval(`(${graphStore.graphJson})`) // Parse JSON with single quotes
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
      cyInstance.value.layout({ name: 'grid' }).run()
    }

    if (textarea && cursorPosition !== null) {
      nextTick(() => {
        textarea.setSelectionRange(cursorPosition, cursorPosition) // Restore cursor position
      })
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
      cyInstance.value.layout({ name: 'grid' }).run()
    }
  } catch (error) {
    console.error('Invalid JSON format:', error)
  }
}

watch(
  () => [graphStore.nodes, graphStore.edges],
  () => {
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
  if (!selectedGraphId.value) return

  try {
    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${selectedGraphId.value}`,
    )
    if (response.ok) {
      const graphData = await response.json()

      // Validate the response structure
      if (!graphData.metadata || !graphData.nodes || !graphData.edges) {
        console.error('Invalid graph data structure:', graphData)
        alert('Failed to load the selected graph. Invalid data structure.')
        return
      }

      // Update the Pinia store
      graphStore.currentGraphId = selectedGraphId.value
      graphStore.graphMetadata = graphData.metadata
      graphStore.nodes = graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: parseColor(node.color || 'blue'), // Validate color or default to 'blue'
          type: node.type || null,
          info: node.info || null,
        },
      }))
      graphStore.edges = graphData.edges.map((edge) => ({
        data: {
          source: edge.source,
          target: edge.target,
        },
      }))
      graphStore.graphJson = JSON.stringify(graphData, null, 2)

      // Update the graph view
      if (cyInstance.value) {
        cyInstance.value.elements().remove()
        cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
        cyInstance.value.layout({ name: 'grid' }).run()
      }
    } else {
      console.error('Failed to load the selected graph:', response.statusText)
      alert('Failed to load the selected graph.')
    }
  } catch (error) {
    console.error('Error loading the selected graph:', error)
    alert('An error occurred while loading the selected graph.')
  }
}

// Fetch the list of graphs on component mount
onMounted(() => {
  fetchKnowledgeGraphs()
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
</style>
