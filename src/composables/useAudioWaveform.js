/**
 * Audio Waveform Composable
 * Provides Web Audio API integration for real-time waveform visualization
 */

import { ref, onUnmounted, computed } from 'vue'

export function useAudioWaveform() {
  // Audio context and nodes
  const audioContext = ref(null)
  const analyserNode = ref(null)
  const sourceNode = ref(null)
  const audioElement = ref(null)

  // Waveform data
  const frequencyData = ref(new Uint8Array(0))
  const timeDomainData = ref(new Uint8Array(0))
  const waveformBuffer = ref([]) // Pre-computed full waveform for static display

  // Playback state
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const isLoading = ref(false)
  const error = ref(null)

  // Animation frame ID for cleanup
  let animationFrameId = null
  let timeUpdateInterval = null

  /**
   * Initialize audio with a URL
   * @param {string} audioUrl - URL of the audio file
   */
  const initializeAudio = async (audioUrl) => {
    if (!audioUrl) {
      error.value = 'No audio URL provided'
      return false
    }

    isLoading.value = true
    error.value = null

    try {
      // Create or resume AudioContext
      if (!audioContext.value) {
        audioContext.value = new (window.AudioContext || window.webkitAudioContext)()
      }

      if (audioContext.value.state === 'suspended') {
        await audioContext.value.resume()
      }

      // Create audio element for playback
      audioElement.value = new Audio()
      audioElement.value.crossOrigin = 'anonymous'
      audioElement.value.src = audioUrl

      // Wait for metadata to load
      await new Promise((resolve, reject) => {
        audioElement.value.addEventListener('loadedmetadata', resolve, { once: true })
        audioElement.value.addEventListener('error', reject, { once: true })
        audioElement.value.load()
      })

      duration.value = audioElement.value.duration

      // Create analyser node
      analyserNode.value = audioContext.value.createAnalyser()
      analyserNode.value.fftSize = 2048
      analyserNode.value.smoothingTimeConstant = 0.8

      // Connect audio element to analyser and destination
      sourceNode.value = audioContext.value.createMediaElementSource(audioElement.value)
      sourceNode.value.connect(analyserNode.value)
      analyserNode.value.connect(audioContext.value.destination)

      // Initialize data arrays
      frequencyData.value = new Uint8Array(analyserNode.value.frequencyBinCount)
      timeDomainData.value = new Uint8Array(analyserNode.value.fftSize)

      // Pre-compute waveform for static display (non-blocking, errors handled internally)
      try {
        await precomputeWaveform(audioUrl)
      } catch (waveformErr) {
        console.warn('Waveform precomputation failed (non-critical):', waveformErr)
        // Use fallback waveform, don't set error
        waveformBuffer.value = Array(200).fill(0.1)
      }

      // Setup event listeners
      audioElement.value.addEventListener('play', () => {
        isPlaying.value = true
        startAnalyserLoop()
      })

      audioElement.value.addEventListener('pause', () => {
        isPlaying.value = false
        stopAnalyserLoop()
      })

      audioElement.value.addEventListener('ended', () => {
        isPlaying.value = false
        currentTime.value = 0
        stopAnalyserLoop()
      })

      // Start time update interval
      timeUpdateInterval = setInterval(() => {
        if (audioElement.value) {
          currentTime.value = audioElement.value.currentTime
        }
      }, 50)

      isLoading.value = false
      error.value = null // Clear any previous errors on successful load
      return true
    } catch (err) {
      console.error('Error initializing audio:', err)
      error.value = err.message || 'Failed to load audio'
      isLoading.value = false
      return false
    }
  }

  /**
   * Pre-compute waveform data for static display
   * @param {string} audioUrl - URL of the audio file
   */
  const precomputeWaveform = async (audioUrl) => {
    try {
      const response = await fetch(audioUrl)
      const arrayBuffer = await response.arrayBuffer()

      // Create offline context for decoding
      const offlineContext = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
        1, // mono
        44100, // sample rate
        44100 // duration placeholder
      )

      const decodedBuffer = await audioContext.value.decodeAudioData(arrayBuffer.slice(0))
      const channelData = decodedBuffer.getChannelData(0)

      // Sample the waveform at regular intervals
      const samples = 200 // Number of bars to display
      const blockSize = Math.floor(channelData.length / samples)
      const waveform = []

      for (let i = 0; i < samples; i++) {
        let sum = 0
        const start = i * blockSize
        const end = Math.min(start + blockSize, channelData.length)

        for (let j = start; j < end; j++) {
          sum += Math.abs(channelData[j])
        }

        // Normalize to 0-1 range
        const average = sum / (end - start)
        waveform.push(Math.min(1, average * 2)) // Scale up for visibility
      }

      waveformBuffer.value = waveform
    } catch (err) {
      console.error('Error precomputing waveform:', err)
      // Generate empty waveform as fallback
      waveformBuffer.value = Array(200).fill(0.1)
    }
  }

  /**
   * Start the analyser update loop for real-time visualization
   */
  const startAnalyserLoop = () => {
    const updateAnalyser = () => {
      if (analyserNode.value && isPlaying.value) {
        analyserNode.value.getByteTimeDomainData(timeDomainData.value)
        analyserNode.value.getByteFrequencyData(frequencyData.value)
        // Trigger reactivity by creating new array references
        timeDomainData.value = new Uint8Array(timeDomainData.value)
        frequencyData.value = new Uint8Array(frequencyData.value)
        animationFrameId = requestAnimationFrame(updateAnalyser)
      }
    }
    updateAnalyser()
  }

  /**
   * Stop the analyser update loop
   */
  const stopAnalyserLoop = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  /**
   * Play the audio
   */
  const play = async () => {
    if (!audioElement.value) return

    try {
      if (audioContext.value?.state === 'suspended') {
        await audioContext.value.resume()
      }
      await audioElement.value.play()
    } catch (err) {
      console.error('Error playing audio:', err)
      error.value = 'Failed to play audio'
    }
  }

  /**
   * Pause the audio
   */
  const pause = () => {
    if (audioElement.value) {
      audioElement.value.pause()
    }
  }

  /**
   * Toggle play/pause
   */
  const togglePlayback = () => {
    if (isPlaying.value) {
      pause()
    } else {
      play()
    }
  }

  /**
   * Seek to a specific time
   * @param {number} time - Time in seconds
   */
  const seek = (time) => {
    if (audioElement.value) {
      audioElement.value.currentTime = Math.max(0, Math.min(time, duration.value))
      currentTime.value = audioElement.value.currentTime
    }
  }

  /**
   * Seek by percentage
   * @param {number} percentage - Position as percentage (0-100)
   */
  const seekByPercentage = (percentage) => {
    const time = (percentage / 100) * duration.value
    seek(time)
  }

  /**
   * Format time as MM:SS
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time string
   */
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * Progress as percentage (0-100)
   */
  const progress = computed(() => {
    if (duration.value === 0) return 0
    return (currentTime.value / duration.value) * 100
  })

  /**
   * Cleanup resources
   */
  const cleanup = () => {
    stopAnalyserLoop()

    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval)
      timeUpdateInterval = null
    }

    if (audioElement.value) {
      audioElement.value.pause()
      audioElement.value.src = ''
      audioElement.value = null
    }

    if (sourceNode.value) {
      sourceNode.value.disconnect()
      sourceNode.value = null
    }

    if (analyserNode.value) {
      analyserNode.value.disconnect()
      analyserNode.value = null
    }

    // Don't close audioContext as it may be reused
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    // State
    audioContext,
    analyserNode,
    frequencyData,
    timeDomainData,
    waveformBuffer,
    isPlaying,
    currentTime,
    duration,
    isLoading,
    error,
    progress,

    // Methods
    initializeAudio,
    play,
    pause,
    togglePlayback,
    seek,
    seekByPercentage,
    formatTime,
    cleanup
  }
}
