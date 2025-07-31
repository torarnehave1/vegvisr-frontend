<template>
  <div class="gnew-map-node" :class="nodeTypeClass">
    <!-- Node Header -->
    <div v-if="nodeTitle" class="node-header">
      <h3 class="node-title">{{ nodeTitle }}</h3>
      <div v-if="showControls" class="node-controls">
        <!-- Map-specific buttons -->
        <button
          @click="uploadKMLFile"
          class="btn btn-sm btn-success me-1"
          :disabled="mapLoading"
          title="Upload KML file"
        >
          <span v-if="mapLoading" class="spinner-border spinner-border-sm me-1"></span>
          📁
        </button>
        <button
          @click="openMapSettings"
          class="btn btn-sm btn-outline-info me-1"
          title="Map settings"
        >
          ⚙️
        </button>
        <button
          v-if="['Admin', 'Superadmin'].includes(userStore.role) && mapPath"
          @click="editMapPath"
          class="btn btn-sm btn-outline-secondary me-1"
          title="Edit map path"
        >
          🔗
        </button>
        <!-- Standard node buttons -->
        <button @click="editNode" class="btn btn-sm btn-outline-primary me-1" title="Edit Map">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Node">
          🗑️
        </button>
      </div>
    </div>

    <!-- Map Container -->
    <div class="map-container" :style="mapContainerStyles">
      <!-- Map Viewer Component -->
      <div v-if="mapPath" class="map-wrapper">
        <MapViewer
          :path="mapPath"
          :map-id="node.mapId || 'efe3a8a8c093a07cf97c4b3c'"
          :height="node.imageHeight || '600px'"
          @place-changed="onPlaceChanged"
        />
      </div>

      <!-- Map Error State -->
      <div v-else-if="mapError" class="map-error-state">
        <div class="error-icon">🗺️</div>
        <p>Failed to load map</p>
        <small class="text-muted">{{ mapPath }}</small>
        <button
          v-if="showControls && !isPreview"
          @click="editNode"
          class="btn btn-sm btn-primary mt-2"
        >
          Fix Map
        </button>
      </div>

      <!-- Loading State -->
      <div v-else-if="mapLoading" class="map-loading-state">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading map...</span>
        </div>
        <p class="mt-2">Loading map...</p>
      </div>

      <!-- No Map State -->
      <div v-else class="map-empty-state">
        <div class="empty-icon">🗺️</div>
        <p>No map configured</p>
        <small class="text-muted mt-2">Use the 📁 button in the header to upload a KML/KMZ file</small>
      </div>
    </div>

    <!-- Map Info Section -->
    <div v-if="node.info" class="map-info-section" v-html="formattedInfo"></div>

    <!-- Upload Progress Indicator -->
    <div v-if="mapLoading" class="upload-progress">
      <div class="progress">
        <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
      </div>
      <small class="text-muted">Uploading KML file...</small>
    </div>

    <!-- File Upload Input (Hidden) -->
    <input
      ref="fileInput"
      type="file"
      accept=".kml,.kmz"
      style="display: none"
      @change="handleFileUpload"
    />

    <!-- Map Settings Modal -->
    <div v-if="showMapSettings" class="modal modal-show">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">🗺️ Map Settings</h5>
            <button type="button" class="btn-close" @click="closeMapSettings"></button>
          </div>
          <div class="modal-body">
            <div class="form-group mb-3">
              <label for="map-title" class="form-label">Map Title</label>
              <input
                id="map-title"
                v-model="mapSettings.title"
                type="text"
                class="form-control"
                placeholder="Enter map title"
              />
            </div>
            <div class="form-group mb-3">
              <label for="map-width" class="form-label">Map Width</label>
              <input
                id="map-width"
                v-model="mapSettings.width"
                type="text"
                class="form-control"
                placeholder="e.g., 100%, 800px"
              />
            </div>
            <div class="form-group mb-3">
              <label for="map-height" class="form-label">Map Height</label>
              <input
                id="map-height"
                v-model="mapSettings.height"
                type="text"
                class="form-control"
                placeholder="e.g., 400px, 50vh"
              />
            </div>
            <div class="form-group mb-3">
              <label for="map-id" class="form-label">Google Maps ID</label>
              <input
                id="map-id"
                v-model="mapSettings.mapId"
                type="text"
                class="form-control"
                placeholder="Google Maps ID (optional)"
              />
              <small class="form-text text-muted">
                Leave empty to use default map style
              </small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeMapSettings">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" @click="saveMapSettings">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import MapViewer from '@/components/MapViewer.vue'

// Store access
const userStore = useUserStore()

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] }),
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  showControls: {
    type: Boolean,
    default: true,
  },
})

// Emits
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Reactive state
const mapLoading = ref(false)
const mapError = ref(false)
const fileInput = ref(null)
const showMapSettings = ref(false)
const mapSettings = ref({
  title: '',
  width: '',
  height: '',
  mapId: ''
})

// Computed properties
const nodeTypeClass = computed(() => {
  return `gnew-node-${props.node.type || 'default'}`
})

const nodeTitle = computed(() => {
  return props.node.label || 'Map Node'
})

const mapPath = computed(() => {
  return props.node.path || null
})

const mapContainerStyles = computed(() => {
  const styles = {}
  
  if (props.node.imageWidth) {
    styles.width = props.node.imageWidth.includes('%') || props.node.imageWidth.includes('px') 
      ? props.node.imageWidth 
      : `${props.node.imageWidth}px`
  }
  
  if (props.node.imageHeight) {
    styles.height = props.node.imageHeight.includes('%') || props.node.imageHeight.includes('px') 
      ? props.node.imageHeight 
      : `${props.node.imageHeight}px`
  }
  
  // Default height if not specified
  if (!styles.height) {
    styles.height = '400px'
  }
  
  return styles
})

const formattedInfo = computed(() => {
  if (!props.node.info) return ''
  
  // Simple markdown-to-HTML conversion for basic formatting
  return props.node.info
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
})

// Methods
const editNode = () => {
  console.log('🗺️ Editing map node:', props.node.id)
  // Emit edit event - parent component will handle the modal
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this map node?')) {
    console.log('🗑️ Deleting map node:', props.node.id)
    emit('node-deleted', props.node.id)
  }
}

const onPlaceChanged = (placeData) => {
  console.log('📍 Place changed on map:', placeData)
  // Could emit this data for potential node updates
}

const uploadKMLFile = () => {
  console.log('📁 Uploading KML file for map node:', props.node.id)
  fileInput.value?.click()
}

const openMapSettings = () => {
  // Populate current values
  mapSettings.value = {
    title: props.node.label || '',
    width: props.node.imageWidth || '100%',
    height: props.node.imageHeight || '400px',
    mapId: props.node.mapId || ''
  }
  showMapSettings.value = true
}

const closeMapSettings = () => {
  showMapSettings.value = false
}

const saveMapSettings = () => {
  const updatedNode = {
    ...props.node,
    label: mapSettings.value.title || props.node.label,
    imageWidth: mapSettings.value.width || '100%',
    imageHeight: mapSettings.value.height || '400px',
    mapId: mapSettings.value.mapId || props.node.mapId
  }
  
  console.log('⚙️ Updating map settings:', updatedNode)
  emit('node-updated', updatedNode)
  closeMapSettings()
}

const editMapPath = () => {
  const newPath = prompt('Enter new KML path:', mapPath.value || '')
  if (newPath && newPath !== mapPath.value) {
    const updatedNode = {
      ...props.node,
      path: newPath
    }
    console.log('🔗 Updating map path:', newPath)
    emit('node-updated', updatedNode)
  }
}

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  // Validate file type
  const validTypes = ['application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz', '.kml', '.kmz']
  const isValidType = validTypes.some(type => 
    file.type === type || file.name.toLowerCase().endsWith('.kml') || file.name.toLowerCase().endsWith('.kmz')
  )

  if (!isValidType) {
    alert('Please select a valid KML or KMZ file.')
    return
  }

  console.log('📤 Uploading KML file:', file.name, 'Size:', (file.size / 1024).toFixed(1) + 'KB')
  mapLoading.value = true
  mapError.value = false

  try {
    const formData = new FormData()
    formData.append('file', file)

    // Upload KML file to the dedicated KLM bucket
    const response = await fetch('https://api.vegvisr.org/upload-kml', {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type - let browser set it for FormData
      }
    })

    console.log('📡 Upload response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('📡 Upload error response:', errorText)
      throw new Error(`Upload failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('📡 Upload result:', result)
    
    const uploadedPath = result.url || result.path || result.location

    if (!uploadedPath) {
      console.error('📡 No path in response:', result)
      throw new Error('No URL returned from upload service')
    }

    // Update node with new KML path
    const updatedNode = {
      ...props.node,
      path: uploadedPath,
      // If no label exists, use filename
      label: props.node.label || file.name.replace(/\.(kml|kmz)$/i, '')
    }

    console.log('✅ KML file uploaded successfully:', uploadedPath)
    emit('node-updated', updatedNode)

    // Show success message
    setTimeout(() => {
      alert(`✅ KML file "${file.name}" uploaded successfully!`)
    }, 500)

  } catch (error) {
    console.error('❌ KML upload failed:', error)
    mapError.value = true
    alert(`❌ Failed to upload KML file: ${error.message}`)
  } finally {
    mapLoading.value = false
    // Reset file input
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

// Lifecycle
onMounted(() => {
  console.log('🗺️ GNewMapNode mounted:', props.node.id, 'Path:', mapPath.value)
  console.log('🔧 Debug - showControls:', props.showControls, 'isPreview:', props.isPreview)
  console.log('🔧 Debug - Should show buttons:', props.showControls && !props.isPreview)
  console.log('🔧 Debug - User role:', userStore.role)
  console.log('🔧 Debug - Map path exists:', !!mapPath.value)
})
</script>

<style scoped>
.gnew-map-node {
  margin-bottom: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.node-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.node-controls {
  display: flex;
  gap: 8px;
}

.map-container {
  position: relative;
  min-height: 300px;
  width: 100%;
}

.map-wrapper {
  width: 100%;
  height: 100%;
}

.map-error-state,
.map-loading-state,
.map-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 40px;
  color: #666;
  background: #f8f9fa;
}

.map-empty-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.upload-progress {
  padding: 12px 16px;
  background: #e3f2fd;
  border-top: 1px solid #90caf9;
}

.upload-progress .progress {
  height: 4px;
  margin-bottom: 8px;
}

.error-icon,
.empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.6;
}

.map-info-section {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background: #fafafa;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #555;
}

.map-edit-buttons {
  padding: 12px 16px;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 8px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .node-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .node-controls {
    width: 100%;
    justify-content: flex-end;
  }

  .map-edit-buttons {
    flex-wrap: wrap;
  }
}

/* Node type specific styling */
.gnew-node-map {
  border-color: #28a745;
}

.gnew-node-map .node-header {
  background: #e8f5e9;
  border-bottom-color: #28a745;
}

.gnew-node-map .node-title {
  color: #1e7e34;
}

/* Modal styles */
.modal {
  display: none;
  position: fixed;
  z-index: 1050;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-show {
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-dialog {
  max-width: 500px;
  width: 90%;
  margin: 0;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
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
  transition: all 0.2s ease;
}

.btn-close:hover {
  background: #f8f9fa;
  color: #333;
}
</style>
