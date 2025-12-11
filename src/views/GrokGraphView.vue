<template>
  <div class="grok-graph-container">
    <!-- Left Column: Grok Chat Panel (resizable) -->
    <div
      class="grok-chat-column"
      :style="{ width: chatWidth + '%' }"
    >
      <GrokChatPanel />
    </div>

    <!-- Resize Divider -->
    <div
      class="resize-divider"
      @mousedown="startResize"
    ></div>

    <!-- Right Column: Knowledge Graph Viewer -->
    <div
      class="graph-viewer-column"
      :style="{ width: (100 - chatWidth) + '%' }"
    >
      <GNewViewer />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import GrokChatPanel from '@/components/GrokChatPanel.vue'
import GNewViewer from '@/views/GNewViewer.vue'

const chatWidth = ref(33) // Initial width: 33% for chat

function startResize(event) {
  const startX = event.clientX
  const startWidth = chatWidth.value
  const containerWidth = event.currentTarget.parentElement.offsetWidth

  function onMouseMove(e) {
    const deltaX = e.clientX - startX
    const deltaPercent = (deltaX / containerWidth) * 100
    let newWidth = startWidth + deltaPercent

    // Constrain between 20% and 50%
    if (newWidth < 20) newWidth = 20
    if (newWidth > 50) newWidth = 50

    chatWidth.value = newWidth
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<style scoped>
.grok-graph-container {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.grok-chat-column {
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  overflow-y: auto;
  border-right: 1px solid #dee2e6;
}

.resize-divider {
  width: 6px;
  background: #dee2e6;
  cursor: col-resize;
  user-select: none;
  flex-shrink: 0;
  transition: background 0.2s;
}

.resize-divider:hover {
  background: #6c757d;
}

.graph-viewer-column {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Make sure GNewViewer fills the column */
.graph-viewer-column :deep(*) {
  width: 100%;
  height: 100%;
}
</style>
