import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useUserStore } from './userStore'

export const useAudioPortfolioStore = defineStore('audioPortfolio', () => {
  const userStore = useUserStore()

  // State
  const recordings = ref([])
  const loading = ref(false)
  const error = ref(null)
  const lastFetch = ref(null)

  // Computed
  const recordingsWithDiarization = computed(() => {
    return recordings.value.filter(r => r.diarization?.segments?.length > 0)
  })

  const recordingsWithTranscription = computed(() => {
    return recordings.value.filter(r => r.transcriptionText || r.norwegianTranscription)
  })

  const totalDuration = computed(() => {
    return recordings.value.reduce((sum, r) => sum + (r.duration || 0), 0)
  })

  // Actions
  const fetchRecordings = async (force = false) => {
    // Cache for 30 seconds unless forced
    if (!force && lastFetch.value && Date.now() - lastFetch.value < 30000) {
      return recordings.value
    }

    if (!userStore.email) {
      error.value = 'User not logged in'
      return []
    }

    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        `https://audio-portfolio-worker.torarnehave.workers.dev/list-recordings?userEmail=${encodeURIComponent(userStore.email)}`
      )

      if (!response.ok) {
        throw new Error(`Failed to load portfolio: ${response.statusText}`)
      }

      const data = await response.json()
      recordings.value = data.recordings || []
      lastFetch.value = Date.now()

      return recordings.value
    } catch (err) {
      console.error('Error loading audio portfolio:', err)
      error.value = err.message
      return []
    } finally {
      loading.value = false
    }
  }

  const updateRecording = async (recordingId, updates) => {
    if (!userStore.email) {
      throw new Error('User not logged in')
    }

    try {
      const response = await fetch(
        'https://audio-portfolio-worker.torarnehave.workers.dev/update-recording',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': userStore.email,
          },
          body: JSON.stringify({
            id: recordingId,
            updates
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to update: ${response.status}`)
      }

      const result = await response.json()

      // Update local cache
      const index = recordings.value.findIndex(r => r.recordingId === recordingId)
      if (index !== -1) {
        recordings.value[index] = result.updatedRecording
      }

      return result.updatedRecording
    } catch (err) {
      console.error('Error updating recording:', err)
      throw err
    }
  }

  const getRecording = (recordingId) => {
    return recordings.value.find(r => r.recordingId === recordingId)
  }

  const hasDiarization = (recordingId) => {
    const recording = getRecording(recordingId)
    return !!(recording?.diarization?.segments?.length > 0)
  }

  const hasTranscription = (recordingId) => {
    const recording = getRecording(recordingId)
    return !!(recording?.transcriptionText || recording?.norwegianTranscription)
  }

  const refreshRecording = async (recordingId) => {
    await fetchRecordings(true)
    return getRecording(recordingId)
  }

  return {
    // State
    recordings,
    loading,
    error,

    // Computed
    recordingsWithDiarization,
    recordingsWithTranscription,
    totalDuration,

    // Actions
    fetchRecordings,
    updateRecording,
    getRecording,
    hasDiarization,
    hasTranscription,
    refreshRecording
  }
})
