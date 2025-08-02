<template>
  <div class="affiliate-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-content">
        <h1>🎯 Affiliate Dashboard</h1>
        <p class="subtitle">Grow your earnings by promoting {{ siteName }}</p>
      </div>
      <div class="quick-stats">
        <div class="stat-card">
          <div class="stat-value">${{ stats.totalEarnings || '0.00' }}</div>
          <div class="stat-label">Total Earnings</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.conversionRate || '0.00' }}%</div>
          <div class="stat-label">Conversion Rate</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalReferrals || 0 }}</div>
          <div class="stat-label">Total Referrals</div>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tab-navigation">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="['tab-button', { active: activeTab === tab.id }]"
      >
        {{ tab.icon }} {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'" class="tab-panel">
        <div class="overview-grid">
          <!-- Earnings Summary -->
          <div class="card earnings-card">
            <h3>💰 Earnings Summary</h3>
            <div class="earnings-breakdown">
              <div class="earning-item">
                <span class="label">Total Earnings:</span>
                <span class="value">${{ stats.totalEarnings || '0.00' }}</span>
              </div>
              <div class="earning-item">
                <span class="label">Pending:</span>
                <span class="value">${{ stats.pendingEarnings || '0.00' }}</span>
              </div>
              <div class="earning-item">
                <span class="label">Commission Rate:</span>
                <span class="value">{{ affiliateInfo.commissionRate || 15 }}%</span>
              </div>
            </div>
          </div>

          <!-- Referral Link -->
          <div class="card referral-card">
            <h3>🔗 Your Referral Link</h3>
            <div class="link-container">
              <input
                ref="referralLinkInput"
                :value="referralLink"
                readonly
                class="referral-input"
                @click="selectAllText"
              />
              <button @click="copyToClipboard" class="copy-button">
                {{ copyButtonText }}
              </button>
            </div>
            <p class="link-help">
              Share this link to earn {{ affiliateInfo.commissionRate || 15 }}% commission on
              referrals!
            </p>
          </div>

          <!-- Recent Activity -->
          <div class="card activity-card">
            <h3>📈 Recent Referrals</h3>
            <div v-if="recentReferrals.length === 0" class="no-activity">
              <p>No referrals yet. Start sharing your link!</p>
            </div>
            <div v-else class="referral-list">
              <div
                v-for="referral in recentReferrals.slice(0, 5)"
                :key="referral.id"
                class="referral-item"
              >
                <div class="referral-info">
                  <span class="email">{{ referral.referred_email || 'Anonymous' }}</span>
                  <span class="date">{{ formatDate(referral.created_at) }}</span>
                </div>
                <div class="referral-status">
                  <span :class="['status-badge', referral.status]">
                    {{ referral.status.toUpperCase() }}
                  </span>
                  <span v-if="referral.commission_amount" class="commission">
                    ${{ referral.commission_amount }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Invite Tab -->
      <div v-if="activeTab === 'invite'" class="tab-panel">
        <div class="invite-section">
          <div class="card">
            <h3>📧 Send Affiliate Invitation</h3>
            <p>Invite others to join as affiliate partners and earn from their success!</p>

            <form @submit.prevent="sendInvitation" class="invitation-form">
              <div class="form-group">
                <label for="recipientEmail">Email Address</label>
                <input
                  id="recipientEmail"
                  v-model="invitationForm.recipientEmail"
                  type="email"
                  required
                  placeholder="Enter email address"
                  class="form-input"
                />
              </div>

              <div class="form-group">
                <label for="recipientName">Name</label>
                <input
                  id="recipientName"
                  v-model="invitationForm.recipientName"
                  type="text"
                  required
                  placeholder="Enter recipient name"
                  class="form-input"
                />
              </div>

              <div class="form-group">
                <label for="customMessage">Personal Message (Optional)</label>
                <textarea
                  id="customMessage"
                  v-model="invitationForm.customMessage"
                  rows="3"
                  placeholder="Add a personal note to your invitation..."
                  class="form-textarea"
                ></textarea>
              </div>

              <button type="submit" :disabled="isLoading || !canSendInvitation" class="send-button">
                <span v-if="isLoading">Sending...</span>
                <span v-else>📨 Send Invitation</span>
              </button>
            </form>

            <!-- Success/Error Messages -->
            <div v-if="invitationMessage" :class="['message', invitationMessageType]">
              {{ invitationMessage }}
            </div>
          </div>
        </div>
      </div>

      <!-- Analytics Tab -->
      <div v-if="activeTab === 'analytics'" class="tab-panel">
        <div class="analytics-grid">
          <div class="card">
            <h3>📊 Performance Metrics</h3>
            <div class="metrics-grid">
              <div class="metric">
                <div class="metric-value">{{ stats.totalReferrals || 0 }}</div>
                <div class="metric-label">Total Clicks</div>
              </div>
              <div class="metric">
                <div class="metric-value">{{ stats.convertedReferrals || 0 }}</div>
                <div class="metric-label">Conversions</div>
              </div>
              <div class="metric">
                <div class="metric-value">{{ stats.conversionRate || '0.00' }}%</div>
                <div class="metric-label">Conversion Rate</div>
              </div>
              <div class="metric">
                <div class="metric-value">
                  ${{ (stats.totalEarnings / Math.max(stats.convertedReferrals, 1)).toFixed(2) }}
                </div>
                <div class="metric-label">Avg. Commission</div>
              </div>
            </div>
          </div>

          <div class="card">
            <h3>📋 All Referrals</h3>
            <div class="referrals-table">
              <div class="table-header">
                <span>Email</span>
                <span>Status</span>
                <span>Date</span>
                <span>Commission</span>
              </div>
              <div v-for="referral in recentReferrals" :key="referral.id" class="table-row">
                <span>{{ referral.referred_email || 'Anonymous' }}</span>
                <span :class="['status-badge', referral.status]">{{ referral.status }}</span>
                <span>{{ formatDate(referral.created_at) }}</span>
                <span>${{ referral.commission_amount || '0.00' }}</span>
              </div>
              <div v-if="recentReferrals.length === 0" class="no-data">No referrals yet</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AffiliateDashboard',
  props: {
    userId: {
      type: String,
      required: true,
    },
    domain: {
      type: String,
      default: 'vegvisr.org',
    },
  },
  data() {
    return {
      activeTab: 'overview',
      isLoading: false,
      copyButtonText: '📋 Copy',

      // Affiliate data
      affiliateInfo: {
        id: null,
        name: '',
        email: '',
        referralCode: '',
        commissionRate: 15,
        status: 'active',
      },

      // Statistics
      stats: {
        totalReferrals: 0,
        convertedReferrals: 0,
        totalEarnings: '0.00',
        pendingEarnings: '0.00',
        conversionRate: '0.00',
      },

      // Recent referrals
      recentReferrals: [],

      // Invitation form
      invitationForm: {
        recipientEmail: '',
        recipientName: '',
        customMessage: '',
      },
      invitationMessage: '',
      invitationMessageType: 'success',

      // Navigation tabs
      tabs: [
        { id: 'overview', label: 'Overview', icon: '📊' },
        { id: 'invite', label: 'Send Invites', icon: '📧' },
        { id: 'analytics', label: 'Analytics', icon: '📈' },
      ],
    }
  },
  computed: {
    siteName() {
      return (
        this.domain.charAt(0).toUpperCase() +
        this.domain.slice(1).replace('.org', '').replace('.com', '')
      )
    },
    referralLink() {
      if (!this.affiliateInfo.referralCode) return ''
      return `https://${this.domain}?ref=${this.affiliateInfo.referralCode}`
    },
    canSendInvitation() {
      return (
        this.invitationForm.recipientEmail && this.invitationForm.recipientName && !this.isLoading
      )
    },
  },
  async mounted() {
    await this.loadDashboardData()
  },
  methods: {
    async loadDashboardData() {
      this.isLoading = true
      try {
        // First check if user is registered as an affiliate
        const response = await fetch(`/affiliate-dashboard?affiliateId=${this.userId}`)
        const data = await response.json()

        if (response.ok && data.success) {
          this.affiliateInfo = data.affiliate
          this.stats = data.statistics
          this.recentReferrals = data.recentReferrals
        } else {
          // User is not an affiliate, show registration option
          this.showAffiliateRegistration()
        }
      } catch (error) {
        console.error('Error loading affiliate dashboard:', error)
        this.showError('Failed to load dashboard data')
      } finally {
        this.isLoading = false
      }
    },

    async sendInvitation() {
      if (!this.canSendInvitation) return

      this.isLoading = true
      this.invitationMessage = ''

      try {
        const response = await fetch('/send-affiliate-invitation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipientEmail: this.invitationForm.recipientEmail,
            recipientName: this.invitationForm.recipientName,
            senderName: this.affiliateInfo.name,
            siteName: this.siteName,
            commissionRate: this.affiliateInfo.commissionRate,
            domain: this.domain,
            inviterAffiliateId: this.affiliateInfo.id,
            customMessage: this.invitationForm.customMessage,
          }),
        })

        const result = await response.json()

        if (response.ok && result.success) {
          this.invitationMessage = 'Invitation sent successfully! 🎉'
          this.invitationMessageType = 'success'
          this.resetInvitationForm()
        } else {
          this.invitationMessage = result.error || 'Failed to send invitation'
          this.invitationMessageType = 'error'
        }
      } catch (error) {
        console.error('Error sending invitation:', error)
        this.invitationMessage = 'Failed to send invitation. Please try again.'
        this.invitationMessageType = 'error'
      } finally {
        this.isLoading = false
        // Clear message after 5 seconds
        setTimeout(() => {
          this.invitationMessage = ''
        }, 5000)
      }
    },

    resetInvitationForm() {
      this.invitationForm = {
        recipientEmail: '',
        recipientName: '',
        customMessage: '',
      }
    },

    selectAllText() {
      this.$refs.referralLinkInput.select()
    },

    async copyToClipboard() {
      try {
        await navigator.clipboard.writeText(this.referralLink)
        this.copyButtonText = '✅ Copied!'
        setTimeout(() => {
          this.copyButtonText = '📋 Copy'
        }, 2000)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
        // Fallback for older browsers
        this.$refs.referralLinkInput.select()
        document.execCommand('copy')
        this.copyButtonText = '✅ Copied!'
        setTimeout(() => {
          this.copyButtonText = '📋 Copy'
        }, 2000)
      }
    },

    formatDate(dateString) {
      if (!dateString) return 'N/A'
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    },

    showAffiliateRegistration() {
      // Emit event to parent component to show registration modal
      this.$emit('show-affiliate-registration')
    },

    showError(message) {
      this.invitationMessage = message
      this.invitationMessageType = 'error'
      setTimeout(() => {
        this.invitationMessage = ''
      }, 5000)
    },
  },
}
</script>

<style scoped>
.affiliate-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

/* Header */
.dashboard-header {
  margin-bottom: 30px;
}

.header-content h1 {
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 2rem;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 1.1rem;
}

.quick-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 0.9rem;
  opacity: 0.9;
}

/* Tabs */
.tab-navigation {
  display: flex;
  gap: 4px;
  margin-bottom: 30px;
  border-bottom: 2px solid #e5e7eb;
}

.tab-button {
  background: none;
  border: none;
  padding: 12px 24px;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s;
}

.tab-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.tab-button.active {
  background: #4f46e5;
  color: white;
}

/* Cards */
.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.card h3 {
  margin: 0 0 16px 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 600;
}

/* Overview Grid */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

/* Earnings Card */
.earnings-breakdown {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.earning-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.earning-item:last-child {
  border-bottom: none;
}

.earning-item .label {
  color: #6b7280;
}

.earning-item .value {
  font-weight: 600;
  color: #059669;
}

/* Referral Link */
.link-container {
  display: flex;
  gap: 8px;
  margin: 16px 0;
}

.referral-input {
  flex: 1;
  padding: 10px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.9rem;
  background: #f9fafb;
}

.copy-button {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.copy-button:hover {
  background: #4338ca;
}

.link-help {
  color: #6b7280;
  font-size: 0.9rem;
  margin: 0;
}

/* Referrals */
.referral-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.referral-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.referral-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.referral-info .email {
  font-weight: 500;
  color: #1f2937;
}

.referral-info .date {
  font-size: 0.8rem;
  color: #6b7280;
}

.referral-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.pending {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.converted {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.invalid {
  background: #fee2e2;
  color: #991b1b;
}

.commission {
  font-weight: 600;
  color: #059669;
}

/* Forms */
.invitation-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-weight: 500;
  color: #374151;
}

.form-input,
.form-textarea {
  padding: 10px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #4f46e5;
}

.send-button {
  background: #10b981;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.send-button:hover:not(:disabled) {
  background: #059669;
}

.send-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

/* Messages */
.message {
  margin-top: 16px;
  padding: 12px;
  border-radius: 6px;
  font-weight: 500;
}

.message.success {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.message.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

/* Analytics */
.analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.metric {
  text-align: center;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.metric-label {
  font-size: 0.9rem;
  color: #6b7280;
  margin-top: 4px;
}

/* Table */
.referrals-table {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 16px;
  padding: 12px 16px;
  background: white;
  align-items: center;
}

.table-header {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.no-activity,
.no-data {
  text-align: center;
  color: #6b7280;
  padding: 40px;
  font-style: italic;
}

/* Responsive */
@media (max-width: 768px) {
  .affiliate-dashboard {
    padding: 16px;
  }

  .overview-grid,
  .analytics-grid {
    grid-template-columns: 1fr;
  }

  .quick-stats {
    grid-template-columns: 1fr;
  }

  .tab-navigation {
    flex-direction: column;
  }

  .link-container {
    flex-direction: column;
  }

  .table-header,
  .table-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>
