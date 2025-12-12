<template>
  <div class="grok-chat-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-title">
        <img :src="grokIcon" alt="Grok AI" class="icon-img" />
        <h3>Grok AI Assistant</h3>
      </div>
      <div class="header-actions">
        <button
          @click="toggleCollapse"
          class="btn btn-sm btn-ghost"
          :title="isCollapsed ? 'Expand' : 'Collapse'"
        >
          {{ isCollapsed ? '◀' : '▶' }}
        </button>
      </div>
    </div>

    <!-- Chat Content -->
    <div v-if="!isCollapsed" class="chat-content">
      <!-- Context Toggle -->
      <div class="context-controls">
        <label class="context-toggle">
          <input type="checkbox" v-model="useGraphContext" />
          <img :src="graphContextIcon" alt="Graph context" class="context-icon" />
          <span>Use Graph Context</span>
        </label>
        <span v-if="useGraphContext" class="context-indicator">
          {{ graphContextSummary }}
        </span>
      </div>

      <!-- Messages -->
      <div class="messages-container" ref="messagesContainer">
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="message"
          :class="message.role"
        >
          <div class="message-header">
            <span class="message-icon" v-if="message.role === 'user'">👤</span>
            <img
              v-else
              :src="grokIcon"
              alt="Grok"
              class="message-icon-img"
            />
            <span class="message-role">{{ message.role === 'user' ? 'You' : 'Grok' }}</span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
          <div class="message-content" v-html="renderMarkdown(message.content)"></div>
          <div v-if="message.role === 'assistant'" class="message-actions">
            <button
              class="btn btn-link btn-sm insert-btn"
              type="button"
              @click="insertAsFullText(message.content)"
            >
              Insert as FullText node
            </button>
          </div>
        </div>

        <!-- Streaming Message -->
        <div v-if="isStreaming" class="message assistant streaming">
          <div class="message-header">
            <img :src="grokIcon" alt="Grok" class="message-icon-img" />
            <span class="message-role">Grok</span>
            <span class="streaming-indicator">
              <span class="spinner"></span> Thinking...
            </span>
          </div>
          <div class="message-content" v-html="renderMarkdown(streamingContent)"></div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="message error">
          <div class="message-header">
            <span class="message-icon">⚠️</span>
            <span class="message-role">Error</span>
          </div>
          <div class="message-content">{{ errorMessage }}</div>
        </div>
      </div>

      <!-- Input -->
      <div class="chat-input-container">
        <div class="input-wrapper">
          <textarea
            v-model="userInput"
            @keydown.enter.exact.prevent="sendMessage"
            @keydown.shift.enter.exact="handleShiftEnter"
            placeholder="Ask Grok anything about the graph..."
            class="chat-input"
            rows="3"
            :disabled="isStreaming"
          ></textarea>
          <button
            @click="sendMessage"
            :disabled="!userInput.trim() || isStreaming"
            class="btn btn-primary send-btn"
            title="Send (Enter)"
          >
            <span v-if="isStreaming" class="spinner-border spinner-border-sm"></span>
            <span v-else>Send</span>
          </button>
        </div>
        <div class="input-hint">
          Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { marked } from 'marked'
import { useUserStore } from '@/stores/userStore'
import grokIcon from '@/assets/grok.svg'
import graphContextIcon from '@/assets/graph-context.svg'

const emit = defineEmits(['insert-fulltext'])

const userStore = useUserStore()

const props = defineProps({
  graphData: {
    type: Object,
    required: true,
  },
})

// State
const isCollapsed = ref(false)
const useGraphContext = ref(true)
const messages = ref([])
const userInput = ref('')
const isStreaming = ref(false)
const streamingContent = ref('')
const errorMessage = ref('')
const messagesContainer = ref(null)

// Computed
const graphContextSummary = computed(() => {
  if (!props.graphData || !props.graphData.nodes) return 'No graph data'
  const nodeCount = props.graphData.nodes.length
  const edgeCount = props.graphData.edges?.length || 0
  return `${nodeCount} nodes, ${edgeCount} edges`
})

// Methods
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const renderMarkdown = (content) => {
  if (!content) return ''
  try {
    return marked(content)
  } catch (error) {
    console.error('Markdown rendering error:', error)
    return content
  }
}

const insertAsFullText = (content) => {
  if (!content) return
  emit('insert-fulltext', content)
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const handleShiftEnter = () => {
  // Allow default behavior (new line)
}

const buildGraphContext = () => {
  if (!useGraphContext.value || !props.graphData) return null

  const { nodes, edges, metadata } = props.graphData

  const context = {
    metadata: {
      title: metadata?.title || 'Untitled Graph',
      description: metadata?.description || '',
      category: metadata?.category || '',
      nodeCount: nodes?.length || 0,
      edgeCount: edges?.length || 0,
    },
    nodes: nodes?.slice(0, 20).map((node) => {
      const infoString = typeof node.info === 'string' ? node.info : String(node.info || '')
      return {
        id: node.id,
        label: node.label || node.id,
        type: node.type || 'unknown',
        info: infoString ? infoString.substring(0, 500) : '',
      }
    }) || [],
    edges: edges?.slice(0, 30).map((edge) => ({
      from: edge.from,
      to: edge.to,
    })) || [],
  }

  return context
}

const sendMessage = async () => {
  const message = userInput.value.trim()
  if (!message || isStreaming.value) return

  // Add user message
  messages.value.push({
    role: 'user',
    content: message,
    timestamp: Date.now(),
  })

  userInput.value = ''
  errorMessage.value = ''
  isStreaming.value = true
  streamingContent.value = ''
  scrollToBottom()

  try {
    // Build messages array for Grok
    let grokMessages = messages.value.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // Inject graph context if enabled
    if (useGraphContext.value) {
      const graphContext = buildGraphContext()
      if (graphContext) {
        const contextMessage = {
          role: 'system',
          content: `You are an AI assistant helping analyze a knowledge graph. Here is the current graph context:

Title: ${graphContext.metadata?.title || 'Untitled'}
Description: ${graphContext.metadata?.description || 'No description'}
Category: ${graphContext.metadata?.category || 'Uncategorized'}
Nodes: ${graphContext.metadata?.nodeCount || 0}
Edges: ${graphContext.metadata?.edgeCount || 0}

Sample Nodes (up to 20):
${graphContext.nodes?.map(node => `- ${node.label} (${node.type}): ${node.info || 'No info'}`).join('\n') || 'No nodes'}

Connections (up to 30):
${graphContext.edges?.map(edge => `- ${edge.from} → ${edge.to}`).join('\n') || 'No connections'}

Use this context to provide relevant insights and answers about the knowledge graph.`
        }
        // Insert context before user messages
        grokMessages = [contextMessage, ...grokMessages]
      }
    }

    // Call grok-worker directly
    const response = await fetch('https://grok.vegvisr.org/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userStore.user_id || 'system', // Use actual user ID from store (note: user_id with underscore)
        messages: grokMessages,
        model: 'grok-3',
        temperature: 0.7,
        max_tokens: 32000, // High token limit for detailed responses (grok-3 supports up to 131,072)
        stream: false,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `API error: ${response.status}`)
    }

    // Parse response from grok-worker
    const data = await response.json()
    const aiMessage = data.choices?.[0]?.message?.content

    if (!aiMessage) {
      throw new Error('No response from AI')
    }

    // Simulate streaming effect by displaying word by word
    const words = aiMessage.split(' ')
    for (let i = 0; i < words.length; i++) {
      streamingContent.value += words[i] + (i < words.length - 1 ? ' ' : '')
      scrollToBottom()
      await new Promise(resolve => setTimeout(resolve, 30))
    }

    // Add assistant message
    messages.value.push({
      role: 'assistant',
      content: aiMessage,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Chat error:', error)
    errorMessage.value = `Error: ${error.message}`
  } finally {
    isStreaming.value = false
    streamingContent.value = ''
    scrollToBottom()
  }
}

// Watch for graph changes
watch(
  () => props.graphData,
  () => {
    // Optionally notify user if graph context is enabled
  },
  { deep: true }
)
</script>

<style scoped>
.grok-chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: white;
  border-left: 1px solid #e0e0e0;
  transition: width 0.3s ease;
  width: 100%;
  min-width: 320px;
  max-width: 100%;
  padding-bottom: 12px;
}

.grok-chat-panel.collapsed {
  width: 72px;
  min-width: 72px;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-title .icon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  display: block;
}

.header-title h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.btn-ghost {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.2);
}

.collapsed .chat-header h3,
.collapsed .header-title .icon-img {
  display: none;
}

.chat-content {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
}

.context-controls {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.context-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.context-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  display: block;
}

.context-toggle input[type='checkbox'] {
  cursor: pointer;
}

.context-indicator {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: #666;
}

.messages-container {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 8px;
  max-width: 90%;
}

.message-actions {
  display: flex;
  justify-content: flex-start;
}

.insert-btn {
  padding: 0;
  font-weight: 600;
}

.message.user {
  align-self: flex-end;
  background: #e3f2fd;
  border: 1px solid #90caf9;
}

.message.assistant {
  align-self: flex-start;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
}

.message.error {
  align-self: center;
  background: #ffebee;
  border: 1px solid #ef5350;
}

.message.streaming {
  background: #fff9e6;
  border: 1px solid #ffd54f;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #666;
}

.message-icon {
  font-size: 1.2rem;
}

.message-icon-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
  display: block;
}

.message-role {
  font-weight: 600;
}

.message-time {
  margin-left: auto;
  font-size: 0.75rem;
  color: #999;
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #ff9800;
  font-weight: 600;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #ff9800;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.message-content {
  font-size: 0.95rem;
  line-height: 1.5;
  word-wrap: break-word;
}

.message-content :deep(pre) {
  background: #f5f5f5;
  padding: 0.5rem;
  border-radius: 4px;
  overflow-x: auto;
}

.message-content :deep(code) {
  background: #f5f5f5;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.message-content :deep(pre code) {
  background: transparent;
  padding: 0;
}

.chat-input-container {
  padding: 1rem;
  padding-bottom: 1.5rem;
  border-top: 1px solid #e0e0e0;
  background: white;
}

.input-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 0.95rem;
  resize: vertical;
  min-height: 60px;
  max-height: 150px;
  font-family: inherit;
}

.chat-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.chat-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.send-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  white-space: nowrap;
}

.input-hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #999;
  text-align: center;
}

.input-hint kbd {
  background: #f5f5f5;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 0.1rem 0.4rem;
  font-family: monospace;
  font-size: 0.85em;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .grok-chat-panel {
    width: 100%;
    max-width: 100%;
    border-left: none;
    border-top: 1px solid #e0e0e0;
  }

  .grok-chat-panel.collapsed {
    width: 100%;
    height: 50px;
  }

  .collapsed .chat-content {
    display: none;
  }

  .message {
    max-width: 95%;
  }
}
</style>
