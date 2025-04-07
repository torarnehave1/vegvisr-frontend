<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import DefaultLayout from './layouts/DefaultLayout.vue'
import { useUserStore } from './stores/userStore'
import { onMounted } from 'vue'

const theme = ref('light')
const userStore = useUserStore()
const route = useRoute()

const currentLayout = computed(() => route.meta.layout || DefaultLayout)

onMounted(() => {
  userStore.loadUserFromStorage()
  theme.value = localStorage.getItem('theme') || 'light'
})

function handleLogout() {
  userStore.logout()
  window.location.href = '/' // Redirect to home page
}
</script>

<template>
  <component
    :is="currentLayout"
    :class="['app-container', { 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }]"
    :theme="theme"
    :user-email="userStore.email"
    @set-theme="setTheme"
  >
    <RouterView :theme="theme" />
    <button @click="userStore.loggedIn ? handleLogout() : $router.push('/login')">
      {{ userStore.loggedIn ? 'Logout' : 'Login' }}
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
