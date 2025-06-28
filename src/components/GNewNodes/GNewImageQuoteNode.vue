<template>
  <div class="gnew-imagequote-node">
    <!-- Node Header (Logged-in Users Only) -->
    <div v-if="showControls && node.label" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ node.label }}</h3>
        <div class="node-type-badge-inline">IMAGEQUOTE</div>
      </div>
      <div v-if="showControls && !isPreview" class="node-controls">
        <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Node">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Node">
          🗑️
        </button>
      </div>
    </div>

    <!-- IMAGEQUOTE Component -->
    <div class="imagequote-container">
      <GNewImageQuote
        :quote-text="imageQuoteData.text"
        :background-image="imageQuoteData.backgroundImage"
        :aspect-ratio="imageQuoteData.aspectRatio"
        :text-align="imageQuoteData.textAlign"
        :padding="imageQuoteData.padding"
        :font-size="imageQuoteData.fontSize"
        :width="imageQuoteData.width"
        :height="imageQuoteData.height"
        :citation="imageQuoteData.citation"
        :show-controls="showControls && !isPreview"
        :edit-mode="true"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import GNewImageQuote from '@/components/GNewImageQuote.vue'

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
const emit = defineEmits(['node-updated', 'node-deleted'])

// Parse IMAGEQUOTE data from node.info
const imageQuoteData = computed(() => {
  const nodeInfo = props.node.info || ''

  // Default values
  const defaults = {
    text: 'Sample IMAGEQUOTE text',
    backgroundImage: props.node.path || '', // Use path property first
    aspectRatio: '16/9',
    textAlign: 'center',
    padding: '2rem',
    fontSize: '1.5rem',
    width: '100%',
    height: 'auto',
    citation: '',
  }

  // Try to parse IMAGEQUOTE definition from node.info
  try {
    const match = nodeInfo.match(/^\[IMAGEQUOTE([^\]]*)\]\s*(.*?)\s*\[END\s+IMAGEQUOTE\]$/s)

    if (match) {
      const paramString = match[1]
      const text = match[2]

      // Parse parameters
      const params = paramString.match(/(\w+):'([^']*)'/g) || []
      const parsed = { ...defaults, text }

      params.forEach((param) => {
        const [, key, value] = param.match(/(\w+):'([^']*)'/)

        switch (key) {
          case 'backgroundImage':
            parsed.backgroundImage = value
            break
          case 'aspectRatio':
            parsed.aspectRatio = value
            break
          case 'textAlign':
            parsed.textAlign = value
            break
          case 'padding':
            parsed.padding = value
            break
          case 'fontSize':
            parsed.fontSize = value
            break
          case 'width':
            parsed.width = value
            break
          case 'height':
            parsed.height = value
            break
          case 'cited':
            parsed.citation = value
            break
        }
      })

      return parsed
    }
  } catch (error) {
    console.error('Error parsing IMAGEQUOTE data:', error)
  }

  // Fallback: try to extract just text content
  if (nodeInfo.trim()) {
    return { ...defaults, text: nodeInfo.trim() }
  }

  return defaults
})

// Event handlers
const editNode = () => {
  emit('node-updated', { action: 'edit', ...props.node })
}

const deleteNode = () => {
  emit('node-deleted', props.node.id)
}
</script>

<style scoped>
.gnew-imagequote-node {
  margin-bottom: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.node-title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.node-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.node-type-badge-inline {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.node-controls {
  display: flex;
  gap: 8px;
}

.node-controls .btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  backdrop-filter: blur(4px);
}

.node-controls .btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
  color: white;
}

.imagequote-container {
  padding: 20px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .node-header {
    padding: 12px 15px;
  }

  .node-title {
    font-size: 1.1rem;
  }

  .node-type-badge-inline {
    font-size: 0.7rem;
    padding: 3px 6px;
  }

  .imagequote-container {
    padding: 15px;
  }
}
</style>
