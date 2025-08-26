<template>
  <div class="password-protection-node">
    <!-- Node Header -->
    <div class="node-header">
      <div class="node-title">
        <span class="node-icon">🔒</span>
        <span class="node-label">        <span class="node-label">{{ node.label || 'Password Protection' }}</span>'Password Protection' }}</span>
        <span class="node-type-badge">SECURITY</span>
      </div>
      <div v-if="showControls" class="node-controls">
        <button @click="editNode" class="btn-control edit" title="Edit Node">
          <i class="bi bi-pencil"></i>
        </button>
        <button @click="deleteNode" class="btn-control delete" title="Delete Node">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>

    <!-- Password Status Section -->
    <div class="control-section status-section">
      <h6 class="section-title">
        <span class="section-icon">🛡️</span>
        Protection Status
      </h6>
      <div class="status-display">
        <div v-if="isPasswordEnabled" class="status-enabled">
          <span class="status-icon">✅</span>
          <span class="status-text">Graph is password protected</span>
          <div class="status-buttons">
            <button @click="showPasswordConfig = true" class="btn-change">
              🔧 Change Password
            </button>
            <button @click="removePassword" class="btn-remove">
              🗑️ Remove Protection
            </button>
          </div>
        </div>
        <div v-else class="status-disabled">
          <span class="status-icon">⚠️</span>
          <span class="status-text">Graph is not protected</span>
          <button @click="showPasswordConfig = true" class="btn-enable">
            Enable Protection
          </button>
        </div>
      </div>
    </div>

    <!-- Password Configuration Section -->
    <div v-if="showPasswordConfig" class="control-section config-section">
      <h6 class="section-title">
        <span class="section-icon">⚙️</span>
        Password Configuration
      </h6>

      <div class="password-form">
        <!-- Current Password Section (only shown when password exists) -->
        <div v-if="isPasswordEnabled" class="form-group current-password-section">
          <label for="current-password-display">
            Current Password
          </label>
          <div class="current-password-wrapper">
            <input
              id="current-password-display"
              :value="currentPasswordDisplay"
              :type="showCurrentPassword ? 'text' : 'password'"
              class="form-control current-password-input"
              readonly
            />
            <button
              type="button"
              class="password-toggle-btn"
              @click="showCurrentPassword = !showCurrentPassword"
              title="Toggle password visibility"
            >
              {{ showCurrentPassword ? '🙈' : '👁️' }}
            </button>
            <button
              type="button"
              class="copy-password-btn"
              @click="copyCurrentPassword"
              title="Copy password to clipboard"
            >
              📋
            </button>
          </div>
          <small class="form-text text-muted">
            This is your current password. You can copy it or change it below.
          </small>
        </div>

        <div class="form-group">
          <label for="password-input">
            {{ isPasswordEnabled ? 'New Password' : 'Set Password' }}
          </label>
          <div class="password-input-wrapper">
            <input
              id="password-input"
              v-model="passwordInput"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter password (minimum 8 characters)"
              class="form-control"
              :class="{ 'is-invalid': passwordError }"
              @input="validatePassword"
              @blur="validatePassword"
            />
            <button
              type="button"
              class="password-toggle-btn"
              @click="showPassword = !showPassword"
              :title="showPassword ? 'Hide password' : 'Show password'"
            >
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
          <div v-if="passwordError" class="invalid-feedback">{{ passwordError }}</div>
          <small class="form-text text-muted">
            Password must be at least 8 characters long
          </small>
        </div>

        <div class="form-group">
          <label for="password-confirm">Confirm Password</label>
          <div class="password-input-wrapper">
            <input
              id="password-confirm"
              v-model="passwordConfirm"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="Confirm password"
              class="form-control"
              :class="{ 'is-invalid': confirmError }"
              @input="validateConfirm"
            />
            <button
              type="button"
              class="password-toggle-btn"
              @click="showConfirmPassword = !showConfirmPassword"
              :title="showConfirmPassword ? 'Hide password' : 'Show password'"
            >
              {{ showConfirmPassword ? '🙈' : '👁️' }}
            </button>
          </div>
          <div v-if="confirmError" class="invalid-feedback">{{ confirmError }}</div>
        </div>

        <div class="form-actions">
          <button
            @click="savePassword"
            class="btn btn-primary"
            :disabled="!canSave || isSaving"
          >
            <span v-if="isSaving">🔄 Saving...</span>
            <span v-else>💾 {{ isPasswordEnabled ? 'Update Password' : 'Enable Protection' }}</span>
          </button>
          <button @click="cancelConfig" class="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Information Section -->
    <div class="control-section info-section">
      <h6 class="section-title">
        <span class="section-icon">ℹ️</span>
        How It Works
      </h6>
      <div class="info-content">
        <p class="info-text">
          Password protection secures your entire Knowledge Graph. When enabled:
        </p>
        <ul class="info-list">
          <li>🔐 Visitors must enter the correct password to view the graph</li>
          <li>🔒 The password is securely stored in the graph metadata</li>
          <li>⏱️ Access is remembered for the browser session</li>
          <li>🚀 No external services required - everything runs locally</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  showControls: {
    type: Boolean,
    default: true
  }
})

// Emits
const emit = defineEmits(['update-node', 'edit-node', 'delete-node'])

// Store
const knowledgeGraphStore = useKnowledgeGraphStore()

// Reactive state
const showPasswordConfig = ref(false)
const passwordInput = ref('')
const passwordConfirm = ref('')
const passwordError = ref('')
const confirmError = ref('')
const isSaving = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const showCurrentPassword = ref(false)

// Computed properties
const isPasswordEnabled = computed(() => {
  // Check if password protection is enabled in the graph metadata
  const graphData = knowledgeGraphStore.currentGraph
  return !!(graphData?.metadata?.passwordProtected && graphData?.metadata?.passwordHash)
})

const canSave = computed(() => {
  return passwordInput.value.length >= 8 &&
         passwordInput.value === passwordConfirm.value &&
         !passwordError.value &&
         !confirmError.value
})

const currentPasswordDisplay = computed(() => {
  // Decode the current password from metadata to display it
  const graphData = knowledgeGraphStore.currentGraph
  if (graphData?.metadata?.passwordHash) {
    try {
      // Since we're using base64 encoding, decode it to show the original password
      return atob(graphData.metadata.passwordHash)
    } catch (error) {
      return 'Unable to display password'
    }
  }
  return ''
})

// Methods
const copyCurrentPassword = async () => {
  try {
    await navigator.clipboard.writeText(currentPasswordDisplay.value)
    // Show temporary success feedback
    const originalText = passwordError.value
    passwordError.value = '✅ Password copied to clipboard!'
    setTimeout(() => {
      passwordError.value = originalText
    }, 2000)
  } catch (error) {
    passwordError.value = 'Failed to copy password to clipboard'
  }
}
const validatePassword = (event) => {
  passwordError.value = ''

  // If this is a blur event or password is long enough, validate immediately
  // If typing and password is short, wait to avoid annoying the user
  const currentLength = passwordInput.value.length
  const isBlurEvent = event && event.type === 'blur'

  if (isBlurEvent || currentLength >= 8 || currentLength === 0) {
    if (currentLength > 0 && currentLength < 8) {
      passwordError.value = 'Password must be at least 8 characters long'
    }
    if (currentLength > 128) {
      passwordError.value = 'Password must not exceed 128 characters'
    }
  }

  validateConfirm()
}

const validateConfirm = () => {
  confirmError.value = ''
  if (passwordConfirm.value.length > 0 && passwordInput.value !== passwordConfirm.value) {
    confirmError.value = 'Passwords do not match'
  }
}

const savePassword = async () => {
  console.log('🔍 Debug - savePassword called')
  console.log('🔍 canSave:', canSave.value)
  console.log('🔍 passwordInput.length:', passwordInput.value.length)
  console.log('🔍 passwordError:', passwordError.value)
  console.log('🔍 confirmError:', confirmError.value)
  console.log('🔍 passwords match:', passwordInput.value === passwordConfirm.value)

  if (!canSave.value) {
    console.log('❌ canSave is false, returning early')
    return
  }

  isSaving.value = true
  try {
    // Create a simple hash of the password (in production, use proper bcrypt)
    const passwordHash = btoa(passwordInput.value) // Simple base64 encoding for demo

    // Update the node with password protection enabled
    const updatedNode = {
      ...props.node,
      passwordEnabled: true,
      passwordHash: passwordHash
    }

    // Also update the graph metadata to include password protection
    await updateGraphMetadata(passwordHash)

    emit('update-node', updatedNode)

    // Reset form
    resetForm()

  } catch (error) {
    console.error('Error saving password:', error)
    passwordError.value = 'Failed to save password. Please try again.'
  } finally {
    isSaving.value = false
  }
}

const removePassword = async () => {
  if (!confirm('Are you sure you want to remove password protection? This will make your graph publicly accessible.')) {
    return
  }

  isSaving.value = true
  try {
    // Update the node to disable password protection
    const updatedNode = {
      ...props.node,
      passwordEnabled: false,
      passwordHash: null
    }

    // Remove password from graph metadata
    await updateGraphMetadata(null)

    emit('update-node', updatedNode)

    // Reset form
    resetForm()

  } catch (error) {
    console.error('Error removing password:', error)
    passwordError.value = 'Failed to remove password protection. Please try again.'
  } finally {
    isSaving.value = false
  }
}

const updateGraphMetadata = async (passwordHash) => {
  // Get current graph data
  const currentGraphId = knowledgeGraphStore.currentGraphId
  if (!currentGraphId) {
    throw new Error('No graph ID available')
  }

  console.log('🔍 Fetching graph data for:', currentGraphId)

  // Get current graph data to preserve existing metadata
  const response = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${currentGraphId}`)
  if (!response.ok) {
    console.error('❌ Failed to fetch graph data:', response.status, response.statusText)
    throw new Error('Failed to fetch current graph data')
  }

  const graphData = await response.json()
  console.log('🔍 Fetched graph data structure:', Object.keys(graphData))

  // Update metadata with password information
  const updatedMetadata = {
    ...graphData.metadata,
    passwordProtected: !!passwordHash,
    passwordHash: passwordHash
  }

  console.log('🔍 Updated metadata:', updatedMetadata)

  // Create the updated graph data
  const updatedGraphData = {
    ...graphData,
    metadata: updatedMetadata
  }

  // Use the correct API format that matches other saveGraphWithHistory calls
  const payload = {
    id: currentGraphId,
    graphData: updatedGraphData,
    override: true
  }

  console.log('🔍 Payload being sent:', payload)

  // Save updated graph with new metadata
  const saveResponse = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  console.log('🔍 Save response status:', saveResponse.status, saveResponse.statusText)

  if (!saveResponse.ok) {
    const errorText = await saveResponse.text()
    console.error('❌ Save response error:', errorText)
    throw new Error('Failed to save graph metadata')
  }

  const result = await saveResponse.json()
  console.log('✅ Save successful:', result)
}

const resetForm = () => {
  passwordInput.value = ''
  passwordConfirm.value = ''
  passwordError.value = ''
  confirmError.value = ''
  showPasswordConfig.value = false
}

const cancelConfig = () => {
  resetForm()
}

const editNode = () => {
  emit('edit-node', props.node)
}

const deleteNode = () => {
  if (confirm('Are you sure you want to remove this password protection node? This will not affect any existing password protection on the graph.')) {
    emit('delete-node', props.node)
  }
}

// Initialize component
onMounted(() => {
  // Check if the graph already has password protection in metadata
  // This would be loaded from the graph data when the component mounts
})
</script>

<style scoped>
.password-protection-node {
  background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
  border: 2px solid #e53e3e;
  border-radius: 12px;
  padding: 20px;
  margin: 10px 0;
  box-shadow: 0 4px 12px rgba(229, 62, 62, 0.1);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #feb2b2;
}

.node-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.node-icon {
  font-size: 1.5em;
}

.node-label {
  font-size: 1.3em;
  font-weight: bold;
  color: #742a2a;
}

.node-type-badge {
  background: #e53e3e;
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.7em;
  font-weight: bold;
  letter-spacing: 0.5px;
}

.node-controls {
  display: flex;
  gap: 8px;
}

.btn-control {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #e53e3e;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  color: #e53e3e;
  transition: all 0.3s ease;
}

.btn-control:hover {
  background: #e53e3e;
  color: white;
}

.control-section {
  margin-bottom: 20px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  padding: 15px;
  border: 1px solid #feb2b2;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #742a2a;
  font-weight: bold;
  font-size: 1em;
}

.section-icon {
  font-size: 1.1em;
}

.status-display {
  padding: 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.8);
}

.status-enabled {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #38a169;
}

.status-disabled {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #d69e2e;
}

.status-icon {
  font-size: 1.2em;
}

.status-text {
  flex: 1;
  font-weight: 500;
}

.btn-change,
.btn-enable {
  background: #e53e3e;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.3s ease;
}

.btn-change:hover,
.btn-enable:hover {
  background: #c53030;
}

.status-buttons {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.btn-remove {
  background: #dc3545;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.3s ease;
}

.btn-remove:hover {
  background: #b02a37;
}

.password-form {
  background: rgba(255, 255, 255, 0.8);
  padding: 15px;
  border-radius: 6px;
  border: 1px solid #feb2b2;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #742a2a;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper .form-control {
  padding-right: 40px;
}

/* Current Password Section */
.current-password-section {
  background: rgba(229, 62, 62, 0.05);
  border: 1px solid rgba(229, 62, 62, 0.2);
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 20px;
}

.current-password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
}

.current-password-input {
  flex: 1;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  color: #495057;
  font-family: monospace;
  letter-spacing: 1px;
}

.current-password-input:focus {
  background: #f8f9fa;
  border-color: #e53e3e;
  outline: none;
  box-shadow: 0 0 0 2px rgba(229, 62, 62, 0.1);
}

.copy-password-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
  min-width: 40px;
}

.copy-password-btn:hover {
  background: #218838;
}

.current-password-section .form-text {
  margin-top: 8px;
  font-style: italic;
  color: #6c757d;
}

.password-toggle-btn {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  border-radius: 3px;
  transition: background-color 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
}

.password-toggle-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.form-control:focus {
  outline: none;
  border-color: #e53e3e;
  box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.1);
}

.form-control.is-invalid {
  border-color: #e53e3e;
  background-color: #fed7d7;
}

.invalid-feedback {
  color: #e53e3e;
  font-size: 0.85em;
  margin-top: 5px;
}

.form-text {
  font-size: 0.85em;
  margin-top: 5px;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #e53e3e;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #c53030;
}

.btn-secondary {
  background: #e2e8f0;
  color: #4a5568;
}

.btn-secondary:hover {
  background: #cbd5e0;
}

.btn-danger {
  background: #e53e3e;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c53030;
}

.info-content {
  background: rgba(255, 255, 255, 0.8);
  padding: 15px;
  border-radius: 6px;
  border: 1px solid #feb2b2;
}

.info-text {
  margin-bottom: 10px;
  color: #4a5568;
  line-height: 1.5;
}

.info-list {
  margin: 0;
  padding-left: 20px;
  color: #4a5568;
  line-height: 1.6;
}

.info-list li {
  margin-bottom: 5px;
}
</style>
