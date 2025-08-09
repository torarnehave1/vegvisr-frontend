<template>
  <div class="gnew-ad-manager-node" :class="nodeTypeClass">
    <!-- Node Header -->
    <div v-if="showControls && nodeTitle" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ nodeTitle }}</h3>
        <div class="node-type-badge-inline">📢 Advertisement Manager</div>
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

    <!-- Advertisement Manager Interface -->
    <div class="advertisement-manager-content">
      <div class="manager-header">
        <div class="manager-icon">📢</div>
        <div class="manager-info">
          <h4>Advertisement Manager</h4>
          <p class="manager-description">Create and manage advertisements with [FANCY] elements</p>
        </div>
      </div>

      <!-- Quick Create -->
      <div class="quick-create-section">
        <div class="quick-create-header">
          <h5>➕ Create New Advertisement</h5>
          <button @click="addNewAd" class="btn btn-sm btn-success">+ Add Advertisement</button>
        </div>
      </div>

      <!-- Advertisements List -->
      <div v-if="advertisements.length > 0" class="advertisements-list">
        <h5>📋 Current Advertisements</h5>

        <div v-for="(ad, index) in advertisements" :key="ad.id || index" class="advertisement-item">
          <div class="ad-header">
            <div class="ad-status-badge" :class="'status-' + ad.status">{{ ad.status }}</div>
            <div class="ad-controls">
              <button @click="saveAd(ad)" class="btn btn-xs btn-primary" :disabled="ad.saving">
                {{ ad.saving ? '💾 Saving...' : '💾 Save' }}
              </button>
              <button @click="deleteAd(index)" class="btn btn-xs btn-danger">🗑️</button>
              <span v-if="ad.saveStatus === 'saved'" class="ad-save-status saved" title="Saved"
                >✓ Saved</span
              >
              <span
                v-else-if="ad.saveStatus === 'error'"
                class="ad-save-status error"
                :title="ad.errorMessage"
                >⚠️ Error</span
              >
            </div>
          </div>

          <!-- Inline Editor -->
          <div class="ad-editor">
            <div class="form-row">
              <div class="form-group">
                <label>Campaign Title:</label>
                <input
                  v-model="ad.title"
                  type="text"
                  class="form-control"
                  placeholder="Enter title..."
                  @input="onFieldInput(ad)"
                />
              </div>
              <div class="form-group">
                <label>Budget ($):</label>
                <input
                  v-model.number="ad.budget"
                  type="number"
                  class="form-control"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <!-- Content Editor with FANCY support -->
            <div class="form-group">
              <label>Advertisement Content:</label>
              <div class="content-editor-enhanced">
                <textarea
                  v-model="ad.content"
                  class="form-control content-textarea"
                  placeholder="Enter content... Use [FANCY] elements for rich formatting!"
                  rows="4"
                  @input="onFieldInput(ad)"
                ></textarea>
                <div class="content-tools">
                  <button
                    @click="insertFancyTemplate(index)"
                    class="btn btn-xs btn-outline-primary"
                  >
                    ✨ Add FANCY
                  </button>
                  <button @click="insertImage(index)" class="btn btn-xs btn-outline-secondary">
                    🖼️ Add Image
                  </button>
                </div>
              </div>
              <p v-if="ad.validationError" class="validation-error">{{ ad.validationError }}</p>
              <small class="form-text text-muted">
                💡 Tip: Use [FANCY] elements for styled content. Example: [FANCY | font-size: 2em;
                color: #007bff; text-align: center]Your Title[END FANCY]
              </small>
            </div>

            <!-- Slide Editor for Multi-Slide Ads -->
            <div
              v-if="isAdReel(ad)"
              class="slide-editor-section"
              :key="`slides-${index}-${ad.content?.split('---').length || 0}-${reactivityTrigger}`"
            >
              <div class="slide-editor-header">
                <label>🎭 Slide Editor (Reel Mode)</label>
                <small class="text-muted">Edit individual slides and their images</small>
              </div>
              <div class="slides-list">
                <div
                  v-for="(slide, slideIndex) in getAdSlides(ad)"
                  :key="`slide-${index}-${slideIndex}-${reactivityTrigger}-${slide.content?.substring(0, 20) || 'empty'}`"
                  class="slide-item"
                >
                  <div class="slide-header">
                    <span class="slide-number">Slide {{ slideIndex + 1 }}</span>
                    <div class="slide-controls">
                      <button
                        @click="insertImage(index, slideIndex)"
                        class="btn btn-xs btn-outline-primary"
                        title="Change image for this slide"
                      >
                        🖼️ Change Image
                      </button>
                    </div>
                  </div>
                  <div class="slide-preview">
                    <div
                      class="slide-content-preview"
                      :key="`preview-${index}-${slideIndex}-${reactivityTrigger}-${slide.content?.length || 0}`"
                    >
                      <GNewDefaultNode :node="{ info: slide.content }" :showControls="false" />
                    </div>
                    <div v-if="slide.backgroundImage" class="slide-image-info">
                      <small class="text-muted">Background: {{ slide.backgroundImage }}</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Additional Fields -->
            <div class="form-row">
              <div class="form-group">
                <label>Target Audience:</label>
                <input
                  v-model="ad.target_audience"
                  type="text"
                  class="form-control"
                  placeholder="Describe audience..."
                />
              </div>
              <div class="form-group">
                <label>Aspect Ratio:</label>
                <select v-model="ad.aspect_ratio" class="form-control">
                  <option value="default">Default</option>
                  <option value="instagram-square">Instagram Square (1:1)</option>
                  <option value="facebook-feed">Facebook Feed (1.91:1)</option>
                  <option value="web-leaderboard">Web Leaderboard (8.1:1)</option>
                  <option value="web-banner">Web Banner (7.8:1)</option>
                  <option value="hero-banner">Hero Banner (16:9)</option>
                  <option value="medium-rectangle">Medium Rectangle (1.2:1)</option>
                  <option value="vegvisr-node">Vegvisr Node (2:1)</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Status:</label>
                <select v-model="ad.status" class="form-control">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>

            <!-- Live Preview -->
            <div v-if="ad.content" class="ad-preview">
              <label>Live Preview:</label>
              <div class="preview-banner" :class="getPreviewClass(ad)">
                <div class="preview-header">
                  <span class="preview-title">{{ ad.title || 'Advertisement Title' }}</span>
                  <span class="preview-sponsored">Sponsored</span>
                </div>
                <div class="preview-content">
                  <GNewDefaultNode :node="{ info: ad.content }" :showControls="false" />
                </div>
                <div
                  v-if="ad.aspect_ratio && ad.aspect_ratio !== 'default'"
                  class="preview-aspect-info"
                >
                  📐 {{ getAspectRatioLabel(ad.aspect_ratio) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-advertisements">
        <div class="empty-icon">📢</div>
        <p>No advertisements created yet</p>
        <p class="empty-hint">Click "Add Advertisement" above to create your first advertisement</p>
      </div>

      <!-- Actions -->
      <div class="manager-actions">
        <div class="left-actions">
          <label class="autosave-toggle">
            <input type="checkbox" v-model="autosaveEnabled" />
            <span>Autosave</span>
          </label>
        </div>
        <div class="right-actions">
          <button @click="refreshAds" class="btn btn-sm btn-outline-secondary">🔄 Refresh</button>
        </div>
      </div>
    </div>

    <!-- ImageSelector Modal -->
    <ImageSelector
      :isOpen="showImageSelector"
      :currentImageUrl="'https://via.placeholder.com/400x200?text=Select+Image'"
      :currentImageAlt="'Advertisement Image'"
      :imageType="'Advertisement'"
      :imageContext="currentImageContext"
      @close="closeImageSelector"
      @image-replaced="handleImageSelected"
    />

    <!-- Local Toast Notifications -->
    <div class="toast-container">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">
        <span class="toast-message">{{ t.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import GNewDefaultNode from '@/components/GNewNodes/GNewDefaultNode.vue'
import ImageSelector from '@/components/ImageSelector.vue'
import { parseAdSlides, replaceSlideImage, serializeAdSlides } from '@/utils/adContentParser'

// Props
const props = defineProps({
  node: { type: Object, required: true },
  graphData: { type: Object, default: () => ({ nodes: [], edges: [] }) },
  showControls: { type: Boolean, default: true },
  isPreview: { type: Boolean, default: false },
  graphId: { type: String, default: '' },
})

// Emits
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Store
const knowledgeGraphStore = useKnowledgeGraphStore()

// State
const advertisements = ref([])
const showImageSelector = ref(false)
const currentImageContext = ref('')
const currentAdIndex = ref(null)
const currentSlideIndex = ref(null)
const toasts = ref([])
const autosaveEnabled = ref(false)
const debounceTimers = new WeakMap()
const slideEditingMode = ref(false)
const reactivityTrigger = ref(0) // Force reactivity updates

// Computed
const nodeTitle = computed(() => props.node.label || 'Advertisement Manager')
const nodeTypeClass = computed(() => `node-type-${props.node.type || 'advertisement_manager'}`)
const knowledgeGraphId = computed(() => {
  if (props.graphId) return props.graphId
  if (knowledgeGraphStore.currentGraphId) return knowledgeGraphStore.currentGraphId
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('graphId') || urlParams.get('id')
})

// Parse slides for each ad (reactive computed)
const getAdSlides = (ad) => {
  // Include reactivityTrigger to force re-computation
  reactivityTrigger.value
  if (!ad.content) return []
  return parseAdSlides(ad.content)
}

// Check if ad has multiple slides (is a reel)
const isAdReel = (ad) => {
  // Include reactivityTrigger to force re-computation
  reactivityTrigger.value
  return getAdSlides(ad).length > 1
}

// Force reactivity update
const forceReactivityUpdate = () => {
  reactivityTrigger.value++
}

// Trigger global ad refresh event for viewers
const triggerAdRefreshEvent = () => {
  // Use localStorage event to communicate with other components/tabs
  const refreshData = {
    timestamp: Date.now(),
    graphId: knowledgeGraphId.value,
    action: 'ad_updated',
  }
  localStorage.setItem('adRefreshTrigger', JSON.stringify(refreshData))
  console.log('🔄 Triggered ad refresh event for graph:', knowledgeGraphId.value)
}

// Helper functions
const getPreviewClass = (ad) => {
  const classes = []
  if (ad.aspect_ratio && ad.aspect_ratio !== 'default') {
    classes.push(`preview-aspect-${ad.aspect_ratio}`)
  }
  return classes.join(' ')
}

const getAspectRatioLabel = (aspectRatio) => {
  const labels = {
    'instagram-square': 'Instagram Square (1:1)',
    'facebook-feed': 'Facebook Feed (1.91:1)',
    'web-leaderboard': 'Web Leaderboard (8.1:1)',
    'web-banner': 'Web Banner (7.8:1)',
    'hero-banner': 'Hero Banner (16:9)',
    'medium-rectangle': 'Medium Rectangle (1.2:1)',
    'vegvisr-node': 'Vegvisr Node (2:1)',
  }
  return labels[aspectRatio] || aspectRatio
}

// Methods
const editNode = () => emit('node-updated', props.node)
const deleteNode = () => emit('node-deleted', props.node)

const addNewAd = () => {
  advertisements.value.push({
    id: null,
    title: '',
    content: '',
    target_audience: '',
    budget: 0,
    status: 'draft',
    aspect_ratio: 'default',
    saving: false,
    saveStatus: null,
    errorMessage: '',
    validationError: '',
  })
}

const saveAd = async (ad) => {
  if (!ad.title || !ad.content) {
    ad.validationError = 'Please fill in title and content before saving.'
    showToast('Please fill in title and content', 'warning')
    return
  }

  ad.saving = true
  ad.validationError = ''
  ad.saveStatus = null
  ad.errorMessage = ''
  try {
    const payload = {
      knowledge_graph_id: knowledgeGraphId.value,
      title: ad.title,
      content: ad.content,
      ad_type: 'banner',
      target_audience: ad.target_audience,
      budget: ad.budget,
      status: ad.status,
      aspect_ratio: ad.aspect_ratio || 'default',
    }

    const url = ad.id
      ? `https://advertisement-worker.torarnehave.workers.dev/api/advertisements/${ad.id}`
      : 'https://advertisement-worker.torarnehave.workers.dev/api/advertisements'

    const response = await fetch(url, {
      method: ad.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      const result = await response.json()
      if (!ad.id && result.id) ad.id = result.id
      ad.saveStatus = 'saved'
      showToast('Advertisement saved', 'success')

      // Trigger ad refresh in viewers
      triggerAdRefreshEvent()

      // Clear the saved badge after a short delay
      setTimeout(() => {
        ad.saveStatus = null
      }, 2500)
    } else {
      const error = await response.json()
      ad.saveStatus = 'error'
      ad.errorMessage = error.error || 'Unknown error'
      showToast(`Failed to save: ${ad.errorMessage}`, 'error')
    }
  } catch (error) {
    console.error('Save error:', error)
    ad.saveStatus = 'error'
    ad.errorMessage = error?.message || 'Failed to save advertisement'
    showToast(ad.errorMessage, 'error')
  } finally {
    ad.saving = false
  }
}

const deleteAd = async (index) => {
  const ad = advertisements.value[index]
  if (!confirm(`Delete "${ad.title}"?`)) return

  if (ad.id) {
    try {
      await fetch(
        `https://advertisement-worker.torarnehave.workers.dev/api/advertisements/${ad.id}`,
        { method: 'DELETE' },
      )
      // Trigger ad refresh in viewers after successful delete
      triggerAdRefreshEvent()
    } catch (error) {
      console.error('Delete error:', error)
    }
  }
  advertisements.value.splice(index, 1)
}

const insertFancyTemplate = (index) => {
  const template = `[FANCY | font-size: 4.5em; color: lightblue; background-image: url('https://vegvisr.imgix.net/FANCYIMG.png'); text-align: center]
Your fancy content here
[END FANCY]`

  console.log('✨ Inserting FANCY template for ad index:', index)
  console.log('📄 Template being inserted:', template)

  const ad = advertisements.value[index]

  if (ad.content) {
    ad.content += '\n\n' + template
  } else {
    ad.content = template
  }

  console.log('📝 Advertisement content after template insertion:', ad.content)
}

const insertImage = (index, slideIndex = null) => {
  currentAdIndex.value = index
  currentSlideIndex.value = slideIndex
  currentImageContext.value =
    slideIndex !== null ? `Advertisement Image - Slide ${slideIndex + 1}` : 'Advertisement Image'
  showImageSelector.value = true
  console.log('🖼️ Opening ImageSelector for ad index:', index, 'slide index:', slideIndex)
}

const closeImageSelector = () => {
  console.log('🖼️ Closing ImageSelector')
  showImageSelector.value = false
  currentAdIndex.value = null
  currentSlideIndex.value = null
  currentImageContext.value = ''
}

const handleImageSelected = (imageData) => {
  console.log('🖼️ handleImageSelected called with:', imageData)
  console.log('📍 currentAdIndex.value:', currentAdIndex.value)
  console.log('📍 currentSlideIndex.value:', currentSlideIndex.value)

  if (currentAdIndex.value !== null && imageData.newUrl) {
    const ad = advertisements.value[currentAdIndex.value]
    console.log('📝 Advertisement before URL replacement:', ad)
    console.log('📄 Content before replacement:', ad.content)

    if (ad.content) {
      // If we're editing a specific slide, use the new slide-specific editor
      if (currentSlideIndex.value !== null) {
        console.log('🎯 Updating specific slide:', currentSlideIndex.value)
        try {
          const newContent = replaceSlideImage(
            ad.content,
            currentSlideIndex.value,
            imageData.newUrl,
          )
          ad.content = newContent

          // Force Vue to detect the change and update slide parsing
          advertisements.value = [...advertisements.value]
          forceReactivityUpdate()

          console.log('✅ Slide-specific URL replacement successful!')
          showToast(`Slide ${currentSlideIndex.value + 1} image updated`, 'success')
        } catch (error) {
          console.error('❌ Error updating slide:', error)
          showToast('Error updating slide image', 'error')
        }
      } else {
        // Fallback to old method for backward compatibility
        const originalContent = ad.content

        // Try replacing without quotes first
        ad.content = ad.content.replace(
          /https:\/\/vegvisr\.imgix\.net\/FANCYIMG\.png/g,
          imageData.newUrl,
        )
        console.log('🔄 After first replacement (no quotes):', ad.content)

        // Also replace the URL if it's wrapped in quotes
        ad.content = ad.content.replace(
          /'https:\/\/vegvisr\.imgix\.net\/FANCYIMG\.png'/g,
          `'${imageData.newUrl}'`,
        )
        console.log('🔄 After second replacement (with quotes):', ad.content)

        if (originalContent === ad.content) {
          console.warn('⚠️ No URL replacement occurred! Original content:', originalContent)
          console.warn('⚠️ Looking for pattern: https://vegvisr.imgix.net/FANCYIMG.png')
          console.warn("⚠️ Or pattern with quotes: 'https://vegvisr.imgix.net/FANCYIMG.png'")
        } else {
          console.log('✅ URL replacement successful!')
          showToast('Image updated', 'success')
        }
      }
    } else {
      console.warn('⚠️ No content found in advertisement')
    }
  } else {
    console.warn('⚠️ Missing currentAdIndex or newUrl:', {
      currentAdIndex: currentAdIndex.value,
      newUrl: imageData?.newUrl,
    })
  }

  closeImageSelector()
}

const refreshAds = async () => {
  if (!knowledgeGraphId.value) return
  try {
    const response = await fetch(
      `https://advertisement-worker.torarnehave.workers.dev/api/advertisements?knowledge_graph_id=${knowledgeGraphId.value}`,
    )
    if (response.ok) {
      const result = await response.json()
      const ads = Array.isArray(result) ? result : result.data || result.results || []
      advertisements.value = ads.map((ad) => ({
        ...ad,
        saving: false,
        // Ensure aspect_ratio field exists for existing ads
        aspect_ratio: ad.aspect_ratio || 'default',
      }))
    }
  } catch (error) {
    console.error('Fetch error:', error)
  }
}

onMounted(refreshAds)

// Simple toast system (local to this component)
const showToast = (message, type = 'success') => {
  const id = Date.now() + Math.random()
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 3000)
}

// Debounced autosave when toggled on
const onFieldInput = (ad) => {
  // Force reactivity update for slide detection
  forceReactivityUpdate()

  if (!autosaveEnabled.value) return
  // clear previous timer
  const existing = debounceTimers.get(ad)
  if (existing) clearTimeout(existing)
  const t = setTimeout(() => {
    if (ad.title && ad.content && !ad.saving) {
      saveAd(ad)
    }
  }, 800)
  debounceTimers.set(ad, t)
}

// Ctrl+S to save all ads with required fields
const onKeyDown = (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
    const candidates = advertisements.value.filter((ad) => !ad.saving && ad.title && ad.content)
    if (candidates.length === 0) {
      showToast('Nothing to save', 'warning')
      return
    }
    // Save sequentially to avoid spamming the API
    ;(async () => {
      for (const ad of candidates) {
        await saveAd(ad)
      }
    })()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.gnew-ad-manager-node {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e9ecef;
}

.node-title-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.node-title {
  margin: 0;
  color: #2c3e50;
  font-size: 1.4rem;
  font-weight: 600;
}

.node-type-badge-inline {
  background: linear-gradient(45deg, #007bff, #6610f2);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.8rem;
}

.node-controls {
  display: flex;
  gap: 8px;
}

.manager-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 25px;
  padding: 15px;
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border-radius: 8px;
  border-left: 4px solid #007bff;
}

.manager-icon {
  font-size: 2rem;
}

.manager-info h4 {
  margin: 0 0 5px 0;
  color: #2c3e50;
}

.manager-description {
  margin: 0;
  color: #6c757d;
  font-size: 0.9rem;
}

.quick-create-section {
  margin-bottom: 25px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.quick-create-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.quick-create-header h5 {
  margin: 0;
  color: #28a745;
}

.advertisements-list h5 {
  margin: 0 0 15px 0;
  color: #2c3e50;
}

.advertisement-item {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  margin-bottom: 20px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.ad-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  border-radius: 8px 8px 0 0;
}

.ad-status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-active {
  background: #d4edda;
  color: #155724;
}
.status-draft {
  background: #fff3cd;
  color: #856404;
}
.status-paused {
  background: #f8d7da;
  color: #721c24;
}

.ad-controls {
  display: flex;
  gap: 8px;
}

.ad-editor {
  padding: 15px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 150px;
  gap: 15px;
  margin-bottom: 15px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #2c3e50;
  font-size: 0.9rem;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: border-color 0.15s ease-in-out;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.content-textarea {
  font-family: Monaco, Menlo, monospace;
  font-size: 0.85rem;
  min-height: 100px;
  resize: vertical;
}

.content-tools {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.form-text {
  font-size: 0.8rem;
  color: #6c757d;
  margin-top: 5px;
}

.ad-preview {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #dee2e6;
}

.ad-preview label {
  display: block;
  margin-bottom: 10px;
  font-weight: 600;
  color: #2c3e50;
}

.preview-banner {
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.preview-title {
  font-weight: 600;
  color: #2c3e50;
}

.preview-sponsored {
  background: #6c757d;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
}

.empty-advertisements {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.empty-hint {
  font-size: 0.9rem;
  margin-top: 10px;
}

.manager-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 15px;
  border-top: 1px solid #e9ecef;
}

.autosave-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #2c3e50;
}

/* Button Styles */
.btn {
  display: inline-block;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-xs {
  padding: 4px 8px;
  font-size: 0.75rem;
}
.btn-sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.btn-primary {
  background: #007bff;
  border-color: #007bff;
  color: white;
}
.btn-primary:hover:not(:disabled) {
  background: #0056b3;
  border-color: #0056b3;
}

.btn-success {
  background: #28a745;
  border-color: #28a745;
  color: white;
}
.btn-success:hover:not(:disabled) {
  background: #218838;
  border-color: #218838;
}

.btn-danger {
  background: #dc3545;
  border-color: #dc3545;
  color: white;
}
.btn-danger:hover:not(:disabled) {
  background: #c82333;
  border-color: #c82333;
}

.btn-outline-primary {
  background: transparent;
  border-color: #007bff;
  color: #007bff;
}
.btn-outline-primary:hover:not(:disabled) {
  background: #007bff;
  color: white;
}

.btn-outline-secondary {
  background: transparent;
  border-color: #6c757d;
  color: #6c757d;
}
.btn-outline-secondary:hover:not(:disabled) {
  background: #6c757d;
  color: white;
}

.btn-outline-danger {
  background: transparent;
  border-color: #dc3545;
  color: #dc3545;
}
.btn-outline-danger:hover:not(:disabled) {
  background: #dc3545;
  color: white;
}

.ad-save-status {
  margin-left: 8px;
  font-size: 0.8rem;
}
.ad-save-status.saved {
  color: #198754;
}
.ad-save-status.error {
  color: #dc3545;
}

.validation-error {
  margin-top: 6px;
  color: #dc3545;
  font-size: 0.85rem;
}

/* Responsive */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  .node-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .quick-create-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .ad-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .content-tools {
    flex-direction: column;
  }
}

/* Preview Aspect Ratio Styles */
.preview-aspect-instagram-square {
  aspect-ratio: 1/1;
  max-width: 400px;
}

.preview-aspect-facebook-feed {
  aspect-ratio: 1.91/1;
  max-width: 600px;
}

.preview-aspect-web-leaderboard {
  aspect-ratio: 8.1/1;
  max-width: 728px;
  min-height: 90px;
}

.preview-aspect-web-banner {
  aspect-ratio: 7.8/1;
  max-width: 468px;
  min-height: 60px;
}

.preview-aspect-hero-banner {
  aspect-ratio: 16/9;
  max-width: 800px;
}

.preview-aspect-medium-rectangle {
  aspect-ratio: 1.2/1;
  max-width: 300px;
}

.preview-aspect-vegvisr-node {
  aspect-ratio: 2/1;
  max-width: 600px;
}

/* Slide Editor Styles */
.slide-editor-section {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.slide-editor-header {
  margin-bottom: 15px;
}

.slide-editor-header label {
  font-size: 1.1rem;
  font-weight: 600;
  color: #495057;
  display: block;
  margin-bottom: 4px;
}

.slides-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.slide-item {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  overflow: hidden;
}

.slide-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #f1f3f4;
  border-bottom: 1px solid #dee2e6;
}

.slide-number {
  font-weight: 600;
  color: #495057;
}

.slide-controls {
  display: flex;
  gap: 8px;
}

.slide-preview {
  padding: 15px;
}

.slide-content-preview {
  margin-bottom: 10px;
}

.slide-image-info {
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  word-break: break-all;
}

.preview-aspect-info {
  margin-top: 8px;
  padding: 4px 8px;
  background: #e9ecef;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #6c757d;
  text-align: center;
}

/* Toasts */
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 2000;
}
.toast {
  padding: 10px 14px;
  border-radius: 6px;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 180px;
}
.toast.success {
  background: #198754;
}
.toast.error {
  background: #dc3545;
}
.toast.warning {
  background: #ffc107;
  color: #212529;
}
.toast-message {
  font-size: 0.9rem;
}
</style>
