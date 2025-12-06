<template>
  <div class="page">
    <div class="card">
      <h1>Send Email via Gmail</h1>
      <p class="muted">
        Uses the slowyou.io relay. Provide your Gmail address and app password (app-specific password
        recommended) to send a message.
      </p>

      <form @submit.prevent="sendEmail">
        <div class="field">
          <label for="senderEmail">Your Gmail address</label>
          <input
            id="senderEmail"
            v-model="form.senderEmail"
            type="email"
            autocomplete="email"
            required
          />
        </div>

        <div class="field">
          <label for="appPassword">Gmail app password</label>
          <input
            id="appPassword"
            v-model="form.appPassword"
            type="password"
            autocomplete="current-password"
            required
          />
          <p class="hint">Use a Google App Password, not your main password.</p>
        </div>

        <div class="field">
          <label for="toEmail">Recipient</label>
          <input id="toEmail" v-model="form.toEmail" type="email" required />
        </div>

        <div class="field">
          <label for="subject">Subject</label>
          <input id="subject" v-model="form.subject" type="text" required />
        </div>

        <div class="field">
          <label for="html">Message (HTML)</label>
          <textarea id="html" v-model="form.html" rows="8" required></textarea>
        </div>

        <button class="primary" type="submit" :disabled="loading">
          <span v-if="loading">Sending...</span>
          <span v-else>Send Email</span>
        </button>
      </form>

      <p v-if="error" class="status error">{{ error }}</p>
      <p v-if="success" class="status success">{{ success }}</p>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()

const form = reactive({
  senderEmail: userStore.email || '',
  appPassword: '',
  toEmail: '',
  subject: '',
  html: '<p>Hello from Vegvisr!</p>',
})

const loading = ref(false)
const error = ref('')
const success = ref('')

const endpointBase = import.meta.env.VITE_EMAIL_WORKER_URL || 'https://email-worker.torarnehave.workers.dev'

async function sendEmail() {
  error.value = ''
  success.value = ''

  if (!form.senderEmail || !form.appPassword || !form.toEmail || !form.subject || !form.html) {
    error.value = 'All fields are required.'
    return
  }

  loading.value = true
  try {
    const response = await fetch(`${endpointBase}/send-gmail-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderEmail: form.senderEmail,
        appPassword: form.appPassword,
        toEmail: form.toEmail,
        subject: form.subject,
        html: form.html,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data.success) {
      error.value = data.error || `Failed with status ${response.status}`
      return
    }

    success.value = 'Email sent successfully.'
  } catch (err) {
    console.error('sendEmail error', err)
    error.value = err.message || 'Unexpected error'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page {
  display: flex;
  justify-content: center;
  padding: 24px;
}

.card {
  width: min(960px, 100%);
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
}

h1 {
  margin: 0 0 8px;
  font-size: 24px;
}

.muted {
  color: #6b7280;
  margin-bottom: 24px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

label {
  font-weight: 600;
  color: #111827;
}

input,
textarea {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease, opacity 0.1s ease;
}

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.primary:not(:disabled):hover {
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.2);
  transform: translateY(-1px);
}

.status {
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 8px;
  font-weight: 600;
}

.status.error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecdd3;
}

.status.success {
  background: #ecfdf3;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.hint {
  color: #6b7280;
  font-size: 12px;
  margin: 0;
}
</style>
