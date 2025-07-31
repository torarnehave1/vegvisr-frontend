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

          <!-- Image Grid -->
          <div class="portfolio-grid">
            <div
              v-for="img in r2Images"
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
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div class="me-auto">
            <small class="text-muted">
              <strong>{{ r2Images.length }}</strong> images • Quality:
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

// Computed properties
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
</style>
