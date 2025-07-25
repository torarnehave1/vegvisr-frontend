<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DefaultLayout from './layouts/DefaultLayout.vue'
import MinimalLayout from './layouts/MinimalLayout.vue'
import { useUserStore } from './stores/userStore'
import { onMounted } from 'vue'

const theme = ref('light')
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const currentLayout = computed(() => route.meta.layout || DefaultLayout)

onMounted(() => {
  userStore.loadUserFromStorage()
  theme.value = localStorage.getItem('theme') || 'light'
})

function handleLogout() {
  userStore.logout()
  router.push('/') // Redirect to home page
}

function setTheme(newTheme) {
  theme.value = newTheme
  localStorage.setItem('theme', newTheme) // Persist theme in localStorage
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
    <!-- Only show logout button for non-minimal layouts -->
    <button
      v-if="currentLayout !== MinimalLayout"
      @click="userStore.loggedIn ? handleLogout() : $router.push('/login')"
    >
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
