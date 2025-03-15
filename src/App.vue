<script setup>
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

const theme = ref('light')

const setTheme = (newTheme) => {
  theme.value = newTheme
  document.body.classList.remove('bg-dark', 'text-white')
  if (newTheme === 'dark') {
    document.body.classList.add('bg-dark', 'text-white')
  }
}
</script>

<template>
  <div :class="['app-container', { 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }]">
    <!-- Top Menu (Header) -->
    <header class="top-menu">
      <nav class="navbar navbar-expand-lg navbar-light bg-light">
        <div class="container-fluid">
          <RouterLink class="navbar-brand" to="/">MyApp</RouterLink>
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
            </ul>
            <div class="dropdown">
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
            <RouterLink class="navbar-brand ms-auto" to="/">
              <img src="@/assets/logo.svg" alt="Logo" height="80" />
            </RouterLink>
          </div>
        </div>
      </nav>
    </header>

    <div class="main-layout">
      <!-- Sidebar (Hidden on About Page) -->
      <aside class="sidebar">
        <nav>
          <RouterLink to="/dashboard">Dashboard</RouterLink>
          <RouterLink to="/profile">Profile</RouterLink>
          <RouterLink to="/settings">Settings</RouterLink>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="content">
        <RouterView />
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
