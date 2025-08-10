<template>
  <div class="advertisement-display" v-if="activeAdvertisements.length">
    <div
      v-for="ad in activeAdvertisements"
      :key="`ad-${ad.id}-${ad.content?.length || 0}-${splitSlides(ad.content).length}`"
      class="advertisement-item"
    >
      <!-- Simplified rendering just like in the manager -->
      <template v-if="splitSlides(ad.content).length <= 1">
        <GNewDefaultNode
          :node="{ info: ad.content }"
          :showControls="false"
          class="advertisement-content"
        />
      </template>
      <template v-else>
        <GAdReel
          :key="`reel-${ad.id}-${splitSlides(ad.content).length}-${ad.content?.length || 0}`"
          :slides="splitSlides(ad.content)"
          :indicators="true"
          :arrows="true"
          :loop="true"
          labelPrefix="Ad slide"
          ariaLabel="Advertisement carousel"
        >
          <template #default="{ slide }">
            <GNewDefaultNode
              :node="{ info: slide }"
              :showControls="false"
              class="advertisement-content"
            />
          </template>
        </GAdReel>
      </template>
    </div>
  </div>
  <div v-else style="background: #ffebee; color: #c62828; padding: 10px; border-radius: 6px">
    No advertisements to display.
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import GNewDefaultNode from '@/components/GNewNodes/GNewDefaultNode.vue'
import GAdReel from '@/components/ads/GAdReel.vue'

const props = defineProps({
  knowledgeGraphId: { type: String, required: true },
  position: { type: String, default: 'top' },
  maxAds: { type: Number, default: 2 },
  ads: { type: Array, default: null },
})

const advertisements = ref([])
const loading = ref(false)

const sourceAds = computed(() => (Array.isArray(props.ads) ? props.ads : advertisements.value))
const activeAdvertisements = computed(() => {
  if (Array.isArray(props.ads)) return sourceAds.value.slice(0, props.maxAds)
  return sourceAds.value
    .filter((a) => String(a?.status || '').toLowerCase() === 'active')
    .slice(0, props.maxAds)
})

const splitSlides = (content) => {
  if (!content || typeof content !== 'string') return []
  const parts = content.split(/\n\s*---\s*\n/g)
  return parts.map((s) => s.trim()).filter((s) => s.length > 0)
}

const fetchAdvertisements = async () => {
  if (!props.knowledgeGraphId) return
  loading.value = true
  try {
    const resp = await fetch(
      `https://advertisement-worker.torarnehave.workers.dev/api/advertisements?knowledge_graph_id=${props.knowledgeGraphId}`,
    )
    if (resp.ok) {
      const result = await resp.json()
      advertisements.value = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.results)
            ? result.results
            : []
    } else {
      advertisements.value = []
    }
  } catch (e) {
    advertisements.value = []
  } finally {
    loading.value = false
  }
}

const getBannerClass = (ad) => ({
  'banner-premium': ad.budget > 100,
  'banner-standard': ad.budget <= 100,
  [`banner-${props.position}`]: true,
  [`banner-aspect-${ad.aspect_ratio}`]: ad.aspect_ratio && ad.aspect_ratio !== 'default',
})

const trackClick = (ad) => {
  fetch('https://advertisement-worker.torarnehave.workers.dev/api/track-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      advertisement_id: ad.id,
      knowledge_graph_id: props.knowledgeGraphId,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {})
}

const reportAd = (ad) => {
  const reason = prompt('Why are you reporting this advertisement?')
  if (reason) alert('Thank you for your feedback. This advertisement has been reported.')
}

onMounted(() => {
  if (!Array.isArray(props.ads)) fetchAdvertisements()

  // Listen for ad refresh events from Ad Manager
  const handleAdRefresh = (event) => {
    if (event.key === 'adRefreshTrigger' && event.newValue) {
      try {
        const refreshData = JSON.parse(event.newValue)
        console.log('🔄 GNewAdvertisementDisplay received ad refresh event:', refreshData)

        // Check if the refresh is for the current graph
        if (refreshData.graphId === props.knowledgeGraphId) {
          console.log(
            '🔄 Refreshing ads in GNewAdvertisementDisplay for graph:',
            props.knowledgeGraphId,
          )
          // Only refresh if we're fetching our own ads (not using injected ads)
          if (!Array.isArray(props.ads)) {
            fetchAdvertisements()
          }
        }
      } catch (error) {
        console.error('❌ Error parsing ad refresh event in GNewAdvertisementDisplay:', error)
      }
    }
  }

  window.addEventListener('storage', handleAdRefresh)

  // Cleanup on unmount
  onUnmounted(() => {
    window.removeEventListener('storage', handleAdRefresh)
  })
})
</script>

<style scoped>
.advertisement-display {
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center; /* Center the entire advertisement display */
  width: 100%;
}

.advertisement-item {
  margin-bottom: 20px;
  max-width: 800px; /* Limit width so image is centered but not full container width */
  width: 100%;
  position: relative; /* Enable positioning for carousel arrows */
}

/* Clean advertisement content styling - matching the manager */
.advertisement-content {
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
  width: 100%;
  position: relative; /* Enable positioning for carousel elements */
}

/* Style the node content to match manager display */
.advertisement-content .node-content {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative; /* Enable positioning for carousel arrows */
}

/* Style the fancy title to match manager display */
.advertisement-content .fancy-title {
  background-size: cover !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-height: 200px;
  border-radius: 8px; /* Add slight rounding for better appearance */
  width: 100%;
}

/* Override for custom width/height in advertisements */
.advertisement-content .fancy-title[style*='width'] {
  width: auto !important; /* Allow inline width to override default */
  max-width: none !important; /* Remove constraints when custom width is set */
}

.advertisement-content .fancy-title[style*='height'] {
  height: auto !important; /* Allow inline height to override default */
  min-height: auto !important; /* Remove constraints when custom height is set */
}

/* When both width and height are specified, respect them exactly */
.advertisement-content .fancy-title[style*='width'][style*='height'] {
  width: auto !important;
  height: auto !important;
  max-width: none !important;
  min-height: auto !important;
}

/* Carousel container styling */
.advertisement-item :deep(.carousel-container) {
  position: relative;
  width: 100%;
}

/* Carousel navigation arrows - overlay on image */
.advertisement-item :deep(.carousel-nav) {
  position: absolute !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  z-index: 10 !important;
  background: rgba(0, 0, 0, 0.5) !important;
  color: white !important;
  border: none !important;
  width: 40px !important;
  height: 40px !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  font-size: 18px !important;
  transition: background-color 0.2s ease !important;
}

.advertisement-item :deep(.carousel-nav:hover) {
  background: rgba(0, 0, 0, 0.8) !important;
}

.advertisement-item :deep(.carousel-nav.prev) {
  left: 10px !important;
}

.advertisement-item :deep(.carousel-nav.next) {
  right: 10px !important;
}

/* Carousel indicators - overlay at bottom */
.advertisement-item :deep(.carousel-indicators) {
  position: absolute !important;
  bottom: 15px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  z-index: 10 !important;
  display: flex !important;
  gap: 8px !important;
}

.advertisement-item :deep(.carousel-indicator) {
  width: 10px !important;
  height: 10px !important;
  border-radius: 50% !important;
  background: rgba(255, 255, 255, 0.5) !important;
  border: none !important;
  cursor: pointer !important;
  transition: background-color 0.2s ease !important;
}

.advertisement-item :deep(.carousel-indicator.active) {
  background: rgba(255, 255, 255, 1) !important;
}

/* Ensure carousel content also follows the same styling */
.advertisement-display .slide-content {
  width: 100%;
}
</style>
transition: color 0.2s ease;
