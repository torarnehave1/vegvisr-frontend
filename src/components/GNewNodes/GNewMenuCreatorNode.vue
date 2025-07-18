<template>
  <div class="gnew-menu-creator-node">
    <!-- PUBLIC MODE: Show only hamburger menu for non-logged-in users -->
    <div
      v-if="!showControls && menuData.items && menuData.items.length > 0"
      class="public-hamburger-menu"
    >
      <div class="hamburger-container">
        <button class="hamburger-btn" @click="toggleMenu" :class="{ active: isMenuOpen }">
          <i class="fas fa-bars"></i>
        </button>

        <!-- Dropdown menu -->
        <div v-if="isMenuOpen" class="menu-dropdown">
          <div v-for="(item, index) in menuData.items" :key="index" class="menu-dropdown-item">
            <a v-if="item.type === 'route'" :href="item.path || item.url" class="menu-link">
              <span class="menu-icon">{{ item.icon || '📄' }}</span>
              {{ item.label }}
            </a>
            <a
              v-else-if="item.type === 'external'"
              :href="item.url || item.path"
              target="_blank"
              class="menu-link"
            >
              <span class="menu-icon">{{ item.icon || '📄' }}</span>
              {{ item.label }}
            </a>
            <button v-else @click="handleMenuItemClick(item)" class="menu-link">
              <span class="menu-icon">{{ item.icon || '📄' }}</span>
              {{ item.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ADMIN MODE: Show full creation interface for logged-in users -->
    <div v-else-if="showControls" class="admin-menu">
      <div class="node-header">
        <h4 class="node-title">
          <i class="fas fa-bars"></i>
          {{ node.label || 'Menu Creator' }}
        </h4>
        <div class="node-controls">
          <button
            class="btn btn-sm btn-outline-primary"
            @click="openMenuTemplateCreator"
            title="Open Menu Template Creator"
          >
            <i class="fas fa-plus"></i>
          </button>
          <button
            class="btn btn-sm btn-outline-secondary"
            @click="toggleJsonEditor"
            title="Toggle JSON Editor"
          >
            <i class="fas fa-code"></i>
          </button>
          <button
            class="btn btn-sm btn-outline-success"
            @click="saveMenuTemplate"
            :disabled="!isValidMenuData || isSaving"
            title="Save Menu Template"
          >
            <i v-if="isSaving" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-save"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" @click="editNode" title="Edit Node">
            <i class="fas fa-edit"></i>
          </button>
        </div>

        <div class="node-content">
          <!-- Menu Template Information -->
          <div v-if="menuData.name" class="menu-info">
            <div class="info-item"><strong>Name:</strong> {{ menuData.name }}</div>
            <div class="info-item">
              <strong>Level:</strong>
              <span
                class="badge"
                :class="menuData.menuLevel === 'graph' ? 'badge-primary' : 'badge-secondary'"
              >
                {{ (menuData.menuLevel || 'graph') === 'graph' ? 'GRAPH MENU' : 'TOP MENU' }}
              </span>
            </div>
            <div class="info-item"><strong>Items:</strong> {{ menuData.items?.length || 0 }}</div>
            <div v-if="menuData.description" class="info-item">
              <strong>Description:</strong> {{ menuData.description }}
            </div>
          </div>

          <!-- Menu Items Preview -->
          <div v-if="menuData.items && menuData.items.length > 0" class="menu-preview">
            <h5>Menu Items Preview</h5>
            <div class="preview-items">
              <div v-for="(item, index) in menuData.items" :key="index" class="preview-item">
                <span class="item-icon">{{ item.icon || '📄' }}</span>
                <span class="item-label">{{ item.label }}</span>
                <span class="item-type">{{ item.type }}</span>
                <span v-if="item.requiresRole" class="item-badge">
                  {{
                    Array.isArray(item.requiresRole)
                      ? item.requiresRole.join(', ')
                      : item.requiresRole
                  }}
                </span>
              </div>
            </div>
          </div>

          <!-- JSON Editor -->
          <div v-if="showJsonEditor" class="json-editor">
            <h5>JSON Configuration</h5>
            <textarea
              v-model="jsonData"
              class="json-textarea"
              placeholder="Enter menu configuration JSON..."
              @input="validateJsonData"
            />
            <div v-if="jsonError" class="json-error">
              <i class="fas fa-exclamation-triangle"></i>
              {{ jsonError }}
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="quick-actions">
            <button
              class="btn btn-sm btn-outline-primary"
              @click="loadDefaultTemplate"
              title="Load Default Template"
            >
              <i class="fas fa-file-import"></i> Load Default
            </button>
            <button class="btn btn-sm btn-outline-info" @click="previewMenu" title="Preview Menu">
              <i class="fas fa-eye"></i> Preview
            </button>
            <button class="btn btn-sm btn-outline-warning" @click="exportJson" title="Export JSON">
              <i class="fas fa-download"></i> Export
            </button>
            <button
              class="btn btn-sm btn-outline-success"
              @click="generateSmartMenu"
              :disabled="isGeneratingMenu"
              title="Generate Smart Menu with AI"
            >
              <i v-if="isGeneratingMenu" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-brain"></i>
              🤖 Smart Menu
            </button>
          </div>

          <!-- Status Messages -->
          <div v-if="statusMessage" class="status-message" :class="statusMessageType">
            <i class="fas" :class="statusMessageIcon"></i>
            {{ statusMessage }}
          </div>
        </div>

        <!-- Menu Template Creator Modal -->
        <MenuTemplateCreator
          v-if="isMenuTemplateCreatorOpen"
          :template="currentTemplate"
          @close="closeMenuTemplateCreator"
          @saved="handleMenuTemplateSaved"
        />

        <!-- AI Menu Suggestions Modal -->
        <div v-if="showAiSuggestions" class="ai-suggestions-modal">
          <div class="modal-backdrop" @click="closeAiSuggestions"></div>
          <div class="modal-content">
            <div class="modal-header">
              <h4>🤖 AI Menu Suggestions</h4>
              <button class="btn-close" @click="closeAiSuggestions">×</button>
            </div>
            <div class="modal-body">
              <div v-if="isGeneratingMenu" class="generating-state">
                <div class="spinner-container">
                  <i class="fas fa-spinner fa-spin"></i>
                  <p>Analyzing graph content and generating smart menu suggestions...</p>
                </div>
              </div>
              <div v-else-if="aiSuggestions" class="suggestions-content">
                <!-- Menu Suggestion -->
                <div class="suggestion-section">
                  <h5>📋 Suggested Menu Structure</h5>
                  <div class="menu-suggestion">
                    <div class="suggestion-header">
                      <strong>{{ aiSuggestions.menuSuggestion.name }}</strong>
                      <p class="suggestion-description">
                        {{ aiSuggestions.menuSuggestion.description }}
                      </p>
                    </div>
                    <div class="menu-items-preview">
                      <div
                        v-for="item in aiSuggestions.menuSuggestion.items"
                        :key="item.id"
                        class="menu-item-suggestion"
                      >
                        <span class="item-icon">{{ item.icon }}</span>
                        <span class="item-label">{{ item.label }}</span>
                        <span class="item-type">{{ item.type }}</span>
                        <div class="item-description">{{ item.description }}</div>
                      </div>
                    </div>
                    <div class="suggestion-actions">
                      <button class="btn btn-sm btn-success" @click="applySuggestedMenu">
                        <i class="fas fa-check"></i> Apply This Menu
                      </button>
                      <button class="btn btn-sm btn-outline-secondary" @click="customizeMenu">
                        <i class="fas fa-edit"></i> Customize
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Page Recommendations -->
                <div
                  v-if="
                    aiSuggestions.pageRecommendations &&
                    aiSuggestions.pageRecommendations.length > 0
                  "
                  class="suggestion-section"
                >
                  <h5>💡 Recommended Additional Pages</h5>
                  <div class="page-recommendations">
                    <div
                      v-for="(rec, index) in aiSuggestions.pageRecommendations"
                      :key="index"
                      class="page-recommendation"
                    >
                      <div class="rec-header">
                        <strong>{{ rec.title }}</strong>
                        <span class="priority-badge" :class="rec.priority">{{ rec.priority }}</span>
                      </div>
                      <p class="rec-description">{{ rec.description }}</p>
                      <div class="rec-details">
                        <small><strong>Content:</strong> {{ rec.estimatedContent }}</small>
                        <small><strong>Target:</strong> {{ rec.targetAudience }}</small>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Audience Insights -->
                <div v-if="aiSuggestions.audienceInsights" class="suggestion-section">
                  <h5>👥 Audience Insights</h5>
                  <div class="audience-insights">
                    <div class="insight-item">
                      <strong>Primary Audience:</strong>
                      {{ aiSuggestions.audienceInsights.primaryAudience }}
                    </div>
                    <div class="insight-item">
                      <strong>Content Complexity:</strong>
                      {{ aiSuggestions.audienceInsights.contentComplexity }}
                    </div>
                    <div class="insight-item">
                      <strong>Navigation Flow:</strong>
                      {{ aiSuggestions.audienceInsights.suggestedNavigationFlow }}
                    </div>
                  </div>
                </div>
              </div>
              <div v-else-if="aiError" class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>{{ aiError }}</p>
                <button class="btn btn-outline-primary" @click="generateSmartMenu">
                  <i class="fas fa-retry"></i> Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PUBLIC FALLBACK: Show message when no menu items are available -->
    <div v-else class="public-fallback">
      <div class="fallback-content">
        <i class="fas fa-bars text-muted"></i>
        <p class="text-muted">Menu not configured</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useMenuTemplateStore } from '@/stores/menuTemplateStore'
import { useUserStore } from '@/stores/userStore'
import MenuTemplateCreator from '@/components/MenuTemplateCreator.vue'

// Props (same pattern as other GNew nodes)
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
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] }),
  },
})

// Emits (same pattern as other GNew nodes)
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created', 'template-requested'])

// Stores
const menuTemplateStore = useMenuTemplateStore()
const userStore = useUserStore()

// State
const showJsonEditor = ref(false)
const jsonData = ref('')
const jsonError = ref('')
const isSaving = ref(false)
const isMenuTemplateCreatorOpen = ref(false)
const currentTemplate = ref(null)
const statusMessage = ref('')
const statusMessageType = ref('')
const statusMessageIcon = ref('')
const isMenuOpen = ref(false)

// AI Menu Generation State
const showAiSuggestions = ref(false)
const isGeneratingMenu = ref(false)
const aiSuggestions = ref(null)
const aiError = ref('')

// Computed properties
const menuData = computed(() => {
  try {
    return JSON.parse(props.node.info || '{}')
  } catch {
    return {
      name: '',
      description: '',
      menuLevel: 'graph',
      items: [],
      style: {
        layout: 'horizontal',
        theme: 'default',
        position: 'top',
        buttonStyle: 'hamburger',
      },
    }
  }
})

const isValidMenuData = computed(() => {
  if (showJsonEditor.value) {
    return !jsonError.value && jsonData.value.trim() !== ''
  }
  return menuData.value.name && menuData.value.items && menuData.value.items.length > 0
})

// Methods
const toggleJsonEditor = () => {
  showJsonEditor.value = !showJsonEditor.value
  if (showJsonEditor.value) {
    jsonData.value = JSON.stringify(menuData.value, null, 2)
  }
}

const validateJsonData = () => {
  try {
    JSON.parse(jsonData.value)
    jsonError.value = ''
  } catch (error) {
    jsonError.value = 'Invalid JSON format: ' + error.message
  }
}

const loadDefaultTemplate = () => {
  const defaultTemplate = {
    name: 'New Menu Template',
    description: 'A new menu template created from the graph',
    menuLevel: 'graph',
    items: [
      {
        id: 'home',
        label: 'Home',
        icon: '🏠',
        type: 'route',
        path: '/',
        requiresRole: null,
      },
      {
        id: 'portfolio',
        label: 'Portfolio',
        icon: '📁',
        type: 'route',
        path: '/graph-portfolio',
        requiresRole: null,
      },
    ],
    style: {
      layout: 'horizontal',
      theme: 'default',
      position: 'top',
      buttonStyle: 'hamburger',
    },
  }

  updateNodeData(defaultTemplate)
  showStatus('Default template loaded', 'success')
}

const previewMenu = () => {
  if (!isValidMenuData.value) {
    showStatus('Invalid menu data - cannot preview', 'error')
    return
  }

  // Create a temporary menu node for preview
  const previewNode = {
    id: 'preview-menu',
    type: 'menu',
    label: menuData.value.name,
    info: JSON.stringify(menuData.value),
    color: '#e8f4fd',
    visible: true,
    position: { x: 0, y: 0 },
  }

  // Add preview node to graph temporarily
  emit('node-created', previewNode)
  showStatus('Menu preview created', 'success')
}

const exportJson = () => {
  const dataStr = JSON.stringify(menuData.value, null, 2)
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

  const exportFileDefaultName = `menu-template-${menuData.value.name || 'unnamed'}.json`

  const linkElement = document.createElement('a')
  linkElement.setAttribute('href', dataUri)
  linkElement.setAttribute('download', exportFileDefaultName)
  linkElement.click()

  showStatus('JSON exported', 'success')
}

// Public menu methods
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const handleMenuItemClick = (item) => {
  // Close menu after clicking an item
  isMenuOpen.value = false

  switch (item.type) {
    case 'route':
      // For route items, navigate programmatically
      if (item.path) {
        window.location.href = item.path
      }
      break
    case 'external':
      window.open(item.url || item.path, '_blank')
      break
    case 'template-selector':
      insertTemplateNode(item.nodeType)
      break
    case 'button':
      // Handle button click - could emit event or call a method
      if (item.action) {
        console.log('Menu item action:', item.action)
      }
      break
    default:
      console.log('Menu item clicked:', item)
  }
}

const insertTemplateNode = async (nodeType) => {
  console.log('🍔 MenuCreator: Inserting template node:', nodeType)

  try {
    // Fetch template from database
    const response = await fetch('https://knowledge.vegvisr.org/getTemplates')

    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.status}`)
    }

    const data = await response.json()

    if (data.results && Array.isArray(data.results)) {
      // Find template by nodeType
      const template = data.results.find((t) => {
        // Check if any node in the template matches the nodeType
        try {
          const nodes = JSON.parse(t.nodes || '[]')
          return nodes.some((node) => node.type === nodeType)
        } catch {
          return false
        }
      })

      if (template) {
        // Generate UUID for new node
        const generateUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0
            const v = c == 'x' ? r : (r & 0x3) | 0x8
            return v.toString(16)
          })
        }

        // Create node from template
        const templateNodes = JSON.parse(template.nodes || '[]')
        const templateNode =
          templateNodes.find((node) => node.type === nodeType) || templateNodes[0]

        const nodeData = {
          id: generateUUID(),
          label: templateNode.label || template.name || 'New Node',
          color: templateNode.color || '#f9f9f9',
          type: templateNode.type || nodeType,
          info: templateNode.info || '',
          bibl: Array.isArray(templateNode.bibl) ? templateNode.bibl : [],
          imageWidth: templateNode.imageWidth || '100%',
          imageHeight: templateNode.imageHeight || '100%',
          visible: templateNode.visible !== false,
          path: templateNode.path || null,
        }

        console.log('🍔 MenuCreator: Created node from template:', nodeData)

        // Emit the node to be added to the graph
        emit('node-created', nodeData)

        showStatus('Template node inserted successfully', 'success')
      } else {
        console.error('🍔 MenuCreator: Template not found for nodeType:', nodeType)
        showStatus(`Template not found for node type: ${nodeType}`, 'error')
      }
    } else {
      throw new Error('Invalid response format: missing results array')
    }
  } catch (error) {
    console.error('🍔 MenuCreator: Error inserting template node:', error)
    showStatus('Failed to insert template node: ' + error.message, 'error')
  }
}

const saveMenuTemplate = async () => {
  if (!isValidMenuData.value) {
    showStatus('Invalid menu data - cannot save', 'error')
    return
  }

  isSaving.value = true
  try {
    let menuDataToSave = menuData.value

    // If JSON editor is open, use the JSON data
    if (showJsonEditor.value) {
      menuDataToSave = JSON.parse(jsonData.value)
    }

    // Prepare template for saving
    const templateToSave = {
      id: `menu-template-${Date.now()}`,
      name: menuDataToSave.name,
      menu_data: menuDataToSave,
      category: 'Custom',
      menu_level: menuDataToSave.menuLevel || 'graph',
      access_level: 'user',
      created_by: userStore.email || 'system',
    }

    await menuTemplateStore.saveMenuTemplate(templateToSave)
    showStatus('Menu template saved successfully', 'success')
  } catch (error) {
    console.error('Error saving menu template:', error)
    showStatus('Failed to save menu template: ' + error.message, 'error')
  } finally {
    isSaving.value = false
  }
}

const openMenuTemplateCreator = () => {
  // Prepare current data for editing
  currentTemplate.value = {
    name: menuData.value.name || '',
    menu_data: menuData.value,
    category: 'Custom',
    menu_level: menuData.value.menuLevel || 'graph',
    access_level: 'user',
    created_by: userStore.email || 'system',
  }

  isMenuTemplateCreatorOpen.value = true
}

const closeMenuTemplateCreator = () => {
  isMenuTemplateCreatorOpen.value = false
  currentTemplate.value = null
}

const handleMenuTemplateSaved = (template) => {
  console.log('Menu template saved from modal:', template)

  // Update the node with the saved template data
  updateNodeData(template.menu_data)

  showStatus('Menu template saved and node updated', 'success')
}

const updateNodeData = (newData) => {
  const updatedNode = {
    ...props.node,
    info: JSON.stringify(newData),
    label: newData.name || props.node.label,
  }

  emit('node-updated', updatedNode)

  // Update JSON editor if open
  if (showJsonEditor.value) {
    jsonData.value = JSON.stringify(newData, null, 2)
  }
}

const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const showStatus = (message, type) => {
  statusMessage.value = message
  statusMessageType.value = type

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle',
  }

  statusMessageIcon.value = icons[type] || 'fa-info-circle'

  // Clear status after 3 seconds
  setTimeout(() => {
    statusMessage.value = ''
    statusMessageType.value = ''
    statusMessageIcon.value = ''
  }, 3000)
}

// AI Menu Generation Methods
const generateSmartMenu = async () => {
  console.log('🤖 Starting AI menu generation...')

  isGeneratingMenu.value = true
  aiError.value = ''
  aiSuggestions.value = null
  showAiSuggestions.value = true

  try {
    // Prepare graph data for AI analysis
    const graphData = {
      nodes: props.graphData.nodes || [],
      edges: props.graphData.edges || [],
      metadata: props.graphData.metadata || {},
    }

    console.log('Graph data for AI:', {
      nodeCount: graphData.nodes.length,
      hasMetadata: !!graphData.metadata,
      metadata: graphData.metadata,
    })

    const requestPayload = {
      graphData,
      userRequest:
        'Generate a context-aware menu based on the graph content and suggest complementary pages',
      currentMenuData: menuData.value,
    }

    console.log('Sending AI request:', requestPayload)

    const response = await fetch('https://api.vegvisr.org/ai-generate-menu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('AI menu generation result:', result)

    aiSuggestions.value = result
    showStatus('AI menu suggestions generated successfully', 'success')
  } catch (error) {
    console.error('AI menu generation error:', error)
    aiError.value = error.message || 'Failed to generate menu suggestions'
    showStatus('Failed to generate AI menu suggestions', 'error')
  } finally {
    isGeneratingMenu.value = false
  }
}

const closeAiSuggestions = () => {
  showAiSuggestions.value = false
  aiSuggestions.value = null
  aiError.value = ''
}

const applySuggestedMenu = () => {
  if (!aiSuggestions.value?.menuSuggestion) return

  console.log('Applying suggested menu:', aiSuggestions.value.menuSuggestion)

  // Update the node with the suggested menu
  updateNodeData(aiSuggestions.value.menuSuggestion)

  // Close the suggestions modal
  closeAiSuggestions()

  showStatus('AI-generated menu applied successfully', 'success')
}

const customizeMenu = () => {
  if (!aiSuggestions.value?.menuSuggestion) return

  console.log('Customizing suggested menu:', aiSuggestions.value.menuSuggestion)

  // Update the node with the suggested menu
  updateNodeData(aiSuggestions.value.menuSuggestion)

  // Close AI suggestions and open the template creator for customization
  closeAiSuggestions()

  // Prepare the current template for editing
  currentTemplate.value = {
    name: aiSuggestions.value.menuSuggestion.name || 'AI Generated Menu',
    menu_data: aiSuggestions.value.menuSuggestion,
    category: 'AI Generated',
    menu_level: aiSuggestions.value.menuSuggestion.menuLevel || 'graph',
    access_level: 'user',
    created_by: userStore.email || 'system',
  }

  isMenuTemplateCreatorOpen.value = true

  showStatus('AI-generated menu ready for customization', 'info')
}

// Click outside handler for hamburger menu
const handleClickOutside = (event) => {
  const menuContainer = event.target.closest('.public-hamburger-menu')
  if (!menuContainer && isMenuOpen.value) {
    isMenuOpen.value = false
  }
}

// ESC key handler
const handleEscKey = (event) => {
  if (event.key === 'Escape') {
    if (showAiSuggestions.value) {
      closeAiSuggestions()
    } else if (isMenuOpen.value) {
      isMenuOpen.value = false
    }
  }
}

// Lifecycle
onMounted(() => {
  // Initialize JSON editor with current data
  jsonData.value = JSON.stringify(menuData.value, null, 2)

  // Add event listeners for hamburger menu
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  // Clean up event listeners
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscKey)
})

// Watch for changes in node data
watch(
  () => props.node.info,
  (newInfo) => {
    if (showJsonEditor.value) {
      jsonData.value = JSON.stringify(menuData.value, null, 2)
    }
  },
  { deep: true },
)
</script>

<style scoped>
.gnew-menu-creator-node {
  background: #f8f9fa;
  border: 2px solid #007bff;
  border-radius: 12px;
  padding: 1rem;
  margin: 1rem 0;
  min-height: 200px;
}

/* Public Hamburger Menu Styles */
.public-hamburger-menu {
  position: relative;
  display: inline-block;
}

.hamburger-container {
  position: relative;
}

.hamburger-btn {
  background: #007bff;
  border: none;
  color: white;
  padding: 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.hamburger-btn:hover {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.hamburger-btn.active {
  background: #0056b3;
}

.menu-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  z-index: 1000;
  margin-top: 0.5rem;
  overflow: hidden;
}

.menu-dropdown-item {
  border-bottom: 1px solid #f8f9fa;
}

.menu-dropdown-item:last-child {
  border-bottom: none;
}

.menu-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: #495057;
  text-decoration: none;
  background: none;
  border: none;
  width: 100%;
  font-size: 0.9rem;
  transition: background-color 0.2s ease;
  cursor: pointer;
}

.menu-link:hover {
  background: #f8f9fa;
  color: #007bff;
}

.menu-icon {
  font-size: 1rem;
  width: 20px;
  text-align: center;
}

.public-fallback {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
}

.fallback-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.fallback-content i {
  font-size: 2rem;
  opacity: 0.5;
}

.fallback-content p {
  margin: 0;
  font-size: 0.9rem;
}

/* Admin Menu Styles */
.admin-menu {
  /* Keep existing styles */
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.node-title {
  margin: 0;
  color: #007bff;
  font-size: 1.1rem;
  font-weight: 600;
}

.node-title i {
  margin-right: 0.5rem;
}

.node-controls {
  display: flex;
  gap: 0.5rem;
}

.node-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.menu-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
  background: #fff;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-primary {
  background-color: #007bff;
  color: white;
}

.badge-secondary {
  background-color: #6c757d;
  color: white;
}

.menu-preview {
  background: #fff;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.menu-preview h5 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1rem;
}

.preview-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.item-icon {
  font-size: 1.2rem;
  width: 24px;
  text-align: center;
}

.item-label {
  font-weight: 500;
  flex: 1;
}

.item-type {
  background: #e9ecef;
  color: #495057;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.item-badge {
  background: #ffc107;
  color: #212529;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.json-editor {
  background: #fff;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.json-editor h5 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1rem;
}

.json-textarea {
  width: 100%;
  height: 200px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  padding: 0.5rem;
  resize: vertical;
}

.json-error {
  color: #dc3545;
  background: #f8d7da;
  padding: 0.5rem;
  border-radius: 4px;
  margin-top: 0.5rem;
  font-size: 0.875rem;
}

.json-error i {
  margin-right: 0.5rem;
}

.quick-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.status-message {
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.status-message.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.status-message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #b6d4db;
}

.btn {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.2s ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline-primary {
  color: #007bff;
  border-color: #007bff;
  background: transparent;
}

.btn-outline-primary:hover {
  background: #007bff;
  color: white;
}

.btn-outline-secondary {
  color: #6c757d;
  border-color: #6c757d;
  background: transparent;
}

.btn-outline-secondary:hover {
  background: #6c757d;
  color: white;
}

.btn-outline-success {
  color: #28a745;
  border-color: #28a745;
  background: transparent;
}

.btn-outline-success:hover {
  background: #28a745;
  color: white;
}

.btn-outline-danger {
  color: #dc3545;
  border-color: #dc3545;
  background: transparent;
}

.btn-outline-danger:hover {
  background: #dc3545;
  color: white;
}

.btn-outline-info {
  color: #17a2b8;
  border-color: #17a2b8;
  background: transparent;
}

.btn-outline-info:hover {
  background: #17a2b8;
  color: white;
}

.btn-outline-warning {
  color: #ffc107;
  border-color: #ffc107;
  background: transparent;
}

.btn-outline-warning:hover {
  background: #ffc107;
  color: #212529;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.fa-spinner {
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

/* AI Suggestions Modal Styles */
.ai-suggestions-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  z-index: 1000;
}

.modal-content {
  position: relative;
  background: white;
  border-radius: 12px;
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  z-index: 1001;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e9ecef;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px 12px 0 0;
}

.modal-header h4 {
  margin: 0;
  font-size: 1.2rem;
}

.btn-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.modal-body {
  padding: 1.5rem;
}

.generating-state {
  text-align: center;
  padding: 2rem;
}

.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner-container i {
  font-size: 2rem;
  color: #007bff;
}

.suggestion-section {
  margin-bottom: 2rem;
}

.suggestion-section h5 {
  color: #333;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e9ecef;
}

.menu-suggestion {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  background: #f8f9fa;
}

.suggestion-header {
  margin-bottom: 1rem;
}

.suggestion-header strong {
  color: #007bff;
  font-size: 1.1rem;
}

.suggestion-description {
  color: #6c757d;
  margin: 0.5rem 0 0 0;
}

.menu-items-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.menu-item-suggestion {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
}

.item-icon {
  font-size: 1.2rem;
  width: 24px;
  text-align: center;
}

.item-label {
  font-weight: 500;
  flex: 1;
}

.item-type {
  background: #e9ecef;
  color: #495057;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.item-description {
  width: 100%;
  font-size: 0.85rem;
  color: #6c757d;
  margin-top: 0.25rem;
}

.suggestion-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.page-recommendations {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-recommendation {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  background: #f8f9fa;
}

.rec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.rec-header strong {
  color: #007bff;
}

.priority-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.priority-badge.high {
  background: #dc3545;
  color: white;
}

.priority-badge.medium {
  background: #ffc107;
  color: #212529;
}

.priority-badge.low {
  background: #28a745;
  color: white;
}

.rec-description {
  color: #495057;
  margin-bottom: 0.5rem;
}

.rec-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.rec-details small {
  color: #6c757d;
}

.audience-insights {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.insight-item {
  padding: 0.75rem;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}

.insight-item strong {
  color: #495057;
}

.error-state {
  text-align: center;
  padding: 2rem;
  color: #dc3545;
}

.error-state i {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.error-state p {
  margin-bottom: 1rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 90vh;
  }

  .modal-header {
    padding: 1rem;
  }

  .modal-body {
    padding: 1rem;
  }

  .suggestion-actions {
    flex-direction: column;
  }

  .rec-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>
