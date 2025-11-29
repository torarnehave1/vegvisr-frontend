<template>
  <div class="component-manager-view">
    <div class="header">
      <div class="header-content">
        <h1>⚡ Component Manager</h1>
        <p class="subtitle">AI-powered component editing and version control</p>
      </div>
      <div class="header-actions">
        <button @click="goToAppBuilder" class="btn-secondary">
          ← Back to App Builder
        </button>
      </div>
    </div>

    <div class="content">
      <!-- Component Manager Web Component - exactly like the working HTML -->
      <component-manager
        api-endpoint="https://api.vegvisr.org"
        user-id="demo-user@example.com"
        theme="light">
      </component-manager>

      <!-- Event Log -->
      <div class="event-log-section">
        <h3>Activity Log</h3>
        <div class="event-log" id="eventLog">
          <div class="log-entry">Component manager initialized...</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Navigation
const goToAppBuilder = () => {
  router.push('/app-builder')
}

// Load script and setup exactly like the working HTML
onMounted(() => {
  // Load the Component Manager script
  if (!document.querySelector('script[src*="component-manager.js"]')) {
    const script = document.createElement('script')
    script.src = 'https://api.vegvisr.org/components/component-manager.js'
    script.onload = () => {
      setupEventListeners()
    }
    document.head.appendChild(script)
  } else {
    setupEventListeners()
  }
})

function setupEventListeners() {
  const manager = document.querySelector('component-manager')
  const eventLog = document.getElementById('eventLog')

  if (!manager || !eventLog) {
    setTimeout(setupEventListeners, 100)
    return
  }

  function logEvent(message, type = 'info') {
    const entry = document.createElement('div')
    entry.className = `log-entry log-${type}`
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`
    eventLog.appendChild(entry)
    eventLog.scrollTop = eventLog.scrollHeight
  }

  // Listen to component events - exactly like working HTML
  manager.addEventListener('componentSelected', (e) => {
    logEvent(`Selected component: ${e.detail.componentName}`, 'info')
  })

  manager.addEventListener('versionCreated', (e) => {
    logEvent(`✅ New version ${e.detail.newVersion} created for ${e.detail.componentName}`, 'success')
    logEvent(`Changes: ${e.detail.changes}`, 'success')
  })

  manager.addEventListener('versionRestored', (e) => {
    logEvent(`↩️ Restored ${e.detail.componentName} to version ${e.detail.versionNumber}`, 'success')
  })

  manager.addEventListener('error', (e) => {
    logEvent(`❌ Error: ${e.detail.message}`, 'error')
  })

  // Wait for component to load
  customElements.whenDefined('component-manager').then(() => {
    logEvent('Component manager loaded successfully!', 'success')
  })
}
</script>

<style scoped>
.component-manager-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  gap: 20px;
}

.header-content {
  flex: 1;
}

.header-content h1 {
  color: white;
  font-size: 2.5rem;
  margin: 0 0 8px 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.subtitle {
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.1rem;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.content {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* Selected Component Info */
.selected-component-info {
  margin-bottom: 30px;
}

.component-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border-left: 4px solid #667eea;
}

.component-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.component-header h2 {
  margin: 0;
  color: #2d3748;
  font-size: 1.5rem;
}

.component-type {
  background: #667eea;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.component-description {
  color: #4a5568;
  margin: 10px 0;
  line-height: 1.6;
}

.component-meta {
  display: flex;
  gap: 20px;
  font-size: 0.875rem;
  color: #718096;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* Tab Navigation */
.tabs {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 30px;
}

.tab-button {
  background: none;
  border: none;
  padding: 12px 24px;
  font-size: 1rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-button:hover:not(:disabled) {
  color: #475569;
  background: #f8fafc;
}

.tab-button.active {
  color: #667eea;
  border-bottom-color: #667eea;
  background: #f0f4ff;
}

.tab-button:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}

/* Tab Content */
.tab-content {
  min-height: 400px;
}

.tab-pane {
  animation: fadeIn 0.3s ease-in-out;
}

/* Component Manager Web Component */
component-manager {
  display: block;
  width: 100%;
  min-height: 500px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* No Selection State */
.no-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
}

.no-selection-content h3 {
  color: #64748b;
  margin-bottom: 10px;
}

.no-selection-content p {
  color: #94a3b8;
  font-size: 1.1rem;
}

/* Loading State */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-content p {
  color: #64748b;
  font-size: 1.1rem;
}

/* Error State */
.error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
}

.error-content h3 {
  color: #dc2626;
  margin-bottom: 10px;
}

.error-content p {
  color: #7f1d1d;
  margin-bottom: 20px;
  background: #fef2f2;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #fecaca;
}

/* Primary Button */
.btn-primary {
  background: #667eea;
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #5a67d8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

/* Tab Navigation */
.tabs {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 30px;
}

.tab-button {
  background: none;
  border: none;
  padding: 12px 24px;
  font-size: 1rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-button:hover:not(:disabled) {
  color: #475569;
  background: #f8fafc;
}

.tab-button.active {
  color: #667eea;
  border-bottom-color: #667eea;
  background: #f0f4ff;
}

.tab-button:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}

/* Tab Content */
.tab-content {
  min-height: 400px;
}

.tab-pane {
  animation: fadeIn 0.3s ease-in-out;
}

/* Component Manager Web Component */
component-manager {
  display: block;
  width: 100%;
  min-height: 500px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* No Selection State */
.no-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
}

.no-selection-content h3 {
  color: #64748b;
  margin-bottom: 10px;
}

.no-selection-content p {
  color: #94a3b8;
  font-size: 1.1rem;
}

/* Loading State */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-content p {
  color: #64748b;
  font-size: 1.1rem;
}

/* Error State */
.error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
}

.error-content h3 {
  color: #dc2626;
  margin-bottom: 10px;
}

.error-content p {
  color: #7f1d1d;
  margin-bottom: 20px;
  background: #fef2f2;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #fecaca;
}

/* Primary Button */
.btn-primary {
  background: #667eea;
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #5a67d8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

/* Event Log */
.event-log-section h3 {
  color: #2d3748;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-log {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  max-height: 300px;
  overflow-y: auto;
}

.log-entry {
  margin: 4px 0;
  padding: 4px;
  border-left: 3px solid #667eea;
  padding-left: 8px;
  color: #e2e8f0;
}

.log-success {
  border-left-color: #10b981;
  color: #6ee7b7;
}

.log-error {
  border-left-color: #ef4444;
  color: #fca5a5;
}

.log-info {
  border-left-color: #3b82f6;
  color: #93c5fd;
}

/* Buttons */
.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* Responsive */
@media (max-width: 768px) {
  .component-manager-view {
    padding: 15px;
  }

  .header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-content h1 {
    font-size: 2rem;
  }

  .content {
    padding: 20px;
  }

  .component-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .component-meta {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
