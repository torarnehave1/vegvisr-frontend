<template>
  <div class="menu-template-creator-overlay" @click="closeModal">
    <div class="menu-template-creator" @click.stop>
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
                <div class="col-md-3">
                  <div class="form-group">
                    <label>ID</label>
                    <input
                      v-model="item.id"
                      type="text"
                      class="form-control"
                      placeholder="item-id"
                    />
                  </div>
                </div>
                <div class="col-md-3">
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
                <div class="col-md-3">
                  <div class="form-group">
                    <label>Icon</label>
                    <input v-model="item.icon" type="text" class="form-control" placeholder="🏠" />
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="form-group">
                    <label>Type</label>
                    <select v-model="item.type" class="form-control">
                      <option value="route">Route</option>
                      <option value="graph-link">Graph Link</option>
                      <option value="template-selector">Template Selector</option>
                      <option value="external">External Link</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label>
                      {{
                        item.type === 'route'
                          ? 'Route Path'
                          : item.type === 'graph-link'
                            ? 'Graph ID'
                            : item.type === 'external'
                              ? 'URL'
                              : 'Value'
                      }}
                    </label>
                    <input
                      v-if="item.type === 'route'"
                      v-model="item.path"
                      type="text"
                      class="form-control"
                      :placeholder="getPlaceholder(item.type)"
                    />
                    <input
                      v-else-if="item.type === 'graph-link'"
                      v-model="item.graphId"
                      type="text"
                      class="form-control"
                      :placeholder="getPlaceholder(item.type)"
                    />
                    <input
                      v-else-if="item.type === 'external'"
                      v-model="item.url"
                      type="text"
                      class="form-control"
                      :placeholder="getPlaceholder(item.type)"
                    />
                    <input
                      v-else
                      v-model="item.value"
                      type="text"
                      class="form-control"
                      :placeholder="getPlaceholder(item.type)"
                    />
                  </div>
                </div>
                <div class="col-md-6">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMenuTemplateStore } from '@/stores/menuTemplateStore'
import { useUserStore } from '@/stores/userStore'

// Props
const props = defineProps({
  template: {
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

// Computed properties
const isValid = computed(() => {
  return (
    templateData.value.name.trim() !== '' &&
    menuConfig.value.menuId.trim() !== '' &&
    menuConfig.value.name.trim() !== '' &&
    menuConfig.value.items.length > 0
  )
})

// Methods
const addMenuItem = () => {
  menuConfig.value.items.push({
    id: `item-${Date.now()}`,
    label: 'New Item',
    icon: '📄',
    type: 'route',
    path: '/',
    graphId: '',
    url: '',
    value: '',
    requiresRole: null,
    requiresRoleString: '',
  })
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

const getPlaceholder = (type) => {
  switch (type) {
    case 'route':
      return '/dashboard'
    case 'graph-link':
      return 'graph-id-123'
    case 'external':
      return 'https://example.com'
    default:
      return 'Value'
  }
}

const saveTemplate = async () => {
  if (!isValid.value) return

  isSaving.value = true

  try {
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

    console.log('Saving menu template:', templateToSave)

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

// Lifecycle
onMounted(() => {
  if (props.template) {
    loadTemplate(props.template)
  } else {
    resetForm()
    // Add a default menu item
    addMenuItem()
  }
})
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
</style>
