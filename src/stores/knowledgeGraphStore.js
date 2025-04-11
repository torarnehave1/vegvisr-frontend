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
  }

  return {
    graphMetadata,
    nodes,
    edges,
    addNode,
    addEdge,
    resetGraph,
  }
})
