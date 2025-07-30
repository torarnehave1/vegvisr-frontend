<template>
  <div class="portfolio-grid">
    <div 
      v-for="img in images" 
      :key="img.key" 
      class="portfolio-card clickable"
      @click="selectImage(img)"
    >
      <img :src="getOptimizedImageUrl(img.url)" :alt="img.key" class="portfolio-thumb" />
      <div class="portfolio-caption">{{ img.key }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// Define emits for parent component communication
const emit = defineEmits(['image-selected'])

const images = ref([])

// Image quality settings for optimization (copied from GraphPortfolio)
const imageQualitySettings = ref({
  preset: 'balanced',
  width: 150,
  height: 94,
  lockAspectRatio: true,
  originalAspectRatio: 150 / 94,
})

// Image optimization function (copied from GraphPortfolio)
const getOptimizedImageUrl = (baseUrl) => {
  if (!baseUrl) return baseUrl

  const settings = imageQualitySettings.value
  const presets = {
    ultraFast: `?w=${settings.width}&h=${settings.height}&fit=crop&auto=format,compress&q=30`,
    balanced: `?w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance,compress&q=65&dpr=2`,
    highQuality: `?w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance&q=85&sharp=1&sat=5`,
  }

  const params = presets[settings.preset] || presets.balanced

  // If URL already has parameters, replace them; otherwise add them
  if (baseUrl.includes('?')) {
    return baseUrl.split('?')[0] + params
  }
  return baseUrl + params
}

// Handle image selection
const selectImage = (img) => {
  const optimizedUrl = getOptimizedImageUrl(img.url)
  console.log('📁 Portfolio image selected:', img.key, optimizedUrl)
  
  emit('image-selected', {
    key: img.key,
    url: img.url,
    optimizedUrl: optimizedUrl,
    size: img.size
  })
}

onMounted(async () => {
  try {
    console.log('🖼️ Fetching R2 portfolio images...')
    const res = await fetch('https://api.vegvisr.org/list-r2-images?size=small')

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }

    const data = await res.json()
    images.value = data.images || []
    console.log(`✅ Successfully loaded ${images.value.length} portfolio images`)
  } catch (error) {
    console.error('❌ Error fetching R2 images:', error)
    images.value = []
  }
})
</script>

<style scoped>
.portfolio-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: flex-start;
}
.portfolio-card {
  width: 180px;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.2s ease;
}

.portfolio-card.clickable {
  cursor: pointer;
}

.portfolio-card.clickable:hover {
  border-color: #6f42c1;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(111, 66, 193, 0.3);
}
.portfolio-thumb {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}
.portfolio-caption {
  font-size: 0.9em;
  padding: 8px;
  text-align: center;
  word-break: break-all;
}
</style>
