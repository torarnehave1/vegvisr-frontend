<template>
  <div class="gnew-video-node" :class="nodeTypeClass">
    <!-- Node Header - Following GNewDefaultNode pattern -->
    <div v-if="showControls && videoTitle" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ videoTitle }}</h3>
        <!-- Node Type Badge inline with title -->
        <div class="node-type-badge-inline">
          {{ nodeTypeDisplay }}
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

    <!-- Title only (for non-control mode) -->
    <div v-else-if="videoTitle" class="node-title-row">
      <h3 class="node-title">{{ videoTitle }}</h3>
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

// Content parsing functions - matches GNewDefaultNode parsing
const parseStyleString = (style) => {
  return style
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const colonIndex = s.indexOf(':')
      if (colonIndex === -1) return ''

      const k = s.substring(0, colonIndex).trim()
      const v = s.substring(colonIndex + 1).trim()

      if (!k || !v) return ''

      // Special handling for background-image to preserve url() quotes
      if (k === 'background-image' && v.includes('url(')) {
        return `${k}:${v}`
      }

      // For other properties, remove outer quotes but preserve inner content
      const cleanValue = v.replace(/^['"]|['"]$/g, '')
      return `${k}:${cleanValue}`
    })
    .join(';')
}

const parseQuoteParams = (style) => {
  // Parse both 'Cited=value' and 'param: value' formats
  const citedMatch = style.match(/Cited\s*=\s*['"]?([^'";]+)['"]?/i)
  if (citedMatch) {
    return citedMatch[1].trim()
  }

  // Try colon format
  const colonMatch = style.match(/cited\s*:\s*['"]?([^'";]+)['"]?/i)
  if (colonMatch) {
    return colonMatch[1].trim()
  }

  return 'Unknown'
}

const processFormattedElementsPass = (text) => {
  let processedText = text

  // Follow the EXACT order from GNewDefaultNode

  // 1. Process COMMENT blocks (with markdown inside)
  processedText = processedText.replace(
    /\[COMMENT\s*\|([^\]]*)\]([\s\S]*?)\[END\s+COMMENT\]/gs,
    (match, style, content) => {
      // Parse style string for author and CSS
      let author = ''
      let css = ''
      style.split(';').forEach((s) => {
        const [k, v] = s.split(':').map((x) => x && x.trim().replace(/^['"]|['"]$/g, ''))
        if (k && v) {
          if (k.toLowerCase() === 'author') {
            author = v
          } else {
            css += `${k}:${v};`
          }
        }
      })

      return `<div class="comment-block" style="${css}">
${author ? `<div class="comment-author">${author}</div>` : ''}
<div>${marked(content.trim(), { breaks: true })}</div>
</div>\n\n`
    },
  )

  // 2. Process FANCY elements (NO markdown processing - just content.trim())
  processedText = processedText.replace(
    /\[FANCY\s*\|([^\]]*)\]([\s\S]*?)\[END\s+FANCY\]/gs,
    (match, style, content) => {
      const css = parseStyleString(style)
      // FANCY elements do NOT process markdown - just use content.trim()
      return `<div class="fancy-title" style="${css}">${content.trim()}</div>`
    },
  )

  // 3. Process QUOTE elements (with markdown inside)
  processedText = processedText.replace(
    /\[QUOTE\s*\|([^\]]*)\]([\s\S]*?)\[END\s+QUOTE\]/gs,
    (match, style, content) => {
      const cited = parseQuoteParams(style)
      const processedContent = marked(content.trim(), { breaks: true })
      return `<div class="fancy-quote">${processedContent}<cite>— ${cited}</cite></div>`
    },
  )

  // 4. Process SECTION elements (with markdown inside)
  processedText = processedText.replace(
    /\[SECTION\s*\|([^\]]*)\]([\s\S]*?)\[END\s+SECTION\]/gs,
    (match, style, content) => {
      const css = parseStyleString(style)
      // Process the content through marked to handle markdown inside the section
      const processedContent = marked(content.trim(), { breaks: true })
      return `<div class="section" style="${css}; padding: 15px; border-radius: 8px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${processedContent}</div>`
    },
  )

  // 5. Process WNOTE elements (with markdown inside)
  processedText = processedText.replace(
    /\[WNOTE\s*\|([^\]]*)\]([\s\S]*?)\[END\s+WNOTE\]/gs,
    (match, style, content) => {
      const cited = parseQuoteParams(style)
      const processedContent = marked(content.trim(), { breaks: true })
      return `<div class="work-note">
        ${processedContent}
        ${cited !== 'Unknown' ? `<cite>— ${cited}</cite>` : ''}
      </div>`
    },
  )

  return processedText
}

// Content parsing function - matches GNewDefaultNode parseFormattedElements
const parseFormattedElements = (text) => {
  // Process all formatted elements in the correct order
  let processedText = processFormattedElementsPass(text)

  // Finally process any remaining markdown
  const finalHtml = marked(processedText, { breaks: true })

  return finalHtml
}

// YouTube parsing functions (compatible with GraphViewer)
const parseYoutubeVideo = (markdown) => {
  // Support GraphViewer markdown format: ![YOUTUBE src=URL]TITLE[END YOUTUBE]
  const regex = /!\[YOUTUBE src=(.+?)\](.+?)\[END YOUTUBE\]/
  const match = markdown.match(regex)

  if (match) {
    let videoUrl = match[1].trim()
    if (videoUrl.includes('youtube.com/embed/')) {
      return videoUrl.split('?')[0]
    } else if (videoUrl.includes('youtu.be/')) {
      const videoId = videoUrl.split('youtu.be/')[1].split('?')[0]
      return `https://www.youtube.com/embed/${videoId}`
    } else if (videoUrl.includes('youtube.com/watch?v=')) {
      const videoId = videoUrl.split('watch?v=')[1].split('&')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
  }
  return null
}

const parseYoutubeVideoTitle = (markdown) => {
  // Support GraphViewer markdown format: ![YOUTUBE src=URL]TITLE[END YOUTUBE]
  const regex = /!\[YOUTUBE src=(.+?)\](.+?)\[END YOUTUBE\]/
  const match = markdown.match(regex)
  return match ? match[2].trim() : null
}

// Computed properties
const isGraphViewerFormat = computed(() => {
  return props.node.label && props.node.label.includes('![YOUTUBE src=')
})

const videoTitle = computed(() => {
  if (isGraphViewerFormat.value) {
    // Use GraphViewer parsing for title
    return parseYoutubeVideoTitle(props.node.label) || 'YouTube Video'
  } else {
    // Extract title from YouTube URL if available (original logic)
    if (props.node.label && videoId.value) {
      return (
        props.node.label
          .replace(/https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/, '')
          .trim() || 'YouTube Video'
      )
    }
    return props.node.label || 'YouTube Video'
  }
})

const nodeContent = computed(() => {
  return props.node.info || ''
})

const formattedContent = computed(() => {
  if (!nodeContent.value) return ''

  try {
    // Use the same parsing logic as GNewDefaultNode
    return parseFormattedElements(nodeContent.value)
  } catch (error) {
    console.error('Error parsing formatted content:', error)
    // Fallback to simple markdown parsing
    return marked.parse(nodeContent.value)
  }
})

const videoId = computed(() => {
  if (!props.node.label) return null

  // Check if it's GraphViewer format first
  if (isGraphViewerFormat.value) {
    const embedUrl = parseYoutubeVideo(props.node.label)
    if (embedUrl) {
      const match = embedUrl.match(/\/embed\/([^?]+)/)
      return match ? match[1] : null
    }
    return null
  }

  // Original logic for simple YouTube URLs
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

  if (isGraphViewerFormat.value) {
    // Use GraphViewer parsing
    return parseYoutubeVideo(props.node.label)
  }

  // Original logic
  return `https://www.youtube.com/embed/${videoId.value}?rel=0&modestbranding=1`
})

const youtubeUrl = computed(() => {
  if (!videoId.value) return null
  return `https://www.youtube.com/watch?v=${videoId.value}`
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

/* Header - Following GNewDefaultNode pattern */
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

/* Inline badge - Following GNewDefaultNode pattern */
.node-type-badge-inline {
  background: #dc3545;
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

/* Title row for non-control mode */
.node-title-row {
  margin-bottom: 15px;
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

/* Formatted Elements Styling - Matches GNewDefaultNode */
.video-description :deep(.section) {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.video-description :deep(.fancy-title) {
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
  margin: 1.5em 0;
  padding: 1.5em;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  position: relative;
  overflow: hidden;
}

.video-description :deep(.fancy-title::before) {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #007bff, #6610f2, #e83e8c, #fd7e14);
}

.video-description :deep(.fancy-quote) {
  font-style: italic;
  font-size: 1.1rem;
  margin: 1.5em 0;
  padding: 1em 1.5em;
  border-left: 4px solid #007bff;
  background: #f8f9fa;
  border-radius: 0 8px 8px 0;
}

.video-description :deep(.fancy-quote cite) {
  display: block;
  margin-top: 0.5em;
  font-size: 0.9rem;
  color: #6c757d;
  font-style: normal;
}

.video-description :deep(.comment-block) {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
}

.video-description :deep(.comment-author) {
  font-weight: bold;
  color: #856404;
  margin-bottom: 8px;
}

.video-description :deep(.work-note) {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-left: 4px solid #28a745;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
}

.video-description :deep(.work-note cite) {
  display: block;
  margin-top: 0.5em;
  font-size: 0.9rem;
  color: #155724;
  font-style: normal;
}

/* Basic markdown styling for video description */
.video-description :deep(h1),
.video-description :deep(h2),
.video-description :deep(h3),
.video-description :deep(h4),
.video-description :deep(h5),
.video-description :deep(h6) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  color: #2c3e50;
}

.video-description :deep(ul),
.video-description :deep(ol) {
  margin-bottom: 1em;
  padding-left: 1.5em;
}

.video-description :deep(blockquote) {
  border-left: 4px solid #007bff;
  margin: 1em 0;
  padding: 0.5em 1em;
  background: #f8f9fa;
  font-style: italic;
}

.video-description :deep(code) {
  background: #f8f9fa;
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
}

.video-description :deep(pre) {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1em;
  overflow-x: auto;
  margin: 1em 0;
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

  .node-type-badge-inline {
    align-self: flex-start;
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

  /* Mobile responsiveness for formatted elements */
  .video-description :deep(.section),
  .video-description :deep(.fancy-title),
  .video-description :deep(.fancy-quote),
  .video-description :deep(.comment-block),
  .video-description :deep(.work-note) {
    padding: 10px;
    margin: 10px 0;
  }

  .video-description :deep(.fancy-title) {
    font-size: 1.2rem;
  }

  .video-description :deep(.fancy-quote) {
    font-size: 1rem;
  }
}
</style>
