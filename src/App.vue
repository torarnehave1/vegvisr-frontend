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
  theme.value = localStorage.getItem('theme') || 'light'
  userState.email = localStorage.getItem('UserEmail') || ''
  store.commit('setJwt', localStorage.getItem('jwt')) // Sync JWT from localStorage to Vuex store
  window.UserEmail = userState.email
})

function handleUserLoggedIn(email, jwt) {
  userState.email = email
  store.commit('setJwt', jwt) // Set JWT in Vuex store
}

function handleLogout() {
  userState.email = ''
  store.commit('logout') // Clear JWT and user data from Vuex store
  localStorage.removeItem('UserEmail')
  localStorage.removeItem('jwt')
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
