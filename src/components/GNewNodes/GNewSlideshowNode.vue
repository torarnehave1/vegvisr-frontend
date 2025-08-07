<template>
  <div class="gnew-slideshow-node">
    <!-- Node Header (Logged-in Users Only) -->
    <div v-if="showControls && node.label" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ node.label }}</h3>
        <!-- Node Type Badge in Header -->
        <div class="node-type-badge-inline">SLIDESHOW</div>
      </div>
      <div v-if="!isPreview" class="node-controls">
        <button
          @click="editSlideshow"
          class="btn btn-sm btn-outline-primary"
          title="Edit Slideshow"
        >
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Node">
          🗑️
        </button>
      </div>
    </div>

    <div class="slideshow-preview-container">
      <div class="slideshow-preview">
        <div class="slideshow-description">
          <p>📽️ Interactive slideshow presentation</p>
          <div class="slide-info">
            <span class="slide-count">{{ slideCount }} slides</span>
            <span class="slide-separator">•</span>
            <span class="slide-duration">{{ estimatedDuration }} min read</span>
          </div>
        </div>

        <div class="slideshow-actions">
          <button @click="openSlideshow" class="btn-slideshow-primary" :disabled="!hasContent">
            🎞️ Show Slideshow
          </button>
        </div>

        <div v-if="hasContent" class="slideshow-first-slide-preview">
          <div class="preview-label">Preview:</div>
          <div class="first-slide-content" v-html="firstSlidePreview"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

// Store access
const knowledgeGraphStore = useKnowledgeGraphStore()

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
  showControls: {
    type: Boolean,
    default: true,
  },
  graphId: {
    type: String,
    required: false,
  },
})

// Emits
const emit = defineEmits(['node-updated'])

// Computed properties
const hasContent = computed(() => {
  return props.node.info && props.node.info.trim().length > 0
})

const slides = computed(() => {
  if (!hasContent.value) return []
  return props.node.info.split('---').filter((slide) => slide.trim())
})

const slideCount = computed(() => {
  return slides.value.length
})

const estimatedDuration = computed(() => {
  // Estimate 1 minute per slide, minimum 1 minute
  return Math.max(1, Math.round(slideCount.value * 1))
})

const firstSlidePreview = computed(() => {
  if (slides.value.length === 0) return 'No content available'

  // Get first slide and limit to first 100 characters
  const firstSlide = slides.value[0].trim()
  const preview = firstSlide.length > 100 ? firstSlide.substring(0, 100) + '...' : firstSlide

  // Convert markdown to HTML
  return marked.parse(preview)
})

// Methods
const openSlideshow = () => {
  if (!hasContent.value) return

  // Get graphId from multiple sources (priority order)
  const currentGraphId =
    props.graphId ||
    knowledgeGraphStore.currentGraphId ||
    new URLSearchParams(window.location.search).get('id')

  if (!currentGraphId) {
    console.error('No graphId available for slideshow')
    console.log('Checked sources:', {
      propsGraphId: props.graphId,
      storeGraphId: knowledgeGraphStore.currentGraphId,
      urlGraphId: new URLSearchParams(window.location.search).get('id'),
    })
    alert('Cannot open slideshow: Graph ID not found')
    return
  }

  console.log('Opening slideshow with graphId:', currentGraphId, 'nodeId:', props.node.id)

  const slideshowUrl = `https://knowledge.vegvisr.org/slideshow?nodeId=${encodeURIComponent(props.node.id)}&graphId=${encodeURIComponent(currentGraphId)}&theme=nibi`

  // Open in new window with slideshow dimensions
  window.open(
    slideshowUrl,
    '_blank',
    'width=1024,height=768,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,status=no',
  )
}

const editSlideshow = () => {
  // Emit edit event - parent component will handle opening the edit modal
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  // Emit delete event - parent component will handle the deletion
  if (confirm('Are you sure you want to delete this slideshow?')) {
    emit('delete-node', props.node.id)
  }
}
</script>

<style scoped>
.gnew-slideshow-node {
  margin: 1rem 0;
}

/* Node Header Styles (matching GNewDefaultNode) */
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
  background: #007bff;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.slideshow-preview-container {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px solid #007bff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.1);
}

.slideshow-preview {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #dee2e6;
}

.slideshow-description p {
  color: #6c757d;
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 500;
}

.slide-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: #6c757d;
}

.slide-count {
  font-weight: 600;
  color: #007bff;
}

.slide-separator {
  color: #dee2e6;
}

.slideshow-actions {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.btn-slideshow-primary {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-slideshow-primary:hover:not(:disabled) {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3);
}

.btn-slideshow-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.btn-slideshow-secondary {
  background: transparent;
  color: #6c757d;
  border: 1px solid #dee2e6;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-slideshow-secondary:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
  color: #495057;
}

.slideshow-first-slide-preview {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 1rem;
}

.preview-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
}

.first-slide-content {
  color: #495057;
  font-size: 0.875rem;
  line-height: 1.5;
}

.first-slide-content :deep(h1),
.first-slide-content :deep(h2),
.first-slide-content :deep(h3) {
  font-size: 1rem;
  margin: 0 0 0.5rem 0;
  color: #343a40;
}

.first-slide-content :deep(p) {
  margin: 0 0 0.5rem 0;
}

.first-slide-content :deep(ul),
.first-slide-content :deep(ol) {
  margin: 0;
  padding-left: 1.5rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .slideshow-preview-container {
    padding: 1rem;
  }

  .slideshow-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .slideshow-actions {
    flex-direction: column;
  }

  .btn-slideshow-primary,
  .btn-slideshow-secondary {
    width: 100%;
    justify-content: center;
  }
}
</style>
