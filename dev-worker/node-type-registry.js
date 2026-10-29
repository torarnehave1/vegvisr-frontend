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

/**
 * { type: { title, fields } } for a World's own types — what a form needs to edit a node of the
 * type (Knowledge Editor) and what a picker shows. Public like the names: no code, no drafts' content.
 */
export async function worldTypeInfo(env, world, opts) {
  const out = {}
  for (const n of await worldTypeNodes(env, world, opts)) {
    const m = n.metadata || {}
    out[String(n.label).trim()] = { title: m.title || String(n.label).trim(), fields: Array.isArray(m.fields) ? m.fields : [] }
  }
  return out
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
 * { type: { version, status, embed? } } for every registered type that has a renderer or an
 * APPROVED network declaration. No code. With `world`, that World's types are added (marked
 * scope: 'world'); a platform type is never replaced. A type with only an embed has no
 * version/status — it has no renderer — and carries `embed` alone.
 */
export async function nodeTypeRenderers(env, opts = {}) {
  const out = {}
  const add = (nodes, scope) => {
    for (const n of nodes) {
      const name = String(n.label).trim()
      if (out[name]) continue
      const r = n.metadata?.renderer
      const hasRenderer = Boolean(r && (r.impl || r.component))
      // Network is a platform-only privilege (2026-10-29): a World's type never gets an embed.
      const embed = scope ? null : approvedEmbed(n)
      if (!hasRenderer && !embed) continue
      out[name] = {
        ...(hasRenderer ? { version: r.version ?? 1, status: r.status || 'pending' } : {}),
        ...(embed ? { embed } : {}),
        ...(scope ? { scope } : {}),
      }
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

// ─────────────────────────────────────────────────────────────────────────────
// Recipe and network — what a node of a type must hold, and what it may embed (2026-10-29)
// ─────────────────────────────────────────────────────────────────────────────
//
// Decided by the architect 2026-10-29 (graph e1678d8c "Nodetyper med oppskrift og nettverk"):
// a type carries its own recipe, so an agent writes a correct node the first time instead of
// searching other graphs for one that works (a youtube-video node was written wrong three ways
// that day). The recipe is metadata.fields (the World types' shape, reused) plus metadata.example.
//
// A type may also DECLARE network: an embed URL template on ONE approved host, e.g.
//   { embed: 'https://www.youtube-nocookie.com/embed/{id}', idPattern: '[A-Za-z0-9_-]{11}', idField: 'videoId' }
// The renderer sandbox is NOT opened for it — "Isolation, not approval, is the security
// boundary" still holds. <vegvisr-node> v6 builds the iframe itself, outside the sandbox, from
// the declaration and the node's metadata[idField], and only when the declaration is APPROVED.
// Like a renderer: saved pending, approved per version by the Superadmin, and any change to it
// starts a new pending version. Platform types only; a World's type cannot declare network.

const META_KEY = /^[a-z][a-zA-Z0-9_]{0,39}$/
const MAX_EMBED = 300
const MAX_ID_PATTERN = 200
const MAX_EXAMPLE = 4000
/** Characters an id may never contain, whatever its pattern says: they would leave the slot. */
const ID_FORBIDDEN = /[/?#%\\\s]/

const bad = (message) => ({ ok: false, code: gs.ERR.INVALID_INPUT, status: gs.statusForCode(gs.ERR.INVALID_INPUT), message })

/** The pattern a declared idPattern is tested with: anchored, whatever anchors it was written with. */
export function anchoredIdPattern(idPattern) {
  const core = String(idPattern || '').trim().replace(/^\^/, '').replace(/\$$/, '')
  return new RegExp(`^(?:${core})$`)
}

/**
 * A validated network declaration { embed, idPattern, idField }, or a failure naming what is wrong.
 * The id may only fill the URL's path or query — never its host — and must be https.
 */
export function normalizeNetwork(network) {
  if (!network || typeof network !== 'object' || Array.isArray(network)) return bad('network must be an object { embed, idPattern, idField }.')
  const embed = String(network.embed || '').trim()
  if (!embed || embed.length > MAX_EMBED) return bad(`network.embed must be a URL of at most ${MAX_EMBED} characters.`)
  if (embed.split('{id}').length !== 2) return bad('network.embed must contain {id} exactly once, where the node\'s id goes.')
  if (/[{}]/.test(embed.replace('{id}', ''))) return bad('network.embed may hold no other { } than {id}.')
  let a, b
  try {
    a = new URL(embed.replace('{id}', 'AAAAAAAAAAA'))
    b = new URL(embed.replace('{id}', 'BBBBBBBBBBB'))
  } catch {
    return bad('network.embed is not a valid URL.')
  }
  if (a.protocol !== 'https:') return bad('network.embed must be https.')
  if (a.username || a.password) return bad('network.embed may not carry a user name or password.')
  if (a.host !== b.host) return bad('{id} may only stand in the path or query of network.embed, never in its host.')

  const idPattern = String(network.idPattern || '').trim().replace(/^\^/, '').replace(/\$$/, '')
  if (!idPattern || idPattern.length > MAX_ID_PATTERN) return bad(`network.idPattern must be a regular expression of at most ${MAX_ID_PATTERN} characters.`)
  let re
  try { re = anchoredIdPattern(idPattern) } catch (e) { return bad(`network.idPattern is not a valid regular expression: ${e.message}`) }
  if (re.test('')) return bad('network.idPattern must not accept an empty id.')
  for (const probe of ['a/b', 'a?b', 'a#b', 'a%2Fb', 'a b']) {
    if (re.test(probe)) return bad(`network.idPattern accepts "${probe}". An id may not contain / ? # % or spaces — narrow the pattern, e.g. [A-Za-z0-9_-]{11}.`)
  }

  const idField = String(network.idField || '').trim().replace(/^metadata\./, '')
  if (!META_KEY.test(idField)) return bad('network.idField must be the metadata key that holds the id, e.g. "videoId".')
  return { ok: true, network: { embed, idPattern, idField } }
}

/** The host a network declaration opens, for messages: "www.youtube-nocookie.com". */
export function embedHost(embed) {
  try { return new URL(String(embed).replace('{id}', 'x')).host } catch { return '' }
}

/** True when two declarations open exactly the same thing — then an approval may be kept. */
export function sameNetwork(a, b) {
  return Boolean(a && b) && a.embed === b.embed && a.idPattern === b.idPattern && a.idField === b.idField
}

/**
 * The public description of an APPROVED declaration on a registry node, or null. What
 * <vegvisr-node> builds the iframe from: { version, url, idPattern, idField }. A stored declaration
 * that no longer validates is treated as absent — nothing unchecked ever reaches a browser.
 */
export function approvedEmbed(node) {
  const net = node?.metadata?.network
  if (!net || net.status !== 'approved') return null
  const v = normalizeNetwork(net)
  if (!v.ok) return null
  return { version: Number(net.version) || 1, url: v.network.embed, idPattern: v.network.idPattern, idField: v.network.idField }
}

/** The id an embed would use for a node, or null when it is missing or does not match. */
export function embedIdFor(embed, node) {
  if (!embed) return null
  const id = String(node?.metadata?.[embed.idField] ?? '').trim()
  if (!id || id.length > 200 || ID_FORBIDDEN.test(id)) return null
  try { return anchoredIdPattern(embed.idPattern).test(id) ? id : null } catch { return null }
}

/**
 * A validated example node { label?, info?, metadata? } — the recipe in its most direct form —
 * or a failure. Small on purpose: it is shown in list_node_types, not stored as content.
 */
export function normalizeExample(example) {
  if (!example || typeof example !== 'object' || Array.isArray(example)) return bad('example must be an object { label, info, metadata }.')
  const out = {}
  if (example.label != null) out.label = String(example.label).slice(0, 200)
  if (example.info != null) out.info = String(example.info)
  if (example.metadata != null) {
    if (typeof example.metadata !== 'object' || Array.isArray(example.metadata)) return bad('example.metadata must be an object.')
    out.metadata = JSON.parse(JSON.stringify(example.metadata))
  }
  if (!Object.keys(out).length) return bad('example needs at least one of label, info or metadata.')
  if (JSON.stringify(out).length > MAX_EXAMPLE) return bad(`example is larger than ${MAX_EXAMPLE} characters; keep it to one short node.`)
  return { ok: true, example: out }
}
