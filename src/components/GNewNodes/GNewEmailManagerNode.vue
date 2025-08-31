<template>
  <div class="gnew-email-manager-node" :class="nodeTypeClass" data-node-type="email-manager">
    <!-- Node Header - Following GNewDefaultNode pattern -->
    <div v-if="showControls && nodeTitle" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ nodeTitle }}</h3>
        <!-- Node Type Badge inline with title -->
        <div class="node-type-badge-inline">📧 Email Manager</div>
      </div>
      <div v-if="!isPreview" class="node-controls">
        <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Node">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Node">
          🗑️
        </button>
      </div>
    </div>

    <!-- Title only (for non-control mode) -->
    <div v-else-if="nodeTitle" class="node-title-row">
      <h3 class="node-title">{{ nodeTitle }}</h3>
    </div>

    <!-- Email Manager Interface -->
    <div class="email-manager-content">
      <div class="manager-header">
        <div class="manager-icon">📧</div>
        <div class="manager-info">
          <h4>Email Templates Manager</h4>
          <p class="manager-description">
            Create and manage email templates for automated communications
          </p>
        </div>
        <div class="manager-stats">
          <div class="stat-item">
            <span class="stat-number">{{ emailTemplates.length }}</span>
            <span class="stat-label">Templates</span>
          </div>
        </div>
      </div>

      <!-- Quick Create New Template -->
      <div class="quick-create-section">
        <div class="quick-create-header">
          <h5>➕ Create New Email Template</h5>
          <button @click="addNewTemplate" class="btn btn-sm btn-success" v-if="!editingTemplate?.isNew">+ Add Template</button>
        </div>
        
        <!-- New Template Form (when adding) -->
        <div v-if="editingTemplate && editingTemplate.isNew" class="new-template-form">
          <div class="form-row">
            <div class="form-group">
              <label>Template Name:</label>
              <input
                v-model="editingTemplate.template_name"
                type="text"
                class="form-control form-control-sm"
                placeholder="Enter template name"
              />
            </div>
            <div class="form-group">
              <label>Template Type:</label>
              <select v-model="editingTemplate.template_type" class="form-select form-select-sm">
                <option value="general">General</option>
                <option value="chat_invitation">Chat Invitation</option>
                <option value="affiliate_invitation">Affiliate Invitation</option>
                <option value="project_update">Project Update</option>
                <option value="welcome">Welcome Email</option>
              </select>
            </div>
            <div class="form-group">
              <label>Language:</label>
              <select v-model="editingTemplate.language_code" class="form-select form-select-sm">
                <option value="en">English</option>
                <option value="tr">Turkish</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label>Subject:</label>
            <input
              v-model="editingTemplate.subject"
              type="text"
              class="form-control form-control-sm"
              placeholder="Enter email subject"
            />
          </div>
          
              <div class="form-group">
                <label>Body:</label>
                <div class="body-input-section">
                  <div class="textarea-with-edit-button">
                    <textarea
                      v-model="editingTemplate.body"
                      class="form-control"
                      rows="4"
                      placeholder="Enter email body content or use Advanced Editor..."
                    ></textarea>
                    <button 
                      @click="openAdvancedEditor(editingTemplate, 'body')"
                      class="btn btn-sm btn-outline-primary edit-advanced-btn"
                      title="Open advanced markdown editor"
                    >
                      ✏️ Advanced Editor
                    </button>
                  </div>
                  <small class="form-text text-muted">
                    Use the Advanced Editor for markdown formatting with live preview and helper tools.
                  </small>
                </div>
              </div>          <div class="form-group">
            <label>Variables (JSON array):</label>
            <input
              v-model="editingTemplate.variables"
              type="text"
              class="form-control form-control-sm"
              placeholder='["variable1", "variable2"]'
            />
            <small class="form-text text-muted">
              List of variables that can be used in the subject and body
            </small>
          </div>
          
          <div class="form-actions">
            <button @click="saveTemplate" class="btn btn-sm btn-success">
              💾 {{ editingTemplate.isNew ? 'Create Template' : 'Save Template' }}
            </button>
            <button @click="cancelEdit" class="btn btn-sm btn-secondary">❌ Cancel</button>
          </div>
        </div>
      </div>

      <!-- Email Templates List with Inline Editing -->
      <div v-if="emailTemplates.length > 0" class="email-templates-list">
        <h5>📋 Current Email Templates</h5>

        <!-- Filter and Search -->
        <div class="templates-filter">
          <div class="filter-row">
            <select v-model="filterType" class="form-select form-select-sm">
              <option value="">All Types</option>
              <option value="chat_invitation">Chat Invitations</option>
              <option value="affiliate_invitation">Affiliate Invitations</option>
              <option value="project_update">Project Updates</option>
              <option value="welcome">Welcome Emails</option>
            </select>
            <input
              v-model="searchTerm"
              type="text"
              class="form-control form-control-sm"
              placeholder="Search templates..."
            />
          </div>
        </div>

        <!-- Templates List -->
        <div class="templates-grid">
          <div
            v-for="template in filteredTemplates"
            :key="template.id"
            class="template-card"
            :class="{ 'editing': editingTemplate?.id === template.id }"
          >
            <!-- Template Header -->
            <div class="template-header">
              <div class="template-info">
                <div class="template-type-badge" :class="'type-' + template.template_type">
                  {{ getTypeIcon(template.template_type) }} {{ formatTemplatType(template.template_type) }}
                </div>
                <div class="template-language">{{ template.language_code.toUpperCase() }}</div>
              </div>
              <div class="template-actions">
                <button
                  @click="editTemplate(template)"
                  class="btn btn-sm btn-outline-primary"
                  title="Edit Template"
                >
                  ✏️
                </button>
                <button
                  @click="duplicateTemplate(template)"
                  class="btn btn-sm btn-outline-secondary"
                  title="Duplicate Template"
                >
                  📋
                </button>
                <button
                  @click="deleteTemplate(template)"
                  class="btn btn-sm btn-outline-danger"
                  title="Delete Template"
                >
                  🗑️
                </button>
              </div>
            </div>

            <!-- Template Content -->
            <div v-if="editingTemplate?.id !== template.id" class="template-content">
              <h6 class="template-name">{{ template.template_name }}</h6>
              <p class="template-subject"><strong>Subject:</strong> {{ template.subject }}</p>
              <div class="template-preview">
                <p class="template-body-preview">{{ getBodyPreview(template.body) }}</p>
              </div>
              <div class="template-variables">
                <span class="variables-label">Variables:</span>
                <span
                  v-for="variable in getTemplateVariables(template.variables)"
                  :key="variable"
                  class="variable-tag"
                >
                  {{ variable }}
                </span>
              </div>
            </div>

            <!-- Editing Form -->
            <div v-else class="template-edit-form">
              <div class="form-group">
                <label>Template Name:</label>
                <input
                  v-model="editingTemplate.template_name"
                  type="text"
                  class="form-control form-control-sm"
                />
              </div>
              <div class="form-group">
                <label>Template Type:</label>
                <select v-model="editingTemplate.template_type" class="form-select form-select-sm">
                  <option value="chat_invitation">Chat Invitation</option>
                  <option value="affiliate_invitation">Affiliate Invitation</option>
                  <option value="project_update">Project Update</option>
                  <option value="welcome">Welcome Email</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div class="form-group">
                <label>Subject:</label>
                <input
                  v-model="editingTemplate.subject"
                  type="text"
                  class="form-control form-control-sm"
                />
              </div>
              <div class="form-group">
                <label>Body:</label>
                <div class="body-input-section">
                  <div class="textarea-with-edit-button">
                    <textarea
                      v-model="editingTemplate.body"
                      class="form-control"
                      rows="4"
                      placeholder="Enter email body content or use Advanced Editor..."
                    ></textarea>
                    <button 
                      @click="openAdvancedEditor(editingTemplate, 'body')"
                      class="btn btn-sm btn-outline-primary edit-advanced-btn"
                      title="Open advanced markdown editor"
                    >
                      ✏️ Advanced Editor
                    </button>
                  </div>
                  <small class="form-text text-muted">
                    Use the Advanced Editor for markdown formatting with live preview and helper tools.
                  </small>
                </div>
              </div>
              <div class="form-group">
                <label>Variables (JSON array):</label>
                <input
                  v-model="editingTemplate.variables"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder='["variable1", "variable2"]'
                />
              </div>
              <div class="edit-actions">
                <button @click="saveTemplate" class="btn btn-sm btn-success">💾 Save</button>
                <button @click="cancelEdit" class="btn btn-sm btn-secondary">❌ Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <div class="empty-icon">📧</div>
        <h5>No Email Templates</h5>
        <p>Get started by creating your first email template.</p>
        <button @click="addNewTemplate" class="btn btn-primary">Create First Template</button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p>Loading email templates...</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GNewEmailManagerNode',
  props: {
    node: {
      type: Object,
      required: true,
    },
    showControls: {
      type: Boolean,
      default: true,
    },
    isPreview: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      emailTemplates: [],
      loading: false,
      editingTemplate: null,
      filterType: '',
      searchTerm: '',
      error: null,
    }
  },
  computed: {
    nodeTitle() {
      return this.node?.label || 'Email Manager'
    },
    nodeTypeClass() {
      return 'node-type-email-manager'
    },
    filteredTemplates() {
      let filtered = this.emailTemplates

      // Filter by type
      if (this.filterType) {
        filtered = filtered.filter(template => template.template_type === this.filterType)
      }

      // Filter by search term
      if (this.searchTerm) {
        const search = this.searchTerm.toLowerCase()
        filtered = filtered.filter(template =>
          template.template_name.toLowerCase().includes(search) ||
          template.subject.toLowerCase().includes(search) ||
          template.body.toLowerCase().includes(search)
        )
      }

      return filtered
    },
  },
  mounted() {
    this.loadEmailTemplates()
    
    // Listen for email template content updates from the advanced editor modal
    window.addEventListener('emailTemplateContentUpdated', this.handleTemplateContentUpdate)
    console.log('🎯 EmailManager: Event listener registered for emailTemplateContentUpdated')
  },

  beforeUnmount() {
    // Clean up event listener
    window.removeEventListener('emailTemplateContentUpdated', this.handleTemplateContentUpdate)
    console.log('🎯 EmailManager: Event listener removed')
  },
  methods: {
    async loadEmailTemplates() {
      this.loading = true
      this.error = null

      try {
        // Use email-worker API endpoint
        const response = await fetch('https://email-worker.torarnehave.workers.dev/email-templates')

        if (response.ok) {
          const data = await response.json()
          this.emailTemplates = data.templates || []
        } else {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to load templates')
        }
      } catch (error) {
        console.error('Error loading email templates:', error)
        this.error = error.message
        this.showError('Failed to load email templates: ' + error.message)
      } finally {
        this.loading = false
      }
    },

    loadSampleData() {
      // This method is no longer needed but kept for backward compatibility
      this.emailTemplates = []
    },

    // Open the advanced editor modal (reusing GNewViewer's node edit modal)
    openAdvancedEditor(template, field) {
      console.log('🚀 EmailManager: Opening advanced editor for:', { template, field })
      
      // Create a virtual node for editing the email template content
      const virtualNode = {
        id: `email-template-${template.id || 'new'}-${field}`,
        label: `${template.template_name || 'Email Template'} - ${field.toUpperCase()}`,
        info: template[field] || '',
        type: 'email-template-content',
        // Store reference to original template and field for saving
        _emailTemplate: template,
        _emailField: field
      }

      console.log('🚀 EmailManager: Created virtual node:', virtualNode)

      // Emit the edit event to trigger GNewViewer's modal
      this.$emit('node-updated', {
        ...virtualNode,
        action: 'edit'
      })
    },

    // Handle when the advanced editor content is saved
    // Handle content updates from advanced editor modal
    handleTemplateContentUpdate(event) {
      console.log('🔄 EmailManager: Event received!', event)
      const { templateId, field, content } = event.detail
      
      console.log('🔄 EmailManager: Received template content update:', { templateId, field, content })
      console.log('🔄 EmailManager: Current editing template:', this.editingTemplate)
      
      // Update the editing template if it exists
      if (this.editingTemplate) {
        console.log('🔄 EmailManager: Updating editingTemplate field:', field)
        this.editingTemplate[field] = content
        console.log('✅ EmailManager: Updated editing template:', this.editingTemplate)
      }
      
      // Also try to update any template in the list that matches
      if (templateId && templateId !== 'new') {
        const templateIndex = this.emailTemplates.findIndex(t => t.id == templateId)
        if (templateIndex !== -1) {
          this.emailTemplates[templateIndex][field] = content
          console.log('✅ EmailManager: Updated template in list:', this.emailTemplates[templateIndex])
        }
      }
      
      // Force re-render to make sure Vue picks up the changes
      this.$forceUpdate()
    },

    getTypeIcon(type) {
      const icons = {
        chat_invitation: '💬',
        affiliate_invitation: '🤝',
        project_update: '📊',
        welcome: '🎉',
        general: '📧',
      }
      return icons[type] || '📧'
    },

    formatTemplatType(type) {
      return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    },

    getBodyPreview(body) {
      return body.length > 100 ? body.substring(0, 100) + '...' : body
    },

    getTemplateVariables(variablesString) {
      try {
        return JSON.parse(variablesString || '[]')
      } catch {
        return []
      }
    },

    // Handle the custom event when email template content is saved from advanced editor
    handleEmailTemplateSaved(event) {
      const { nodeId, content } = event.detail
      
      console.log('Email template saved:', { nodeId, content })
      
      if (this.currentEditingTemplate && this.currentEditingField) {
        // Update the template field with the saved content
        this.currentEditingTemplate[this.currentEditingField] = content
        
        console.log(`Updated ${this.currentEditingField} for template:`, this.currentEditingTemplate.template_name)
        
        // Clear the editing references
        this.currentEditingTemplate = null
        this.currentEditingField = null
        
        // Force reactivity update
        this.$forceUpdate()
      }
    },

    addNewTemplate() {
      this.editingTemplate = {
        id: 'new-' + Date.now(),
        template_name: 'New Email Template',
        template_type: 'general',
        language_code: 'en',
        subject: '',
        body: '',
        variables: '[]',
        is_active: 1,
        isNew: true,
      }
    },

    editTemplate(template) {
      this.editingTemplate = { ...template }
    },

    cancelEdit() {
      this.editingTemplate = null
    },

    async saveTemplate() {
      if (!this.editingTemplate) return

      try {
        // Prepare template data
        const templateData = {
          template_name: this.editingTemplate.template_name,
          template_type: this.editingTemplate.template_type,
          language_code: this.editingTemplate.language_code,
          subject: this.editingTemplate.subject,
          body: this.editingTemplate.body,
          variables: this.editingTemplate.variables,
          is_active: this.editingTemplate.is_active
        }

        if (this.editingTemplate.isNew) {
          // Create new template
          templateData.created_by = 'email_manager_ui'
          
          const response = await fetch('https://email-worker.torarnehave.workers.dev/email-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(templateData)
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to create template')
          }

          const result = await response.json()

          // Add the new template to local state
          const newTemplate = {
            ...this.editingTemplate,
            ...templateData,
            id: result.templateId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          delete newTemplate.isNew
          this.emailTemplates.unshift(newTemplate)

        } else {
          // Update existing template
          const response = await fetch(`https://email-worker.torarnehave.workers.dev/email-templates/${this.editingTemplate.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(templateData)
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to update template')
          }

          // Update the template in local state
          const index = this.emailTemplates.findIndex(t => t.id === this.editingTemplate.id)
          if (index !== -1) {
            this.emailTemplates[index] = {
              ...this.editingTemplate,
              ...templateData,
              updated_at: new Date().toISOString()
            }
          }
        }

        this.editingTemplate = null
        this.showSuccess('Template saved successfully!')

      } catch (error) {
        console.error('Error saving template:', error)
        this.showError('Failed to save template: ' + error.message)
      }
    },

    async duplicateTemplate(template) {
      const duplicated = {
        ...template,
        id: 'dup-' + Date.now(),
        template_name: template.template_name + ' (Copy)',
        isNew: true,
      }
      this.editingTemplate = duplicated
    },

    async deleteTemplate(template) {
      if (confirm(`Are you sure you want to delete "${template.template_name}"?`)) {
        try {
          const response = await fetch(`https://email-worker.torarnehave.workers.dev/email-templates/${template.id}`, {
            method: 'DELETE'
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to delete template')
          }

          // Remove from local state
          this.emailTemplates = this.emailTemplates.filter(t => t.id !== template.id)
          this.showSuccess('Template deleted successfully!')

        } catch (error) {
          console.error('Error deleting template:', error)
          this.showError('Failed to delete template: ' + error.message)
        }
      }
    },

    editNode() {
      this.$emit('edit-node')
    },

    deleteNode() {
      this.$emit('delete-node')
    },

    showSuccess(message) {
      // TODO: Implement toast notification
      console.log('Success:', message)
    },

    showError(message) {
      // TODO: Implement toast notification
      console.error('Error:', message)
    },
  },
}
</script>

<style scoped>
.gnew-email-manager-node {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.node-title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.node-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #343a40;
}

.node-type-badge-inline {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.node-controls {
  display: flex;
  gap: 8px;
}

.email-manager-content {
  padding: 20px;
}

.manager-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
}

.manager-icon {
  font-size: 32px;
}

.manager-info h4 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
}

.manager-description {
  margin: 0;
  opacity: 0.9;
}

.manager-stats {
  margin-left: auto;
}

.stat-item {
  text-align: center;
  background: rgba(255, 255, 255, 0.2);
  padding: 8px 16px;
  border-radius: 8px;
}

.stat-number {
  display: block;
  font-size: 24px;
  font-weight: 700;
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
}

.quick-create-section {
  margin-bottom: 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.quick-create-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.quick-create-header h5 {
  margin: 0;
  color: #495057;
}

.new-template-form {
  margin-top: 20px;
  padding: 20px;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.form-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.new-template-form .form-group {
  margin-bottom: 16px;
}

.new-template-form label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #495057;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #dee2e6;
}

.templates-filter {
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-row select,
.filter-row input {
  flex: 1;
}

.templates-grid {
  display: grid;
  gap: 16px;
}

.template-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 16px;
  background: white;
  transition: all 0.2s ease;
}

.template-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.template-card.editing {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.template-info {
  display: flex;
  gap: 8px;
  align-items: center;
}

.template-type-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.template-type-badge.type-chat_invitation {
  background: #e8f5e8;
  color: #2e7d32;
}

.template-type-badge.type-affiliate_invitation {
  background: #fff3e0;
  color: #ef6c00;
}

.template-type-badge.type-project_update {
  background: #e3f2fd;
  color: #1976d2;
}

.template-type-badge.type-welcome {
  background: #fce4ec;
  color: #c2185b;
}

.template-language {
  background: #6c757d;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.template-actions {
  display: flex;
  gap: 4px;
}

.template-name {
  margin: 0 0 8px 0;
  font-weight: 600;
  color: #343a40;
}

.template-subject {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #6c757d;
}

.template-preview {
  margin-bottom: 12px;
}

.template-body-preview {
  margin: 0;
  font-size: 14px;
  color: #6c757d;
  line-height: 1.4;
}

.template-variables {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.variables-label {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.variable-tag {
  background: #e9ecef;
  color: #495057;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
}

.template-edit-form .form-group {
  margin-bottom: 12px;
}

.template-edit-form label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #495057;
}

.edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.loading-state {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.loading-state .spinner-border {
  margin-bottom: 16px;
}

/* Advanced Editor Button Styles */
.body-input-section {
  margin-bottom: 1rem;
}

.textarea-with-edit-button {
  position: relative;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.textarea-with-edit-button textarea {
  flex: 1;
  background-color: #f8f9fa;
  border: 2px dashed #dee2e6;
  resize: vertical;
}

.edit-advanced-btn {
  flex-shrink: 0;
  height: fit-content;
  margin-top: 2px;
  white-space: nowrap;
}

.edit-advanced-btn:hover {
  background-color: #0056b3;
  color: white;
  border-color: #0056b3;
}
</style>
