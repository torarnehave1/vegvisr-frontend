<template>
  <div class="gnew-cf-live-node">
    <!-- Header with live indicator -->
    <div class="node-header">
      <div class="node-title-section">
        <div class="live-indicator" :class="statusClass">
          <span class="live-dot"></span>
          <span class="live-label">{{ statusLabel }}</span>
        </div>
        <h3 class="node-title">{{ title }}</h3>
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

    <!-- Video Container -->
    <div class="video-container">
      <div v-if="embedUrl" class="video-embed-wrapper">
        <iframe
          :src="embedUrl"
          :title="title"
          frameborder="0"
          allow="autoplay; encrypted-media"
          allowfullscreen
          class="video-embed"
        ></iframe>
      </div>

      <!-- Waiting state (no active stream yet) -->
      <div v-else-if="liveInputId && !embedUrl" class="video-waiting-state">
        <div class="waiting-icon">📡</div>
        <p>Waiting for stream to start...</p>
        <small class="text-muted">Use OBS or another RTMP client to start streaming</small>
      </div>

      <!-- No config -->
      <div v-else class="video-empty-state">
        <div class="empty-icon">📡</div>
        <p>No live stream configured</p>
        <button v-if="showControls && !isPreview" @click="editNode" class="btn btn-sm btn-primary mt-2">
          Configure Stream
        </button>
      </div>
    </div>

    <!-- Stream Info (RTMP details for admins) -->
    <div v-if="showControls && rtmpsUrl" class="stream-info">
      <details>
        <summary class="stream-info-toggle">Stream Credentials</summary>
        <div class="stream-credentials">
          <div class="credential-row">
            <label>RTMPS URL:</label>
            <code>{{ rtmpsUrl }}</code>
          </div>
          <div v-if="streamKey" class="credential-row">
            <label>Stream Key:</label>
            <code>{{ streamKey }}</code>
          </div>
          <div v-if="srtUrl" class="credential-row">
            <label>SRT URL:</label>
            <code>{{ srtUrl }}</code>
          </div>
        </div>
      </details>
    </div>

    <!-- Description -->
    <div v-if="node.info && !isIframeContent" class="stream-description">
      <div v-html="formattedInfo"></div>
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

const title = computed(() => props.node.label || 'Live Stream')

const meta = computed(() => props.node.metadata || {})

const streamStatus = computed(() => meta.value.status || 'waiting')

const statusClass = computed(() => ({
  'is-live': streamStatus.value === 'streaming',
  'is-waiting': streamStatus.value === 'waiting',
  'is-ended': streamStatus.value === 'ended',
}))

const statusLabel = computed(() => {
  switch (streamStatus.value) {
    case 'streaming': return 'LIVE'
    case 'ended': return 'ENDED'
    default: return 'WAITING'
  }
})

const liveInputId = computed(() => meta.value.liveInputId || null)

const rtmpsUrl = computed(() => meta.value.rtmpsUrl || null)
const streamKey = computed(() => meta.value.streamKey || null)
const srtUrl = computed(() => meta.value.srtUrl || null)

const isIframeContent = computed(() => {
  const info = props.node.info || ''
  return info.trim().startsWith('<iframe') || info.includes('cloudflarestream.com')
})

const formattedInfo = computed(() => {
  if (!props.node.info || isIframeContent.value) return ''
  return marked(props.node.info, { breaks: true })
})

// Extract video ID for the playback iframe
const extractVideoId = (raw) => {
  if (!raw) return null
  const val = raw.trim()
  if (/^[a-f0-9]{32}$/.test(val)) return val
  const srcMatch = val.match(/src=["']([^"']+)["']/)
  const url = srcMatch ? srcMatch[1] : val
  const cfMatch = url.match(/cloudflarestream\.com\/([a-f0-9]{32})/)
  if (cfMatch) return cfMatch[1]
  const vdMatch = url.match(/videodelivery\.net\/([a-f0-9]{32})/)
  if (vdMatch) return vdMatch[1]
  return null
}

const videoId = computed(() => {
  // path field holds the playback URL or video ID
  const fromPath = extractVideoId(props.node.path)
  if (fromPath) return fromPath
  if (meta.value.videoId) return meta.value.videoId
  const fromInfo = extractVideoId(props.node.info)
  if (fromInfo) return fromInfo
  return null
})

const embedUrl = computed(() => {
  if (!videoId.value) return null
  return `https://${CUSTOMER_SUBDOMAIN}/${videoId.value}/iframe`
})

const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this live stream node?')) {
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-cf-live-node {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.gnew-cf-live-node:hover {
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

.node-controls {
  display: flex;
  gap: 8px;
  margin-left: 15px;
}

/* Live indicator */
.live-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
}

.live-indicator.is-live {
  background: #ef4444;
  color: white;
}

.live-indicator.is-waiting {
  background: #f59e0b;
  color: white;
}

.live-indicator.is-ended {
  background: #6b7280;
  color: white;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.is-live .live-dot {
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}

/* Video */
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

.video-waiting-state,
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

.waiting-icon,
.empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  opacity: 0.6;
}

.video-waiting-state p {
  color: #f59e0b;
  font-weight: 600;
}

/* Stream credentials */
.stream-info {
  margin-top: 12px;
}

.stream-info-toggle {
  cursor: pointer;
  font-size: 0.85rem;
  color: #6c757d;
  user-select: none;
}

.stream-info-toggle:hover {
  color: #495057;
}

.stream-credentials {
  margin-top: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 0.8rem;
}

.credential-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}

.credential-row:last-child {
  margin-bottom: 0;
}

.credential-row label {
  font-weight: 600;
  color: #495057;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.credential-row code {
  background: #e9ecef;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  word-break: break-all;
}

/* Description */
.stream-description {
  color: #495057;
  line-height: 1.6;
  font-size: 0.95rem;
  margin-top: 12px;
}

.stream-description :deep(p) {
  margin-bottom: 0.5em;
}

@media (max-width: 768px) {
  .gnew-cf-live-node {
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
