<template>
  <div class="gnew-cf-video-node">
    <!-- Node Header -->
    <div v-if="showControls && videoTitle" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ videoTitle }}</h3>
        <div class="node-type-badge-inline">
          Cloudflare Video
        </div>
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

    <!-- Title only (non-control mode) -->
    <div v-else-if="videoTitle" class="node-title-row">
      <h3 class="node-title">{{ videoTitle }}</h3>
    </div>

    <!-- Video Container -->
    <div class="video-container">
      <!-- Stream Embed -->
      <div v-if="embedUrl" class="video-embed-wrapper">
        <iframe
          :src="embedUrl"
          :title="videoTitle"
          frameborder="0"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          class="video-embed"
        ></iframe>
      </div>

      <!-- No Video State -->
      <div v-else class="video-empty-state">
        <div class="empty-icon">🎥</div>
        <p>No Cloudflare Stream video configured</p>
        <small class="text-muted">Set the video ID or iframe URL in the path field</small>
        <button v-if="showControls && !isPreview" @click="editNode" class="btn btn-sm btn-primary mt-2">
          Add Video
        </button>
      </div>
    </div>

    <!-- Video Description (markdown from info field) -->
    <div v-if="node.info && !isIframeContent" class="video-description">
      <div v-html="formattedInfo"></div>
    </div>

    <!-- Metadata -->
    <div v-if="videoMeta && showControls" class="video-metadata">
      <small class="text-muted">
        <span v-if="videoMeta.duration">{{ formatDuration(videoMeta.duration) }}</span>
        <span v-if="videoMeta.readyToStream === false"> • Processing...</span>
        <span v-if="videoMeta.readyToStream === true"> • Ready</span>
      </small>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'

const CUSTOMER_SUBDOMAIN = 'customer-7tiaylt74yxtwkg8.cloudflarestream.com'

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

const videoTitle = computed(() => props.node.label || 'Cloudflare Video')

const videoMeta = computed(() => props.node.metadata || null)

// Check if info field contains an iframe (legacy/inline embed) vs markdown description
const isIframeContent = computed(() => {
  const info = props.node.info || ''
  return info.trim().startsWith('<iframe') || info.includes('cloudflarestream.com')
})

const formattedInfo = computed(() => {
  if (!props.node.info || isIframeContent.value) return ''
  return marked(props.node.info, { breaks: true })
})

// Extract video ID from various formats
const extractVideoId = (raw) => {
  if (!raw) return null
  const val = raw.trim()

  // Direct video ID (32-char hex)
  if (/^[a-f0-9]{32}$/.test(val)) return val

  // Extract from iframe src
  const srcMatch = val.match(/src=["']([^"']+)["']/)
  const url = srcMatch ? srcMatch[1] : val

  // cloudflarestream.com/<videoId>/iframe or /manifest or /thumbnails
  const cfMatch = url.match(/cloudflarestream\.com\/([a-f0-9]{32})/)
  if (cfMatch) return cfMatch[1]

  // videodelivery.net/<videoId>
  const vdMatch = url.match(/videodelivery\.net\/([a-f0-9]{32})/)
  if (vdMatch) return vdMatch[1]

  return null
}

const videoId = computed(() => {
  // Try path first (preferred field for URLs)
  const fromPath = extractVideoId(props.node.path)
  if (fromPath) return fromPath

  // Try metadata.videoId
  if (props.node.metadata?.videoId) return props.node.metadata.videoId

  // Try info field (might contain iframe)
  const fromInfo = extractVideoId(props.node.info)
  if (fromInfo) return fromInfo

  // Try label as last resort
  return extractVideoId(props.node.label)
})

const embedUrl = computed(() => {
  if (!videoId.value) return null
  return `https://${CUSTOMER_SUBDOMAIN}/${videoId.value}/iframe`
})

const formatDuration = (seconds) => {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this video node?')) {
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-cf-video-node {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.gnew-cf-video-node:hover {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

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

.node-title-row {
  margin-bottom: 15px;
}

.node-controls {
  display: flex;
  gap: 8px;
  margin-left: 15px;
}

.node-type-badge-inline {
  background: #f48120;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  flex-shrink: 0;
}

.video-container {
  margin-bottom: 15px;
}

.video-embed-wrapper {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.video-embed {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 8px;
}

.video-empty-state {
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

.empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  opacity: 0.6;
}

.video-description {
  color: #495057;
  line-height: 1.6;
  font-size: 0.95rem;
}

.video-description :deep(p) {
  margin-bottom: 0.5em;
}

.video-metadata {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e9ecef;
}

@media (max-width: 768px) {
  .gnew-cf-video-node {
    padding: 15px;
    margin-bottom: 15px;
  }

  .node-header {
    flex-direction: column;
    gap: 10px;
  }

  .node-title-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .node-controls {
    margin-left: 0;
    align-self: flex-end;
  }

  .node-title {
    font-size: 1.2rem;
  }

  .video-embed-wrapper {
    padding-bottom: 65%;
  }
}
</style>
