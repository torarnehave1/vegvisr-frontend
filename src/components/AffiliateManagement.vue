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
          <button class="btn btn-sm btn-outline-secondary" @click="loadRecentInvitations">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
        <div class="card-body">
          <div v-if="loadingInvitations" class="text-center">
            <i class="spinner-border spinner-border-sm"></i> Loading...
          </div>
          <div v-else-if="recentInvitations.length === 0" class="text-muted text-center">
            No recent invitations found
          </div>
          <div v-else class="table-responsive">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Recipient</th>
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
</template>

<script>
export default {
  name: 'AffiliateManagement',
  data() {
    return {
      form: {
        recipientEmail: '',
        recipientName: '',
        senderName: '',
        siteName: 'Vegvisr.org',
        commissionType: 'percentage', // 'percentage' or 'fixed'
        commissionRate: 15,
        commissionAmount: 50,
        domain: 'vegvisr.org',
      },
      sending: false,
      showPreview: false,
      successMessage: '',
      errorMessage: '',
      lastInvitation: null,
      recentInvitations: [],
      loadingInvitations: false,
    }
  },
  computed: {
    isFormValid() {
      const basicValid = this.form.recipientEmail && this.form.recipientName && this.form.senderName

      if (this.form.commissionType === 'percentage') {
        return basicValid && this.form.commissionRate > 0
      } else {
        return basicValid && this.form.commissionAmount > 0
      }
    },
  },
  mounted() {
    // Pre-fill sender name from user store if available
    if (this.$store && this.$store.state.user) {
      this.form.senderName =
        this.$store.state.user.displayName || this.$store.state.user.email || ''
    }

    // Load recent invitations
    this.loadRecentInvitations()
  },
  methods: {
    async sendInvitation() {
      this.sending = true
      this.successMessage = ''
      this.errorMessage = ''

      try {
        const response = await fetch('https://test.vegvisr.org/send-affiliate-invitation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(this.form),
        })

        const result = await response.json()

        if (response.ok && result.success) {
          this.successMessage = result.message
          this.lastInvitation = {
            invitationToken: result.invitationToken,
            expiresAt: result.expiresAt,
          }

          // Reset form
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
        // Note: This endpoint would need to be implemented in your backend
        const response = await fetch('https://test.vegvisr.org/api/affiliate-invitations?limit=10')
        if (response.ok) {
          const result = await response.json()
          this.recentInvitations = result.invitations || []
        }
      } catch (error) {
        console.error('Error loading invitations:', error)
      } finally {
        this.loadingInvitations = false
      }
    },

    formatDate(dateString) {
      if (!dateString) return 'N/A'
      return new Date(dateString).toLocaleString()
    },

    getStatusText(invitation) {
      const now = new Date()
      const expires = new Date(invitation.expires_at)

      if (invitation.used_at) return 'Accepted'
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

@media (max-width: 768px) {
  .affiliate-management-panel {
    padding: 10px;
  }

  .card-body {
    padding: 15px;
  }
}
</style>
