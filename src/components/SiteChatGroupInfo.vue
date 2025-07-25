<template>
  <div class="group-info-panel">
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
            <button
              v-if="canManageMember(member)"
              class="action-btn"
              @click.stop="showMemberMenu(member)"
              title="More actions"
            >
              <i class="bi bi-three-dots"></i>
            </button>
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
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
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

// Load settings when component mounts
loadRoomSettings()

// Emits
const emit = defineEmits([
  'close',
  'notifications-changed',
  'edit-group',
  'invite-members',
  'leave-group',
])

// State
const notificationsEnabled = ref(true)

// Demo members data (matches Norwegian names from chat)
const members = ref([
  {
    id: 'user_1',
    name: 'Maiken Sneeggen',
    initials: 'MS',
    color: '#ff6b9d',
    avatar: null,
    role: 'owner',
    isOnline: false,
    lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 11), // 11 hours ago
  },
  {
    id: 'user_2',
    name: 'Tor Arne Håve',
    initials: 'TH',
    color: '#4ade80',
    avatar: null,
    role: 'admin',
    isOnline: true,
    lastSeen: new Date(),
  },
  {
    id: 'user_3',
    name: 'Siri Mægland',
    initials: 'SM',
    color: '#8b5cf6',
    avatar: null,
    role: 'member',
    isOnline: false,
    lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 9), // 9 hours ago
  },
  {
    id: 'user_4',
    name: 'Stine Oksvold',
    initials: 'SO',
    color: '#f59e0b',
    avatar: null,
    role: 'member',
    isOnline: false,
    lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 11), // 11 hours ago
  },
  {
    id: 'user_5',
    name: 'Håkon Steinbakk',
    initials: 'HS',
    color: '#06b6d4',
    avatar: null,
    role: 'member',
    isOnline: true,
    lastSeen: new Date(),
  },
  {
    id: 'user_6',
    name: 'Martin Blåse',
    initials: 'MB',
    color: '#84cc16',
    avatar: null,
    role: 'member',
    isOnline: false,
    lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
  },
])

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

const showMemberMenu = (member) => {
  console.log('Showing member menu for:', member.name)
  // TODO: Show member management menu
  alert(`Member management for ${member.name} will be implemented in next phase`)
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
</script>

<style scoped>
.group-info-panel {
  width: 340px;
  background: white;
  border-left: 1px solid #e5e7eb;
  height: 100vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
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

/* Responsive Design */
@media (max-width: 768px) {
  .group-info-panel {
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
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
