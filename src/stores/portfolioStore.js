import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePortfolioStore = defineStore('portfolio', () => {
  const viewMode = ref('detailed') // 'detailed' or 'simple'
  const searchQuery = ref('')
  const sortBy = ref('date-desc') // Default to newest first
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

  // Method to directly set all meta areas (used for system-wide meta areas in branding)
  const setAllMetaAreas = (metaAreas) => {
    console.log('Setting all meta areas directly:', metaAreas)
    allMetaAreas.value = metaAreas
    // Reset frequencies since we're setting system-wide meta areas
    metaAreaFrequencies.value = {}
  }

  // Method to fetch graphs (used by various components)
  const fetchGraphs = async () => {
    try {
      const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
      if (response.ok) {
        const data = await response.json()
        return data.results || []
      }
      throw new Error('Failed to fetch graphs')
    } catch (error) {
      console.error('Error fetching graphs:', error)
      throw error
    }
  }

  return {
    viewMode,
    searchQuery,
    sortBy,
    selectedMetaArea,
    allMetaAreas,
    metaAreaFrequencies,
    sortedMetaAreas,
    updateMetaAreas,
    setAllMetaAreas,
    fetchGraphs,
  }
})
