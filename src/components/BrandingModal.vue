<template>
  <div v-if="isOpen" class="branding-modal-overlay">
    <div class="branding-modal">
      <div class="modal-header">
        <h2>🎨 Custom Domain Branding Setup</h2>
        <button @click="closeModal" class="close-btn">&times;</button>
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
            <h4>Your Configured Domains</h4>
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
            />
            <div class="form-text">
              Enter your custom domain name. This should be a subdomain you control.
            </div>
            <div v-if="domainError" class="error-message">{{ domainError }}</div>
          </div>

          <div class="form-group">
            <label for="customLogo" class="form-label">
              <strong>Logo URL:</strong>
            </label>
            <input
              id="customLogo"
              v-model="formData.logo"
              type="url"
              class="form-control"
              placeholder="https://example.com/logo.png"
              @input="validateLogo"
            />
            <div class="form-text">
              URL to your logo image. Recommended size: 200x80px or similar aspect ratio.
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
              <strong>2. DNS Setup:</strong> Point {{ getDomainSubdomain() }} to your Cloudflare
              Worker<br />
              <button
                @click="testDomainSetup"
                class="btn btn-primary btn-sm mt-2"
                :disabled="isTestingDomain"
              >
                {{ isTestingDomain ? 'Testing...' : 'Test Domain Setup' }}
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
              <strong>3. Test:</strong> Visit {{ formData.domain }} after deployment
            </div>
          </div>

          <div class="mb-3">
            <label for="frontPage" class="form-label">Custom Front Page (Knowledge Graph ID)</label>
            <div class="input-group">
              <input
                type="text"
                class="form-control"
                id="frontPage"
                v-model="formData.mySiteFrontPage"
                placeholder="Enter Graph ID or Path (e.g., /graph-viewer?graphId=123&template=Frontpage)"
              />
              <button
                class="btn btn-outline-secondary dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                Select Graph
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li v-for="graph in userGraphs" :key="graph.id" @click="selectFrontPage(graph)">
                  <a class="dropdown-item" href="#">{{ graph.title }} (ID: {{ graph.id }})</a>
                </li>
              </ul>
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
          </div>
          <div>
            <button
              @click="saveAllDomains"
              class="btn btn-success me-2"
              :disabled="domainConfigs.length === 0"
            >
              Save All Domains
            </button>
            <button @click="closeModal" class="btn btn-outline-secondary">Close</button>
          </div>
        </div>

        <!-- Edit View Footer -->
        <div v-if="viewMode === 'edit'" class="w-100 d-flex justify-content-end">
          <button @click="backToList" class="btn btn-secondary me-2">Cancel</button>
          <button @click="saveDomain" :disabled="!canSaveDomain()" class="btn btn-primary">
            {{ editingDomainIndex !== null ? 'Update Domain' : 'Add Domain' }}
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
    </div>
  </div>
</template>

<script>
import { useUserStore } from '@/stores/userStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { apiUrls } from '@/config/api'

export default {
  name: 'BrandingModal',
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
      isSaving: false,
      domainConfigs: [...this.existingDomainConfigs], // Initialize with existing configs
      editingDomainIndex: null, // Index of domain being edited, null for new domain
      formData: {
        domain: '',
        logo: '',
        contentFilter: 'none',
        selectedCategories: [],
        mySiteFrontPage: '',
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
    }
  },
  setup() {
    const userStore = useUserStore()
    const portfolioStore = usePortfolioStore()
    return { userStore, portfolioStore }
  },
  watch: {
    existingDomainConfigs: {
      handler(newConfigs) {
        console.log('Updating domain configs from props:', newConfigs)
        this.domainConfigs = [...newConfigs]
      },
      immediate: true,
    },
    isOpen: {
      handler(newValue) {
        if (newValue) {
          console.log('BrandingModal opened, current domainConfigs:', this.domainConfigs)
          // Fetch domain configs from KV and system-wide meta areas when modal opens
          this.fetchDomainConfigsFromKV()
          this.fetchMetaAreas()
        }
      },
      immediate: false,
    },
  },
  computed: {
    availableCategories() {
      // Get meta areas from portfolio store and format them for the UI
      return this.portfolioStore.allMetaAreas.map((metaArea) => ({
        value: metaArea,
        label: this.formatMetaAreaLabel(metaArea),
        description: `Content related to ${this.formatMetaAreaLabel(metaArea).toLowerCase()}`,
      }))
    },
  },
  mounted() {
    console.log('BrandingModal mounted with existingDomainConfigs:', this.existingDomainConfigs)
    this.loadExistingDomainConfigs()
    this.fetchDomainConfigsFromKV()
    this.fetchMetaAreas()
    this.loadUserGraphs()
  },
  methods: {
    loadExistingDomainConfigs() {
      // Load existing domain configurations from props
      this.domainConfigs = [...this.existingDomainConfigs]
      console.log('Loaded existing domain configs from props:', this.domainConfigs)
    },
    async fetchDomainConfigsFromKV() {
      // Fetch domain configurations from user profile + KV store
      try {
        console.log(
          'Fetching domain configs from user profile + KV for user:',
          this.userStore.email,
        )

        // Step 1: Get the list of domains from user's profile data
        const response = await fetch(apiUrls.getUserData(this.userStore.email))

        if (!response.ok) {
          console.error('Failed to fetch user data:', response.status, response.statusText)
          return
        }

        const userData = await response.json()
        console.log('Fetched user data:', userData)

        let domainList = []

        // Extract domain list from user data
        if (
          userData.data &&
          userData.data.domainConfigs &&
          Array.isArray(userData.data.domainConfigs)
        ) {
          // New multi-domain structure - extract domain names
          domainList = userData.data.domainConfigs.map((config) => config.domain).filter(Boolean)
          console.log('Found domains in user profile:', domainList)
        } else if (userData.data && userData.data.branding && userData.data.branding.mySite) {
          // Legacy single domain structure
          domainList = [userData.data.branding.mySite]
          console.log('Found legacy domain in user profile:', domainList)
        }

        if (domainList.length === 0) {
          console.log('No domains found in user profile, trying to detect from known domains')
          // Fallback: try common domain patterns for this user
          const knownDomains = [
            'salt.norsegong.com',
            'sweet.norsegong.com',
            'torarne.xyzvibe.com',
            'vegvisr.norsegong.com',
          ]

          // Check which of these domains exist in KV and belong to this user
          for (const domain of knownDomains) {
            try {
              const kvResponse = await fetch(apiUrls.getSiteConfig(domain))
              if (kvResponse.ok) {
                const siteConfig = await kvResponse.json()
                if (siteConfig.owner === this.userStore.email) {
                  domainList.push(domain)
                  console.log(`Found owned domain: ${domain}`)
                }
              }
            } catch (error) {
              console.log(`Could not check domain ${domain}:`, error)
            }
          }

          if (domainList.length === 0) {
            console.log('No domains found even with fallback detection')
            return
          }
        }

        // Step 2: Fetch detailed configuration from KV for each domain
        const domainConfigs = []

        for (const domain of domainList) {
          try {
            console.log(`Fetching KV config for domain: ${domain}`)
            const kvResponse = await fetch(apiUrls.getSiteConfig(domain))

            if (kvResponse.ok) {
              const siteConfig = await kvResponse.json()
              console.log(`KV config for ${domain}:`, siteConfig)

              // Convert KV format to modal format
              const modalConfig = {
                domain: siteConfig.domain,
                logo: siteConfig.branding?.myLogo || '',
                contentFilter: siteConfig.branding?.contentFilter || 'none',
                selectedCategories: siteConfig.branding?.selectedCategories || [],
                mySiteFrontPage: siteConfig.branding?.mySiteFrontPage || '',
              }

              domainConfigs.push(modalConfig)
            } else if (kvResponse.status === 404) {
              console.log(`No KV config found for ${domain}, using fallback`)
              // Create fallback config if KV entry doesn't exist
              const fallbackConfig = {
                domain: domain,
                logo: '',
                contentFilter: 'none',
                selectedCategories: [],
                mySiteFrontPage: '',
              }
              domainConfigs.push(fallbackConfig)
            } else {
              console.error(`Error fetching KV config for ${domain}:`, kvResponse.status)
            }
          } catch (error) {
            console.error(`Error processing domain ${domain}:`, error)
          }
        }

        // Step 3: Update the modal with the fetched configurations
        if (domainConfigs.length > 0) {
          this.domainConfigs = domainConfigs
          console.log('Updated domain configs from KV:', this.domainConfigs)
        }
      } catch (error) {
        console.error('Error fetching domain configs from KV:', error)
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
      }
      // Update the meta area input to reflect selected categories
      this.updateMetaAreaInput()
      this.viewMode = 'edit'
    },
    async removeDomain(index) {
      const domainConfig = this.domainConfigs[index]
      const domainName = domainConfig.domain

      if (
        confirm(
          `Are you sure you want to remove the domain "${domainName}"?\n\nThis will:\n- Delete the DNS record\n- Delete the worker route\n- Delete the site configuration\n\nThis action cannot be undone.`,
        )
      ) {
        try {
          console.log('🗑️ Starting domain deletion for:', domainName)

          // Extract subdomain and root domain from the full domain
          const domainParts = domainName.split('.')
          const subdomain = domainParts[0]
          const rootDomain = domainParts.slice(1).join('.') // e.g., "norsegong.com"

          console.log('🎯 Parsed domain:', { subdomain, rootDomain, fullDomain: domainName })

          // Call the delete API
          const response = await fetch('https://api.vegvisr.org/delete-custom-domain', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subdomain,
              rootDomain,
            }),
          })

          const result = await response.json()
          console.log('🗑️ Delete API response:', JSON.stringify(result, null, 2))

          if (response.ok && result.overallSuccess) {
            // Success - remove from local array
            this.domainConfigs.splice(index, 1)
            console.log('✅ Domain successfully deleted and removed from list')

            // Show success message
            alert(
              `✅ Domain "${domainName}" has been successfully removed!\n\nDeleted:\n- DNS Record: ${result.dnsSetup?.deleted ? 'Yes' : 'Not found'}\n- Worker Route: ${result.workerSetup?.deleted ? 'Yes' : 'Not found'}\n- KV Configuration: ${result.kvSetup?.deleted ? 'Yes' : 'Not found'}`,
            )
          } else {
            // Partial success or failure
            let errorMessage = `❌ Failed to completely remove domain "${domainName}"`

            if (result.dnsSetup && !result.dnsSetup.success) {
              errorMessage += `\n- DNS: ${result.dnsSetup.errors?.map((e) => e.message).join('; ') || 'Failed'}`
            }
            if (result.workerSetup && !result.workerSetup.success) {
              errorMessage += `\n- Worker Route: ${result.workerSetup.errors?.map((e) => e.message).join('; ') || 'Failed'}`
            }
            if (result.kvSetup && !result.kvSetup.success) {
              errorMessage += `\n- KV Store: ${result.kvSetup.errors?.map((e) => e.message).join('; ') || 'Failed'}`
            }

            // Ask user if they want to remove from list anyway
            const removeAnyway = confirm(
              errorMessage + '\n\nDo you want to remove it from the list anyway?',
            )
            if (removeAnyway) {
              this.domainConfigs.splice(index, 1)
              console.log('⚠️ Domain removed from list despite deletion errors')
            }
          }
        } catch (error) {
          console.error('❌ Error during domain deletion:', error)
          alert(
            `❌ Error removing domain "${domainName}": ${error.message}\n\nThe domain was not removed from the list.`,
          )
        }
      }
    },
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
    saveDomain() {
      if (!this.canSaveDomain()) return

      const newConfig = {
        domain: this.formData.domain,
        logo: this.formData.logo,
        contentFilter: this.formData.contentFilter,
        selectedCategories: this.formData.selectedCategories,
        mySiteFrontPage: this.formData.mySiteFrontPage,
      }

      if (this.editingDomainIndex !== null) {
        // Update existing domain
        this.domainConfigs[this.editingDomainIndex] = newConfig
        console.log('Updated domain config at index', this.editingDomainIndex, newConfig)
      } else {
        // Add new domain
        this.domainConfigs.push(newConfig)
        console.log('Added new domain config:', newConfig)
      }

      this.backToList()
    },
    validateDomain() {
      this.domainError = ''
      if (this.formData.domain) {
        // Updated regex to handle subdomains properly
        const domainRegex =
          /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
        if (!domainRegex.test(this.formData.domain)) {
          this.domainError = 'Please enter a valid domain name'
        }
      }
    },
    validateLogo() {
      this.logoError = ''
      if (this.formData.logo) {
        try {
          new URL(this.formData.logo)
        } catch {
          this.logoError = 'Please enter a valid URL'
        }
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
      // Generic title generation from domain (no hardcoded values)
      const parts = this.formData.domain.split('.')
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
    },
    getDomainSubdomain() {
      if (!this.formData.domain) return ''
      return this.formData.domain.split('.')[0]
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

    async saveAllDomains() {
      this.isSaving = true

      try {
        // Get current user data to preserve existing settings
        const currentResponse = await fetch(apiUrls.getUserData(this.userStore.email))
        let currentData = {}
        if (currentResponse.ok) {
          currentData = await currentResponse.json()
          console.log('Current user data:', JSON.stringify(currentData, null, 2))
        }

        const payload = {
          email: this.userStore.email,
          bio: currentData.bio || '',
          profileimage: currentData.profileimage || '',
          data: {
            ...currentData.data,
            domainConfigs: this.domainConfigs, // New multi-domain structure
            // Keep legacy branding for backward compatibility
            branding:
              this.domainConfigs.length > 0
                ? {
                    mySite: this.domainConfigs[0].domain,
                    myLogo: this.domainConfigs[0].logo,
                    mySiteFrontPage: this.domainConfigs[0].mySiteFrontPage || '',
                  }
                : {},
          },
        }

        console.log('Saving domain configuration payload:', JSON.stringify(payload, null, 2))

        const response = await fetch(apiUrls.updateUserData(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          throw new Error('Failed to save domain configurations')
        }

        const result = await response.json()
        console.log('Save domain configuration response:', JSON.stringify(result, null, 2))

        // Emit success with updated domain configs
        this.$emit('saved', 'All domain configurations saved successfully!', this.domainConfigs)
        this.closeModal()
      } catch (error) {
        console.error('Error saving domain configurations:', error)
        this.$emit('saved', `Error: ${error.message}`)
      } finally {
        this.isSaving = false
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
      this.formData.mySiteFrontPage = `/graph-viewer?graphId=${graph.id}&template=Frontpage`
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
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
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
  padding: 30px;
  overflow-y: auto;
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

@media (max-width: 768px) {
  .branding-modal {
    width: 95%;
    max-height: 95vh;
  }

  .modal-header,
  .modal-content,
  .modal-footer {
    padding: 20px;
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
</style>
