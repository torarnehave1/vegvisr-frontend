import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useUserStore } from './userStore'

// Teacher worker runs on its own subdomain following multi-worker architecture
const API_BASE = 'https://teacher.vegvisr.org'

export const useTeacherStore = defineStore('teacher', () => {
  const userStore = useUserStore()

  // State
  const isOpen = ref(false)
  const isLoading = ref(false)
  const currentView = ref('GraphCanvas') // Current view context

  // Settings
  const settings = ref({
    voice: 'Puck',  // Upbeat, friendly voice - best for tutorials
    language: 'en',
    voiceEnabled: true,
    autoSuggestions: true
  })

  // Available voices and languages
  const availableVoices = ref([])
  const availableLanguages = ref([
    { code: 'en', name: 'English' },
    { code: 'no', name: 'Norsk' }
  ])

  // Tutorials
  const tutorials = ref([])
  const activeTutorial = ref(null)
  const currentStep = ref(0)
  const tutorialProgress = ref({}) // { tutorialId: { currentStep, completed } }

  // Guide search
  const searchQuery = ref('')
  const searchResults = ref([])
  const selectedGuideSection = ref(null)

  // Audio
  const isPlaying = ref(false)
  const audioElement = ref(null)
  const audioCache = new Map()

  // Suggestions based on context
  const contextSuggestions = ref([])

  // Computed
  const tutorialsForCurrentView = computed(() => {
    return tutorials.value.filter(t => t.target_view === currentView.value)
  })

  const currentStepData = computed(() => {
    if (!activeTutorial.value) return null
    const steps = activeTutorial.value.steps || []
    return steps[currentStep.value] || null
  })

  const totalSteps = computed(() => {
    return activeTutorial.value?.steps?.length || 0
  })

  const isLastStep = computed(() => {
    return currentStep.value >= totalSteps.value - 1
  })

  const progressPercent = computed(() => {
    if (!activeTutorial.value) return 0
    return Math.round(((currentStep.value + 1) / totalSteps.value) * 100)
  })

  // Actions
  async function initialize() {
    await Promise.all([
      loadSettings(),
      loadVoices(),
      loadTutorials()
    ])
  }

  async function loadSettings() {
    if (!userStore.loggedIn) return

    try {
      const response = await fetch(`${API_BASE}/api/teacher/settings`, {
        headers: {
          'x-user-email': userStore.email,
          'x-user-role': userStore.role
        }
      })
      const data = await response.json()
      if (data.success && data.settings) {
        settings.value = {
          voice: data.settings.voice || 'Kore',
          language: data.settings.language || 'en',
          voiceEnabled: Boolean(data.settings.voice_enabled),
          autoSuggestions: Boolean(data.settings.auto_suggestions)
        }
      }
    } catch (error) {
      console.error('Failed to load teacher settings:', error)
    }
  }

  async function saveSettings() {
    if (!userStore.loggedIn) return

    try {
      await fetch(`${API_BASE}/api/teacher/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userStore.email,
          'x-user-role': userStore.role
        },
        body: JSON.stringify({
          voice: settings.value.voice,
          language: settings.value.language,
          voice_enabled: settings.value.voiceEnabled,
          auto_suggestions: settings.value.autoSuggestions
        })
      })
    } catch (error) {
      console.error('Failed to save teacher settings:', error)
    }
  }

  async function loadVoices() {
    try {
      const response = await fetch(`${API_BASE}/api/teacher/voices?lang=${settings.value.language}`)
      const data = await response.json()
      if (data.success) {
        availableVoices.value = data.voices || []
        if (data.languages) {
          availableLanguages.value = data.languages
        }
      }
    } catch (error) {
      console.error('Failed to load voices:', error)
    }
  }

  async function loadTutorials() {
    isLoading.value = true
    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/tutorials?view=${currentView.value}&lang=${settings.value.language}`,
        {
          headers: {
            'x-user-email': userStore.email || '',
            'x-user-role': userStore.role || ''
          }
        }
      )
      const data = await response.json()
      if (data.success) {
        tutorials.value = data.tutorials || []
        // Update progress from response
        tutorials.value.forEach(t => {
          if (t.user_current_step !== undefined) {
            tutorialProgress.value[t.id] = {
              currentStep: t.user_current_step,
              completed: Boolean(t.user_completed)
            }
          }
        })
      }
    } catch (error) {
      console.error('Failed to load tutorials:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function searchGuide(query) {
    if (!query || query.length < 2) {
      searchResults.value = []
      return
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/teacher/guide/search?q=${encodeURIComponent(query)}&lang=${settings.value.language}&view=${currentView.value}`
      )
      const data = await response.json()
      if (data.success) {
        searchResults.value = data.results || []
      }
    } catch (error) {
      console.error('Failed to search guide:', error)
    }
  }

  async function loadGuideSection(sectionId) {
    try {
      const response = await fetch(`${API_BASE}/api/teacher/guide/section/${sectionId}`)
      const data = await response.json()
      if (data.success) {
        selectedGuideSection.value = data.section
      }
    } catch (error) {
      console.error('Failed to load guide section:', error)
    }
  }

  async function startTutorial(tutorialId) {
    isLoading.value = true
    try {
      const response = await fetch(`${API_BASE}/api/teacher/tutorials/${tutorialId}`)
      const data = await response.json()
      if (data.success && data.tutorial) {
        activeTutorial.value = data.tutorial
        // Resume from saved progress or start fresh
        currentStep.value = tutorialProgress.value[tutorialId]?.currentStep || 0

        // Speak the first step
        if (settings.value.voiceEnabled && currentStepData.value?.narration) {
          await speak(currentStepData.value.narration)
        }
      }
    } catch (error) {
      console.error('Failed to start tutorial:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function nextStep() {
    if (isLastStep.value) {
      await completeTutorial()
      return
    }

    currentStep.value++
    await saveProgress()

    // Speak the new step
    if (settings.value.voiceEnabled && currentStepData.value?.narration) {
      await speak(currentStepData.value.narration)
    }
  }

  function prevStep() {
    if (currentStep.value > 0) {
      currentStep.value--
      stopAudio()
    }
  }

  async function completeTutorial() {
    if (!activeTutorial.value) return

    const tutorialId = activeTutorial.value.id
    tutorialProgress.value[tutorialId] = {
      currentStep: totalSteps.value,
      completed: true
    }

    await saveProgress(true)

    // Speak completion message
    if (settings.value.voiceEnabled && currentStepData.value?.narration) {
      await speak(currentStepData.value.narration)
    }

    // Close tutorial after a delay
    setTimeout(() => {
      closeTutorial()
    }, 3000)
  }

  async function saveProgress(completed = false) {
    if (!userStore.loggedIn || !activeTutorial.value) return

    try {
      await fetch(`${API_BASE}/api/teacher/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userStore.email,
          'x-user-role': userStore.role
        },
        body: JSON.stringify({
          tutorial_id: activeTutorial.value.id,
          current_step: currentStep.value,
          completed
        })
      })
    } catch (error) {
      console.error('Failed to save progress:', error)
    }
  }

  function closeTutorial() {
    stopAudio()
    activeTutorial.value = null
    currentStep.value = 0
  }

  // Text-to-Speech with browser fallback
  async function speak(text) {
    if (!settings.value.voiceEnabled || !text) return

    stopAudio()

    const cacheKey = `${text}-${settings.value.voice}-${settings.value.language}`
    let audioUrl = audioCache.get(cacheKey)

    if (!audioUrl) {
      try {
        const response = await fetch(`${API_BASE}/api/teacher/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice: settings.value.voice,
            language: settings.value.language === 'no' ? 'no-NO' : 'en-US'
          })
        })

        const contentType = response.headers.get('content-type')

        // Check if we got audio back or JSON (fallback signal)
        if (contentType?.includes('audio')) {
          const blob = await response.blob()
          audioUrl = URL.createObjectURL(blob)
          audioCache.set(cacheKey, audioUrl)
        } else {
          // Server returned JSON - TTS failed, stay silent (no browser fallback)
          const data = await response.json()
          console.warn('TTS unavailable:', data.error)
          isPlaying.value = false
          return
        }
      } catch (error) {
        console.error('TTS error:', error)
        isPlaying.value = false
        return
      }
    }

    audioElement.value = new Audio(audioUrl)
    audioElement.value.onended = () => { isPlaying.value = false }
    audioElement.value.onerror = () => {
      isPlaying.value = false
      console.warn('Audio playback error')
    }

    try {
      await audioElement.value.play()
      isPlaying.value = true
    } catch (error) {
      console.error('Audio playback error:', error)
      isPlaying.value = false
    }
  }

  // Browser Web Speech API fallback (disabled - sounds terrible)
  function useBrowserTTS(text) {
    // Disabled - browser voices don't sound good
    console.log('Browser TTS disabled, text:', text.substring(0, 50))
    return

    /* Original browser TTS code - kept for reference
    if (!window.speechSynthesis) {
      console.warn('Browser TTS not available')
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = settings.value.language === 'no' ? 'nb-NO' : 'en-US'
    utterance.rate = 1.0
    utterance.pitch = 1.0

    utterance.onstart = () => { isPlaying.value = true }
    utterance.onend = () => { isPlaying.value = false }
    utterance.onerror = () => { isPlaying.value = false }

    window.speechSynthesis.speak(utterance)
    */
  }

  function stopAudio() {
    // Stop audio element
    if (audioElement.value) {
      audioElement.value.pause()
      audioElement.value.currentTime = 0
    }
    // Stop browser TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    isPlaying.value = false
  }

  function toggleVoice() {
    settings.value.voiceEnabled = !settings.value.voiceEnabled
    if (!settings.value.voiceEnabled) {
      stopAudio()
    }
    saveSettings()
  }

  async function setLanguage(lang) {
    settings.value.language = lang
    await saveSettings()
    await loadVoices()
    await loadTutorials()
  }

  async function setVoice(voiceId) {
    settings.value.voice = voiceId
    await saveSettings()
  }

  function setCurrentView(view) {
    currentView.value = view
    loadTutorials()
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  // Context-aware suggestions
  function updateSuggestions(context) {
    const suggestions = []

    if (currentView.value === 'GraphCanvas') {
      if (context.nodeCount === 0) {
        suggestions.push(tutorials.value.find(t => t.id.includes('first-node')))
      } else if (context.edgeCount === 0 && context.nodeCount >= 2) {
        suggestions.push(tutorials.value.find(t => t.id.includes('connect-nodes')))
      } else if (context.selectedCount === 1 && !context.hasStyledNode) {
        suggestions.push(tutorials.value.find(t => t.id.includes('style-nodes')))
      }
    }

    contextSuggestions.value = suggestions.filter(Boolean)
  }

  function getProgressForTutorial(tutorialId) {
    return tutorialProgress.value[tutorialId] || null
  }

  return {
    // State
    isOpen,
    isLoading,
    currentView,
    settings,
    availableVoices,
    availableLanguages,
    tutorials,
    activeTutorial,
    currentStep,
    tutorialProgress,
    searchQuery,
    searchResults,
    selectedGuideSection,
    isPlaying,
    contextSuggestions,

    // Computed
    tutorialsForCurrentView,
    currentStepData,
    totalSteps,
    isLastStep,
    progressPercent,

    // Actions
    initialize,
    loadSettings,
    saveSettings,
    loadVoices,
    loadTutorials,
    searchGuide,
    loadGuideSection,
    startTutorial,
    nextStep,
    prevStep,
    completeTutorial,
    closeTutorial,
    speak,
    stopAudio,
    toggleVoice,
    setLanguage,
    setVoice,
    setCurrentView,
    toggle,
    open,
    close,
    updateSuggestions,
    getProgressForTutorial
  }
})
