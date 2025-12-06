<template>
  <div class="login-container">
    <h1 :style="{ color: theme === 'dark' ? 'black' : 'inherit' }">Login</h1>

    <div v-if="step === 'email'" class="card">
      <form @submit.prevent="handleEmailSubmit">
        <div class="mb-3">
          <label for="email" class="form-label">Email address</label>
          <input
            type="email"
            class="form-control"
            id="email"
            v-model="email"
            :disabled="loadingEmail"
            required
          />
        </div>
        <button type="submit" class="btn btn-primary w-100" :disabled="loadingEmail">
          {{ loadingEmail ? 'Checking...' : 'Continue' }}
        </button>
      </form>
    </div>

    <div v-else-if="step === 'phone'" class="card">
      <p class="small text-muted">We need to verify your phone before continuing.</p>
      <form @submit.prevent="handleSendCode">
        <div class="mb-3">
          <label for="phone" class="form-label">Phone (Norway, 8 digits)</label>
          <input
            type="tel"
            class="form-control"
            id="phone"
            v-model="phone"
            inputmode="numeric"
            pattern="[0-9]{8}"
            :disabled="sendingCode"
            required
          />
        </div>
        <button type="submit" class="btn btn-primary w-100" :disabled="sendingCode">
          {{ sendingCode ? 'Sending code...' : 'Send code' }}
        </button>
      </form>
    </div>

    <div v-else-if="step === 'code'" class="card">
      <p class="small text-muted">Enter the 6-digit code we sent to {{ phoneDisplay }}.</p>
      <form @submit.prevent="handleVerifyCode">
        <div class="mb-3">
          <label for="code" class="form-label">Verification code</label>
          <input
            type="text"
            class="form-control"
            id="code"
            v-model="code"
            inputmode="numeric"
            pattern="[0-9]{6}"
            maxlength="6"
            :disabled="verifyingCode"
            required
          />
        </div>
        <button type="submit" class="btn btn-success w-100" :disabled="verifyingCode">
          {{ verifyingCode ? 'Verifying...' : 'Verify & continue' }}
        </button>
      </form>
      <div class="resend-row">
        <button class="btn btn-link" @click="handleSendCode" :disabled="sendingCode || resendDisabled">
          Resend code
        </button>
        <span v-if="resendDisabled" class="small text-muted">Wait {{ resendCountdown }}s</span>
      </div>
    </div>

    <div v-if="statusMessage" class="alert alert-info mt-3">{{ statusMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger mt-3">{{ errorMessage }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/userStore'

const email = ref('')
const phone = ref('')
const code = ref('')
const theme = ref('light')
const step = ref('email')
const loadingEmail = ref(false)
const sendingCode = ref(false)
const verifyingCode = ref(false)
const statusMessage = ref('')
const errorMessage = ref('')
const resendCooldown = ref(30)
const resendTimer = ref(null)
const expiresAt = ref(null)
const pendingUser = ref(null)

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

const phoneDisplay = computed(() => {
  if (!phone.value) return ''
  return phone.value.length > 4
    ? `${phone.value.slice(0, phone.value.length - 4)}••••`
    : phone.value
})

const resendDisabled = computed(() => resendCooldown.value > 0)
const resendCountdown = computed(() => Math.max(resendCooldown.value, 0))

onMounted(() => {
  const storedUser = JSON.parse(localStorage.getItem('user'))
  if (storedUser && storedUser.email) {
    email.value = storedUser.email
  }
  theme.value = localStorage.getItem('theme') || 'light'

  // If redirected for phone requirement and user already logged in, skip email step
  if (route.query.requirePhone === '1' && userStore.loggedIn && userStore.email) {
    email.value = userStore.email
    pendingUser.value = {
      email: userStore.email,
      role: userStore.role,
      user_id: userStore.user_id,
      emailVerificationToken: userStore.emailVerificationToken,
      oauth_id: userStore.oauth_id,
      phone: userStore.phone,
      phoneVerifiedAt: userStore.phoneVerifiedAt,
      mystmkraUserId: userStore.mystmkraUserId,
      branding: userStore.branding,
    }
    // Prefetch phone and go straight to phone/code flow
    checkPhoneStatus()
  }
})

onBeforeUnmount(() => {
  if (resendTimer.value) clearInterval(resendTimer.value)
})

function resetMessages() {
  statusMessage.value = ''
  errorMessage.value = ''
}

async function handleEmailSubmit() {
  resetMessages()
  loadingEmail.value = true
  try {
    const res = await fetch(
      `https://test.vegvisr.org/check-email?email=${encodeURIComponent(email.value)}`,
    )
    const data = await res.json()

    if (!data || !data.exists || !data.verified) {
      router.push(`/register?email=${encodeURIComponent(email.value)}`)
      return
    }

    const roleRes = await fetch(
      `https://dashboard.vegvisr.org/get-role?email=${encodeURIComponent(email.value)}`,
    )
    const roleData = await roleRes.json()

    if (!roleData || !roleData.role) {
      errorMessage.value = 'Unable to retrieve user role. Please contact support.'
      return
    }

    const userDataRes = await fetch(
      `https://dashboard.vegvisr.org/userdata?email=${encodeURIComponent(email.value)}`,
    )
    const userData = await userDataRes.json()

    pendingUser.value = {
      email: email.value,
      role: roleData.role,
      user_id: userData.user_id,
      emailVerificationToken: userData.emailVerificationToken,
    }

    await checkPhoneStatus()
  } catch (err) {
    errorMessage.value = 'An error occurred during login. Please try again later.'
    console.error('handleEmailSubmit error:', err)
  } finally {
    loadingEmail.value = false
  }
}

async function checkPhoneStatus() {
  try {
    const res = await fetch(
      `https://auth.vegvisr.org/auth/phone/status?email=${encodeURIComponent(email.value)}`,
    )
    if (res.ok) {
      const data = await res.json()
      if (data?.phone) {
        phone.value = data.phone.replace('+47', '')
      }
    }
    step.value = 'phone'
  } catch (err) {
    console.error('checkPhoneStatus error:', err)
    step.value = 'phone'
  }
}

async function handleSendCode() {
  resetMessages()
  if (!pendingUser.value) {
    errorMessage.value = 'Please complete email step first.'
    step.value = 'email'
    return
  }

  sendingCode.value = true
  try {
    const payload = { email: email.value, phone: phone.value }
    const res = await fetch('https://auth.vegvisr.org/auth/phone/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to send code')
    }

    statusMessage.value = 'Code sent. Check your phone.'
    expiresAt.value = data.expires_at || null
    step.value = 'code'
    startResendTimer()
  } catch (err) {
    console.error('handleSendCode error:', err)
    errorMessage.value = err.message || 'Failed to send verification code.'
  } finally {
    sendingCode.value = false
  }
}

async function handleVerifyCode() {
  resetMessages()
  verifyingCode.value = true
  try {
    const payload = { email: email.value, code: code.value }
    const res = await fetch('https://auth.vegvisr.org/auth/phone/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Invalid code')
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    userStore.setUser({
      ...pendingUser.value,
      phone: data.phone || phone.value,
      phoneVerifiedAt: nowSeconds,
    })
    sessionStorage.setItem('phone_session_verified', '1')
    statusMessage.value = 'Phone verified. Redirecting...'
    router.push('/user')
  } catch (err) {
    console.error('handleVerifyCode error:', err)
    errorMessage.value = err.message || 'Verification failed.'
  } finally {
    verifyingCode.value = false
  }
}

function startResendTimer() {
  resendCooldown.value = 30
  if (resendTimer.value) clearInterval(resendTimer.value)
  resendTimer.value = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0) {
      clearInterval(resendTimer.value)
      resendTimer.value = null
    }
  }, 1000)
}
</script>

<style>
.login-container {
  max-width: 420px;
  margin: 50px auto;
  margin-top: 10%;
  border: 1px solid #ddd;
  border-radius: 10px;
  background-color: #f9f9f9;
  padding: 24px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

.login-container h1 {
  text-align: center;
  margin-bottom: 20px;
}

.card {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 16px;
}

.form-label {
  font-weight: bold;
}

.resend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
</style>
