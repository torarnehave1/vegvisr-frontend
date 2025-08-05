<template>
  <div class="affiliate-management-panel">
    <!-- Header -->
    <div class="panel-header">
      <h4>🎯 Affiliate Partner Management</h4>
      <p class="text-muted">Send invitation emails to potential affiliate partners</p>
    </div>

    <!-- Invitation Form -->
    <div class="invitation-form card">
      <div class="card-header">
        <h5>📧 Send Affiliate Invitation</h5>
      </div>
      <div class="card-body">
        <form @submit.prevent="sendInvitation">
          <!-- Recipient Information -->
          <div class="row mb-3">
            <div class="col-md-6">
              <label for="recipientEmail" class="form-label">Recipient Email *</label>
              <input
                v-model="form.recipientEmail"
                type="email"
                class="form-control"
                id="recipientEmail"
                placeholder="john@example.com"
                required
              />
            </div>
            <div class="col-md-6">
              <label for="recipientName" class="form-label">Recipient Name *</label>
              <input
                v-model="form.recipientName"
                type="text"
                class="form-control"
                id="recipientName"
                placeholder="John Smith"
                required
              />
            </div>
          </div>

          <!-- Sender & Site Information -->
          <div class="row mb-3">
            <div class="col-md-6">
              <label for="senderName" class="form-label">Your Name *</label>
              <input
                v-model="form.senderName"
                type="text"
                class="form-control"
                id="senderName"
                placeholder="Your name as sender"
                required
              />
            </div>
            <div class="col-md-6">
              <label for="siteName" class="form-label">Site Name</label>
              <input
                v-model="form.siteName"
                type="text"
                class="form-control"
                id="siteName"
                placeholder="Vegvisr.org"
              />
            </div>
          </div>

          <!-- Knowledge Graph Selection -->
          <div class="row mb-3">
            <div class="col-12">
              <label for="graphSelection" class="form-label">Knowledge Graph *</label>
              <select
                v-model="form.selectedGraphId"
                class="form-select"
                id="graphSelection"
                required
              >
                <option value="">Select a knowledge graph...</option>
                <option v-for="graph in availableGraphs" :key="graph.id" :value="graph.id">
                  {{ graph.title || graph.id }}
                </option>
              </select>
              <small class="form-text text-muted">
                Every affiliate must be assigned to a specific knowledge graph. This determines
                their commission scope.
              </small>
            </div>
          </div>

          <!-- Commission Type & Amount -->
          <div class="row mb-3">
            <div class="col-md-4">
              <label for="commissionType" class="form-label">Commission Type</label>
              <select v-model="form.commissionType" class="form-select" id="commissionType">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div class="col-md-4">
              <label
                v-if="form.commissionType === 'percentage'"
                for="commissionRate"
                class="form-label"
                >Commission Rate (%)</label
              >
              <label v-else for="commissionAmount" class="form-label">Fixed Amount ($)</label>

              <div class="input-group" v-if="form.commissionType === 'percentage'">
                <input
                  v-model.number="form.commissionRate"
                  type="number"
                  class="form-control"
                  id="commissionRate"
                  min="1"
                  max="50"
                  step="0.5"
                />
                <span class="input-group-text">%</span>
              </div>

              <div class="input-group" v-else>
                <span class="input-group-text">$</span>
                <input
                  v-model.number="form.commissionAmount"
                  type="number"
                  class="form-control"
                  id="commissionAmount"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>

              <small class="text-muted">
                {{
                  form.commissionType === 'percentage'
                    ? 'Percentage commission for referrals'
                    : 'Fixed amount per successful referral'
                }}
              </small>
            </div>
            <div class="col-md-4">
              <label for="domain" class="form-label">Domain</label>
              <input
                v-model="form.domain"
                type="text"
                class="form-control"
                id="domain"
                placeholder="vegvisr.org"
              />
            </div>
          </div>

          <!-- Email Preview -->
          <div class="mb-3">
            <button
              type="button"
              class="btn btn-outline-info btn-sm"
              @click="showPreview = !showPreview"
            >
              {{ showPreview ? 'Hide' : 'Show' }} Email Preview
            </button>
          </div>

          <div v-if="showPreview" class="email-preview mb-3">
            <div class="card">
              <div class="card-header bg-light">
                <strong>Email Preview</strong>
              </div>
              <div class="card-body">
                <p><strong>To:</strong> {{ form.recipientEmail || 'recipient@example.com' }}</p>
                <p>
                  <strong>Subject:</strong> Join {{ form.siteName || 'Vegvisr.org' }} as an
                  Affiliate Partner! 🚀
                </p>
                <div class="preview-content border p-3" style="background: #f8f9fa">
                  <div style="max-width: 600px; margin: 0 auto">
                    <div
                      style="
                        background: #4f46e5;
                        color: white;
                        padding: 20px;
                        text-align: center;
                        border-radius: 8px 8px 0 0;
                      "
                    >
                      <h4>🎯 Affiliate Partner Invitation</h4>
                    </div>
                    <div style="background: white; padding: 20px; border: 1px solid #e5e7eb">
                      <p>Hello {{ form.recipientName || 'John' }},</p>
                      <p>
                        {{ form.senderName || 'Admin' }} has invited you to join
                        <strong>{{ form.siteName || 'Vegvisr.org' }}</strong> as an affiliate
                        partner!
                      </p>
                      <div
                        style="
                          background: #fef3c7;
                          padding: 15px;
                          border-left: 4px solid #f59e0b;
                          margin: 20px 0;
                        "
                      >
                        <h5>💰 Earn {{ form.commissionRate || 15 }}% Commission</h5>
                        <p>
                          Start earning money by promoting {{ form.siteName || 'Vegvisr.org' }} to
                          your network!
                        </p>
                      </div>
                      <p style="text-align: center">
                        <span
                          style="
                            background: #10b981;
                            color: white;
                            padding: 12px 24px;
                            border-radius: 6px;
                          "
                        >
                          Get Started - Step 1: Create Account
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <small class="text-muted"> * Required fields. Invitation expires in 7 days. </small>
            </div>
            <button type="submit" class="btn btn-primary" :disabled="sending || !isFormValid">
              <span v-if="sending">
                <i class="spinner-border spinner-border-sm me-2"></i>
                Sending...
              </span>
              <span v-else> 📧 Send Invitation </span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Status Messages -->
    <div v-if="successMessage" class="alert alert-success mt-3">
      <i class="bi bi-check-circle me-2"></i>
      {{ successMessage }}
      <div v-if="lastInvitation" class="mt-2 small">
        <strong>Invitation Token:</strong> {{ lastInvitation.invitationToken }}<br />
        <strong>Expires:</strong> {{ formatDate(lastInvitation.expiresAt) }}
      </div>
    </div>

    <div v-if="errorMessage" class="alert alert-danger mt-3">
      <i class="bi bi-exclamation-triangle me-2"></i>
      {{ errorMessage }}
    </div>

    <!-- Recent Invitations -->
    <div class="recent-invitations mt-4">
      <div class="card">
        <div class="card-header">
          <h6>📋 Recent Affiliate Invitations</h6>
          <div class="d-flex align-items-center gap-2">
            <!-- Access Level Indicator -->
            <span
              v-if="userAccess.userRole"
              class="badge"
              :class="{
                'bg-success': userAccess.userRole === 'superadmin',
                'bg-info': userAccess.userRole !== 'superadmin',
              }"
              :title="
                userAccess.userRole === 'superadmin'
                  ? 'Viewing all invitations (Superadmin)'
                  : 'Viewing your invitations only'
              "
            >
              {{
                userAccess.userRole === 'superadmin' ? '👑 All Invitations' : '🔒 My Invitations'
              }}
            </span>
            <button class="btn btn-sm btn-outline-secondary" @click="loadRecentInvitations">
              <i class="bi bi-arrow-clockwise"></i> Refresh
            </button>
          </div>
        </div>

        <!-- Filter Controls -->
        <div class="card-body border-bottom">
          <div class="row g-3">
            <div class="col-md-3">
              <label for="statusFilter" class="form-label">Status</label>
              <select
                id="statusFilter"
                v-model="filters.status"
                @change="applyFilters"
                class="form-select form-select-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div class="col-md-3">
              <label for="searchFilter" class="form-label">Search</label>
              <input
                id="searchFilter"
                v-model="filters.search"
                @input="debouncedSearch"
                type="text"
                class="form-control form-control-sm"
                placeholder="Email or name..."
              />
            </div>

            <div class="col-md-2">
              <label for="dateFromFilter" class="form-label">From Date</label>
              <input
                id="dateFromFilter"
                v-model="filters.dateFrom"
                @change="applyFilters"
                type="date"
                class="form-control form-control-sm"
              />
            </div>

            <div class="col-md-2">
              <label for="dateToFilter" class="form-label">To Date</label>
              <input
                id="dateToFilter"
                v-model="filters.dateTo"
                @change="applyFilters"
                type="date"
                class="form-control form-control-sm"
              />
            </div>

            <div class="col-md-2">
              <div class="d-flex align-items-end h-100">
                <button
                  @click="clearFilters"
                  class="btn btn-outline-secondary btn-sm"
                  title="Clear all filters"
                >
                  <i class="bi bi-x-circle"></i> Clear
                </button>
              </div>
            </div>
          </div>

          <!-- Filter Results Summary -->
          <div v-if="filterResultsText" class="mt-2">
            <small class="text-muted">{{ filterResultsText }}</small>
          </div>
        </div>

        <div class="card-body">
          <div v-if="loadingInvitations" class="text-center">
            <i class="spinner-border spinner-border-sm"></i> Loading...
          </div>
          <div v-else-if="recentInvitations.length === 0" class="text-muted text-center">
            {{
              filters.status !== 'all' || filters.search
                ? 'No invitations match your filters'
                : 'No recent invitations found'
            }}
          </div>
          <div v-else class="table-responsive-container">
            <div class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Knowledge Graph</th>
                    <th>Sender</th>
                    <th>Commission</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="invitation in recentInvitations" :key="invitation.token">
                    <td>
                      <div>{{ invitation.recipient_name }}</div>
                      <small class="text-muted">{{ invitation.recipient_email }}</small>
                    </td>
                    <td>
                      <span v-if="invitation.deal_name" class="badge bg-info">
                        {{ invitation.deal_name }}
                      </span>
                      <span v-else class="text-muted">None</span>
                    </td>
                    <td>{{ invitation.sender_name }}</td>
                    <td>
                      {{
                        invitation.commission_type === 'fixed'
                          ? `$${invitation.commission_amount}`
                          : `${invitation.commission_rate}%`
                      }}
                    </td>
                    <td>
                      <span :class="getStatusClass(invitation)">
                        {{ getStatusText(invitation) }}
                      </span>
                    </td>
                    <td>{{ formatDate(invitation.created_at) }}</td>
                    <td>{{ formatDate(invitation.expires_at) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useUserStore } from '@/stores/userStore'

export default {
  name: 'AffiliateManagement',
  setup() {
    const userStore = useUserStore()
    return { userStore }
  },
  data() {
    return {
      form: {
        recipientEmail: '',
        recipientName: '',
        senderName: '',
        siteName: 'Vegvisr.org',
        selectedGraphId: '', // Required graph selection
        commissionType: 'percentage', // 'percentage' or 'fixed'
        commissionRate: 15,
        commissionAmount: 50,
        domain: 'vegvisr.org',
      },
      availableGraphs: [], // Will be loaded from knowledge graph API
      sending: false,
      showPreview: false,
      successMessage: '',
      errorMessage: '',
      lastInvitation: null,
      recentInvitations: [],
      loadingInvitations: false,
      // Filtering system
      filters: {
        status: 'all',
        search: '',
        dateFrom: '',
        dateTo: '',
        dealName: 'all',
        senderName: '',
      },
      totalInvitations: 0,
      filteredCount: 0,
      searchTimeout: null,
      userAccess: {}, // Store user access info from API response
    }
  },
  computed: {
    isFormValid() {
      const basicValid =
        this.form.recipientEmail &&
        this.form.recipientName &&
        this.form.senderName &&
        this.form.selectedGraphId // Graph selection is required

      if (this.form.commissionType === 'percentage') {
        return basicValid && this.form.commissionRate > 0
      } else {
        return basicValid && this.form.commissionAmount > 0
      }
    },

    filterResultsText() {
      if (this.totalInvitations === 0) return ''

      const hasFilters =
        this.filters.status !== 'all' ||
        this.filters.search ||
        this.filters.dateFrom ||
        this.filters.dateTo

      if (!hasFilters) {
        return `Showing ${this.recentInvitations.length} of ${this.totalInvitations} invitations`
      }

      return `Found ${this.filteredCount} of ${this.totalInvitations} invitations`
    },
  },
  mounted() {
    // Pre-fill sender name from user store if available
    if (this.userStore.email) {
      this.form.senderName =
        this.userStore.displayName || this.userStore.name || this.userStore.email || ''
    }

    // Load available knowledge graphs
    this.loadAvailableGraphs()

    // Load recent invitations
    this.loadRecentInvitations()
  },

  beforeUnmount() {
    // Clear search timeout to prevent memory leaks
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout)
    }
  },
  methods: {
    async loadAvailableGraphs() {
      try {
        const response = await fetch(
          'https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraphs',
        )
        if (response.ok) {
          const data = await response.json()
          this.availableGraphs = data.results || []
        } else {
          console.error('Failed to load graphs:', response.statusText)
          this.errorMessage = 'Failed to load available knowledge graphs'
        }
      } catch (error) {
        console.error('Error loading graphs:', error)
        this.errorMessage = 'Network error: Could not load knowledge graphs'
      }
    },

    async sendInvitation() {
      this.sending = true
      this.successMessage = ''
      this.errorMessage = ''

      try {
        // Include the selected graph ID in the form data as dealName
        const invitationData = {
          ...this.form,
          dealName: this.form.selectedGraphId, // Map selectedGraphId to dealName for backend
          senderUserId: this.userStore.user_id, // Add current user's ID for inviter_affiliate_id
        }

        const response = await fetch(
          'https://aff-worker.torarnehave.workers.dev/send-affiliate-invitation',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(invitationData),
          },
        )

        const result = await response.json()

        if (response.ok && result.success) {
          this.successMessage = result.message
          this.lastInvitation = {
            invitationToken: result.invitationToken,
            expiresAt: result.expiresAt,
          }

          // Reset form (but keep sender info and graph selection)
          this.form.recipientEmail = ''
          this.form.recipientName = ''

          // Reload recent invitations
          this.loadRecentInvitations()
        } else {
          this.errorMessage = result.error || 'Failed to send invitation'
        }
      } catch (error) {
        console.error('Error sending invitation:', error)
        this.errorMessage = 'Network error: Failed to send invitation'
      } finally {
        this.sending = false
      }
    },

    async loadRecentInvitations() {
      this.loadingInvitations = true

      try {
        // Build query parameters
        const params = new URLSearchParams({
          limit: '50', // Increased from 10 to show more with filtering
          offset: '0',
        })

        // Add filters
        if (this.filters.status !== 'all') {
          params.set('status', this.filters.status)
        }
        if (this.filters.search) {
          params.set('search', this.filters.search)
        }
        if (this.filters.dateFrom) {
          params.set('dateFrom', this.filters.dateFrom)
        }
        if (this.filters.dateTo) {
          params.set('dateTo', this.filters.dateTo)
        }
        if (this.filters.dealName !== 'all') {
          params.set('dealName', this.filters.dealName)
        }
        if (this.filters.senderName) {
          params.set('senderName', this.filters.senderName)
        }

        // Add user context for role-based filtering
        if (this.userStore.user_id) {
          params.set('currentUserId', this.userStore.user_id)
        }
        if (this.userStore.role) {
          params.set('userRole', this.userStore.role)
        }

        const response = await fetch(
          `https://aff-worker.torarnehave.workers.dev/list-invitations?${params.toString()}`,
        )

        if (response.ok) {
          const result = await response.json()
          this.recentInvitations = result.invitations || []
          this.totalInvitations = result.totalCount || 0
          this.filteredCount = result.totalCount || 0

          // Store user access info for display
          this.userAccess = result.userAccess || {}
        }
      } catch (error) {
        console.error('Error loading invitations:', error)
      } finally {
        this.loadingInvitations = false
      }
    },

    applyFilters() {
      this.loadRecentInvitations()
    },

    debouncedSearch() {
      // Clear existing timeout
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
      }

      // Set new timeout for search
      this.searchTimeout = setTimeout(() => {
        this.applyFilters()
      }, 300) // 300ms delay
    },

    clearFilters() {
      this.filters = {
        status: 'all',
        search: '',
        dateFrom: '',
        dateTo: '',
        dealName: 'all',
        senderName: '',
      }
      this.loadRecentInvitations()
    },

    formatDate(dateString) {
      if (!dateString) return 'N/A'
      return new Date(dateString).toLocaleString()
    },

    getStatusText(invitation) {
      const now = new Date()
      const expires = new Date(invitation.expires_at)

      // Check database status first, then fallback to used_at logic
      if (invitation.status === 'completed' || invitation.used_at) return 'Accepted'
      if (now > expires) return 'Expired'
      return 'Pending'
    },

    getStatusClass(invitation) {
      const status = this.getStatusText(invitation)
      return {
        'badge bg-success': status === 'Accepted',
        'badge bg-warning': status === 'Pending',
        'badge bg-secondary': status === 'Expired',
      }
    },
  },
}
</script>

<style scoped>
.affiliate-management-panel {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.panel-header {
  text-align: center;
  margin-bottom: 30px;
}

.panel-header h4 {
  color: #4f46e5;
  margin-bottom: 10px;
}

.invitation-form .card-header {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: white;
}

.email-preview {
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 15px;
  background: #f8f9fa;
}

.preview-content {
  font-family: Arial, sans-serif;
  line-height: 1.6;
}

.table th {
  font-weight: 600;
  color: #4f46e5;
  border-top: none;
}

.recent-invitations .card-header {
  background: #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.recent-invitations .card-header h6 {
  margin: 0;
  color: #4f46e5;
}

.filter-controls {
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.filter-controls .form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
  margin-bottom: 0.25rem;
}

.filter-controls .form-control,
.filter-controls .form-select {
  font-size: 0.875rem;
}

/* Scrollable table container */
.table-responsive-container {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
}

.table-responsive-container .table {
  margin-bottom: 0;
}

.table-responsive-container .table thead th {
  position: sticky;
  top: 0;
  background-color: #f8f9fa;
  z-index: 10;
  border-bottom: 2px solid #dee2e6;
}

/* Scrollbar styling for webkit browsers */
.table-responsive-container::-webkit-scrollbar {
  width: 8px;
}

.table-responsive-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.table-responsive-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.table-responsive-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

@media (max-width: 768px) {
  .affiliate-management-panel {
    padding: 10px;
  }

  .card-body {
    padding: 15px;
  }

  .filter-controls .col-md-3,
  .filter-controls .col-md-2 {
    margin-bottom: 1rem;
  }
}
</style>
