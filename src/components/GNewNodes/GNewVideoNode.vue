<template>
  <div class="gnew-video-node" :class="nodeTypeClass">
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

    <!-- Video Container -->
    <div class="video-container">
      <!-- YouTube Embed -->
      <div v-if="videoId" class="video-embed-wrapper">
        <iframe
          :src="embedUrl"
          :title="videoTitle"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
          class="video-embed"
        ></iframe>
      </div>

      <!-- Video Error State -->
      <div v-else-if="hasInvalidUrl" class="video-error-state">
        <div class="error-icon">📹</div>
        <p>Invalid YouTube URL</p>
        <small class="text-muted">{{ node.label }}</small>
        <button
          v-if="showControls && !isPreview"
          @click="editNode"
          class="btn btn-sm btn-primary mt-2"
        >
          Fix Video URL
        </button>
      </div>

      <!-- No Video State -->
      <div v-else class="video-empty-state">
        <div class="empty-icon">📹</div>
        <p>No video available</p>
        <button v-if="showControls && !isPreview" @click="editNode" class="btn btn-sm btn-primary">
          Add Video
        </button>
      </div>
    </div>

    <!-- Video Info -->
    <div v-if="nodeContent" class="video-description">
      <div v-html="formattedContent"></div>
    </div>

    <!-- Video Metadata -->
    <div v-if="videoMetadata && showControls" class="video-metadata">
      <small class="text-muted">
        <span v-if="videoMetadata.duration">{{ videoMetadata.duration }}</span>
        <span v-if="videoMetadata.channel"> • {{ videoMetadata.channel }}</span>
        <a v-if="videoId" :href="youtubeUrl" target="_blank" class="text-decoration-none">
          • Watch on YouTube ↗
        </a>
      </small>
    </div>

    <!-- Node Type Badge -->
    <div v-if="showControls" class="node-type-badge">
      {{ nodeTypeDisplay }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
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

// Reactive state
const videoMetadata = ref(null)

// Computed properties
const nodeTitle = computed(() => {
  // Extract title from YouTube URL if available
  if (props.node.label && videoId.value) {
    return (
      props.node.label
        .replace(/https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/, '')
        .trim() || 'YouTube Video'
    )
  }
  return props.node.label || 'YouTube Video'
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

const videoId = computed(() => {
  if (!props.node.label) return null

  // Extract YouTube video ID from various URL formats
  const url = props.node.label
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
})

const hasInvalidUrl = computed(() => {
  return (
    props.node.label &&
    (props.node.label.includes('youtube') || props.node.label.includes('youtu.be')) &&
    !videoId.value
  )
})

const embedUrl = computed(() => {
  if (!videoId.value) return null
  return `https://www.youtube.com/embed/${videoId.value}?rel=0&modestbranding=1`
})

const youtubeUrl = computed(() => {
  if (!videoId.value) return null
  return `https://www.youtube.com/watch?v=${videoId.value}`
})

const videoTitle = computed(() => {
  return nodeTitle.value || 'YouTube Video'
})

const nodeTypeClass = computed(() => {
  return 'node-type-youtube-video'
})

const nodeTypeDisplay = computed(() => {
  return 'YouTube Video'
})

// Methods
const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this video node?')) {
    emit('node-deleted', props.node.id)
  }
}

// Lifecycle
onMounted(() => {
  // You could fetch video metadata from YouTube API here
  // For now, we'll just set some basic info
  if (videoId.value) {
    videoMetadata.value = {
      // These would come from YouTube API in a full implementation
      duration: 'Unknown',
      channel: 'Unknown Channel',
    }
  }
})
</script>

<style scoped>
.gnew-video-node {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  position: relative;
}

.gnew-video-node:hover {
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

.video-container {
  margin-bottom: 15px;
}

.video-embed-wrapper {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
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

.video-error-state,
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

.error-icon,
.empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  opacity: 0.6;
}

.video-error-state p {
  color: #dc3545;
  font-weight: 500;
  margin-bottom: 8px;
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

.video-metadata a {
  color: #007bff;
}

.video-metadata a:hover {
  color: #0056b3;
}

.node-type-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: #dc3545;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

@media (max-width: 768px) {
  .gnew-video-node {
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

  .video-error-state,
  .video-empty-state {
    padding: 30px 15px;
    min-height: 150px;
  }

  .error-icon,
  .empty-icon {
    font-size: 2.5rem;
  }

  .video-embed-wrapper {
    padding-bottom: 65%; /* Slightly taller aspect ratio on mobile */
  }
}
</style>
