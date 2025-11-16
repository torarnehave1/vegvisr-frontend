<template>
  <div class="template-manager">
    <div class="header">
      <h1>📚 Knowledge Graph Template Manager</h1>
      <p class="subtitle">Manage AI templates for knowledge graph generation (Superadmin Only)</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading templates...</p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="error-banner">
      <strong>Error:</strong> {{ error }}
      <button @click="loadTemplates">Retry</button>
    </div>

    <!-- Templates List -->
    <div v-if="!loading && templates.length > 0" class="templates-container">
      <div class="toolbar">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search templates by name, category, or type..."
            class="search-input"
          />
        </div>
        <div class="filter-buttons">
          <button
            v-for="cat in categories"
            :key="cat"
            :class="{ active: selectedCategory === cat }"
            @click="selectedCategory = cat"
            class="category-btn"
          >
            {{ cat }}
          </button>
        </div>
        <button @click="createNewTemplate" class="btn-primary">
          ➕ New Template
        </button>
      </div>

      <div class="templates-grid">
        <div
          v-for="template in filteredTemplates"
          :key="template.id"
          class="template-card"
          @click="editTemplate(template)"
        >
          <div class="template-thumbnail">
            <img
              v-if="template.thumbnail_path"
              :src="template.thumbnail_path"
              :alt="template.name"
              @error="handleImageError"
            />
            <div v-else class="no-thumbnail">📄</div>
          </div>
          <div class="template-info">
            <h3>{{ template.name }}</h3>
            <div class="template-meta">
              <span class="badge badge-category">{{ template.category || 'General' }}</span>
              <span class="badge badge-type">{{ template.type || 'N/A' }}</span>
            </div>
            <p class="template-question">{{ template.standard_question || 'No question set' }}</p>
            <div class="template-stats">
              <span>{{ template.nodes?.length || 0 }} nodes</span>
              <span>{{ template.edges?.length || 0 }} edges</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && templates.length === 0" class="empty-state">
      <p>No templates found</p>
      <button @click="createNewTemplate" class="btn-primary">Create First Template</button>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ isNewTemplate ? 'Create New Template' : 'Edit Template' }}</h2>
          <button @click="closeModal" class="btn-close">×</button>
        </div>

        <div class="modal-body">
          <div class="form-row">
            <label>Template Name</label>
            <input v-model="editingTemplate.name" type="text" class="form-input" />
          </div>

          <div class="form-row">
            <label>Type</label>
            <input v-model="editingTemplate.type" type="text" class="form-input" placeholder="e.g., ai_knowledge_node, worknote" />
          </div>

          <div class="form-row">
            <label>Category</label>
            <select v-model="editingTemplate.category" class="form-select">
              <option value="General">General</option>
              <option value="AI">AI</option>
              <option value="Interactive">Interactive</option>
              <option value="Project Management">Project Management</option>
              <option value="Education">Education</option>
              <option value="Research">Research</option>
            </select>
          </div>

          <div class="form-row">
            <label>Standard Question</label>
            <textarea
              v-model="editingTemplate.standard_question"
              class="form-textarea"
              rows="2"
              placeholder="e.g., Create a WorkNote node about [TOPIC]"
            ></textarea>
          </div>

          <div class="form-row">
            <label>Thumbnail URL</label>
            <input v-model="editingTemplate.thumbnail_path" type="text" class="form-input" placeholder="https://..." />
          </div>

          <div class="form-row">
            <label>
              Nodes (JSON)
              <button @click="formatJSON('nodes')" class="btn-small">Format</button>
            </label>
            <textarea
              v-model="nodesJSON"
              class="form-textarea code-editor"
              rows="10"
              placeholder="[{...}]"
            ></textarea>
          </div>

          <div class="form-row">
            <label>
              Edges (JSON)
              <button @click="formatJSON('edges')" class="btn-small">Format</button>
            </label>
            <textarea
              v-model="edgesJSON"
              class="form-textarea code-editor"
              rows="6"
              placeholder="[]"
            ></textarea>
          </div>

          <div class="form-row">
            <label>
              AI Instructions (JSON)
              <button @click="formatJSON('ai_instructions')" class="btn-small">Format</button>
            </label>
            <textarea
              v-model="aiInstructionsJSON"
              class="form-textarea code-editor"
              rows="15"
              placeholder="{...}"
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeModal" class="btn-secondary">Cancel</button>
          <button v-if="!isNewTemplate" @click="deleteTemplate" class="btn-danger">Delete</button>
          <button @click="saveTemplate" class="btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Template' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()

// Check if user is Superadmin
onMounted(() => {
  if (userStore.role !== 'Superadmin') {
    alert('Access denied: Superadmin only')
    router.push('/')
  } else {
    loadTemplates()
  }
})

const templates = ref([])
const loading = ref(false)
const error = ref(null)
const searchQuery = ref('')
const selectedCategory = ref('All')
const showEditModal = ref(false)
const editingTemplate = ref(null)
const isNewTemplate = ref(false)
const saving = ref(false)

// JSON editors for template fields
const nodesJSON = ref('')
const edgesJSON = ref('')
const aiInstructionsJSON = ref('')

const categories = computed(() => {
  const cats = new Set(['All'])
  templates.value.forEach((t) => {
    if (t.category) cats.add(t.category)
  })
  return Array.from(cats)
})

const filteredTemplates = computed(() => {
  let filtered = templates.value

  if (selectedCategory.value !== 'All') {
    filtered = filtered.filter((t) => t.category === selectedCategory.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (t) =>
        t.name?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query) ||
        t.type?.toLowerCase().includes(query) ||
        t.standard_question?.toLowerCase().includes(query)
    )
  }

  return filtered
})

const loadTemplates = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await fetch('https://knowledge.vegvisr.org/getAITemplates')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const data = await response.json()
    templates.value = data.results || []
  } catch (err) {
    error.value = err.message
    console.error('Failed to load templates:', err)
  } finally {
    loading.value = false
  }
}

const createNewTemplate = () => {
  isNewTemplate.value = true
  editingTemplate.value = {
    id: crypto.randomUUID(),
    name: '',
    type: '',
    category: 'General',
    standard_question: '',
    thumbnail_path: '',
    nodes: [],
    edges: [],
    ai_instructions: ''
  }
  nodesJSON.value = '[]'
  edgesJSON.value = '[]'
  aiInstructionsJSON.value = '{}'
  showEditModal.value = true
}

const editTemplate = (template) => {
  isNewTemplate.value = false
  editingTemplate.value = { ...template }
  
  // Convert to JSON strings for editing
  nodesJSON.value = JSON.stringify(template.nodes || [], null, 2)
  edgesJSON.value = JSON.stringify(template.edges || [], null, 2)
  
  // Handle ai_instructions - it might be string or object
  let aiInstructions = template.ai_instructions
  if (typeof aiInstructions === 'string') {
    try {
      aiInstructions = JSON.parse(aiInstructions)
    } catch {
      // Keep as string if not valid JSON
    }
  }
  aiInstructionsJSON.value = typeof aiInstructions === 'object' 
    ? JSON.stringify(aiInstructions, null, 2)
    : aiInstructions || '{}'
  
  showEditModal.value = true
}

const formatJSON = (field) => {
  try {
    let value
    if (field === 'nodes') value = nodesJSON.value
    else if (field === 'edges') value = edgesJSON.value
    else if (field === 'ai_instructions') value = aiInstructionsJSON.value
    
    const parsed = JSON.parse(value)
    const formatted = JSON.stringify(parsed, null, 2)
    
    if (field === 'nodes') nodesJSON.value = formatted
    else if (field === 'edges') edgesJSON.value = formatted
    else if (field === 'ai_instructions') aiInstructionsJSON.value = formatted
  } catch (err) {
    alert('Invalid JSON: ' + err.message)
  }
}

const saveTemplate = async () => {
  saving.value = true
  try {
    // Parse JSON fields
    const nodes = JSON.parse(nodesJSON.value)
    const edges = JSON.parse(edgesJSON.value)
    const ai_instructions = aiInstructionsJSON.value.trim() ? JSON.parse(aiInstructionsJSON.value) : {}
    
    const templateData = {
      ...editingTemplate.value,
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
      ai_instructions: JSON.stringify(ai_instructions)
    }
    
    const endpoint = isNewTemplate.value 
      ? 'https://knowledge.vegvisr.org/addTemplate'
      : 'https://knowledge.vegvisr.org/updateTemplate'
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || response.statusText)
    }
    
    alert('Template saved successfully!')
    closeModal()
    loadTemplates()
  } catch (err) {
    alert('Failed to save template: ' + err.message)
  } finally {
    saving.value = false
  }
}

const deleteTemplate = async () => {
  if (!confirm(`Delete template "${editingTemplate.value.name}"? This cannot be undone.`)) {
    return
  }
  
  try {
    const response = await fetch('https://knowledge.vegvisr.org/deleteTemplate', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingTemplate.value.id })
    })
    
    if (!response.ok) throw new Error('Delete failed')
    
    alert('Template deleted successfully')
    closeModal()
    loadTemplates()
  } catch (err) {
    alert('Failed to delete template: ' + err.message)
  }
}

const closeModal = () => {
  showEditModal.value = false
  editingTemplate.value = null
}

const handleImageError = (e) => {
  e.target.style.display = 'none'
  e.target.parentElement.innerHTML = '<div class="no-thumbnail">📄</div>'
}
</script>

<style scoped>
.template-manager {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  font-size: 0.95rem;
}

.loading {
  text-align: center;
  padding: 3rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-banner {
  background: #fee;
  border: 1px solid #fcc;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.search-box {
  flex: 1;
  min-width: 250px;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
}

.filter-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.category-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.category-btn:hover {
  background: #f0f0f0;
}

.category-btn.active {
  background: #3498db;
  color: white;
  border-color: #3498db;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.template-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.template-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.template-thumbnail {
  height: 150px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.template-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-thumbnail {
  font-size: 3rem;
  color: #ccc;
}

.template-info {
  padding: 1rem;
}

.template-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
}

.template-meta {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-category {
  background: #e3f2fd;
  color: #1976d2;
}

.badge-type {
  background: #f3e5f5;
  color: #7b1fa2;
}

.template-question {
  font-size: 0.85rem;
  color: #666;
  margin: 0.5rem 0;
  line-height: 1.4;
}

.template-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: #999;
  margin-top: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #999;
  line-height: 1;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.form-row {
  margin-bottom: 1.5rem;
}

.form-row label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
  font-family: inherit;
}

.form-textarea {
  resize: vertical;
}

.code-editor {
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  background: #f8f8f8;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #ddd;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

/* Buttons */
.btn-primary,
.btn-secondary,
.btn-danger,
.btn-small {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background: #7f8c8d;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background: #c0392b;
}

.btn-small {
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  background: #ecf0f1;
  color: #2c3e50;
}

.btn-small:hover {
  background: #bdc3c7;
}
</style>
