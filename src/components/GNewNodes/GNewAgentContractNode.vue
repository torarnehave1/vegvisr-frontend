<template>
  <div class="gnew-agent-contract-node">
    <!-- Header -->
    <div class="contract-header">
      <div class="contract-title-wrap">
        <h3 v-if="node.label" class="contract-title">{{ node.label }}</h3>
        <div class="contract-type-badge">Agent Contract</div>
        <div v-if="contractData.version" class="contract-version">v{{ contractData.version }}</div>
      </div>
      <div class="contract-controls">
        <div class="contract-node-id" v-if="node.id">
          <code class="node-id-value">{{ node.id }}</code>
          <button @click="copyNodeId" class="btn-copy-id" :title="idCopied ? 'Copied!' : 'Copy Node ID'">
            {{ idCopied ? 'OK' : 'Copy' }}
          </button>
        </div>
        <template v-if="showControls">
          <button v-if="!isEditing" @click="toggleEditMode" class="btn-control">Edit</button>
          <button @click="exportContract" class="btn-control">Export</button>
          <button @click="deleteNode" class="btn-control btn-delete">Delete</button>
        </template>
      </div>
    </div>

    <!-- Edit Mode -->
    <div v-if="isEditing && showControls" class="contract-editor-section">
      <div class="editor-toolbar">
        <div class="toolbar-left">
          <label class="toolbar-label">Label:</label>
          <input v-model="editingLabel" type="text" class="contract-label-input" placeholder="Contract name" />
        </div>
        <div class="toolbar-actions">
          <button @click="saveContract" class="btn-save">Save</button>
          <button @click="cancelEdit" class="btn-cancel">Cancel</button>
        </div>
      </div>

      <!-- Contract Type -->
      <div class="editor-field">
        <label class="field-label">Contract Type</label>
        <select v-model="editingContract.type" class="field-select">
          <option value="html-node">HTML Node</option>
          <option value="fulltext">Fulltext</option>
          <option value="chart">Chart</option>
          <option value="composite">Composite</option>
        </select>
      </div>

      <!-- CSS Design System -->
      <div class="editor-section">
        <h4 class="section-heading">CSS Design System</h4>
        <div class="token-grid">
          <div v-for="(value, key) in editingContract.node?.css?.colorTokens || {}" :key="key" class="token-item">
            <div class="token-swatch" :style="{ background: value }"></div>
            <input v-model="editingContract.node.css.colorTokens[key]" class="token-input" />
            <span class="token-name">{{ key }}</span>
          </div>
        </div>
        <button @click="addColorToken" class="btn-add-token">+ Color Token</button>

        <div class="token-fields">
          <div class="field-row">
            <label class="field-label">Design System</label>
            <input v-model="editingContract.node.css.designSystem" class="field-input" placeholder="e.g., dark-glass" />
          </div>
          <div class="field-row">
            <label class="field-label">Border Radius</label>
            <input v-model="editingContract.node.css.borderRadius" class="field-input" placeholder="e.g., 18px" />
          </div>
          <div class="field-row">
            <label class="field-label">Font Stack</label>
            <input v-model="editingContract.node.css.fontStack" class="field-input" placeholder="e.g., system-ui, sans-serif" />
          </div>
        </div>
      </div>

      <!-- Features -->
      <div class="editor-section">
        <h4 class="section-heading">Features</h4>
        <div class="feature-toggles">
          <div v-for="(value, key) in editingContract.node?.features || {}" :key="key" class="feature-item">
            <label class="toggle-label">
              <input type="checkbox" v-model="editingContract.node.features[key]" class="toggle-input" />
              <span class="toggle-switch"></span>
              <span class="toggle-text">{{ formatFeatureName(key) }}</span>
            </label>
          </div>
        </div>
        <button @click="addFeature" class="btn-add-token">+ Feature</button>
      </div>

      <!-- Content Sections -->
      <div class="editor-section">
        <h4 class="section-heading">Content</h4>
        <div class="content-sections">
          <div v-for="(section, index) in editingContract.node?.content?.sections || []" :key="index" class="section-chip">
            {{ section }}
            <button @click="removeSection(index)" class="chip-remove">x</button>
          </div>
          <button @click="addSection" class="btn-add-token">+ Section</button>
        </div>
        <div class="field-row">
          <label class="field-label">Menu Mode</label>
          <select v-model="editingContract.node.content.menuMode" class="field-select">
            <option value="none">None</option>
            <option value="hamburger">Hamburger</option>
            <option value="sidebar">Sidebar</option>
            <option value="top">Top Bar</option>
          </select>
        </div>
        <div class="field-row">
          <label class="field-label">Image Strategy</label>
          <select v-model="editingContract.node.content.imageStrategy" class="field-select">
            <option value="pexels">Pexels</option>
            <option value="unsplash">Unsplash</option>
            <option value="none">None</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      <!-- Validation Rules -->
      <div class="editor-section">
        <h4 class="section-heading">Validation</h4>
        <div class="field-row">
          <label class="field-label">Max Size (KB)</label>
          <input v-model.number="editingContract.node.validation.maxSizeKb" type="number" class="field-input field-input-sm" />
        </div>
        <div class="field-row">
          <label class="field-label">Must Contain</label>
          <div class="validation-chips">
            <span v-for="(rule, index) in editingContract.node?.validation?.mustContain || []" :key="index" class="validation-chip">
              {{ rule }}
              <button @click="removeValidation(index)" class="chip-remove">x</button>
            </span>
          </div>
        </div>
      </div>

      <!-- Raw JSON Editor -->
      <div class="editor-section">
        <h4 class="section-heading" @click="showRawJson = !showRawJson" style="cursor: pointer">
          {{ showRawJson ? 'Hide' : 'Show' }} Raw JSON
        </h4>
        <textarea v-if="showRawJson" v-model="rawJsonText" class="raw-json-editor" rows="12"></textarea>
      </div>
    </div>

    <!-- Preview Mode -->
    <div v-else class="contract-preview">
      <!-- Contract Overview Cards -->
      <div class="preview-grid">
        <!-- CSS Design System Card -->
        <div class="preview-card">
          <div class="card-header">
            <span class="card-icon">CSS</span>
            <span class="card-title">Design System</span>
          </div>
          <div v-if="contractData.node?.css" class="card-body">
            <div class="design-system-name">{{ contractData.node.css.designSystem || 'custom' }}</div>
            <div class="color-swatches">
              <div
                v-for="(value, key) in contractData.node?.css?.colorTokens || {}"
                :key="key"
                class="swatch"
                :style="{ background: value }"
                :title="`${key}: ${value}`"
              ></div>
            </div>
            <div v-if="contractData.node.css.borderRadius" class="detail-row">
              <span class="detail-label">Radius</span>
              <span class="detail-value">{{ contractData.node.css.borderRadius }}</span>
            </div>
          </div>
          <div v-else class="card-empty">No CSS defined</div>
        </div>

        <!-- Features Card -->
        <div class="preview-card">
          <div class="card-header">
            <span class="card-icon">FT</span>
            <span class="card-title">Features</span>
          </div>
          <div v-if="contractData.node?.features" class="card-body">
            <div v-for="(value, key) in contractData.node.features" :key="key" class="feature-row">
              <span class="feature-indicator" :class="{ active: value }"></span>
              <span class="feature-name">{{ formatFeatureName(key) }}</span>
            </div>
          </div>
          <div v-else class="card-empty">No features defined</div>
        </div>

        <!-- Content Card -->
        <div class="preview-card">
          <div class="card-header">
            <span class="card-icon">CT</span>
            <span class="card-title">Content</span>
          </div>
          <div v-if="contractData.node?.content" class="card-body">
            <div class="section-chips-preview">
              <span v-for="section in contractData.node.content.sections || []" :key="section" class="section-chip-preview">
                {{ section }}
              </span>
            </div>
            <div v-if="contractData.node.content.menuMode" class="detail-row">
              <span class="detail-label">Menu</span>
              <span class="detail-value">{{ contractData.node.content.menuMode }}</span>
            </div>
            <div v-if="contractData.node.content.imageStrategy" class="detail-row">
              <span class="detail-label">Images</span>
              <span class="detail-value">{{ contractData.node.content.imageStrategy }}</span>
            </div>
          </div>
          <div v-else class="card-empty">No content defined</div>
        </div>

        <!-- Validation Card -->
        <div class="preview-card">
          <div class="card-header">
            <span class="card-icon">VL</span>
            <span class="card-title">Validation</span>
          </div>
          <div v-if="contractData.node?.validation" class="card-body">
            <div v-if="contractData.node.validation.maxSizeKb" class="detail-row">
              <span class="detail-label">Max Size</span>
              <span class="detail-value">{{ contractData.node.validation.maxSizeKb }}KB</span>
            </div>
            <div v-if="contractData.node.validation.mustContain?.length" class="detail-row">
              <span class="detail-label">Required</span>
              <span class="detail-value">{{ contractData.node.validation.mustContain.length }} rules</span>
            </div>
          </div>
          <div v-else class="card-empty">No validation</div>
        </div>
      </div>

      <!-- Safety & Parent info -->
      <div class="contract-meta-row">
        <div v-if="contractData.node?.safety" class="meta-badge safety-badge">
          Safety: {{ contractData.node.safety.sanitizer || 'none' }}
        </div>
        <div v-if="node.metadata?.parentContractId" class="meta-badge parent-badge">
          Inherits: {{ node.metadata.parentContractId }}
        </div>
        <div v-if="contractData.type" class="meta-badge type-badge">
          {{ contractData.type }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
  isPreview: { type: Boolean, default: false },
  showControls: { type: Boolean, default: true },
  graphData: { type: Object, default: () => ({ nodes: [], edges: [] }) },
  graphId: { type: String, default: '' }
})

const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// State
const isEditing = ref(false)
const idCopied = ref(false)
const showRawJson = ref(false)
const editingLabel = ref('')
const editingContract = ref({})
const rawJsonText = ref('')

// Parse contract data from node.info (JSON string)
const contractData = computed(() => {
  try {
    if (typeof props.node.info === 'string' && props.node.info.trim()) {
      return JSON.parse(props.node.info)
    }
    if (typeof props.node.info === 'object' && props.node.info) {
      return props.node.info
    }
  } catch { /* ignore parse errors */ }
  return {}
})

// Helpers
function formatFeatureName(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
}

function copyNodeId() {
  navigator.clipboard.writeText(props.node.id).then(() => {
    idCopied.value = true
    setTimeout(() => { idCopied.value = false }, 2000)
  })
}

function ensureNestedPaths(obj) {
  if (!obj.node) obj.node = {}
  if (!obj.node.css) obj.node.css = {}
  if (!obj.node.css.colorTokens) obj.node.css.colorTokens = {}
  if (!obj.node.features) obj.node.features = {}
  if (!obj.node.content) obj.node.content = { sections: [] }
  if (!obj.node.content.sections) obj.node.content.sections = []
  if (!obj.node.validation) obj.node.validation = { mustContain: [], maxSizeKb: 200 }
  if (!obj.node.validation.mustContain) obj.node.validation.mustContain = []
  if (!obj.node.safety) obj.node.safety = {}
  return obj
}

// Edit mode
function toggleEditMode() {
  if (!props.showControls) return
  isEditing.value = true
  editingLabel.value = props.node.label || ''
  const parsed = JSON.parse(JSON.stringify(contractData.value))
  editingContract.value = ensureNestedPaths(parsed)
  rawJsonText.value = JSON.stringify(editingContract.value, null, 2)
}

function saveContract() {
  // If raw JSON was edited, try to use it
  if (showRawJson.value) {
    try {
      editingContract.value = ensureNestedPaths(JSON.parse(rawJsonText.value))
    } catch {
      alert('Invalid JSON in raw editor. Fix the JSON or close the raw editor before saving.')
      return
    }
  }

  const updatedNode = {
    ...props.node,
    label: editingLabel.value || 'Untitled Contract',
    info: JSON.stringify(editingContract.value, null, 2)
  }
  emit('node-updated', updatedNode)
  isEditing.value = false
  showRawJson.value = false
}

function cancelEdit() {
  isEditing.value = false
  showRawJson.value = false
}

function deleteNode() {
  if (!props.showControls) return
  if (confirm('Delete this agent contract node?')) {
    emit('node-deleted', props.node.id)
  }
}

function exportContract() {
  const content = typeof props.node.info === 'string' ? props.node.info : JSON.stringify(contractData.value, null, 2)
  const filename = (props.node.label || 'agent-contract').replace(/\s+/g, '-') + '.json'
  const el = document.createElement('a')
  el.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(content))
  el.setAttribute('download', filename)
  el.style.display = 'none'
  document.body.appendChild(el)
  el.click()
  document.body.removeChild(el)
}

// Dynamic editors
function addColorToken() {
  const name = prompt('Token name (e.g., --accent2):')
  if (!name) return
  editingContract.value.node.css.colorTokens[name] = '#7c3aed'
}

function addFeature() {
  const name = prompt('Feature name (e.g., animations):')
  if (!name) return
  editingContract.value.node.features[name] = false
}

function addSection() {
  const name = prompt('Section name (e.g., hero, pricing):')
  if (!name) return
  editingContract.value.node.content.sections.push(name)
}

function removeSection(index) {
  editingContract.value.node.content.sections.splice(index, 1)
}

function removeValidation(index) {
  editingContract.value.node.validation.mustContain.splice(index, 1)
}
</script>

<style scoped>
.gnew-agent-contract-node {
  margin-bottom: 20px;
}

/* Header */
.contract-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.3);
  border-radius: 8px;
}

.contract-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.contract-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: #a78bfa;
}

.contract-type-badge {
  display: inline-block;
  padding: 4px 8px;
  background: rgba(124, 58, 237, 0.2);
  border: 1px solid rgba(124, 58, 237, 0.4);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #a78bfa;
  text-transform: uppercase;
}

.contract-version {
  font-size: 0.75rem;
  color: rgba(167, 139, 250, 0.7);
  padding: 4px 8px;
  background: rgba(124, 58, 237, 0.1);
  border-radius: 4px;
}

.contract-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.contract-node-id {
  display: flex;
  align-items: center;
  gap: 4px;
}

.node-id-value {
  font-size: 0.7rem;
  color: rgba(167, 139, 250, 0.7);
  background: rgba(124, 58, 237, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-copy-id {
  background: none;
  border: 1px solid rgba(124, 58, 237, 0.3);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.7rem;
  cursor: pointer;
  color: rgba(167, 139, 250, 0.7);
}

.btn-control {
  background: rgba(55, 65, 81, 0.5);
  border: 1px solid rgba(107, 114, 128, 0.3);
  padding: 6px 12px;
  font-size: 0.85rem;
  border-radius: 6px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  transition: all 0.2s;
}

.btn-control:hover {
  background: rgba(55, 65, 81, 0.8);
  border-color: rgba(167, 139, 250, 0.5);
}

.btn-control.btn-delete {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.3);
  color: rgba(248, 113, 113, 0.9);
}

.btn-control.btn-delete:hover {
  background: rgba(248, 113, 113, 0.25);
}

/* Edit Mode */
.contract-editor-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background: rgba(55, 65, 81, 0.5);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 8px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.toolbar-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
}

.contract-label-input {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  font-size: 0.9rem;
  min-width: 250px;
}

.contract-label-input:focus {
  outline: none;
  border-color: #a78bfa;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.btn-save {
  background: rgba(74, 222, 128, 0.2);
  border: 1px solid rgba(74, 222, 128, 0.4);
  color: rgba(74, 222, 128, 0.9);
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-save:hover {
  background: rgba(74, 222, 128, 0.3);
}

.btn-cancel {
  background: rgba(248, 113, 113, 0.2);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: rgba(248, 113, 113, 0.9);
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-cancel:hover {
  background: rgba(248, 113, 113, 0.3);
}

/* Editor sections */
.editor-section {
  padding: 16px;
  background: rgba(55, 65, 81, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 8px;
}

.section-heading {
  margin: 0 0 12px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(167, 139, 250, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.editor-field {
  padding: 12px;
  background: rgba(55, 65, 81, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 8px;
}

/* Color Tokens */
.token-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.token-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.token-swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

.token-input {
  width: 80px;
  padding: 4px 6px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #fff;
  font-family: monospace;
  font-size: 0.8rem;
}

.token-name {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-add-token {
  background: rgba(124, 58, 237, 0.15);
  border: 1px dashed rgba(124, 58, 237, 0.4);
  color: rgba(167, 139, 250, 0.8);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-add-token:hover {
  background: rgba(124, 58, 237, 0.25);
}

/* Token fields */
.token-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

/* Field rows */
.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  min-width: 120px;
}

.field-input {
  flex: 1;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #fff;
  font-size: 0.85rem;
}

.field-input:focus {
  outline: none;
  border-color: #a78bfa;
}

.field-input-sm {
  max-width: 100px;
}

.field-select {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #fff;
  font-size: 0.85rem;
}

/* Feature toggles */
.feature-toggles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.feature-item {
  padding: 4px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
}

.toggle-input {
  display: none;
}

.toggle-switch {
  width: 36px;
  height: 20px;
  background: rgba(107, 114, 128, 0.5);
  border-radius: 10px;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-input:checked + .toggle-switch {
  background: rgba(74, 222, 128, 0.6);
}

.toggle-input:checked + .toggle-switch::after {
  transform: translateX(16px);
}

/* Content sections */
.content-sections {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.section-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(96, 165, 250, 0.2);
  border: 1px solid rgba(96, 165, 250, 0.4);
  border-radius: 16px;
  font-size: 0.8rem;
  color: rgba(96, 165, 250, 0.9);
}

.chip-remove {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0 2px;
}

.chip-remove:hover {
  color: rgba(248, 113, 113, 0.9);
}

/* Validation chips */
.validation-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.validation-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 12px;
  font-size: 0.75rem;
  color: rgba(251, 191, 36, 0.9);
  font-family: monospace;
}

/* Raw JSON */
.raw-json-editor {
  width: 100%;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  resize: vertical;
}

/* Preview Mode */
.contract-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.preview-card {
  background: rgba(55, 65, 81, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 10px;
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(124, 58, 237, 0.1);
  border-bottom: 1px solid rgba(107, 114, 128, 0.2);
}

.card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(124, 58, 237, 0.3);
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 700;
  color: #c4b5fd;
}

.card-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.card-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-empty {
  padding: 12px 14px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
}

/* Design system preview */
.design-system-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #c4b5fd;
}

.color-swatches {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Feature preview */
.feature-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.feature-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(248, 113, 113, 0.6);
}

.feature-indicator.active {
  background: rgba(74, 222, 128, 0.8);
}

.feature-name {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
}

/* Content preview */
.section-chips-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.section-chip-preview {
  padding: 3px 8px;
  background: rgba(96, 165, 250, 0.15);
  border-radius: 10px;
  font-size: 0.75rem;
  color: rgba(96, 165, 250, 0.9);
}

/* Detail rows */
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.detail-value {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

/* Meta row */
.contract-meta-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.safety-badge {
  background: rgba(74, 222, 128, 0.15);
  color: rgba(74, 222, 128, 0.9);
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.parent-badge {
  background: rgba(251, 191, 36, 0.15);
  color: rgba(251, 191, 36, 0.9);
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.type-badge {
  background: rgba(124, 58, 237, 0.15);
  color: rgba(167, 139, 250, 0.9);
  border: 1px solid rgba(124, 58, 237, 0.3);
}
</style>
