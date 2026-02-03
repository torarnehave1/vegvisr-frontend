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

        <!-- Mobile App Logo -->
        <div class="form-group mt-4">
          <label for="mobileAppLogo" class="form-label">
            <strong>Mobile App Logo:</strong>
            <span class="badge bg-info ms-2">Optional</span>
          </label>
          <div class="logo-input-group">
            <input
              id="mobileAppLogo"
              v-model="formData.mobileAppLogo"
              type="url"
              class="form-control"
              placeholder="https://example.com/mobile-logo.png"
            />
            <button
              type="button"
              class="btn btn-outline-primary"
              @click="triggerMobileLogoUpload"
              :disabled="isUploadingMobileLogo"
            >
              <i class="fas" :class="isUploadingMobileLogo ? 'fa-spinner fa-spin' : 'fa-upload'"></i>
              {{ isUploadingMobileLogo ? 'Uploading...' : 'Upload' }}
            </button>
          </div>
          <input
            ref="mobileLogoFileInput"
            type="file"
            accept="image/*"
            style="display: none"
            @change="handleMobileLogoUpload"
          />
          <div class="form-text">
            Special logo for the HALLO VEGVISR mobile app. This logo will be displayed with a
            "Powered by Hallo Vegvisr" badge. If not set, the main logo is used.
          </div>
        </div>

        <!-- Mobile App Logo Preview -->
        <div v-if="formData.mobileAppLogo" class="logo-preview mb-4">
          <label class="form-label"><strong>Mobile App Logo Preview:</strong></label>
          <div class="preview-container">
            <div class="mobile-logo-preview-wrapper">
              <img
                :src="formData.mobileAppLogo"
                alt="Mobile App Logo Preview"
                class="logo-preview-img"
              />
              <div class="powered-by-badge">
                <small>Powered by Hallo Vegvisr</small>
              </div>
            </div>
          </div>
        </div>

        <!-- Slogan -->
        <div class="form-group mt-4">
          <label for="slogan" class="form-label">
            <strong>Brand Slogan:</strong>
            <span class="badge bg-info ms-2">Optional</span>
          </label>
          <input
            id="slogan"
            v-model="formData.slogan"
            type="text"
            class="form-control"
            placeholder="e.g., Empowering your knowledge journey"
            maxlength="100"
          />
          <div class="form-text">
            A short tagline or slogan for your brand (max 100 characters).
            This is displayed below the logo in the mobile app.
          </div>
          <div v-if="formData.slogan" class="slogan-preview mt-2">
            <small class="text-muted">Preview: </small>
            <em class="text-primary">{{ formData.slogan }}</em>
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
                placeholder="e.g., #Technology #Management #WebDesign (press Enter to add)"
                @input="onMetaAreaInput"
                @keydown.tab.prevent="selectSuggestion"
                @keydown.enter.prevent="addMetaAreaFromInput"
                @keydown.down.prevent="moveSuggestion(1)"
                @keydown.up.prevent="moveSuggestion(-1)"
                @blur="handleBlur"
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
            <!-- Menu Template Selection -->
            <div class="menu-template-selection mb-4">
              <label class="form-label">
                <strong>Menu Template:</strong>
              </label>
              <select
                v-model="formData.menuConfig.selectedTemplate"
                class="form-control mb-3"
                @change="applyMenuTemplate"
              >
                <option value="">Select a menu template...</option>
                <option
                  v-for="template in availableMenuTemplates"
                  :key="template.id"
                  :value="template.id"
                >
                  {{ template.name }} ({{ template.menu_level }})
                </option>
              </select>

              <div class="template-actions">
                <button
                  type="button"
                  class="btn btn-outline-primary btn-sm me-2"
                  @click="openMenuTemplateCreator"
                >
                  {{ formData.menuConfig.selectedTemplate ? 'Edit Template' : 'Create Template' }}
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="refreshMenuTemplates"
                >
                  <i class="fas fa-sync"></i> Refresh
                </button>
              </div>

              <!-- Template Preview -->
              <div
                v-if="formData.menuConfig.templateData"
                class="template-preview mt-3 p-3 border rounded bg-light"
              >
                <h6 class="mb-2">
                  <i class="fas fa-eye"></i> Template Preview: {{ formData.menuConfig.templateData.name }}
                </h6>
                <div class="template-items">
                  <span
                    v-for="item in formData.menuConfig.templateData.items"
                    :key="item.id"
                    class="badge bg-secondary me-2 mb-2"
                  >
                    {{ item.icon }} {{ item.label }}
                  </span>
                </div>
                <div class="template-style-info mt-2">
                  <small class="text-muted">
                    Style: {{ formData.menuConfig.templateData.style?.buttonStyle || 'hamburger' }} |
                    Layout: {{ formData.menuConfig.templateData.style?.layout || 'horizontal' }} |
                    Theme: {{ formData.menuConfig.templateData.style?.theme || 'default' }}
                  </small>
                </div>
              </div>
            </div>

            <!-- Legacy Menu Items (Backward Compatibility) -->
            <div class="legacy-menu-items mt-4">
              <label class="form-label">
                <strong>Legacy Menu Items:</strong>
                <small class="text-muted">(For backward compatibility - customize using templates above)</small>
              </label>
              <div class="row">
                <div v-for="menuItem in availableMenuItems" :key="menuItem.id" class="col-md-6 col-lg-4 mb-3">
                  <div class="form-check menu-item-config">
                    <input
                      :id="`menu-${menuItem.id}`"
                      v-model="formData.menuConfig.visibleItems"
                      type="checkbox"
                      :value="menuItem.id"
                      class="form-check-input"
                    />
                    <label :for="`menu-${menuItem.id}`" class="form-check-label">
                      {{ menuItem.label }}
                    </label>
                    <small class="d-block text-muted menu-item-path">{{ menuItem.path }}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile App Phone Mappings Section -->
      <div v-if="isEditing" class="form-section">
        <h5 class="section-title">
          <i class="fas fa-mobile-alt text-primary me-2"></i>
          Mobile App Phone Mappings
        </h5>

        <div class="form-group">
          <label class="form-label">
            <strong>Linked Phone Numbers:</strong>
          </label>
          <div class="form-text mb-3">
            Phone numbers linked to this domain will see this branding in the HALLO VEGVISR mobile app.
            <br />
            <small class="text-muted">
              <i class="fas fa-info-circle"></i>
              Only Norwegian phone numbers (+47) are supported.
            </small>
          </div>

          <!-- Add Phone Input -->
          <div class="input-group mb-3">
            <span class="input-group-text">+47</span>
            <input
              type="tel"
              class="form-control"
              v-model="newPhoneNumber"
              placeholder="12345678"
              maxlength="8"
              pattern="[0-9]{8}"
              @keyup.enter="addPhoneMapping"
              :disabled="isAddingPhone"
            />
            <button
              type="button"
              class="btn btn-primary"
              @click="addPhoneMapping"
              :disabled="!isValidPhone || isAddingPhone"
            >
              <i v-if="isAddingPhone" class="fas fa-spinner fa-spin me-1"></i>
              <i v-else class="fas fa-plus me-1"></i>
              {{ isAddingPhone ? 'Adding...' : 'Add Phone' }}
            </button>
          </div>

          <div v-if="phoneError" class="alert alert-danger py-2 mb-3">
            <i class="fas fa-exclamation-circle me-2"></i>
            {{ phoneError }}
          </div>

          <!-- Linked Phones List -->
          <div v-if="linkedPhones.length > 0" class="linked-phones">
            <label class="form-label"><strong>Currently Linked:</strong></label>
            <div class="list-group">
              <div
                v-for="mapping in linkedPhones"
                :key="mapping.phone"
                class="list-group-item d-flex justify-content-between align-items-center"
              >
                <span>
                  <i class="fas fa-phone me-2 text-success"></i>
                  {{ mapping.phone }}
                </span>
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm"
                  @click="removePhoneMapping(mapping.phone)"
                  :disabled="isRemovingPhone === mapping.phone"
                >
                  <i v-if="isRemovingPhone === mapping.phone" class="fas fa-spinner fa-spin"></i>
                  <i v-else class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>

          <div v-else-if="!isLoadingPhones" class="alert alert-info py-2">
            <i class="fas fa-info-circle me-2"></i>
            No phone numbers linked yet. Add phone numbers to enable mobile app branding.
          </div>

          <div v-if="isLoadingPhones" class="text-center py-3">
            <i class="fas fa-spinner fa-spin me-2"></i>
            Loading phone mappings...
          </div>
        </div>
      </div>

      <!-- DEBUG: Live Form Data Display -->
      <div class="form-section" style="background: #fff3cd; border: 2px solid #ffc107;">
        <h5 class="section-title" style="color: #856404;">
          <i class="fas fa-bug me-2"></i>
          DEBUG: Current Form Data
        </h5>
        <div style="font-family: monospace; font-size: 12px;">
          <p><strong>Domain:</strong> {{ formData.domain }}</p>
          <p><strong>Slogan:</strong> "{{ formData.slogan }}" (length: {{ formData.slogan?.length || 0 }})</p>
          <p><strong>MobileAppLogo:</strong> "{{ formData.mobileAppLogo }}"</p>
          <p><strong>Logo:</strong> {{ formData.logo?.substring(0, 50) }}...</p>
          <p><strong>ContentFilter:</strong> {{ formData.contentFilter }}</p>
          <p><strong>Categories:</strong> {{ formData.selectedCategories?.join(', ') }}</p>
          <p><strong>Is Editing:</strong> {{ isEditing }}</p>
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

    <!-- Menu Template Creator Modal -->
    <MenuTemplateCreator
      :isOpen="isMenuTemplateCreatorOpen"
      :menuTemplate="selectedMenuTemplate"
      @close="closeMenuTemplateCreator"
      @template-saved="handleMenuTemplateSaved"
    />
  </div>
</template>

<script>
import { computed, ref, watch, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useDomainStore } from '@/stores/domainStore'
import { useMenuTemplateStore } from '@/stores/menuTemplateStore'
import { apiUrls } from '@/config/api'
import AIImageModal from './AIImageModal.vue'
import MenuTemplateCreator from './MenuTemplateCreator.vue'

export default {
  name: 'DomainForm',
  components: {
    AIImageModal,
    MenuTemplateCreator
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
    const menuTemplateStore = useMenuTemplateStore()

    // Form state
    const formData = ref({
      domain: '',
      logo: '',
      mobileAppLogo: '',
      slogan: '',
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
    const isUploadingMobileLogo = ref(false)
    const isSaving = ref(false)
    const isAILogoModalOpen = ref(false)
    const logoFileInput = ref(null)
    const mobileLogoFileInput = ref(null)

    // Meta area autocomplete state
    const metaAreaInput = ref('')
    const availableCategories = ref([])
    const showSuggestions = ref(false)
    const filteredSuggestions = ref([])
    const suggestionIndex = ref(-1)

    // User graphs for front page selection
    const userGraphs = ref([])

    // Menu configuration state
    const availableMenuTemplates = ref([])
    const selectedMenuTemplate = ref(null)
    const isMenuTemplateCreatorOpen = ref(false)

    // Phone mapping state
    const newPhoneNumber = ref('')
    const linkedPhones = ref([])
    const phoneError = ref('')
    const isLoadingPhones = ref(false)
    const isAddingPhone = ref(false)
    const isRemovingPhone = ref(null)

    // Computed properties
    const isEditing = computed(() => !!props.domainConfig)

    const canSaveDomain = computed(() => {
      return formData.value.domain &&
             !domainError.value &&
             !logoError.value &&
             !frontPageError.value
    })

    const isValidPhone = computed(() => {
      const digits = newPhoneNumber.value.replace(/\D/g, '')
      return digits.length === 8 && /^[0-9]+$/.test(digits)
    })

    const availableMenuItems = computed(() => {
      return [
        {
          id: 'graph-editor',
          label: 'Editor',
          path: '/graph-editor',
          roles: ['User', 'Admin', 'Superadmin'],
        },
        {
          id: 'graph-canvas',
          label: '🎨 Canvas',
          path: '/graph-canvas',
          roles: ['User', 'Admin', 'Superadmin'],
        },
        {
          id: 'graph-portfolio',
          label: 'Portfolio',
          path: '/graph-portfolio',
          roles: ['User', 'Admin', 'Superadmin', 'Subscriber'],
        },
        {
          id: 'graph-viewer',
          label: 'Viewer',
          path: '/graph-viewer',
          roles: ['User', 'Admin', 'Superadmin', 'Subscriber'],
        },
        {
          id: 'search',
          label: 'Search',
          path: '/search',
          roles: ['User', 'Admin', 'Superadmin', 'Subscriber'],
        },
        {
          id: 'user-dashboard',
          label: 'Dashboard',
          path: '/user',
          roles: ['User', 'Admin', 'Superadmin', 'Subscriber'],
        },
        {
          id: 'github-issues',
          label: '🗺️ Roadmap',
          path: '/github-issues',
          roles: ['User', 'Admin', 'Superadmin'],
        },
        {
          id: 'sandbox',
          label: '🔧 Sandbox',
          path: '/sandbox',
          roles: ['Superadmin'],
        },
        {
          id: 'gnew',
          label: '🧪 GNew Viewer',
          path: '/gnew-viewer',
          roles: ['User', 'Admin', 'Superadmin', 'Subscriber'],
        },
      ]
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
        const logoUrl = data.url || (data.urls && Array.isArray(data.urls) ? data.urls[0] : null)
        if (!logoUrl) {
          throw new Error('API did not return an image URL')
        }
        formData.value.logo = logoUrl
        logoError.value = '' // Clear any previous errors

        console.log('Logo uploaded successfully:', logoUrl)
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

    // Mobile App Logo upload handlers
    const triggerMobileLogoUpload = () => {
      if (mobileLogoFileInput.value) {
        mobileLogoFileInput.value.click()
      }
    }

    const handleMobileLogoUpload = async (event) => {
      const file = event.target.files?.[0]
      if (!file || !file.type.startsWith('image/')) {
        alert('Please select a valid image file.')
        return
      }

      isUploadingMobileLogo.value = true

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('type', 'image')

      try {
        const response = await fetch('https://api.vegvisr.org/upload', {
          method: 'POST',
          body: uploadFormData,
        })

        if (!response.ok) {
          throw new Error('Failed to upload mobile logo image')
        }

        const data = await response.json()
        const mobileLogoUrl = data.url || (data.urls && Array.isArray(data.urls) ? data.urls[0] : null)
        if (!mobileLogoUrl) {
          throw new Error('API did not return an image URL')
        }
        formData.value.mobileAppLogo = mobileLogoUrl

        console.log('Mobile logo uploaded successfully:', mobileLogoUrl)
      } catch (error) {
        console.error('Error uploading mobile logo:', error)
        alert('Failed to upload mobile logo image. Please try again.')
      } finally {
        isUploadingMobileLogo.value = false
        if (event.target) {
          event.target.value = ''
        }
      }
    }

    // Meta area handling
    const loadAvailableMetaAreas = async () => {
      try {
        console.log('🔍 Loading available meta areas directly from API...')

        // Fetch directly from API to bypass content filtering
        const response = await fetch(apiUrls.getKnowledgeGraphs())
        if (!response.ok) {
          console.error('❌ Failed to fetch graphs')
          return
        }

        const data = await response.json()
        console.log('📊 API response:', data)

        if (!data.results || data.results.length === 0) {
          console.warn('⚠️ No graphs in results')
          return
        }

        const categories = new Set()

        // Fetch full data for each graph to get metaArea
        const graphPromises = data.results.map(async (graph) => {
          try {
            const fullResponse = await fetch(apiUrls.getKnowledgeGraph(graph.id))
            if (!fullResponse.ok) return null

            const graphData = await fullResponse.json()

            // Extract metaArea from metadata and normalize it
            if (graphData.metadata?.metaArea) {
              // Remove # if it exists at the start, store without #
              let metaArea = graphData.metadata.metaArea.trim()
              if (metaArea.startsWith('#')) {
                metaArea = metaArea.substring(1)
              }
              console.log('✅ Found metaArea:', metaArea, 'in graph:', graphData.metadata?.title)
              categories.add(metaArea)
            }

            return graphData
          } catch (error) {
            console.error('❌ Error fetching graph:', graph.id, error)
            return null
          }
        })

        await Promise.all(graphPromises)

        availableCategories.value = Array.from(categories)
        console.log('✅ Total unique meta areas found:', availableCategories.value.length, availableCategories.value)
      } catch (error) {
        console.error('❌ Error loading meta areas:', error)
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

    const addMetaAreaFromInput = () => {
      // If suggestions are shown, select the highlighted one
      if (showSuggestions.value && filteredSuggestions.value.length > 0) {
        selectSuggestion()
        return
      }

      // Otherwise parse the entire input for meta areas
      const areas = metaAreaInput.value
        .split(/\s+/)
        .map((area) => area.trim())
        .filter((area) => area.startsWith('#'))
        .map((area) => area.substring(1))
        .filter((area) => area.length > 0)

      // Add each unique area to selected categories
      areas.forEach(area => {
        if (!formData.value.selectedCategories.includes(area)) {
          formData.value.selectedCategories.push(area)
        }
      })

      // Clear the input after adding
      metaAreaInput.value = ''
      showSuggestions.value = false
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

    // Menu template methods
    const fetchMenuTemplates = async () => {
      try {
        await menuTemplateStore.fetchMenuTemplates('top')
        availableMenuTemplates.value = menuTemplateStore.menuTemplates
        console.log('Fetched menu templates:', availableMenuTemplates.value.length)
      } catch (error) {
        console.error('Error fetching menu templates:', error)
      }
    }

    const applyMenuTemplate = () => {
      if (!formData.value.menuConfig.selectedTemplate) {
        formData.value.menuConfig.templateData = null
        return
      }

      const template = availableMenuTemplates.value.find(
        t => t.id === formData.value.menuConfig.selectedTemplate
      )

      if (template) {
        console.log('Applying menu template:', template.name)
        formData.value.menuConfig.templateData = template.menu_data

        // Update visible items for backward compatibility
        if (template.menu_data?.items) {
          formData.value.menuConfig.visibleItems = template.menu_data.items.map(item => item.id)
        }
      }
    }

    const refreshMenuTemplates = async () => {
      console.log('Refreshing menu templates...')
      await fetchMenuTemplates()

      // Re-apply current template if one is selected
      if (formData.value.menuConfig.selectedTemplate) {
        applyMenuTemplate()
      }
    }

    const openMenuTemplateCreator = () => {
      // Find selected template for editing
      if (formData.value.menuConfig.selectedTemplate) {
        selectedMenuTemplate.value = availableMenuTemplates.value.find(
          t => t.id === formData.value.menuConfig.selectedTemplate
        )
      } else {
        selectedMenuTemplate.value = null // Create new
      }
      isMenuTemplateCreatorOpen.value = true
    }

    const closeMenuTemplateCreator = () => {
      isMenuTemplateCreatorOpen.value = false
      selectedMenuTemplate.value = null
    }

    const handleMenuTemplateSaved = async (template) => {
      console.log('Menu template saved:', template)
      const wasEditing = selectedMenuTemplate.value !== null
      const savedTemplateId = template.id

      // Refresh templates list
      await refreshMenuTemplates()

      // Maintain selection after save
      if (wasEditing && savedTemplateId) {
        formData.value.menuConfig.selectedTemplate = savedTemplateId
        applyMenuTemplate()
      }

      closeMenuTemplateCreator()
    }

    // Phone mapping methods
    const loadPhoneMappings = async () => {
      if (!formData.value.domain) return

      isLoadingPhones.value = true
      phoneError.value = ''

      try {
        const response = await fetch(apiUrls.listPhoneMappings(formData.value.domain))
        if (response.ok) {
          const data = await response.json()
          linkedPhones.value = data.mappings || []
          console.log('Loaded phone mappings:', linkedPhones.value.length)
        }
      } catch (error) {
        console.error('Error loading phone mappings:', error)
        phoneError.value = 'Failed to load phone mappings'
      } finally {
        isLoadingPhones.value = false
      }
    }

    const addPhoneMapping = async () => {
      if (!isValidPhone.value || !formData.value.domain) return

      phoneError.value = ''
      const fullPhone = '+47' + newPhoneNumber.value.replace(/\D/g, '')

      // Check for duplicates
      if (linkedPhones.value.some(p => p.phone === fullPhone)) {
        phoneError.value = 'This phone number is already linked'
        return
      }

      isAddingPhone.value = true

      try {
        const response = await fetch(apiUrls.savePhoneMapping(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: fullPhone,
            domain: formData.value.domain,
            ownerEmail: userStore.email
          })
        })

        if (response.ok) {
          linkedPhones.value.push({ phone: fullPhone })
          newPhoneNumber.value = ''
          console.log('Phone mapping added:', fullPhone)
        } else {
          const data = await response.json()
          phoneError.value = data.error || 'Failed to add phone mapping'
        }
      } catch (error) {
        phoneError.value = 'Network error. Please try again.'
        console.error('Error adding phone mapping:', error)
      } finally {
        isAddingPhone.value = false
      }
    }

    const removePhoneMapping = async (phone) => {
      if (!confirm(`Remove phone ${phone} from this domain?`)) return

      isRemovingPhone.value = phone

      try {
        const response = await fetch(apiUrls.deletePhoneMapping(phone), {
          method: 'DELETE'
        })

        if (response.ok) {
          linkedPhones.value = linkedPhones.value.filter(p => p.phone !== phone)
          console.log('Phone mapping removed:', phone)
        } else {
          phoneError.value = 'Failed to remove phone mapping'
        }
      } catch (error) {
        console.error('Error removing phone mapping:', error)
        phoneError.value = 'Network error. Please try again.'
      } finally {
        isRemovingPhone.value = null
      }
    }

    // Form submission
    const handleSubmit = async () => {
      if (!canSaveDomain.value) return

      isSaving.value = true

      try {
        const domainConfig = { ...formData.value }

        // DEBUG: Log exactly what we're about to save
        console.log('=== DOMAIN FORM DEBUG ===')
        console.log('formData.value:', JSON.stringify(formData.value, null, 2))
        console.log('formData.slogan:', formData.value.slogan)
        console.log('formData.mobileAppLogo:', formData.value.mobileAppLogo)
        console.log('domainConfig:', JSON.stringify(domainConfig, null, 2))
        console.log('domainConfig.slogan:', domainConfig.slogan)
        console.log('isEditing:', isEditing.value)
        console.log('=========================')

        // Show debug alert on page
        alert(`DEBUG: Saving domain\nSlogan: "${domainConfig.slogan}"\nMobileAppLogo: "${domainConfig.mobileAppLogo}"`)

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

    // Initialize on mount
    onMounted(() => {
      initializeForm()
      fetchMenuTemplates()
      // Load phone mappings if editing
      if (props.domainConfig) {
        loadPhoneMappings()
      }
    })

    // Watch for prop changes
    watch(() => props.domainConfig, initializeForm)

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
      isUploadingMobileLogo,
      isSaving,
      isAILogoModalOpen,
      logoFileInput,
      mobileLogoFileInput,
      metaAreaInput,
      availableCategories,
      showSuggestions,
      filteredSuggestions,
      suggestionIndex,
      userGraphs,
      availableMenuTemplates,
      selectedMenuTemplate,
      isMenuTemplateCreatorOpen,

      // Phone mapping state
      newPhoneNumber,
      linkedPhones,
      phoneError,
      isLoadingPhones,
      isAddingPhone,
      isRemovingPhone,

      // Computed
      isEditing,
      canSaveDomain,
      availableMenuItems,
      isValidPhone,

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
      triggerMobileLogoUpload,
      handleMobileLogoUpload,
      onMetaAreaInput,
      selectSuggestion,
      moveSuggestion,
      handleBlur,
      addMetaAreaFromInput,
      parseMetaAreaInput,
      removeMetaArea,
      validateFrontPageGraph,
      selectFrontPage,
      handleSubmit,
      applyMenuTemplate,
      refreshMenuTemplates,
      openMenuTemplateCreator,
      closeMenuTemplateCreator,
      handleMenuTemplateSaved,

      // Phone mapping methods
      loadPhoneMappings,
      addPhoneMapping,
      removePhoneMapping
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

.mobile-logo-preview-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 2px dashed #dee2e6;
}

.powered-by-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #6c757d;
  font-style: italic;
}

.slogan-preview {
  padding: 8px 12px;
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border-radius: 6px;
  border-left: 3px solid #007bff;
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

/* Menu Configuration Styles */
.menu-template-selection {
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.template-actions {
  display: flex;
  gap: 0.5rem;
}

.template-preview {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.template-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.legacy-menu-items {
  padding-top: 1rem;
  border-top: 2px dashed #dee2e6;
}

.menu-item-config {
  padding: 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background-color: white;
  transition: all 0.2s ease;
}

.menu-item-config:hover {
  border-color: #0d6efd;
  box-shadow: 0 2px 4px rgba(13, 110, 253, 0.1);
}

.menu-item-config .form-check-input:checked ~ .form-check-label {
  color: #0d6efd;
  font-weight: 500;
}

.menu-item-path {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: #6c757d;
  margin-top: 0.25rem;
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
