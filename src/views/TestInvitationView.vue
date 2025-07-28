<template>
  <div class="test-invitation-view">
    <div class="test-header">
      <h1>InvitationModal Test Page</h1>
      <p>This page allows you to test the InvitationModal component directly.</p>
    </div>

    <div class="test-controls">
      <h3>Test Controls</h3>
      <div class="control-group">
        <label for="roomId">Room ID:</label>
        <input
          id="roomId"
          v-model="testRoomId"
          type="text"
          placeholder="Enter room ID for testing"
        />
      </div>

      <div class="control-group">
        <label for="roomName">Room Name:</label>
        <input
          id="roomName"
          v-model="testRoomName"
          type="text"
          placeholder="Enter room name for testing"
        />
      </div>

      <div class="control-group">
        <button @click="showModal = !showModal" class="btn btn-primary">
          {{ showModal ? 'Hide' : 'Show' }} Invitation Modal
        </button>
      </div>

      <div class="control-group">
        <button @click="refreshUserData" class="btn btn-secondary">🔄 Refresh User Data</button>
      </div>
    </div>

    <div class="test-info">
      <h3>Current Test Data</h3>
      <div class="info-grid">
        <div><strong>Room ID:</strong> {{ testRoomId || 'Not set' }}</div>
        <div><strong>Room Name:</strong> {{ testRoomName || 'Not set' }}</div>
        <div><strong>Modal Visible:</strong> {{ showModal ? 'Yes' : 'No' }}</div>
        <div><strong>User Authenticated:</strong> {{ isAuthenticated ? 'Yes' : 'No' }}</div>
        <div><strong>User Email:</strong> {{ userEmail }}</div>
        <div><strong>User ID:</strong> {{ userId }}</div>
        <div><strong>User Role:</strong> {{ userRole }}</div>
        <div><strong>Can Send Invitations:</strong> {{ canSendInvitations ? 'Yes' : 'No' }}</div>
      </div>
    </div>

    <div v-if="!isAuthenticated" class="auth-warning">
      <h3>⚠️ Authentication Required</h3>
      <p>You need to be logged in to test the invitation functionality.</p>
      <button @click="goToLogin" class="btn btn-primary">Go to Login</button>
    </div>

    <!-- Render the InvitationModal with test data -->
    <InvitationModal
      :is-visible="showModal"
      :room-id="testRoomId"
      :room-name="testRoomName"
      @close="showModal = false"
      @invitation-sent="handleInvitationSent"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import InvitationModal from '../components/InvitationModal.vue'
import { useUserStore } from '../stores/userStore'

const router = useRouter()
const userStore = useUserStore()

// Test data
const testRoomId = ref('room_1753439025194') // Use the real room ID from testing
const testRoomName = ref('Vegvisr.org Test Room')
const showModal = ref(true) // Start with modal visible for testing

// Simple authentication check - same as other routes
const isAuthenticated = computed(() => userStore.loggedIn)
const userEmail = computed(() => userStore.email || 'Not logged in')
const userRole = computed(() => userStore.role || 'No role')
const userId = computed(() => userStore.user_id || 'No user ID')

// Check if user has permission to send invitations
const canSendInvitations = computed(() => isAuthenticated.value)

onMounted(() => {
  console.log('🔍 TestInvitationView mounted')
  console.log('User state:', {
    loggedIn: userStore.loggedIn,
    email: userStore.email,
    user_id: userStore.user_id,
    role: userStore.role,
  })
})

function handleInvitationSent() {
  console.log('Invitation sent successfully!')
  // You can add additional test logic here
}

function goToLogin() {
  router.push('/login')
}

function refreshUserData() {
  console.log('🔄 Refreshing user data...')
  userStore.loadUserFromStorage()
  console.log('User state after refresh:', {
    loggedIn: userStore.loggedIn,
    email: userStore.email,
    user_id: userStore.user_id,
    role: userStore.role,
  })
}
</script>

<style scoped>
.test-invitation-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.test-header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 10px;
}

.test-header h1 {
  margin: 0 0 10px 0;
  font-size: 2em;
}

.test-header p {
  margin: 0;
  opacity: 0.9;
}

.test-controls {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #e9ecef;
}

.test-controls h3 {
  margin-top: 0;
  color: #495057;
}

.control-group {
  margin-bottom: 15px;
}

.control-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #495057;
}

.control-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.control-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.25);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(108, 117, 125, 0.4);
}

.test-info {
  background: #e3f2fd;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #bbdefb;
}

.test-info h3 {
  margin-top: 0;
  color: #1976d2;
}

.info-grid {
  display: grid;
  gap: 10px;
}

.info-grid > div {
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.info-grid strong {
  color: #1976d2;
}

.auth-warning {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
  text-align: center;
}

.auth-warning h3 {
  color: #856404;
  margin-top: 0;
}

.auth-warning p {
  color: #856404;
  margin-bottom: 15px;
}

.loading-state {
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
  text-align: center;
}

.loading-state h3 {
  color: #1976d2;
  margin-top: 0;
}

.loading-state p {
  color: #1976d2;
  margin-bottom: 0;
}
</style>
