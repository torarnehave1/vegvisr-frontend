<template>
  <div v-if="isOpen" class="google-photos-modal">
    <div class="google-photos-content">
      <div class="google-photos-header">
        <h3>📷 Select from Google Photos</h3>
        <button class="google-photos-close" @click="closeModal" title="Close">&times;</button>
      </div>

      <div class="google-photos-body">
        <!-- Connection Status -->
        <div v-if="!userStore.googlePhotosConnected" class="connection-section">
          <div class="connection-info">
            <h4>🔗 Connect Your Google Photos</h4>
            <p>Access your Google Photos library to select images for your content.</p>
          </div>

          <button
            @click="connectGooglePhotos"
            :disabled="connecting"
            class="btn btn-primary connect-btn"
          >
            <span v-if="connecting" class="spinner-sm"></span>
            {{ connecting ? 'Connecting...' : '📷 Connect Google Photos' }}
          </button>
        </div>

        <!-- Connected Interface -->
        <div v-if="userStore.googlePhotosConnected" class="picker-section">
          <div class="connection-status">
            <span class="status-icon">✅</span>
            <span>Connected to Google Photos</span>
            <button @click="disconnect" class="btn btn-link btn-sm">Disconnect</button>
          </div>

          <div class="picker-interface">
            <div class="picker-info">
              <h4>🖼️ Choose Your Photos</h4>
              <p>Click the button below to open Google Photos picker and select images.</p>
            </div>

            <button @click="openPicker" :disabled="loading" class="btn btn-primary picker-btn">
              <span v-if="loading" class="spinner-sm"></span>
              {{ loading ? 'Opening Picker...' : '🎨 Browse Google Photos' }}
            </button>
          </div>

          <!-- Selected Photos Grid -->
          <div v-if="selectedPhotos.length > 0" class="selected-photos-section">
            <h4>📸 Selected Photos</h4>
            <div class="photos-grid">
              <div
                v-for="photo in selectedPhotos"
                :key="photo.id"
                class="photo-option"
                :class="{ active: activePhoto?.id === photo.id }"
                @click="setActivePhoto(photo)"
              >
                <img :src="photo.url" :alt="photo.alt" />
                <div class="photo-overlay">
                  <div class="photo-info">
                    <p class="photo-name">{{ photo.alt }}</p>
                  </div>
                  <div v-if="activePhoto?.id === photo.id" class="selected-indicator">
                    ✓ Selected
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="error-section">
          <div class="error-message">
            <span class="error-icon">⚠️</span>
            {{ error }}
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="google-photos-footer">
        <div class="selected-preview" v-if="activePhoto">
          <h5>Selected Photo Preview</h5>
          <img :src="activePhoto.url" :alt="activePhoto.alt" class="preview-image" />
          <p class="preview-info">{{ activePhoto.alt }}</p>
        </div>

        <div class="action-buttons">
          <button @click="closeModal" class="btn btn-secondary">Cancel</button>
          <button
            @click="useSelectedPhoto"
            :disabled="!activePhoto || applying"
            class="btn btn-primary"
          >
            <span v-if="applying" class="spinner-sm"></span>
            {{ applying ? 'Applying...' : 'Use This Photo' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useUserStore } from '../stores/userStore'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  imageType: {
    type: String,
    default: 'Unknown',
  },
  imageContext: {
    type: String,
    default: 'No context provided',
  },
})

const emit = defineEmits(['close', 'photo-selected'])

// State
const connecting = ref(false)
const loading = ref(false)
const applying = ref(false)
const error = ref('')
const selectedPhotos = ref([])
const activePhoto = ref(null)

// Store
const userStore = useUserStore()

// Methods
const connectGooglePhotos = async () => {
  connecting.value = true
  error.value = ''

  try {
    if (!userStore.loggedIn || !userStore.email) {
      error.value = 'Please log in first to connect Google Photos'
      return
    }

    if (userStore.googlePhotosCredentials) {
      console.log('✅ Already have credentials')
      return
    }

    await userStore.connectGooglePhotos()
  } catch (err) {
    error.value = 'Failed to connect to Google Photos: ' + err.message
    console.error('Google Photos connection error:', err)
  } finally {
    connecting.value = false
  }
}

const openPicker = async () => {
  loading.value = true
  error.value = ''

  try {
    if (!userStore.googlePhotosCredentials) {
      error.value = 'Please connect to Google Photos first'
      return
    }

    console.log('🖼️ Creating Google Photos Picker session...')

    // Create a new picker session using the proper Picker API
    const response = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userStore.googlePhotosCredentials.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to create picker session: ${response.status}`)
    }

    const sessionData = await response.json()
    console.log('📸 Picker session created:', sessionData)

    if (sessionData.pickerUri) {
      // Open the picker URI in a new window/tab
      window.open(sessionData.pickerUri, '_blank', 'width=800,height=600')

      // Start polling for results
      pollPickerSession(sessionData.id)
    } else {
      throw new Error('No picker URI received from Google')
    }
  } catch (err) {
    error.value = 'Failed to open Google Photos picker: ' + err.message
    console.error('Google Photos picker error:', err)
  } finally {
    loading.value = false
  }
}

// Poll the picker session until photos are selected
const pollPickerSession = async (sessionId) => {
  console.log('🔄 Starting to poll picker session:', sessionId)

  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${userStore.googlePhotosCredentials.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to poll session: ${response.status}`)
      }

      const sessionStatus = await response.json()
      console.log('📊 Session status:', sessionStatus)

      // Check if user has selected photos
      if (sessionStatus.mediaItemsSet) {
        console.log('✅ User has selected photos!')
        clearInterval(pollInterval)

        // Get the selected media items
        await getSelectedMediaItems(sessionId)
      }
    } catch (error) {
      console.error('❌ Error polling session:', error)
      clearInterval(pollInterval)
      error.value = 'Failed to check picker status: ' + error.message
    }
  }, 3000) // Poll every 3 seconds

  // Stop polling after 5 minutes
  setTimeout(() => {
    clearInterval(pollInterval)
    console.log('⏰ Picker polling timeout')
  }, 300000)
}

// Get the selected media items from the session
const getSelectedMediaItems = async (sessionId) => {
  try {
    const response = await fetch(
      `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`,
      {
        headers: {
          Authorization: `Bearer ${userStore.googlePhotosCredentials.access_token}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to get media items: ${response.status}`)
    }

    const mediaData = await response.json()
    console.log('📸 Selected media items:', mediaData)

    if (mediaData.mediaItems && mediaData.mediaItems.length > 0) {
      // Convert Google Photos API results to our format
      console.log('🔍 Processing media items:', mediaData.mediaItems)

      // Process media items and create proxy URLs
      const newPhotos = []

      for (const item of mediaData.mediaItems) {
        const baseUrl = item.mediaFile.baseUrl + '=w800-h600'
        console.log('📸 Processing item:', {
          id: item.id,
          filename: item.mediaFile.filename,
          baseUrl: item.mediaFile.baseUrl,
          dimensions: `${item.mediaFile.mediaFileMetadata.width}x${item.mediaFile.mediaFileMetadata.height}`,
        })

        try {
          // Fetch image through proxy
          const proxyResponse = await fetch('https://auth.vegvisr.org/picker/proxy-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              baseUrl: baseUrl,
              user_email: userStore.email,
            }),
          })

          if (proxyResponse.ok) {
            // Create blob URL for the image
            const imageBlob = await proxyResponse.blob()
            const blobUrl = URL.createObjectURL(imageBlob)

            newPhotos.push({
              id: 'picker-' + item.id,
              url: blobUrl,
              alt: item.mediaFile.filename || 'Google Photos image',
              photographer: 'Your Google Photos',
              isGooglePhoto: true,
              originalItem: item,
            })
          } else {
            console.error('Failed to proxy image:', item.id)
          }
        } catch (error) {
          console.error('Error proxying image:', error)
        }
      }

      selectedPhotos.value = newPhotos
      if (newPhotos.length > 0) {
        activePhoto.value = newPhotos[0] // Auto-select first photo
      }

      console.log('✅ Photos processed:', selectedPhotos.value)
    }
  } catch (error) {
    console.error('❌ Error getting media items:', error)
    error.value = 'Failed to get selected photos: ' + error.message
  }
}

const setActivePhoto = (photo) => {
  activePhoto.value = photo
}

const useSelectedPhoto = async () => {
  if (!activePhoto.value) return

  applying.value = true

  try {
    console.log('=== Processing Selected Photo for Permanent Storage ===')
    console.log('Selected photo:', activePhoto.value)

    // Get the original Google Photos item
    const originalItem = activePhoto.value.originalItem
    if (!originalItem || !originalItem.mediaFile) {
      throw new Error('Original photo data not found')
    }

    // Download the image from Google Photos using our proxy at higher resolution
    console.log('📥 Downloading high-resolution image from Google Photos...')
    const highResUrl = originalItem.mediaFile.baseUrl + '=w1200-h800' // Higher resolution

    const proxyResponse = await fetch('https://auth.vegvisr.org/picker/proxy-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        baseUrl: highResUrl,
        user_email: userStore.email,
      }),
    })

    if (!proxyResponse.ok) {
      throw new Error('Failed to download image from Google Photos')
    }

    const imageBlob = await proxyResponse.blob()
    console.log('✅ Image downloaded, size:', imageBlob.size, 'bytes')

    // Create a File object for upload
    const fileName = `google-photos-${Date.now()}.jpg`
    const file = new File([imageBlob], fileName, { type: 'image/jpeg' })

    // Upload to R2 bucket via api-worker
    console.log('☁️ Uploading to permanent storage...')
    const formData = new FormData()
    formData.append('file', file)

    const uploadResponse = await fetch('https://api.vegvisr.org/upload', {
      method: 'POST',
      body: formData,
    })

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload image to storage')
    }

    const uploadData = await uploadResponse.json()
    console.log('✅ Image uploaded successfully:', uploadData.url)

    // Convert blog.vegvisr.org URL to imgix URL
    const blogUrl = uploadData.url
    const fileName = blogUrl.split('/').pop()
    const imgixUrl = `https://vegvisr.imgix.net/${fileName}`

    console.log('🔄 Converting URL:', blogUrl, '→', imgixUrl)

    // Create the final photo object with permanent imgix URL
    const permanentPhoto = {
      ...activePhoto.value,
      url: imgixUrl, // Use the permanent imgix URL
      isGooglePhoto: true,
      originalGoogleUrl: activePhoto.value.url, // Keep reference to blob URL
      permanentUrl: imgixUrl,
    }

    // Clean up the blob URL
    if (activePhoto.value.url && activePhoto.value.url.startsWith('blob:')) {
      URL.revokeObjectURL(activePhoto.value.url)
    }

    console.log('📸 Photo ready with permanent URL')

    emit('photo-selected', {
      photo: permanentPhoto,
      imageType: props.imageType,
    })

    closeModal()
  } catch (err) {
    error.value = 'Failed to process photo: ' + err.message
    console.error('Photo processing error:', err)
  } finally {
    applying.value = false
  }
}

const disconnect = () => {
  // Clean up blob URLs
  selectedPhotos.value.forEach((photo) => {
    if (photo.url && photo.url.startsWith('blob:')) {
      URL.revokeObjectURL(photo.url)
    }
  })

  userStore.disconnectGooglePhotos()
  selectedPhotos.value = []
  activePhoto.value = null
  console.log('🔌 Disconnected from Google Photos')
}

const closeModal = () => {
  // Clean up blob URLs to prevent memory leaks
  selectedPhotos.value.forEach((photo) => {
    if (photo.url && photo.url.startsWith('blob:')) {
      URL.revokeObjectURL(photo.url)
    }
  })

  selectedPhotos.value = []
  activePhoto.value = null
  error.value = ''
  emit('close')
}

// Check connection on mount
const checkConnection = async () => {
  if (userStore.loggedIn && userStore.email) {
    await userStore.checkGooglePhotosConnection()
  }
}

// Auto-check connection when modal opens
const handleModalOpen = () => {
  if (props.isOpen) {
    checkConnection()
    userStore.handleGooglePhotosOAuthReturn()
  }
}

// Watch for modal open
import { watch } from 'vue'
watch(() => props.isOpen, handleModalOpen)
</script>

<style scoped>
.google-photos-modal {
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

.google-photos-content {
  background: #fff;
  border-radius: 16px;
  width: 95%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.google-photos-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
  background: linear-gradient(135deg, #4285f4, #34a853);
  color: white;
}

.google-photos-header h3 {
  margin: 0;
  font-size: 1.4rem;
}

.google-photos-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: white;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.google-photos-close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.google-photos-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  min-height: 0;
}

.connection-section {
  text-align: center;
  padding: 40px 20px;
}

.connection-info h4 {
  margin: 0 0 12px 0;
  font-size: 1.2rem;
  color: #333;
}

.connection-info p {
  margin: 0 0 24px 0;
  color: #666;
  font-size: 1rem;
}

.connect-btn {
  padding: 12px 24px;
  font-size: 1rem;
  border-radius: 8px;
  background: #4285f4;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0 auto;
  transition: background 0.2s ease;
}

.connect-btn:hover:not(:disabled) {
  background: #3367d6;
}

.connect-btn:disabled {
  background: #9aa0a6;
  cursor: not-allowed;
}

.picker-section {
  max-width: 600px;
  margin: 0 auto;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  padding: 12px 16px;
  background: #e8f5e8;
  border-radius: 8px;
  font-size: 0.9rem;
}

.status-icon {
  font-size: 1.1rem;
}

.picker-interface {
  text-align: center;
  padding: 20px;
  border: 2px dashed #4285f4;
  border-radius: 12px;
  background: #f8f9ff;
}

.picker-interface h4 {
  margin: 0 0 8px 0;
  color: #4285f4;
  font-size: 1.1rem;
}

.picker-interface p {
  margin: 0 0 20px 0;
  color: #666;
  font-size: 0.9rem;
}

.picker-btn {
  padding: 12px 24px;
  font-size: 1rem;
  border-radius: 8px;
  background: #4285f4;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0 auto;
  transition: background 0.2s ease;
}

.picker-btn:hover:not(:disabled) {
  background: #3367d6;
}

.picker-btn:disabled {
  background: #9aa0a6;
  cursor: not-allowed;
}

.selected-photos-section {
  margin-top: 32px;
}

.selected-photos-section h4 {
  margin: 0 0 16px 0;
  font-size: 1.1rem;
  color: #333;
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.photo-option {
  position: relative;
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  border: 3px solid transparent;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.photo-option:hover {
  border-color: #4285f4;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(66, 133, 244, 0.3);
}

.photo-option.active {
  border-color: #4285f4;
  box-shadow: 0 6px 20px rgba(66, 133, 244, 0.4);
  transform: translateY(-2px);
}

.photo-option img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  display: block;
}

.photo-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  color: white;
  padding: 8px;
  transform: translateY(100%);
  transition: transform 0.2s ease;
}

.photo-option:hover .photo-overlay {
  transform: translateY(0);
}

.photo-info .photo-name {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 500;
}

.selected-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #34a853;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.error-section {
  text-align: center;
  padding: 20px;
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 16px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  color: #721c24;
  font-size: 0.9rem;
}

.error-icon {
  font-size: 1.1rem;
}

.google-photos-footer {
  border-top: 1px solid #e9ecef;
  padding: 20px 24px;
  background: #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
}

.selected-preview {
  flex: 1;
  max-width: 300px;
}

.selected-preview h5 {
  margin: 0 0 10px 0;
  font-size: 1rem;
  color: #333;
}

.preview-image {
  width: 100%;
  max-width: 150px;
  height: 100px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.preview-info {
  margin: 8px 0 0 0;
  font-size: 0.85rem;
  color: #666;
}

.action-buttons {
  display: flex;
  gap: 12px;
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
  background: #4285f4;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #3367d6;
}

.btn-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.btn-link {
  background: none;
  color: #4285f4;
  text-decoration: underline;
  padding: 4px 8px;
  font-size: 0.8rem;
}

.btn-link:hover {
  color: #3367d6;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 0.8rem;
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
  .google-photos-content {
    width: 98%;
    max-height: 95vh;
  }

  .google-photos-body {
    padding: 16px;
  }

  .photos-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }

  .google-photos-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding: 16px;
  }

  .action-buttons {
    justify-content: stretch;
  }

  .action-buttons .btn {
    flex: 1;
  }
}
</style>
