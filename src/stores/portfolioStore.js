import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePortfolioStore = defineStore('portfolio', () => {
  const viewMode = ref('detailed') // 'detailed' or 'simple'
  const searchQuery = ref('')
  const sortBy = ref('title')
  const selectedMetaArea = ref(null)
  const allMetaAreas = ref([])

  // Computed property to get unique meta areas from all graphs
  const updateMetaAreas = (graphs) => {
    const areas = new Set()
    graphs.forEach((graph) => {
      if (graph.metadata?.metaArea) {
        graph.metadata.metaArea
          .split('#')
          .map((area) => area.trim())
          .filter((area) => area.length > 0)
          .forEach((area) => areas.add(area))
      }
    })
    allMetaAreas.value = Array.from(areas)
  }

  return {
    viewMode,
    searchQuery,
    sortBy,
    selectedMetaArea,
    allMetaAreas,
    updateMetaAreas,
  }
})
