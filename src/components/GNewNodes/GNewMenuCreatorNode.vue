<template>
  <div class="gnew-menu-creator-node">
    <!-- PUBLIC MODE: Show functional menu for non-logged-in users -->
    <div v-if="!showControls && menuData.items && menuData.items.length > 0" class="public-menu">
      <div class="menu-container">
        <div class="menu-header">
          <h4 class="menu-title">
            <i class="fas fa-bars"></i>
            {{ menuData.name || 'Menu' }}
          </h4>
        </div>
        <div class="menu-items">
          <div v-for="(item, index) in menuData.items" :key="index" class="menu-item">
            <component
              :is="getMenuItemComponent(item)"
              :item="item"
              @click="handleMenuItemClick(item)"
            />
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
                {{ menuData.menuLevel || 'graph' }}
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
                    Array.isArray(item.requiresRole) ? item.requiresRole.join(', ') : item.requiresRole
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
import { ref, computed, onMounted, watch } from 'vue'
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
const emit = defineEmits(['node-updated', 'node-deleted', 'template-requested'])

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
const getMenuItemComponent = (item) => {
  // Return the appropriate component based on item type
  switch (item.type) {
    case 'route':
      return 'router-link'
    case 'external':
      return 'a'
    case 'button':
      return 'button'
    default:
      return 'button'
  }
}

const handleMenuItemClick = (item) => {
  switch (item.type) {
    case 'route':
      // Router navigation is handled by router-link
      break
    case 'external':
      window.open(item.url || item.path, '_blank')
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

// Lifecycle
onMounted(() => {
  // Initialize JSON editor with current data
  jsonData.value = JSON.stringify(menuData.value, null, 2)
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

/* Public Menu Styles */
.public-menu {
  background: #ffffff;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.menu-container {
  max-width: 100%;
}

.menu-header {
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.menu-title {
  margin: 0;
  color: #2c3e50;
  font-size: 1.1rem;
  font-weight: 600;
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.menu-item {
  display: flex;
  align-items: center;
}

.menu-item button,
.menu-item a {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: #f8f9fa;
  color: #495057;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
  font-size: 0.9rem;
  width: 100%;
}

.menu-item button:hover,
.menu-item a:hover {
  background: #e9ecef;
  border-color: #adb5bd;
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
</style>
