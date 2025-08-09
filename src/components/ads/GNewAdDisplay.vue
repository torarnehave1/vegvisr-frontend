<template>
  <div v-if="activeAdvertisements.length" class="advertisement-display">
    <div
      v-for="ad in activeAdvertisements"
      :key="`ad-${ad.id}`"
    >
      <GAdCarousel
        :title="ad.title"
        :aspect-ratio="ad.aspect_ratio"
        :position="position"
        :slides="getAdSlides(ad)"
        :autoplay="getAdSlides(ad).length > 1"
        @action="trackClick(ad)"
      >
        <template #default="{ slide }">
          <GNewDefaultNode
            :node="{ info: slide }"
            :showControls="false"
            class="ad-slide-content"
          />
        </template>
      </GAdCarousel>
    </div>
  </div>
  <div 
    v-else-if="!loading" 
    class="no-ads-message"
  >
    No advertisements to display.
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import GAdCarousel from './GAdCarousel.vue'
import GNewDefaultNode from '@/components/GNewNodes/GNewDefaultNode.vue'

const props = defineProps({
  knowledgeGraphId: { 
    type: String, 
    required: true 
  },
  position: { 
    type: String, 
    default: 'top' 
  },
  maxAds: { 
    type: Number, 
    default: 2 
  },
  ads: { 
    type: Array, 
    default: null 
  }
})

const advertisements = ref([])
const loading = ref(false)

const sourceAds = computed(() => 
  Array.isArray(props.ads) ? props.ads : advertisements.value
)

const activeAdvertisements = computed(() => {
  const filteredAds = sourceAds.value
    .filter(ad => String(ad?.status || '').toLowerCase() === 'active')
  return props.maxAds ? filteredAds.slice(0, props.maxAds) : filteredAds
})

const getAdSlides = (ad) => {
  if (!ad.content || typeof ad.content !== 'string') return []
  return ad.content
    .split(/\n\s*---\s*\n/g)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

const fetchAdvertisements = async () => {
  if (!props.knowledgeGraphId || Array.isArray(props.ads)) return
  
  loading.value = true
  try {
    const resp = await fetch(
      `https://advertisement-worker.torarnehave.workers.dev/api/advertisements?knowledge_graph_id=${props.knowledgeGraphId}`
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
    }
  } catch (error) {
    console.error('Failed to fetch advertisements:', error)
    advertisements.value = []
  } finally {
    loading.value = false
  }
}

const trackClick = (ad) => {
  fetch('https://advertisement-worker.torarnehave.workers.dev/api/track-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      advertisement_id: ad.id,
      knowledge_graph_id: props.knowledgeGraphId,
      timestamp: new Date().toISOString()
    })
  }).catch(error => {
    console.error('Failed to track click:', error)
  })
}

// Handle ad refresh events
const handleAdRefresh = (event) => {
  if (event.key === 'adRefreshTrigger' && event.newValue) {
    try {
      const refreshData = JSON.parse(event.newValue)
      if (refreshData.graphId === props.knowledgeGraphId) {
        if (!Array.isArray(props.ads)) {
          fetchAdvertisements()
        }
      }
    } catch (error) {
      console.error('Error handling ad refresh event:', error)
    }
  }
}

onMounted(() => {
  if (!Array.isArray(props.ads)) {
    fetchAdvertisements()
  }
  window.addEventListener('storage', handleAdRefresh)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleAdRefresh)
})
</script>

<style scoped>
.advertisement-display {
  width: 100%;
  margin: 0;
  padding: 0;
}

.no-ads-message {
  background: #ffebee;
  color: #c62828;
  padding: 10px;
  border-radius: 6px;
  text-align: center;
  margin: 20px 0;
}

.ad-slide-content {
  width: 100%;
  height: 100%;
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

.ad-slide-content :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
