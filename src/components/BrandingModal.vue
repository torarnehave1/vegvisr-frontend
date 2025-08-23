<template>
  <div
    v-if="isOpen"
    class="branding-modal-overlay"
    @click="handleOverlayClick"
    @keydown="handleKeydown"
  >
    <div class="branding-modal" :class="{ 'edit-mode': viewMode === 'edit' }" @click.stop>
      <div class="modal-header">
        <h2>🎨 Custom Domain Branding Setup</h2>
        <div class="modal-header-actions">
          <!-- Superadmin Domain Management Button -->
          <button
            v-if="userStore.role === 'Superadmin'"
            @click="openAdminDomainModal"
            class="btn btn-outline-warning btn-sm me-2"
            title="Superadmin Domain Management"
          >
            <i class="fas fa-crown me-1"></i>
            Admin Domains
          </button>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
      </div>

      <div class="modal-content">
        <!-- Domain Management Views -->

        <!-- Domain List View -->
        <div v-if="viewMode === 'list'" class="step-content">
          <h3>Manage Your Custom Domains</h3>
          <p class="step-description">
            Configure multiple custom domains with unique branding and content filtering for each.
          </p>

          <!-- Existing Domains List -->
          <div v-if="domainConfigs.length > 0" class="domain-list mb-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h4 class="mb-0">Your Configured Domains</h4>
              <small class="text-muted" v-if="domainConfigs.length > 3">
                <i class="bi bi-arrow-up-down"></i> Scroll to see all
              </small>
            </div>
            <div v-for="(config, index) in domainConfigs" :key="index" class="domain-item">
              <div class="domain-card">
                <div class="domain-header">
                  <div class="domain-info">
                    <h5 class="domain-name">
                      <a
                        :href="`https://${config.domain}`"
                        target="_blank"
                        class="domain-link"
                        :title="`Visit ${config.domain} (opens in new tab)`"
                      >
                        {{ config.domain }}
                        <i class="bi bi-box-arrow-up-right ms-1"></i>
                      </a>
                      <!-- Change indicators -->
                      <span
                        v-if="domainStore.newDomains.has(config.domain)"
                        class="badge bg-success ms-2"
                        title="This domain is new and will be saved to server"
                      >
                        NEW
                      </span>
                      <span
                        v-else-if="domainStore.updatedDomains.has(config.domain)"
                        class="badge bg-warning text-dark ms-2"
                        title="This domain has unsaved changes"
                      >
                        MODIFIED
                      </span>
                    </h5>
                    <div class="domain-meta">
                      <span v-if="config.logo" class="badge bg-success">✓ Logo</span>
                      <span v-else class="badge bg-secondary">No Logo</span>
                      <span class="badge bg-info ms-1">
                        {{
                          config.contentFilter === 'none'
                            ? 'No Filtering'
                            : config.selectedCategories
                              ? config.selectedCategories.length + ' Filters'
                              : 'Custom Filter'
                        }}
                      </span>
                      <span v-if="config.showSearchBar !== false" class="badge bg-primary ms-1">
                        <i class="bi bi-search"></i> Search Bar
                      </span>
                      <span v-else class="badge bg-secondary ms-1">
                        <i class="bi bi-search-x"></i> No Search
                      </span>
                    </div>
                  </div>
                  <div class="domain-actions">
                    <button @click="editDomain(index)" class="btn btn-outline-primary btn-sm me-2">
                      <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button @click="removeDomain(index)" class="btn btn-outline-danger btn-sm">
                      <i class="bi bi-trash"></i> Remove
                    </button>
                  </div>
                </div>

                <!-- Domain Preview -->
                <div v-if="config.logo" class="domain-preview mt-2">
                  <img
                    :src="config.logo"
                    :alt="config.domain + ' logo'"
                    class="domain-logo-preview"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- No Domains Message -->
          <div v-else class="no-domains-message">
            <div class="alert alert-info">
              <i class="bi bi-info-circle"></i>
              <strong>No custom domains configured yet.</strong><br />
              Start by adding your first custom domain to create a branded experience.
            </div>
          </div>

          <!-- Add New Domain Button -->
          <div class="add-domain-section">
            <button @click="addNewDomain" class="btn btn-primary">
              <i class="bi bi-plus-circle me-2"></i>
              Add New Domain
            </button>
          </div>
        </div>

        <!-- Domain Edit/Add Form -->
        <div v-if="viewMode === 'edit'" class="step-content">
          <div class="d-flex align-items-center mb-3">
            <button @click="backToList" class="btn btn-outline-secondary btn-sm me-3">
              <i class="bi bi-arrow-left"></i> Back
            </button>
            <h3 class="mb-0">
              {{ editingDomainIndex !== null ? 'Edit Domain' : 'Add New Domain' }}
            </h3>
          </div>
          <p class="step-description">
            {{
              editingDomainIndex !== null
                ? 'Update your domain configuration and branding settings.'
                : 'Set up a new custom domain with branding and content filtering.'
            }}
          </p>

          <div class="form-group">
            <label for="customDomain" class="form-label">
              <strong>Custom Domain:</strong>
            </label>
            <input
              id="customDomain"
              v-model="formData.domain"
              type="text"
              class="form-control"
              placeholder="e.g., mybrand.example.com"
              @input="validateDomain"
              @keydown.enter.prevent
            />
            <div class="form-text">
              Enter your custom domain name. This can be a main domain (e.g., yourdomain.com) or a
              subdomain (e.g., mybrand.yourdomain.com).
              <br />
              <small class="text-muted">
                <i class="bi bi-info-circle"></i>
                Domain names are automatically converted to lowercase to prevent configuration
                issues.
              </small>
            </div>
            <div v-if="domainError" class="error-message">{{ domainError }}</div>
          </div>

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
                placeholder="https://example.com/logo.png"
                @input="validateLogo"
                @keydown.enter.prevent
              />
              <button
                type="button"
                class="btn btn-outline-primary upload-btn"
                @click="triggerLogoUpload"
                :disabled="isUploadingLogo"
              >
                <i class="bi" :class="isUploadingLogo ? 'bi-hourglass-split' : 'bi-upload'"></i>
                {{ isUploadingLogo ? 'Uploading...' : 'Upload' }}
              </button>
              <button
                type="button"
                class="btn btn-outline-success ai-generate-btn"
                @click="openAILogoModal"
                :disabled="isUploadingLogo"
              >
                <i class="bi bi-magic"></i>
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
            <div v-if="logoError" class="error-message">{{ logoError }}</div>
          </div>

          <!-- Logo Preview -->
          <div v-if="formData.logo && !logoError" class="logo-preview">
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

          <!-- Content Filtering Options -->
          <div class="form-group">
            <label class="form-label">
              <strong>Content Filtering:</strong>
            </label>
            <div class="filter-options">
              <div class="filter-option">
                <input
                  id="filterNone"
                  v-model="formData.contentFilter"
                  type="radio"
                  value="none"
                  class="form-check-input"
                />
                <label for="filterNone" class="form-check-label">
                  No filtering - Show all content
                </label>
              </div>
              <div class="filter-option">
                <input
                  id="filterCustom"
                  v-model="formData.contentFilter"
                  type="radio"
                  value="custom"
                  class="form-check-input"
                />
                <label for="filterCustom" class="form-check-label">
                  Filter by specific meta areas
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
                <i class="bi bi-info-circle"></i>
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

          <!-- Search Bar Visibility Toggle -->
          <div class="form-group">
            <label class="form-label">
              <strong>Search Bar Settings:</strong>
            </label>
            <div class="form-check mb-3">
              <input
                id="showSearchBar"
                v-model="formData.showSearchBar"
                type="checkbox"
                class="form-check-input"
              />
              <label for="showSearchBar" class="form-check-label">
                Show search bar on knowledge graphs
              </label>
            </div>
            <div class="form-text mb-3">
              Controls whether the global search bar is displayed on knowledge graph pages. When disabled, users will need to use the dedicated search page to find content.
            </div>
          </div>

          <!-- Menu Configuration - Superadmin Only -->
          <div v-if="userStore.role === 'Superadmin'" class="form-group">
            <label class="form-label">
              <strong>Menu Configuration:</strong>
            </label>
            <div class="menu-config-section">
              <div class="form-check mb-3">
                <input
                  id="enableMenuConfig"
                  v-model="formData.menuConfig.enabled"
                  type="checkbox"
                  class="form-check-input"
                />
                <label for="enableMenuConfig" class="form-check-label">
                  Enable custom menu configuration for this domain
                </label>
              </div>

              <div v-if="formData.menuConfig.enabled" class="menu-items-config">
                <!-- Menu Template Selection -->
                <div class="menu-template-selection mb-4">
                  <label class="form-label">
                    <strong>Menu Template:</strong>
                  </label>
                  <div class="form-text mb-3">
                    Select a pre-built menu template or create a custom one.
                  </div>

                  <div class="menu-template-controls">
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
                        <i
                          :class="
                            formData.menuConfig.selectedTemplate ? 'fas fa-edit' : 'fas fa-plus'
                          "
                        ></i>
                        {{
                          formData.menuConfig.selectedTemplate ? 'Edit Template' : 'Create Template'
                        }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-secondary btn-sm"
                        @click="refreshMenuTemplates"
                      >
                        <i class="fas fa-sync"></i> Refresh
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Legacy Menu Items (Fallback) -->
                <div class="legacy-menu-items">
                  <label class="form-label">
                    <strong>Legacy Menu Items:</strong>
                  </label>
                  <div class="form-text mb-3">
                    Uncheck items to hide them from the navigation menu on this domain.
                  </div>

                  <div class="row">
                    <div
                      v-for="menuItem in availableMenuItems"
                      :key="menuItem.id"
                      class="col-md-6 col-lg-4 mb-3"
                    >
                      <div class="menu-item-config">
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
                        <small class="menu-item-path">{{ menuItem.path }}</small>
                        <small
                          v-if="menuItem.roles.includes('superadmin')"
                          class="badge bg-warning ms-2"
                        >
                          Admin Only
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Live Preview for Edit Mode -->
          <div v-if="formData.domain" class="preview-section mt-4">
            <h5>Live Preview</h5>
            <div class="browser-mockup">
              <div class="browser-bar">
                <div class="browser-buttons">
                  <span class="browser-button red"></span>
                  <span class="browser-button yellow"></span>
                  <span class="browser-button green"></span>
                </div>
                <div class="browser-url">{{ formData.domain || 'your-domain.com' }}</div>
              </div>
              <div class="browser-content">
                <header class="mockup-header">
                  <img v-if="formData.logo" :src="formData.logo" alt="Logo" class="mockup-logo" />
                  <div v-else class="mockup-logo-placeholder">Your Logo</div>
                  <h1 class="mockup-title">{{ getDomainTitle() }}</h1>
                </header>
                <div class="mockup-content">
                  <div class="mockup-nav">Knowledge Graphs | Dashboard | Profile</div>
                  <div class="mockup-graph">
                    <div class="mockup-node">Sample Knowledge Graph</div>
                    <div class="mockup-node">Filtered Content</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Deployment Instructions -->
          <div v-if="formData.domain" class="deployment-instructions mt-4">
            <h5>🚀 Quick Deployment Guide</h5>
            <div class="alert alert-info">
              <strong>1. Copy Worker Code:</strong>
              <button @click="copyWorkerCode" class="btn btn-outline-primary btn-sm ms-2">
                Copy Worker Code
              </button>
              <br /><br />
              <strong>2. DNS Setup:</strong>
              <div v-if="isMainDomain(formData.domain)" class="dns-setup-main">
                Add <strong>{{ formData.domain }}</strong> as a custom domain to your Cloudflare
                Worker
                <br />
                <small class="text-muted">
                  <i class="bi bi-info-circle"></i>
                  Main domains require custom domain setup in Cloudflare Workers dashboard
                </small>
              </div>
              <div v-else class="dns-setup-subdomain">
                Point <strong>{{ getDomainSubdomain() }}</strong> to your Cloudflare Worker
                <br />
                <small class="text-muted">
                  <i class="bi bi-info-circle"></i>
                  Subdomains can use CNAME records or worker routes
                </small>
              </div>
              <br />
              <button
                @click="testDomainSetup"
                class="btn btn-primary btn-sm mt-2"
                :disabled="isTestingDomain"
              >
                {{ isTestingDomain ? 'Setting up...' : 'Setup Domain' }}
              </button>
              <div
                v-if="domainTestResult"
                :class="[
                  'alert',
                  domainTestResult.success ? 'alert-success' : 'alert-danger',
                  'mt-2',
                ]"
              >
                {{ domainTestResult.message }}

                <!-- Show delete button for DNS conflicts -->
                <div
                  v-if="!domainTestResult.success && isDnsConflict(domainTestResult)"
                  class="mt-3"
                >
                  <hr />
                  <p class="mb-2">
                    <strong>💡 Solution:</strong> This domain has existing DNS records or worker
                    routes. You can clean them up and try again.
                  </p>
                  <button
                    class="btn btn-warning btn-sm me-2"
                    @click="deleteExistingDomain"
                    :disabled="isDeletingExisting"
                  >
                    <i
                      class="bi"
                      :class="isDeletingExisting ? 'bi-hourglass-split' : 'bi-trash'"
                    ></i>
                    {{ isDeletingExisting ? 'Deleting...' : 'Delete Existing & Retry' }}
                  </button>
                  <small class="text-muted">
                    This will remove existing DNS records and worker routes, then try creating
                    again.
                  </small>
                </div>
              </div>
              <br />
              <strong>3. Test:</strong> Visit {{ formData.domain }} after setup
            </div>
          </div>

          <!-- Front Page Graph Selection -->
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
                @keydown.enter.prevent
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
                  <i class="bi bi-info-circle"></i>
                  No knowledge graphs found. Create one first.
                </li>
                <li v-for="graph in userGraphs" :key="graph.id" @click="selectFrontPage(graph)">
                  <a class="dropdown-item" href="#">
                    <strong>{{ graph.title }}</strong
                    ><br />
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
                <i class="bi bi-info-circle"></i>
                Graph IDs are automatically validated to prevent broken front pages.
              </small>
            </div>
            <div v-if="frontPageError" class="error-message">{{ frontPageError }}</div>
            <div v-if="frontPageValid && formData.mySiteFrontPage" class="valid-message">
              <i class="bi bi-check-circle"></i>
              Valid graph selected: {{ frontPageGraphTitle }}
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <!-- List View Footer -->
        <div v-if="viewMode === 'list'" class="w-100 d-flex justify-content-between">
          <div>
            <small class="text-muted">
              {{ domainConfigs.length }} domain{{ domainConfigs.length !== 1 ? 's' : '' }}
              configured
            </small>
            <!-- Change tracking info -->
            <div v-if="hasUnsavedChanges" class="mt-1">
              <span class="badge bg-warning text-dark">
                {{ changeSummary }}
              </span>
            </div>
          </div>
          <div>
            <button
              @click="saveAllDomains"
              class="btn me-2"
              :class="hasUnsavedChanges ? 'btn-warning' : 'btn-success'"
              :disabled="!hasUnsavedChanges && domainConfigs.length === 0"
            >
              <span
                v-if="isSaving"
                class="spinner-border spinner-border-sm me-2"
                role="status"
              ></span>
              {{
                isSaving
                  ? 'Saving...'
                  : hasUnsavedChanges
                    ? `Save Changes (${changeStats.total})`
                    : 'All Saved'
              }}
            </button>
            <button @click="closeModal" class="btn btn-outline-secondary">Close</button>
          </div>
        </div>

        <!-- Edit View Footer -->
        <div v-if="viewMode === 'edit'" class="w-100 d-flex justify-content-end">
          <button @click="backToList" class="btn btn-secondary me-2" :disabled="isSavingDomain">
            Cancel
          </button>
          <button
            @click="saveDomain"
            :disabled="!canSaveDomain() || isSavingDomain"
            class="btn btn-primary"
          >
            <span
              v-if="isSavingDomain"
              class="spinner-border spinner-border-sm me-2"
              role="status"
            ></span>
            {{
              isSavingDomain
                ? 'Saving...'
                : editingDomainIndex !== null
                  ? 'Update Domain'
                  : 'Add Domain'
            }}
          </button>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div v-if="isSaving" class="loading-overlay">
        <div class="loading-content">
          <div class="spinner"></div>
          <p>Saving your branding configuration...</p>
        </div>
      </div>

      <!-- AI Image Modal for Logo Generation -->
      <AIImageModal
        :isOpen="isAILogoModalOpen"
        :graphContext="{ type: 'logo', domain: formData.domain }"
        @close="closeAILogoModal"
        @image-inserted="handleAILogoGenerated"
      />
    </div>
  </div>

  <!-- Superadmin Domain Management Modal -->
  <AdminDomainModal
    :is-visible="isAdminDomainModalOpen"
    @close="closeAdminDomainModal"
    @domain-updated="handleDomainUpdated"
  />

  <!-- Menu Template Creator Modal -->
  <MenuTemplateCreator
    v-if="isMenuTemplateCreatorOpen"
    :template="selectedMenuTemplate"
    @close="closeMenuTemplateCreator"
    @saved="handleMenuTemplateSaved"
  />
</template>

<script>
import { useUserStore } from '@/stores/userStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useMenuTemplateStore } from '@/stores/menuTemplateStore'
import { useDomainStore } from '@/stores/domainStore'
import AIImageModal from './AIImageModal.vue'
import AdminDomainModal from './AdminDomainModal.vue'
import MenuTemplateCreator from './MenuTemplateCreator.vue'

export default {
  name: 'BrandingModal',
  components: {
    AIImageModal,
    AdminDomainModal,
    MenuTemplateCreator,
  },
  props: {
    isOpen: {
      type: Boolean,
      default: false,
    },
    existingDomainConfigs: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['close', 'saved'],
  data() {
    return {
      currentStep: 1,
      editingDomainIndex: null, // Index of domain being edited, null for new domain
      formData: {
        domain: '',
        logo: '',
        contentFilter: 'none',
        selectedCategories: [],
        mySiteFrontPage: '',
        showSearchBar: true, // Default to showing search bar
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
            'gnew',
          ],
        },
      },
      domainError: '',
      logoError: '',
      viewMode: 'list', // 'list' or 'edit'
      logoLoaded: false,
      isTestingDomain: false,
      domainTestResult: null,
      userGraphs: [],
      metaAreaInput: '',
      showSuggestions: false,
      suggestionIndex: 0,
      filteredSuggestions: [],
      isDeletingExisting: false,
      isUploadingLogo: false,
      isSavingDomain: false,
      isAILogoModalOpen: false,
      isAdminDomainModalOpen: false,
      frontPageError: '',
      frontPageValid: false,
      frontPageGraphTitle: '',
      frontPageValidationTimeout: null,
      // Menu template system
      availableMenuTemplates: [],
      isMenuTemplateCreatorOpen: false,
      selectedMenuTemplate: null,
    }
  },
  setup() {
    const userStore = useUserStore()
    const portfolioStore = usePortfolioStore()
    const menuTemplateStore = useMenuTemplateStore()
    const domainStore = useDomainStore()
    return { userStore, portfolioStore, menuTemplateStore, domainStore }
  },
  watch: {
    isOpen: {
      handler(newValue) {
        if (newValue) {
          console.log('BrandingModal opened, loading domains...')
          // Load domains from store when modal opens
          this.loadDomains()
          this.fetchMetaAreas()

          // Ensure proper focus management for keyboard events
          this.$nextTick(() => {
            const modalOverlay = this.$el
            if (modalOverlay && typeof modalOverlay.setAttribute === 'function') {
              modalOverlay.setAttribute('tabindex', '0')
              if (typeof modalOverlay.focus === 'function') {
                modalOverlay.focus()
              }
            }
          })
        }
      },
      immediate: false,
    },
  },
  computed: {
    // Domain store getters
    domainConfigs() {
      return this.domainStore.allDomains
    },
    hasUnsavedChanges() {
      return this.domainStore.hasUnsavedChanges
    },
    changeSummary() {
      return this.domainStore.changeSummary
    },
    changeStats() {
      return this.domainStore.changeStats
    },
    isSaving() {
      return this.domainStore.isSaving
    },
    isLoading() {
      return this.domainStore.isLoading
    },

    availableCategories() {
      // Get meta areas from portfolio store and format them for the UI
      return this.portfolioStore.allMetaAreas.map((metaArea) => ({
        value: metaArea,
        label: this.formatMetaAreaLabel(metaArea),
        description: `Content related to ${this.formatMetaAreaLabel(metaArea).toLowerCase()}`,
      }))
    },
    availableMenuItems() {
      // Menu items available for configuration
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
    },
  },
  mounted() {
    console.log('BrandingModal mounted')
    this.loadDomains()
    this.fetchMetaAreas()
    this.loadUserGraphs()
    this.fetchMenuTemplates()

    // Ensure modal is focusable and handles keyboard events properly
    if (this.isOpen) {
      this.$nextTick(() => {
        // Focus the modal overlay to ensure keyboard events work
        const modalOverlay = this.$el
        if (modalOverlay && typeof modalOverlay.setAttribute === 'function') {
          modalOverlay.setAttribute('tabindex', '0')
          if (typeof modalOverlay.focus === 'function') {
            modalOverlay.focus()
          }
        }
      })
    }
  },
  beforeUnmount() {
    // Clean up validation timeout to prevent memory leaks
    if (this.frontPageValidationTimeout) {
      clearTimeout(this.frontPageValidationTimeout)
    }
  },
  methods: {
    // Modal event handlers
    handleOverlayClick(event) {
      // Only close if clicking directly on the overlay, not on modal content
      if (event.target === event.currentTarget) {
        this.closeModal()
      }
    },
    handleKeydown(event) {
      // Handle Escape key to close modal
      if (event.key === 'Escape') {
        event.preventDefault()
        this.closeModal()
      }
    },
    // Domain management methods
    async loadDomains() {
      try {
        await this.domainStore.loadDomains(this.userStore.email)
        console.log('Domains loaded into store:', this.domainConfigs.length)
      } catch (error) {
        console.error('Error loading domains:', error)
        this.$emit('saved', `❌ Error loading domains: ${error.message}`)
      }
    },

    addNewDomain() {
      this.editingDomainIndex = null
      this.formData = {
        domain: '',
        logo: '',
        contentFilter: 'none',
        selectedCategories: [],
        mySiteFrontPage: '',
        showSearchBar: true, // Default to showing search bar
        menuConfig: {
          enabled: false,
          visibleItems: [
            'graph-editor',
            'graph-canvas',
            'graph-portfolio',
            'graph-viewer',
            'search',
            'user-dashboard',
            'github-issues',
            'sandbox',
            'gnew',
          ],
        },
      }
      this.viewMode = 'edit'
    },

    editDomain(index) {
      this.editingDomainIndex = index
      const config = this.domainConfigs[index]
      this.formData = {
        domain: config.domain,
        logo: config.logo || '',
        contentFilter: config.contentFilter || 'none',
        selectedCategories: config.selectedCategories || [],
        mySiteFrontPage: config.mySiteFrontPage || '',
        showSearchBar: config.showSearchBar !== undefined ? config.showSearchBar : true, // Default to true if not set
        menuConfig: config.menuConfig || {
          enabled: false,
          visibleItems: [
            'graph-editor',
            'graph-canvas',
            'graph-portfolio',
            'graph-viewer',
            'search',
            'user-dashboard',
            'github-issues',
            'sandbox',
            'gnew',
          ],
        },
      }
      // Update the meta area input to reflect selected categories
      this.updateMetaAreaInput()
      // Validate front page graph if one is set
      if (this.formData.mySiteFrontPage) {
        this.$nextTick(() => {
          this.validateFrontPageGraph()
        })
      }
      this.viewMode = 'edit'
    },

    async removeDomain(index) {
      const domainConfig = this.domainConfigs[index]
      const domainName = domainConfig.domain

      if (
        confirm(
          `Are you sure you want to remove the domain "${domainName}"?\n\nThis will be removed from your configuration.`,
        )
      ) {
        try {
          console.log('Removing domain from store:', domainName)
          this.domainStore.removeDomain(domainName)
          console.log('Domain removed from store successfully')
        } catch (error) {
          console.error('Error removing domain:', error)
          this.$emit('saved', `❌ Error removing domain: ${error.message}`)
        }
      }
    },

    saveDomain() {
      if (!this.canSaveDomain()) {
        console.log('Cannot save domain - validation failed')
        return
      }

      console.log('Saving domain to store...')
      this.isSavingDomain = true

      const newConfig = {
        domain: this.formData.domain,
        logo: this.formData.logo,
        contentFilter: this.formData.contentFilter,
        selectedCategories: this.formData.selectedCategories,
        mySiteFrontPage: this.formData.mySiteFrontPage,
        showSearchBar: this.formData.showSearchBar,
        menuConfig: this.formData.menuConfig,
      }

      try {
        if (this.editingDomainIndex !== null) {
          // Update existing domain
          const originalDomain = this.domainConfigs[this.editingDomainIndex].domain
          this.domainStore.updateDomain(originalDomain, newConfig)
          console.log('Updated domain in store:', originalDomain)
        } else {
          // Add new domain
          this.domainStore.addDomain(newConfig)
          console.log('Added new domain to store:', newConfig.domain)
        }

        // Go back to list view
        this.backToList()

        console.log('Domain saved to store. Changes:', this.changeSummary)
      } catch (error) {
        console.error('Error saving domain to store:', error)
        this.$emit('saved', `❌ Error saving domain: ${error.message}`)
      } finally {
        this.isSavingDomain = false
      }
    },

    async saveAllDomains() {
      if (!this.hasUnsavedChanges) {
        this.$emit('saved', 'No changes to save')
        return
      }

      try {
        console.log('Saving changes to server:', this.changeSummary)

        const result = await this.domainStore.saveChanges(this.userStore.email)

        if (result.success) {
          const message = `✅ Successfully saved ${result.stats.total} changes (${this.changeSummary})`
          this.$emit('saved', message, this.domainConfigs)
          this.closeModal()
        } else {
          const errors = result.errors.map((e) => `${e.domain}: ${e.error}`).join(', ')
          this.$emit('saved', `❌ Some domains failed to save: ${errors}`)
        }
      } catch (error) {
        console.error('Error saving all domains:', error)
        this.$emit('saved', `❌ Error saving domains: ${error.message}`)
      }
    },

    // Form management methods
    backToList() {
      this.viewMode = 'list'
      this.editingDomainIndex = null
      this.clearFormData()
    },

    clearFormData() {
      this.formData = {
        domain: '',
        logo: '',
        contentFilter: 'none',
        selectedCategories: [],
        mySiteFrontPage: '',
        showSearchBar: true, // Default to showing search bar
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
            'gnew',
          ],
        },
      }
      this.metaAreaInput = ''
      this.domainError = ''
      this.logoError = ''
    },

    canSaveDomain() {
      return (
        this.formData.domain && !this.domainError && (this.formData.logo ? !this.logoError : true)
      )
    },

    // Domain validation methods
    validateDomain() {
      this.domainError = ''
      try {
        if (this.formData.domain) {
          // Automatically convert domain to lowercase to prevent case mismatch issues
          this.formData.domain = this.formData.domain.toLowerCase()

          // Updated regex to handle subdomains properly
          const domainRegex =
            /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
          if (!domainRegex.test(this.formData.domain)) {
            this.domainError = 'Please enter a valid domain name'
          }
        }
      } catch (error) {
        console.error('Error in domain validation:', error)
        this.domainError = 'Error validating domain'
      }
    },
    validateLogo() {
      this.logoError = ''
      try {
        if (this.formData.logo) {
          new URL(this.formData.logo)
        }
      } catch (error) {
        console.error('Error in logo validation:', error)
        this.logoError = 'Please enter a valid URL'
      }
    },
    handleLogoError() {
      this.logoError = 'Unable to load image from this URL'
      this.logoLoaded = false
    },
    handleLogoLoad() {
      this.logoError = ''
      this.logoLoaded = true
    },
    getDomainTitle() {
      if (!this.formData.domain) return 'Your Brand'

      // Generic title generation from domain (handles both main domains and subdomains)
      const parts = this.formData.domain.split('.')

      // For main domains like "norsegong.com" or "www.norsegong.com"
      if (parts.length === 2 || (parts.length === 3 && parts[0] === 'www')) {
        const mainPart = parts.length === 2 ? parts[0] : parts[1]
        return mainPart.charAt(0).toUpperCase() + mainPart.slice(1)
      }

      // For subdomains like "salt.norsegong.com"
      const subdomain = parts[0]
      if (subdomain !== 'www') {
        return subdomain.charAt(0).toUpperCase() + subdomain.slice(1)
      }

      // Fallback to second part for www subdomains
      return parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
    },
    getDomainSubdomain() {
      if (!this.formData.domain) return ''

      const parts = this.formData.domain.split('.')

      // For main domains like "norsegong.com" or "www.norsegong.com", return the full domain
      if (parts.length === 2 || (parts.length === 3 && parts[0] === 'www')) {
        return this.formData.domain
      }

      // For subdomains like "salt.norsegong.com", return just the subdomain
      return parts[0]
    },
    formatMetaAreaLabel(metaArea) {
      // Convert meta area to a readable label
      return metaArea
        .split(/(?=[A-Z])/) // Split on capital letters
        .join(' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between lowercase and uppercase
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    },
    async fetchMetaAreas() {
      // Fetch ALL knowledge graphs from the system to get all available meta areas
      // We need to bypass content filtering to get meta areas from all graphs system-wide
      try {
        console.log('Fetching all meta areas from system-wide graphs...')

        // Call the knowledge graph worker directly without hostname filtering
        // This will return all graphs from all users in the system
        const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs', {
          headers: {
            // Don't send x-original-hostname to avoid content filtering
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          console.log('Fetched system-wide graphs for meta areas:', data.results?.length || 0)

          if (data.results) {
            // Fetch complete data for each graph to get meta areas
            const metaAreasSet = new Set()

            for (const graph of data.results) {
              try {
                const graphResponse = await fetch(
                  `https://knowledge.vegvisr.org/getknowgraph?id=${graph.id}`,
                )
                if (graphResponse.ok) {
                  const graphData = await graphResponse.json()
                  const metaAreaString = graphData.metadata?.metaArea || ''

                  if (metaAreaString) {
                    // Parse meta areas and add to set
                    const metaAreas = metaAreaString
                      .split('#')
                      .map((area) => area.trim())
                      .filter((area) => area.length > 0)

                    metaAreas.forEach((area) => metaAreasSet.add(area))
                  }
                }
              } catch (error) {
                console.warn(`Error fetching graph ${graph.id}:`, error)
              }
            }

            // Convert set to array and update the store
            const allMetaAreas = Array.from(metaAreasSet).sort()
            console.log('All system meta areas found:', allMetaAreas)

            // Update portfolio store with all meta areas
            this.portfolioStore.setAllMetaAreas(allMetaAreas)
          }
        } else {
          console.error('Failed to fetch system graphs:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('Error fetching system meta areas:', error)
      }
    },
    getSelectedCategoryNames() {
      if (!this.formData.selectedCategories || this.formData.selectedCategories.length === 0) {
        return 'No categories selected'
      }
      const names = this.formData.selectedCategories.map((value) => {
        const category = this.availableCategories.find((cat) => cat.value === value)
        return category ? category.label : this.formatMetaAreaLabel(value)
      })
      return names.length > 3
        ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
        : names.join(', ')
    },
    generateWorkerCode() {
      return `export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const hostname = url.hostname

    let targetUrl
    if (
      url.pathname.startsWith('/getknowgraphs') ||
      url.pathname.startsWith('/getknowgraph') ||
      url.pathname.startsWith('/saveknowgraph') ||
      url.pathname.startsWith('/updateknowgraph') ||
      url.pathname.startsWith('/deleteknowgraph') ||
      url.pathname.startsWith('/saveGraphWithHistory')
    ) {
      targetUrl = 'https://knowledge-graph-worker.torarnehave.workers.dev' + url.pathname + url.search
    } else if (
      url.pathname.startsWith('/mystmkrasave') ||
      url.pathname.startsWith('/generate-header-image') ||
      url.pathname.startsWith('/grok-ask') ||
      url.pathname.startsWith('/grok-elaborate') ||
      url.pathname.startsWith('/apply-style-template')
    ) {
      targetUrl = 'https://api.vegvisr.org' + url.pathname + url.search
    } else {
      targetUrl = 'https://www.vegvisr.org' + url.pathname + url.search
    }

    const headers = new Headers(request.headers)
    headers.set('x-original-hostname', hostname)

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'follow',
    })

    return new Response(response.body, response)
  },
}`
    },
    async copyWorkerCode() {
      try {
        await navigator.clipboard.writeText(this.generateWorkerCode())
        this.$emit('saved', 'Worker code copied to clipboard!')
      } catch (error) {
        console.error('Failed to copy worker code:', error)
      }
    },

    convertModalToKVFormat(domainConfig) {
      // Convert from modal format to KV storage format for main-worker
      return {
        domain: domainConfig.domain,
        owner: this.userStore.email,
        branding: {
          myLogo: domainConfig.logo || '',
          contentFilter: domainConfig.contentFilter,
          selectedCategories: domainConfig.selectedCategories || [],
          mySiteFrontPage: domainConfig.mySiteFrontPage || '',
          showSearchBar: domainConfig.showSearchBar !== undefined ? domainConfig.showSearchBar : true,
          site_title: this.getDomainTitleFromConfig(domainConfig),
          menuConfig: domainConfig.menuConfig || {
            enabled: false,
            selectedTemplate: '',
            visibleItems: [],
            templateData: null,
          },
        },
        contentFilter: {
          metaAreas: domainConfig.selectedCategories || [],
        },
      }
    },

    getDomainTitleFromConfig(domainConfig) {
      if (!domainConfig.domain) return 'Your Brand'

      const parts = domainConfig.domain.split('.')

      // Main domains: "example.com" or "www.example.com"
      if (parts.length === 2 || (parts.length === 3 && parts[0] === 'www')) {
        const mainPart = parts.length === 2 ? parts[0] : parts[1]
        return mainPart.charAt(0).toUpperCase() + mainPart.slice(1)
      }

      // Subdomains: "sub.example.com"
      const subdomain = parts[0]
      return subdomain !== 'www'
        ? subdomain.charAt(0).toUpperCase() + subdomain.slice(1)
        : parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
    },

    convertKVToModalFormat(siteConfig) {
      // Convert from KV storage format to modal format
      return {
        domain: siteConfig.domain,
        logo: siteConfig.branding?.myLogo || siteConfig.logo || '',
        contentFilter: siteConfig.branding?.contentFilter || siteConfig.content_filter || 'none',
        selectedCategories:
          siteConfig.branding?.selectedCategories || siteConfig.selected_categories || [],
        mySiteFrontPage: siteConfig.branding?.mySiteFrontPage || siteConfig.front_page_graph || '',
        showSearchBar: siteConfig.branding?.showSearchBar !== undefined ? siteConfig.branding.showSearchBar : true,
        menuConfig: siteConfig.menuConfig ||
          siteConfig.menu_config || {
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
              'gnew',
            ],
            templateData: null,
          },
      }
    },

    closeModal() {
      this.viewMode = 'list'
      this.editingDomainIndex = null
      this.clearFormData()
      this.$emit('close')
    },
    async testDomainSetup() {
      this.isTestingDomain = true
      this.domainTestResult = null

      try {
        // Extract subdomain and root domain from the full domain
        const domainParts = this.formData.domain.split('.')
        const subdomain = domainParts[0]
        const rootDomain = domainParts.slice(1).join('.') // e.g., "xyzvibe.com"

        // Use the brand-worker for domain registration testing
        const testUrl = 'https://api.vegvisr.org/create-custom-domain'

        console.log('Testing domain setup with URL:', testUrl)
        console.log('Full domain:', this.formData.domain)
        console.log('Subdomain:', subdomain)
        console.log('Root domain:', rootDomain)

        const payload = {
          subdomain,
          rootDomain, // This is crucial for xyzvibe.com
        }
        console.log('Request payload:', JSON.stringify(payload, null, 2))

        const response = await fetch(testUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        const result = await response.json()
        console.log('Domain setup test result:', JSON.stringify(result, null, 2))

        if (response.ok && result.overallSuccess) {
          this.domainTestResult = {
            success: true,
            message: `✅ Domain ${this.formData.domain} has been successfully configured!\nDNS: ${result.dnsSetup?.success ? 'OK' : 'Error'}\nWorker Route: ${result.workerSetup?.success ? 'OK' : 'Error'}`,
          }
        } else {
          let errorMessage =
            (result.dnsSetup &&
              !result.dnsSetup.success &&
              result.dnsSetup.errors?.map((e) => e.message).join('; ')) ||
            (result.workerSetup &&
              !result.workerSetup.success &&
              result.workerSetup.errors?.map((e) => e.message).join('; ')) ||
            result.error ||
            'Failed to configure domain'
          this.domainTestResult = {
            success: false,
            message: `❌ Error: ${errorMessage}`,
          }
        }
      } catch (error) {
        console.error('Error testing domain setup:', error)
        this.domainTestResult = {
          success: false,
          message: `❌ Error: ${error.message}`,
        }
      } finally {
        this.isTestingDomain = false
      }
    },
    async loadUserGraphs() {
      try {
        const graphs = await this.portfolioStore.fetchGraphs()
        this.userGraphs = graphs
      } catch (error) {
        console.error('Error loading user graphs:', error)
      }
    },
    selectFrontPage(graph) {
      this.formData.mySiteFrontPage = graph.id
      this.frontPageError = ''
      this.frontPageValid = true
      this.frontPageGraphTitle = graph.title
    },
    async validateFrontPageGraph() {
      const graphId = this.formData.mySiteFrontPage?.trim()

      // Clear previous validation state
      this.frontPageError = ''
      this.frontPageValid = false
      this.frontPageGraphTitle = ''

      if (!graphId) {
        // Empty is valid (means use default landing page)
        return
      }

      // Check basic format
      if (!graphId.startsWith('graph_') || graphId.length < 15) {
        this.frontPageError = 'Graph ID must start with "graph_" and be at least 15 characters long'
        return
      }

      // Check if graph exists (debounced to avoid too many API calls)
      clearTimeout(this.frontPageValidationTimeout)
      this.frontPageValidationTimeout = setTimeout(async () => {
        try {
          const response = await fetch(
            `https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraph?id=${graphId}`,
          )

          if (response.ok) {
            const graphData = await response.json()
            this.frontPageValid = true
            this.frontPageGraphTitle = graphData.metadata?.title || 'Unknown Title'
            this.frontPageError = ''
          } else if (response.status === 404) {
            this.frontPageError =
              'Graph not found. Please check the ID or select from the dropdown.'
          } else {
            this.frontPageError = 'Unable to validate graph. Please try again.'
          }
        } catch (error) {
          console.error('Error validating front page graph:', error)
          this.frontPageError = 'Network error while validating graph.'
        }
      }, 500) // 500ms debounce
    },
    onMetaAreaInput() {
      const value = this.metaAreaInput || ''
      const match = value.match(/#([\w-]*)$/)
      if (match) {
        const search = match[1].toLowerCase()
        this.filteredSuggestions = this.availableCategories
          .map((cat) => cat.value)
          .filter((area) => area.toLowerCase().includes(search))
        this.showSuggestions = this.filteredSuggestions.length > 0
        this.suggestionIndex = 0
      } else {
        this.showSuggestions = false
      }
    },
    selectSuggestion(idx = this.suggestionIndex) {
      if (!this.showSuggestions || !this.filteredSuggestions.length) return

      const value = this.metaAreaInput || ''
      const match = value.match(/#([\w-]*)$/)

      if (match) {
        const before = value.slice(0, match.index + 1)
        const after = value.slice(match.index + match[0].length)
        const selectedArea = this.filteredSuggestions[idx]

        if (selectedArea) {
          this.metaAreaInput = before + selectedArea + ' ' + after
          // Add to selected categories if not already present
          if (!this.formData.selectedCategories.includes(selectedArea)) {
            this.formData.selectedCategories.push(selectedArea)
          }
        }
      }

      this.showSuggestions = false
    },
    moveSuggestion(dir) {
      if (!this.showSuggestions) return
      this.suggestionIndex =
        (this.suggestionIndex + dir + this.filteredSuggestions.length) %
        this.filteredSuggestions.length
    },
    handleBlur() {
      setTimeout(() => {
        this.showSuggestions = false
      }, 200)
    },
    removeMetaArea(index) {
      this.formData.selectedCategories.splice(index, 1)
      this.updateMetaAreaInput()
    },
    updateMetaAreaInput() {
      // Update the input field to reflect the current selected categories
      this.metaAreaInput = this.formData.selectedCategories.map((area) => '#' + area).join(' ')
    },
    parseMetaAreaInput() {
      // Parse the input and extract meta areas
      const areas = this.metaAreaInput
        .split(/\s+/)
        .map((area) => area.trim())
        .filter((area) => area.startsWith('#'))
        .map((area) => area.substring(1))
        .filter((area) => area.length > 0)

      // Update selected categories with unique values
      this.formData.selectedCategories = [...new Set(areas)]
    },
    isDnsConflict(testResult) {
      // Check if the error indicates DNS or worker route conflicts
      const message = testResult.message || ''
      return (
        message.includes('A, AAAA, or CNAME record with that host already exists') ||
        message.includes('route with the same pattern already exists') ||
        message.includes('already exists')
      )
    },
    triggerLogoUpload() {
      this.$refs.logoFileInput.click()
    },
    async handleLogoUpload(event) {
      const file = event.target.files[0]
      if (!file || !file.type.startsWith('image/')) {
        alert('Please select a valid image file.')
        return
      }

      this.isUploadingLogo = true

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
        this.formData.logo = data.url
        this.logoError = '' // Clear any previous errors

        console.log('Logo uploaded successfully:', data.url)
      } catch (error) {
        console.error('Error uploading logo:', error)
        alert('Failed to upload logo image. Please try again.')
      } finally {
        this.isUploadingLogo = false
        // Clear the file input
        event.target.value = ''
      }
    },
    async deleteExistingDomain() {
      if (!this.formData.domain) {
        alert('No domain specified to delete')
        return
      }

      this.isDeletingExisting = true

      try {
        console.log('🗑️ Deleting existing domain infrastructure for:', this.formData.domain)

        // Extract subdomain and root domain
        const domainParts = this.formData.domain.split('.')
        const subdomain = domainParts[0]
        const rootDomain = domainParts.slice(1).join('.')

        // Call delete API
        const deleteResponse = await fetch('https://api.vegvisr.org/delete-custom-domain', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subdomain,
            rootDomain,
          }),
        })

        const deleteResult = await deleteResponse.json()
        console.log('🗑️ Delete result:', JSON.stringify(deleteResult, null, 2))

        if (deleteResponse.ok) {
          // Show what was deleted
          let deletedItems = []
          if (deleteResult.dnsSetup?.deleted) deletedItems.push('DNS record')
          if (deleteResult.workerSetup?.deleted) deletedItems.push('Worker route')
          if (deleteResult.kvSetup?.deleted) deletedItems.push('KV configuration')

          const deletedText =
            deletedItems.length > 0
              ? `Deleted: ${deletedItems.join(', ')}`
              : 'No existing infrastructure found to delete'

          console.log('✅ Delete completed:', deletedText)

          // Now try creating the domain again
          console.log('🔄 Retrying domain creation...')
          await this.testDomainSetup()
        } else {
          throw new Error(deleteResult.error || 'Failed to delete existing domain')
        }
      } catch (error) {
        console.error('❌ Error during delete & retry:', error)
        this.domainTestResult = {
          success: false,
          message: `❌ Failed to delete existing domain: ${error.message}`,
        }
      } finally {
        this.isDeletingExisting = false
      }
    },
    openAILogoModal() {
      this.isAILogoModalOpen = true
    },
    closeAILogoModal() {
      this.isAILogoModalOpen = false
    },
    handleAILogoGenerated(imageData) {
      console.log('AI Logo generated:', imageData)

      try {
        let imageUrl = null

        // Check if imageData is a simple URL string (for logo generation)
        if (typeof imageData === 'string' && imageData.startsWith('http')) {
          imageUrl = imageData
        } else if (typeof imageData === 'object') {
          // Handle the original node format for backward compatibility
          if (imageData.info) {
            // Extract URL from markdown format: ![alt](url)
            const match = imageData.info.match(/!\[.*?\]\((.+?)\)/)
            imageUrl = match ? match[1] : null
          } else if (imageData.label && imageData.label.includes('http')) {
            // If the URL is directly in the label
            const urlMatch = imageData.label.match(/(https?:\/\/[^\s)]+)/)
            imageUrl = urlMatch ? urlMatch[1] : null
          }
        }

        if (imageUrl) {
          this.formData.logo = imageUrl
          this.logoError = ''
          console.log('Logo URL set to:', imageUrl)

          // Close the AI modal
          this.closeAILogoModal()

          // Show success message
          this.$emit('saved', '✅ AI logo generated successfully!')
        } else {
          console.error('Could not extract image URL from generated data:', imageData)
          this.logoError = 'Failed to extract image URL from generated logo'
        }
      } catch (error) {
        console.error('Error handling AI generated logo:', error)
        this.logoError = 'Failed to process AI generated logo'
      }
    },
    // Superadmin Domain Management Modal methods
    openAdminDomainModal() {
      this.isAdminDomainModalOpen = true
    },
    closeAdminDomainModal() {
      this.isAdminDomainModalOpen = false
    },
    handleDomainUpdated() {
      // Refresh domain configurations when domains are updated via admin modal
      this.fetchDomainConfigsFromKV()
      // Optionally show a success message
      this.$emit('saved', '✅ Domain configurations updated successfully!')
    },
    isMainDomain(domain) {
      if (!domain) return false

      const parts = domain.split('.')

      // Main domains: "example.com" (2 parts) or "www.example.com" (3 parts with www)
      if (parts.length === 2) {
        return true // e.g., "norsegong.com"
      }

      if (parts.length === 3 && parts[0] === 'www') {
        return true // e.g., "www.norsegong.com"
      }

      // Subdomains: "salt.example.com", "api.example.com", etc.
      return false
    },

    // Menu template system methods
    async fetchMenuTemplates() {
      try {
        console.log('BrandingModal: Fetching menu templates...')
        await this.menuTemplateStore.fetchMenuTemplates('top')
        this.availableMenuTemplates = this.menuTemplateStore.menuTemplates
        console.log('BrandingModal: Fetched menu templates:', this.availableMenuTemplates.length)
        console.log(
          'BrandingModal: Template details:',
          this.availableMenuTemplates.map((t) => ({
            id: t.id,
            name: t.name,
            menu_level: t.menu_level,
            access_level: t.access_level,
            hasMenuData: !!t.menu_data,
            itemCount: t.menu_data?.items?.length || 0,
          })),
        )
      } catch (error) {
        console.error('BrandingModal: Error fetching menu templates:', error)
      }
    },

    async refreshMenuTemplates() {
      await this.fetchMenuTemplates()
    },

    applyMenuTemplate() {
      if (!this.formData.menuConfig.selectedTemplate) {
        // Clear template data if no template is selected
        this.formData.menuConfig.templateData = null
        return
      }

      const template = this.availableMenuTemplates.find(
        (t) => t.id === this.formData.menuConfig.selectedTemplate,
      )

      if (template) {
        console.log('Applying menu template:', template.name)
        console.log('Template menu_data:', template.menu_data)

        // Store the full template data in the menu configuration
        this.formData.menuConfig.templateData = template.menu_data

        // Also update visibleItems based on template items for backward compatibility
        if (template.menu_data && template.menu_data.items) {
          this.formData.menuConfig.visibleItems = template.menu_data.items.map((item) => item.id)
          console.log(
            'Updated visible items based on template:',
            this.formData.menuConfig.visibleItems,
          )
        }

        // Debug the full application process
        this.debugTemplateApplication()
      }
    },

    openMenuTemplateCreator() {
      // Debug: Log the current state
      console.log('=== OPENING MENU TEMPLATE CREATOR ===')
      console.log('Selected template ID:', this.formData.menuConfig.selectedTemplate)
      console.log('Available templates:', this.availableMenuTemplates)
      console.log(
        'Available template IDs:',
        this.availableMenuTemplates.map((t) => t.id),
      )

      // Check if a template is selected from the dropdown
      if (this.formData.menuConfig.selectedTemplate) {
        // Find the selected template in availableMenuTemplates
        const selectedTemplate = this.availableMenuTemplates.find(
          (t) => t.id === this.formData.menuConfig.selectedTemplate,
        )

        console.log('Found template:', selectedTemplate)

        if (selectedTemplate) {
          this.selectedMenuTemplate = selectedTemplate
          console.log('✅ Template found and set for editing:', selectedTemplate.name)
        } else {
          console.error('❌ Template not found in availableMenuTemplates!')
          console.error('Looking for ID:', this.formData.menuConfig.selectedTemplate)
          console.error(
            'Available IDs:',
            this.availableMenuTemplates.map((t) => t.id),
          )
          this.selectedMenuTemplate = null
          // Show user-friendly error
          alert('Selected template not found. Please refresh templates and try again.')
        }
      } else {
        // No template selected, creating new template
        console.log('📝 No template selected - creating new template')
        this.selectedMenuTemplate = null
      }

      console.log('Final selectedMenuTemplate:', this.selectedMenuTemplate)
      console.log(
        'Opening modal with template:',
        this.selectedMenuTemplate ? 'EDIT MODE' : 'CREATE MODE',
      )

      this.isMenuTemplateCreatorOpen = true
    },

    closeMenuTemplateCreator() {
      this.isMenuTemplateCreatorOpen = false
      this.selectedMenuTemplate = null
    },

    handleMenuTemplateSaved(template) {
      console.log('Menu template saved:', template)

      // If we were editing a template, keep it selected after saving
      const wasEditing = this.selectedMenuTemplate !== null
      const savedTemplateId = template.id

      // Refresh the templates list
      this.refreshMenuTemplates()

      // If we were editing, maintain the selection
      if (wasEditing && savedTemplateId) {
        this.formData.menuConfig.selectedTemplate = savedTemplateId
        console.log('✅ Maintained template selection after save:', savedTemplateId)
      }
    },

    // Debug method to test template application
    debugTemplateApplication() {
      console.log('=== TEMPLATE APPLICATION DEBUG ===')
      console.log('Available templates:', this.availableMenuTemplates.length)
      console.log('Selected template:', this.formData.menuConfig.selectedTemplate)
      console.log('Template data:', this.formData.menuConfig.templateData)
      console.log('Menu config enabled:', this.formData.menuConfig.enabled)
      console.log('Visible items:', this.formData.menuConfig.visibleItems)

      if (this.formData.menuConfig.selectedTemplate) {
        const template = this.availableMenuTemplates.find(
          (t) => t.id === this.formData.menuConfig.selectedTemplate,
        )
        console.log('Found template:', template)
        if (template) {
          console.log('Template menu_data:', template.menu_data)
          console.log('Template items:', template.menu_data?.items)
        }
      }
    },
  },
}
</script>

<style scoped>
.branding-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  backdrop-filter: blur(4px);
}

.branding-modal {
  background: #fff;
  border-radius: 16px;
  width: 95%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
}

/* Increase height for edit mode to accommodate more content */
.branding-modal.edit-mode {
  max-height: 95vh;
  max-width: 1400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 30px 20px;
  border-bottom: 2px solid #f0f0f0;
}

.modal-header h2 {
  margin: 0;
  color: #333;
  font-size: 1.5rem;
  font-weight: 600;
}

.modal-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: #999;
  cursor: pointer;
  line-height: 1;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.modal-content {
  flex: 1;
  padding: 30px 30px 60px 30px; /* Extra bottom padding to ensure content is scrollable */
  overflow-y: scroll !important; /* Force scrollbar to always show */
  overflow-x: hidden;
  /* Ensure proper scrolling with better height calculation */
  min-height: 0;
  max-height: calc(90vh - 120px); /* Account for header and padding */
  /* Force scrollbar visibility */
  scrollbar-width: auto; /* Firefox */
  -ms-overflow-style: auto; /* IE/Edge */
}

/* Better scrolling for edit mode with more content */
.branding-modal.edit-mode .modal-content {
  max-height: calc(95vh - 120px);
  overflow-y: scroll !important;
}

/* Make scrollbar more visible and prominent */
.modal-content::-webkit-scrollbar {
  width: 12px;
  background: #f0f0f0;
}

.modal-content::-webkit-scrollbar-track {
  background: #e9ecef;
  border-radius: 6px;
  margin: 5px;
}

.modal-content::-webkit-scrollbar-thumb {
  background: #6c757d;
  border-radius: 6px;
  border: 2px solid #e9ecef;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: #495057;
}

.modal-content::-webkit-scrollbar-thumb:active {
  background: #343a40;
}

/* Force scrollbar to always be visible */
.modal-content {
  scrollbar-width: thick; /* Firefox - thick scrollbar */
  scrollbar-color: #6c757d #e9ecef; /* Firefox - thumb and track color */
}

/* Add scroll indicator shadow when content overflows */
.modal-content::after {
  content: '';
  position: sticky;
  bottom: 0;
  display: block;
  height: 20px;
  background: linear-gradient(transparent, rgba(255, 255, 255, 0.8));
  pointer-events: none;
  margin: 0 -30px -60px -30px;
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e9ecef;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.step.active .step-number {
  background: #007bff;
  color: white;
}

.step.completed .step-number {
  background: #28a745;
  color: white;
}

.step-label {
  font-size: 0.85rem;
  color: #6c757d;
  font-weight: 500;
}

.step.active .step-label {
  color: #007bff;
  font-weight: 600;
}

.step.completed .step-label {
  color: #28a745;
}

.step-divider {
  width: 80px;
  height: 2px;
  background: #e9ecef;
  margin: 0 20px 20px;
}

.step-content h3 {
  color: #333;
  margin-bottom: 12px;
  font-size: 1.3rem;
}

.step-description {
  color: #666;
  margin-bottom: 30px;
  font-size: 1rem;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 25px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-size: 0.95rem;
}

.form-control {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.form-text {
  margin-top: 6px;
  font-size: 0.85rem;
  color: #6c757d;
}

.error-message {
  margin-top: 6px;
  color: #dc3545;
  font-size: 0.85rem;
  font-weight: 500;
}

.valid-message {
  margin-top: 6px;
  color: #28a745;
  font-size: 0.85rem;
  font-weight: 500;
}

.logo-preview {
  margin-top: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.preview-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: white;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.logo-preview-img {
  max-width: 200px;
  max-height: 80px;
  object-fit: contain;
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 10px;
}

.form-check-input {
  margin: 0;
}

.form-check-label {
  margin: 0;
  cursor: pointer;
  font-size: 0.95rem;
}

.category-selection {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #dee2e6;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.category-item {
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.category-item:hover {
  border-color: #007bff;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.1);
}

.category-item:has(.form-check-input:checked) {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.05);
}

.category-item .form-check-input {
  margin-bottom: 8px;
}

.category-item .form-check-label {
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 4px;
}

.category-description {
  color: #6c757d;
  font-size: 0.8rem;
  line-height: 1.4;
  display: block;
}

/* Multi-Domain Management Styles */
.domain-list {
  margin-bottom: 20px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 12px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  background-color: #f8f9fa;
}

/* Custom scrollbar for domain list */
.domain-list::-webkit-scrollbar {
  width: 12px;
}

.domain-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 6px;
  margin: 4px;
}

.domain-list::-webkit-scrollbar-thumb {
  background: #6c757d;
  border-radius: 6px;
  border: 2px solid #f1f1f1;
}

.domain-list::-webkit-scrollbar-thumb:hover {
  background: #495057;
}

.domain-item {
  margin-bottom: 15px;
}

.domain-card {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  transition: box-shadow 0.2s ease;
}

.domain-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.domain-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 15px;
}

.domain-info {
  flex: 1;
}

.domain-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  margin: 0 0 8px 0;
}

.domain-link {
  color: #333;
  text-decoration: none;
  transition: color 0.2s ease;
  display: inline-flex;
  align-items: center;
}

.domain-link:hover {
  color: #007bff;
  text-decoration: underline;
}

.domain-link i {
  font-size: 0.9rem;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.domain-link:hover i {
  opacity: 1;
}

.domain-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.domain-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.domain-preview {
  border-top: 1px solid #dee2e6;
  padding-top: 15px;
  text-align: center;
}

.domain-logo-preview {
  max-width: 120px;
  max-height: 50px;
  object-fit: contain;
  border-radius: 4px;
}

.no-domains-message {
  text-align: center;
  margin: 40px 0;
}

.add-domain-section {
  text-align: center;
  margin-top: 30px;
}

.deployment-instructions {
  background: #e7f3ff;
  border-radius: 8px;
  padding: 20px;
  border-left: 4px solid #007bff;
}

.deployment-instructions h5 {
  color: #004085;
  margin-bottom: 15px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .domain-header {
    flex-direction: column;
    align-items: stretch;
  }

  .domain-actions {
    justify-content: flex-end;
    margin-top: 15px;
  }
}

.browser-mockup {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.browser-bar {
  background: #f5f5f5;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #ddd;
}

.browser-buttons {
  display: flex;
  gap: 6px;
}

.browser-button {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.browser-button.red {
  background: #ff5f56;
}
.browser-button.yellow {
  background: #ffbd2e;
}
.browser-button.green {
  background: #27ca3f;
}

.browser-url {
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 0.85rem;
  color: #666;
  flex: 1;
}

.browser-content {
  padding: 20px;
}

.mockup-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.mockup-logo {
  width: 50px;
  height: 20px;
  object-fit: contain;
}

.mockup-logo-placeholder {
  width: 50px;
  height: 20px;
  background: #e9ecef;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: #6c757d;
}

.mockup-title {
  margin: 0;
  font-size: 1.2rem;
  color: #333;
}

.mockup-nav {
  background: #f8f9fa;
  padding: 10px 15px;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #495057;
  margin-bottom: 15px;
}

.mockup-graph {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.mockup-node {
  background: #007bff;
  color: white;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
}

.preview-details {
  margin-top: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.preview-details h4 {
  margin-bottom: 15px;
  color: #333;
}

.preview-details ul {
  margin: 0;
  padding-left: 20px;
}

.preview-details li {
  margin-bottom: 8px;
  color: #555;
}

.deployment-steps {
  margin-bottom: 30px;
}

.deployment-step {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.step-number-small {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #007bff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content-small {
  flex: 1;
}

.step-content-small h4 {
  margin-bottom: 10px;
  color: #333;
}

.step-content-small p {
  margin-bottom: 15px;
  color: #666;
  line-height: 1.5;
}

.code-block {
  background: #2d3748;
  color: #e2e8f0;
  padding: 15px;
  border-radius: 6px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  position: relative;
  overflow-x: auto;
  margin-bottom: 15px;
}

.copy-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #4a5568;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.copy-btn:hover {
  background: #2d3748;
}

.deployment-notice {
  display: flex;
  gap: 15px;
  padding: 20px;
  background: #e7f3ff;
  border-left: 4px solid #007bff;
  border-radius: 6px;
}

.notice-icon {
  font-size: 1.5rem;
}

.notice-content {
  color: #004085;
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 30px;
  border-top: 2px solid #f0f0f0;
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-size: 0.95rem;
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

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #1e7e34;
}

.btn-outline-secondary {
  background: transparent;
  color: #6c757d;
  border: 1px solid #6c757d;
}

.btn-outline-secondary:hover {
  background: #6c757d;
  color: white;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
}

.loading-content {
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Autocomplete styles */
.autocomplete-list {
  position: absolute;
  z-index: 1000;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.autocomplete-list li {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.autocomplete-list li.active,
.autocomplete-list li:hover {
  background: #007bff;
  color: #fff;
}

.selected-areas {
  margin-top: 15px;
}

.selected-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.selected-badges .badge {
  display: flex;
  align-items: center;
  gap: 5px;
}

.selected-badges .btn-close {
  font-size: 0.7rem;
  opacity: 0.8;
}

.selected-badges .btn-close:hover {
  opacity: 1;
}

.logo-input-group {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.logo-input-group .form-control {
  flex: 1;
}

.logo-input-group .upload-btn,
.logo-input-group .ai-generate-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 12px 16px;
  white-space: nowrap;
}

.logo-input-group .upload-btn:disabled,
.logo-input-group .ai-generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.logo-input-group .upload-btn i,
.logo-input-group .ai-generate-btn i {
  font-size: 0.9rem;
}

.ai-generate-btn {
  background: transparent;
  color: #28a745;
  border: 1px solid #28a745;
  transition: all 0.2s ease;
}

.ai-generate-btn:hover:not(:disabled) {
  background: #28a745;
  color: white;
}

.ai-generate-btn:disabled {
  color: #6c757d;
  border-color: #6c757d;
}

/* Menu Configuration Styles */
.menu-config-section {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-top: 15px;
}

.menu-items-config {
  margin-top: 15px;
}

.menu-item-config {
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.menu-item-config:hover {
  border-color: #007bff;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
}

.menu-item-config:has(.form-check-input:checked) {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.05);
}

.menu-item-config .form-check-input {
  margin-bottom: 4px;
}

.menu-item-config .form-check-label {
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 4px;
}

.menu-item-path {
  color: #6c757d;
  font-size: 0.8rem;
  display: block;
  margin-bottom: 4px;
}

@media (max-width: 768px) {
  .branding-modal {
    width: 98%;
    max-width: none;
    max-height: 95vh;
    margin: 1vh auto;
  }

  .modal-header,
  .modal-content,
  .modal-footer {
    padding: 15px;
  }

  .domain-list {
    max-height: 300px;
    padding: 12px;
    margin-bottom: 15px;
  }

  .step-indicator {
    flex-direction: column;
    gap: 10px;
  }

  .step-divider {
    width: 2px;
    height: 30px;
    margin: 10px 0;
  }

  .deployment-step {
    flex-direction: column;
    gap: 15px;
  }

  .modal-footer {
    flex-direction: column;
  }
}

.dns-setup-main,
.dns-setup-subdomain {
  margin-bottom: 15px;
}
</style>
