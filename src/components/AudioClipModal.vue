<template>
  <Teleport to="body">
    <div v-if="recording" class="clip-modal-overlay" @click="$emit('close')">
      <div class="clip-modal-container" @click.stop>
        <div class="clip-modal-header">
          <h4 class="clip-modal-title">
            <span>&#9986;</span> Clip Audio
          </h4>
          <div class="clip-modal-subtitle">{{ recording.displayName || 'Untitled' }}</div>
          <button class="btn-close" @click="$emit('close')">&times;</button>
        </div>

        <div class="clip-modal-body">
          <!-- Loading state -->
          <div v-if="loadingAudio" class="text-center py-5">
            <div class="spinner-border" role="status"></div>
            <p class="mt-3 text-muted">Loading audio waveform...</p>
          </div>

          <!-- Error state -->
          <div v-if="loadError" class="alert alert-danger">{{ loadError }}</div>

          <!-- Waveform section -->
          <div v-if="!loadingAudio && !loadError && waveformData.length > 0">

            <!-- Overview minimap (always shows full audio) -->
            <div class="overview-section mb-2">
              <small class="text-muted d-block mb-1">Overview</small>
              <div class="overview-bar" @click="overviewClick">
                <svg :width="overviewWidth" height="32" class="overview-svg">
                  <rect x="0" y="0" :width="overviewWidth" height="32" fill="#1a1a2e" rx="3" />
                  <rect
                    v-for="(amp, i) in overviewBars"
                    :key="'ov-' + i"
                    :x="i * (overviewWidth / overviewBarCount)"
                    :y="16 - amp * 14"
                    :width="Math.max(1, overviewWidth / overviewBarCount - 1)"
                    :height="amp * 28"
                    fill="#2a5298"
                    rx="0.5"
                  />
                  <!-- Selected region on overview -->
                  <rect
                    :x="(clipStart / audioDuration) * overviewWidth"
                    y="0"
                    :width="Math.max(2, ((clipEnd - clipStart) / audioDuration) * overviewWidth)"
                    height="32"
                    fill="rgba(78, 205, 196, 0.3)"
                  />
                  <!-- Viewport indicator -->
                  <rect
                    :x="viewportLeft"
                    y="0"
                    :width="viewportWidth"
                    height="32"
                    fill="none"
                    stroke="rgba(255,255,255,0.6)"
                    stroke-width="1.5"
                    rx="2"
                  />
                </svg>
              </div>
            </div>

            <!-- Scrollable waveform timeline -->
            <div
              ref="scrollContainer"
              class="waveform-scroll-container"
              @scroll="onScroll"
            >
              <svg
                ref="waveformSvg"
                :width="totalWaveformWidth"
                :height="waveformHeight"
                :viewBox="`0 0 ${totalWaveformWidth} ${waveformHeight}`"
                class="waveform-timeline-svg"
                @mousedown="handleWaveformMouseDown"
                @mousemove="handleWaveformMouseMove"
                @mouseup="handleWaveformMouseUp"
                @mouseleave="handleWaveformMouseUp"
              >
                <!-- Background -->
                <rect x="0" y="0" :width="totalWaveformWidth" :height="waveformHeight" fill="#1a1a2e" />

                <!-- Time grid lines -->
                <g v-for="tick in timeGridTicks" :key="'tick-' + tick.time">
                  <line
                    :x1="tick.x" y1="0" :x2="tick.x" :y2="waveformHeight"
                    stroke="#333355" stroke-width="1"
                  />
                  <text
                    :x="tick.x + 4" :y="14"
                    fill="rgba(255,255,255,0.4)" font-size="11" font-family="monospace"
                  >{{ tick.label }}</text>
                </g>

                <!-- Center line -->
                <line x1="0" :y1="waveformHeight / 2" :x2="totalWaveformWidth" :y2="waveformHeight / 2" stroke="#4a4a6a" stroke-width="1" opacity="0.4" />

                <!-- Waveform bars -->
                <rect
                  v-for="(amp, i) in waveformData"
                  :key="'bar-' + i"
                  :x="i * barStep"
                  :y="(waveformHeight - amp * waveformHeight * 0.8) / 2"
                  :width="barW"
                  :height="Math.max(2, amp * waveformHeight * 0.8)"
                  :fill="getBarFill(i)"
                  rx="1"
                />

                <!-- Dimmed regions outside clip selection -->
                <rect x="0" y="0" :width="timeToX(clipStart)" :height="waveformHeight" fill="rgba(0,0,0,0.45)" />
                <rect :x="timeToX(clipEnd)" y="0" :width="totalWaveformWidth - timeToX(clipEnd)" :height="waveformHeight" fill="rgba(0,0,0,0.45)" />

                <!-- Start handle -->
                <g class="handle" :transform="`translate(${timeToX(clipStart)}, 0)`">
                  <rect x="-12" y="0" width="24" :height="waveformHeight" fill="transparent" style="cursor: ew-resize" />
                  <line x1="0" y1="0" x2="0" :y2="waveformHeight" stroke="#4ecdc4" stroke-width="3" />
                  <rect x="-14" y="0" width="14" height="24" fill="#4ecdc4" rx="3" />
                  <text x="-7" y="16" fill="#1a1a2e" font-size="10" font-weight="bold" text-anchor="middle">IN</text>
                  <polygon :points="`0,${waveformHeight} -10,${waveformHeight - 16} 0,${waveformHeight - 16}`" fill="#4ecdc4" />
                </g>

                <!-- End handle -->
                <g class="handle" :transform="`translate(${timeToX(clipEnd)}, 0)`">
                  <rect x="-12" y="0" width="24" :height="waveformHeight" fill="transparent" style="cursor: ew-resize" />
                  <line x1="0" y1="0" x2="0" :y2="waveformHeight" stroke="#ff6b6b" stroke-width="3" />
                  <rect x="0" y="0" width="14" height="24" fill="#ff6b6b" rx="3" />
                  <text x="7" y="16" fill="#1a1a2e" font-size="10" font-weight="bold" text-anchor="middle">OUT</text>
                  <polygon :points="`0,${waveformHeight} 10,${waveformHeight - 16} 0,${waveformHeight - 16}`" fill="#ff6b6b" />
                </g>

                <!-- Playhead -->
                <g v-if="playheadTime > 0">
                  <line
                    :x1="timeToX(playheadTime)" y1="0"
                    :x2="timeToX(playheadTime)" :y2="waveformHeight"
                    stroke="#ffffff" stroke-width="2" opacity="0.9"
                  />
                  <circle :cx="timeToX(playheadTime)" cy="8" r="4" fill="#ffffff" />
                </g>
              </svg>
            </div>

            <!-- Time ruler below waveform -->
            <div class="time-ruler d-flex justify-content-between px-1 mt-1">
              <small class="text-muted font-monospace">0:00</small>
              <small class="text-muted font-monospace">{{ formatTime(audioDuration / 4) }}</small>
              <small class="text-muted font-monospace">{{ formatTime(audioDuration / 2) }}</small>
              <small class="text-muted font-monospace">{{ formatTime(audioDuration * 3 / 4) }}</small>
              <small class="text-muted font-monospace">{{ formatTime(audioDuration) }}</small>
            </div>
          </div>

          <!-- Controls -->
          <div v-if="audioDuration > 0" class="clip-controls mt-3">
            <div class="d-flex flex-wrap align-items-end gap-3">
              <div>
                <label class="form-label mb-1 small fw-bold">IN point</label>
                <input
                  type="text"
                  class="form-control form-control-sm time-input"
                  :value="formatTimePrecise(clipStart)"
                  @change="parseTimeInput($event, 'start')"
                />
              </div>
              <div>
                <label class="form-label mb-1 small fw-bold">OUT point</label>
                <input
                  type="text"
                  class="form-control form-control-sm time-input"
                  :value="formatTimePrecise(clipEnd)"
                  @change="parseTimeInput($event, 'end')"
                />
              </div>
              <div>
                <span class="badge bg-info fs-6">{{ formatTime(clipEnd - clipStart) }}</span>
              </div>
              <div>
                <button class="btn btn-sm btn-outline-dark" @click="previewClip">
                  {{ previewing ? '&#9632; Stop' : '&#9654; Preview Clip' }}
                </button>
              </div>
              <div>
                <button class="btn btn-sm btn-outline-secondary" @click="playFull">
                  {{ playingFull ? '&#9632; Stop' : '&#9654; Play Full' }}
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
            <div class="progress" style="height: 24px">
              <div class="progress-bar progress-bar-striped progress-bar-animated" :style="{ width: saveProgress + '%' }">
                {{ saveMessage }}
              </div>
            </div>
          </div>

          <div v-if="saveError" class="alert alert-danger mt-3 mb-0">{{ saveError }}</div>
          <div v-if="saveSuccess" class="alert alert-success mt-3 mb-0">{{ saveSuccess }}</div>
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
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { trimAudioByTime } from '../utils/audioChunker'
import { useUserStore } from '../stores/userStore'

const NORWEGIAN_WORKER_URL = 'https://norwegian-transcription-worker.torarnehave.workers.dev'
const AUDIO_PORTFOLIO_WORKER_URL = 'https://audio-portfolio-worker.torarnehave.workers.dev'

const props = defineProps({
  recording: { type: Object, default: null }
})

const emit = defineEmits(['close', 'clip-saved'])

const userStore = useUserStore()

// Layout constants
const waveformHeight = 200
const pixelsPerSecond = 12 // Controls how wide the timeline is — scrollable
const overviewBarCount = 150

// Audio state
const loadingAudio = ref(false)
const loadError = ref(null)
const audioDuration = ref(0)
const waveformData = ref([])
const waveformSvg = ref(null)
const scrollContainer = ref(null)

// Region state
const clipStart = ref(0)
const clipEnd = ref(0)

// Dragging: 'start', 'end', or null
const dragging = ref(null)

// Preview state
const previewing = ref(false)
const playingFull = ref(false)
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

// Total waveform SVG width (scrollable)
const totalWaveformWidth = computed(() => {
  const w = Math.max(600, Math.ceil(audioDuration.value * pixelsPerSecond))
  return w
})

// Number of bars in the full waveform
const barCount = computed(() => {
  // ~3 pixels per bar
  return Math.max(200, Math.floor(totalWaveformWidth.value / 3))
})

const barW = computed(() => Math.max(1, (totalWaveformWidth.value / barCount.value) - 1))
const barStep = computed(() => totalWaveformWidth.value / barCount.value)

// Overview bar width
const overviewWidth = ref(600)

// Overview bars (downsampled from waveformData)
const overviewBars = computed(() => {
  if (waveformData.value.length === 0) return []
  const step = Math.max(1, Math.floor(waveformData.value.length / overviewBarCount))
  const bars = []
  for (let i = 0; i < overviewBarCount; i++) {
    const srcIdx = Math.floor(i * waveformData.value.length / overviewBarCount)
    bars.push(waveformData.value[srcIdx] || 0)
  }
  return bars
})

// Overview viewport indicator
const scrollLeft = ref(0)
const containerWidth = ref(600)

const viewportLeft = computed(() => {
  if (totalWaveformWidth.value <= 0) return 0
  return (scrollLeft.value / totalWaveformWidth.value) * overviewWidth.value
})

const viewportWidth = computed(() => {
  if (totalWaveformWidth.value <= 0) return overviewWidth.value
  return Math.max(8, (containerWidth.value / totalWaveformWidth.value) * overviewWidth.value)
})

// Time grid ticks
const timeGridTicks = computed(() => {
  if (audioDuration.value === 0) return []
  // Choose interval: every 5s, 10s, 30s, or 60s depending on density
  let interval = 5
  if (audioDuration.value > 120) interval = 10
  if (audioDuration.value > 300) interval = 30
  if (audioDuration.value > 600) interval = 60

  const ticks = []
  for (let t = interval; t < audioDuration.value; t += interval) {
    ticks.push({
      time: t,
      x: timeToX(t),
      label: formatTime(t)
    })
  }
  return ticks
})

function timeToX(time) {
  if (audioDuration.value === 0) return 0
  return (time / audioDuration.value) * totalWaveformWidth.value
}

function xToTime(x) {
  if (totalWaveformWidth.value === 0) return 0
  return Math.max(0, Math.min(audioDuration.value, (x / totalWaveformWidth.value) * audioDuration.value))
}

function getBarFill(index) {
  const barTime = (index / barCount.value) * audioDuration.value
  if (barTime >= clipStart.value && barTime <= clipEnd.value) {
    return '#4ecdc4'
  }
  return '#2a5298'
}

function onScroll() {
  if (scrollContainer.value) {
    scrollLeft.value = scrollContainer.value.scrollLeft
    containerWidth.value = scrollContainer.value.clientWidth
  }
}

function overviewClick(event) {
  if (!scrollContainer.value) return
  const rect = event.currentTarget.getBoundingClientRect()
  const clickFraction = (event.clientX - rect.left) / rect.width
  const targetScroll = clickFraction * totalWaveformWidth.value - containerWidth.value / 2
  scrollContainer.value.scrollLeft = Math.max(0, targetScroll)
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

    // Compute waveform at the target resolution
    const numBars = barCount.value
    const channelData = audioBuffer.getChannelData(0)
    const blockSize = Math.max(1, Math.floor(channelData.length / numBars))
    const waveform = []
    for (let i = 0; i < numBars; i++) {
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

    clipName.value = `Clip of ${props.recording.displayName || 'Untitled'}`
    clipCategory.value = props.recording.metadata?.category || props.recording.category || 'other'

    // Update overview width after render
    await nextTick()
    if (scrollContainer.value) {
      containerWidth.value = scrollContainer.value.clientWidth
      overviewWidth.value = scrollContainer.value.clientWidth
    }
  } catch (err) {
    loadError.value = err.message || 'Failed to load audio'
  } finally {
    loadingAudio.value = false
  }
}

// SVG mouse interaction
function getSvgX(event) {
  if (!waveformSvg.value) return 0
  const rect = waveformSvg.value.getBoundingClientRect()
  const scale = totalWaveformWidth.value / rect.width
  return (event.clientX - rect.left) * scale
}

function handleWaveformMouseDown(event) {
  const x = getSvgX(event)
  const startX = timeToX(clipStart.value)
  const endX = timeToX(clipEnd.value)
  const distToStart = Math.abs(x - startX)
  const distToEnd = Math.abs(x - endX)

  // Grab threshold in SVG units (scaled for scroll width)
  const threshold = 15 * (totalWaveformWidth.value / (scrollContainer.value?.clientWidth || 600))

  if (distToStart < threshold && distToStart <= distToEnd) {
    dragging.value = 'start'
  } else if (distToEnd < threshold) {
    dragging.value = 'end'
  } else {
    // Click to move the nearest handle
    const time = xToTime(x)
    if (Math.abs(time - clipStart.value) < Math.abs(time - clipEnd.value)) {
      clipStart.value = Math.max(0, Math.min(time, clipEnd.value - 0.1))
      dragging.value = 'start'
    } else {
      clipEnd.value = Math.min(audioDuration.value, Math.max(time, clipStart.value + 0.1))
      dragging.value = 'end'
    }
  }
}

function handleWaveformMouseMove(event) {
  if (!dragging.value) return
  const x = getSvgX(event)
  const time = xToTime(x)

  if (dragging.value === 'start') {
    clipStart.value = Math.max(0, Math.min(time, clipEnd.value - 0.1))
  } else if (dragging.value === 'end') {
    clipEnd.value = Math.min(audioDuration.value, Math.max(time, clipStart.value + 0.1))
  }
}

function handleWaveformMouseUp() {
  dragging.value = null
}

function parseTimeInput(event, which) {
  const parts = event.target.value.split(':')
  let seconds = 0
  if (parts.length === 2) {
    seconds = parseInt(parts[0] || 0) * 60 + parseFloat(parts[1] || 0)
  } else if (parts.length === 1) {
    seconds = parseFloat(parts[0] || 0)
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

function formatTimePrecise(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function previewClip() {
  if (previewing.value) {
    stopPlayback()
    return
  }
  stopPlayback()

  const url = getAudioUrl()
  if (!url) return

  const audio = new Audio(url)
  audio.currentTime = clipStart.value
  previewAudio.value = audio
  previewing.value = true
  playheadTime.value = clipStart.value

  playheadInterval = setInterval(() => {
    if (audio.currentTime >= clipEnd.value) {
      stopPlayback()
    } else {
      playheadTime.value = audio.currentTime
    }
  }, 50)

  audio.play()
  audio.addEventListener('ended', stopPlayback)
}

function playFull() {
  if (playingFull.value) {
    stopPlayback()
    return
  }
  stopPlayback()

  const url = getAudioUrl()
  if (!url) return

  const audio = new Audio(url)
  audio.currentTime = 0
  previewAudio.value = audio
  playingFull.value = true
  playheadTime.value = 0

  playheadInterval = setInterval(() => {
    playheadTime.value = audio.currentTime
  }, 50)

  audio.play()
  audio.addEventListener('ended', stopPlayback)
}

function stopPlayback() {
  if (previewAudio.value) {
    previewAudio.value.pause()
    previewAudio.value = null
  }
  previewing.value = false
  playingFull.value = false
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
    const { blob, duration } = await trimAudioByTime(url, clipStart.value, clipEnd.value)
    saveProgress.value = 40
    saveMessage.value = 'Uploading clip...'

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

watch(() => props.recording, (newVal) => {
  if (newVal) {
    waveformData.value = []
    audioDuration.value = 0
    clipStart.value = 0
    clipEnd.value = 0
    saveError.value = null
    saveSuccess.value = null
    stopPlayback()
    loadAudio()
  }
}, { immediate: true })

onUnmounted(() => {
  stopPlayback()
})
</script>

<style scoped>
.clip-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 120000;
  backdrop-filter: blur(3px);
}

.clip-modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  max-width: 950px;
  width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  z-index: 120001;
}

.clip-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.clip-modal-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #2c3e50;
  white-space: nowrap;
}

.clip-modal-subtitle {
  flex: 1;
  font-size: 0.9rem;
  color: #6c757d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  margin-left: auto;
  flex-shrink: 0;
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
  padding: 14px 24px;
  border-top: 1px solid #e9ecef;
}

/* Overview minimap */
.overview-bar {
  cursor: pointer;
  border-radius: 4px;
  overflow: hidden;
}

.overview-svg {
  display: block;
  width: 100%;
  height: 32px;
}

/* Scrollable waveform */
.waveform-scroll-container {
  overflow-x: auto;
  overflow-y: hidden;
  border-radius: 6px;
  border: 1px solid #dee2e6;
  background: #1a1a2e;
  cursor: crosshair;
}

.waveform-scroll-container::-webkit-scrollbar {
  height: 10px;
}

.waveform-scroll-container::-webkit-scrollbar-track {
  background: #2a2a4a;
  border-radius: 0 0 6px 6px;
}

.waveform-scroll-container::-webkit-scrollbar-thumb {
  background: #5a5a8a;
  border-radius: 5px;
}

.waveform-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #7a7aba;
}

.waveform-timeline-svg {
  display: block;
  user-select: none;
}

.handle {
  cursor: ew-resize;
}

.time-input {
  width: 80px;
  text-align: center;
  font-family: monospace;
  font-size: 0.95rem;
}
</style>
