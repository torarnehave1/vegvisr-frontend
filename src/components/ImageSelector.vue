<template>
  <div v-if="isOpen" class="image-selector-modal">
    <div class="image-selector-content">
      <div class="image-selector-header">
        <h3>🖼️ Change Image</h3>
        <button class="image-selector-close" @click="closeModal" title="Close">&times;</button>
      </div>

      <div v-if="searchResults.length === 0" class="current-image-section">
        <h4>Current Image</h4>
        <div class="current-image-preview">
          <img :src="currentImageUrl" :alt="currentImageAlt" />
          <div class="image-info">
            <p><strong>Type:</strong> {{ imageType }}</p>
            <p><strong>Context:</strong> {{ imageContext }}</p>
          </div>
        </div>
      </div>

      <div class="search-section" :class="{ 'search-section-compact': searchResults.length > 0 }">
        <h4>🔍 Search New Images</h4>

        <!-- Clipboard Paste Area -->
        <div class="clipboard-paste-area" v-if="!pastedImage">
          <div class="paste-info">
            <span class="paste-icon">📋</span>
            <span class="paste-text">Or paste an image from clipboard (Ctrl+V)</span>
          </div>
        </div>

        <!-- Pasted Image Preview -->
        <div v-if="pastedImage" class="pasted-image-preview">
          <h5>📋 Pasted Image</h5>
          <div class="pasted-preview-container">
            <img :src="pastedImage.url" alt="Pasted image" class="pasted-preview-img" />
            <div class="pasted-actions">
              <button @click="usePastedImage" class="btn btn-primary btn-sm">Use This Image</button>
              <button @click="clearPastedImage" class="btn btn-secondary btn-sm">Clear</button>
            </div>
          </div>
        </div>

        <div class="search-controls">
          <input
            v-model="searchQuery"
            @keyup.enter="searchImages"
            class="search-input"
            placeholder="Enter search keywords (e.g., 'technology', 'nature', 'business')"
          />
          <button @click="searchImages" :disabled="searching" class="search-button">
            <span v-if="searching" class="spinner-sm"></span>
            {{ searching ? 'Searching...' : 'Search' }}
          </button>
        </div>
        <div class="quick-search-tags">
          <span>Quick searches:</span>
          <button
            v-for="tag in quickSearchTags"
            :key="tag"
            @click="quickSearch(tag)"
            class="quick-tag"
          >
            {{ tag }}
          </button>
        </div>
      </div>

      <div v-if="searchResults.length > 0" class="results-section">
        <div class="results-header">
          <h4>🎨 Search Results</h4>
          <div class="results-count">{{ searchResults.length }} professional images found</div>
        </div>
        <div class="image-grid">
          <div
            v-for="image in searchResults"
            :key="image.id"
            class="image-option"
            :class="{ selected: selectedImage?.id === image.id }"
            @click="selectImage(image)"
          >
            <img :src="image.url" :alt="image.alt" />
            <div class="image-overlay">
              <div class="image-info">
                <p class="photographer">📸 {{ image.photographer }}</p>
                <p class="image-size">{{ getImageDimensions(image) }}</p>
              </div>
              <div v-if="selectedImage?.id === image.id" class="selected-indicator">✓ Selected</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="searching || uploading" class="loading-section">
        <div class="loading-spinner"></div>
        <p v-if="searching">Searching Pexels for images...</p>
        <p v-if="uploading">📤 Uploading pasted image...</p>
      </div>

      <div v-if="error" class="error-section">
        <div class="error-message">
          <span class="error-icon">⚠️</span>
          {{ error }}
        </div>
      </div>

      <div class="image-selector-footer">
        <div class="selected-image-preview" v-if="selectedImage">
          <h5>Selected Image Preview</h5>
          <img :src="selectedImage.url" :alt="selectedImage.alt" class="preview-image" />
          <p class="preview-info">By {{ selectedImage.photographer }}</p>
        </div>

        <div v-else-if="searchResults.length > 0" class="replacement-info">
          <h5>Replacing {{ imageType }} Image</h5>
          <p class="replacement-context">{{ imageContext }}</p>
        </div>

        <div class="action-buttons">
          <button @click="closeModal" class="btn btn-secondary">Cancel</button>
          <button
            @click="replaceImage"
            :disabled="!selectedImage || replacing"
            class="btn btn-primary"
          >
            <span v-if="replacing" class="spinner-sm"></span>
            {{ replacing ? 'Replacing...' : 'Replace Image' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  currentImageUrl: {
    type: String,
    required: true,
  },
  currentImageAlt: {
    type: String,
    default: '',
  },
  imageType: {
    type: String,
    default: 'Unknown', // 'Header', 'Leftside', 'Rightside'
  },
  imageContext: {
    type: String,
    default: 'No context provided',
  },
  nodeContent: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'image-replaced'])

// State
const searchQuery = ref('')
const searchResults = ref([])
const selectedImage = ref(null)
const searching = ref(false)
const replacing = ref(false)
const error = ref('')
const pastedImage = ref(null)
const uploading = ref(false)

// Quick search suggestions based on image type
const quickSearchTags = computed(() => {
  const baseCategories = ['abstract', 'minimal', 'professional', 'modern']

  switch (props.imageType.toLowerCase()) {
    case 'header':
      return [...baseCategories, 'landscape', 'banner', 'wide', 'gradient']
    case 'leftside':
    case 'rightside':
      return [...baseCategories, 'concept', 'technology', 'business', 'creativity']
    default:
      return baseCategories
  }
})

// Methods
const searchImages = async () => {
  if (!searchQuery.value.trim()) return

  searching.value = true
  error.value = ''

  try {
    const response = await fetch('https://api.vegvisr.org/pexels-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery.value.trim(),
        count: 20,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to search images')
    }

    const data = await response.json()
    searchResults.value = data.images || []

    if (searchResults.value.length === 0) {
      error.value = 'No images found for this search. Try different keywords.'
    }
  } catch (err) {
    error.value = err.message || 'Error searching for images'
    console.error('Image search error:', err)
  } finally {
    searching.value = false
  }
}

const quickSearch = (tag) => {
  searchQuery.value = tag
  searchImages()
}

const selectImage = (image) => {
  selectedImage.value = image
}

const replaceImage = async () => {
  if (!selectedImage.value) return

  replacing.value = true

  try {
    emit('image-replaced', {
      oldUrl: props.currentImageUrl,
      newUrl: selectedImage.value.url,
      newAlt: selectedImage.value.alt,
      photographer: selectedImage.value.photographer,
      imageType: props.imageType,
    })

    closeModal()
  } catch (err) {
    error.value = 'Failed to replace image. Please try again.'
    console.error('Image replacement error:', err)
  } finally {
    replacing.value = false
  }
}

const closeModal = () => {
  searchQuery.value = ''
  searchResults.value = []
  selectedImage.value = null
  error.value = ''
  pastedImage.value = null
  uploading.value = false
  removePasteListener()
  emit('close')
}

const getImageDimensions = (image) => {
  // This would ideally come from the Pexels API response
  return 'Medium size' // Placeholder
}

const generateContextSearch = async () => {
  // Simple keyword extraction from content
  const words = props.nodeContent.toLowerCase().split(/\s+/)
  const relevantWords = words.filter(
    (word) =>
      word.length > 4 &&
      !['that', 'this', 'with', 'have', 'will', 'from', 'they', 'been'].includes(word),
  )

  if (relevantWords.length > 0) {
    searchQuery.value = relevantWords.slice(0, 3).join(' ')
  } else {
    searchQuery.value = 'abstract professional'
  }
}

// Clipboard paste functionality
const handlePaste = async (event) => {
  event.preventDefault()

  const items = event.clipboardData?.items
  if (!items) return

  for (let item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        await processPastedImage(file)
        break
      }
    }
  }
}

const processPastedImage = async (file) => {
  try {
    uploading.value = true
    error.value = ''

    // Create preview URL
    const previewUrl = URL.createObjectURL(file)

    // Upload to R2 bucket
    const formData = new FormData()
    formData.append('file', file)

    const uploadResponse = await fetch('https://api.vegvisr.org/upload', {
      method: 'POST',
      body: formData,
    })

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload pasted image')
    }

    const uploadData = await uploadResponse.json()

    // Set pasted image data
    pastedImage.value = {
      url: uploadData.url,
      previewUrl: previewUrl,
      alt: 'Pasted image',
      photographer: 'User uploaded',
      id: 'pasted-' + Date.now(),
    }

    // Clear any previous search results and selection
    searchResults.value = []
    selectedImage.value = null
  } catch (err) {
    error.value = 'Failed to process pasted image: ' + err.message
    console.error('Paste error:', err)
  } finally {
    uploading.value = false
  }
}

const usePastedImage = () => {
  if (pastedImage.value) {
    selectedImage.value = pastedImage.value
    replaceImage()
  }
}

const clearPastedImage = () => {
  if (pastedImage.value?.previewUrl) {
    URL.revokeObjectURL(pastedImage.value.previewUrl)
  }
  pastedImage.value = null
  error.value = ''
}

const addPasteListener = () => {
  document.addEventListener('paste', handlePaste)
}

const removePasteListener = () => {
  document.removeEventListener('paste', handlePaste)
}

// Initialize paste listener when modal opens
watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue) {
      addPasteListener()
      if (props.nodeContent) {
        // Generate initial search query based on content
        generateContextSearch()
      }
    } else {
      removePasteListener()
    }
  },
)
</script>

<style scoped>
.image-selector-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  backdrop-filter: blur(4px);
}

.image-selector-content {
  background: #fff;
  border-radius: 16px;
  width: 95%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.image-selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.image-selector-header h3 {
  margin: 0;
  font-size: 1.4rem;
  color: #333;
}

.image-selector-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: #888;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.image-selector-close:hover {
  background: #e9ecef;
  color: #333;
}

.current-image-section {
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.current-image-section h4 {
  margin: 0 0 15px 0;
  font-size: 1.1rem;
  color: #333;
}

.current-image-preview {
  display: flex;
  gap: 15px;
  align-items: center;
}

.current-image-preview img {
  width: 120px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #dee2e6;
}

.image-info p {
  margin: 5px 0;
  font-size: 0.9rem;
  color: #666;
}

.search-section {
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
}

.search-section-compact {
  padding: 15px 24px;
}

.search-section h4 {
  margin: 0 0 15px 0;
  font-size: 1.1rem;
  color: #333;
}

.search-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.search-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #6f42c1;
  box-shadow: 0 0 0 2px rgba(111, 66, 193, 0.25);
}

.search-button {
  padding: 10px 20px;
  background: #6f42c1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-button:hover:not(:disabled) {
  background: #5a359a;
}

.search-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.quick-search-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-search-tags span {
  font-size: 0.9rem;
  color: #666;
}

.quick-tag {
  padding: 4px 8px;
  background: #e9ecef;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  color: #495057;
}

.quick-tag:hover {
  background: #6f42c1;
  color: white;
}

.clipboard-paste-area {
  margin: 15px 0;
  padding: 15px;
  border: 2px dashed #d1ecf1;
  border-radius: 8px;
  background: #f8f9fa;
  text-align: center;
  transition: all 0.2s ease;
}

.clipboard-paste-area:hover {
  border-color: #6f42c1;
  background: #f4f1ff;
}

.paste-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #6c757d;
  font-size: 0.9rem;
}

.paste-icon {
  font-size: 1.2rem;
}

.paste-text {
  font-weight: 500;
}

.pasted-image-preview {
  margin: 15px 0;
  padding: 15px;
  border: 2px solid #28a745;
  border-radius: 8px;
  background: #f8fff9;
}

.pasted-image-preview h5 {
  margin: 0 0 10px 0;
  color: #28a745;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pasted-preview-container {
  display: flex;
  gap: 15px;
  align-items: center;
}

.pasted-preview-img {
  width: 120px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.pasted-actions {
  display: flex;
  gap: 8px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
}

.results-section {
  flex: 1;
  padding: 15px 24px;
  overflow-y: auto;
  min-height: 0; /* Allow flex child to shrink */
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.results-header h4 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.results-count {
  font-size: 0.9rem;
  color: #6c757d;
  background: #f8f9fa;
  padding: 4px 12px;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.image-option {
  position: relative;
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  border: 3px solid transparent;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.image-option:hover {
  border-color: #6f42c1;
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(111, 66, 193, 0.3);
}

.image-option.selected {
  border-color: #6f42c1;
  box-shadow: 0 6px 20px rgba(111, 66, 193, 0.4);
  transform: translateY(-2px);
}

.image-option img {
  width: 100%;
  height: 220px;
  object-fit: cover;
  display: block;
}

.image-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  color: white;
  padding: 10px;
  transform: translateY(100%);
  transition: transform 0.2s ease;
}

.image-option:hover .image-overlay {
  transform: translateY(0);
}

.image-overlay .image-info p {
  margin: 2px 0;
  font-size: 0.8rem;
}

.photographer {
  font-weight: 500;
}

.image-size {
  opacity: 0.8;
}

.selected-indicator {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #28a745;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #666;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #6f42c1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

.error-section {
  padding: 20px 24px;
  text-align: center;
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 15px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  color: #721c24;
}

.error-icon {
  font-size: 1.2rem;
}

.image-selector-footer {
  border-top: 1px solid #e9ecef;
  padding: 20px 24px;
  background: #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
}

.selected-image-preview {
  flex: 1;
  max-width: 300px;
}

.selected-image-preview h5 {
  margin: 0 0 10px 0;
  font-size: 1rem;
  color: #333;
}

.preview-image {
  width: 100%;
  max-width: 200px;
  height: 120px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.preview-info {
  margin: 8px 0 0 0;
  font-size: 0.9rem;
  color: #666;
}

.replacement-info {
  flex: 1;
  max-width: 300px;
}

.replacement-info h5 {
  margin: 0 0 5px 0;
  font-size: 1rem;
  color: #333;
}

.replacement-context {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-primary {
  background: #6f42c1;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5a359a;
}

.btn-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.spinner-sm {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .image-selector-content {
    width: 98%;
    max-height: 95vh;
  }

  .search-section,
  .search-section-compact {
    padding: 12px 16px;
  }

  .results-section {
    padding: 12px 16px;
  }

  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px;
  }

  .image-option img {
    height: 180px;
  }

  .image-selector-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 15px;
    padding: 15px 16px;
  }

  .action-buttons {
    justify-content: stretch;
  }

  .btn {
    flex: 1;
  }

  .pasted-preview-container {
    flex-direction: column;
    text-align: center;
  }

  .pasted-actions {
    justify-content: center;
    margin-top: 10px;
  }

  .clipboard-paste-area {
    margin: 10px 0;
    padding: 12px;
  }

  .paste-info {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
