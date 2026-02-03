<template>
  <div class="gnew-css-node">
    <!-- Header -->
    <div class="css-header">
      <div class="css-title-wrap">
        <h3 v-if="node.label" class="css-title">🎨 {{ node.label }}</h3>
        <div v-if="node.type" class="css-type-badge">CSS Node</div>
      </div>
      <div v-if="showControls" class="css-controls">
        <button v-if="!isEditing" @click="toggleEditMode" class="btn-control" title="Edit CSS">
          ✏️ Edit
        </button>
        <button @click="exportCss" class="btn-control" title="Export CSS">
          📥 Export
        </button>
        <button @click="deleteNode" class="btn-control btn-delete" title="Delete CSS Node">
          🗑️ Delete
        </button>
      </div>
    </div>

    <!-- Edit Mode -->
    <div v-if="isEditing && showControls" class="css-editor-section">
      <div class="css-editor-toolbar">
        <div class="toolbar-left">
          <label for="css-label-input" class="toolbar-label">Node Label:</label>
          <input
            id="css-label-input"
            v-model="editingLabel"
            type="text"
            class="css-label-input"
            placeholder="e.g., Connect HTML Styles"
          />
        </div>
        <div class="toolbar-actions">
          <button @click="saveCss" class="btn-save" title="Save CSS Node">
            ✅ Save
          </button>
          <button @click="cancelEdit" class="btn-cancel" title="Cancel editing">
            ❌ Cancel
          </button>
        </div>
      </div>

      <!-- Monaco Editor or Fallback -->
      <div v-if="!monacoError" class="monaco-editor-wrapper">
        <div v-if="isMonacoLoading" class="monaco-loading">
          <p>Loading CSS Editor...</p>
        </div>
        <Editor
          v-show="!isMonacoLoading"
          v-model="editingCss"
          language="css"
          theme="vs-dark"
          :options="editorOptions"
          @change="onEditorChange"
          @mount="onEditorMount"
          height="500px"
          :path="`css-${node.id}.css`"
        />
      </div>

      <!-- Fallback Text Editor (if Monaco fails to load) -->
      <div v-else class="css-editor-fallback">
        <p class="fallback-warning">⚠️ Monaco Editor failed to load. Using fallback text editor:</p>
        <textarea
          v-model="editingCss"
          class="fallback-textarea"
          placeholder="Enter CSS code here..."
          @input="onEditorChange($event.target.value)"
        ></textarea>
      </div>

      <!-- CSS Metadata Controls -->
      <div class="css-metadata-section">
        <div class="metadata-group">
          <label for="applies-to-select" class="metadata-label">Applied To:</label>
          <div class="applies-to-controls">
            <select
              id="applies-to-select"
              v-model="editingAppliesTo"
              class="applies-to-select"
            >
              <option value="*">All HTML Nodes (*)</option>
              <option value="specific">Specific HTML Nodes</option>
            </select>
            <span v-if="editingAppliesTo === '*'" class="applies-to-badge">✓ Global</span>
          </div>
        </div>

        <div class="metadata-group">
          <label for="priority-slider" class="metadata-label"
            >Priority: <span class="priority-value">{{ editingPriority }}</span></label
          >
          <input
            id="priority-slider"
            v-model.number="editingPriority"
            type="range"
            min="0"
            max="999"
            class="priority-slider"
            title="Lower priority loads CSS first (0 = highest priority)"
          />
          <div class="priority-hint">Lower value = loads first (highest priority)</div>
        </div>
      </div>

      <!-- CSS Stats -->
      <div class="css-stats">
        <div class="stat-item">
          <span class="stat-label">Lines:</span>
          <span class="stat-value">{{ cssLineCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Size:</span>
          <span class="stat-value">{{ cssSize }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Selectors:</span>
          <span class="stat-value">{{ selectorCount }}</span>
        </div>
      </div>
    </div>

    <!-- Preview Mode -->
    <div v-else class="css-preview-section">
      <div class="preview-header">
        <h4>CSS Preview</h4>
        <span class="preview-meta">{{ node.info ? node.info.length + ' characters' : 'Empty' }}</span>
      </div>

      <div v-if="node.info" class="css-preview-content">
        <div class="preview-stats">
          <div class="stat">
            <span class="label">Lines:</span>
            <span class="value">{{ cssLineCount }}</span>
          </div>
          <div class="stat">
            <span class="label">Size:</span>
            <span class="value">{{ cssSize }}</span>
          </div>
          <div class="stat">
            <span class="label">Selectors:</span>
            <span class="value">{{ selectorCount }}</span>
          </div>
          <div class="stat">
            <span class="label">Applied To:</span>
            <span class="value">{{ appliesTo === '*' ? 'All HTML Nodes' : 'Specific Nodes' }}</span>
          </div>
          <div class="stat">
            <span class="label">Priority:</span>
            <span class="value">{{ priority || 100 }}</span>
          </div>
        </div>

        <div class="css-code-preview">
          <pre><code>{{ cssPreview }}</code></pre>
        </div>
      </div>

      <div v-else class="css-empty">
        <p>No CSS content yet. Click "Edit" to add CSS styles.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Editor from '@monaco-editor/react'
import { useUserStore } from '../../stores/userStore'

// Configure Monaco Editor to use CDN with proper worker setup
if (typeof window !== 'undefined') {
  const monacoPath = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.48.0/min/vs'

  window.MonacoEnvironment = {
    getWorkerUrl: (moduleId, label) => {
      if (label === 'json') {
        return `${monacoPath}/language/json/json.worker.js`
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return `${monacoPath}/language/css/css.worker.js`
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return `${monacoPath}/language/html/html.worker.js`
      }
      if (label === 'typescript' || label === 'javascript') {
        return `${monacoPath}/language/typescript/ts.worker.js`
      }
      return `${monacoPath}/editor/editor.worker.js`
    }
  }
}

const userStore = useUserStore()

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  showControls: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['node-deleted', 'node-updated'])

// State
const isEditing = ref(false)
const editingCss = ref('')
const editingLabel = ref('')
const editingAppliesTo = ref('*')
const editingPriority = ref(100)
const isMonacoLoading = ref(true)
const monacoError = ref(false)
const loadingTimeout = ref(null)

// Monaco Editor options
const editorOptions = {
  minimap: { enabled: false },
  fontSize: 14,
  lineNumbers: 'on',
  automaticLayout: true,
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  tabSize: 2,
  theme: 'vs-dark',
  padding: { top: 10, bottom: 10 }
}

// Get original metadata
const priority = computed(() => props.node.metadata?.priority ?? 100)
const appliesTo = computed(() => {
  const appliesToArray = props.node.metadata?.appliesTo
  if (Array.isArray(appliesToArray) && appliesToArray.includes('*')) {
    return '*'
  }
  return 'specific'
})

// CSS Analysis
const cssLineCount = computed(() => {
  const css = isEditing.value ? editingCss.value : (props.node.info || '')
  return css.split('\n').length
})

const cssSize = computed(() => {
  const css = isEditing.value ? editingCss.value : (props.node.info || '')
  const bytes = new Blob([css]).size
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
})

const selectorCount = computed(() => {
  const css = isEditing.value ? editingCss.value : (props.node.info || '')
  // Simple regex to count selectors (comma-separated)
  const matches = css.match(/[^{}]+\s*{/g)
  if (!matches) return 0
  return matches.reduce((count, match) => {
    return count + match.split(',').length
  }, 0)
})

const cssPreview = computed(() => {
  const css = props.node.info || ''
  if (css.length > 500) {
    return css.substring(0, 500) + '\n\n/* ... CSS truncated ... */'
  }
  return css
})

// Methods
function toggleEditMode() {
  if (!props.showControls) return
  isEditing.value = true
  editingCss.value = props.node.info || ''
  editingLabel.value = props.node.label || ''
  editingAppliesTo.value = appliesTo.value
  editingPriority.value = priority.value
}

function onEditorChange(value) {
  editingCss.value = value
}

function onEditorMount(editor) {
  console.log('✅ Monaco Editor mounted successfully')
  isMonacoLoading.value = false
  monacoError.value = false
  if (loadingTimeout.value) {
    clearTimeout(loadingTimeout.value)
  }
  // Set editor focus
  if (editor && editor.focus) {
    editor.focus()
  }
}

function onEditorError(error) {
  console.error('❌ Monaco Editor error:', error)
  monacoError.value = true
  isMonacoLoading.value = false
  if (loadingTimeout.value) {
    clearTimeout(loadingTimeout.value)
  }
}

async function saveCss() {
  // Update node data
  const updatedNode = {
    ...props.node,
    label: editingLabel.value || 'Untitled CSS',
    info: editingCss.value,
    metadata: {
      ...props.node.metadata,
      appliesTo: editingAppliesTo.value === '*' ? ['*'] : (props.node.metadata?.appliesTo || ['*']),
      priority: editingPriority.value
    }
  }

  emit('node-updated', updatedNode)
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
}

function exportCss() {
  const css = props.node.info || ''
  if (!css) {
    alert('No CSS content to export.')
    return
  }

  const filename = (props.node.label || 'css-node').replace(/\s+/g, '-') + '.css'
  const element = document.createElement('a')
  element.setAttribute('href', 'data:text/css;charset=utf-8,' + encodeURIComponent(css))
  element.setAttribute('download', filename)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

function deleteNode() {
  if (!props.showControls) return
  if (confirm('Are you sure you want to delete this CSS node?')) {
    emit('node-deleted', props.node.id)
  }
}

onMounted(() => {
  // Set a timeout to fallback to textarea if Monaco doesn't load in 5 seconds
  loadingTimeout.value = setTimeout(() => {
    if (isMonacoLoading.value) {
      console.warn('⚠️ Monaco Editor failed to load within 5 seconds. Switching to fallback editor.')
      monacoError.value = true
      isMonacoLoading.value = false
    }
  }, 5000)
})

onBeforeUnmount(() => {
  // Cleanup timeout
  if (loadingTimeout.value) {
    clearTimeout(loadingTimeout.value)
  }
})
</script>

<style scoped>
.gnew-css-node {
  margin-bottom: 20px;
}

.css-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 8px;
}

.css-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.css-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: #a78bfa;
}

.css-type-badge {
  display: inline-block;
  padding: 4px 8px;
  background: rgba(167, 139, 250, 0.2);
  border: 1px solid rgba(167, 139, 250, 0.4);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #a78bfa;
  text-transform: uppercase;
}

.css-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-control {
  background: #f1f3f5;
  border: 1px solid #dee2e6;
  padding: 6px 12px;
  font-size: 0.85rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-control:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.btn-control.btn-delete {
  background: #ffe3e3;
  border-color: #ffa8a8;
  color: #c92a2a;
}

.btn-control.btn-delete:hover {
  background: #ffc9c9;
  border-color: #ff8787;
}

/* Edit Mode */
.css-editor-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.css-editor-toolbar {
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

.css-label-input {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  font-size: 0.9rem;
  min-width: 250px;
}

.css-label-input:focus {
  outline: none;
  border-color: #a78bfa;
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.1);
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
  transition: all 0.2s;
}

.btn-save:hover {
  background: rgba(74, 222, 128, 0.3);
  border-color: rgba(74, 222, 128, 0.6);
}

.btn-cancel {
  background: rgba(248, 113, 113, 0.2);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: rgba(248, 113, 113, 0.9);
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: rgba(248, 113, 113, 0.3);
  border-color: rgba(248, 113, 113, 0.6);
}

/* Monaco Editor Container */
.monaco-editor-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(17, 24, 39, 0.8);
  min-height: 400px;
  height: 500px;
  width: 100%;
}

.monaco-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 24, 39, 0.9);
  z-index: 10;
  border-radius: 8px;
}

.monaco-loading p {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}

/* Fallback CSS Editor */
.css-editor-fallback {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 8px;
  padding: 12px;
  background: rgba(17, 24, 39, 0.8);
}

.fallback-warning {
  margin: 0;
  padding: 8px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: 6px;
  color: rgba(248, 113, 113, 0.9);
  font-size: 0.85rem;
  font-weight: 500;
}

.fallback-textarea {
  width: 100%;
  height: 500px;
  padding: 12px;
  font-family: 'Fira Code', 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 6px;
  color: #e5e7eb;
  resize: vertical;
}

.fallback-textarea:focus {
  outline: none;
  border-color: #a78bfa;
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.1);
}

/* CSS Metadata */
.css-metadata-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 12px;
  background: rgba(55, 65, 81, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 8px;
}

.metadata-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metadata-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.applies-to-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.applies-to-select {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  font-size: 0.9rem;
  flex: 1;
}

.applies-to-select:focus {
  outline: none;
  border-color: #a78bfa;
}

.applies-to-badge {
  display: inline-block;
  padding: 4px 8px;
  background: rgba(74, 222, 128, 0.2);
  border: 1px solid rgba(74, 222, 128, 0.4);
  border-radius: 4px;
  font-size: 0.75rem;
  color: rgba(74, 222, 128, 0.9);
  white-space: nowrap;
}

.priority-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(107, 114, 128, 0.3);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.priority-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #a78bfa;
  cursor: pointer;
  transition: all 0.2s;
}

.priority-slider::-webkit-slider-thumb:hover {
  background: #c4b5fd;
  box-shadow: 0 0 0 6px rgba(167, 139, 250, 0.2);
}

.priority-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #a78bfa;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.priority-slider::-moz-range-thumb:hover {
  background: #c4b5fd;
  box-shadow: 0 0 0 6px rgba(167, 139, 250, 0.2);
}

.priority-value {
  font-weight: 700;
  color: #a78bfa;
}

.priority-hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

/* CSS Stats */
.css-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 12px;
  background: rgba(55, 65, 81, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #a78bfa;
}

/* Preview Mode */
.css-preview-section {
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 8px;
  padding: 16px;
  background: rgba(55, 65, 81, 0.2);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.preview-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.preview-meta {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}

.css-preview-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.stat .label {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
}

.stat .value {
  font-size: 1rem;
  font-weight: 700;
  color: #a78bfa;
}

.css-code-preview {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 6px;
  padding: 12px;
  max-height: 300px;
  overflow: auto;
}

.css-code-preview pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.css-empty {
  padding: 24px;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
}

.css-empty p {
  margin: 0;
}
</style>
