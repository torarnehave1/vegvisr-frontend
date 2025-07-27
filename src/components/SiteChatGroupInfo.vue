<template>
  <div class="group-info-panel" @click="closeAllMenus">
    <!-- Header -->
    <div class="group-info-header">
      <button class="close-btn" @click="$emit('close')" title="Close group info">
        <i class="bi bi-x-lg"></i>
      </button>
      <h3>Group Info</h3>
    </div>

    <!-- Group Profile Section -->
    <div class="group-profile">
      <!-- Group Avatar -->
      <div class="group-avatar">
        <div class="avatar-circle large" :style="{ backgroundColor: groupInfo.color }">
          <img
            v-if="groupInfo.avatar"
            :src="groupInfo.avatar"
            :alt="groupInfo.name"
            class="avatar-image"
            onerror="this.style.display='none'"
          />
          <i v-else :class="getGroupIcon(groupInfo.type)" class="group-icon"></i>
        </div>
      </div>

      <!-- Group Name and Members -->
      <div class="group-details">
        <h2 class="group-name">{{ groupInfo.name }}</h2>
        <p class="group-member-count">{{ groupInfo.memberCount }} members</p>
      </div>
    </div>

    <!-- Group Description -->
    <div class="group-section">
      <div class="section-header">
        <i class="bi bi-info-circle"></i>
        <span>Description</span>
      </div>
      <div class="group-description">
        <p v-if="groupInfo.description">{{ groupInfo.description }}</p>
        <p v-else class="description-empty">No description</p>
      </div>
    </div>

    <!-- Notifications Toggle -->
    <div class="group-section">
      <div class="setting-item">
        <div class="setting-info">
          <i class="bi bi-bell"></i>
          <span>Notifications</span>
        </div>
        <div class="toggle-switch">
          <input
            type="checkbox"
            :checked="notificationsEnabled"
            @change="toggleNotifications"
            id="notifications-toggle"
          />
          <label for="notifications-toggle" class="toggle-label"></label>
        </div>
      </div>
    </div>

    <!-- Display Name Section -->
    <div class="group-section">
      <div class="section-header">
        <i class="bi bi-person-badge"></i>
        <span>Your Display Name</span>
      </div>
      <div class="display-name-section">
        <div v-if="!editingDisplayName" class="display-name-view">
          <div class="current-name">
            <span class="name-text">{{ currentDisplayName }}</span>
            <span class="name-hint">{{
              currentDisplayName === userStore.email ? '(using email)' : '(custom name)'
            }}</span>
          </div>
          <button class="edit-name-btn" @click="startEditingDisplayName">
            <i class="bi bi-pencil"></i>
            Change
          </button>
        </div>

        <div v-else class="display-name-edit">
          <div class="edit-input-container">
            <input
              v-model="newDisplayName"
              @keydown.enter="saveDisplayName"
              @keydown.escape="cancelEditingDisplayName"
              ref="displayNameInput"
              class="display-name-input"
              :placeholder="userStore.email"
              maxlength="50"
            />
            <div class="char-count">{{ newDisplayName?.length || 0 }}/50</div>
          </div>
          <div class="edit-actions">
            <button class="save-btn" @click="saveDisplayName" :disabled="savingDisplayName">
              <i v-if="savingDisplayName" class="bi bi-clock"></i>
              <i v-else class="bi bi-check"></i>
              {{ savingDisplayName ? 'Saving...' : 'Save' }}
            </button>
            <button class="cancel-btn" @click="cancelEditingDisplayName">
              <i class="bi bi-x"></i>
              Cancel
            </button>
          </div>
          <div class="name-preview">
            <small>Preview: {{ newDisplayName || userStore.email }}</small>
          </div>
        </div>
      </div>
    </div>

    <!-- Shared Content -->
    <div class="group-section">
      <div class="section-header">
        <i class="bi bi-folder"></i>
        <span>Shared Content</span>
      </div>

      <div class="shared-content-grid">
        <div class="content-item">
          <i class="bi bi-mic-fill"></i>
          <div class="content-details">
            <span class="content-count">{{ sharedContent.audioFiles }}</span>
            <span class="content-label"
              >audio file{{ sharedContent.audioFiles !== 1 ? 's' : '' }}</span
            >
          </div>
        </div>

        <div class="content-item">
          <i class="bi bi-link-45deg"></i>
          <div class="content-details">
            <span class="content-count">{{ sharedContent.sharedLinks }}</span>
            <span class="content-label"
              >shared link{{ sharedContent.sharedLinks !== 1 ? 's' : '' }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- Members Section -->
    <div class="group-section">
      <div class="section-header">
        <i class="bi bi-people"></i>
        <span>{{ groupInfo.memberCount }} MEMBERS</span>
      </div>

      <div class="members-list">
        <div
          v-for="member in members"
          :key="member.id"
          class="member-item"
          @click="viewMemberProfile(member)"
        >
          <!-- Member Avatar -->
          <div class="member-avatar">
            <div class="avatar-circle" :style="{ backgroundColor: member.color }">
              <img
                v-if="member.avatar"
                :src="member.avatar"
                :alt="member.name"
                class="avatar-image"
                onerror="this.style.display='none'"
              />
              <span v-else class="avatar-initials">{{ member.initials }}</span>
            </div>
            <!-- Online status indicator -->
            <div v-if="member.isOnline" class="online-indicator" title="Online"></div>
          </div>

          <!-- Member Info -->
          <div class="member-info">
            <div class="member-header">
              <span class="member-name">{{ member.name }}</span>
              <span v-if="member.role === 'owner'" class="member-role owner">owner</span>
              <span v-else-if="member.role === 'admin'" class="member-role admin">admin</span>
            </div>
            <div class="member-status">
              <span v-if="member.isOnline" class="status-online">online</span>
              <span v-else class="status-last-seen">{{ formatLastSeen(member.lastSeen) }}</span>
            </div>
          </div>

          <!-- Member Actions -->
          <div class="member-actions">
            <div v-if="canManageMember(member)" class="member-menu-container">
              <button
                class="action-btn"
                @click.stop="toggleMemberMenu(member.id)"
                title="Member actions"
              >
                <i class="bi bi-three-dots"></i>
              </button>

              <!-- Member Action Menu -->
              <div v-if="activeMemberMenu === member.id" class="member-menu" @click.stop>
                <!-- Change Role -->
                <div class="menu-section" v-if="currentUserRole === 'owner'">
                  <div class="menu-header">Change Role</div>
                  <button
                    v-if="member.role !== 'moderator'"
                    class="menu-item"
                    @click="changeRole(member, 'moderator')"
                  >
                    <i class="bi bi-shield-check"></i>
                    Make Moderator
                  </button>
                  <button
                    v-if="member.role !== 'member'"
                    class="menu-item"
                    @click="changeRole(member, 'member')"
                  >
                    <i class="bi bi-person"></i>
                    Make Member
                  </button>
                  <button class="menu-item transfer-ownership" @click="transferOwnership(member)">
                    <i class="bi bi-crown"></i>
                    Transfer Ownership
                  </button>
                </div>

                <!-- Moderation Actions -->
                <div class="menu-section">
                  <div class="menu-header">Actions</div>
                  <button class="menu-item remove" @click="removeMember(member)">
                    <i class="bi bi-person-x"></i>
                    Remove from Room
                  </button>
                  <button class="menu-item ban" @click="banMember(member)">
                    <i class="bi bi-person-slash"></i>
                    Ban from Room
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Group Actions -->
    <div class="group-section" v-if="canManageGroup">
      <div class="section-header">
        <i class="bi bi-gear"></i>
        <span>Group Management</span>
      </div>

      <div class="group-actions">
        <button class="action-item" @click="editGroup">
          <i class="bi bi-pencil"></i>
          <span>Edit Group</span>
        </button>

        <button class="action-item" @click="inviteMembers">
          <i class="bi bi-person-plus"></i>
          <span>Add Members</span>
        </button>

        <button class="action-item danger" @click="leaveGroup">
          <i class="bi bi-box-arrow-right"></i>
          <span>Leave Group</span>
        </button>
      </div>
    </div>

    <!-- SuperAdmin Actions -->
    <div class="group-section" v-if="userStore.role === 'Superadmin'">
      <div class="section-header">
        <i class="bi bi-shield-exclamation"></i>
        <span>SuperAdmin Actions</span>
      </div>

      <div class="group-actions">
        <button class="action-item danger" @click="deleteRoom">
          <i class="bi bi-trash3"></i>
          <span>Delete Room</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { API_CONFIG } from '@/config/api'

// Props
const props = defineProps({
  groupInfo: {
    type: Object,
    required: true,
    default: () => ({
      name: 'Group Chat',
      type: 'group',
      memberCount: 0,
      description: '',
      color: '#3b82f6',
    }),
  },
  currentUserId: {
    type: String,
    default: 'current_user',
  },
})

// Composables
const userStore = useUserStore()

// Display Name State
const editingDisplayName = ref(false)
const newDisplayName = ref('')
const savingDisplayName = ref(false)
const roomSettings = ref({}) // Store room settings locally

// Computed Properties
const currentDisplayName = computed(() => {
  const userEmail = userStore.email
  if (!userEmail || !roomSettings.value.displayNames) return userEmail || ''
  return roomSettings.value.displayNames[userEmail] || userEmail
})

// Display Name Methods
const startEditingDisplayName = () => {
  editingDisplayName.value = true
  const currentName = currentDisplayName.value
  newDisplayName.value = currentName === userStore.email ? '' : currentName

  nextTick(() => {
    const input = document.querySelector('.display-name-input')
    if (input) input.focus()
  })
}

const cancelEditingDisplayName = () => {
  editingDisplayName.value = false
  newDisplayName.value = ''
}

const saveDisplayName = async () => {
  if (savingDisplayName.value) return

  const trimmedName = newDisplayName.value?.trim()
  const finalName = trimmedName || userStore.email

  if (finalName === currentDisplayName.value) {
    cancelEditingDisplayName()
    return
  }

  savingDisplayName.value = true

  try {
    await updateRoomDisplayName(finalName)
    editingDisplayName.value = false
    newDisplayName.value = ''
    console.log('✅ Display name updated:', finalName)

    // Emit event to parent to reconnect with new display name
    emit('display-name-changed', finalName)
  } catch (error) {
    console.error('❌ Failed to update display name:', error)
    alert('Failed to update display name. Please try again.')
  } finally {
    savingDisplayName.value = false
  }
}

const updateRoomDisplayName = async (displayName) => {
  const userEmail = userStore.email
  if (!userEmail) throw new Error('User email not available')

  // Initialize room settings if not exists
  if (!roomSettings.value.displayNames) {
    roomSettings.value = {
      displayNames: {},
      roomConfig: {
        allowNicknameChange: true,
        requireApprovalForNameChange: false,
        maxDisplayNameLength: 50,
        theme: 'default',
        language: 'en',
      },
      userPermissions: {},
      roomFeatures: {
        enableTypingIndicators: true,
        enableUserColors: true,
        enableEmojis: true,
        maxMessageLength: 2000,
      },
      metadata: {
        lastUpdated: new Date().toISOString(),
        updatedBy: userEmail,
        version: '1.0',
      },
    }
  }

  // Set display name (remove if same as email to save space)
  if (displayName === userEmail) {
    delete roomSettings.value.displayNames[userEmail]
  } else {
    roomSettings.value.displayNames[userEmail] = displayName
  }

  // Update permissions and metadata
  if (!roomSettings.value.userPermissions[userEmail]) {
    roomSettings.value.userPermissions[userEmail] = {
      canChangeNickname: true,
      canModerateRoom: false,
      joinedAt: new Date().toISOString(),
    }
  }
  roomSettings.value.userPermissions[userEmail].lastNameChange = new Date().toISOString()
  roomSettings.value.metadata.lastUpdated = new Date().toISOString()
  roomSettings.value.metadata.updatedBy = userEmail

  // API call to update room settings
  const response = await fetch(
    `${API_CONFIG.baseUrl}/api/chat-rooms/${props.groupInfo.id}/settings`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_settings: roomSettings.value }),
    },
  )

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(result.error || 'Failed to update room settings')
  }
}

// Load room settings on component mount
const loadRoomSettings = async () => {
  try {
    const response = await fetch(
      `${API_CONFIG.baseUrl}/api/chat-rooms/${props.groupInfo.id}/settings`,
    )
    if (response.ok) {
      const data = await response.json()
      if (data.success && data.room_settings) {
        roomSettings.value = data.room_settings
      }
    }
  } catch (error) {
    console.error('Error loading room settings:', error)
  }
}

// Load settings and members when component mounts
loadRoomSettings()

// Load real members from database
onMounted(() => {
  loadMembers()
})

// Emits
const emit = defineEmits([
  'close',
  'notifications-changed',
  'edit-group',
  'invite-members',
  'leave-group',
  'display-name-changed',
  'delete-room',
  'members-loaded',
])

// State
const notificationsEnabled = ref(true)
const members = ref([])
const membersLoading = ref(false)
const membersError = ref(null)
const activeMemberMenu = ref(null)
const managementLoading = ref(false)

// Load real members from database
const loadMembers = async () => {
  if (!props.groupInfo?.id) return

  membersLoading.value = true
  membersError.value = null

  try {
    console.log('🔍 Loading members for room:', props.groupInfo.id)
    const response = await fetch(
      `${API_CONFIG.baseUrl}/api/chat-rooms/${props.groupInfo.id}/members`,
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (data.success) {
      members.value = data.members || []
      console.log('✅ Loaded', members.value.length, 'members:', members.value)

      // Update parent component with real member count
      emit('members-loaded', {
        memberCount: data.memberCount,
        members: data.members,
      })
    } else {
      throw new Error(data.error || 'Failed to load members')
    }
  } catch (error) {
    console.error('❌ Error loading members:', error)
    membersError.value = error.message
    members.value = [] // Clear members on error
  } finally {
    membersLoading.value = false
  }
}

// Shared content data
const sharedContent = ref({
  audioFiles: 1,
  sharedLinks: 1,
})

// Computed properties
const canManageGroup = computed(() => {
  const currentMember = members.value.find((m) => m.id === props.currentUserId)
  return currentMember && (currentMember.role === 'owner' || currentMember.role === 'admin')
})

const currentUserRole = computed(() => {
  const currentMember = members.value.find((m) => m.id === props.currentUserId)
  return currentMember?.role || null
})

// Methods
const getGroupIcon = (type) => {
  return type === 'group' ? 'bi bi-people-fill' : 'bi bi-megaphone-fill'
}

const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return 'unknown'

  const now = new Date()
  const diff = now - lastSeen
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `last seen ${minutes}m ago`
  if (hours < 24) return `last seen ${hours} hour${hours !== 1 ? 's' : ''} ago`
  if (days < 7) return `last seen ${days} day${days !== 1 ? 's' : ''} ago`

  return `last seen ${lastSeen.toLocaleDateString()}`
}

const canManageMember = (member) => {
  if (member.id === props.currentUserId) return false

  const currentMember = members.value.find((m) => m.id === props.currentUserId)
  if (!currentMember) return false

  // Owner can manage everyone, admin can manage regular members
  if (currentMember.role === 'owner') return true
  if (currentMember.role === 'admin' && member.role === 'member') return true

  return false
}

const toggleNotifications = () => {
  notificationsEnabled.value = !notificationsEnabled.value
  emit('notifications-changed', notificationsEnabled.value)
  console.log('Notifications toggled:', notificationsEnabled.value)
}

const viewMemberProfile = (member) => {
  console.log('Viewing member profile:', member.name)
  // TODO: Implement member profile view
}

// Member menu management
const toggleMemberMenu = (memberId) => {
  if (activeMemberMenu.value === memberId) {
    activeMemberMenu.value = null
  } else {
    activeMemberMenu.value = memberId
  }
}

// Close member menu when clicking outside
const closeAllMenus = () => {
  activeMemberMenu.value = null
}

// Member management functions
const removeMember = async (member) => {
  if (managementLoading.value) return

  const reason = prompt(`Why are you removing ${member.name}?`, 'Removed by room owner')
  if (reason === null) return // User cancelled

  if (!confirm(`Are you sure you want to remove ${member.name} from this room?`)) {
    return
  }

  managementLoading.value = true
  activeMemberMenu.value = null

  try {
    console.log('🔍 Removing member:', member.name)
    const response = await fetch(
      `${API_CONFIG.baseUrl}/api/chat-rooms/${props.groupInfo.id}/members/${member.id}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          removed_by: props.currentUserId,
          reason: reason,
        }),
      },
    )

    const data = await response.json()

    if (data.success) {
      console.log('✅ Member removed successfully')
      // Remove from local member list
      members.value = members.value.filter((m) => m.id !== member.id)
      // Update member count
      emit('members-loaded', {
        memberCount: members.value.length,
        members: members.value,
      })
      alert(`${member.name} has been removed from the room.`)
    } else {
      throw new Error(data.error || 'Failed to remove member')
    }
  } catch (error) {
    console.error('❌ Error removing member:', error)
    alert(`Failed to remove member: ${error.message}`)
  } finally {
    managementLoading.value = false
  }
}

const banMember = async (member) => {
  if (managementLoading.value) return

  const reason = prompt(`Why are you banning ${member.name}?`, 'Banned for violating room rules')
  if (reason === null) return // User cancelled

  if (
    !confirm(
      `Are you sure you want to BAN ${member.name} from this room?\n\nThis will prevent them from rejoining.`,
    )
  ) {
    return
  }

  managementLoading.value = true
  activeMemberMenu.value = null

  try {
    console.log('🔍 Banning member:', member.name)
    const response = await fetch(`${API_CONFIG.baseUrl}/api/chat-rooms/${props.groupInfo.id}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: member.id,
        banned_by: props.currentUserId,
        reason: reason,
      }),
    })

    const data = await response.json()

    if (data.success) {
      console.log('✅ Member banned successfully')
      // Remove from local member list
      members.value = members.value.filter((m) => m.id !== member.id)
      // Update member count
      emit('members-loaded', {
        memberCount: members.value.length,
        members: members.value,
      })
      alert(`${member.name} has been banned from the room.`)
    } else {
      throw new Error(data.error || 'Failed to ban member')
    }
  } catch (error) {
    console.error('❌ Error banning member:', error)
    alert(`Failed to ban member: ${error.message}`)
  } finally {
    managementLoading.value = false
  }
}

const changeRole = async (member, newRole) => {
  if (managementLoading.value) return

  const roleNames = { owner: 'Owner', moderator: 'Moderator', member: 'Member' }

  if (!confirm(`Change ${member.name}'s role to ${roleNames[newRole]}?`)) {
    return
  }

  managementLoading.value = true
  activeMemberMenu.value = null

  try {
    console.log('🔍 Changing member role:', member.name, 'to', newRole)
    const response = await fetch(
      `${API_CONFIG.baseUrl}/api/chat-rooms/${props.groupInfo.id}/members/${member.id}/role`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_role: newRole,
          changed_by: props.currentUserId,
        }),
      },
    )

    const data = await response.json()

    if (data.success) {
      console.log('✅ Member role changed successfully')
      // Update local member role
      const memberIndex = members.value.findIndex((m) => m.id === member.id)
      if (memberIndex !== -1) {
        members.value[memberIndex].role = newRole
      }

      // If transferring ownership, refresh member list to update current user's role
      if (newRole === 'owner') {
        await loadMembers() // Reload to get updated roles
      }

      alert(`${member.name} is now a ${roleNames[newRole]}.`)
    } else {
      throw new Error(data.error || 'Failed to change role')
    }
  } catch (error) {
    console.error('❌ Error changing role:', error)
    alert(`Failed to change role: ${error.message}`)
  } finally {
    managementLoading.value = false
  }
}

const transferOwnership = async (member) => {
  if (managementLoading.value) return

  if (
    !confirm(
      `⚠️ TRANSFER OWNERSHIP to ${member.name}?\n\nYou will become a regular member and lose owner privileges. This cannot be undone unless the new owner transfers it back.`,
    )
  ) {
    return
  }

  // Double confirmation for ownership transfer
  if (!confirm('Are you absolutely sure? This is a permanent change.')) {
    return
  }

  await changeRole(member, 'owner')
}

const editGroup = () => {
  console.log('Editing group')
  emit('edit-group')
  alert('Group editing will be implemented in next phase')
}

const inviteMembers = () => {
  console.log('Inviting members')
  emit('invite-members')
  alert('Member invitation will be implemented in next phase')
}

const leaveGroup = () => {
  if (confirm('Are you sure you want to leave this group?')) {
    console.log('Leaving group')
    emit('leave-group')
    alert('Leave group functionality will be implemented in next phase')
  }
}

const deleteRoom = () => {
  emit('delete-room')
}
</script>

<style scoped>
.group-info-panel {
  width: 340px;
  background: white;
  border-left: 1px solid #e5e7eb;
  height: calc(100vh - 10px); /* Small buffer to prevent viewport issues */
  max-height: 100vh;
  overflow-y: scroll !important; /* Force scrolling */
  overflow-x: hidden;
  display: block; /* Changed from flex to block for better scroll behavior */
  position: relative;
  /* Ensure bottom content is accessible */
  padding-bottom: 20px;
  /* Temporary debug - remove after testing */
  border: 2px solid red;
  box-sizing: border-box;
}

/* Header */
.group-info-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  position: sticky;
  top: 0;
  z-index: 10;
}

.close-btn {
  background: none;
  border: none;
  color: #6b7280;
  padding: 8px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.group-info-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: #1f2937;
}

/* Group Profile */
.group-profile {
  padding: 24px 20px;
  text-align: center;
  border-bottom: 1px solid #e5e7eb;
}

.group-avatar {
  margin-bottom: 16px;
}

.avatar-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
  font-weight: 500;
  position: relative;
}

.avatar-circle.large {
  width: 80px;
  height: 80px;
  font-size: 24px;
  margin: 0 auto;
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.group-icon {
  font-size: 24px;
}

.group-name {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  word-break: break-word;
}

.group-member-count {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

/* Sections */
.group-section {
  border-bottom: 1px solid #e5e7eb;
  padding: 20px;
}

.group-section:last-child {
  border-bottom: none;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-header i {
  font-size: 14px;
}

/* Description */
.group-description p {
  margin: 0;
  font-size: 14px;
  color: #374151;
  line-height: 1.5;
}

.description-empty {
  color: #9ca3af;
  font-style: italic;
}

/* Settings */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #374151;
}

.setting-info i {
  color: #6b7280;
  font-size: 16px;
  width: 20px;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
}

.toggle-switch input[type='checkbox'] {
  opacity: 0;
  position: absolute;
  width: 0;
  height: 0;
}

.toggle-label {
  display: block;
  width: 44px;
  height: 24px;
  background: #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  position: relative;
  transition: background 0.3s ease;
}

.toggle-label::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  top: 2px;
  left: 2px;
  transition: transform 0.3s ease;
}

input[type='checkbox']:checked + .toggle-label {
  background: #3b82f6;
}

input[type='checkbox']:checked + .toggle-label::before {
  transform: translateX(20px);
}

/* Shared Content */
.shared-content-grid {
  display: flex;
  gap: 16px;
}

.content-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  flex: 1;
}

.content-item:hover {
  background: #f3f4f6;
}

.content-item i {
  color: #6b7280;
  font-size: 18px;
}

.content-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.content-count {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.content-label {
  font-size: 12px;
  color: #6b7280;
}

/* Members List */
.members-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-radius: 8px;
  position: relative;
}

.member-item:hover {
  background: #f9fafb;
  padding-left: 8px;
  padding-right: 8px;
}

.member-avatar {
  position: relative;
  flex-shrink: 0;
}

.avatar-initials {
  font-size: 14px;
  font-weight: 600;
}

.online-indicator {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 12px;
  height: 12px;
  background: #10b981;
  border: 2px solid white;
  border-radius: 50%;
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-role {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.member-role.owner {
  background: #fef3c7;
  color: #d97706;
}

.member-role.admin {
  background: #dbeafe;
  color: #2563eb;
}

.member-status {
  font-size: 12px;
}

.status-online {
  color: #10b981;
  font-weight: 500;
}

.status-last-seen {
  color: #9ca3af;
}

.member-actions {
  flex-shrink: 0;
}

.action-btn {
  background: none;
  border: none;
  color: #9ca3af;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;
}

.member-item:hover .action-btn {
  opacity: 1;
}

/* Member Menu Dropdown */
.member-menu-container {
  position: relative;
}

.member-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  min-width: 180px;
  padding: 8px 0;
}

.menu-section {
  padding: 4px 0;
}

.menu-section + .menu-section {
  border-top: 1px solid #f3f4f6;
  margin-top: 4px;
  padding-top: 8px;
}

.menu-header {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 12px;
  margin-bottom: 4px;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: none;
  border: none;
  text-align: left;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  transition: background-color 0.15s;
}

.menu-item:hover {
  background-color: #f9fafb;
}

.menu-item i {
  font-size: 14px;
  width: 16px;
  text-align: center;
}

.menu-item.remove {
  color: #dc2626;
}

.menu-item.remove:hover {
  background-color: #fef2f2;
}

.menu-item.ban {
  color: #b91c1c;
}

.menu-item.ban:hover {
  background-color: #fef2f2;
}

.menu-item.transfer-ownership {
  color: #d97706;
}

.menu-item.transfer-ownership:hover {
  background-color: #fffbeb;
}

.action-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* Group Actions */
.group-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-size: 14px;
  color: #374151;
  text-align: left;
  width: 100%;
}

.action-item:hover {
  background: #f9fafb;
}

.action-item.danger {
  color: #dc2626;
}

.action-item.danger:hover {
  background: #fef2f2;
}

.action-item i {
  color: #6b7280;
  font-size: 16px;
  width: 20px;
}

.action-item.danger i {
  color: #dc2626;
}

/* SuperAdmin Actions */
.action-item.superadmin {
  color: #dc2626; /* Red color for SuperAdmin actions */
}

.action-item.superadmin:hover {
  background: #fef2f2; /* Light red background for SuperAdmin actions */
}

.action-item.superadmin i {
  color: #dc2626; /* Red color for SuperAdmin actions */
}

/* SuperAdmin Actions - Enhanced visibility */
.group-section:last-child {
  margin-bottom: 60px !important; /* Much more space at bottom */
  /* Temporary debug - remove after testing */
  border: 2px solid blue;
  background: yellow !important;
}

/* Force scroll recognition of all content */
.group-info-panel::after {
  content: '';
  display: block;
  height: 50px; /* Extra invisible space to ensure scrolling works */
  width: 100%;
}

/* Scrollbar Styling */
.group-info-panel::-webkit-scrollbar {
  width: 6px;
}

.group-info-panel::-webkit-scrollbar-track {
  background: transparent;
}

.group-info-panel::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 3px;
}

.group-info-panel::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}

/* Force scroll container to recognize all content */
.group-info-panel > :last-child {
  padding-bottom: 20px;
}

/* Fix responsive issues that might prevent scrolling */
@media (max-width: 768px) {
  .group-info-panel {
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
    height: 100vh; /* Full height on mobile */
    padding-bottom: 40px; /* More padding on mobile */
  }

  .shared-content-grid {
    flex-direction: column;
  }
}

/* Display Name Styles */
.display-name-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.display-name-view {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.current-name {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name-text {
  font-size: 16px;
  font-weight: 500;
  color: #1f2937;
}

.name-hint {
  font-size: 12px;
  color: #6b7280;
}

.edit-name-btn {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.edit-name-btn:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.display-name-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.edit-input-container {
  position: relative;
}

.display-name-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.display-name-input:focus {
  border-color: #3b82f6;
}

.char-count {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: #9ca3af;
  background: white;
  padding: 0 4px;
}

.edit-actions {
  display: flex;
  gap: 8px;
}

.save-btn {
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.save-btn:hover:not(:disabled) {
  background: #2563eb;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 16px;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.cancel-btn:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.name-preview {
  font-size: 12px;
  color: #6b7280;
  text-align: center;
  padding: 8px;
  background: #f9fafb;
  border-radius: 6px;
}
</style>
