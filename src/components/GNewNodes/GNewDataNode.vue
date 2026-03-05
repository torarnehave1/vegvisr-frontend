<template>
  <div class="gnew-data-node">
    <!-- Node Controls -->
    <div v-if="showControls && !isPreview" class="node-controls">
      <button @click="toggleEdit" class="btn btn-sm btn-outline-primary" :title="editing ? 'Cancel editing' : 'Edit form schema'">
        <i class="fas fa-edit"></i> {{ editing ? 'Cancel' : 'Edit' }}
      </button>
      <button @click="downloadCsv" class="btn btn-sm btn-outline-secondary ms-2" title="Download CSV">
        <i class="fas fa-download"></i> CSV
      </button>
      <button @click="deleteNode" class="btn btn-sm btn-outline-danger ms-2" title="Delete Node">
        <i class="fas fa-trash"></i>
      </button>
    </div>

    <!-- Label -->
    <h3 v-if="cleanLabel" class="node-label">{{ cleanLabel }}</h3>

    <!-- ========== EDIT MODE ========== -->
    <div v-if="editing" class="schema-editor">

      <!-- Header Image -->
      <div class="editor-section">
        <label class="editor-section-label">Header Image</label>
        <div
          v-if="!editHeaderImage"
          class="image-dropzone"
          @click="openImageSelector"
          @drop.prevent="handleDrop"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @paste="handlePaste"
          :class="{ 'drag-over': dragOver }"
          tabindex="0"
        >
          <i class="fas fa-image"></i>
          <span>Click, drag &amp; drop, or paste an image</span>
        </div>
        <div v-else class="image-preview">
          <img :src="editHeaderImage" alt="Header image" />
          <div class="image-actions">
            <button @click="openImageSelector" class="btn btn-sm btn-outline-primary" title="Change image">
              <i class="fas fa-sync-alt"></i> Change
            </button>
            <button @click="editHeaderImage = ''" class="btn btn-sm btn-outline-danger" title="Remove image">
              <i class="fas fa-trash"></i> Remove
            </button>
          </div>
        </div>
        <div v-if="imageUploading" class="image-uploading">
          <i class="fas fa-spinner fa-spin"></i> Uploading...
        </div>
      </div>

      <!-- Form Title -->
      <div class="editor-section">
        <label class="editor-section-label">Form Title</label>
        <input v-model="editFormTitle" class="editor-input" placeholder="e.g. Contact Us" />
      </div>

      <!-- Columns -->
      <div class="editor-section">
        <label class="editor-section-label">Form Fields</label>
        <div v-for="(col, idx) in editColumns" :key="idx" class="column-row">
          <input v-model="col.key" class="col-input col-key" placeholder="field_key" />
          <input v-model="col.label" class="col-input col-label" placeholder="Display Label" />
          <select v-model="col.type" class="col-select">
            <option value="text">Text</option>
            <option value="email">Email</option>
            <option value="textarea">Textarea</option>
            <option value="select">Select</option>
          </select>
          <button @click="removeColumn(idx)" class="col-remove" title="Remove field">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <button @click="addColumn" class="btn btn-sm btn-outline-secondary add-field-btn">
          <i class="fas fa-plus"></i> Add Field
        </button>
      </div>

      <!-- Save / Cancel -->
      <div class="editor-actions">
        <button @click="saveSchema" class="btn btn-sm btn-primary">
          <i class="fas fa-save"></i> Save
        </button>
        <button @click="toggleEdit" class="btn btn-sm btn-outline-secondary ms-2">Cancel</button>
        <span v-if="validationError" class="editor-error">{{ validationError }}</span>
      </div>
    </div>

    <!-- ========== VIEW MODE ========== -->
    <template v-else>
      <!-- Header Image -->
      <div v-if="headerImage" class="header-image">
        <img :src="headerImage" :alt="cleanLabel || 'Form header'" />
      </div>

      <!-- Data Table -->
      <div v-if="records.length > 0" class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th v-for="col in columns" :key="col.key">{{ col.label || col.key }}</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in records" :key="row._id">
              <td v-for="col in columns" :key="col.key">{{ row[col.key] != null ? row[col.key] : '' }}</td>
              <td>{{ formatDate(row._ts) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="data-empty">No records yet.</p>

      <!-- Record count -->
      <p class="data-meta">{{ records.length }} record{{ records.length !== 1 ? 's' : '' }}</p>
    </template>

    <!-- ImageSelector Modal -->
    <ImageSelector
      v-if="showImageSelector"
      :isOpen="showImageSelector"
      :currentImageUrl="editHeaderImage || ''"
      :currentImageAlt="cleanLabel || 'Form header'"
      imageType="Header"
      imageContext="data-node-header"
      @close="showImageSelector = false"
      @image-replaced="onImageSelected"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ImageSelector from '@/components/ImageSelector.vue'

const props = defineProps({
  node: { type: Object, required: true },
  graphData: { type: Object, default: () => ({ nodes: [], edges: [] }) },
  isPreview: { type: Boolean, default: false },
  showControls: { type: Boolean, default: true },
  graphId: { type: String, default: '' },
})

const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Edit state
const editing = ref(false)
const editFormTitle = ref('')
const editHeaderImage = ref('')
const editColumns = ref([])
const validationError = ref('')
const dragOver = ref(false)
const imageUploading = ref(false)
const showImageSelector = ref(false)

// Computed
const cleanLabel = computed(() => (props.node.label || '').replace(/^#\s*/, ''))

const headerImage = computed(() => props.node.metadata?.headerImage || '')

const records = computed(() => {
  try {
    const parsed = JSON.parse(props.node.info || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
})

const columns = computed(() => {
  const schema = props.node.metadata?.schema
  if (schema && Array.isArray(schema.columns)) return schema.columns
  if (records.value.length > 0) {
    return Object.keys(records.value[0])
      .filter(k => !k.startsWith('_'))
      .map(k => ({ key: k, label: k, type: 'text' }))
  }
  return []
})

// Methods
function formatDate(ts) {
  if (!ts) return ''
  try { return new Date(ts).toLocaleDateString() } catch { return '' }
}

function toggleEdit() {
  if (!editing.value) {
    editFormTitle.value = props.node.metadata?.formTitle || ''
    editHeaderImage.value = props.node.metadata?.headerImage || ''
    editColumns.value = columns.value.map(c => ({ ...c }))
    if (editColumns.value.length === 0) {
      editColumns.value.push({ key: '', label: '', type: 'text' })
    }
    validationError.value = ''
  }
  editing.value = !editing.value
}

function addColumn() {
  editColumns.value.push({ key: '', label: '', type: 'text' })
}

function removeColumn(idx) {
  editColumns.value.splice(idx, 1)
}

function saveSchema() {
  // Validate
  const cols = editColumns.value.filter(c => c.key.trim())
  if (cols.length === 0) {
    validationError.value = 'Add at least one field with a key'
    return
  }
  const keys = cols.map(c => c.key.trim())
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
  if (dupes.length > 0) {
    validationError.value = 'Duplicate key: ' + dupes[0]
    return
  }
  validationError.value = ''

  // Clean up columns
  const cleanCols = cols.map(c => ({
    key: c.key.trim(),
    label: (c.label || c.key).trim(),
    type: c.type || 'text',
  }))

  const updatedMetadata = {
    ...(props.node.metadata || {}),
    schema: { columns: cleanCols },
    formTitle: editFormTitle.value.trim() || 'Submit',
    headerImage: editHeaderImage.value || undefined,
    encrypted: true,
  }
  // Remove headerImage key if empty
  if (!updatedMetadata.headerImage) delete updatedMetadata.headerImage

  emit('node-updated', {
    ...props.node,
    metadata: updatedMetadata,
  })
  editing.value = false
}

// Image handling
function openImageSelector() {
  showImageSelector.value = true
}

function onImageSelected(imageData) {
  if (imageData?.newUrl) {
    editHeaderImage.value = imageData.newUrl
  }
  showImageSelector.value = false
}

async function uploadImage(file) {
  if (!file || !file.type.startsWith('image/')) return
  imageUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('https://api.vegvisr.org/upload', {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error('Upload failed')
    const data = await res.json()
    if (data.url) {
      editHeaderImage.value = data.url
    }
  } catch (err) {
    console.error('Image upload error:', err)
    validationError.value = 'Image upload failed: ' + err.message
  } finally {
    imageUploading.value = false
  }
}

function handleDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) uploadImage(file)
}

function handlePaste(e) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      uploadImage(item.getAsFile())
      return
    }
    if (item.type === 'text/plain') {
      item.getAsString(text => {
        const trimmed = text.trim()
        if (/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)/i.test(trimmed)) {
          editHeaderImage.value = trimmed
        }
      })
    }
  }
}

function deleteNode() {
  if (confirm('Delete this data node and all its records?')) {
    emit('node-deleted', props.node.id)
  }
}

function downloadCsv() {
  if (records.value.length === 0) return
  const cols = columns.value
  const header = cols.map(c => c.label || c.key).join(',')
  const rows = records.value.map(r =>
    cols.map(c => {
      const val = r[c.key] != null ? String(r[c.key]) : ''
      return '"' + val.replace(/"/g, '""') + '"'
    }).join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (cleanLabel.value || 'data') + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.gnew-data-node {
  background: #ffffff;
  border: 2px solid #dbeafe;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1rem 0;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08);
  transition: all 0.3s ease;
}
.gnew-data-node:hover {
  border-color: #2563eb;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.12);
}
.node-controls {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
  gap: 0.5rem;
}
.node-controls .btn {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
}
.node-label {
  color: #1e3a5f;
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
}

/* Header Image */
.header-image {
  margin-bottom: 1rem;
  border-radius: 8px;
  overflow: hidden;
}
.header-image img {
  width: 100%;
  max-height: 240px;
  object-fit: cover;
  display: block;
}

/* Data Table */
.data-table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.data-table th {
  background: #2563eb; color: #fff;
  padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; white-space: nowrap;
}
.data-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; }
.data-table tr:nth-child(even) { background: #f9fafb; }
.data-table tr:hover { background: #eff6ff; }
.data-empty { color: #6b7280; font-style: italic; }
.data-meta { margin-top: 0.75rem; font-size: 0.8rem; color: #9ca3af; }

/* Schema Editor */
.schema-editor {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
}
.editor-section {
  margin-bottom: 1rem;
}
.editor-section-label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  color: #374151;
  margin-bottom: 0.4rem;
}
.editor-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  box-sizing: border-box;
}
.editor-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

/* Image Dropzone */
.image-dropzone {
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.image-dropzone:hover,
.image-dropzone.drag-over {
  border-color: #2563eb;
  background: #eff6ff;
  color: #2563eb;
}
.image-dropzone i { font-size: 1.5rem; }
.image-dropzone span { font-size: 0.85rem; }

.image-preview {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}
.image-preview img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  display: block;
}
.image-actions {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}
.image-actions .btn {
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(4px);
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}
.image-uploading {
  padding: 0.5rem;
  color: #2563eb;
  font-size: 0.85rem;
}

/* Column Editor */
.column-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  align-items: center;
}
.col-input {
  padding: 0.4rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  box-sizing: border-box;
}
.col-input:focus, .col-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
.col-key { flex: 1; }
.col-label { flex: 1.5; }
.col-select {
  width: 100px;
  padding: 0.4rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  background: #fff;
}
.col-remove {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 0.25rem 0.4rem;
  border-radius: 4px;
  font-size: 0.85rem;
}
.col-remove:hover {
  background: #fef2f2;
}
.add-field-btn {
  margin-top: 0.25rem;
}

/* Editor Actions */
.editor-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e2e8f0;
}
.editor-error {
  color: #dc2626;
  font-size: 0.8rem;
  margin-left: 0.5rem;
}

@media (max-width: 768px) {
  .gnew-data-node { padding: 1rem; }
  .node-label { font-size: 1.1rem; }
  .column-row { flex-wrap: wrap; }
  .col-key, .col-label { flex: 1 1 40%; }
  .col-select { flex: 1 1 auto; }
}
</style>
