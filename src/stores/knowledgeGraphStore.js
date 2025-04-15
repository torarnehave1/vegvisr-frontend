import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useKnowledgeGraphStore = defineStore('knowledgeGraph', () => {
  const graphMetadata = ref({
    title: '',
    description: '',
    createdBy: '',
  })
  const nodes = ref([])
  const edges = ref([])
  const graphJson = ref('{}') // Initialize with an empty JSON structure
  const currentGraphId = ref(null) // Track the current graph ID

  const addNode = (node) => {
    nodes.value.push(node)
  }

  const addEdge = (edge) => {
    edges.value.push(edge)
  }

  const resetGraph = () => {
    graphMetadata.value = { title: '', description: '', createdBy: '' }
    nodes.value = []
    edges.value = []
    graphJson.value = '' // Reset graphJson
    currentGraphId.value = null // Reset currentGraphId
  }

  const updateGraph = (newNodes, newEdges) => {
    nodes.value = newNodes
    edges.value = newEdges
  }

  return {
    graphMetadata,
    nodes,
    edges,
    graphJson, // Expose graphJson
    currentGraphId, // Expose currentGraphId
    addNode,
    addEdge,
    resetGraph,
    updateGraph, // Expose updateGraph
  }
})
