<template>
  <div class="gnew-data-node">
    <!-- Node Controls -->
    <div v-if="showControls && !isPreview" class="node-controls">
      <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Schema">
        <i class="fas fa-edit"></i> Edit
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
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
  graphData: { type: Object, default: () => ({ nodes: [], edges: [] }) },
  isPreview: { type: Boolean, default: false },
  showControls: { type: Boolean, default: true },
  graphId: { type: String, default: '' },
})

const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

const cleanLabel = computed(() => {
  return (props.node.label || '').replace(/^#\s*/, '')
})

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
  // Auto-detect from first record
  if (records.value.length > 0) {
    return Object.keys(records.value[0])
      .filter(k => !k.startsWith('_'))
      .map(k => ({ key: k, label: k, type: 'text' }))
  }
  return []
})

function formatDate(ts) {
  if (!ts) return ''
  try { return new Date(ts).toLocaleDateString() } catch { return '' }
}

function editNode() {
  emit('node-updated', { ...props.node, action: 'edit' })
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
.data-table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.data-table th {
  background: #2563eb;
  color: #fff;
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-weight: 600;
  white-space: nowrap;
}
.data-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}
.data-table tr:nth-child(even) {
  background: #f9fafb;
}
.data-table tr:hover {
  background: #eff6ff;
}
.data-empty {
  color: #6b7280;
  font-style: italic;
}
.data-meta {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: #9ca3af;
}
@media (max-width: 768px) {
  .gnew-data-node {
    padding: 1rem;
  }
  .node-label {
    font-size: 1.1rem;
  }
}
</style>
