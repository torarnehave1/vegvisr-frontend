import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useAppBuilderStore = defineStore('appBuilder', () => {
  // Current app state
  const currentApp = ref(null)
  const appPrompt = ref('')
  const generatedCode = ref('')
  const selectedAIModel = ref('grok')
  const conversationHistory = ref([])

  // Version tracking
  const currentVersionInfo = ref(null) // { historyId, versionId, versionNumber, appName }

  // UI state
  const showTemplates = ref(false)

  // API and Component Library state
  const enabledAPIs = ref([
    'ai-chat', // Always on
    'cloud-storage-save', // Always on
    'cloud-storage-load', // Always on
    'cloud-storage-load-all', // Always on
    'cloud-storage-delete', // Always on
    'pexels', // Enabled by default
    'portfolio-images' // Enabled by default
  ])

  const enabledComponents = ref([
    // Components are opt-in, none enabled by default
  ])

  // Load persisted state from localStorage on init
  const loadPersistedState = () => {
    try {
      const persisted = localStorage.getItem('appBuilderState')
      if (persisted) {
        const state = JSON.parse(persisted)
        if (state.currentApp) currentApp.value = state.currentApp
        if (state.appPrompt) appPrompt.value = state.appPrompt
        if (state.generatedCode) generatedCode.value = state.generatedCode
        if (state.selectedAIModel) selectedAIModel.value = state.selectedAIModel
        if (state.currentVersionInfo) currentVersionInfo.value = state.currentVersionInfo
        if (state.conversationHistory) conversationHistory.value = state.conversationHistory
        if (state.enabledAPIs) enabledAPIs.value = state.enabledAPIs
        if (state.enabledComponents) enabledComponents.value = state.enabledComponents
        console.log('✅ Restored app builder state from storage')
      }
    } catch (error) {
      console.error('Failed to load persisted state:', error)
    }
  }

  // Persist state to localStorage on changes
  const persistState = () => {
    try {
      const state = {
        currentApp: currentApp.value,
        appPrompt: appPrompt.value,
        generatedCode: generatedCode.value,
        selectedAIModel: selectedAIModel.value,
        currentVersionInfo: currentVersionInfo.value,
        conversationHistory: conversationHistory.value,
        enabledAPIs: enabledAPIs.value,
        enabledComponents: enabledComponents.value
      }
      localStorage.setItem('appBuilderState', JSON.stringify(state))
    } catch (error) {
      console.error('Failed to persist state:', error)
    }
  }

  // Watch for changes and persist
  watch([currentApp, appPrompt, generatedCode, selectedAIModel, currentVersionInfo, conversationHistory, enabledAPIs, enabledComponents], persistState, { deep: true })

  // Load persisted state immediately
  loadPersistedState()

  // Load an app version
  const loadVersion = (versionData) => {
    appPrompt.value = versionData.prompt
    generatedCode.value = versionData.code
    selectedAIModel.value = versionData.aiModel || 'grok'
    conversationHistory.value = versionData.conversationHistory || []

    currentVersionInfo.value = {
      historyId: versionData.historyId,
      versionId: versionData.versionId,
      versionNumber: versionData.versionNumber,
      appName: versionData.appName
    }

    currentApp.value = {
      prompt: versionData.prompt,
      code: versionData.code,
      ...currentVersionInfo.value
    }

    // Hide templates when loading a version
    showTemplates.value = false

    console.log('✅ AppBuilder store loaded version:', currentVersionInfo.value)
    console.log('📜 Conversation history:', conversationHistory.value)
  }

  // Clear current app
  const clearApp = () => {
    currentApp.value = null
    appPrompt.value = ''
    generatedCode.value = ''
    selectedAIModel.value = 'grok'
    currentVersionInfo.value = null
    conversationHistory.value = []
  }

  // Update current app after generation/regeneration
  const updateApp = (code, prompt = null) => {
    generatedCode.value = code
    if (prompt) {
      appPrompt.value = prompt
    }

    if (currentApp.value) {
      currentApp.value.code = code
      if (prompt) {
        currentApp.value.prompt = prompt
      }
    } else {
      currentApp.value = {
        code,
        prompt: prompt || appPrompt.value,
        timestamp: new Date().toISOString()
      }
    }
  }

  // Check if current app is a loaded version (can be regenerated)
  const isLoadedVersion = () => {
    return currentVersionInfo.value !== null && appPrompt.value.trim() !== ''
  }

  // Get version display name
  const getVersionDisplayName = () => {
    if (!currentVersionInfo.value) return null
    return `${currentVersionInfo.value.appName} v${currentVersionInfo.value.versionNumber}`
  }

  // Fetch fresh components from Component Manager API
  const componentsFetchError = ref(null)
  const componentsFetching = ref(false)
  const componentsLastFetch = ref(null)
  const availableComponents = ref([]) // Full component list from Component Manager

  const fetchComponents = async () => {
    componentsFetching.value = true
    componentsFetchError.value = null

    try {
      const response = await fetch('https://api.vegvisr.org/api/components')

      if (!response.ok) {
        throw new Error(`Failed to fetch components: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success || !data.components) {
        throw new Error(data.error || 'Invalid response from Component Manager')
      }

      availableComponents.value = data.components
      componentsLastFetch.value = new Date().toISOString()

      console.log('✅ Fetched fresh components from Component Manager:', data.components.length)

      // Auto-enable components that were previously enabled but may have been updated
      // This preserves user's selection while showing fresh data
      const previouslyEnabledSlugs = enabledComponents.value.map(c =>
        typeof c === 'string' ? c : c.slug
      )

      // Filter available components to only those that were previously enabled
      const freshEnabledComponents = data.components
        .filter(comp => previouslyEnabledSlugs.includes(comp.slug || comp.name))
        .map(comp => comp.slug || comp.name)

      if (freshEnabledComponents.length > 0) {
        enabledComponents.value = freshEnabledComponents
        console.log('🔄 Updated enabled components with fresh data:', freshEnabledComponents)
      }

      return { success: true, components: data.components }
    } catch (error) {
      console.error('❌ Failed to fetch components:', error)
      componentsFetchError.value = error.message

      // Fallback to localStorage if API fails
      console.log('📦 Using localStorage fallback for components')

      return { success: false, error: error.message }
    } finally {
      componentsFetching.value = false
    }
  }

  // Toggle component enabled state
  const toggleComponent = (componentSlug) => {
    const index = enabledComponents.value.indexOf(componentSlug)
    if (index > -1) {
      enabledComponents.value.splice(index, 1)
      console.log('❌ Disabled component:', componentSlug)
    } else {
      enabledComponents.value.push(componentSlug)
      console.log('✅ Enabled component:', componentSlug)
    }
  }

  return {
    // State
    currentApp,
    appPrompt,
    generatedCode,
    selectedAIModel,
    currentVersionInfo,
    showTemplates,
    conversationHistory,
    enabledAPIs,
    enabledComponents,
    availableComponents,
    componentsFetching,
    componentsFetchError,
    componentsLastFetch,

    // Actions
    loadVersion,
    clearApp,
    updateApp,
    isLoadedVersion,
    getVersionDisplayName,
    fetchComponents,
    toggleComponent
  }
})
