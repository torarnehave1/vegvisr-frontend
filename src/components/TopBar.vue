<template>
  <div class="top-bar sticky-top bg-light p-3 border-bottom">
    <div class="container-fluid">
      <div class="row align-items-center">
        <!-- Sidebar Toggle Button -->
        <div class="col-auto">
          <button class="btn btn-outline-secondary" @click="$emit('toggle-sidebar')">
            <span class="material-icons"> menu </span>
          </button>
        </div>

        <!-- GitHub Issues Button -->
        <div class="col-auto">
          <RouterLink to="/github-issues" class="btn btn-outline-primary">
            <span class="material-icons">map</span>
            <span class="ms-1">Roadmap</span>
          </RouterLink>
        </div>

        <!-- Logged-in User -->
        <div class="col-md-3 col-sm-12">
          <p class="mb-0">
            <strong>Logged in as:</strong>
            <span>{{ userStore.email || 'Guest' }}</span>
          </p>
        </div>

        <!-- Graph Selector -->
        <div class="col-md-3 col-sm-12">
          <label for="graphDropdown" class="form-label">
            <strong>Select Knowledge Graph:</strong>
          </label>
          <select
            id="graphDropdown"
            :value="selectedGraphId"
            @change="$emit('update:selectedGraphId', $event.target.value)"
            class="form-select"
          >
            <option value="" disabled>Select a graph</option>
            <option v-for="graph in knowledgeGraphs" :key="graph.id" :value="graph.id">
              {{ graph.title || 'Untitled Graph' }}
              <!-- Fallback to 'Untitled Graph' if title is missing -->
            </option>
          </select>
        </div>

        <!-- Current Graph ID -->
        <div class="col-md-3 col-sm-12 text-center">
          <p class="mb-0">
            <strong>Current Graph ID:</strong>
            <span>{{ currentGraphId || 'Not saved yet' }}</span>
          </p>
        </div>

        <!-- Validation Errors -->
        <div class="col-md-12 col-sm-12">
          <div v-if="validationErrors.length" class="alert alert-danger mb-0 mt-2" role="alert">
            <strong>Graph Validation Errors:</strong>
            <ul class="mb-0">
              <li v-for="(error, index) in validationErrors" :key="index">{{ error }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Dedicated Search Bar Section -->
  <div v-if="showSearchBar" class="search-bar-section">
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
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { defineProps, defineEmits } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useRouter } from 'vue-router'
import { RouterLink } from 'vue-router'
import { useBranding } from '@/composables/useBranding'

const router = useRouter()
const userStore = useUserStore()
const { showSearchBar } = useBranding()

defineProps({
  selectedGraphId: String,
  knowledgeGraphs: Array,
  currentGraphId: String,
  validationErrors: Array,
})

defineEmits(['update:selectedGraphId', 'toggle-sidebar'])

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
</script>

<style scoped>
.top-bar {
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
