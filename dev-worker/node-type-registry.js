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
import { systemWorldStore } from './graph-store.js'
import { NODE_TYPES } from './node-types.js'

export const REGISTRY_GRAPH_ID = 'graph_system_registry'
export const REGISTRY_NODE_TYPE = 'system-nodetype'
/** A type name is a short lowercase slug, the same shape as every existing type. */
export const TYPE_NAME = /^[a-z][a-z0-9_-]{1,39}$/

const TTL_MS = 60_000
let cache = { at: 0, nodes: null }
const worldCache = new Map() // domain -> { at, nodes }

/** Forget the cached registries — after a write, so the next request sees it. */
export function invalidateNodeTypeCache(world = null) {
  if (world) {
    worldCache.delete(normalizeWorld(world))
    return
  }
  cache = { at: 0, nodes: null }
  worldCache.clear()
}

/** A World domain as the registries key it: lowercase, trimmed. null when none. */
export function normalizeWorld(world) {
  const d = String(world || '').trim().toLowerCase()
  return d || null
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

// ─────────────────────────────────────────────────────────────────────────────
// World types — a World's own node types (phase 2, decided 2026-10-18: D1 A, D2 A)
// ─────────────────────────────────────────────────────────────────────────────
//
// A World's types live in ONE graph in that World's own store (graph-store.js), found by the tag
// #WORLD-NODE-TYPES (the oldest such graph wins), created by the first register_node_type with
// `world`. Its type nodes have the platform's shape: system-nodetype, metadata.renderer.
// Resolution for a graph in World X: platform types first, then X's. A name the platform has —
// renderable or registered — is never taken from X (no shadowing); types of another World never
// apply. The registry is read without an actor (systemWorldStore): only names and APPROVED
// renderers leave this module, the same contract as platform types (D4 A).

export const WORLD_TYPES_TAG = '#WORLD-NODE-TYPES'
const WORLD_REGISTRY_SQL =
  `SELECT id, data FROM knowledge_graphs WHERE json_valid(data) AND json_extract(data, '$.metadata.metaArea') LIKE ? ` +
  `ORDER BY created_date ASC, id ASC LIMIT 1`

/**
 * The World's type registry graph, read fresh: { store, graphId, graph, version } or null when
 * the World has no store or no registry yet. `storeFor` defaults to the system read; the MCP
 * tools pass the actor's own store so a write goes through the founder's rights.
 */
export async function worldRegistryGraph(env, world, { storeFor = systemWorldStore } = {}) {
  const domain = normalizeWorld(world)
  if (!domain) return null
  const store = await storeFor(env, domain)
  if (!store) return null
  const row = await store.first(WORLD_REGISTRY_SQL, [`%${WORLD_TYPES_TAG}%`])
  if (!row) return { store, graphId: null, graph: null, version: null }
  let graph = null
  try { graph = JSON.parse(row.data) } catch { graph = null }
  return { store, graphId: row.id, graph, version: graph?.metadata?.version ?? null }
}

/** The World's type nodes, cached a minute per World. Platform names are filtered out (D2 A). */
async function worldTypeNodes(env, world, { now = Date.now(), storeFor, getGraph = gs.getGraph } = {}) {
  const domain = normalizeWorld(world)
  if (!domain) return []
  const hit = worldCache.get(domain)
  let nodes
  if (hit && now - hit.at < TTL_MS) nodes = hit.nodes
  else {
    try {
      const reg = await worldRegistryGraph(env, domain, storeFor ? { storeFor } : {})
      nodes = (reg?.graph?.nodes || []).filter((n) => n?.type === REGISTRY_NODE_TYPE && TYPE_NAME.test(String(n.label || '').trim()))
      worldCache.set(domain, { at: now, nodes })
    } catch (e) {
      console.error(`[node-types] ${domain} registry read failed:`, e.message)
      nodes = [...(hit?.nodes || [])]
    }
  }
  const platform = new Set([...NODE_TYPES, ...(await registryTypeNodes(env, { now, getGraph })).map((n) => String(n.label).trim())])
  return nodes.filter((n) => !platform.has(String(n.label).trim()))
}

/** Type names registered by a World itself (never one the platform has). */
export async function worldNodeTypes(env, world, opts) {
  const nodes = await worldTypeNodes(env, world, opts)
  return [...new Set(nodes.map((n) => String(n.label).trim()))]
}

/** Type names registered as system-nodetype nodes: the platform's, then — with `world` — that World's. */
export async function registeredNodeTypes(env, opts = {}) {
  const nodes = await registryTypeNodes(env, opts)
  const platform = [...new Set(nodes.map((n) => String(n.label).trim()))]
  if (!opts.world) return platform
  const own = await worldNodeTypes(env, opts.world, opts)
  return [...platform, ...own.filter((t) => !platform.includes(t))]
}

/** Every type a write may carry: renderable first, then registered (platform, then `world`'s), no duplicates. */
export async function allowedNodeTypes(env, opts) {
  const registered = await registeredNodeTypes(env, opts)
  return [...NODE_TYPES, ...registered.filter((t) => !NODE_TYPES.includes(t))]
}

/**
 * Is `type` allowed on a node of a graph that lives in `world` (null = the platform)? The MCP
 * schema lists the types of every World the caller may use, so this is the check that a World's
 * type is only ever written into that World's graphs.
 */
export async function nodeTypeAllowedIn(env, type, world, opts = {}) {
  if (!type) return true
  const t = String(type).trim()
  if ((await allowedNodeTypes(env, opts)).includes(t)) return true
  return Boolean(world) && (await worldNodeTypes(env, world, opts)).includes(t)
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

/** The registry node for a type, or null: the platform's first, then — with `world` — that World's. */
export async function nodeTypeEntry(env, type, opts = {}) {
  const nodes = await registryTypeNodes(env, opts)
  const platform = nodes.find((n) => String(n.label).trim() === type)
  if (platform || !opts.world) return platform || null
  return (await worldTypeNodes(env, opts.world, opts)).find((n) => String(n.label).trim() === type) || null
}

/**
 * { type: { version, status } } for every registered type that has a renderer. No code. With
 * `world`, that World's types are added (marked scope: 'world'); a platform type is never replaced.
 */
export async function nodeTypeRenderers(env, opts = {}) {
  const out = {}
  const add = (nodes, scope) => {
    for (const n of nodes) {
      const name = String(n.label).trim()
      const r = n.metadata?.renderer
      if (out[name] || !r || !(r.impl || r.component)) continue
      out[name] = { version: r.version ?? 1, status: r.status || 'pending', ...(scope ? { scope } : {}) }
    }
  }
  add(await registryTypeNodes(env, opts), null)
  if (opts.world) add(await worldTypeNodes(env, opts.world, opts), 'world')
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
