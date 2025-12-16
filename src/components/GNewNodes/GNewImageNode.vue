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
      <!-- Image with Attribution -->
      <div v-if="imageUrl" class="image-change-wrapper">
        <img
          :src="imageUrl"
          :alt="imageAlt"
          :style="imageStyles"
          class="node-image"
          draggable="true"
          @dragstart="handleImageDragStart"
          @dragend="handleImageDragEnd"
          @error="handleImageError"
          @load="handleImageLoad"
          :title="'Drag to chat to analyze this image'"
        />

        <!-- Attribution Overlay or Below -->
        <div
          v-if="imageAttribution"
          :class="
            imageAttribution.isSmall ? 'image-attribution-below' : 'image-attribution-overlay'
          "
        >
          <div
            :class="imageAttribution.isSmall ? 'attribution-text-below' : 'attribution-text'"
            v-html="imageAttribution.html"
          ></div>
        </div>
      </div>

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
    // If we have a path (new format), use the label as-is
    if (props.node.path && props.node.label && !props.node.label.includes('![')) {
      return props.node.label
    }
    // For old markdown format, extract title from markdown syntax
    const match = props.node.label?.match(/!\[([^\]]*)\|/)
    return match?.[1] || props.node.label || null
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
  // For markdown-image nodes, prefer path field, fall back to parsing label
  if (props.node.type === 'markdown-image') {
    return props.node.path || parseMarkdownImage()?.url || null
  } else if (props.node.type === 'portfolio-image') {
    return props.node.path || null
  } else {
    // background and other image types - check path first, then label
    return props.node.path || props.node.label || null
  }
})

const imageAlt = computed(() => {
  return nodeTitle.value || props.node.label || 'Node image'
})

const imageStyles = computed(() => {
  const styles = {}

  if (props.node.type === 'markdown-image') {
    // First check for new format with individual style properties
    if (props.node.imageWidth) styles.width = props.node.imageWidth
    if (props.node.imageHeight) styles.height = props.node.imageHeight

    // Check for imageStyles object
    if (props.node.imageStyles && typeof props.node.imageStyles === 'object') {
      Object.assign(styles, props.node.imageStyles)
    }

    // Fall back to old markdown format parsing if no direct styles found
    if (Object.keys(styles).length === 0) {
      const parsed = parseMarkdownImage()
      if (parsed?.styles) {
        Object.assign(styles, parsed.styles)
      }
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

// Attribution computation
const imageAttribution = computed(() => {
  if (!props.node.imageAttributions || !imageUrl.value) {
    return null
  }

  const attribution = props.node.imageAttributions[imageUrl.value]
  if (!attribution) {
    return null
  }

  // Check if this is a small contextual image (Rightside/Leftside with small dimensions)
  const isSmallContextualImage =
    props.node.type === 'markdown-image' &&
    props.node.label &&
    (props.node.label.match(/!\[(Rightside|Leftside)-\d+\|.*?width:\s*\d{1,3}px/i) ||
      props.node.label.match(/!\[(Rightside|Leftside)-\d+\|.*?height:\s*\d{1,3}px/i))

  if (attribution.provider === 'pexels') {
    const photographerName = attribution.photographer || 'Unknown'
    const photographerUrl = attribution.photographer_url || '#'
    const pexelsUrl = attribution.pexels_url || 'https://www.pexels.com'

    return {
      html: `Photo by <a href="${photographerUrl}" target="_blank" rel="noopener" class="photographer-link">${photographerName}</a> on <a href="${pexelsUrl}" target="_blank" rel="noopener" class="pexels-link">Pexels</a>`,
      isSmall: isSmallContextualImage,
    }
  }

  if (attribution.provider === 'unsplash') {
    const photographerName = attribution.photographer || 'Unknown'
    const photographerUsername =
      attribution.photographer_username || photographerName.toLowerCase().replace(/\s+/g, '')
    const unsplashUrl = attribution.unsplash_url || 'https://unsplash.com'

    // Unsplash requires UTM parameters for attribution links
    const photographerUrl = `https://unsplash.com/@${photographerUsername}?utm_source=vegvisr&utm_medium=referral`
    const photoUrl = `${unsplashUrl}?utm_source=vegvisr&utm_medium=referral`

    return {
      html: `Photo by <a href="${photographerUrl}" target="_blank" rel="noopener" class="photographer-link">${photographerName}</a> on <a href="${photoUrl}" target="_blank" rel="noopener" class="unsplash-link">Unsplash</a>`,
      isSmall: isSmallContextualImage,
    }
  }

  if (attribution.provider === 'custom') {
    // Filter out meaningless photographer names
    const photographer = attribution.photographer && !['Portfolio', 'Unknown', ''].includes(attribution.photographer.trim())
      ? attribution.photographer
      : null

    const photographerUrl = attribution.photographer_url
    const customText = attribution.custom_attribution

    // Only show attribution if we have meaningful content
    if (!photographer && !customText) {
      return null
    }

    let html = ''

    if (photographer) {
      html += 'Photo by '
      if (photographerUrl && photographerUrl.trim()) {
        html += `<a href="${photographerUrl}" target="_blank" rel="noopener" class="photographer-link">${photographer}</a>`
      } else {
        html += `<span class="photographer-name">${photographer}</span>`
      }
    }

    if (customText && customText.trim()) {
      html += photographer ? ` - ${customText}` : customText
    }

    return {
      html: html,
      isSmall: isSmallContextualImage,
    }
  }

  return null
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

// Drag handlers for image drag-and-drop to chat
const handleImageDragStart = (event) => {
  const url = imageUrl.value
  if (!url) return
  
  // Set the image URL as drag data
  event.dataTransfer.setData('text/uri-list', url)
  event.dataTransfer.setData('text/plain', url)
  event.dataTransfer.setData('application/x-vegvisr-image', url)
  
  // Also set HTML for broader compatibility
  event.dataTransfer.setData('text/html', `<img src="${url}" />`)
  
  // Set drag effect
  event.dataTransfer.effectAllowed = 'copy'
  
  // Add visual feedback
  event.target.style.opacity = '0.6'
  event.target.style.cursor = 'grabbing'
}

const handleImageDragEnd = (event) => {
  // Reset visual feedback
  event.target.style.opacity = '1'
  event.target.style.cursor = 'grab'
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

  // Add change image button functionality for attribution support
  addChangeImageButtons()
})

// Methods for attribution support
const addChangeImageButtons = () => {
  if (typeof window === 'undefined') return

  setTimeout(() => {
    const changeImageBtns = document.querySelectorAll('.change-image-btn')
    const googlePhotosBtns = document.querySelectorAll('.google-photos-btn')

    changeImageBtns.forEach((btn) => {
      if (!btn.hasClickListener) {
        btn.addEventListener('click', handleChangeImageClick)
        btn.hasClickListener = true
      }
    })

    googlePhotosBtns.forEach((btn) => {
      if (!btn.hasClickListener) {
        btn.addEventListener('click', handleGooglePhotosClick)
        btn.hasClickListener = true
      }
    })
  }, 100)
}

const handleChangeImageClick = (event) => {
  const btn = event.target
  const imageUrl = btn.dataset.imageUrl
  const imageAlt = btn.dataset.imageAlt
  const imageType = btn.dataset.imageType
  const imageContext = btn.dataset.imageContext
  const nodeId = btn.dataset.nodeId
  const nodeContent = btn.dataset.nodeContent

  if (typeof window !== 'undefined' && window.openImageSelector) {
    window.openImageSelector({
      currentImageUrl: imageUrl,
      currentImageAlt: imageAlt,
      imageType: imageType,
      context: imageContext,
      nodeId: nodeId,
      nodeContent: nodeContent,
    })
  }
}

const handleGooglePhotosClick = (event) => {
  const btn = event.target
  const imageUrl = btn.dataset.imageUrl
  const imageAlt = btn.dataset.imageAlt
  const imageType = btn.dataset.imageType
  const imageContext = btn.dataset.imageContext
  const nodeId = btn.dataset.nodeId
  const nodeContent = btn.dataset.nodeContent

  if (typeof window !== 'undefined' && window.openGooglePhotosSelector) {
    window.openGooglePhotosSelector({
      currentImageUrl: imageUrl,
      currentImageAlt: imageAlt,
      imageType: imageType,
      context: imageContext,
      nodeId: nodeId,
      nodeContent: nodeContent,
    })
  }
}
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

.image-change-wrapper {
  position: relative;
  display: inline-block;
  width: 100%;
}

.node-image {
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
  cursor: grab;
  transition: opacity 0.2s ease;
}

.node-image:active {
  cursor: grabbing;
}

/* Image Attribution Overlay Styles */
.image-attribution-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  padding: clamp(4px, 2vw, 12px) clamp(6px, 3vw, 12px) clamp(6px, 2.5vw, 10px);
  font-size: clamp(0.6rem, 1.5vw, 0.8rem);
  line-height: 1.2;
  z-index: 2;
  container-type: inline-size;
}

/* For smaller images (width <= 300px), show attribution below instead of overlay */
@container (max-width: 300px) {
  .image-attribution-overlay {
    position: static;
    background: none;
    padding: 8px 0 0 0;
    font-size: 0.75rem;
    line-height: 1.3;
    border-top: 1px solid #e9ecef;
    margin-top: 8px;
  }

  .attribution-text {
    color: #495057 !important;
    text-shadow: none !important;
  }

  .attribution-text a {
    color: #007bff !important;
    border-bottom: 1px solid rgba(0, 123, 255, 0.3) !important;
  }

  .attribution-text a:hover {
    color: #0056b3 !important;
    border-bottom-color: #0056b3 !important;
    text-shadow: none !important;
  }
}

/* For medium images (301px - 500px), use smaller overlay */
@container (min-width: 301px) and (max-width: 500px) {
  .image-attribution-overlay {
    font-size: 0.7rem;
    padding: 6px 8px 8px;
    line-height: 1.15;
  }
}

/* For larger images (501px+), use full overlay */
@container (min-width: 501px) {
  .image-attribution-overlay {
    font-size: 0.8rem;
    padding: 8px 12px 10px;
    line-height: 1.2;
  }
}

.attribution-text {
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.attribution-text a {
  color: #ffffff;
  text-decoration: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
  transition: all 0.2s ease;
}

.attribution-text a:hover {
  color: #f8f9fa;
  border-bottom-color: #f8f9fa;
  text-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
}

.photographer-link {
  font-weight: 500;
}

.pexels-link,
.unsplash-link {
  font-weight: 600;
}

/* Attribution below image (for small contextual images like Rightside/Leftside) */
.image-attribution-below {
  margin-top: 4px;
  padding: 6px 0;
  font-size: 0.7rem;
  line-height: 1.3;
  border-top: 1px solid #e9ecef;
  text-align: left;
}

.attribution-text-below {
  color: #495057;
  font-size: 0.7rem;
}

.attribution-text-below a {
  color: #007bff;
  text-decoration: none;
  border-bottom: 1px solid rgba(0, 123, 255, 0.3);
  transition: all 0.2s ease;
}

.attribution-text-below a:hover {
  color: #0056b3;
  border-bottom-color: #0056b3;
}

.attribution-text-below .photographer-link {
  font-weight: 500;
}

.attribution-text-below .provider-link {
  font-weight: 600;
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

/* Custom attribution styling */
.photographer-name {
  font-weight: 500;
  color: inherit;
}
</style>
