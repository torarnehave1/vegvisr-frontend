<template>
  <div class="canvas-demo">
    <div class="demo-header">
      <h1>🎨 Canvas Drawing Component Demo</h1>
      <p>Test the Canvas Drawing component with various configurations</p>
    </div>

    <div class="demo-section">
      <h2>Default Configuration</h2>
      <CanvasDrawing
        @export="handleExport"
        @draw="handleDraw"
        @clear="handleClear"
        @colorChange="handleColorChange"
      />
    </div>

    <div class="demo-section">
      <h2>Custom Size & Colors</h2>
      <CanvasDrawing
        :width="600"
        :height="400"
        stroke-color="#ff6b6b"
        :stroke-width="5"
        background-color="#f0f0f0"
        @export="handleExport"
      />
    </div>

    <div class="demo-section">
      <h2>No Controls (Programmatic)</h2>
      <CanvasDrawing
        ref="programmaticCanvas"
        :width="500"
        :height="300"
        :show-controls="false"
        stroke-color="#4ecdc4"
      />
      <div class="external-controls">
        <button @click="clearCanvas" class="demo-btn">Clear Canvas</button>
        <button @click="undoLast" class="demo-btn">Undo</button>
        <button @click="exportCanvas" class="demo-btn">Export PNG</button>
      </div>
    </div>

    <div class="demo-section">
      <h2>Event Log</h2>
      <div class="event-log">
        <div v-for="(event, index) in eventLog" :key="index" class="event-item">
          <span class="event-type">{{ event.type }}</span>
          <span class="event-data">{{ event.data }}</span>
          <span class="event-time">{{ event.time }}</span>
        </div>
        <div v-if="eventLog.length === 0" class="no-events">
          No events yet. Try drawing on the canvas above!
        </div>
      </div>
    </div>

    <div class="demo-section">
      <h2>Usage Code</h2>
      <pre class="code-block"><code>&lt;template&gt;
  &lt;CanvasDrawing
    :width="800"
    :height="600"
    stroke-color="#000000"
    :stroke-width="2"
    :show-controls="true"
    background-color="#ffffff"
    @export="handleExport"
    @draw="handleDraw"
    @clear="handleClear"
    @colorChange="handleColorChange"
  /&gt;
&lt;/template&gt;

&lt;script setup&gt;
import CanvasDrawing from '@/components/shared/CanvasDrawing.vue'

const handleExport = (dataUrl) => {
  console.log('Canvas exported:', dataUrl)
  // Save to cloud storage, display preview, etc.
}

const handleDraw = ({ x, y }) => {
  console.log('Drawing at:', x, y)
}

const handleClear = () => {
  console.log('Canvas cleared')
}

const handleColorChange = (color) => {
  console.log('Color changed to:', color)
}
&lt;/script&gt;</code></pre>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CanvasDrawing from '@/components/shared/CanvasDrawing.vue'

const programmaticCanvas = ref(null)
const eventLog = ref([])

const addEvent = (type, data) => {
  eventLog.value.unshift({
    type,
    data: JSON.stringify(data),
    time: new Date().toLocaleTimeString()
  })

  // Keep only last 20 events
  if (eventLog.value.length > 20) {
    eventLog.value.pop()
  }
}

const handleExport = (dataUrl) => {
  addEvent('export', { size: dataUrl.length + ' bytes' })
  console.log('Canvas exported')
}

const handleDraw = ({ x, y }) => {
  addEvent('draw', { x: Math.round(x), y: Math.round(y) })
}

const handleClear = () => {
  addEvent('clear', {})
}

const handleColorChange = (color) => {
  addEvent('colorChange', { color })
}

// Programmatic controls
const clearCanvas = () => {
  programmaticCanvas.value?.clear()
}

const undoLast = () => {
  programmaticCanvas.value?.undo()
}

const exportCanvas = () => {
  programmaticCanvas.value?.exportImage()
}
</script>

<style scoped>
.canvas-demo {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
}

.demo-header {
  text-align: center;
  margin-bottom: 3rem;
  padding: 2rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.demo-header h1 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 2.5rem;
}

.demo-header p {
  margin: 0;
  color: #666;
  font-size: 1.1rem;
}

.demo-section {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.demo-section h2 {
  margin: 0 0 1.5rem 0;
  color: #333;
  font-size: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #f0f0f0;
}

.external-controls {
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
}

.demo-btn {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.demo-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.demo-btn:active {
  transform: translateY(0);
}

.event-log {
  max-height: 300px;
  overflow-y: auto;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  background: #f9f9f9;
}

.event-item {
  display: flex;
  gap: 1rem;
  padding: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
}

.event-item:last-child {
  border-bottom: none;
}

.event-type {
  color: #667eea;
  font-weight: 600;
  min-width: 100px;
}

.event-data {
  color: #333;
  flex: 1;
}

.event-time {
  color: #999;
  font-size: 0.75rem;
}

.no-events {
  text-align: center;
  color: #999;
  padding: 2rem;
  font-style: italic;
}

.code-block {
  background: #2d3748;
  color: #e2e8f0;
  padding: 1.5rem;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  line-height: 1.6;
}

.code-block code {
  display: block;
}

@media (max-width: 768px) {
  .canvas-demo {
    padding: 1rem;
  }

  .demo-header h1 {
    font-size: 1.8rem;
  }

  .external-controls {
    flex-direction: column;
  }

  .demo-btn {
    width: 100%;
  }
}
</style>
