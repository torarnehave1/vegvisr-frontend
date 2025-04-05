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

  if (store.state.loggedIn) {
    console.log('User is already logged in. Skipping reinitialization.')
    return
  }

  if (storedJwt && queryEmail) {
    console.log('JWT token and email found. Initializing user state.')
    store.commit('setUser', { email: queryEmail, role: 'User' }) // Example role
    store.commit('setJwt', storedJwt)
    store.commit('setLoggedIn', true) // Explicitly set loggedIn to true
  } else {
    console.warn('No valid user session found. Ensuring loggedIn is false.')
    store.commit('setLoggedIn', false) // Explicitly set loggedIn to false
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
    store.commit('setLoggedIn', true) // Explicitly set loggedIn to true
  } else {
    console.error('Attempted to set an undefined JWT token.')
  }
}

function handleLogout() {
  console.log('Logout initiated.')
  userState.email = ''
  store.commit('logout') // Clear user data from Vuex store
  store.commit('setLoggedIn', false) // Explicitly set loggedIn to false
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
    <button @click="store.state.loggedIn ? handleLogout() : $router.push('/login')">
      {{ store.state.loggedIn ? 'Logout' : 'Login' }}
    </button>
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
