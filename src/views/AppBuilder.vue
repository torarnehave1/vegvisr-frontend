<template>
  <div class="app-builder">
    <div class="builder-header">
      <div class="header-content">
        <h1>🚀 App Builder</h1>
        <p class="subtitle">Create and deploy custom applications powered by AI and Cloudflare Workers</p>
      </div>
      <div class="header-actions">
        <button @click="showTemplates = !showTemplates" class="btn-secondary">
          {{ showTemplates ? '📝 Create Custom' : '📚 Browse Templates' }}
        </button>
        <button v-if="currentApp" @click="downloadApp" class="btn-secondary">
          📥 Download HTML
        </button>
        <button v-if="currentApp" @click="deployApp" class="btn-primary" :disabled="isDeploying">
          {{ isDeploying ? 'Saving...' : 'Save as Template' }}
        </button>
      </div>
    </div>

    <!-- Template Gallery -->
    <div v-if="showTemplates" class="template-gallery">
      <h2>App Templates</h2>
      <div class="templates-grid">
        <div
          v-for="template in appTemplates"
          :key="template.id"
          class="template-card"
          @click="selectTemplate(template)"
          :class="{ selected: selectedTemplate?.id === template.id }"
        >
          <div class="template-icon">{{ template.icon }}</div>
          <h3>{{ template.name }}</h3>
          <p>{{ template.description }}</p>
          <div class="template-tags">
            <span v-for="tag in template.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- AI App Builder -->
    <div v-else class="ai-builder">
      <div class="builder-panel">
        <div class="prompt-section">
          <h2>✨ Describe Your App</h2>
          <textarea
            v-model="appPrompt"
            placeholder="Example: Create a todo list app with local storage, add/delete tasks, and mark as complete"
            rows="4"
            class="prompt-input"
          ></textarea>
          <button
            @click="generateApp"
            :disabled="!appPrompt.trim() || isGenerating"
            class="btn-primary"
          >
            {{ isGenerating ? '🤖 Generating...' : '✨ Generate App with AI' }}
          </button>
        </div>

        <div v-if="generatedCode" class="code-section">
          <div class="code-header">
            <h3>Generated Code</h3>
            <div class="code-actions">
              <button @click="copyCode" class="btn-small">📋 Copy</button>
              <button @click="editCode = !editCode" class="btn-small">
                {{ editCode ? '👁️ Preview' : '✏️ Edit' }}
              </button>
            </div>
          </div>
          <textarea
            v-if="editCode"
            v-model="generatedCode"
            class="code-editor"
            rows="20"
          ></textarea>
          <pre v-else class="code-preview"><code>{{ generatedCode }}</code></pre>
        </div>
      </div>

      <!-- Live Preview Panel -->
      <div class="preview-panel">
        <div class="preview-header">
          <h3>🎨 Live Preview</h3>
          <div class="preview-actions">
            <button @click="refreshPreview" class="btn-small">🔄 Refresh</button>
            <button v-if="deployedUrl" @click="openInNewTab" class="btn-small">
              🔗 Open in New Tab
            </button>
          </div>
        </div>
        <div class="preview-container">
          <iframe
            v-if="previewUrl"
            :src="previewUrl"
            class="preview-iframe"
            sandbox="allow-scripts allow-same-origin"
            ref="previewFrame"
          ></iframe>
          <div v-else class="preview-placeholder">
            <div class="placeholder-icon">📱</div>
            <p>Generate an app to see live preview</p>
          </div>
        </div>
        <div v-if="deployedUrl" class="deployment-info">
          <strong>🎉 Deployed:</strong>
          <a :href="deployedUrl" target="_blank">{{ deployedUrl }}</a>
        </div>
      </div>
    </div>

    <!-- Deployment Status -->
    <div v-if="deploymentStatus" class="deployment-toast" :class="deploymentStatus.type">
      {{ deploymentStatus.message }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// State
const showTemplates = ref(true)
const appPrompt = ref('')
const generatedCode = ref('')
const selectedTemplate = ref(null)
const currentApp = ref(null)
const isGenerating = ref(false)
const isDeploying = ref(false)
const editCode = ref(false)
const previewUrl = ref('')
const deployedUrl = ref('')
const deploymentStatus = ref(null)
const previewFrame = ref(null)

// App Templates
const appTemplates = ref([
  {
    id: 'name-display',
    name: 'Name Display App',
    icon: '👋',
    description: 'Simple app that displays a personalized greeting',
    tags: ['beginner', 'form', 'interactive'],
    prompt: 'Create an app that takes a name input and displays a personalized greeting for 3 seconds'
  },
  {
    id: 'todo-list',
    name: 'Todo List',
    icon: '✅',
    description: 'Task manager with add, complete, and delete features',
    tags: ['productivity', 'local-storage', 'crud'],
    prompt: 'Create a todo list app with local storage, add/delete tasks, mark as complete, and filter options'
  },
  {
    id: 'calculator',
    name: 'Calculator',
    icon: '🧮',
    description: 'Basic calculator with mathematical operations',
    tags: ['utility', 'math', 'beginner'],
    prompt: 'Create a calculator app with basic operations (add, subtract, multiply, divide) and a clean interface'
  },
  {
    id: 'weather-app',
    name: 'Weather Dashboard',
    icon: '🌤️',
    description: 'Weather app with location search and forecasts',
    tags: ['api', 'data', 'location'],
    prompt: 'Create a weather app that fetches weather data from an API and displays current conditions and forecast'
  },
  {
    id: 'notes-app',
    name: 'Notes App',
    icon: '📝',
    description: 'Simple note-taking app with markdown support',
    tags: ['productivity', 'markdown', 'storage'],
    prompt: 'Create a notes app with markdown support, local storage, and search functionality'
  },
  {
    id: 'timer',
    name: 'Pomodoro Timer',
    icon: '⏱️',
    description: 'Productivity timer with work/break intervals',
    tags: ['productivity', 'time', 'notifications'],
    prompt: 'Create a Pomodoro timer with 25-minute work sessions, 5-minute breaks, and sound notifications'
  },
  {
    id: 'color-picker',
    name: 'Color Palette Generator',
    icon: '🎨',
    description: 'Generate and save color palettes',
    tags: ['design', 'utility', 'creative'],
    prompt: 'Create a color palette generator that creates random palettes, shows hex codes, and allows copying'
  },
  {
    id: 'quiz-app',
    name: 'Quiz App',
    icon: '🎯',
    description: 'Interactive quiz with scoring',
    tags: ['education', 'game', 'interactive'],
    prompt: 'Create a quiz app with multiple choice questions, score tracking, and results display'
  },
  {
    id: 'expense-tracker',
    name: 'Expense Tracker',
    icon: '💰',
    description: 'Track income and expenses with charts',
    tags: ['finance', 'charts', 'analytics'],
    prompt: 'Create an expense tracker with income/expense categories, total calculations, and simple charts'
  },
  {
    id: 'custom',
    name: 'Custom App',
    icon: '✨',
    description: 'Describe your own app idea',
    tags: ['custom', 'ai-powered'],
    prompt: ''
  }
])

const selectTemplate = (template) => {
  selectedTemplate.value = template
  if (template.id === 'custom') {
    showTemplates.value = false
    appPrompt.value = ''
  } else {
    showTemplates.value = false
    appPrompt.value = template.prompt
  }
}

const generateApp = async () => {
  if (!appPrompt.value.trim()) return

  isGenerating.value = true
  deploymentStatus.value = { type: 'info', message: '🤖 AI is generating your app...' }

  try {
    const response = await fetch('https://api.vegvisr.org/generate-worker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: `Create a complete standalone HTML application. ${appPrompt.value}. 
        
IMPORTANT: Return ONLY a complete HTML document (starting with <!DOCTYPE html>) that includes:
- All HTML structure
- Embedded CSS in <style> tags
- Embedded JavaScript in <script> tags
- No external dependencies
- No worker code, no addEventListener, no fetch handlers
- Just a pure client-side HTML/CSS/JS application that runs in a browser

The app should be fully self-contained and work when opened directly in a browser.`,
        aiModel: 'grok',
        userPrompt: appPrompt.value,
        selectedExamples: []
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.success && data.code) {
      // Extract HTML from worker code if it's wrapped in a worker
      let htmlCode = data.code
      
      // If AI returned worker code, extract the HTML
      const htmlMatch = htmlCode.match(/`(<!DOCTYPE html>[\s\S]*?)`/m) || 
                       htmlCode.match(/return\s+`(<!DOCTYPE html>[\s\S]*?)`/m) ||
                       htmlCode.match(/return new Response\(`(<!DOCTYPE html>[\s\S]*?)`/m)
      
      if (htmlMatch) {
        htmlCode = htmlMatch[1]
      } else if (!htmlCode.includes('<!DOCTYPE html>')) {
        // If no HTML found, create a simple wrapper
        htmlCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated App</title>
</head>
<body>
  <div style="padding: 2rem; text-align: center;">
    <h1>App Generated</h1>
    <p>The AI returned code in an unexpected format. Please try again.</p>
    <pre style="text-align: left; background: #f5f5f5; padding: 1rem; border-radius: 8px; overflow: auto;">${htmlCode.substring(0, 500)}...</pre>
  </div>
</body>
</html>`
      }
      
      generatedCode.value = htmlCode
      currentApp.value = {
        prompt: appPrompt.value,
        code: htmlCode,
        timestamp: new Date().toISOString()
      }
      
      // Create preview URL (blob URL for local preview)
      createPreview(htmlCode)
      
      deploymentStatus.value = { type: 'success', message: '✅ App generated successfully! Running in browser.' }
      setTimeout(() => {
        deploymentStatus.value = null
      }, 3000)
    } else {
      throw new Error(data.error || 'Failed to generate app')
    }
  } catch (error) {
    console.error('Generation error:', error)
    deploymentStatus.value = { type: 'error', message: `❌ Error: ${error.message}` }
    setTimeout(() => {
      deploymentStatus.value = null
    }, 5000)
  } finally {
    isGenerating.value = false
  }
}

const createPreview = (htmlCode) => {
  // Clean up the HTML code (remove escape characters, etc.)
  const cleanedHTML = htmlCode
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
  
  // Create blob URL for preview
  const blob = new Blob([cleanedHTML], { type: 'text/html' })
  
  // Revoke old blob URL if exists
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  
  previewUrl.value = URL.createObjectURL(blob)
}

const refreshPreview = () => {
  if (generatedCode.value) {
    createPreview(generatedCode.value)
  }
}

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(generatedCode.value)
    deploymentStatus.value = { type: 'success', message: '📋 Code copied to clipboard!' }
    setTimeout(() => {
      deploymentStatus.value = null
    }, 2000)
  } catch (error) {
    console.error('Copy failed:', error)
  }
}

const deployApp = async () => {
  if (!currentApp.value || !generatedCode.value) return

  // For client-side apps, we'll save to a knowledge graph template instead
  // This creates a reusable template that can be embedded anywhere
  
  isDeploying.value = true
  deploymentStatus.value = { type: 'info', message: 'Saving app as template...' }

  try {
    // Create a template node with the app
    const templateData = {
      name: `App: ${appPrompt.value.substring(0, 50)}`,
      type: 'app-template',
      category: 'Apps',
      nodes: [{
        id: `app-${Date.now()}`,
        type: 'app-viewer',
        label: appPrompt.value.substring(0, 50),
        info: generatedCode.value, // Store the HTML code
        color: '#11998e',
        visible: true
      }],
      edges: [],
      ai_instructions: {
        prompt: appPrompt.value,
        generated_at: new Date().toISOString()
      }
    }

    const response = await fetch('https://knowledge.vegvisr.org/addTemplate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    })

    if (!response.ok) {
      throw new Error(`Save failed: ${response.status}`)
    }

    const result = await response.json()
    console.log('Template saved:', result)
    
    // Also create a downloadable HTML file
    const blob = new Blob([generatedCode.value], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `app-${Date.now()}.html`
    
    deployedUrl.value = url
    deploymentStatus.value = { 
      type: 'success', 
      message: '✅ App saved! You can download it or use it as a template.' 
    }
    
    setTimeout(() => {
      deploymentStatus.value = null
    }, 5000)
    
  } catch (error) {
    console.error('Save error:', error)
    deploymentStatus.value = { type: 'error', message: `❌ Save failed: ${error.message}` }
    setTimeout(() => {
      deploymentStatus.value = null
    }, 5000)
  } finally {
    isDeploying.value = false
  }
}

const openInNewTab = () => {
  if (previewUrl.value) {
    window.open(previewUrl.value, '_blank')
  }
}

const downloadApp = () => {
  if (!generatedCode.value) return
  
  const blob = new Blob([generatedCode.value], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `app-${Date.now()}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  deploymentStatus.value = { type: 'success', message: '📥 App downloaded!' }
  setTimeout(() => {
    deploymentStatus.value = null
  }, 2000)
}
</script>

<style scoped>
.app-builder {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 2rem;
}

.builder-header {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content h1 {
  margin: 0;
  font-size: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  margin: 0.5rem 0 0 0;
  color: #666;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

/* Template Gallery */
.template-gallery {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.template-gallery h2 {
  margin-bottom: 1.5rem;
  color: #333;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.template-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 20%);
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}

.template-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.2);
  border-color: #667eea;
}

.template-card.selected {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.template-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.template-card h3 {
  margin: 0.5rem 0;
  font-size: 1.2rem;
}

.template-card p {
  color: inherit;
  opacity: 0.8;
  margin: 0.5rem 0 1rem 0;
  font-size: 0.9rem;
}

.template-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.tag {
  background: rgba(255, 255, 255, 0.3);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.template-card.selected .tag {
  background: rgba(255, 255, 255, 0.4);
}

/* AI Builder */
.ai-builder {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.builder-panel,
.preview-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 2rem;
}

.prompt-section {
  margin-bottom: 2rem;
}

.prompt-section h2 {
  margin-bottom: 1rem;
  color: #333;
}

.prompt-input {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-family: inherit;
  font-size: 1rem;
  margin-bottom: 1rem;
  resize: vertical;
  transition: border-color 0.3s;
}

.prompt-input:focus {
  outline: none;
  border-color: #667eea;
}

.code-section {
  margin-top: 2rem;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.code-header h3 {
  margin: 0;
  color: #333;
}

.code-actions {
  display: flex;
  gap: 0.5rem;
}

.code-editor,
.code-preview {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  background: #f5f5f5;
  overflow: auto;
}

.code-editor {
  resize: vertical;
}

.code-preview {
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}

.code-preview code {
  white-space: pre-wrap;
  word-break: break-word;
}

/* Preview Panel */
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.preview-header h3 {
  margin: 0;
  color: #333;
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
}

.preview-container {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  height: 600px;
  overflow: hidden;
  background: white;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.preview-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.placeholder-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.deployment-info {
  margin-top: 1rem;
  padding: 1rem;
  background: #e8f5e9;
  border-radius: 8px;
  text-align: center;
}

.deployment-info a {
  color: #2e7d32;
  text-decoration: none;
  font-weight: 500;
}

/* Buttons */
.btn-primary,
.btn-secondary,
.btn-small {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 1rem;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #667eea;
  border: 2px solid #667eea;
}

.btn-secondary:hover {
  background: #667eea;
  color: white;
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  background: #f5f5f5;
  color: #333;
}

.btn-small:hover {
  background: #e0e0e0;
}

/* Deployment Toast */
.deployment-toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  font-weight: 500;
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

.deployment-toast.success {
  background: #4caf50;
  color: white;
}

.deployment-toast.error {
  background: #f44336;
  color: white;
}

.deployment-toast.info {
  background: #2196f3;
  color: white;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Responsive */
@media (max-width: 1024px) {
  .ai-builder {
    grid-template-columns: 1fr;
  }
}
</style>
