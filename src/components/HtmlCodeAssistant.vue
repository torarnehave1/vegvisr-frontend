<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="code-assistant-modal" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <div class="header-left">
          <h3>🤖 Code Assistant</h3>
          <span class="node-label">{{ nodeLabel }}</span>
        </div>
        <div class="header-controls">
          <select v-model="provider" class="provider-select" title="Select AI provider">
            <option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <select
            v-if="provider === 'openai'"
            v-model="openaiModel"
            class="model-select"
            title="Select OpenAI model"
          >
            <option v-for="opt in openaiModelOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <select
            v-if="provider === 'claude'"
            v-model="claudeModel"
            class="model-select"
            title="Select Claude model"
          >
            <option v-for="opt in claudeModelOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <button @click="$emit('close')" class="btn-close" title="Close">&times;</button>
        </div>
      </div>

      <!-- Current Code (Collapsible) -->
      <div class="code-section">
        <button class="code-toggle" @click="showCurrentCode = !showCurrentCode">
          <span class="toggle-icon">{{ showCurrentCode ? '▼' : '▶' }}</span>
          Current Code ({{ lineCount }} lines)
        </button>
        <div v-if="showCurrentCode" class="code-display">
          <pre><code>{{ htmlContent }}</code></pre>
        </div>
      </div>

      <!-- Conversation Area -->
      <div class="conversation-area" ref="conversationArea">
        <div v-if="conversationHistory.length === 0" class="empty-state">
          <p>Ask me to make changes to your HTML code.</p>
          <p class="examples">Examples:</p>
          <ul>
            <li>"Add a loading spinner to the fetch function"</li>
            <li>"Make the header sticky"</li>
            <li>"Add dark mode support"</li>
            <li>"Fix the responsive layout for mobile"</li>
          </ul>
        </div>

        <div v-for="(message, index) in conversationHistory" :key="index" class="message" :class="message.role">
          <div class="message-header">
            <span class="message-icon">{{ message.role === 'user' ? '👤' : '🤖' }}</span>
            <span class="message-role">{{ message.role === 'user' ? 'You' : providerLabel }}</span>
          </div>
          <div class="message-content">
            <!-- For assistant messages, separate explanation from code -->
            <template v-if="message.role === 'assistant'">
              <div v-if="message.explanation" class="explanation" v-html="renderMarkdown(message.explanation)"></div>
              <div v-if="message.code" class="code-response">
                <div class="code-header">
                  <span>Updated HTML</span>
                  <button
                    v-if="message.code && index === conversationHistory.length - 1"
                    @click="applyChanges(message.code)"
                    class="btn btn-sm btn-success apply-btn"
                  >
                    ✓ Apply Changes
                  </button>
                </div>
                <pre class="code-block"><code v-html="highlightChanges(message.code)"></code></pre>
              </div>
              <div v-if="!message.code && !message.explanation" v-html="renderMarkdown(message.content)"></div>
            </template>
            <template v-else>
              <div v-html="renderMarkdown(message.content)"></div>
            </template>
          </div>
        </div>

        <div v-if="isLoading" class="message assistant loading">
          <div class="message-header">
            <span class="message-icon">🤖</span>
            <span class="message-role">{{ providerLabel }}</span>
          </div>
          <div class="message-content">
            <div class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="input-area">
        <textarea
          v-model="userInput"
          @keydown.enter.exact.prevent="sendMessage"
          placeholder="Type your code change request..."
          :disabled="isLoading"
          rows="2"
        ></textarea>
        <button
          @click="sendMessage"
          class="btn btn-primary send-btn"
          :disabled="!userInput.trim() || isLoading"
        >
          {{ isLoading ? '...' : 'Send' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  htmlContent: {
    type: String,
    required: true
  },
  nodeId: {
    type: String,
    required: true
  },
  nodeLabel: {
    type: String,
    default: 'HTML Node'
  }
})

const emit = defineEmits(['apply-changes', 'close'])

// Provider options
const providerOptions = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' },
  { value: 'grok', label: 'Grok' },
  { value: 'perplexity', label: 'Perplexity' },
  { value: 'gemini', label: 'Gemini' }
]

const openaiModelOptions = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'o1', label: 'o1' },
  { value: 'o1-mini', label: 'o1 Mini' },
  { value: 'o3-mini', label: 'o3 Mini' }
]

const claudeModelOptions = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' }
]

// State
const provider = ref('openai')
const openaiModel = ref('gpt-4o')
const claudeModel = ref('claude-sonnet-4-20250514')
const showCurrentCode = ref(false)
const conversationHistory = ref([])
const userInput = ref('')
const isLoading = ref(false)
const conversationArea = ref(null)
const currentHtmlState = ref(props.htmlContent)

// Computed
const lineCount = computed(() => {
  return (props.htmlContent || '').split('\n').length
})

const providerLabel = computed(() => {
  const opt = providerOptions.find(o => o.value === provider.value)
  return opt ? opt.label : 'AI'
})

// System prompt for code assistant
const systemPrompt = `You are a code assistant helping modify HTML/CSS/JavaScript code.
The user will ask for specific changes. Respond with:
1. Brief explanation of what you'll change (2-3 sentences)
2. The complete updated code (full HTML document)

IMPORTANT:
- Always return the COMPLETE updated HTML document, not just snippets
- Wrap the code in \`\`\`html code fences
- Preserve all existing functionality unless explicitly asked to remove it
- Keep the same code style and formatting`

// Get API endpoint based on provider
const getEndpoint = () => {
  const endpoints = {
    grok: 'https://api.vegvisr.org/grok-ask',
    openai: 'https://api.vegvisr.org/openai-chat',
    claude: 'https://api.vegvisr.org/claude-chat',
    perplexity: 'https://api.vegvisr.org/perplexity-ask',
    gemini: 'https://api.vegvisr.org/gemini-chat'
  }
  return endpoints[provider.value] || endpoints.openai
}

// Get selected model
const getModel = () => {
  if (provider.value === 'openai') return openaiModel.value
  if (provider.value === 'claude') return claudeModel.value
  return null
}

// Build request payload based on provider
const buildPayload = (userMessage) => {
  const currentCode = currentHtmlState.value

  // Build conversation messages for chat-based APIs
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Current HTML:\n\`\`\`html\n${currentCode}\n\`\`\`\n\nRequest: ${userMessage}` }
  ]

  // Add conversation history (excluding system messages)
  conversationHistory.value.forEach(msg => {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      messages.push({ role: 'assistant', content: msg.fullContent || msg.content })
    }
  })

  // Different payload structure for different providers
  if (provider.value === 'openai' || provider.value === 'claude') {
    return {
      messages,
      model: getModel()
    }
  } else if (provider.value === 'gemini') {
    return {
      messages,
      model: 'gemini-pro'
    }
  } else {
    // Grok and Perplexity use simpler format
    return {
      context: systemPrompt + "\n\nCurrent HTML:\n```html\n" + currentCode + "\n```",
      question: userMessage
    }
  }
}

// Parse AI response to extract explanation and code
const parseResponse = (responseText) => {
  const result = {
    explanation: '',
    code: '',
    fullContent: responseText
  }

  // Try to extract code block
  const codeMatch = responseText.match(/```(?:html)?\s*([\s\S]*?)```/i)
  if (codeMatch) {
    result.code = codeMatch[1].trim()
    // Everything before the code block is explanation
    const beforeCode = responseText.substring(0, responseText.indexOf('```')).trim()
    result.explanation = beforeCode
  } else {
    // No code block found, treat entire response as explanation
    result.explanation = responseText
  }

  return result
}

// Send message to AI
const sendMessage = async () => {
  const message = userInput.value.trim()
  if (!message || isLoading.value) return

  // Add user message to history
  conversationHistory.value.push({
    role: 'user',
    content: message
  })

  userInput.value = ''
  isLoading.value = true

  // Scroll to bottom
  await nextTick()
  scrollToBottom()

  try {
    const endpoint = getEndpoint()
    const payload = buildPayload(message)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    // Extract response text based on provider response format
    let responseText = ''
    if (data.result) {
      responseText = data.result
    } else if (data.content) {
      responseText = data.content
    } else if (data.choices && data.choices[0]) {
      responseText = data.choices[0].message?.content || data.choices[0].text || ''
    } else if (typeof data === 'string') {
      responseText = data
    }

    // Parse the response
    const parsed = parseResponse(responseText)

    // Add assistant message to history
    conversationHistory.value.push({
      role: 'assistant',
      content: responseText,
      explanation: parsed.explanation,
      code: parsed.code,
      fullContent: responseText
    })

    // Update current HTML state if code was provided
    if (parsed.code) {
      currentHtmlState.value = parsed.code
    }

  } catch (error) {
    console.error('Code Assistant error:', error)
    conversationHistory.value.push({
      role: 'assistant',
      content: `Error: ${error.message}. Please try again.`,
      explanation: `Error: ${error.message}. Please try again.`,
      code: ''
    })
  } finally {
    isLoading.value = false
    await nextTick()
    scrollToBottom()
  }
}

// Apply changes to the node
const applyChanges = (code) => {
  emit('apply-changes', code)
}

// Scroll conversation to bottom
const scrollToBottom = () => {
  if (conversationArea.value) {
    conversationArea.value.scrollTop = conversationArea.value.scrollHeight
  }
}

// Simple markdown renderer
const renderMarkdown = (text) => {
  if (!text) return ''
  try {
    return marked.parse(text)
  } catch {
    return text
  }
}

// Highlight changes in code (simple line-based diff)
const highlightChanges = (newCode) => {
  if (!newCode) return ''

  const originalLines = (props.htmlContent || '').split('\n')
  const newLines = newCode.split('\n')
  const originalSet = new Set(originalLines.map(l => l.trim()))

  return newLines.map(line => {
    const trimmed = line.trim()
    const escaped = escapeHtml(line)
    // Highlight lines that are new or modified
    if (trimmed && !originalSet.has(trimmed)) {
      return `<span class="line-added">${escaped}</span>`
    }
    return escaped
  }).join('\n')
}

// Escape HTML for safe display
const escapeHtml = (text) => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Watch for content changes
watch(() => props.htmlContent, (newVal) => {
  currentHtmlState.value = newVal
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  backdrop-filter: blur(4px);
}

.code-assistant-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90vw;
  max-width: 900px;
  height: 85vh;
  max-height: 800px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.node-label {
  color: #6b7280;
  font-size: 14px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-select,
.model-select {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: white;
  cursor: pointer;
}

.provider-select:focus,
.model-select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  padding: 0 8px;
  line-height: 1;
}

.btn-close:hover {
  color: #111827;
}

.code-section {
  border-bottom: 1px solid #e5e7eb;
}

.code-toggle {
  width: 100%;
  padding: 12px 20px;
  background: #f3f4f6;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.code-toggle:hover {
  background: #e5e7eb;
}

.toggle-icon {
  font-size: 10px;
  color: #6b7280;
}

.code-display {
  max-height: 200px;
  overflow: auto;
  background: #1e1e1e;
}

.code-display pre {
  margin: 0;
  padding: 12px 20px;
}

.code-display code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #d4d4d4;
  white-space: pre;
}

.conversation-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #fafafa;
}

.empty-state {
  text-align: center;
  color: #6b7280;
  padding: 40px 20px;
}

.empty-state p {
  margin: 0 0 16px 0;
}

.empty-state .examples {
  font-weight: 600;
  color: #374151;
}

.empty-state ul {
  list-style: none;
  padding: 0;
  margin: 8px 0 0 0;
}

.empty-state li {
  padding: 8px 16px;
  margin: 4px 0;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  font-size: 14px;
  color: #4b5563;
}

.message {
  margin-bottom: 16px;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.message-icon {
  font-size: 16px;
}

.message-role {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.message-content {
  padding-left: 28px;
}

.message.user .message-content {
  background: #eff6ff;
  padding: 12px 16px;
  border-radius: 12px;
  color: #1e40af;
  margin-left: 28px;
}

.message.assistant .message-content {
  background: white;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  margin-left: 28px;
}

.explanation {
  margin-bottom: 12px;
  color: #374151;
  line-height: 1.6;
}

.explanation :deep(p) {
  margin: 0 0 8px 0;
}

.code-response {
  margin-top: 12px;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #1e1e1e;
  border-radius: 8px 8px 0 0;
  color: #9ca3af;
  font-size: 12px;
}

.apply-btn {
  font-size: 12px;
  padding: 4px 12px;
}

.code-block {
  margin: 0;
  padding: 12px;
  background: #1e1e1e;
  border-radius: 0 0 8px 8px;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}

.code-block code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #d4d4d4;
  white-space: pre;
}

.code-block :deep(.line-added) {
  background: rgba(34, 197, 94, 0.2);
  display: block;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #9ca3af;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.6;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.input-area {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  background: white;
}

.input-area textarea {
  flex: 1;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  resize: none;
  font-family: inherit;
}

.input-area textarea:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.input-area textarea:disabled {
  background: #f3f4f6;
}

.send-btn {
  padding: 12px 24px;
  font-weight: 600;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 640px) {
  .code-assistant-modal {
    width: 100%;
    height: 100%;
    max-height: 100%;
    border-radius: 0;
  }

  .modal-header {
    flex-wrap: wrap;
    gap: 12px;
  }

  .header-controls {
    flex-wrap: wrap;
  }

  .node-label {
    display: none;
  }
}
</style>
