<template>
  <teleport to="body">
    <transition name="modal-fade">
      <div v-if="isOpen" class="modal-overlay" @click.self="handleCancel">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <div class="modal-icon" :class="iconClass">
              {{ icon }}
            </div>
            <h3 class="modal-title">{{ title }}</h3>
          </div>

          <div class="modal-body">
            <p class="modal-message">{{ message }}</p>

            <div v-if="requireConfirmation" class="confirmation-input-group">
              <label class="confirmation-label">
                {{ confirmationLabel }}
              </label>
              <input
                ref="confirmationInput"
                v-model="userInput"
                type="text"
                class="confirmation-input"
                :placeholder="confirmationPlaceholder"
                @keyup.enter="handleConfirm"
                @keyup.esc="handleCancel"
              />
              <p v-if="showError" class="error-message">
                {{ errorMessage }}
              </p>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-cancel" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button
              class="btn btn-confirm"
              :class="confirmButtonClass"
              :disabled="requireConfirmation && !isConfirmationValid"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Confirm Action',
  },
  message: {
    type: String,
    required: true,
  },
  confirmText: {
    type: String,
    default: 'Confirm',
  },
  cancelText: {
    type: String,
    default: 'Cancel',
  },
  variant: {
    type: String,
    default: 'danger', // 'danger', 'warning', 'info', 'success'
    validator: (value) => ['danger', 'warning', 'info', 'success'].includes(value),
  },
  requireConfirmation: {
    type: Boolean,
    default: false,
  },
  confirmationText: {
    type: String,
    default: 'DELETE',
  },
  confirmationLabel: {
    type: String,
    default: 'Type DELETE in capital letters to confirm:',
  },
  confirmationPlaceholder: {
    type: String,
    default: 'Type here...',
  },
})

const emit = defineEmits(['confirm', 'cancel', 'update:isOpen'])

const userInput = ref('')
const showError = ref(false)
const confirmationInput = ref(null)

const icon = computed(() => {
  const icons = {
    danger: '⚠️',
    warning: '⚠️',
    info: 'ℹ️',
    success: '✓',
  }
  return icons[props.variant] || '⚠️'
})

const iconClass = computed(() => {
  return `icon-${props.variant}`
})

const confirmButtonClass = computed(() => {
  return `btn-${props.variant}`
})

const isConfirmationValid = computed(() => {
  if (!props.requireConfirmation) return true
  return userInput.value === props.confirmationText
})

const errorMessage = computed(() => {
  return `You must type "${props.confirmationText}" exactly to confirm.`
})

const handleConfirm = () => {
  if (props.requireConfirmation && !isConfirmationValid.value) {
    showError.value = true
    return
  }

  emit('confirm')
  emit('update:isOpen', false)
  resetModal()
}

const handleCancel = () => {
  emit('cancel')
  emit('update:isOpen', false)
  resetModal()
}

const resetModal = () => {
  userInput.value = ''
  showError.value = false
}

// Focus input when modal opens
watch(
  () => props.isOpen,
  async (newValue) => {
    if (newValue && props.requireConfirmation) {
      await nextTick()
      confirmationInput.value?.focus()
    }
  },
)

// Reset when modal closes
watch(
  () => props.isOpen,
  (newValue) => {
    if (!newValue) {
      resetModal()
    }
  },
)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal-container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 100%;
  overflow: hidden;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 24px 24px 20px;
  border-bottom: 1px solid #e9ecef;
  text-align: center;
}

.modal-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  line-height: 1;
}

.icon-danger {
  color: #dc3545;
}

.icon-warning {
  color: #ffc107;
}

.icon-info {
  color: #17a2b8;
}

.icon-success {
  color: #28a745;
}

.modal-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #212529;
}

.modal-body {
  padding: 24px;
}

.modal-message {
  margin: 0 0 20px 0;
  font-size: 1rem;
  line-height: 1.6;
  color: #495057;
  text-align: center;
}

.confirmation-input-group {
  margin-top: 20px;
}

.confirmation-label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #495057;
}

.confirmation-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s ease;
  font-family: monospace;
  letter-spacing: 1px;
}

.confirmation-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.error-message {
  margin: 8px 0 0 0;
  font-size: 0.85rem;
  color: #dc3545;
  font-weight: 500;
}

.modal-footer {
  padding: 20px 24px 24px;
  border-top: 1px solid #e9ecef;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.1);
}

.btn-cancel {
  background: #e9ecef;
  color: #495057;
}

.btn-cancel:hover {
  background: #d3d6db;
}

.btn-confirm {
  color: white;
}

.btn-danger {
  background: #dc3545;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-warning {
  background: #ffc107;
  color: #212529;
}

.btn-warning:hover:not(:disabled) {
  background: #e0a800;
}

.btn-info {
  background: #17a2b8;
}

.btn-info:hover:not(:disabled) {
  background: #138496;
}

.btn-success {
  background: #28a745;
}

.btn-success:hover:not(:disabled) {
  background: #218838;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Transition classes */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container {
  transition: transform 0.3s ease;
}

.modal-fade-enter-from .modal-container,
.modal-fade-leave-to .modal-container {
  transform: translateY(-20px);
}

/* Mobile responsiveness */
@media (max-width: 576px) {
  .modal-container {
    max-width: 100%;
    border-radius: 12px;
  }

  .modal-header {
    padding: 20px 16px 16px;
  }

  .modal-icon {
    font-size: 2.5rem;
  }

  .modal-title {
    font-size: 1.25rem;
  }

  .modal-body {
    padding: 20px 16px;
  }

  .modal-footer {
    padding: 16px;
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
    padding: 12px 24px;
  }
}
</style>
