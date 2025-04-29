import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

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

  const undoStack = ref([]) // Stack to track undo actions
  const redoStack = ref([]) // Stack to track redo actions

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
  }

  const updateGraph = (newNodes, newEdges) => {
    nodes.value = newNodes
    edges.value = newEdges.map((edge) => {
      const edgeData = {
        id: `${edge.source}_${edge.target}`,
        source: edge.source,
        target: edge.target,
      }
      if (edge.label !== undefined) edgeData.label = edge.label
      if (edge.type !== undefined) edgeData.type = edge.type
      if (edge.info !== undefined) edgeData.info = edge.info
      return { data: edgeData }
    })
  }

  const sanitizeGraphData = (graphData, forGraphEditor = false) => {
    const sanitize = (obj) =>
      Object.fromEntries(
        Object.entries(obj)
          .filter(([_, value]) => value !== null) // Exclude null values
          .map(([key, value]) => [key, value]),
      )

    return {
      ...graphData,
      nodes: graphData.nodes.map((node) => ({
        ...sanitize(node),
        visible: forGraphEditor ? true : node.visible !== false, // Always true for graph editor
        position: node.position || { x: 0, y: 0 },
        imageWidth: node.imageWidth || null,
        imageHeight: node.imageHeight || null,
      })),
      edges: graphData.edges.map((edge) => {
        const sanitizedEdge = sanitize(edge)
        return {
          id: edge.id || `${edge.source}_${edge.target}`,
          source: edge.source,
          target: edge.target,
          ...(sanitizedEdge.label !== undefined && { label: sanitizedEdge.label }),
          ...(sanitizedEdge.type !== undefined && { type: sanitizedEdge.type }),
          ...(sanitizedEdge.info !== undefined && { info: sanitizedEdge.info }),
        }
      }),
    }
  }

  const updateGraphFromJson = (parsedJson, forGraphEditor = false) => {
    // Preserve existing action_txt nodes
    const existingActionTxtNodes = nodes.value.filter((node) => node.data.type === 'action_txt')

    const sanitizedData = sanitizeGraphData(parsedJson, forGraphEditor)
    nodes.value = [
      ...sanitizedData.nodes.map((node) => ({
        data: {
          ...node,
          imageWidth: node.imageWidth || null, // Preserve null
          imageHeight: node.imageHeight || null, // Preserve null
        },
        position: node.position,
      })),
      ...existingActionTxtNodes, // Add preserved action_txt nodes
    ]
    edges.value = sanitizedData.edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        ...(edge.label !== undefined && { label: edge.label }),
        ...(edge.type !== undefined && { type: edge.type }),
        ...(edge.info !== undefined && { info: edge.info }),
      },
    }))
  }

  const setCurrentGraphId = (id) => {
    currentGraphId.value = id
  }

  const setCurrentVersion = (version) => {
    currentVersion.value = version
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
  }

  const updateNodeVisibilityInStore = (nodeId, isVisible) => {
    const node = nodes.value.find((n) => n.data.id === nodeId)
    if (node) {
      node.data.visible = isVisible
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

  return {
    graphMetadata,
    nodes,
    edges,
    graphJson,
    currentGraphId,
    currentVersion,
    resetGraph,
    updateGraph,
    updateGraphFromJson,
    setCurrentGraphId,
    setCurrentVersion,
    undoStack,
    redoStack,
    pushToUndoStack,
    undo, // Ensure undo is returned
    redo, // Ensure redo is returned
    updateNodeVisibilityInStore, // Ensure updateNodeVisibilityInStore is returned
  }
})
