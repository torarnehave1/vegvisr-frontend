/**
 * node-type-registry.js — node types that are DATA, not renderers (decided 2026-10-17).
 *
 * node-types.js lists the types the viewer can display, derived from the renderer and frozen
 * there on purpose. Some types are never displayed: they are read by a program. work-context is
 * the first — Agent-Builder's GET /work-contexts reads those nodes and turns them into cards.
 * Such a type could not be written through MCP at all, so the architect had to set it in the
 * Knowledge Editor, and that save wiped metadata on every node in the graph (2026-10-17).
 *
 * These types live where capability is defined (Lesson 25): as `system-nodetype` nodes in
 * graph_system_registry. Allowed types = the renderable list + every registered one. Adding a
 * type is register_node_type (Superadmin), never a code change.
 */
import * as gs from './graph-service.js'
import { NODE_TYPES } from './node-types.js'

export const REGISTRY_GRAPH_ID = 'graph_system_registry'
export const REGISTRY_NODE_TYPE = 'system-nodetype'
/** A type name is a short lowercase slug, the same shape as every existing type. */
export const TYPE_NAME = /^[a-z][a-z0-9_-]{1,39}$/

const TTL_MS = 60_000
let cache = { at: 0, types: null }

/** Forget the cached list — after register_node_type, so the next request sees the new type. */
export function invalidateNodeTypeCache() {
  cache = { at: 0, types: null }
}

/** Type names registered as system-nodetype nodes in graph_system_registry. */
export async function registeredNodeTypes(env, { now = Date.now(), getGraph = gs.getGraph } = {}) {
  if (cache.types && now - cache.at < TTL_MS) return cache.types
  let types = []
  try {
    const result = await getGraph(env, REGISTRY_GRAPH_ID)
    const nodes = result?.ok ? (result.graph?.nodes || []) : []
    types = [...new Set(
      nodes
        .filter((n) => n?.type === REGISTRY_NODE_TYPE)
        .map((n) => String(n.label || '').trim())
        .filter((t) => TYPE_NAME.test(t)),
    )]
  } catch (e) {
    // The renderable list still works; a registry outage only hides the data types for a minute.
    console.error('[node-types] registry read failed:', e.message)
    return [...(cache.types || [])]
  }
  cache = { at: now, types }
  return types
}

/** Every type a write may carry: renderable first, then registered, no duplicates. */
export async function allowedNodeTypes(env, opts) {
  const registered = await registeredNodeTypes(env, opts)
  return [...NODE_TYPES, ...registered.filter((t) => !NODE_TYPES.includes(t))]
}
