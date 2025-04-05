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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const emit = defineEmits(['user-logged-in'])
const email = ref('')
const theme = ref('light') // Default theme is light
const userState = ref({ email: '', role: '', loggedIn: false })

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

function handleLogin() {
  // Call the check-email endpoint before logging in
  ;(async () => {
    try {
      const res = await fetch(
        `https://test.vegvisr.org/check-email?email=${encodeURIComponent(email.value)}`,
      )
      const data = await res.json()

      if (data && data.exists && data.verified) {
        // Fetch the user's role after verifying their email
        const roleRes = await fetch(
          `https://dashboard.vegvisr.org/get-role?email=${encodeURIComponent(email.value)}`,
        )
        const roleData = await roleRes.json()

        console.log('Role data response:', roleData) // Log the role data for debugging

        if (roleData && roleData.role) {
          // Set UserEmail and Role in local state and localStorage
          userState.value = { email: email.value, role: roleData.role, loggedIn: true }
          localStorage.setItem('user', JSON.stringify(userState.value))
          console.log('UserEmail and Role set in local state:', email.value, roleData.role)
          emit('user-logged-in', email.value)
          router.push('/') // Redirect to the home page
        } else {
          console.error('Error: Role data is missing or invalid. Response:', roleData)
          alert('Unable to retrieve user role. Please contact support.') // Notify the user
        }
      } else {
        // Redirect to register endpoint; prefill email if applicable
        router.push(`/register?email=${encodeURIComponent(email.value)}`)
      }
    } catch (error) {
      console.error('Error checking email or fetching role:', error)
      alert('An error occurred during login. Please try again later.') // Notify the user
    }
  })()
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
