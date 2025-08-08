<template>
  <div v-if="advertisements.length > 0" class="advertisement-display">
    <div 
      v-for="ad in activeAdvertisements" 
      :key="ad.id" 
      class="advertisement-banner"
      :class="getBannerClass(ad)"
    >
      <div class="banner-content">
        <div class="banner-header">
          <span class="banner-title">{{ ad.title }}</span>
          <span class="banner-sponsored">Sponsored</span>
        </div>
        <!-- Rich content with [FANCY] element support -->
        <div class="banner-content-rich">
          <GNewDefaultNode 
            :node="{ info: ad.content }" 
            :showControls="false" 
            class="banner-fancy-content"
          />
        </div>
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
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import GNewDefaultNode from '@/components/GNewNodes/GNewDefaultNode.vue'

// Props
const props = defineProps({
  knowledgeGraphId: {
    type: String,
    required: true,
  },
  position: {
    type: String,
    default: 'top', // 'top', 'bottom', 'sidebar', 'between-nodes'
  },
  maxAds: {
    type: Number,
    default: 2,
  },
})

// State
const advertisements = ref([])
const loading = ref(false)

// Computed
const activeAdvertisements = computed(() => {
  return advertisements.value
    .filter(ad => ad.status === 'active')
    .slice(0, props.maxAds)
})

// Methods
const fetchAdvertisements = async () => {
  if (!props.knowledgeGraphId) return

  loading.value = true
  try {
    const response = await fetch(
      `https://advertisement-worker.torarnehave.workers.dev/api/advertisements?knowledge_graph_id=${props.knowledgeGraphId}`,
    )
    
    if (response.ok) {
      const result = await response.json()
      
      // Handle different response formats
      if (Array.isArray(result)) {
        advertisements.value = result
      } else if (result.data && Array.isArray(result.data)) {
        advertisements.value = result.data
      } else if (result.results && Array.isArray(result.results)) {
        advertisements.value = result.results
      } else {
        console.warn('Unexpected response format for advertisements:', result)
        advertisements.value = []
      }
    }
  } catch (error) {
    console.error('Failed to fetch advertisements:', error)
  } finally {
    loading.value = false
  }
}

const getBannerClass = (ad) => {
  return {
    'banner-premium': ad.budget > 100,
    'banner-standard': ad.budget <= 100,
    [`banner-${props.position}`]: true,
    // Add aspect ratio class if specified
    [`banner-aspect-${ad.aspect_ratio}`]: ad.aspect_ratio && ad.aspect_ratio !== 'default'
  }
}

const trackClick = (ad) => {
  console.log('📊 Advertisement clicked:', ad.title)
  
  // Track click analytics
  // You could send this to your analytics API
  fetch('https://advertisement-worker.torarnehave.workers.dev/api/track-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      advertisement_id: ad.id,
      knowledge_graph_id: props.knowledgeGraphId,
      timestamp: new Date().toISOString(),
    }),
  }).catch(console.error)
  
  // For now, just show the content
  alert(`Advertisement: ${ad.title}\n\n${ad.content}`)
}

const reportAd = (ad) => {
  const reason = prompt('Why are you reporting this advertisement?')
  if (reason) {
    console.log('📋 Advertisement reported:', ad.title, 'Reason:', reason)
    alert('Thank you for your feedback. This advertisement has been reported.')
  }
}

// Lifecycle
onMounted(() => {
  fetchAdvertisements()
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
  color: white;
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

.banner-fancy-content .fancy-title {
  margin: 0 0 10px 0 !important;
}

.banner-text {
  color: #495057;
  line-height: 1.5;
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
  color: white;
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

/* Position-specific styles */
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

/* Aspect Ratio styles */
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

/* Responsive */
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
