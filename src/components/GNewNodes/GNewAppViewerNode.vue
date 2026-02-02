<template>
  <div class="gnew-app-viewer-node">
    <div class="app-header">
      <div class="title-section">
        <h3 v-if="!isEditingLabel" class="app-title" @dblclick="startEditingLabel">
          {{ node.label || 'Interactive App' }}
        </h3>
        <input
          v-else
          ref="labelInput"
          v-model="editedLabel"
          @blur="saveLabel"
          @keyup.enter="saveLabel"
          @keyup.esc="cancelEditLabel"
          class="label-input"
          type="text"
        />
        <button
          v-if="!isEditingLabel"
          @click="startEditingLabel"
          class="btn-edit-label"
          title="Edit label (or double-click title)"
        >
          ✏️
        </button>
      </div>
      <div class="app-controls">
        <button @click="toggleFullscreen" class="btn-control" title="Toggle Fullscreen">
          {{ isFullscreen ? '🗗 Exit Fullscreen' : '⛶ Fullscreen' }}
        </button>
        <button @click="refreshApp" class="btn-control" title="Refresh App">
          🔄 Refresh
        </button>
        <button v-if="isSuperadmin" @click="downloadApp" class="btn-control" title="Download HTML">
          📥 Download
        </button>
        <button @click="deleteNode" class="btn-control btn-delete" title="Delete App">
          🗑️ Delete
        </button>
      </div>
    </div>

    <div
      class="app-container"
      :class="{ 'fullscreen': isFullscreen }"
      ref="appContainer"
    >
      <!-- Floating exit button when in fullscreen -->
      <button
        v-if="isFullscreen"
        @click="toggleFullscreen"
        class="exit-fullscreen-btn"
        title="Exit Fullscreen (Esc)"
      >
        ✕ Exit Fullscreen
      </button>

      <iframe
        ref="appFrame"
        :src="appUrl"
        class="app-iframe"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox allow-presentation"
        :title="node.label || 'Interactive App'"
      ></iframe>
    </div>

    <!-- Fullscreen overlay backdrop -->
    <div v-if="isFullscreen" class="fullscreen-backdrop" @click="toggleFullscreen"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue'
import { useUserStore } from '../../stores/userStore'
import { useKnowledgeGraphStore } from '../../stores/knowledgeGraphStore'

const userStore = useUserStore()
const knowledgeGraphStore = useKnowledgeGraphStore()

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  isPreview: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['node-deleted', 'node-updated'])

const appFrame = ref(null)
const appContainer = ref(null)
const appUrl = ref('')
const isFullscreen = ref(false)
const labelInput = ref(null)
const isEditingLabel = ref(false)
const editedLabel = ref('')

// Check if user is Superadmin
const isSuperadmin = computed(() => {
  return userStore.role === 'Superadmin'
})

// Create blob URL from HTML content
const createAppUrl = () => {
  if (!props.node.info) {
    console.error('No HTML content found in node.info')
    return
  }

  // Clean up previous blob URL if it exists
  if (appUrl.value && appUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(appUrl.value)
  }

  // Inject graph ID by replacing {{GRAPH_ID}} placeholder
  // Simply use the currentGraphId from the store - it's set when the graph is loaded
  let htmlContent = props.node.info
  const graphId = knowledgeGraphStore.currentGraphId
  if (graphId) {
    htmlContent = htmlContent.replace(/\{\{GRAPH_ID\}\}/g, graphId)
  }

  // Create blob URL from HTML content
  const blob = new Blob([htmlContent], { type: 'text/html' })
  appUrl.value = URL.createObjectURL(blob)
}

// Refresh the app by recreating the blob URL
const refreshApp = () => {
  createAppUrl()
}

// Toggle fullscreen mode
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value

  if (isFullscreen.value) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
}

// Download the HTML app
const downloadApp = () => {
  if (!props.node.info) return

  const blob = new Blob([props.node.info], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.node.label || 'app'}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Delete the node
const deleteNode = () => {
  emit('node-deleted', props.node.id)
}

// Label editing functions
const startEditingLabel = () => {
  isEditingLabel.value = true
  editedLabel.value = props.node.label || 'Interactive App'
  nextTick(() => {
    if (labelInput.value) {
      labelInput.value.focus()
      labelInput.value.select()
    }
  })
}

const saveLabel = () => {
  if (editedLabel.value.trim()) {
    const updatedNode = {
      ...props.node,
      label: editedLabel.value.trim()
    }
    emit('node-updated', updatedNode)
  }
  isEditingLabel.value = false
}

const cancelEditLabel = () => {
  isEditingLabel.value = false
  editedLabel.value = ''
}

// Watch for node content changes and update the app
watch(() => props.node.info, () => {
  createAppUrl()
}, { deep: true })

// Initialize on mount
onMounted(() => {
  createAppUrl()
})

// Cleanup on unmount
onBeforeUnmount(() => {
  if (appUrl.value && appUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(appUrl.value)
  }

  // Clean up fullscreen state
  if (isFullscreen.value) {
    document.body.style.overflow = ''
  }
})

// Handle escape key to exit fullscreen
const handleEscape = (e) => {
  if (e.key === 'Escape' && isFullscreen.value) {
    toggleFullscreen()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.gnew-app-viewer-node {
  position: relative;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);
}

.title-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.app-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.app-title:hover {
  opacity: 0.9;
}

.label-input {
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  border: 2px solid rgba(255, 255, 255, 0.5);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 1.1rem;
  font-weight: 600;
  outline: none;
  flex: 1;
  max-width: 400px;
}

.label-input:focus {
  border-color: #fff;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
}

.btn-edit-label {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-edit-label:hover {
  background: rgba(255, 255, 255, 0.3);
}

.app-controls {
  display: flex;
  gap: 8px;
}

.btn-control {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-control:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.btn-control:active {
  transform: translateY(0);
}

.btn-delete {
  background: rgba(244, 67, 54, 0.3);
  border-color: rgba(244, 67, 54, 0.5);
}

.btn-delete:hover {
  background: rgba(244, 67, 54, 0.5);
}

.app-container {
  position: relative;
  width: 100%;
  height: 600px;
  background: #f5f5f5;
  transition: all 0.3s ease;
}

.app-container.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10000;
  border-radius: 0;
}

.app-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.exit-fullscreen-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10002;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.exit-fullscreen-btn:hover {
  background: rgba(244, 67, 54, 0.9);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.exit-fullscreen-btn:active {
  transform: translateY(0);
}

.fullscreen-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 9999;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }

  .app-controls {
    justify-content: space-between;
  }

  .btn-control {
    flex: 1;
    font-size: 0.75rem;
    padding: 8px 6px;
  }

  .app-container {
    height: 400px;
  }
}

/* Ensure fullscreen takes precedence on mobile */
@media (max-width: 768px) {
  .app-container.fullscreen {
    height: 100vh;
  }
}
</style>
