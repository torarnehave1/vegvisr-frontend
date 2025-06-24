<template>
  <div v-if="isOpen" class="template-selector-modal">
    <div class="template-selector-content">
      <div class="template-header">
        <h3>Apply Style Template</h3>
        <button class="template-close" @click="closeModal" title="Close">&times;</button>
      </div>

      <div class="template-body">
        <div v-if="loading" class="template-loading">
          <span class="spinner"></span>
          Loading templates...
        </div>

        <div v-else-if="error" class="template-error">
          <span class="error-icon">⚠️</span>
          {{ error }}
        </div>

        <div v-else class="template-list">
          <div class="template-info">
            <p>
              Select a formatting template to enhance your <strong>{{ nodeType }}</strong> node:
            </p>
          </div>

          <div
            v-for="template in filteredTemplates"
            :key="template.id"
            class="template-card"
            :class="{ 'template-selected': selectedTemplate?.id === template.id }"
            @click="selectTemplate(template)"
          >
            <div class="template-card-header">
              <h4>{{ template.name }}</h4>
              <span class="template-category">{{ template.category }}</span>
            </div>
            <p class="template-description">{{ template.description }}</p>

            <div class="template-features">
              <span v-if="template.transformationRules.addFancyHeaders" class="feature-tag">
                ✨ FANCY Headers
              </span>
              <span v-if="template.transformationRules.addSections" class="feature-tag">
                📋 SECTION Blocks
              </span>
              <span v-if="template.transformationRules.addQuotes" class="feature-tag">
                💬 QUOTE Citations
              </span>
              <span v-if="template.transformationRules.addWorkNotes" class="feature-tag">
                📝 WNOTE Annotations
              </span>
              <span v-if="template.transformationRules.addHeaderImage" class="feature-tag">
                🖼️ Header Images
              </span>
              <span v-if="template.transformationRules.addSideImages?.leftside" class="feature-tag">
                ⬅️ Leftside Images
              </span>
              <span
                v-if="template.transformationRules.addSideImages?.rightside"
                class="feature-tag"
              >
                ➡️ Rightside Images
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="template-footer">
        <div class="template-options" v-if="selectedTemplate">
          <div class="options-row">
            <div class="formatting-options">
              <h4>Formatting Options</h4>
              <label class="option-checkbox">
                <input type="checkbox" v-model="options.includeImages" />
                Include contextual images
              </label>
              <label class="option-checkbox">
                <input type="checkbox" v-model="options.preserveStructure" />
                Preserve existing structure
              </label>
            </div>

            <!-- Color Theme Selection -->
            <div class="color-theme-section">
              <h4>🎨 Color Theme</h4>
              <div class="color-theme-grid">
                <div
                  v-for="(theme, themeId) in colorThemes"
                  :key="themeId"
                  class="color-theme-card"
                  :class="{ 'theme-selected': selectedColorTheme === themeId }"
                  @click="selectedColorTheme = themeId"
                >
                  <div class="theme-preview" :style="{ background: theme.preview }"></div>
                  <span class="theme-name">{{ theme.name }}</span>
                </div>
              </div>
            </div>

            <!-- Language Preservation Section -->
            <div class="language-preservation-section">
              <h4>🌍 Language Options</h4>
              <div class="language-options">
                <label class="language-radio">
                  <input type="radio" v-model="languageMode" value="auto-detect" />
                  🔍 Auto-detect and keep current language
                  <span
                    v-if="detectedLanguage && detectedLanguage !== 'Unknown'"
                    class="detected-lang"
                  >
                    (Detected: {{ detectedLanguage }})
                  </span>
                  <span v-else-if="detectedLanguage === 'Unknown'" class="detected-lang">
                    (Language unclear - will preserve as-is)
                  </span>
                </label>
                <label class="language-radio">
                  <input type="radio" v-model="languageMode" value="keep-current" />
                  🔒 Keep current language as-is
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="template-actions">
          <button @click="closeModal" class="btn btn-secondary">Cancel</button>
          <button
            @click="applyTemplate"
            :disabled="!selectedTemplate || applying"
            class="btn btn-primary"
          >
            <span v-if="applying" class="spinner-sm"></span>
            {{ applying ? 'Applying...' : 'Apply Template' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  nodeType: {
    type: String,
    required: true,
  },
  nodeContent: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['close', 'template-applied'])

// Color Themes Configuration
const colorThemes = ref({
  sunset: {
    name: 'Sunset Gradient',
    primary: '#FF6B6B',
    secondary: '#FFE66D',
    accent: '#FF8E53',
    background: '#FFF5F5',
    sections: ['#FFE8E8', '#FFF0E0', '#FFE5CC'],
    preview: 'linear-gradient(45deg, #FF6B6B, #FFE66D, #FF8E53)',
  },
  lavender_dream: {
    name: 'Lavender Dream',
    primary: '#8B5A8C',
    secondary: '#C8A8C8',
    accent: '#6B4C6B',
    background: '#F8F5F8',
    sections: ['#F0E8F0', '#E8D8E8', '#E0C8E0'],
    preview: 'linear-gradient(45deg, #8B5A8C, #C8A8C8, #6B4C6B)',
  },
  ocean_blue: {
    name: 'Ocean Blue',
    primary: '#4ECDC4',
    secondary: '#45B7D1',
    accent: '#96CEB4',
    background: '#F0F8FF',
    sections: ['#E8F4F8', '#E0F0F8', '#D8EBF0'],
    preview: 'linear-gradient(45deg, #4ECDC4, #45B7D1, #96CEB4)',
  },
  forest_green: {
    name: 'Forest Green',
    primary: '#6BCF7F',
    secondary: '#4D7C0F',
    accent: '#84CC16',
    background: '#F0FDF4',
    sections: ['#E8F5E8', '#E0F0E0', '#D8EBD8'],
    preview: 'linear-gradient(45deg, #6BCF7F, #4D7C0F, #84CC16)',
  },
  midnight: {
    name: 'Midnight Dark',
    primary: '#1F2937',
    secondary: '#374151',
    accent: '#6366F1',
    background: '#F9FAFB',
    sections: ['#F3F4F6', '#E5E7EB', '#D1D5DB'],
    preview: 'linear-gradient(45deg, #1F2937, #374151, #6366F1)',
  },
  coral_reef: {
    name: 'Coral Reef',
    primary: '#FF7F7F',
    secondary: '#FFB366',
    accent: '#FF9999',
    background: '#FFF8F8',
    sections: ['#FFE8E8', '#FFEBE8', '#FFE5E5'],
    preview: 'linear-gradient(45deg, #FF7F7F, #FFB366, #FF9999)',
  },
})

// State
const templates = ref([])
const loading = ref(false)
const error = ref('')
const selectedTemplate = ref(null)
const selectedColorTheme = ref('lavender_dream') // Default to lavender dream
const applying = ref(false)
const options = ref({
  includeImages: true,
  preserveStructure: false,
})

// NEW: Language detection state
const languageMode = ref('auto-detect')
const detectedLanguage = ref('')

// Computed
const filteredTemplates = computed(() => {
  return templates.value.filter((template) => template.nodeTypes.includes(props.nodeType))
})

// Methods
const fetchTemplates = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch(
      `https://api.vegvisr.org/style-templates?nodeType=${props.nodeType}`,
    )

    if (!response.ok) {
      throw new Error('Failed to fetch templates')
    }

    const data = await response.json()
    templates.value = data.templates || []

    // DEBUG: Log template information
    console.log('=== Template Fetch Debug ===')
    console.log('Node Type:', props.nodeType)
    console.log('Total templates received:', templates.value.length)
    console.log(
      'Templates:',
      templates.value.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        nodeTypes: t.nodeTypes,
      })),
    )
    console.log('Filtered templates:', filteredTemplates.value.length)

    // Auto-select first template if available
    if (templates.value.length > 0) {
      selectedTemplate.value = templates.value[0]
    }
  } catch (err) {
    error.value = err.message
    console.error('Error fetching templates:', err)
  } finally {
    loading.value = false
  }
}

const selectTemplate = (template) => {
  selectedTemplate.value = template
}

// NEW: Simple language detection function
const detectLanguage = (text) => {
  if (!text || text.trim().length === 0) return 'Unknown'

  // Norwegian common words
  const norwegianWords = [
    'og',
    'er',
    'på',
    'med',
    'til',
    'av',
    'for',
    'ikke',
    'som',
    'det',
    'den',
    'de',
    'å',
    'i',
    'har',
    'var',
    'kan',
    'skal',
    'vil',
    'må',
  ]
  // English common words
  const englishWords = [
    'the',
    'and',
    'is',
    'in',
    'to',
    'of',
    'for',
    'not',
    'as',
    'it',
    'with',
    'that',
    'this',
    'have',
    'was',
    'can',
    'will',
    'would',
    'could',
    'should',
  ]

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 1)
  const norwegianCount = words.filter((word) => norwegianWords.includes(word)).length
  const englishCount = words.filter((word) => englishWords.includes(word)).length

  console.log('=== Language Detection ===')
  console.log('Text length:', text.length)
  console.log('Norwegian matches:', norwegianCount)
  console.log('English matches:', englishCount)

  if (norwegianCount > englishCount && norwegianCount > 2) return 'Norwegian'
  if (englishCount > norwegianCount && englishCount > 2) return 'English'
  return 'Unknown'
}

const applyTemplate = async () => {
  if (!selectedTemplate.value) return

  applying.value = true

  try {
    const response = await fetch('https://api.vegvisr.org/apply-style-template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeContent: props.nodeContent,
        templateId: selectedTemplate.value.id,
        nodeType: props.nodeType,
        options: options.value,
        colorTheme: {
          id: selectedColorTheme.value,
          ...colorThemes.value[selectedColorTheme.value],
        },
        // NEW: Language preservation options
        languageOptions: {
          mode: languageMode.value,
          detectedLanguage: detectedLanguage.value,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to apply template')
    }

    const result = await response.json()

    emit('template-applied', {
      formattedContent: result.formattedContent,
      templateUsed: result.templateUsed,
      template: selectedTemplate.value,
    })

    closeModal()
  } catch (err) {
    error.value = err.message
    console.error('Error applying template:', err)
  } finally {
    applying.value = false
  }
}

const closeModal = () => {
  selectedTemplate.value = null
  error.value = ''
  emit('close')
}

// Watchers
watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue) {
      fetchTemplates()
      // NEW: Detect language when modal opens
      if (props.nodeContent) {
        detectedLanguage.value = detectLanguage(props.nodeContent)
        console.log('Detected language for template selector:', detectedLanguage.value)
      }
    }
  },
)

// NEW: Watch for content changes to re-detect language
watch(
  () => props.nodeContent,
  (newContent) => {
    if (newContent && props.isOpen) {
      detectedLanguage.value = detectLanguage(newContent)
      console.log('Re-detected language:', detectedLanguage.value)
    }
  },
)

// Lifecycle
onMounted(() => {
  if (props.isOpen) {
    fetchTemplates()
  }
})
</script>

<style scoped>
.template-selector-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.template-selector-content {
  background: #fff;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
}

.template-header h3 {
  margin: 0;
  font-size: 1.4rem;
  color: #333;
}

.template-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: #888;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-close:hover {
  color: #333;
}

.template-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.template-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: #6c757d;
}

.template-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  color: #721c24;
}

.error-icon {
  font-size: 1.2rem;
}

.template-info {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #6f42c1;
}

.template-info p {
  margin: 0;
  color: #495057;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.template-card {
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fff;
}

.template-card:hover {
  border-color: #6f42c1;
  box-shadow: 0 4px 12px rgba(111, 66, 193, 0.1);
}

.template-selected {
  border-color: #6f42c1 !important;
  background-color: #f8f5ff !important;
  box-shadow: 0 4px 12px rgba(111, 66, 193, 0.2);
}

.template-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.template-card-header h4 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.template-category {
  background-color: #6f42c1;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: 600;
}

.template-description {
  margin: 0 0 12px 0;
  color: #6c757d;
  font-size: 0.9rem;
  line-height: 1.4;
}

.template-features {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.feature-tag {
  background-color: #e9ecef;
  color: #495057;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.template-footer {
  border-top: 1px solid #e9ecef;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.template-options {
  flex: 1;
  max-width: 70%;
}

.template-options h4 {
  margin: 0 0 10px 0;
  font-size: 1rem;
  color: #333;
}

.option-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: #495057;
  cursor: pointer;
}

.option-checkbox input[type='checkbox'] {
  margin: 0;
}

.template-actions {
  display: flex;
  gap: 10px;
  align-self: flex-end;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #545b62;
}

.btn-primary {
  background-color: #6f42c1;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #5a359a;
}

.btn-primary:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #6f42c1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-sm {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Template Footer Layout */
.options-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: flex-start;
}

.formatting-options {
  min-width: 0;
}

/* Color Theme Styles */
.color-theme-section {
  min-width: 0;
}

.color-theme-section h4 {
  margin: 0 0 10px 0;
  font-size: 1rem;
  color: #333;
}

.color-theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.color-theme-card {
  border: 2px solid #e9ecef;
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  background: #fff;
}

.color-theme-card:hover {
  border-color: #6f42c1;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(111, 66, 193, 0.15);
}

.theme-selected {
  border-color: #6f42c1 !important;
  background-color: #f8f5ff !important;
  box-shadow: 0 2px 8px rgba(111, 66, 193, 0.2);
}

.theme-preview {
  width: 100%;
  height: 24px;
  border-radius: 4px;
  margin-bottom: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.theme-name {
  font-size: 0.7rem;
  color: #495057;
  font-weight: 500;
  display: block;
  line-height: 1.2;
}

.theme-selected .theme-name {
  color: #6f42c1;
  font-weight: 600;
}

/* Language Preservation Styles */
.language-preservation-section {
  margin-top: 20px;
}

.language-preservation-section h4 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 1rem;
}

.language-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.language-radio {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.language-radio:hover {
  border-color: #6f42c1;
  background: #f8f5ff;
}

.language-radio input[type='radio'] {
  margin: 0;
}

.detected-lang {
  color: #28a745;
  font-size: 0.85em;
  font-weight: 500;
  margin-left: 4px;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .template-selector-content {
    width: 95%;
    max-height: 90vh;
  }

  .template-header,
  .template-body,
  .template-footer {
    padding: 16px;
  }

  .template-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .template-actions {
    justify-content: stretch;
  }

  .template-actions .btn {
    flex: 1;
  }

  .options-row {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .color-theme-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .color-theme-card {
    padding: 4px;
  }

  .theme-preview {
    height: 20px;
  }

  .theme-name {
    font-size: 0.65rem;
  }
}
</style>
