<template>
  <div class="gnew-image-analysis-node">
    <!-- Node Header -->
    <div class="node-header">
      <div class="node-title-section">
        <span class="node-icon">🔍</span>
        <span class="node-label">{{ node.label || 'Image Analysis' }}</span>
        <div class="node-type-badge-inline">IMAGE_ANALYSIS</div>
      </div>
      <div v-if="showControls" class="node-controls">
        <button @click="editNode" class="btn-control edit" title="Edit Node">
          <i class="bi bi-pencil"></i>
        </button>
        <button @click="deleteNode" class="btn-control delete" title="Delete Node">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>

    <!-- OpenAI Configuration Section -->
    <div class="control-section ai-config-section">
      <h6 class="section-title">
        <span class="section-icon">🤖</span>
        OpenAI Vision Configuration
      </h6>
      <div class="config-grid">
        <div class="config-item">
          <label class="config-label">Model:</label>
          <select v-model="selectedModel" class="form-control config-select">
            <option value="gpt-4o">GPT-4o (Most Capable)</option>
            <option value="gpt-4o-mini">GPT-4o Mini (Cost-effective)</option>
          </select>
        </div>
        <div class="config-item">
          <label class="config-label">Max Tokens:</label>
          <input
            type="number"
            v-model="maxTokens"
            min="100"
            max="4096"
            class="form-control config-input"
            placeholder="1024"
          />
        </div>
      </div>
    </div>

    <!-- Image Upload Section -->
    <div class="control-section image-upload-section">
      <h6 class="section-title">
        <span class="section-icon">🖼️</span>
        Image Input
      </h6>

      <!-- Image Upload Methods -->
      <div class="upload-methods">
        <div class="method-tabs">
          <button
            @click="uploadMethod = 'file'"
            :class="{ active: uploadMethod === 'file' }"
            class="method-tab"
          >
            📁 Upload File
          </button>
          <button
            @click="uploadMethod = 'url'"
            :class="{ active: uploadMethod === 'url' }"
            class="method-tab"
          >
            🌐 Image URL
          </button>
          <button
            @click="uploadMethod = 'paste'"
            :class="{ active: uploadMethod === 'paste' }"
            class="method-tab"
          >
            📋 Paste Image
          </button>
        </div>

        <!-- File Upload -->
        <div
          v-if="uploadMethod === 'file'"
          class="upload-area"
          @dragover.prevent
          @drop.prevent="handleFileDrop"
        >
          <input
            ref="fileInput"
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
            @change="handleFileSelect"
            class="file-input"
            style="display: none"
          />
          <button @click="$refs.fileInput.click()" class="btn btn-outline-primary upload-btn">
            <span class="btn-icon">📁</span>
            Choose Image File
          </button>
          <div class="upload-hint">or drag & drop image here</div>
          <div class="format-info">Supported formats: JPEG, PNG, GIF, WebP (max 5MB)</div>
        </div>

        <!-- URL Input -->
        <div v-if="uploadMethod === 'url'" class="url-input-section">
          <input
            type="url"
            v-model="imageUrl"
            @input="handleUrlChange"
            placeholder="https://example.com/image.jpg"
            class="form-control url-input"
          />
          <button @click="loadImageFromUrl" :disabled="!imageUrl" class="btn btn-outline-primary">
            Load Image
          </button>
        </div>

        <!-- Paste Image -->
        <div
          v-if="uploadMethod === 'paste'"
          class="paste-area"
          @paste="handlePaste"
          @click="focusPasteArea"
          tabindex="0"
          ref="pasteArea"
        >
          <div class="paste-content">
            <div class="paste-icon">📋</div>
            <div class="paste-text">Click here and paste an image</div>
            <div class="paste-hint">Use Ctrl+V (Windows) or Cmd+V (Mac)</div>
            <div class="paste-instructions">
              <small>Copy an image from anywhere and paste it here</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Image Preview -->
      <div v-if="selectedImage" class="image-preview-section">
        <div class="image-preview">
          <img
            :src="imagePreviewUrl"
            :alt="selectedImage.name || 'Selected image'"
            class="preview-image"
          />
          <button @click="clearImage" class="btn btn-sm btn-outline-danger clear-btn">
            ❌ Clear
          </button>
        </div>
        <div class="image-info">
          <div v-if="selectedImage.name" class="file-info">
            <strong>File:</strong> {{ selectedImage.name }}
          </div>
          <div v-if="selectedImage.size" class="size-info">
            <strong>Size:</strong> {{ formatFileSize(selectedImage.size) }}
          </div>
          <div v-if="selectedImage.type" class="type-info">
            <strong>Type:</strong> {{ selectedImage.type }}
          </div>
        </div>
      </div>
    </div>

    <!-- Analysis Configuration Section -->
    <div class="control-section analysis-config-section">
      <h6 class="section-title">
        <span class="section-icon">💭</span>
        Analysis Configuration
      </h6>

      <!-- Analysis Type Selection -->
      <div class="analysis-type-section">
        <label class="config-label">Analysis Type:</label>
        <select
          v-model="analysisType"
          @change="updateAnalysisPrompt"
          class="form-control config-select"
        >
          <option value="general">🔍 General Description</option>
          <option value="detailed">📝 Detailed Analysis</option>
          <option value="objects">🎯 Object Detection</option>
          <option value="text">📄 Text Extraction (OCR)</option>
          <option value="medical">🏥 Medical Analysis</option>
          <option value="technical">⚙️ Technical Analysis</option>
          <option value="artistic">🎨 Artistic Analysis</option>
          <option value="custom">✏️ Custom Prompt</option>
        </select>
      </div>

      <!-- Analysis Prompt -->
      <div class="analysis-prompt-section">
        <label class="config-label">Analysis Prompt:</label>
        <textarea
          v-model="analysisPrompt"
          class="form-control analysis-prompt-textarea"
          rows="4"
          placeholder="Enter your analysis prompt..."
        ></textarea>
        <div class="prompt-info">
          <small class="text-muted">
            Describe what you want the AI to analyze in the image. Be specific for better results.
          </small>
        </div>
      </div>

      <!-- Analysis Options -->
      <div class="analysis-options">
        <div class="option-group">
          <label class="option-checkbox">
            <input type="checkbox" v-model="createResultNode" />
            <span class="option-label">📝 Create fulltext node with results</span>
          </label>
        </div>
        <div class="option-group">
          <label class="option-checkbox">
            <input type="checkbox" v-model="includeImageContext" />
            <span class="option-label">🔗 Include image context in analysis</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Analysis Action Section -->
    <div class="control-section action-section">
      <div class="action-buttons">
        <button
          @click="analyzeImage"
          :disabled="isAnalyzing || !selectedImage || !analysisPrompt"
          class="btn btn-primary analyze-btn"
        >
          <span v-if="isAnalyzing" class="spinner-border spinner-border-sm me-2"></span>
          <span class="btn-icon">🚀</span>
          {{ isAnalyzing ? 'Analyzing...' : 'Analyze Image' }}
        </button>
        <button @click="resetAnalysis" class="btn btn-outline-secondary">
          <span class="btn-icon">🔄</span>
          Reset
        </button>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="isAnalyzing" class="loading-overlay">
      <div class="loading-content">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="loading-text">{{ loadingMessage }}</p>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="analysisResult" class="control-section results-section">
      <h6 class="section-title">
        <span class="section-icon">📊</span>
        Analysis Results
      </h6>
      <div class="results-content">
        <div class="result-text">{{ analysisResult }}</div>
        <div class="result-actions">
          <button
            v-if="!resultNodeCreated && createResultNode"
            @click="createFulltextNode"
            class="btn btn-success create-node-btn"
          >
            <span class="btn-icon">➕</span>
            Create Fulltext Node
          </button>
          <button @click="copyResult" class="btn btn-outline-primary">
            <span class="btn-icon">📋</span>
            Copy Result
          </button>
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="alert alert-danger error-alert">
      <strong>❌ Error:</strong> {{ error }}
      <button @click="clearError" class="btn-close" aria-label="Close"></button>
    </div>

    <!-- Success Display -->
    <div v-if="successMessage" class="alert alert-success success-alert">
      <strong>✅ Success:</strong> {{ successMessage }}
      <button @click="clearSuccess" class="btn-close" aria-label="Close"></button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  showControls: {
    type: Boolean,
    default: true,
  },
})

// Emits
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Reactive data
const selectedModel = ref('gpt-4o')
const maxTokens = ref(1024)
const uploadMethod = ref('file')
const selectedImage = ref(null)
const imageUrl = ref('')
const imagePreviewUrl = ref('')
const analysisType = ref('general')
const analysisPrompt = ref('')
const createResultNode = ref(true)
const includeImageContext = ref(false)
const isAnalyzing = ref(false)
const loadingMessage = ref('')
const analysisResult = ref('')
const resultNodeCreated = ref(false)
const error = ref('')
const successMessage = ref('')

// Template refs
const pasteArea = ref(null)

// Analysis type prompts
const analysisPrompts = {
  general: 'Describe this image in detail. What do you see?',
  detailed:
    'Provide a comprehensive analysis of this image. Include details about objects, people, setting, mood, colors, composition, and any notable features.',
  objects:
    'Identify and list all objects visible in this image. Describe their locations, sizes, and relationships to each other.',
  text: 'Extract and transcribe all text visible in this image. Preserve the original formatting and structure as much as possible.',
  medical:
    'Analyze this medical image. Describe any visible anatomical structures, potential abnormalities, or clinically relevant findings. Note: This is for educational purposes only.',
  technical:
    'Provide a technical analysis of this image. Focus on technical aspects, components, measurements, or engineering details visible.',
  artistic:
    'Analyze this image from an artistic perspective. Comment on composition, color theory, style, technique, and aesthetic qualities.',
  custom: '',
}

// Methods
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    processImageFile(file)
  }
}

const handleFileDrop = (event) => {
  const file = event.dataTransfer.files[0]
  if (file && file.type.startsWith('image/')) {
    processImageFile(file)
  }
}

const processImageFile = (file) => {
  // Check file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'Image file size must be less than 5MB'
    return
  }

  selectedImage.value = file

  // Create preview URL
  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreviewUrl.value = e.target.result
  }
  reader.readAsDataURL(file)

  clearError()
}

const handleUrlChange = () => {
  clearError()
}

const loadImageFromUrl = async () => {
  if (!imageUrl.value) return

  try {
    // Create a temporary image object to validate URL
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      selectedImage.value = {
        url: imageUrl.value,
        name: imageUrl.value.split('/').pop(),
        type: 'image/url',
      }
      imagePreviewUrl.value = imageUrl.value
      clearError()
    }

    img.onerror = () => {
      error.value = 'Failed to load image from URL. Please check the URL and try again.'
    }

    img.src = imageUrl.value
  } catch (err) {
    error.value = 'Invalid image URL'
  }
}

const clearImage = () => {
  selectedImage.value = null
  imagePreviewUrl.value = ''
  imageUrl.value = ''
  analysisResult.value = ''
  resultNodeCreated.value = false
  clearError()
}

const handlePaste = async (event) => {
  const clipboardData = event.clipboardData || window.clipboardData
  const items = clipboardData.items

  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        processImageFile(file)
        successMessage.value = 'Image pasted successfully!'
        setTimeout(() => {
          successMessage.value = ''
        }, 3000)
      }
      break
    }
  }
}

const focusPasteArea = () => {
  // Focus the paste area to ensure paste events are captured
  if (pasteArea.value) {
    pasteArea.value.focus()
  }
}

const updateAnalysisPrompt = () => {
  if (analysisType.value !== 'custom') {
    analysisPrompt.value = analysisPrompts[analysisType.value]
  }
}

const analyzeImage = async () => {
  if (!selectedImage.value || !analysisPrompt.value) return

  isAnalyzing.value = true
  loadingMessage.value = 'Preparing image for analysis...'
  resultNodeCreated.value = false

  try {
    let requestBody

    if (selectedImage.value.url) {
      // URL-based image
      requestBody = {
        imageUrl: selectedImage.value.url,
        prompt: analysisPrompt.value,
        analysisType: analysisType.value,
        model: selectedModel.value,
        maxTokens: maxTokens.value,
        includeImageContext: includeImageContext.value,
      }
    } else {
      // File-based image - convert to base64
      loadingMessage.value = 'Converting image to base64...'
      const base64DataUrl = await convertImageToBase64(selectedImage.value)
      requestBody = {
        image: base64DataUrl,
        prompt: analysisPrompt.value,
        analysisType: analysisType.value,
        model: selectedModel.value,
        maxTokens: maxTokens.value,
        includeImageContext: includeImageContext.value,
      }
    }

    loadingMessage.value = 'Sending to image analysis service...'

    // Call the independent image analysis worker
    const response = await fetch(
      'https://image-analysis-worker.torarnehave.workers.dev/analyze-image',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Image analysis service request failed')
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Image analysis failed')
    }

    analysisResult.value = data.analysis

    successMessage.value = 'Image analysis completed successfully!'

    // Auto-create node if enabled
    if (createResultNode.value) {
      await createFulltextNode()
    }
  } catch (err) {
    error.value = err.message || 'Failed to analyze image'
    console.error('Image analysis error:', err)
  } finally {
    isAnalyzing.value = false
    loadingMessage.value = ''
  }
}

const convertImageToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // Return the full data URL (data:image/type;base64,...)
      resolve(reader.result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const createFulltextNode = async () => {
  if (!analysisResult.value) return

  try {
    const newNode = {
      id: `node_${Date.now()}`,
      type: 'fulltext',
      label: `Image Analysis: ${analysisType.value}`,
      info: analysisResult.value,
      position: {
        x: props.node.position.x + 300,
        y: props.node.position.y + 100,
      },
    }

    emit('node-created', newNode)
    resultNodeCreated.value = true
    successMessage.value = 'Fulltext node created with analysis results!'
  } catch (err) {
    error.value = 'Failed to create fulltext node'
    console.error('Node creation error:', err)
  }
}

const copyResult = async () => {
  if (!analysisResult.value) return

  try {
    await navigator.clipboard.writeText(analysisResult.value)
    successMessage.value = 'Analysis result copied to clipboard!'
  } catch (err) {
    error.value = 'Failed to copy result to clipboard'
  }
}

const resetAnalysis = () => {
  clearImage()
  analysisResult.value = ''
  resultNodeCreated.value = false
  error.value = ''
  successMessage.value = ''
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const editNode = () => {
  // Implementation for editing the node
  emit('node-updated', { ...props.node, editing: true })
}

const deleteNode = () => {
  emit('node-deleted', props.node.id)
}

const clearError = () => {
  error.value = ''
}

const clearSuccess = () => {
  successMessage.value = ''
}

// Initialize
onMounted(() => {
  updateAnalysisPrompt()

  // Add global paste event listener for when paste method is active
  const globalPasteHandler = (event) => {
    if (uploadMethod.value === 'paste') {
      handlePaste(event)
    }
  }

  document.addEventListener('paste', globalPasteHandler)

  // Clean up on unmount
  onUnmounted(() => {
    document.removeEventListener('paste', globalPasteHandler)
  })
})

// Watch for analysis type changes
watch(analysisType, updateAnalysisPrompt)
</script>

<style scoped>
.gnew-image-analysis-node {
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 16px;
  margin: 8px 0;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* Node Header */
.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.node-title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.node-icon {
  font-size: 1.5rem;
}

.node-label {
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.node-type-badge-inline {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  flex-shrink: 0;
}

.node-controls {
  display: flex;
  gap: 8px;
}

.btn-control {
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-control:hover {
  background: #f5f5f5;
}

.btn-control.edit:hover {
  border-color: #007bff;
  color: #007bff;
}

.btn-control.delete:hover {
  border-color: #dc3545;
  color: #dc3545;
}

/* Control Sections */
.control-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.section-icon {
  font-size: 1.2rem;
}

/* Configuration Grid */
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #555;
}

.config-select,
.config-input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

/* Upload Methods */
.upload-methods {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.method-tabs {
  display: flex;
  gap: 8px;
}

.method-tab {
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.method-tab.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.method-tab:hover:not(.active) {
  background: #f5f5f5;
}

/* Upload Area */
.upload-area {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  transition: border-color 0.2s;
}

.upload-area:hover {
  border-color: #007bff;
}

.upload-btn {
  background: #fff;
  border: 1px solid #007bff;
  color: #007bff;
  padding: 12px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.upload-btn:hover {
  background: #007bff;
  color: white;
}

.upload-hint {
  margin-top: 12px;
  color: #666;
  font-size: 0.9rem;
}

.format-info {
  margin-top: 8px;
  color: #888;
  font-size: 0.8rem;
}

/* URL Input */
.url-input-section {
  display: flex;
  gap: 12px;
  align-items: center;
}

.url-input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

/* Image Preview */
.image-preview-section {
  margin-top: 16px;
}

.image-preview {
  position: relative;
  display: inline-block;
}

.preview-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.clear-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(220, 53, 69, 0.9);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 0.8rem;
}

.image-info {
  margin-top: 12px;
  display: flex;
  gap: 16px;
  font-size: 0.9rem;
  color: #666;
}

/* Analysis Configuration */
.analysis-type-section,
.analysis-prompt-section {
  margin-bottom: 16px;
}

.analysis-prompt-textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  resize: vertical;
}

.prompt-info {
  margin-top: 4px;
}

.analysis-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.option-label {
  font-size: 0.9rem;
  color: #555;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.btn-outline-secondary {
  background: #fff;
  color: #6c757d;
  border: 1px solid #6c757d;
}

.btn-outline-secondary:hover {
  background: #6c757d;
  color: white;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #218838;
}

.btn-outline-primary {
  background: #fff;
  color: #007bff;
  border: 1px solid #007bff;
}

.btn-outline-primary:hover {
  background: #007bff;
  color: white;
}

.btn-icon {
  font-size: 1.1rem;
}

/* Loading Overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  z-index: 10;
}

.loading-content {
  text-align: center;
}

.loading-text {
  margin-top: 12px;
  color: #666;
  font-size: 0.9rem;
}

/* Results Section */
.results-section {
  background: #e8f5e8;
  border-left: 4px solid #28a745;
}

.results-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-text {
  background: white;
  padding: 16px;
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #333;
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
}

.result-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* Alerts */
.alert {
  padding: 12px 16px;
  margin: 16px 0;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.alert-danger {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.alert-success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
}

.btn-close:hover {
  opacity: 1;
}

/* Responsive Design */
@media (max-width: 768px) {
  .config-grid {
    grid-template-columns: 1fr;
  }

  .url-input-section {
    flex-direction: column;
    align-items: stretch;
  }

  .action-buttons {
    flex-direction: column;
  }

  .result-actions {
    flex-direction: column;
  }

  .image-info {
    flex-direction: column;
    gap: 8px;
  }

  .paste-area {
    padding: 16px;
  }
}

/* Paste Area Styling */
.paste-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px 20px;
  background: #fafafa;
  cursor: pointer;
  transition: all 0.3s ease;
  outline: none;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.paste-area:hover {
  border-color: #007bff;
  background: #f8f9ff;
}

.paste-area:focus {
  border-color: #007bff;
  background: #f8f9ff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.paste-content {
  text-align: center;
  color: #666;
}

.paste-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  opacity: 0.7;
}

.paste-text {
  font-size: 1.1rem;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.paste-hint {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 8px;
}

.paste-instructions {
  font-size: 0.85rem;
  color: #999;
}

.paste-area:hover .paste-icon {
  opacity: 1;
}

.paste-area:hover .paste-text {
  color: #007bff;
}
</style>
