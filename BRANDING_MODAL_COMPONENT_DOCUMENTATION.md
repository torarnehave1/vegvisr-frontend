# BrandingModal.vue Component Documentation

## Overview

The `BrandingModal.vue` component is a sophisticated Vue 3 modal component that serves as the primary interface for managing custom domain branding in the Vegvisr system. With 2,929 lines of code, it's one of the most complex components in the application, providing comprehensive domain management, logo handling, content filtering, and menu configuration capabilities.

## Table of Contents

1. [Component API](#component-api)
2. [Data Structure](#data-structure)
3. [Computed Properties](#computed-properties)
4. [Methods Documentation](#methods-documentation)
5. [Child Components](#child-components)
6. [Event System](#event-system)
7. [Lifecycle Management](#lifecycle-management)
8. [State Management](#state-management)
9. [Development Guidelines](#development-guidelines)
10. [Code Structure Analysis](#code-structure-analysis)

## Component API

### Props

```typescript
interface Props {
  isOpen: boolean // Controls modal visibility
  existingDomainConfigs: Array<DomainConfig> // Pre-loaded domain configurations
}
```

### Emits

```typescript
interface Emits {
  close: () => void // Modal close event
  saved: (message: string, configs?: Array) => void // Save success event
}
```

### Dependencies

```javascript
// Stores
import { useUserStore } from '@/stores/userStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useMenuTemplateStore } from '@/stores/menuTemplateStore'

// Configuration
import { apiUrls } from '@/config/api'

// Child Components
import AIImageModal from './AIImageModal.vue'
import AdminDomainModal from './AdminDomainModal.vue'
import MenuTemplateCreator from './MenuTemplateCreator.vue'
```

## Data Structure

### Primary State

```javascript
data() {
  return {
    // Modal Control
    currentStep: 1,
    isSaving: false,
    viewMode: 'list', // 'list' | 'edit'

    // Domain Management
    domainConfigs: [...this.existingDomainConfigs],
    editingDomainIndex: null,

    // Form Data
    formData: {
      domain: '',
      logo: '',
      contentFilter: 'none', // 'none' | 'custom'
      selectedCategories: [],
      mySiteFrontPage: '',
      menuConfig: {
        enabled: false,
        selectedTemplate: '',
        visibleItems: [/* default menu items */],
        templateData: null
      }
    },

    // Validation
    domainError: '',
    logoError: '',
    frontPageError: '',
    frontPageValid: false,

    // UI State
    logoLoaded: false,
    isTestingDomain: false,
    domainTestResult: null,
    isSavingDomain: false,

    // Meta Area Selection
    metaAreaInput: '',
    showSuggestions: false,
    suggestionIndex: 0,
    filteredSuggestions: [],

    // Logo Management
    isUploadingLogo: false,
    isAILogoModalOpen: false,

    // Admin Features
    isAdminDomainModalOpen: false,

    // Menu System
    availableMenuTemplates: [],
    isMenuTemplateCreatorOpen: false,
    selectedMenuTemplate: null,

    // Data Sources
    userGraphs: [],
    frontPageGraphTitle: '',
    frontPageValidationTimeout: null
  }
}
```

### Domain Configuration Schema

```javascript
interface DomainConfig {
  domain: string                    // Domain name (e.g., "example.com")
  logo: string                      // Logo URL
  contentFilter: 'none' | 'custom'  // Content filtering type
  selectedCategories: string[]      // Meta areas for filtering
  mySiteFrontPage: string          // Custom front page graph ID
  menuConfig: {
    enabled: boolean               // Menu customization enabled
    selectedTemplate: string       // Menu template ID
    visibleItems: string[]         // Visible menu item IDs
    templateData: object          // Full template configuration
  }
}
```

## Computed Properties

### `availableCategories`

Transforms portfolio store meta areas into UI-friendly format.

```javascript
computed: {
  availableCategories() {
    return this.portfolioStore.allMetaAreas.map((metaArea) => ({
      value: metaArea,
      label: this.formatMetaAreaLabel(metaArea),
      description: `Content related to ${this.formatMetaAreaLabel(metaArea).toLowerCase()}`,
    }))
  }
}
```

### `availableMenuItems`

Defines default menu items with role-based access control.

```javascript
availableMenuItems() {
  return [
    {
      id: 'graph-editor',
      label: 'Editor',
      path: '/graph-editor',
      roles: ['User', 'Admin', 'Superadmin'],
    },
    // ... more menu items
  ]
}
```

## Methods Documentation

### Modal Management

#### `handleOverlayClick(event)`

Handles clicks on modal overlay to close modal only when clicking outside content.

```javascript
handleOverlayClick(event) {
  if (event.target === event.currentTarget) {
    this.closeModal()
  }
}
```

#### `handleKeydown(event)`

Handles keyboard events, primarily ESC key for modal closing.

```javascript
handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    this.closeModal()
  }
}
```

#### `closeModal()`

Resets modal state and emits close event.

```javascript
closeModal() {
  this.viewMode = 'list'
  this.editingDomainIndex = null
  this.clearFormData()
  this.$emit('close')
}
```

### Domain Configuration Management

#### `fetchDomainConfigsFromKV()`

**Purpose**: Loads domain configurations from user profile and KV store  
**Process**:

1. Fetches user data to get domain list
2. For each domain, fetches detailed config from KV store
3. Converts KV format to modal format
4. Updates component state

```javascript
async fetchDomainConfigsFromKV() {
  try {
    // Step 1: Get domain list from user profile
    const response = await fetch(apiUrls.getUserData(this.userStore.email))
    const userData = await response.json()

    // Step 2: Extract domain names
    let domainList = []
    if (userData.data?.domainConfigs) {
      domainList = userData.data.domainConfigs.map(config => config.domain)
    }

    // Step 3: Fetch detailed configs from KV
    const domainConfigs = []
    for (const domain of domainList) {
      const kvResponse = await fetch(apiUrls.getSiteConfig(domain))
      if (kvResponse.ok) {
        const siteConfig = await kvResponse.json()
        domainConfigs.push(this.convertKVToModalFormat(siteConfig))
      }
    }

    this.domainConfigs = domainConfigs
  } catch (error) {
    console.error('Error fetching domain configs:', error)
  }
}
```

#### `addNewDomain()`

Initializes form for new domain creation.

```javascript
addNewDomain() {
  this.editingDomainIndex = null
  this.formData = this.getDefaultFormData()
  this.viewMode = 'edit'
}
```

#### `saveDomain()`

**Purpose**: Saves individual domain configuration immediately  
**Process**:

1. Validates domain configuration
2. Saves to KV store via `saveDomainToKV()`
3. Updates local state only after successful save
4. Provides real-time feedback

```javascript
saveDomain() {
  if (!this.canSaveDomain()) return

  this.isSavingDomain = true

  const newConfig = {
    domain: this.formData.domain,
    logo: this.formData.logo,
    contentFilter: this.formData.contentFilter,
    selectedCategories: this.formData.selectedCategories,
    mySiteFrontPage: this.formData.mySiteFrontPage,
    menuConfig: this.formData.menuConfig,
  }

  // Save to KV store immediately
  this.saveDomainToKV(newConfig)
    .then(() => {
      // Update local state only after successful KV save
      if (this.editingDomainIndex !== null) {
        this.domainConfigs[this.editingDomainIndex] = newConfig
        this.$emit('saved', `✅ Domain "${newConfig.domain}" updated successfully!`)
      } else {
        this.domainConfigs.push(newConfig)
        this.$emit('saved', `✅ Domain "${newConfig.domain}" added successfully!`)
      }

      this.backToList()
    })
    .catch((error) => {
      this.$emit('saved', `❌ Error saving domain "${newConfig.domain}": ${error.message}`)
    })
    .finally(() => {
      this.isSavingDomain = false
    })
}
```

#### `saveDomainToKV(domainConfig)`

**Purpose**: Saves individual domain configuration to KV store  
**Process**:

1. Converts modal format to KV format
2. Makes API call to save configuration
3. Returns promise for chaining

```javascript
async saveDomainToKV(domainConfig) {
  try {
    console.log('Saving individual domain to KV:', domainConfig.domain)

    // Convert modal format to KV format
    const kvConfig = this.convertModalToKVFormat(domainConfig)

    // Save to KV store via API
    const response = await fetch(apiUrls.saveSiteConfig(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: domainConfig.domain,
        config: kvConfig
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to save domain ${domainConfig.domain} to KV store`)
    }

    const result = await response.json()
    console.log('Domain saved to KV successfully:', result)
    return result
  } catch (error) {
    console.error('Error saving domain to KV:', error)
    throw error
  }
}
```

#### `removeDomain(index)`

**Purpose**: Removes domain from system with infrastructure cleanup  
**Process**:

1. Confirms user intent
2. Calls delete API to remove DNS/worker routes
3. Updates local domain list
4. Shows result feedback

```javascript
async removeDomain(index) {
  const domainConfig = this.domainConfigs[index]
  const domainName = domainConfig.domain

  if (confirm(`Remove "${domainName}"? This will delete DNS, worker routes, and configuration.`)) {
    try {
      const [subdomain, ...rootParts] = domainName.split('.')
      const rootDomain = rootParts.join('.')

      const response = await fetch('https://api.vegvisr.org/delete-custom-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, rootDomain })
      })

      const result = await response.json()
      if (response.ok && result.overallSuccess) {
        this.domainConfigs.splice(index, 1)
        alert('✅ Domain successfully removed!')
      } else {
        // Handle partial success/failure
        this.handlePartialDomainDeletion(result, domainName, index)
      }
    } catch (error) {
      alert(`❌ Error removing domain: ${error.message}`)
    }
  }
}
```

### Validation System

#### `validateDomain()`

Validates domain format and converts to lowercase.

```javascript
validateDomain() {
  this.domainError = ''
  if (this.formData.domain) {
    this.formData.domain = this.formData.domain.toLowerCase()
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
    if (!domainRegex.test(this.formData.domain)) {
      this.domainError = 'Please enter a valid domain name'
    }
  }
}
```

#### `validateLogo()`

Validates logo URL format.

```javascript
validateLogo() {
  this.logoError = ''
  try {
    if (this.formData.logo) {
      new URL(this.formData.logo)
    }
  } catch (error) {
    this.logoError = 'Please enter a valid URL'
  }
}
```

#### `validateFrontPageGraph()`

**Purpose**: Validates knowledge graph ID for custom front page  
**Features**:

- Debounced validation (500ms)
- Format checking (graph_XXXXX pattern)
- Existence verification via API
- Real-time feedback

```javascript
async validateFrontPageGraph() {
  const graphId = this.formData.mySiteFrontPage?.trim()

  // Clear previous state
  this.frontPageError = ''
  this.frontPageValid = false
  this.frontPageGraphTitle = ''

  if (!graphId) return // Empty is valid

  // Format validation
  if (!graphId.startsWith('graph_') || graphId.length < 15) {
    this.frontPageError = 'Graph ID must start with "graph_" and be at least 15 characters'
    return
  }

  // Debounced API validation
  clearTimeout(this.frontPageValidationTimeout)
  this.frontPageValidationTimeout = setTimeout(async () => {
    try {
      const response = await fetch(`https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraph?id=${graphId}`)

      if (response.ok) {
        const graphData = await response.json()
        this.frontPageValid = true
        this.frontPageGraphTitle = graphData.metadata?.title || 'Unknown Title'
      } else if (response.status === 404) {
        this.frontPageError = 'Graph not found. Please check the ID or select from dropdown.'
      } else {
        this.frontPageError = 'Unable to validate graph. Please try again.'
      }
    } catch (error) {
      this.frontPageError = 'Network error while validating graph.'
    }
  }, 500)
}
```

### Logo Management

#### `handleLogoUpload(event)`

**Purpose**: Handles file upload for logo images  
**Process**:

1. Validates file type
2. Uploads to R2 storage via API
3. Updates form with returned URL

```javascript
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
      body: formData
    })

    if (!response.ok) throw new Error('Upload failed')

    const data = await response.json()
    this.formData.logo = data.url
    this.logoError = ''
  } catch (error) {
    alert('Failed to upload logo image. Please try again.')
  } finally {
    this.isUploadingLogo = false
    event.target.value = ''
  }
}
```

#### `openAILogoModal()` / `closeAILogoModal()`

Controls AI logo generation modal.

#### `handleAILogoGenerated(imageData)`

**Purpose**: Processes AI-generated logo data  
**Supports**: Multiple image data formats (URL string, object with info, etc.)

```javascript
handleAILogoGenerated(imageData) {
  try {
    let imageUrl = null

    if (typeof imageData === 'string' && imageData.startsWith('http')) {
      imageUrl = imageData
    } else if (typeof imageData === 'object') {
      // Extract URL from markdown format or label
      const match = imageData.info?.match(/!\[.*?\]\((.+?)\)/)
      imageUrl = match ? match[1] : null
    }

    if (imageUrl) {
      this.formData.logo = imageUrl
      this.logoError = ''
      this.closeAILogoModal()
      this.$emit('saved', '✅ AI logo generated successfully!')
    } else {
      this.logoError = 'Failed to extract image URL from generated logo'
    }
  } catch (error) {
    this.logoError = 'Failed to process AI generated logo'
  }
}
```

### Content Filtering System

#### `fetchMetaAreas()`

**Purpose**: Loads all meta areas from system-wide knowledge graphs  
**Process**:

1. Fetches all graphs without hostname filtering
2. Extracts meta areas from each graph
3. Updates portfolio store with comprehensive list

```javascript
async fetchMetaAreas() {
  try {
    const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs', {
      headers: { 'Content-Type': 'application/json' }
      // No x-original-hostname to bypass content filtering
    })

    if (response.ok) {
      const data = await response.json()
      const metaAreasSet = new Set()

      for (const graph of data.results) {
        const graphResponse = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${graph.id}`)
        if (graphResponse.ok) {
          const graphData = await graphResponse.json()
          const metaAreaString = graphData.metadata?.metaArea || ''

          // Parse and collect meta areas
          const metaAreas = metaAreaString.split('#')
            .map(area => area.trim())
            .filter(area => area.length > 0)

          metaAreas.forEach(area => metaAreasSet.add(area))
        }
      }

      const allMetaAreas = Array.from(metaAreasSet).sort()
      this.portfolioStore.setAllMetaAreas(allMetaAreas)
    }
  } catch (error) {
    console.error('Error fetching system meta areas:', error)
  }
}
```

#### Meta Area Selection Methods

```javascript
// Input handling with autocomplete
onMetaAreaInput() {
  const value = this.metaAreaInput || ''
  const match = value.match(/#([\w-]*)$/)
  if (match) {
    const search = match[1].toLowerCase()
    this.filteredSuggestions = this.availableCategories
      .map(cat => cat.value)
      .filter(area => area.toLowerCase().includes(search))
    this.showSuggestions = this.filteredSuggestions.length > 0
    this.suggestionIndex = 0
  } else {
    this.showSuggestions = false
  }
}

// Suggestion selection
selectSuggestion(idx = this.suggestionIndex) {
  if (!this.showSuggestions || !this.filteredSuggestions.length) return

  const selectedArea = this.filteredSuggestions[idx]
  if (selectedArea && !this.formData.selectedCategories.includes(selectedArea)) {
    this.formData.selectedCategories.push(selectedArea)
  }
  this.showSuggestions = false
}

// Keyboard navigation
moveSuggestion(dir) {
  if (!this.showSuggestions) return
  this.suggestionIndex = (this.suggestionIndex + dir + this.filteredSuggestions.length) % this.filteredSuggestions.length
}
```

### Domain Testing and Deployment

#### `testDomainSetup()`

**Purpose**: Tests and creates domain infrastructure  
**Features**:

- DNS record creation
- Worker route setup
- Comprehensive error handling
- Conflict resolution

```javascript
async testDomainSetup() {
  this.isTestingDomain = true
  this.domainTestResult = null

  try {
    const [subdomain, ...rootParts] = this.formData.domain.split('.')
    const rootDomain = rootParts.join('.')

    const response = await fetch('https://api.vegvisr.org/create-custom-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain, rootDomain })
    })

    const result = await response.json()

    if (response.ok && result.overallSuccess) {
      this.domainTestResult = {
        success: true,
        message: `✅ Domain ${this.formData.domain} configured successfully!`
      }
    } else {
      this.domainTestResult = {
        success: false,
        message: `❌ Error: ${this.extractErrorMessage(result)}`
      }
    }
  } catch (error) {
    this.domainTestResult = {
      success: false,
      message: `❌ Error: ${error.message}`
    }
  } finally {
    this.isTestingDomain = false
  }
}
```

#### `deleteExistingDomain()`

Handles domain conflicts by deleting existing infrastructure before retry.

### Menu Template System

#### `fetchMenuTemplates()`

Loads available menu templates from menu-worker.

```javascript
async fetchMenuTemplates() {
  try {
    await this.menuTemplateStore.fetchMenuTemplates('top')
    this.availableMenuTemplates = this.menuTemplateStore.menuTemplates
    console.log('Fetched menu templates:', this.availableMenuTemplates.length)
  } catch (error) {
    console.error('Error fetching menu templates:', error)
  }
}
```

#### `applyMenuTemplate()`

**Purpose**: Applies selected template to current configuration  
**Process**:

1. Finds template by ID
2. Stores full template data
3. Updates visible items for backward compatibility

```javascript
applyMenuTemplate() {
  if (!this.formData.menuConfig.selectedTemplate) {
    this.formData.menuConfig.templateData = null
    return
  }

  const template = this.availableMenuTemplates.find(
    t => t.id === this.formData.menuConfig.selectedTemplate
  )

  if (template) {
    this.formData.menuConfig.templateData = template.menu_data

    // Update visible items for backward compatibility
    if (template.menu_data?.items) {
      this.formData.menuConfig.visibleItems = template.menu_data.items.map(item => item.id)
    }
  }
}
```

#### Menu Template Creator Integration

```javascript
openMenuTemplateCreator() {
  // Find selected template for editing
  if (this.formData.menuConfig.selectedTemplate) {
    this.selectedMenuTemplate = this.availableMenuTemplates.find(
      t => t.id === this.formData.menuConfig.selectedTemplate
    )
  } else {
    this.selectedMenuTemplate = null // Create new
  }
  this.isMenuTemplateCreatorOpen = true
}

handleMenuTemplateSaved(template) {
  const wasEditing = this.selectedMenuTemplate !== null
  const savedTemplateId = template.id

  this.refreshMenuTemplates()

  // Maintain selection after save
  if (wasEditing && savedTemplateId) {
    this.formData.menuConfig.selectedTemplate = savedTemplateId
  }
}
```

### Data Persistence

#### `saveAllDomains()`

**Purpose**: Updates user profile with domain list (optimized for bulk operations)  
**Process**:

1. Fetches current user data
2. Updates user profile with domain configurations list
3. Maintains backward compatibility
4. **Note**: Individual domain KV saves are handled by `saveDomainToKV()` immediately when domains are added/edited

```javascript
async saveAllDomains() {
  // NOTE: This method now focuses on updating user profile only.
  // Individual domain KV configurations are saved immediately via saveDomainToKV()
  // when each domain is added/edited, eliminating the need to iterate through all domains.

  this.isSaving = true

  try {
    // Get current user data for preservation
    const currentResponse = await fetch(apiUrls.getUserData(this.userStore.email))
    let currentData = {}
    if (currentResponse.ok) {
      currentData = await currentResponse.json()
    }

    const payload = {
      email: this.userStore.email,
      bio: currentData.bio || '',
      profileimage: currentData.profileimage || '',
      data: {
        ...currentData.data,
        domainConfigs: this.domainConfigs, // New multi-domain structure
        // Legacy branding for backward compatibility
        branding: this.domainConfigs.length > 0 ? {
          mySite: this.domainConfigs[0].domain,
          myLogo: this.domainConfigs[0].logo,
          mySiteFrontPage: this.domainConfigs[0].mySiteFrontPage || '',
        } : {},
      },
    }

    const response = await fetch(apiUrls.updateUserData(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) throw new Error('Failed to save domain configurations')

    this.$emit('saved', 'All domain configurations saved successfully!', this.domainConfigs)
    this.closeModal()
  } catch (error) {
    this.$emit('saved', `Error: ${error.message}`)
  } finally {
    this.isSaving = false
  }
}
```

### Utility Methods

#### `convertModalToKVFormat(domainConfig)`

Converts domain configuration from modal format to KV storage format.

```javascript
convertModalToKVFormat(domainConfig) {
  return {
    owner: this.userStore.email,
    domain: domainConfig.domain,
    logo: domainConfig.logo || '',
    site_title: this.getDomainTitleFromConfig(domainConfig),
    content_filter: domainConfig.contentFilter,
    selected_categories: domainConfig.selectedCategories || [],
    front_page_graph: domainConfig.mySiteFrontPage || '',
    menu_config: domainConfig.menuConfig || {
      enabled: false,
      selectedTemplate: '',
      visibleItems: [],
      templateData: null
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}
```

#### `convertKVToModalFormat(siteConfig)`

Converts domain configuration from KV storage format to modal format.

```javascript
convertKVToModalFormat(siteConfig) {
  return {
    domain: siteConfig.domain,
    logo: siteConfig.branding?.myLogo || siteConfig.logo || '',
    contentFilter: siteConfig.branding?.contentFilter || siteConfig.content_filter || 'none',
    selectedCategories: siteConfig.branding?.selectedCategories || siteConfig.selected_categories || [],
    mySiteFrontPage: siteConfig.branding?.mySiteFrontPage || siteConfig.front_page_graph || '',
    menuConfig: siteConfig.menuConfig || siteConfig.menu_config || {
      enabled: false,
      selectedTemplate: '',
      visibleItems: [/* default items */],
      templateData: null
    }
  }
}
```

#### `getDomainTitleFromConfig(domainConfig)`

Generates display title from domain configuration.

```javascript
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
  return subdomain !== 'www' ?
    subdomain.charAt(0).toUpperCase() + subdomain.slice(1) :
    parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
}
```

#### `formatMetaAreaLabel(metaArea)`

Converts camelCase meta areas to readable labels.

```javascript
formatMetaAreaLabel(metaArea) {
  return metaArea
    .split(/(?=[A-Z])/)
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
```

#### `isMainDomain(domain)`

Determines if domain is a main domain vs subdomain.

```javascript
isMainDomain(domain) {
  if (!domain) return false
  const parts = domain.split('.')
  return parts.length === 2 || (parts.length === 3 && parts[0] === 'www')
}
```

## Child Components

### AIImageModal Integration

**Purpose**: AI-powered logo generation  
**Props**:

- `isOpen`: Modal visibility
- `graphContext`: Logo generation context with domain info

**Events**:

- `close`: Modal closed
- `image-inserted`: Logo generated and ready

**Usage**:

```vue
<AIImageModal
  :isOpen="isAILogoModalOpen"
  :graphContext="{ type: 'logo', domain: formData.domain }"
  @close="closeAILogoModal"
  @image-inserted="handleAILogoGenerated"
/>
```

### AdminDomainModal Integration

**Purpose**: Superadmin domain management  
**Access**: Restricted to Superadmin role  
**Features**: System-wide domain overview, transfer capabilities

**Events**:

- `close`: Modal closed
- `domain-updated`: Domain configurations changed

**Usage**:

```vue
<AdminDomainModal
  :is-visible="isAdminDomainModalOpen"
  @close="closeAdminDomainModal"
  @domain-updated="handleDomainUpdated"
/>
```

### MenuTemplateCreator Integration

**Purpose**: Menu template creation and editing  
**Access**: Superadmin only  
**Features**: Template design, item configuration, preview

**Props**:

- `template`: Template to edit (null for new template)

**Events**:

- `close`: Modal closed
- `saved`: Template saved

**Usage**:

```vue
<MenuTemplateCreator
  v-if="isMenuTemplateCreatorOpen"
  :template="selectedMenuTemplate"
  @close="closeMenuTemplateCreator"
  @saved="handleMenuTemplateSaved"
/>
```

## Event System

### Internal Events

1. **Modal Control**: `handleOverlayClick`, `handleKeydown`
2. **Form Validation**: `@input` events on form fields
3. **File Upload**: `@change` on file input
4. **Template Selection**: `@change` on template dropdown

### External Events

1. **Save Events**: Emitted to parent with success/error messages
2. **Close Events**: Modal lifecycle management
3. **Child Component Events**: Logo generation, admin actions, template management

### Event Flow

```
User Action → Method Call → State Update → UI Update → Event Emission
```

Example:

```
Logo Upload → handleLogoUpload() → formData.logo update → Preview refresh → No emission (internal)
Save All → saveAllDomains() → API call → Success → emit('saved', message, configs)
```

## Lifecycle Management

### Component Lifecycle

#### `mounted()`

**Purpose**: Initializes component when first displayed  
**Actions**:

- Loads existing domain configurations
- Fetches system meta areas
- Loads user graphs for front page selection
- Fetches menu templates
- Sets up keyboard event handling

```javascript
mounted() {
  this.loadExistingDomainConfigs()
  this.fetchDomainConfigsFromKV()
  this.fetchMetaAreas()
  this.loadUserGraphs()
  this.fetchMenuTemplates()

  // Set up keyboard handling
  if (this.isOpen) {
    this.$nextTick(() => {
      const modalOverlay = this.$el
      if (modalOverlay) {
        modalOverlay.setAttribute('tabindex', '0')
        modalOverlay.focus()
      }
    })
  }
}
```

#### `beforeUnmount()`

**Purpose**: Cleanup before component destruction  
**Actions**:

- Clears validation timeouts
- Prevents memory leaks

```javascript
beforeUnmount() {
  if (this.frontPageValidationTimeout) {
    clearTimeout(this.frontPageValidationTimeout)
  }
}
```

### Watchers

#### `existingDomainConfigs` Watcher

Responds to prop changes for domain configurations.

```javascript
watch: {
  existingDomainConfigs: {
    handler(newConfigs) {
      this.domainConfigs = [...newConfigs]
    },
    immediate: true,
  }
}
```

#### `isOpen` Watcher

Handles modal open/close lifecycle.

```javascript
isOpen: {
  handler(newValue) {
    if (newValue) {
      this.fetchDomainConfigsFromKV()
      this.fetchMetaAreas()
      this.$nextTick(() => {
        // Focus management for accessibility
        const modalOverlay = this.$el
        if (modalOverlay) {
          modalOverlay.setAttribute('tabindex', '0')
          modalOverlay.focus()
        }
      })
    }
  },
  immediate: false,
}
```

## State Management

### View State Management

The component uses a view mode system:

- **'list'**: Domain overview and management
- **'edit'**: Domain configuration form

State transitions:

```
Initial → 'list'
'list' + Add New → 'edit' (editingDomainIndex = null)
'list' + Edit → 'edit' (editingDomainIndex = index)
'edit' + Save → 'list'
'edit' + Cancel → 'list'
```

### Form State Management

Form data is isolated and validated independently:

- **Validation**: Real-time with error display
- **Reset**: `clearFormData()` method
- **Persistence**: Only on explicit save

### Loading States

Multiple loading states for better UX:

- `isSaving`: Overall save operation (bulk domain profile updates)
- `isSavingDomain`: Individual domain save operation
- `isTestingDomain`: Domain setup testing
- `isUploadingLogo`: Logo file upload
- `isDeletingExisting`: Domain deletion

## Development Guidelines

### Adding New Domain Validation

1. **Create validation method**:

```javascript
validateNewField() {
  this.newFieldError = ''
  // Validation logic
  if (!isValid) {
    this.newFieldError = 'Error message'
  }
}
```

2. **Add to form validation**:

```javascript
canSaveDomain() {
  return this.formData.domain &&
         !this.domainError &&
         !this.newFieldError && // Add here
         (this.formData.logo ? !this.logoError : true)
}
```

3. **Add UI elements**:

```vue
<input @input="validateNewField" />
<div v-if="newFieldError" class="error-message">{{ newFieldError }}</div>
```

### Adding New Child Components

1. **Import component**:

```javascript
import NewChildModal from './NewChildModal.vue'
```

2. **Register in components**:

```javascript
components: {
  AIImageModal,
  AdminDomainModal,
  MenuTemplateCreator,
  NewChildModal, // Add here
}
```

3. **Add state management**:

```javascript
data() {
  return {
    isNewChildModalOpen: false,
    // other state
  }
}
```

4. **Add template usage**:

```vue
<NewChildModal
  :is-open="isNewChildModalOpen"
  @close="closeNewChildModal"
  @action="handleNewChildAction"
/>
```

### Performance Considerations

1. **Debounced Validation**: Use for expensive operations (API calls)
2. **Lazy Loading**: Child components use `v-if` instead of `v-show`
3. **Event Cleanup**: Always clear timeouts in `beforeUnmount`
4. **Large Data**: Consider pagination for many domains

### Error Handling Patterns

```javascript
async apiMethod() {
  try {
    // API call
    const response = await fetch(url, options)
    if (!response.ok) throw new Error('API error')

    // Success handling
    this.successState = true
  } catch (error) {
    console.error('Method failed:', error)
    this.errorMessage = error.message
    // User feedback
    this.$emit('saved', `Error: ${error.message}`)
  } finally {
    // Cleanup
    this.loadingState = false
  }
}
```

## Code Structure Analysis

### Component Organization

The component follows a logical structure:

1. **Template Section** (Lines 1-657)

   - Modal structure and overlay
   - Two main views: list and edit
   - Child component integrations

2. **Script Section** (Lines 658-2006)

   - Imports and setup
   - Data and computed properties
   - Method definitions
   - Lifecycle hooks

3. **Style Section** (Lines 2007-2929)
   - Scoped CSS
   - Responsive design
   - Component-specific styling

### Method Organization

Methods are logically grouped:

1. **Modal Management**: Event handlers, lifecycle
2. **Domain CRUD**: Create, read, update, delete operations
3. **Validation**: Form field validation methods
4. **Logo Management**: Upload, AI generation, preview
5. **Content Filtering**: Meta area selection and management
6. **Menu Templates**: Template selection and configuration
7. **API Integration**: External service communication
8. **Utility Functions**: Helper methods and formatters

### Best Practices Implemented

1. **Separation of Concerns**: Each method has a single responsibility
2. **Error Handling**: Comprehensive try-catch with user feedback
3. **Accessibility**: Keyboard navigation and focus management
4. **Responsive Design**: Mobile-friendly UI components
5. **State Management**: Clear state transitions and validation
6. **Code Documentation**: Extensive console logging for debugging
7. **Memory Management**: Proper cleanup of timeouts and resources

### Areas for Improvement

1. **Component Size**: Consider splitting into smaller components
2. **Type Safety**: Add TypeScript for better type checking
3. **Testing**: Add unit tests for critical methods
4. **Performance**: ✅ **OPTIMIZED** - Individual domain saves now prevent bulk iteration
5. **Accessibility**: Add ARIA labels and screen reader support

### Recent Optimizations

**Individual Domain Persistence (2025-08-07)**:

- ✅ **Added `saveDomainToKV()`** - Individual domain KV persistence
- ✅ **Optimized `saveDomain()`** - Immediate KV save with loading states
- ✅ **Streamlined `saveAllDomains()`** - Focus on user profile updates only
- ✅ **Enhanced UX** - Real-time feedback and loading indicators
- ✅ **Eliminated bulk iteration** - No longer processes all domains for single changes

## Conclusion

The BrandingModal.vue component is a sophisticated piece of software that demonstrates advanced Vue.js patterns and comprehensive feature implementation. Its modular method organization, robust error handling, and extensive validation system make it a reliable foundation for domain management in the Vegvisr system.

**Recent optimizations have significantly improved performance** by implementing individual domain persistence, eliminating the need to iterate through all domains when saving single domain changes. This provides immediate feedback and better user experience.

For developers working with this component, understanding its state management patterns, validation system, and child component integrations is crucial for successful modification and extension.

---

**Last Updated**: August 7, 2025  
**Component Version**: Lines 1-3043 (Optimized)  
**Dependencies**: Vue 3, Pinia, Cloudflare Workers API  
**Rollback ID**: BRANDING-MODAL-OPTIMIZATION-2025-08-07-002
