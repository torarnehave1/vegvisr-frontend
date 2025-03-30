<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import DefaultLayout from './layouts/DefaultLayout.vue'

const theme = ref('light')
const userState = reactive({ email: '' })
const route = useRoute()

// Resolve the layout component from the route's meta.layout
const currentLayout = computed(() => route.meta.layout || DefaultLayout)

onMounted(() => {
  theme.value = localStorage.getItem('theme') || 'light'
  userState.email = localStorage.getItem('UserEmail') || ''
  window.UserEmail = userState.email
})

function handleUserLoggedIn(email) {
  userState.email = email
}
</script>

<template>
  <component
    :is="currentLayout"
    :class="['app-container', { 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }]"
  >
    <nav>
      <ul>
        <li><router-link to="/blog">Blog</router-link></li>
      </ul>
    </nav>
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
