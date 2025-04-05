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
import { useRoute, useRouter } from 'vue-router'
import { useStore } from '@/store' // Correctly import useStore function

const emit = defineEmits(['user-logged-in'])
const email = ref('')
const theme = ref('light') // Default theme is light
const route = useRoute()
const router = useRouter()
const store = useStore() // Access Vuex store

onMounted(() => {
  // Pre-fill the email field if provided in the query parameters
  const queryEmail = route.query.email
  const queryToken = route.query.token

  if (queryEmail) {
    email.value = queryEmail
  }

  // Store the JWT token in Local Storage if provided
  if (queryToken) {
    localStorage.setItem('jwt', queryToken)
    console.log('JWT token stored in Local Storage:', queryToken)
  } else if (queryEmail) {
    // If JWT is missing, call the /set-jwt endpoint using GET method
    fetch(`https://test.vegvisr.org/set-jwt?email=${encodeURIComponent(queryEmail)}`)
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to fetch JWT token:', response.status, response.statusText);
          throw new Error('Failed to fetch JWT token');
        }
        return response.json();
      })
      .then((data) => {
        if (data.jwt) {
          localStorage.setItem('jwt', data.jwt);
          console.log('JWT token fetched and stored in Local Storage:', data.jwt);
        } else {
          console.warn('No JWT token found in the response:', data);
        }
      })
      .catch((error) => {
        console.error('Error fetching JWT token:', error);
      });
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

      if (data && data.exists && data.verified) {
        // Fetch the user's role after verifying their email
        const roleRes = await fetch(
          `https://dashboard.vegvisr.org/get-role?email=${encodeURIComponent(email.value)}`,
        )
        const roleData = await roleRes.json()

        console.log('Role data response:', roleData) // Log the role data for debugging

        if (roleData && roleData.role) {
          // Use Vuex store to set UserEmail and Role
          store.commit('setUser', { email: email.value, role: roleData.role })
          localStorage.setItem('UserEmail', email.value) // Ensure UserEmail is stored
          console.log('UserEmail and Role set in Vuex store:', email.value, roleData.role)
          emit('user-logged-in', email.value)
          router.push('/') // Redirect to the main App.vue
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
