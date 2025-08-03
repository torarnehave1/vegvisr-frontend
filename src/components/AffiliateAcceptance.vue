<template>
  <div class="affiliate-acceptance">
    <div class="container">
      <div class="acceptance-card">
        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <h3>🔍 Validating Invitation...</h3>
          <p>Please wait while we verify your affiliate invitation.</p>
        </div>

        <!-- Invalid Token -->
        <div v-else-if="error" class="error-state">
          <div class="error-icon">❌</div>
          <h3>Invalid or Expired Invitation</h3>
          <p>{{ error }}</p>
          <router-link to="/" class="btn-secondary">Go to Home</router-link>
        </div>

        <!-- Valid Invitation - Show Details -->
        <div v-else-if="invitation && !accepting" class="invitation-details">
          <div class="header">
            <h2>🤝 Affiliate Partnership Invitation</h2>
            <div class="welcome-back">
              <h3>👋 Welcome back, {{ invitation.recipientName }}!</h3>
              <p>You've been invited to join our affiliate program.</p>
            </div>
          </div>

          <div class="invitation-info">
            <div class="info-item">
              <strong>Invited by:</strong> {{ invitation.senderName }}
            </div>
            <div class="info-item">
              <strong>Domain:</strong> {{ invitation.domain }}
            </div>
            <div class="info-item">
              <strong>Commission Rate:</strong> {{ invitation.commissionRate }}%
            </div>
            <div class="info-item">
              <strong>Expires:</strong> {{ formatDate(invitation.expiresAt) }}
            </div>
          </div>

          <div class="benefits">
            <h4>🎯 What you get as an affiliate:</h4>
            <ul>
              <li>Earn commission on all successful referrals</li>
              <li>Real-time tracking dashboard</li>
              <li>Professional marketing materials</li>
              <li>Monthly payouts via PayPal</li>
              <li>Dedicated affiliate support</li>
            </ul>
          </div>

          <div class="actions">
            <button @click="acceptInvitation" class="btn-primary" :disabled="accepting">
              Accept Affiliate Invitation
            </button>
            <button @click="decline" class="btn-secondary">
              Decline
            </button>
          </div>
        </div>

        <!-- Accepting State -->
        <div v-else-if="accepting" class="accepting-state">
          <div class="loading-spinner"></div>
          <h3>🚀 Activating Your Affiliate Account...</h3>
          <p>Please wait while we set up your affiliate dashboard.</p>
        </div>

        <!-- Success State -->
        <div v-else-if="success" class="success-state">
          <div class="success-icon">🎉</div>
          <h3>Welcome to Our Affiliate Program!</h3>
          <p>Your affiliate account has been successfully activated.</p>
          <div class="next-steps">
            <h4>What's next:</h4>
            <ul>
              <li>✅ Your affiliate dashboard is now active</li>
              <li>✅ You can start promoting and earning immediately</li>
              <li>✅ Track your performance in real-time</li>
            </ul>
          </div>
          <div class="actions">
            <router-link to="/affiliate" class="btn-primary">
              Go to Affiliate Dashboard
            </router-link>
            <router-link to="/" class="btn-secondary">
              Go to Home
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export default {
  name: 'AffiliateAcceptance',
  setup() {
    const route = useRoute()
    const router = useRouter()
    
    const loading = ref(true)
    const accepting = ref(false)
    const success = ref(false)
    const error = ref(null)
    const invitation = ref(null)
    
    const token = route.query.token

    // Validate invitation token on mount
    onMounted(async () => {
      if (!token) {
        error.value = 'No invitation token provided'
        loading.value = false
        return
      }

      try {
        const response = await fetch(`https://aff-worker.torarnehave.workers.dev/validate-invitation?token=${token}`)
        const data = await response.json()

        if (response.ok && data.success) {
          invitation.value = data.invitation
        } else {
          error.value = data.error || 'Invalid invitation token'
        }
      } catch (err) {
        console.error('Error validating invitation:', err)
        error.value = 'Failed to validate invitation'
      }
      
      loading.value = false
    })

    // Accept the invitation
    const acceptInvitation = async () => {
      accepting.value = true
      
      try {
        const response = await fetch('https://aff-worker.torarnehave.workers.dev/complete-invitation-registration', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: token,
            email: invitation.value.recipientEmail,
            name: invitation.value.recipientName
          })
        })

        const data = await response.json()

        if (response.ok && data.success) {
          success.value = true
        } else {
          error.value = data.error || 'Failed to accept invitation'
        }
      } catch (err) {
        console.error('Error accepting invitation:', err)
        error.value = 'Failed to accept invitation'
      }
      
      accepting.value = false
    }

    // Decline invitation
    const decline = () => {
      router.push('/')
    }

    // Format date for display
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    return {
      loading,
      accepting,
      success,
      error,
      invitation,
      acceptInvitation,
      decline,
      formatDate
    }
  }
}
</script>

<style scoped>
.affiliate-acceptance {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  max-width: 600px;
  width: 100%;
}

.acceptance-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.loading-state, .error-state, .accepting-state, .success-state {
  text-align: center;
  padding: 2rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4f46e5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon, .success-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h2 {
  color: #4f46e5;
  margin-bottom: 1rem;
}

.welcome-back {
  background: #dbeafe;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.invitation-info {
  background: #f9fafb;
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1.5rem 0;
  border: 1px solid #e5e7eb;
}

.info-item {
  margin-bottom: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.info-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.benefits {
  background: #f0f9ff;
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1.5rem 0;
}

.benefits h4 {
  color: #1e40af;
  margin-bottom: 1rem;
}

.benefits ul {
  list-style: none;
  padding: 0;
}

.benefits li {
  padding: 0.5rem 0;
  padding-left: 1.5rem;
  position: relative;
}

.benefits li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #10b981;
  font-weight: bold;
}

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  justify-content: center;
}

.btn-primary {
  background: #4f46e5;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background: #4338ca;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6b7280;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: background-color 0.2s;
}

.btn-secondary:hover {
  background: #374151;
}

.next-steps {
  text-align: left;
  margin: 1.5rem 0;
}

.next-steps ul {
  list-style: none;
  padding: 0;
}

.next-steps li {
  padding: 0.5rem 0;
}
</style>
