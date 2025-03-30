<template>
  <div class="login-container">
    <h1 :style="{ color: theme === 'dark' ? 'black' : 'inherit' }">Login</h1>
    <form @submit.prevent="handleLogin">
      <div class="mb-3">
        <label for="email" class="form-label">Email address</label>
        <input type="email" class="form-control" id="email" v-model="email" required />
      </div>
      <button type="submit" class="btn btn-primary">Login</button>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// Declare the emit function at the top level
const emit = defineEmits(['user-logged-in'])

const email = ref('')
const theme = ref('light') // Default theme is light
const route = useRoute()
const router = useRouter()

onMounted(() => {
  // Pre-fill the email field if provided in the query parameters
  const queryEmail = route.query.email
  const queryToken = route.query.token

  if (queryEmail) {
    email.value = queryEmail
  }

  // Store the JWT token in Local Storage if provided
  if (queryToken) {
    localStorage.setItem('jwt-vegvisr.org', queryToken)
    console.log('JWT token stored in Local Storage:', queryToken)
  }

  // Detect and set the theme
  theme.value = localStorage.getItem('theme') || 'light'
})

function handleLogin() {
  // Call the check-email endpoint before logging in
  ;(async () => {
    try {
      const res = await fetch(
        `https://test.vegvisr.org/check-email?email=${encodeURIComponent(email.value)}`,
      )
      const data = await res.json()
      if (data.exists && data.verified) {
        // Allowed to login
        window.UserEmail = email.value
        localStorage.setItem('UserEmail', email.value)
        console.log('UserEmail set in localStorage:', email.value)
        emit('user-logged-in', email.value)
        router.push('/protected').then(() => {
          window.location.reload()
        })
      } else {
        // Redirect to register endpoint; prefill email if applicable
        router.push(`/register?email=${encodeURIComponent(email.value)}`)
      }
    } catch (error) {
      console.error('Error checking email:', error)
      // Optionally handle error (e.g. notify user)
    }
  })()
}
</script>

<style>
.login-container {
  max-width: 400px;
  margin: 50px auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}
</style>
