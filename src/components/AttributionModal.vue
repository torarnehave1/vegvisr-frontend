<template>
  <div v-if="isOpen" class="attribution-modal-overlay" @click="closeModal">
    <div class="attribution-modal" @click.stop>
      <div class="attribution-modal-header">
        <h3>Update Image Attribution</h3>
        <button @click="closeModal" class="close-btn">&times;</button>
      </div>

      <div class="attribution-modal-body">
        <!-- Current Image Info -->
        <div class="current-image-info">
          <img v-if="imageUrl" :src="imageUrl" :alt="imageAlt" class="current-image-preview" />
          <div class="image-details">
            <p><strong>Image Type:</strong> {{ imageType }}</p>
            <p><strong>Context:</strong> {{ imageContext }}</p>
          </div>
        </div>

        <!-- Attribution Form -->
        <div class="attribution-form">
          <h4>Attribution Details</h4>

          <div class="form-group">
            <label for="photographer">Photographer Name</label>
            <input
              id="photographer"
              v-model="photographer"
              type="text"
              class="form-control"
              placeholder="Enter photographer name"
            />
          </div>

          <div class="form-group">
            <label for="photographer-url">Photographer URL (optional)</label>
            <input
              id="photographer-url"
              v-model="photographerUrl"
              type="url"
              class="form-control"
              placeholder="https://photographer-website.com"
            />
          </div>

          <div class="form-group">
            <label for="custom-attribution">Custom Attribution Text (optional)</label>
            <input
              id="custom-attribution"
              v-model="customAttribution"
              type="text"
              class="form-control"
              placeholder="Additional attribution text"
            />
          </div>

          <!-- Preview -->
          <div v-if="attributionPreview" class="attribution-preview">
            <h5>Preview:</h5>
            <div class="preview-text" v-html="attributionPreview"></div>
          </div>
        </div>
      </div>

      <div class="attribution-modal-footer">
        <button @click="closeModal" class="btn btn-secondary">Cancel</button>
        <button
          @click="removeAttribution"
          class="btn btn-danger"
          :disabled="!hasExistingAttribution"
        >
          Remove Attribution
        </button>
        <button
          @click="saveAttribution"
          class="btn btn-primary"
          :disabled="!photographer.trim() && !customAttribution.trim()"
        >
          {{ hasExistingAttribution ? 'Update Attribution' : 'Save Attribution' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  imageUrl: {
    type: String,
    default: '',
  },
  imageAlt: {
    type: String,
    default: '',
  },
  imageType: {
    type: String,
    default: '',
  },
  imageContext: {
    type: String,
    default: '',
  },
  nodeId: {
    type: String,
    default: '',
  },
  currentAttribution: {
    type: Object,
    default: null,
  },
})

// Emits
const emit = defineEmits(['close', 'attribution-saved', 'attribution-removed'])

// Reactive data
const photographer = ref('')
const photographerUrl = ref('')
const customAttribution = ref('')

// Computed
const hasExistingAttribution = computed(() => {
  return props.currentAttribution && props.currentAttribution.requires_attribution
})

const attributionPreview = computed(() => {
  if (!photographer.value.trim() && !customAttribution.value.trim()) {
    return null
  }

  let html = ''

  if (photographer.value.trim()) {
    html += 'Photo by '
    if (photographerUrl.value.trim()) {
      html += `<a href="${photographerUrl.value}" target="_blank" rel="noopener" class="photographer-link">${photographer.value}</a>`
    } else {
      html += `<span class="photographer-name">${photographer.value}</span>`
    }
  }

  if (customAttribution.value.trim()) {
    html += photographer.value.trim() ? ` - ${customAttribution.value}` : customAttribution.value
  }

  return html
})

// Methods
const closeModal = () => {
  emit('close')
}

const saveAttribution = () => {
  const attributionData = {
    provider: 'custom',
    photographer: photographer.value.trim() || null,
    photographer_url: photographerUrl.value.trim() || null,
    custom_attribution: customAttribution.value.trim() || null,
    requires_attribution: !!(photographer.value.trim() || customAttribution.value.trim()),
  }

  emit('attribution-saved', {
    imageUrl: props.imageUrl,
    nodeId: props.nodeId,
    attribution: attributionData,
  })
}

const removeAttribution = () => {
  emit('attribution-removed', {
    imageUrl: props.imageUrl,
    nodeId: props.nodeId,
  })
}

// Watch for modal opening to populate fields
watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue && props.currentAttribution) {
      // Populate fields with current attribution
      const attr = props.currentAttribution
      if (attr.provider === 'custom') {
        photographer.value = attr.photographer || ''
        photographerUrl.value = attr.photographer_url || ''
        customAttribution.value = attr.custom_attribution || ''
      } else {
        // For non-custom attributions, show read-only info
        photographer.value = attr.photographer || ''
        photographerUrl.value = attr.photographer_url || ''
        customAttribution.value = ''
      }
    } else if (newValue) {
      // Reset for new attribution
      photographer.value = ''
      photographerUrl.value = ''
      customAttribution.value = ''
    }
  },
)
</script>

<style scoped>
.attribution-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.attribution-modal {
  background: white;
  border-radius: 8px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.attribution-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.attribution-modal-header h3 {
  margin: 0;
  color: #343a40;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f8f9fa;
  color: #495057;
}

.attribution-modal-body {
  padding: 20px;
}

.current-image-info {
  display: flex;
  gap: 15px;
  margin-bottom: 25px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
}

.current-image-preview {
  width: 100px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.image-details p {
  margin: 0 0 5px 0;
  font-size: 0.9rem;
  color: #495057;
}

.attribution-form h4 {
  margin: 0 0 20px 0;
  color: #343a40;
  font-size: 1.1rem;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #495057;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: border-color 0.2s ease;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.attribution-preview {
  margin-top: 20px;
  padding: 15px;
  background: #e9ecef;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.attribution-preview h5 {
  margin: 0 0 10px 0;
  font-size: 0.9rem;
  color: #495057;
}

.preview-text {
  font-size: 0.85rem;
  color: #343a40;
}

.preview-text .photographer-link {
  color: #007bff;
  text-decoration: none;
  border-bottom: 1px solid rgba(0, 123, 255, 0.3);
}

.preview-text .photographer-name {
  font-weight: 500;
}

.attribution-modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 20px;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

/* Mobile responsiveness */
@media (max-width: 576px) {
  .attribution-modal {
    margin: 10px;
    max-width: calc(100vw - 20px);
  }

  .current-image-info {
    flex-direction: column;
  }

  .current-image-preview {
    width: 100%;
    height: 120px;
  }

  .attribution-modal-footer {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
