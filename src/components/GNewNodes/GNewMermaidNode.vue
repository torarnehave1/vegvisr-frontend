<template>
  <div ref="mermaidContainer" class="gnew-mermaid-node">
    <!-- Node Header - Following GNewDefaultNode pattern -->
    <div v-if="showControls && node.label" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ node.label }}</h3>
        <div class="node-type-badge-inline">
          {{ nodeTypeDisplay }}
        </div>
      </div>
      <div v-if="!isPreview" class="node-controls">
        <button @click="openFull" class="btn btn-sm btn-outline-secondary" title="Show in full window" aria-label="Show in full window">
          🔲
        </button>
        <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Node">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Node">
          🗑️
        </button>
      </div>
    </div>

    <!-- Title only (for non-control mode) -->
    <div v-else-if="node.label" class="node-title-row">
      <h3 class="node-title">{{ node.label }}</h3>
      <button @click="openFull" class="btn btn-sm btn-outline-secondary fullscreen-btn-inline" title="Show in full window" aria-label="Show in full window">
        🔲
      </button>
    </div>

    <!-- Zoom Controls -->
    <div v-if="showControls" class="zoom-controls">
      <button @click="zoomIn" class="btn btn-sm btn-outline-secondary" title="Zoom In">🔍+</button>
      <button @click="zoomOut" class="btn btn-sm btn-outline-secondary" title="Zoom Out">🔍-</button>
      <button @click="resetZoom" class="btn btn-sm btn-outline-secondary" title="Reset Zoom">↺</button>
      <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
    </div>

    <!-- Mermaid Diagram -->
    <div
      ref="mermaidWrapper"
      class="mermaid-wrapper"
      @wheel.prevent="handleWheel"
      @mousedown="handlePanStart"
      @mousemove="handlePanMove"
      @mouseup="handlePanEnd"
      @mouseleave="handlePanEnd"
      :style="{ cursor: isPanning ? 'grabbing' : (zoomLevel > 1 ? 'grab' : 'default') }"
    >
      <div
        class="mermaid-content"
        :style="{
          transform: `scale(${zoomLevel}) translate(${panX}px, ${panY}px)`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : 'transform 0.2s ease'
        }"
      >
        <Mermaid :code="node.info" />
      </div>
    </div>

    <!-- Optional Bibliography -->
    <div v-if="node.bibl && node.bibl.length > 0" class="node-bibliography">
      <h6>📚 References:</h6>
      <ul class="bibliography-list">
        <li v-for="(ref, index) in node.bibl" :key="index" class="bibliography-item">
          {{ ref }}
        </li>
      </ul>
    </div>

    <!-- The diagram in the whole window. A fixed layer on <body>, not the browser's Fullscreen
         API: iPhone does not offer that API for anything but video, and a fixed element inside
         a transformed parent does not cover the window. -->
    <Teleport to="body">
      <div
        v-if="isFullscreen"
        class="gnew-mermaid-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="node.label || 'Diagram'"
      >
        <div class="gmo-head">
          <strong class="gmo-title">{{ node.label }}</strong>
          <div class="gmo-tools">
            <button type="button" class="btn btn-sm btn-outline-secondary" aria-label="Zoom out" @click="fullZoomBy(1 / 1.25)">−</button>
            <span class="gmo-pct" aria-live="polite">{{ Math.round(full.z * 100) }}%</span>
            <button type="button" class="btn btn-sm btn-outline-secondary" aria-label="Zoom in" @click="fullZoomBy(1.25)">+</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" @click="fullReset">Fit</button>
            <button ref="closeBtn" type="button" class="btn btn-sm btn-outline-secondary" @click="closeFull">✕ Close</button>
          </div>
        </div>
        <div
          class="gmo-stage"
          @pointerdown="fullPointerDown"
          @pointermove="fullPointerMove"
          @pointerup="fullPointerDrop"
          @pointercancel="fullPointerDrop"
          @wheel.prevent="fullWheel"
        >
          <div class="gmo-sheet" :style="{ transform: `translate(${full.x}px, ${full.y}px) scale(${full.z})` }">
            <Mermaid :code="fullCode" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, reactive, nextTick, onMounted, onUnmounted } from 'vue'
import Mermaid from '@/components/Mermaid.vue'

// Component name for debugging
defineOptions({
  name: 'GNewMermaidNode',
})

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] }),
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  showControls: {
    type: Boolean,
    default: true,
  },
  graphId: {
    type: String,
    default: '',
  },
})

// Emits
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Refs
const mermaidContainer = ref(null)
const mermaidWrapper = ref(null)
const isFullscreen = ref(false)

// Zoom and Pan state
const zoomLevel = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const lastPanX = ref(0)
const lastPanY = ref(0)

const nodeTypeDisplay = computed(() => 'Mermaid Diagram')

// Zoom functions
const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value + 0.2, 3) // Max 300%
}

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value - 0.2, 0.5) // Min 50%
}

const resetZoom = () => {
  zoomLevel.value = 1
  panX.value = 0
  panY.value = 0
}

// Mouse wheel zoom
const handleWheel = (event) => {
  const delta = event.deltaY > 0 ? -0.1 : 0.1
  zoomLevel.value = Math.max(0.5, Math.min(3, zoomLevel.value + delta))
}

// Pan functionality
const handlePanStart = (event) => {
  if (zoomLevel.value > 1) {
    isPanning.value = true
    lastPanX.value = event.clientX
    lastPanY.value = event.clientY
  }
}

const handlePanMove = (event) => {
  if (isPanning.value) {
    const deltaX = event.clientX - lastPanX.value
    const deltaY = event.clientY - lastPanY.value
    panX.value += deltaX / zoomLevel.value
    panY.value += deltaY / zoomLevel.value
    lastPanX.value = event.clientX
    lastPanY.value = event.clientY
  }
}

const handlePanEnd = () => {
  isPanning.value = false
}

const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this mermaid diagram?')) {
    emit('node-deleted', props.node.id)
  }
}

// ---------- the diagram in the whole window ----------
const closeBtn = ref(null)
const full = reactive({ z: 1, x: 0, y: 0 })
const clampFull = (z) => Math.min(8, Math.max(0.25, z))
const fullZoomBy = (f) => {
  full.z = clampFull(full.z * f)
}
const fullReset = () => {
  full.z = 1
  full.x = 0
  full.y = 0
}

// A Gantt chart is laid out to the width it is drawn in, so on a phone its labels collide. In the
// full window it is laid out wide and scaled to fit, and zooming brings the labels up.
const fullCode = computed(() => {
  const code = String(props.node.info || '')
  return /^\s*gantt\b/.test(code) && !code.includes('%%{')
    ? `%%{init: {"gantt": {"useWidth": 1600}}}%%\n${code}`
    : code
})

// One finger or the mouse drags; two fingers pinch.
const fullPoints = new Map()
let fullPinch = null
const fullSpread = () => {
  const [a, b] = [...fullPoints.values()]
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
}
const fullPointerDown = (event) => {
  try {
    event.currentTarget.setPointerCapture(event.pointerId)
  } catch {
    /* the pointer is already gone */
  }
  fullPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (fullPoints.size === 2) fullPinch = { d: fullSpread(), z: full.z }
}
const fullPointerMove = (event) => {
  const prev = fullPoints.get(event.pointerId)
  if (!prev) return
  const dx = event.clientX - prev.x
  const dy = event.clientY - prev.y
  fullPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (fullPoints.size >= 2 && fullPinch && fullPinch.d > 0) {
    full.z = clampFull((fullPinch.z * fullSpread()) / fullPinch.d)
  } else if (fullPoints.size === 1) {
    full.x += dx
    full.y += dy
  }
}
const fullPointerDrop = (event) => {
  fullPoints.delete(event.pointerId)
  if (fullPoints.size < 2) fullPinch = null
}
const fullWheel = (event) => {
  fullZoomBy(event.deltaY > 0 ? 1 / 1.15 : 1.15)
}

let bodyOverflowBefore = ''
const openFull = async () => {
  if (isFullscreen.value) return
  fullReset()
  fullPoints.clear()
  fullPinch = null
  bodyOverflowBefore = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  isFullscreen.value = true
  await nextTick()
  closeBtn.value?.focus()
}
const closeFull = () => {
  if (!isFullscreen.value) return
  isFullscreen.value = false
  document.body.style.overflow = bodyOverflowBefore
}

const handleKeyDown = (event) => {
  if (!isFullscreen.value) return
  if (event.key === 'Escape') closeFull()
  else if (event.key === '+' || event.key === '=') fullZoomBy(1.25)
  else if (event.key === '-') fullZoomBy(1 / 1.25)
  else if (event.key === '0') fullReset()
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  // Never leave the page locked if the node goes away while the view is open.
  closeFull()
})
</script>

<style scoped>
.gnew-mermaid-node {
  margin: 1.5rem 0;
  padding: 1rem;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Header - Following GNewDefaultNode pattern */
.node-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.node-title-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.node-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: #2c3e50;
  line-height: 1.3;
}

.node-controls {
  display: flex;
  gap: 8px;
  margin-left: 15px;
}

.node-type-badge-inline {
  background: #6f42c1;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Title row for non-control mode */
.node-title-row {
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fullscreen-btn-inline {
  margin-left: auto;
}

/* Zoom Controls */
.zoom-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.zoom-level {
  font-size: 0.875rem;
  font-weight: 600;
  color: #495057;
  padding: 0 8px;
  min-width: 50px;
  text-align: center;
}

.mermaid-wrapper {
  margin: 1rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #dee2e6;
  overflow: hidden;
  position: relative;
  user-select: none;
}

.mermaid-content {
  display: inline-block;
  min-width: 100%;
}

/* The diagram in the whole window (drawn on <body>) */
.gnew-mermaid-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #2c3e50;
}

.gmo-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid #dee2e6;
}

.gmo-title {
  flex: 1 1 160px;
  min-width: 0;
  font-size: 1.05rem;
  overflow-wrap: anywhere;
}

.gmo-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.gmo-tools .btn {
  min-width: 40px;
  min-height: 36px;
}

.gmo-pct {
  min-width: 48px;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: #495057;
  font-variant-numeric: tabular-nums;
}

.gmo-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
}

.gmo-stage:active {
  cursor: grabbing;
}

.gmo-sheet {
  position: absolute;
  inset: 12px;
  transform-origin: center center;
}

.gmo-sheet :deep(.mermaid-container) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: visible;
}

.gmo-sheet :deep(svg) {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
}

.node-bibliography {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.node-bibliography h6 {
  margin-bottom: 0.75rem;
  color: #495057;
  font-weight: 600;
}

.bibliography-list {
  margin: 0;
  padding-left: 1rem;
  list-style-type: decimal;
}

.bibliography-item {
  margin-bottom: 0.5rem;
  color: #6c757d;
  font-size: 0.9rem;
  line-height: 1.4;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .gnew-mermaid-node {
    background: #2d3748;
    color: #e2e8f0;
  }

  .node-title {
    color: #e2e8f0;
  }

  .zoom-controls {
    background: #4a5568;
    border-color: #718096;
  }

  .zoom-level {
    color: #e2e8f0;
  }

  .mermaid-wrapper,
  .node-bibliography {
    background: #4a5568;
    border-color: #718096;
  }

  .node-bibliography {
    border-left-color: #63b3ed;
  }

  .bibliography-item {
    color: #a0aec0;
  }
}
</style>
