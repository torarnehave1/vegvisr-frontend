<template>
  <div class="sandbox-workspace">
    <!-- Sidebar Navigation -->
    <div class="sidebar">
      <div class="sidebar-header">
        <h3>🔧 Sandbox</h3>
        <p class="role-badge">{{ userStore.role }}</p>
      </div>

      <div class="sidebar-section">
        <h4>Actions</h4>
        <button @click="clearPrompt" class="sidebar-btn clear-btn">🔄 Clear Prompt</button>
        <button @click="clearCode" class="sidebar-btn clear-btn">🗑️ Clear Code</button>
        <button @click="clearLogs" class="sidebar-btn clear-btn">📝 Clear Logs</button>
        <button @click="clearAll" class="sidebar-btn clear-btn danger">🧹 Clear All</button>
      </div>

      <div class="sidebar-section">
        <h4>Generation History</h4>
        <div class="history-list">
          <div
            v-for="item in sandboxStore.generationHistory"
            :key="item.id"
            class="history-item"
            @click="loadFromHistory(item)"
          >
            <div class="history-prompt">{{ item.prompt.substring(0, 30) }}...</div>
            <div class="history-time">{{ formatTime(item.timestamp) }}</div>
          </div>
          <div v-if="sandboxStore.generationHistory.length === 0" class="no-history">
            No history yet
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Header -->
      <div class="workspace-header">
        <h1>Worker Sandbox</h1>
        <p>Generate and test Cloudflare Workers with AI assistance</p>
      </div>

      <!-- Prompt Input -->
      <div class="prompt-section">
        <label for="prompt">What kind of worker do you want to create?</label>
        <textarea
          id="prompt"
          v-model="sandboxStore.userPrompt"
          placeholder="Example: Create a simple Hello World worker that responds with the current time"
          rows="3"
          class="prompt-input"
        ></textarea>
        <div class="prompt-actions">
          <button
            @click="generateCode"
            :disabled="sandboxStore.isGenerating || !sandboxStore.userPrompt.trim()"
            class="generate-btn"
          >
            {{ sandboxStore.isGenerating ? '🔄 Generating...' : '✨ Generate Worker' }}
          </button>
          <button
            @click="clearPrompt"
            :disabled="!sandboxStore.userPrompt.trim()"
            class="refresh-btn"
            title="Clear prompt and start fresh"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Code Editor -->
      <div class="code-section">
        <div class="code-header">
          <h3>Generated Worker Code</h3>
          <div class="code-actions">
            <button @click="copyCode" class="action-btn">📋 Copy</button>
            <button
              @click="deployCode"
              :disabled="!sandboxStore.currentWorkerCode.trim() || isDeploying"
              class="action-btn deploy-btn"
            >
              {{ isDeploying ? '🚀 Deploying...' : '🚀 Deploy' }}
            </button>
          </div>
        </div>

        <!-- Deployment Status -->
        <div v-if="deploymentStatus" class="deployment-status" :class="deploymentStatus.type">
          <div class="status-icon">{{ deploymentStatus.icon }}</div>
          <div class="status-content">
            <div class="status-message">{{ deploymentStatus.message }}</div>
            <div v-if="deploymentStatus.endpoint" class="status-endpoint">
              <a :href="deploymentStatus.endpoint" target="_blank">{{
                deploymentStatus.endpoint
              }}</a>
            </div>
          </div>
        </div>
        <textarea
          v-model="sandboxStore.currentWorkerCode"
          placeholder="Generated worker code will appear here..."
          class="code-editor"
          rows="20"
        ></textarea>
      </div>
    </div>

    <!-- Logs Panel -->
    <div class="logs-panel" ref="logsPanel">
      <!-- Resize Handle -->
      <div class="resize-handle" @mousedown="startResize"></div>

      <div class="logs-header">
        <h3>🔍 Debug Logs</h3>
        <span class="log-count">{{ sandboxStore.logs.length }} entries</span>
      </div>

      <div class="logs-container">
        <div
          v-for="log in sandboxStore.logs"
          :key="log.id"
          :class="['log-entry', `log-${log.type}`]"
        >
          <div class="log-time">{{ formatTime(log.timestamp) }}</div>
          <div class="log-type">{{ log.type.toUpperCase() }}</div>
          <div class="log-message">{{ log.message }}</div>
          <div v-if="log.data" class="log-data">
            <pre>{{ JSON.stringify(log.data, null, 2) }}</pre>
          </div>
        </div>

        <div v-if="sandboxStore.logs.length === 0" class="no-logs">
          No logs yet. Start by generating a worker!
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useSandboxStore } from '@/stores/sandboxStore'

const userStore = useUserStore()
const sandboxStore = useSandboxStore()
const logsPanel = ref(null)
const isDeploying = ref(false)
const deploymentStatus = ref(null)

// Resize functionality
let isResizing = false
let startX = 0
let startWidth = 0

const startResize = (e) => {
  isResizing = true
  startX = e.clientX
  startWidth = logsPanel.value.offsetWidth

  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  e.preventDefault()
}

const doResize = (e) => {
  if (!isResizing) return

  const deltaX = startX - e.clientX // Reversed because we're resizing from the left
  const newWidth = startWidth + deltaX

  // Set minimum and maximum widths
  const minWidth = 250
  const maxWidth = window.innerWidth * 0.6 // Max 60% of screen width

  if (newWidth >= minWidth && newWidth <= maxWidth) {
    logsPanel.value.style.width = newWidth + 'px'
  }
}

const stopResize = () => {
  isResizing = false
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onMounted(() => {
  sandboxStore.addLog('info', 'Sandbox workspace initialized')
})

onUnmounted(() => {
  // Clean up event listeners if component is destroyed during resize
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
})

// Generate worker code
const generateCode = async () => {
  deploymentStatus.value = null // Clear previous deployment status
  await sandboxStore.generateWorkerCode()
}

// Clear prompt
const clearPrompt = () => {
  sandboxStore.setPrompt('')
  deploymentStatus.value = null // Also clear deployment status
  sandboxStore.addLog('info', 'Prompt cleared and ready for fresh input')
}

// Clear code
const clearCode = () => {
  sandboxStore.clearCode()
  deploymentStatus.value = null // Also clear deployment status when clearing code
}

// Clear logs
const clearLogs = () => {
  sandboxStore.clearLogs()
}

// Clear everything
const clearAll = () => {
  sandboxStore.setPrompt('')
  sandboxStore.clearCode()
  sandboxStore.clearLogs()
  deploymentStatus.value = null
  sandboxStore.addLog('info', '🧹 Everything cleared - fresh start!')
}

// Copy code to clipboard
const copyCode = async () => {
  if (!sandboxStore.currentWorkerCode) {
    sandboxStore.addLog('error', 'No code to copy')
    return
  }

  try {
    await navigator.clipboard.writeText(sandboxStore.currentWorkerCode)
    sandboxStore.addLog('success', 'Code copied to clipboard')
  } catch (error) {
    sandboxStore.addLog('error', 'Failed to copy code', error.message)
  }
}

// Load from history
const loadFromHistory = (item) => {
  sandboxStore.setPrompt(item.prompt)
  sandboxStore.setWorkerCode(item.code)
  sandboxStore.addLog('info', `Loaded from history: ${item.prompt}`)
}

// Deploy worker code
const deployCode = async () => {
  if (!sandboxStore.currentWorkerCode.trim()) {
    sandboxStore.addLog('error', 'No code to deploy')
    return
  }

  // Debug: Log available user data
  sandboxStore.addLog('info', 'User data available:', {
    email: userStore.email,
    user_id: userStore.user_id,
    emailVerificationToken: userStore.emailVerificationToken,
    mystmkraUserId: userStore.mystmkraUserId,
    loggedIn: userStore.loggedIn,
  })

  if (!userStore.emailVerificationToken) {
    sandboxStore.addLog(
      'error',
      'User must be logged in to deploy (emailVerificationToken missing)',
    )
    return
  }

  isDeploying.value = true
  deploymentStatus.value = {
    type: 'deploying',
    icon: '🚀',
    message: 'Deploying worker...',
  }
  sandboxStore.addLog('info', 'Starting deployment process...')

  try {
    const result = await sandboxStore.deployWorker(userStore.emailVerificationToken)

    if (result && result.success) {
      sandboxStore.addLog('success', `🎉 Deployment successful!`)
      sandboxStore.addLog('info', `Worker endpoint: ${result.endpoint}`)

      deploymentStatus.value = {
        type: 'success',
        icon: '✅',
        message: 'Worker deployed successfully!',
        endpoint: result.endpoint,
      }
    } else {
      sandboxStore.addLog('error', `Deployment failed: ${result?.error || 'Unknown error'}`)
      deploymentStatus.value = {
        type: 'error',
        icon: '❌',
        message: `Deployment failed: ${result?.error || 'Unknown error'}`,
      }
    }
  } catch (error) {
    sandboxStore.addLog('error', 'Deployment error', error.message)
    deploymentStatus.value = {
      type: 'error',
      icon: '❌',
      message: `Deployment error: ${error.message}`,
    }
  } finally {
    isDeploying.value = false
  }
}

// Format timestamp
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}
</script>

<style scoped>
.sandbox-workspace {
  display: flex;
  height: 100vh;
  background: #f5f5f5;
}

/* Sidebar */
.sidebar {
  background: white;
  border-right: 1px solid #e0e0e0;
  padding: 20px;
  overflow-y: auto;
  width: 250px;
  flex-shrink: 0;
}

.sidebar-header h3 {
  margin: 0 0 5px 0;
  color: #333;
}

.role-badge {
  background: #007acc;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  margin: 0;
}

.sidebar-section {
  margin-top: 30px;
}

.sidebar-section h4 {
  margin: 0 0 10px 0;
  color: #666;
  font-size: 14px;
  text-transform: uppercase;
}

.sidebar-btn {
  display: block;
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  text-align: left;
}

.sidebar-btn:hover {
  background: #e9ecef;
}

.clear-btn:hover {
  background: #f8d7da;
  border-color: #f5c6cb;
}

.clear-btn.danger {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

.clear-btn.danger:hover {
  background: #c82333;
  border-color: #bd2130;
}

/* History */
.history-list {
  max-height: 200px;
  overflow-y: auto;
}

.history-item {
  padding: 8px;
  margin-bottom: 4px;
  background: #f8f9fa;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.history-item:hover {
  background: #e9ecef;
}

.history-prompt {
  font-weight: 500;
  margin-bottom: 2px;
}

.history-time {
  color: #666;
  font-size: 11px;
}

.no-history {
  color: #999;
  font-size: 12px;
  font-style: italic;
}

/* Main Content */
.main-content {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  min-width: 0;
}

.workspace-header h1 {
  margin: 0 0 5px 0;
  color: #333;
}

.workspace-header p {
  margin: 0 0 30px 0;
  color: #666;
}

/* Prompt Section */
.prompt-section {
  margin-bottom: 30px;
}

.prompt-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.prompt-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 12px;
}

.prompt-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.generate-btn {
  background: #007acc;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.generate-btn:hover:not(:disabled) {
  background: #005fa3;
}

.generate-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.refresh-btn {
  padding: 10px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #5a6268;
  transform: translateY(-1px);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Code Section */
.code-section {
  margin-bottom: 30px;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.code-header h3 {
  margin: 0;
  color: #333;
}

.action-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.action-btn:hover {
  background: #545b62;
}

.deploy-btn {
  background: #28a745 !important;
  margin-left: 8px;
}

.deploy-btn:hover:not(:disabled) {
  background: #218838 !important;
}

.deploy-btn:disabled {
  background: #6c757d !important;
  cursor: not-allowed;
}

/* Deployment Status */
.deployment-status {
  display: flex;
  align-items: center;
  padding: 12px;
  margin-bottom: 12px;
  border-radius: 6px;
  border-left: 4px solid;
}

.deployment-status.success {
  background: #d4edda;
  border-left-color: #28a745;
  color: #155724;
}

.deployment-status.error {
  background: #f8d7da;
  border-left-color: #dc3545;
  color: #721c24;
}

.deployment-status.deploying {
  background: #fff3cd;
  border-left-color: #ffc107;
  color: #856404;
}

.status-icon {
  font-size: 20px;
  margin-right: 12px;
}

.status-content {
  flex: 1;
}

.status-message {
  font-weight: 500;
  margin-bottom: 4px;
}

.status-endpoint {
  font-size: 14px;
}

.status-endpoint a {
  color: inherit;
  text-decoration: none;
  font-family: 'Courier New', monospace;
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
}

.status-endpoint a:hover {
  text-decoration: underline;
}

.code-editor {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  background: #fafafa;
  resize: vertical;
}

/* Logs Panel */
.logs-panel {
  background: white;
  border-left: 1px solid #e0e0e0;
  padding: 20px;
  overflow-y: auto;
  position: relative;
  width: 300px;
  min-width: 250px;
  max-width: 60vw;
  flex-shrink: 0;
}

/* Resize Handle */
.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 100%;
  background: #ddd;
  cursor: col-resize;
  z-index: 10;
  transition: background-color 0.2s ease;
}

.resize-handle:hover {
  background: #007acc;
}

.resize-handle:active {
  background: #005fa3;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.logs-header h3 {
  margin: 0;
  color: #333;
}

.log-count {
  background: #e9ecef;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  color: #666;
}

.logs-container {
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.log-entry {
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  border-left: 3px solid #ddd;
}

.log-info {
  background: #f8f9fa;
  border-left-color: #6c757d;
}

.log-success {
  background: #d4edda;
  border-left-color: #28a745;
}

.log-error {
  background: #f8d7da;
  border-left-color: #dc3545;
}

.log-request {
  background: #fff3cd;
  border-left-color: #ffc107;
}

.log-response {
  background: #d1ecf1;
  border-left-color: #17a2b8;
}

.log-time {
  color: #666;
  font-size: 10px;
  margin-bottom: 2px;
}

.log-type {
  font-weight: bold;
  margin-bottom: 4px;
}

.log-message {
  margin-bottom: 4px;
}

.log-data {
  background: #f1f3f4;
  padding: 8px;
  border-radius: 3px;
  margin-top: 4px;
}

.log-data pre {
  margin: 0;
  font-size: 10px;
  white-space: pre-wrap;
  word-break: break-word;
}

.no-logs {
  color: #999;
  font-style: italic;
  text-align: center;
  padding: 40px 20px;
}
</style>
