<template>
  <div
    class="modal fade"
    :class="{ show: isVisible }"
    :style="{ display: isVisible ? 'block' : 'none' }"
    tabindex="-1"
    aria-labelledby="adminDomainModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-xl">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="adminDomainModalLabel">
            <i class="fas fa-crown text-warning me-2"></i>
            Superadmin Domain Management
          </h5>
          <button type="button" class="btn-close" @click="closeModal" aria-label="Close"></button>
        </div>

        <div class="modal-body">
          <!-- Loading State -->
          <div v-if="isLoading" class="text-center p-4">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading domains...</span>
            </div>
            <p class="mt-2 text-muted">Loading domain configurations...</p>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="alert alert-danger" role="alert">
            <i class="fas fa-exclamation-triangle me-2"></i>
            {{ error }}
          </div>

          <!-- Domain Management Interface -->
          <div v-else>
            <!-- Summary Stats -->
            <div class="row mb-4">
              <div class="col-md-3">
                <div class="card bg-primary text-white">
                  <div class="card-body">
                    <h5 class="card-title">{{ domains.length }}</h5>
                    <p class="card-text">Total Domains</p>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="card bg-success text-white">
                  <div class="card-body">
                    <h5 class="card-title">{{ uniqueOwners.length }}</h5>
                    <p class="card-text">Unique Owners</p>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="card bg-info text-white">
                  <div class="card-body">
                    <h5 class="card-title">{{ domainsWithLogo }}</h5>
                    <p class="card-text">With Custom Logo</p>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="card bg-warning text-white">
                  <div class="card-body">
                    <h5 class="card-title">{{ domainsWithFilters }}</h5>
                    <p class="card-text">With Content Filters</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Search and Filter -->
            <div class="row mb-3">
              <div class="col-md-6">
                <div class="input-group">
                  <span class="input-group-text">
                    <i class="fas fa-search"></i>
                  </span>
                  <input
                    type="text"
                    class="form-control"
                    placeholder="Search domains or owners..."
                    v-model="searchTerm"
                  />
                </div>
              </div>
              <div class="col-md-3">
                <select class="form-select" v-model="ownerFilter">
                  <option value="">All Owners</option>
                  <option v-for="owner in uniqueOwners" :key="owner" :value="owner">
                    {{ owner }}
                  </option>
                </select>
              </div>
              <div class="col-md-3">
                <div class="btn-group w-100" role="group">
                  <button
                    type="button"
                    class="btn btn-success"
                    @click="openTemplateModal"
                    :disabled="!selectedDomain"
                  >
                    <i class="fas fa-share-alt me-1"></i>
                    Share Template
                  </button>
                </div>
              </div>
            </div>

            <!-- Domain Table -->
            <div class="table-responsive">
              <table class="table table-striped table-hover">
                <thead class="table-dark">
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        class="form-check-input"
                        v-model="selectAll"
                        @change="toggleSelectAll"
                      />
                    </th>
                    <th>Domain</th>
                    <th>Owner</th>
                    <th>Created</th>
                    <th>Last Modified</th>
                    <th>Features</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="domain in filteredDomains"
                    :key="domain.domain"
                    :class="{ 'table-active': selectedDomain === domain.domain }"
                  >
                    <td>
                      <input
                        type="checkbox"
                        class="form-check-input"
                        :value="domain.domain"
                        v-model="selectedDomains"
                        @change="onDomainSelect(domain.domain)"
                      />
                    </td>
                    <td>
                      <div class="d-flex align-items-center">
                        <i class="fas fa-globe text-primary me-2"></i>
                        <div>
                          <strong>{{ domain.domain }}</strong>
                          <br />
                          <small class="text-muted">
                            <a
                              :href="`https://${domain.domain}`"
                              target="_blank"
                              class="text-decoration-none"
                            >
                              Visit <i class="fas fa-external-link-alt"></i>
                            </a>
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="d-flex align-items-center">
                        <i class="fas fa-user text-secondary me-2"></i>
                        <div>
                          {{ domain.owner }}
                          <br />
                          <small class="text-muted">
                            <a :href="`mailto:${domain.owner}`" class="text-decoration-none">
                              Contact <i class="fas fa-envelope"></i>
                            </a>
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <small class="text-muted">
                        {{ formatDate(domain.createdAt) }}
                      </small>
                    </td>
                    <td>
                      <small class="text-muted">
                        {{ formatDate(domain.lastModified) }}
                      </small>
                    </td>
                    <td>
                      <div class="d-flex gap-1">
                        <span v-if="domain.hasLogo" class="badge bg-success">
                          <i class="fas fa-image me-1"></i>Logo
                        </span>
                        <span v-if="domain.hasContentFilters" class="badge bg-info">
                          <i class="fas fa-filter me-1"></i>Filters
                        </span>
                        <span v-if="domain.graphId" class="badge bg-warning">
                          <i class="fas fa-project-diagram me-1"></i>Graph
                        </span>
                      </div>
                    </td>
                    <td>
                      <div class="btn-group" role="group">
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-primary"
                          @click="openTransferModal(domain)"
                          :title="`Transfer ${domain.domain}`"
                        >
                          <i class="fas fa-exchange-alt"></i>
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-info"
                          @click="openTemplateModal(domain)"
                          :title="`Share template from ${domain.domain}`"
                        >
                          <i class="fas fa-share-alt"></i>
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-danger"
                          @click="confirmRemove(domain)"
                          :title="`Remove ${domain.domain}`"
                        >
                          <i class="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Empty State -->
            <div v-if="filteredDomains.length === 0" class="text-center p-4">
              <i class="fas fa-search fa-3x text-muted mb-3"></i>
              <h5 class="text-muted">No domains found</h5>
              <p class="text-muted">
                {{
                  searchTerm || ownerFilter
                    ? 'Try adjusting your search or filters.'
                    : 'No domains have been configured yet.'
                }}
              </p>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeModal">
            <i class="fas fa-times me-1"></i>Close
          </button>
          <button type="button" class="btn btn-primary" @click="refreshDomains">
            <i class="fas fa-sync-alt me-1"></i>Refresh
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Background overlay -->
  <div v-if="isVisible" class="modal-backdrop fade show"></div>

  <!-- Domain Transfer Modal -->
  <DomainTransferModal
    :is-visible="transferModalVisible"
    :domain="selectedDomainForTransfer"
    @close="closeTransferModal"
    @transfer-complete="onTransferComplete"
  />

  <!-- Template Share Modal -->
  <TemplateShareModal
    :is-visible="templateModalVisible"
    :source-domain="selectedDomainForTemplate"
    @close="closeTemplateModal"
    @template-shared="onTemplateShared"
  />
</template>

<script>
import { useUserStore } from '@/stores/userStore'
import DomainTransferModal from '@/components/DomainTransferModal.vue'
import TemplateShareModal from '@/components/TemplateShareModal.vue'

export default {
  name: 'AdminDomainModal',
  components: {
    DomainTransferModal,
    TemplateShareModal,
  },
  props: {
    isVisible: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close', 'domain-updated'],
  data() {
    return {
      domains: [],
      isLoading: false,
      error: null,
      searchTerm: '',
      ownerFilter: '',
      selectedDomains: [],
      selectAll: false,
      selectedDomain: null,
      transferModalVisible: false,
      templateModalVisible: false,
      selectedDomainForTransfer: null,
      selectedDomainForTemplate: null,
    }
  },
  computed: {
    uniqueOwners() {
      return [...new Set(this.domains.map((d) => d.owner))].sort()
    },
    domainsWithLogo() {
      return this.domains.filter((d) => d.hasLogo).length
    },
    domainsWithFilters() {
      return this.domains.filter((d) => d.hasContentFilters).length
    },
    filteredDomains() {
      let filtered = this.domains

      // Apply search filter
      if (this.searchTerm) {
        const term = this.searchTerm.toLowerCase()
        filtered = filtered.filter(
          (d) => d.domain.toLowerCase().includes(term) || d.owner.toLowerCase().includes(term),
        )
      }

      // Apply owner filter
      if (this.ownerFilter) {
        filtered = filtered.filter((d) => d.owner === this.ownerFilter)
      }

      return filtered
    },
  },
  watch: {
    isVisible(newVal) {
      if (newVal) {
        this.loadDomains()
      }
    },
  },
  methods: {
    async loadDomains() {
      this.isLoading = true
      this.error = null

      try {
        const userStore = useUserStore()
        const response = await fetch(
          `https://api.vegvisr.org/admin/domains?email=${encodeURIComponent(userStore.email)}`,
        )

        if (!response.ok) {
          throw new Error('Failed to load domains')
        }

        const data = await response.json()
        this.domains = data.domains || []
      } catch (error) {
        console.error('Error loading domains:', error)
        this.error = error.message || 'Failed to load domains'
      } finally {
        this.isLoading = false
      }
    },

    async refreshDomains() {
      await this.loadDomains()
    },

    closeModal() {
      this.selectedDomains = []
      this.selectAll = false
      this.selectedDomain = null
      this.searchTerm = ''
      this.ownerFilter = ''
      this.$emit('close')
    },

    toggleSelectAll() {
      if (this.selectAll) {
        this.selectedDomains = this.filteredDomains.map((d) => d.domain)
      } else {
        this.selectedDomains = []
      }
    },

    onDomainSelect(domain) {
      this.selectedDomain = this.selectedDomains.includes(domain) ? domain : null
    },

    openTransferModal(domain) {
      this.selectedDomainForTransfer = domain
      this.transferModalVisible = true
    },

    closeTransferModal() {
      this.transferModalVisible = false
      this.selectedDomainForTransfer = null
    },

    onTransferComplete() {
      this.closeTransferModal()
      this.refreshDomains()
      this.$emit('domain-updated')
    },

    openTemplateModal(domain = null) {
      this.selectedDomainForTemplate =
        domain || this.domains.find((d) => d.domain === this.selectedDomain)
      this.templateModalVisible = true
    },

    closeTemplateModal() {
      this.templateModalVisible = false
      this.selectedDomainForTemplate = null
    },

    onTemplateShared() {
      this.closeTemplateModal()
      this.refreshDomains()
      this.$emit('domain-updated')
    },

    confirmRemove(domain) {
      if (
        confirm(
          `Are you sure you want to remove ${domain.domain} from the system?\n\nThis action cannot be undone and will remove all associated configuration.`,
        )
      ) {
        this.removeDomain(domain)
      }
    },

    async removeDomain(domain) {
      try {
        const userStore = useUserStore()
        const response = await fetch(
          `https://api.vegvisr.org/admin/remove-domain?email=${encodeURIComponent(userStore.email)}&domain=${encodeURIComponent(domain.domain)}`,
          {
            method: 'DELETE',
          },
        )

        if (!response.ok) {
          throw new Error('Failed to remove domain')
        }

        await this.refreshDomains()
        this.$emit('domain-updated')

        // Show success message
        this.$toast?.success?.(`Domain ${domain.domain} removed successfully`)
      } catch (error) {
        console.error('Error removing domain:', error)
        this.error = error.message || 'Failed to remove domain'
      }
    },

    formatDate(dateString) {
      if (!dateString) return 'N/A'

      try {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      } catch (error) {
        return 'Invalid Date'
      }
    },
  },
}
</script>

<style scoped>
.modal-xl {
  max-width: 1200px;
}

.table-responsive {
  max-height: 400px;
  overflow-y: auto;
}

.btn-group .btn {
  margin-right: 2px;
}

.badge {
  font-size: 0.75em;
}

.card {
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.table-active {
  background-color: rgba(13, 110, 253, 0.1);
}

.modal-backdrop {
  z-index: 1040;
}

.modal {
  z-index: 1050;
}
</style>
