<template>
  <div class="gnew-youtube-live-node">
    <div v-if="title" class="node-title-row">
      <h3 class="node-title">{{ title }}</h3>
    </div>

    <div class="video-container">
      <div class="video-embed-wrapper">
        <iframe
          :src="embedUrl"
          title="YouTube live stream"
          frameborder="0"
          allow="autoplay; encrypted-media"
          allowfullscreen
          class="video-embed"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const DEFAULT_CHANNEL_ID = 'UCxXZApz9QooXSnvTGMhTgbQ'

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
})

const title = computed(() => props.node?.label || 'YouTube Live')

const extractChannelId = (value = '') => {
  if (!value) return ''
  if (value.includes('<iframe')) {
    const srcMatch = value.match(/src=["']([^"']+)["']/i)
    if (srcMatch && srcMatch[1]) {
      return extractChannelId(srcMatch[1])
    }
  }
  if (value.includes('channel=')) {
    try {
      const url = new URL(value)
      return url.searchParams.get('channel') || ''
    } catch {
      const channelMatch = value.match(/channel=([^&]+)/)
      return channelMatch ? channelMatch[1] : ''
    }
  }
  const channelMatch = value.match(/UC[a-zA-Z0-9_-]{10,}/)
  if (channelMatch) return channelMatch[0]
  return value.trim()
}

const embedUrl = computed(() => {
  const raw = props.node?.info || props.node?.url || ''
  const channelId = extractChannelId(raw) || DEFAULT_CHANNEL_ID
  return `https://www.youtube.com/embed/live_stream?channel=${channelId}`
})
</script>

<style scoped>
.gnew-youtube-live-node {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-title-row {
  display: flex;
  align-items: center;
}

.node-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.video-container {
  border-radius: 16px;
  overflow: hidden;
  background: #0b1220;
}

.video-embed-wrapper {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
}

.video-embed {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
