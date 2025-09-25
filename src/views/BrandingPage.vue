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
                <!-- Success/Error Messages -->
                <div v-if="successMessage" class="alert alert-success alert-dismissible fade show" role="alert">
                  <i class="fas fa-check-circle me-2"></i>
                  {{ successMessage }}
                  <button type="button" class="btn-close" @click="successMessage = ''" aria-label="Close"></button>
                </div>

                <div v-if="errorMessage" class="alert alert-danger alert-dismissible fade show" role="alert">
                  <i class="fas fa-exclamation-circle me-2"></i>
                  {{ errorMessage }}
                  <button type="button" class="btn-close" @click="errorMessage = ''" aria-label="Close"></button>
                </div>

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
                      <!-- List View Options -->
                      <div class="list-controls mb-4">
                        <div class="row align-items-center">
                          <div class="col-auto">
                            <h6 class="mb-0 text-muted">
                              {{ domainConfigs.length }} domain{{ domainConfigs.length !== 1 ? 's' : '' }} configured
                            </h6>
                          </div>
                          <div class="col-auto ms-auto">
                            <div class="btn-group btn-group-sm">
                              <button @click="startAddDomain" class="btn btn-primary">
                                <i class="fas fa-plus me-1"></i>
                                Add Domain
                              </button>
                              <button @click="refreshDomains" class="btn btn-outline-secondary">
                                <i class="fas fa-sync me-1"></i>
                                Refresh
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Enhanced Domain Grid -->
                      <div class="row g-3">
                        <div
                          v-for="(config, index) in domainConfigs"
                          :key="config.domain"
                          class="col-lg-6 col-xl-4"
                        >
                          <div class="domain-card h-100">
                            <div class="card h-100 border-0 shadow-sm">
                              <div class="card-header bg-transparent border-bottom-0 pb-0">
                                <div class="d-flex align-items-start justify-content-between">
                                  <!-- Domain Status & Logo -->
                                  <div class="d-flex align-items-center">
                                    <div v-if="config.logo" class="domain-logo-container me-3">
                                      <img
                                        :src="config.logo"
                                        :alt="config.domain + ' logo'"
                                        class="domain-logo-preview"
                                      />
                                    </div>
                                    <div v-else class="domain-logo-placeholder me-3">
                                      <i class="fas fa-image text-muted"></i>
                                    </div>
                                    <div class="domain-status">
                                      <!-- Change indicators -->
                                      <span
                                        v-if="domainStore.newDomains.has(config.domain)"
                                        class="badge bg-success mb-1"
                                        title="This domain is new and will be saved to server"
                                      >
                                        NEW
                                      </span>
                                      <span
                                        v-else-if="domainStore.updatedDomains.has(config.domain)"
                                        class="badge bg-warning text-dark mb-1"
                                        title="This domain has unsaved changes"
                                      >
                                        MODIFIED
                                      </span>
                                    </div>
                                  </div>

                                  <!-- Quick Actions Dropdown -->
                                  <div class="dropdown">
                                    <button
                                      class="btn btn-outline-secondary btn-sm dropdown-toggle"
                                      type="button"
                                      :id="'domainActions' + index"
                                      data-bs-toggle="dropdown"
                                      aria-expanded="false"
                                    >
                                      <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-end" :aria-labelledby="'domainActions' + index">
                                      <li>
                                        <a class="dropdown-item" href="#" @click.prevent="editDomain(index)">
                                          <i class="fas fa-edit me-2"></i>
                                          Edit Configuration
                                        </a>
                                      </li>
                                      <li>
                                        <a
                                          class="dropdown-item"
                                          :href="`https://${config.domain}`"
                                          target="_blank"
                                        >
                                          <i class="fas fa-external-link-alt me-2"></i>
                                          Visit Domain
                                        </a>
                                      </li>
                                      <li><hr class="dropdown-divider"></li>
                                      <li>
                                        <a
                                          class="dropdown-item text-danger"
                                          href="#"
                                          @click.prevent="deleteDomain(index)"
                                        >
                                          <i class="fas fa-trash me-2"></i>
                                          Delete Domain
                                        </a>
                                      </li>
                                    </ul>
                                  </div>
                                </div>
                              </div>

                              <div class="card-body pt-2">
                                <!-- Domain Name & Link -->
                                <h6 class="card-title mb-2">
                                  <a
                                    :href="`https://${config.domain}`"
                                    target="_blank"
                                    class="text-decoration-none fw-bold"
                                    :title="`Visit ${config.domain} (opens in new tab)`"
                                  >
                                    {{ config.domain }}
                                    <i class="fas fa-external-link-alt ms-1 small text-muted"></i>
                                  </a>
                                </h6>

                                <!-- Domain Description -->
                                <p class="card-text text-muted small mb-3">
                                  {{ getCardDescription(config) }}
                                </p>

                                <!-- Feature Badges -->
                                <div class="domain-features">
                                  <div class="d-flex flex-wrap gap-1 mb-2">
                                    <span v-if="config.logo" class="badge rounded-pill bg-success-subtle text-success">
                                      <i class="fas fa-check me-1"></i>Logo
                                    </span>
                                    <span v-else class="badge rounded-pill bg-light text-muted">
                                      <i class="fas fa-times me-1"></i>No Logo
                                    </span>

                                    <span class="badge rounded-pill bg-info-subtle text-info">
                                      {{
                                        config.contentFilter === 'none'
                                          ? 'All Content'
                                          : config.selectedCategories?.length > 0
                                          ? `${config.selectedCategories.length} Filter${config.selectedCategories.length !== 1 ? 's' : ''}`
                                          : 'Custom Filter'
                                      }}
                                    </span>

                                    <span
                                      v-if="config.showSearchBar !== false"
                                      class="badge rounded-pill bg-primary-subtle text-primary"
                                    >
                                      <i class="fas fa-search me-1"></i>Search
                                    </span>
                                    <span v-else class="badge rounded-pill bg-light text-muted">
                                      <i class="fas fa-search-minus me-1"></i>No Search
                                    </span>

                                    <span v-if="config.mySiteFrontPage" class="badge rounded-pill bg-warning-subtle text-warning">
                                      <i class="fas fa-home me-1"></i>Custom Home
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <!-- Card Footer with Actions -->
                              <div class="card-footer bg-transparent border-top-0 pt-0">
                                <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                                  <button
                                    @click="editDomain(index)"
                                    class="btn btn-outline-primary btn-sm flex-fill"
                                    title="Edit domain configuration"
                                  >
                                    <i class="fas fa-edit me-1"></i>
                                    Edit
                                  </button>
                                  <button
                                    @click="deleteDomain(index)"
                                    class="btn btn-outline-danger btn-sm flex-fill"
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
                    <DomainForm
                      :show-back-button="true"
                      @back="viewMode = 'list'"
                      @cancel="viewMode = 'list'"
                      @saved="handleDomainSaved"
                    />
                  </div>

                  <div v-if="viewMode === 'edit'" class="view-content">
                    <DomainForm
                      :domain-config="editingDomain"
                      :show-back-button="true"
                      @back="cancelEdit"
                      @cancel="cancelEdit"
                      @saved="handleDomainSaved"
                    />
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
import DomainForm from '@/components/DomainForm.vue'

export default {
  name: 'BrandingPage',
  components: {
    DomainForm
  },
  setup() {
    const userStore = useUserStore()
    const domainStore = useDomainStore()
    const viewMode = ref('list')
    const editingDomain = ref(null)
    const successMessage = ref('')
    const errorMessage = ref('')

    // Get domain configurations from the store
    const domainConfigs = computed(() => domainStore.allDomains || [])

    // Load domains when component mounts
    onMounted(async () => {
      try {
        await domainStore.loadDomains(userStore.email)
        console.log('Domains loaded:', domainConfigs.value.length)
      } catch (error) {
        console.error('Error loading domains:', error)
        errorMessage.value = 'Failed to load domains. Please refresh the page.'
      }
    })

    const startAddDomain = () => {
      editingDomain.value = null
      viewMode.value = 'add'
    }

    const editDomain = (index) => {
      const domain = domainConfigs.value[index]
      if (domain) {
        editingDomain.value = { ...domain }
        viewMode.value = 'edit'
        console.log('Editing domain:', domain.domain)
      }
    }

    const cancelEdit = () => {
      editingDomain.value = null
      viewMode.value = 'list'
    }

    const deleteDomain = async (index) => {
      const domain = domainConfigs.value[index]
      if (!domain) return

      if (confirm(`Are you sure you want to delete "${domain.domain}"? This action cannot be undone.`)) {
        try {
          domainStore.removeDomain(domain.domain)
          await domainStore.saveChanges(userStore.email)

          successMessage.value = `✅ Domain "${domain.domain}" deleted successfully!`
          setTimeout(() => { successMessage.value = '' }, 5000)

          console.log('Domain deleted:', domain.domain)
        } catch (error) {
          console.error('Error deleting domain:', error)
          errorMessage.value = `❌ Failed to delete domain "${domain.domain}". Please try again.`
          setTimeout(() => { errorMessage.value = '' }, 5000)
        }
      }
    }

    const handleDomainSaved = (result) => {
      if (result.success) {
        successMessage.value = result.message
        viewMode.value = 'list'
        editingDomain.value = null
      } else {
        errorMessage.value = result.message
      }

      // Clear messages after 5 seconds
      setTimeout(() => {
        successMessage.value = ''
        errorMessage.value = ''
      }, 5000)
    }

    const refreshDomains = async () => {
      try {
        await domainStore.loadDomains(userStore.email)
        successMessage.value = '✅ Domains refreshed successfully!'
        setTimeout(() => { successMessage.value = '' }, 3000)
        console.log('Domains refreshed')
      } catch (error) {
        console.error('Error refreshing domains:', error)
        errorMessage.value = '❌ Failed to refresh domains. Please try again.'
        setTimeout(() => { errorMessage.value = '' }, 5000)
      }
    }

    const getCardDescription = (config) => {
      const features = []

      if (config.contentFilter === 'custom' && config.selectedCategories?.length > 0) {
        features.push(`Filtered content (${config.selectedCategories.length} categories)`)
      } else {
        features.push('All content visible')
      }

      if (config.mySiteFrontPage) {
        features.push('Custom landing page')
      }

      if (config.showSearchBar === false) {
        features.push('Search disabled')
      }

      return features.length > 0 ? features.join(' • ') : 'Standard configuration'
    }

    return {
      userStore,
      domainStore,
      viewMode,
      editingDomain,
      successMessage,
      errorMessage,
      domainConfigs,
      startAddDomain,
      editDomain,
      cancelEdit,
      deleteDomain,
      handleDomainSaved,
      refreshDomains,
      getCardDescription
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.page-header .btn-outline-secondary {
  border-color: rgba(255, 255, 255, 0.3);
  color: white;
}

.page-header .btn-outline-secondary:hover {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.5);
  color: white;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 600;
}

.page-subtitle {
  font-size: 1rem;
  opacity: 0.9;
}

.card {
  border: none;
  border-radius: 12px;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  transition: box-shadow 0.15s ease-in-out, transform 0.15s ease-in-out;
}

.card:hover {
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
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

/* Enhanced Domain Cards */
.domain-card .card {
  border: 1px solid #e9ecef;
  transition: all 0.2s ease-in-out;
}

.domain-card .card:hover {
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
  border-color: #007bff;
}

.domain-logo-preview {
  max-width: 60px;
  max-height: 40px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  background: #fff;
  padding: 4px;
}

.domain-logo-placeholder {
  width: 60px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  font-size: 1.2rem;
}

.domain-logo-container {
  flex-shrink: 0;
}

.domain-features .badge {
  font-size: 0.7rem;
  font-weight: 500;
}

.badge.rounded-pill {
  padding: 0.35em 0.75em;
}

.bg-success-subtle {
  background-color: rgba(25, 135, 84, 0.1) !important;
}

.bg-info-subtle {
  background-color: rgba(13, 202, 240, 0.1) !important;
}

.bg-primary-subtle {
  background-color: rgba(13, 110, 253, 0.1) !important;
}

.bg-warning-subtle {
  background-color: rgba(255, 193, 7, 0.1) !important;
}

.text-success {
  color: #198754 !important;
}

.text-info {
  color: #0dcaf0 !important;
}

.text-primary {
  color: #0d6efd !important;
}

.text-warning {
  color: #ffc107 !important;
}

.list-controls {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
}

.btn-group .btn.active {
  background-color: var(--bs-primary);
  color: white;
  border-color: var(--bs-primary);
}

.view-content {
  animation: fadeIn 0.3s ease-in-out;
}

.alert {
  border-radius: 10px;
  border: none;
}

.alert-success {
  background: linear-gradient(135deg, #d4edda, #c3e6cb);
}

.alert-danger {
  background: linear-gradient(135deg, #f8d7da, #f5c2c7);
}

.dropdown-menu {
  border: none;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}

.dropdown-item {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  margin: 0 0.25rem;
}

.dropdown-item:hover {
  background-color: #f8f9fa;
}

.dropdown-item.text-danger:hover {
  background-color: #f8d7da;
  color: #721c24 !important;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .page-title {
    font-size: 1.5rem;
  }

  .domain-card .card-footer .btn {
    font-size: 0.8rem;
    padding: 0.375rem 0.5rem;
  }

  .domain-logo-preview,
  .domain-logo-placeholder {
    max-width: 50px;
    max-height: 35px;
    width: 50px;
    height: 35px;
  }

  .list-controls {
    padding: 0.75rem;
  }
}

@media (max-width: 576px) {
  .card-footer .d-md-flex {
    flex-direction: column !important;
  }

  .card-footer .btn {
    margin-bottom: 0.5rem;
  }

  .card-footer .btn:last-child {
    margin-bottom: 0;
  }
}

/* Dark mode support (if needed) */
@media (prefers-color-scheme: dark) {
  .branding-page {
    background-color: #1a1a1a;
  }

  .card {
    background-color: #2d2d2d;
    border-color: #404040;
  }

  .list-controls {
    background-color: #2d2d2d;
    border-color: #404040;
  }
}
</style>
