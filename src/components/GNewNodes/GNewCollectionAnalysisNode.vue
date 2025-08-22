<template>
  <div class="gnew-collection-analysis-node">
    <!-- Node Header -->
    <div class="node-header">
      <div class="node-title-section">
        <span class="node-icon">🔍📁</span>
        <span class="node-label">{{ node.label || 'Collection Analysis' }}</span>
        <div class="node-type-badge-inline">COLLECTION_ANALYSIS</div>
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

    <!-- Collection Type Selection -->
    <div class="control-section collection-type-section">
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

    <!-- OpenAI Configuration -->
    <div class="control-section ai-config-section">
      <h6 class="section-title">
        <span class="section-icon">🤖</span>
        AI Configuration
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
            min="500"
            max="4096"
            class="form-control config-input"
            placeholder="2048"
          />
        </div>
      </div>
    </div>

    <!-- Multi-Image Upload -->
    <div class="control-section image-upload-section">
      <h6 class="section-title">
        <span class="section-icon">🖼️</span>
        Upload Images ({{ selectedImages.length }}/10)
      </h6>

      <!-- Upload Area -->
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
          <p class="upload-instructions">{{ getUploadInstructions() }}</p>
          <button @click="$refs.multiFileInput.click()" class="btn btn-primary">
            <i class="bi bi-upload"></i>
            Select Images
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

    <!-- Custom Prompt (for custom analysis type) -->
    <div v-if="collectionType === 'custom'" class="control-section prompt-section">
      <h6 class="section-title">
        <span class="section-icon">✏️</span>
        Custom Analysis Prompt
      </h6>
      <textarea
        v-model="customPrompt"
        class="form-control prompt-textarea"
        rows="4"
        placeholder="Describe how you want to analyze this collection of images..."
      ></textarea>
    </div>

    <!-- Analysis Options -->
    <div class="control-section options-section">
      <h6 class="section-title">
        <span class="section-icon">⚙️</span>
        Analysis Options
      </h6>
      <div class="options-grid">
        <label class="option-item">
          <input type="checkbox" v-model="createResultNode">
          <span class="option-label">Create Result Node</span>
        </label>
        <label class="option-item">
          <input type="checkbox" v-model="createStructuredNodes">
          <span class="option-label">Create Structured Nodes</span>
        </label>
        <label class="option-item">
          <input type="checkbox" v-model="enableContextDetection">
          <span class="option-label">Enable Context Detection</span>
        </label>
      </div>
    </div>

    <!-- Analyze Button -->
    <div class="control-section analyze-section">
      <button
        @click="analyzeCollection"
        :disabled="isAnalyzing || selectedImages.length === 0"
        class="btn btn-primary analyze-btn"
      >
        <span v-if="isAnalyzing" class="spinner-border spinner-border-sm me-2"></span>
        <i v-else class="bi bi-play-circle me-2"></i>
        {{ isAnalyzing ? 'Analyzing...' : 'Analyze Collection' }}
      </button>

      <div v-if="isAnalyzing" class="loading-info">
        <div class="progress">
          <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
        </div>
        <small class="loading-message">{{ loadingMessage }}</small>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="analysisResult || errorMessage" class="control-section results-section">
      <h6 class="section-title">
        <span class="section-icon">📊</span>
        Analysis Results
      </h6>

      <!-- Error Message -->
      <div v-if="errorMessage" class="alert alert-danger">
        <i class="bi bi-exclamation-triangle me-2"></i>
        {{ errorMessage }}
      </div>

      <!-- Success Message -->
      <div v-if="successMessage" class="alert alert-success">
        <i class="bi bi-check-circle me-2"></i>
        {{ successMessage }}
      </div>

      <!-- Analysis Results -->
      <div v-if="analysisResult" class="results-content">
        <!-- Main Analysis -->
        <div class="result-section">
          <h6>Overall Analysis</h6>
          <div class="analysis-text">{{ analysisResult }}</div>
        </div>

        <!-- Structured Data Tabs -->
        <div v-if="collectionData && hasStructuredData" class="structured-data">
          <div class="data-tabs">
            <button
              v-for="tab in availableTabs"
              :key="tab.key"
              @click="activeTab = tab.key"
              :class="{ active: activeTab === tab.key }"
              class="data-tab"
            >
              {{ tab.icon }} {{ tab.label }}
            </button>
          </div>

          <div class="tab-content">
            <!-- Ingredients Tab -->
            <div v-if="activeTab === 'ingredients' && collectionData.ingredients?.length" class="tab-pane">
              <div class="items-list">
                <div v-for="(item, index) in collectionData.ingredients" :key="index" class="item-card">
                  <div class="item-content">
                    <strong>{{ item.name || item.description }}</strong>
                    <div v-if="item.quantity" class="item-detail">Quantity: {{ item.quantity }}</div>
                    <div v-if="item.category" class="item-detail">Category: {{ item.category }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Items Tab -->
            <div v-if="activeTab === 'items' && collectionData.items?.length" class="tab-pane">
              <div class="items-list">
                <div v-for="(item, index) in collectionData.items" :key="index" class="item-card">
                  <div class="item-content">
                    <strong>{{ item.name || item.description }}</strong>
                    <div v-if="item.category" class="item-detail">Category: {{ item.category }}</div>
                    <div v-if="item.purpose" class="item-detail">Purpose: {{ item.purpose }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Products Tab -->
            <div v-if="activeTab === 'products' && collectionData.products?.length" class="tab-pane">
              <div class="items-list">
                <div v-for="(item, index) in collectionData.products" :key="index" class="item-card">
                  <div class="item-content">
                    <strong>{{ item.name || item.description }}</strong>
                    <div v-if="item.category" class="item-detail">Category: {{ item.category }}</div>
                    <div v-if="item.brand" class="item-detail">Brand: {{ item.brand }}</div>
                    <div v-if="item.condition" class="item-detail">Condition: {{ item.condition }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sequence Tab -->
            <div v-if="activeTab === 'sequence' && collectionData.sequence?.length" class="tab-pane">
              <div class="sequence-list">
                <div v-for="(step, index) in collectionData.sequence" :key="index" class="sequence-step">
                  <div class="step-number">{{ step.step || index + 1 }}</div>
                  <div class="step-content">{{ step.description }}</div>
                </div>
              </div>
            </div>

            <!-- Analysis Tab -->
            <div v-if="activeTab === 'analysis' && collectionData.analysis" class="tab-pane">
              <div class="analysis-details">
                <div v-for="(value, key) in collectionData.analysis" :key="key" class="analysis-item">
                  <strong>{{ formatAnalysisKey(key) }}:</strong>
                  <div>{{ value }}</div>
                </div>
              </div>
            </div>

            <!-- Suggestions Tab -->
            <div v-if="activeTab === 'suggestions' && collectionData.suggestions?.length" class="tab-pane">
              <div class="suggestions-list">
                <div v-for="(suggestion, index) in collectionData.suggestions" :key="index" class="suggestion-item">
                  <i class="bi bi-lightbulb me-2"></i>
                  {{ suggestion }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="result-actions">
          <button @click="copyResultsToClipboard" class="btn btn-secondary">
            <i class="bi bi-clipboard me-2"></i>
            Copy Results
          </button>
          <button v-if="createResultNode" @click="createNodes" class="btn btn-success">
            <i class="bi bi-plus-circle me-2"></i>
            Create Nodes
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useGraphStore } from '@/stores/graphStore'

export default {
  name: 'GNewCollectionAnalysisNode',
  props: {
    node: {
      type: Object,
      required: true,
    },
    showControls: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['edit', 'delete', 'update'],
  setup(props, { emit }) {
    const graphStore = useGraphStore()

    // Reactive data
    const collectionType = ref('recipe_ingredients')
    const selectedModel = ref('gpt-4o-mini')
    const maxTokens = ref(2048)
    const customPrompt = ref('')
    const selectedImages = ref([])
    const isDragOver = ref(false)

    // Options
    const createResultNode = ref(true)
    const createStructuredNodes = ref(true)
    const enableContextDetection = ref(false)

    // Analysis state
    const isAnalyzing = ref(false)
    const loadingMessage = ref('')
    const analysisResult = ref('')
    const collectionData = ref(null)
    const errorMessage = ref('')
    const successMessage = ref('')
    const activeTab = ref('ingredients')

    // File input ref
    const multiFileInput = ref(null)

    // Computed properties
    const hasStructuredData = computed(() => {
      return collectionData.value && (
        collectionData.value.ingredients?.length ||
        collectionData.value.items?.length ||
        collectionData.value.products?.length ||
        collectionData.value.sequence?.length ||
        Object.keys(collectionData.value.analysis || {}).length ||
        collectionData.value.suggestions?.length
      )
    })

    const availableTabs = computed(() => {
      const tabs = []

      if (collectionData.value?.ingredients?.length) {
        tabs.push({ key: 'ingredients', label: 'Ingredients', icon: '🥘' })
      }
      if (collectionData.value?.items?.length) {
        tabs.push({ key: 'items', label: 'Items', icon: '📋' })
      }
      if (collectionData.value?.products?.length) {
        tabs.push({ key: 'products', label: 'Products', icon: '📦' })
      }
      if (collectionData.value?.sequence?.length) {
        tabs.push({ key: 'sequence', label: 'Sequence', icon: '📖' })
      }
      if (collectionData.value?.analysis && Object.keys(collectionData.value.analysis).length) {
        tabs.push({ key: 'analysis', label: 'Analysis', icon: '📊' })
      }
      if (collectionData.value?.suggestions?.length) {
        tabs.push({ key: 'suggestions', label: 'Suggestions', icon: '💡' })
      }

      return tabs
    })

    // Methods
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

    const getUploadInstructions = () => {
      const instructions = {
        recipe_ingredients: 'Upload photos of ingredients in any order',
        packing_list: 'Upload photos of items to pack or equipment to check',
        sequence_story: 'Upload images in chronological order for best results',
        product_collection: 'Upload photos of products or items in the collection',
        custom: 'Upload images related to your custom analysis'
      }
      return instructions[collectionType.value] || 'Upload multiple related images'
    }

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
        errorMessage.value = 'Maximum 10 images allowed'
        return
      }

      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          errorMessage.value = `File ${file.name} is too large (max 5MB)`
          continue
        }

        try {
          const base64 = await convertFileToBase64(file)
          const preview = URL.createObjectURL(file)

          selectedImages.value.push({
            file,
            base64,
            preview,
            name: file.name
          })
        } catch (error) {
          console.error('Error processing file:', error)
          errorMessage.value = `Error processing file ${file.name}`
        }
      }

      // Clear the file input
      if (multiFileInput.value) {
        multiFileInput.value.value = ''
      }
    }

    const convertFileToBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
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

    const analyzeCollection = async () => {
      if (selectedImages.value.length === 0) {
        errorMessage.value = 'Please select at least one image'
        return
      }

      isAnalyzing.value = true
      errorMessage.value = ''
      successMessage.value = ''
      loadingMessage.value = 'Preparing images for analysis...'

      try {
        // Prepare image data
        const images = selectedImages.value.map(img => img.base64)

        const requestBody = {
          images,
          collectionType: collectionType.value,
          prompt: collectionType.value === 'custom' ? customPrompt.value : undefined,
          model: selectedModel.value,
          maxTokens: maxTokens.value,
          enableContextDetection: enableContextDetection.value,
        }

        loadingMessage.value = 'Sending to collection analysis service...'

        const response = await fetch(
          'https://image-analysis-worker.torarnehave.workers.dev/analyze-collection',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Collection analysis service request failed')
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Collection analysis failed')
        }

        analysisResult.value = data.analysis
        collectionData.value = data.collectionData

        // Set active tab to first available
        if (availableTabs.value.length > 0) {
          activeTab.value = availableTabs.value[0].key
        }

        successMessage.value = 'Collection analysis completed successfully!'

        // Create nodes if enabled
        if (createResultNode.value || createStructuredNodes.value) {
          await createNodes()
        }

      } catch (error) {
        console.error('Collection analysis error:', error)
        errorMessage.value = error.message || 'Analysis failed. Please try again.'
      } finally {
        isAnalyzing.value = false
        loadingMessage.value = ''
      }
    }

    const createNodes = async () => {
      if (!analysisResult.value) return

      try {
        const newNodes = []

        if (createResultNode.value) {
          // Create main result node
          const resultNode = await graphStore.createNode({
            label: `Collection Analysis: ${getCollectionTypeName()}`,
            type: 'info',
            info: analysisResult.value,
            color: '#e8f5e8',
          })
          newNodes.push(resultNode)
        }

        if (createStructuredNodes.value && collectionData.value) {
          // Create structured nodes based on collection type
          if (collectionData.value.ingredients?.length) {
            for (const ingredient of collectionData.value.ingredients) {
              const node = await graphStore.createNode({
                label: ingredient.name || ingredient.description,
                type: 'ingredient',
                info: `Category: ${ingredient.category || 'N/A'}\nQuantity: ${ingredient.quantity || 'N/A'}`,
                color: '#fff2e6',
              })
              newNodes.push(node)
            }
          }

          if (collectionData.value.items?.length) {
            for (const item of collectionData.value.items) {
              const node = await graphStore.createNode({
                label: item.name || item.description,
                type: 'item',
                info: `Category: ${item.category || 'N/A'}\nPurpose: ${item.purpose || 'N/A'}`,
                color: '#e6f3ff',
              })
              newNodes.push(node)
            }
          }

          if (collectionData.value.products?.length) {
            for (const product of collectionData.value.products) {
              const node = await graphStore.createNode({
                label: product.name || product.description,
                type: 'product',
                info: `Category: ${product.category || 'N/A'}\nBrand: ${product.brand || 'N/A'}\nCondition: ${product.condition || 'N/A'}`,
                color: '#fff0e6',
              })
              newNodes.push(node)
            }
          }
        }

        console.log(`Created ${newNodes.length} nodes from collection analysis`)

      } catch (error) {
        console.error('Error creating nodes:', error)
        errorMessage.value = 'Failed to create nodes. Please try again.'
      }
    }

    const getCollectionTypeName = () => {
      const names = {
        recipe_ingredients: 'Recipe Ingredients',
        packing_list: 'Packing List',
        sequence_story: 'Story Sequence',
        product_collection: 'Product Collection',
        custom: 'Custom Collection'
      }
      return names[collectionType.value] || 'Collection'
    }

    const formatAnalysisKey = (key) => {
      return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }

    const copyResultsToClipboard = () => {
      let textToCopy = analysisResult.value

      if (collectionData.value) {
        textToCopy += '\n\n--- Structured Data ---\n'

        if (collectionData.value.ingredients?.length) {
          textToCopy += '\nIngredients:\n'
          collectionData.value.ingredients.forEach(item => {
            textToCopy += `- ${item.name || item.description}\n`
          })
        }

        if (collectionData.value.suggestions?.length) {
          textToCopy += '\nSuggestions:\n'
          collectionData.value.suggestions.forEach(suggestion => {
            textToCopy += `- ${suggestion}\n`
          })
        }
      }

      navigator.clipboard.writeText(textToCopy).then(() => {
        successMessage.value = 'Results copied to clipboard!'
        setTimeout(() => { successMessage.value = '' }, 3000)
      }).catch(err => {
        console.error('Failed to copy: ', err)
        errorMessage.value = 'Failed to copy to clipboard'
      })
    }

    const editNode = () => {
      emit('edit', props.node)
    }

    const deleteNode = () => {
      emit('delete', props.node)
    }

    // Initialize activeTab when availableTabs changes
    const initializeActiveTab = () => {
      if (availableTabs.value.length > 0 && !availableTabs.value.find(tab => tab.key === activeTab.value)) {
        activeTab.value = availableTabs.value[0].key
      }
    }

    onMounted(() => {
      initializeActiveTab()
    })

    return {
      // Data
      collectionType,
      selectedModel,
      maxTokens,
      customPrompt,
      selectedImages,
      isDragOver,
      createResultNode,
      createStructuredNodes,
      enableContextDetection,
      isAnalyzing,
      loadingMessage,
      analysisResult,
      collectionData,
      errorMessage,
      successMessage,
      activeTab,
      multiFileInput,

      // Computed
      hasStructuredData,
      availableTabs,

      // Methods
      getCollectionDescription,
      getUploadInstructions,
      handleMultiFileSelect,
      handleMultiDrop,
      removeImage,
      moveImage,
      analyzeCollection,
      createNodes,
      formatAnalysisKey,
      copyResultsToClipboard,
      editNode,
      deleteNode,
    }
  },
}
</script>

<style scoped>
.gnew-collection-analysis-node {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #f9f9f9;
  margin: 8px;
  min-height: 400px;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e0e0e0;
}

.node-title-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-icon {
  font-size: 1.2em;
}

.node-label {
  font-weight: 600;
  font-size: 1.1em;
}

.node-type-badge-inline {
  background: #007bff;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7em;
  font-weight: 600;
}

.node-controls {
  display: flex;
  gap: 4px;
}

.btn-control {
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 0.9em;
}

.btn-control:hover {
  background: #f0f0f0;
}

.btn-control.edit {
  color: #007bff;
}

.btn-control.delete {
  color: #dc3545;
}

.control-section {
  margin-bottom: 16px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 0.95em;
  font-weight: 600;
  color: #333;
}

.section-icon {
  font-size: 1.1em;
}

.collection-type-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.collection-description {
  margin-top: 4px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-label {
  font-size: 0.9em;
  font-weight: 500;
  color: #555;
}

.form-control {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9em;
}

.multi-upload-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  transition: all 0.3s ease;
  min-height: 120px;
  background: #fafafa;
}

.multi-upload-area.drag-over {
  border-color: #007bff;
  background: #f0f8ff;
}

.upload-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.upload-prompt i {
  font-size: 2em;
  color: #ccc;
}

.upload-instructions {
  color: #666;
  font-size: 0.9em;
  margin: 0;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.image-preview-item {
  position: relative;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  background: white;
}

.preview-img {
  width: 100%;
  height: 80px;
  object-fit: cover;
}

.image-controls {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 2px;
}

.image-number {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.8em;
  font-weight: 600;
}

.btn-remove,
.btn-move {
  background: rgba(220, 53, 69, 0.8);
  color: white;
  border: none;
  border-radius: 3px;
  padding: 2px 4px;
  cursor: pointer;
  font-size: 0.7em;
}

.btn-move {
  background: rgba(0, 123, 255, 0.8);
}

.btn-remove:hover {
  background: rgba(220, 53, 69, 1);
}

.btn-move:hover {
  background: rgba(0, 123, 255, 1);
}

.btn-move:disabled {
  background: rgba(108, 117, 125, 0.5);
  cursor: not-allowed;
}

.image-info {
  padding: 4px;
  text-align: center;
  border-top: 1px solid #eee;
}

.add-more-item {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #ccc;
  border-radius: 6px;
  background: #f8f9fa;
  min-height: 120px;
}

.btn-add-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 16px;
}

.btn-add-more:hover {
  color: #007bff;
}

.prompt-textarea {
  min-height: 80px;
  resize: vertical;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.option-label {
  font-size: 0.9em;
}

.analyze-btn {
  width: 100%;
  padding: 12px;
  font-size: 1em;
  font-weight: 600;
}

.loading-info {
  margin-top: 12px;
}

.progress {
  height: 6px;
  margin-bottom: 8px;
}

.loading-message {
  color: #666;
  font-style: italic;
}

.results-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-section {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.analysis-text {
  line-height: 1.6;
  white-space: pre-wrap;
}

.data-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid #dee2e6;
}

.data-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.9em;
  color: #666;
  transition: all 0.2s ease;
}

.data-tab:hover {
  color: #007bff;
}

.data-tab.active {
  color: #007bff;
  border-bottom-color: #007bff;
  font-weight: 600;
}

.tab-content {
  min-height: 100px;
}

.items-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.item-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
}

.item-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-detail {
  font-size: 0.85em;
  color: #666;
}

.sequence-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sequence-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border-left: 4px solid #28a745;
}

.step-number {
  background: #28a745;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
  line-height: 1.5;
}

.analysis-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.analysis-item {
  padding: 12px;
  background: white;
  border-radius: 6px;
  border-left: 4px solid #17a2b8;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  line-height: 1.4;
}

.result-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.alert {
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.alert-danger {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.alert-success {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

@media (max-width: 768px) {
  .config-grid {
    grid-template-columns: 1fr;
  }

  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }

  .items-list {
    grid-template-columns: 1fr;
  }

  .result-actions {
    flex-direction: column;
  }
}
</style>
