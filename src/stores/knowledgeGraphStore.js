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

  const resetGraph = () => {
    graphMetadata.value = { title: '', description: '', createdBy: '' }
    nodes.value = []
    edges.value = []
    graphJson.value = '' // Reset graphJson
    currentGraphId.value = null // Reset currentGraphId
    currentVersion.value = null // Reset currentVersion
    localStorage.removeItem('currentGraphId') // Clear from local storage
  }

  // In knowledgeGraphStore.js, update the updateGraph function
  const updateGraph = (newNodes, newEdges) => {
    nodes.value = newNodes
    edges.value = newEdges.map((edge) => ({
      data: {
        id: `${edge.source}_${edge.target}`, // Ensure ID is set correctly
        source: edge.source,
        target: edge.target,
      },
    }))
  }

  const sanitizeGraphData = (graphData) => {
    const sanitize = (obj) =>
      Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [key, value === null ? '' : value]),
      )

    return {
      ...graphData,
      nodes: graphData.nodes.map((node) => ({
        ...sanitize(node),
        position: node.position || { x: 0, y: 0 },
      })),
      edges: graphData.edges.map((edge) => sanitize(edge)),
    }
  }

  const updateGraphFromJson = (parsedJson) => {
    const sanitizedData = sanitizeGraphData(parsedJson)
    nodes.value = sanitizedData.nodes.map((node) => ({
      data: node,
      position: node.position,
    }))
    edges.value = sanitizedData.edges.map(({ source, target }) => ({
      data: { id: `${source}_${target}`, source, target },
    }))
  }

  const setCurrentGraphId = (id) => {
    currentGraphId.value = id
  }

  const setCurrentVersion = (version) => {
    currentVersion.value = version
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
    graphJson, // Expose graphJson
    currentGraphId, // Expose currentGraphId
    currentVersion, // Expose currentVersion

    resetGraph,
    updateGraph, // Expose updateGraph
    updateGraphFromJson, // Expose updateGraphFromJson
    setCurrentGraphId, // Expose setCurrentGraphId
    setCurrentVersion, // Expose setCurrentVersion
  }
})
