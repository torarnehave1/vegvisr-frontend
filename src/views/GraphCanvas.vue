<template>
  <div class="graph-canvas">
    <!-- Top Toolbar -->
    <div class="canvas-toolbar">
      <div class="toolbar-section">
        <h3 class="canvas-title">Graph Canvas</h3>
        <select v-model="selectedGraphId" @change="loadGraph" class="form-select">
          <option value="">Select a graph...</option>
          <option v-for="graph in knowledgeGraphs" :key="graph.id" :value="graph.id">
            {{ graph.title || graph.name || `Graph ${graph.id}` }}
          </option>
        </select>
        <span v-if="knowledgeGraphs.length === 0" class="text-muted ms-2">
          No graphs available
        </span>
      </div>

      <div class="toolbar-section">
        <!-- Search -->
        <input
          v-model="searchQuery"
          @input="searchNodes"
          type="text"
          class="form-control search-input"
          placeholder="Search nodes..."
        />
      </div>

      <div class="toolbar-section">
        <!-- Alignment Controls -->
        <div class="btn-group" role="group">
          <button
            @click="alignSelectedNodes('horizontal')"
            class="btn btn-outline-primary"
            title="Align Horizontal"
          >
            ⬌ Horizontal
          </button>
          <button
            @click="alignSelectedNodes('vertical')"
            class="btn btn-outline-primary"
            title="Align Vertical"
          >
            ⬍ Vertical
          </button>
          <button
            @click="alignSelectedNodes('center')"
            class="btn btn-outline-primary"
            title="Align Center"
          >
            ⊕ Center
          </button>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- Spacing Controls -->
        <div class="btn-group" role="group">
          <button
            @click="spreadSelectedNodes('horizontal')"
            class="btn btn-outline-secondary"
            title="Spread Horizontal"
          >
            ↔ Spread H
          </button>
          <button
            @click="spreadSelectedNodes('vertical')"
            class="btn btn-outline-secondary"
            title="Spread Vertical"
          >
            ↕ Spread V
          </button>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- View Controls -->
        <div class="btn-group" role="group">
          <button @click="centerAndZoom" class="btn btn-outline-info" title="Center & Fit">
            🎯 Center
          </button>
          <button @click="deleteSelected" class="btn btn-outline-danger" title="Delete Selected">
            🗑️ Delete
          </button>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- Undo/Redo -->
        <div class="btn-group" role="group">
          <button @click="undoAction" class="btn btn-outline-secondary" title="Undo">↶ Undo</button>
          <button @click="redoAction" class="btn btn-outline-secondary" title="Redo">↷ Redo</button>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- Save -->
        <button @click="saveGraph" class="btn btn-success" title="Save Changes">
          💾 Save Graph
        </button>
      </div>
    </div>

    <!-- Status Bar -->
    <div v-if="statusMessage" class="status-bar" :class="statusClass">
      {{ statusMessage }}
    </div>

    <!-- Main Canvas -->
    <div class="canvas-container">
      <div id="graph-canvas" class="cytoscape-canvas"></div>
    </div>

    <!-- Selection Info -->
    <div v-if="selectedCount > 0" class="selection-info">
      {{ selectedCount }} node{{ selectedCount > 1 ? 's' : '' }} selected
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import cytoscape from 'cytoscape'
import undoRedo from 'cytoscape-undo-redo'

// Initialize undo-redo plugin
if (!cytoscape.prototype.undoRedo) {
  undoRedo(cytoscape)
}

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const graphStore = useKnowledgeGraphStore()

// Use store's currentGraphId instead of local state
const selectedGraphId = computed({
  get: () => graphStore.currentGraphId || '',
  set: (value) => graphStore.setCurrentGraphId(value),
})
const searchQuery = ref('')
const statusMessage = ref('')
const statusClass = ref('')
const selectedCount = ref(0)
const knowledgeGraphs = ref([])

// Cytoscape instance
const cyInstance = ref(null)
const undoRedoInstance = ref(null)

// Helper function to parse markdown image syntax (from GraphAdmin)
const parseMarkdownImage = (markdown) => {
  const regex = /!\[.*?\|(.+?)\]\((.+?)\)/ // Match markdown image syntax
  const match = markdown.match(regex)

  if (match) {
    const styles = match[1].split(';').reduce((acc, style) => {
      const [key, value] = style.split(':').map((s) => s.trim())
      if (key && value) acc[key] = value
      return acc
    }, {})

    return { url: match[2], styles }
  }
  return null
}

// Computed
const hasSelection = computed(() => selectedCount.value > 0)

// Load available graphs
const loadGraphs = async () => {
  try {
    const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
    if (response.ok) {
      const data = await response.json()
      console.log('Raw API response:', data)
      console.log('Data type:', typeof data)
      console.log('Is array:', Array.isArray(data))

      // Handle different response formats
      let graphs = []
      if (Array.isArray(data)) {
        graphs = data
      } else if (data && Array.isArray(data.graphs)) {
        graphs = data.graphs
      } else if (data && typeof data === 'object') {
        // If it's an object with graph data, try to extract graphs
        graphs = Object.values(data).filter((item) => item && typeof item === 'object' && item.id)
      } else {
        console.warn('Unexpected data format:', data)
        showStatus('Unexpected response format from server', 'warning')
        return
      }

      // Filter graphs for current user or admin
      knowledgeGraphs.value = graphs.filter(
        (graph) =>
          graph.user_email === userStore.email || ['Admin', 'Superadmin'].includes(userStore.role),
      )

      console.log('Filtered graphs:', knowledgeGraphs.value.length)
      showStatus(`Loaded ${knowledgeGraphs.value.length} graphs`, 'success')
    } else {
      console.error('Failed to fetch graphs. Status:', response.status)
      showStatus('Failed to load graphs from server', 'error')
    }
  } catch (error) {
    console.error('Error loading graphs:', error)
    showStatus('Error loading graphs: ' + error.message, 'error')
  }
}

// Load selected graph
const loadGraph = async () => {
  if (!selectedGraphId.value) return

  try {
    showStatus('Loading graph...', 'info')

    // Update URL to reflect current graph
    if (route.query.graphId !== selectedGraphId.value) {
      router.replace({
        name: 'GraphCanvas',
        query: { graphId: selectedGraphId.value },
      })
    }

    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${selectedGraphId.value}`,
    )

    if (response.ok) {
      let graphData = await response.json()
      console.log('Raw graph data:', graphData)

      // Handle case where graph data is stored as JSON string
      if (typeof graphData === 'string') {
        try {
          graphData = JSON.parse(graphData)
        } catch (parseError) {
          console.error('Failed to parse graph JSON:', parseError)
          showStatus('Invalid JSON format in graph data', 'error')
          return
        }
      }

      console.log('Parsed graph data:', graphData)
      console.log('Has nodes:', !!graphData.nodes)
      console.log('Has edges:', !!graphData.edges)

      // Ensure we have nodes and edges arrays
      if (!graphData.nodes || !graphData.edges) {
        console.warn('Missing nodes or edges in graph data')
        // Initialize empty arrays if missing
        graphData.nodes = graphData.nodes || []
        graphData.edges = graphData.edges || []
        showStatus('Graph loaded with missing data - initialized empty arrays', 'warning')
      }

      initializeCytoscape(graphData)
      showStatus('Graph loaded successfully', 'success')
    } else {
      showStatus('Error loading graph', 'error')
    }
  } catch (error) {
    console.error('Error loading graph:', error)
    showStatus('Error loading graph', 'error')
  }
}

// Initialize Cytoscape
const initializeCytoscape = (graphData) => {
  const container = document.getElementById('graph-canvas')
  if (!container) {
    console.error('Canvas container not found')
    return
  }

  // Destroy existing instance
  if (cyInstance.value) {
    cyInstance.value.destroy()
  }

  // Prepare elements
  const elements = [
    ...graphData.nodes.map((node) => ({
      data: { id: node.id, label: node.label, ...node },
      position: node.position || { x: Math.random() * 800, y: Math.random() * 600 },
    })),
    ...graphData.edges.map((edge) => ({
      data: { id: edge.id, source: edge.source, target: edge.target, ...edge },
    })),
  ]

  // Create Cytoscape instance
  cyInstance.value = cytoscape({
    container: container,
    elements: elements,
    style: [
      {
        selector: 'node',
        style: {
          display: 'element',
          label: (ele) =>
            ele.data('type') === 'info' ? ele.data('label') + ' ℹ️' : ele.data('label') || '',
          'background-color': (ele) => ele.data('color') || '#ccc',
          color: '#000',
          'text-valign': 'center',
          'text-halign': 'center',
        },
      },
      {
        selector: 'node[type="worknote"]',
        style: {
          shape: 'rectangle',
          'background-color': '#FFD580',
          'border-width': 2,
          'border-color': '#333',
          label: (ele) => `${ele.data('label')}\n\n${ele.data('info') || ''}`,
          'text-wrap': 'wrap',
          'text-max-width': '734px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '14px',
          'font-weight': 'bold',
          width: '300px',
          height: (ele) => {
            const lineHeight = 30
            const padding = 20
            const labelLines = ele.data('label') ? ele.data('label').split('\n').length : 1
            const infoLines = ele.data('info') ? ele.data('info').split('\n').length : 0
            const totalLines = labelLines + infoLines + 2
            return Math.max(100, totalLines * lineHeight + padding)
          },
        },
      },
      {
        selector: 'node[type="markdown-image"]',
        style: {
          shape: 'rectangle',
          'background-image': (ele) => {
            const parsed = parseMarkdownImage(ele.data('label'))
            return parsed ? parsed.url : ''
          },
          'background-fit': 'cover',
          'background-opacity': 1,
          'border-width': 0,
          width: (ele) => ele.data('imageWidth') || '100%',
          height: (ele) => ele.data('imageHeight') || '100%',
          'z-index': -1,
          label: '',
        },
      },
      {
        selector: 'node[type="fulltext"]',
        style: {
          shape: 'round-rectangle',
          'background-color': (ele) => ele.data('color') || '#ede8e8',
          'border-width': 4,
          'border-color': '#555',
          label: (ele) => `${ele.data('label')}\n\n${ele.data('info')}`,
          'text-wrap': 'wrap',
          'text-max-width': '734px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '16px',
          padding: '10px',
          width: '794px',
          height: '1122pt',
        },
      },
      {
        selector: 'node[type="title"]',
        style: {
          shape: 'rectangle',
          'background-opacity': 0,
          'border-width': 1,
          'border-color': '#ccc',
          'padding-left': '15px',
          'padding-right': '10px',
          'padding-top': '5px',
          'padding-bottom': '5px',
          label: (ele) => ele.data('label') || '',
          'font-size': '24px',
          'font-weight': 'bold',
          color: 'black',
          'text-valign': 'center',
          'text-halign': 'center',
          width: 200,
          height: 50,
        },
      },
      {
        selector: 'node[type="youtube-video"]',
        style: {
          shape: 'rectangle',
          'background-color': '#FF0000',
          'border-width': 1,
          'border-color': '#000',
          label: (ele) => {
            const match = ele.data('label').match(/!\[YOUTUBE src=.+?\](.+?)\[END YOUTUBE\]/)
            return match ? match[1] : ele.data('label')
          },
          'text-wrap': 'wrap',
          'text-max-width': '180px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '14px',
          width: '200px',
          height: '112px',
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
          width: (ele) => ele.data('imageWidth') || '100%',
          height: (ele) => ele.data('imageHeight') || '100%',
          label: 'data(label)',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'font-size': '0px',
          color: '#000',
          'background-image-crossorigin': 'anonymous',
        },
      },
      {
        selector: 'node[type="map"]',
        style: {
          shape: 'rectangle',
          'background-color': '#FFD580',
          'border-width': 2,
          'border-color': '#333',
          label: (ele) => `${ele.data('label')}\n\n${ele.data('info') || ''}`,
          'text-wrap': 'wrap',
          'text-max-width': '734px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '14px',
          'font-weight': 'bold',
          width: '300px',
          height: (ele) => {
            const lineHeight = 30
            const padding = 20
            const labelLines = ele.data('label') ? ele.data('label').split('\n').length : 1
            const infoLines = ele.data('info') ? ele.data('info').split('\n').length : 0
            const totalLines = labelLines + infoLines + 2
            return Math.max(100, totalLines * lineHeight + padding)
          },
        },
      },
      {
        selector: 'node[type="app-viewer"]',
        style: {
          shape: 'rectangle',
          'background-color': (ele) => ele.data('path') ? 'transparent' : '#11998e',
          'background-image': (ele) => ele.data('path') || null,
          'background-fit': 'cover',
          'background-opacity': 1,
          'border-width': 3,
          'border-color': '#11998e',
          label: 'data(label)',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-background-color': 'rgba(17, 153, 142, 0.9)',
          'text-background-opacity': 1,
          'text-background-padding': '4px',
          'font-size': '14px',
          'font-weight': 'bold',
          color: '#fff',
          'text-wrap': 'wrap',
          'text-max-width': '180px',
          width: '200px',
          height: '150px',
          'background-image-crossorigin': 'anonymous',
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
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [50, -50],
          'control-point-weights': [0.3, 0.7],
          'edge-distances': 'intersection',
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
          'border-color': '#FF9800',
        },
      },
      {
        selector: 'edge:selected',
        style: {
          'line-color': '#FF9800',
          'target-arrow-color': '#FF9800',
          width: 4,
        },
      },
    ],
    layout: {
      name: 'preset',
    },
    // Interaction options
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: true,
    selectionType: 'additive',
    // Fine-tuned zoom settings
    wheelSensitivity: 0.1, // Reduce wheel sensitivity for finer control (default is 1)
    minZoom: 0.1, // Minimum zoom level
    maxZoom: 3, // Maximum zoom level
    zoomingEnabled: true,
    // Pan settings
    panningEnabled: true,
  })

  // Initialize undo-redo
  undoRedoInstance.value = cyInstance.value.undoRedo({
    isDebug: false,
    actions: {},
    undoableDrag: true,
    stackSizeLimit: 50,
  })

  // Event listeners
  setupEventListeners()

  // Fit to view
  cyInstance.value.fit()
}

// Setup event listeners
const setupEventListeners = () => {
  if (!cyInstance.value) return

  // Selection tracking
  cyInstance.value.on('select unselect', () => {
    selectedCount.value = cyInstance.value.$(':selected').length
  })

  // Double-click to edit label (simple prompt for now)
  cyInstance.value.on('dblclick', 'node', (event) => {
    const node = event.target
    const newLabel = prompt('Enter new label:', node.data('label'))
    if (newLabel && newLabel.trim()) {
      node.data('label', newLabel.trim())
      showStatus('Label updated', 'success')
    }
  })

  // Delete key to remove selected elements
  document.addEventListener('keydown', handleKeyDown)
}

// Handle keyboard shortcuts
const handleKeyDown = (event) => {
  if (!cyInstance.value) return

  switch (event.key) {
    case 'Delete':
    case 'Backspace':
      deleteSelected()
      break
    case 'z':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        undoAction()
      }
      break
    case 'y':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        redoAction()
      }
      break
  }
}

// Alignment functions
const alignSelectedNodes = (alignmentType) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$('node:selected')
  if (selectedNodes.length === 0) {
    showStatus('No nodes selected for alignment', 'warning')
    return
  }

  const positions = selectedNodes.map((node) => node.position())

  if (alignmentType === 'horizontal') {
    const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length
    selectedNodes.forEach((node) => {
      node.position({ x: node.position('x'), y: avgY })
    })
  } else if (alignmentType === 'vertical') {
    const avgX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length
    selectedNodes.forEach((node) => {
      node.position({ x: avgX, y: node.position('y') })
    })
  } else if (alignmentType === 'center') {
    const avgX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length
    const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length
    selectedNodes.forEach((node) => {
      node.position({ x: avgX, y: avgY })
    })
  }

  showStatus(`Aligned ${selectedNodes.length} nodes ${alignmentType}`, 'success')
}

// Spacing functions
const spreadSelectedNodes = (axis) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$('node:selected')
  if (selectedNodes.length < 2) {
    showStatus('Select at least 2 nodes for spreading', 'warning')
    return
  }

  const sortedNodes = selectedNodes.sort((a, b) =>
    axis === 'horizontal' ? a.position('x') - b.position('x') : a.position('y') - b.position('y'),
  )

  const minPos = sortedNodes[0].position(axis === 'horizontal' ? 'x' : 'y')
  const maxPos = sortedNodes[sortedNodes.length - 1].position(axis === 'horizontal' ? 'x' : 'y')
  const spacing = (maxPos - minPos) / (sortedNodes.length - 1)

  sortedNodes.forEach((node, index) => {
    const newPos = minPos + index * spacing
    if (axis === 'horizontal') {
      node.position({ x: newPos, y: node.position('y') })
    } else {
      node.position({ x: node.position('x'), y: newPos })
    }
  })

  showStatus(`Spread ${selectedNodes.length} nodes ${axis}`, 'success')
}

// View controls
const centerAndZoom = () => {
  if (!cyInstance.value) return
  cyInstance.value.fit()
  showStatus('Centered and fitted to view', 'success')
}

// Delete selected elements
const deleteSelected = () => {
  if (!cyInstance.value) return

  const selected = cyInstance.value.$(':selected')
  if (selected.length === 0) {
    showStatus('No elements selected for deletion', 'warning')
    return
  }

  if (confirm(`Delete ${selected.length} selected element(s)?`)) {
    selected.remove()
    selectedCount.value = 0
    showStatus(`Deleted ${selected.length} element(s)`, 'success')
  }
}

// Search nodes
const searchNodes = () => {
  if (!cyInstance.value) return

  cyInstance.value.nodes().removeClass('highlighted')

  if (searchQuery.value.trim()) {
    const matchingNodes = cyInstance.value
      .nodes()
      .filter((node) => node.data('label').toLowerCase().includes(searchQuery.value.toLowerCase()))

    if (matchingNodes.length > 0) {
      matchingNodes.addClass('highlighted')
      cyInstance.value.fit(matchingNodes, 50)
      showStatus(`Found ${matchingNodes.length} matching nodes`, 'success')
    } else {
      showStatus('No matching nodes found', 'warning')
    }
  }
}

// Undo/Redo
const undoAction = () => {
  if (undoRedoInstance.value) {
    undoRedoInstance.value.undo()
    showStatus('Undone', 'info')
  }
}

const redoAction = () => {
  if (undoRedoInstance.value) {
    undoRedoInstance.value.redo()
    showStatus('Redone', 'info')
  }
}

// Save graph (position updates only) - FIXED to preserve metadata
const saveGraph = async () => {
  if (!cyInstance.value || !selectedGraphId.value) {
    showStatus('No graph selected to save', 'warning')
    return
  }

  try {
    showStatus('Saving positions...', 'info')

    // CRITICAL FIX: Fetch the current graph data to preserve metadata
    console.log('🔍 [GraphCanvas] Fetching current graph to preserve metadata...')
    const currentGraphResponse = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${selectedGraphId.value}`,
    )

    if (!currentGraphResponse.ok) {
      throw new Error(`Failed to fetch current graph: ${currentGraphResponse.status}`)
    }

    const currentGraph = await currentGraphResponse.json()

    // Ensure metadata exists with fallback defaults
    const existingMetadata = currentGraph.metadata || {}

    console.log(
      '🔍 [GraphCanvas] Current graph metadata:',
      JSON.stringify(existingMetadata, null, 2),
    )
    console.log(
      '🔍 [GraphCanvas] Meta area in current graph:',
      existingMetadata.metaArea || 'NO META AREA FOUND',
    )

    // Get current positions from Cytoscape
    const updatedNodes = cyInstance.value.nodes().map((node) => ({
      ...node.data(), // Keep all existing node data
      position: node.position(), // Update position
    }))

    const updatedEdges = cyInstance.value.edges().map((edge) => ({
      ...edge.data(), // Keep all existing edge data
    }))

    console.log('=== Saving Position Updates ===')
    console.log('Updated nodes with positions:', updatedNodes.length)
    console.log(
      'Sample node positions:',
      updatedNodes.slice(0, 2).map((n) => ({ id: n.id, position: n.position })),
    )

    // CRITICAL FIX: Include metadata in the payload to preserve it
    const preservedMetadata = {
      title: existingMetadata.title || 'Untitled Graph',
      description: existingMetadata.description || '',
      createdBy: existingMetadata.createdBy || 'Unknown',
      category: existingMetadata.category || '',
      metaArea: existingMetadata.metaArea || '', // Preserve metaArea - CRITICAL!
      version: existingMetadata.version || 1,
      createdAt: existingMetadata.createdAt || new Date().toISOString(),
      // Preserve any other existing fields
      ...existingMetadata,
      // Always update timestamp
      updatedAt: new Date().toISOString(),
    }

    const payload = {
      id: selectedGraphId.value,
      graphData: {
        metadata: preservedMetadata,
        nodes: updatedNodes,
        edges: updatedEdges,
      },
    }

    console.log(
      '💾 [GraphCanvas] Saving with preserved metadata:',
      JSON.stringify(preservedMetadata, null, 2),
    )
    console.log(
      '💾 [GraphCanvas] Meta area being saved:',
      preservedMetadata.metaArea || 'NO META AREA IN SAVE DATA',
    )

    const response = await fetch('https://knowledge.vegvisr.org/updateknowgraph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      console.log('✅ [GraphCanvas] Position update successful with metadata preserved')
      showStatus('Positions saved successfully!', 'success')
    } else {
      const errorText = await response.text()
      console.error('❌ [GraphCanvas] Save failed:', response.status, errorText)
      showStatus(`Error saving positions: ${response.status}`, 'error')
    }
  } catch (error) {
    console.error('❌ [GraphCanvas] Error saving positions:', error)
    showStatus('Error saving positions: ' + error.message, 'error')
  }
}

// Status message helper
const showStatus = (message, type = 'info') => {
  statusMessage.value = message
  statusClass.value = `alert-${type === 'error' ? 'danger' : type}`

  setTimeout(() => {
    statusMessage.value = ''
    statusClass.value = ''
  }, 3000)
}

// Initialize empty canvas
const initializeEmptyCanvas = () => {
  const container = document.getElementById('graph-canvas')
  if (!container) return

  if (cyInstance.value) {
    cyInstance.value.destroy()
  }

  cyInstance.value = cytoscape({
    container: container,
    elements: [],
    style: [
      {
        selector: 'node',
        style: {
          display: 'element',
          label: (ele) =>
            ele.data('type') === 'info' ? ele.data('label') + ' ℹ️' : ele.data('label') || '',
          'background-color': (ele) => ele.data('color') || '#ccc',
          color: '#000',
          'text-valign': 'center',
          'text-halign': 'center',
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#FF9800',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': '#999',
          'target-arrow-color': '#999',
          'target-arrow-shape': 'triangle',
          'curve-style': 'unbundled-bezier',
        },
      },
    ],
    layout: { name: 'grid' },
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: true,
    selectionType: 'additive',
    // Fine-tuned zoom settings
    wheelSensitivity: 0.1, // Reduce wheel sensitivity for finer control
    minZoom: 0.1, // Minimum zoom level
    maxZoom: 3, // Maximum zoom level
    zoomingEnabled: true,
    panningEnabled: true,
  })

  setupEventListeners()
  showStatus('Canvas initialized - select a graph to load data', 'info')
}

// Handle URL parameters and store changes
const handleGraphIdChange = async (newGraphId) => {
  if (newGraphId && knowledgeGraphs.value.length > 0) {
    console.log('Loading graph from ID change:', newGraphId)
    await loadGraph()
  }
}

// Watch for changes in currentGraphId (from store or URL)
watch(() => graphStore.currentGraphId, handleGraphIdChange)

// Lifecycle
onMounted(async () => {
  if (!userStore.loggedIn) {
    router.push('/login')
    return
  }

  // Check URL parameters first
  const urlGraphId = route.query.graphId
  if (urlGraphId) {
    console.log('Found graphId in URL:', urlGraphId)
    graphStore.setCurrentGraphId(urlGraphId)
  }

  // Initialize empty canvas first
  setTimeout(() => {
    initializeEmptyCanvas()
  }, 100)

  await loadGraphs()

  // Auto-load current graph if one is stored
  if (graphStore.currentGraphId) {
    console.log('Auto-loading stored graph:', graphStore.currentGraphId)
    await loadGraph()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  if (cyInstance.value) {
    cyInstance.value.destroy()
  }
})
</script>

<style scoped>
.graph-canvas {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
}

.canvas-toolbar {
  background: white;
  border-bottom: 1px solid #dee2e6;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.canvas-title {
  margin: 0;
  color: #495057;
  font-size: 1.25rem;
  font-weight: 600;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-input {
  width: 200px;
}

.status-bar {
  padding: 0.5rem 1rem;
  text-align: center;
  font-weight: 500;
}

.alert-success {
  background-color: #d4edda;
  color: #155724;
}
.alert-info {
  background-color: #d1ecf1;
  color: #0c5460;
}
.alert-warning {
  background-color: #fff3cd;
  color: #856404;
}
.alert-danger {
  background-color: #f8d7da;
  color: #721c24;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.cytoscape-canvas {
  width: 100%;
  height: 100%;
  background: white;
}

.selection-info {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

/* Highlighted nodes */
:global(.highlighted) {
  background-color: #ff5722 !important;
  border-color: #d84315 !important;
}

/* Responsive design */
@media (max-width: 768px) {
  .canvas-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-section {
    justify-content: center;
  }

  .search-input {
    width: 100%;
  }
}
</style>
