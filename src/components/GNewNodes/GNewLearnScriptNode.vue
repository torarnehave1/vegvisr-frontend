<template>
  <div class="gnew-learn-script-node">
    <div class="node-header">
      <h3 class="node-title">🎓 Learning Content Creator</h3>
      <p class="node-description">Generate YouTube scripts from markdown documentation</p>
    </div>

    <div class="node-content">
      <div class="form-container">
        <!-- Markdown Input -->
        <div class="form-group">
          <label class="form-label">📄 Markdown Documentation:</label>
          <textarea
            v-model="markdownContent"
            class="form-control markdown-input"
            placeholder="Paste your markdown documentation here..."
            rows="8"
          ></textarea>
          <small class="form-text text-muted">
            Paste the documentation you want to turn into a YouTube script
          </small>
        </div>

        <!-- YouTube URL Input -->
        <div class="form-group">
          <label class="form-label">🎬 YouTube URL (optional):</label>
          <input
            v-model="youtubeUrl"
            type="url"
            class="form-control"
            placeholder="https://youtu.be/VIDEO_ID or https://www.youtube.com/watch?v=VIDEO_ID"
          />
          <small class="form-text text-muted">
            If provided, a YouTube video node will be created alongside the script
          </small>
        </div>

        <!-- AI Provider Selection -->
        <div class="form-group">
          <label class="form-label">🤖 AI Provider:</label>
          <select v-model="aiProvider" class="form-control">
            <option value="api-worker">🔥 API Worker (GPT-4/Grok-3 - Better Quality)</option>
            <option value="dev-worker">⚡ Dev Worker (Cloudflare AI - Faster)</option>
          </select>
        </div>

        <!-- Script Style -->
        <div class="form-group">
          <label class="form-label">🎨 Script Style:</label>
          <select v-model="scriptStyle" class="form-control">
            <option value="tutorial">📚 Tutorial (Step-by-step)</option>
            <option value="overview">🔍 Overview (High-level)</option>
            <option value="demo">🎯 Demo (Show-and-tell)</option>
            <option value="explainer">💡 Explainer (Problem-solution)</option>
          </select>
        </div>

        <!-- Target Duration -->
        <div class="form-group">
          <label class="form-label">⏱️ Target Duration:</label>
          <select v-model="targetDuration" class="form-control">
            <option value="2-5 minutes">2-5 minutes (Short)</option>
            <option value="5-10 minutes">5-10 minutes (Medium)</option>
            <option value="10-15 minutes">10-15 minutes (Long)</option>
            <option value="15+ minutes">15+ minutes (Deep dive)</option>
          </select>
        </div>

        <!-- Options -->
        <div class="form-group">
          <label class="form-label">📝 Options:</label>
          <div class="form-check">
            <input
              id="includeTimestamps"
              v-model="includeTimestamps"
              type="checkbox"
              class="form-check-input"
            />
            <label class="form-check-label" for="includeTimestamps">
              Include timestamps for YouTube chapters
            </label>
          </div>
          <div class="form-check">
            <input
              id="includeEngagement"
              v-model="includeEngagement"
              type="checkbox"
              class="form-check-input"
            />
            <label class="form-check-label" for="includeEngagement">
              Include engagement prompts (subscribe, like, comment)
            </label>
          </div>
        </div>

        <!-- Generate Button -->
        <div class="form-group">
          <button
            @click="generateScript"
            :disabled="!markdownContent.trim() || isGenerating"
            class="btn btn-primary btn-lg generate-btn"
          >
            <span v-if="isGenerating">🔄 Generating Script...</span>
            <span v-else>✨ Generate Learning Content</span>
          </button>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="alert alert-danger"><strong>❌ Error:</strong> {{ error }}</div>

        <!-- Success Message -->
        <div v-if="successMessage" class="alert alert-success">
          <strong>✅ Success:</strong> {{ successMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] }),
  },
  showControls: {
    type: Boolean,
    default: false,
  },
})

// Emits
const emit = defineEmits(['node-created'])

// Reactive state
const markdownContent = ref('')
const youtubeUrl = ref('')
const aiProvider = ref('api-worker')
const scriptStyle = ref('tutorial')
const targetDuration = ref('5-10 minutes')
const includeTimestamps = ref(true)
const includeEngagement = ref(true)
const isGenerating = ref(false)
const error = ref('')
const successMessage = ref('')

// Methods
const generateScript = async () => {
  if (!markdownContent.value.trim()) {
    error.value = 'Please provide markdown documentation'
    return
  }

  isGenerating.value = true
  error.value = ''
  successMessage.value = ''

  try {
    // Determine API endpoint based on provider
    const endpoint =
      aiProvider.value === 'api-worker'
        ? 'https://api.vegvisr.org/generate-youtube-script'
        : 'https://knowledge-graph-worker.torarnehave.workers.dev/generate-youtube-script'

    console.log('🎬 Generating YouTube script with:', {
      aiProvider: aiProvider.value,
      endpoint,
      markdownLength: markdownContent.value.length,
      youtubeUrl: youtubeUrl.value,
      scriptStyle: scriptStyle.value,
      targetDuration: targetDuration.value,
    })

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        markdown: markdownContent.value,
        youtubeUrl: youtubeUrl.value,
        aiProvider: aiProvider.value,
        scriptStyle: scriptStyle.value,
        targetDuration: targetDuration.value,
        includeTimestamps: includeTimestamps.value,
        includeEngagement: includeEngagement.value,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Script generation failed')
    }

    console.log('✅ Script generated successfully:', {
      scriptLength: result.script.length,
      videoId: result.videoId,
      provider: result.provider,
    })

    // Create nodes
    await createNodes(result.script, result.videoId)

    successMessage.value = 'Learning content generated successfully!'

    // Clear form after successful generation
    setTimeout(() => {
      markdownContent.value = ''
      youtubeUrl.value = ''
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    console.error('❌ Script generation error:', err)
    error.value = err.message
  } finally {
    isGenerating.value = false
  }
}

const createNodes = async (script, videoId) => {
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0
      const v = c == 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const nodes = []

  // Create fulltext node with the script
  const scriptNode = {
    id: generateUUID(),
    label: 'YouTube Script',
    type: 'fulltext',
    color: '#e8f5e8',
    info: script,
    bibl: [],
    imageWidth: '100%',
    imageHeight: '100%',
    visible: true,
    path: null,
  }
  nodes.push(scriptNode)

  // Create YouTube video node if URL provided
  if (youtubeUrl.value && videoId) {
    const embedUrl = `https://www.youtube.com/embed/${videoId}`
    const videoNode = {
      id: generateUUID(),
      label: `![YOUTUBE src=${embedUrl}]Learning Video[END YOUTUBE]`,
      type: 'youtube-video',
      color: '#FF0000',
      info: "[SECTION | background-color:'#FFF'; color:'#333']\nGenerated learning content from documentation\n[END SECTION]",
      bibl: [youtubeUrl.value],
      imageWidth: '100%',
      imageHeight: '100%',
      visible: true,
      path: null,
    }
    nodes.push(videoNode)
  }

  // Emit node creation events
  nodes.forEach((node) => {
    emit('node-created', node)
  })
}
</script>

<style scoped>
.gnew-learn-script-node {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.node-header {
  text-align: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #dee2e6;
}

.node-title {
  color: #2c3e50;
  margin-bottom: 8px;
  font-size: 1.5rem;
}

.node-description {
  color: #6c757d;
  margin-bottom: 0;
  font-size: 1rem;
}

.form-container {
  max-width: 600px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #495057;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.markdown-input {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.4;
  resize: vertical;
  min-height: 200px;
}

.form-check {
  margin-bottom: 8px;
}

.form-check-input {
  margin-right: 8px;
}

.form-check-label {
  font-weight: normal;
  color: #495057;
}

.generate-btn {
  width: 100%;
  padding: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  background: linear-gradient(45deg, #28a745, #20c997);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.generate-btn:hover:not(:disabled) {
  background: linear-gradient(45deg, #218838, #1aa179);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.alert {
  padding: 10px 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.alert-danger {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.alert-success {
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.form-text {
  font-size: 0.875rem;
  color: #6c757d;
  margin-top: 4px;
}

select.form-control {
  background: white;
  cursor: pointer;
}

select.form-control:focus {
  outline: none;
  border-color: #007bff;
}

/* Responsive design */
@media (max-width: 768px) {
  .gnew-learn-script-node {
    padding: 15px;
  }

  .form-container {
    max-width: 100%;
  }

  .node-title {
    font-size: 1.3rem;
  }

  .markdown-input {
    min-height: 150px;
  }
}
</style>
