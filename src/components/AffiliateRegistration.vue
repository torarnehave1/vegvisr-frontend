<template>
  <div class="affiliate-registration">
    <div class="registration-modal" v-if="showModal">
      <div class="modal-overlay" @click="closeModal"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🎯 Join Our Affiliate Program</h2>
          <button @click="closeModal" class="close-button">×</button>
        </div>

        <div class="modal-body">
          <!-- User Account Check -->
          <div v-if="!userVerified" class="user-verification-section">
            <div class="verification-info">
              <h3>📝 Step 1: Verify Your Account</h3>
              <p>
                To become an affiliate, you must first have a verified account with us. Please enter
                your email to check your registration status.
              </p>
            </div>

            <div class="form-group">
              <label for="email-check">Email Address</label>
              <input
                id="email-check"
                v-model="emailToCheck"
                type="email"
                required
                placeholder="Enter your email address"
                class="form-input"
                :disabled="isChecking"
              />
            </div>

            <button
              @click="checkUserAccount"
              class="btn-primary"
              :disabled="!emailToCheck || isChecking"
            >
              {{ isChecking ? 'Checking...' : 'Check My Account' }}
            </button>

            <div v-if="accountStatus" class="account-status mt-3">
              <div v-if="accountStatus === 'verified'" class="alert alert-success">
                ✅ Account verified! You can now register as an affiliate.
              </div>
              <div v-else-if="accountStatus === 'not-verified'" class="alert alert-warning">
                ⚠️ Account found but not verified. Please check your email and click the
                verification link first.
                <br />
                <router-link
                  :to="`/register?email=${emailToCheck}`"
                  class="btn btn-outline-primary btn-sm mt-2"
                >
                  Resend Verification Email
                </router-link>
              </div>
              <div v-else-if="accountStatus === 'not-found'" class="alert alert-info">
                ❌ No account found. Please register first.
                <br />
                <router-link
                  :to="`/register?email=${emailToCheck}`"
                  class="btn btn-outline-primary btn-sm mt-2"
                >
                  Create Account
                </router-link>
              </div>
            </div>
          </div>

          <!-- Invitation Mode (when user is verified) -->
          <div v-if="userVerified && invitationToken" class="invitation-section">
            <div class="invitation-info">
              <div class="invitation-badge">📧 Invitation</div>
              <h3>You've been invited by {{ invitationData.senderName }}</h3>
              <p>
                Join {{ invitationData.siteName || siteName }} as an affiliate partner and start
                earning {{ invitationData.commissionRate }}% commission!
              </p>
            </div>
          </div>

          <!-- Registration Form (only shown when user is verified) -->
          <form v-if="userVerified" @submit.prevent="registerAffiliate" class="registration-form">
            <div class="form-group">
              <label for="name">Full Name</label>
              <input
                id="name"
                v-model="form.name"
                type="text"
                required
                placeholder="Enter your full name"
                class="form-input"
                :disabled="isLoading"
              />
            </div>

            <div class="form-group">
              <label for="email">Email Address</label>
              <input
                id="email"
                v-model="form.email"
                type="email"
                required
                placeholder="Enter your email address"
                class="form-input"
                :disabled="isLoading || (invitationData && invitationData.recipientEmail)"
              />
            </div>

            <div class="form-group">
              <label for="domain">Website/Domain (Optional)</label>
              <input
                id="domain"
                v-model="form.domain"
                type="text"
                placeholder="yourwebsite.com"
                class="form-input"
                :disabled="isLoading"
              />
            </div>

            <div class="form-group">
              <label for="experience">Marketing Experience</label>
              <select v-model="form.experience" class="form-select" :disabled="isLoading">
                <option value="">Select your experience level</option>
                <option value="beginner">Beginner (New to affiliate marketing)</option>
                <option value="intermediate">Intermediate (1-3 years experience)</option>
                <option value="advanced">Advanced (3+ years experience)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="referralMethods">How will you promote us? (Optional)</label>
              <textarea
                id="referralMethods"
                v-model="form.referralMethods"
                rows="3"
                placeholder="Describe your marketing channels (social media, blog, email, etc.)"
                class="form-textarea"
                :disabled="isLoading"
              ></textarea>
            </div>

            <!-- Commission Rate Display -->
            <div class="commission-display">
              <div class="commission-highlight">
                <span class="commission-icon">💰</span>
                <div class="commission-text">
                  <strong
                    >{{ invitationData?.commissionRate || defaultCommissionRate }}% Commission
                    Rate</strong
                  >
                  <p>Earn money on every successful referral</p>
                </div>
              </div>
            </div>

            <!-- Terms and Conditions -->
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="form.acceptTerms" required :disabled="isLoading" />
                <span class="checkmark"></span>
                I agree to the
                <a href="/affiliate-terms" target="_blank">Affiliate Terms & Conditions</a>
              </label>
            </div>

            <!-- Submit Button -->
            <button type="submit" :disabled="!canSubmit || isLoading" class="submit-button">
              <span v-if="isLoading">
                <span class="spinner"></span>
                Processing...
              </span>
              <span v-else> 🚀 Join Affiliate Program </span>
            </button>
          </form>

          <!-- Success/Error Messages -->
          <div v-if="message" :class="['message', messageType]">
            <div class="message-content">
              <span v-if="messageType === 'success'">✅</span>
              <span v-else>❌</span>
              {{ message }}
            </div>
          </div>

          <!-- Success State -->
          <div v-if="registrationSuccess" class="success-state">
            <div class="success-content">
              <div class="success-icon">🎉</div>
              <h3>Welcome to Our Affiliate Program!</h3>
              <p>Your registration was successful. Here are your affiliate details:</p>

              <div class="affiliate-details">
                <div class="detail-item">
                  <span class="label">Affiliate ID:</span>
                  <span class="value">{{ affiliateResult.affiliateId }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Referral Code:</span>
                  <span class="value">{{ affiliateResult.referralCode }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Commission Rate:</span>
                  <span class="value">{{ affiliateResult.commissionRate }}%</span>
                </div>
              </div>

              <div class="success-actions">
                <button @click="openDashboard" class="primary-button">📊 Open Dashboard</button>
                <button @click="closeModal" class="secondary-button">Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AffiliateRegistration',
  props: {
    showModal: {
      type: Boolean,
      default: false,
    },
    invitationToken: {
      type: String,
      default: null,
    },
    domain: {
      type: String,
      default: 'vegvisr.org',
    },
    defaultCommissionRate: {
      type: Number,
      default: 15,
    },
  },
  data() {
    return {
      isLoading: false,
      isChecking: false,
      userVerified: false,
      accountStatus: null,
      emailToCheck: '',
      registrationSuccess: false,
      message: '',
      messageType: 'success',

      // Invitation data (if invited)
      invitationData: null,

      // Registration form (only visible after user verification)
      form: {
        name: '',
        email: '',
        domain: '',
        experience: '',
        referralMethods: '',
        acceptTerms: false,
      },

      // Registration result
      affiliateResult: null,
    }
  },
  computed: {
    siteName() {
      return (
        this.domain.charAt(0).toUpperCase() +
        this.domain.slice(1).replace('.org', '').replace('.com', '')
      )
    },
    canSubmit() {
      return this.form.name && this.form.email && this.form.acceptTerms && !this.isLoading
    },
  },
  watch: {
    showModal(newValue) {
      if (newValue) {
        this.resetForm()
        if (this.invitationToken) {
          this.validateInvitation()
        }
      }
    },
  },
  methods: {
    async validateInvitation() {
      if (!this.invitationToken) return

      this.isLoading = true
      try {
        const response = await fetch(`/validate-invitation?token=${this.invitationToken}`)
        const data = await response.json()

        if (response.ok && data.success) {
          this.invitationData = data.invitation
          // Pre-fill form with invitation data
          this.form.email = this.invitationData.recipientEmail
          this.form.name = this.invitationData.recipientName
        } else {
          this.showMessage('Invalid or expired invitation token', 'error')
        }
      } catch (error) {
        console.error('Error validating invitation:', error)
        this.showMessage('Failed to validate invitation', 'error')
      } finally {
        this.isLoading = false
      }
    },

    async checkUserAccount() {
      if (!this.emailToCheck) return

      this.isChecking = true
      this.accountStatus = null

      try {
        const response = await fetch(`/check-email?email=${encodeURIComponent(this.emailToCheck)}`)
        const data = await response.json()

        if (data.exists && data.verified) {
          this.accountStatus = 'verified'
          this.userVerified = true
          this.form.email = this.emailToCheck
          // Check if user already has a name in their profile
          await this.loadUserProfile()
        } else if (data.exists && !data.verified) {
          this.accountStatus = 'not-verified'
          this.userVerified = false
        } else {
          this.accountStatus = 'not-found'
          this.userVerified = false
        }
      } catch (error) {
        console.error('Error checking user account:', error)
        this.showMessage('Failed to check account status', 'error')
      } finally {
        this.isChecking = false
      }
    },

    async loadUserProfile() {
      try {
        const response = await fetch(`/userdata?email=${encodeURIComponent(this.emailToCheck)}`)
        if (response.ok) {
          const userData = await response.json()
          // Pre-fill name if available in user profile
          if (userData.data && userData.data.profile && userData.data.profile.name) {
            this.form.name = userData.data.profile.name
          }
        }
      } catch (error) {
        console.log('Could not load user profile data:', error)
      }
    },

    async registerAffiliate() {
      if (!this.canSubmit) return

      this.isLoading = true
      this.clearMessage()

      try {
        let endpoint, payload

        if (this.invitationToken) {
          // Registration via invitation
          endpoint = '/complete-invitation-registration'
          payload = {
            token: this.invitationToken,
            email: this.form.email,
            name: this.form.name,
            additionalInfo: {
              domain: this.form.domain,
              experience: this.form.experience,
              referralMethods: this.form.referralMethods,
            },
          }
        } else {
          // Direct registration
          endpoint = '/register-affiliate'
          payload = {
            email: this.form.email,
            name: this.form.name,
            domain: this.form.domain || this.domain,
            experience: this.form.experience,
            referralMethods: this.form.referralMethods,
          }
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (response.ok && result.success) {
          this.affiliateResult = result.affiliate
          this.registrationSuccess = true
          this.showMessage('Affiliate registration successful!', 'success')

          // Emit success event to parent
          this.$emit('registration-success', result.affiliate)
        } else {
          this.showMessage(result.error || 'Registration failed', 'error')
        }
      } catch (error) {
        console.error('Error registering affiliate:', error)
        this.showMessage('Registration failed. Please try again.', 'error')
      } finally {
        this.isLoading = false
      }
    },

    openDashboard() {
      // Emit event to parent to open dashboard
      this.$emit('open-dashboard', this.affiliateResult)
      this.closeModal()
    },

    closeModal() {
      this.$emit('close')
      setTimeout(() => {
        this.resetForm()
        this.registrationSuccess = false
        this.clearMessage()
      }, 300) // Wait for modal animation
    },

    resetForm() {
      this.form = {
        name: '',
        email: '',
        domain: '',
        experience: '',
        referralMethods: '',
        acceptTerms: false,
      }
      this.invitationData = null
      this.affiliateResult = null
    },

    showMessage(message, type = 'success') {
      this.message = message
      this.messageType = type

      // Auto-clear success messages
      if (type === 'success') {
        setTimeout(() => {
          this.clearMessage()
        }, 5000)
      }
    },

    clearMessage() {
      this.message = ''
      this.messageType = 'success'
    },
  },
}
</script>

<style scoped>
.affiliate-registration {
  position: relative;
}

/* Modal */
.registration-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  background: white;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0 24px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 24px;
}

.modal-header h2 {
  margin: 0;
  color: #1f2937;
  font-size: 1.5rem;
  font-weight: 700;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-body {
  padding: 0 24px 24px 24px;
}

/* Invitation Section */
.invitation-section {
  margin-bottom: 24px;
}

.invitation-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
}

.invitation-badge {
  display: inline-block;
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 12px;
}

.invitation-info h3 {
  margin: 0 0 8px 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.invitation-info p {
  margin: 0;
  opacity: 0.9;
}

/* Form */
.registration-form {
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
  font-size: 0.9rem;
}

.form-input,
.form-textarea,
.form-select {
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.form-input:disabled,
.form-textarea:disabled,
.form-select:disabled {
  background: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

/* Commission Display */
.commission-display {
  margin: 20px 0;
}

.commission-highlight {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #fef3c7;
  padding: 16px;
  border-radius: 12px;
  border-left: 4px solid #f59e0b;
}

.commission-icon {
  font-size: 1.5rem;
}

.commission-text strong {
  color: #92400e;
  font-size: 1.1rem;
}

.commission-text p {
  margin: 4px 0 0 0;
  color: #78350f;
  font-size: 0.9rem;
}

/* Checkbox */
.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  line-height: 1.5;
}

.checkbox-label input[type='checkbox'] {
  width: 18px;
  height: 18px;
  margin: 0;
  cursor: pointer;
}

.checkbox-label a {
  color: #4f46e5;
  text-decoration: none;
}

.checkbox-label a:hover {
  text-decoration: underline;
}

/* Buttons */
.submit-button {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 14px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.submit-button:hover:not(:disabled) {
  background: #4338ca;
  transform: translateY(-1px);
}

.submit-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

.primary-button {
  background: #10b981;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.primary-button:hover {
  background: #059669;
}

.secondary-button {
  background: #f3f4f6;
  color: #374151;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.secondary-button:hover {
  background: #e5e7eb;
}

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Messages */
.message {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 8px;
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

.message-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Success State */
.success-state {
  text-align: center;
  padding: 20px 0;
}

.success-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.success-content h3 {
  margin: 0 0 12px 0;
  color: #1f2937;
  font-size: 1.5rem;
  font-weight: 700;
}

.success-content p {
  margin: 0 0 24px 0;
  color: #6b7280;
}

.affiliate-details {
  background: #f9fafb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
  text-align: left;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-item .label {
  color: #6b7280;
  font-weight: 500;
}

.detail-item .value {
  font-weight: 600;
  color: #1f2937;
  font-family: monospace;
}

.success-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

/* Responsive */
@media (max-width: 768px) {
  .registration-modal {
    padding: 10px;
  }

  .modal-content {
    max-height: 95vh;
  }

  .modal-header,
  .modal-body {
    padding: 16px;
  }

  .success-actions {
    flex-direction: column;
  }
}
</style>
