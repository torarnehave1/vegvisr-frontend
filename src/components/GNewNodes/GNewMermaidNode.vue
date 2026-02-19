<template>
  <div ref="mermaidContainer" class="gnew-mermaid-node" :class="{ 'fullscreen-mode': isFullscreen }">
    <!-- Node Header - Following GNewDefaultNode pattern -->
    <div v-if="showControls && node.label" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ node.label }}</h3>
        <div class="node-type-badge-inline">
          {{ nodeTypeDisplay }}
        </div>
      </div>
      <div v-if="!isPreview" class="node-controls">
        <button @click="toggleFullscreen" class="btn btn-sm btn-outline-secondary" :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'">
          {{ isFullscreen ? '🗗' : '🔲' }}
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
      <button @click="toggleFullscreen" class="btn btn-sm btn-outline-secondary fullscreen-btn-inline" :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'">
        {{ isFullscreen ? '🗗' : '🔲' }}
      </button>
    </div>

    <!-- Zoom Controls -->
    <div v-if="showControls || isFullscreen" class="zoom-controls">
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
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
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

// Fullscreen functionality
const toggleFullscreen = async () => {
  if (!mermaidContainer.value) return

  try {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      await mermaidContainer.value.requestFullscreen()
      isFullscreen.value = true
    } else {
      // Exit fullscreen
      await document.exitFullscreen()
      isFullscreen.value = false
    }
  } catch (err) {
    console.error('Error toggling fullscreen:', err)
  }
}

// Handle fullscreen change events
const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

// Listen for ESC key to exit fullscreen
const handleKeyDown = (event) => {
  if (event.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('keydown', handleKeyDown)
  // Exit fullscreen if still active
  if (document.fullscreenElement === mermaidContainer.value) {
    document.exitFullscreen()
  }
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

/* Fullscreen mode styles */
.gnew-mermaid-node.fullscreen-mode {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: #fff;
  padding: 2rem;
  margin: 0;
  overflow: auto;
  box-shadow: none;
}

.gnew-mermaid-node.fullscreen-mode .mermaid-wrapper {
  min-height: calc(100vh - 200px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}

.gnew-mermaid-node.fullscreen-mode .mermaid-wrapper :deep(svg) {
  max-width: 95vw;
  max-height: 90vh;
  width: auto;
  height: auto;
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

  .gnew-mermaid-node.fullscreen-mode {
    background: #1a202c;
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

  .gnew-mermaid-node.fullscreen-mode .mermaid-wrapper {
    background: #2d3748;
  }

  .node-bibliography {
    border-left-color: #63b3ed;
  }

  .bibliography-item {
    color: #a0aec0;
  }
}
</style>
