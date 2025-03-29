<script setup>
import { ref, reactive, onMounted } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'

const theme = ref('light')
const userState = reactive({
  email: '',
})
const router = useRouter()

const setTheme = (newTheme) => {
  theme.value = newTheme
  document.body.classList.remove('bg-dark', 'text-white')
  if (newTheme === 'dark') {
    document.body.classList.add('bg-dark', 'text-white')
  }
}

onMounted(() => {
  // Initialize userState.email from localStorage
  userState.email = localStorage.getItem('UserEmail') || ''
  window.UserEmail = userState.email
})

function handleLogout() {
  // Clear UserEmail from localStorage and global variable
  localStorage.removeItem('UserEmail')
  window.UserEmail = ''
  userState.email = ''

  // Redirect to the login page
  router.push('/login')
}

function handleUserLoggedIn(email) {
  userState.email = email
}
</script>

<template>
  <div :class="['app-container', { 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }]">
    <!-- Top Menu (Header) -->
    <header class="top-menu">
      <nav class="navbar navbar-expand-lg navbar-light bg-light">
        <div class="container-fluid">
          <RouterLink class="navbar-brand" to="/">Vegvisr.org</RouterLink>
          <button
            class="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav me-auto">
              <li class="nav-item">
                <RouterLink class="nav-link" to="/">Home</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/test">Test</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/openAi">OpenAI</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/book">Book</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/user">Dashboard</RouterLink>
              </li>
            </ul>

            <div class="dropdown me-3">
              <button
                class="btn btn-outline-secondary dropdown-toggle"
                type="button"
                id="themeDropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                Theme
              </button>
              <ul class="dropdown-menu" aria-labelledby="themeDropdown">
                <li>
                  <a class="dropdown-item" href="#" @click.prevent="setTheme('light')">
                    <i class="bi bi-sun"></i> Light
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="#" @click.prevent="setTheme('dark')">
                    <i class="bi bi-moon"></i> Dark
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="#" @click.prevent="setTheme('auto')">
                    <i class="bi bi-circle-half"></i> Auto
                  </a>
                </li>
              </ul>
            </div>

            <!-- Logout Button -->
            <button
              v-if="userState.email"
              class="btn btn-outline-danger me-2"
              @click="handleLogout"
            >
              Logout
            </button>
            <!-- Login Button -->
            <RouterLink v-else class="btn btn-outline-primary me-2" to="/login"> Login </RouterLink>
            <!-- Register Button -->
            <RouterLink class="btn btn-outline-success" to="/register"> Sign Up </RouterLink>
            <!-- Logo -->
            <RouterLink class="navbar-brand ms-3" to="/">
              <img src="@/assets/logo.svg" alt="Logo" height="80" />
            </RouterLink>
          </div>
        </div>
      </nav>
    </header>

    <div class="main-layout">
      <!-- Sidebar (Hidden on About Page) -->

      <!-- Main Content -->
      <main class="content">
        <RouterView :theme="theme" @user-logged-in="handleUserLoggedIn" />
      </main>
    </div>
  </div>
</template>

<style>
.bg-dark {
  background-color: #343a40 !important;
}
.text-white {
  color: #fff !important;
}
</style>
