<template>
  <div class="gnew-audio-portfolio-selector-node">
    <!-- Node Header -->
    <div v-if="showControls" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ node.label }}</h3>
        <div class="node-type-badge-inline">AUDIO-PORTFOLIO-SELECTOR</div>
      </div>
      <div v-if="!isPreview" class="node-controls">
        <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Node">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Node">
          🗑️
        </button>
      </div>
    </div>

    <!-- Clickable Selector Area -->
    <div class="audio-selector-container" @click="openAudioModal">
      <div class="audio-selector-button">
        <div class="selector-icon">🎤</div>
        <div class="selector-content">
          <h4 class="selector-title">{{ node.label }}</h4>
          <p class="selector-description">{{ node.info }}</p>
        </div>
        <div class="selector-arrow">→</div>
      </div>
    </div>

    <!-- Audio Recording Selector Modal -->
    <AudioRecordingSelector
      :isVisible="showAudioModal"
      :transcriptionType="selectedTranscriptionType"
      @close="closeAudioModal"
      @node-created="handleAudioNodeCreated"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AudioRecordingSelector from '@/components/AudioRecordingSelector.vue'

// Props
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

// Emits
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Reactive state
const showAudioModal = ref(false)
const selectedTranscriptionType = ref('enhanced') // Default to enhanced

// Methods
const openAudioModal = () => {
  console.log('🎤 Opening audio portfolio selector modal')
  showAudioModal.value = true
}

const closeAudioModal = () => {
  console.log('🎤 Closing audio portfolio selector modal')
  showAudioModal.value = false
}

const handleAudioNodeCreated = (node) => {
  console.log('🎤 Audio node created:', node)
  // Emit the new node to parent
  emit('node-created', node)
  closeAudioModal()
}

const editNode = () => {
  emit('node-updated', props.node)
}

const deleteNode = () => {
  emit('node-deleted', props.node.id)
}
</script>

<style scoped>
.gnew-audio-portfolio-selector-node {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background: white;
  margin-bottom: 20px;
  overflow: hidden;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.node-title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.node-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #2c3e50;
}

.node-type-badge-inline {
  background: #007bff;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.node-controls {
  display: flex;
  gap: 8px;
}

.audio-selector-container {
  padding: 20px;
}

.audio-selector-button {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #e8f5e8 0%, #f0f8f0 100%);
  border: 2px solid #28a745;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.audio-selector-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
  border-color: #218838;
}

.selector-icon {
  font-size: 2.5rem;
  color: #28a745;
}

.selector-content {
  flex: 1;
}

.selector-title {
  margin: 0 0 8px 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: #2c3e50;
}

.selector-description {
  margin: 0;
  color: #6c757d;
  font-size: 0.9rem;
  line-height: 1.4;
}

.selector-arrow {
  font-size: 1.5rem;
  color: #28a745;
  font-weight: bold;
}

/* Responsive design */
@media (max-width: 768px) {
  .audio-selector-button {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }

  .selector-arrow {
    transform: rotate(90deg);
  }
}
</style>
