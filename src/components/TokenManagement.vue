<template>
  <div class="token-management">
    <div class="header">
      <h2>API Token Management</h2>
      <button @click="showCreateModal = true" class="btn-primary">
        <span class="icon">+</span>
        Create New Token
      </button>
    </div>

    <!-- Token List -->
    <div v-if="tokens.length > 0" class="token-list">
      <div v-for="token in tokens" :key="token.id" class="token-card">
        <div class="token-header">
          <div class="token-info">
            <h3>{{ token.name }}</h3>
            <div class="token-prefix">{{ token.prefix }}...</div>
          </div>
          <div class="token-status">
            <span :class="['status-badge', token.isActive ? 'active' : 'inactive']">
              {{ token.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>

        <div class="token-details">
          <div class="detail-item">
            <span class="label">Scopes:</span>
            <div class="scopes">
              <span v-for="scope in token.scopes" :key="scope" class="scope-badge">
                {{ scope }}
              </span>
            </div>
          </div>

          <div class="detail-row">
            <div class="detail-item">
              <span class="label">Rate Limit:</span>
              <span class="value">{{ token.rateLimit }} req/hour</span>
            </div>
            <div class="detail-item">
              <span class="label">Usage:</span>
              <span class="value">{{ token.usageCount }} requests</span>
            </div>
          </div>

          <div class="detail-row">
            <div class="detail-item">
              <span class="label">Created:</span>
              <span class="value">{{ formatDate(token.createdAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Last Used:</span>
              <span class="value">{{ token.lastUsedAt ? formatDate(token.lastUsedAt) : 'Never' }}</span>
            </div>
          </div>

          <div v-if="token.expiresAt" class="detail-item">
            <span class="label">Expires:</span>
            <span class="value">{{ formatDate(token.expiresAt) }}</span>
          </div>
        </div>

        <div class="token-actions">
          <button @click="viewUsage(token)" class="btn-secondary">
            📊 View Usage
          </button>
          <button
            @click="toggleTokenStatus(token)"
            class="btn-secondary"
            :class="{ warning: token.isActive }"
          >
            {{ token.isActive ? '⏸️ Disable' : '▶️ Enable' }}
          </button>
          <button @click="confirmRevoke(token)" class="btn-danger">
            🗑️ Revoke
          </button>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>No API tokens yet. Create your first token to get started!</p>
    </div>

    <!-- Create Token Modal -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-backdrop" @click.self="closeCreateModal">
        <div class="modal">
          <div class="modal-header">
            <h3>Create New API Token</h3>
            <button @click="closeCreateModal" class="close-btn">&times;</button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label for="token-name">Token Name</label>
              <input
                id="token-name"
                v-model="newToken.name"
                type="text"
                placeholder="e.g., Production API Access"
                class="form-input"
                @keyup.enter="createToken"
              />
            </div>

            <div class="form-group">
              <label>Scopes (select at least one)</label>
              <div class="scopes-grid">
                <label v-for="scope in availableScopes" :key="scope.name" class="scope-checkbox">
                  <input
                    type="checkbox"
                    :value="scope.name"
                    v-model="newToken.scopes"
                  />
                  <span class="scope-label">
                    <strong>{{ scope.name }}</strong>
                    <small>{{ scope.description }}</small>
                  </span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label for="rate-limit">Rate Limit (requests per hour)</label>
              <input
                id="rate-limit"
                v-model.number="newToken.rateLimit"
                type="number"
                min="1"
                max="10000"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="expires-in">Expiration (optional)</label>
              <select id="expires-in" v-model="newToken.expiresIn" class="form-select">
                <option :value="null">Never expires</option>
                <option :value="86400">1 Day</option>
                <option :value="604800">1 Week</option>
                <option :value="2592000">30 Days</option>
                <option :value="7776000">90 Days</option>
                <option :value="31536000">1 Year</option>
              </select>
            </div>

            <div v-if="createdToken" class="created-token-display">
              <div class="warning-message">
                ⚠️ Save this token now! You won't be able to see it again.
              </div>
              <div class="token-value">
                <code>{{ createdToken }}</code>
                <button @click="copyToken" class="btn-copy">
                  {{ tokenCopied ? '✓ Copied' : '📋 Copy' }}
                </button>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button @click="closeCreateModal" class="btn-secondary">Cancel</button>
            <button
              @click="createToken"
              class="btn-primary"
              :disabled="!canCreateToken || isCreating"
            >
              {{ isCreating ? 'Creating...' : 'Create Token' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Usage Stats Modal -->
    <Teleport to="body">
      <div v-if="showUsageModal" class="modal-backdrop" @click.self="showUsageModal = false">
        <div class="modal modal-large">
          <div class="modal-header">
            <h3>Token Usage - {{ selectedToken?.name }}</h3>
            <button @click="showUsageModal = false" class="close-btn">&times;</button>
          </div>

          <div class="modal-body">
            <div v-if="usageStats" class="usage-stats">
              <div class="stats-summary">
                <div class="stat-card">
                  <div class="stat-value">{{ usageStats.totalRequests }}</div>
                  <div class="stat-label">Total Requests</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ usageStats.successfulRequests }}</div>
                  <div class="stat-label">Successful</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ usageStats.failedRequests }}</div>
                  <div class="stat-label">Failed</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ Math.round(usageStats.averageResponseTime) }}ms</div>
                  <div class="stat-label">Avg Response Time</div>
                </div>
              </div>

              <div v-if="usageStats.byEndpoint && usageStats.byEndpoint.length > 0" class="endpoint-stats">
                <h4>Usage by Endpoint</h4>
                <div v-for="endpoint in usageStats.byEndpoint" :key="endpoint.endpoint" class="endpoint-item">
                  <div class="endpoint-path">{{ endpoint.endpoint }}</div>
                  <div class="endpoint-count">{{ endpoint.count }} requests</div>
                </div>
              </div>

              <div v-if="usageStats.recentRequests && usageStats.recentRequests.length > 0" class="recent-requests">
                <h4>Recent Requests (Last 20)</h4>
                <div class="requests-table">
                  <div v-for="req in usageStats.recentRequests" :key="req.id" class="request-row">
                    <div class="request-time">{{ formatDate(req.timestamp) }}</div>
                    <div class="request-endpoint">{{ req.endpoint }}</div>
                    <div class="request-method">{{ req.method }}</div>
                    <div :class="['request-status', getStatusClass(req.statusCode)]">
                      {{ req.statusCode }}
                    </div>
                    <div class="request-duration">{{ req.responseTime }}ms</div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="loading">Loading usage statistics...</div>
          </div>

          <div class="modal-footer">
            <button @click="showUsageModal = false" class="btn-secondary">Close</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Revoke Confirmation Modal -->
    <ConfirmationModal
      :isOpen="showRevokeModal"
      title="Revoke API Token?"
      :message="`Are you sure you want to revoke '${tokenToRevoke?.name}'? This action cannot be undone and any applications using this token will lose access immediately.`"
      variant="danger"
      confirmText="Revoke Token"
      :requireConfirmation="true"
      confirmationText="REVOKE"
      @confirm="revokeToken"
      @cancel="showRevokeModal = false"
      @update:isOpen="showRevokeModal = $event"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import ConfirmationModal from './ConfirmationModal.vue'

const userStore = useUserStore()

const tokens = ref([])
const showCreateModal = ref(false)
const showUsageModal = ref(false)
const showRevokeModal = ref(false)
const selectedToken = ref(null)
const tokenToRevoke = ref(null)
const usageStats = ref(null)
const isCreating = ref(false)
const createdToken = ref(null)
const tokenCopied = ref(false)

const newToken = ref({
  name: '',
  scopes: [],
  rateLimit: 1000,
  expiresIn: null
})

const availableScopes = ref([
  { name: 'ai:chat', description: 'Access AI chat endpoints' },
  { name: 'graph:read', description: 'Read knowledge graphs' },
  { name: 'graph:write', description: 'Create and update graphs' },
  { name: 'graph:delete', description: 'Delete knowledge graphs' },
  { name: 'node:read', description: 'Read graph nodes' },
  { name: 'node:write', description: 'Create and update nodes' },
  { name: 'node:delete', description: 'Delete graph nodes' },
  { name: 'template:read', description: 'Read templates' },
  { name: 'template:write', description: 'Create templates' },
  { name: 'user:read', description: 'Read user profile' },
  { name: 'analytics:read', description: 'View analytics data' }
])

const canCreateToken = computed(() => {
  return newToken.value.name.trim() && newToken.value.scopes.length > 0
})

const formatDate = (dateString) => {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStatusClass = (status) => {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 400 && status < 500) return 'client-error'
  if (status >= 500) return 'server-error'
  return ''
}

const fetchTokens = async () => {
  try {
    const response = await fetch('https://api.vegvisr.org/api/tokens/list', {
      headers: {
        'Authorization': `Bearer ${userStore.emailVerificationToken}`
      }
    })

    const data = await response.json()
    if (data.success) {
      tokens.value = data.tokens
    }
  } catch (error) {
    console.error('Failed to fetch tokens:', error)
  }
}

const createToken = async () => {
  if (!canCreateToken.value || isCreating.value) return

  isCreating.value = true
  try {
    const response = await fetch('https://api.vegvisr.org/api/tokens/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userStore.emailVerificationToken}`
      },
      body: JSON.stringify(newToken.value)
    })

    const data = await response.json()
    if (data.success) {
      createdToken.value = data.token.token
      await fetchTokens()
      // Don't close modal yet - let user copy the token
    }
  } catch (error) {
    console.error('Failed to create token:', error)
  } finally {
    isCreating.value = false
  }
}

const copyToken = async () => {
  try {
    await navigator.clipboard.writeText(createdToken.value)
    tokenCopied.value = true
    setTimeout(() => {
      tokenCopied.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy token:', error)
  }
}

const closeCreateModal = () => {
  showCreateModal.value = false
  newToken.value = {
    name: '',
    scopes: [],
    rateLimit: 1000,
    expiresIn: null
  }
  createdToken.value = null
  tokenCopied.value = false
}

const viewUsage = async (token) => {
  selectedToken.value = token
  showUsageModal.value = true
  usageStats.value = null

  try {
    const response = await fetch(`https://api.vegvisr.org/api/tokens/${token.id}/usage`, {
      headers: {
        'Authorization': `Bearer ${userStore.emailVerificationToken}`
      }
    })

    const data = await response.json()
    if (data.success) {
      usageStats.value = data.usage
    }
  } catch (error) {
    console.error('Failed to fetch usage stats:', error)
  }
}

const toggleTokenStatus = async (token) => {
  try {
    const response = await fetch(`https://api.vegvisr.org/api/tokens/${token.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userStore.emailVerificationToken}`
      },
      body: JSON.stringify({
        isActive: !token.isActive
      })
    })

    const data = await response.json()
    if (data.success) {
      await fetchTokens()
    }
  } catch (error) {
    console.error('Failed to toggle token status:', error)
  }
}

const confirmRevoke = (token) => {
  tokenToRevoke.value = token
  showRevokeModal.value = true
}

const revokeToken = async () => {
  if (!tokenToRevoke.value) return

  try {
    const response = await fetch(`https://api.vegvisr.org/api/tokens/${tokenToRevoke.value.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${userStore.emailVerificationToken}`
      }
    })

    const data = await response.json()
    if (data.success) {
      await fetchTokens()
      showRevokeModal.value = false
      tokenToRevoke.value = null
    }
  } catch (error) {
    console.error('Failed to revoke token:', error)
  }
}

onMounted(() => {
  fetchTokens()
})
</script>

<style scoped>
.token-management {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h2 {
  margin: 0;
  font-size: 1.75rem;
  color: #1a1a1a;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #4338ca;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-secondary.warning:hover {
  background: #fef3c7;
  border-color: #fbbf24;
  color: #92400e;
}

.btn-danger {
  padding: 0.5rem 1rem;
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:hover {
  background: #fecaca;
  border-color: #ef4444;
}

.token-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.token-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.2s;
}

.token-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.token-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 1rem;
}

.token-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  color: #1a1a1a;
}

.token-prefix {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: #6b7280;
  background: #f9fafb;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  display: inline-block;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.active {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.inactive {
  background: #fee2e2;
  color: #991b1b;
}

.token-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.detail-row {
  display: flex;
  gap: 2rem;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.detail-item .label {
  color: #6b7280;
  font-weight: 500;
}

.detail-item .value {
  color: #1a1a1a;
}

.scopes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.scope-badge {
  padding: 0.25rem 0.625rem;
  background: #ede9fe;
  color: #5b21b6;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.token-actions {
  display: flex;
  gap: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s;
}

.modal-large {
  max-width: 900px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #1a1a1a;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #1a1a1a;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.form-input,
.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.scopes-grid {
  display: grid;
  gap: 0.75rem;
}

.scope-checkbox {
  display: flex;
  align-items: start;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.scope-checkbox:hover {
  background: #f9fafb;
  border-color: #4f46e5;
}

.scope-checkbox input[type="checkbox"] {
  margin-top: 0.25rem;
  cursor: pointer;
}

.scope-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.scope-label strong {
  color: #1a1a1a;
  font-size: 0.875rem;
}

.scope-label small {
  color: #6b7280;
  font-size: 0.75rem;
}

.created-token-display {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.warning-message {
  color: #92400e;
  font-weight: 600;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}

.token-value {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.token-value code {
  flex: 1;
  padding: 0.75rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  word-break: break-all;
}

.btn-copy {
  padding: 0.75rem 1rem;
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.btn-copy:hover {
  background: #f3f4f6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.usage-stats {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.endpoint-stats h4,
.recent-requests h4 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  color: #1a1a1a;
}

.endpoint-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.endpoint-path {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: #374151;
}

.endpoint-count {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.requests-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.request-row {
  display: grid;
  grid-template-columns: 150px 1fr 80px 80px 80px;
  gap: 1rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 0.875rem;
  align-items: center;
}

.request-time {
  color: #6b7280;
}

.request-endpoint {
  font-family: 'Courier New', monospace;
  color: #374151;
}

.request-method {
  font-weight: 600;
  color: #4f46e5;
}

.request-status {
  text-align: center;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}

.request-status.success {
  background: #d1fae5;
  color: #065f46;
}

.request-status.client-error {
  background: #fef3c7;
  color: #92400e;
}

.request-status.server-error {
  background: #fee2e2;
  color: #991b1b;
}

.request-duration {
  text-align: right;
  color: #6b7280;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
