<template>
  <div class="chat-messages-view">
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
            <!-- User name (for received messages in groups) -->
            <div
              v-if="!message.isOwn && message.type !== 'system' && message.user"
              class="message-sender"
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

      <!-- Typing Indicators -->
      <div v-if="typingUsers.length > 0" class="typing-indicator">
        <div class="typing-dots"><span></span><span></span><span></span></div>
        <small>{{ formatTypingUsers() }} typing...</small>
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

    <!-- Message Input Area -->
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
  return messages.value.map((message) => {
    // For chat-worker format messages, convert to our UI format
    if (message.type === 'chat_message') {
      return {
        ...message,
        type: 'text', // Convert chat_message to text for UI
        isOwn: message.userId === userStore.user_id,
        user: {
          id: message.userId,
          name: message.userName || 'Unknown User',
          initials: (message.userName || '?').substring(0, 2).toUpperCase(),
          color: generateUserColor(message.userId),
          avatar: null,
        },
        timestamp: new Date(message.timestamp),
      }
    } else if (message.type === 'user_joined' || message.type === 'user_left') {
      return {
        ...message,
        type: 'system',
        content:
          message.type === 'user_joined'
            ? `${message.userName} joined the chat`
            : `${message.userName} left the chat`,
        timestamp: new Date(message.timestamp),
        user: null,
      }
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
const connectToChat = () => {
  console.log('🔗 Chat: Attempting to connect...')
  console.log('🔗 Chat: Logged in:', userStore.loggedIn)
  console.log('🔗 Chat: Chat ID:', props.chatId)
  console.log('🔗 Chat: User ID:', userStore.user_id)
  console.log('🔗 Chat: User Email:', userStore.email)

  if (!userStore.loggedIn || !props.chatId) {
    console.log('❌ Chat: Cannot connect - missing user or chat ID')
    console.log('❌ Chat: Logged in?', userStore.loggedIn)
    console.log('❌ Chat: Chat ID?', props.chatId)
    return
  }

  connectionStatus.value = 'Connecting'

  const wsUrl = `wss://durable-chat-template.torarnehave.workers.dev/chat/${props.chatId}?userId=${userStore.user_id}&userName=${encodeURIComponent(userStore.email || 'Anonymous')}`

  console.log('🔌 Chat: Connecting to WebSocket:', wsUrl)

  socket.value = new WebSocket(wsUrl)

  socket.value.onopen = () => {
    console.log('✅ Chat: WebSocket connected successfully')
    console.log('👤 Chat: Connected as user:', userStore.email)
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
    console.log('❌ Chat: WebSocket disconnected')
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
  console.log('📩 Incoming chat message:', message)

  switch (message.type) {
    case 'connected':
      activeUsers.value = message.activeUsers || []
      break

    case 'chat_message':
      messages.value.push(message)
      scrollToBottom()
      emit('message-sent') // Notify parent component
      break

    case 'user_joined':
    case 'user_left':
      activeUsers.value = message.activeUsers || []
      messages.value.push(message) // Show as system message
      scrollToBottom()
      break

    case 'typing':
      handleTypingMessage(message)
      break

    default:
      console.log('Unknown message type:', message.type)
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

// Load chat history
const loadChatHistory = async () => {
  console.log('📜 Chat: Loading chat history for room:', props.chatId)
  try {
    const response = await fetch(
      `https://durable-chat-template.torarnehave.workers.dev/api/chat/${props.chatId}/history?limit=50`,
    )
    if (response.ok) {
      const data = await response.json()
      console.log('📜 Chat: History loaded, message count:', data.messages?.length || 0)
      if (data.messages) {
        messages.value = data.messages
        scrollToBottom()
      }
    }
  } catch (error) {
    console.error('❌ Chat: Error loading chat history:', error)
    console.error('❌ Chat: Room ID:', props.chatId)
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
  console.log(`Selecting attachment type: ${type}`)
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
    console.log('🔄 Chat: Login state changed:', isLoggedIn)
    if (isLoggedIn && !isConnected.value) {
      console.log('🔌 Chat: User logged in, connecting to chat...')
      connectToChat()
      loadChatHistory()
    } else if (!isLoggedIn && socket.value) {
      console.log('🚪 Chat: User logged out, closing connection...')
      socket.value.close()
    }
  },
  { immediate: true },
)

// Lifecycle
onMounted(() => {
  console.log('🚀 Chat: Component mounted')
  console.log('👤 Chat: Initial login state:', userStore.loggedIn)
  console.log('🆔 Chat: User ID:', userStore.user_id)
  console.log('📧 Chat: User email:', userStore.email)

  // Brief loading to prevent undefined errors
  isLoading.value = true
  setTimeout(() => {
    isLoading.value = false
    console.log('⏰ Chat: Loading timeout complete, login state:', userStore.loggedIn)

    // The watch function with immediate: true will handle connection
    // No need to duplicate logic here, but ensure scroll works
    nextTick(() => {
      scrollToBottom()
    })
  }, 100)
})

onUnmounted(() => {
  if (socket.value) {
    socket.value.close()
  }
  if (typingTimeout) {
    clearTimeout(typingTimeout)
  }
})

// Watch for new messages
watch(
  () => messages.value.length,
  () => {
    scrollToBottom()
  },
)

// Close menus when clicking outside
const closeMenus = () => {
  showAttachmentMenu.value = false
  showEmojiPicker.value = false
}

onMounted(() => {
  document.addEventListener('click', closeMenus)
})
</script>

<style scoped>
.chat-messages-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f9fafb;
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

/* Messages Container */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  scroll-behavior: smooth;
}

.date-group {
  margin-bottom: 24px;
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
  background: #0ac630;
  color: white;
  margin-left: auto;
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

/* Message Input Area */
.message-input-area {
  background: white;
  border-top: 1px solid #e5e7eb;
  padding: 16px;
  position: relative;
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
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.05);
  border-top: 1px solid #e5e7eb;
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

/* Connection Status */
.connection-status-bar {
  background: #fef3c7;
  border-top: 1px solid #f59e0b;
  padding: 8px 16px;
  text-align: center;
  color: #92400e;
  font-size: 12px;
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

/* Auth Required */
.auth-required-bar {
  background: #f3f4f6;
  border-top: 1px solid #d1d5db;
  padding: 16px;
  text-align: center;
  color: #6b7280;
}

.auth-required-bar p {
  margin: 0 0 4px 0;
  font-weight: 500;
}

.auth-required-bar small {
  margin: 0;
}
</style>
