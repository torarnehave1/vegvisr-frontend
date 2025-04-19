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

  const sanitizeGraphData = (graphData) => {
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
        position: node.position || { x: 0, y: 0 },
        imageWidth: node.imageWidth || null, // Preserve null if not set
        imageHeight: node.imageHeight || null, // Preserve null if not set
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

  const updateGraphFromJson = (parsedJson) => {
    const sanitizedData = sanitizeGraphData(parsedJson)
    nodes.value = sanitizedData.nodes.map((node) => ({
      data: {
        ...node,
        imageWidth: node.imageWidth || null, // Preserve null
        imageHeight: node.imageHeight || null, // Preserve null
      },
      position: node.position,
    }))
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
  }
})
