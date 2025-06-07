import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useUserStore } from './userStore'

export const useGraphTemplateStore = defineStore('graphTemplate', () => {
  const templates = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const userStore = useUserStore()

  // Fetch templates from the API
  async function fetchTemplates() {
    isLoading.value = true
    error.value = null
    try {
      const response = await fetch('https://knowledge.vegvisr.org/getAITemplates', {
        headers: {
          'X-API-Token': userStore.emailVerificationToken,
          Accept: 'application/json',
        },
        mode: 'cors',
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Failed to load templates: ${response.status}`)
      }
      const data = await response.json()
      if (!data.results) throw new Error('Invalid response format')
      templates.value = data.results
    } catch (err) {
      error.value = err.message
    } finally {
      isLoading.value = false
    }
  }

  // Get a template by ID
  function getTemplateById(id) {
    return templates.value.find((t) => t.id === id)
  }

  return {
    templates,
    isLoading,
    error,
    fetchTemplates,
    getTemplateById,
  }
})
