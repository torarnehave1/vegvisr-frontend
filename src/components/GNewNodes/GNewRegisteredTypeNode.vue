<template>
  <div ref="host" class="gnew-registered-type-node"></div>
</template>

<script setup>
// A node whose type is a REGISTERED data type with an approved renderer (graph_system_registry,
// metadata.renderer) — phase 1 of the rendering engine, 2026-10-18. The <vegvisr-node> element
// runs that renderer in an isolated iframe (no cookies, storage, parent access or network). It is
// a Component Registry component served from api.vegvisr.org. The element is created here in
// code, so Vue never has to resolve it as a component.
import { onMounted, ref, toRaw, watch } from 'vue'
import { loadApprovedNodeTypes } from '@/utils/vegvisrNode'

const props = defineProps({
  node: { type: Object, required: true },
  graphData: { type: Object, default: () => ({}) },
  isPreview: { type: Boolean, default: false },
  showControls: { type: Boolean, default: false },
  graphId: { type: String, default: '' },
})

const host = ref(null)
let el = null

// Plain data, not Vue's reactive Proxy: postMessage cannot clone a Proxy (DataCloneError), which
// left the frame on its "Loading…" text (2026-10-18). The engine copies too; this is belt and braces.
const payload = () => {
  const n = toRaw(props.node)
  let metadata = {}
  try { metadata = JSON.parse(JSON.stringify(toRaw(n.metadata) || {})) } catch { metadata = {} }
  return { id: n.id, label: n.label, type: n.type, info: n.info, color: n.color, metadata }
}

onMounted(async () => {
  await loadApprovedNodeTypes()
  el = document.createElement('vegvisr-node')
  el.style.display = 'block'
  el.theme = 'light'
  el.node = payload()
  host.value.replaceChildren(el)
})

watch(() => props.node, () => { if (el) el.node = payload() }, { deep: true })
</script>
