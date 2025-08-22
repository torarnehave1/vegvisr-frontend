<template>
  <div class="gnew-comparison-analysis-node">
    <!-- Node Header -->
    <div class="node-header">
      <div class="node-title-section">
        <span class="node-icon">🔍⚖️</span>
        <span class="node-label">{{ node.label || 'Image Comparison' }}</span>
        <div class="node-type-badge-inline">COMPARISON_ANALYSIS</div>
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

    <!-- Comparison Type Selection -->
    <div class="control-section comparison-type-section">
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

    <!-- Two-Image Upload Section -->
    <div class="control-section image-upload-section">
      <h6 class="section-title">
        <span class="section-icon">🖼️</span>
        Upload Images for Comparison
      </h6>

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

    <!-- Custom Prompt (for custom comparison type) -->
    <div v-if="comparisonType === 'custom'" class="control-section prompt-section">
      <h6 class="section-title">
        <span class="section-icon">✏️</span>
        Custom Comparison Prompt
      </h6>
      <textarea
        v-model="customPrompt"
        class="form-control prompt-textarea"
        rows="4"
        placeholder="Describe how you want to compare these two images..."
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
          <span class="option-label">Create Difference Nodes</span>
        </label>
        <label class="option-item">
          <input type="checkbox" v-model="showSideBySide">
          <span class="option-label">Show Side-by-Side View</span>
        </label>
      </div>
    </div>

    <!-- Compare Button -->
    <div class="control-section analyze-section">
      <button
        @click="compareImages"
        :disabled="isAnalyzing || !imageA || !imageB"
        class="btn btn-primary analyze-btn"
      >
        <span v-if="isAnalyzing" class="spinner-border spinner-border-sm me-2"></span>
        <i v-else class="bi bi-arrows-collapse me-2"></i>
        {{ isAnalyzing ? 'Comparing...' : 'Compare Images' }}
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
        Comparison Results
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

      <!-- Side-by-Side View -->
      <div v-if="showSideBySide && imageA && imageB" class="side-by-side-view">
        <div class="comparison-images">
          <div class="comparison-image">
            <img :src="imageA.preview" :alt="getImageALabel()" class="compare-img">
            <div class="image-label">{{ getImageALabel() }}</div>
          </div>
          <div class="comparison-image">
            <img :src="imageB.preview" :alt="getImageBLabel()" class="compare-img">
            <div class="image-label">{{ getImageBLabel() }}</div>
          </div>
        </div>
      </div>

      <!-- Analysis Results -->
      <div v-if="analysisResult" class="results-content">
        <!-- Similarity Score -->
        <div v-if="comparisonData?.similarityScore !== null" class="similarity-section">
          <div class="similarity-score">
            <span class="score-label">Similarity Score:</span>
            <div class="score-display">
              <div class="score-bar">
                <div
                  class="score-fill"
                  :style="{ width: comparisonData.similarityScore + '%' }"
                ></div>
              </div>
              <span class="score-text">{{ comparisonData.similarityScore }}%</span>
            </div>
          </div>
        </div>

        <!-- Main Analysis -->
        <div class="result-section">
          <h6>Analysis Summary</h6>
          <div class="analysis-text">{{ analysisResult }}</div>
        </div>

        <!-- Structured Data Tabs -->
        <div v-if="comparisonData && hasStructuredData" class="structured-data">
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
            <!-- Differences Tab -->
            <div v-if="activeTab === 'differences' && comparisonData.differences?.length" class="tab-pane">
              <div class="differences-list">
                <div v-for="(diff, index) in comparisonData.differences" :key="index" class="difference-item">
                  <div class="difference-header">
                    <span class="difference-location">{{ diff.location || `Difference ${index + 1}` }}</span>
                    <span class="significance-badge" :class="diff.significance || 'medium'">
                      {{ formatSignificance(diff.significance) }}
                    </span>
                  </div>
                  <div class="difference-description">{{ diff.description }}</div>
                </div>
              </div>
            </div>

            <!-- Changes Tab -->
            <div v-if="activeTab === 'changes' && comparisonData.changes?.length" class="tab-pane">
              <div class="changes-list">
                <div v-for="(change, index) in comparisonData.changes" :key="index" class="change-item">
                  <div class="change-content">
                    <strong>{{ change.name || change.description }}</strong>
                    <div v-if="change.category" class="change-detail">Category: {{ change.category }}</div>
                    <div v-if="change.impact" class="change-detail">Impact: {{ change.impact }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Quality Scores Tab -->
            <div v-if="activeTab === 'quality' && comparisonData.qualityScores" class="tab-pane">
              <div class="quality-comparison">
                <div class="quality-item">
                  <span class="quality-label">{{ getImageALabel() }}:</span>
                  <div class="quality-score">
                    <span class="score">{{ comparisonData.qualityScores.imageA || 'N/A' }}</span>
                    <div v-if="comparisonData.qualityScores.imageA" class="score-bar">
                      <div
                        class="score-fill"
                        :style="{ width: (comparisonData.qualityScores.imageA * 10) + '%' }"
                      ></div>
                    </div>
                  </div>
                </div>
                <div class="quality-item">
                  <span class="quality-label">{{ getImageBLabel() }}:</span>
                  <div class="quality-score">
                    <span class="score">{{ comparisonData.qualityScores.imageB || 'N/A' }}</span>
                    <div v-if="comparisonData.qualityScores.imageB" class="score-bar">
                      <div
                        class="score-fill"
                        :style="{ width: (comparisonData.qualityScores.imageB * 10) + '%' }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Assessment Tab -->
            <div v-if="activeTab === 'assessment' && comparisonData.assessment" class="tab-pane">
              <div class="assessment-details">
                <div v-for="(value, key) in comparisonData.assessment" :key="key" class="assessment-item">
                  <strong>{{ formatAssessmentKey(key) }}:</strong>
                  <div>{{ value }}</div>
                </div>
              </div>
            </div>

            <!-- Recommendations Tab -->
            <div v-if="activeTab === 'recommendations' && comparisonData.recommendations?.length" class="tab-pane">
              <div class="recommendations-list">
                <div v-for="(recommendation, index) in comparisonData.recommendations" :key="index" class="recommendation-item">
                  <i class="bi bi-lightbulb me-2"></i>
                  {{ recommendation }}
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
  name: 'GNewComparisonAnalysisNode',
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
    const comparisonType = ref('spot_differences')
    const selectedModel = ref('gpt-4o-mini')
    const maxTokens = ref(2048)
    const customPrompt = ref('')
    const imageA = ref(null)
    const imageB = ref(null)
    const isDragOverA = ref(false)
    const isDragOverB = ref(false)

    // Options
    const createResultNode = ref(true)
    const createStructuredNodes = ref(true)
    const showSideBySide = ref(true)

    // Analysis state
    const isAnalyzing = ref(false)
    const loadingMessage = ref('')
    const analysisResult = ref('')
    const comparisonData = ref(null)
    const errorMessage = ref('')
    const successMessage = ref('')
    const activeTab = ref('differences')

    // File input refs
    const fileInputA = ref(null)
    const fileInputB = ref(null)

    // Computed properties
    const hasStructuredData = computed(() => {
      return comparisonData.value && (
        comparisonData.value.differences?.length ||
        comparisonData.value.changes?.length ||
        comparisonData.value.qualityScores ||
        Object.keys(comparisonData.value.assessment || {}).length ||
        comparisonData.value.recommendations?.length
      )
    })

    const availableTabs = computed(() => {
      const tabs = []

      if (comparisonData.value?.differences?.length) {
        tabs.push({ key: 'differences', label: 'Differences', icon: '🔍' })
      }
      if (comparisonData.value?.changes?.length) {
        tabs.push({ key: 'changes', label: 'Changes', icon: '🔄' })
      }
      if (comparisonData.value?.qualityScores) {
        tabs.push({ key: 'quality', label: 'Quality', icon: '⭐' })
      }
      if (comparisonData.value?.assessment && Object.keys(comparisonData.value.assessment).length) {
        tabs.push({ key: 'assessment', label: 'Assessment', icon: '📋' })
      }
      if (comparisonData.value?.recommendations?.length) {
        tabs.push({ key: 'recommendations', label: 'Recommendations', icon: '💡' })
      }

      return tabs
    })

    // Methods
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
        errorMessage.value = 'File is too large (max 5MB)'
        return
      }

      try {
        const base64 = await convertFileToBase64(file)
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

        errorMessage.value = ''
      } catch (error) {
        console.error('Error processing file:', error)
        errorMessage.value = 'Error processing image A'
      }
    }

    const setImageB = async (file) => {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        errorMessage.value = 'File is too large (max 5MB)'
        return
      }

      try {
        const base64 = await convertFileToBase64(file)
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

        errorMessage.value = ''
      } catch (error) {
        console.error('Error processing file:', error)
        errorMessage.value = 'Error processing image B'
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

    const compareImages = async () => {
      if (!imageA.value || !imageB.value) {
        errorMessage.value = 'Please select both images for comparison'
        return
      }

      isAnalyzing.value = true
      errorMessage.value = ''
      successMessage.value = ''
      loadingMessage.value = 'Preparing images for comparison...'

      try {
        const requestBody = {
          imageA: imageA.value.base64,
          imageB: imageB.value.base64,
          comparisonType: comparisonType.value,
          prompt: comparisonType.value === 'custom' ? customPrompt.value : undefined,
          model: selectedModel.value,
          maxTokens: maxTokens.value,
        }

        loadingMessage.value = 'Sending to comparison analysis service...'

        const response = await fetch(
          'https://image-analysis-worker.torarnehave.workers.dev/compare-images',
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
          throw new Error(errorData.error || 'Comparison analysis service request failed')
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Comparison analysis failed')
        }

        analysisResult.value = data.analysis
        comparisonData.value = data.comparisonData

        // Set active tab to first available
        if (availableTabs.value.length > 0) {
          activeTab.value = availableTabs.value[0].key
        }

        successMessage.value = 'Image comparison completed successfully!'

        // Create nodes if enabled
        if (createResultNode.value || createStructuredNodes.value) {
          await createNodes()
        }

      } catch (error) {
        console.error('Comparison analysis error:', error)
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
            label: `Comparison: ${getComparisonTypeName()}`,
            type: 'info',
            info: analysisResult.value,
            color: '#e8f5e8',
          })
          newNodes.push(resultNode)
        }

        if (createStructuredNodes.value && comparisonData.value) {
          // Create nodes for differences
          if (comparisonData.value.differences?.length) {
            for (const diff of comparisonData.value.differences) {
              const node = await graphStore.createNode({
                label: diff.location || 'Difference',
                type: 'difference',
                info: `${diff.description}\nSignificance: ${diff.significance || 'Medium'}`,
                color: getSignificanceColor(diff.significance),
              })
              newNodes.push(node)
            }
          }

          // Create nodes for changes
          if (comparisonData.value.changes?.length) {
            for (const change of comparisonData.value.changes) {
              const node = await graphStore.createNode({
                label: change.name || change.description,
                type: 'change',
                info: `Category: ${change.category || 'N/A'}\nImpact: ${change.impact || 'N/A'}`,
                color: '#ffe6e6',
              })
              newNodes.push(node)
            }
          }
        }

        console.log(`Created ${newNodes.length} nodes from comparison analysis`)

      } catch (error) {
        console.error('Error creating nodes:', error)
        errorMessage.value = 'Failed to create nodes. Please try again.'
      }
    }

    const getComparisonTypeName = () => {
      const names = {
        spot_differences: 'Spot Differences',
        before_after: 'Before/After',
        quality_comparison: 'Quality Comparison',
        variant_analysis: 'Variant Analysis',
        custom: 'Custom Comparison'
      }
      return names[comparisonType.value] || 'Comparison'
    }

    const formatSignificance = (significance) => {
      const formatted = {
        high: 'High',
        medium: 'Medium',
        low: 'Low'
      }
      return formatted[significance] || 'Medium'
    }

    const getSignificanceColor = (significance) => {
      const colors = {
        high: '#ffcccc',
        medium: '#fff4cc',
        low: '#e6ffe6'
      }
      return colors[significance] || '#fff4cc'
    }

    const formatAssessmentKey = (key) => {
      return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }

    const copyResultsToClipboard = () => {
      let textToCopy = analysisResult.value

      if (comparisonData.value) {
        textToCopy += '\n\n--- Comparison Data ---\n'

        if (comparisonData.value.similarityScore !== null) {
          textToCopy += `\nSimilarity Score: ${comparisonData.value.similarityScore}%\n`
        }

        if (comparisonData.value.differences?.length) {
          textToCopy += '\nDifferences:\n'
          comparisonData.value.differences.forEach(diff => {
            textToCopy += `- ${diff.location || 'Unknown location'}: ${diff.description}\n`
          })
        }

        if (comparisonData.value.recommendations?.length) {
          textToCopy += '\nRecommendations:\n'
          comparisonData.value.recommendations.forEach(rec => {
            textToCopy += `- ${rec}\n`
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
      comparisonType,
      selectedModel,
      maxTokens,
      customPrompt,
      imageA,
      imageB,
      isDragOverA,
      isDragOverB,
      createResultNode,
      createStructuredNodes,
      showSideBySide,
      isAnalyzing,
      loadingMessage,
      analysisResult,
      comparisonData,
      errorMessage,
      successMessage,
      activeTab,
      fileInputA,
      fileInputB,

      // Computed
      hasStructuredData,
      availableTabs,

      // Methods
      getComparisonDescription,
      getImageALabel,
      getImageBLabel,
      handleFileSelectA,
      handleFileSelectB,
      handleDropA,
      handleDropB,
      clearImageA,
      clearImageB,
      compareImages,
      createNodes,
      formatSignificance,
      formatAssessmentKey,
      copyResultsToClipboard,
      editNode,
      deleteNode,
    }
  },
}
</script>

<style scoped>
.gnew-comparison-analysis-node {
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

.comparison-type-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comparison-description {
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

.two-image-layout {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  align-items: center;
}

.image-upload-slot {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slot-label {
  font-weight: 600;
  color: #333;
}

.btn-clear {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.8em;
}

.btn-clear:hover {
  background: #c82333;
}

.upload-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  transition: all 0.3s ease;
  min-height: 150px;
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-area.drag-over {
  border-color: #007bff;
  background: #f0f8ff;
}

.upload-area.has-image {
  padding: 8px;
  border-color: #28a745;
  background: #f8fff9;
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

.image-preview {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-img {
  width: 100%;
  max-height: 150px;
  object-fit: cover;
  border-radius: 4px;
}

.image-info {
  text-align: center;
  padding: 4px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
}

.vs-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  background: linear-gradient(45deg, #007bff, #0056b3);
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 1.2em;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.vs-text {
  font-weight: 700;
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

.side-by-side-view {
  margin-bottom: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
}

.comparison-images {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.comparison-image {
  text-align: center;
}

.compare-img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 6px;
  border: 2px solid #dee2e6;
}

.image-label {
  margin-top: 8px;
  font-weight: 600;
  color: #495057;
}

.similarity-section {
  margin-bottom: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #17a2b8;
}

.similarity-score {
  display: flex;
  align-items: center;
  gap: 16px;
}

.score-label {
  font-weight: 600;
  color: #495057;
  min-width: 120px;
}

.score-display {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.score-bar {
  flex: 1;
  height: 20px;
  background: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  background: linear-gradient(90deg, #dc3545 0%, #ffc107 50%, #28a745 100%);
  border-radius: 10px;
  transition: width 0.5s ease;
}

.score-text {
  font-weight: 600;
  color: #495057;
  min-width: 40px;
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

.differences-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.difference-item {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
}

.difference-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.difference-location {
  font-weight: 600;
  color: #495057;
}

.significance-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: 600;
}

.significance-badge.high {
  background: #f8d7da;
  color: #721c24;
}

.significance-badge.medium {
  background: #fff3cd;
  color: #856404;
}

.significance-badge.low {
  background: #d4edda;
  color: #155724;
}

.difference-description {
  line-height: 1.4;
  color: #6c757d;
}

.changes-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.change-item {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
}

.change-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.change-detail {
  font-size: 0.85em;
  color: #666;
}

.quality-comparison {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quality-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.quality-label {
  font-weight: 600;
  color: #495057;
  min-width: 100px;
}

.quality-score {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.score {
  font-weight: 600;
  color: #495057;
  min-width: 40px;
}

.assessment-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.assessment-item {
  padding: 12px;
  background: white;
  border-radius: 6px;
  border-left: 4px solid #17a2b8;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recommendation-item {
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
  .two-image-layout {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .vs-separator {
    width: 40px;
    height: 40px;
    font-size: 1em;
  }

  .comparison-images {
    grid-template-columns: 1fr;
  }

  .similarity-score {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .score-label {
    min-width: auto;
  }

  .quality-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .config-grid {
    grid-template-columns: 1fr;
  }

  .changes-list {
    grid-template-columns: 1fr;
  }

  .result-actions {
    flex-direction: column;
  }
}
</style>
