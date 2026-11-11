<template>
  <div class="gnew-album-video-node">
    <div v-if="showControls && videoTitle" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ videoTitle }}</h3>
        <div class="node-type-badge-inline">
          Album Video
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

    <div v-else-if="videoTitle" class="node-title-row">
      <h3 class="node-title">{{ videoTitle }}</h3>
    </div>

    <div class="video-container">
      <div v-if="videoUrl" class="video-player-wrapper">
        <video
          :key="videoUrl"
          :src="videoUrl"
          :title="videoTitle"
          class="video-player"
          controls
          preload="metadata"
          playsinline
          @error="playbackFailed = true"
          @loadedmetadata="playbackFailed = false"
        ></video>
        <div v-if="playbackFailed" class="video-error">
          This video cannot be played in this browser. iPhone .mov files often only play in Safari —
          <a :href="videoUrl" target="_blank" rel="noopener">open the file directly</a>.
        </div>
      </div>

      <div v-else class="video-empty-state">
        <div class="empty-icon">🎬</div>
        <p>No album video configured</p>
        <small class="text-muted">Set the node path to the URL of a video in a Photos album (mp4, m4v, webm or mov).</small>
        <button v-if="showControls && !isPreview" @click="editNode" class="btn btn-sm btn-primary mt-2">
          Add Video
        </button>
      </div>
    </div>

    <div v-if="node.info" class="video-description">
      <div v-html="formattedInfo"></div>
    </div>

    <div v-if="videoUrl && showControls" class="video-source">
      <small class="text-muted">
        Source path: <code>{{ sourcePath }}</code>
      </small>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
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

const videoTitle = computed(() => props.node.label || 'Album Video')

const sourcePath = computed(() => String(props.node.path || '').trim())

// An album video is always a full public URL: the `url` that the Photos album list returns.
// It is never rebuilt from a key, because a World with its own storage serves from another host.
const normalizeVideoUrl = (rawValue) => {
  const trimmed = String(rawValue || '').trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : null
}

const playbackFailed = ref(false)

const videoUrl = computed(() => normalizeVideoUrl(sourcePath.value))

watch(videoUrl, () => {
  playbackFailed.value = false
})

const formattedInfo = computed(() => {
  if (!props.node.info) return ''
  return marked(props.node.info, { breaks: true })
})

const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this album video node?')) {
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-album-video-node {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.gnew-album-video-node:hover {
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
  background: #0d9488;
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

.video-player-wrapper {
  border-radius: 10px;
  overflow: hidden;
  background: #0f172a;
}

.video-player {
  display: block;
  width: 100%;
  max-height: 70vh;
  background: #000;
}

.video-error {
  padding: 12px 16px;
  background: #fff3cd;
  color: #664d03;
  font-size: 0.9rem;
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
  margin-bottom: 10px;
  opacity: 0.6;
}

.video-description {
  margin-top: 15px;
  color: #495057;
}

.video-description :deep(p:last-child) {
  margin-bottom: 0;
}

.video-source {
  margin-top: 12px;
}

code {
  word-break: break-all;
}

@media (max-width: 768px) {
  .gnew-album-video-node {
    padding: 16px;
  }

  .node-header {
    flex-direction: column;
    gap: 12px;
  }

  .node-title-section {
    flex-wrap: wrap;
  }

  .node-controls {
    margin-left: 0;
  }
}
</style>
