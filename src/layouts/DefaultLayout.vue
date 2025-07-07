<template>
  <div class="default-layout">
    <!-- Top Menu (Header) -->
    <header class="top-menu w-100">
      <nav class="navbar navbar-expand-lg navbar-light bg-light">
        <div class="container-fluid">
          <RouterLink class="navbar-brand" to="/">
            <img :src="currentLogo" :alt="currentSiteTitle + ' Logo'" width="200" />
          </RouterLink>

          <!-- Global Search Bar (Mobile and Desktop) -->
          <div class="global-search-container d-none d-md-block me-3">
            <div class="global-search">
              <div class="input-group">
                <input
                  type="text"
                  class="form-control"
                  v-model="globalSearchQuery"
                  placeholder="Search knowledge graphs..."
                  @keyup.enter="performGlobalSearch"
                  @focus="showSearchHint = true"
                  @blur="showSearchHint = false"
                />
                <button
                  class="btn btn-outline-primary"
                  @click="performGlobalSearch"
                  :disabled="!globalSearchQuery.trim()"
                >
                  <i class="bi bi-search"></i>
                </button>
              </div>
              <div v-if="showSearchHint" class="search-hint">
                <small class="text-muted">🧠 Semantic search across all graphs</small>
              </div>
            </div>
          </div>

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
            <!-- Mobile Search Bar -->
            <div class="mobile-search-container d-block d-md-none mb-3">
              <div class="global-search">
                <div class="input-group">
                  <input
                    type="text"
                    class="form-control"
                    v-model="globalSearchQuery"
                    placeholder="Search knowledge graphs..."
                    @keyup.enter="performGlobalSearch"
                  />
                  <button
                    class="btn btn-outline-primary"
                    @click="performGlobalSearch"
                    :disabled="!globalSearchQuery.trim()"
                  >
                    <i class="bi bi-search"></i>
                  </button>
                </div>
              </div>
            </div>

            <ul class="navbar-nav me-auto">
              <li class="nav-item">
                <RouterLink class="nav-link" to="/graph-editor">Editor</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/graph-canvas">🎨 Canvas</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/graph-portfolio">Portfolio</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/graph-viewer">Viewer</RouterLink>
              </li>
              <li class="nav-item">
                <RouterLink class="nav-link" to="/search">🔍 Search</RouterLink>
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
              <!-- Sandbox link - only for Superadmin users -->
              <li v-if="userStore.role === 'Superadmin'" class="nav-item">
                <RouterLink class="nav-link" to="/sandbox"> 🔧 Sandbox </RouterLink>
              </li>
              <!-- GNew link - only for Superadmin users -->
              <li v-if="userStore.role === 'Superadmin'" class="nav-item">
                <RouterLink class="nav-link" to="/gnew"> 🧪 GNew Viewer </RouterLink>
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
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useRouter } from 'vue-router'
import { useBranding } from '@/composables/useBranding'

const userStore = useUserStore()
const router = useRouter()
const { currentLogo, currentSiteTitle, isCustomDomain } = useBranding()

// Global search functionality
const globalSearchQuery = ref('')
const showSearchHint = ref(false)

const performGlobalSearch = () => {
  if (!globalSearchQuery.value.trim()) return

  // Navigate to search view with query
  router.push({
    name: 'search',
    query: { q: globalSearchQuery.value },
  })

  // Clear the search input
  globalSearchQuery.value = ''
}

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
  userStore.logout()
  emit('logout')
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

/* Global Search Styles */
.global-search-container {
  min-width: 300px;
  max-width: 400px;
}

.global-search {
  position: relative;
}

.global-search .form-control {
  border-radius: 20px 0 0 20px;
  border-right: none;
  font-size: 0.9rem;
}

.global-search .btn {
  border-radius: 0 20px 20px 0;
  border-left: none;
}

.global-search .form-control:focus {
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
  border-color: #007bff;
}

.search-hint {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #dee2e6;
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 0.5rem;
  z-index: 1001;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.mobile-search-container {
  padding: 0.5rem 0;
}

.mobile-search-container .global-search .form-control {
  border-radius: 4px 0 0 4px;
}

.mobile-search-container .global-search .btn {
  border-radius: 0 4px 4px 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .global-search-container {
    min-width: 250px;
  }

  .search-hint {
    font-size: 0.8rem;
  }
}

@media (max-width: 576px) {
  .global-search-container {
    min-width: 200px;
  }

  .global-search .form-control {
    font-size: 0.8rem;
  }
}
</style>
