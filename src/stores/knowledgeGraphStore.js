import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'

export const useKnowledgeGraphStore = defineStore('knowledgeGraph', () => {
  const graphMetadata = ref({
    title: '',
    description: '',
    createdBy: '',
  })
  const nodes = ref([])
  const edges = ref([])
  const graphJson = ref('{}') // Initialize with an empty JSON structure
  const currentGraphId = ref(localStorage.getItem('currentGraphId') || null) // Retrieve from local storage
  const currentVersion = ref(null) // Track the currently loaded version
  const currentGraph = ref(null) // Store the complete current graph data including metadata

  const undoStack = ref([]) // Stack to track undo actions
  const redoStack = ref([]) // Stack to track redo actions
  const validationMessage = ref('') // Message for validation feedback
  const validationMessageClass = ref('') // CSS class for validation feedback

  const nodeCount = ref(0)
  const edgeCount = ref(0)

  // Computed properties for counts
  const getNodeCount = computed(() => nodeCount.value)
  const getEdgeCount = computed(() => edgeCount.value)

  const resetGraph = () => {
    // Preserve existing action_txt nodes
    const existingActionTxtNodes = nodes.value.filter((node) => node.data.type === 'action_txt')

    graphMetadata.value = { title: '', description: '', createdBy: '' }
    nodes.value = [...existingActionTxtNodes] // Reset but keep action_txt nodes
    edges.value = []
    graphJson.value = '' // Reset graphJson
    currentGraphId.value = null // Reset currentGraphId
    currentVersion.value = null // Reset currentVersion
    undoStack.value = [] // Clear undo stack
    redoStack.value = [] // Clear redo stack
    localStorage.removeItem('currentGraphId') // Clear from local storage
    updateCounts()
  }

  const updateGraph = (newNodes, newEdges) => {
    nodes.value = newNodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label || node.id,
        color: node.color || 'gray',
        type: node.type || 'default',
        info: node.info || null,
        bibl: Array.isArray(node.bibl) ? node.bibl : [],
        visible: node.visible !== false,
        path: node.path || null,
      },
      position: node.position || { x: 0, y: 0 }, // Ensure position is preserved
    }))

    edges.value = newEdges.map((edge) => ({
      data: {
        id: edge.id || `${edge.source}_${edge.target}`,
        source: edge.source,
        target: edge.target,
        label: edge.label || null,
        type: edge.type || 'default',
        info: edge.info || null,
      },
    }))
    updateCounts()
  }

  const updateGraphFromJson = (parsedJson) => {
    nodes.value = parsedJson.nodes.map((node) => {
      return {
        data: {
          ...node,
          visible: node.visible !== false, // Ensure visibility is handled
          path: node.path || null, // Ensure path is included
        },
        position: node.position || null,
      }
    })
    edges.value = parsedJson.edges.map((edge) => ({
      data: {
        id: edge.id || `${edge.source}_${edge.target}`,
        source: edge.source,
        target: edge.target,
        ...(edge.label !== undefined && { label: edge.label }),
        ...(edge.type !== undefined && { type: edge.type }),
        ...(edge.info !== undefined && { info: edge.info }),
      },
    }))
    graphJson.value = JSON.stringify(parsedJson, null, 2)
    updateCounts()
  }

  const setCurrentGraphId = (id) => {
    currentGraphId.value = id
  }

  const setCurrentVersion = (version) => {
    currentVersion.value = version
  }

  const setCurrentGraph = (graphData) => {
    currentGraph.value = graphData
  }

  const pushToUndoStack = (action) => {
    undoStack.value.push(action)
    redoStack.value = [] // Clear redo stack on new action
  }

  const undo = () => {
    if (undoStack.value.length === 0) return
    const lastAction = undoStack.value.pop()
    redoStack.value.push(lastAction)

    // Reverse the last action
    if (lastAction.type === 'addNode') {
      nodes.value = nodes.value.filter((node) => node.data.id !== lastAction.nodeId)
    } else if (lastAction.type === 'addEdge') {
      edges.value = edges.value.filter((edge) => edge.data.id !== lastAction.edgeId)
    } else if (lastAction.type === 'updateGraph') {
      nodes.value = lastAction.previousState.nodes
      edges.value = lastAction.previousState.edges
    } else if (lastAction.type === 'moveNode') {
      const node = nodes.value.find((n) => n.data.id === lastAction.nodeId)
      if (node) {
        node.position = lastAction.previousPosition
      }
    }
    updateCounts()
  }

  const redo = () => {
    if (redoStack.value.length === 0) return
    const lastAction = redoStack.value.pop()
    undoStack.value.push(lastAction)

    // Reapply the last undone action
    if (lastAction.type === 'addNode') {
      nodes.value.push(lastAction.node)
    } else if (lastAction.type === 'addEdge') {
      edges.value.push(lastAction.edge)
    } else if (lastAction.type === 'updateGraph') {
      nodes.value = lastAction.newState.nodes
      edges.value = lastAction.newState.edges
    } else if (lastAction.type === 'moveNode') {
      const node = nodes.value.find((n) => n.data.id === lastAction.nodeId)
      if (node) {
        node.position = lastAction.newPosition
      }
    }
    updateCounts()
  }

  const updateNodeVisibilityInStore = (nodeId, isVisible) => {
    const node = nodes.value.find((n) => n.data.id === nodeId)
    if (node) {
      node.data.visible = isVisible
    }
  }

  const verifyJson = () => {
    try {
      const parsedJson = JSON.parse(graphJson.value)
      if (!parsedJson.nodes || !parsedJson.edges) {
        validationMessage.value = 'Invalid graph data. Ensure JSON contains "nodes" and "edges".'
        validationMessageClass.value = 'alert-danger'
        return
      }

      // Check for duplicate node IDs
      const nodeIds = parsedJson.nodes.map((node) => node.id)
      const duplicateIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index)
      if (duplicateIds.length > 0) {
        validationMessage.value = `Duplicate node IDs found: ${[...new Set(duplicateIds)].join(', ')}`
        validationMessageClass.value = 'alert-danger'
        return
      }

      nodes.value = parsedJson.nodes.map((node) => {
        return {
          data: {
            id: node.id,
            label: node.label,
            color: node.color || 'gray',
            type: node.type || null,
            info: node.info || null,
            bibl: Array.isArray(node.bibl) ? node.bibl : [],
            imageWidth: node.imageWidth || '100%',
            imageHeight: node.imageHeight || '100%',
            visible: node.visible !== false, // Ensure visible field is included
            path: node.path || null, // Ensure path is included
          },
          position: node.position || null,
        }
      })

      edges.value = parsedJson.edges.map((edge) => ({
        data: {
          id: edge.id || `${edge.source}_${edge.target}`,
          source: edge.source,
          target: edge.target,
          label: edge.label !== undefined ? edge.label : null,
          type: edge.type !== undefined ? edge.type : null,
          info: edge.info !== undefined ? edge.info : null,
        },
      }))

      graphJson.value = JSON.stringify(
        {
          nodes: nodes.value.map((node) => node.data),
          edges: edges.value.map((edge) => edge.data),
        },
        null,
        2,
      )

      validationMessage.value = 'JSON is valid!'
      validationMessageClass.value = 'alert-success'
      setTimeout(() => {
        validationMessage.value = ''
        validationMessageClass.value = ''
      }, 2000)
    } catch (error) {
      validationMessage.value = `Invalid JSON: ${error.message}`
      validationMessageClass.value = 'alert-danger'
    }
  }

  // Watch for changes to currentGraphId and persist to localStorage
  watch(currentGraphId, (newId) => {
    if (newId === null) {
      localStorage.removeItem('currentGraphId')
    } else {
      localStorage.setItem('currentGraphId', newId)
    }
  })

  // Update counts whenever nodes or edges change
  const updateCounts = () => {
    nodeCount.value = nodes.value.length
    edgeCount.value = edges.value.length
  }

  return {
    graphMetadata,
    nodes,
    edges,
    graphJson,
    currentGraphId,
    currentVersion,
    currentGraph,
    resetGraph,
    updateGraph,
    updateGraphFromJson,
    setCurrentGraphId,
    setCurrentVersion,
    setCurrentGraph,
    undoStack,
    redoStack,
    pushToUndoStack,
    undo, // Ensure undo is returned
    redo, // Ensure redo is returned
    updateNodeVisibilityInStore, // Ensure updateNodeVisibilityInStore is returned
    verifyJson, // Ensure verifyJson is returned
    nodeCount,
    edgeCount,
    getNodeCount,
    getEdgeCount,
  }
})
