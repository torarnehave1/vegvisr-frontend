<template>
  <div class="brand-users-page">
    <div class="page-header">
      <div class="d-flex align-items-center mb-3">
        <router-link to="/branding" class="btn btn-outline-secondary btn-sm me-3">
          <i class="fas fa-arrow-left"></i> Back to Branding
        </router-link>
        <h2 class="mb-0">
          <i class="fas fa-users text-primary me-2"></i>
          Manage Users: {{ domain }}
        </h2>
      </div>
      <p class="text-muted">
        Manage users and invitations for your branded domain. Users added here will see your branding in the mobile app.
      </p>
    </div>

    <!-- Add User Section -->
    <div class="card mb-4">
      <div class="card-header">
        <h5 class="mb-0">
          <i class="fas fa-user-plus me-2"></i>
          Add New User
        </h5>
      </div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label">Phone Number</label>
            <div class="input-group">
              <span class="input-group-text">+47</span>
              <input
                type="tel"
                class="form-control"
                v-model="newUser.phone"
                placeholder="12345678"
                maxlength="8"
                pattern="[0-9]{8}"
              />
            </div>
          </div>
          <div class="col-md-3">
            <label class="form-label">Role</label>
            <select v-model="newUser.role" class="form-select">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="col-md-3 d-flex align-items-end">
            <button
              class="btn btn-primary me-2"
              @click="addUser"
              :disabled="!isValidNewUser || isAddingUser"
            >
              <i v-if="isAddingUser" class="fas fa-spinner fa-spin me-1"></i>
              <i v-else class="fas fa-plus me-1"></i>
              Add User
            </button>
            <button
              class="btn btn-outline-success"
              @click="createInvite"
              :disabled="isCreatingInvite"
            >
              <i v-if="isCreatingInvite" class="fas fa-spinner fa-spin me-1"></i>
              <i v-else class="fas fa-link me-1"></i>
              Create Invite Link
            </button>
          </div>
        </div>
        <div v-if="userError" class="alert alert-danger mt-3 py-2">
          <i class="fas fa-exclamation-circle me-2"></i>
          {{ userError }}
        </div>
        <div v-if="userSuccess" class="alert alert-success mt-3 py-2">
          <i class="fas fa-check-circle me-2"></i>
          {{ userSuccess }}
        </div>
      </div>
    </div>

    <!-- Pending Invitations -->
    <div class="card mb-4">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">
          <i class="fas fa-envelope-open-text me-2"></i>
          Pending Invitations ({{ invites.length }})
        </h5>
        <button class="btn btn-sm btn-outline-secondary" @click="loadInvites" :disabled="isLoadingInvites">
          <i :class="isLoadingInvites ? 'fas fa-spinner fa-spin' : 'fas fa-sync'"></i>
        </button>
      </div>
      <div class="card-body">
        <div v-if="isLoadingInvites" class="text-center py-3">
          <i class="fas fa-spinner fa-spin me-2"></i> Loading invitations...
        </div>
        <div v-else-if="invites.length === 0" class="text-muted text-center py-3">
          <i class="fas fa-inbox me-2"></i> No pending invitations
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>Invite Code</th>
                <th>Role</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="invite in invites" :key="invite.code">
                <td>
                  <code>{{ invite.code }}</code>
                </td>
                <td>
                  <span :class="getRoleBadgeClass(invite.role)">{{ invite.role }}</span>
                </td>
                <td>{{ formatDate(invite.createdAt) }}</td>
                <td>{{ formatDate(invite.expiresAt) }}</td>
                <td>
                  <button
                    class="btn btn-sm btn-outline-primary me-1"
                    @click="copyInviteLink(invite.code)"
                    title="Copy invite link"
                  >
                    <i class="fas fa-copy"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-outline-danger"
                    @click="cancelInvite(invite.code)"
                    title="Cancel invitation"
                  >
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Current Users -->
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">
          <i class="fas fa-users me-2"></i>
          Current Users ({{ users.length }})
        </h5>
        <button class="btn btn-sm btn-outline-secondary" @click="loadUsers" :disabled="isLoadingUsers">
          <i :class="isLoadingUsers ? 'fas fa-spinner fa-spin' : 'fas fa-sync'"></i>
        </button>
      </div>
      <div class="card-body">
        <div v-if="isLoadingUsers" class="text-center py-3">
          <i class="fas fa-spinner fa-spin me-2"></i> Loading users...
        </div>
        <div v-else-if="users.length === 0" class="text-muted text-center py-3">
          <i class="fas fa-user-slash me-2"></i> No users yet. Add users above or share an invite link.
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.phone">
                <td>
                  <i class="fas fa-phone text-success me-2"></i>
                  {{ user.phone }}
                </td>
                <td>
                  <span :class="getRoleBadgeClass(user.role)">{{ user.role }}</span>
                </td>
                <td>
                  <span :class="getStatusBadgeClass(user.status)">{{ user.status }}</span>
                </td>
                <td>{{ formatDate(user.joinedAt || user.addedAt) }}</td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button
                      class="btn btn-outline-secondary dropdown-toggle"
                      type="button"
                      data-bs-toggle="dropdown"
                    >
                      <i class="fas fa-cog"></i>
                    </button>
                    <ul class="dropdown-menu">
                      <li>
                        <a class="dropdown-item" href="#" @click.prevent="updateUserRole(user, 'member')">
                          <i class="fas fa-user me-2"></i> Set as Member
                        </a>
                      </li>
                      <li>
                        <a class="dropdown-item" href="#" @click.prevent="updateUserRole(user, 'admin')">
                          <i class="fas fa-user-shield me-2"></i> Set as Admin
                        </a>
                      </li>
                      <li><hr class="dropdown-divider"></li>
                      <li>
                        <a class="dropdown-item text-danger" href="#" @click.prevent="removeUser(user)">
                          <i class="fas fa-trash me-2"></i> Remove User
                        </a>
                      </li>
                    </ul>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Invite Link Modal -->
    <div class="modal fade" id="inviteLinkModal" tabindex="-1" ref="inviteLinkModal">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="fas fa-link text-success me-2"></i>
              Invitation Link Created
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>Share this link to invite users to your brand:</p>
            <div class="input-group mb-3">
              <input type="text" class="form-control" :value="createdInviteUrl" readonly />
              <button class="btn btn-outline-primary" @click="copyCreatedInvite">
                <i class="fas fa-copy"></i> Copy
              </button>
            </div>
            <div class="mb-3">
              <label class="form-label">Deep Link (for mobile app):</label>
              <div class="input-group">
                <input type="text" class="form-control" :value="createdInviteDeepLink" readonly />
                <button class="btn btn-outline-primary" @click="copyCreatedDeepLink">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
            <div class="alert alert-info py-2">
              <i class="fas fa-info-circle me-2"></i>
              This invite expires in 7 days.
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { apiUrls } from '@/config/api'
import { Modal } from 'bootstrap'

export default {
  name: 'BrandUsersPage',
  props: {
    domain: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const userStore = useUserStore()

    // Users state
    const users = ref([])
    const isLoadingUsers = ref(false)

    // Invites state
    const invites = ref([])
    const isLoadingInvites = ref(false)

    // New user form
    const newUser = ref({
      phone: '',
      role: 'member'
    })
    const isAddingUser = ref(false)
    const userError = ref('')
    const userSuccess = ref('')

    // Invite creation
    const isCreatingInvite = ref(false)
    const createdInviteUrl = ref('')
    const createdInviteDeepLink = ref('')
    const inviteLinkModal = ref(null)
    let modalInstance = null

    // Computed
    const isValidNewUser = computed(() => {
      const digits = newUser.value.phone.replace(/\D/g, '')
      return digits.length === 8
    })

    // Load users
    const loadUsers = async () => {
      isLoadingUsers.value = true
      try {
        const response = await fetch(apiUrls.listBrandUsers(props.domain))
        if (response.ok) {
          const data = await response.json()
          users.value = data.users || []
        }
      } catch (error) {
        console.error('Error loading users:', error)
      } finally {
        isLoadingUsers.value = false
      }
    }

    // Load invites
    const loadInvites = async () => {
      isLoadingInvites.value = true
      try {
        const response = await fetch(apiUrls.listBrandInvites(props.domain))
        if (response.ok) {
          const data = await response.json()
          invites.value = data.invites || []
        }
      } catch (error) {
        console.error('Error loading invites:', error)
      } finally {
        isLoadingInvites.value = false
      }
    }

    // Add user
    const addUser = async () => {
      if (!isValidNewUser.value) return

      userError.value = ''
      userSuccess.value = ''
      isAddingUser.value = true

      try {
        const response = await fetch(apiUrls.addBrandUser(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: props.domain,
            phone: '+47' + newUser.value.phone.replace(/\D/g, ''),
            role: newUser.value.role,
            ownerEmail: userStore.email
          })
        })

        const data = await response.json()

        if (response.ok && data.success) {
          userSuccess.value = `User ${data.user.phone} added successfully`
          newUser.value.phone = ''
          await loadUsers()
        } else {
          userError.value = data.error || 'Failed to add user'
        }
      } catch (error) {
        userError.value = 'Network error. Please try again.'
        console.error('Error adding user:', error)
      } finally {
        isAddingUser.value = false
      }
    }

    // Create invite
    const createInvite = async () => {
      userError.value = ''
      isCreatingInvite.value = true

      try {
        const response = await fetch(apiUrls.createBrandInvite(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: props.domain,
            role: newUser.value.role || 'member',
            ownerEmail: userStore.email,
            expiresInDays: 7
          })
        })

        const data = await response.json()

        if (response.ok && data.success) {
          createdInviteUrl.value = data.inviteUrl
          createdInviteDeepLink.value = data.deepLink
          await loadInvites()

          // Show modal
          if (inviteLinkModal.value && !modalInstance) {
            modalInstance = new Modal(inviteLinkModal.value)
          }
          modalInstance?.show()
        } else {
          userError.value = data.error || 'Failed to create invite'
        }
      } catch (error) {
        userError.value = 'Network error. Please try again.'
        console.error('Error creating invite:', error)
      } finally {
        isCreatingInvite.value = false
      }
    }

    // Update user role
    const updateUserRole = async (user, newRole) => {
      try {
        const response = await fetch(apiUrls.updateBrandUser(user.phone), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: props.domain,
            role: newRole,
            ownerEmail: userStore.email
          })
        })

        if (response.ok) {
          await loadUsers()
        }
      } catch (error) {
        console.error('Error updating user:', error)
      }
    }

    // Remove user
    const removeUser = async (user) => {
      if (!confirm(`Remove ${user.phone} from this brand?`)) return

      try {
        const response = await fetch(apiUrls.deleteBrandUser(user.phone, props.domain), {
          method: 'DELETE'
        })

        if (response.ok) {
          await loadUsers()
        }
      } catch (error) {
        console.error('Error removing user:', error)
      }
    }

    // Cancel invite
    const cancelInvite = async (code) => {
      if (!confirm('Cancel this invitation?')) return

      try {
        const response = await fetch(apiUrls.deleteBrandInvite(code), {
          method: 'DELETE'
        })

        if (response.ok) {
          await loadInvites()
        }
      } catch (error) {
        console.error('Error cancelling invite:', error)
      }
    }

    // Copy functions
    const copyInviteLink = (code) => {
      const url = `https://vegvisr.org/join/${code}`
      navigator.clipboard.writeText(url)
      alert('Invite link copied!')
    }

    const copyCreatedInvite = () => {
      navigator.clipboard.writeText(createdInviteUrl.value)
    }

    const copyCreatedDeepLink = () => {
      navigator.clipboard.writeText(createdInviteDeepLink.value)
    }

    // Helper functions
    const formatDate = (dateStr) => {
      if (!dateStr) return '-'
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    }

    const getRoleBadgeClass = (role) => {
      const classes = {
        owner: 'badge bg-danger',
        admin: 'badge bg-warning text-dark',
        member: 'badge bg-primary'
      }
      return classes[role] || 'badge bg-secondary'
    }

    const getStatusBadgeClass = (status) => {
      const classes = {
        active: 'badge bg-success',
        pending: 'badge bg-warning text-dark',
        revoked: 'badge bg-danger'
      }
      return classes[status] || 'badge bg-secondary'
    }

    // Initialize
    onMounted(() => {
      loadUsers()
      loadInvites()
    })

    return {
      // State
      users,
      invites,
      newUser,
      isLoadingUsers,
      isLoadingInvites,
      isAddingUser,
      isCreatingInvite,
      userError,
      userSuccess,
      createdInviteUrl,
      createdInviteDeepLink,
      inviteLinkModal,

      // Computed
      isValidNewUser,

      // Methods
      loadUsers,
      loadInvites,
      addUser,
      createInvite,
      updateUserRole,
      removeUser,
      cancelInvite,
      copyInviteLink,
      copyCreatedInvite,
      copyCreatedDeepLink,
      formatDate,
      getRoleBadgeClass,
      getStatusBadgeClass
    }
  }
}
</script>

<style scoped>
.brand-users-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.card {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card-header {
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  padding: 1rem 1.25rem;
}

.card-header h5 {
  color: #495057;
}

.table th {
  font-weight: 600;
  color: #495057;
  border-top: none;
}

.badge {
  font-weight: 500;
  padding: 0.35em 0.65em;
}

code {
  background: #f8f9fa;
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.85em;
}

@media (max-width: 768px) {
  .brand-users-page {
    padding: 1rem;
  }

  .page-header h2 {
    font-size: 1.25rem;
  }
}
</style>
