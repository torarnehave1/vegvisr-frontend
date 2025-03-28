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
import { useRoute, useRouter } from 'vue-router'

const email = ref('')
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
})

function handleLogin() {
  // Set the global variable UserEmail
  window.UserEmail = email.value

  // Simulate successful login and redirect to the protected path
  router.push('/protected')
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
