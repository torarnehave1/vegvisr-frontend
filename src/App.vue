<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import DefaultLayout from './layouts/DefaultLayout.vue'
import { useStore } from '@/store'

const theme = ref('light')
const userState = reactive({ email: '' })
const route = useRoute()
const store = useStore()

// Resolve the layout component from the route's meta.layout
const currentLayout = computed(() => route.meta.layout || DefaultLayout)

onMounted(() => {
  const storedJwt = localStorage.getItem('jwt')
  const queryEmail = localStorage.getItem('UserEmail')

  if (storedJwt && store.state.user.email && store.state.user.role) {
    console.log('JWT token found in Vuex store:', storedJwt)
    store.commit('setJwt', storedJwt)
  } else if (queryEmail && store.state.user.email === null && store.state.user.role === null) {
    console.log('No JWT token found. Attempting to create one using email:', queryEmail)
    fetch(`https://test.vegvisr.org/set-jwt?email=${encodeURIComponent(queryEmail)}`)
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to fetch JWT token:', response.status, response.statusText)
          throw new Error('Failed to fetch JWT token')
        }
        return response.json()
      })
      .then((data) => {
        if (data.jwt) {
          store.commit('setJwt', data.jwt)
          localStorage.setItem('jwt', data.jwt)
          console.log('JWT token fetched and stored in Vuex store and localStorage:', data.jwt)
        } else {
          console.warn('No JWT token found in the response:', data)
        }
      })
      .catch((error) => {
        console.error('Error fetching JWT token:', error)
      })
  } else {
    console.warn('No JWT token or email found. Cannot create JWT.')
  }

  theme.value = localStorage.getItem('theme') || 'light'
  userState.email = store.state.user.email || queryEmail || ''
  window.UserEmail = userState.email
})

function handleUserLoggedIn(email, jwt) {
  userState.email = email
  if (jwt) {
    console.log('Setting JWT token in Vuex store and localStorage:', jwt)
    store.commit('setJwt', jwt)
  } else {
    console.error('Attempted to set an undefined JWT token.')
  }
}

function handleLogout() {
  console.log('Logout initiated.')
  userState.email = ''
  store.commit('logout') // Clear user data from Vuex store
  console.log('Vuex store after logout:', store.state.user)
  localStorage.removeItem('UserEmail')
  console.log('UserEmail removed from localStorage.')
  window.location.href = '/' // Redirect to the home route
  console.log('User logged out and redirected to home page.')
}

function setTheme(newTheme) {
  theme.value = newTheme
  localStorage.setItem('theme', newTheme)
}
</script>

<template>
  <component
    :is="currentLayout"
    :class="['app-container', { 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }]"
    :theme="theme"
    :user-email="userState.email"
    @set-theme="setTheme"
    @user-logged-in="handleUserLoggedIn"
    @logout="handleLogout"
  >
    <RouterView :theme="theme" @user-logged-in="handleUserLoggedIn" />
  </component>
</template>

<style>
.bg-dark {
  background-color: #343a40 !important;
}
.text-white {
  color: #fff !important;
}
/* Ensure the header spans the full width of the page */
.top-menu {
  width: 100%;
}
</style>
