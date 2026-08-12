<template>
  <div class="gnew-instagram-node">
    <!-- Node Header - follows GNewVideoNode pattern -->
    <div v-if="showControls && postTitle" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ postTitle }}</h3>
        <div class="node-type-badge-inline">Instagram</div>
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

    <div v-else-if="postTitle" class="node-title-row">
      <h3 class="node-title">{{ postTitle }}</h3>
    </div>

    <div class="instagram-container">
      <!-- Embed -->
      <div v-if="embedUrl" class="instagram-embed-wrapper">
        <iframe
          :src="embedUrl"
          :title="postTitle"
          frameborder="0"
          scrolling="no"
          allowtransparency="true"
          allow="encrypted-media; picture-in-picture; web-share"
          allowfullscreen
          class="instagram-embed"
          :style="{ height: embedHeight + 'px' }"
        ></iframe>
      </div>

      <!-- No usable URL -->
      <div v-else class="instagram-error-state">
        <div class="error-icon">📷</div>
        <p>No Instagram URL set</p>
        <small class="text-muted d-block mt-1">
          Add a post or reel permalink to this node's <code>path</code>, for example
          <code>https://www.instagram.com/reel/ABC123/</code>
        </small>
        <button
          v-if="showControls && !isPreview"
          @click="editNode"
          class="btn btn-sm btn-outline-primary mt-2"
        >
          Edit Node
        </button>
      </div>

      <!-- Source link: the embed is a live third-party dependency, so always
           surface the canonical permalink alongside it. -->
      <div v-if="sourceUrl" class="instagram-source">
        <a :href="sourceUrl" target="_blank" rel="noopener noreferrer">View on Instagram ↗</a>
      </div>
    </div>

    <!-- Description -->
    <div v-if="formattedContent" class="node-content" v-html="formattedContent"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'

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

const DEFAULT_HEIGHT = 640

// Matches the fulltext element form, so a label written for the inline element
// still resolves here. Mirrors how GNewVideoNode accepts the GraphViewer format.
const ELEMENT_RE = /!\[INSTAGRAM\s+([^\]]*)\]([\s\S]*?)\[END\s+INSTAGRAM\]/

// Accepts /p/, /reel/, /reels/ and /tv/ permalinks.
const PERMALINK_RE = /instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/

// Normalise any Instagram permalink to its /embed/ endpoint. Share params such
// as ?igsi=... break that route, so the query string is dropped.
const toEmbedUrl = (rawUrl) => {
  if (!rawUrl) return null
  const trimmed = String(rawUrl).trim()
  if (!PERMALINK_RE.test(trimmed)) return null

  const base = trimmed.split('?')[0].replace(/\/+$/, '')
  return base.endsWith('/embed') ? `${base}/` : `${base}/embed/`
}

// Source of truth order: path first (canonical), then the element form in label.
const rawUrl = computed(() => {
  if (props.node.path && PERMALINK_RE.test(props.node.path)) {
    return props.node.path.trim()
  }
  const label = props.node.label || ''
  const match = label.match(ELEMENT_RE)
  if (match) {
    const srcMatch = /src=(\S+)/.exec(match[1])
    if (srcMatch) return srcMatch[1].trim()
  }
  if (PERMALINK_RE.test(label)) return label.trim()
  return null
})

const embedUrl = computed(() => toEmbedUrl(rawUrl.value))

// Canonical (non-embed) permalink for the "View on Instagram" link.
const sourceUrl = computed(() => {
  if (!rawUrl.value) return null
  const match = rawUrl.value.match(PERMALINK_RE)
  if (!match) return null
  return `https://www.instagram.com/${match[1]}/${match[2]}/`
})

const postTitle = computed(() => {
  const label = props.node.label || ''
  const match = label.match(ELEMENT_RE)
  if (match && match[2].trim()) return match[2].trim()

  // A label that is only a bare URL is not a title.
  if (label && !PERMALINK_RE.test(label)) return label
  return 'Instagram Post'
})

// Instagram embeds reflow — height tracks caption length and chrome rather than
// the media ratio — so height is explicit rather than an aspect-ratio.
const embedHeight = computed(() => {
  const raw = props.node.imageHeight
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HEIGHT
})

const formattedContent = computed(() => {
  const info = props.node.info || ''
  if (!info) return ''
  try {
    return marked.parse(info)
  } catch (error) {
    console.error('Error parsing Instagram node content:', error)
    return info
  }
})

const editNode = () => emit('node-updated', props.node)
const deleteNode = () => emit('node-deleted', props.node)
</script>

<style scoped>
.gnew-instagram-node {
  margin-bottom: 20px;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.node-title-section {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.node-title {
  margin: 0;
  font-size: 1.15rem;
}

.node-type-badge-inline {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 10px;
  color: #fff;
  background: linear-gradient(45deg, #f09433, #dc2743, #bc1888);
}

.node-controls {
  display: flex;
  gap: 6px;
}

.instagram-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.instagram-embed-wrapper {
  width: 100%;
  max-width: 540px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  background: #fff;
}

.instagram-embed {
  width: 100%;
  border: 0;
  display: block;
}

.instagram-error-state {
  width: 100%;
  max-width: 540px;
  padding: 24px;
  text-align: center;
  border: 1px dashed #ccc;
  border-radius: 8px;
  background: #fafafa;
}

.error-icon {
  font-size: 2rem;
  margin-bottom: 6px;
}

.instagram-source {
  margin-top: 8px;
  font-size: 0.85rem;
}

.node-content {
  margin-top: 12px;
}
</style>
