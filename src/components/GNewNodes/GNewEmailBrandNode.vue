<template>
  <div class="gnew-email-brand-node">
    <div class="brand-header">
      <span class="brand-title">🎨 {{ nodeData.name ? nodeData.name + ' — email brand' : 'Email brand' }}</span>
      <button v-if="showControls" @click="deleteNode" class="btn-icon" title="Delete node">🗑️</button>
    </div>

    <div class="brand-body">
      <div class="config-row">
        <label>Brand name:</label>
        <input v-model="nodeData.name" @input="markDirty" class="fld" placeholder="Universi" />
      </div>

      <div class="config-row">
        <label>Logo:</label>
        <div class="logo-field">
          <input v-model="nodeData.logo" @input="markDirty" class="fld" placeholder="https://…/logo.png" />
          <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="onFilePicked" />
          <button @click="pickFile" :disabled="uploading" class="btn-upload">
            {{ uploading ? 'Laster opp…' : '⬆︎ Last opp' }}
          </button>
        </div>
        <div v-if="nodeData.logo" class="logo-preview"><img :src="nodeData.logo" alt="logo preview" /></div>
      </div>

      <div class="config-row">
        <label>Accent color:</label>
        <div class="accent-field">
          <input v-model="nodeData.accent" @input="markDirty" class="fld" placeholder="#0f2a43" />
          <input v-model="nodeData.accent" @input="markDirty" type="color" class="color-swatch" />
        </div>
      </div>

      <div class="config-row">
        <label>From name:</label>
        <input v-model="nodeData.fromName" @input="markDirty" class="fld" placeholder="Universi" />
      </div>

      <div class="config-row">
        <label>Footer:</label>
        <input v-model="nodeData.footer" @input="markDirty" class="fld" placeholder="Universi AS · universi.no" />
      </div>

      <div class="brand-actions">
        <button @click="saveBrand" :disabled="!isDirty" class="btn-save">
          💾 {{ isDirty ? 'Lagre endringer' : 'Lagret' }}
        </button>
        <span v-if="statusMessage" :class="`status-${statusType}`">{{ statusMessage }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

// email-brand node: metadata = { name, logo, accent, fromName, footer }. Edited locally + saved on
// the Save button (never save-on-keystroke — L56). Logo upload reuses the platform pipeline:
// POST https://api.vegvisr.org/upload (FormData 'file') → { url: blog.vegvisr.org/<name> } → the
// permanent imgix URL https://vegvisr.imgix.net/<name>.
const props = defineProps({
  node: { type: Object, required: true },
  graphData: { type: Object, default: () => ({ nodes: [], edges: [] }) },
  showControls: { type: Boolean, default: true },
  isPreview: { type: Boolean, default: false },
})
const emit = defineEmits(['node-updated', 'node-deleted'])

const fileInput = ref(null)
const uploading = ref(false)
const isDirty = ref(false)
const statusMessage = ref('')
const statusType = ref('info')

function readBrand() {
  const m = props.node.metadata || {}
  return {
    name: m.name || '',
    logo: m.logo || '',
    accent: m.accent || '#0f2a43',
    fromName: m.fromName || '',
    footer: m.footer || '',
  }
}
const nodeData = ref(readBrand())
// Re-read only on EXTERNAL node changes (not our own save mid-typing).
watch(() => props.node.metadata, () => { nodeData.value = readBrand() }, { deep: true })

function markDirty() { isDirty.value = true }

function saveBrand() {
  const updatedNode = {
    ...props.node,
    type: 'email-brand',
    label: `${nodeData.value.name || 'Email'} email brand`,
    metadata: {
      ...(props.node.metadata || {}),
      name: nodeData.value.name,
      logo: nodeData.value.logo,
      accent: nodeData.value.accent,
      fromName: nodeData.value.fromName,
      footer: nodeData.value.footer,
    },
  }
  emit('node-updated', updatedNode)
  isDirty.value = false
  statusMessage.value = 'Lagret ✓'
  statusType.value = 'success'
  setTimeout(() => { if (statusMessage.value === 'Lagret ✓') statusMessage.value = '' }, 2500)
}

function pickFile() { fileInput.value?.click() }

async function onFilePicked(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  uploading.value = true
  statusMessage.value = 'Laster opp logo…'
  statusType.value = 'info'
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('https://api.vegvisr.org/upload', { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Opplasting feilet (' + res.status + ')')
    const data = await res.json()
    const fileName = String(data.url || '').split('/').pop()
    if (!fileName) throw new Error('Ingen URL i opplastingssvaret')
    nodeData.value.logo = `https://vegvisr.imgix.net/${fileName}`
    isDirty.value = true
    statusMessage.value = 'Logo lastet opp — husk å lagre'
    statusType.value = 'success'
  } catch (err) {
    statusMessage.value = (err && err.message) || 'Opplasting feilet'
    statusType.value = 'error'
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function deleteNode() { emit('node-deleted', props.node) }
</script>

<style scoped>
.gnew-email-brand-node { border: 1px solid #d5d0c8; border-radius: 8px; padding: 12px; background: #fff; color: #1a1a2e; }
.brand-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.brand-title { font-weight: 600; }
.btn-icon { margin-left: auto; background: none; border: none; cursor: pointer; font-size: 14px; }
.config-row { margin: 8px 0; }
.config-row > label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px; }
.fld { width: 100%; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; box-sizing: border-box; }
.logo-field { display: flex; gap: 6px; }
.logo-field .fld { flex: 1; }
.btn-upload { white-space: nowrap; padding: 6px 10px; border: 1px solid #1a4a6e; background: #1a4a6e; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; }
.btn-upload:disabled { opacity: 0.6; cursor: default; }
.logo-preview { margin-top: 6px; }
.logo-preview img { max-height: 48px; max-width: 220px; border: 1px solid #eee; border-radius: 4px; background: #fafafa; padding: 4px; }
.accent-field { display: flex; gap: 6px; align-items: center; }
.color-swatch { width: 42px; height: 32px; padding: 0; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }
.brand-actions { margin-top: 12px; display: flex; align-items: center; gap: 10px; }
.btn-save { background: #28a745; color: #fff; border: none; padding: 7px 14px; border-radius: 6px; cursor: pointer; font-weight: 500; }
.btn-save:disabled { opacity: 0.5; cursor: default; }
.status-success { color: #28a745; font-size: 12px; }
.status-error { color: #dc3545; font-size: 12px; }
.status-info { color: #666; font-size: 12px; }
</style>
