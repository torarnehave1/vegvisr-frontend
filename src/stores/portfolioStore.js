import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePortfolioStore = defineStore('portfolio', () => {
  const viewMode = ref('detailed') // 'detailed' or 'simple'
  const searchQuery = ref('')
  const sortBy = ref('title')
  // Add more UI state as needed (e.g., scroll position, filters)

  return {
    viewMode,
    searchQuery,
    sortBy,
  }
})
