<template>
  <div class="site-chat-view">
    <!-- Telegram-style Layout -->
    <div class="telegram-container">
      <!-- Left Panel - Chat List -->
      <div class="chat-list-panel">
        <!-- Chat List Header -->
        <div class="chat-list-header">
          <!-- Hamburger Menu Button -->
          <button
            class="hamburger-button"
            @click="toggleSidebar"
            :class="{ active: showSidebar }"
            aria-label="Toggle menu"
          >
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
          </button>

          <!-- Search -->
          <div class="search-container">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search rooms"
              class="search-input"
            />
            <button class="create-room-btn" @click="createNewGroup" title="Create new room">
              <i class="bi bi-plus"></i>
            </button>
          </div>
        </div>

        <!-- Chat List -->
        <div class="chats-list">
          <!-- Demo Chats (placeholder data) -->
          <div
            v-for="chat in filteredChats"
            :key="chat.id"
            @click="selectChat(chat.id)"
            class="chat-item"
            :class="{ active: selectedChatId === chat.id, unread: chat.unreadCount > 0 }"
          >
            <div class="chat-avatar">
              <div class="avatar-circle" :style="{ backgroundColor: chat.color }">
                <i :class="getChatIcon(chat.type)"></i>
              </div>
            </div>
            <div class="chat-info">
              <div class="chat-header-row">
                <h6 class="chat-title">{{ chat.name }}</h6>
                <span class="chat-time">{{ formatChatTime(chat.lastActivity) }}</span>
              </div>
              <div class="chat-preview-row">
                <p class="chat-preview">{{ chat.lastMessage || chat.description }}</p>
                <span v-if="chat.unreadCount" class="unread-badge">{{ chat.unreadCount }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Middle Panel - Chat Messages -->
      <div class="chat-messages-panel" v-if="selectedChatId">
        <!-- Chat Header -->
        <div class="chat-header-bar">
          <!-- Mobile Menu Button (only on mobile) -->
          <button class="mobile-menu-btn" @click="toggleMobileChatList" title="Show chat list">
            <i class="bi bi-list"></i>
          </button>

          <div class="chat-info-section">
            <div class="chat-avatar-small">
              <div class="avatar-circle-small" :style="{ backgroundColor: selectedChat?.color }">
                <i :class="getChatIcon(selectedChat?.type)"></i>
              </div>
            </div>
            <div class="chat-details">
              <h5>{{ selectedChat?.name }}</h5>
              <small>
                Room: {{ selectedChat?.id }} • {{ selectedChat?.memberCount }} members
                <button
                  class="copy-room-id-btn"
                  @click="copyRoomId"
                  title="Copy room URL"
                  v-if="selectedChat"
                >
                  <i class="bi bi-link-45deg"></i>
                </button>
              </small>
            </div>
          </div>

          <!-- Group Info Toggle Button -->
          <button
            class="group-info-toggle"
            @click="toggleGroupInfo"
            :class="{ active: showGroupInfo }"
            title="Group info"
          >
            <i class="bi bi-info-circle"></i>
          </button>
        </div>

        <!-- Chat Messages Component -->
        <SiteChatMessagesView
          :chatId="selectedChatId"
          :chatInfo="selectedChat"
          @message-sent="handleMessageSent"
          @show-group-info="showGroupInfo = true"
        />
      </div>

      <!-- Empty State Panel -->
      <div v-else class="chat-empty-state-panel">
        <div class="empty-content">
          <i class="bi bi-chat-dots empty-icon"></i>
          <h4>Select a chat to start messaging</h4>
          <p class="text-muted">Choose from your existing conversations or create a new one</p>
        </div>
      </div>

      <!-- Right Panel - Group Info -->
      <div v-if="showGroupInfo && selectedChat" class="group-info-panel-wrapper">
        <SiteChatGroupInfo
          :groupInfo="selectedChat"
          :currentUserId="userStore.user_id"
          @close="showGroupInfo = false"
          @notifications-changed="handleNotificationsChanged"
          @edit-group="handleEditGroup"
          @invite-members="handleInviteMembers"
          @leave-group="handleLeaveGroup"
        />
      </div>
    </div>

    <!-- Telegram-style Left Sidebar Overlay -->
    <div v-if="showSidebar" class="sidebar-overlay" @click="closeSidebar">
      <div class="sidebar-content" @click.stop>
        <!-- User Profile Section -->
        <div class="profile-section">
          <div class="profile-info">
            <div class="profile-avatar">
              <img
                :src="
                  currentLogo ||
                  userStore.profileImage ||
                  'https://vegvisr.imgix.net/vegvisr-logo.png'
                "
                :alt="userStore.user_name || 'User'"
                class="profile-image"
                onerror="this.src='https://vegvisr.imgix.net/vegvisr-logo.png'"
              />
            </div>
            <div class="profile-details">
              <h5 class="profile-name">{{ userStore.user_name || currentSiteTitle }}</h5>
              <p class="profile-status">{{ currentDomain || 'vegvisr.org' }}</p>
            </div>
          </div>
          <button class="profile-settings-btn" @click="openSettings">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
        </div>

        <!-- Menu Items -->
        <div class="menu-section">
          <div class="menu-item" @click="openMyProfile">
            <i class="bi bi-person menu-icon"></i>
            <span>My Profile</span>
          </div>

          <div class="menu-item" @click="createNewGroup">
            <i class="bi bi-people-fill menu-icon"></i>
            <span>New Group</span>
            <small class="menu-description">KnowledgeGraph Discussion</small>
          </div>

          <div class="menu-item" @click="createNewChannel">
            <i class="bi bi-megaphone-fill menu-icon"></i>
            <span>New Channel</span>
            <small class="menu-description">Domain Community</small>
          </div>

          <div class="menu-item" @click="openContacts">
            <i class="bi bi-person-lines-fill menu-icon"></i>
            <span>Contacts</span>
          </div>

          <div class="menu-item" @click="openCalls">
            <i class="bi bi-telephone-fill menu-icon"></i>
            <span>Calls</span>
          </div>

          <div class="menu-item" @click="openSavedMessages">
            <i class="bi bi-bookmark-fill menu-icon"></i>
            <span>Saved Messages</span>
          </div>

          <div class="menu-item" @click="openSettings">
            <i class="bi bi-gear-fill menu-icon"></i>
            <span>Settings</span>
          </div>

          <div class="menu-item" @click="toggleNightMode">
            <i class="bi bi-moon-fill menu-icon"></i>
            <span>Night Mode</span>
            <div class="toggle-switch">
              <input type="checkbox" :checked="nightMode" @change="toggleNightMode" />
            </div>
          </div>
        </div>

        <!-- Version Info -->
        <div class="version-info">
          <p>{{ currentSiteTitle }} Chat</p>
          <small>Version 1.0.0 – About</small>
        </div>
      </div>
    </div>

    <!-- Create Group/Channel Modal -->
    <div
      v-if="showCreateModal"
      class="modal fade show"
      style="display: block; background: rgba(0, 0, 0, 0.5)"
      @click="closeCreateModal"
    >
      <div class="modal-dialog" @click.stop>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              {{ createType === 'group' ? 'Create New Group' : 'Create New Channel' }}
            </h5>
            <small class="text-muted">
              {{ createType === 'group' ? 'KnowledgeGraph Discussion' : 'Domain Community' }}
            </small>
            <button @click="closeCreateModal" class="btn-close"></button>
          </div>

          <div class="modal-body">
            <!-- Room Creation Form -->
            <div class="mb-3">
              <label class="form-label">
                {{ createType === 'group' ? 'Group' : 'Channel' }} Name:
              </label>
              <input
                v-model="newRoomData.name"
                type="text"
                class="form-control"
                :placeholder="
                  createType === 'group' ? 'Knowledge Graph Discussion' : 'General Discussion'
                "
              />
            </div>

            <div class="mb-3">
              <label class="form-label">Description:</label>
              <textarea
                v-model="newRoomData.description"
                class="form-control"
                rows="3"
                :placeholder="getDescriptionPlaceholder()"
              ></textarea>
            </div>

            <div v-if="createType === 'group'" class="mb-3">
              <label class="form-label">KnowledgeGraph ID (Optional):</label>
              <input
                v-model="newRoomData.graphId"
                type="text"
                class="form-control"
                placeholder="Link to specific knowledge graph"
              />
            </div>

            <!-- Preview -->
            <div class="room-preview">
              <h6>Preview:</h6>
              <div class="preview-chat-item">
                <div class="chat-avatar">
                  <div class="avatar-circle" :style="{ backgroundColor: getPreviewColor() }">
                    <i
                      :class="createType === 'group' ? 'bi bi-people-fill' : 'bi bi-megaphone-fill'"
                    ></i>
                  </div>
                </div>
                <div class="chat-info">
                  <h6>
                    {{
                      newRoomData.name || (createType === 'group' ? 'Group Name' : 'Channel Name')
                    }}
                  </h6>
                  <small>{{ newRoomData.description || 'Description...' }}</small>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button @click="closeCreateModal" class="btn btn-secondary">Cancel</button>
            <button
              @click="createRoom"
              class="btn btn-primary"
              :disabled="!newRoomData.name.trim()"
            >
              <i class="bi bi-plus-circle"></i>
              Create {{ createType === 'group' ? 'Group' : 'Channel' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useBranding } from '@/composables/useBranding'
import SiteChatMessagesView from '@/components/SiteChatMessagesView.vue'
import SiteChatGroupInfo from '@/components/SiteChatGroupInfo.vue'

// Props
const props = defineProps({
  domain: {
    type: String,
    default: null,
  },
})

// Composables
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const { currentDomain, currentLogo, currentSiteTitle, currentTheme } = useBranding()

// State
const loading = ref(false)
const showSidebar = ref(false)
const showCreateModal = ref(false)
const showGroupInfo = ref(false)
const createType = ref('group') // 'group' or 'channel'
const selectedChatId = ref(null)
const searchQuery = ref('')
const nightMode = ref(false)

const newRoomData = ref({
  name: '',
  description: '',
  graphId: '', // For groups linked to knowledge graphs
})

// Room management with localStorage persistence
const rooms = ref([])

// Default rooms (created if none exist)
const defaultRooms = [
  {
    id: 'general',
    name: 'General Discussion',
    description: 'Welcome to the general chat room',
    type: 'channel',
    color: '#3b82f6',
    memberCount: 0,
    unreadCount: 0,
    lastMessage: 'Welcome to the chat!',
    lastActivity: new Date(),
  },
  {
    id: 'demo-room',
    name: 'Demo Room',
    description: 'Try out the real-time messaging features',
    type: 'group',
    color: '#4ade80',
    memberCount: 0,
    unreadCount: 0,
    lastMessage: 'This is a demo room for testing',
    lastActivity: new Date(),
  },
]

// Computed properties
const canCreateRooms = computed(() => {
  return userStore.role === 'Superadmin' || userStore.role === 'Admin'
})

const userRole = computed(() => {
  return userStore.role || 'User'
})

const filteredChats = computed(() => {
  if (!searchQuery.value.trim()) return rooms.value

  const query = searchQuery.value.toLowerCase()
  return rooms.value.filter(
    (chat) =>
      chat.name.toLowerCase().includes(query) || chat.description.toLowerCase().includes(query),
  )
})

const selectedChat = computed(() => {
  return rooms.value.find((chat) => chat.id === selectedChatId.value)
})

// Methods

// Room Management with localStorage
const loadRoomsFromStorage = () => {
  try {
    const savedRooms = localStorage.getItem('vegvisr-chat-rooms')
    if (savedRooms) {
      const parsedRooms = JSON.parse(savedRooms)
      // Convert date strings back to Date objects
      rooms.value = parsedRooms.map((room) => ({
        ...room,
        lastActivity: new Date(room.lastActivity),
      }))
      console.log('📂 Loaded rooms from localStorage:', rooms.value.length)
    } else {
      // First time - use default rooms
      rooms.value = [...defaultRooms]
      saveRoomsToStorage()
      console.log('🆕 Created default rooms')
    }
  } catch (error) {
    console.error('Error loading rooms from storage:', error)
    rooms.value = [...defaultRooms]
  }
}

const saveRoomsToStorage = () => {
  try {
    localStorage.setItem('vegvisr-chat-rooms', JSON.stringify(rooms.value))
    console.log('💾 Saved rooms to localStorage')
  } catch (error) {
    console.error('Error saving rooms to storage:', error)
  }
}

const addNewRoom = (roomData) => {
  const newRoom = {
    id: `room_${Date.now()}`, // Simple room ID generation
    name: roomData.name,
    description: roomData.description || '',
    type: roomData.type || 'group',
    color: generateRandomColor(),
    memberCount: 1, // Creator is first member
    unreadCount: 0,
    lastMessage: `${roomData.type === 'group' ? 'Group' : 'Channel'} created`,
    lastActivity: new Date(),
    graphId: roomData.graphId || null,
  }

  rooms.value.unshift(newRoom) // Add to beginning of list
  saveRoomsToStorage()

  console.log('🆕 Created new room:', newRoom)
  return newRoom
}

const generateRandomColor = () => {
  const colors = [
    '#4ade80',
    '#3b82f6',
    '#8b5cf6',
    '#f59e0b',
    '#ef4444',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#ec4899',
    '#10b981',
    '#6366f1',
    '#14b8a6',
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

const updateRoomActivity = (roomId, message) => {
  const room = rooms.value.find((r) => r.id === roomId)
  if (room) {
    room.lastMessage = message
    room.lastActivity = new Date()
    saveRoomsToStorage()
  }
}

// URL Parameter Handling
const handleUrlRoom = () => {
  const roomFromUrl = route.query.room
  if (roomFromUrl) {
    console.log('🔗 Room from URL:', roomFromUrl)

    // Check if room exists
    let existingRoom = rooms.value.find((r) => r.id === roomFromUrl)

    // If room doesn't exist, create it
    if (!existingRoom) {
      console.log('Creating room from URL:', roomFromUrl)
      existingRoom = addNewRoom({
        name: roomFromUrl.charAt(0).toUpperCase() + roomFromUrl.slice(1).replace(/[-_]/g, ' '),
        description: `Chat room: ${roomFromUrl}`,
        type: 'group',
      })
      // Update the room ID to match URL (for consistency)
      existingRoom.id = roomFromUrl
      saveRoomsToStorage()
    }

    // Select the room
    selectedChatId.value = roomFromUrl
    console.log('🎯 Auto-selected room from URL:', roomFromUrl)
  } else {
    // Default to general room if no URL param
    selectedChatId.value = 'general'
  }
}

// Sidebar Management
const toggleSidebar = () => {
  showSidebar.value = !showSidebar.value
  console.log('🍔 Sidebar toggled:', showSidebar.value)

  // Prevent body scroll when sidebar is open
  if (showSidebar.value) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
}

const closeSidebar = () => {
  showSidebar.value = false
  document.body.style.overflow = ''
}

// Chat Management
const selectChat = (chatId) => {
  // Clear group info when selecting a different chat
  if (selectedChatId.value !== chatId) {
    showGroupInfo.value = false
  }

  selectedChatId.value = chatId
  console.log('🎯 Selected chat:', chatId, selectedChat.value)

  // Update URL to reflect selected room
  router.replace({ query: { room: chatId } })

  // Clear unread count for selected chat
  const chat = rooms.value.find((c) => c.id === chatId)
  if (chat && chat.unreadCount > 0) {
    chat.unreadCount = 0
    saveRoomsToStorage()
  }
}

const getChatIcon = (chatType) => {
  return chatType === 'group' ? 'bi bi-people-fill' : 'bi bi-megaphone-fill'
}

const formatChatTime = (date) => {
  if (!date) return ''

  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`

  return date.toLocaleDateString()
}

// Sidebar Menu Actions
const openMyProfile = () => {
  closeSidebar()
  router.push('/user')
  console.log('Opening profile')
}

const createNewGroup = () => {
  closeSidebar()
  createType.value = 'group'
  showCreateModal.value = true
  console.log('Creating new group (KnowledgeGraph discussion)')
}

const createNewChannel = () => {
  closeSidebar()
  createType.value = 'channel'
  showCreateModal.value = true
  console.log('Creating new channel (Domain community)')
}

const openContacts = () => {
  closeSidebar()
  console.log('Opening contacts (coming soon)')
  alert('Contacts feature will be implemented in next phase')
}

const openCalls = () => {
  closeSidebar()
  console.log('Opening calls (coming soon)')
  alert('Calls feature will be implemented in next phase')
}

const openSavedMessages = () => {
  closeSidebar()
  console.log('Opening saved messages (coming soon)')
  alert('Saved messages feature will be implemented in next phase')
}

const openSettings = () => {
  closeSidebar()
  console.log('Opening settings')
  router.push('/user')
}

const toggleNightMode = () => {
  nightMode.value = !nightMode.value
  console.log('Night mode toggled:', nightMode.value)
  // TODO: Apply night mode theme
}

// Modal Management
const closeCreateModal = () => {
  showCreateModal.value = false
  // Reset form data
  newRoomData.value = {
    name: '',
    description: '',
    graphId: '',
  }
}

const getDescriptionPlaceholder = () => {
  return createType.value === 'group'
    ? 'Discuss topics related to a specific knowledge graph'
    : 'Community discussions and updates for this domain'
}

const getPreviewColor = () => {
  return createType.value === 'group' ? '#4ade80' : '#3b82f6'
}

const createRoom = () => {
  if (!newRoomData.value.name.trim()) return

  console.log('🚀 Creating room:', newRoomData.value)

  // Create new room using room management system
  const newRoom = addNewRoom({
    name: newRoomData.value.name,
    description: newRoomData.value.description,
    type: createType.value,
    graphId: newRoomData.value.graphId,
  })

  // Auto-select the new room
  selectChat(newRoom.id)

  // Show success message
  const typeName = createType.value === 'group' ? 'Group' : 'Channel'
  console.log(`✅ ${typeName} "${newRoom.name}" created successfully!`)

  closeCreateModal()
}

const sendMessage = () => {
  // This method is called from the message component
  console.log('📤 Message sent in room:', selectedChatId.value)
}

const handleMessageSent = (message) => {
  // Update room activity when a message is sent
  if (selectedChatId.value && message) {
    const preview = typeof message === 'string' ? message : message.content || 'New message'
    updateRoomActivity(
      selectedChatId.value,
      preview.substring(0, 50) + (preview.length > 50 ? '...' : ''),
    )
  }
  console.log('📩 Message sent, room activity updated')
}

// Room URL Sharing
const copyRoomId = async () => {
  if (!selectedChat.value) return

  const currentUrl = window.location.origin + window.location.pathname
  const roomUrl = `${currentUrl}?room=${selectedChat.value.id}`

  try {
    await navigator.clipboard.writeText(roomUrl)
    console.log('📋 Room URL copied to clipboard:', roomUrl)

    // Visual feedback
    const button = event.target.closest('.copy-room-id-btn')
    const originalIcon = button.innerHTML
    button.innerHTML = '<i class="bi bi-check"></i>'
    button.classList.add('copied')

    setTimeout(() => {
      button.innerHTML = originalIcon
      button.classList.remove('copied')
    }, 2000)
  } catch (error) {
    console.error('Failed to copy room URL:', error)

    // Fallback - show URL in prompt
    prompt('Copy this room URL:', roomUrl)
  }
}

// Group Info Management
const toggleGroupInfo = () => {
  showGroupInfo.value = !showGroupInfo.value
  console.log('🔍 Group info toggled:', showGroupInfo.value)

  // On mobile, add mobile-open class for animation
  if (window.innerWidth <= 768) {
    nextTick(() => {
      const groupInfoPanel = document.querySelector('.group-info-panel-wrapper')
      if (groupInfoPanel) {
        if (showGroupInfo.value) {
          groupInfoPanel.classList.add('mobile-open')
        } else {
          groupInfoPanel.classList.remove('mobile-open')
        }
      }
    })
  }
}

// Mobile panel management
const isMobile = computed(() => window.innerWidth <= 768)

const toggleMobileChatList = () => {
  if (isMobile.value) {
    const chatPanel = document.querySelector('.chat-list-panel')
    if (chatPanel) {
      chatPanel.classList.toggle('mobile-open')
    }
  }
}

const handleMessageSent = (message) => {
  console.log('Message sent:', message)
  // Real-time message handling will be implemented in backend phase
}

const handleNotificationsChanged = (enabled) => {
  console.log('Notifications changed:', enabled)
  // Update user preferences via API
}

const handleEditGroup = () => {
  console.log('Edit group requested')
  showGroupInfo.value = false
  // Show group edit modal (to be implemented)
}

const handleInviteMembers = () => {
  console.log('Invite members requested')
  showGroupInfo.value = false
  // Show member invitation modal (to be implemented)
}

const handleLeaveGroup = () => {
  console.log('Leave group requested')
  showGroupInfo.value = false
  // Handle leaving the group
}

// Keyboard shortcuts
const handleEscKey = (event) => {
  if (event.key === 'Escape') {
    if (showCreateModal.value) {
      closeCreateModal()
    } else if (showSidebar.value) {
      closeSidebar()
    }
  }
}

// Lifecycle
onMounted(() => {
  console.log('🚀 SiteChatView mounted - Real-time Room System')
  console.log('Current domain:', currentDomain.value)
  console.log('User role:', userRole.value)
  console.log('Can create rooms:', canCreateRooms.value)

  // Initialize room management system
  loadRoomsFromStorage()

  // Handle URL room parameter
  handleUrlRoom()

  // Add keyboard listener
  document.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  // Cleanup
  document.removeEventListener('keydown', handleEscKey)
  document.body.style.overflow = '' // Restore body scroll
})
</script>

<style scoped>
/* Main Container - Telegram Desktop Style */
.site-chat-view {
  height: 100vh;
  background-color: #f4f4f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

.telegram-container {
  display: flex;
  height: 100vh;
  position: relative;
}

/* Left Panel - Chat List */
.chat-list-panel {
  width: 420px;
  background: white;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  min-width: 320px;
  flex-shrink: 0;
}

.chat-list-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  gap: 12px;
}

/* Hamburger Button - Telegram Style */
.hamburger-button {
  background: rgba(255, 255, 255, 0.8);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  padding: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  width: 32px;
  height: 32px;
  position: relative;
  transition: all 0.2s ease;
}

.hamburger-button:hover {
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.hamburger-line {
  width: 16px;
  height: 2px;
  background-color: #6b7280;
  border-radius: 2px;
  transition: all 0.3s ease;
}

.hamburger-button.active .hamburger-line:nth-child(1) {
  transform: rotate(45deg) translate(4px, 4px);
}

.hamburger-button.active .hamburger-line:nth-child(2) {
  opacity: 0;
}

.hamburger-button.active .hamburger-line:nth-child(3) {
  transform: rotate(-45deg) translate(4px, -4px);
}

.search-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  flex: 1;
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #f9fafb;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
}

.search-input:focus {
  background: white;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.create-room-btn {
  background: #3b82f6;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.create-room-btn:hover {
  background: #2563eb;
  transform: scale(1.05);
}

.create-room-btn i {
  font-size: 14px;
}

/* Chat List */
.chats-list {
  flex: 1;
  overflow-y: auto;
}

.chat-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.1s ease;
  border-bottom: 1px solid rgba(229, 231, 235, 0.5);
}

.chat-item:hover {
  background-color: #f9fafb;
}

.chat-item.active {
  background-color: #3b82f6;
  color: white;
}

.chat-item.unread {
  background-color: #fef3c7;
}

.chat-item.active.unread {
  background-color: #3b82f6;
}

.chat-avatar {
  margin-right: 12px;
}

.avatar-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
}

.avatar-circle-small {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
}

.chat-info {
  flex: 1;
  overflow: hidden;
}

.chat-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.chat-title {
  font-weight: 500;
  font-size: 14px;
  margin: 0;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-time {
  font-size: 12px;
  color: #9ca3af;
  flex-shrink: 0;
}

.chat-item.active .chat-time {
  color: rgba(255, 255, 255, 0.8);
}

.chat-preview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-preview {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.chat-item.active .chat-preview {
  color: rgba(255, 255, 255, 0.8);
}

.unread-badge {
  background: #3b82f6;
  color: white;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 12px;
  min-width: 20px;
  text-align: center;
  flex-shrink: 0;
}

/* Middle Panel - Chat Messages */
.chat-messages-panel {
  flex: 1;
  background: white;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-empty-state-panel {
  flex: 1;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-empty-state-panel .empty-content {
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 60px 40px;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

/* Right Panel - Group Info Wrapper */
.group-info-panel-wrapper {
  flex-shrink: 0;
  background: white;
}

.empty-content h4 {
  margin: 16px 0 8px 0;
  font-weight: 400;
}

.empty-icon {
  font-size: 4rem;
  opacity: 0.8;
  margin-bottom: 16px;
}

.chat-header-bar {
  padding: 12px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat-info-section {
  display: flex;
  align-items: center;
  flex: 1;
}

.group-info-toggle {
  background: none;
  border: none;
  color: #6b7280;
  padding: 8px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}

.group-info-toggle:hover {
  background: #f3f4f6;
  color: #374151;
}

.group-info-toggle.active {
  background: #3b82f6;
  color: white;
}

.group-info-toggle.active:hover {
  background: #2563eb;
}

.mobile-menu-btn {
  display: none;
  background: none;
  border: none;
  color: #6b7280;
  padding: 8px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-right: 8px;
}

.mobile-menu-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.chat-avatar-small {
  margin-right: 12px;
}

.chat-details h5 {
  margin: 0 0 2px 0;
  font-size: 16px;
  font-weight: 500;
  color: #1f2937;
}

.chat-details small {
  color: #6b7280;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.copy-room-id-btn {
  background: none;
  border: none;
  color: #6b7280;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
}

.copy-room-id-btn:hover {
  background: #f3f4f6;
  color: #3b82f6;
}

.copy-room-id-btn.copied {
  color: #10b981;
  background: #d1fae5;
}

.chat-messages-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
}

.messages-placeholder {
  text-align: center;
  color: #6b7280;
}

.chat-input-area {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  background: white;
}

.message-input-container {
  display: flex;
  gap: 12px;
  align-items: center;
}

.message-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.message-input:focus {
  border-color: #3b82f6;
}

.send-button {
  background: #3b82f6;
  border: none;
  color: white;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.send-button:hover {
  background: #2563eb;
}

/* Sidebar Overlay - Telegram Style */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  backdrop-filter: blur(2px);
}

.sidebar-content {
  background: white;
  border-radius: 0 12px 12px 0;
  width: 300px;
  max-width: 80vw;
  height: 100vh;
  overflow-y: auto;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
  animation: slideInFromLeft 0.3s ease-out;
  display: flex;
  flex-direction: column;
}

@keyframes slideInFromLeft {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.profile-section {
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.profile-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.profile-avatar {
  margin-right: 12px;
}

.profile-image {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.profile-name {
  margin: 0 0 2px 0;
  font-size: 16px;
  font-weight: 500;
}

.profile-status {
  margin: 0;
  font-size: 13px;
  opacity: 0.9;
}

.profile-settings-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.profile-settings-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.menu-section {
  flex: 1;
  padding: 8px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  position: relative;
}

.menu-item:hover {
  background-color: #f9fafb;
}

.menu-icon {
  width: 24px;
  font-size: 20px;
  margin-right: 32px;
  color: #6b7280;
  text-align: center;
}

.menu-item span {
  font-size: 14px;
  font-weight: 400;
  color: #1f2937;
}

.menu-description {
  display: block;
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}

.toggle-switch {
  margin-left: auto;
}

.toggle-switch input[type='checkbox'] {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: #e5e7eb;
  appearance: none;
  cursor: pointer;
  position: relative;
  transition: background 0.3s ease;
}

.toggle-switch input[type='checkbox']:checked {
  background: #3b82f6;
}

.toggle-switch input[type='checkbox']::before {
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

.toggle-switch input[type='checkbox']:checked::before {
  transform: translateX(20px);
}

.version-info {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  text-align: center;
}

.version-info p {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
}

.version-info small {
  color: #6b7280;
  font-size: 12px;
}

/* Create Modal Styles */
.modal.show {
  display: flex !important;
  align-items: center;
  justify-content: center;
}

.room-preview {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
}

.preview-chat-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.preview-chat-item .chat-avatar {
  margin-right: 12px;
}

.preview-chat-item h6 {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 500;
}

.preview-chat-item small {
  color: #6b7280;
  font-size: 12px;
}

/* Responsive Design */
@media (max-width: 1200px) {
  .chat-list-panel {
    width: 360px;
    min-width: 300px;
  }

  .group-info-panel-wrapper {
    width: 320px;
  }
}

@media (max-width: 992px) {
  .chat-list-panel {
    width: 320px;
    min-width: 280px;
  }

  .group-info-panel-wrapper {
    width: 300px;
  }
}

@media (max-width: 768px) {
  .telegram-container {
    position: relative;
  }

  .mobile-menu-btn {
    display: flex !important;
  }

  .chat-list-panel {
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1001;
    height: 100vh;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }

  .chat-list-panel.mobile-open {
    transform: translateX(0);
  }

  .chat-messages-panel {
    width: 100%;
  }

  .group-info-panel-wrapper {
    position: fixed;
    top: 0;
    right: 0;
    width: 100%;
    height: 100vh;
    z-index: 1002;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  }

  .group-info-panel-wrapper.mobile-open {
    transform: translateX(0);
  }

  .sidebar-content {
    width: 100%;
    max-width: none;
  }

  .chat-empty-state-panel .empty-content {
    padding: 40px 20px;
    margin: 20px;
  }
}

@media (max-width: 480px) {
  .chat-list-panel {
    width: 100vw;
  }

  .empty-icon {
    font-size: 3rem;
  }

  .empty-content h4 {
    font-size: 1.2rem;
  }
}
</style>
