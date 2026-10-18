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
 * type is register_node_type (Superadmin), never a code change. How a type is shown is its
 * renderer, on the same node (see below).
 */
import * as gs from './graph-service.js'
import { NODE_TYPES } from './node-types.js'

export const REGISTRY_GRAPH_ID = 'graph_system_registry'
export const REGISTRY_NODE_TYPE = 'system-nodetype'
/** A type name is a short lowercase slug, the same shape as every existing type. */
export const TYPE_NAME = /^[a-z][a-z0-9_-]{1,39}$/

const TTL_MS = 60_000
let cache = { at: 0, nodes: null }

/** Forget the cached registry — after a write, so the next request sees it. */
export function invalidateNodeTypeCache() {
  cache = { at: 0, nodes: null }
}

/**
 * The system-nodetype nodes of graph_system_registry, cached a minute. Type names and renderers
 * both derive from this one read. A failed read returns the last good list, or none.
 */
async function registryTypeNodes(env, { now = Date.now(), getGraph = gs.getGraph } = {}) {
  if (cache.nodes && now - cache.at < TTL_MS) return cache.nodes
  try {
    const result = await getGraph(env, REGISTRY_GRAPH_ID)
    const nodes = result?.ok ? (result.graph?.nodes || []) : []
    const typeNodes = nodes.filter((n) => n?.type === REGISTRY_NODE_TYPE && TYPE_NAME.test(String(n.label || '').trim()))
    cache = { at: now, nodes: typeNodes }
    return typeNodes
  } catch (e) {
    // The renderable list still works; a registry outage only hides the data types for a minute.
    console.error('[node-types] registry read failed:', e.message)
    return [...(cache.nodes || [])]
  }
}

/** Type names registered as system-nodetype nodes in graph_system_registry. */
export async function registeredNodeTypes(env, opts) {
  const nodes = await registryTypeNodes(env, opts)
  return [...new Set(nodes.map((n) => String(n.label).trim()))]
}

/** Every type a write may carry: renderable first, then registered, no duplicates. */
export async function allowedNodeTypes(env, opts) {
  const registered = await registeredNodeTypes(env, opts)
  return [...NODE_TYPES, ...registered.filter((t) => !NODE_TYPES.includes(t))]
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderers — how a registered type is DISPLAYED (phase 1 of the rendering engine, 2026-10-18)
// ─────────────────────────────────────────────────────────────────────────────
//
// A type's renderer lives on its own registry node, metadata.renderer:
//   { version, impl | component, status: 'pending'|'approved', scope, approvedBy, approvedAt, verify }
// impl is HTML/CSS/JS run by <vegvisr-node> in an isolated iframe (sandbox="allow-scripts",
// CSP default-src 'none'); component names a Component Registry node whose metadata.impl is used
// instead. Only an APPROVED renderer is ever served. Who approves: the Superadmin for platform
// types; a World's founder for that World's types (phase 2); catalog shares go through the
// Superadmin (phase 3) — decided 2026-10-18.

export const COMPONENT_REGISTRY_GRAPH_ID = '4072b898-f111-42a9-b5ca-0d901bb17d26'

/** The registry node for a type, or null. */
export async function nodeTypeEntry(env, type, opts) {
  const nodes = await registryTypeNodes(env, opts)
  return nodes.find((n) => String(n.label).trim() === type) || null
}

/** { type: { version, status } } for every registered type that has a renderer. No code. */
export async function nodeTypeRenderers(env, opts) {
  const out = {}
  for (const n of await registryTypeNodes(env, opts)) {
    const r = n.metadata?.renderer
    if (r && (r.impl || r.component)) out[String(n.label).trim()] = { version: r.version ?? 1, status: r.status || 'pending' }
  }
  return out
}

/**
 * The code to run for a type, or null when there is none or it is not approved. A renderer that
 * names a component is resolved from the Component Registry graph.
 */
export async function approvedRenderer(env, type, { getGraph = gs.getGraph, ...opts } = {}) {
  const entry = await nodeTypeEntry(env, type, { getGraph, ...opts })
  const r = entry?.metadata?.renderer
  if (!r || r.status !== 'approved') return null
  if (typeof r.impl === 'string' && r.impl.trim()) return { type, version: r.version ?? 1, impl: r.impl }
  if (r.component) {
    const reg = await getGraph(env, COMPONENT_REGISTRY_GRAPH_ID)
    const comp = reg?.ok
      ? (reg.graph?.nodes || []).find((n) => (n.type === 'component' || n.type === 'layout') && String(n.label || '').trim() === r.component)
      : null
    const impl = comp?.metadata?.impl
    if (typeof impl === 'string' && impl.trim()) return { type, version: r.version ?? 1, impl, component: r.component }
  }
  return null
}
