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
            <option value="gpt-4o">GPT-4o (Most Capable Vision Model)</option>
            <option value="gpt-4o-mini">GPT-4o Mini (Cost-effective Vision Model)</option>
            <option value="gpt-4-vision-preview">GPT-4 Vision Preview (Legacy)</option>
          </select>
          <div class="model-info">
            <small class="text-muted">
              💡 <strong>GPT-4o:</strong> Latest and most capable vision model with enhanced understanding. <strong>GPT-4o Mini:</strong> Cost-effective alternative with good performance. <strong>GPT-4 Vision Preview:</strong> Legacy model for compatibility.
            </small>
          </div>
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
        <div v-if="false" class="config-item">
          <label class="config-label">Verbosity:</label>
          <select v-model="verbosity" class="form-control config-select">
            <option value="high">High (Detailed explanations)</option>
            <option value="medium">Medium (Balanced)</option>
            <option value="low">Low (Concise answers)</option>
          </select>
        </div>
        <div v-if="false" class="config-item">
          <label class="config-label">Reasoning Effort:</label>
          <select v-model="reasoningEffort" class="form-control config-select">
            <option value="medium">Medium (Default)</option>
            <option value="minimal">Minimal (Fastest)</option>
            <option value="low">Low (Speed focused)</option>
            <option value="high">High (Thorough)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Analysis Mode Selection -->
    <div class="control-section analysis-mode-section">
      <h6 class="section-title">
        <span class="section-icon">🎯</span>
        Analysis Mode
      </h6>
      <div class="mode-selector">
        <div class="mode-tabs">
          <button
            @click="analysisMode = 'single'"
            :class="{ active: analysisMode === 'single' }"
            class="mode-tab"
          >
            🔍 Single Image
          </button>
          <button
            @click="analysisMode = 'collection'"
            :class="{ active: analysisMode === 'collection' }"
            class="mode-tab"
          >
            📁 Collection
          </button>
          <button
            @click="analysisMode = 'comparison'"
            :class="{ active: analysisMode === 'comparison' }"
            class="mode-tab"
          >
            ⚖️ Compare Images
          </button>
        </div>
        <div class="mode-description">
          <small class="text-muted">{{ getModeDescription() }}</small>
        </div>
      </div>
    </div>

    <!-- Collection Type Selection (for collection mode) -->
    <div v-if="analysisMode === 'collection'" class="control-section collection-type-section">
      <h6 class="section-title">
        <span class="section-icon">📋</span>
        Collection Type
      </h6>
      <div class="collection-type-selector">
        <select v-model="collectionType" class="form-control">
          <option value="recipe_ingredients">🍳 Recipe Ingredients</option>
          <option value="packing_list">🎒 Packing List</option>
          <option value="sequence_story">📖 Story Sequence</option>
          <option value="product_collection">📦 Product Collection</option>
          <option value="custom">✏️ Custom Analysis</option>
        </select>
        <div class="collection-description">
          <small class="text-muted">{{ getCollectionDescription() }}</small>
        </div>
      </div>
    </div>

    <!-- Comparison Type Selection (for comparison mode) -->
    <div v-if="analysisMode === 'comparison'" class="control-section comparison-type-section">
      <h6 class="section-title">
        <span class="section-icon">🎯</span>
        Comparison Type
      </h6>
      <div class="comparison-type-selector">
        <select v-model="comparisonType" class="form-control">
          <option value="spot_differences">🔍 Spot Differences</option>
          <option value="before_after">⏳ Before/After Analysis</option>
          <option value="quality_comparison">⭐ Quality Comparison</option>
          <option value="variant_analysis">🔄 Variant Analysis</option>
          <option value="custom">✏️ Custom Comparison</option>
        </select>
        <div class="comparison-description">
          <small class="text-muted">{{ getComparisonDescription() }}</small>
        </div>
      </div>
    </div>

    <!-- Image Upload Section -->
    <div class="control-section image-upload-section">
      <h6 class="section-title">
        <span class="section-icon">🖼️</span>
        {{ getImageSectionTitle() }}
      </h6>

      <!-- Single Image Upload -->
      <div v-if="analysisMode === 'single'" class="single-image-upload">
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

        <!-- Single Image Preview -->
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

      <!-- Collection Image Upload -->
      <div v-if="analysisMode === 'collection'" class="collection-image-upload">
        <div class="upload-instructions">
          <p>{{ getCollectionUploadInstructions() }}</p>
        </div>

        <!-- Multi-Image Upload Area -->
        <div
          class="multi-upload-area"
          @drop="handleMultiDrop"
          @dragover.prevent
          @dragenter.prevent
          :class="{ 'drag-over': isDragOver }"
          @dragenter="isDragOver = true"
          @dragleave="isDragOver = false"
        >
          <input
            type="file"
            multiple
            accept="image/*"
            @change="handleMultiFileSelect"
            ref="multiFileInput"
            style="display: none"
          >

          <div v-if="selectedImages.length === 0" class="upload-prompt">
            <i class="bi bi-images"></i>
            <p>Drop multiple images here or click to select</p>
            <button @click="$refs.multiFileInput.click()" class="btn btn-primary">
              <i class="bi bi-upload"></i>
              Select Images ({{ selectedImages.length }}/10)
            </button>
          </div>

          <!-- Image Preview Grid -->
          <div v-if="selectedImages.length > 0" class="image-grid">
            <div
              v-for="(image, index) in selectedImages"
              :key="index"
              class="image-preview-item"
            >
              <img :src="image.preview" :alt="`Image ${index + 1}`" class="preview-img">
              <div class="image-controls">
                <span class="image-number">{{ index + 1 }}</span>
                <button @click="removeImage(index)" class="btn-remove" title="Remove image">
                  <i class="bi bi-x"></i>
                </button>
                <button
                  v-if="collectionType === 'sequence_story'"
                  @click="moveImage(index, -1)"
                  :disabled="index === 0"
                  class="btn-move"
                  title="Move up"
                >
                  <i class="bi bi-arrow-up"></i>
                </button>
                <button
                  v-if="collectionType === 'sequence_story'"
                  @click="moveImage(index, 1)"
                  :disabled="index === selectedImages.length - 1"
                  class="btn-move"
                  title="Move down"
                >
                  <i class="bi bi-arrow-down"></i>
                </button>
              </div>
              <div class="image-info">
                <small>{{ image.file?.name || 'Image ' + (index + 1) }}</small>
              </div>
            </div>

            <!-- Add More Button -->
            <div v-if="selectedImages.length < 10" class="add-more-item">
              <button @click="$refs.multiFileInput.click()" class="btn-add-more">
                <i class="bi bi-plus-lg"></i>
                <span>Add More</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Comparison Image Upload -->
      <div v-if="analysisMode === 'comparison'" class="comparison-image-upload">
        <div class="upload-instructions">
          <p>Upload two images to compare: {{ getComparisonUploadInstructions() }}</p>
        </div>

        <div class="two-image-layout">
          <!-- Image A Upload -->
          <div class="image-upload-slot">
            <div class="slot-header">
              <span class="slot-label">{{ getImageALabel() }}</span>
              <button v-if="imageA" @click="clearImageA" class="btn-clear">
                <i class="bi bi-x"></i>
              </button>
            </div>

            <div
              class="upload-area"
              @drop="handleDropA"
              @dragover.prevent
              @dragenter.prevent
              :class="{ 'drag-over': isDragOverA, 'has-image': !!imageA }"
              @dragenter="isDragOverA = true"
              @dragleave="isDragOverA = false"
            >
              <input
                type="file"
                accept="image/*"
                @change="handleFileSelectA"
                ref="fileInputA"
                style="display: none"
              >

              <div v-if="!imageA" class="upload-prompt">
                <i class="bi bi-image"></i>
                <p>Drop image A here</p>
                <button @click="$refs.fileInputA.click()" class="btn btn-primary btn-sm">
                  Select Image
                </button>
              </div>

              <div v-if="imageA" class="image-preview">
                <img :src="imageA.preview" :alt="getImageALabel()" class="preview-img">
                <div class="image-info">
                  <small>{{ imageA.name || 'Image A' }}</small>
                </div>
              </div>
            </div>
          </div>

          <!-- VS Separator -->
          <div class="vs-separator">
            <span class="vs-text">VS</span>
          </div>

          <!-- Image B Upload -->
          <div class="image-upload-slot">
            <div class="slot-header">
              <span class="slot-label">{{ getImageBLabel() }}</span>
              <button v-if="imageB" @click="clearImageB" class="btn-clear">
                <i class="bi bi-x"></i>
              </button>
            </div>

            <div
              class="upload-area"
              @drop="handleDropB"
              @dragover.prevent
              @dragenter.prevent
              :class="{ 'drag-over': isDragOverB, 'has-image': !!imageB }"
              @dragenter="isDragOverB = true"
              @dragleave="isDragOverB = false"
            >
              <input
                type="file"
                accept="image/*"
                @change="handleFileSelectB"
                ref="fileInputB"
                style="display: none"
              >

              <div v-if="!imageB" class="upload-prompt">
                <i class="bi bi-image"></i>
                <p>Drop image B here</p>
                <button @click="$refs.fileInputB.click()" class="btn btn-primary btn-sm">
                  Select Image
                </button>
              </div>

              <div v-if="imageB" class="image-preview">
                <img :src="imageB.preview" :alt="getImageBLabel()" class="preview-img">
                <div class="image-info">
                  <small>{{ imageB.name || 'Image B' }}</small>
                </div>
              </div>
            </div>
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
          <option value="public_document">📋 Public Document Analysis</option>
          <option value="name_extraction">👥 Name & Organization Extraction</option>
          <option value="public_verified">✅ Public Information (Verified)</option>
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
            <span v-if="analysisType === 'public_document' || analysisType === 'name_extraction' || analysisType === 'public_verified'" class="extraction-hint">
              <br><strong>💡 Tip:</strong> These modes are designed to extract names and information from public documents, directories, organizational charts, and published materials.
              <span v-if="analysisType === 'public_verified'">
                <br><strong>✅ Verified Mode:</strong> Use this when you've confirmed the information is from a public source.
              </span>
            </span>
            <span v-if="selectedModel === 'gpt-4o'" class="gpt4o-hint">
              <br><strong>🚀 GPT-4o:</strong> Latest vision model with enhanced image understanding and reasoning capabilities.
            </span>
          </small>
        </div>
      </div>

      <!-- AI Context Detection Section -->
      <div v-if="aiContext" class="ai-context-section">
        <h6 class="context-title">
          <span class="context-icon">🤖</span>
          AI Context Detection
        </h6>
        <div class="context-display">
          <div class="context-item">
            <span class="context-label">Domain:</span>
            <span class="context-value">{{ aiContext.domain }}</span>
          </div>
          <div class="context-item">
            <span class="context-label">Geography:</span>
            <span class="context-value">{{ aiContext.geography }}</span>
          </div>
          <div class="context-item">
            <span class="context-label">Content Type:</span>
            <span class="context-value">{{ aiContext.contentType }}</span>
          </div>
          <div class="context-item">
            <span class="context-label">Suggested Graph:</span>
            <span class="context-value">{{ aiContext.suggestedGraphType }}</span>
          </div>
          <div v-if="aiContext.suggestedNodeTypes" class="context-item">
            <span class="context-label">Recommended Nodes:</span>
            <span class="context-value">{{ aiContext.suggestedNodeTypes.join(', ') }}</span>
          </div>
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
            <input type="checkbox" v-model="createAIGraph" />
            <span class="option-label">🤖 Create New Knowledge AI-suggested graph structure</span>
          </label>
        </div>
        <div class="option-group">
          <label class="option-checkbox">
            <input type="checkbox" v-model="createMultipleNodes" />
            <span class="option-label">📊 Create multiple structured nodes in this Knowledge Graph</span>
          </label>
        </div>
        <div class="option-group">
          <label class="option-checkbox">
            <input type="checkbox" v-model="includeImageContext" />
            <span class="option-label">🔗 Include image context in analysis (surroundings, metadata)</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Analysis Action Section -->
    <div class="control-section action-section">
      <div class="action-buttons">
        <button
          @click="analyzeImage"
          :disabled="isAnalyzing || !isAnalysisReady || !analysisPrompt"
          class="btn btn-primary analyze-btn"
        >
          <span v-if="isAnalyzing" class="spinner-border spinner-border-sm me-2"></span>
          <span class="btn-icon">🚀</span>
          {{
            isAnalyzing
              ? 'Analyzing...'
              : analysisMode === 'single'
                ? 'Analyze Image'
                : analysisMode === 'collection'
                  ? 'Analyze Collection'
                  : 'Compare Images'
          }}
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
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'

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
const selectedModel = ref('gpt-4o-mini')
const maxTokens = ref(1024)
const verbosity = ref('medium')
const reasoningEffort = ref('medium')
const uploadMethod = ref('file')
const selectedImage = ref(null)
const imageUrl = ref('')
const imagePreviewUrl = ref('')
const analysisType = ref('general')
const analysisPrompt = ref('')
const createResultNode = ref(true)
const createAIGraph = ref(false)
const createMultipleNodes = ref(false)
const includeImageContext = ref(false)
const isAnalyzing = ref(false)
const loadingMessage = ref('')
const analysisResult = ref('')
const aiContext = ref(null)
const resultNodeCreated = ref(false)
const error = ref('')
const successMessage = ref('')

// New multi-image analysis variables
const analysisMode = ref('single')
const collectionType = ref('recipe_ingredients')
const comparisonType = ref('spot_differences')
const selectedImages = ref([])
const imageA = ref(null)
const imageB = ref(null)
const isDragOver = ref(false)
const isDragOverA = ref(false)
const isDragOverB = ref(false)

// Template refs
const pasteArea = ref(null)
const multiFileInput = ref(null)
const fileInputA = ref(null)
const fileInputB = ref(null)

// Computed property to check if analysis is ready based on mode
const isAnalysisReady = computed(() => {
  if (analysisMode.value === 'single') {
    return !!selectedImage.value
  } else if (analysisMode.value === 'collection') {
    return selectedImages.value.length > 0
  } else if (analysisMode.value === 'comparison') {
    return !!imageA.value && !!imageB.value
  }
  return false
})

// Analysis type prompts
const analysisPrompts = {
  general: 'Describe this image in detail. What do you see? If this appears to be a public document, list, or published material, please include all visible names, organizations, and text content.',
  detailed:
    'Provide a comprehensive analysis of this image. Include details about objects, people, setting, mood, colors, composition, and any notable features. If this appears to be a public document, directory, list, or published material (such as organizational charts, public listings, academic papers, news articles, or official documents), please extract and include all visible names, titles, organizations, and textual content as this information is publicly available.',
  objects:
    'Identify and list all objects visible in this image. Describe their locations, sizes, and relationships to each other. Include any text, names, or labels visible on objects.',
  text: 'Extract and transcribe all text visible in this image, including names, titles, organizations, and any other textual content. Preserve the original formatting and structure as much as possible. This includes extracting names from public documents, lists, directories, or published materials.',
  public_document: 'This appears to be a public document, list, directory, or published material. Please extract all visible text including names, organizations, titles, positions, and any other information. Public information extraction is permitted and helpful for knowledge graph creation.',
  name_extraction: 'Please extract all names, organizations, titles, and positions visible in this image. This appears to be from a public source such as a directory, organizational chart, public listing, or published document where this information is meant to be publicly accessible.',
  public_verified: 'This image contains information that appears to be from a publicly accessible source (such as a company website, organizational directory, published document, or public listing). Please extract all visible information including names, titles, organizations, and contact details. The user has indicated this is public information, so please be thorough in your extraction for knowledge graph creation purposes.',
  medical:
    'Analyze this medical image. Describe any visible anatomical structures, potential abnormalities, or clinically relevant findings. Note: This is for educational purposes only.',
  technical:
    'Provide a technical analysis of this image. Focus on technical aspects, components, measurements, or engineering details visible. Include any visible labels, names, model numbers, or textual information.',
  artistic:
    'Analyze this image from an artistic perspective. Comment on composition, color theory, style, technique, and aesthetic qualities. If this appears to be a published work, include visible artist names, titles, or attribution information.',
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
  } catch (urlError) {
    console.error('Image URL error:', urlError)
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
  // Validation based on analysis mode
  if (analysisMode.value === 'single') {
    if (!selectedImage.value || !analysisPrompt.value) return
  } else if (analysisMode.value === 'collection') {
    if (!selectedImages.value.length || !analysisPrompt.value) return
  } else if (analysisMode.value === 'comparison') {
    if (!imageA.value || !imageB.value || !analysisPrompt.value) return
  }

  isAnalyzing.value = true
  loadingMessage.value = 'Preparing image(s) for analysis...'
  resultNodeCreated.value = false

  try {
    let requestBody
    let endpoint

    if (analysisMode.value === 'single') {
      // Single image analysis (existing logic)
      endpoint = 'https://image-analysis-worker.torarnehave.workers.dev/analyze-image'

      if (selectedImage.value.url) {
        // URL-based image
        requestBody = {
          imageUrl: selectedImage.value.url,
          prompt: analysisPrompt.value,
          analysisType: analysisType.value,
          model: selectedModel.value,
          maxTokens: maxTokens.value,
          verbosity: verbosity.value,
          reasoningEffort: reasoningEffort.value,
          includeImageContext: includeImageContext.value,
          enableContextDetection: createAIGraph.value || createMultipleNodes.value,
          requestedOutputs: {
            fulltext: createResultNode.value,
            aiGraph: createAIGraph.value,
            multipleNodes: createMultipleNodes.value,
          },
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
          verbosity: verbosity.value,
          reasoningEffort: reasoningEffort.value,
          includeImageContext: includeImageContext.value,
          enableContextDetection: createAIGraph.value || createMultipleNodes.value,
          requestedOutputs: {
            fulltext: createResultNode.value,
            aiGraph: createAIGraph.value,
            multipleNodes: createMultipleNodes.value,
          },
        }
      }
    } else if (analysisMode.value === 'collection') {
      // Collection analysis
      endpoint = 'https://image-analysis-worker.torarnehave.workers.dev/analyze-collection'
      loadingMessage.value = 'Converting collection images to base64...'

      const images = []
      for (const img of selectedImages.value) {
        if (img.url) {
          images.push({ url: img.url })
        } else {
          const base64DataUrl = await convertImageToBase64(img.file)
          images.push({ base64: base64DataUrl })
        }
      }

      requestBody = {
        images,
        prompt: analysisPrompt.value,
        collectionType: collectionType.value,
        model: selectedModel.value,
        maxTokens: maxTokens.value,
        verbosity: verbosity.value,
        enableContextDetection: createAIGraph.value || createMultipleNodes.value,
        requestedOutputs: {
          fulltext: createResultNode.value,
          aiGraph: createAIGraph.value,
          multipleNodes: createMultipleNodes.value,
        },
      }
    } else if (analysisMode.value === 'comparison') {
      // Comparison analysis
      endpoint = 'https://image-analysis-worker.torarnehave.workers.dev/compare-images'
      loadingMessage.value = 'Converting comparison images to base64...'

      let imageAData, imageBData

      if (imageA.value.url) {
        imageAData = { url: imageA.value.url }
      } else {
        const base64DataUrl = await convertImageToBase64(imageA.value.file)
        imageAData = { base64: base64DataUrl }
      }

      if (imageB.value.url) {
        imageBData = { url: imageB.value.url }
      } else {
        const base64DataUrl = await convertImageToBase64(imageB.value.file)
        imageBData = { base64: base64DataUrl }
      }

      requestBody = {
        imageA: imageAData,
        imageB: imageBData,
        prompt: analysisPrompt.value,
        comparisonType: comparisonType.value,
        model: selectedModel.value,
        maxTokens: maxTokens.value,
        verbosity: verbosity.value,
        enableContextDetection: createAIGraph.value || createMultipleNodes.value,
        requestedOutputs: {
          fulltext: createResultNode.value,
          aiGraph: createAIGraph.value,
          multipleNodes: createMultipleNodes.value,
        },
      }
    }

    loadingMessage.value = 'Sending to image analysis service...'

    // Call the appropriate endpoint
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Image analysis service request failed')
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Image analysis failed')
    }

    analysisResult.value = data.analysis

    // Store AI context if provided
    if (data.context) {
      aiContext.value = data.context
      console.log('AI Context detected:', data.context)
    }

    successMessage.value = `${analysisMode.value} image analysis completed successfully!`

    // Create nodes based on selected options
    const createdNodes = []

    // Create fulltext node if enabled
    if (createResultNode.value) {
      const fulltextNode = await createFulltextNode()
      if (fulltextNode) createdNodes.push(fulltextNode)
    }

    // Create AI-suggested graph structure if enabled
    if (createAIGraph.value && data.graphStructure) {
      const graphNodes = await createAIGraphStructure(data.graphStructure)
      createdNodes.push(...graphNodes)
    }

    // Create multiple structured nodes if enabled
    if (createMultipleNodes.value && data.structuredNodes) {
      const structuredNodes = await createMultipleStructuredNodes(data.structuredNodes)
      createdNodes.push(...structuredNodes)
    }

    if (createdNodes.length > 1) {
      successMessage.value = `✅ Created ${createdNodes.length} nodes successfully!`
    }
  } catch (error) {
    error.value = error.message || 'Failed to analyze image'
    console.error('Image analysis error:', error)
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

const createAIGraphStructure = async (graphStructure) => {
  if (!graphStructure || !graphStructure.nodes) return []

  const createdNodes = []
  let nodeIndex = 0

  try {
    for (const nodeData of graphStructure.nodes) {
      const newNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        label: nodeData.label || `AI Node ${nodeIndex + 1}`,
        info: nodeData.content || nodeData.info || '',
        type: nodeData.type || 'concept',
        color: nodeData.color || '#e8f0ff',
        visible: true,
        x: (props.node.x || 0) + 300 + (nodeIndex * 200),
        y: (props.node.y || 0) + 100 + (nodeIndex * 150),
        bibl: [
          `Generated from AI context analysis`,
          `Domain: ${aiContext.value?.domain || 'Unknown'}`,
          `Geography: ${aiContext.value?.geography || 'Unknown'}`,
          `Created on ${new Date().toISOString().split('T')[0]}`,
        ],
      }

      emit('node-created', newNode)
      createdNodes.push(newNode)
      nodeIndex++
    }

    successMessage.value = `✅ Created ${createdNodes.length} AI-suggested nodes!`
    return createdNodes
  } catch (error) {
    console.error('Error creating AI graph structure:', error)
    return createdNodes
  }
}

const createMultipleStructuredNodes = async (structuredNodes) => {
  if (!structuredNodes || !Array.isArray(structuredNodes)) return []

  const createdNodes = []
  let nodeIndex = 0

  try {
    for (const nodeData of structuredNodes) {
      const newNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        label: nodeData.label || nodeData.title || `Structured Node ${nodeIndex + 1}`,
        info: nodeData.content || nodeData.description || nodeData.info || '',
        type: nodeData.type || 'info',
        color: getNodeColor(nodeData.type),
        visible: true,
        x: (props.node.x || 0) + 300,
        y: (props.node.y || 0) + 100 + (nodeIndex * 120),
        bibl: [
          `Extracted from image analysis`,
          `Analysis type: ${analysisType.value}`,
          `Node type: ${nodeData.type || 'info'}`,
          `Generated on ${new Date().toISOString().split('T')[0]}`,
        ],
      }

      emit('node-created', newNode)
      createdNodes.push(newNode)
      nodeIndex++
    }

    successMessage.value = `✅ Created ${createdNodes.length} structured nodes!`
    return createdNodes
  } catch (error) {
    console.error('Error creating structured nodes:', error)
    return createdNodes
  }
}

const getNodeColor = (nodeType) => {
  const colorMap = {
    fulltext: '#e8f5e8',
    concept: '#e8f0ff',
    person: '#fff0e8',
    location: '#f0fff0',
    object: '#ffe8f0',
    technical: '#f0f8ff',
    medical: '#fff8e8',
    economic: '#e8fff8',
    default: '#f8f8f8',
  }
  return colorMap[nodeType] || colorMap.default
}

const createFulltextNode = async () => {
  if (!analysisResult.value) return null

  try {
    const newNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: `Image Analysis: ${analysisType.value}`,
      info: analysisResult.value,
      type: 'fulltext',
      color: '#e8f5e8',
      visible: true,
      x: (props.node.x || 0) + 300,
      y: (props.node.y || 0) + 100,
      bibl: [
        `Image analyzed using ${selectedModel.value} via image-analysis-worker.torarnehave.workers.dev`,
        `Analysis type: ${analysisType.value}`,
        `Generated on ${new Date().toISOString().split('T')[0]}`,
      ],
    }

    emit('node-created', newNode)
    resultNodeCreated.value = true
    return newNode
  } catch (error) {
    error.value = 'Failed to create fulltext node'
    console.error('Node creation error:', error)
    return null
  }
}

const copyResult = async () => {
  if (!analysisResult.value) return

  try {
    await navigator.clipboard.writeText(analysisResult.value)
    successMessage.value = 'Analysis result copied to clipboard!'
  } catch (error) {
    error.value = 'Failed to copy result to clipboard'
    console.error('Copy error:', error)
  }
}

const resetAnalysis = () => {
  clearImage()
  analysisResult.value = ''
  aiContext.value = null
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

// New methods for multi-image analysis
const getModeDescription = () => {
  const descriptions = {
    single: 'Analyze a single image with AI vision models',
    collection: 'Analyze multiple images as a related collection (recipe ingredients, packing lists, etc.)',
    comparison: 'Compare two images to identify differences, changes, or similarities'
  }
  return descriptions[analysisMode.value] || ''
}

const getImageSectionTitle = () => {
  const titles = {
    single: 'Image Input',
    collection: `Upload Images (${selectedImages.value.length}/10)`,
    comparison: 'Upload Images for Comparison'
  }
  return titles[analysisMode.value] || 'Image Input'
}

const getCollectionDescription = () => {
  const descriptions = {
    recipe_ingredients: 'Analyze ingredients as a complete recipe collection',
    packing_list: 'Analyze items as a packing/equipment list for travel or activities',
    sequence_story: 'Analyze images as a sequential story or timeline',
    product_collection: 'Analyze items as a product collection or catalog',
    custom: 'Provide your own analysis prompt for the collection'
  }
  return descriptions[collectionType.value] || ''
}

const getComparisonDescription = () => {
  const descriptions = {
    spot_differences: 'Find and highlight all visual differences between two images',
    before_after: 'Analyze transformation or changes between before and after images',
    quality_comparison: 'Compare quality, condition, or state of objects in images',
    variant_analysis: 'Compare different variants, versions, or models of similar items',
    custom: 'Provide your own comparison criteria and analysis prompt'
  }
  return descriptions[comparisonType.value] || ''
}

const getCollectionUploadInstructions = () => {
  const instructions = {
    recipe_ingredients: 'Upload photos of ingredients in any order',
    packing_list: 'Upload photos of items to pack or equipment to check',
    sequence_story: 'Upload images in chronological order for best results',
    product_collection: 'Upload photos of products or items in the collection',
    custom: 'Upload images related to your custom analysis'
  }
  return instructions[collectionType.value] || 'Upload multiple related images'
}

const getComparisonUploadInstructions = () => {
  const instructions = {
    spot_differences: 'reference image and comparison image',
    before_after: 'before image and after image',
    quality_comparison: 'first item and second item to compare',
    variant_analysis: 'variant A and variant B',
    custom: 'first image and second image'
  }
  return instructions[comparisonType.value] || 'two images to compare'
}

const getImageALabel = () => {
  const labels = {
    spot_differences: 'Reference Image',
    before_after: 'Before Image',
    quality_comparison: 'Image A',
    variant_analysis: 'Variant A',
    custom: 'Image A'
  }
  return labels[comparisonType.value] || 'Image A'
}

const getImageBLabel = () => {
  const labels = {
    spot_differences: 'Comparison Image',
    before_after: 'After Image',
    quality_comparison: 'Image B',
    variant_analysis: 'Variant B',
    custom: 'Image B'
  }
  return labels[comparisonType.value] || 'Image B'
}

// Multi-image upload handlers
const handleMultiFileSelect = (event) => {
  const files = Array.from(event.target.files)
  addFiles(files)
}

const handleMultiDrop = (event) => {
  event.preventDefault()
  isDragOver.value = false
  const files = Array.from(event.dataTransfer.files).filter(file => file.type.startsWith('image/'))
  addFiles(files)
}

const addFiles = async (files) => {
  if (selectedImages.value.length + files.length > 10) {
    error.value = 'Maximum 10 images allowed'
    return
  }

  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      error.value = `File ${file.name} is too large (max 5MB)`
      continue
    }

    try {
      const base64 = await convertImageToBase64(file)
      const preview = URL.createObjectURL(file)

      selectedImages.value.push({
        file,
        base64,
        preview,
        name: file.name
      })
    } catch (error) {
      console.error('Error processing file:', error)
      error.value = `Error processing file ${file.name}`
    }
  }

  // Clear the file input
  if (multiFileInput.value) {
    multiFileInput.value.value = ''
  }
}

const removeImage = (index) => {
  URL.revokeObjectURL(selectedImages.value[index].preview)
  selectedImages.value.splice(index, 1)
}

const moveImage = (index, direction) => {
  const newIndex = index + direction
  if (newIndex >= 0 && newIndex < selectedImages.value.length) {
    const item = selectedImages.value.splice(index, 1)[0]
    selectedImages.value.splice(newIndex, 0, item)
  }
}

// Comparison image handlers
const handleFileSelectA = (event) => {
  const file = event.target.files[0]
  if (file) {
    setImageA(file)
  }
}

const handleFileSelectB = (event) => {
  const file = event.target.files[0]
  if (file) {
    setImageB(file)
  }
}

const handleDropA = (event) => {
  event.preventDefault()
  isDragOverA.value = false
  const files = Array.from(event.dataTransfer.files).filter(file => file.type.startsWith('image/'))
  if (files.length > 0) {
    setImageA(files[0])
  }
}

const handleDropB = (event) => {
  event.preventDefault()
  isDragOverB.value = false
  const files = Array.from(event.dataTransfer.files).filter(file => file.type.startsWith('image/'))
  if (files.length > 0) {
    setImageB(files[0])
  }
}

const setImageA = async (file) => {
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    error.value = 'File is too large (max 5MB)'
    return
  }

  try {
    const base64 = await convertImageToBase64(file)
    const preview = URL.createObjectURL(file)

    // Clean up previous image
    if (imageA.value?.preview) {
      URL.revokeObjectURL(imageA.value.preview)
    }

    imageA.value = {
      file,
      base64,
      preview,
      name: file.name
    }

    error.value = ''
  } catch (error) {
    console.error('Error processing file:', error)
    error.value = 'Error processing image A'
  }
}

const setImageB = async (file) => {
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    error.value = 'File is too large (max 5MB)'
    return
  }

  try {
    const base64 = await convertImageToBase64(file)
    const preview = URL.createObjectURL(file)

    // Clean up previous image
    if (imageB.value?.preview) {
      URL.revokeObjectURL(imageB.value.preview)
    }

    imageB.value = {
      file,
      base64,
      preview,
      name: file.name
    }

    error.value = ''
  } catch (error) {
    console.error('Error processing file:', error)
    error.value = 'Error processing image B'
  }
}

const clearImageA = () => {
  if (imageA.value?.preview) {
    URL.revokeObjectURL(imageA.value.preview)
  }
  imageA.value = null
  if (fileInputA.value) {
    fileInputA.value.value = ''
  }
}

const clearImageB = () => {
  if (imageB.value?.preview) {
    URL.revokeObjectURL(imageB.value.preview)
  }
  imageB.value = null
  if (fileInputB.value) {
    fileInputB.value.value = ''
  }
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

.model-info {
  margin-top: 4px;
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
  max-width: 100% !important;
  max-height: 300px !important;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  object-fit: contain;
  display: block;
}

.preview-img {
  max-width: 100%;
  max-height: 150px;
  border-radius: 4px;
  object-fit: cover;
  display: block;
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

.extraction-hint {
  color: #28a745;
  font-weight: 500;
}

.reasoning-hint {
  color: #6f42c1;
  font-weight: 500;
}

.gpt5-hint {
  color: #007bff;
  font-weight: 500;
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

/* AI Context Section */
.ai-context-section {
  background: #f8f9ff;
  border: 1px solid #e0e8ff;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
}

.context-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.context-icon {
  font-size: 1.2rem;
}

.context-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.context-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}

.context-label {
  font-weight: 500;
  color: #555;
  min-width: 100px;
}

.context-value {
  color: #333;
  background: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  flex: 1;
}

/* Multi-image analysis styles */
.analysis-mode-selector {
  margin-bottom: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  background: #f9f9f9;
}

.mode-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.mode-option:hover {
  background: #e8f4f8;
}

.mode-option input[type="radio"] {
  margin: 0;
}

.collection-analysis-section,
.comparison-analysis-section {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
  background: #fafafa;
}

.collection-type-selector,
.comparison-type-selector {
  margin-bottom: 16px;
}

.type-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.type-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.type-option:hover {
  background: #e8f4f8;
}

.multi-image-upload {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 16px;
}

.multi-image-upload:hover,
.multi-image-upload.drag-over {
  border-color: #007acc;
  background-color: #f0f8ff;
}

.upload-instructions {
  color: #666;
  margin-bottom: 12px;
}

.upload-button {
  background: #007acc;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.upload-button:hover {
  background: #005fa3;
}

.image-collection {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 16px;
  max-width: 100%;
}

.collection-image {
  position: relative;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background: #f9f9f9;
  aspect-ratio: 4/3;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.collection-image:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.collection-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-controls {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 4px;
}

.control-btn {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 3px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
}

.control-btn:hover {
  background: rgba(0, 0, 0, 0.9);
}

.image-order {
  position: absolute;
  bottom: 4px;
  left: 4px;
  background: rgba(0, 122, 204, 0.9);
  color: white;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: bold;
}

.comparison-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.comparison-upload {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.comparison-upload:hover,
.comparison-upload.drag-over {
  border-color: #007acc;
  background-color: #f0f8ff;
}

.comparison-upload.has-image {
  padding: 8px;
  min-height: auto;
}

.comparison-image {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 4px;
}

.upload-label {
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.empty-state {
  color: #666;
  font-style: italic;
}

/* Responsive adjustments for image collection */
@media (max-width: 768px) {
  .image-collection {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .image-collection {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .comparison-container {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
