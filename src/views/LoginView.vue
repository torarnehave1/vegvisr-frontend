<template>
  <div class="login-container">
    <h1>Login</h1>
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
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const email = ref('')
const token = localStorage.getItem('jwtToken') // Retrieve JWT token from browser storage
const route = useRoute()

onMounted(() => {
  // Pre-fill the email field if provided in the query parameters
  const queryEmail = route.query.email
  if (queryEmail) {
    email.value = queryEmail
  }
})

const handleLogin = async () => {
  try {
    const payload = { email: email.value, token }
    console.log('Sending POST /login request:', JSON.stringify(payload, null, 2))

    const response = await fetch('https://test.vegvisr.org/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log('Login response:', result)

    if (result.success) {
      alert('Login successful!')
    } else {
      alert('Login failed: ' + result.error)
    }
  } catch (error) {
    console.error('Error during login:', error)
    alert('An error occurred during login.')
  }
}

// Example function to verify email and store JWT token
const verifyEmail = async (emailVerificationToken) => {
  try {
    const response = await fetch(
      `https://test.vegvisr.org/verify-email?token=${emailVerificationToken}`,
    )
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log('Verify email response:', result)

    if (result.success) {
      // Store the JWT token in localStorage
      localStorage.setItem('jwtToken', result.token)
      alert('Email verified successfully!')
    } else {
      alert('Email verification failed: ' + result.error)
    }
  } catch (error) {
    console.error('Error during email verification:', error)
    alert('An error occurred during email verification.')
  }
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
