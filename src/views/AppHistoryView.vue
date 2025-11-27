<template>
  <div class="app-history-view">
    <div class="header">
      <div class="header-content">
        <h1>📚 App History</h1>
        <p class="subtitle">Manage and load your saved applications</p>
      </div>
      <div class="header-actions">
        <router-link to="/app-builder" class="btn-secondary">
          ← Back to App Builder
        </router-link>
      </div>
    </div>

    <div class="content">
      <div v-if="loadingHistory" class="loading-state">
        <div class="spinner"></div>
        <p>Loading app history...</p>
      </div>

      <div v-else-if="savedApps.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <h2>No saved apps yet</h2>
        <p>Generate and save an app in the App Builder to see it here!</p>
        <router-link to="/app-builder" class="btn-primary">
          ✨ Create Your First App
        </router-link>
      </div>

      <div v-else class="apps-list">
        <div
          v-for="app in savedApps"
          :key="app.id"
          class="app-container"
        >
          <!-- App Header -->
          <div class="app-header" @click="toggleAppVersions(app.id)">
            <div class="app-info">
              <h2>{{ app.app_name || 'Untitled App' }}</h2>
              <p class="app-description">{{ app.description || 'No description provided' }}</p>
              <div class="app-meta">
                <span class="version-count">
                  <span class="icon">🔄</span>
                  {{ app.version_count || 0 }} version{{ (app.version_count || 0) !== 1 ? 's' : '' }}
                </span>
                <span class="date">
                  <span class="icon">📅</span>
                  {{ formatDate(app.created_at) }}
                </span>
              </div>
              <div v-if="app.tags && app.tags.length > 0" class="app-tags">
                <span v-for="tag in app.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
            </div>
            <div class="app-actions">
              <button
                @click.stop="toggleAppVersions(app.id)"
                class="btn-secondary"
              >
                {{ expandedApps.has(app.id) ? '▼ Hide Versions' : '▶ Show Versions' }}
              </button>
              <button
                @click.stop="deleteApp(app.id, app.app_name)"
                class="btn-danger"
              >
                🗑️ Delete App
              </button>
            </div>
          </div>

          <!-- Versions List (Expandable) -->
          <div v-if="expandedApps.has(app.id)" class="versions-section">
            <div v-if="loadingVersions && currentLoadingAppId === app.id" class="loading-versions">
              <div class="spinner-small"></div>
              <span>Loading versions...</span>
            </div>

            <div v-else-if="appVersionsByApp[app.id] && appVersionsByApp[app.id].length > 0" class="versions-grid">
              <div
                v-for="version in appVersionsByApp[app.id]"
                :key="version.id"
                class="version-card"
                :class="{ 'is-current': version.is_current }"
              >
                <div class="version-header">
                  <div class="version-number">
                    <span class="label">Version</span>
                    <span class="number">{{ version.version_number }}</span>
                  </div>
                  <span v-if="version.is_current" class="current-badge">✓ Current</span>
                </div>

                <div class="version-content">
                  <div class="version-prompt">
                    <label>Prompt:</label>
                    <p>{{ version.prompt }}</p>
                  </div>

                  <div class="version-meta">
                    <span class="model-badge">
                      <span class="icon">🤖</span>
                      {{ getModelName(version.ai_model) }}
                    </span>
                    <span class="date">
                      <span class="icon">📅</span>
                      {{ formatDate(version.created_at) }}
                    </span>
                  </div>
                </div>

                <div class="version-actions">
                  <button @click="loadVersion(version, app)" class="btn-primary btn-load">
                    Load Version
                  </button>
                  <button @click="toggleVersionUpdate(app.id, version.version_number)" class="btn-secondary">
                    {{ showUpdateForm[`${app.id}-${version.version_number}`] ? 'Cancel' : 'Update Code' }}
                  </button>
                </div>
                
                <!-- Update Form -->
                <div v-if="showUpdateForm[`${app.id}-${version.version_number}`]" class="update-form">
                  <div class="form-group">
                    <label for="updateCode">Paste New HTML Code:</label>
                    <textarea
                      v-model="updateCode[`${app.id}-${version.version_number}`]"
                      id="updateCode"
                      class="code-textarea"
                      rows="10"
                      placeholder="Paste your HTML code here..."
                    ></textarea>
                  </div>
                  <div class="form-actions">
                    <button 
                      @click="updateVersionCode(app.id, version.version_number, version.prompt, version.ai_model)"
                      class="btn-primary"
                      :disabled="!updateCode[`${app.id}-${version.version_number}`] || updatingVersion"
                    >
                      {{ updatingVersion ? 'Updating...' : 'Create New Version' }}
                    </button>
                    <button @click="cancelUpdate(app.id, version.version_number)" class="btn-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="no-versions">
              <p>No versions found for this app.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore'
import { useAppBuilderStore } from '../stores/appBuilderStore'

const router = useRouter()
const userStore = useUserStore()
const appBuilderStore = useAppBuilderStore()

// State
const savedApps = ref([])
const loadingHistory = ref(false)
const loadingVersions = ref(false)
const currentLoadingAppId = ref(null)
const expandedApps = ref(new Set())
const appVersionsByApp = ref({})

// Update functionality state
const showUpdateForm = ref({})
const updateCode = ref({})
const updatingVersion = ref(false)

// Load app history on mount
onMounted(() => {
  loadAppHistory()
})

const loadAppHistory = async () => {
  if (!userStore.user_id) {
    router.push('/login')
    return
  }

  loadingHistory.value = true

  try {
    const response = await fetch(`https://api.vegvisr.org/api/app-history/list?userId=${userStore.user_id}&limit=50&offset=0`)
    const result = await response.json()

    if (result.success) {
      savedApps.value = result.apps
    } else {
      throw new Error(result.error || 'Failed to load app history')
    }
  } catch (error) {
    console.error('Load history error:', error)
    alert(`Error loading app history: ${error.message}`)
  } finally {
    loadingHistory.value = false
  }
}

const toggleAppVersions = async (appId) => {
  if (expandedApps.value.has(appId)) {
    expandedApps.value.delete(appId)
  } else {
    expandedApps.value.add(appId)

    if (!appVersionsByApp.value[appId]) {
      await loadVersionsForApp(appId)
    }
  }
}

const loadVersionsForApp = async (appId) => {
  loadingVersions.value = true
  currentLoadingAppId.value = appId

  try {
    const response = await fetch(`https://api.vegvisr.org/api/app-history/versions?userId=${userStore.user_id}&appHistoryId=${appId}`)
    const result = await response.json()

    if (result.success) {
      appVersionsByApp.value[appId] = result.versions
    } else {
      throw new Error(result.error || 'Failed to load versions')
    }
  } catch (error) {
    console.error('Load versions error:', error)
    alert(`Error loading versions: ${error.message}`)
  } finally {
    loadingVersions.value = false
    currentLoadingAppId.value = null
  }
}

const loadVersion = (version, app) => {
  // Parse conversation history from JSON if it exists
  let conversationHistory = []
  if (version.conversation_history) {
    try {
      conversationHistory = JSON.parse(version.conversation_history)
    } catch (e) {
      console.warn('Failed to parse conversation history:', e)
      conversationHistory = []
    }
  }

  // Use the store to load the version
  appBuilderStore.loadVersion({
    prompt: version.prompt,
    code: version.generated_code,
    aiModel: version.ai_model,
    appName: app.app_name,
    versionNumber: version.version_number,
    historyId: app.id,
    versionId: version.id,
    conversationHistory
  })

  router.push('/app-builder')
}

// Update functionality
const toggleVersionUpdate = (appId, versionNumber) => {
  const key = `${appId}-${versionNumber}`
  showUpdateForm.value[key] = !showUpdateForm.value[key]
  
  // Clear code when hiding form
  if (!showUpdateForm.value[key]) {
    updateCode.value[key] = ''
  }
}

const cancelUpdate = (appId, versionNumber) => {
  const key = `${appId}-${versionNumber}`
  showUpdateForm.value[key] = false
  updateCode.value[key] = ''
}

const updateVersionCode = async (appHistoryId, currentVersionNumber, originalPrompt, aiModel) => {
  const key = `${appHistoryId}-${currentVersionNumber}`
  const newCode = updateCode.value[key]
  
  if (!newCode.trim()) {
    alert('Please paste some HTML code to update')
    return
  }

  updatingVersion.value = true

  try {
    const response = await fetch('https://api.vegvisr.org/api/app-history/new-version', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userStore.user_id,
        appHistoryId: appHistoryId,
        prompt: `Updated version based on v${currentVersionNumber}: ${originalPrompt}`,
        aiModel: aiModel,
        generatedCode: newCode,
        conversationHistory: []
      })
    })

    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create new version')
    }

    alert(`Successfully created version ${result.versionNumber}!`)
    
    // Clear the form
    cancelUpdate(appHistoryId, currentVersionNumber)
    
    // Reload versions for this app
    await loadVersionsForApp(appHistoryId)
    
  } catch (error) {
    console.error('Error creating new version:', error)
    alert(`Error creating new version: ${error.message}`)
  } finally {
    updatingVersion.value = false
  }
}

const deleteApp = async (appId, appName) => {
  if (!confirm(`Delete "${appName || 'Untitled App'}" and all its versions permanently?`)) {
    return
  }

  try {
    const response = await fetch('https://api.vegvisr.org/api/app-history/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userStore.user_id,
        appHistoryId: appId
      })
    })

    const result = await response.json()

    if (result.success) {
      savedApps.value = savedApps.value.filter(app => app.id !== appId)
      expandedApps.value.delete(appId)
      delete appVersionsByApp.value[appId]
      alert(result.message)
    } else {
      throw new Error(result.error || 'Failed to delete app')
    }
  } catch (error) {
    console.error('Delete app error:', error)
    alert(`Error deleting app: ${error.message}`)
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getModelName = (model) => {
  const models = {
    'grok-beta': 'Grok Beta',
    'claude': 'Claude',
    'claude-sonnet-4': 'Claude 4 Sonnet',
    'gpt-4': 'GPT-4'
  }
  return models[model] || model
}
</script>

<style scoped>
.app-history-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.header {
  max-width: 1400px;
  margin: 0 auto 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.header-content h1 {
  margin: 0 0 0.5rem 0;
  color: #2d3748;
  font-size: 2rem;
}

.subtitle {
  margin: 0;
  color: #718096;
  font-size: 1.1rem;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.content {
  max-width: 1400px;
  margin: 0 auto;
}

.loading-state, .empty-state {
  background: white;
  padding: 4rem 2rem;
  border-radius: 12px;
  text-align: center;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h2 {
  color: #2d3748;
  margin-bottom: 1rem;
}

.empty-state p {
  color: #718096;
  margin-bottom: 2rem;
}

.apps-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.app-container {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.app-container:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.app-header {
  padding: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  cursor: pointer;
  transition: background 0.2s;
}

.app-header:hover {
  background: #f7fafc;
}

.app-info {
  flex: 1;
}

.app-info h2 {
  margin: 0 0 0.5rem 0;
  color: #2d3748;
  font-size: 1.5rem;
}

.app-description {
  color: #718096;
  margin: 0 0 1rem 0;
  line-height: 1.6;
}

.app-meta {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: #718096;
}

.app-meta .icon {
  margin-right: 0.25rem;
}

.app-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tag {
  background: #edf2f7;
  color: #4a5568;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
}

.app-actions {
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
}

.versions-section {
  padding: 0 2rem 2rem;
  background: #f7fafc;
  border-top: 2px solid #e2e8f0;
}

.loading-versions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  color: #718096;
}

.spinner-small {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
}

.versions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.version-card {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.2s;
}

.version-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.1);
}

.version-card.is-current {
  border-color: #48bb78;
  background: #f0fff4;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.version-number {
  display: flex;
  flex-direction: column;
}

.version-number .label {
  font-size: 0.75rem;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.version-number .number {
  font-size: 1.5rem;
  font-weight: bold;
  color: #667eea;
}

.current-badge {
  background: #48bb78;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.version-content {
  margin-bottom: 1.5rem;
}

.version-prompt {
  margin-bottom: 1rem;
}

.version-prompt label {
  display: block;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.version-prompt p {
  color: #2d3748;
  line-height: 1.6;
  margin: 0;
  background: #f7fafc;
  padding: 0.75rem;
  border-radius: 6px;
  border-left: 3px solid #667eea;
}

.version-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: #718096;
}

.model-badge,
.version-meta .date {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.version-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-load {
  width: 100%;
  justify-content: center;
  font-weight: 600;
}

.no-versions {
  text-align: center;
  padding: 3rem 1rem;
  color: #718096;
}

/* Buttons */
.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
  background: #e2e8f0;
  color: #4a5568;
}

.btn-secondary:hover {
  background: #cbd5e0;
}

.btn-danger {
  background: #fc8181;
  color: white;
}

.btn-danger:hover {
  background: #f56565;
}

/* Update Form Styles */
.update-form {
  margin-top: 1rem;
  padding: 1.5rem;
  background: #f7fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #2d3748;
}

.code-textarea {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  resize: vertical;
  min-height: 200px;
  background: white;
  transition: border-color 0.2s;
}

.code-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.form-actions .btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
