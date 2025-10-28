<template>
  <Teleport to="body">
    <div v-if="isOpen" class="menu-template-creator-overlay" @click="closeModal">
      <div class="menu-template-creator" @click.stop="closeAllDropdowns">
        <div class="modal-header">
          <h4 class="modal-title">
            <i class="fas fa-bars"></i>
            {{ editingTemplate ? 'Edit Menu Template' : 'Create Menu Template' }}
          </h4>
          <button type="button" class="btn-close" @click="closeModal" aria-label="Close"></button>
        </div>

      <div class="modal-body">
        <!-- Template Basic Info -->
        <div class="form-section">
          <h5>Template Information</h5>
          <div class="row">
            <div class="col-md-6">
              <div class="form-group">
                <label for="templateName">Template Name</label>
                <input
                  id="templateName"
                  v-model="templateData.name"
                  type="text"
                  class="form-control"
                  placeholder="Enter template name"
                  required
                />
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="templateCategory">Category</label>
                <select id="templateCategory" v-model="templateData.category" class="form-control">
                  <option value="General">General</option>
                  <option value="Navigation">Navigation</option>
                  <option value="Admin">Admin</option>
                  <option value="Branding">Branding</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="col-md-6">
              <div class="form-group">
                <label for="menuLevel">Menu Level</label>
                <select id="menuLevel" v-model="templateData.menu_level" class="form-control">
                  <option value="graph">Graph Level</option>
                  <option value="top">Top Level</option>
                </select>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="accessLevel">Access Level</label>
                <select id="accessLevel" v-model="templateData.access_level" class="form-control">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="templateDescription">Description</label>
            <textarea
              id="templateDescription"
              v-model="menuConfig.description"
              class="form-control"
              rows="3"
              placeholder="Describe what this menu template does"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="templateDomain">Domain (Optional)</label>
            <input
              id="templateDomain"
              v-model="templateData.domain"
              type="text"
              class="form-control"
              placeholder="Leave blank for global template"
            />
          </div>
        </div>

        <!-- Menu Configuration -->
        <div class="form-section">
          <h5>Menu Configuration</h5>
          <div class="row">
            <div class="col-md-6">
              <div class="form-group">
                <label for="menuId">Menu ID</label>
                <input
                  id="menuId"
                  v-model="menuConfig.menuId"
                  type="text"
                  class="form-control"
                  placeholder="unique-menu-id"
                  required
                />
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="menuName">Menu Name</label>
                <input
                  id="menuName"
                  v-model="menuConfig.name"
                  type="text"
                  class="form-control"
                  placeholder="Display name for menu"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Menu Style -->
        <div class="form-section">
          <h5>Menu Style</h5>
          <div class="row">
            <div class="col-md-3">
              <div class="form-group">
                <label for="buttonStyle">Button Style</label>
                <select
                  id="buttonStyle"
                  v-model="menuConfig.style.buttonStyle"
                  class="form-control"
                >
                  <option value="hamburger">Hamburger</option>
                  <option value="button">Button</option>
                  <option value="link">Link</option>
                  <option value="icon">Icon</option>
                </select>
              </div>
            </div>
            <div class="col-md-3">
              <div class="form-group">
                <label for="menuLayout">Layout</label>
                <select id="menuLayout" v-model="menuConfig.style.layout" class="form-control">
                  <option value="horizontal">Horizontal</option>
                  <option value="vertical">Vertical</option>
                </select>
              </div>
            </div>
            <div class="col-md-3">
              <div class="form-group">
                <label for="menuTheme">Theme</label>
                <select id="menuTheme" v-model="menuConfig.style.theme" class="form-control">
                  <option value="default">Default</option>
                  <option value="admin">Admin</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
            </div>
            <div class="col-md-3">
              <div class="form-group">
                <label for="menuPosition">Position</label>
                <select id="menuPosition" v-model="menuConfig.style.position" class="form-control">
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Menu Items -->
        <div class="form-section">
          <h5>Menu Items</h5>
          <div class="menu-items-container">
            <div v-for="(item, index) in menuConfig.items" :key="index" class="menu-item-editor">
              <div class="menu-item-header">
                <h6>Item {{ index + 1 }}</h6>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  @click="removeMenuItem(index)"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>

              <div class="row">
                <div class="col-md-4">
                  <div class="form-group">
                    <label>ID</label>
                    <input
                      v-model="item.id"
                      type="text"
                      class="form-control"
                      placeholder="item-id"
                      readonly
                    />
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label>Label</label>
                    <input
                      v-model="item.label"
                      type="text"
                      class="form-control"
                      placeholder="Display text"
                    />
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label>Type</label>
                    <select v-model="item.type" class="form-control" @change="onMenuItemTypeChange(item)">
                      <option value="route">Route</option>
                      <option value="graph-link">Graph Link</option>
                      <option value="external">External Link</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Graph Link Type -->
              <div v-if="item.type === 'graph-link'" class="graph-link-section">
                <div class="form-group">
                  <label>Select Graph</label>
                  <div class="graph-search-container" @click.stop>
                    <!-- Show loading state -->
                    <div v-if="loadingGraphs" class="loading-message">
                      <i class="fas fa-spinner fa-spin"></i> Loading graphs...
                    </div>

                    <!-- Show message if no graphs available -->
                    <div v-else-if="availableGraphs.length === 0" class="no-graphs-message">
                      <i class="fas fa-info-circle"></i> No graphs available
                    </div>

                    <!-- Graph selection interface -->
                    <template v-else>
                      <input
                        v-model="item.graphSearchQuery"
                        type="text"
                        class="form-control"
                        placeholder="🔍 Search by title, description, category, or #metaArea..."
                        @input="onGraphSearch(item)"
                        @focus="item.showGraphDropdown = true"
                      />

                      <!-- Graph Dropdown - Always show when no graph selected and not loading -->
                      <div v-if="!item.selectedGraph && item.showGraphDropdown && filteredGraphs(item).length > 0" class="graph-dropdown">
                        <div class="dropdown-header">
                          <strong>{{ filteredGraphs(item).length }} graph{{ filteredGraphs(item).length !== 1 ? 's' : '' }} available</strong>
                        </div>
                        <div
                          v-for="graph in filteredGraphs(item)"
                          :key="graph.id"
                          class="graph-option"
                          @click="selectGraph(item, graph)"
                        >
                          <div class="graph-option-header">
                            <strong>{{ graph.title }}</strong>
                            <span v-if="graph.seoSlug" class="badge badge-success">🔗 SEO</span>
                            <span v-if="graph.metaArea" class="badge badge-meta-area">{{ graph.metaArea }}</span>
                          </div>
                          <div class="graph-option-meta">
                            <small class="text-muted">
                              {{ graph.nodeCount }} nodes · Updated {{ formatRelativeTime(graph.updatedAt) }}
                            </small>
                          </div>
                        </div>
                      </div>

                      <!-- Selected Graph Display -->
                      <div v-if="item.selectedGraph" class="selected-graph-display">
                        <div class="selected-graph-info">
                          <strong>{{ item.selectedGraph.title }}</strong>
                          <span v-if="item.selectedGraph.seoSlug" class="badge badge-success">🔗 SEO</span>
                        </div>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-secondary"
                          @click="clearGraphSelection(item)"
                        >
                          Change
                        </button>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Path Format Selector (only if graph has SEO slug) -->
                <div v-if="item.selectedGraph?.seoSlug" class="form-group">
                  <label>URL Format</label>
                  <div class="path-format-options">
                    <div class="form-check">
                      <input
                        type="radio"
                        :id="`seo-${index}`"
                        :name="`pathFormat-${index}`"
                        value="seo"
                        v-model="item.pathFormat"
                        @change="updateGraphPath(item)"
                        class="form-check-input"
                      />
                      <label :for="`seo-${index}`" class="form-check-label">
                        <strong>SEO-friendly:</strong>
                        <code>/gnew-viewer/graphs/{{ item.selectedGraph.seoSlug }}</code>
                      </label>
                    </div>
                    <div class="form-check">
                      <input
                        type="radio"
                        :id="`graphId-${index}`"
                        :name="`pathFormat-${index}`"
                        value="graphId"
                        v-model="item.pathFormat"
                        @change="updateGraphPath(item)"
                        class="form-check-input"
                      />
                      <label :for="`graphId-${index}`" class="form-check-label">
                        <strong>Graph ID:</strong>
                        <code>/gnew-viewer?graphId={{ item.selectedGraph.id }}</code>
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Generated Path (Read-only) -->
                <div class="form-group">
                  <label>Generated Route Path</label>
                  <input
                    v-model="item.path"
                    type="text"
                    class="form-control"
                    readonly
                    placeholder="Select a graph to generate path"
                  />
                  <small class="form-text text-muted">
                    <i class="fas fa-info-circle"></i> Path is automatically generated based on selected graph
                  </small>
                </div>
              </div>

              <!-- Route Type (Custom Path) -->
              <div v-else-if="item.type === 'route'" class="form-group">
                <label>Route Path</label>
                <input
                  v-model="item.path"
                  type="text"
                  class="form-control"
                  placeholder="/custom-route"
                />
                <small class="form-text text-muted">
                  Enter a custom route path (e.g., /dashboard, /settings)
                </small>
              </div>

              <!-- External Link Type -->
              <div v-else-if="item.type === 'external'" class="external-link-section">
                <div class="form-group">
                  <label>External URL</label>
                  <input
                    v-model="item.url"
                    type="url"
                    class="form-control"
                    placeholder="https://example.com"
                  />
                  <small class="form-text text-muted">
                    <i class="fas fa-info-circle"></i>
                    <strong>External links:</strong> Opens in a new tab. Perfect for linking to external websites, documentation, or resources.
                    Must start with <code>https://</code> or <code>http://</code>
                  </small>
                </div>

                <!-- Example suggestions -->
                <div class="external-link-examples">
                  <small><strong>Examples:</strong></small>
                  <div class="example-links">
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-secondary"
                      @click="item.url = 'https://'"
                    >
                      🌐 Website
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-secondary"
                      @click="item.url = 'https://docs.'"
                    >
                      📚 Documentation
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-secondary"
                      @click="item.url = 'https://github.com/'"
                    >
                      💻 GitHub
                    </button>
                  </div>
                </div>
              </div>

              <!-- Required Roles -->
              <div class="row">
                <div class="col-md-12">
                  <div class="form-group">
                    <label>Required Roles (Optional)</label>
                    <input
                      v-model="item.requiresRoleString"
                      type="text"
                      class="form-control"
                      placeholder="Admin, Superadmin"
                      @blur="updateRequiredRoles(item)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button type="button" class="btn btn-outline-primary" @click="addMenuItem">
              <i class="fas fa-plus"></i> Add Menu Item
            </button>
          </div>
        </div>

        <!-- Preview -->
        <div class="form-section">
          <h5>Preview</h5>
          <div class="menu-preview-container">
            <div class="preview-info">
              <strong>{{ menuConfig.name }}</strong>
              <span class="preview-badge">{{ templateData.menu_level }}</span>
              <span class="preview-items">{{ menuConfig.items.length }} items</span>
            </div>
            <div class="preview-items-list">
              <div v-for="item in menuConfig.items" :key="item.id" class="preview-item">
                <span class="preview-icon">{{ item.icon }}</span>
                <span class="preview-label">{{ item.label }}</span>
                <span class="preview-type">{{ item.type }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
        <button
          type="button"
          class="btn btn-primary"
          @click="saveTemplate"
          :disabled="!isValid || isSaving"
        >
          <i v-if="isSaving" class="fas fa-spinner fa-spin"></i>
          {{ isSaving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template' }}
        </button>
      </div>
    </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useMenuTemplateStore } from '@/stores/menuTemplateStore'
import { useUserStore } from '@/stores/userStore'
import { apiUrls } from '@/config/api'

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  menuTemplate: {
    type: Object,
    default: null,
  },
})

// Emits
const emit = defineEmits(['close', 'saved'])

// Stores
const menuTemplateStore = useMenuTemplateStore()
const userStore = useUserStore()

// State
const isSaving = ref(false)
const editingTemplate = ref(false)

// Template data structure
const templateData = ref({
  id: '',
  name: '',
  category: 'General',
  menu_level: 'graph',
  access_level: 'user',
  domain: '',
  created_by: userStore.email || 'system',
})

// Menu configuration
const menuConfig = ref({
  menuId: '',
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
})

// Graph selection state
const availableGraphs = ref([])
const loadingGraphs = ref(false)

// Fetch available graphs on mount
onMounted(async () => {
  await fetchAvailableGraphs()

  // If editing an existing template, populate the form
  if (props.menuTemplate) {
    editingTemplate.value = true
    loadTemplate(props.menuTemplate)
  }
})

// Fetch graphs from API
const fetchAvailableGraphs = async () => {
  loadingGraphs.value = true
  console.log('🔍 Starting to fetch graphs using apiUrls...')
  try {
    const response = await fetch(apiUrls.getKnowledgeGraphs())
    console.log('📡 Response status:', response.status)

    if (!response.ok) {
      console.error('❌ Failed to fetch graphs, status:', response.status)
      throw new Error('Failed to fetch graphs')
    }

    const data = await response.json()
    console.log('📊 Received data:', data)
    console.log('📊 Results count:', data.results?.length || 0)

    if (!data.results || data.results.length === 0) {
      console.warn('⚠️ No graphs in results')
      availableGraphs.value = []
      return
    }

    // Fetch full data for each graph to get seoSlug
    const graphPromises = data.results.map(async (graph) => {
      try {
        console.log('🔍 Fetching full data for graph:', graph.id)
        const fullResponse = await fetch(apiUrls.getKnowledgeGraph(graph.id))
        if (!fullResponse.ok) {
          console.warn('⚠️ Failed to fetch graph:', graph.id)
          return null
        }

        const graphData = await fullResponse.json()
        console.log('✅ Got graph data:', graphData.metadata?.title || graph.id)

        return {
          id: graph.id,
          title: graphData.metadata?.title || graph.title || 'Untitled Graph',
          description: graphData.metadata?.description || '',
          seoSlug: graphData.metadata?.seoSlug || null,
          nodeCount: Array.isArray(graphData.nodes) ? graphData.nodes.length : 0,
          updatedAt: graphData.metadata?.updatedAt || graphData.updated_at || new Date().toISOString(),
          category: graphData.metadata?.category || '',
          metaArea: graphData.metadata?.metaArea || ''
        }
      } catch (error) {
        console.error('❌ Error fetching graph:', graph.id, error)
        return null
      }
    })

    const graphs = await Promise.all(graphPromises)
    availableGraphs.value = graphs.filter(g => g !== null)

    console.log('✅ Successfully fetched', availableGraphs.value.length, 'graphs')
    console.log('📋 Graphs:', availableGraphs.value)
  } catch (error) {
    console.error('❌ Error fetching graphs:', error)
    availableGraphs.value = []
  } finally {
    loadingGraphs.value = false
  }
}

// Filter graphs based on search query
const filteredGraphs = (item) => {
  if (!item.graphSearchQuery || item.graphSearchQuery.trim() === '') {
    return availableGraphs.value.slice(0, 10) // Show first 10 if no search
  }

  const query = item.graphSearchQuery.toLowerCase()

  return availableGraphs.value.filter(graph => {
    // Search in title, description, category
    const matchesText =
      graph.title.toLowerCase().includes(query) ||
      graph.description.toLowerCase().includes(query) ||
      graph.category.toLowerCase().includes(query)

    // Search in metaArea (supports both "#Yoga" and "Yoga" format)
    const matchesMetaArea = graph.metaArea &&
      graph.metaArea.toLowerCase().includes(query)

    return matchesText || matchesMetaArea
  }).slice(0, 10) // Limit to 10 results
}

// Select a graph
const selectGraph = (item, graph) => {
  item.selectedGraph = graph
  item.graphSearchQuery = graph.title
  item.showGraphDropdown = false
  item.label = graph.title // Auto-fill label

  // Set default path format based on SEO slug availability
  item.pathFormat = graph.seoSlug ? 'seo' : 'graphId'

  // Update the path
  updateGraphPath(item)
}

// Clear graph selection
const clearGraphSelection = (item) => {
  item.selectedGraph = null
  item.graphSearchQuery = ''
  item.path = ''
  item.showGraphDropdown = true
}

// Update graph path based on selected format
const updateGraphPath = (item) => {
  if (!item.selectedGraph) return

  if (item.pathFormat === 'seo' && item.selectedGraph.seoSlug) {
    item.path = `/gnew-viewer/graphs/${item.selectedGraph.seoSlug}`
  } else {
    item.path = `/gnew-viewer?graphId=${item.selectedGraph.id}`
  }
}

// Handle menu item type change
const onMenuItemTypeChange = (item) => {
  // Reset relevant fields when type changes
  item.path = ''
  item.url = ''
  item.selectedGraph = null
  item.graphSearchQuery = ''
  // Auto-show dropdown when switching to graph-link type
  if (item.type === 'graph-link') {
    item.showGraphDropdown = true
  } else {
    item.showGraphDropdown = false
  }
}

// Handle graph search
const onGraphSearch = (item) => {
  item.showGraphDropdown = true
}

// Close all dropdowns (for click-outside handling)
const closeAllDropdowns = () => {
  menuConfig.value.items.forEach(item => {
    item.showGraphDropdown = false
  })
}

// Format relative time
const formatRelativeTime = (dateString) => {
  if (!dateString) return 'unknown'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

// Computed properties
const isValid = computed(() => {
  const nameValid = templateData.value.name.trim() !== ''
  const menuIdValid = menuConfig.value.menuId.trim() !== ''
  const menuNameValid = menuConfig.value.name.trim() !== ''
  const hasItems = menuConfig.value.items.length > 0

  const valid = nameValid && menuIdValid && menuNameValid && hasItems

  // Debug validation
  console.log('=== VALIDATION DEBUG ===')
  console.log('Name valid:', nameValid, '(', templateData.value.name, ')')
  console.log('Menu ID valid:', menuIdValid, '(', menuConfig.value.menuId, ')')
  console.log('Menu Name valid:', menuNameValid, '(', menuConfig.value.name, ')')
  console.log('Has items:', hasItems, '(', menuConfig.value.items.length, ')')
  console.log('Overall valid:', valid)

  return valid
})

// Methods
const addMenuItem = () => {
  const newItem = {
    id: `item-${Date.now()}`,
    label: 'New Item',
    type: 'route',
    path: '',
    url: '',
    requiresRole: null,
    requiresRoleString: '',
    // Graph link specific fields
    selectedGraph: null,
    graphSearchQuery: '',
    showGraphDropdown: false,
    pathFormat: 'seo', // Default to SEO format
  }
  menuConfig.value.items.push(newItem)
}

const removeMenuItem = (index) => {
  menuConfig.value.items.splice(index, 1)
}

const updateRequiredRoles = (item) => {
  if (item.requiresRoleString && item.requiresRoleString.trim()) {
    item.requiresRole = item.requiresRoleString
      .split(',')
      .map((role) => role.trim())
      .filter((role) => role.length > 0)
  } else {
    item.requiresRole = null
  }
}

const saveTemplate = async () => {
  if (!isValid.value) return

  isSaving.value = true

  try {
    // Debug: Log current form state
    console.log('=== MENU TEMPLATE DEBUG ===')
    console.log('Template Data:', templateData.value)
    console.log('Menu Config:', menuConfig.value)
    console.log('Is Valid:', isValid.value)
    console.log('Template Data Name:', templateData.value.name?.trim())
    console.log('Menu Config ID:', menuConfig.value.menuId?.trim())
    console.log('Menu Config Name:', menuConfig.value.name?.trim())
    console.log('Menu Items Count:', menuConfig.value.items?.length)

    // Prepare menu data
    const menuData = {
      ...menuConfig.value,
      menuLevel: templateData.value.menu_level,
    }

    // Prepare template for saving
    const templateToSave = {
      ...templateData.value,
      menu_data: menuData,
    }

    console.log('=== FINAL TEMPLATE TO SAVE ===')
    console.log('Template to save:', JSON.stringify(templateToSave, null, 2))

    if (editingTemplate.value) {
      await menuTemplateStore.updateMenuTemplate(templateToSave)
    } else {
      await menuTemplateStore.saveMenuTemplate(templateToSave)
    }

    emit('saved', templateToSave)
    closeModal()
  } catch (error) {
    console.error('Error saving menu template:', error)
    alert('Failed to save menu template: ' + error.message)
  } finally {
    isSaving.value = false
  }
}

const closeModal = () => {
  emit('close')
}

const resetForm = () => {
  templateData.value = {
    id: '',
    name: '',
    category: 'General',
    menu_level: 'graph',
    access_level: 'user',
    domain: '',
    created_by: userStore.email || 'system',
  }

  menuConfig.value = {
    menuId: '',
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

const loadTemplate = (template) => {
  if (template) {
    editingTemplate.value = true
    templateData.value = { ...template }
    menuConfig.value = { ...template.menu_data }

    // Convert requiresRole arrays to strings for editing
    menuConfig.value.items.forEach((item) => {
      if (item.requiresRole && Array.isArray(item.requiresRole)) {
        item.requiresRoleString = item.requiresRole.join(', ')
      }
    })
  }
}

// Watch for template changes when modal is opened
watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue) {
      // Modal is opening
      if (props.menuTemplate) {
        loadTemplate(props.menuTemplate)
      } else {
        resetForm()
        // Add a default menu item for new templates
        if (menuConfig.value.items.length === 0) {
          addMenuItem()
        }
      }
    }
  }
)

// Lifecycle - merged both onMounted hooks
// (Already handled in the graph fetching section above)
</script>

<style scoped>
.menu-template-creator-overlay {
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

.menu-template-creator {
  background: #fff;
  border-radius: 16px;
  width: 90%;
  max-width: 900px;
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
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #dee2e6;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
}

.modal-title i {
  margin-right: 0.5rem;
  color: #007bff;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #333;
}

.btn-close::before {
  content: '×';
}

.modal-body {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.form-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.form-section h5 {
  margin-bottom: 1rem;
  color: #333;
  font-weight: 600;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #007bff;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #333;
  font-weight: 500;
}

.form-control {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.menu-items-container {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  background: white;
}

.menu-item-editor {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  background: #f8f9fa;
}

.menu-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.menu-item-header h6 {
  margin: 0;
  color: #333;
  font-weight: 600;
}

.menu-preview-container {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  background: white;
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
}

.preview-badge {
  background: #007bff;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
}

.preview-items {
  color: #666;
  font-size: 0.9rem;
}

.preview-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  background: #f8f9fa;
}

.preview-icon {
  width: 24px;
  text-align: center;
}

.preview-label {
  flex: 1;
  font-weight: 500;
}

.preview-type {
  color: #666;
  font-size: 0.8rem;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 8px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #dee2e6;
  background-color: #f8f9fa;
  flex-shrink: 0;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
  border-color: #0056b3;
}

.btn-primary:disabled {
  background: #6c757d;
  border-color: #6c757d;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border-color: #6c757d;
}

.btn-secondary:hover {
  background: #5a6268;
  border-color: #5a6268;
}

.btn-outline-primary {
  color: #007bff;
  border-color: #007bff;
}

.btn-outline-primary:hover {
  background: #007bff;
  color: white;
}

.btn-outline-danger {
  color: #dc3545;
  border-color: #dc3545;
}

.btn-outline-danger:hover {
  background: #dc3545;
  color: white;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -0.75rem;
}

.col-md-3,
.col-md-6 {
  padding: 0 0.75rem;
}

.col-md-3 {
  flex: 0 0 25%;
}

.col-md-6 {
  flex: 0 0 50%;
}

@media (max-width: 768px) {
  .col-md-3,
  .col-md-6 {
    flex: 0 0 100%;
  }
}

/* Graph Selection Styling */
.graph-link-section {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

/* External Link Styling */
.external-link-section {
  margin-top: 1rem;
  padding: 1rem;
  background: #fff8e6;
  border-radius: 8px;
  border: 1px solid #ffe066;
}

.external-link-examples {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.external-link-examples small {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
  font-weight: 600;
}

.example-links {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.example-links .btn {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.loading-message,
.no-graphs-message {
  padding: 1rem;
  text-align: center;
  color: #666;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.loading-message i {
  margin-right: 0.5rem;
  color: #007bff;
}

.no-graphs-message i {
  margin-right: 0.5rem;
  color: #ffc107;
}

.graph-search-container {
  position: relative;
  margin-bottom: 0.5rem;
}

.graph-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-top: 0.25rem;
}

.dropdown-header {
  padding: 0.75rem;
  background: #f8f9fa;
  border-bottom: 2px solid #007bff;
  font-size: 0.85rem;
  color: #666;
  position: sticky;
  top: 0;
  z-index: 1;
}

.graph-option {
  padding: 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.graph-option:hover {
  background: #f8f9fa;
}

.graph-option:last-child {
  border-bottom: none;
}

.graph-option-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.graph-option-title {
  font-weight: 600;
  color: #333;
  flex: 1;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-success {
  background: #d4edda;
  color: #155724;
}

.badge-meta-area {
  background: #e7f3ff;
  color: #0066cc;
  text-transform: none;
}

.graph-option-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.25rem;
}

.selected-graph-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: white;
  border: 2px solid #28a745;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.selected-graph-info {
  flex: 1;
}

.selected-graph-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
}

.selected-graph-meta {
  font-size: 0.8rem;
  color: #666;
}

.path-format-options {
  margin: 1rem 0;
  padding: 0.75rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.path-format-options label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.path-format-options label:hover {
  background: #f8f9fa;
}

.path-format-options input[type="radio"] {
  cursor: pointer;
}

.path-format-description {
  font-size: 0.8rem;
  color: #666;
  margin-left: 1.75rem;
  margin-top: -0.25rem;
  margin-bottom: 0.5rem;
}

</style>
