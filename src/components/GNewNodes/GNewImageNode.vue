<template>
  <div class="gnew-image-node" :class="nodeTypeClass">
    <!-- Node Header -->
    <div v-if="nodeTitle" class="node-header">
      <h3 class="node-title">{{ nodeTitle }}</h3>
      <div v-if="showControls && !isPreview" class="node-controls">
        <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Node">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Node">
          🗑️
        </button>
      </div>
    </div>

    <!-- Image Container -->
    <div class="image-container" :style="imageContainerStyles">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="imageAlt"
        :style="imageStyles"
        class="node-image"
        @error="handleImageError"
        @load="handleImageLoad"
      />

      <!-- Image Error State -->
      <div v-else-if="imageError" class="image-error-state">
        <div class="error-icon">🖼️</div>
        <p>Failed to load image</p>
        <small class="text-muted">{{ imageUrl }}</small>
        <button
          v-if="showControls && !isPreview"
          @click="editNode"
          class="btn btn-sm btn-primary mt-2"
        >
          Fix Image
        </button>
      </div>

      <!-- Loading State -->
      <div v-else-if="imageLoading" class="image-loading-state">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading image...</span>
        </div>
        <p class="mt-2">Loading image...</p>
      </div>

      <!-- No Image State -->
      <div v-else class="image-empty-state">
        <div class="empty-icon">🖼️</div>
        <p>No image available</p>
        <button v-if="showControls && !isPreview" @click="editNode" class="btn btn-sm btn-primary">
          Add Image
        </button>
      </div>
    </div>

    <!-- Image Edit Buttons (Superadmin only) -->
    <div
      v-if="showControls && !isPreview && imageUrl && userStore.role === 'Superadmin'"
      class="image-edit-buttons"
    >
      <button
        class="change-image-btn"
        :data-image-url="imageUrl"
        :data-image-alt="imageAlt"
        :data-image-type="node.type"
        :data-image-context="`${nodeTypeDisplay} node image`"
        :data-node-id="node.id"
        :data-node-content="node.label || ''"
        title="Change this image"
      >
        🔄 Change Image
      </button>
      <button
        class="google-photos-btn"
        :data-image-url="imageUrl"
        :data-image-alt="imageAlt"
        :data-image-type="node.type"
        :data-image-context="`${nodeTypeDisplay} node image`"
        :data-node-id="node.id"
        :data-node-content="node.label || ''"
        title="Select from Google Photos"
      >
        📷 Google
      </button>
    </div>

    <!-- Image Caption/Info -->
    <div v-if="nodeContent" class="image-caption">
      <div v-html="formattedContent"></div>
    </div>

    <!-- Image Metadata -->
    <div v-if="imageMetadata && showControls" class="image-metadata">
      <small class="text-muted">
        <span v-if="imageMetadata.dimensions">{{ imageMetadata.dimensions }}</span>
        <span v-if="imageMetadata.size"> • {{ imageMetadata.size }}</span>
        <span v-if="imageMetadata.type"> • {{ imageMetadata.type }}</span>
      </small>
    </div>

    <!-- Node Type Badge -->
    <div v-if="node.type && showControls" class="node-type-badge">
      {{ nodeTypeDisplay }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { marked } from 'marked'
import { useUserStore } from '@/stores/userStore'

// Store access
const userStore = useUserStore()

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

// Reactive state
const imageLoading = ref(false)
const imageError = ref(false)
const imageMetadata = ref(null)

// Computed properties
const nodeTitle = computed(() => {
  if (props.node.type === 'markdown-image') {
    // For markdown images, extract title from label if available
    const match = props.node.label?.match(/!\[([^\]]*)\|/)
    return match?.[1] || null
  }
  return props.node.label || null
})

const nodeContent = computed(() => {
  return props.node.info || ''
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

const imageUrl = computed(() => {
  if (props.node.type === 'markdown-image') {
    return parseMarkdownImage()?.url || null
  } else if (props.node.type === 'portfolio-image') {
    return props.node.path || null
  } else {
    // background and other image types
    return props.node.label || null
  }
})

const imageAlt = computed(() => {
  return nodeTitle.value || props.node.label || 'Node image'
})

const imageStyles = computed(() => {
  const styles = {}

  if (props.node.type === 'markdown-image') {
    const parsed = parseMarkdownImage()
    if (parsed?.styles) {
      Object.assign(styles, parsed.styles)
    }
  }

  // Default styles
  if (!styles.width) styles.width = 'auto'
  if (!styles.height) styles.height = 'auto'
  if (!styles.objectFit) styles.objectFit = 'cover'
  if (!styles.objectPosition) styles.objectPosition = 'center'

  return styles
})

const imageContainerStyles = computed(() => {
  const styles = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '8px',
  }

  // Apply container-specific styling based on image type
  if (props.node.type === 'background') {
    styles.minHeight = '200px'
    styles.background = `url(${imageUrl.value}) center/cover no-repeat`
  }

  return styles
})

const nodeTypeClass = computed(() => {
  const type = props.node.type || 'image'
  return `node-type-${type}`
})

const nodeTypeDisplay = computed(() => {
  const type = props.node.type || 'image'
  const typeLabels = {
    'markdown-image': 'Markdown Image',
    background: 'Background',
    'portfolio-image': 'Portfolio Image',
  }
  return typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)
})

// Methods
const parseMarkdownImage = () => {
  const regex = /!\[.*?\|(.+?)\]\((.+?)\)/
  const match = props.node.label?.match(regex)

  if (match) {
    const styles = match[1].split(';').reduce((acc, style) => {
      const [key, value] = style.split(':').map((s) => s.trim())
      if (key && value) acc[key] = value.replace(/'/g, '')
      return acc
    }, {})

    return { url: match[2], styles }
  }
  return null
}

const handleImageLoad = (event) => {
  imageLoading.value = false
  imageError.value = false

  // Extract image metadata
  const img = event.target
  imageMetadata.value = {
    dimensions: `${img.naturalWidth} × ${img.naturalHeight}`,
    type: img.src.split('.').pop()?.toUpperCase() || 'Unknown',
  }
}

const handleImageError = () => {
  imageLoading.value = false
  imageError.value = true
  imageMetadata.value = null
}

const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this image node?')) {
    emit('node-deleted', props.node.id)
  }
}

// Lifecycle
onMounted(() => {
  if (imageUrl.value) {
    imageLoading.value = true
  }
})
</script>

<style scoped>
.gnew-image-node {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  position: relative;
}

.gnew-image-node:hover {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.node-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: #2c3e50;
  line-height: 1.3;
  flex: 1;
}

.node-controls {
  display: flex;
  gap: 8px;
  margin-left: 15px;
}

.image-container {
  position: relative;
  background: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 15px;
}

.node-image {
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
}

.image-error-state,
.image-loading-state,
.image-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  min-height: 200px;
  background: #f8f9fa;
  border: 2px dashed #dee2e6;
  border-radius: 8px;
}

.error-icon,
.empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  opacity: 0.6;
}

.image-error-state p {
  color: #dc3545;
  font-weight: 500;
  margin-bottom: 8px;
}

.image-caption {
  color: #495057;
  line-height: 1.6;
  font-size: 0.95rem;
}

.image-caption :deep(p) {
  margin-bottom: 0.5em;
}

.image-metadata {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e9ecef;
}

.node-type-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: #007bff;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Node type specific styling */
.node-type-markdown-image .node-type-badge {
  background: #6f42c1;
}

.node-type-background {
  padding: 0;
}

.node-type-background .image-container {
  border-radius: 12px;
  min-height: 300px;
  background-attachment: fixed;
}

.node-type-background .node-header,
.node-type-background .image-caption,
.node-type-background .image-metadata {
  margin: 0 20px;
  padding: 15px 0;
}

.node-type-background .node-header {
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.node-type-portfolio-image .node-type-badge {
  background: #fd7e14;
}

/* Image editing buttons */
.image-edit-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 10px;
  margin-bottom: 15px;
}

.change-image-btn,
.google-photos-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.change-image-btn:hover,
.google-photos-btn:hover {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.change-image-btn:active,
.google-photos-btn:active {
  transform: translateY(0);
  box-shadow: none;
}

.google-photos-btn {
  background: #28a745;
}

.google-photos-btn:hover {
  background: #1e7e34;
}

@media (max-width: 768px) {
  .gnew-image-node {
    padding: 15px;
    margin-bottom: 15px;
  }

  .node-header {
    flex-direction: column;
    gap: 10px;
  }

  .node-controls {
    margin-left: 0;
    align-self: flex-end;
  }

  .node-title {
    font-size: 1.2rem;
  }

  .image-error-state,
  .image-loading-state,
  .image-empty-state {
    padding: 30px 15px;
    min-height: 150px;
  }

  .error-icon,
  .empty-icon {
    font-size: 2.5rem;
  }

  /* Mobile responsiveness for image edit buttons */
  .image-edit-buttons {
    flex-direction: column;
    gap: 4px;
  }

  .change-image-btn,
  .google-photos-btn {
    width: 100%;
    font-size: 0.8rem;
    padding: 8px 10px;
  }
}
</style>
