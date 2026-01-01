<template>
  <div
    class="waveform-canvas"
    ref="canvasContainer"
    @wheel.prevent="handleWheelZoom"
  >
    <svg
      ref="svgCanvas"
      :width="canvasWidth"
      :height="canvasHeight"
      :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`"
      class="waveform-svg"
      @mousedown="startScrub"
      @mousemove="handleScrub"
      @mouseup="endScrub"
      @mouseleave="endScrub"
      @touchstart.prevent="startScrubTouch"
      @touchmove.prevent="handleScrubTouch"
      @touchend="endScrub"
    >
      <!-- Background -->
      <rect
        x="0"
        y="0"
        :width="canvasWidth"
        :height="canvasHeight"
        fill="#1a1a2e"
        rx="4"
      />

      <!-- Grid lines -->
      <g class="grid-lines" opacity="0.2">
        <line
          v-for="i in 4"
          :key="'hline-' + i"
          :x1="0"
          :y1="(canvasHeight / 5) * i"
          :x2="canvasWidth"
          :y2="(canvasHeight / 5) * i"
          stroke="#4a4a6a"
          stroke-width="1"
        />
      </g>

      <!-- Center line -->
      <line
        :x1="0"
        :y1="canvasHeight / 2"
        :x2="canvasWidth"
        :y2="canvasHeight / 2"
        stroke="#4a4a6a"
        stroke-width="1"
        opacity="0.5"
      />

      <!-- Static waveform bars -->
      <g class="waveform-bars">
        <rect
          v-for="(amplitude, index) in visibleWaveform"
          :key="'bar-' + index"
          :x="getBarX(index)"
          :y="getBarY(amplitude)"
          :width="barWidth"
          :height="getBarHeight(amplitude)"
          :fill="getBarColor(index)"
          class="waveform-bar"
          rx="1"
        />
      </g>

      <!-- Real-time audio visualization overlay -->
      <g v-if="isPlaying && timeDomainData.length > 0" class="realtime-visualization">
        <path
          :d="realtimeWavePath"
          fill="none"
          stroke="#00ff88"
          stroke-width="2"
          opacity="0.7"
        />
      </g>

      <!-- Playback position indicator (playhead) -->
      <g v-if="duration > 0" class="playhead-group">
        <line
          :x1="playheadPosition"
          :y1="0"
          :x2="playheadPosition"
          :y2="canvasHeight"
          stroke="#ff6b6b"
          stroke-width="2"
          class="playhead"
        />
        <!-- Playhead handle -->
        <circle
          :cx="playheadPosition"
          :cy="6"
          r="5"
          fill="#ff6b6b"
          class="playhead-handle"
        />
      </g>

      <!-- Zoom viewport indicator -->
      <rect
        v-if="zoomLevel > 1"
        :x="viewportIndicatorX"
        :y="canvasHeight - 6"
        :width="viewportIndicatorWidth"
        :height="4"
        fill="rgba(255,255,255,0.4)"
        rx="2"
        class="viewport-indicator"
      />

      <!-- Hover time indicator -->
      <g v-if="hoverPosition !== null && !isScrubbing" class="hover-indicator">
        <line
          :x1="hoverPosition"
          :y1="0"
          :x2="hoverPosition"
          :y2="canvasHeight"
          stroke="rgba(255,255,255,0.3)"
          stroke-width="1"
          stroke-dasharray="4,4"
        />
        <rect
          :x="Math.min(hoverPosition + 5, canvasWidth - 45)"
          :y="5"
          width="40"
          height="18"
          fill="rgba(0,0,0,0.7)"
          rx="3"
        />
        <text
          :x="Math.min(hoverPosition + 25, canvasWidth - 25)"
          :y="17"
          fill="white"
          font-size="10"
          text-anchor="middle"
        >
          {{ hoverTimeFormatted }}
        </text>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  waveformData: {
    type: Array,
    default: () => []
  },
  currentTime: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0
  },
  isPlaying: {
    type: Boolean,
    default: false
  },
  timeDomainData: {
    type: [Uint8Array, Array],
    default: () => new Uint8Array(0)
  },
  frequencyData: {
    type: [Uint8Array, Array],
    default: () => new Uint8Array(0)
  },
  zoomLevel: {
    type: Number,
    default: 1
  },
  width: {
    type: Number,
    default: 300
  },
  height: {
    type: Number,
    default: 80
  }
})

const emit = defineEmits(['seek', 'scrub-start', 'scrub-end', 'zoom-change'])

// Canvas dimensions
const canvasWidth = computed(() => props.width)
const canvasHeight = computed(() => props.height)

// Interaction state
const isScrubbing = ref(false)
const wasPlayingBeforeScrub = ref(false)
const hoverPosition = ref(null)
const panOffset = ref(0) // For zoomed view panning (0-1)

// Bar dimensions
const barGap = 1
const barWidth = computed(() => {
  const totalBars = props.waveformData.length || 1
  const availableWidth = canvasWidth.value * props.zoomLevel
  return Math.max(1, (availableWidth / totalBars) - barGap)
})

// Visible waveform based on zoom/pan
const visibleWaveform = computed(() => {
  if (props.zoomLevel === 1 || !props.waveformData.length) {
    return props.waveformData
  }

  // Calculate visible portion
  const visibleCount = Math.ceil(props.waveformData.length / props.zoomLevel)
  const maxOffset = 1 - (1 / props.zoomLevel)
  const normalizedOffset = Math.min(panOffset.value, maxOffset)
  const startIndex = Math.floor(normalizedOffset * props.waveformData.length)

  return props.waveformData.slice(startIndex, startIndex + visibleCount)
})

// Playhead position in pixels
const playheadPosition = computed(() => {
  if (props.duration === 0) return 0
  const progress = props.currentTime / props.duration
  return progress * canvasWidth.value
})

// Viewport indicator for zoom
const viewportIndicatorWidth = computed(() => {
  return canvasWidth.value / props.zoomLevel
})

const viewportIndicatorX = computed(() => {
  return panOffset.value * (canvasWidth.value - viewportIndicatorWidth.value)
})

// Hover time formatted
const hoverTimeFormatted = computed(() => {
  if (hoverPosition.value === null || props.duration === 0) return '0:00'
  const percentage = hoverPosition.value / canvasWidth.value
  const time = percentage * props.duration
  return formatTime(time)
})

// Real-time waveform path from time-domain data
const realtimeWavePath = computed(() => {
  if (!props.timeDomainData || props.timeDomainData.length === 0) return ''

  const sliceWidth = canvasWidth.value / props.timeDomainData.length
  let path = ''

  for (let i = 0; i < props.timeDomainData.length; i++) {
    const v = props.timeDomainData[i] / 128.0 // Normalize to 0-2 range
    const y = (v * canvasHeight.value) / 2

    if (i === 0) {
      path = `M 0 ${y}`
    } else {
      path += ` L ${i * sliceWidth} ${y}`
    }
  }

  return path
})

// Bar positioning helpers
const getBarX = (index) => {
  return index * (barWidth.value + barGap)
}

const getBarY = (amplitude) => {
  const barHeight = amplitude * canvasHeight.value * 0.8
  return (canvasHeight.value - barHeight) / 2
}

const getBarHeight = (amplitude) => {
  return Math.max(2, amplitude * canvasHeight.value * 0.8)
}

const getBarColor = (index) => {
  if (props.duration === 0) return '#2a5298'

  const progress = props.currentTime / props.duration
  const barProgress = index / (visibleWaveform.value.length || 1)

  // Account for zoom offset
  const adjustedBarProgress = props.zoomLevel > 1
    ? panOffset.value + (barProgress / props.zoomLevel)
    : barProgress

  return adjustedBarProgress < progress ? '#4ecdc4' : '#2a5298'
}

// Format time helper
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Mouse interaction handlers
const startScrub = (event) => {
  isScrubbing.value = true
  emit('scrub-start')
  handleScrub(event)
}

const handleScrub = (event) => {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - rect.left
  const clampedX = Math.max(0, Math.min(x, canvasWidth.value))

  if (isScrubbing.value) {
    const percentage = (clampedX / canvasWidth.value) * 100
    emit('seek', percentage)
  } else {
    hoverPosition.value = clampedX
  }
}

const endScrub = () => {
  if (isScrubbing.value) {
    isScrubbing.value = false
    emit('scrub-end')
  }
  hoverPosition.value = null
}

// Touch interaction handlers
const startScrubTouch = (event) => {
  isScrubbing.value = true
  emit('scrub-start')
  handleScrubTouch(event)
}

const handleScrubTouch = (event) => {
  if (!isScrubbing.value || !event.touches[0]) return

  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.touches[0].clientX - rect.left
  const clampedX = Math.max(0, Math.min(x, canvasWidth.value))
  const percentage = (clampedX / canvasWidth.value) * 100
  emit('seek', percentage)
}

// Wheel zoom handler
const handleWheelZoom = (event) => {
  const delta = event.deltaY < 0 ? 0.5 : -0.5
  const newZoom = Math.max(1, Math.min(10, props.zoomLevel + delta))

  if (newZoom !== props.zoomLevel) {
    emit('zoom-change', newZoom)
  }
}

// Update pan offset to follow playhead when zoomed
watch(() => props.currentTime, (newTime) => {
  if (props.zoomLevel > 1 && props.duration > 0 && !isScrubbing.value) {
    const progress = newTime / props.duration
    const viewportSize = 1 / props.zoomLevel
    const halfViewport = viewportSize / 2

    // Center playhead in viewport
    const targetOffset = progress - halfViewport
    panOffset.value = Math.max(0, Math.min(1 - viewportSize, targetOffset))
  }
})

// Mouse leave handler for hover
const canvasContainer = ref(null)
onMounted(() => {
  if (canvasContainer.value) {
    canvasContainer.value.addEventListener('mouseleave', () => {
      hoverPosition.value = null
    })
  }
})
</script>

<style scoped>
.waveform-canvas {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
}

.waveform-svg {
  display: block;
}

.waveform-bar {
  transition: fill 0.1s ease;
}

.playhead {
  filter: drop-shadow(0 0 3px rgba(255, 107, 107, 0.5));
}

.playhead-handle {
  cursor: ew-resize;
  filter: drop-shadow(0 0 2px rgba(255, 107, 107, 0.8));
}

.realtime-visualization path {
  filter: drop-shadow(0 0 2px rgba(0, 255, 136, 0.5));
}

.hover-indicator {
  pointer-events: none;
}

.viewport-indicator {
  pointer-events: none;
}
</style>
