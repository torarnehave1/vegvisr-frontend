<template>
  <div class="gnew-title-node" :class="[nodeTypeClass, titleSizeClass]">
    <!-- Title Content -->
    <div class="title-content">
      <component :is="titleTag" class="title-text" :style="titleStyles" v-html="formattedTitle" />
    </div>

    <!-- Controls -->
    <div v-if="showControls && !isPreview" class="title-controls">
      <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Title">
        ✏️
      </button>
      <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Title">
        🗑️
      </button>
    </div>

    <!-- Subtitle/Description -->
    <div v-if="nodeContent" class="title-description">
      <div v-html="formattedContent"></div>
    </div>

    <!-- Node Type Badge -->
    <div v-if="showControls" class="node-type-badge">
      {{ nodeTypeDisplay }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'

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

// Computed properties
const titleText = computed(() => {
  return props.node.label || 'Untitled'
})

const nodeContent = computed(() => {
  return props.node.info || ''
})

const formattedTitle = computed(() => {
  // Allow basic markdown in titles (bold, italic, etc.)
  if (!titleText.value) return 'Untitled'

  try {
    // Parse as inline markdown (no paragraphs)
    return marked.parseInline(titleText.value)
  } catch (error) {
    console.error('Error parsing title markdown:', error)
    return titleText.value
  }
})

const formattedContent = computed(() => {
  if (!nodeContent.value) return ''

  try {
    return marked.parse(nodeContent.value)
  } catch (error) {
    console.error('Error parsing markdown:', error)
    return nodeContent.value
  }
})

// Determine title level and styling based on content
const titleLevel = computed(() => {
  const text = titleText.value.toLowerCase()

  // Detect heading indicators
  if (text.includes('chapter') || text.includes('part')) return 1
  if (text.includes('section')) return 2
  if (text.includes('subsection')) return 3

  // Default based on text length
  if (text.length < 20) return 1
  if (text.length < 40) return 2
  return 3
})

const titleTag = computed(() => {
  return `h${titleLevel.value}`
})

const titleSizeClass = computed(() => {
  return `title-level-${titleLevel.value}`
})

const titleStyles = computed(() => {
  const styles = {}

  // Apply gradient or special styling if needed
  if (titleText.value.includes('✨') || titleText.value.includes('🌟')) {
    styles.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    styles.webkitBackgroundClip = 'text'
    styles.webkitTextFillColor = 'transparent'
    styles.backgroundClip = 'text'
  }

  return styles
})

const nodeTypeClass = computed(() => {
  return 'node-type-title'
})

const nodeTypeDisplay = computed(() => {
  return 'Title'
})

// Methods
const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this title?')) {
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-title-node {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 30px 25px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  position: relative;
  text-align: center;
}

.gnew-title-node:hover {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.title-content {
  position: relative;
}

.title-text {
  margin: 0;
  color: #2c3e50;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.025em;
  text-align: center;
}

/* Title size variations */
.title-level-1 .title-text {
  font-size: 2.5rem;
  margin-bottom: 0.5em;
}

.title-level-2 .title-text {
  font-size: 2rem;
  margin-bottom: 0.4em;
}

.title-level-3 .title-text {
  font-size: 1.6rem;
  margin-bottom: 0.3em;
}

.title-controls {
  position: absolute;
  top: 15px;
  right: 15px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.gnew-title-node:hover .title-controls {
  opacity: 1;
}

.title-description {
  margin-top: 20px;
  color: #6c757d;
  line-height: 1.6;
  font-size: 1.1rem;
  max-width: 80%;
  margin-left: auto;
  margin-right: auto;
}

.title-description :deep(p) {
  margin-bottom: 0.8em;
}

.title-description :deep(strong) {
  color: #495057;
}

.title-description :deep(em) {
  font-style: italic;
}

.node-type-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: #28a745;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Special title styling variations */
.title-level-1 {
  background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
  border: 2px solid #007bff;
  padding: 40px 30px;
}

.title-level-1 .title-text {
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.title-level-2 {
  background: #f8f9fa;
  border-left: 4px solid #007bff;
}

.title-level-3 {
  background: white;
  border-top: 3px solid #dee2e6;
}

/* Responsive design */
@media (max-width: 768px) {
  .gnew-title-node {
    padding: 25px 20px;
    margin-bottom: 20px;
  }

  .title-level-1 .title-text {
    font-size: 2rem;
  }

  .title-level-2 .title-text {
    font-size: 1.6rem;
  }

  .title-level-3 .title-text {
    font-size: 1.4rem;
  }

  .title-controls {
    position: relative;
    top: auto;
    right: auto;
    opacity: 1;
    justify-content: center;
    margin-top: 15px;
  }

  .title-description {
    max-width: 100%;
    font-size: 1rem;
    margin-top: 15px;
  }

  .title-level-1 {
    padding: 30px 20px;
  }
}

@media (max-width: 480px) {
  .title-level-1 .title-text {
    font-size: 1.8rem;
  }

  .title-level-2 .title-text {
    font-size: 1.4rem;
  }

  .title-level-3 .title-text {
    font-size: 1.2rem;
  }
}
</style>
