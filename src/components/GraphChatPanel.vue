<template>
  <div class="graph-chat-panel" v-if="isVisible">
    <!-- Chat Header -->
    <div class="chat-header">
      <h4>💬 Live Discussion</h4>
      <div class="chat-info">
        <span class="user-count" v-if="activeUsers.length > 0">
          {{ activeUsers.length }} {{ activeUsers.length === 1 ? 'user' : 'users' }} online
        </span>
        <span class="connection-status" :class="connectionStatusClass">
          {{ connectionStatus }}
        </span>
      </div>
    </div>

    <!-- Connection Status Message -->
    <div v-if="!isConnected && userStore.user_id" class="connecting-message">
      <div class="loading-spinner"></div>
      <span>Connecting to live discussion...</span>
    </div>

    <!-- Authentication Required -->
    <div v-if="!userStore.user_id" class="auth-required">
      <p>🔐 Login required to join the discussion</p>
      <small>Professional discussions are available to authenticated users.</small>
    </div>

    <!-- Chat Interface (only when connected) -->
    <div v-else-if="isConnected" class="chat-interface">
      <!-- Online Users -->
      <div v-if="activeUsers.length > 1" class="online-users">
        <div class="users-list">
          <span v-for="user in activeUsers.slice(0, 5)" :key="user.userId" class="user-badge">
            {{ user.userName }}
          </span>
          <span v-if="activeUsers.length > 5" class="more-users">
            +{{ activeUsers.length - 5 }} more
          </span>
        </div>
      </div>

      <!-- Messages Container -->
      <div class="messages-container" ref="messagesContainer">
        <!-- Chat History -->
        <div v-if="messages.length === 0" class="no-messages">
          <p>Start the professional discussion!</p>
          <small>Messages can reference specific nodes in the knowledge graph.</small>
        </div>

        <!-- Message List -->
        <div
          v-for="message in messages"
          :key="message.id"
          class="message"
          :class="messageClasses(message)"
        >
          <!-- System Messages (user joined/left) -->
          <div v-if="isSystemMessage(message)" class="system-message">
            <span class="system-text">{{ formatSystemMessage(message) }}</span>
            <small class="timestamp">{{ formatTime(message.timestamp) }}</small>
          </div>

          <!-- Regular Chat Messages -->
          <div v-else class="chat-message">
            <div class="message-header">
              <span class="user-name">{{ message.userName }}</span>
              <small class="timestamp">{{ formatTime(message.timestamp) }}</small>
            </div>

            <div class="message-content">
              {{ message.content }}
            </div>

            <!-- Node Reference -->
            <div v-if="message.nodeReference" class="node-reference">
              <i class="bi bi-link-45deg"></i>
              <small>References: {{ formatNodeReference(message.nodeReference) }}</small>
            </div>
          </div>
        </div>

        <!-- Typing Indicators -->
        <div v-if="typingUsers.length > 0" class="typing-indicator">
          <div class="typing-dots"><span></span><span></span><span></span></div>
          <small>{{ formatTypingUsers() }} typing...</small>
        </div>
      </div>

      <!-- Message Input -->
      <div class="message-input-container">
        <!-- Node Reference Selector (optional) -->
        <div v-if="showNodeSelector" class="node-selector">
          <select v-model="selectedNodeReference" class="form-select form-select-sm">
            <option value="">No node reference</option>
            <option v-for="node in referenceableNodes" :key="node.id" :value="node.id">
              {{ formatNodeOption(node) }}
            </option>
          </select>
          <button @click="showNodeSelector = false" class="btn btn-sm btn-outline-secondary">
            <i class="bi bi-x"></i>
          </button>
        </div>

        <!-- Message Input -->
        <div class="input-group">
          <textarea
            v-model="newMessage"
            @keydown.enter.exact.prevent="sendMessage"
            @keydown.shift.enter.exact="handleShiftEnter"
            @input="handleTyping"
            @blur="stopTyping"
            placeholder="Add to the professional discussion..."
            rows="1"
            maxlength="1000"
            class="form-control message-input"
            :disabled="!isConnected"
            ref="messageInput"
          ></textarea>

          <div class="input-actions">
            <!-- Node Reference Button -->
            <button
              @click="toggleNodeSelector"
              :class="[
                'btn',
                'btn-sm',
                selectedNodeReference ? 'btn-primary' : 'btn-outline-secondary',
              ]"
              title="Reference a graph node"
              type="button"
            >
              <i class="bi bi-link-45deg"></i>
            </button>

            <!-- Send Button -->
            <button
              @click="sendMessage"
              :disabled="!canSendMessage"
              class="btn btn-primary btn-sm"
              title="Send message (Enter)"
              type="button"
            >
              <i class="bi bi-send"></i>
            </button>
          </div>
        </div>

        <!-- Character Count & Tips -->
        <div class="input-footer">
          <small class="char-count">{{ newMessage.length }}/1000</small>
          <small class="input-tips">
            <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useUserStore } from '@/stores/userStore'

export default {
  name: 'GraphChatPanel',
  props: {
    graphId: {
      type: String,
      required: true,
    },
    graphData: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const userStore = useUserStore()

    // Component state
    const isVisible = ref(true)
    const isConnected = ref(false)
    const socket = ref(null)
    const messages = ref([])
    const newMessage = ref('')
    const activeUsers = ref([])
    const typingUsers = ref([])
    const connectionStatus = ref('Disconnected')

    // Node reference functionality
    const showNodeSelector = ref(false)
    const selectedNodeReference = ref('')
    const messagesContainer = ref(null)
    const messageInput = ref(null)

    // Typing indicator
    let typingTimeout = null
    let isCurrentlyTyping = false

    // Connection status computed
    const connectionStatusClass = computed(() => ({
      'status-connected': isConnected.value,
      'status-connecting': connectionStatus.value === 'Connecting',
      'status-disconnected': !isConnected.value && connectionStatus.value !== 'Connecting',
    }))

    // Message send validation
    const canSendMessage = computed(() => {
      return isConnected.value && newMessage.value.trim().length > 0 && userStore.user_id
    })

    // Get referenceable nodes from graph data
    const referenceableNodes = computed(() => {
      if (!props.graphData?.nodes) return []

      return props.graphData.nodes.filter((node) =>
        ['fulltext', 'worknote', 'notes', 'info'].includes(node.type),
      )
    })

    // WebSocket connection
    const connectToChat = () => {
      if (!userStore.user_id || !props.graphId) {
        console.log('Cannot connect: missing user or graph ID')
        return
      }

      connectionStatus.value = 'Connecting'

      const wsUrl = `wss://durable-chat-template.torarnehave.workers.dev/chat/${props.graphId}?userId=${userStore.user_id}&userName=${encodeURIComponent(userStore.email || 'Anonymous')}`

      console.log('Connecting to chat:', wsUrl)

      socket.value = new WebSocket(wsUrl)

      socket.value.onopen = () => {
        console.log('Chat connected')
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
        console.log('Chat disconnected')
        isConnected.value = false
        connectionStatus.value = 'Disconnected'

        // Attempt to reconnect after 3 seconds
        if (userStore.user_id) {
          setTimeout(() => {
            if (!isConnected.value) {
              connectToChat()
            }
          }, 3000)
        }
      }

      socket.value.onerror = (error) => {
        console.error('Chat WebSocket error:', error)
        connectionStatus.value = 'Error'
      }
    }

    // Handle incoming WebSocket messages
    const handleIncomingMessage = (message) => {
      console.log('Incoming chat message:', message)

      switch (message.type) {
        case 'connected':
          activeUsers.value = message.activeUsers || []
          break

        case 'chat_message':
          messages.value.push(message)
          scrollToBottom()
          break

        case 'user_joined':
        case 'user_left':
          activeUsers.value = message.activeUsers || []
          messages.value.push(message) // Show as system message
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

    // Send chat message
    const sendMessage = () => {
      if (!canSendMessage.value) return

      const messageData = {
        type: 'chat_message',
        content: newMessage.value.trim(),
        nodeReference: selectedNodeReference.value || null,
      }

      if (socket.value && socket.value.readyState === WebSocket.OPEN) {
        socket.value.send(JSON.stringify(messageData))
        newMessage.value = ''
        selectedNodeReference.value = ''
        showNodeSelector.value = false
        stopTyping()

        // Focus back to input
        nextTick(() => {
          if (messageInput.value) {
            messageInput.value.focus()
          }
        })
      }
    }

    // Handle typing indicator
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

    // Handle Shift+Enter for new lines
    const handleShiftEnter = (event) => {
      // Allow default behavior (new line)
      return true
    }

    // Toggle node selector
    const toggleNodeSelector = () => {
      showNodeSelector.value = !showNodeSelector.value
    }

    // Scroll to bottom of messages
    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    }

    // Message formatting helpers
    const formatTime = (timestamp) => {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    const formatSystemMessage = (message) => {
      if (message.type === 'user_joined') {
        return `${message.userName} joined the discussion`
      } else if (message.type === 'user_left') {
        return `${message.userName} left the discussion`
      }
      return message.content || ''
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

    const formatNodeReference = (nodeRef) => {
      const node = referenceableNodes.value.find((n) => n.id === nodeRef)
      return node ? formatNodeOption(node) : nodeRef
    }

    const formatNodeOption = (node) => {
      const typeMap = {
        fulltext: '📄 Analysis',
        worknote: '📝 Notes',
        notes: '📋 Notes',
        info: 'ℹ️ Info',
      }
      const prefix = typeMap[node.type] || '📄'
      const title = node.title || node.content?.substring(0, 30) || node.id
      return `${prefix}: ${title}`
    }

    const isSystemMessage = (message) => {
      return ['user_joined', 'user_left'].includes(message.type)
    }

    const messageClasses = (message) => ({
      'own-message': message.userId === userStore.user_id,
      'system-message-container': isSystemMessage(message),
    })

    // Load chat history on connection
    const loadChatHistory = async () => {
      try {
        const response = await fetch(
          `https://durable-chat-template.torarnehave.workers.dev/api/chat/${props.graphId}/history?limit=50`,
        )
        const data = await response.json()

        if (data.messages) {
          messages.value = data.messages
          scrollToBottom()
        }
      } catch (error) {
        console.error('Error loading chat history:', error)
      }
    }

    // Watch for user login status changes
    watch(
      () => userStore.user_id,
      (newUserId) => {
        if (newUserId && !isConnected.value) {
          connectToChat()
        } else if (!newUserId && socket.value) {
          socket.value.close()
        }
      },
    )

    // Component lifecycle
    onMounted(() => {
      if (userStore.user_id) {
        connectToChat()
        loadChatHistory()
      }
    })

    onUnmounted(() => {
      if (socket.value) {
        socket.value.close()
      }
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }
    })

    return {
      // State
      isVisible,
      isConnected,
      messages,
      newMessage,
      activeUsers,
      typingUsers,
      connectionStatus,
      connectionStatusClass,
      showNodeSelector,
      selectedNodeReference,
      messagesContainer,
      messageInput,

      // Computed
      canSendMessage,
      referenceableNodes,

      // Methods
      sendMessage,
      handleTyping,
      stopTyping,
      handleShiftEnter,
      toggleNodeSelector,
      formatTime,
      formatSystemMessage,
      formatTypingUsers,
      formatNodeReference,
      formatNodeOption,
      isSystemMessage,
      messageClasses,

      // Store
      userStore,
    }
  },
}
</script>

<style scoped>
.graph-chat-panel {
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  margin-top: 20px;
  overflow: hidden;
}

.chat-header {
  background: #f8f9fa;
  padding: 12px 16px;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.chat-info {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.user-count {
  color: #6c757d;
}

.connection-status {
  font-weight: 500;
}

.status-connected {
  color: #198754;
}

.status-connecting {
  color: #fd7e14;
}

.status-disconnected {
  color: #dc3545;
}

.connecting-message {
  padding: 20px;
  text-align: center;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e9ecef;
  border-top: 2px solid #0d6efd;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.auth-required {
  padding: 20px;
  text-align: center;
  color: #6c757d;
}

.auth-required p {
  margin-bottom: 8px;
}

.chat-interface {
  display: flex;
  flex-direction: column;
  height: 400px;
}

.online-users {
  padding: 8px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.users-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.user-badge {
  background: #e9ecef;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  color: #495057;
}

.more-users {
  color: #6c757d;
  font-size: 12px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.no-messages {
  text-align: center;
  color: #6c757d;
  padding: 20px;
}

.no-messages p {
  margin-bottom: 8px;
}

.message {
  max-width: 100%;
}

.system-message {
  text-align: center;
  color: #6c757d;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.chat-message {
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: 8px;
  position: relative;
}

.own-message .chat-message {
  background: #0d6efd;
  color: white;
  margin-left: 20%;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.user-name {
  font-weight: 600;
  font-size: 12px;
}

.own-message .user-name {
  color: rgba(255, 255, 255, 0.8);
}

.timestamp {
  font-size: 11px;
  color: #6c757d;
}

.own-message .timestamp {
  color: rgba(255, 255, 255, 0.6);
}

.message-content {
  line-height: 1.4;
  word-wrap: break-word;
}

.node-reference {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #dee2e6;
  font-size: 11px;
  color: #6c757d;
  display: flex;
  align-items: center;
  gap: 4px;
}

.own-message .node-reference {
  border-top-color: rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.7);
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6c757d;
  font-size: 12px;
}

.typing-dots {
  display: flex;
  gap: 2px;
}

.typing-dots span {
  width: 4px;
  height: 4px;
  background: #6c757d;
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

.message-input-container {
  border-top: 1px solid #dee2e6;
  padding: 12px 16px;
  background: #fff;
}

.node-selector {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.node-selector .form-select {
  flex: 1;
}

.input-group {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.message-input {
  flex: 1;
  resize: none;
  max-height: 100px;
  min-height: 38px;
}

.input-actions {
  display: flex;
  gap: 4px;
}

.input-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: #6c757d;
}

.input-tips kbd {
  font-size: 10px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .chat-interface {
    height: 300px;
  }

  .own-message .chat-message {
    margin-left: 10%;
  }

  .input-actions {
    flex-direction: column;
  }
}
</style>
