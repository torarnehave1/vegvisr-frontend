<template>
  <div class="claude-code-interface">
    <!-- Header -->
    <div class="header">
      <div class="logo-section">
        <span class="logo">Claude Code</span>
        <span class="badge">Research preview</span>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="main-content">
      <!-- Left Sidebar -->
      <div class="sidebar">
        <!-- Repository Selector -->
        <div class="selector-group">
          <select v-model="selectedRepo" class="selector">
            <option value="">torarnehave1/AppBuilder</option>
            <option value="vegvisr">torarnehave1/vegvisr-frontend</option>
          </select>
          
          <select v-model="selectedBranch" class="selector">
            <option value="default">Default</option>
            <option value="main">Main</option>
            <option value="dev">Dev</option>
          </select>
        </div>

        <!-- Sessions Section -->
        <div class="sessions-section">
          <div class="sessions-header">
            <span>Sessions</span>
            <button class="icon-button">⋯</button>
          </div>

          <div class="session-list">
            <div 
              v-for="session in sessions" 
              :key="session.id"
              class="session-item"
              :class="{ active: session.id === activeSessionId }"
              @click="selectSession(session.id)"
            >
              <div class="session-content">
                <div class="session-title">{{ session.title }}</div>
                <div class="session-repo">{{ session.repo }}</div>
              </div>
              <div class="session-meta">
                <span class="session-changes">{{ session.changes }}</span>
                <span v-if="session.merged" class="session-status merged">✓ Merged</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Center Panel - Chat/Input Area -->
      <div class="center-panel">
        <!-- Input Area -->
        <div class="input-section">
          <div class="input-container">
            <textarea
              v-model="userPrompt"
              placeholder="Ask Claude to write code..."
              class="prompt-input"
              rows="1"
              @input="autoResizeTextarea"
              @keydown.meta.enter="submitPrompt"
              @keydown.ctrl.enter="submitPrompt"
            ></textarea>
            
            <div class="input-footer">
              <div class="input-actions">
                <button class="attach-button" title="Attach files">
                  📎
                </button>
              </div>
              
              <div class="model-selector">
                <button class="model-button">
                  Opus 4.5
                  <span class="arrow">▼</span>
                </button>
                <button class="submit-button" @click="submitPrompt" :disabled="!userPrompt.trim()">
                  ➔
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Conversation History (will show after first message) -->
        <div v-if="messages.length > 0" class="conversation-area">
          <div v-for="(message, index) in messages" :key="index" class="message">
            <div class="message-header">
              <span class="message-role">{{ message.role }}</span>
              <span class="message-time">{{ message.timestamp }}</span>
            </div>
            <div class="message-content" v-html="message.content"></div>
          </div>
        </div>
      </div>

      <!-- Right Panel - Suggestions -->
      <div class="right-panel">
        <div class="suggestions">
          <div 
            v-for="(suggestion, index) in suggestions" 
            :key="index"
            class="suggestion-card"
            @click="applySuggestion(suggestion)"
          >
            <div class="suggestion-icon">{{ suggestion.icon }}</div>
            <div class="suggestion-content">
              <h3 class="suggestion-title">{{ suggestion.title }}</h3>
              <p class="suggestion-description">{{ suggestion.description }}</p>
            </div>
            <div v-if="suggestion.meta" class="suggestion-meta">
              {{ suggestion.meta }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// State
const selectedRepo = ref('torarnehave1/AppBuilder')
const selectedBranch = ref('default')
const userPrompt = ref('')
const messages = ref([])
const activeSessionId = ref(1)

// Sample sessions
const sessions = ref([
  {
    id: 1,
    title: 'Add Vue Vite server for component development',
    repo: 'torarnehave1/AppBuilder',
    changes: '+5236 -2',
    merged: true
  },
  {
    id: 2,
    title: 'Build app builder with API and web components',
    repo: 'torarnehave1/AppBuilder',
    changes: '+4973 -0',
    merged: true
  },
  {
    id: 3,
    title: 'Build virtual body doubling app for focus',
    repo: 'torarnehave1/bodydouble',
    changes: '',
    merged: false
  }
])

// Sample suggestions
const suggestions = ref([
  {
    icon: '📝',
    title: 'Write a CLAUDE.md',
    description: 'Create or update my .CLAUDE_md file',
    meta: '📋 Claude Blueprint: AI answers from Learning'
  },
  {
    icon: '✓',
    title: 'Fix a small todo',
    description: 'Search for a TODO comment and fix it',
    meta: ''
  },
  {
    icon: '🧪',
    title: 'Improve test coverage',
    description: 'Recommend areas to improve our tests',
    meta: '📊 - auth.js\n ├─ utils.js\n └─ api.js'
  }
])

// Methods
const selectSession = (id) => {
  activeSessionId.value = id
}

const submitPrompt = () => {
  if (!userPrompt.value.trim()) return
  
  // Add user message
  messages.value.push({
    role: 'user',
    content: userPrompt.value,
    timestamp: new Date().toLocaleTimeString()
  })
  
  // TODO: Connect to AI endpoint here
  console.log('Submitting prompt:', userPrompt.value)
  
  // Clear input
  userPrompt.value = ''
}

const applySuggestion = (suggestion) => {
  userPrompt.value = suggestion.description
}

const autoResizeTextarea = (event) => {
  const textarea = event.target
  textarea.style.height = 'auto'
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
}

onMounted(() => {
  // Component mounted
})
</script>

<style scoped>
.claude-code-interface {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #1a1a1a;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #e5e5e5;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.badge {
  background: #f0f0f0;
  color: #666;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

/* Main Content */
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Left Sidebar */
.sidebar {
  width: 320px;
  background: #fafafa;
  border-right: 1px solid #e5e5e5;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.selector-group {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selector {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  background: white;
  font-size: 13px;
  cursor: pointer;
  outline: none;
}

.selector:hover {
  border-color: #a0a0a0;
}

.sessions-section {
  flex: 1;
  padding: 0 16px 16px;
}

.sessions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

.icon-button {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 4px;
  font-size: 16px;
}

.icon-button:hover {
  color: #1a1a1a;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-item {
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.session-item:hover {
  border-color: #c0c0c0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.session-item.active {
  border-color: #007aff;
  background: #f0f7ff;
}

.session-content {
  margin-bottom: 8px;
}

.session-title {
  font-size: 13px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.session-repo {
  font-size: 11px;
  color: #666;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.session-changes {
  color: #28a745;
  font-family: 'Monaco', 'Courier New', monospace;
}

.session-status.merged {
  color: #6f42c1;
  font-weight: 500;
}

/* Center Panel */
.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  overflow-y: auto;
}

.input-section {
  width: 100%;
  max-width: 800px;
}

.input-container {
  background: white;
  border: 1px solid #d0d0d0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.prompt-input {
  width: 100%;
  min-height: 120px;
  max-height: 300px;
  padding: 20px;
  border: none;
  font-size: 15px;
  font-family: inherit;
  resize: none;
  outline: none;
  color: #1a1a1a;
}

.prompt-input::placeholder {
  color: #999;
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid #e5e5e5;
  background: #fafafa;
}

.input-actions {
  display: flex;
  gap: 8px;
}

.attach-button {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.attach-button:hover {
  opacity: 1;
}

.model-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.model-button {
  background: white;
  border: 1px solid #d0d0d0;
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.model-button:hover {
  border-color: #a0a0a0;
  background: #f5f5f5;
}

.arrow {
  font-size: 10px;
  opacity: 0.6;
}

.submit-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e8b4a4;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.submit-button:hover:not(:disabled) {
  background: #d9a494;
  transform: scale(1.05);
}

.submit-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Conversation Area */
.conversation-area {
  width: 100%;
  max-width: 800px;
  margin-bottom: 24px;
}

.message {
  margin-bottom: 24px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e5e5;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
}

.message-role {
  font-weight: 600;
  color: #007aff;
  text-transform: uppercase;
}

.message-time {
  color: #999;
}

.message-content {
  font-size: 14px;
  line-height: 1.6;
  color: #1a1a1a;
}

/* Right Panel */
.right-panel {
  width: 380px;
  background: #fafafa;
  border-left: 1px solid #e5e5e5;
  padding: 24px;
  overflow-y: auto;
}

.suggestions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.suggestion-card {
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.suggestion-card:hover {
  border-color: #c0c0c0;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.suggestion-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.suggestion-content {
  margin-bottom: 8px;
}

.suggestion-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 4px 0;
}

.suggestion-description {
  font-size: 13px;
  color: #666;
  margin: 0;
}

.suggestion-meta {
  font-size: 11px;
  color: #999;
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
  white-space: pre-line;
}

/* Responsive */
@media (max-width: 1200px) {
  .right-panel {
    display: none;
  }
}

@media (max-width: 768px) {
  .sidebar {
    width: 260px;
  }
  
  .center-panel {
    padding: 20px;
  }
}
</style>
