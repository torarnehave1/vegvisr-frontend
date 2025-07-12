<template>
  <div
    class="modal fade"
    :class="{ show: isVisible }"
    :style="{ display: isVisible ? 'block' : 'none' }"
    tabindex="-1"
    aria-labelledby="templateShareModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="templateShareModalLabel">
            <i class="fas fa-share-alt text-success me-2"></i>
            Share Domain Template
          </h5>
          <button type="button" class="btn-close" @click="closeModal" aria-label="Close"></button>
        </div>

        <div class="modal-body">
          <!-- Source Domain Information -->
          <div v-if="sourceDomain" class="card mb-4">
            <div class="card-header bg-light">
              <h6 class="mb-0">
                <i class="fas fa-info-circle me-2"></i>
                Source Domain Template
              </h6>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <p class="mb-1"><strong>Domain:</strong></p>
                  <p class="text-muted mb-3">{{ sourceDomain.domain }}</p>

                  <p class="mb-1"><strong>Owner:</strong></p>
                  <p class="text-muted mb-3">{{ sourceDomain.owner }}</p>
                </div>
                <div class="col-md-6">
                  <p class="mb-1"><strong>Created:</strong></p>
                  <p class="text-muted mb-3">{{ formatDate(sourceDomain.createdAt) }}</p>

                  <p class="mb-1"><strong>Last Modified:</strong></p>
                  <p class="text-muted mb-3">{{ formatDate(sourceDomain.lastModified) }}</p>
                </div>
              </div>

              <!-- Template Features -->
              <div class="mt-3">
                <p class="mb-2"><strong>Available Features:</strong></p>
                <div class="d-flex gap-2">
                  <span v-if="sourceDomain.hasLogo" class="badge bg-success">
                    <i class="fas fa-image me-1"></i>Custom Logo
                  </span>
                  <span v-if="sourceDomain.hasContentFilters" class="badge bg-info">
                    <i class="fas fa-filter me-1"></i>Content Filters
                  </span>
                  <span v-if="sourceDomain.graphId" class="badge bg-warning">
                    <i class="fas fa-project-diagram me-1"></i>Knowledge Graph
                  </span>
                  <span
                    v-if="
                      !sourceDomain.hasLogo &&
                      !sourceDomain.hasContentFilters &&
                      !sourceDomain.graphId
                    "
                    class="badge bg-secondary"
                  >
                    Basic configuration only
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Template Share Form -->
          <div class="card">
            <div class="card-header bg-success text-white">
              <h6 class="mb-0">
                <i class="fas fa-plus-circle me-2"></i>
                Create New Domain from Template
              </h6>
            </div>
            <div class="card-body">
              <!-- Error Display -->
              <div v-if="error" class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-circle me-2"></i>
                {{ error }}
              </div>

              <!-- Success Display -->
              <div v-if="success" class="alert alert-success" role="alert">
                <i class="fas fa-check-circle me-2"></i>
                {{ success }}
              </div>

              <!-- Share Form -->
              <form @submit.prevent="handleShare" v-if="!success">
                <div class="row">
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label for="targetDomain" class="form-label">
                        <i class="fas fa-globe me-2"></i>
                        Target Domain
                      </label>
                      <input
                        type="text"
                        class="form-control"
                        id="targetDomain"
                        v-model="targetDomain"
                        :class="{ 'is-invalid': domainError }"
                        placeholder="example.com"
                        required
                      />
                      <div v-if="domainError" class="invalid-feedback">
                        {{ domainError }}
                      </div>
                      <div class="form-text">
                        The new domain that will receive the template configuration.
                      </div>
                    </div>
                  </div>

                  <div class="col-md-6">
                    <div class="mb-3">
                      <label for="targetOwner" class="form-label">
                        <i class="fas fa-user me-2"></i>
                        Target Owner
                      </label>
                      <input
                        type="email"
                        class="form-control"
                        id="targetOwner"
                        v-model="targetOwner"
                        :class="{ 'is-invalid': ownerError }"
                        placeholder="user@example.com"
                        required
                      />
                      <div v-if="ownerError" class="invalid-feedback">
                        {{ ownerError }}
                      </div>
                      <div class="form-text">
                        The email address of the user who will own the new domain.
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Template Options -->
                <div class="mb-3">
                  <label class="form-label">
                    <i class="fas fa-cogs me-2"></i>
                    Template Options
                  </label>
                  <div class="border rounded p-3">
                    <div class="form-check mb-2">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        id="includeLogo"
                        v-model="includeLogo"
                        :disabled="!sourceDomain.hasLogo"
                      />
                      <label class="form-check-label" for="includeLogo">
                        <i class="fas fa-image me-2"></i>
                        Include Custom Logo
                        <span v-if="!sourceDomain.hasLogo" class="text-muted">(Not available)</span>
                      </label>
                    </div>

                    <div class="form-check mb-2">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        id="includeFilters"
                        v-model="includeFilters"
                        :disabled="!sourceDomain.hasContentFilters"
                      />
                      <label class="form-check-label" for="includeFilters">
                        <i class="fas fa-filter me-2"></i>
                        Include Content Filters
                        <span v-if="!sourceDomain.hasContentFilters" class="text-muted"
                          >(Not available)</span
                        >
                      </label>
                    </div>

                    <div class="form-check mb-2">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        id="includeContent"
                        v-model="includeContent"
                        :disabled="!sourceDomain.graphId"
                      />
                      <label class="form-check-label" for="includeContent">
                        <i class="fas fa-project-diagram me-2"></i>
                        Include Knowledge Graph Content
                        <span v-if="!sourceDomain.graphId" class="text-muted">(Not available)</span>
                      </label>
                    </div>

                    <div class="form-check">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        id="includeBasicConfig"
                        v-model="includeBasicConfig"
                        checked
                        disabled
                      />
                      <label class="form-check-label" for="includeBasicConfig">
                        <i class="fas fa-cog me-2"></i>
                        Include Basic Configuration
                        <span class="text-muted">(Always included)</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label for="shareReason" class="form-label">
                    <i class="fas fa-comment me-2"></i>
                    Share Reason (Optional)
                  </label>
                  <textarea
                    class="form-control"
                    id="shareReason"
                    v-model="shareReason"
                    rows="3"
                    placeholder="Provide a reason for sharing this template (for audit log)"
                  ></textarea>
                </div>

                <!-- Share Confirmation -->
                <div class="form-check mb-3">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="confirmShare"
                    v-model="confirmShare"
                    required
                  />
                  <label class="form-check-label" for="confirmShare">
                    I understand that this will create a new domain configuration for
                    <strong>{{ targetDomain }}</strong> owned by <strong>{{ targetOwner }}</strong
                    >.
                  </label>
                </div>

                <!-- Info Box -->
                <div class="alert alert-info" role="alert">
                  <i class="fas fa-info-circle me-2"></i>
                  <strong>Note:</strong> This action will:
                  <ul class="mt-2 mb-0">
                    <li>Create a new domain configuration based on the selected template</li>
                    <li>Add the domain to the target owner's account</li>
                    <li>Copy selected features from the source domain</li>
                    <li>Create an audit trail of the template sharing</li>
                  </ul>
                </div>

                <div class="d-flex justify-content-end gap-2">
                  <button type="button" class="btn btn-secondary" @click="closeModal">
                    <i class="fas fa-times me-1"></i>
                    Cancel
                  </button>
                  <button type="submit" class="btn btn-success" :disabled="!canShare || isSharing">
                    <span
                      v-if="isSharing"
                      class="spinner-border spinner-border-sm me-1"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    <i v-else class="fas fa-share-alt me-1"></i>
                    {{ isSharing ? 'Sharing...' : 'Share Template' }}
                  </button>
                </div>
              </form>

              <!-- Success Actions -->
              <div v-else class="text-center">
                <button type="button" class="btn btn-success" @click="closeModal">
                  <i class="fas fa-check me-1"></i>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Background overlay -->
  <div v-if="isVisible" class="modal-backdrop fade show"></div>
</template>

<script>
import { useUserStore } from '@/stores/userStore'

export default {
  name: 'TemplateShareModal',
  props: {
    isVisible: {
      type: Boolean,
      default: false,
    },
    sourceDomain: {
      type: Object,
      default: null,
    },
  },
  emits: ['close', 'template-shared'],
  data() {
    return {
      targetDomain: '',
      targetOwner: '',
      shareReason: '',
      confirmShare: false,
      isSharing: false,
      error: null,
      success: null,
      domainError: null,
      ownerError: null,
      includeLogo: false,
      includeFilters: false,
      includeContent: false,
      includeBasicConfig: true,
    }
  },
  computed: {
    canShare() {
      return (
        this.targetDomain &&
        this.targetOwner &&
        this.isValidDomain(this.targetDomain) &&
        this.isValidEmail(this.targetOwner) &&
        this.confirmShare &&
        !this.isSharing
      )
    },
  },
  watch: {
    isVisible(newVal) {
      if (newVal) {
        this.resetForm()
      }
    },
    targetDomain(newVal) {
      this.validateDomain(newVal)
    },
    targetOwner(newVal) {
      this.validateOwner(newVal)
    },
    sourceDomain(newVal) {
      if (newVal) {
        this.includeLogo = newVal.hasLogo
        this.includeFilters = newVal.hasContentFilters
        this.includeContent = false // Default to false for content
      }
    },
  },
  methods: {
    resetForm() {
      this.targetDomain = ''
      this.targetOwner = ''
      this.shareReason = ''
      this.confirmShare = false
      this.isSharing = false
      this.error = null
      this.success = null
      this.domainError = null
      this.ownerError = null
      this.includeLogo = this.sourceDomain?.hasLogo || false
      this.includeFilters = this.sourceDomain?.hasContentFilters || false
      this.includeContent = false
      this.includeBasicConfig = true
    },

    closeModal() {
      this.resetForm()
      this.$emit('close')
    },

    isValidDomain(domain) {
      const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/
      return domainPattern.test(domain)
    },

    isValidEmail(email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailPattern.test(email)
    },

    validateDomain(domain) {
      if (!domain) {
        this.domainError = null
        return
      }

      if (!this.isValidDomain(domain)) {
        this.domainError = 'Please enter a valid domain name'
        return
      }

      if (domain === this.sourceDomain?.domain) {
        this.domainError = 'Cannot share template to the same domain'
        return
      }

      this.domainError = null
    },

    validateOwner(owner) {
      if (!owner) {
        this.ownerError = null
        return
      }

      if (!this.isValidEmail(owner)) {
        this.ownerError = 'Please enter a valid email address'
        return
      }

      this.ownerError = null
    },

    async handleShare() {
      if (!this.canShare) {
        return
      }

      this.isSharing = true
      this.error = null
      this.success = null

      try {
        const userStore = useUserStore()
        const response = await fetch('https://api.vegvisr.org/admin/share-template', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userStore.email,
            sourceDomain: this.sourceDomain.domain,
            targetDomain: this.targetDomain,
            targetOwner: this.targetOwner,
            includeContent: this.includeContent,
            includeLogo: this.includeLogo,
            includeFilters: this.includeFilters,
            reason: this.shareReason || null,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to share template')
        }

        const result = await response.json()

        this.success = `Template successfully shared from ${result.sourceDomain} to ${result.targetDomain} for ${result.targetOwner}`

        // Emit success event after a short delay
        setTimeout(() => {
          this.$emit('template-shared', result)
        }, 2000)
      } catch (error) {
        console.error('Error sharing template:', error)
        this.error = error.message || 'Failed to share template'
      } finally {
        this.isSharing = false
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
.modal-lg {
  max-width: 800px;
}

.card {
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.card-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.125);
}

.badge {
  font-size: 0.75em;
}

.form-check-label {
  cursor: pointer;
}

.form-check-input:disabled + .form-check-label {
  opacity: 0.6;
  cursor: not-allowed;
}

.alert ul {
  padding-left: 1.5rem;
}

.modal-backdrop {
  z-index: 1040;
}

.modal {
  z-index: 1050;
}

.spinner-border-sm {
  width: 1rem;
  height: 1rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.border {
  border-color: #dee2e6;
}

.text-muted {
  color: #6c757d !important;
}
</style>
