<template>
  <div class="branding-page">
    <!-- Page Header -->
    <div class="page-header bg-light py-4">
      <div class="container-fluid">
        <div class="row align-items-center">
          <div class="col">
            <h1 class="page-title mb-1">
              <i class="fas fa-palette me-2 text-primary"></i>
              Domain Branding Management
            </h1>
            <p class="page-subtitle text-muted mb-0">
              Configure custom domains with unique branding and content filtering
            </p>
          </div>
          <div class="col-auto">
            <router-link to="/dashboard" class="btn btn-outline-secondary">
              <i class="fas fa-arrow-left me-2"></i>
              Back to Dashboard
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="page-content py-4">
      <div class="container-fluid">
        <div class="row">
          <div class="col-12">
            <div class="card shadow-sm">
              <div class="card-header">
                <h4 class="card-title mb-0">Branding Configuration</h4>
              </div>
              <div class="card-body">
                <div class="alert alert-success">
                  <i class="fas fa-check-circle me-2"></i>
                  Success! This is the new dedicated branding management page. Much better UX than the modal!
                </div>

                <h5>Domain Management</h5>
                <div class="mb-3">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>Total Domains:</span>
                    <span class="badge bg-primary">{{ domainConfigs.length }}</span>
                  </div>
                </div>

                <div class="mt-4">
                  <h6>Navigation Options:</h6>
                  <div class="btn-group" role="group">
                    <button
                      @click="viewMode = 'list'"
                      class="btn btn-outline-primary"
                      :class="{ active: viewMode === 'list' }"
                    >
                      <i class="fas fa-list me-1"></i>
                      List View
                    </button>
                    <button
                      @click="viewMode = 'add'"
                      class="btn btn-outline-success"
                      :class="{ active: viewMode === 'add' }"
                    >
                      <i class="fas fa-plus me-1"></i>
                      Add Domain
                    </button>
                    <button
                      @click="viewMode = 'edit'"
                      class="btn btn-outline-warning"
                      :class="{ active: viewMode === 'edit' }"
                    >
                      <i class="fas fa-edit me-1"></i>
                      Edit Domain
                    </button>
                  </div>
                </div>

                <!-- Content based on view mode -->
                <div class="mt-4">
                  <div v-if="viewMode === 'list'" class="view-content">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                      <h6 class="mb-0">Your Configured Domains</h6>
                      <button @click="refreshDomains" class="btn btn-outline-secondary btn-sm">
                        <i class="fas fa-sync me-1"></i>
                        Refresh
                      </button>
                    </div>

                    <!-- Domain List -->
                    <div v-if="domainConfigs.length > 0" class="domain-list">
                      <div v-for="(config, index) in domainConfigs" :key="index" class="domain-card mb-3">
                        <div class="card">
                          <div class="card-body">
                            <div class="row align-items-center">
                              <div class="col">
                                <div class="d-flex align-items-center mb-2">
                                  <!-- Domain Logo -->
                                  <div v-if="config.logo" class="domain-logo-container me-3">
                                    <img
                                      :src="config.logo"
                                      :alt="config.domain + ' logo'"
                                      class="domain-logo-preview"
                                    />
                                  </div>

                                  <!-- Domain Info -->
                                  <div>
                                    <h6 class="mb-1">
                                      <a :href="`https://${config.domain}`" target="_blank" class="text-decoration-none">
                                        {{ config.domain }}
                                        <i class="bi bi-box-arrow-up-right ms-1 small"></i>
                                      </a>
                                    </h6>
                                    <p class="text-muted mb-0 small">{{ config.title || 'No title set' }}</p>
                                  </div>
                                </div>

                                <!-- Badges -->
                                <div class="d-flex gap-2 flex-wrap">
                                  <span class="badge bg-primary">{{ config.filtering || 'No filtering' }}</span>
                                  <span v-if="config.showSearchBar" class="badge bg-success">Search Bar</span>
                                  <span v-else class="badge bg-secondary">No Search Bar</span>
                                  <span v-if="config.logo" class="badge bg-info">Custom Logo</span>
                                </div>
                              </div>

                              <!-- Action Buttons -->
                              <div class="col-auto">
                                <div class="d-flex gap-2">
                                  <button
                                    @click="editDomain(index)"
                                    class="btn btn-outline-primary"
                                    title="Edit domain configuration"
                                  >
                                    <i class="fas fa-edit me-1"></i>
                                    Edit
                                  </button>
                                  <button
                                    @click="deleteDomain(index)"
                                    class="btn btn-outline-danger"
                                    title="Delete domain"
                                  >
                                    <i class="fas fa-trash me-1"></i>
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- No domains message -->
                    <div v-else class="text-center py-5">
                      <i class="fas fa-globe fa-3x text-muted mb-3"></i>
                      <h5 class="text-muted">No domains configured yet</h5>
                      <p class="text-muted mb-3">Get started by adding your first custom domain</p>
                      <button @click="startAddDomain" class="btn btn-primary">
                        <i class="fas fa-plus me-2"></i>
                        Add Your First Domain
                      </button>
                    </div>
                  </div>

                  <div v-if="viewMode === 'add'" class="view-content">
                    <h6>Add New Domain</h6>
                    <p>Form to add a new domain with branding configuration - now with unlimited space!</p>
                    <div class="demo-content bg-light p-4 rounded">
                      <p class="text-muted mb-0">Domain creation form with full-page real estate</p>
                    </div>
                  </div>

                  <div v-if="viewMode === 'edit'" class="view-content">
                    <h6>Edit Domain</h6>
                    <p>Form to edit existing domain configuration - no more scrollbar issues!</p>
                    <div class="demo-content bg-light p-4 rounded">
                      <p class="text-muted mb-0">All branding options visible without scrolling constraints</p>
                    </div>
                  </div>
                </div>

                <!-- Future Implementation Note -->
                <div class="mt-5">
                  <div class="alert alert-info">
                    <h6 class="alert-heading">Implementation Plan</h6>
                    <p class="mb-0">The full branding interface from BrandingModal.vue can now be moved here with proper page layout, better navigation, and improved user experience.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useDomainStore } from '@/stores/domainStore'

export default {
  name: 'BrandingPage',
  setup() {
    const userStore = useUserStore()
    const domainStore = useDomainStore()
    const viewMode = ref('list')

    // Get domain configurations from the store
    const domainConfigs = computed(() => domainStore.allDomains || [])

    // Load domains when component mounts
    onMounted(async () => {
      try {
        await domainStore.loadDomains(userStore.email)
        console.log('Domains loaded:', domainConfigs.value.length)
      } catch (error) {
        console.error('Error loading domains:', error)
      }
    })

    const startAddDomain = () => {
      viewMode.value = 'add'
    }

    const editDomain = (index) => {
      viewMode.value = 'edit'
      console.log('Editing domain at index:', index)
      // Could store which domain is being edited
    }

    const deleteDomain = (index) => {
      if (confirm('Are you sure you want to delete this domain?')) {
        // Domain deletion logic would go here
        console.log('Delete domain at index:', index)
      }
    }

    const refreshDomains = async () => {
      try {
        await domainStore.loadDomains(userStore.email)
        console.log('Domains refreshed')
      } catch (error) {
        console.error('Error refreshing domains:', error)
      }
    }

    return {
      userStore,
      domainStore,
      viewMode,
      domainConfigs,
      startAddDomain,
      editDomain,
      deleteDomain,
      refreshDomains
    }
  }
}
</script>

<style scoped>
.branding-page {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.page-header {
  border-bottom: 1px solid #dee2e6;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 600;
}

.page-subtitle {
  font-size: 1rem;
}

.card {
  border: none;
  border-radius: 12px;
}

.card-header {
  background-color: #fff;
  border-bottom: 1px solid #e9ecef;
  border-radius: 12px 12px 0 0 !important;
}

.demo-content {
  border: 2px dashed #28a745;
  text-align: center;
}

.domain-logo-preview {
  max-width: 120px;
  max-height: 50px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.domain-logo-container {
  flex-shrink: 0;
}

.domain-card .card {
  border: 1px solid #e9ecef;
  transition: box-shadow 0.15s ease-in-out;
}

.domain-card .card:hover {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.btn-outline-primary, .btn-outline-danger {
  min-width: 80px;
}

.btn-group .btn.active {
  background-color: var(--bs-primary);
  color: white;
  border-color: var(--bs-primary);
}

.view-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
