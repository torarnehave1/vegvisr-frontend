<template>
  <div class="domain-form">
    <div class="form-header">
      <div class="d-flex align-items-center mb-3">
        <button
          v-if="showBackButton"
          @click="$emit('back')"
          class="btn btn-outline-secondary btn-sm me-3"
        >
          <i class="fas fa-arrow-left"></i> Back to List
        </button>
        <h3 class="mb-0">
          {{ isEditing ? 'Edit Domain Configuration' : 'Add New Domain' }}
        </h3>
      </div>
      <p class="text-muted">
        {{ isEditing
          ? 'Update your domain configuration and branding settings.'
          : 'Set up a new custom domain with branding and content filtering.'
        }}
      </p>
    </div>

    <form @submit.prevent="handleSubmit" class="domain-form-content">
      <!-- Domain Input Section -->
      <div class="form-section">
        <h5 class="section-title">
          <i class="fas fa-globe text-primary me-2"></i>
          Domain Configuration
        </h5>

        <div class="form-group">
          <label for="customDomain" class="form-label">
            <strong>Custom Domain:</strong>
          </label>
          <input
            id="customDomain"
            v-model="formData.domain"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': domainError }"
            placeholder="e.g., mybrand.example.com"
            @input="validateDomain"
            :disabled="isEditing"
          />
          <div class="form-text">
            Enter your custom domain name. This can be a main domain (e.g., yourdomain.com) or a
            subdomain (e.g., mybrand.yourdomain.com).
            <br />
            <small class="text-muted">
              <i class="fas fa-info-circle"></i>
              Domain names are automatically converted to lowercase to prevent configuration issues.
            </small>
          </div>
          <div v-if="domainError" class="invalid-feedback">{{ domainError }}</div>
        </div>
      </div>

      <!-- Branding Section -->
      <div class="form-section">
        <h5 class="section-title">
          <i class="fas fa-paint-brush text-primary me-2"></i>
          Branding & Logo
        </h5>

        <div class="form-group">
          <label for="customLogo" class="form-label">
            <strong>Logo URL:</strong>
          </label>
          <div class="logo-input-group">
            <input
              id="customLogo"
              v-model="formData.logo"
              type="url"
              class="form-control"
              :class="{ 'is-invalid': logoError, 'is-valid': formData.logo && !logoError && logoLoaded }"
              placeholder="https://example.com/logo.png"
              @input="validateLogo"
            />
            <button
              type="button"
              class="btn btn-outline-primary"
              @click="triggerLogoUpload"
              :disabled="isUploadingLogo"
            >
              <i class="fas" :class="isUploadingLogo ? 'fa-spinner fa-spin' : 'fa-upload'"></i>
              {{ isUploadingLogo ? 'Uploading...' : 'Upload' }}
            </button>
            <button
              type="button"
              class="btn btn-outline-success"
              @click="openAILogoModal"
              :disabled="isUploadingLogo"
            >
              <i class="fas fa-magic"></i>
              AI Generate
            </button>
          </div>
          <input
            ref="logoFileInput"
            type="file"
            accept="image/*"
            style="display: none"
            @change="handleLogoUpload"
          />
          <div class="form-text">
            URL to your logo image, upload a new one, or generate one using AI. Recommended size:
            200x80px or similar aspect ratio.
          </div>
          <div v-if="logoError" class="invalid-feedback">{{ logoError }}</div>
        </div>

        <!-- Logo Preview -->
        <div v-if="formData.logo && !logoError" class="logo-preview mb-4">
          <label class="form-label"><strong>Logo Preview:</strong></label>
          <div class="preview-container">
            <img
              :src="formData.logo"
              alt="Logo Preview"
              class="logo-preview-img"
              @error="handleLogoError"
              @load="handleLogoLoad"
            />
          </div>
        </div>
      </div>

      <!-- Content Filtering Section -->
      <div class="form-section">
        <h5 class="section-title">
          <i class="fas fa-filter text-primary me-2"></i>
          Content Filtering
        </h5>

        <div class="form-group">
          <label class="form-label">
            <strong>Content Filtering:</strong>
          </label>
          <div class="filter-options">
            <div class="form-check">
              <input
                id="filterNone"
                v-model="formData.contentFilter"
                type="radio"
                value="none"
                class="form-check-input"
              />
              <label for="filterNone" class="form-check-label">
                <strong>No filtering</strong> - Show all content
              </label>
            </div>
            <div class="form-check">
              <input
                id="filterCustom"
                v-model="formData.contentFilter"
                type="radio"
                value="custom"
                class="form-check-input"
              />
              <label for="filterCustom" class="form-check-label">
                <strong>Filter by specific meta areas</strong> - Show only selected content categories
              </label>
            </div>
          </div>

          <!-- Custom Category Selection -->
          <div v-if="formData.contentFilter === 'custom'" class="category-selection mt-3">
            <label class="form-label">
              <strong>Select Meta Areas to Show:</strong>
            </label>
            <div class="form-text mb-3">
              Type # followed by meta area names. Use space to separate multiple areas.
              <span v-if="availableCategories.length === 0" class="text-warning">
                No meta areas found. Create some knowledge graphs with meta areas first.
              </span>
            </div>

            <!-- Meta Areas Input with Autocomplete -->
            <div v-if="availableCategories.length > 0" class="mb-3 position-relative">
              <input
                type="text"
                class="form-control"
                v-model="metaAreaInput"
                placeholder="e.g., #Technology #Management #WebDesign"
                @input="onMetaAreaInput"
                @keydown.tab.prevent="selectSuggestion"
                @keydown.enter.prevent="selectSuggestion"
                @keydown.down.prevent="moveSuggestion(1)"
                @keydown.up.prevent="moveSuggestion(-1)"
                @blur="handleBlur"
                @change="parseMetaAreaInput"
                autocomplete="off"
              />
              <ul v-if="showSuggestions" class="autocomplete-list">
                <li
                  v-for="(suggestion, idx) in filteredSuggestions"
                  :key="suggestion"
                  :class="{ active: idx === suggestionIndex }"
                  @mousedown.prevent="selectSuggestion(idx)"
                >
                  {{ suggestion }}
                </li>
              </ul>
            </div>

            <!-- Selected Meta Areas Display -->
            <div v-if="formData.selectedCategories.length > 0" class="selected-areas mt-2">
              <label class="form-label"><strong>Selected Meta Areas:</strong></label>
              <div class="selected-badges">
                <span
                  v-for="(area, index) in formData.selectedCategories"
                  :key="area"
                  class="badge bg-primary me-2 mb-2"
                >
                  {{ area }}
                  <button
                    type="button"
                    class="btn-close btn-close-white ms-2"
                    @click="removeMetaArea(index)"
                    aria-label="Remove"
                  ></button>
                </span>
              </div>
            </div>

            <div v-else class="alert alert-info">
              <i class="fas fa-info-circle"></i>
              <strong>No meta areas available yet.</strong><br />
              To enable content filtering, you need to:
              <ol class="mt-2 mb-0">
                <li>Create knowledge graphs in the system</li>
                <li>Add meta areas to those graphs (e.g., #Technology #Business)</li>
                <li>Come back here to select which meta areas to show on your domain</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <!-- Search Bar Settings Section -->
      <div class="form-section">
        <h5 class="section-title">
          <i class="fas fa-search text-primary me-2"></i>
          Search Settings
        </h5>

        <div class="form-group">
          <div class="form-check">
            <input
              id="showSearchBar"
              v-model="formData.showSearchBar"
              type="checkbox"
              class="form-check-input"
            />
            <label for="showSearchBar" class="form-check-label">
              <strong>Show search bar on knowledge graphs</strong>
            </label>
          </div>
          <div class="form-text">
            Controls whether the global search bar is displayed on knowledge graph pages. When disabled,
            users will need to use the dedicated search page to find content.
          </div>
        </div>
      </div>

      <!-- Front Page Selection Section -->
      <div class="form-section">
        <h5 class="section-title">
          <i class="fas fa-home text-primary me-2"></i>
          Front Page Configuration
        </h5>

        <div class="form-group">
          <label for="frontPage" class="form-label">
            <strong>Custom Front Page (Knowledge Graph):</strong>
          </label>
          <div class="input-group">
            <input
              type="text"
              class="form-control"
              id="frontPage"
              v-model="formData.mySiteFrontPage"
              placeholder="Enter Graph ID (e.g., graph_1234567890) or select from dropdown"
              @input="validateFrontPageGraph"
              :class="{ 'is-invalid': frontPageError, 'is-valid': frontPageValid }"
            />
            <button
              class="btn btn-outline-secondary dropdown-toggle"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              :disabled="userGraphs.length === 0"
            >
              {{ userGraphs.length === 0 ? 'No Graphs' : 'Select Graph' }}
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li v-if="userGraphs.length === 0" class="dropdown-item-text text-muted">
                <i class="fas fa-info-circle"></i>
                No knowledge graphs found. Create one first.
              </li>
              <li v-for="graph in userGraphs" :key="graph.id" @click="selectFrontPage(graph)">
                <a class="dropdown-item" href="#">
                  <strong>{{ graph.title }}</strong><br />
                  <small class="text-muted">ID: {{ graph.id }}</small>
                </a>
              </li>
            </ul>
          </div>
          <div class="form-text">
            Select a knowledge graph to use as your domain's front page. Leave empty to use the
            default landing page.
            <br />
            <small class="text-muted">
              <i class="fas fa-info-circle"></i>
              Graph IDs are automatically validated to prevent broken front pages.
            </small>
          </div>
          <div v-if="frontPageError" class="invalid-feedback">{{ frontPageError }}</div>
          <div v-if="frontPageValid && formData.mySiteFrontPage" class="valid-feedback">
            <i class="fas fa-check-circle"></i>
            Valid graph selected: {{ frontPageGraphTitle }}
          </div>
        </div>
      </div>

      <!-- Menu Configuration for Superadmin -->
      <div v-if="userStore.role === 'Superadmin'" class="form-section">
        <h5 class="section-title">
          <i class="fas fa-bars text-warning me-2"></i>
          Menu Configuration <span class="badge bg-warning text-dark">Superadmin</span>
        </h5>

        <div class="form-group">
          <div class="form-check mb-3">
            <input
              id="enableMenuConfig"
              v-model="formData.menuConfig.enabled"
              type="checkbox"
              class="form-check-input"
            />
            <label for="enableMenuConfig" class="form-check-label">
              <strong>Enable custom menu configuration for this domain</strong>
            </label>
          </div>

          <div v-if="formData.menuConfig.enabled" class="menu-items-config">
            <div class="alert alert-warning">
              <i class="fas fa-exclamation-triangle"></i>
              <strong>Advanced Feature:</strong> Menu configuration allows you to customize the navigation
              menu for this specific domain. This feature is only available to superadministrators.
            </div>
            <!-- Placeholder for menu configuration - can be expanded later -->
            <p class="text-muted">Menu configuration interface will be implemented here.</p>
          </div>
        </div>
      </div>

      <!-- Form Actions -->
      <div class="form-actions">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <small class="text-muted">
              <i class="fas fa-info-circle"></i>
              Changes are saved automatically to your profile and domain configuration.
            </small>
          </div>
          <div class="action-buttons">
            <button
              v-if="showBackButton"
              type="button"
              @click="$emit('cancel')"
              class="btn btn-outline-secondary me-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="!canSaveDomain || isSaving"
            >
              <i v-if="isSaving" class="fas fa-spinner fa-spin me-2"></i>
              <i v-else class="fas fa-save me-2"></i>
              {{ isSaving ? 'Saving...' : (isEditing ? 'Update Domain' : 'Add Domain') }}
            </button>
          </div>
        </div>
      </div>
    </form>

    <!-- AI Logo Generation Modal -->
    <AIImageModal
      :isOpen="isAILogoModalOpen"
      :graphContext="{ type: 'logo', domain: formData.domain }"
      @close="closeAILogoModal"
      @image-inserted="handleAILogoGenerated"
    />
  </div>
</template>

<script>
import { computed, ref, watch } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useDomainStore } from '@/stores/domainStore'
import AIImageModal from './AIImageModal.vue'

export default {
  name: 'DomainForm',
  components: {
    AIImageModal
  },
  props: {
    domainConfig: {
      type: Object,
      default: null
    },
    showBackButton: {
      type: Boolean,
      default: true
    }
  },
  emits: ['back', 'cancel', 'saved'],
  setup(props, { emit }) {
    const userStore = useUserStore()
    const portfolioStore = usePortfolioStore()
    const domainStore = useDomainStore()

    // Form state
    const formData = ref({
      domain: '',
      logo: '',
      contentFilter: 'none',
      selectedCategories: [],
      mySiteFrontPage: '',
      showSearchBar: true,
      menuConfig: {
        enabled: false,
        selectedTemplate: '',
        visibleItems: [
          'graph-editor',
          'graph-canvas',
          'graph-portfolio',
          'graph-viewer',
          'search',
          'user-dashboard',
          'github-issues',
          'sandbox',
          'gnew'
        ]
      }
    })

    // Validation state
    const domainError = ref('')
    const logoError = ref('')
    const frontPageError = ref('')
    const frontPageValid = ref(false)
    const frontPageGraphTitle = ref('')

    // UI state
    const logoLoaded = ref(false)
    const isUploadingLogo = ref(false)
    const isSaving = ref(false)
    const isAILogoModalOpen = ref(false)
    const logoFileInput = ref(null)

    // Meta area autocomplete state
    const metaAreaInput = ref('')
    const availableCategories = ref([])
    const showSuggestions = ref(false)
    const filteredSuggestions = ref([])
    const suggestionIndex = ref(-1)

    // User graphs for front page selection
    const userGraphs = ref([])

    // Computed properties
    const isEditing = computed(() => !!props.domainConfig)

    const canSaveDomain = computed(() => {
      return formData.value.domain &&
             !domainError.value &&
             !logoError.value &&
             !frontPageError.value
    })

    // Initialize form data
    const initializeForm = () => {
      if (props.domainConfig) {
        // Editing existing domain
        Object.assign(formData.value, props.domainConfig)
      }
      // Load user graphs and meta areas
      loadUserGraphs()
      loadAvailableMetaAreas()
    }

    // Domain validation
    const validateDomain = () => {
      const domain = formData.value.domain.toLowerCase()
      formData.value.domain = domain

      domainError.value = ''

      if (!domain) {
        domainError.value = 'Domain is required'
        return
      }

      // Basic domain validation
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}\.)*[a-zA-Z]{2,}$/
      if (!domainRegex.test(domain)) {
        domainError.value = 'Please enter a valid domain name'
        return
      }

      // Check for existing domain (only when adding new)
      if (!isEditing.value && domainStore.allDomains.some(d => d.domain === domain)) {
        domainError.value = 'This domain is already configured'
      }
    }

    // Logo validation and handling
    const validateLogo = () => {
      const logo = formData.value.logo
      logoError.value = ''
      logoLoaded.value = false

      if (!logo) return

      try {
        new URL(logo)
      } catch {
        logoError.value = 'Please enter a valid URL'
      }
    }

    const handleLogoLoad = () => {
      logoLoaded.value = true
    }

    const handleLogoError = () => {
      logoError.value = 'Failed to load logo image'
      logoLoaded.value = false
    }

    const triggerLogoUpload = () => {
      if (logoFileInput.value) {
        logoFileInput.value.click()
      }
    }

    const handleLogoUpload = async (event) => {
      const file = event.target.files?.[0]
      if (!file || !file.type.startsWith('image/')) {
        alert('Please select a valid image file.')
        return
      }

      isUploadingLogo.value = true

      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'image')

      try {
        const response = await fetch('https://api.vegvisr.org/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Failed to upload logo image')
        }

        const data = await response.json()
        formData.value.logo = data.url
        logoError.value = '' // Clear any previous errors

        console.log('Logo uploaded successfully:', data.url)
      } catch (error) {
        console.error('Error uploading logo:', error)
        alert('Failed to upload logo image. Please try again.')
      } finally {
        isUploadingLogo.value = false
        // Clear the file input
        if (event.target) {
          event.target.value = ''
        }
      }
    }

    // AI Logo Modal
    const openAILogoModal = () => {
      isAILogoModalOpen.value = true
    }

    const closeAILogoModal = () => {
      isAILogoModalOpen.value = false
    }

    const handleAILogoGenerated = (logoUrl) => {
      formData.value.logo = logoUrl
      validateLogo()
      closeAILogoModal()
    }

    // Meta area handling
    const loadAvailableMetaAreas = async () => {
      try {
        // Load from portfolio store
        await portfolioStore.loadUserGraphs(userStore.email)
        const categories = new Set()

        portfolioStore.userGraphs.forEach(graph => {
          if (graph.nodes) {
            graph.nodes.forEach(node => {
              if (node.metaAreas && Array.isArray(node.metaAreas)) {
                node.metaAreas.forEach(area => categories.add(area))
              }
            })
          }
        })

        availableCategories.value = Array.from(categories)
      } catch {
        console.error('Error loading meta areas')
      }
    }

    const onMetaAreaInput = () => {
      const value = metaAreaInput.value || ''
      const match = value.match(/#([\w-]*)$/)
      if (match) {
        const search = match[1].toLowerCase()
        filteredSuggestions.value = availableCategories.value
          .filter((area) => area.toLowerCase().includes(search))
        showSuggestions.value = filteredSuggestions.value.length > 0
        suggestionIndex.value = 0
      } else {
        showSuggestions.value = false
      }
    }

    const selectSuggestion = (idx = suggestionIndex.value) => {
      if (!showSuggestions.value || !filteredSuggestions.value.length) return

      const value = metaAreaInput.value || ''
      const match = value.match(/#([\w-]*)$/)

      if (match) {
        const before = value.slice(0, match.index + 1)
        const after = value.slice(match.index + match[0].length)
        const selectedArea = filteredSuggestions.value[idx]

        if (selectedArea) {
          metaAreaInput.value = before + selectedArea + ' ' + after
          // Add to selected categories if not already present
          if (!formData.value.selectedCategories.includes(selectedArea)) {
            formData.value.selectedCategories.push(selectedArea)
          }
        }
      }

      showSuggestions.value = false
    }

    const moveSuggestion = (dir) => {
      if (!showSuggestions.value) return
      suggestionIndex.value =
        (suggestionIndex.value + dir + filteredSuggestions.value.length) %
        filteredSuggestions.value.length
    }

    const handleBlur = () => {
      setTimeout(() => {
        showSuggestions.value = false
      }, 200)
    }

    const parseMetaAreaInput = () => {
      // Parse the input and extract meta areas
      const areas = metaAreaInput.value
        .split(/\s+/)
        .map((area) => area.trim())
        .filter((area) => area.startsWith('#'))
        .map((area) => area.substring(1))
        .filter((area) => area.length > 0)

      // Update selected categories with unique values
      formData.value.selectedCategories = [...new Set(areas)]
    }

    const removeMetaArea = (index) => {
      formData.value.selectedCategories.splice(index, 1)
      updateMetaAreaInput()
    }

    const updateMetaAreaInput = () => {
      // Update the input field to reflect the current selected categories
      metaAreaInput.value = formData.value.selectedCategories.map((area) => '#' + area).join(' ')
    }

    // Front page graph handling
    const loadUserGraphs = async () => {
      try {
        await portfolioStore.loadUserGraphs(userStore.email)
        userGraphs.value = portfolioStore.userGraphs || []
      } catch {
        console.error('Error loading user graphs')
      }
    }

    const validateFrontPageGraph = async () => {
      const graphId = formData.value.mySiteFrontPage
      frontPageError.value = ''
      frontPageValid.value = false
      frontPageGraphTitle.value = ''

      if (!graphId) return

      try {
        // Find graph in user's graphs
        const graph = userGraphs.value.find(g => g.id === graphId)
        if (graph) {
          frontPageValid.value = true
          frontPageGraphTitle.value = graph.title || graph.id
        } else {
          frontPageError.value = 'Graph not found or not accessible'
        }
      } catch {
        frontPageError.value = 'Error validating graph'
      }
    }

    const selectFrontPage = (graph) => {
      formData.value.mySiteFrontPage = graph.id
      validateFrontPageGraph()
    }

    // Form submission
    const handleSubmit = async () => {
      if (!canSaveDomain.value) return

      isSaving.value = true

      try {
        const domainConfig = { ...formData.value }

        if (isEditing.value) {
          // Update existing domain
          domainStore.updateDomain(props.domainConfig.domain, domainConfig)
        } else {
          // Add new domain
          domainStore.addDomain(domainConfig)
        }

        // Save changes to server
        const result = await domainStore.saveChanges(userStore.email)

        if (result.success) {
          emit('saved', {
            success: true,
            message: isEditing.value
              ? `✅ Domain "${domainConfig.domain}" updated successfully!`
              : `✅ Domain "${domainConfig.domain}" added successfully!`,
            domain: domainConfig
          })
        } else {
          throw new Error(result.errors?.[0]?.error || 'Unknown error occurred')
        }
      } catch (error) {
        console.error('Error saving domain:', error)
        emit('saved', {
          success: false,
          message: `❌ Error saving domain: ${error.message}`,
          error
        })
      } finally {
        isSaving.value = false
      }
    }

    // Watch for prop changes
    watch(() => props.domainConfig, initializeForm, { immediate: true })

    return {
      // Stores
      userStore,
      portfolioStore,
      domainStore,

      // State
      formData,
      domainError,
      logoError,
      frontPageError,
      frontPageValid,
      frontPageGraphTitle,
      logoLoaded,
      isUploadingLogo,
      isSaving,
      isAILogoModalOpen,
      logoFileInput,
      metaAreaInput,
      availableCategories,
      showSuggestions,
      filteredSuggestions,
      suggestionIndex,
      userGraphs,

      // Computed
      isEditing,
      canSaveDomain,

      // Methods
      validateDomain,
      validateLogo,
      handleLogoLoad,
      handleLogoError,
      triggerLogoUpload,
      handleLogoUpload,
      openAILogoModal,
      closeAILogoModal,
      handleAILogoGenerated,
      onMetaAreaInput,
      selectSuggestion,
      moveSuggestion,
      handleBlur,
      parseMetaAreaInput,
      removeMetaArea,
      validateFrontPageGraph,
      selectFrontPage,
      handleSubmit
    }
  }
}
</script>

<style scoped>
.domain-form {
  max-width: 900px;
  margin: 0 auto;
}

.form-header {
  margin-bottom: 2rem;
}

.form-section {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.section-title {
  color: #495057;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #f8f9fa;
}

.logo-input-group {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.logo-input-group .form-control {
  flex: 1;
}

.logo-input-group .btn {
  flex-shrink: 0;
}

.logo-preview {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
  background: #f8f9fa;
}

.preview-container {
  text-align: center;
}

.logo-preview-img {
  max-width: 200px;
  max-height: 80px;
  object-fit: contain;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #fff;
  padding: 8px;
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-check-label {
  margin-left: 0.25rem;
}

.category-selection {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
}

.autocomplete-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #ced4da;
  border-top: none;
  border-radius: 0 0 0.375rem 0.375rem;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  list-style: none;
  padding: 0;
  margin: 0;
}

.autocomplete-list li {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid #f8f9fa;
}

.autocomplete-list li:hover,
.autocomplete-list li.active {
  background: #007bff;
  color: white;
}

.selected-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.form-actions {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 2rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-primary {
  min-width: 140px;
}

.valid-feedback {
  display: block;
  color: #198754;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.invalid-feedback {
  display: block;
}

@media (max-width: 768px) {
  .domain-form {
    margin: 0 1rem;
  }

  .form-section {
    padding: 1rem;
  }

  .logo-input-group {
    flex-direction: column;
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
