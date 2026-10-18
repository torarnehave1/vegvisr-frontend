<template>
  <div ref="host" class="gnew-registered-type-node"></div>
</template>

<script setup>
// A node whose type is a REGISTERED data type with an approved renderer (graph_system_registry,
// metadata.renderer) — phase 1 of the rendering engine, 2026-10-18. The <vegvisr-node> element
// runs that renderer in an isolated iframe (no cookies, storage, parent access or network). It is
// a Component Registry component served from api.vegvisr.org. The element is created here in
// code, so Vue never has to resolve it as a component.
import { onMounted, ref, watch } from 'vue'
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

const payload = () => ({
  id: props.node.id,
  label: props.node.label,
  type: props.node.type,
  info: props.node.info,
  color: props.node.color,
  metadata: props.node.metadata || {},
})

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
