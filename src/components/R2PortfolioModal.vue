<template>
  <!-- R2 Image Selection Modal -->
  <div
    v-if="isOpen"
    class="modal d-block"
    tabindex="-1"
    style="background-color: rgba(0, 0, 0, 0.5)"
  >
    <div class="modal-dialog modal-xl" style="max-width: 1000px">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Select Portfolio Image</h5>
          <button type="button" class="btn-close" @click="closeModal" aria-label="Close"></button>
        </div>
        <div class="modal-body" style="max-height: 80vh; overflow-y: auto">
          <!-- Quality Controls Section -->
          <div class="quality-controls mb-4 p-3 border rounded">
            <h6 class="mb-3">Image Quality & Size Settings</h6>

            <!-- Quality Presets -->
            <div class="mb-3">
              <label class="form-label fw-bold">Quality Preset:</label>
              <div class="btn-group w-100" role="group">
                <input
                  type="radio"
                  class="btn-check"
                  name="qualityPreset"
                  id="ultraFast"
                  value="ultraFast"
                  v-model="outputSettings.preset"
                  @change="updateImagePreview"
                />
                <label class="btn btn-outline-success" for="ultraFast">
                  <i class="bi bi-lightning-fill"></i> Ultra Fast
                </label>

                <input
                  type="radio"
                  class="btn-check"
                  name="qualityPreset"
                  id="balanced"
                  value="balanced"
                  v-model="outputSettings.preset"
                  @change="updateImagePreview"
                />
                <label class="btn btn-outline-primary" for="balanced">
                  <i class="bi bi-speedometer2"></i> Balanced
                </label>

                <input
                  type="radio"
                  class="btn-check"
                  name="qualityPreset"
                  id="highQuality"
                  value="highQuality"
                  v-model="outputSettings.preset"
                  @change="updateImagePreview"
                />
                <label class="btn btn-outline-warning" for="highQuality">
                  <i class="bi bi-gem"></i> High Quality
                </label>
              </div>
            </div>

            <!-- Custom Size Controls -->
            <div class="row mb-3">
              <div class="col-12 mb-2">
                <div class="form-check">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="lockAspectRatio"
                    v-model="outputSettings.lockAspectRatio"
                  />
                  <label class="form-check-label fw-bold" for="lockAspectRatio">
                    <i class="bi bi-lock-fill" v-if="outputSettings.lockAspectRatio"></i>
                    <i class="bi bi-unlock-fill" v-else></i>
                    Lock Aspect Ratio ({{ aspectRatio }})
                  </label>
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label fw-bold">Width:</label>
                <div class="input-group">
                  <input
                    type="range"
                    class="form-range"
                    min="50"
                    max="2000"
                    v-model="outputSettings.width"
                    @input="onWidthChange"
                  />
                  <input
                    type="number"
                    class="form-control"
                    style="max-width: 80px"
                    v-model="outputSettings.width"
                    @input="onWidthChange"
                    min="50"
                    max="2000"
                  />
                  <span class="input-group-text">px</span>
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label fw-bold">Height:</label>
                <div class="input-group">
                  <input
                    type="range"
                    class="form-range"
                    min="50"
                    max="2000"
                    v-model="outputSettings.height"
                    @input="onHeightChange"
                  />
                  <input
                    type="number"
                    class="form-control"
                    style="max-width: 80px"
                    v-model="outputSettings.height"
                    @input="onHeightChange"
                    min="50"
                    max="2000"
                  />
                  <span class="input-group-text">px</span>
                </div>
              </div>
            </div>

            <!-- Preview URL Display -->
            <div class="mb-3">
              <label class="form-label fw-bold">Preview URL Parameters (for grid):</label>
              <div class="alert alert-info p-2">
                <small class="font-monospace">{{ previewUrlParams }}</small>
              </div>
            </div>

            <!-- Output URL Display -->
            <div class="mb-3">
              <label class="form-label fw-bold">Output URL Parameters (for selected image):</label>
              <div class="alert alert-success p-2">
                <small class="font-monospace">{{ outputUrlParams }}</small>
              </div>
            </div>

            <!-- Reset Button -->
            <button class="btn btn-sm btn-outline-secondary" @click="resetQualitySettings">
              <i class="bi bi-arrow-clockwise"></i> Reset to Defaults
            </button>
          </div>

          <!-- Filters Section -->
          <div class="filters-section mb-3">
            <!-- Search -->
            <div class="filter-group">
              <label class="filter-label">Search:</label>
              <input
                v-model="searchQuery"
                type="text"
                class="filter-input"
                placeholder="Search images..."
              />
            </div>

            <!-- Year Filter -->
            <div class="filter-group">
              <label class="filter-label">Year:</label>
              <select v-model="selectedYear" class="filter-select">
                <option value="">All Years</option>
                <option v-for="year in availableYears" :key="year" :value="year">
                  {{ year }}
                </option>
              </select>
            </div>

            <!-- Sort Order -->
            <div class="filter-group">
              <label class="filter-label">Sort:</label>
              <select v-model="sortOrder" class="filter-select">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="size">Size (Largest)</option>
                <option value="size-asc">Size (Smallest)</option>
              </select>
            </div>

            <!-- Results Count -->
            <div class="filter-results">
              <span class="results-count">{{ filteredImages.length }} of {{ r2Images.length }} images</span>
            </div>
          </div>

          <!-- Image Grid -->
          <div class="portfolio-grid">
            <div
              v-for="img in filteredImages"
              :key="img.key"
              class="portfolio-card clickable"
              @click="selectR2Image(img)"
            >
              <img
                :src="getOptimizedImageUrl(img.url)"
                :alt="img.key"
                class="portfolio-thumb"
                loading="lazy"
              />
              <div class="portfolio-caption">{{ img.key }}</div>
              <div v-if="getImageDate(img)" class="portfolio-date">{{ formatDate(getImageDate(img)) }}</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div class="me-auto">
            <small class="text-muted">
              <strong>{{ filteredImages.length }}</strong> of <strong>{{ r2Images.length }}</strong> images • Quality:
              <strong>{{ outputSettings.preset }}</strong> • Size:
              <strong>{{ outputSettings.width }}×{{ outputSettings.height }}</strong>
            </small>
          </div>
          <button type="button" class="btn btn-secondary" @click="closeModal">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'image-selected'])

// Reactive data
const r2Images = ref([])
const searchQuery = ref('')
const selectedYear = ref('')
const sortOrder = ref('newest')

// Preview settings for modal display (small/fast)
const previewSettings = ref({
  preset: 'balanced',
  width: 150,
  height: 94,
  lockAspectRatio: true,
  originalAspectRatio: 150 / 94,
})

// Output settings for final selected image (full size)
const outputSettings = ref({
  preset: 'highQuality',
  width: 1920,
  height: 1080,
  lockAspectRatio: true,
  originalAspectRatio: 1920 / 1080,
})

// Helper function to extract date from image key (filename)
const getImageDate = (img) => {
  if (!img || !img.key) return null

  // Try to extract timestamp from filename (e.g., "1743532765979.png")
  const timestampMatch = img.key.match(/^(\d{13})/)
  if (timestampMatch) {
    const timestamp = parseInt(timestampMatch[1])
    if (!isNaN(timestamp)) {
      return new Date(timestamp)
    }
  }

  // Try shorter timestamp (10 digits - seconds)
  const shortTimestampMatch = img.key.match(/^(\d{10})/)
  if (shortTimestampMatch) {
    const timestamp = parseInt(shortTimestampMatch[1]) * 1000
    if (!isNaN(timestamp)) {
      return new Date(timestamp)
    }
  }

  // If image has uploaded/lastModified metadata
  if (img.uploaded) return new Date(img.uploaded)
  if (img.lastModified) return new Date(img.lastModified)

  return null
}

// Computed properties
const availableYears = computed(() => {
  const years = new Set()
  r2Images.value.forEach((img) => {
    const date = getImageDate(img)
    if (date && !isNaN(date.getTime())) {
      years.add(date.getFullYear())
    }
  })
  return Array.from(years).sort((a, b) => b - a) // Sort descending (newest first)
})

const filteredImages = computed(() => {
  let result = r2Images.value

  // Filter by search query
  if (searchQuery.value.trim()) {
    result = result.filter((img) =>
      (img.key || '').toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }

  // Filter by year
  if (selectedYear.value) {
    result = result.filter((img) => {
      const date = getImageDate(img)
      if (!date) return false
      return date.getFullYear() === parseInt(selectedYear.value)
    })
  }

  // Sort results
  result = [...result].sort((a, b) => {
    const dateA = getImageDate(a)
    const dateB = getImageDate(b)

    switch (sortOrder.value) {
      case 'newest':
        return (dateB?.getTime() || 0) - (dateA?.getTime() || 0)
      case 'oldest':
        return (dateA?.getTime() || 0) - (dateB?.getTime() || 0)
      case 'name':
        return (a.key || '').localeCompare(b.key || '')
      case 'name-desc':
        return (b.key || '').localeCompare(a.key || '')
      case 'size':
        return (b.size || 0) - (a.size || 0)
      case 'size-asc':
        return (a.size || 0) - (b.size || 0)
      default:
        return 0
    }
  })

  return result
})

const aspectRatio = computed(() => {
  const ratio = outputSettings.value.width / outputSettings.value.height
  return `${Math.round(ratio * 47)}:47`
})

const previewUrlParams = computed(() => {
  const settings = previewSettings.value
  const presets = {
    ultraFast: `w=${settings.width}&h=${settings.height}&fit=crop&auto=format,compress&q=30`,
    balanced: `w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance,compress&q=65&dpr=2`,
    highQuality: `w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance&q=85&sharp=1&sat=5`,
  }
  return presets[settings.preset] || presets.balanced
})

const outputUrlParams = computed(() => {
  const settings = outputSettings.value
  const presets = {
    ultraFast: `w=${settings.width}&h=${settings.height}&fit=crop&auto=format,compress&q=30`,
    balanced: `w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance,compress&q=65&dpr=2`,
    highQuality: `w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance&q=85&sharp=1&sat=5`,
  }
  return presets[settings.preset] || presets.balanced
})

// Methods
const getOptimizedImageUrl = (baseUrl) => {
  if (!baseUrl) return baseUrl

  const settings = previewSettings.value
  const presets = {
    ultraFast: `?w=${settings.width}&h=${settings.height}&fit=crop&auto=format,compress&q=30`,
    balanced: `?w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance,compress&q=65&dpr=2`,
    highQuality: `?w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance&q=85&sharp=1&sat=5`,
  }

  const params = presets[settings.preset] || presets.balanced

  if (baseUrl.includes('?')) {
    return baseUrl.split('?')[0] + params
  }
  return baseUrl + params
}

const getOutputImageUrl = (baseUrl) => {
  if (!baseUrl) return baseUrl

  const settings = outputSettings.value
  const presets = {
    ultraFast: `?w=${settings.width}&h=${settings.height}&fit=crop&auto=format,compress&q=30`,
    balanced: `?w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance,compress&q=65&dpr=2`,
    highQuality: `?w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance&q=85&sharp=1&sat=5`,
  }

  const params = presets[settings.preset] || presets.balanced

  if (baseUrl.includes('?')) {
    return baseUrl.split('?')[0] + params
  }
  return baseUrl + params
}

const fetchR2Images = async () => {
  try {
    console.log('🖼️ Fetching R2 portfolio images...')
    const res = await fetch('https://api.vegvisr.org/list-r2-images?size=small')

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }

    const data = await res.json()
    r2Images.value = data.images || []
    console.log(`✅ Successfully loaded ${r2Images.value.length} portfolio images`)
  } catch (error) {
    console.error('❌ Error fetching R2 images:', error)
    r2Images.value = []
  }
}

const selectR2Image = (img) => {
  const optimizedUrl = getOutputImageUrl(img.url)
  console.log('📁 Portfolio image selected:', img.key, optimizedUrl)

  emit('image-selected', {
    key: img.key,
    url: img.url,
    optimizedUrl: optimizedUrl,
    size: img.size,
  })
}

const closeModal = () => {
  resetFilters()
  emit('close')
}

const updateImagePreview = () => {
  // Force reactivity update when preset changes
  previewSettings.value = { ...previewSettings.value }
}

const onWidthChange = () => {
  if (outputSettings.value.lockAspectRatio) {
    const newHeight = Math.round(
      outputSettings.value.width / outputSettings.value.originalAspectRatio,
    )
    outputSettings.value.height = Math.max(50, Math.min(2000, newHeight))
  }
}

const onHeightChange = () => {
  if (outputSettings.value.lockAspectRatio) {
    const newWidth = Math.round(
      outputSettings.value.height * outputSettings.value.originalAspectRatio,
    )
    outputSettings.value.width = Math.max(50, Math.min(2000, newWidth))
  }
}

const resetQualitySettings = () => {
  previewSettings.value = {
    preset: 'balanced',
    width: 150,
    height: 94,
    lockAspectRatio: true,
    originalAspectRatio: 150 / 94,
  }
  outputSettings.value = {
    preset: 'highQuality',
    width: 1920,
    height: 1080,
    lockAspectRatio: true,
    originalAspectRatio: 1920 / 1080,
  }
}

const formatDate = (date) => {
  if (!date || isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedYear.value = ''
  sortOrder.value = 'newest'
}

// Watch for modal opening to fetch images
watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue) {
      fetchR2Images()
    }
  },
)

// Fetch images on mount if modal is already open
onMounted(() => {
  if (props.isOpen) {
    fetchR2Images()
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

.quality-controls {
  background-color: #f8f9fa;
}

/* Filters Section */
.filters-section {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 13px;
  font-weight: 500;
  color: #495057;
  white-space: nowrap;
}

.filter-input {
  padding: 6px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  background: white;
  color: #495057;
  min-width: 150px;
}

.filter-input:focus {
  outline: none;
  border-color: #6f42c1;
  box-shadow: 0 0 0 2px rgba(111, 66, 193, 0.15);
}

.filter-select {
  padding: 6px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  background: white;
  color: #495057;
  cursor: pointer;
  min-width: 120px;
}

.filter-select:focus {
  outline: none;
  border-color: #6f42c1;
  box-shadow: 0 0 0 2px rgba(111, 66, 193, 0.15);
}

.filter-results {
  margin-left: auto;
}

.results-count {
  font-size: 13px;
  color: #6c757d;
  font-weight: 500;
}

.portfolio-date {
  font-size: 0.75em;
  color: #6c757d;
  padding: 2px 8px 6px;
  text-align: center;
}
</style>
