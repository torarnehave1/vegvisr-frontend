<template>
  <div v-if="isOpen" class="image-selector-modal">
    <div class="image-selector-content">
      <div class="image-selector-header">
        <h3>🖼️ Change Image</h3>
        <button class="image-selector-close" @click="closeModal" title="Close">&times;</button>
      </div>

      <div v-if="searchResults.length === 0" class="current-image-section">
        <h4>Current Image</h4>
        <div class="current-image-layout">
          <!-- Left: Image Preview and Info -->
          <div class="current-image-preview">
            <img :src="currentImageUrl" :alt="currentImageAlt" />
            <div class="image-info">
              <p><strong>Type:</strong> {{ imageType }}</p>
              <p><strong>Context:</strong> {{ imageContext }}</p>
              <p>
                <strong>Current Size:</strong> {{ currentDimensions.width || 'auto' }} ×
                {{ currentDimensions.height || 'auto' }}
              </p>
            </div>
          </div>

          <!-- Right: Resize Controls -->
          <div class="resize-controls-compact">
            <h5>📐 Resize Current Image</h5>
            <div class="resize-inputs">
              <div class="dimension-input-group">
                <label>Width:</label>
                <input
                  type="number"
                  v-model.number="newDimensions.width"
                  min="50"
                  max="2000"
                  placeholder="Width"
                  class="dimension-input"
                  @input="onWidthChange"
                />
                <span class="unit">px</span>
              </div>

              <div class="dimension-input-group">
                <label>Height:</label>
                <input
                  type="number"
                  v-model.number="newDimensions.height"
                  min="50"
                  max="2000"
                  placeholder="Height"
                  class="dimension-input"
                  @input="onHeightChange"
                />
                <span class="unit">px</span>
              </div>
            </div>

            <div class="aspect-ratio-toggle">
              <input
                type="checkbox"
                id="lockAspectRatio"
                v-model="lockAspectRatio"
                class="aspect-checkbox"
              />
              <label for="lockAspectRatio" class="aspect-label"> 🔗 Lock aspect ratio </label>
            </div>

            <div class="resize-actions">
              <button
                @click="resetDimensions"
                class="btn btn-secondary btn-sm"
                title="Reset to original dimensions"
              >
                ↻ Reset
              </button>
              <button
                @click="applyDimensions"
                :disabled="!hasValidDimensions || applyingDimensions"
                class="btn btn-primary btn-sm"
                title="Apply new dimensions to image"
              >
                <span v-if="applyingDimensions" class="spinner-sm"></span>
                {{ applyingDimensions ? 'Applying...' : '✓ Apply Size' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Image URL Editor -->
        <div class="url-editor">
          <h5>🔗 Change Image URL</h5>
          <div class="url-controls">
            <div class="url-input-group">
              <label>Current URL:</label>
              <input
                type="url"
                v-model="editableImageUrl"
                placeholder="Enter image URL (https://...) or Google Photos link"
                class="url-input"
                @blur="validateImageUrl"
                @paste="handleUrlPaste"
              />
            </div>
            <div class="url-actions">
              <button
                @click="resetImageUrl"
                class="btn btn-secondary btn-sm"
                title="Reset to original URL"
              >
                ↻ Reset URL
              </button>
              <button
                @click="applyImageUrl"
                :disabled="!hasValidUrl || applyingUrl"
                class="btn btn-primary btn-sm"
                :title="
                  isGooglePhotosLink
                    ? 'Google Photos links need to be converted first'
                    : 'Apply new image URL'
                "
              >
                <span v-if="applyingUrl" class="spinner-sm"></span>
                {{
                  applyingUrl ? 'Applying...' : isGooglePhotosLink ? '🚫 Cannot Use' : '✓ Apply URL'
                }}
              </button>
            </div>
          </div>
          <div v-if="urlPreview" class="url-preview">
            <img :src="urlPreview" alt="URL Preview" class="preview-img" />
            <p class="preview-text">Preview of new URL</p>
          </div>

          <div v-if="isGooglePhotosLink" class="google-photos-help">
            <div class="help-icon">🚫</div>
            <div class="help-content">
              <p><strong>Google Photos URL Cannot Be Used</strong></p>
              <p>
                This URL requires Google authentication and won't work in web pages due to privacy
                restrictions.
              </p>

              <div class="alternative-options">
                <p><strong>Alternative options:</strong></p>
                <ol>
                  <li>
                    <strong>Upload directly:</strong> Save the image to your computer, then paste it
                    in the clipboard area above
                  </li>
                  <li>
                    <strong>Use search:</strong> Try the "Search New Images" section below for
                    professional stock photos
                  </li>
                  <li>
                    <strong>Use a public image host:</strong> Upload to imgur.com, imgbb.com, or
                    similar, then use that URL
                  </li>
                </ol>
              </div>

              <div class="why-explanation">
                <p>
                  <strong>Why this happens:</strong> Google Photos URLs include authentication
                  tokens and access restrictions that prevent them from being embedded in other
                  websites for privacy and security reasons.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="search-section" :class="{ 'search-section-compact': searchResults.length > 0 }">
        <h4>🔍 Search New Images</h4>

        <!-- Google Photos Integration -->
        <div class="google-photos-section">
          <button
            @click="connectGooglePhotos"
            v-if="!googlePhotosConnected"
            class="btn btn-outline-primary google-photos-btn"
            :disabled="connectingGooglePhotos"
          >
            <span v-if="connectingGooglePhotos" class="spinner-sm"></span>
            {{ connectingGooglePhotos ? 'Connecting...' : '📷 Connect My Google Photos' }}
          </button>

          <div v-if="googlePhotosConnected" class="google-photos-connected">
            <div class="connection-status">
              <span class="status-icon">✅</span>
              <span>Connected to Google Photos</span>
              <button @click="disconnectGooglePhotos" class="btn btn-link btn-sm">
                Disconnect
              </button>
            </div>

            <div class="google-photos-search">
              <input
                v-model="googlePhotosQuery"
                @keyup.enter="searchGooglePhotos"
                class="search-input"
                placeholder="Search your Google Photos..."
              />
              <button
                @click="searchGooglePhotos"
                :disabled="searchingGooglePhotos"
                class="search-button"
              >
                <span v-if="searchingGooglePhotos" class="spinner-sm"></span>
                {{ searchingGooglePhotos ? 'Searching...' : 'Search My Photos' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Clipboard Paste Area -->
        <div class="clipboard-paste-area" v-if="!pastedImage && !pastedUrl">
          <div class="paste-info">
            <span class="paste-icon">📋</span>
            <span class="paste-text">Or paste an image or URL from clipboard (Ctrl+V)</span>
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

        <!-- Pasted URL Preview -->
        <div v-if="pastedUrl" class="pasted-url-preview">
          <h5>📋 Pasted URL</h5>
          <div class="pasted-url-container">
            <div class="pasted-url-info">
              <p class="url-text">{{ pastedUrl.url }}</p>
              <p v-if="pastedUrl.isGooglePhotos" class="url-type google-photos">
                🔗 Google Photos Link
              </p>
              <p v-else-if="pastedUrl.isDirect" class="url-type direct">🖼️ Direct Image URL</p>
              <p v-else class="url-type unknown">🌐 Web URL</p>
            </div>
            <div class="pasted-actions">
              <button
                @click="usePastedUrl"
                class="btn btn-primary btn-sm"
                :title="
                  pastedUrl.isGooglePhotos
                    ? 'Move to URL editor for conversion guidance'
                    : 'Use this URL'
                "
              >
                {{ pastedUrl.isGooglePhotos ? '📝 Edit in URL Field' : 'Use This URL' }}
              </button>
              <button @click="clearPastedUrl" class="btn btn-secondary btn-sm">Clear</button>
            </div>
          </div>
          <div v-if="pastedUrl.isGooglePhotos" class="google-photos-paste-help">
            <p><strong>Google Photos URLs cannot be used directly.</strong></p>
            <p>
              They require authentication and have privacy restrictions. Use the alternatives in the
              URL editor below instead.
            </p>
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
import { ref, computed, watch, onMounted } from 'vue'

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

// Dimensions state
const currentDimensions = ref({ width: null, height: null })
const newDimensions = ref({ width: null, height: null })
const lockAspectRatio = ref(true)
const originalAspectRatio = ref(1)
const applyingDimensions = ref(false)

// URL editing state
const editableImageUrl = ref('')
const originalImageUrl = ref('')
const applyingUrl = ref(false)
const urlPreview = ref('')
const pastedUrl = ref(null)

// Google Photos integration state
const googlePhotosConnected = ref(false)
const connectingGooglePhotos = ref(false)
const searchingGooglePhotos = ref(false)
const googlePhotosQuery = ref('')
const googlePhotosResults = ref([])
const googleAuth = ref(null)

// Environment-aware API base URL
const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8789'
    : 'https://api.vegvisr.org'

console.log(
  '🌍 Environment detected:',
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'LOCAL'
    : 'PRODUCTION',
)
console.log('📡 API Base URL:', API_BASE)

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
  // Reset URL state
  editableImageUrl.value = ''
  originalImageUrl.value = ''
  urlPreview.value = ''
  pastedUrl.value = null
  removePasteListener()
  emit('close')
}

const getImageDimensions = (image) => {
  // This would ideally come from the Pexels API response
  return 'Medium size' // Placeholder
}

// Computed properties for dimensions
const hasValidDimensions = computed(() => {
  return (
    newDimensions.value.width > 50 &&
    newDimensions.value.height > 50 &&
    newDimensions.value.width <= 2000 &&
    newDimensions.value.height <= 2000
  )
})

// Computed properties for URL
const hasValidUrl = computed(() => {
  return (
    editableImageUrl.value &&
    editableImageUrl.value.trim() !== '' &&
    editableImageUrl.value !== originalImageUrl.value &&
    (editableImageUrl.value.startsWith('http://') ||
      editableImageUrl.value.startsWith('https://')) &&
    !isGooglePhotosLink.value // Disable Apply for Google Photos links
  )
})

const isGooglePhotosLink = computed(() => {
  return (
    editableImageUrl.value &&
    (editableImageUrl.value.includes('photos.app.goo.gl') ||
      editableImageUrl.value.includes('photos.google.com') ||
      editableImageUrl.value.includes('photos.fife.usercontent.google.com') ||
      editableImageUrl.value.includes('lh3.googleusercontent.com'))
  )
})

// Dimension methods
const parseCurrentDimensions = () => {
  console.log('=== Parsing Current Dimensions ===')
  console.log('Node content:', props.nodeContent)
  console.log('Current image URL:', props.currentImageUrl)

  // Extract dimensions from markdown content
  const imageUrl = props.currentImageUrl
  if (!imageUrl || !props.nodeContent) {
    console.log('No URL or content provided')
    currentDimensions.value = { width: null, height: null }
    newDimensions.value = { width: 300, height: 200 }
    originalAspectRatio.value = 1.5
    return
  }

  // Escape special regex characters in URL
  const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Look for image syntax with the specific URL and extract dimensions
  const imageRegex = new RegExp(`!\\[([^\\]]*?)\\|([^\\]]*?)\\]\\(${escapedUrl}\\)`, 'g')
  const match = imageRegex.exec(props.nodeContent)

  if (match) {
    const styleString = match[2]
    console.log('Found image style string:', styleString)

    const widthMatch = styleString.match(/width:\s*['"]?([^;'"]+)['"]?/i)
    const heightMatch = styleString.match(/height:\s*['"]?([^;'"]+)['"]?/i)

    let width = null
    let height = null

    if (widthMatch) {
      width = parseInt(widthMatch[1].replace('px', '')) || null
    }

    if (heightMatch) {
      height = parseInt(heightMatch[1].replace('px', '')) || null
    }

    console.log('Parsed dimensions:', { width, height })

    currentDimensions.value = { width, height }
    newDimensions.value = { width: width || 300, height: height || 200 }

    if (width && height) {
      originalAspectRatio.value = width / height
    } else {
      originalAspectRatio.value = 1.5 // Default aspect ratio
    }
  } else {
    console.log('No image found in content')
    currentDimensions.value = { width: null, height: null }
    newDimensions.value = { width: 300, height: 200 }
    originalAspectRatio.value = 1.5
  }

  console.log('Final dimensions:', currentDimensions.value, newDimensions.value)
}

const onWidthChange = () => {
  if (lockAspectRatio.value && newDimensions.value.width) {
    newDimensions.value.height = Math.round(newDimensions.value.width / originalAspectRatio.value)
  }
}

const onHeightChange = () => {
  if (lockAspectRatio.value && newDimensions.value.height) {
    newDimensions.value.width = Math.round(newDimensions.value.height * originalAspectRatio.value)
  }
}

const resetDimensions = () => {
  newDimensions.value = {
    width: currentDimensions.value.width || 300,
    height: currentDimensions.value.height || 200,
  }
}

const applyDimensions = async () => {
  if (!hasValidDimensions.value) return

  applyingDimensions.value = true

  try {
    console.log('=== Applying Dimensions ===')
    console.log('New dimensions:', newDimensions.value)

    // Emit the dimension change
    emit('image-replaced', {
      oldUrl: props.currentImageUrl,
      newUrl: props.currentImageUrl, // Same URL, just different dimensions
      newAlt: props.currentImageAlt,
      newWidth: newDimensions.value.width + 'px',
      newHeight: newDimensions.value.height + 'px',
      photographer: 'Current image resized',
      imageType: props.imageType,
      isDimensionChange: true, // Flag to indicate this is just a resize
    })

    closeModal()
  } catch (err) {
    error.value = 'Failed to apply dimensions. Please try again.'
    console.error('Dimension application error:', err)
  } finally {
    applyingDimensions.value = false
  }
}

// URL methods
const handleUrlPaste = (event) => {
  console.log('=== URL Input Paste Event ===')

  // Get the pasted text
  const pasteData = event.clipboardData?.getData('text')
  if (pasteData) {
    console.log('Pasted text:', pasteData)

    // Allow the default paste, then validate
    setTimeout(() => {
      // Ensure the input has the pasted value
      if (!editableImageUrl.value) {
        editableImageUrl.value = pasteData.trim()
      }
      validateImageUrl()
    }, 50)
  }
}

const validateImageUrl = () => {
  if (editableImageUrl.value && editableImageUrl.value !== originalImageUrl.value) {
    // Check if it's a Google Photos link
    if (isGooglePhotosLink.value) {
      urlPreview.value = ''
      // Don't show preview for Google Photos links as they need conversion
      return
    }

    // Show preview if it's a valid direct image URL
    if (editableImageUrl.value.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
      urlPreview.value = editableImageUrl.value
    } else {
      urlPreview.value = ''
    }
  } else {
    urlPreview.value = ''
  }
}

const resetImageUrl = () => {
  editableImageUrl.value = originalImageUrl.value
  urlPreview.value = ''
}

const applyImageUrl = async () => {
  if (!hasValidUrl.value) return

  applyingUrl.value = true

  try {
    console.log('=== Applying URL Change ===')
    console.log('Old URL:', originalImageUrl.value)
    console.log('New URL:', editableImageUrl.value)

    // Emit the URL change
    emit('image-replaced', {
      oldUrl: originalImageUrl.value,
      newUrl: editableImageUrl.value.trim(),
      newAlt: props.currentImageAlt,
      photographer: 'Custom URL',
      imageType: props.imageType,
      isUrlChange: true, // Flag to indicate this is a URL change
    })

    closeModal()
  } catch (err) {
    error.value = 'Failed to apply URL change. Please try again.'
    console.error('URL application error:', err)
  } finally {
    applyingUrl.value = false
  }
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

  // First check for text (URLs)
  for (let item of items) {
    if (item.type === 'text/plain') {
      item.getAsString((text) => {
        const trimmedText = text.trim()
        // Check if it's a URL
        if (trimmedText.startsWith('http://') || trimmedText.startsWith('https://')) {
          processPastedUrl(trimmedText)
          return
        }
      })
      break
    }
  }

  // Then check for images
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

const processPastedUrl = (url) => {
  console.log('=== Processing Pasted URL ===')
  console.log('URL:', url)

  try {
    const isGooglePhotos =
      url.includes('photos.app.goo.gl') ||
      url.includes('photos.google.com') ||
      url.includes('photos.fife.usercontent.google.com') ||
      url.includes('lh3.googleusercontent.com')
    const isDirect = url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)

    pastedUrl.value = {
      url: url,
      isGooglePhotos: isGooglePhotos,
      isDirect: !!isDirect,
      id: 'pasted-url-' + Date.now(),
    }

    // Clear any previous search results and image pastes
    searchResults.value = []
    selectedImage.value = null
    pastedImage.value = null
    error.value = ''

    console.log('URL processed:', pastedUrl.value)
  } catch (err) {
    error.value = 'Failed to process pasted URL: ' + err.message
    console.error('URL paste error:', err)
  }
}

const usePastedUrl = () => {
  if (pastedUrl.value && !pastedUrl.value.isGooglePhotos) {
    // Use the pasted URL as if it was selected
    selectedImage.value = {
      id: pastedUrl.value.id,
      url: pastedUrl.value.url,
      alt: 'Pasted URL image',
      photographer: 'Custom URL',
    }
    replaceImage()
  } else if (pastedUrl.value && pastedUrl.value.isGooglePhotos) {
    // For Google Photos links, show them in the URL editor
    editableImageUrl.value = pastedUrl.value.url
    validateImageUrl()
    // Clear the pasted URL since it's now in the URL editor
    pastedUrl.value = null
  }
}

const clearPastedUrl = () => {
  pastedUrl.value = null
  error.value = ''
}

// Load Google Picker API and show picker
const loadGooglePickerAPI = async (apiKey, accessToken) => {
  return new Promise((resolve, reject) => {
    // Check if Google API is already loaded
    if (window.gapi) {
      initializePicker(apiKey, accessToken)
      resolve()
      return
    }

    // Load Google API
    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = () => {
      window.gapi.load('picker', () => {
        initializePicker(apiKey, accessToken)
        resolve()
      })
    }
    script.onerror = () => reject(new Error('Failed to load Google API'))
    document.head.appendChild(script)
  })
}

// Initialize and show Google Picker
const initializePicker = (apiKey, accessToken) => {
  const picker = new window.google.picker.PickerBuilder()
    .addView(window.google.picker.ViewId.PHOTOS) // Google Photos view
    .setOAuthToken(accessToken) // Access token from auth-worker
    .setDeveloperKey(apiKey) // API key from auth-worker
    .setCallback(handlePickerCallback) // Handle photo selection
    .build()

  picker.setVisible(true)
  console.log('🖼️ Google Photos Picker opened!')
}

// Handle photo selection from picker
const handlePickerCallback = (data) => {
  if (data.action === window.google.picker.Action.PICKED) {
    const selectedPhotos = data.docs || []
    console.log('📸 Photos selected:', selectedPhotos)

    if (selectedPhotos.length > 0) {
      const photo = selectedPhotos[0] // Use first selected photo

      // Convert picker result to our image format
      selectedImage.value = {
        id: 'picker-' + photo.id,
        url: photo.url,
        alt: photo.name || 'Google Photos image',
        photographer: 'Your Google Photos',
        width: photo.sizeBytes ? 'Original size' : '800x600',
        height: '',
        isGooglePhoto: true,
        originalItem: photo,
      }

      console.log('✅ Selected photo:', selectedImage.value)

      // Replace search results with selected photo for preview
      searchResults.value = [selectedImage.value]
    }
  }

  if (data.action === window.google.picker.Action.CANCEL) {
    console.log('🚫 Picker was cancelled')
  }
}

// Google Photos Methods
const connectGooglePhotos = async () => {
  connectingGooglePhotos.value = true
  error.value = ''

  try {
    console.log('🔄 Starting Google Photos Picker auth via auth-worker...')

    // Use the new auth-worker picker flow
    window.location.href = 'https://auth.vegvisr.org/picker/auth'

    // The redirect will happen, and we'll handle the return in checkForPickerAuthReturn()
  } catch (err) {
    error.value = 'Failed to connect to Google Photos: ' + err.message
    console.error('Google Photos connection error:', err)
  } finally {
    connectingGooglePhotos.value = false
  }
}

const searchGooglePhotos = async (query = null) => {
  if (!googlePhotosConnected.value) return

  searchingGooglePhotos.value = true
  error.value = ''

  try {
    const searchTerm = query || googlePhotosQuery.value || 'recent'

    // Use different endpoint based on search term
    const endpoint =
      searchTerm === 'recent'
        ? `${API_BASE}/google-photos-recent`
        : `${API_BASE}/google-photos-search`

    const requestBody = {
      access_token: googleAuth.value,
      ...(searchTerm !== 'recent' && {
        searchParams: {
          contentCategories: [searchTerm.toUpperCase()],
        },
      }),
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Failed to search Google Photos')
    }

    // Transform Google Photos results to match our format
    googlePhotosResults.value = (data.mediaItems || []).map((item) => ({
      id: 'google-' + item.id,
      url: item.baseUrl + '=w800-h600', // Add size parameters for better quality
      alt: item.filename || 'Google Photos image',
      photographer: 'Your Google Photos',
      width: item.mediaMetadata?.width || 800,
      height: item.mediaMetadata?.height || 600,
      isGooglePhoto: true,
      originalItem: item,
    }))

    // Replace search results with Google Photos results
    searchResults.value = googlePhotosResults.value

    console.log(`✅ Loaded ${googlePhotosResults.value.length} photos from Google Photos`)
  } catch (err) {
    error.value = 'Failed to search Google Photos: ' + err.message
    console.error('Google Photos search error:', err)
  } finally {
    searchingGooglePhotos.value = false
  }
}

const disconnectGooglePhotos = () => {
  googleAuth.value = null
  googlePhotosConnected.value = false
  googlePhotosResults.value = []
  googlePhotosQuery.value = ''
  searchResults.value = []
}

// Old popup-based functions removed - now using redirect-based OAuth

const addPasteListener = () => {
  document.addEventListener('paste', handlePaste)
}

const removePasteListener = () => {
  document.removeEventListener('paste', handlePaste)
}

// Check for OAuth return on component mount
onMounted(() => {
  checkForOAuthReturn()
  checkForPickerAuthReturn()
})

// Function to check if we're returning from Picker OAuth
const checkForPickerAuthReturn = async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const pickerToken = urlParams.get('picker_access_token')
  const pickerSuccess = urlParams.get('picker_auth_success')
  const pickerError = urlParams.get('picker_auth_error')

  // Handle Picker OAuth error
  if (pickerError) {
    error.value = 'Google Picker authorization failed: ' + decodeURIComponent(pickerError)
    console.error('❌ Picker OAuth Error:', pickerError)

    // Clean up URL parameters
    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('picker_auth_error')
    window.history.replaceState({}, document.title, cleanUrl.toString())
    return
  }

  // Handle Picker OAuth success
  if (pickerToken && pickerSuccess === 'true') {
    console.log('🔄 Detected Picker OAuth return, initializing picker...')

    try {
      // Get API key and credentials from auth-worker
      const response = await fetch('https://auth.vegvisr.org/picker/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: pickerToken,
        }),
      })

      const creds = await response.json()

      if (creds.success) {
        console.log('✅ Got picker credentials, loading Google Picker...')

        // Load Google Picker API and show picker
        await loadGooglePickerAPI(creds.api_key, creds.access_token)
      } else {
        error.value = creds.error || 'Failed to get picker credentials'
      }
    } catch (err) {
      error.value = 'Failed to initialize picker: ' + err.message
      console.error('Picker initialization error:', err)
    }

    // Clean up URL parameters
    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('picker_access_token')
    cleanUrl.searchParams.delete('picker_auth_success')
    cleanUrl.searchParams.delete('picker_expires_in')
    window.history.replaceState({}, document.title, cleanUrl.toString())
  }
}

// Function to check if we're returning from OAuth
const checkForOAuthReturn = async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const authCode = urlParams.get('google_auth_code')
  const authSuccess = urlParams.get('google_auth_success')
  const authError = urlParams.get('google_auth_error')

  // Handle OAuth error
  if (authError) {
    error.value = 'Google Photos authorization failed: ' + decodeURIComponent(authError)
    console.error('❌ OAuth Error:', authError)

    // Clean up URL parameters
    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('google_auth_error')
    window.history.replaceState({}, document.title, cleanUrl.toString())
    return
  }

  // Handle OAuth success
  if (authCode && authSuccess === 'true') {
    console.log('🔄 Detected OAuth return, processing...')

    try {
      // Exchange the authorization code for an access token
      const response = await fetch(`${API_BASE}/google-photos-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: authCode,
        }),
      })

      const data = await response.json()

      if (data.success && data.access_token) {
        googleAuth.value = data.access_token
        googlePhotosConnected.value = true
        console.log('✅ Google Photos connected successfully!')

        // Load recent photos automatically
        await searchGooglePhotos('recent')
      } else {
        error.value = data.error || 'Failed to get access token'
      }
    } catch (err) {
      error.value = 'Failed to exchange authorization code: ' + err.message
      console.error('OAuth exchange error:', err)
    }

    // Clean up URL parameters
    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('google_auth_code')
    cleanUrl.searchParams.delete('google_auth_success')
    window.history.replaceState({}, document.title, cleanUrl.toString())
  }
}

// Initialize paste listener when modal opens
watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue) {
      addPasteListener()
      // Initialize URL state
      originalImageUrl.value = props.currentImageUrl
      editableImageUrl.value = props.currentImageUrl
      // Parse current image dimensions
      parseCurrentDimensions()
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
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.current-image-section h4 {
  margin: 0 0 12px 0;
  font-size: 1.1rem;
  color: #333;
}

.current-image-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.current-image-preview {
  display: flex;
  gap: 12px;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.current-image-preview img {
  width: 100px;
  height: 67px;
  object-fit: cover;
  border-radius: 6px;
  border: 2px solid #dee2e6;
  flex-shrink: 0;
}

.image-info p {
  margin: 3px 0;
  font-size: 0.85rem;
  color: #666;
}

/* Compact Resize Controls */
.resize-controls-compact {
  flex: 1;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px;
  min-width: 280px;
}

.resize-controls-compact h5 {
  margin: 0 0 10px 0;
  font-size: 0.9rem;
  color: #333;
  display: flex;
  align-items: center;
  gap: 4px;
}

.resize-inputs {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.resize-inputs .dimension-input-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.resize-inputs .dimension-input-group label {
  font-weight: 500;
  color: #333;
  font-size: 0.8rem;
  min-width: 40px;
}

.resize-inputs .dimension-input {
  width: 70px;
  padding: 4px 6px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}

.resize-inputs .dimension-input:focus {
  outline: none;
  border-color: #6f42c1;
  box-shadow: 0 0 0 1px rgba(111, 66, 193, 0.25);
}

.resize-inputs .unit {
  font-size: 0.8rem;
  color: #666;
  font-weight: 500;
}

.resize-controls-compact .aspect-ratio-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding: 6px 8px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  font-size: 0.8rem;
}

.resize-controls-compact .aspect-checkbox {
  margin: 0;
}

.resize-controls-compact .aspect-label {
  margin: 0;
  font-size: 0.8rem;
  color: #495057;
  cursor: pointer;
  user-select: none;
}

.resize-actions {
  display: flex;
  gap: 8px;
}

.resize-actions .btn {
  flex: 1;
  font-size: 0.8rem;
  padding: 6px 10px;
}

/* URL Editor Styles */
.url-editor {
  margin-top: 16px;
  padding: 12px;
  background: #f1f8ff;
  border-radius: 6px;
  border: 1px solid #b8daff;
}

.url-editor h5 {
  margin: 0 0 10px 0;
  font-size: 0.9rem;
  color: #0056b3;
  display: flex;
  align-items: center;
  gap: 6px;
}

.url-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.url-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.url-input-group label {
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
}

.url-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
  font-family: monospace;
  background: white;
}

.url-input:focus {
  outline: none;
  border-color: #0056b3;
  box-shadow: 0 0 0 2px rgba(0, 86, 179, 0.25);
}

.url-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.url-preview {
  margin-top: 10px;
  padding: 8px;
  background: white;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  text-align: center;
}

.preview-img {
  max-width: 120px;
  max-height: 80px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  margin-bottom: 6px;
}

.preview-text {
  margin: 0;
  font-size: 0.8rem;
  color: #666;
  font-style: italic;
}

/* Google Photos Help Styles */
.google-photos-help {
  margin-top: 10px;
  padding: 12px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.help-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.help-content {
  flex: 1;
}

.help-content p {
  margin: 0 0 8px 0;
  font-size: 0.85rem;
  color: #856404;
}

.help-content p:last-child {
  margin-bottom: 0;
}

.help-content strong {
  color: #856404;
  font-weight: 600;
}

.help-content ol {
  margin: 8px 0;
  padding-left: 18px;
  font-size: 0.8rem;
  color: #856404;
}

.help-content li {
  margin-bottom: 4px;
}

.help-note {
  font-style: italic;
  opacity: 0.9;
}

.alternative-options {
  margin: 12px 0;
  padding: 10px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  border-left: 3px solid #856404;
}

.alternative-options p {
  margin-bottom: 6px;
  font-weight: 600;
}

.alternative-options ol {
  margin: 6px 0 0 0;
}

.alternative-options li {
  margin-bottom: 6px;
  line-height: 1.4;
}

.why-explanation {
  margin-top: 12px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  font-size: 0.8rem;
}

.why-explanation p {
  margin: 0;
  opacity: 0.9;
  font-style: italic;
}

/* Dimensions Editor Styles */
.dimensions-editor {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.dimensions-editor h5 {
  margin: 0 0 15px 0;
  font-size: 1rem;
  color: #333;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dimensions-controls {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 15px;
  align-items: center;
  margin-bottom: 15px;
}

.dimension-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dimension-input-group label {
  font-weight: 500;
  color: #333;
  min-width: 50px;
}

.dimension-input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  text-align: center;
}

.dimension-input:focus {
  outline: none;
  border-color: #6f42c1;
  box-shadow: 0 0 0 2px rgba(111, 66, 193, 0.25);
}

.unit {
  font-size: 0.85rem;
  color: #666;
  font-weight: 500;
}

.aspect-ratio-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  justify-self: center;
}

.aspect-checkbox {
  margin: 0;
}

.aspect-label {
  margin: 0;
  font-size: 0.9rem;
  color: #495057;
  cursor: pointer;
  user-select: none;
}

.dimension-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.dimension-actions .btn {
  min-width: 100px;
}

/* Mobile responsive dimensions editor */
@media (max-width: 768px) {
  .dimensions-controls {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .dimension-input-group {
    justify-content: space-between;
  }

  .aspect-ratio-toggle {
    justify-self: stretch;
    justify-content: center;
  }

  .dimension-actions {
    flex-direction: column;
  }

  .dimension-actions .btn {
    width: 100%;
  }

  /* Mobile responsive URL editor */
  .url-actions {
    flex-direction: column;
  }

  .url-actions .btn {
    width: 100%;
  }

  .url-input {
    font-size: 16px; /* Prevent zoom on iOS */
  }

  /* Mobile responsive Google Photos help */
  .google-photos-help {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }

  .help-content ol {
    text-align: left;
    padding-left: 16px;
  }

  .alternative-options {
    margin: 10px 0;
    padding: 8px;
  }

  .why-explanation {
    margin-top: 10px;
    padding: 6px;
    font-size: 0.75rem;
  }

  /* Mobile responsive current image layout */
  .current-image-layout {
    flex-direction: column;
    gap: 15px;
  }

  .current-image-preview {
    justify-content: center;
  }

  .resize-controls-compact {
    min-width: auto;
  }

  .resize-inputs {
    flex-direction: column;
    gap: 8px;
  }

  .resize-inputs .dimension-input-group {
    justify-content: space-between;
  }

  .resize-actions {
    flex-direction: column;
  }
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

/* Pasted URL Styles */
.pasted-url-preview {
  margin: 15px 0;
  padding: 15px;
  border: 2px solid #007bff;
  border-radius: 8px;
  background: #f0f8ff;
}

.pasted-url-preview h5 {
  margin: 0 0 10px 0;
  color: #007bff;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pasted-url-container {
  display: flex;
  gap: 15px;
  align-items: flex-start;
}

.pasted-url-info {
  flex: 1;
}

.url-text {
  margin: 0 0 8px 0;
  font-size: 0.85rem;
  color: #333;
  font-family: monospace;
  word-break: break-all;
  background: white;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.url-type {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
}

.url-type.google-photos {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.url-type.direct {
  background: #d1edff;
  color: #0056b3;
  border: 1px solid #b8daff;
}

.url-type.unknown {
  background: #f8f9fa;
  color: #6c757d;
  border: 1px solid #dee2e6;
}

.google-photos-paste-help {
  margin-top: 12px;
  padding: 10px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #856404;
}

.google-photos-paste-help p {
  margin: 0 0 6px 0;
}

.google-photos-paste-help p:last-child {
  margin-bottom: 0;
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

  /* Mobile responsive pasted URL */
  .pasted-url-container {
    flex-direction: column;
    gap: 12px;
  }

  .pasted-url-preview {
    margin: 12px 0;
    padding: 12px;
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

/* Google Photos Integration Styles */
.google-photos-section {
  margin-bottom: 20px;
  padding: 15px;
  border: 2px dashed #e0e0e0;
  border-radius: 8px;
  background-color: #fafafa;
}

.google-photos-btn {
  width: 100%;
  padding: 12px;
  font-size: 1rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.google-photos-btn:hover:not(:disabled) {
  background-color: #4285f4;
  border-color: #4285f4;
  color: white;
}

.google-photos-connected {
  width: 100%;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 15px;
  padding: 8px 12px;
  background-color: #e8f5e8;
  border-radius: 6px;
  font-size: 0.9rem;
}

.status-icon {
  font-size: 1.1rem;
}

.google-photos-search {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.google-photos-search .search-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
}

.google-photos-search .search-button {
  padding: 10px 16px;
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.2s ease;
}

.google-photos-search .search-button:hover:not(:disabled) {
  background-color: #3367d6;
}

.google-photos-search .search-button:disabled {
  background-color: #9aa0a6;
  cursor: not-allowed;
}

.spinner-sm {
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
</style>
