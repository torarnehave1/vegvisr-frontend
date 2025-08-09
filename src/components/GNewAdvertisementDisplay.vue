<template>
  <div class="advertisement-display" v-if="activeAdvertisements.length">
    <div
      v-for="ad in activeAdvertisements"
      :key="`ad-${ad.id}-${ad.content?.length || 0}-${splitSlides(ad.content).length}`"
      class="advertisement-banner"
      :class="getBannerClass(ad)"
    >
      <div class="banner-content">
        <div class="banner-header">
          <span class="banner-title">{{ ad.title }}</span>
          <span class="banner-sponsored">Sponsored</span>
        </div>

        <!-- Phase A: Manual carousel when multiple sections are present -->
        <template v-if="splitSlides(ad.content).length <= 1">
          <div class="banner-content-rich" :key="`single-${ad.id}-${ad.content?.length || 0}`">
            <GNewDefaultNode
              :node="{ info: ad.content }"
              :showControls="false"
              class="banner-fancy-content"
            />
          </div>
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
              <div class="banner-content-rich">
                <GNewDefaultNode
                  :node="{ info: slide }"
                  :showControls="false"
                  class="banner-fancy-content"
                />
              </div>
            </template>
          </GAdReel>
        </template>

        <div v-if="ad.target_audience" class="banner-audience">
          <small>Target: {{ ad.target_audience }}</small>
        </div>
        <div class="banner-actions">
          <button @click="trackClick(ad)" class="banner-cta">Learn More</button>
          <button @click="reportAd(ad)" class="banner-report" title="Report Ad">⚠️</button>
        </div>
      </div>
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
}
.advertisement-banner {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}
.advertisement-banner:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
.banner-premium {
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  border-color: #f39c12;
}
.banner-standard {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}
.banner-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.banner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.banner-title {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1.1rem;
}
.banner-sponsored {
  background: #6c757d;
  color: #fff;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}
.banner-content-rich {
  flex: 1;
}
.banner-fancy-content {
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
}
.banner-audience {
  color: #6c757d;
  font-style: italic;
}
.banner-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.banner-cta {
  background: #007bff;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}
.banner-cta:hover {
  background: #0056b3;
}
.banner-report {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 5px;
  border-radius: 3px;
  transition: color 0.2s ease;
}
.banner-report:hover {
  color: #dc3545;
}
.banner-top {
  border-left: 4px solid #007bff;
}
.banner-bottom {
  border-left: 4px solid #28a745;
}
.banner-sidebar {
  border-left: 4px solid #6f42c1;
}
.banner-between-nodes {
  border-left: 4px solid #fd7e14;
  margin: 30px 0;
}
.banner-aspect-instagram-square {
  aspect-ratio: 1/1;
  max-width: 400px;
}
.banner-aspect-facebook-feed {
  aspect-ratio: 1.91/1;
  max-width: 600px;
}
.banner-aspect-web-leaderboard {
  aspect-ratio: 8.1/1;
  max-width: 728px;
  min-height: 90px;
}
.banner-aspect-web-banner {
  aspect-ratio: 7.8/1;
  max-width: 468px;
  min-height: 60px;
}
.banner-aspect-hero-banner {
  aspect-ratio: 16/9;
  max-width: 800px;
}
.banner-aspect-medium-rectangle {
  aspect-ratio: 1.2/1;
  max-width: 300px;
}
.banner-aspect-vegvisr-node {
  aspect-ratio: 2/1;
  max-width: 500px;
}
@media (max-width: 768px) {
  .advertisement-banner {
    padding: 12px;
  }
  .banner-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  .banner-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
transition: color 0.2s ease;
