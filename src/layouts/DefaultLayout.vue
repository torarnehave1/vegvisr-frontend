<template>
  <div class="default-layout">
    <!-- Top Menu (Header) -->
    <header class="top-menu w-100">
      <nav class="navbar navbar-expand-lg navbar-light bg-light">
        <div class="container-fluid">
          <RouterLink class="navbar-brand" to="/">
            <img :src="currentLogo" :alt="currentSiteTitle + ' Logo'" width="200" />
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
              <li v-for="item in visibleMenuItems" :key="item.id" class="nav-item">
                <!-- Route items -->
                <RouterLink
                  v-if="!item.type || item.type === 'route'"
                  class="nav-link"
                  :to="item.path"
                >
                  <span v-if="item.icon" class="me-1">{{ item.icon }}</span>
                  {{ item.label }}
                </RouterLink>

                <!-- External links -->
                <a
                  v-else-if="item.type === 'external'"
                  class="nav-link"
                  :href="item.url || item.path"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span v-if="item.icon" class="me-1">{{ item.icon }}</span>
                  {{ item.label }}
                </a>

                <!-- Graph links -->
                <RouterLink
                  v-else-if="item.type === 'graph-link'"
                  class="nav-link"
                  :to="`/gnew-viewer?graphId=${item.graphId}`"
                >
                  <span v-if="item.icon" class="me-1">{{ item.icon }}</span>
                  {{ item.label }}
                </RouterLink>

                <!-- Fallback for other types -->
                <RouterLink v-else class="nav-link" :to="item.path || '/'">
                  <span v-if="item.icon" class="me-1">{{ item.icon }}</span>
                  {{ item.label }}
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
            <a
              v-else
              class="btn btn-outline-primary me-2 btn-lg"
              href="https://login.vegvisr.org/"
            >
              Login
            </a>
            <!-- Register Button -->
            <a class="btn btn-outline-success me-3 btn-lg" href="https://login.vegvisr.org/">
              Sign Up
            </a>
          </div>
        </div>
      </nav>
    </header>

    <!-- Dedicated Search Bar Section -->
    <section v-if="showSearchBar" class="search-bar-section">
      <div class="container-fluid">
        <div class="row justify-content-center">
          <div class="col-12 col-md-8 col-lg-6">
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
        </div>
      </div>
    </section>

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
import { useMenuConfig } from '@/composables/useMenuConfig'

const userStore = useUserStore()
const router = useRouter()
const { currentLogo, currentSiteTitle, isCustomDomain, currentMenuConfig, showSearchBar } = useBranding()

// Use menu configuration system
const { visibleMenuItems } = useMenuConfig(currentMenuConfig)

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

/* Search Bar Section Styles */
.search-bar-section {
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  padding: 15px 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.global-search {
  position: relative;
}

.global-search .form-control {
  border-radius: 25px 0 0 25px;
  border-right: none;
  font-size: 1rem;
  padding: 12px 20px;
  border: 2px solid #e9ecef;
  transition: all 0.3s ease;
}

.global-search .btn {
  border-radius: 0 25px 25px 0;
  border-left: none;
  padding: 12px 20px;
  border: 2px solid #007bff;
  background-color: #007bff;
  transition: all 0.3s ease;
}

.global-search .form-control:focus {
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.15);
  border-color: #007bff;
  outline: none;
}

.global-search .btn:hover:not(:disabled) {
  background-color: #0056b3;
  border-color: #0056b3;
  transform: translateY(-1px);
}

.search-hint {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #dee2e6;
  border-top: none;
  border-radius: 0 0 12px 12px;
  padding: 10px 15px;
  z-index: 1001;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-top: 2px;
}

@media (max-width: 768px) {
  .search-bar-section {
    padding: 12px 0;
  }

  .global-search .form-control,
  .global-search .btn {
    padding: 10px 16px;
    font-size: 0.9rem;
  }

  .search-hint {
    font-size: 0.85rem;
    padding: 8px 12px;
  }
}

@media (max-width: 576px) {
  .search-bar-section .col-12 {
    padding: 0 15px;
  }
}
</style>
