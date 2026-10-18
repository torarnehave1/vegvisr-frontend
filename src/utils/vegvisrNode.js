// Loader for the rendering engine for registered node types (phase 1, 2026-10-18).
// <vegvisr-node> is a Component Registry component served from api.vegvisr.org; it runs a type's
// APPROVED renderer in an isolated iframe. Loaded once, on first need; a failed load yields an
// empty set so every caller falls back to its own renderer.
import { ref } from 'vue'

const SCRIPT_URL = 'https://api.vegvisr.org/components/vegvisr-node.js'
let loading = null

/** Reactive set of types that have an approved renderer — empty until loaded. */
export const approvedNodeTypes = ref(new Set())

export function loadApprovedNodeTypes() {
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      if (customElements.get('vegvisr-node')) return resolve()
      const s = document.createElement('script')
      s.src = SCRIPT_URL
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('vegvisr-node.js failed to load'))
      document.head.appendChild(s)
    })
      .then(() => customElements.whenDefined('vegvisr-node'))
      .then(() => window.VegvisrNode.approvedTypes())
      .catch(() => new Set())
      .then((types) => {
        approvedNodeTypes.value = types
        return types
      })
  }
  return loading
}
