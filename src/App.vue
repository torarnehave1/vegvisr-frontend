<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DefaultLayout from './layouts/DefaultLayout.vue'
import { useUserStore } from './stores/userStore'
import { onMounted } from 'vue'

const theme = ref('light')
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const currentLayout = computed(() => route.meta.layout || DefaultLayout)

onMounted(() => {
  userStore.loadUserFromStorage()
  console.log('🚀 App initialized - User:', userStore.email, 'ID:', userStore.user_id)
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

    <!-- Fixed positioned logout button that won't interfere with content -->
    <button v-if="userStore.loggedIn" @click="handleLogout" class="fixed-logout-btn" title="Logout">
      <i class="bi bi-box-arrow-right"></i>
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

/* Fixed logout button that won't interfere with scrollable content */
.fixed-logout-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
  font-size: 16px;
}

.fixed-logout-btn:hover {
  background: #c82333;
  transform: scale(1.05);
}

.fixed-logout-btn:active {
  transform: scale(0.95);
}
</style>
