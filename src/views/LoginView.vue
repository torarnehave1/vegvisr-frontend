<template>
  <div class="login-container">
    <h1 :style="{ color: theme === 'dark' ? 'black' : 'inherit' }">Login</h1>
    <form @submit.prevent="handleLogin">
      <div class="mb-3">
        <label for="email" class="form-label">Email address</label>
        <input type="email" class="form-control" id="email" v-model="email" required />
        <button type="submit" class="btn btn-primary">Login</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore'

const email = ref('')
const theme = ref('light') // Default theme is light
const userState = ref({ email: '', role: '', loggedIn: false }) // Define userState
const userStore = useUserStore()
const router = useRouter()

onMounted(() => {
  const storedUser = JSON.parse(localStorage.getItem('user'))
  if (storedUser && storedUser.email) {
    userState.value = storedUser
  } else {
    userState.value = { email: '', role: '', loggedIn: false }
  }

  theme.value = localStorage.getItem('theme') || 'light'
})

async function handleLogin() {
  try {
    const res = await fetch(
      `https://test.vegvisr.org/check-email?email=${encodeURIComponent(email.value)}`,
    )
    const data = await res.json()

    if (data && data.exists && data.verified) {
      const roleRes = await fetch(
        `https://dashboard.vegvisr.org/get-role?email=${encodeURIComponent(email.value)}`,
      )
      const roleData = await roleRes.json()

      if (roleData && roleData.role) {
        userStore.setUser({ email: email.value, role: roleData.role })
        router.push('/') // Redirect to home page
      } else {
        alert('Unable to retrieve user role. Please contact support.')
      }
    } else {
      router.push(`/register?email=${encodeURIComponent(email.value)}`)
    }
  } catch (error) {
    alert('An error occurred during login. Please try again later.')
  }
}
</script>

<style>
.login-container {
  max-width: 400px;
  margin: 50px auto;
  margin-top: 10%;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.login-container h1 {
  text-align: center;
  margin-bottom: 20px;
}
.login-container .form-label {
  font-weight: bold;
}
</style>
