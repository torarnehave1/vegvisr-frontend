import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePortfolioStore = defineStore('portfolio', () => {
  const viewMode = ref('detailed') // 'detailed' or 'simple'
  const searchQuery = ref('')
  const sortBy = ref('title')
  const selectedMetaArea = ref(null)
  const allMetaAreas = ref([])
  const metaAreaFrequencies = ref({})

  // Computed property to get unique meta areas from all graphs
  const updateMetaAreas = (graphs) => {
    console.log('Updating meta areas with graphs:', graphs)
    const areas = new Set()
    const frequencies = {}

    graphs.forEach((graph) => {
      if (graph.metadata?.metaArea) {
        graph.metadata.metaArea
          .split('#')
          .map((area) => area.trim())
          .filter((area) => area.length > 0)
          .forEach((area) => {
            areas.add(area)
            frequencies[area] = (frequencies[area] || 0) + 1
          })
      }
    })

    allMetaAreas.value = Array.from(areas)
    metaAreaFrequencies.value = frequencies
    console.log('Updated meta areas:', allMetaAreas.value)
    console.log('Updated frequencies:', metaAreaFrequencies.value)
  }

  // Computed property to get meta areas sorted by frequency
  const sortedMetaAreas = computed(() => {
    const sorted = allMetaAreas.value.sort(
      (a, b) => (metaAreaFrequencies.value[b] || 0) - (metaAreaFrequencies.value[a] || 0),
    )
    console.log('Sorted meta areas:', sorted)
    return sorted
  })

  return {
    viewMode,
    searchQuery,
    sortBy,
    selectedMetaArea,
    allMetaAreas,
    metaAreaFrequencies,
    sortedMetaAreas,
    updateMetaAreas,
  }
})
