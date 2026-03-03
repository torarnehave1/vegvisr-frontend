<template>
  <Teleport to="body">
    <div v-if="recording" class="clip-modal-overlay" @click="$emit('close')">
      <div class="clip-modal-container" @click.stop>
        <div class="clip-modal-header">
          <h4 class="clip-modal-title">
            <span>&#9986;</span> Clip Audio: {{ recording.displayName || 'Untitled' }}
          </h4>
          <button class="btn-close" @click="$emit('close')">&times;</button>
        </div>

        <div class="clip-modal-body">
          <!-- Loading state -->
          <div v-if="loadingAudio" class="text-center py-4">
            <div class="spinner-border spinner-border-sm" role="status"></div>
            <p class="mt-2 text-muted">Loading audio waveform...</p>
          </div>

          <!-- Error state -->
          <div v-if="loadError" class="alert alert-danger">{{ loadError }}</div>

          <!-- Waveform with region selection -->
          <div v-if="!loadingAudio && !loadError && waveformData.length > 0" class="waveform-section">
            <!-- Zoom controls -->
            <div class="zoom-controls d-flex align-items-center justify-content-between mb-2">
              <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-secondary" @click="zoomOut" :disabled="zoomLevel <= 1">&#8722;</button>
                <span class="zoom-label small text-muted">{{ zoomLevel.toFixed(1) }}x</span>
                <button class="btn btn-sm btn-outline-secondary" @click="zoomIn" :disabled="zoomLevel >= 20">+</button>
                <button v-if="zoomLevel > 1" class="btn btn-sm btn-outline-secondary ms-1" @click="resetZoom">Reset</button>
              </div>
              <small class="text-muted">Scroll to zoom, drag to pan</small>
            </div>

            <div
              class="waveform-wrapper"
              @wheel.prevent="handleWheelZoom"
            >
              <svg
                ref="waveformSvg"
                :width="svgWidth"
                :height="svgHeight"
                :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
                class="clip-waveform-svg"
                @mousedown="handleWaveformClick"
                @mousemove="handleMouseMove"
                @mouseup="handleMouseUp"
                @mouseleave="handleMouseUp"
              >
                <!-- Background -->
                <rect x="0" y="0" :width="svgWidth" :height="svgHeight" fill="#1a1a2e" rx="4" />

                <!-- Center line -->
                <line :x1="0" :y1="svgHeight / 2" :x2="svgWidth" :y2="svgHeight / 2" stroke="#4a4a6a" stroke-width="1" opacity="0.5" />

                <!-- Waveform bars (only visible portion) -->
                <rect
                  v-for="(bar, i) in visibleBars"
                  :key="'bar-' + i"
                  :x="bar.x"
                  :y="(svgHeight - bar.amp * svgHeight * 0.8) / 2"
                  :width="visibleBarWidth"
                  :height="Math.max(2, bar.amp * svgHeight * 0.8)"
                  :fill="bar.fill"
                  rx="1"
                />

                <!-- Selected region highlight -->
                <rect
                  v-if="regionVisibleX.width > 0"
                  :x="regionVisibleX.x"
                  y="0"
                  :width="regionVisibleX.width"
                  :height="svgHeight"
                  fill="rgba(78, 205, 196, 0.15)"
                />

                <!-- Start handle (if visible) -->
                <g v-if="startHandleVisible" class="handle start-handle" :transform="`translate(${startHandleScreenX}, 0)`" style="cursor: ew-resize">
                  <line x1="0" y1="0" x2="0" :y2="svgHeight" stroke="#4ecdc4" stroke-width="3" />
                  <rect x="-8" y="0" width="16" :height="svgHeight" fill="transparent" />
                  <polygon :points="`0,0 8,12 -8,12`" fill="#4ecdc4" />
                  <polygon :points="`0,${svgHeight} 8,${svgHeight - 12} -8,${svgHeight - 12}`" fill="#4ecdc4" />
                </g>

                <!-- End handle (if visible) -->
                <g v-if="endHandleVisible" class="handle end-handle" :transform="`translate(${endHandleScreenX}, 0)`" style="cursor: ew-resize">
                  <line x1="0" y1="0" x2="0" :y2="svgHeight" stroke="#ff6b6b" stroke-width="3" />
                  <rect x="-8" y="0" width="16" :height="svgHeight" fill="transparent" />
                  <polygon :points="`0,0 8,12 -8,12`" fill="#ff6b6b" />
                  <polygon :points="`0,${svgHeight} 8,${svgHeight - 12} -8,${svgHeight - 12}`" fill="#ff6b6b" />
                </g>

                <!-- Playhead -->
                <line
                  v-if="audioDuration > 0 && playheadScreenX >= 0 && playheadScreenX <= svgWidth"
                  :x1="playheadScreenX"
                  y1="0"
                  :x2="playheadScreenX"
                  :y2="svgHeight"
                  stroke="#ffffff"
                  stroke-width="1.5"
                  opacity="0.7"
                />

                <!-- Viewport indicator (minimap) when zoomed -->
                <g v-if="zoomLevel > 1">
                  <!-- Minimap background -->
                  <rect :x="0" :y="svgHeight - 8" :width="svgWidth" height="8" fill="rgba(0,0,0,0.5)" />
                  <!-- Visible region -->
                  <rect
                    :x="(panOffset / audioDuration) * svgWidth"
                    :y="svgHeight - 8"
                    :width="Math.max(4, (viewDuration / audioDuration) * svgWidth)"
                    height="8"
                    fill="rgba(255,255,255,0.5)"
                    rx="2"
                  />
                </g>
              </svg>
            </div>

            <!-- Time labels under waveform -->
            <div class="time-labels d-flex justify-content-between mt-1">
              <small class="text-muted">{{ formatTime(panOffset) }}</small>
              <small class="text-muted">{{ formatTime(panOffset + viewDuration) }}</small>
            </div>
          </div>

          <!-- Time inputs and clip info -->
          <div v-if="audioDuration > 0" class="clip-controls mt-3">
            <div class="row g-3 align-items-end">
              <div class="col-auto">
                <label class="form-label mb-1 small">Start</label>
                <input
                  type="text"
                  class="form-control form-control-sm time-input"
                  :value="formatTime(clipStart)"
                  @change="parseTimeInput($event, 'start')"
                />
              </div>
              <div class="col-auto">
                <label class="form-label mb-1 small">End</label>
                <input
                  type="text"
                  class="form-control form-control-sm time-input"
                  :value="formatTime(clipEnd)"
                  @change="parseTimeInput($event, 'end')"
                />
              </div>
              <div class="col-auto">
                <span class="badge bg-info">Clip: {{ formatTime(clipEnd - clipStart) }}</span>
              </div>
              <div class="col-auto">
                <button class="btn btn-sm btn-outline-secondary" @click="previewClip" :disabled="previewing">
                  {{ previewing ? '&#9632; Stop' : '&#9654; Preview' }}
                </button>
              </div>
            </div>

            <!-- Clip metadata -->
            <div class="row g-3 mt-2">
              <div class="col-md-8">
                <label class="form-label mb-1 small">Clip Name</label>
                <input type="text" class="form-control form-control-sm" v-model="clipName" />
              </div>
              <div class="col-md-4">
                <label class="form-label mb-1 small">Category</label>
                <input type="text" class="form-control form-control-sm" v-model="clipCategory" />
              </div>
            </div>
          </div>

          <!-- Saving progress -->
          <div v-if="saving" class="mt-3">
            <div class="progress">
              <div class="progress-bar progress-bar-striped progress-bar-animated" :style="{ width: saveProgress + '%' }">
                {{ saveMessage }}
              </div>
            </div>
          </div>

          <div v-if="saveError" class="alert alert-danger mt-3">{{ saveError }}</div>
          <div v-if="saveSuccess" class="alert alert-success mt-3">{{ saveSuccess }}</div>
        </div>

        <div class="clip-modal-footer">
          <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="saving || loadingAudio || clipEnd - clipStart < 0.5"
            @click="saveClip"
          >
            {{ saving ? 'Saving...' : 'Save Clip' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { trimAudioByTime } from '../utils/audioChunker'
import { useUserStore } from '../stores/userStore'

const NORWEGIAN_WORKER_URL = 'https://norwegian-transcription-worker.torarnehave.workers.dev'
const AUDIO_PORTFOLIO_WORKER_URL = 'https://audio-portfolio-worker.torarnehave.workers.dev'

const props = defineProps({
  recording: { type: Object, default: null }
})

const emit = defineEmits(['close', 'clip-saved'])

const userStore = useUserStore()

// SVG dimensions
const svgWidth = 600
const svgHeight = 140

// Audio state
const loadingAudio = ref(false)
const loadError = ref(null)
const audioDuration = ref(0)
const waveformData = ref([]) // Full resolution waveform (all bars)
const waveformSvg = ref(null)

// Zoom & pan state
const zoomLevel = ref(1)
const panOffset = ref(0) // Start time of visible window (in seconds)

// Region state
const clipStart = ref(0)
const clipEnd = ref(0)

// Dragging state: 'start', 'end', 'pan', or null
const dragging = ref(null)
const panDragStartX = ref(0)
const panDragStartOffset = ref(0)

// Preview state
const previewing = ref(false)
const previewAudio = ref(null)
const playheadTime = ref(0)
let playheadInterval = null

// Save state
const saving = ref(false)
const saveProgress = ref(0)
const saveMessage = ref('')
const saveError = ref(null)
const saveSuccess = ref(null)

// Clip metadata
const clipName = ref('')
const clipCategory = ref('')

const barCount = 600 // Higher resolution for zoom

// Duration of the visible time window
const viewDuration = computed(() => audioDuration.value / zoomLevel.value)

// Visible bar width depends on how many bars are in the visible window
const visibleBarWidth = computed(() => {
  const visibleCount = Math.ceil(barCount / zoomLevel.value)
  return Math.max(1, (svgWidth / visibleCount) - 1)
})

// Compute which bars are visible and their screen positions
const visibleBars = computed(() => {
  if (audioDuration.value === 0 || waveformData.value.length === 0) return []

  const startFraction = panOffset.value / audioDuration.value
  const endFraction = (panOffset.value + viewDuration.value) / audioDuration.value

  const startBar = Math.floor(startFraction * barCount)
  const endBar = Math.min(Math.ceil(endFraction * barCount), barCount)
  const visibleCount = endBar - startBar

  const bw = visibleCount > 0 ? Math.max(1, (svgWidth / visibleCount) - 1) : 2
  const gap = 1

  const clipStartFrac = clipStart.value / audioDuration.value
  const clipEndFrac = clipEnd.value / audioDuration.value

  const bars = []
  for (let i = startBar; i < endBar; i++) {
    const localIndex = i - startBar
    const barFraction = i / barCount
    const inRegion = barFraction >= clipStartFrac && barFraction <= clipEndFrac
    bars.push({
      x: localIndex * (bw + gap),
      amp: waveformData.value[i] || 0,
      fill: inRegion ? '#4ecdc4' : '#2a5298'
    })
  }
  return bars
})

// Convert a time (seconds) to screen X coordinate
function timeToScreenX(time) {
  if (audioDuration.value === 0 || viewDuration.value === 0) return 0
  return ((time - panOffset.value) / viewDuration.value) * svgWidth
}

// Convert screen X to time
function screenXToTime(x) {
  if (audioDuration.value === 0) return 0
  return panOffset.value + (x / svgWidth) * viewDuration.value
}

const startHandleScreenX = computed(() => timeToScreenX(clipStart.value))
const endHandleScreenX = computed(() => timeToScreenX(clipEnd.value))
const playheadScreenX = computed(() => timeToScreenX(playheadTime.value))

const startHandleVisible = computed(() => startHandleScreenX.value >= -10 && startHandleScreenX.value <= svgWidth + 10)
const endHandleVisible = computed(() => endHandleScreenX.value >= -10 && endHandleScreenX.value <= svgWidth + 10)

const regionVisibleX = computed(() => {
  const x1 = Math.max(0, startHandleScreenX.value)
  const x2 = Math.min(svgWidth, endHandleScreenX.value)
  return { x: x1, width: Math.max(0, x2 - x1) }
})

// Zoom functions
function zoomIn() {
  setZoom(Math.min(20, zoomLevel.value * 1.5))
}

function zoomOut() {
  setZoom(Math.max(1, zoomLevel.value / 1.5))
}

function resetZoom() {
  zoomLevel.value = 1
  panOffset.value = 0
}

function setZoom(newZoom, centerTime) {
  if (centerTime === undefined) {
    // Default: zoom centered on the middle of the current view
    centerTime = panOffset.value + viewDuration.value / 2
  }
  const oldZoom = zoomLevel.value
  zoomLevel.value = Math.max(1, Math.min(20, newZoom))

  // Adjust pan to keep centerTime in the same screen position
  const newViewDuration = audioDuration.value / zoomLevel.value
  panOffset.value = Math.max(0, Math.min(
    audioDuration.value - newViewDuration,
    centerTime - newViewDuration / 2
  ))
}

function handleWheelZoom(event) {
  if (audioDuration.value === 0) return

  // Get the time under the cursor
  const rect = waveformSvg.value?.getBoundingClientRect()
  if (!rect) return
  const svgX = ((event.clientX - rect.left) / rect.width) * svgWidth
  const timeUnderCursor = screenXToTime(svgX)

  const delta = event.deltaY < 0 ? 1.3 : 1 / 1.3
  setZoom(zoomLevel.value * delta, timeUnderCursor)
}

function getAudioUrl() {
  if (!props.recording) return ''
  const r = props.recording
  if (r.r2Key && r.r2Url) {
    try {
      const origin = new URL(r.r2Url).origin
      const encodedKey = String(r.r2Key).split('/').map(s => encodeURIComponent(s)).join('/')
      return `${origin}/${encodedKey}`
    } catch { /* fall through */ }
  }
  if (r.r2Url) return r.r2Url
  if (r.r2Key) {
    const encodedKey = String(r.r2Key).split('/').map(s => encodeURIComponent(s)).join('/')
    return `https://audio.vegvisr.org/${encodedKey}`
  }
  return ''
}

async function loadAudio() {
  const url = getAudioUrl()
  if (!url) {
    loadError.value = 'No audio URL available for this recording'
    return
  }

  loadingAudio.value = true
  loadError.value = null

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`)
    const arrayBuffer = await response.arrayBuffer()

    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    audioDuration.value = audioBuffer.duration
    clipStart.value = 0
    clipEnd.value = audioBuffer.duration

    // Compute high-resolution waveform
    const channelData = audioBuffer.getChannelData(0)
    const blockSize = Math.floor(channelData.length / barCount)
    const waveform = []
    for (let i = 0; i < barCount; i++) {
      let sum = 0
      const start = i * blockSize
      const end = Math.min(start + blockSize, channelData.length)
      for (let j = start; j < end; j++) {
        sum += Math.abs(channelData[j])
      }
      const avg = sum / (end - start)
      waveform.push(Math.min(1, avg * 2))
    }
    waveformData.value = waveform

    audioContext.close()

    // Set default clip name
    clipName.value = `Clip of ${props.recording.displayName || 'Untitled'}`
    clipCategory.value = props.recording.metadata?.category || props.recording.category || 'other'
  } catch (err) {
    loadError.value = err.message || 'Failed to load audio'
  } finally {
    loadingAudio.value = false
  }
}

function getSvgX(event) {
  if (!waveformSvg.value) return 0
  const rect = waveformSvg.value.getBoundingClientRect()
  return Math.max(0, Math.min(svgWidth, ((event.clientX - rect.left) / rect.width) * svgWidth))
}

function handleWaveformClick(event) {
  const x = getSvgX(event)
  const startDist = Math.abs(x - startHandleScreenX.value)
  const endDist = Math.abs(x - endHandleScreenX.value)

  // If close to a handle, drag it
  if (startDist < 15 && startHandleVisible.value && startDist <= endDist) {
    dragging.value = 'start'
  } else if (endDist < 15 && endHandleVisible.value) {
    dragging.value = 'end'
  } else if (zoomLevel.value > 1 && event.shiftKey) {
    // Shift+drag to pan when zoomed
    dragging.value = 'pan'
    panDragStartX.value = event.clientX
    panDragStartOffset.value = panOffset.value
  } else {
    // Click to move nearest handle
    const time = screenXToTime(x)
    const distToStart = Math.abs(time - clipStart.value)
    const distToEnd = Math.abs(time - clipEnd.value)
    if (distToStart < distToEnd) {
      clipStart.value = Math.max(0, Math.min(time, clipEnd.value - 0.1))
      dragging.value = 'start'
    } else {
      clipEnd.value = Math.min(audioDuration.value, Math.max(time, clipStart.value + 0.1))
      dragging.value = 'end'
    }
  }
}

function handleMouseMove(event) {
  if (!dragging.value) return

  if (dragging.value === 'pan') {
    const rect = waveformSvg.value?.getBoundingClientRect()
    if (!rect) return
    const dx = event.clientX - panDragStartX.value
    const timeDelta = -(dx / rect.width) * viewDuration.value
    const maxPan = audioDuration.value - viewDuration.value
    panOffset.value = Math.max(0, Math.min(maxPan, panDragStartOffset.value + timeDelta))
    return
  }

  const x = getSvgX(event)
  const time = screenXToTime(x)

  if (dragging.value === 'start') {
    clipStart.value = Math.max(0, Math.min(time, clipEnd.value - 0.1))
  } else if (dragging.value === 'end') {
    clipEnd.value = Math.min(audioDuration.value, Math.max(time, clipStart.value + 0.1))
  }
}

function handleMouseUp() {
  dragging.value = null
}

function parseTimeInput(event, which) {
  const parts = event.target.value.split(':')
  let seconds = 0
  if (parts.length === 2) {
    seconds = parseInt(parts[0] || 0) * 60 + parseInt(parts[1] || 0)
  } else if (parts.length === 1) {
    seconds = parseInt(parts[0] || 0)
  }
  seconds = Math.max(0, Math.min(audioDuration.value, seconds))
  if (which === 'start') {
    clipStart.value = Math.min(seconds, clipEnd.value - 0.1)
  } else {
    clipEnd.value = Math.max(seconds, clipStart.value + 0.1)
  }
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function previewClip() {
  if (previewing.value) {
    stopPreview()
    return
  }

  const url = getAudioUrl()
  if (!url) return

  const audio = new Audio(url)
  audio.currentTime = clipStart.value
  previewAudio.value = audio
  previewing.value = true
  playheadTime.value = clipStart.value

  playheadInterval = setInterval(() => {
    if (audio.currentTime >= clipEnd.value) {
      stopPreview()
    } else {
      playheadTime.value = audio.currentTime
    }
  }, 50)

  audio.play()
  audio.addEventListener('ended', stopPreview)
}

function stopPreview() {
  if (previewAudio.value) {
    previewAudio.value.pause()
    previewAudio.value = null
  }
  previewing.value = false
  playheadTime.value = 0
  if (playheadInterval) {
    clearInterval(playheadInterval)
    playheadInterval = null
  }
}

async function saveClip() {
  const url = getAudioUrl()
  if (!url) return

  saving.value = true
  saveError.value = null
  saveSuccess.value = null
  saveProgress.value = 10
  saveMessage.value = 'Trimming audio...'

  try {
    // Step 1: Trim audio client-side
    const { blob, duration } = await trimAudioByTime(url, clipStart.value, clipEnd.value)
    saveProgress.value = 40
    saveMessage.value = 'Uploading clip...'

    // Step 2: Upload to R2
    const fileName = `clip-${Date.now()}.wav`
    const uploadRes = await fetch(`${NORWEGIAN_WORKER_URL}/upload`, {
      method: 'POST',
      headers: { 'X-File-Name': encodeURIComponent(fileName) },
      body: blob
    })
    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`)
    const { r2Key, audioUrl } = await uploadRes.json()
    saveProgress.value = 70
    saveMessage.value = 'Saving to portfolio...'

    // Step 3: Save recording metadata
    const recordingData = {
      userEmail: userStore.email,
      fileName,
      displayName: clipName.value || `Clip of ${props.recording.displayName || 'Untitled'}`,
      fileSize: blob.size,
      duration: Math.round(duration),
      r2Key,
      r2Url: audioUrl,
      transcriptionText: '',
      category: clipCategory.value || 'other',
      tags: ['clip', `clipped-from:${props.recording.recordingId || props.recording.id}`],
      audioFormat: 'wav',
      aiService: 'none',
      aiModel: 'none',
      processingTime: 0
    }

    const saveRes = await fetch(`${AUDIO_PORTFOLIO_WORKER_URL}/save-recording`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userStore.email
      },
      body: JSON.stringify(recordingData)
    })
    if (!saveRes.ok) throw new Error(`Save failed: ${saveRes.status}`)

    saveProgress.value = 100
    saveMessage.value = 'Done!'
    saveSuccess.value = `Clip saved: "${clipName.value}" (${formatTime(duration)})`

    emit('clip-saved')
  } catch (err) {
    saveError.value = err.message || 'Failed to save clip'
  } finally {
    saving.value = false
  }
}

// Load audio when recording changes
watch(() => props.recording, (newVal) => {
  if (newVal) {
    // Reset state
    waveformData.value = []
    audioDuration.value = 0
    clipStart.value = 0
    clipEnd.value = 0
    zoomLevel.value = 1
    panOffset.value = 0
    saveError.value = null
    saveSuccess.value = null
    stopPreview()
    loadAudio()
  }
}, { immediate: true })

onUnmounted(() => {
  stopPreview()
})
</script>

<style scoped>
.clip-modal-overlay,
.clip-modal-container,
.clip-modal-header,
.clip-modal-body,
.clip-modal-footer {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.4;
}

.clip-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 120000;
  backdrop-filter: blur(2px);
}

.clip-modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  max-width: 750px;
  width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 120001;
}

.clip-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.clip-modal-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
}

.clip-modal-body {
  padding: 20px 24px;
  flex: 1;
  overflow-y: auto;
}

.clip-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid #e9ecef;
}

.waveform-wrapper {
  position: relative;
}

.clip-waveform-svg {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 6px;
  cursor: crosshair;
  user-select: none;
}

.handle {
  cursor: ew-resize;
}

.handle line {
  filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.3));
}

.time-input {
  width: 70px;
  text-align: center;
  font-family: monospace;
}

.zoom-controls .btn {
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: bold;
}

.zoom-label {
  min-width: 36px;
  text-align: center;
  font-family: monospace;
}
</style>
