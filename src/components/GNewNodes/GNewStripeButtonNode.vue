<template>
  <div class="gnew-stripe-button-node" :class="nodeTypeClass">
    <!-- Node Header -->
    <div v-if="showControls && node.label" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ node.label }}</h3>
        <div class="node-type-badge-inline">💳 Stripe Button</div>
      </div>
      <div v-if="!isPreview" class="node-controls">
        <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Stripe Button">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Node">
          🗑️
        </button>
      </div>
    </div>

    <!-- Stripe Button Content -->
    <div class="stripe-button-container">
      <div v-if="isLoading" class="stripe-loading">
        <span class="loading-spinner">⏳</span>
        <span>Loading Stripe...</span>
      </div>

      <div v-else-if="hasError" class="stripe-error">
        <span class="error-icon">⚠️</span>
        <span>Failed to load Stripe button</span>
        <button @click="retryLoad" class="btn btn-sm btn-outline-primary">Retry</button>
        <details class="mt-2">
          <summary class="text-muted small">Debug Info</summary>
          <pre class="small mt-1">{{ JSON.stringify(stripeConfig, null, 2) }}</pre>
        </details>
      </div>

      <div
        v-else-if="stripeConfig.buyButtonId && stripeConfig.publishableKey"
        class="stripe-button-wrapper"
        :id="`stripe-container-${node.id}`"
      >
        <!-- Stripe buy button will be inserted here -->
        <div v-if="!isLoading && !hasError" class="stripe-manual-render">
          <button @click="forceRender" class="btn btn-sm btn-outline-secondary">
            🔄 Force Render
          </button>
        </div>
      </div>

      <div v-else class="stripe-config-needed">
        <p class="text-muted">Stripe button configuration needed</p>
        <button v-if="!isPreview" @click="editNode" class="btn btn-sm btn-primary">
          Configure Stripe Button
        </button>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="modal modal-show">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit Stripe Button</h5>
            <button type="button" class="btn-close" @click="closeEditModal"></button>
          </div>
          <div class="modal-body">
            <div class="form-group mb-3">
              <label for="stripe-label" class="form-label">Button Label</label>
              <input
                id="stripe-label"
                v-model="editForm.label"
                type="text"
                class="form-control"
                placeholder="Buy Now Button"
              />
            </div>

            <div class="form-group mb-3">
              <label for="stripe-buy-button-id" class="form-label">Buy Button ID</label>
              <input
                id="stripe-buy-button-id"
                v-model="editForm.buyButtonId"
                type="text"
                class="form-control"
                placeholder="buy_btn_..."
                required
              />
              <small class="form-text text-muted">
                Your Stripe buy button ID (starts with buy_btn_)
              </small>
            </div>

            <div class="form-group mb-3">
              <label for="stripe-publishable-key" class="form-label">Publishable Key</label>
              <input
                id="stripe-publishable-key"
                v-model="editForm.publishableKey"
                type="text"
                class="form-control"
                placeholder="pk_live_... or pk_test_..."
                required
              />
              <small class="form-text text-muted">
                Your Stripe publishable key (starts with pk_)
              </small>
            </div>

            <div class="form-group mb-3">
              <label for="stripe-description" class="form-label">Description (Optional)</label>
              <textarea
                id="stripe-description"
                v-model="editForm.description"
                class="form-control"
                rows="2"
                placeholder="Brief description of the product or service"
              ></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeEditModal">Cancel</button>
            <button type="button" class="btn btn-primary" @click="saveNode">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true,
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
const emit = defineEmits(['node-updated', 'node-deleted'])

// Reactive state
const isLoading = ref(false)
const hasError = ref(false)
const showEditModal = ref(false)
const stripeScriptLoaded = ref(false)

// Edit form
const editForm = ref({
  label: '',
  buyButtonId: '',
  publishableKey: '',
  description: '',
})

// Computed properties
const nodeTypeClass = computed(() => {
  return `gnew-node-stripe-button`
})

const stripeConfig = computed(() => {
  try {
    if (props.node.info && typeof props.node.info === 'string') {
      return JSON.parse(props.node.info)
    } else if (props.node.info && typeof props.node.info === 'object') {
      return props.node.info
    }
    return {}
  } catch (error) {
    console.warn('Failed to parse Stripe config:', error)
    return {}
  }
})

// Methods
const loadStripeScript = async () => {
  if (stripeScriptLoaded.value) {
    renderStripeButton()
    return
  }

  isLoading.value = true
  hasError.value = false

  try {
    // Check if script already exists
    const existingScript = document.querySelector(
      'script[src="https://js.stripe.com/v3/buy-button.js"]',
    )
    if (existingScript) {
      stripeScriptLoaded.value = true
      renderStripeButton()
      isLoading.value = false
      return
    }

    // Load Stripe script
    const script = document.createElement('script')
    script.src = 'https://js.stripe.com/v3/buy-button.js'
    script.async = true

    script.onload = () => {
      console.log('Stripe script loaded successfully')
      stripeScriptLoaded.value = true
      isLoading.value = false
      renderStripeButton()
    }

    script.onerror = (error) => {
      console.error('Failed to load Stripe script:', error)
      hasError.value = true
      isLoading.value = false
    }

    document.head.appendChild(script)
  } catch (error) {
    console.error('Error loading Stripe script:', error)
    hasError.value = true
    isLoading.value = false
  }
}

const renderStripeButton = () => {
  if (!stripeConfig.value.buyButtonId || !stripeConfig.value.publishableKey) {
    console.warn('Missing Stripe configuration:', stripeConfig.value)
    return
  }

  // Wait for next tick to ensure DOM is ready
  nextTick(() => {
    const container = document.getElementById(`stripe-container-${props.node.id}`)
    if (!container) {
      console.warn('Stripe container not found for node:', props.node.id)
      hasError.value = true
      return
    }

    // Clear existing content
    container.innerHTML = ''

    try {
      // Create stripe-buy-button element
      const stripeButton = document.createElement('stripe-buy-button')
      stripeButton.setAttribute('buy-button-id', stripeConfig.value.buyButtonId)
      stripeButton.setAttribute('publishable-key', stripeConfig.value.publishableKey)

      // Add error handling for the Stripe button
      stripeButton.addEventListener('error', (event) => {
        console.error('Stripe button error:', event)
        hasError.value = true
      })

      container.appendChild(stripeButton)
      console.log('Stripe button rendered successfully for node:', props.node.id)
    } catch (error) {
      console.error('Error creating Stripe button:', error)
      hasError.value = true
    }
  })
}

const retryLoad = () => {
  hasError.value = false
  isLoading.value = false
  stripeScriptLoaded.value = false

  // Force reload after a short delay
  setTimeout(() => {
    loadStripeScript()
  }, 100)
}

const forceRender = () => {
  if (stripeScriptLoaded.value) {
    renderStripeButton()
  } else {
    loadStripeScript()
  }
}

const editNode = () => {
  // Populate edit form with current values
  editForm.value = {
    label: props.node.label || 'Stripe Buy Button',
    buyButtonId: stripeConfig.value.buyButtonId || '',
    publishableKey: stripeConfig.value.publishableKey || '',
    description: stripeConfig.value.description || '',
  }
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
}

const saveNode = () => {
  // Create updated node data
  const updatedConfig = {
    buyButtonId: editForm.value.buyButtonId.trim(),
    publishableKey: editForm.value.publishableKey.trim(),
    description: editForm.value.description.trim(),
  }

  const updatedNode = {
    ...props.node,
    label: editForm.value.label.trim() || 'Stripe Buy Button',
    info: JSON.stringify(updatedConfig),
  }

  emit('node-updated', updatedNode)
  closeEditModal()
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this Stripe button?')) {
    emit('node-deleted', props.node.id)
  }
}

// Watch for config changes to re-render button
watch(
  () => stripeConfig.value,
  (newConfig) => {
    console.log('Stripe config changed:', newConfig)
    if (stripeScriptLoaded.value && newConfig.buyButtonId && newConfig.publishableKey) {
      renderStripeButton()
    }
  },
  { deep: true },
)

// Lifecycle
onMounted(() => {
  console.log('GNewStripeButtonNode mounted for node:', props.node.id)
  console.log('Stripe config:', stripeConfig.value)

  if (stripeConfig.value.buyButtonId && stripeConfig.value.publishableKey) {
    // Try loading immediately
    loadStripeScript()

    // Also try again after a delay in case DOM isn't ready
    setTimeout(() => {
      if (!stripeScriptLoaded.value || hasError.value) {
        console.log('Retrying Stripe script load after delay')
        loadStripeScript()
      }
    }, 1000)
  } else {
    console.warn('Missing Stripe configuration on mount')
  }
})
</script>

<style scoped>
.gnew-stripe-button-node {
  border: 2px solid #635bff;
  border-radius: 12px;
  background: #ffffff;
  padding: 16px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(99, 91, 255, 0.1);
  transition: all 0.3s ease;
}

.gnew-stripe-button-node:hover {
  border-color: #524ae6;
  box-shadow: 0 4px 16px rgba(99, 91, 255, 0.15);
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(99, 91, 255, 0.2);
}

.node-title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.node-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #1a1a1a;
}

.node-type-badge-inline {
  background: linear-gradient(135deg, #635bff, #524ae6);
  color: white;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 500;
}

.node-controls {
  display: flex;
  gap: 8px;
}

.stripe-button-container {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stripe-loading,
.stripe-error,
.stripe-config-needed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  text-align: center;
}

.loading-spinner {
  font-size: 1.5rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.error-icon {
  font-size: 1.5rem;
  color: #dc3545;
}

.stripe-button-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px;
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

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:before {
  content: '×';
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

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
}

.form-control:focus {
  outline: none;
  border-color: #635bff;
  box-shadow: 0 0 0 2px rgba(99, 91, 255, 0.2);
}

.form-text {
  font-size: 0.8rem;
  margin-top: 0.25rem;
  display: block;
}

/* Button styles */
.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

.btn-primary {
  background: #635bff;
  color: white;
}

.btn-primary:hover {
  background: #524ae6;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-outline-primary {
  background: transparent;
  color: #635bff;
  border: 1px solid #635bff;
}

.btn-outline-primary:hover {
  background: #635bff;
  color: white;
}

.btn-outline-danger {
  background: transparent;
  color: #dc3545;
  border: 1px solid #dc3545;
}

.btn-outline-danger:hover {
  background: #dc3545;
  color: white;
}

.text-muted {
  color: #6c757d;
}

.stripe-manual-render {
  text-align: center;
  padding: 10px;
  opacity: 0.7;
}

.stripe-manual-render:hover {
  opacity: 1;
}

.mt-1 {
  margin-top: 0.25rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

.small {
  font-size: 0.8rem;
}

details {
  margin-top: 0.5rem;
}

summary {
  cursor: pointer;
  padding: 0.25rem 0;
}

pre {
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  overflow-x: auto;
}
</style>
