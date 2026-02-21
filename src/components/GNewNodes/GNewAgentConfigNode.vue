<template>
  <div class="gnew-agent-config-node">
    <!-- Header -->
    <div class="config-header">
      <div class="config-title-wrap">
        <h3 v-if="node.label" class="config-title">{{ node.label }}</h3>
        <div class="config-type-badge">Agent Config</div>
        <div v-if="configData.model" class="config-model-badge">{{ configData.model }}</div>
      </div>
      <div class="config-controls">
        <div class="config-node-id" v-if="node.id">
          <code class="node-id-value">{{ node.id }}</code>
          <button @click="copyNodeId" class="btn-copy-id">{{ idCopied ? 'OK' : 'Copy' }}</button>
        </div>
        <template v-if="showControls">
          <button v-if="!isEditing" @click="toggleEditMode" class="btn-control">Edit</button>
          <button @click="exportConfig" class="btn-control">Export</button>
          <button @click="deleteNode" class="btn-control btn-delete">Delete</button>
        </template>
      </div>
    </div>

    <!-- Edit Mode -->
    <div v-if="isEditing && showControls" class="config-editor-section">
      <div class="editor-toolbar">
        <div class="toolbar-left">
          <label class="toolbar-label">Label:</label>
          <input v-model="editingLabel" type="text" class="config-label-input" placeholder="Agent name" />
        </div>
        <div class="toolbar-actions">
          <button @click="saveConfig" class="btn-save">Save</button>
          <button @click="cancelEdit" class="btn-cancel">Cancel</button>
        </div>
      </div>

      <!-- Agent Name & Description -->
      <div class="editor-section">
        <h4 class="section-heading">Identity</h4>
        <div class="field-row">
          <label class="field-label">Agent Name</label>
          <input v-model="editingConfig.name" class="field-input" placeholder="e.g., HTML Builder Agent" />
        </div>
        <div class="field-row">
          <label class="field-label">Description</label>
          <input v-model="editingConfig.description" class="field-input" placeholder="What does this agent do?" />
        </div>
        <div class="field-row">
          <label class="field-label">Agent ID</label>
          <input v-model="editingConfig.id" class="field-input field-mono" placeholder="e.g., agent_kg_html_builder" />
        </div>
      </div>

      <!-- Model Settings -->
      <div class="editor-section">
        <h4 class="section-heading">Model</h4>
        <div class="model-grid">
          <div class="field-row">
            <label class="field-label">Model</label>
            <select v-model="editingConfig.model" class="field-select">
              <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
              <option value="claude-opus-4-6">Claude Opus 4.6</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
            </select>
          </div>
          <div class="field-row">
            <label class="field-label">Max Tokens</label>
            <input v-model.number="editingConfig.max_tokens" type="number" class="field-input field-input-sm" />
          </div>
          <div class="field-row">
            <label class="field-label">Temperature: <span class="temp-value">{{ editingConfig.temperature }}</span></label>
            <input v-model.number="editingConfig.temperature" type="range" min="0" max="1" step="0.1" class="temp-slider" />
          </div>
        </div>
      </div>

      <!-- System Prompt -->
      <div class="editor-section">
        <h4 class="section-heading">System Prompt</h4>
        <textarea v-model="editingConfig.system_prompt" class="prompt-editor" rows="8" placeholder="Enter the agent's system prompt..."></textarea>
        <div class="prompt-stats">
          <span>{{ (editingConfig.system_prompt || '').length }} chars</span>
          <span>~{{ Math.ceil((editingConfig.system_prompt || '').length / 4) }} tokens</span>
        </div>
      </div>

      <!-- Tools -->
      <div class="editor-section">
        <h4 class="section-heading">Registered Tools</h4>
        <div class="tools-list">
          <div v-for="(tool, index) in editingConfig.tools || []" :key="index" class="tool-chip">
            <span class="tool-name">{{ tool }}</span>
            <button @click="removeTool(index)" class="chip-remove">x</button>
          </div>
          <button @click="addTool" class="btn-add-tool">+ Tool</button>
        </div>
      </div>

      <!-- Default Contract -->
      <div class="editor-section">
        <h4 class="section-heading">Default Contract</h4>
        <div class="field-row">
          <label class="field-label">Contract ID</label>
          <input v-model="editingConfig.default_contract_id" class="field-input field-mono" placeholder="e.g., contract_dark_glass" />
        </div>
      </div>
    </div>

    <!-- Preview Mode -->
    <div v-else class="config-preview">
      <!-- Agent Identity -->
      <div class="identity-section">
        <div v-if="configData.description" class="agent-description">{{ configData.description }}</div>
      </div>

      <!-- Model & Settings Cards -->
      <div class="preview-grid">
        <!-- Model Card -->
        <div class="preview-card">
          <div class="card-header">
            <span class="card-icon model-icon">AI</span>
            <span class="card-title">Model</span>
          </div>
          <div class="card-body">
            <div class="model-name">{{ formatModelName(configData.model) }}</div>
            <div class="settings-row">
              <div class="setting">
                <span class="setting-label">Tokens</span>
                <span class="setting-value">{{ configData.max_tokens || 4096 }}</span>
              </div>
              <div class="setting">
                <span class="setting-label">Temp</span>
                <span class="setting-value">{{ configData.temperature ?? 0.7 }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tools Card -->
        <div class="preview-card">
          <div class="card-header">
            <span class="card-icon tools-icon">TL</span>
            <span class="card-title">Tools</span>
            <span class="card-count">{{ (configData.tools || []).length }}</span>
          </div>
          <div class="card-body">
            <div class="tools-preview">
              <span v-for="tool in configData.tools || []" :key="tool" class="tool-badge">{{ tool }}</span>
            </div>
            <div v-if="!(configData.tools || []).length" class="card-empty-text">No tools registered</div>
          </div>
        </div>

        <!-- Contract Card -->
        <div class="preview-card">
          <div class="card-header">
            <span class="card-icon contract-icon">CT</span>
            <span class="card-title">Contract</span>
          </div>
          <div class="card-body">
            <div v-if="configData.default_contract_id" class="contract-ref">
              <code>{{ configData.default_contract_id }}</code>
            </div>
            <div v-else class="card-empty-text">No default contract</div>
          </div>
        </div>
      </div>

      <!-- System Prompt Preview -->
      <div class="prompt-preview-section">
        <div class="prompt-preview-header">
          <span class="prompt-label">System Prompt</span>
          <span class="prompt-length">{{ (configData.system_prompt || '').length }} chars</span>
        </div>
        <div v-if="configData.system_prompt" class="prompt-preview-content">
          <pre>{{ promptPreview }}</pre>
        </div>
        <div v-else class="prompt-empty">No system prompt defined</div>
      </div>

      <!-- Status -->
      <div class="config-status-row">
        <div class="status-badge" :class="{ active: configData.is_active !== false }">
          {{ configData.is_active !== false ? 'Active' : 'Inactive' }}
        </div>
        <div v-if="configData.id" class="agent-id-badge">
          ID: {{ configData.id }}
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
const editingLabel = ref('')
const editingConfig = ref({})

// Parse config from node.info
const configData = computed(() => {
  try {
    if (typeof props.node.info === 'string' && props.node.info.trim()) {
      return JSON.parse(props.node.info)
    }
    if (typeof props.node.info === 'object' && props.node.info) {
      return props.node.info
    }
  } catch { /* ignore */ }
  return {}
})

const promptPreview = computed(() => {
  const prompt = configData.value.system_prompt || ''
  if (prompt.length > 400) return prompt.substring(0, 400) + '\n\n... (truncated)'
  return prompt
})

// Helpers
function formatModelName(model) {
  if (!model) return 'Not set'
  if (model.includes('sonnet')) return 'Sonnet 4.5'
  if (model.includes('opus')) return 'Opus 4.6'
  if (model.includes('haiku')) return 'Haiku 4.5'
  return model
}

function copyNodeId() {
  navigator.clipboard.writeText(props.node.id).then(() => {
    idCopied.value = true
    setTimeout(() => { idCopied.value = false }, 2000)
  })
}

// Edit mode
function toggleEditMode() {
  if (!props.showControls) return
  isEditing.value = true
  editingLabel.value = props.node.label || ''
  editingConfig.value = JSON.parse(JSON.stringify(configData.value))
  if (!editingConfig.value.tools) editingConfig.value.tools = []
}

function saveConfig() {
  const updatedNode = {
    ...props.node,
    label: editingLabel.value || 'Untitled Agent',
    info: JSON.stringify(editingConfig.value, null, 2)
  }
  emit('node-updated', updatedNode)
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
}

function deleteNode() {
  if (!props.showControls) return
  if (confirm('Delete this agent config node?')) {
    emit('node-deleted', props.node.id)
  }
}

function exportConfig() {
  const content = typeof props.node.info === 'string' ? props.node.info : JSON.stringify(configData.value, null, 2)
  const filename = (props.node.label || 'agent-config').replace(/\s+/g, '-') + '.json'
  const el = document.createElement('a')
  el.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(content))
  el.setAttribute('download', filename)
  el.style.display = 'none'
  document.body.appendChild(el)
  el.click()
  document.body.removeChild(el)
}

function addTool() {
  const available = ['create_graph', 'create_html_node', 'get_contract']
  const name = prompt(`Tool name:\nAvailable: ${available.join(', ')}`)
  if (!name) return
  if (!editingConfig.value.tools) editingConfig.value.tools = []
  editingConfig.value.tools.push(name)
}

function removeTool(index) {
  editingConfig.value.tools.splice(index, 1)
}
</script>

<style scoped>
.gnew-agent-config-node {
  margin-bottom: 20px;
}

/* Header */
.config-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
}

.config-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: #60a5fa;
}

.config-type-badge {
  display: inline-block;
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #60a5fa;
  text-transform: uppercase;
}

.config-model-badge {
  font-size: 0.7rem;
  color: rgba(96, 165, 250, 0.7);
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 4px;
  font-family: monospace;
}

.config-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.config-node-id {
  display: flex;
  align-items: center;
  gap: 4px;
}

.node-id-value {
  font-size: 0.7rem;
  color: rgba(96, 165, 250, 0.7);
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-copy-id {
  background: none;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.7rem;
  cursor: pointer;
  color: rgba(96, 165, 250, 0.7);
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
  border-color: rgba(96, 165, 250, 0.5);
}

.btn-control.btn-delete {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.3);
  color: rgba(248, 113, 113, 0.9);
}

/* Editor */
.config-editor-section {
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

.config-label-input {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  font-size: 0.9rem;
  min-width: 250px;
}

.config-label-input:focus {
  outline: none;
  border-color: #60a5fa;
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

.btn-cancel {
  background: rgba(248, 113, 113, 0.2);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: rgba(248, 113, 113, 0.9);
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
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
  color: rgba(96, 165, 250, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

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
  border-color: #60a5fa;
}

.field-input-sm {
  max-width: 120px;
}

.field-mono {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8rem;
}

.field-select {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #fff;
  font-size: 0.85rem;
}

/* Model settings */
.model-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.temp-value {
  font-weight: 700;
  color: #60a5fa;
}

.temp-slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: rgba(107, 114, 128, 0.3);
  -webkit-appearance: none;
  appearance: none;
}

.temp-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #60a5fa;
  cursor: pointer;
}

/* Prompt editor */
.prompt-editor {
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

.prompt-stats {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

/* Tools */
.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tool-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 16px;
  font-size: 0.8rem;
  color: rgba(96, 165, 250, 0.9);
  font-family: monospace;
}

.chip-remove {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 0.8rem;
}

.chip-remove:hover {
  color: rgba(248, 113, 113, 0.9);
}

.btn-add-tool {
  background: rgba(59, 130, 246, 0.15);
  border: 1px dashed rgba(59, 130, 246, 0.4);
  color: rgba(96, 165, 250, 0.8);
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 0.8rem;
  cursor: pointer;
}

/* Preview Mode */
.config-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.identity-section {
  padding: 0 0 4px 0;
}

.agent-description {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
  background: rgba(59, 130, 246, 0.1);
  border-bottom: 1px solid rgba(107, 114, 128, 0.2);
}

.card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 700;
}

.model-icon {
  background: rgba(59, 130, 246, 0.3);
  color: #93c5fd;
}

.tools-icon {
  background: rgba(74, 222, 128, 0.3);
  color: #86efac;
}

.contract-icon {
  background: rgba(124, 58, 237, 0.3);
  color: #c4b5fd;
}

.card-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  flex: 1;
}

.card-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 8px;
}

.card-body {
  padding: 12px 14px;
}

.card-empty-text {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
}

/* Model preview */
.model-name {
  font-size: 1rem;
  font-weight: 600;
  color: #93c5fd;
  margin-bottom: 8px;
}

.settings-row {
  display: flex;
  gap: 16px;
}

.setting {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}

.setting-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

/* Tools preview */
.tools-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tool-badge {
  padding: 3px 8px;
  background: rgba(74, 222, 128, 0.15);
  border-radius: 10px;
  font-size: 0.7rem;
  color: rgba(74, 222, 128, 0.9);
  font-family: monospace;
}

/* Contract ref */
.contract-ref code {
  font-size: 0.8rem;
  color: #c4b5fd;
  background: rgba(124, 58, 237, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
}

/* Prompt preview */
.prompt-preview-section {
  background: rgba(55, 65, 81, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 10px;
  overflow: hidden;
}

.prompt-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(59, 130, 246, 0.05);
  border-bottom: 1px solid rgba(107, 114, 128, 0.2);
}

.prompt-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.prompt-length {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.prompt-preview-content {
  padding: 12px 14px;
  max-height: 200px;
  overflow: auto;
}

.prompt-preview-content pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.prompt-empty {
  padding: 12px 14px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
}

/* Status row */
.config-status-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  background: rgba(248, 113, 113, 0.15);
  color: rgba(248, 113, 113, 0.9);
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.status-badge.active {
  background: rgba(74, 222, 128, 0.15);
  color: rgba(74, 222, 128, 0.9);
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.agent-id-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  background: rgba(59, 130, 246, 0.15);
  color: rgba(96, 165, 250, 0.9);
  border: 1px solid rgba(59, 130, 246, 0.3);
  font-family: monospace;
}
</style>
