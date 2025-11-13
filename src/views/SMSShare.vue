<template>
  <div class="sms-share-page">
    <div class="container">
      <div class="sms-share-card">
        <!-- Header -->
        <div class="page-header">
          <h1>
            <i class="bi bi-chat-dots-fill"></i>
            Share via SMS
          </h1>
          <p class="subtitle">Send this knowledge graph to your contacts</p>
        </div>

        <!-- Share Content Preview -->
        <div class="content-preview">
          <label class="form-label">Message Preview</label>
          <textarea
            v-model="shareContent"
            class="form-control message-preview"
            rows="6"
            readonly
          ></textarea>
          <small class="text-muted">
            {{ messageCharCount }} characters
          </small>
        </div>

        <!-- Recipients -->
        <div class="recipients-section">
          <label class="form-label">
            Recipients
            <span class="badge bg-primary ms-2">{{ recipients.length }}</span>
          </label>

          <!-- Add Recipient Input -->
          <div class="add-recipient-group">
            <input
              v-model="newRecipient"
              type="tel"
              class="form-control"
              placeholder="Enter phone number (e.g., 4790914095)"
              @keyup.enter="addRecipient"
            />
            <button @click="addRecipient" class="btn btn-primary" :disabled="!newRecipient.trim()">
              <i class="bi bi-plus-circle"></i> Add
            </button>
          </div>

          <!-- Recipients List -->
          <div v-if="recipients.length > 0" class="recipients-list">
            <div v-for="(recipient, index) in recipients" :key="index" class="recipient-item">
              <i class="bi bi-phone"></i>
              <span class="phone-number">{{ formatPhoneNumber(recipient) }}</span>
              <button @click="removeRecipient(index)" class="btn-remove" title="Remove">
                <i class="bi bi-x-circle"></i>
              </button>
            </div>
          </div>
          <div v-else class="empty-recipients">
            <i class="bi bi-inbox"></i>
            <p>No recipients added yet</p>
          </div>
        </div>

        <!-- Optional: Sender Name -->
        <div class="sender-section">
          <label class="form-label">
            Sender Name <span class="text-muted">(optional, max 11 characters)</span>
          </label>
          <input
            v-model="senderName"
            type="text"
            class="form-control"
            placeholder="e.g., Vegvisr"
            maxlength="11"
          />
          <small class="text-muted">
            {{ senderName.length }}/11 characters
          </small>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <button @click="sendSMS" class="btn btn-success btn-lg" :disabled="!canSend || sending">
            <span v-if="!sending">
              <i class="bi bi-send-fill"></i> Send SMS
            </span>
            <span v-else>
              <span class="spinner-border spinner-border-sm me-2"></span>
              Sending...
            </span>
          </button>
          <button @click="goBack" class="btn btn-outline-secondary btn-lg">
            <i class="bi bi-arrow-left"></i> Back
          </button>
        </div>

        <!-- Status Messages -->
        <div v-if="successMessage" class="alert alert-success mt-3" role="alert">
          <i class="bi bi-check-circle-fill"></i> {{ successMessage }}
        </div>
        <div v-if="errorMessage" class="alert alert-danger mt-3" role="alert">
          <i class="bi bi-exclamation-triangle-fill"></i> {{ errorMessage }}
        </div>

        <!-- Cost Estimate -->
        <div v-if="recipients.length > 0" class="cost-estimate">
          <i class="bi bi-info-circle"></i>
          Estimated cost: ~€{{ (recipients.length * 0.05).toFixed(2) }} for {{ recipients.length }} recipient{{ recipients.length > 1 ? 's' : '' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// Reactive data
const shareContent = ref('')
const recipients = ref([])
const newRecipient = ref('')
const senderName = ref('')
const sending = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Computed
const messageCharCount = computed(() => shareContent.value.length)

const canSend = computed(() => {
  return recipients.value.length > 0 && shareContent.value.trim() !== '' && !sending.value
})

// Methods
const addRecipient = () => {
  const phone = newRecipient.value.trim()
  if (phone && !recipients.value.includes(phone)) {
    recipients.value.push(phone)
    newRecipient.value = ''
  }
}

const removeRecipient = (index) => {
  recipients.value.splice(index, 1)
}

const formatPhoneNumber = (phone) => {
  // Simple formatting for display
  if (phone.startsWith('47')) {
    return `+${phone.substring(0, 2)} ${phone.substring(2, 5)} ${phone.substring(5)}`
  }
  return phone
}

const sendSMS = async () => {
  if (!canSend.value) return

  sending.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const payload = {
      to: recipients.value,
      message: shareContent.value,
    }

    // Add sender name if provided
    if (senderName.value.trim()) {
      payload.sender = senderName.value.trim()
    }

    console.log('Sending SMS:', payload)

    const response = await fetch('https://sms-gateway.torarnehave.workers.dev/api/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    console.log('SMS API Response Status:', response.status, response.statusText)

    const result = await response.json()

    console.log('SMS API Response Data:', result)

    if (result.success) {
      successMessage.value = `Successfully sent SMS to ${result.successfulSends} recipient${result.successfulSends > 1 ? 's' : ''}!`

      // Show cost information if available
      if (result.usage && result.usage.total_cost) {
        successMessage.value += ` Cost: €${result.usage.total_cost.toFixed(4)}`
      }

      // Clear recipients after successful send
      setTimeout(() => {
        recipients.value = []
      }, 3000)
    } else {
      console.error('SMS sending failed:', result)
      errorMessage.value = result.error?.message || 'Failed to send SMS. Please try again.'
    }

  } catch (error) {
    console.error('Error sending SMS:', error)
    errorMessage.value = 'Network error. Please check your connection and try again.'
  } finally {
    console.log('SMS sending completed. Sending:', sending.value)
    sending.value = false
  }
}

const goBack = () => {
  router.back()
}

// Load content from URL parameters
onMounted(() => {
  shareContent.value = route.query.content || 'Check out this knowledge graph!'

  // Optionally pre-populate sender name
  senderName.value = 'Vegvisr'
})
</script>

<style scoped>
.sms-share-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem 1rem;
}

.container {
  max-width: 800px;
  margin: 0 auto;
}

.sms-share-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.page-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #f0f0f0;
}

.page-header h1 {
  color: #333;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.page-header h1 i {
  color: #28a745;
}

.subtitle {
  color: #666;
  font-size: 1.1rem;
  margin: 0;
}

.content-preview {
  margin-bottom: 2rem;
}

.form-label {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
  display: block;
}

.message-preview {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.95rem;
  line-height: 1.5;
  background-color: #f9f9f9;
  resize: vertical;
}

.recipients-section {
  margin-bottom: 2rem;
}

.add-recipient-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.add-recipient-group input {
  flex: 1;
}

.add-recipient-group .btn {
  white-space: nowrap;
}

.recipients-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.recipient-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s;
}

.recipient-item:hover {
  border-color: #28a745;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.1);
}

.recipient-item i.bi-phone {
  color: #28a745;
  font-size: 1.1rem;
}

.phone-number {
  flex: 1;
  font-weight: 500;
  color: #333;
}

.btn-remove {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 1.2rem;
  transition: transform 0.2s;
}

.btn-remove:hover {
  transform: scale(1.1);
}

.empty-recipients {
  text-align: center;
  padding: 2rem;
  color: #999;
}

.empty-recipients i {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

.sender-section {
  margin-bottom: 2rem;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
}

.btn-lg {
  padding: 0.75rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.cost-estimate {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #e7f5ff;
  border-left: 4px solid #007bff;
  border-radius: 6px;
  color: #004085;
  font-size: 0.9rem;
}

.cost-estimate i {
  margin-right: 0.5rem;
}

@media (max-width: 768px) {
  .sms-share-card {
    padding: 1.5rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn-lg {
    width: 100%;
  }
}
</style>
