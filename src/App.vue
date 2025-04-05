<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DefaultLayout from './layouts/DefaultLayout.vue'

const theme = ref('light')
const userState = reactive({ email: '', role: '', loggedIn: false })
const route = useRoute()
const router = useRouter()

const currentLayout = computed(() => route.meta.layout || DefaultLayout)

onMounted(() => {
  const storedUser = JSON.parse(localStorage.getItem('user'))
  if (storedUser && storedUser.email) {
    userState.email = storedUser.email
    userState.role = storedUser.role
    userState.loggedIn = true
  } else {
    userState.email = ''
    userState.role = ''
    userState.loggedIn = false
  }

  theme.value = localStorage.getItem('theme') || 'light'
})

function handleLogin(email, role) {
  userState.email = email
  userState.role = role
  userState.loggedIn = true
  localStorage.setItem('user', JSON.stringify({ email, role }))
}

function handleLogout() {
  userState.email = ''
  userState.role = ''
  userState.loggedIn = false
  localStorage.removeItem('user')
  router.push('/') // Redirect to home page
}
</script>

<template>
  <component
    :is="currentLayout"
    :class="['app-container', { 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }]"
    :theme="theme"
    :user-email="userState.email"
    @set-theme="setTheme"
  >
    <RouterView :theme="theme" />
    <button @click="userState.loggedIn ? handleLogout() : $router.push('/login')">
      {{ userState.loggedIn ? 'Logout' : 'Login' }}
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
