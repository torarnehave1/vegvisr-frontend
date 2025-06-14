<template>
  <div v-if="isOpen" class="ai-image-modal">
    <div class="ai-image-modal-content">
      <div class="ai-image-header">
        <h3>🎨 AI Image Generator</h3>
        <button class="ai-image-close" @click="closeModal" title="Close">&times;</button>
      </div>

      <div v-if="!generatedImage" class="ai-image-form">
        <!-- Prompt Input -->
        <div class="form-section">
          <label for="imagePrompt" class="form-label">
            <strong>📝 Image Description:</strong>
          </label>
          <textarea
            id="imagePrompt"
            v-model="imagePrompt"
            class="form-control prompt-textarea"
            placeholder="Describe the image you want to generate... e.g., 'A beautiful sunset over a mountain landscape with vibrant colors'"
            rows="4"
          ></textarea>
          <small class="form-text text-muted">
            Be descriptive and specific for better results. Include details about style, colors,
            composition, etc.
          </small>
        </div>

        <!-- Model Selection -->
        <div class="form-section">
          <label for="modelSelect" class="form-label">
            <strong>🤖 AI Model:</strong>
          </label>
          <select
            id="modelSelect"
            v-model="selectedModel"
            class="form-control"
            @change="updateModelSettings"
          >
            <option value="dall-e-2">DALL-E 2 (Fast, Standard Quality)</option>
            <option value="dall-e-3">DALL-E 3 (High Quality, Better Prompt Understanding)</option>
            <option value="gpt-image-1">GPT-Image-1 (Latest, Best Instruction Following)</option>
          </select>
          <small class="form-text text-muted model-info">
            {{ getModelDescription(selectedModel) }}
          </small>
        </div>

        <!-- Size Selection -->
        <div class="form-section">
          <label for="sizeSelect" class="form-label">
            <strong>📐 Image Size:</strong>
          </label>
          <select id="sizeSelect" v-model="selectedSize" class="form-control">
            <option
              v-for="size in availableSizes"
              :key="size"
              :value="size"
              :disabled="!availableSizes.includes(size)"
            >
              {{ formatSizeDisplay(size) }}
            </option>
          </select>
          <small class="form-text text-muted">
            Choose the size based on your intended use. Larger sizes take more time to generate.
          </small>
        </div>

        <!-- Quality Selection -->
        <div class="form-section">
          <label for="qualitySelect" class="form-label">
            <strong>⭐ Quality:</strong>
          </label>
          <select id="qualitySelect" v-model="selectedQuality" class="form-control">
            <option
              v-for="quality in availableQualities"
              :key="quality"
              :value="quality"
              :disabled="!availableQualities.includes(quality)"
            >
              {{ formatQualityDisplay(quality) }}
            </option>
          </select>
          <small class="form-text text-muted">
            {{ getQualityDescription(selectedQuality) }}
          </small>
        </div>

        <!-- Image Type Selection -->
        <div class="form-section">
          <label for="imageTypeSelect" class="form-label">
            <strong>🖼️ Image Type:</strong>
          </label>
          <select id="imageTypeSelect" v-model="selectedImageType" class="form-control">
            <option value="header">Header Image (Full Width, for page headers)</option>
            <option value="leftside">Leftside Image (Small, left-aligned with text)</option>
            <option value="rightside">Rightside Image (Small, right-aligned with text)</option>
            <option value="standalone">Standalone Image (Medium size, centered)</option>
          </select>
          <small class="form-text text-muted">
            Choose how you want the image to be displayed in your content.
          </small>
        </div>

        <!-- Generation Settings Summary -->
        <div class="generation-summary">
          <h5>📋 Generation Summary:</h5>
          <ul>
            <li><strong>Model:</strong> {{ selectedModel.toUpperCase() }}</li>
            <li><strong>Size:</strong> {{ selectedSize }}</li>
            <li><strong>Quality:</strong> {{ selectedQuality.toUpperCase() }}</li>
            <li>
              <strong>Type:</strong>
              {{ selectedImageType.charAt(0).toUpperCase() + selectedImageType.slice(1) }}
            </li>
          </ul>
        </div>

        <!-- Action Buttons -->
        <div class="modal-actions">
          <button
            @click="generateImage"
            class="btn btn-primary generate-btn"
            :disabled="!imagePrompt.trim() || isGenerating"
          >
            <span v-if="isGenerating">
              <span class="spinner-border spinner-border-sm me-2"></span>
              Generating...
            </span>
            <span v-else> 🎨 Generate Image </span>
          </button>
          <button @click="closeModal" class="btn btn-secondary">Cancel</button>
        </div>
      </div>

      <!-- Generated Image Preview -->
      <div v-else class="ai-image-result">
        <div class="image-preview-section">
          <h4>🖼️ Generated Image Preview</h4>
          <div class="image-preview-container">
            <img
              :src="generatedImage.imageUrl"
              :alt="generatedImage.prompt"
              class="generated-image-preview"
            />
          </div>

          <!-- Image Details -->
          <div class="image-details">
            <div class="detail-row">
              <span class="detail-label">Model:</span>
              <span class="detail-value">{{ generatedImage.model.toUpperCase() }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Size:</span>
              <span class="detail-value">{{ generatedImage.size }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Quality:</span>
              <span class="detail-value">{{ generatedImage.quality.toUpperCase() }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Type:</span>
              <span class="detail-value">{{
                generatedImage.imageType.charAt(0).toUpperCase() + generatedImage.imageType.slice(1)
              }}</span>
            </div>
          </div>

          <!-- Generated Markdown Preview -->
          <div class="markdown-preview">
            <h5>📄 Generated Markdown:</h5>
            <pre class="markdown-code">{{ generatedImage.markdown }}</pre>
          </div>
        </div>

        <!-- Result Actions -->
        <div class="result-actions">
          <button @click="insertImageToGraph" class="btn btn-success insert-btn">
            ✅ Insert into Graph
          </button>
          <button @click="regenerateImage" class="btn btn-warning">🔄 Generate New Image</button>
          <button @click="closeModal" class="btn btn-secondary">Close</button>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div v-if="isGenerating" class="generation-loading-overlay">
        <div class="loading-content">
          <div class="spinner-large"></div>
          <h4>🎨 Generating Your Image...</h4>
          <p>Using {{ selectedModel.toUpperCase() }} to create your image</p>
          <div class="loading-progress">
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
          </div>
          <small>This may take 10-30 seconds depending on the model and complexity.</small>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="errorMessage" class="alert alert-danger error-message">
        <strong>❌ Error:</strong> {{ errorMessage }}
        <button @click="clearError" class="btn btn-sm btn-outline-danger ms-2">Clear</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  graphContext: {
    type: Object,
    default: () => ({}),
  },
})

// Emits
const emit = defineEmits(['close', 'image-inserted'])

// Modal state
const imagePrompt = ref('')
const selectedModel = ref('dall-e-3') // Default to DALL-E 3 for better quality
const selectedSize = ref('1024x1024')
const selectedQuality = ref('standard')
const selectedImageType = ref('header')
const isGenerating = ref(false)
const generatedImage = ref(null)
const errorMessage = ref('')

// Model configurations
const modelConfig = {
  'dall-e-2': {
    sizes: ['256x256', '512x512', '1024x1024'],
    qualities: ['standard'],
    description: 'Fast generation with good quality. Best for simple concepts and quick results.',
  },
  'dall-e-3': {
    sizes: ['1024x1024', '1024x1792', '1792x1024'],
    qualities: ['standard', 'hd'],
    description:
      'High quality with excellent prompt understanding. Best for complex, detailed images.',
  },
  'gpt-image-1': {
    sizes: ['1024x1024', '1024x1536', '1536x1024', 'auto'],
    qualities: ['auto', 'high', 'medium', 'low'],
    description: 'Latest model with superior instruction following and contextual awareness.',
  },
}

// Computed properties
const availableSizes = computed(() => {
  return modelConfig[selectedModel.value]?.sizes || []
})

const availableQualities = computed(() => {
  return modelConfig[selectedModel.value]?.qualities || []
})

// Methods
const updateModelSettings = () => {
  const config = modelConfig[selectedModel.value]

  // Reset size to first available option if current size is not supported
  if (!config.sizes.includes(selectedSize.value)) {
    selectedSize.value = config.sizes[0]
  }

  // Reset quality to first available option if current quality is not supported
  if (!config.qualities.includes(selectedQuality.value)) {
    selectedQuality.value = config.qualities[0]
  }
}

const getModelDescription = (model) => {
  return modelConfig[model]?.description || ''
}

const formatSizeDisplay = (size) => {
  if (size === 'auto') return 'Auto (Optimal for content)'

  const [width, height] = size.split('x')
  const megapixels = ((parseInt(width) * parseInt(height)) / 1000000).toFixed(1)

  if (width === height) {
    return `${size} (Square, ${megapixels}MP)`
  } else if (parseInt(width) > parseInt(height)) {
    return `${size} (Landscape, ${megapixels}MP)`
  } else {
    return `${size} (Portrait, ${megapixels}MP)`
  }
}

const formatQualityDisplay = (quality) => {
  const qualityMap = {
    auto: 'Auto (Balanced)',
    standard: 'Standard',
    hd: 'HD (High Definition)',
    high: 'High',
    medium: 'Medium',
    low: 'Low (Faster)',
  }
  return qualityMap[quality] || quality
}

const getQualityDescription = (quality) => {
  const descriptions = {
    auto: 'AI chooses the best quality for your prompt',
    standard: 'Good quality, faster generation',
    hd: 'Highest quality available, slower generation',
    high: 'High quality with detailed features',
    medium: 'Balanced quality and speed',
    low: 'Basic quality, fastest generation',
  }
  return descriptions[quality] || ''
}

const generateImage = async () => {
  if (!imagePrompt.value.trim()) {
    errorMessage.value = 'Please enter a description for your image.'
    return
  }

  isGenerating.value = true
  errorMessage.value = ''

  try {
    console.log('=== Generating AI Image ===')
    console.log('Prompt:', imagePrompt.value)
    console.log('Model:', selectedModel.value)
    console.log('Size:', selectedSize.value)
    console.log('Quality:', selectedQuality.value)
    console.log('Image Type:', selectedImageType.value)

    // Build the request payload
    const requestBody = {
      prompt: imagePrompt.value.trim(),
      model: selectedModel.value,
      size: selectedSize.value,
      quality: selectedQuality.value,
      imageType: selectedImageType.value,
    }

    console.log('Request body:', requestBody)

    const response = await fetch('https://api.vegvisr.org/gpt4-vision-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `API Error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log('Generation result:', result)

    // Extract image information from result
    generatedImage.value = {
      imageUrl: result.metadata?.generatedImageUrl || extractImageUrl(result.info),
      markdown: result.info,
      prompt: result.metadata?.originalPrompt || imagePrompt.value,
      model: result.metadata?.model || selectedModel.value,
      size: result.metadata?.size || selectedSize.value,
      quality: result.metadata?.quality || selectedQuality.value,
      imageType: result.metadata?.imageType || selectedImageType.value,
      nodeData: result,
    }

    console.log('=== Generated Image Data ===')
    console.log('Image URL:', generatedImage.value.imageUrl)
    console.log('Markdown:', generatedImage.value.markdown)
    console.log('Size:', generatedImage.value.size)
    console.log('Model:', generatedImage.value.model)
    console.log('Quality:', generatedImage.value.quality)

    console.log('Generated image data:', generatedImage.value)
  } catch (error) {
    console.error('Error generating image:', error)
    errorMessage.value = error.message || 'Failed to generate image. Please try again.'
  } finally {
    isGenerating.value = false
  }
}

const extractImageUrl = (markdown) => {
  // Extract URL from markdown image syntax: ![alt](url)
  const match = markdown.match(/!\[.*?\]\((.+?)\)/)
  return match ? match[1] : null
}

const insertImageToGraph = () => {
  console.log('=== Inserting Image to Graph ===')
  console.log('Generated image:', generatedImage.value)

  if (generatedImage.value?.markdown && generatedImage.value?.imageUrl) {
    // Create a proper markdown-image node
    const newNode = {
      id: crypto.randomUUID(),
      label: generatedImage.value.markdown,
      color: 'white',
      type: 'markdown-image',
      info: null,
      bibl: [],
      imageWidth: generatedImage.value.size?.split('x')[0] || '1024',
      imageHeight: generatedImage.value.size?.split('x')[1] || '1024',
      visible: true,
      path: null,
    }

    console.log('Created markdown-image node:', newNode)

    // Emit the node data for insertion
    emit('image-inserted', newNode)
    closeModal()
  } else {
    errorMessage.value = 'No image data available for insertion.'
  }
}

const regenerateImage = () => {
  generatedImage.value = null
  errorMessage.value = ''
}

const clearError = () => {
  errorMessage.value = ''
}

const closeModal = () => {
  // Reset all state
  imagePrompt.value = ''
  selectedModel.value = 'dall-e-3'
  selectedSize.value = '1024x1024'
  selectedQuality.value = 'standard'
  selectedImageType.value = 'header'
  isGenerating.value = false
  generatedImage.value = null
  errorMessage.value = ''

  emit('close')
}

// Watch for model changes to update dependent settings
watch(selectedModel, () => {
  updateModelSettings()
})

// Initialize settings when component mounts
updateModelSettings()
</script>

<style scoped>
.ai-image-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.ai-image-modal-content {
  background: #fff;
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  position: relative;
}

.ai-image-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
  background: linear-gradient(135deg, #6f42c1, #8b5cf6);
  color: white;
}

.ai-image-header h3 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}

.ai-image-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.ai-image-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.ai-image-form {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.form-section {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-size: 0.95rem;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.form-control:focus {
  outline: none;
  border-color: #6f42c1;
  box-shadow: 0 0 0 3px rgba(111, 66, 193, 0.1);
}

.prompt-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-text {
  margin-top: 6px;
  font-size: 0.85rem;
}

.model-info {
  font-style: italic;
  color: #6c757d;
}

.generation-summary {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin: 20px 0;
  border-left: 4px solid #6f42c1;
}

.generation-summary h5 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 1rem;
}

.generation-summary ul {
  margin: 0;
  padding-left: 20px;
}

.generation-summary li {
  margin-bottom: 4px;
  color: #555;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
}

.generate-btn {
  min-width: 140px;
}

.ai-image-result {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.image-preview-section h4 {
  margin: 0 0 20px 0;
  color: #333;
  text-align: center;
}

.image-preview-container {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 2px dashed #dee2e6;
}

.generated-image-preview {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.image-details {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid #e9ecef;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-weight: 500;
  color: #6c757d;
}

.detail-value {
  color: #333;
  font-weight: 500;
}

.markdown-preview {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.markdown-preview h5 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 1rem;
}

.markdown-code {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  color: #495057;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.result-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
}

.insert-btn {
  min-width: 160px;
}

.generation-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-content {
  text-align: center;
  max-width: 300px;
}

.loading-content h4 {
  margin: 20px 0 10px 0;
  color: #333;
  font-size: 1.3rem;
}

.loading-content p {
  margin: 0 0 20px 0;
  color: #666;
  font-size: 1rem;
}

.loading-content small {
  color: #888;
  font-size: 0.85rem;
}

.spinner-large {
  width: 60px;
  height: 60px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #6f42c1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

.loading-progress {
  margin: 20px 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6f42c1, #8b5cf6, #6f42c1);
  background-size: 200% 100%;
  animation: progressSlide 2s ease-in-out infinite;
  border-radius: 4px;
}

.error-message {
  margin: 16px 24px;
  border-radius: 8px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes progressSlide {
  0% {
    width: 0%;
    background-position: 0% 50%;
  }
  50% {
    width: 70%;
    background-position: 100% 50%;
  }
  100% {
    width: 100%;
    background-position: 200% 50%;
  }
}

@media (max-width: 768px) {
  .ai-image-modal-content {
    width: 95%;
    max-height: 95vh;
  }

  .ai-image-form,
  .ai-image-result {
    padding: 16px;
  }

  .modal-actions,
  .result-actions {
    padding: 16px;
    flex-direction: column;
  }

  .modal-actions button,
  .result-actions button {
    width: 100%;
    margin-bottom: 8px;
  }

  .modal-actions button:last-child,
  .result-actions button:last-child {
    margin-bottom: 0;
  }
}
</style>
