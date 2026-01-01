<template>
  <div class="gnew-audio-visualizer-node">
    <!-- Title -->
    <div class="node-title">
      <span class="title-text">{{ displayTitle }}</span>
    </div>

    <!-- Waveform Visualization -->
    <div class="waveform-container">
      <AudioWaveformCanvas
        v-if="hasValidAudioUrl"
        :waveform-data="waveformBuffer"
        :current-time="currentTime"
        :duration="duration"
        :is-playing="isPlaying"
        :time-domain-data="timeDomainData"
        :frequency-data="frequencyData"
        :zoom-level="zoomLevel"
        :width="300"
        :height="80"
        @seek="handleSeek"
        @scrub-start="handleScrubStart"
        @scrub-end="handleScrubEnd"
        @zoom-change="handleZoomChange"
      />

      <!-- No audio placeholder -->
      <div v-else class="no-audio-placeholder" @click.stop="openPortfolioModal">
        <div class="placeholder-icon">&#127925;</div>
        <p class="placeholder-text">Click to select audio</p>
      </div>

      <!-- Loading overlay -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="spinner"></div>
        <span>Loading...</span>
      </div>
    </div>

    <!-- Playback Controls -->
    <div class="playback-controls">
      <button
        @click.stop="togglePlayback"
        class="play-btn"
        :class="{ playing: isPlaying }"
        :disabled="!hasValidAudioUrl || isLoading"
      >
        {{ isPlaying ? '⏸' : '▶' }}
      </button>

      <div class="time-display">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </div>

      <button
        @click.stop="openPortfolioModal"
        class="select-btn"
        title="Select audio"
      >
        📁
      </button>
    </div>

    <!-- Audio Portfolio Modal -->
    <AudioPortfolioModal
      :isVisible="showPortfolioModal"
      @close="closePortfolioModal"
      @audio-selected="handleAudioSelected"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AudioWaveformCanvas from '@/components/AudioWaveformCanvas.vue'
import AudioPortfolioModal from '@/components/AudioPortfolioModal.vue'
import { useAudioWaveform } from '@/composables/useAudioWaveform'

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  isPreview: {
    type: Boolean,
    default: false
  },
  showControls: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['node-updated', 'node-deleted'])

// Audio waveform composable
const {
  waveformBuffer,
  timeDomainData,
  frequencyData,
  isPlaying,
  currentTime,
  duration,
  isLoading,
  error,
  initializeAudio,
  play,
  pause,
  togglePlayback,
  seekByPercentage,
  formatTime,
  cleanup
} = useAudioWaveform()

// Local state
const showPortfolioModal = ref(false)
const zoomLevel = ref(1)
const wasPlayingBeforeScrub = ref(false)
const localAudioUrl = ref('')
const localTitle = ref('')

// Computed
const hasValidAudioUrl = computed(() => {
  const url = localAudioUrl.value || props.node?.audioUrl || props.node?.path
  return url && typeof url === 'string' && url.trim().length > 0
})

const displayTitle = computed(() => {
  return localTitle.value || props.node?.label || props.node?.audioTitle || 'Audio Visualizer'
})

const audioUrl = computed(() => {
  return localAudioUrl.value || props.node?.audioUrl || props.node?.path || ''
})

// Methods
const handleSeek = (percentage) => {
  seekByPercentage(percentage)
}

const handleScrubStart = () => {
  wasPlayingBeforeScrub.value = isPlaying.value
  if (isPlaying.value) pause()
}

const handleScrubEnd = () => {
  if (wasPlayingBeforeScrub.value) play()
}

const handleZoomChange = (newZoom) => {
  zoomLevel.value = newZoom
}

const openPortfolioModal = () => {
  showPortfolioModal.value = true
}

const closePortfolioModal = () => {
  showPortfolioModal.value = false
}

const handleAudioSelected = async (audioData) => {
  console.log('Audio selected:', audioData)
  closePortfolioModal()

  const newAudioUrl = audioData.r2Url || audioData.url || ''
  if (!newAudioUrl) return

  // Store locally
  localAudioUrl.value = newAudioUrl
  localTitle.value = audioData.label || audioData.filename || 'Audio'

  // Emit update
  emit('node-updated', {
    ...props.node,
    audioUrl: newAudioUrl,
    label: localTitle.value
  })

  // Initialize audio
  cleanup()
  await initializeAudio(newAudioUrl)
}

// Initialize on mount if audio URL exists
onMounted(async () => {
  if (audioUrl.value) {
    await initializeAudio(audioUrl.value)
  }
})

onUnmounted(() => {
  cleanup()
})
</script>

<style scoped>
.gnew-audio-visualizer-node {
  background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
  border: 2px solid #3498db;
  border-radius: 12px;
  padding: 12px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  color: white;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.node-title {
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
}

.title-text {
  font-size: 14px;
  font-weight: 600;
  color: #ecf0f1;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waveform-container {
  flex: 1;
  background: #1a1a2e;
  border-radius: 8px;
  overflow: hidden;
  min-height: 80px;
  position: relative;
  cursor: pointer;
  pointer-events: auto;
}

.no-audio-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 80px;
  color: rgba(255,255,255,0.5);
}

.placeholder-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.placeholder-text {
  margin: 0;
  font-size: 12px;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: white;
  font-size: 12px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.2);
  pointer-events: auto;
}

.play-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #3498db;
  color: white;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-btn:hover:not(:disabled) {
  background: #2980b9;
}

.play-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.play-btn.playing {
  background: #e74c3c;
}

.time-display {
  flex: 1;
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  font-family: monospace;
}

.select-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.3);
  background: transparent;
  color: white;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.select-btn:hover {
  background: rgba(255,255,255,0.1);
}
</style>
