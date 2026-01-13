<template>
  <div class="gnew-guide-node">
    <div class="guide-header">
      <div class="title-section">
        <h3 v-if="!isEditingLabel" class="guide-title" @dblclick="startEditingLabel">
          {{ node.label || 'Glitter Guide' }}
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
          v-if="showControls && !isEditingLabel && !isPreview"
          @click="startEditingLabel"
          class="btn-edit-label"
          title="Edit label (or double-click title)"
        >
          ✏️
        </button>
      </div>
      <div class="guide-controls">
        <button @click="toggleFullscreen" class="btn-control" title="Toggle Fullscreen">
          {{ isFullscreen ? '🗗 Exit Fullscreen' : '⛶ Fullscreen' }}
        </button>
        <button
          v-if="showControls && !isPreview"
          @click="deleteNode"
          class="btn-control btn-delete"
          title="Delete Guide Node"
        >
          🗑️ Delete
        </button>
      </div>
    </div>

    <div class="guide-container" :class="{ fullscreen: isFullscreen }">
      <button
        v-if="isFullscreen"
        @click="toggleFullscreen"
        class="exit-fullscreen-btn"
        title="Exit Fullscreen (Esc)"
      >
        ✕ Exit Fullscreen
      </button>

      <iframe
        v-if="guideUrl"
        :src="guideUrl"
        class="guide-iframe"
        frameborder="0"
        allow="fullscreen; clipboard-write; autoplay; encrypted-media; picture-in-picture"
        allowfullscreen
        :title="node.label || 'Glitter Guide'"
      ></iframe>

      <div v-else class="guide-empty-state">
        <div class="empty-icon">🧭</div>
        <p>No guide URL found</p>
        <small class="text-muted">Add a glitter.io URL or iframe in the node info.</small>
      </div>
    </div>

    <div v-if="isFullscreen" class="fullscreen-backdrop" @click="toggleFullscreen"></div>
  </div>
</template>

<script setup>
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  showControls: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['node-updated', 'node-deleted'])

const isFullscreen = ref(false)
const labelInput = ref(null)
const isEditingLabel = ref(false)
const editedLabel = ref('')

const extractIframeSrc = (value) => {
  if (!value || typeof value !== 'string') return ''
  const match = value.match(/<iframe[^>]+src=["']([^"']+)["']/i)
  return match ? match[1] : ''
}

const extractUrl = (value) => {
  if (!value || typeof value !== 'string') return ''
  const match = value.match(/https?:\/\/[^\s"'<>]+/i)
  return match ? match[0] : ''
}

const rawSource = computed(() => {
  return props.node.url || props.node.path || props.node.info || ''
})

const guideUrl = computed(() => {
  if (typeof rawSource.value !== 'string') return ''
  return extractIframeSrc(rawSource.value) || extractUrl(rawSource.value) || ''
})

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  document.body.style.overflow = isFullscreen.value ? 'hidden' : ''
}

const deleteNode = () => {
  emit('node-deleted', props.node.id)
}

const startEditingLabel = () => {
  isEditingLabel.value = true
  editedLabel.value = props.node.label || 'Glitter Guide'
  nextTick(() => {
    if (labelInput.value) {
      labelInput.value.focus()
      labelInput.value.select()
    }
  })
}

const saveLabel = () => {
  if (editedLabel.value.trim()) {
    emit('node-updated', {
      ...props.node,
      label: editedLabel.value.trim(),
    })
  }
  isEditingLabel.value = false
}

const cancelEditLabel = () => {
  isEditingLabel.value = false
  editedLabel.value = ''
}

const handleEscape = (event) => {
  if (event.key === 'Escape' && isFullscreen.value) {
    toggleFullscreen()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape)
  if (isFullscreen.value) {
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
.gnew-guide-node {
  position: relative;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.guide-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #0f766e 0%, #155e75 100%);
  color: #fff;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.guide-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.label-input {
  background: rgba(255, 255, 255, 0.95);
  color: #1f2937;
  border: 2px solid rgba(255, 255, 255, 0.5);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 1.05rem;
  font-weight: 600;
  outline: none;
  flex: 1;
  max-width: 420px;
}

.btn-edit-label {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-edit-label:hover {
  background: rgba(255, 255, 255, 0.3);
}

.guide-controls {
  display: flex;
  gap: 8px;
}

.btn-control {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
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
}

.btn-delete {
  background: rgba(244, 67, 54, 0.3);
  border-color: rgba(244, 67, 54, 0.5);
}

.btn-delete:hover {
  background: rgba(244, 67, 54, 0.5);
}

.guide-container {
  position: relative;
  width: 100%;
  height: 600px;
  background: #f8fafc;
  transition: all 0.3s ease;
}

.guide-container.fullscreen {
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

.guide-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.guide-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 100%;
  color: #475569;
}

.empty-icon {
  font-size: 1.6rem;
}

.exit-fullscreen-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10002;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.exit-fullscreen-btn:hover {
  background: rgba(244, 67, 54, 0.9);
}

.fullscreen-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 9999;
}

@media (max-width: 768px) {
  .guide-header {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }

  .guide-controls {
    justify-content: space-between;
  }

  .btn-control {
    flex: 1;
    font-size: 0.75rem;
    padding: 8px 6px;
  }

  .guide-container {
    height: 400px;
  }
}
</style>
