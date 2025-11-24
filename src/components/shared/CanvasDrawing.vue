<template>
  <div class="canvas-drawing-container">
    <canvas
      ref="canvasRef"
      :width="width"
      :height="height"
      class="drawing-canvas"
      @mousedown="startDrawing"
      @mousemove="draw"
      @mouseup="stopDrawing"
      @mouseleave="stopDrawing"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="stopDrawing"
    ></canvas>

    <div v-if="showControls" class="canvas-controls">
      <div class="control-group">
        <label for="color-picker">Color:</label>
        <input
          id="color-picker"
          type="color"
          v-model="currentColor"
          @change="updateColor"
          class="color-input"
        />
        <span class="color-preview" :style="{ backgroundColor: currentColor }"></span>
      </div>

      <div class="control-group">
        <label for="stroke-width">Width:</label>
        <input
          id="stroke-width"
          type="range"
          v-model="currentStrokeWidth"
          min="1"
          max="20"
          class="stroke-slider"
        />
        <span class="stroke-value">{{ currentStrokeWidth }}px</span>
      </div>

      <div class="control-buttons">
        <button @click="clear" class="btn-control btn-clear">
          🗑️ Clear
        </button>
        <button @click="undo" class="btn-control btn-undo" :disabled="history.length === 0">
          ↶ Undo
        </button>
        <button @click="exportImage" class="btn-control btn-export">
          💾 Export
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  width: {
    type: Number,
    default: 800
  },
  height: {
    type: Number,
    default: 600
  },
  strokeColor: {
    type: String,
    default: '#000000'
  },
  strokeWidth: {
    type: Number,
    default: 2
  },
  showControls: {
    type: Boolean,
    default: true
  },
  backgroundColor: {
    type: String,
    default: '#ffffff'
  }
})

const emit = defineEmits(['export', 'draw', 'clear', 'colorChange'])

// Refs
const canvasRef = ref(null)
const ctx = ref(null)
const isDrawing = ref(false)
const currentColor = ref(props.strokeColor)
const currentStrokeWidth = ref(props.strokeWidth)
const history = ref([])
const lastX = ref(0)
const lastY = ref(0)

// Initialize canvas
onMounted(() => {
  ctx.value = canvasRef.value.getContext('2d')
  clear()

  // Save initial state
  saveState()
})

// Watch for prop changes
watch(() => props.strokeColor, (newColor) => {
  currentColor.value = newColor
})

watch(() => props.strokeWidth, (newWidth) => {
  currentStrokeWidth.value = newWidth
})

// Drawing functions
const startDrawing = (e) => {
  isDrawing.value = true
  const rect = canvasRef.value.getBoundingClientRect()
  lastX.value = e.clientX - rect.left
  lastY.value = e.clientY - rect.top

  ctx.value.beginPath()
  ctx.value.moveTo(lastX.value, lastY.value)
}

const draw = (e) => {
  if (!isDrawing.value) return

  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  ctx.value.lineTo(x, y)
  ctx.value.strokeStyle = currentColor.value
  ctx.value.lineWidth = currentStrokeWidth.value
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
  ctx.value.stroke()

  emit('draw', { x, y })

  lastX.value = x
  lastY.value = y
}

const stopDrawing = () => {
  if (isDrawing.value) {
    isDrawing.value = false
    saveState()
  }
}

// Touch support
const handleTouchStart = (e) => {
  e.preventDefault()
  const touch = e.touches[0]
  const rect = canvasRef.value.getBoundingClientRect()

  isDrawing.value = true
  lastX.value = touch.clientX - rect.left
  lastY.value = touch.clientY - rect.top

  ctx.value.beginPath()
  ctx.value.moveTo(lastX.value, lastY.value)
}

const handleTouchMove = (e) => {
  e.preventDefault()
  if (!isDrawing.value) return

  const touch = e.touches[0]
  const rect = canvasRef.value.getBoundingClientRect()
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top

  ctx.value.lineTo(x, y)
  ctx.value.strokeStyle = currentColor.value
  ctx.value.lineWidth = currentStrokeWidth.value
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
  ctx.value.stroke()

  emit('draw', { x, y })

  lastX.value = x
  lastY.value = y
}

// Control functions
const clear = () => {
  ctx.value.fillStyle = props.backgroundColor
  ctx.value.fillRect(0, 0, props.width, props.height)
  history.value = []
  emit('clear')
}

const updateColor = () => {
  emit('colorChange', currentColor.value)
}

const exportImage = () => {
  const dataUrl = canvasRef.value.toDataURL('image/png')
  emit('export', dataUrl)

  // Also trigger download
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `drawing-${Date.now()}.png`
  link.click()
}

// History management
const saveState = () => {
  const imageData = ctx.value.getImageData(0, 0, props.width, props.height)
  history.value.push(imageData)

  // Limit history to 20 states to prevent memory issues
  if (history.value.length > 20) {
    history.value.shift()
  }
}

const undo = () => {
  if (history.value.length > 1) {
    history.value.pop() // Remove current state
    const previousState = history.value[history.value.length - 1]
    ctx.value.putImageData(previousState, 0, 0)
  } else if (history.value.length === 1) {
    clear()
  }
}

// Expose methods for parent components
defineExpose({
  clear,
  exportImage,
  undo,
  getCanvas: () => canvasRef.value,
  getContext: () => ctx.value
})
</script>

<style scoped>
.canvas-drawing-container {
  display: inline-block;
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.drawing-canvas {
  display: block;
  cursor: crosshair;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  touch-action: none; /* Prevent scrolling on touch devices */
}

.canvas-controls {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid #f0f0f0;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: center;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.control-group label {
  font-weight: 600;
  color: #555;
  font-size: 0.9rem;
}

.color-input {
  width: 50px;
  height: 35px;
  border: 2px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  padding: 2px;
}

.color-input:hover {
  border-color: #667eea;
}

.color-preview {
  width: 35px;
  height: 35px;
  border: 2px solid #ddd;
  border-radius: 6px;
  display: inline-block;
}

.stroke-slider {
  width: 120px;
  cursor: pointer;
}

.stroke-value {
  font-weight: 600;
  color: #667eea;
  font-size: 0.9rem;
  min-width: 45px;
}

.control-buttons {
  display: flex;
  gap: 0.75rem;
  margin-left: auto;
}

.btn-control {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-control:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.btn-control:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-clear {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.btn-undo {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.btn-export {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: white;
}

/* Responsive design */
@media (max-width: 768px) {
  .canvas-drawing-container {
    padding: 1rem;
  }

  .canvas-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .control-buttons {
    margin-left: 0;
    width: 100%;
  }

  .btn-control {
    flex: 1;
  }
}

/* Animation for buttons */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.btn-control:active:not(:disabled) {
  animation: pulse 0.3s;
}
</style>
