<template>
  <div v-if="isVisible" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Invite to Chat Room</h3>
        <button class="close-button" @click="closeModal">&times;</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="recipientEmail">Email Address *</label>
          <input
            id="recipientEmail"
            v-model="recipientEmail"
            type="email"
            placeholder="Enter email address"
            required
            :disabled="isLoading"
          />
        </div>

        <div class="form-group">
          <label for="invitationMessage">Personal Message (Optional)</label>
          <textarea
            id="invitationMessage"
            v-model="invitationMessage"
            placeholder="Add a personal message to your invitation..."
            rows="3"
            :disabled="isLoading"
          ></textarea>
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-if="success" class="success-message">Invitation sent successfully!</div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="closeModal" :disabled="isLoading">Cancel</button>
        <button
          class="btn btn-primary"
          @click="sendInvitation"
          :disabled="!recipientEmail || isLoading"
        >
          <span v-if="isLoading">Sending...</span>
          <span v-else>Send Invitation</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useUserStore } from '../stores/userStore'
import { API_CONFIG } from '../config/api'

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false,
  },
  roomId: {
    type: String,
    required: true,
  },
  roomName: {
    type: String,
    default: 'Chat Room',
  },
})

const emit = defineEmits(['close', 'invitation-sent'])

const userStore = useUserStore()

const recipientEmail = ref('')
const invitationMessage = ref('')
const isLoading = ref(false)
const error = ref('')
const success = ref(false)

// Reset form when modal opens
watch(
  () => props.isVisible,
  (newValue) => {
    if (newValue) {
      resetForm()
    }
  },
)

function resetForm() {
  recipientEmail.value = ''
  invitationMessage.value = ''
  error.value = ''
  success.value = false
  isLoading.value = false
}

function closeModal() {
  emit('close')
}

async function sendInvitation() {
  if (!recipientEmail.value) {
    error.value = 'Please enter an email address'
    return
  }

  isLoading.value = true
  error.value = ''
  success.value = false

  try {
    const response = await fetch(`${API_CONFIG.baseUrl}/api/chat-rooms/${props.roomId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userStore.emailVerificationToken}`,
      },
      body: JSON.stringify({
        recipientEmail: recipientEmail.value,
        invitationMessage: invitationMessage.value || undefined,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send invitation')
    }

    success.value = true
    emit('invitation-sent', {
      email: recipientEmail.value,
      message: invitationMessage.value,
    })

    // Auto-close after 2 seconds
    setTimeout(() => {
      closeModal()
    }, 2000)
  } catch (err) {
    console.error('Error sending invitation:', err)
    error.value = err.message || 'Failed to send invitation. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 0 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
}

.modal-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.2rem;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-group input:disabled,
.form-group textarea:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
  border: 1px solid #f5c6cb;
}

.success-message {
  background-color: #d4edda;
  color: #155724;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
  border: 1px solid #c3e6cb;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 20px 20px 20px;
  border-top: 1px solid #eee;
  padding-top: 15px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
}
</style>
