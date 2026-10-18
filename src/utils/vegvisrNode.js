// Loader for the rendering engine for registered node types (phase 1, 2026-10-18; World types,
// phase 2). <vegvisr-node> is a Component Registry component served from api.vegvisr.org; it runs
// a type's APPROVED renderer in an isolated iframe. Loaded once, on first need; a failed load
// yields an empty set so every caller falls back to its own renderer.
import { ref } from 'vue'

const SCRIPT_URL = 'https://api.vegvisr.org/components/vegvisr-node.js'
let engine = null
let requested = false
const byWorld = new Map() // world ('' = platform) -> Promise<Set>

/** Reactive set of types that have an approved renderer for the open graph — empty until loaded. */
export const approvedNodeTypes = ref(new Set())

/**
 * The World the open graph lives in (getknowgraph's X-Graph-World header), '' for the platform.
 * Its own node types render only while it is set (decided 2026-10-18, D5 A).
 */
export const graphWorld = ref('')

export function setGraphWorld(world) {
  const w = String(world || '').trim().toLowerCase()
  if (w === graphWorld.value) return
  graphWorld.value = w
  approvedNodeTypes.value = new Set()
  if (requested) loadApprovedNodeTypes()
}

function loadEngine() {
  if (!engine) {
    engine = new Promise((resolve, reject) => {
      if (customElements.get('vegvisr-node')) return resolve()
      const s = document.createElement('script')
      s.src = SCRIPT_URL
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('vegvisr-node.js failed to load'))
      document.head.appendChild(s)
    }).then(() => customElements.whenDefined('vegvisr-node'))
  }
  return engine
}

export function loadApprovedNodeTypes() {
  requested = true
  const w = graphWorld.value
  if (!byWorld.has(w)) {
    byWorld.set(w, loadEngine()
      .then(() => window.VegvisrNode.approvedTypes(undefined, w))
      .catch(() => new Set()))
  }
  return byWorld.get(w).then((types) => {
    if (graphWorld.value === w) approvedNodeTypes.value = types
    return types
  })
}
