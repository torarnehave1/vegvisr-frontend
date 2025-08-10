<template>
  <div class="gnew-audio-node" :class="nodeTypeClass">
    <!-- Node Header - Following GNewDefaultNode pattern -->
    <div v-if="showControls && audioTitle" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ audioTitle }}</h3>
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
    <div v-else-if="audioTitle" class="node-title-row">
      <h3 class="node-title">{{ audioTitle }}</h3>
    </div>

    <!-- Audio Container -->
    <div class="audio-container">
      <div v-if="hasValidAudioUrl" class="audio-player-wrapper">
        <!-- Audio Player -->
        <audio
          ref="audioPlayer"
          :src="audioUrl"
          controls
          preload="metadata"
          class="audio-player"
          @loadedmetadata="onAudioLoaded"
          @error="onAudioError"
          @play="onAudioPlay"
          @pause="onAudioPause"
          @ended="onAudioEnded"
          @loadstart="onAudioLoadStart"
        >
          Your browser does not support the audio element.
        </audio>

        <!-- Audio Info -->
        <div class="audio-info">
          <div class="audio-meta">
            <span v-if="audioDuration" class="audio-duration">
              🕐 {{ formatDuration(audioDuration) }}
            </span>
            <span v-if="audioFileSize" class="audio-size">
              📁 {{ formatFileSize(audioFileSize) }}
            </span>
            <span v-if="audioType" class="audio-type"> 🎵 {{ audioType.toUpperCase() }} </span>
          </div>
          <div class="audio-controls-extra">
            <button
              @click="openPortfolioModal"
              class="btn btn-sm btn-outline-primary"
              title="Select audio from portfolio"
            >
              📁 Portfolio
            </button>
            <button
              v-if="audioUrl"
              @click="openInNewTab"
              class="btn btn-sm btn-outline-info"
              title="Open audio in new tab"
            >
              🔗 Open
            </button>
            <button
              v-if="audioUrl"
              @click="downloadAudio"
              class="btn btn-sm btn-outline-success"
              title="Download audio file"
            >
              📥 Download
            </button>
          </div>
        </div>
      </div>

      <!-- Invalid URL Display -->
      <div v-else-if="hasInvalidUrl" class="invalid-url-display">
        <div class="invalid-url-icon">🎵❌</div>
        <p class="invalid-url-text">
          <strong>Invalid Audio URL:</strong><br />
          {{ node.path }}
        </p>
        <p class="invalid-url-help">Please check the audio URL and ensure it's accessible.</p>
      </div>

      <!-- No URL Display -->
      <div v-else class="no-url-display">
        <div class="no-url-icon">🎵</div>
        <p class="no-url-text">No audio URL provided</p>
        <p class="no-url-help">
          Set the audio URL in the node's <strong>path</strong> field to display the audio player.
        </p>
      </div>
    </div>

    <!-- Description Content -->
    <div v-if="nodeContent" class="audio-description">
      <div class="description-header">
        <h4>📝 Description</h4>
      </div>
      <div class="description-content" v-html="formattedContent"></div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner-border spinner-border-sm" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <span class="loading-text">Loading audio...</span>
    </div>

    <!-- Error State -->
    <div v-if="audioError" class="error-state">
      <div class="error-icon">❌</div>
      <div class="error-text"><strong>Audio Error:</strong> {{ audioError }}</div>
    </div>

    <!-- Audio Portfolio Selector Modal -->
    <AudioPortfolioModal
      :isVisible="showPortfolioModal"
      @close="closePortfolioModal"
      @audio-selected="handleAudioSelected"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import AudioPortfolioModal from '@/components/AudioPortfolioModal.vue'

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
const audioPlayer = ref(null)
const audioDuration = ref(0)
const audioFileSize = ref(null)
const audioType = ref(null)
const isLoading = ref(false)
const audioError = ref('')

// Portfolio modal state
const showPortfolioModal = ref(false)

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

      // Special handling for width and height - ensure units are added if missing
      if (k === 'width' || k === 'height') {
        // If the value is just a number, add px
        if (/^\d+(\.\d+)?$/.test(v)) {
          return `${k}:${v}px`
        }
        // If it already has units or is a percentage, keep as is
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

// Computed properties
const audioTitle = computed(() => {
  return props.node.label || 'Audio Player'
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

const audioUrl = computed(() => {
  return props.node.path || null
})

const hasValidAudioUrl = computed(() => {
  return audioUrl.value && isValidAudioUrl(audioUrl.value)
})

const hasInvalidUrl = computed(() => {
  return audioUrl.value && !isValidAudioUrl(audioUrl.value)
})

const nodeTypeClass = computed(() => {
  return 'node-type-audio'
})

const nodeTypeDisplay = computed(() => {
  return 'Audio Player'
})

// Methods
const isValidAudioUrl = (url) => {
  if (!url) return false

  // Check for common audio file extensions
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.mp4', '.webm']
  const hasAudioExtension = audioExtensions.some((ext) => url.toLowerCase().includes(ext))

  // Check for valid URL format
  const urlPattern = /^https?:\/\/.+/
  const isValidUrl = urlPattern.test(url)

  return (
    isValidUrl &&
    (hasAudioExtension || url.includes('audio') || url.includes('r2.cloudflarestorage.com'))
  )
}

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return 'Unknown'

  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
}

const openInNewTab = () => {
  if (audioUrl.value) {
    window.open(audioUrl.value, '_blank')
  }
}

const downloadAudio = () => {
  if (audioUrl.value) {
    const link = document.createElement('a')
    link.href = audioUrl.value
    link.download = audioTitle.value || 'audio-file'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

// Portfolio modal methods
const openPortfolioModal = () => {
  console.log('🎤 Opening audio portfolio modal')
  showPortfolioModal.value = true
}

const closePortfolioModal = () => {
  console.log('🎤 Closing audio portfolio modal')
  showPortfolioModal.value = false
}

const handleAudioSelected = (audioData) => {
  console.log('🎤 Audio selected from portfolio:', audioData)

  // AudioPortfolioModal emits { url, label, info }
  if (audioData && audioData.url) {
    const updatedNode = {
      ...props.node,
      path: audioData.url,
      label: audioData.label || 'Selected Audio',
      info: audioData.info || 'Audio selected from portfolio',
    }

    console.log('🎤 Updating node with audio URL:', updatedNode.path)
    emit('node-updated', updatedNode)
  }

  closePortfolioModal()
}

const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this audio node?')) {
    emit('node-deleted', props.node.id)
  }
}

// Audio event handlers
const onAudioLoaded = () => {
  if (audioPlayer.value) {
    audioDuration.value = audioPlayer.value.duration
    audioError.value = ''
    console.log('Audio loaded successfully:', audioTitle.value)
  }
}

const onAudioError = (event) => {
  console.error('Audio error:', event)
  audioError.value =
    'Failed to load audio file. Please check the URL and ensure the file is accessible.'
  isLoading.value = false
}

const onAudioPlay = () => {
  console.log('Audio started playing:', audioTitle.value)
}

const onAudioPause = () => {
  console.log('Audio paused:', audioTitle.value)
}

const onAudioEnded = () => {
  console.log('Audio playback ended:', audioTitle.value)
}

const onAudioLoadStart = () => {
  isLoading.value = true
  audioError.value = ''
}

// Lifecycle
onMounted(() => {
  console.log('GNewAudioNode mounted:', audioTitle.value)

  // Try to extract file info from URL if available
  if (audioUrl.value) {
    const urlParts = audioUrl.value.split('/')
    const fileName = urlParts[urlParts.length - 1]

    // Try to determine audio type from file extension
    if (fileName.includes('.')) {
      const extension = fileName.split('.').pop().toLowerCase()
      audioType.value = extension
    }
  }
})

onUnmounted(() => {
  // Clean up audio player
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value.src = ''
  }
})
</script>

<style scoped>
.gnew-audio-node {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  position: relative;
}

.gnew-audio-node:hover {
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
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  flex-shrink: 0;
}

.node-title-row {
  margin-bottom: 15px;
}

.node-title-row .node-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: #2c3e50;
}

/* Audio Container */
.audio-container {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
}

.audio-player-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.audio-player {
  width: 100%;
  height: 40px;
  border-radius: 6px;
  outline: none;
}

.audio-player:focus {
  box-shadow: 0 0 0 2px rgba(40, 167, 69, 0.25);
}

.audio-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.audio-meta {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.audio-meta span {
  background: #ffffff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #6c757d;
  border: 1px solid #dee2e6;
}

.audio-controls-extra {
  display: flex;
  gap: 8px;
}

/* Invalid/No URL states */
.invalid-url-display,
.no-url-display {
  text-align: center;
  padding: 30px 20px;
  color: #6c757d;
}

.invalid-url-icon,
.no-url-icon {
  font-size: 3rem;
  margin-bottom: 10px;
}

.invalid-url-text,
.no-url-text {
  font-size: 1.1rem;
  margin-bottom: 8px;
}

.invalid-url-help,
.no-url-help {
  font-size: 0.9rem;
  color: #868e96;
  margin: 0;
}

/* Description */
.audio-description {
  margin-top: 15px;
}

.description-header {
  margin-bottom: 10px;
}

.description-header h4 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #495057;
}

.description-content {
  background: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 15px;
  line-height: 1.6;
}

/* Loading and Error states */
.loading-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  background: #e7f3ff;
  border: 1px solid #b8daff;
  border-radius: 6px;
  margin-top: 10px;
}

.loading-text {
  color: #004085;
  font-size: 0.9rem;
}

.error-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  margin-top: 10px;
}

.error-icon {
  font-size: 1.2rem;
}

.error-text {
  color: #721c24;
  font-size: 0.9rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .node-header {
    flex-direction: column;
    gap: 10px;
  }

  .node-controls {
    margin-left: 0;
    align-self: flex-start;
  }

  .audio-info {
    flex-direction: column;
    align-items: flex-start;
  }

  .audio-meta {
    flex-direction: column;
    gap: 8px;
  }
}

/* Formatted content styles - matching GNewDefaultNode */
.description-content :deep(.fancy-title) {
  font-weight: 600;
  margin: 15px 0;
  padding: 10px 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  text-align: center;
}

.description-content :deep(.fancy-quote) {
  background: #f8f9fa;
  border-left: 4px solid #007bff;
  padding: 15px 20px;
  margin: 15px 0;
  border-radius: 0 8px 8px 0;
  font-style: italic;
}

.description-content :deep(.fancy-quote cite) {
  display: block;
  margin-top: 10px;
  font-style: normal;
  font-weight: 600;
  color: #495057;
}

.description-content :deep(.work-note) {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
}

.description-content :deep(.work-note cite) {
  display: block;
  margin-top: 10px;
  font-style: normal;
  font-weight: 600;
  color: #856404;
}

.description-content :deep(.comment-block) {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
}

.description-content :deep(.comment-author) {
  font-weight: 600;
  color: #155724;
  margin-bottom: 8px;
}
</style>
