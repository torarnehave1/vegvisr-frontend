import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useAppBuilderStore = defineStore('appBuilder', () => {
  // Current app state
  const currentApp = ref(null)
  const appPrompt = ref('')
  const generatedCode = ref('')
  const selectedAIModel = ref('gpt-4o')
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
    selectedAIModel.value = versionData.aiModel || 'gpt-4o'
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
    selectedAIModel.value = 'gpt-4o'
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

    // Actions
    loadVersion,
    clearApp,
    updateApp,
    isLoadedVersion,
    getVersionDisplayName
  }
})
