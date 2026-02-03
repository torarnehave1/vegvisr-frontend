<template>
  <div class="gnew-imagequote-container">
    <!-- IMAGEQUOTE Display -->
    <div
      ref="imagequoteElement"
      class="imagequote"
      :style="computedStyles"
      :data-export-id="exportId"
    >
      <!-- Background overlay for text readability -->
      <div class="imagequote-overlay" :style="overlayStyles"></div>

      <!-- Quote content -->
      <div class="imagequote-content" :style="contentStyles">
        <div class="quote-text" v-html="formattedQuoteText"></div>
        <cite v-if="citation" class="quote-citation">— {{ citation }}</cite>
      </div>
    </div>

    <!-- Controls (Superadmin only) -->
    <div v-if="showControls && userStore.role === 'Superadmin'" class="imagequote-controls">
      <button @click="openImageModal" class="btn btn-outline-primary btn-sm">
        🖼️ {{ backgroundImage ? 'Change Image' : 'Add Image' }}
      </button>
      <button @click="openExportModal" class="btn btn-success btn-sm">📸 Export as Image</button>
      <button v-if="editMode" @click="openEditModal" class="btn btn-outline-secondary btn-sm">
        ✏️ Edit Text
      </button>
    </div>

    <!-- Image Selection Modal -->
    <div v-if="showImageModal" class="modal-overlay" @click.self="closeImageModal">
      <div class="image-modal">
        <div class="modal-header">
          <h4>🖼️ Select Background Image</h4>
          <button @click="closeImageModal" class="btn-close">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Current Image Preview -->
          <div v-if="backgroundImage" class="current-image-section">
            <h5>Current Image</h5>
            <div class="current-image-preview">
              <img :src="backgroundImage" alt="Current background" />
              <div class="current-image-actions">
                <button @click="clearImage" class="btn btn-outline-danger btn-sm">
                  🗑️ Remove Image
                </button>
              </div>
            </div>
          </div>

          <!-- Image Source Options -->
          <div class="image-source-section">
            <h5>Add New Image</h5>

            <!-- Upload, AI Generate, URL buttons -->
            <div class="image-source-options">
              <button
                @click="triggerImageUpload"
                class="btn btn-outline-primary btn-source"
                :disabled="isUploadingImage"
              >
                <i class="bi" :class="isUploadingImage ? 'bi-hourglass-split' : 'bi-upload'"></i>
                {{ isUploadingImage ? 'Uploading...' : 'Upload Image' }}
              </button>

              <button
                @click="openAIImageModal"
                class="btn btn-outline-success btn-source"
                :disabled="isUploadingImage"
              >
                <i class="bi bi-magic"></i>
                AI Generate
              </button>

              <button
                @click="showUrlInput = !showUrlInput"
                class="btn btn-outline-info btn-source"
                :class="{ active: showUrlInput }"
              >
                <i class="bi bi-link-45deg"></i>
                Image URL
              </button>
            </div>

            <!-- Hidden file input -->
            <input
              ref="imageFileInput"
              type="file"
              accept="image/*"
              style="display: none"
              @change="handleImageUpload"
            />

            <!-- URL Input Section -->
            <div v-if="showUrlInput" class="url-input-section">
              <div class="form-group">
                <label class="form-label">Image URL:</label>
                <div class="url-input-group">
                  <input
                    v-model="imageUrl"
                    type="url"
                    class="form-control"
                    placeholder="https://example.com/image.jpg"
                    @paste="handleUrlPaste"
                    @input="validateImageUrl"
                  />
                  <button
                    @click="useImageUrl"
                    :disabled="!isValidUrl || isLoadingUrl"
                    class="btn btn-primary"
                  >
                    {{ isLoadingUrl ? 'Loading...' : 'Use URL' }}
                  </button>
                </div>
                <small class="form-text text-muted">
                  Paste an image URL or use Ctrl+V to paste from clipboard
                </small>
              </div>

              <!-- URL Preview -->
              <div v-if="urlPreviewImage" class="url-preview">
                <img :src="urlPreviewImage" alt="URL preview" />
                <button @click="applyUrlImage" class="btn btn-success btn-sm">
                  ✅ Use This Image
                </button>
              </div>
            </div>

            <!-- Clipboard Paste Area -->
            <div v-if="!pastedImage && !showUrlInput" class="clipboard-paste-area">
              <div class="paste-info">
                <span class="paste-icon">📋</span>
                <span class="paste-text">Or paste an image from clipboard (Ctrl+V)</span>
              </div>
            </div>

            <!-- Pasted Image Preview -->
            <div v-if="pastedImage" class="pasted-image-preview">
              <h5>📋 Pasted Image</h5>
              <div class="pasted-preview-container">
                <img :src="pastedImage.url" alt="Pasted image" />
                <div class="pasted-actions">
                  <button @click="usePastedImage" class="btn btn-primary btn-sm">
                    Use This Image
                  </button>
                  <button @click="clearPastedImage" class="btn btn-secondary btn-sm">Clear</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Loading/Error States -->
          <div v-if="imageError" class="alert alert-danger">
            <strong>❌ Error:</strong> {{ imageError }}
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeImageModal" class="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>

    <!-- Export Modal -->
    <div v-if="showExportModal" class="modal-overlay" @click.self="closeExportModal">
      <div class="export-modal">
        <div class="modal-header">
          <h4>📸 Export Quote as Image</h4>
          <button @click="closeExportModal" class="btn-close">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Size Presets -->
          <div class="form-group">
            <label class="form-label">Image Size:</label>
            <div class="size-presets">
              <button
                v-for="preset in sizePresets"
                :key="preset.name"
                @click="selectedPreset = preset"
                class="preset-btn"
                :class="{ active: selectedPreset.name === preset.name }"
              >
                {{ preset.name }}
                <small>{{ preset.width }}x{{ preset.height }}</small>
              </button>
            </div>
          </div>

          <!-- Format Options -->
          <div class="form-group">
            <label class="form-label">Format:</label>
            <div class="format-options">
              <label class="form-check">
                <input v-model="exportFormat" type="radio" value="png" class="form-check-input" />
                PNG (Transparent background)
              </label>
              <label class="form-check">
                <input v-model="exportFormat" type="radio" value="jpg" class="form-check-input" />
                JPG (Solid background)
              </label>
            </div>
          </div>

          <!-- Quality Slider -->
          <div class="form-group">
            <label class="form-label">Quality: {{ exportQuality }}%</label>
            <input
              v-model.number="exportQuality"
              type="range"
              min="50"
              max="100"
              step="10"
              class="form-range"
            />
          </div>
        </div>

        <div class="modal-footer">
          <button @click="exportImage" class="btn btn-primary" :disabled="exporting">
            <span v-if="exporting" class="spinner-border spinner-border-sm me-2"></span>
            {{ exporting ? 'Exporting...' : 'Export Image' }}
          </button>
          <button @click="closeExportModal" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>

    <!-- AI Image Modal -->
    <AIImageModal
      :isOpen="isAIImageModalOpen"
      :graphContext="{ type: 'imagequote-background' }"
      @close="closeAIImageModal"
      @image-inserted="handleAIImageGenerated"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import html2canvas from 'html2canvas'
import AIImageModal from './AIImageModal.vue'

// Props
const props = defineProps({
  quoteText: {
    type: String,
    required: true,
  },
  backgroundImage: {
    type: String,
    default: '',
  },
  aspectRatio: {
    type: String,
    default: '16/9', // Can be '16/9', '1/1', '4/3', etc.
  },
  textAlign: {
    type: String,
    default: 'center', // 'left', 'center', 'right'
  },
  padding: {
    type: String,
    default: '2em',
  },
  citation: {
    type: String,
    default: '',
  },
  overlayOpacity: {
    type: Number,
    default: 0.4, // Background overlay for text readability
  },
  overlayColor: {
    type: String,
    default: '#000000',
  },
  textColor: {
    type: String,
    default: '#ffffff',
  },
  fontSize: {
    type: String,
    default: '1.5rem',
  },
  width: {
    type: String,
    default: '100%',
  },
  height: {
    type: String,
    default: 'auto',
  },
  showControls: {
    type: Boolean,
    default: true,
  },
  editMode: {
    type: Boolean,
    default: false,
  },
})

// Emits
const emit = defineEmits(['edit', 'exported', 'image-changed'])

// Store access
const userStore = useUserStore()

// Reactive data
const imagequoteElement = ref(null)
const showExportModal = ref(false)
const showImageModal = ref(false)
const exporting = ref(false)
const exportFormat = ref('png')
const exportQuality = ref(90)
const exportId = ref(`imagequote-${Date.now()}`)

// Image handling state
const isUploadingImage = ref(false)
const isAIImageModalOpen = ref(false)
const imageFileInput = ref(null)
const showUrlInput = ref(false)
const imageUrl = ref('')
const isValidUrl = ref(false)
const isLoadingUrl = ref(false)
const urlPreviewImage = ref('')
const pastedImage = ref(null)
const imageError = ref('')

// Size presets for different social media platforms
const sizePresets = ref([
  { name: 'Instagram Square', width: 1080, height: 1080, aspectRatio: '1/1' },
  { name: 'Instagram Story', width: 1080, height: 1920, aspectRatio: '9/16' },
  { name: 'Facebook Post', width: 1200, height: 630, aspectRatio: '1.91/1' },
  { name: 'Twitter Header', width: 1500, height: 500, aspectRatio: '3/1' },
  { name: 'LinkedIn Post', width: 1200, height: 627, aspectRatio: '1.91/1' },
  { name: 'Custom 16:9', width: 1920, height: 1080, aspectRatio: '16/9' },
])

const selectedPreset = ref(sizePresets.value[0])

// Computed styles
const computedStyles = computed(() => {
  const styles = {
    aspectRatio: props.aspectRatio,
    backgroundImage: props.backgroundImage ? `url('${props.backgroundImage}')` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
    borderRadius: '12px',
    overflow: 'hidden',
    width: props.width,
    height: props.height,
  }

  // Add fallback background if no image
  if (!props.backgroundImage) {
    styles.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  }

  return styles
})

const overlayStyles = computed(() => ({
  position: 'absolute',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  backgroundColor: props.overlayColor,
  opacity: props.overlayOpacity,
  zIndex: '1',
}))

const contentStyles = computed(() => ({
  position: 'relative',
  zIndex: '2',
  padding: props.padding,
  textAlign: props.textAlign,
  color: props.textColor,
  fontSize: props.fontSize,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems:
    props.textAlign === 'center'
      ? 'center'
      : props.textAlign === 'right'
        ? 'flex-end'
        : 'flex-start',
}))

const formattedQuoteText = computed(() => {
  // Simple markdown processing for bold, italic
  return props.quoteText
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
})

// Modal methods
const openExportModal = () => {
  showExportModal.value = true
}

const closeExportModal = () => {
  showExportModal.value = false
}

const openImageModal = () => {
  showImageModal.value = true
  addPasteListener()
}

const closeImageModal = () => {
  showImageModal.value = false
  showUrlInput.value = false
  imageUrl.value = ''
  urlPreviewImage.value = ''
  clearPastedImage()
  imageError.value = ''
  removePasteListener()
}

const openEditModal = () => {
  emit('edit')
}

// Image handling methods
const clearImage = () => {
  emit('image-changed', '')
  closeImageModal()
}

const triggerImageUpload = () => {
  imageFileInput.value?.click()
}

const handleImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file || !file.type.startsWith('image/')) {
    imageError.value = 'Please select a valid image file.'
    return
  }

  isUploadingImage.value = true
  imageError.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('https://api.vegvisr.org/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload image')
    }

    const data = await response.json()

    // Handle both single URL and array of URLs from API
    const imageUrl = data.url || (data.urls && Array.isArray(data.urls) ? data.urls[0] : null)
    if (!imageUrl) {
      throw new Error('API did not return an image URL')
    }

    console.log('✅ Image uploaded successfully:', imageUrl)
    emit('image-changed', imageUrl)
    closeImageModal()
  } catch (error) {
    console.error('❌ Upload error:', error)
    imageError.value = 'Failed to upload image. Please try again.'
  } finally {
    isUploadingImage.value = false
    event.target.value = '' // Clear the file input
  }
}

// AI Image Generation
const openAIImageModal = () => {
  isAIImageModalOpen.value = true
}

const closeAIImageModal = () => {
  isAIImageModalOpen.value = false
}

const handleAIImageGenerated = (imageData) => {
  console.log('=== AI Image Generated for IMAGEQUOTE ===')
  console.log('imageData:', imageData)

  try {
    let imageUrl = null

    // Extract URL from different possible formats
    if (typeof imageData === 'string' && imageData.startsWith('http')) {
      imageUrl = imageData
    } else if (typeof imageData === 'object' && imageData.info) {
      // Extract URL from markdown format: ![alt](url)
      const match = imageData.info.match(/!\[.*?\]\((.+?)\)/)
      imageUrl = match ? match[1] : null
    } else if (imageData.url) {
      imageUrl = imageData.url
    }

    console.log('Extracted image URL:', imageUrl)

    if (imageUrl) {
      emit('image-changed', imageUrl)
      closeAIImageModal()
      closeImageModal()
    } else {
      console.error('Could not extract image URL from AI response')
      imageError.value = 'Failed to extract image URL from AI generated image.'
    }
  } catch (error) {
    console.error('Error processing AI generated image:', error)
    imageError.value = 'Failed to process AI generated image.'
  }
}

// URL handling
const validateImageUrl = () => {
  isValidUrl.value =
    imageUrl.value.trim() !== '' &&
    (imageUrl.value.startsWith('http://') || imageUrl.value.startsWith('https://'))
}

const handleUrlPaste = (event) => {
  // Allow normal paste behavior, validation will happen on input
  setTimeout(validateImageUrl, 50)
}

const useImageUrl = async () => {
  if (!isValidUrl.value) return

  isLoadingUrl.value = true
  imageError.value = ''

  try {
    // Test if the URL loads as an image
    await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = resolve
      img.onerror = reject
      img.src = imageUrl.value
    })

    urlPreviewImage.value = imageUrl.value
  } catch (error) {
    imageError.value = 'Invalid image URL or image failed to load.'
  } finally {
    isLoadingUrl.value = false
  }
}

const applyUrlImage = () => {
  if (urlPreviewImage.value) {
    emit('image-changed', urlPreviewImage.value)
    closeImageModal()
  }
}

// Clipboard paste handling
const handlePaste = async (event) => {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault()
      const file = item.getAsFile()
      if (file) {
        await processPastedImage(file)
      }
      return
    }
  }
}

const processPastedImage = async (file) => {
  try {
    isUploadingImage.value = true
    imageError.value = ''

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('https://api.vegvisr.org/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload pasted image')
    }

    const data = await response.json()

    // Handle both single URL and array of URLs from API
    const imageUrl = data.url || (data.urls && Array.isArray(data.urls) ? data.urls[0] : null)
    if (!imageUrl) {
      throw new Error('API did not return an image URL')
    }

    pastedImage.value = {
      url: imageUrl,
      alt: 'Pasted image',
    }

    console.log('✅ Pasted image uploaded:', imageUrl)
  } catch (error) {
    console.error('❌ Paste error:', error)
    imageError.value = 'Failed to process pasted image: ' + error.message
  } finally {
    isUploadingImage.value = false
  }
}

const usePastedImage = () => {
  if (pastedImage.value) {
    emit('image-changed', pastedImage.value.url)
    closeImageModal()
  }
}

const clearPastedImage = () => {
  pastedImage.value = null
}

const addPasteListener = () => {
  document.addEventListener('paste', handlePaste)
}

const removePasteListener = () => {
  document.removeEventListener('paste', handlePaste)
}

// Export functionality
const exportImage = async () => {
  if (!imagequoteElement.value) return

  exporting.value = true

  try {
    // Create a temporary element with the selected dimensions
    const tempElement = imagequoteElement.value.cloneNode(true)
    tempElement.style.width = `${selectedPreset.value.width}px`
    tempElement.style.height = `${selectedPreset.value.height}px`
    tempElement.style.aspectRatio = selectedPreset.value.aspectRatio
    tempElement.style.position = 'absolute'
    tempElement.style.top = '-9999px'
    tempElement.style.left = '-9999px'

    document.body.appendChild(tempElement)

    // Wait for fonts and images to load
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Capture with html2canvas
    const canvas = await html2canvas(tempElement, {
      width: selectedPreset.value.width,
      height: selectedPreset.value.height,
      scale: 1,
      useCORS: true,
      allowTaint: false,
      backgroundColor: exportFormat.value === 'jpg' ? '#ffffff' : null,
      logging: false,
    })

    // Clean up temporary element
    document.body.removeChild(tempElement)

    // Convert to blob and download
    canvas.toBlob(
      (blob) => {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `quote-${selectedPreset.value.name.toLowerCase().replace(/ /g, '-')}.${exportFormat.value}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        emit('exported', {
          format: exportFormat.value,
          size: selectedPreset.value,
          filename: link.download,
        })

        console.log('✅ Image exported successfully:', link.download)
      },
      `image/${exportFormat.value}`,
      exportQuality.value / 100,
    )
  } catch (error) {
    console.error('❌ Export failed:', error)
    alert('Export failed. Please try again.')
  } finally {
    exporting.value = false
    closeExportModal()
  }
}

// Watchers
watch(() => imageUrl.value, validateImageUrl)
</script>

<style scoped>
.gnew-imagequote-container {
  margin: 20px 0;
}

.imagequote {
  margin-bottom: 15px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}

.imagequote:hover {
  transform: translateY(-2px);
}

.imagequote-content {
  max-width: 90%;
}

.quote-text {
  font-size: v-bind(fontSize);
  line-height: 1.4;
  margin-bottom: 1em;
  font-weight: 500;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
}

.quote-citation {
  font-style: italic;
  font-size: 0.9em;
  opacity: 0.9;
  font-weight: 400;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.imagequote-controls {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.image-modal,
.export-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 25px 15px;
  border-bottom: 1px solid #dee2e6;
}

.modal-header h4 {
  margin: 0;
  color: #333;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.btn-close:hover {
  background-color: #f8f9fa;
}

.modal-body {
  padding: 25px;
}

.modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 15px 25px 25px;
  border-top: 1px solid #dee2e6;
}

.form-group {
  margin-bottom: 25px;
}

.form-label {
  display: block;
  margin-bottom: 10px;
  font-weight: 600;
  color: #333;
}

/* Image Modal Specific Styles */
.current-image-section {
  margin-bottom: 25px;
  padding-bottom: 20px;
  border-bottom: 1px solid #dee2e6;
}

.current-image-preview {
  display: flex;
  align-items: center;
  gap: 15px;
}

.current-image-preview img {
  width: 120px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #dee2e6;
}

.current-image-actions {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.image-source-section h5 {
  margin-bottom: 15px;
  color: #333;
}

.image-source-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}

.btn-source {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 15px 10px;
  border: 2px solid;
  border-radius: 8px;
  transition: all 0.2s;
  text-decoration: none;
}

.btn-source:hover {
  transform: translateY(-2px);
}

.btn-source.active {
  background-color: #e7f3ff;
  border-color: #007bff;
}

.btn-source i {
  font-size: 1.2rem;
}

.url-input-section {
  margin-top: 20px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.url-input-group {
  display: flex;
  gap: 10px;
}

.url-input-group input {
  flex: 1;
}

.url-preview {
  margin-top: 15px;
  padding: 15px;
  background-color: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  text-align: center;
}

.url-preview img {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 8px;
  margin-bottom: 10px;
}

.clipboard-paste-area {
  margin-top: 20px;
  padding: 30px;
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  text-align: center;
  background-color: #f8f9fa;
  transition: all 0.2s;
}

.clipboard-paste-area:hover {
  border-color: #007bff;
  background-color: #e7f3ff;
}

.paste-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #666;
}

.paste-icon {
  font-size: 2rem;
}

.paste-text {
  font-size: 0.9rem;
}

.pasted-image-preview {
  margin-top: 20px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.pasted-preview-container {
  display: flex;
  align-items: center;
  gap: 15px;
}

.pasted-preview-container img {
  width: 120px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #28a745;
}

.pasted-actions {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* Export Modal Styles */
.size-presets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.preset-btn:hover {
  border-color: #007bff;
  background-color: #f8f9ff;
}

.preset-btn.active {
  border-color: #007bff;
  background-color: #e7f3ff;
  color: #0056b3;
}

.preset-btn small {
  margin-top: 4px;
  opacity: 0.7;
  font-size: 0.8rem;
}

.format-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-check {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.form-check-input {
  margin: 0;
}

.form-range {
  width: 100%;
}

@media (max-width: 768px) {
  .image-modal,
  .export-modal {
    width: 95%;
    margin: 20px;
  }

  .size-presets {
    grid-template-columns: 1fr;
  }

  .image-source-options {
    grid-template-columns: 1fr;
  }

  .modal-body {
    padding: 20px;
  }

  .quote-text {
    font-size: 1.2rem;
  }

  .current-image-preview,
  .pasted-preview-container {
    flex-direction: column;
    text-align: center;
  }

  .url-input-group {
    flex-direction: column;
  }
}
</style>
