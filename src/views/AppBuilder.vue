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
          <div class="prompt-actions">
            <button @click="openPortfolioModal" class="btn-secondary">
              🎨 Add Portfolio Images
            </button>
            <button
              @click="generateApp"
              :disabled="!appPrompt.trim() || isGenerating"
              class="btn-primary"
            >
              {{ isGenerating ? '🤖 Generating...' : '✨ Generate App with AI' }}
            </button>
          </div>
          <div v-if="selectedPortfolioImages.length > 0" class="selected-images-info">
            <span>{{ selectedPortfolioImages.length }} image(s) selected</span>
            <button @click="clearSelectedImages" class="btn-link">Clear</button>
          </div>
        </div>

        <div v-if="generatedCode" class="code-section">
          <div class="code-header">
            <h3>Generated Code</h3>
            <div class="code-actions">
              <button @click="copyCode" class="btn-small">📋 Copy</button>
              <button @click="editCode = !editCode" class="btn-small">
                {{ editCode ? '👁️ Preview' : '✏️ Edit' }}
              </button>
              <button @click="showErrorReporter = !showErrorReporter" class="btn-small btn-warning">
                🐛 Report Error
              </button>
            </div>
          </div>

          <!-- Error Reporter -->
          <div v-if="showErrorReporter" class="error-reporter">
            <h4>🐛 Report an Error</h4>
            <p>Paste the error message and the AI will fix it:</p>
            <textarea
              v-model="errorMessage"
              placeholder="Example: Uncaught ReferenceError: generatePalette is not defined at HTMLButtonElement.onclick"
              rows="4"
              class="error-input"
            ></textarea>
            <div class="error-actions">
              <button @click="regenerateWithFix" :disabled="!errorMessage.trim() || isGenerating" class="btn-primary">
                {{ isGenerating ? '🔧 Fixing...' : '🔧 Fix & Regenerate' }}
              </button>
              <button @click="showErrorReporter = false; errorMessage = ''" class="btn-secondary">
                Cancel
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

    <!-- Portfolio Image Modal -->
    <div v-if="showPortfolioModal" class="modal-overlay" @click.self="closePortfolioModal">
      <div class="portfolio-modal">
        <div class="modal-header">
          <h3>🎨 Select Portfolio Images</h3>
          <button @click="closePortfolioModal" class="btn-close">&times;</button>
        </div>

        <div class="modal-body">
          <div v-if="loadingPortfolioImages" class="loading-state">
            <div class="spinner"></div>
            <p>Loading portfolio images...</p>
          </div>

          <div v-else-if="portfolioImages.length > 0">
            <div class="image-quality-selector">
              <label>Image Quality:</label>
              <select v-model="imageQualityPreset">
                <option value="ultraFast">Ultra Fast (Low Quality)</option>
                <option value="balanced">Balanced (Recommended)</option>
                <option value="highQuality">High Quality</option>
              </select>
            </div>

            <div class="portfolio-grid">
              <div
                v-for="img in portfolioImages"
                :key="img.url"
                class="portfolio-image-card"
                :class="{ selected: isImageSelected(img) }"
                @click="toggleImageSelection(img)"
              >
                <img :src="getOptimizedImageUrl(img.url)" :alt="img.key" loading="lazy" />
                <div class="image-overlay">
                  <span v-if="isImageSelected(img)" class="check-icon">✓</span>
                </div>
                <div class="image-info">
                  <small>{{ img.key }}</small>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            <p>No portfolio images found.</p>
          </div>
        </div>

        <div class="modal-footer">
          <div class="selection-info">
            <strong>{{ selectedPortfolioImages.length }}</strong> image(s) selected
          </div>
          <div class="modal-actions">
            <button @click="closePortfolioModal" class="btn-secondary">Cancel</button>
            <button
              @click="addSelectedImagesToPrompt"
              class="btn-primary"
              :disabled="selectedPortfolioImages.length === 0"
            >
              Add to Prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()

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
const showErrorReporter = ref(false)
const errorMessage = ref('')

// Portfolio images state
const showPortfolioModal = ref(false)
const portfolioImages = ref([])
const loadingPortfolioImages = ref(false)
const selectedPortfolioImages = ref([])
const imageQualityPreset = ref('balanced')

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
    const response = await fetch('https://api.vegvisr.org/generate-app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: appPrompt.value,
        aiModel: 'claude'
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

      // Inject AI helper if prompt mentions AI/chat
      if (needsAIHelper(appPrompt.value)) {
        generatedCode.value = injectAIHelper(htmlCode)
      }

      currentApp.value = {
        prompt: appPrompt.value,
        code: generatedCode.value,
        timestamp: new Date().toISOString()
      }

      // Create preview URL (blob URL for local preview)
      createPreview(generatedCode.value)

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
  // Create blob URL for preview directly without string manipulation
  // The HTML from Claude is already clean and ready to use
  const blob = new Blob([htmlCode], { type: 'text/html' })

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

// Check if prompt mentions AI-related keywords
const needsAIHelper = (prompt) => {
  const aiKeywords = ['ai', 'chat', 'assistant', 'grok', 'question', 'ask']
  const lowerPrompt = prompt.toLowerCase()
  return aiKeywords.some(keyword => lowerPrompt.includes(keyword))
}

// Inject AI helper function into HTML
const injectAIHelper = (htmlCode) => {
  // Don't remove anything - just inject the real askAI which will override the mock one
  // This way we don't risk breaking other functions

  const aiHelper = `
  <script>
    // Vegvisr AI Helper - Auto-injected for Superadmin users
    // This will override any mock askAI function that was generated
    console.log('🤖 Vegvisr AI Helper loaded!');

    async function askAI(question, options = {}) {
      console.log('🤖 askAI called with question:', question);

      try {
        const response = await fetch('https://api.vegvisr.org/user-ai-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: question }],
            max_tokens: options.max_tokens || 500,
            graph_id: options.graph_id || null,
            userEmail: 'superadmin'
          })
        });

        console.log('🤖 AI Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('🤖 AI Error response:', errorText);
          throw new Error('AI request failed: ' + response.status);
        }

        const data = await response.json();
        console.log('🤖 AI Response data:', data);

        // Return the message string directly for easy display
        // Also return node if it needs to be added to graph
        if (window.parent !== window && data.node) {
          console.log('🤖 Sending node to parent window:', data.node);
          window.parent.postMessage({
            type: 'ADD_AI_NODE',
            node: data.node
          }, '*');
        }

        // Return just the message string for simple usage
        return data.message || 'No response from AI';
      } catch (error) {
        console.error('🤖 AI Error:', error);
        throw error; // Let the caller handle the error
      }
    }

    // Portfolio image fetcher function
    async function getPortfolioImages(quality = 'balanced') {
      console.log('🎨 Fetching portfolio images with quality:', quality);

      try {
        const response = await fetch('https://api.vegvisr.org/list-r2-images?size=small');

        if (!response.ok) {
          throw new Error('Failed to fetch portfolio images');
        }

        const data = await response.json();
        const images = data.images || [];

        // Apply quality presets to image URLs
        const qualityPresets = {
          ultraFast: '?w=150&h=94&fit=crop&auto=format,compress&q=30',
          balanced: '?w=150&h=94&fit=crop&crop=entropy&auto=format,enhance,compress&q=65&dpr=2',
          highQuality: '?w=150&h=94&fit=crop&crop=entropy&auto=format,enhance&q=85&sharp=1&sat=5',
          original: ''
        };

        const params = qualityPresets[quality] || qualityPresets.balanced;

        return images.map(img => ({
          ...img,
          url: img.url.includes('?') ? img.url.split('?')[0] + params : img.url + params,
          originalUrl: img.url
        }));
      } catch (error) {
        console.error('🎨 Portfolio images error:', error);
        return [];
      }
    }

    // Make functions globally accessible
    window.askAI = askAI;
    window.getPortfolioImages = getPortfolioImages;
    console.log('🤖 Real askAI and getPortfolioImages functions are now available globally');
  </scr` + `ipt>
  `

  // Insert before closing </body> tag
  return htmlCode.replace('</body>', `${aiHelper}\n</body>`)
}

const regenerateWithFix = async () => {
  if (!errorMessage.value.trim()) return

  isGenerating.value = true
  showErrorReporter.value = false

  try {
    const fixPrompt = `${appPrompt.value}

IMPORTANT: The previous version had this error:
${errorMessage.value}

Please fix this error in the code. Make sure all functions are properly defined before they are used.

Previous code that had the error:
\`\`\`html
${generatedCode.value}
\`\`\`

Generate a corrected version with the error fixed.`

    const response = await fetch('https://api.vegvisr.org/generate-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: fixPrompt,
        aiModel: 'claude'
      })
    })

    const data = await response.json()

    if (data.success && data.code) {
      let htmlCode = data.code

      // Check if AI needs to inject helper function
      if (needsAIHelper(appPrompt.value)) {
        htmlCode = injectAIHelper(htmlCode)
      }

      generatedCode.value = htmlCode
      currentApp.value = {
        prompt: appPrompt.value,
        code: htmlCode,
        timestamp: new Date().toISOString()
      }

      createPreview(generatedCode.value)
      errorMessage.value = '' // Clear error message after successful fix

      deploymentStatus.value = { type: 'success', message: '✅ App regenerated with fix!' }
      setTimeout(() => {
        deploymentStatus.value = null
      }, 3000)
    } else {
      throw new Error(data.error || 'Failed to regenerate app')
    }
  } catch (error) {
    console.error('Regeneration error:', error)
    deploymentStatus.value = { type: 'error', message: `❌ Error: ${error.message}` }
    setTimeout(() => {
      deploymentStatus.value = null
    }, 5000)
  } finally {
    isGenerating.value = false
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

  isDeploying.value = true
  deploymentStatus.value = { type: 'info', message: 'Saving app as template...' }

  try {
    // Get app name from user
    const appName = prompt('Enter a name for this app:', appPrompt.value.substring(0, 50))
    if (!appName || !appName.trim()) {
      deploymentStatus.value = null
      isDeploying.value = false
      return
    }

    // API expects: { name, node, ai_instructions, category, userId }
    // ai_instructions must be a JSON STRING, not object
    const templateData = {
      name: appName.trim(),
      category: 'My Apps', // User-specific category
      userId: userStore.email || 'anonymous', // Store user's email
      node: {
        id: `app-${Date.now()}`,
        type: 'app-viewer',
        label: appName.trim(),
        info: generatedCode.value, // Store the complete HTML code
        color: '#11998e',
        visible: true,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        path: null
      },
      ai_instructions: JSON.stringify({
        prompt: appPrompt.value,
        model: 'claude',
        generated_at: new Date().toISOString(),
        generated_by: 'AI App Builder',
        user_email: userStore.email || 'anonymous'
      })
    }

    const response = await fetch('https://knowledge-graph-worker.torarnehave.workers.dev/addTemplate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Server response:', errorText)
      try {
        const errorData = JSON.parse(errorText)
        throw new Error(errorData.error || errorData.details || `Save failed: ${response.status}`)
      } catch {
        throw new Error(errorText || `Save failed: ${response.status}`)
      }
    }

    const result = await response.json()
    console.log('Template saved:', result)

    deploymentStatus.value = {
      type: 'success',
      message: `✅ "${appName}" saved to My Apps! You can find it in GNewViewer under My Apps category.`
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

// Portfolio Image Functions
const openPortfolioModal = async () => {
  showPortfolioModal.value = true
  loadingPortfolioImages.value = true

  try {
    const response = await fetch('https://api.vegvisr.org/list-r2-images?size=small')
    const data = await response.json()
    portfolioImages.value = data.images || []
  } catch (error) {
    console.error('Error fetching portfolio images:', error)
    portfolioImages.value = []
  } finally {
    loadingPortfolioImages.value = false
  }
}

const closePortfolioModal = () => {
  showPortfolioModal.value = false
}

const toggleImageSelection = (img) => {
  const index = selectedPortfolioImages.value.findIndex(i => i.url === img.url)
  if (index > -1) {
    selectedPortfolioImages.value.splice(index, 1)
  } else {
    selectedPortfolioImages.value.push(img)
  }
}

const isImageSelected = (img) => {
  return selectedPortfolioImages.value.some(i => i.url === img.url)
}

const getOptimizedImageUrl = (baseUrl, preset = null) => {
  if (!baseUrl) return baseUrl

  const currentPreset = preset || imageQualityPreset.value
  const presets = {
    ultraFast: '?w=150&h=94&fit=crop&auto=format,compress&q=30',
    balanced: '?w=150&h=94&fit=crop&crop=entropy&auto=format,enhance,compress&q=65&dpr=2',
    highQuality: '?w=150&h=94&fit=crop&crop=entropy&auto=format,enhance&q=85&sharp=1&sat=5',
  }

  const params = presets[currentPreset] || presets.balanced

  if (baseUrl.includes('?')) {
    return baseUrl.split('?')[0] + params
  }
  return baseUrl + params
}

const addSelectedImagesToPrompt = () => {
  if (selectedPortfolioImages.value.length === 0) return

  const imageUrls = selectedPortfolioImages.value
    .map(img => getOptimizedImageUrl(img.url, 'highQuality'))
    .join(', ')

  const imageSection = `\n\nAvailable portfolio images to use in the app:\n${imageUrls}`

  if (!appPrompt.value.includes('Available portfolio images')) {
    appPrompt.value += imageSection
  }

  deploymentStatus.value = {
    type: 'success',
    message: `✅ Added ${selectedPortfolioImages.value.length} image(s) to prompt!`
  }
  setTimeout(() => {
    deploymentStatus.value = null
  }, 2000)

  closePortfolioModal()
}

const clearSelectedImages = () => {
  selectedPortfolioImages.value = []
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

/* Error Reporter */
.error-reporter {
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.error-reporter h4 {
  margin: 0 0 0.5rem 0;
  color: #856404;
}

.error-reporter p {
  margin: 0 0 1rem 0;
  color: #856404;
  font-size: 0.9rem;
}

.error-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ffc107;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  resize: vertical;
  margin-bottom: 1rem;
}

.error-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-warning {
  background: #ffc107 !important;
  color: #000 !important;
}

.btn-warning:hover {
  background: #e0a800 !important;
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

/* Portfolio Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 2rem;
}

.portfolio-modal {
  background: white;
  border-radius: 16px;
  max-width: 1000px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #f0f0f0;
  color: #333;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.image-quality-selector {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f5f7fa;
  border-radius: 8px;
}

.image-quality-selector label {
  font-weight: 500;
  color: #333;
}

.image-quality-selector select {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
}

.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.portfolio-image-card {
  position: relative;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  background: #f9f9f9;
}

.portfolio-image-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: #667eea;
}

.portfolio-image-card.selected {
  border-color: #667eea;
  border-width: 3px;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.portfolio-image-card img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(102, 126, 234, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.portfolio-image-card.selected .image-overlay {
  opacity: 1;
}

.check-icon {
  color: white;
  font-size: 2rem;
  font-weight: bold;
}

.image-info {
  padding: 0.5rem;
  background: white;
  text-align: center;
}

.image-info small {
  color: #666;
  font-size: 0.75rem;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #999;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-top: 1px solid #e0e0e0;
  background: #f9f9f9;
}

.selection-info {
  color: #666;
}

.modal-actions {
  display: flex;
  gap: 1rem;
}

.prompt-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.selected-images-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #e8f5e9;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #2e7d32;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.9rem;
  padding: 0;
}

.btn-link:hover {
  color: #764ba2;
}

/* Responsive */
@media (max-width: 1024px) {
  .ai-builder {
    grid-template-columns: 1fr;
  }

  .portfolio-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 1rem;
  }

  .portfolio-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
  }

  .modal-header {
    padding: 1rem;
  }

  .modal-body {
    padding: 1rem;
  }

  .modal-footer {
    padding: 1rem;
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
