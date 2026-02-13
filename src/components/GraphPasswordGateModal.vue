<template>
  <div v-if="show" class="modal-overlay">
    <div class="password-modal" @click.stop>
      <div class="modal-header">
        <h3>🔒 Password Required</h3>
      </div>

      <div class="modal-body">
        <p>This Knowledge Graph is password protected. Please enter the password to view the content.</p>

        <div v-if="canBypass" class="superadmin-bypass-panel">
          <div class="superadmin-bypass-text">
            <strong>Superadmin access:</strong> You can bypass password verification for this graph.
          </div>
          <button
            type="button"
            class="btn-bypass"
            :disabled="passwordLoading"
            @click="$emit('bypass')"
          >
            🚀 Bypass as Superadmin
          </button>
        </div>

        <div class="password-input-container">
          <input
            :value="passwordInput"
            type="password"
            placeholder="Enter password"
            class="password-input"
            :disabled="passwordLoading"
            @input="$emit('update:passwordInput', $event.target.value)"
            @keyup.enter="$emit('verify')"
          />
          <div v-if="passwordError" class="password-error">
            {{ passwordError }}
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-secondary" :disabled="passwordLoading" @click="$emit('cancel')">
          Cancel
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="passwordLoading || !passwordInput.trim()"
          @click="$emit('verify')"
        >
          <span v-if="passwordLoading">🔄 Verifying...</span>
          <span v-else>🔓 Unlock</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  passwordInput: {
    type: String,
    default: '',
  },
  passwordError: {
    type: String,
    default: '',
  },
  passwordLoading: {
    type: Boolean,
    default: false,
  },
  canBypass: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['update:passwordInput', 'verify', 'cancel', 'bypass'])
</script>

<style scoped>
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

.password-modal {
  background: white;
  border-radius: 12px;
  max-width: 450px;
  width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease-out;
}

.password-modal .modal-header {
  padding: 1.5rem 2rem 0.5rem;
  border-bottom: none;
}

.password-modal .modal-header h3 {
  font-size: 1.5rem;
  color: #333;
  margin: 0;
  text-align: center;
}

.password-modal .modal-body {
  padding: 1rem 2rem;
}

.password-modal .modal-body p {
  color: #666;
  text-align: center;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.superadmin-bypass-panel {
  background: #eef7ff;
  border: 1px solid #cfe6ff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.superadmin-bypass-text {
  color: #1d3557;
  font-size: 0.9rem;
  line-height: 1.4;
}

.btn-bypass {
  align-self: flex-start;
  background: #0d6efd;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-bypass:hover:not(:disabled) {
  background: #0b5ed7;
}

.btn-bypass:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.password-input-container {
  margin-bottom: 1rem;
}

.password-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s ease;
  background: #fafbfc;
}

.password-input:focus {
  outline: none;
  border-color: #0366d6;
  background: white;
  box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.1);
}

.password-input:disabled {
  background: #f1f3f4;
  color: #6a737d;
  cursor: not-allowed;
}

.password-error {
  color: #d73a49;
  font-size: 0.875rem;
  margin-top: 0.5rem;
  padding: 8px 12px;
  background: #ffeef0;
  border: 1px solid #fdb8c0;
  border-radius: 6px;
}

.password-modal .modal-footer {
  padding: 1rem 2rem 2rem;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  border-top: none;
}

.password-modal .btn-secondary,
.password-modal .btn-primary {
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 500;
  font-size: 14px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 100px;
}

.password-modal .btn-secondary {
  background: #f1f3f4;
  color: #586069;
}

.password-modal .btn-secondary:hover:not(:disabled) {
  background: #e1e4e8;
}

.password-modal .btn-primary {
  background: #0366d6;
  color: white;
}

.password-modal .btn-primary:hover:not(:disabled) {
  background: #0256cc;
}

.password-modal .btn-primary:disabled,
.password-modal .btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-50px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
