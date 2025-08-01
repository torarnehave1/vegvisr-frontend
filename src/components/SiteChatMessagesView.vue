<template>
  <div class="chat-messages-view">
    <!-- Message Input Area (MOVED TO TOP) -->
    <div class="message-input-area">
      <div class="input-container">
        <!-- Attachment button -->
        <button class="attachment-btn" @click="showAttachmentMenu = !showAttachmentMenu">
          <i class="bi bi-plus-circle"></i>
        </button>

        <!-- Message input -->
        <div class="message-input-wrapper">
          <textarea
            v-model="newMessage"
            @keydown="handleKeydown"
            @input="handleInputWithTyping"
            @blur="stopTyping"
            ref="messageInput"
            class="message-input"
            placeholder="Write a message..."
            rows="1"
            :disabled="!isConnected"
          ></textarea>
        </div>

        <!-- Emoji button -->
        <button class="emoji-btn" @click="showEmojiPicker = !showEmojiPicker">
          <i class="bi bi-emoji-smile"></i>
        </button>

        <!-- Send button -->
        <button
          class="send-btn"
          @click="sendMessage"
          :disabled="!canSendMessage"
          :class="{ 'send-enabled': canSendMessage }"
          :title="
            !isConnected
              ? 'Chat disconnected'
              : !userStore.loggedIn
                ? 'Login required'
                : 'Send message'
          "
        >
          <i class="bi bi-send-fill"></i>
        </button>
      </div>

      <!-- Attachment Menu -->
      <div v-if="showAttachmentMenu" class="attachment-menu">
        <div class="attachment-option" @click="selectAttachment('file')">
          <i class="bi bi-file-earmark"></i>
          <span>File</span>
        </div>
        <div class="attachment-option" @click="selectAttachment('image')">
          <i class="bi bi-image"></i>
          <span>Photo</span>
        </div>
        <div class="attachment-option" @click="selectAttachment('link')">
          <i class="bi bi-link-45deg"></i>
          <span>Link</span>
        </div>
      </div>

      <!-- Emoji Picker Placeholder -->
      <div v-if="showEmojiPicker" class="emoji-picker">
        <div class="emoji-grid">
          <span
            v-for="emoji in commonEmojis"
            :key="emoji"
            @click="addEmoji(emoji)"
            class="emoji-option"
          >
            {{ emoji }}
          </span>
        </div>
      </div>
    </div>

    <!-- Connection Status (when not connected) -->
    <div v-if="!isConnected && userStore.loggedIn" class="connection-status-bar">
      <div class="connection-message">
        <div v-if="connectionStatus === 'Connecting'" class="connecting-spinner"></div>
        <span>{{
          connectionStatus === 'Connecting'
            ? 'Connecting to chat...'
            : 'Chat disconnected. Retrying...'
        }}</span>
      </div>
    </div>

    <!-- Authentication Required -->
    <div v-if="!userStore.loggedIn" class="auth-required-bar">
      <p>🔐 Login required to join the chat</p>
      <small>Please log in to participate in the discussion.</small>
    </div>

    <!-- User Identity Indicator -->
    <div v-if="userStore.loggedIn" class="user-identity-bar">
      <small class="identity-text">
        <i class="bi bi-person-circle"></i>
        Logged in as: {{ userStore.email || 'Unknown User' }}
      </small>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="messages-loading">
      <div class="loading-spinner"></div>
      <p>Loading messages...</p>
    </div>

    <!-- Messages Area -->
    <div v-else class="messages-container" ref="messagesContainer">
      <!-- Date Separator -->
      <div v-for="(dateGroup, date) in groupedMessages" :key="date" class="date-group">
        <div class="date-separator">
          <span class="date-label">{{ formatDate(date) }}</span>
        </div>

        <!-- Messages for this date -->
        <div
          v-for="message in dateGroup"
          :key="message?.id || Math.random()"
          class="message-wrapper"
          :class="{ 'own-message': message.isOwn }"
        >
          <!-- User Avatar (only for received messages) -->
          <div v-if="!message.isOwn && message.user" class="message-avatar">
            <div
              class="avatar-circle"
              :style="{ backgroundColor: message.user?.color || '#9ca3af' }"
            >
              <img
                v-if="message.user?.avatar"
                :src="message.user.avatar"
                :alt="message.user?.name || 'User'"
                class="avatar-image"
                onerror="this.style.display='none'"
              />
              <span v-else class="avatar-initials">{{ message.user?.initials || '?' }}</span>
            </div>
          </div>

          <!-- Message Bubble -->
          <div
            class="message-bubble"
            :class="{
              'message-own': message.isOwn,
              'message-received': !message.isOwn,
              'message-system': message.type === 'system',
            }"
          >
            <!-- User name (for all messages) -->
            <div
              v-if="message.type !== 'system' && message.user"
              class="message-sender"
              :class="{ 'own-message-sender': message.isOwn }"
            >
              {{ message.user?.name || 'Unknown User' }}
            </div>

            <!-- Message content -->
            <div class="message-content">
              <!-- Text message -->
              <div v-if="message?.type === 'text'" class="message-text">
                {{ message?.content || '' }}
              </div>

              <!-- System message -->
              <div v-else-if="message?.type === 'system'" class="message-system-text">
                <i class="bi bi-info-circle"></i>
                {{ message?.content || 'System message' }}
              </div>

              <!-- File attachment -->
              <div v-else-if="message.type === 'file'" class="message-file">
                <i class="bi bi-file-earmark"></i>
                <span>{{ message.filename }}</span>
              </div>

              <!-- Link attachment -->
              <div v-else-if="message.type === 'link'" class="message-link">
                <i class="bi bi-link-45deg"></i>
                <a :href="message.url" target="_blank">{{ message.title }}</a>
              </div>
            </div>

            <!-- Message reactions -->
            <div
              v-if="message?.reactions && message.reactions.length > 0"
              class="message-reactions"
            >
              <span
                v-for="reaction in message.reactions"
                :key="reaction?.emoji || Math.random()"
                class="reaction-badge"
                :title="`${reaction?.count || 0} ${reaction?.emoji || ''}`"
              >
                {{ reaction?.emoji || '?' }} {{ reaction?.count || 0 }}
              </span>
            </div>

            <!-- Message timestamp -->
            <div class="message-timestamp">
              {{ message?.timestamp ? formatTime(message.timestamp) : '' }}
              <i
                v-if="message?.isOwn && message?.status"
                class="bi bi-check2-all message-status"
                :class="{
                  'status-sent': message?.status === 'sent',
                  'status-delivered': message?.status === 'delivered',
                  'status-read': message?.status === 'read',
                }"
              ></i>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Typing Indicators (positioned outside messages container) -->
    <div v-if="typingUsers.length > 0" class="typing-indicator">
      <div class="typing-dots"><span></span><span></span><span></span></div>
      <small>{{ formatTypingUsers() }} typing...</small>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useUserStore } from '@/stores/userStore'

// Props
const props = defineProps({
  chatId: {
    type: String,
    required: true,
  },
  chatInfo: {
    type: Object,
    default: () => ({}),
  },
})

// Emits
const emit = defineEmits(['message-sent', 'show-group-info'])

// Store
const userStore = useUserStore()

// Refs
const messagesContainer = ref(null)
const messageInput = ref(null)
const newMessage = ref('')
const showAttachmentMenu = ref(false)
const showEmojiPicker = ref(false)
const isLoading = ref(false)

// WebSocket connection state
const socket = ref(null)
const isConnected = ref(false)
const connectionStatus = ref('Disconnected')
const activeUsers = ref([])
const typingUsers = ref([])

// Typing indicator
let typingTimeout = null
let isCurrentlyTyping = false

// Real messages array (populated via WebSocket and chat history)
const messages = ref([])

// Common emojis for picker
const commonEmojis = ref([
  '😊',
  '😂',
  '❤️',
  '👍',
  '👎',
  '🔥',
  '🎉',
  '😍',
  '🤔',
  '👏',
  '💯',
  '🙏',
  '✨',
  '🌟',
  '🎯',
  '💪',
  '🤝',
  '👋',
  '🎊',
  '🥰',
])

// Computed properties
const canSendMessage = computed(() => {
  return isConnected.value && newMessage.value.trim().length > 0 && userStore.loggedIn
})

const connectionStatusClass = computed(() => ({
  'status-connected': isConnected.value,
  'status-connecting': connectionStatus.value === 'Connecting',
  'status-disconnected': !isConnected.value && connectionStatus.value !== 'Connecting',
}))

const safeMessages = computed(() => {
  return messages.value
    .map((message) => {
      // For chat-worker format messages, convert to our UI format
      if (message.type === 'chat_message') {
        const isOwn = String(message.userId) === String(userStore.user_id)

        // Removed verbose message debugging

        return {
          ...message,
          type: 'text', // Convert chat_message to text for UI
          isOwn: isOwn, // Use string comparison for robust matching
          user: {
            id: message.userId,
            name: getDisplayNameForMessage(message.userName),
            initials: getDisplayNameForMessage(message.userName).substring(0, 2).toUpperCase(),
            color: generateUserColor(message.userId),
            avatar: null,
          },
          timestamp: new Date(message.timestamp),
        }
      } else if (message.type === 'user_joined' || message.type === 'user_left') {
        // Skip join/leave notifications - treat as group, not chat
        return null
      } else {
        // Handle existing format messages with safety
        return {
          ...message,
          user:
            message.type === 'system'
              ? null
              : message.user || {
                  id: 'unknown',
                  name: 'Unknown User',
                  initials: '?',
                  color: '#9ca3af',
                  avatar: null,
                },
        }
      }
    })
    .filter((message) => message !== null)
})

const groupedMessages = computed(() => {
  const groups = {}
  safeMessages.value.forEach((message) => {
    if (!message?.timestamp) return

    try {
      const date = message.timestamp.toDateString()
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(message)
    } catch (error) {
      console.warn('Error grouping message by date:', message, error)
    }
  })
  return groups
})

// WebSocket Connection Management
const connectToChat = async () => {
  if (!userStore.loggedIn || !props.chatId) {
    return
  }

  // Load fresh room settings before connecting
  await loadRoomSettings()

  connectionStatus.value = 'Connecting'

  // Get display name after we're sure settings are loaded
  let displayName = userStore.email || 'Anonymous'

  if (roomSettings.value?.displayNames?.[userStore.email]) {
    displayName = roomSettings.value.displayNames[userStore.email]
  }

  const wsUrl = `wss://durable-chat-template.torarnehave.workers.dev/chat/${props.chatId}?userId=${userStore.user_id}&userName=${encodeURIComponent(displayName)}`

  // Connecting to WebSocket

  socket.value = new WebSocket(wsUrl)

  socket.value.onopen = () => {
    isConnected.value = true
    connectionStatus.value = 'Connected'
  }

  socket.value.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)
      handleIncomingMessage(message)
    } catch (error) {
      console.error('Error parsing chat message:', error)
    }
  }

  socket.value.onclose = () => {
    isConnected.value = false
    connectionStatus.value = 'Disconnected'

    // Attempt to reconnect after 3 seconds
    if (userStore.loggedIn) {
      setTimeout(() => {
        if (!isConnected.value) {
          connectToChat()
        }
      }, 3000)
    }
  }

  socket.value.onerror = (error) => {
    console.error('WebSocket error:', error)
    connectionStatus.value = 'Error'
  }
}

// Handle incoming WebSocket messages
const handleIncomingMessage = (message) => {
  // Removed excessive message logging

  switch (message.type) {
    case 'connected':
      activeUsers.value = message.activeUsers || []
      break

    case 'chat_message':
      // Check for duplicates before adding
      const isDuplicate = messages.value.some((msg) => msg.id === message.id)
      if (!isDuplicate) {
        messages.value.push(message)
        scrollToBottom()
        emit('message-sent') // Notify parent component
      }
      break

    case 'user_joined':
    case 'user_left':
      activeUsers.value = message.activeUsers || []
      // Check for duplicates for system messages too
      const isSystemDuplicate = messages.value.some((msg) => msg.id === message.id)
      if (!isSystemDuplicate) {
        messages.value.push(message) // Show as system message
        scrollToBottom()
      }
      break

    case 'typing':
      handleTypingMessage(message)
      break

    default:
    // Unknown message type
  }
}

// Handle typing indicators
const handleTypingMessage = (message) => {
  if (message.userId === userStore.user_id) return // Ignore own typing

  const existingIndex = typingUsers.value.findIndex((u) => u.userId === message.userId)

  if (message.isTyping) {
    if (existingIndex === -1) {
      typingUsers.value.push({
        userId: message.userId,
        userName: message.userName,
      })
    }
  } else {
    if (existingIndex > -1) {
      typingUsers.value.splice(existingIndex, 1)
    }
  }
}

// Loading state for chat history to prevent duplicate loads
const isLoadingHistory = ref(false)

// Room settings for display names
const roomSettings = ref({})

// Load room settings for display names
const loadRoomSettings = async () => {
  if (!props.chatId) {
    return
  }

  try {
    const url = `https://vegvisr-frontend.torarnehave.workers.dev/api/chat-rooms/${props.chatId}/settings`
    const response = await fetch(url)

    if (response.ok) {
      const data = await response.json()
      roomSettings.value = data.room_settings || {}
    } else {
      roomSettings.value = {}
    }
  } catch (error) {
    roomSettings.value = {}
  }
}

// Load chat history with deduplication
const loadChatHistory = async () => {
  // Prevent multiple simultaneous loads
  if (isLoadingHistory.value) {
    return
  }
  isLoadingHistory.value = true

  try {
    const response = await fetch(
      `https://durable-chat-template.torarnehave.workers.dev/api/chat/${props.chatId}/history?limit=50`,
    )
    const data = await response.json()
    if (Array.isArray(data.messages)) {
      // Replace messages (don't append) and deduplicate by message ID
      const uniqueMessages = data.messages.filter(
        (msg, index, self) => index === self.findIndex((m) => m.id === msg.id),
      )

      messages.value = uniqueMessages
    }
  } catch (error) {
    // Error loading chat history
  } finally {
    isLoadingHistory.value = false
  }
}

// Generate consistent color for user ID
const generateUserColor = (userId) => {
  const colors = [
    '#ff6b9d',
    '#4ade80',
    '#3b82f6',
    '#f59e0b',
    '#8b5cf6',
    '#ef4444',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#ec4899',
    '#10b981',
    '#6366f1',
  ]

  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }

  return colors[Math.abs(hash) % colors.length]
}

// Methods
const formatDate = (dateString) => {
  if (!dateString) return 'Unknown Date'

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'

    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      })
    }
  } catch (error) {
    console.warn('Error formatting date:', dateString, error)
    return 'Invalid Date'
  }
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''

  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
    if (isNaN(date.getTime())) return ''

    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch (error) {
    console.warn('Error formatting time:', timestamp, error)
    return ''
  }
}

const formatTypingUsers = () => {
  if (typingUsers.value.length === 1) {
    return typingUsers.value[0].userName
  } else if (typingUsers.value.length === 2) {
    return `${typingUsers.value[0].userName} and ${typingUsers.value[1].userName}`
  } else {
    return `${typingUsers.value[0].userName} and ${typingUsers.value.length - 1} others`
  }
}

const handleKeydown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

const handleInput = () => {
  // Auto-resize textarea
  const textarea = messageInput.value
  textarea.style.height = 'auto'
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
}

const sendMessage = () => {
  if (!canSendMessage.value) return

  const messageData = {
    type: 'chat_message',
    content: newMessage.value.trim(),
    nodeReference: null, // Could be extended later for node references
  }

  if (socket.value && socket.value.readyState === WebSocket.OPEN) {
    socket.value.send(JSON.stringify(messageData))
    newMessage.value = ''
    stopTyping()

    // Reset textarea height and focus
    nextTick(() => {
      messageInput.value.style.height = 'auto'
      if (messageInput.value) {
        messageInput.value.focus()
      }
    })
  } else {
    console.error('WebSocket not connected')
  }
}

const selectAttachment = (type) => {
  showAttachmentMenu.value = false
  // Selecting attachment type
  // TODO: Implement file selection logic
  alert(`${type} attachment will be implemented in next phase`)
}

const addEmoji = (emoji) => {
  newMessage.value += emoji
  showEmojiPicker.value = false
  messageInput.value.focus()
}

// Typing indicator functions
const handleTyping = () => {
  if (!isCurrentlyTyping) {
    isCurrentlyTyping = true
    sendTypingIndicator(true)
  }

  // Clear existing timeout
  if (typingTimeout) {
    clearTimeout(typingTimeout)
  }

  // Set timeout to stop typing indicator
  typingTimeout = setTimeout(() => {
    stopTyping()
  }, 1000)
}

const stopTyping = () => {
  if (isCurrentlyTyping) {
    isCurrentlyTyping = false
    sendTypingIndicator(false)
  }

  if (typingTimeout) {
    clearTimeout(typingTimeout)
    typingTimeout = null
  }
}

const sendTypingIndicator = (isTyping) => {
  if (socket.value && socket.value.readyState === WebSocket.OPEN) {
    socket.value.send(
      JSON.stringify({
        type: 'typing',
        isTyping,
      }),
    )
  }
}

// Enhanced handleInput with typing indicator
const handleInputWithTyping = () => {
  handleInput()
  handleTyping()
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Watch for user login status changes
watch(
  () => userStore.loggedIn,
  (isLoggedIn) => {
    if (isLoggedIn && !isConnected.value) {
      connectToChat()
      loadChatHistory()
    } else if (!isLoggedIn && socket.value) {
      socket.value.close()
    }
  },
  { immediate: true },
)

// Watch for room/chat ID changes
watch(
  () => props.chatId,
  (newChatId, oldChatId) => {
    if (newChatId !== oldChatId && newChatId) {
      // Disconnect from previous room
      if (socket.value) {
        socket.value.close()
      }

      // Clear previous room's messages
      messages.value = []

      // Connect to new room if user is logged in
      if (userStore.loggedIn) {
        connectToChat()
        loadChatHistory()
      }
    }
  },
  { immediate: false }, // Don't run immediately, let login watcher handle initial connection
)

// Close menus when clicking outside
const closeMenus = () => {
  showAttachmentMenu.value = false
  showEmojiPicker.value = false
}

// Lifecycle - CONSOLIDATED single onMounted
onMounted(() => {
  // Add event listener for menu closing
  document.addEventListener('click', closeMenus)

  // Brief loading to prevent undefined errors
  isLoading.value = true
  setTimeout(() => {
    isLoading.value = false

    // The watch function with immediate: true will handle connection
    // No need to duplicate logic here, but ensure scroll works
    nextTick(() => {
      scrollToBottom()
    })
  }, 100)
})

onUnmounted(() => {
  // Clean up WebSocket connection
  if (socket.value) {
    socket.value.close()
  }
  // Clear typing timeout
  if (typingTimeout) {
    clearTimeout(typingTimeout)
  }
  // Remove event listener
  document.removeEventListener('click', closeMenus)
})

// SIMPLE: Get display name or fallback to email
const getDisplayNameForMessage = (userName) => {
  if (!userName) return 'Unknown User'
  if (!roomSettings.value?.displayNames) return userName
  return roomSettings.value.displayNames[userName] || userName
}

// Reconnect WebSocket with new display name (called from parent component)
const reconnectWithNewDisplayName = async (newDisplayName) => {
  try {
    // 1. Close current WebSocket connection
    if (socket.value) {
      socket.value.close()
      isConnected.value = false
    }

    // 2. Reload room settings to get fresh display name
    await loadRoomSettings()

    // 3. Reconnect to same room with new display name
    await connectToChat()

    // 4. Show success message without breaking UX

    // Add a brief success indicator (non-intrusive)
    connectionStatus.value = `Connected as ${newDisplayName}`
    setTimeout(() => {
      connectionStatus.value = 'Connected'
    }, 3000)

    return { success: true, displayName: newDisplayName }
  } catch (error) {
    console.error('❌ Error reconnecting with new display name:', error)
    connectionStatus.value = 'Connection Error'
    return { success: false, error: error.message }
  }
}

// Expose methods to parent component
defineExpose({
  reconnectWithNewDisplayName,
})

// Watch for new messages
watch(
  () => messages.value.length,
  () => {
    scrollToBottom()
  },
)
</script>

<style scoped>
.chat-messages-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f9fafb;
  overflow: hidden;
}

/* Loading State */
.messages-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f4f6;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Messages Container (NOW BELOW INPUT) */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 60px; /* Ensure last message is always visible */
  scroll-behavior: smooth;
  background-image: url('/images/Chat.svg');
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
  margin-top: 0;
  min-height: 0;
  max-height: calc(100% - 120px); /* Account for input and status bars */
}

.date-group {
  margin-bottom: 24px;
}

.date-group:last-child {
  margin-bottom: 40px; /* Extra space for last message group */
}

.date-separator {
  display: flex;
  justify-content: center;
  margin: 16px 0;
}

.date-label {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  padding: 4px 16px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

/* Message Layout */
.message-wrapper {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 8px;
}

.message-wrapper.own-message {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

.message-avatar {
  flex-shrink: 0;
  width: 32px;
}

.avatar-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  font-weight: 500;
  position: relative;
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-initials {
  font-size: 12px;
  font-weight: 600;
}

/* Message Bubbles */
.message-bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 20px;
  position: relative;
  word-wrap: break-word;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.message-received {
  background: white;
  border: 1px solid #e1e5e9;
  margin-left: 0;
  border-bottom-left-radius: 6px;
}

.message-own {
  background: white;
  color: #333;
  margin-left: auto;
  border: 1px solid #e1e5e9;
  border-bottom-right-radius: 6px;
}

.message-system {
  background: #f3f4f6;
  color: #6b7280;
  font-style: italic;
  text-align: center;
  margin: 8px auto;
  max-width: none;
  font-size: 13px;
}

.message-sender {
  font-size: 12px;
  font-weight: 600;
  color: #0088cc;
  margin-bottom: 4px;
}

/* Own message sender styling */
.own-message-sender {
  text-align: right;
  color: #6366f1;
  font-weight: 600;
}

.message-content {
  line-height: 1.4;
}

.message-text {
  white-space: pre-wrap;
  font-size: 14px;
}

.message-system-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.message-file,
.message-link {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.message-link a {
  color: inherit;
  text-decoration: underline;
}

.message-own .message-link a {
  color: rgba(255, 255, 255, 0.9);
}

/* Message Reactions */
.message-reactions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.reaction-badge {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.reaction-badge:hover {
  background: rgba(59, 130, 246, 0.2);
}

.message-own .reaction-badge {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.message-own .reaction-badge:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Message Timestamp */
.message-timestamp {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}

.message-own .message-timestamp {
  color: rgba(255, 255, 255, 0.7);
}

.message-status {
  font-size: 12px;
}

.status-sent {
  color: #9ca3af;
}

.status-delivered {
  color: #6b7280;
}

.status-read {
  color: #3b82f6;
}

.message-own .status-sent {
  color: rgba(255, 255, 255, 0.5);
}

.message-own .status-delivered {
  color: rgba(255, 255, 255, 0.7);
}

.message-own .status-read {
  color: rgba(255, 255, 255, 0.9);
}

/* Message Input Area (NOW AT TOP) */
.message-input-area {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 16px;
  position: relative;
  flex-shrink: 0;
  z-index: 10;
  order: -1; /* Ensure it stays at top */
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 100%;
}

.attachment-btn,
.emoji-btn,
.send-btn {
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
  flex-shrink: 0;
}

.attachment-btn:hover,
.emoji-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.send-btn {
  color: #9ca3af;
}

.send-btn.send-enabled {
  background: #3b82f6;
  color: white;
}

.send-btn.send-enabled:hover {
  background: #2563eb;
}

.send-btn:disabled {
  cursor: not-allowed;
}

.message-input-wrapper {
  flex: 1;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  padding: 8px 16px;
  min-height: 36px;
  display: flex;
  align-items: center;
}

.message-input {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2937;
  min-height: 20px;
  max-height: 120px;
}

.message-input::placeholder {
  color: #9ca3af;
}

/* Attachment Menu */
.attachment-menu {
  position: absolute;
  bottom: 70px;
  left: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  padding: 8px;
  z-index: 10;
  min-width: 160px;
}

.attachment-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-size: 14px;
  color: #374151;
}

.attachment-option:hover {
  background: #f9fafb;
}

.attachment-option i {
  width: 20px;
  color: #6b7280;
}

/* Emoji Picker */
.emoji-picker {
  position: absolute;
  bottom: 70px;
  right: 60px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  padding: 16px;
  z-index: 10;
  width: 280px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
}

.emoji-option {
  font-size: 20px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: background-color 0.2s ease;
}

.emoji-option:hover {
  background: #f9fafb;
}

/* Scrollbar Styling */
.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}

/* Responsive Design */
@media (max-width: 768px) {
  .messages-container {
    padding: 12px;
  }

  .message-bubble {
    max-width: 80%;
  }

  .attachment-menu {
    left: 12px;
  }

  .emoji-picker {
    right: 12px;
    width: 240px;
  }

  .emoji-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}

/* Typing Indicators */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6b7280;
  font-size: 12px;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid #e5e7eb;
  backdrop-filter: blur(4px);
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
  z-index: 5;
}

.typing-dots {
  display: flex;
  gap: 2px;
}

.typing-dots span {
  width: 4px;
  height: 4px;
  background: #6b7280;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%,
  80%,
  100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Connection Status (NOW AT TOP) */
.connection-status-bar {
  background: #fef3c7;
  border-bottom: 1px solid #f59e0b;
  padding: 8px 16px;
  text-align: center;
  color: #92400e;
  font-size: 12px;
  flex-shrink: 0;
}

.connection-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.connecting-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #fbbf24;
  border-top: 2px solid #f59e0b;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Auth Required (NOW AT TOP) */
.auth-required-bar {
  background: #f3f4f6;
  border-bottom: 1px solid #d1d5db;
  padding: 16px;
  text-align: center;
  color: #6b7280;
  flex-shrink: 0;
}

.auth-required-bar p {
  margin: 0 0 4px 0;
  font-weight: 500;
}

.auth-required-bar small {
  margin: 0;
}

/* User Identity Indicator */
.user-identity-bar {
  background: #f0f9ff;
  border-bottom: 1px solid #bae6fd;
  padding: 8px 16px;
  text-align: center;
  flex-shrink: 0;
}

.identity-text {
  color: #0369a1;
  font-weight: 500;
  margin: 0;
}

.identity-text i {
  margin-right: 6px;
  color: #0284c7;
}
</style>
