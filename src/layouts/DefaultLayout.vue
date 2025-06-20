<template>
  <div class="default-layout">
    <!-- Top Menu (Header) -->
    <header class="top-menu w-100">
      <nav class="navbar navbar-expand-lg navbar-light bg-light">
        <div class="container-fluid">
          <RouterLink class="navbar-brand" to="/">
            <img :src="currentLogo" :alt="currentSiteTitle + ' Logo'" width="200" />
            <span v-if="isCustomDomain" class="ms-2 site-title">{{ currentSiteTitle }}</span>
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
                <RouterLink class="nav-link" to="/graph-editor">Editor</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/graph-portfolio">Portfolio</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/graph-viewer">Viewer</RouterLink>
              </li>

              <li class="nav-item">
                <RouterLink class="nav-link" to="/user">Dashboard</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/github-issues">
                  <span class="material-icons">map</span>
                  Roadmap
                </RouterLink>
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
            <button
              v-if="userEmail"
              class="btn btn-outline-danger me-2 btn-lg"
              @click="handleLogout"
            >
              Logout
            </button>
            <!-- Login Button -->
            <RouterLink v-else class="btn btn-outline-primary me-2 btn-lg" to="/login">
              Login
            </RouterLink>
            <!-- Register Button -->
            <RouterLink class="btn btn-outline-success me-3 btn-lg" to="/register">
              Sign Up
            </RouterLink>
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
import { useUserStore } from '@/stores/userStore' // Import Pinia store
import { useBranding } from '@/composables/useBranding' // Import branding composable

const userStore = useUserStore() // Access Pinia store
const { currentLogo, currentSiteTitle, isCustomDomain } = useBranding() // Use branding composable

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

const emit = defineEmits(['set-theme', 'logout'])

function handleLogout() {
  userStore.logout() // Call Pinia store logout action
  emit('logout') // Emit logout event
}
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

.graph-viewer[data-v-40c491c3] :deep(.node-info img) {
  max-width: 50%;
  height: 10px;
  display: inline-block;
  vertical-align: middle;
  margin: 5px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

img {
  max-width: 100%;
  height: 200px;
  display: block;
  margin: 10px auto;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.site-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #2c3e50;
  text-decoration: none;
}
</style>
