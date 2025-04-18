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
    nodes.value = newNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        imageWidth: node.imageWidth || null, // Include image-width
        imageHeight: node.imageHeight || null, // Include image-height
      },
    }))
    edges.value = newEdges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type || null, // Ensure type is included
      info: edge.info || null, // Ensure info is included
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
    setCurrentGraphId, // Expose setCurrentGraphId
    setCurrentVersion, // Expose setCurrentVersion
  }
})
