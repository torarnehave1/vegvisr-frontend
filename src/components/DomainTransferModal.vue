<template>
  <div
    class="modal fade"
    :class="{ show: isVisible }"
    :style="{ display: isVisible ? 'block' : 'none' }"
    tabindex="-1"
    aria-labelledby="domainTransferModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="domainTransferModalLabel">
            <i class="fas fa-exchange-alt text-primary me-2"></i>
            Transfer Domain Ownership
          </h5>
          <button type="button" class="btn-close" @click="closeModal" aria-label="Close"></button>
        </div>

        <div class="modal-body">
          <!-- Domain Information -->
          <div v-if="domain" class="card mb-4">
            <div class="card-header bg-light">
              <h6 class="mb-0">
                <i class="fas fa-info-circle me-2"></i>
                Domain Information
              </h6>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <p class="mb-1"><strong>Domain:</strong></p>
                  <p class="text-muted mb-3">{{ domain.domain }}</p>

                  <p class="mb-1"><strong>Current Owner:</strong></p>
                  <p class="text-muted mb-3">{{ domain.owner }}</p>
                </div>
                <div class="col-md-6">
                  <p class="mb-1"><strong>Created:</strong></p>
                  <p class="text-muted mb-3">{{ formatDate(domain.createdAt) }}</p>

                  <p class="mb-1"><strong>Last Modified:</strong></p>
                  <p class="text-muted mb-3">{{ formatDate(domain.lastModified) }}</p>
                </div>
              </div>

              <!-- Domain Features -->
              <div class="mt-3">
                <p class="mb-2"><strong>Features:</strong></p>
                <div class="d-flex gap-2">
                  <span v-if="domain.hasLogo" class="badge bg-success">
                    <i class="fas fa-image me-1"></i>Custom Logo
                  </span>
                  <span v-if="domain.hasContentFilters" class="badge bg-info">
                    <i class="fas fa-filter me-1"></i>Content Filters
                  </span>
                  <span v-if="domain.graphId" class="badge bg-warning">
                    <i class="fas fa-project-diagram me-1"></i>Knowledge Graph
                  </span>
                  <span
                    v-if="!domain.hasLogo && !domain.hasContentFilters && !domain.graphId"
                    class="badge bg-secondary"
                  >
                    No custom features
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Transfer Form -->
          <div class="card">
            <div class="card-header bg-warning text-dark">
              <h6 class="mb-0">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Transfer Domain
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

              <!-- Transfer Form -->
              <form @submit.prevent="handleTransfer" v-if="!success">
                <div class="mb-3">
                  <label for="newOwnerEmail" class="form-label">
                    <i class="fas fa-user me-2"></i>
                    New Owner Email Address
                  </label>
                  <input
                    type="email"
                    class="form-control"
                    id="newOwnerEmail"
                    v-model="newOwnerEmail"
                    :class="{ 'is-invalid': emailError }"
                    placeholder="Enter email address of new owner"
                    required
                  />
                  <div v-if="emailError" class="invalid-feedback">
                    {{ emailError }}
                  </div>
                  <div class="form-text">
                    The domain will be transferred to this user's account.
                  </div>
                </div>

                <div class="mb-3">
                  <label for="transferReason" class="form-label">
                    <i class="fas fa-comment me-2"></i>
                    Transfer Reason (Optional)
                  </label>
                  <textarea
                    class="form-control"
                    id="transferReason"
                    v-model="transferReason"
                    rows="3"
                    placeholder="Provide a reason for this transfer (for audit log)"
                  ></textarea>
                </div>

                <!-- Transfer Confirmation -->
                <div class="form-check mb-3">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="confirmTransfer"
                    v-model="confirmTransfer"
                    required
                  />
                  <label class="form-check-label" for="confirmTransfer">
                    I understand that this will transfer all ownership rights and configurations for
                    <strong>{{ domain?.domain }}</strong> to the new owner.
                  </label>
                </div>

                <!-- Warning Box -->
                <div class="alert alert-warning" role="alert">
                  <i class="fas fa-info-circle me-2"></i>
                  <strong>Important:</strong> This action will:
                  <ul class="mt-2 mb-0">
                    <li>Remove the domain from the current owner's account</li>
                    <li>Add the domain to the new owner's account</li>
                    <li>Preserve all domain configurations (logo, filters, etc.)</li>
                    <li>Create an audit trail of the transfer</li>
                  </ul>
                </div>

                <div class="d-flex justify-content-end gap-2">
                  <button type="button" class="btn btn-secondary" @click="closeModal">
                    <i class="fas fa-times me-1"></i>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="btn btn-primary"
                    :disabled="!canTransfer || isTransferring"
                  >
                    <span
                      v-if="isTransferring"
                      class="spinner-border spinner-border-sm me-1"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    <i v-else class="fas fa-exchange-alt me-1"></i>
                    {{ isTransferring ? 'Transferring...' : 'Transfer Domain' }}
                  </button>
                </div>
              </form>

              <!-- Success Actions -->
              <div v-else class="text-center">
                <button type="button" class="btn btn-primary" @click="closeModal">
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
  name: 'DomainTransferModal',
  props: {
    isVisible: {
      type: Boolean,
      default: false,
    },
    domain: {
      type: Object,
      default: null,
    },
  },
  emits: ['close', 'transfer-complete'],
  data() {
    return {
      newOwnerEmail: '',
      transferReason: '',
      confirmTransfer: false,
      isTransferring: false,
      error: null,
      success: null,
      emailError: null,
    }
  },
  computed: {
    canTransfer() {
      return (
        this.newOwnerEmail &&
        this.isValidEmail(this.newOwnerEmail) &&
        this.confirmTransfer &&
        !this.isTransferring
      )
    },
  },
  watch: {
    isVisible(newVal) {
      if (newVal) {
        this.resetForm()
      }
    },
    newOwnerEmail(newVal) {
      this.validateEmail(newVal)
    },
  },
  methods: {
    resetForm() {
      this.newOwnerEmail = ''
      this.transferReason = ''
      this.confirmTransfer = false
      this.isTransferring = false
      this.error = null
      this.success = null
      this.emailError = null
    },

    closeModal() {
      this.resetForm()
      this.$emit('close')
    },

    isValidEmail(email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailPattern.test(email)
    },

    validateEmail(email) {
      if (!email) {
        this.emailError = null
        return
      }

      if (!this.isValidEmail(email)) {
        this.emailError = 'Please enter a valid email address'
        return
      }

      if (email === this.domain?.owner) {
        this.emailError = 'Cannot transfer domain to the same owner'
        return
      }

      this.emailError = null
    },

    async handleTransfer() {
      if (!this.canTransfer) {
        return
      }

      this.isTransferring = true
      this.error = null
      this.success = null

      try {
        const userStore = useUserStore()
        const response = await fetch('https://api.vegvisr.org/admin/transfer-domain', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': userStore.role || '',
          },
          body: JSON.stringify({
            email: userStore.email,
            domain: this.domain.domain,
            newOwner: this.newOwnerEmail,
            reason: this.transferReason || null,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to transfer domain')
        }

        const result = await response.json()

        this.success = `Domain ${this.domain.domain} successfully transferred from ${result.oldOwner} to ${result.newOwner}`

        // Emit success event after a short delay
        setTimeout(() => {
          this.$emit('transfer-complete', result)
        }, 2000)
      } catch (error) {
        console.error('Error transferring domain:', error)
        this.error = error.message || 'Failed to transfer domain'
      } finally {
        this.isTransferring = false
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
          hour: '2-digit',
          minute: '2-digit',
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
</style>
