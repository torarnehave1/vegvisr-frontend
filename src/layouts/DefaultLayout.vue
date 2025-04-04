<template>
  <div class="default-layout">
    <!-- Top Menu (Header) -->
    <header class="top-menu w-100">
      <nav class="navbar navbar-expand-lg navbar-light bg-light">
        <div class="container-fluid">
          <RouterLink class="navbar-brand" to="/">
            <img src="../assets/logo.svg" alt="Vegvisr Logo" width="200" />
          </RouterLink>
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
                <RouterLink class="nav-link" to="/book">Book</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/soundstudio">Sound Studio</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/user">Dashboard</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/editor">Editor</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/blog">Blog</RouterLink>
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
                  <a class="dropdown-item" href="#" @click.prevent="$emit('set-theme', 'light')">
                    <i class="bi bi-sun"></i> Light
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="#" @click.prevent="$emit('set-theme', 'dark')">
                    <i class="bi bi-moon"></i> Dark
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="#" @click.prevent="$emit('set-theme', 'auto')">
                    <i class="bi bi-circle-half"></i> Auto
                  </a>
                </li>
              </ul>
            </div>

            <!-- Logout Button -->
            <button v-if="userEmail" class="btn btn-outline-danger me-2" @click="$emit('logout')">
              Logout
            </button>
            <!-- Login Button -->
            <RouterLink v-else class="btn btn-outline-primary me-2" to="/login"> Login </RouterLink>
            <!-- Register Button -->
            <RouterLink class="btn btn-outline-success me-3" to="/register"> Sign Up </RouterLink>
          </div>
        </div>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
defineProps({
  theme: {
    type: String,
    default: 'light',
  },
  userEmail: {
    type: String,
    default: '',
  },
})
defineEmits(['set-theme', 'logout'])
</script>

<style scoped>
.navbar-brand {
  display: flex;
  align-items: center;
}
.top-menu nav {
  background-color: #2c3e50;
}

.top-menu {
  width: 100%;
  background-color: #958380;
}
.content {
  padding: 1rem;
}
.navbar-brand img {
  margin-left: auto;
}
</style>
