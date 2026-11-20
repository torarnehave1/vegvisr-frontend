/**
 * graph-service.js — the single internal service layer for Knowledge Graph operations.
 *
 *   REST-handler ─┐
 *                 ├── graphService ── graph-store ── D1 (vegvisr_org)
 *   MCP-verktøy ──┘
 *
 * No function here names a database. Each asks graph-store.js for the store that holds the graph
 * it is working on (2026-10-13), which today is always the platform D1 and soon is not.
 *
 * Extracted from dev-worker/index.js (2026-09-27) so the MCP tools and the REST handlers
 * execute the SAME code instead of two parallel implementations. The extraction is
 * behaviour-preserving: every REST response body, status code and side effect is what the
 * inlined handlers produced. New capability (access control, actor-derived createdBy,
 * optional expectedVersion on addNode) is ADDITIVE and opt-in per caller, so existing REST
 * clients keep their current contract.
 *
 * Functions return plain result objects, never Responses — the caller decides the wire
 * format. That is what lets one implementation serve both HTTP/REST and MCP/JSON-RPC.
 */

import { parseQuery, matchGraph, collectWords, suggest } from './mcp/search-text.js'
import { platformStore, resolveGraphStore, GraphStoreError, reserveLocation, activateLocation, dropPendingLocation, relocateGraph, worldStoresFor, defaultWorldFor, setLocationStatus, graphIdOfTrashId, sharedInFor, sharedWorldStore, sharesOf, putShare, dropShare, knownWorld, SHARE_MODES } from './graph-store.js'

/**
 * resolveGraphStore() throws on routing failures; the service speaks in fail() results. `caller`
 * is who is asking, for the World-store check only — distinct from `actor`, which on the REST
 * paths also decides who a new graph's creator is and is deliberately absent there.
 */
async function storeFor(env, args) {
  try {
    return { store: await resolveGraphStore(env, args) }
  } catch (e) {
    if (e instanceof GraphStoreError) return { error: fail(ERR[e.code] || ERR.INTERNAL_ERROR, e.message) }
    throw e
  }
}

/** A World store's failures arrive as thrown GraphStoreErrors; turn them into results too. */
async function guarded(fn) {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof GraphStoreError) return fail(ERR[e.code] || ERR.INTERNAL_ERROR, e.message)
    throw e
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error codes — the structured vocabulary shared by REST and MCP
// ─────────────────────────────────────────────────────────────────────────────

export const ERR = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INSUFFICIENT_SCOPE: 'INSUFFICIENT_SCOPE',
  FORBIDDEN_GRAPH: 'FORBIDDEN_GRAPH',
  INVALID_INPUT: 'INVALID_INPUT',
  GRAPH_NOT_FOUND: 'GRAPH_NOT_FOUND',
  NODE_EXISTS: 'NODE_EXISTS',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  STORE_UNAVAILABLE: 'STORE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
}

/** HTTP status for each code, so a REST wrapper needs no mapping table of its own. */
const ERR_STATUS = {
  [ERR.UNAUTHENTICATED]: 401,
  [ERR.INSUFFICIENT_SCOPE]: 403,
  [ERR.FORBIDDEN_GRAPH]: 403,
  [ERR.INVALID_INPUT]: 400,
  [ERR.GRAPH_NOT_FOUND]: 404,
  [ERR.NODE_EXISTS]: 409,
  [ERR.VERSION_CONFLICT]: 409,
  [ERR.RATE_LIMITED]: 429,
  [ERR.STORE_UNAVAILABLE]: 503,
  [ERR.INTERNAL_ERROR]: 500,
}

function fail(code, message, extra = {}) {
  return { ok: false, code, status: ERR_STATUS[code] || 500, message, ...extra }
}

export function statusForCode(code) {
  return ERR_STATUS[code] || 500
}

// ─────────────────────────────────────────────────────────────────────────────
// Links — the canonical editor/viewer URL formats
// ─────────────────────────────────────────────────────────────────────────────

export const EDITOR_BASE = 'https://editor.vegvisr.org'

/**
 * A graph stored in a World opens in that World's own editor (editor.<domain>, the same
 * convention as graphs.<domain>), where its founder is signed in — editor.vegvisr.org has no
 * session for her, so a link there is refused (403) for a private World graph.
 */
export function editorBaseFor(world) {
  return world ? `https://editor.${String(world).toLowerCase()}` : EDITOR_BASE
}

export function graphLinks(graphId, world = null) {
  const base = editorBaseFor(world)
  return {
    graphId,
    editorUrl: `${base}/?graphId=${graphId}`,
    viewerUrl: `${base}/view?graphId=${graphId}`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Actor — one normalised identity, whatever the auth method was
// ─────────────────────────────────────────────────────────────────────────────

/**
 * validateAuth() in index.js reports `userId` differently per method: api_tokens.user_id for
 * a token, the email for a session, null for a service binding or trusted origin. Anything
 * that has to decide ownership needs one shape, so normalise once here.
 *
 * `anonymous` marks an actor with no identity at all (service binding / trusted origin).
 * Such an actor may act on the REST paths exactly as before, but can never pass an
 * ownership check — see checkAccess().
 */
export function normalizeActor(validation) {
  if (!validation || !validation.valid) return null
  const email = validation.userEmail || (isEmail(validation.userId) ? validation.userId : null)
  const role = validation.userRole || null
  return {
    userId: validation.userId || null,
    email: email ? String(email).toLowerCase() : null,
    role,
    isSuperadmin: String(role || '').toLowerCase() === 'superadmin',
    authMethod: validation.authMethod || 'unknown',
    scopes: Array.isArray(validation.scopes) ? validation.scopes : [],
    anonymous: !email && !validation.userId,
  }
}

function isEmail(v) {
  return typeof v === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)
}

export function actorLabel(actor) {
  if (!actor) return 'Unknown'
  return actor.email || actor.userId || 'Unknown'
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared shaping helpers (moved verbatim out of index.js)
// ─────────────────────────────────────────────────────────────────────────────

export const sanitizeGraphData = (graphData) => {
  const sanitize = (obj) =>
    Object.fromEntries(
      Object.entries(obj)
        .filter(([, value]) => value !== null)
        .map(([key, value]) => [
          key,
          typeof value === 'object' && value !== null && !Array.isArray(value)
            ? sanitize(value)
            : value,
        ]),
    )

  return {
    ...graphData,
    nodes: graphData.nodes.map((node) => ({
      ...sanitize(node),
      visible: node.visible !== false,
      position: node.position || { x: 0, y: 0 },
      imageWidth: node.imageWidth || null,
      imageHeight: node.imageHeight || null,
      path: node.path || null,
    })),
    edges: graphData.edges.map((edge) => {
      const sanitizedEdge = sanitize(edge)
      return {
        id: edge.id || `${edge.source}_${edge.target}`,
        source: edge.source,
        target: edge.target,
        ...(sanitizedEdge.label !== undefined && { label: sanitizedEdge.label }),
        ...(sanitizedEdge.type !== undefined && { type: sanitizedEdge.type }),
        ...(sanitizedEdge.info !== undefined && { info: sanitizedEdge.info }),
      }
    }),
  }
}

// ── data-node encryption (AES-256-GCM + PBKDF2) ──────────────────────
export async function encryptDataNodeInfo(plaintext, masterKey) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(masterKey), { name: 'PBKDF2' }, false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('vegvisr-data-node'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext))
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptDataNodeInfo(encryptedBase64, masterKey) {
  const combined = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(masterKey), { name: 'PBKDF2' }, false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('vegvisr-data-node'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

/**
 * Edge ids, one rule for every read and write: an edge keeps the id it was stored with; only an
 * edge without one gets `source_target`. Before 2026-11-16 every path overwrote the id with
 * `source_target`, so two edges between the same pair (a flow step's "next" and "error") came out
 * with one id — and add_edge's explicit id was stored but never read back.
 *
 * unique (writes only): an id already used earlier in the same graph gets the edge's label, or a
 * counter, appended — so a write never stores two edges with one id. Reads do not rename: what a
 * reader sees is what is stored, so removeEdge by the id it was shown finds that edge.
 */
export function withEdgeIds(edges, { unique = false } = {}) {
  const seen = new Set()
  return (Array.isArray(edges) ? edges : []).map((edge) => {
    const stored = edge?.id
    let id = stored !== undefined && stored !== null && String(stored).trim() !== '' ? String(stored) : `${edge?.source}_${edge?.target}`
    if (unique && seen.has(id)) {
      const tag = String(edge?.label || '').replace(/[^A-Za-z0-9_-]/g, '')
      const base = tag ? `${id}_${tag}` : id
      let candidate = base
      for (let n = 2; seen.has(candidate); n++) candidate = `${base}_${n}`
      id = candidate
    }
    seen.add(id)
    return { ...edge, id, source: edge?.source, target: edge?.target }
  })
}

/** Node/edge enrichment applied on every write. Verbatim from /saveGraphWithHistory. */
function enrichGraphData(graphData) {
  return {
    ...graphData,
    nodes: graphData.nodes.map((node) => ({
      ...node,
      bibl: Array.isArray(node.bibl) ? node.bibl : [],
      type: node.type || null,
      info: node.info || null,
      position: node.position || { x: 0, y: 0 },
      imageWidth: node.imageWidth || null,
      imageHeight: node.imageHeight || null,
      visible: node.visible !== false,
      path: node.path || null,
    })),
    edges: withEdgeIds(graphData.edges, { unique: true }),
  }
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidV4(id) {
  return UUID_V4_RE.test(String(id || ''))
}

// ─────────────────────────────────────────────────────────────────────────────
// A node's own update time (2026-11-20)
// ─────────────────────────────────────────────────────────────────────────────
//
// node.metadata.updatedAt (ISO, UTC) is when the node's CONTENT last changed. Until this, only the
// graph carried a time, and a map that wanted "the nodes changed today" had to read two saved
// versions of every graph and compare them. The server sets the time on every versioned write;
// what a client sends in that field is never trusted. Moving a node in an editor (position, x, y,
// visible) is not a change to the node. Nodes written before this carry no time.

const NODE_PLACE_KEYS = new Set(['position', 'x', 'y', 'visible'])

/** A node as text for comparing two states of it: place and the stamp itself left out. */
function nodeFace(node) {
  const n = node && typeof node === 'object' ? node : {}
  const out = {}
  for (const k of Object.keys(n).sort()) {
    if (NODE_PLACE_KEYS.has(k)) continue
    let v = n[k]
    if (k === 'metadata' && v && typeof v === 'object' && !Array.isArray(v)) {
      const m = {}
      for (const mk of Object.keys(v).sort()) if (mk !== 'updatedAt') m[mk] = v[mk]
      v = Object.keys(m).length ? m : null
    }
    // The defaults enrichGraphData fills in on a whole-graph save, so a node stored by add_node
    // and the same node sent back by an editor compare equal.
    if (k === 'bibl' && Array.isArray(v) && !v.length) v = null
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return JSON.stringify(out)
}

/** Set (time) or clear (null) a node's update time. A metadata that is not an object is left alone. */
function setNodeUpdatedAt(node, time) {
  if (!node || typeof node !== 'object') return
  const m = node.metadata
  if (m == null) {
    if (time) node.metadata = { updatedAt: time }
    return
  }
  if (typeof m !== 'object' || Array.isArray(m)) return
  if (time) m.updatedAt = time
  else delete m.updatedAt
}

/**
 * Whole-graph save: a node that is new, or reads differently than the stored one, gets `now`;
 * an unchanged node keeps the time the stored node carries (or none). prevNodes null: a new graph.
 */
export function stampChangedNodes(prevNodes, nodes, now) {
  const was = new Map((Array.isArray(prevNodes) ? prevNodes : []).filter((n) => n && n.id != null).map((n) => [String(n.id), n]))
  for (const n of Array.isArray(nodes) ? nodes : []) {
    if (!n || typeof n !== 'object') continue
    const old = n.id != null ? was.get(String(n.id)) : null
    if (!old || nodeFace(old) !== nodeFace(n)) setNodeUpdatedAt(n, now)
    else {
      const t = old.metadata && typeof old.metadata === 'object' ? old.metadata.updatedAt : null
      setNodeUpdatedAt(n, typeof t === 'string' && t ? t : null)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Version helpers
// ─────────────────────────────────────────────────────────────────────────────

/** The authoritative current version of a graph: MAX(version) in the history table. */
export async function currentVersion(env, graphId, caller = null) {
  const store = await resolveGraphStore(env, { graphId, actor: caller })
  return store.currentVersion(graphId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Access control — NEW. Nothing like this existed before 2026-09-27.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decide whether `actor` may perform `action` on `graphId`.
 *
 * Ownership in this database is genuinely messy, and this function is deliberately
 * fail-closed about it. Measured 2026-09-27 over 1271 graphs:
 *   - created_by column populated on all 1271, but only 892 are email-shaped;
 *     the other 379 hold an app name ('my-app') or 'Unknown' and identify nobody.
 *   - user_id column populated on 258.
 * So a graph whose creator is an app name has NO owner and is reachable only by a
 * Superadmin, or by anyone if it is published (read only). That is the safe reading of
 * "a user may only read or change graphs the user has access to".
 *
 * This is enforced on the MCP path. The REST handlers keep their historical behaviour
 * (see the F2/F3 notes in index.js) so existing clients do not break.
 *
 * action: 'read' | 'write' | 'publish'
 */
export async function checkAccess(env, actor, graphId, action = 'read') {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')

  const { store, error } = await storeFor(env, { graphId, actor })
  if (error) return error
  return guarded(async () => {
  const row = await store.getRow(graphId)
  if (!row) return fail(ERR.GRAPH_NOT_FOUND, `Graph ${graphId} not found.`)

  let meta = {}
  try {
    meta = JSON.parse(row.data)?.metadata || {}
  } catch {
    /* a graph with unparseable JSON is treated as having no metadata */
  }

  const isPublished = meta.publicationState === 'published'

  // A graph in a World store: resolveGraphStore() has already admitted this actor (Superadmin, the
  // World's founder or account holder, or a member carrying the World's tag — mayUseWorld), and
  // that is the whole rule there — the World's graphs are shared by its members, whoever typed
  // them in.
  //
  // Reached through a share (graph_shares): a 'read' share may read and run, nothing else.
  if (store.kind === 'world' && store.readOnly && action !== 'read' && action !== 'run') {
    return fail(ERR.FORBIDDEN_GRAPH, `Graph ${graphId} is in ${store.world} and shared with ${store.sharedVia} for reading only, so you may not ${action} it.`)
  }
  if (store.kind === 'world') return { ok: true, graph: row, owner: ownerOf(row, meta), isPublished, world: store.world, ...(store.sharedVia ? { sharedVia: store.sharedVia, sharedMode: store.readOnly ? 'read' : 'write' } : {}) }

  // Superadmin passes everything.
  if (actor.isSuperadmin) return { ok: true, graph: row, owner: ownerOf(row, meta), isPublished }

  const owner = ownerOf(row, meta)
  const isOwner = Boolean(owner && actor.email && owner === actor.email)
  const userIdMatch = Boolean(row.user_id && actor.userId && row.user_id === actor.userId)

  if (isOwner || userIdMatch) return { ok: true, graph: row, owner, isPublished }

  if (action === 'read' && isPublished) return { ok: true, graph: row, owner, isPublished }

  return fail(
    ERR.FORBIDDEN_GRAPH,
    action === 'read'
      ? `Graph ${graphId} is private and belongs to another user.`
      : `You do not have permission to ${action} graph ${graphId}.`,
  )
  })
}

/**
 * May `caller` READ this graph over the open REST read routes? The gate behind
 * KG_ENFORCE_READ_AUTH (owner decision 2026-10-24: a graph is read only from approved sources).
 *
 *   - an identified caller (a user's token, a server source's own token, a bound worker acting
 *     for a user): checkAccess(..., 'read') — owner, Superadmin, or published
 *   - an anonymous caller (no credentials, a trusted origin, a browser component): published
 *     graphs only. An id shipped to a visitor's browser can be copied, so it names a source but
 *     proves nothing, and gets no more than nobody does.
 *
 * A graph in a World store keeps its own admission rule, applied by resolveGraphStore().
 * Pure check — the caller decides what a refusal looks like on the wire.
 */
export async function checkReadAccess(env, caller, graphId) {
  if (!graphId) return fail(ERR.INVALID_INPUT, 'Graph ID is required.')
  if (caller && !caller.anonymous) return checkAccess(env, caller, graphId, 'read')

  const { store, error } = await storeFor(env, { graphId, actor: caller || null })
  if (error) return error
  return guarded(async () => {
    const row = await store.getRow(graphId)
    if (!row) return fail(ERR.GRAPH_NOT_FOUND, `Graph ${graphId} not found.`)
    let meta = {}
    try {
      meta = JSON.parse(row.data)?.metadata || {}
    } catch {
      /* unparseable JSON has no publicationState, so it is not published */
    }
    if (meta.publicationState === 'published') return { ok: true, isPublished: true }
    return fail(ERR.FORBIDDEN_GRAPH, `Graph ${graphId} is not published.`)
  })
}

/** The owner e-mail of a graph, or null when the creator field names an app, not a person. */
function ownerOf(row, meta) {
  for (const candidate of [meta?.createdBy, row?.created_by]) {
    if (isEmail(candidate)) return String(candidate).toLowerCase()
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read a graph and shape it exactly as GET /getknowgraph does.
 * Pure read — the caller decides whether to run checkAccess() first.
 *
 * opts: { nodeId, nodeTitle } optional filters, same semantics as the query params.
 */
export async function getGraph(env, id, opts = {}) {
  if (!id) return fail(ERR.INVALID_INPUT, 'Graph ID is required.')

  const { store, error } = await storeFor(env, { graphId: id, actor: opts.caller ?? null })
  if (error) return error
  return guarded(async () => {
  const result = await store.getRow(id)
  if (!result) return fail(ERR.GRAPH_NOT_FOUND, 'Graph not found.')

  const graphData = await shapeGraphData(env, JSON.parse(result.data), opts)
  graphData.created_date = result.created_date
  graphData.updated_at = result.updated_at

  return { ok: true, graph: graphData, version: graphData.metadata?.version ?? null, world: store.world }
  })
}

/**
 * The shaping GET /getknowgraph applies to stored graph JSON: sanitize, default the image
 * fields, give edges ids, apply the nodeId/nodeTitle filter, decrypt data-nodes. Shared by the
 * current row and by history versions, so an old version reads exactly like the live graph.
 */
async function shapeGraphData(env, raw, opts = {}) {
  const graphData = sanitizeGraphData(raw)

  graphData.nodes = graphData.nodes.map((node) => ({
    ...node,
    imageWidth: node.imageWidth || null,
    imageHeight: node.imageHeight || null,
    path: node.path || null,
  }))
  graphData.edges = withEdgeIds(graphData.edges)

  const { nodeId, nodeTitle } = opts
  if (nodeId || nodeTitle) {
    let filteredNodes = graphData.nodes
    if (nodeId) {
      filteredNodes = filteredNodes.filter((node) => String(node.id) === String(nodeId))
    }
    if (nodeTitle) {
      const needle = String(nodeTitle).toLowerCase()
      filteredNodes = filteredNodes.filter((node) => {
        const label = node.label || node.title || node.name || ''
        return String(label).toLowerCase().includes(needle)
      })
    }
    const allowedIds = new Set(filteredNodes.map((node) => String(node.id)))
    graphData.nodes = filteredNodes
    graphData.edges = graphData.edges.filter(
      (edge) => allowedIds.has(String(edge.source)) && allowedIds.has(String(edge.target)),
    )
  }

  if (env.ENCRYPTION_MASTER_KEY && graphData.nodes) {
    for (const node of graphData.nodes) {
      if (node.type === 'data-node' && node.metadata?.encrypted && node.info) {
        try {
          node.info = await decryptDataNodeInfo(node.info, env.ENCRYPTION_MASTER_KEY)
        } catch (e) {
          console.error('Failed to decrypt data-node:', node.id, e.message)
          node.info = '[]'
        }
      }
    }
  }

  return graphData
}

/**
 * The saved versions of a graph, newest first: [{ version, timestamp }]. Only versioned writes
 * add a row, and the store keeps the newest HISTORY_CAP of them.
 * Pure read — the caller decides whether to run checkAccess() first.
 */
export async function getGraphHistory(env, id, opts = {}) {
  if (!id) return fail(ERR.INVALID_INPUT, 'Graph ID is required.')
  const { store, error } = await storeFor(env, { graphId: id, actor: opts.caller ?? null })
  if (error) return error
  return guarded(async () => {
    const rows = (await store.historyList(id))?.results || []
    return {
      ok: true,
      versions: rows.map((r) => ({ version: Number(r.version), timestamp: r.timestamp ?? null })),
      world: store.world,
    }
  })
}

/**
 * One saved version of a graph, shaped like getGraph(). opts.nodeId narrows it to one node.
 * Pure read — the caller decides whether to run checkAccess() first.
 */
export async function getGraphVersion(env, id, version, opts = {}) {
  if (!id) return fail(ERR.INVALID_INPUT, 'Graph ID is required.')
  if (!Number.isInteger(version) || version < 1) return fail(ERR.INVALID_INPUT, 'version must be a positive integer.')
  const { store, error } = await storeFor(env, { graphId: id, actor: opts.caller ?? null })
  if (error) return error
  return guarded(async () => {
    const row = await store.historyVersion(id, version)
    if (!row) return fail(ERR.GRAPH_NOT_FOUND, `Graph ${id} has no saved version ${version}.`)
    const graphData = await shapeGraphData(env, JSON.parse(row.data), opts)
    return { ok: true, graph: graphData, version, world: store.world }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a graph with version history — the implementation behind POST /saveGraphWithHistory.
 *
 * `actor` is optional. When given, metadata.createdBy is FORCED to the authenticated
 * identity for a NEW graph, so a client cannot claim to be someone else. Existing REST
 * callers pass no actor and keep the historical body-supplied createdBy.
 *
 * Returns { ok, id, newVersion, graphData } or a structured failure.
 */
export async function saveGraph(env, { id, graphData, override = false, actor = null, caller = undefined, world = null }) {
  if (!id || !graphData) {
    return fail(ERR.INVALID_INPUT, 'Graph ID and graph data are required.')
  }

  // `world` only places a NEW graph; an existing graph is written wherever it already lives.
  const who = caller === undefined ? actor : caller
  const located = await storeFor(env, { graphId: id, actor: who })
  if (located.error) return located.error
  let store = located.store
  return guarded(async () => {
  const graphExists = await store.exists(id)
  // No World named: a founder of one active World store gets it by default (G7). System graphs
  // (#EMAIL-) stay on the platform whoever creates them — other workers read them there.
  if (!world && !graphExists && store.kind === 'platform' && !/#EMAIL-/i.test(String(graphData?.metadata?.metaArea || ''))) {
    world = await defaultWorldFor(env, who)
  }
  if (world && !graphExists && store.kind === 'platform') {
    // System graphs are read straight from the platform database by other workers (the World's
    // e-mail template, by email-service, via its #EMAIL-<domain> tag). One placed in a World store
    // would silently stop working, so they never go there.
    if (/#EMAIL-/i.test(String(graphData?.metadata?.metaArea || ''))) {
      return fail(ERR.INVALID_INPUT, 'A #EMAIL- system graph is read from the platform by the e-mail worker and cannot be stored in a World.')
    }
    const target = await storeFor(env, { world, actor: who })
    if (target.error) return target.error
    store = target.store
  }
  // world only PLACES a new graph. On an existing graph it is ignored — the graph stays where it
  // lives; moving one is move_graph_to_world. (Until 2026-10-15 this was an error, which would
  // have refused every save of a platform graph from an editor running on a World's host.)

  // UUID v4 required for NEW graphs. Existing graphs (semantic-named legacy ids are
  // common here) keep updating at their current id. Additive rule from 2026-05-28.
  if (!graphExists && !isUuidV4(id)) {
    return fail(ERR.INVALID_INPUT, 'New graph IDs must be a valid UUID v4. Existing graphs with non-UUID ids may still update at their current id.', {
      expected: 'UUID v4 (e.g., 550e8400-e29b-41d4-a716-446655440000)',
      received: id,
    })
  }

  const current = await store.currentVersion(id)

  let newVersion
  if (!graphExists && current === 0) {
    newVersion = 1
  } else {
    if (!override && graphData.metadata && graphData.metadata.version !== current) {
      return fail(ERR.VERSION_CONFLICT, 'Version mismatch. Please reload the latest version of the graph.', {
        currentVersion: current,
      })
    }
    newVersion = current + 1
  }

  if (!graphData.metadata) graphData.metadata = { title: null, description: null, createdBy: null }

  // Rule 3: createdBy comes from the authenticated user, never from the client.
  // Only stamped on creation — an existing graph keeps its original creator.
  if (actor && !graphExists) {
    graphData.metadata.createdBy = actorLabel(actor)
    if (actor.userId) graphData.metadata.userId = actor.userId
  }

  graphData.metadata.version = newVersion
  if (!Array.isArray(graphData.nodes)) graphData.nodes = []
  if (!Array.isArray(graphData.edges)) graphData.edges = []

  const enriched = enrichGraphData(graphData)

  const userId = enriched.metadata.userId || null
  const sourceApp = enriched.metadata.createdBy || null
  const now = new Date().toISOString()

  // Each node's own update time: compared with the graph as it is stored now.
  let storedNodes = null
  if (graphExists) {
    try {
      storedNodes = JSON.parse((await store.getRow(id))?.data || '{}')?.nodes || []
    } catch {
      storedNodes = [] // an unparseable stored graph: every node counts as changed
    }
  }
  // enrichGraphData copies each node but not its metadata: copy it, so the caller's object is not changed.
  for (const n of enriched.nodes) if (n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata)) n.metadata = { ...n.metadata }
  stampChangedNodes(storedNodes, enriched.nodes, now)

  // A new row stores '' for a missing title/description/creator; an existing row keeps its
  // column when the incoming value is missing (null → COALESCE in the store).
  const blank = graphExists ? null : ''
  const placing = store.kind === 'world' && !graphExists
  if (placing) await reserveLocation(env, id, store.world, now)
  try {
  await store.commit({
    id,
    create: !graphExists,
    data: JSON.stringify(enriched),
    version: newVersion,
    now,
    title: enriched.metadata.title || blank,
    description: enriched.metadata.description || blank,
    createdBy: enriched.metadata.createdBy || blank,
    userId,
    sourceApp,
  })
  } catch (e) {
    if (placing) await dropPendingLocation(env, id)
    throw e
  }
  if (placing) await activateLocation(env, id)

  return { ok: true, id, newVersion, graphData: enriched, created: !graphExists, world: store.world }
  })
}

/**
 * Create a brand-new private graph owned by `actor`. Thin, opinionated wrapper over
 * saveGraph() for the MCP create_graph tool.
 *
 * VEGR.AI rules applied here: UUID v4 id, createdBy from the authenticated user,
 * publicationState 'private' (rule 1 — never published without an explicit publish).
 */
export async function createGraph(env, { title, description = '', metaArea, nodes = [], edges = [], actor, world = null }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!title || !String(title).trim()) return fail(ERR.INVALID_INPUT, 'title is required.')
  if (!metaArea || !String(metaArea).trim()) return fail(ERR.INVALID_INPUT, 'metaArea is required.')

  const validation = validateNodesAndEdges(nodes, edges)
  if (!validation.ok) return validation

  const id = crypto.randomUUID()

  const graphData = {
    metadata: {
      title: String(title).trim(),
      description: String(description || '').trim(),
      createdBy: actorLabel(actor),
      metaArea: String(metaArea).trim(),
      publicationState: 'private',
      version: 0,
    },
    nodes: validation.nodes,
    edges: validation.edges,
  }

  const saved = await saveGraph(env, { id, graphData, override: false, actor, world })
  if (!saved.ok) return saved

  return {
    ok: true,
    graphId: id,
    title: graphData.metadata.title,
    metaArea: graphData.metadata.metaArea,
    publicationState: 'private',
    version: saved.newVersion,
    world: saved.world || null,
    ...graphLinks(id, saved.world),
  }
}

/**
 * Add one node to a graph. Wraps the historical insertNodeIntoGraph() behaviour and adds
 * OPTIONAL optimistic concurrency: pass expectedVersion to have a concurrent write refused
 * with VERSION_CONFLICT instead of silently interleaving. Omitting it preserves the
 * existing REST contract for POST /addNode, which never had the check.
 */
export async function addNode(env, { graphId, node, expectedVersion = null, actor = null , caller = undefined}) {
  if (!graphId || !node || typeof node !== 'object') {
    return fail(ERR.INVALID_INPUT, 'graphId and node are required.')
  }

  const located = await storeFor(env, { graphId, actor: caller === undefined ? actor : caller })
  if (located.error) return located.error
  const { store } = located
  return guarded(async () => {
  const result = await store.getRow(graphId)
  if (!result) return fail(ERR.GRAPH_NOT_FOUND, 'Graph not found.')

  const graphData = JSON.parse(result.data)
  if (!Array.isArray(graphData.nodes)) graphData.nodes = []
  if (!Array.isArray(graphData.edges)) graphData.edges = []

  const current = await store.currentVersion(graphId)
  if (expectedVersion !== null && expectedVersion !== undefined) {
    if (!Number.isInteger(expectedVersion)) {
      return fail(ERR.INVALID_INPUT, 'expectedVersion must be an integer when provided.')
    }
    if (current !== expectedVersion) {
      return fail(ERR.VERSION_CONFLICT, 'Grafen er endret siden den ble lest.', { currentVersion: current })
    }
  }

  // Rule 5: node ids are UUID v4 when the caller does not supply one.
  const nodeToInsert = { ...node, id: node.id || crypto.randomUUID() }

  if (graphData.nodes.some((n) => n.id === nodeToInsert.id)) {
    return fail(ERR.NODE_EXISTS, `Node with id ${nodeToInsert.id} already exists in graph ${graphId}.`)
  }

  if (nodeToInsert.type === 'data-node' && nodeToInsert.info && env.ENCRYPTION_MASTER_KEY) {
    nodeToInsert.info = await encryptDataNodeInfo(nodeToInsert.info, env.ENCRYPTION_MASTER_KEY)
    if (!nodeToInsert.metadata) nodeToInsert.metadata = {}
    nodeToInsert.metadata.encrypted = true
  }

  const now = new Date().toISOString()
  if (nodeToInsert.metadata && typeof nodeToInsert.metadata === 'object' && !Array.isArray(nodeToInsert.metadata)) nodeToInsert.metadata = { ...nodeToInsert.metadata }
  setNodeUpdatedAt(nodeToInsert, now)
  graphData.nodes.push(nodeToInsert)

  const newVersion = current + 1
  if (!graphData.metadata) graphData.metadata = {}
  graphData.metadata.version = newVersion

  await store.commit({
    id: graphId,
    data: JSON.stringify(graphData),
    version: newVersion,
    now,
  })

  return {
    ok: true,
    graphId,
    nodeId: nodeToInsert.id,
    currentVersion: current,
    newVersion,
    title: graphData.metadata?.title || null,
    metaArea: graphData.metadata?.metaArea || null,
    publicationState: graphData.metadata?.publicationState || 'private',
    ...graphLinks(graphId, store.world),
  }
  })
}

/**
 * Append one edge between two nodes that already exist in the graph. Mirrors addNode: nothing
 * existing is rewritten, a duplicate id is refused, expectedVersion (optional) guards against a
 * concurrent change. Added 2026-10-19 — before it, an edge could only be written by sending a
 * whole graph (create_graph), so a node added later could never be connected over the MCP.
 */
export async function addEdge(env, { graphId, edge, expectedVersion = null, actor = null, caller = undefined }) {
  if (!graphId || !edge || typeof edge !== 'object' || !edge.source || !edge.target) {
    return fail(ERR.INVALID_INPUT, 'graphId and an edge with source and target are required.')
  }

  const located = await storeFor(env, { graphId, actor: caller === undefined ? actor : caller })
  if (located.error) return located.error
  const { store } = located
  return guarded(async () => {
  const result = await store.getRow(graphId)
  if (!result) return fail(ERR.GRAPH_NOT_FOUND, 'Graph not found.')

  const graphData = JSON.parse(result.data)
  if (!Array.isArray(graphData.nodes)) graphData.nodes = []
  if (!Array.isArray(graphData.edges)) graphData.edges = []

  const current = await store.currentVersion(graphId)
  if (expectedVersion !== null && expectedVersion !== undefined) {
    if (!Number.isInteger(expectedVersion)) {
      return fail(ERR.INVALID_INPUT, 'expectedVersion must be an integer when provided.')
    }
    if (current !== expectedVersion) {
      return fail(ERR.VERSION_CONFLICT, 'Grafen er endret siden den ble lest.', { currentVersion: current })
    }
  }

  const ids = new Set(graphData.nodes.map((n) => n.id))
  const missing = [edge.source, edge.target].filter((id) => !ids.has(id))
  if (missing.length) {
    return fail(ERR.INVALID_INPUT, `No node with id ${missing.join(' or ')} in graph ${graphId}.`)
  }

  const edgeToInsert = {
    id: edge.id || `${edge.source}_${edge.target}`,
    source: edge.source,
    target: edge.target,
    ...(edge.label ? { label: String(edge.label) } : {}),
    ...(edge.type ? { type: String(edge.type) } : {}),
  }
  if (graphData.edges.some((e) => e.id === edgeToInsert.id)) {
    return fail(ERR.INVALID_INPUT, `Edge ${edgeToInsert.id} already exists in graph ${graphId}.`)
  }

  graphData.edges.push(edgeToInsert)

  const newVersion = current + 1
  if (!graphData.metadata) graphData.metadata = {}
  graphData.metadata.version = newVersion

  await store.commit({
    id: graphId,
    data: JSON.stringify(graphData),
    version: newVersion,
    now: new Date().toISOString(),
  })

  return {
    ok: true,
    graphId,
    edgeId: edgeToInsert.id,
    currentVersion: current,
    newVersion,
    title: graphData.metadata?.title || null,
    metaArea: graphData.metadata?.metaArea || null,
    publicationState: graphData.metadata?.publicationState || 'private',
    ...graphLinks(graphId, store.world),
  }
  })
}

/**
 * Add many nodes and edges in ONE saved version (MCP add_nodes, 2026-11-18).
 *
 * Asked for after «Gruppe 2026-09-24»: the group flow wrote 10 nodes and 5 edges one call at a
 * time and the graph got 15 versions in 20 seconds. The history keeps only the 20 newest versions,
 * so building a graph pushed its own meaningful history out. Same rules as addNode/addEdge:
 *   - nothing existing is rewritten;
 *   - a node or edge whose id is already in the graph is SKIPPED and reported (so a flow that runs
 *     again writes nothing twice — what EXISTS_IS_OK does for single add_node/add_edge steps);
 *   - an edge may join nodes added in the same call;
 *   - everything is checked first: one bad edge or a duplicate id inside the call writes nothing;
 *   - nothing new to add → no new version.
 */
export const ADD_MANY_MAX_NODES = 100
export const ADD_MANY_MAX_EDGES = 300

export async function addElements(env, { graphId, nodes = [], edges = [], expectedVersion = null, actor = null, caller = undefined }) {
  if (!graphId) return fail(ERR.INVALID_INPUT, 'graphId is required.')
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return fail(ERR.INVALID_INPUT, 'nodes and edges must be lists.')
  if (!nodes.length && !edges.length) return fail(ERR.INVALID_INPUT, 'Give at least one node or edge.')
  if (nodes.length > ADD_MANY_MAX_NODES) return fail(ERR.INVALID_INPUT, `At most ${ADD_MANY_MAX_NODES} nodes in one call.`)
  if (edges.length > ADD_MANY_MAX_EDGES) return fail(ERR.INVALID_INPUT, `At most ${ADD_MANY_MAX_EDGES} edges in one call.`)
  if (nodes.some((n) => !n || typeof n !== 'object')) return fail(ERR.INVALID_INPUT, 'Every node must be an object.')
  if (edges.some((e) => !e || typeof e !== 'object' || !e.source || !e.target)) {
    return fail(ERR.INVALID_INPUT, 'Every edge needs a source and a target.')
  }

  const located = await storeFor(env, { graphId, actor: caller === undefined ? actor : caller })
  if (located.error) return located.error
  const { store } = located
  return guarded(async () => {
  const result = await store.getRow(graphId)
  if (!result) return fail(ERR.GRAPH_NOT_FOUND, 'Graph not found.')

  const graphData = JSON.parse(result.data)
  if (!Array.isArray(graphData.nodes)) graphData.nodes = []
  if (!Array.isArray(graphData.edges)) graphData.edges = []

  const current = await store.currentVersion(graphId)
  if (expectedVersion !== null && expectedVersion !== undefined) {
    if (!Number.isInteger(expectedVersion)) {
      return fail(ERR.INVALID_INPUT, 'expectedVersion must be an integer when provided.')
    }
    if (current !== expectedVersion) {
      return fail(ERR.VERSION_CONFLICT, 'Grafen er endret siden den ble lest.', { currentVersion: current })
    }
  }

  // Nodes: ids (UUID v4 when none is given), duplicates inside the call refused, existing ones skipped.
  const existingNodes = new Set(graphData.nodes.map((n) => n.id))
  const seen = new Set()
  const newNodes = []
  const skippedNodes = []
  for (const node of nodes) {
    const n = { ...node, id: node.id || crypto.randomUUID() }
    if (seen.has(n.id)) return fail(ERR.INVALID_INPUT, `Node id ${n.id} appears twice in this call.`)
    seen.add(n.id)
    if (existingNodes.has(n.id)) skippedNodes.push(n.id)
    else newNodes.push(n)
  }

  // Edges: both ends must exist after this call; existing edge ids skipped.
  const allIds = new Set([...existingNodes, ...newNodes.map((n) => n.id)])
  const existingEdges = new Set(graphData.edges.map((e) => e.id))
  const seenEdges = new Set()
  const newEdges = []
  const skippedEdges = []
  for (const edge of edges) {
    const missing = [edge.source, edge.target].filter((id) => !allIds.has(id))
    if (missing.length) {
      return fail(ERR.INVALID_INPUT, `Edge ${edge.source} → ${edge.target}: no node with id ${missing.join(' or ')} in graph ${graphId} or in this call. Nothing was written.`)
    }
    const e = {
      id: edge.id || `${edge.source}_${edge.target}`,
      source: edge.source,
      target: edge.target,
      ...(edge.label ? { label: String(edge.label) } : {}),
      ...(edge.type ? { type: String(edge.type) } : {}),
    }
    if (seenEdges.has(e.id)) return fail(ERR.INVALID_INPUT, `Edge id ${e.id} appears twice in this call.`)
    seenEdges.add(e.id)
    if (existingEdges.has(e.id)) skippedEdges.push(e.id)
    else newEdges.push(e)
  }

  const base = {
    ok: true,
    graphId,
    addedNodeIds: newNodes.map((n) => n.id),
    addedEdgeIds: newEdges.map((e) => e.id),
    skippedNodeIds: skippedNodes,
    skippedEdgeIds: skippedEdges,
    currentVersion: current,
    title: graphData.metadata?.title || null,
    metaArea: graphData.metadata?.metaArea || null,
    publicationState: graphData.metadata?.publicationState || 'private',
    ...graphLinks(graphId, store.world),
  }
  if (!newNodes.length && !newEdges.length) return { ...base, newVersion: current, written: false }

  const now = new Date().toISOString()
  for (const n of newNodes) {
    if (n.type === 'data-node' && n.info && env.ENCRYPTION_MASTER_KEY) {
      n.info = await encryptDataNodeInfo(n.info, env.ENCRYPTION_MASTER_KEY)
      if (!n.metadata) n.metadata = {}
      n.metadata.encrypted = true
    }
    if (n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata)) n.metadata = { ...n.metadata }
    setNodeUpdatedAt(n, now)
    graphData.nodes.push(n)
  }
  graphData.edges.push(...newEdges)

  const newVersion = current + 1
  if (!graphData.metadata) graphData.metadata = {}
  graphData.metadata.version = newVersion

  await store.commit({
    id: graphId,
    data: JSON.stringify(graphData),
    version: newVersion,
    now,
  })

  return { ...base, newVersion, written: true }
  })
}

/**
 * Remove ONE edge from a graph (MCP remove_edge, 2026-11-16). Nodes are never touched.
 *
 * Asked for when a step had to be moved inside a flow graph and nothing could take an edge away,
 * so the step ended up last instead of where it belonged. The edge is named by its id, or by
 * source + target (+ label when two edges join the same pair). expectedVersion is REQUIRED, as
 * for update_node: this rewrites the edge list, and the graph's history keeps the version before.
 */
export async function removeEdge(env, { graphId, edgeId = null, source = null, target = null, label = null, expectedVersion, actor = null, caller = undefined }) {
  if (!graphId || (!edgeId && !(source && target))) {
    return fail(ERR.INVALID_INPUT, 'graphId and either edgeId or source + target are required.')
  }
  if (!Number.isInteger(expectedVersion)) {
    return fail(ERR.INVALID_INPUT, 'expectedVersion (an integer, from get_graph) is required to remove an edge.')
  }

  const located = await storeFor(env, { graphId, actor: caller === undefined ? actor : caller })
  if (located.error) return located.error
  const { store } = located
  return guarded(async () => {
  const result = await store.getRow(graphId)
  if (!result) return fail(ERR.GRAPH_NOT_FOUND, 'Graph not found.')

  const graphData = JSON.parse(result.data)
  if (!Array.isArray(graphData.edges)) graphData.edges = []

  const current = await store.currentVersion(graphId)
  if (current !== expectedVersion) {
    return fail(ERR.VERSION_CONFLICT, 'Grafen er endret siden den ble lest.', { currentVersion: current })
  }

  const matches = graphData.edges.filter((e) =>
    edgeId
      ? e.id === edgeId
      : e.source === source && e.target === target && (label === null || label === undefined || String(e.label || '') === String(label)))
  if (!matches.length) {
    return fail(ERR.INVALID_INPUT, `No edge ${edgeId ? `with id ${edgeId}` : `${source} → ${target}${label ? ` (${label})` : ''}`} in graph ${graphId}. Nothing was removed.`)
  }
  if (matches.length > 1) {
    return fail(ERR.INVALID_INPUT, `${matches.length} edges match (${matches.map((e) => `${e.id}${e.label ? ` "${e.label}"` : ''}`).join(', ')}). Name one by edgeId or label. Nothing was removed.`)
  }
  const removed = matches[0]
  graphData.edges = graphData.edges.filter((e) => e !== removed)

  const newVersion = current + 1
  if (!graphData.metadata) graphData.metadata = {}
  graphData.metadata.version = newVersion

  await store.commit({
    id: graphId,
    data: JSON.stringify(graphData),
    version: newVersion,
    now: new Date().toISOString(),
  })

  return {
    ok: true,
    graphId,
    edgeId: removed.id || `${removed.source}_${removed.target}`,
    source: removed.source,
    target: removed.target,
    label: removed.label || null,
    currentVersion: current,
    newVersion,
    title: graphData.metadata?.title || null,
    metaArea: graphData.metadata?.metaArea || null,
    publicationState: graphData.metadata?.publicationState || 'private',
    ...graphLinks(graphId, store.world),
  }
  })
}

/**
 * Remove ONE node from a graph, with the edges that touch it (MCP remove_node, 2026-11-20).
 *
 * Asked for when a payment node had been made for someone who is not a member, and nothing could
 * take a node away. The node is named by its id. expectedVersion is REQUIRED, as for remove_edge:
 * this rewrites the node and edge lists, and the graph's history keeps the version before, so the
 * node can be read back from get_graph_version. Other nodes are never touched.
 */
export async function removeNode(env, { graphId, nodeId, expectedVersion, actor = null, caller = undefined }) {
  if (!graphId || !nodeId) return fail(ERR.INVALID_INPUT, 'graphId and nodeId are required.')
  if (!Number.isInteger(expectedVersion)) {
    return fail(ERR.INVALID_INPUT, 'expectedVersion (an integer, from get_graph) is required to remove a node.')
  }

  const located = await storeFor(env, { graphId, actor: caller === undefined ? actor : caller })
  if (located.error) return located.error
  const { store } = located
  return guarded(async () => {
  const result = await store.getRow(graphId)
  if (!result) return fail(ERR.GRAPH_NOT_FOUND, 'Graph not found.')

  const graphData = JSON.parse(result.data)
  if (!Array.isArray(graphData.nodes)) graphData.nodes = []
  if (!Array.isArray(graphData.edges)) graphData.edges = []

  const current = await store.currentVersion(graphId)
  if (current !== expectedVersion) {
    return fail(ERR.VERSION_CONFLICT, 'Grafen er endret siden den ble lest.', { currentVersion: current })
  }

  const node = graphData.nodes.find((n) => n.id === nodeId)
  if (!node) return fail(ERR.INVALID_INPUT, `No node ${nodeId} in graph ${graphId}. Nothing was removed.`)
  const touching = graphData.edges.filter((e) => e.source === nodeId || e.target === nodeId)
  graphData.nodes = graphData.nodes.filter((n) => n !== node)
  graphData.edges = graphData.edges.filter((e) => !touching.includes(e))

  const newVersion = current + 1
  if (!graphData.metadata) graphData.metadata = {}
  graphData.metadata.version = newVersion

  await store.commit({
    id: graphId,
    data: JSON.stringify(graphData),
    version: newVersion,
    now: new Date().toISOString(),
  })

  return {
    ok: true,
    graphId,
    nodeId,
    label: node.label || null,
    type: node.type || null,
    removedEdgeIds: touching.map((e) => e.id || `${e.source}_${e.target}`),
    currentVersion: current,
    newVersion,
    title: graphData.metadata?.title || null,
    metaArea: graphData.metadata?.metaArea || null,
    publicationState: graphData.metadata?.publicationState || 'private',
    ...graphLinks(graphId, store.world),
  }
  })
}

/**
 * Update graph-level metadata under optimistic concurrency. Mirrors POST /patchGraphMetadata.
 * `allowPublicationState` gates the one field that must go through publishGraph() instead,
 * so publishing cannot happen as a side effect of an ordinary metadata edit (rule 2).
 */
/**
 * A caller's created date as the ISO string stored in created_date, or null when it is not a
 * usable date. A bare YYYY-MM-DD becomes noon UTC that day, so it reads as the same calendar day
 * in every time zone the apps run in.
 */
export function normalizeCreatedDate(value) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00.000Z` : v
  if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const d = new Date(t)
  if (d.toISOString().slice(0, 10) !== iso.slice(0, 10) && /^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  if (d.getUTCFullYear() < 1900 || t > Date.now()) return null
  return d.toISOString()
}

export async function updateMetadata(env, { graphId, fields, expectedVersion, actor = null, allowPublicationState = false , caller = undefined}) {
  if (!graphId || !fields || typeof fields !== 'object' || !Number.isInteger(expectedVersion)) {
    return fail(ERR.INVALID_INPUT, 'graphId, fields (object), and expectedVersion (integer) are required.')
  }
  if (!allowPublicationState && 'publicationState' in fields) {
    return fail(ERR.INVALID_INPUT, 'publicationState cannot be set through a metadata update — use the explicit publish action.')
  }

  const located = await storeFor(env, { graphId, actor: caller === undefined ? actor : caller })
  if (located.error) return located.error
  const { store } = located
  return guarded(async () => {
  const row = await store.getRow(graphId)
  if (!row) return fail(ERR.GRAPH_NOT_FOUND, 'Graph not found.')

  const current = await store.currentVersion(graphId)
  if (current !== expectedVersion) {
    return fail(ERR.VERSION_CONFLICT, 'Grafen er endret siden den ble lest.', { currentVersion: current, expectedVersion })
  }

  const graphData = JSON.parse(row.data)
  if (!graphData.metadata) graphData.metadata = {}

  // createdBy is never client-settable (rule 3).
  // createdDate is the row's created_date column, not a metadata key: it is lifted out here and
  // handed to the store. Added 2026-11-14 so a graph that stands for something published earlier
  // (a journal article) can sit at that date in timelines. A World's store is a separate
  // deployment that may not know the field yet and would drop it silently, so it is refused there.
  const { createdBy: _ignoredCreatedBy, version: _ignoredVersion, createdDate: rawCreatedDate, ...safeFields } = fields
  let createdDate = null
  if (rawCreatedDate !== undefined && rawCreatedDate !== null) {
    createdDate = normalizeCreatedDate(rawCreatedDate)
    if (!createdDate) {
      return fail(ERR.INVALID_INPUT, 'createdDate must be a date (YYYY-MM-DD) or an ISO date-time, not in the future and not before 1900.')
    }
    if (store.kind !== 'platform') {
      return fail(ERR.INVALID_INPUT, 'createdDate can only be changed on graphs stored on the platform, not in a World\'s own storage.')
    }
  }
  Object.assign(graphData.metadata, safeFields)

  const newVersion = current + 1
  graphData.metadata.version = newVersion

  await store.commit({
    id: graphId,
    data: JSON.stringify(graphData),
    version: newVersion,
    now: new Date().toISOString(),
    title: graphData.metadata.title || null,
    description: graphData.metadata.description || null,
    createdDate,
  })

  return {
    ok: true,
    graphId,
    newVersion,
    createdAt: createdDate || row.created_date || null,
    title: graphData.metadata.title || null,
    metaArea: graphData.metadata.metaArea || null,
    publicationState: graphData.metadata.publicationState || 'private',
    ...graphLinks(graphId, store.world),
  }
  })
}

/**
 * The stored form of a graph password — byte-for-byte what the graph editor writes, because
 * both viewers compare against it: GNewViewer (src/composables/useGraphPasswordGate.js) and
 * graph-portfolio (Agent-Builder worker/components/graph-portfolio.js) both do
 * `btoa(input) === metadata.passwordHash`. That is base64, not a hash: anyone who can read the
 * graph's metadata can read the password. Chosen 2026-10-27 (option A) for parity with the app;
 * a real hash needs both viewers changed in the same step.
 *
 * Returns null for a password the viewers cannot check: btoa throws on characters above U+00FF,
 * so such a password could never be typed in correctly.
 */
export function encodeGraphPassword(password) {
  try {
    return btoa(password)
  } catch {
    return null
  }
}

export const GRAPH_PASSWORD_MIN = 8 // the editor's rule (GNewPasswordProtectionNode.vue)
export const GRAPH_PASSWORD_MAX = 128

/**
 * Turn a graph's password protection on (password given) or off (password null), the way the
 * editor's password node does: metadata.passwordProtected + metadata.passwordHash, which is what
 * the viewers gate on, and passwordEnabled + passwordHash on every password-protection node, which
 * is what the editor's node shows. One write, one version. The password itself is never returned.
 */
export async function setGraphPassword(env, { graphId, password, actor = null, caller = undefined }) {
  if (!graphId) return fail(ERR.INVALID_INPUT, 'graphId is required.')

  let stored = null
  if (password !== null && password !== undefined) {
    if (typeof password !== 'string' || password.length < GRAPH_PASSWORD_MIN || password.length > GRAPH_PASSWORD_MAX) {
      return fail(ERR.INVALID_INPUT, `The password must be ${GRAPH_PASSWORD_MIN}–${GRAPH_PASSWORD_MAX} characters.`)
    }
    stored = encodeGraphPassword(password)
    if (stored === null) {
      return fail(
        ERR.INVALID_INPUT,
        'The password contains characters the viewer cannot check (emoji or letters outside ' +
          'Western European). Use letters, digits and ordinary punctuation; æ, ø and å are fine.',
      )
    }
  }

  const located = await storeFor(env, { graphId, actor: caller === undefined ? actor : caller })
  if (located.error) return located.error
  const { store } = located
  return guarded(async () => {
  const row = await store.getRow(graphId)
  if (!row) return fail(ERR.GRAPH_NOT_FOUND, 'Graph not found.')

  const graphData = JSON.parse(row.data)
  if (!graphData.metadata) graphData.metadata = {}
  if (!Array.isArray(graphData.nodes)) graphData.nodes = []

  const jsonVersion = graphData.metadata.version
  const current = await store.currentVersion(graphId)

  graphData.metadata.passwordProtected = stored !== null
  graphData.metadata.passwordHash = stored

  let nodesSynced = 0
  for (const node of graphData.nodes) {
    if (node && node.type === 'password-protection') {
      node.passwordEnabled = stored !== null
      node.passwordHash = stored
      nodesSynced++
    }
  }

  const newVersion = Math.max(current, Number(jsonVersion) || 0) + 1
  graphData.metadata.version = newVersion

  const committed = await store.commit({
    id: graphId,
    data: JSON.stringify(graphData),
    version: newVersion,
    casVersion: Number.isInteger(jsonVersion) ? jsonVersion : null,
    now: new Date().toISOString(),
    title: graphData.metadata.title || null,
    description: graphData.metadata.description || null,
  })
  if (committed && committed.conflict) {
    return fail(ERR.VERSION_CONFLICT, 'The graph changed while the password was being set. Try again.', {
      currentVersion: current,
    })
  }

  return {
    ok: true,
    graphId,
    passwordProtected: stored !== null,
    nodesSynced,
    newVersion,
    title: graphData.metadata.title || null,
    metaArea: graphData.metadata.metaArea || null,
    publicationState: graphData.metadata.publicationState || 'private',
    ...graphLinks(graphId, store.world),
  }
  })
}

/**
 * Publish a graph — the ONLY way publicationState becomes 'published' (rule 2).
 * Deliberately separate from updateMetadata so it can require graph:publish scope and be
 * audited as its own action. Not wired to an MCP tool in v1; the architecture is ready.
 */
export async function publishGraph(env, { graphId, expectedVersion, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  return updateMetadata(env, {
    graphId,
    fields: { publicationState: 'published', publishedAt: new Date().toISOString() },
    expectedVersion,
    actor,
    allowPublicationState: true,
  })
}

/**
 * Unpublish a graph — take it back to 'private'. The mirror of publishGraph(), and likewise its
 * own action rather than a metadata edit, so it can be named in the audit log. It only ever
 * REDUCES who can read the graph, which is why its tool asks for graph:write and not
 * graph:publish. publishedAt is cleared the way the editor clears it (GraphPortfolio.vue).
 *
 * Not touched here, and both still public afterwards: a seoSlug (the open list routes treat a
 * graph with one as listed) and any page already put on a domain with publish_html_node.
 */
export async function unpublishGraph(env, { graphId, expectedVersion, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  return updateMetadata(env, {
    graphId,
    fields: { publicationState: 'private', publishedAt: null, unpublishedAt: new Date().toISOString() },
    expectedVersion,
    actor,
    allowPublicationState: true,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Input validation for nodes and edges
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_NODE_TYPE_FALLBACK = 'fulltext'

/**
 * Validate and normalise caller-supplied nodes/edges. Assigns UUID v4 ids where missing
 * (rule 5) and refuses edges that do not connect two nodes present in the same payload.
 */
export function validateNodesAndEdges(nodes = [], edges = []) {
  if (!Array.isArray(nodes)) return fail(ERR.INVALID_INPUT, 'nodes must be an array.')
  if (!Array.isArray(edges)) return fail(ERR.INVALID_INPUT, 'edges must be an array.')

  const outNodes = []
  const seen = new Set()
  for (const [i, raw] of nodes.entries()) {
    if (!raw || typeof raw !== 'object') {
      return fail(ERR.INVALID_INPUT, `nodes[${i}] must be an object.`)
    }
    if (!raw.label || !String(raw.label).trim()) {
      return fail(ERR.INVALID_INPUT, `nodes[${i}].label is required.`)
    }
    const id = raw.id || crypto.randomUUID()
    if (seen.has(id)) return fail(ERR.INVALID_INPUT, `Duplicate node id ${id}.`)
    seen.add(id)
    outNodes.push({
      id,
      label: String(raw.label),
      type: raw.type || ALLOWED_NODE_TYPE_FALLBACK,
      info: raw.info ?? null,
      color: raw.color || '#4f6d7a',
      bibl: Array.isArray(raw.bibl) ? raw.bibl : [],
      position: raw.position || { x: 0, y: 0 },
      visible: raw.visible !== false,
      imageWidth: raw.imageWidth ?? null,
      imageHeight: raw.imageHeight ?? null,
      path: raw.path ?? null,
      ...(raw.metadata ? { metadata: raw.metadata } : {}),
    })
  }

  const outEdges = []
  for (const [i, raw] of edges.entries()) {
    if (!raw || typeof raw !== 'object') {
      return fail(ERR.INVALID_INPUT, `edges[${i}] must be an object.`)
    }
    if (!raw.source || !raw.target) {
      return fail(ERR.INVALID_INPUT, `edges[${i}] requires source and target.`)
    }
    if (!seen.has(raw.source) || !seen.has(raw.target)) {
      return fail(ERR.INVALID_INPUT, `edges[${i}] references a node id that is not in this graph.`)
    }
    outEdges.push({
      id: raw.id || `${raw.source}_${raw.target}`,
      source: raw.source,
      target: raw.target,
      ...(raw.label !== undefined ? { label: raw.label } : {}),
      ...(raw.type !== undefined ? { type: raw.type } : {}),
      ...(raw.info !== undefined ? { info: raw.info } : {}),
    })
  }

  return { ok: true, nodes: outNodes, edges: outEdges }
}

/** The standard success envelope for a graph operation (oppgavens standardresultat). */
export function graphResult(env, { graphId, title, metaArea, publicationState, version, world = null }) {
  return {
    success: true,
    graphId,
    title: title ?? null,
    metaArea: metaArea ?? null,
    publicationState: publicationState || 'private',
    version: version ?? null,
    ...graphLinks(graphId, world),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery: search and list
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The SQL fragment that limits a result set to what `actor` may see: their own graphs, plus
 * anything published. A Superadmin sees everything.
 *
 * Applied IN THE QUERY, never by filtering rows afterwards — a client-side filter over a
 * paginated result silently drops matches and reports a wrong total. The production schema has
 * `creator_email` and `publication_state` as generated columns over the JSON, so this costs no
 * extra parsing.
 */
function visibilityClause(actor) {
  if (actor?.isSuperadmin) return { sql: null, bindings: [] }
  if (!actor?.email) {
    // No identity at all: published graphs only.
    return { sql: `publication_state = 'published'`, bindings: [] }
  }
  return {
    sql: `(LOWER(COALESCE(creator_email, '')) = ? OR publication_state = 'published')`,
    bindings: [actor.email],
  }
}


/**
 * Run one listing over the platform AND every World store the actor may use, then merge.
 *
 * Each store answers COUNT and its newest (offset + limit) rows; the merge sorts by updated_at and
 * slices the requested page. `whereFor(store)` builds that store's WHERE: the platform keeps its
 * visibility rule, a World store has already admitted the actor (resolveGraphStore's rule) and may
 * narrow differently. Returning null from whereFor skips the store.
 */
async function queryAcrossStores(env, actor, { whereFor, selectSql, lim, off }) {
  const stores = [platformStore(env), ...(await worldStoresFor(env, actor))]
  let total = 0
  const rows = []
  for (const store of stores) {
    const w = whereFor(store)
    if (!w) continue
    const count = await store.first(`SELECT COUNT(*) AS total FROM knowledge_graphs ${w.whereSql}`, w.bindings)
    const n = Number(count?.total || 0)
    total += n
    if (!n) continue
    const page = await store.all(`${selectSql} ${w.whereSql} ORDER BY updated_at DESC LIMIT ? OFFSET 0`, [...w.bindings, off + lim])
    for (const r of page) rows.push({ ...r, _world: store.world })
  }
  rows.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
  return { total, rows: rows.slice(off, off + lim) }
}

const SEARCH_MAX_LIMIT = 50

function clampLimit(limit, fallback = 20, max = SEARCH_MAX_LIMIT) {
  const n = Number.parseInt(limit ?? '', 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, 1), max)
}

/**
 * listMyGraphs may page bigger than search does. Someone with 675 graphs needs a handful of
 * calls, not fourteen — and unlike search this one is a plain owner filter with no scan.
 */
const OWN_GRAPHS_MAX_LIMIT = 200

/**
 * The SQL condition for "this graph carries the tag `metaArea`", read the way list_meta_areas and
 * the Portfolio read tags: split on '#', trimmed, case-insensitive. So a graph tagged "NINE" (typed
 * without the #, which the editor allows) is found by a filter of "#NINE" or "NINE" alike, and
 * "#NINE" no longer catches "#NINETEEN".
 *
 * How: the stored string is wrapped as '#…#' with the spaces next to each '#' removed, so every
 * tag sits between two '#'s — "KINESISK KOSMOLOGI #NINE " becomes "#KINESISK KOSMOLOGI#NINE#" —
 * and the tag is matched whole between them. Both sides go through SQLite's UPPER, so they agree
 * even where SQLite and JavaScript upper-case differently (non-ASCII letters such as Å, Ø).
 * Returns null for an empty tag, so the caller adds no filter.
 */
export function metaAreaTagFilter(dataSql, metaArea) {
  const tag = String(metaArea ?? '').replace(/#/g, ' ').trim()
  if (!tag) return null
  let wrapped = `'#' || UPPER(COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '')) || '#'`
  // Three passes collapse up to three spaces on either side of a '#'.
  for (let i = 0; i < 3; i++) wrapped = `REPLACE(REPLACE(${wrapped}, ' #', '#'), '# ', '#')`
  const escaped = tag.replace(/[\\%_]/g, (c) => `\\${c}`)
  return {
    sql: `${wrapped} LIKE ('%#' || UPPER(?) || '#%') ESCAPE '\\'`,
    binding: escaped,
  }
}

/**
 * Free-text search across titles, descriptions, meta areas and node content, restricted to what
 * the actor may see. Mirrors the columns GET /searchGraphs matches on.
 */
export async function searchGraphs(env, { query, metaArea = null, nodeType = null, limit = 20, offset = 0, actor, domainMatchIds = [] }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')

  const lim = clampLimit(limit)
  const off = Math.max(Number.parseInt(offset ?? '', 10) || 0, 0)

  const dataSql = `CASE WHEN json_valid(data) THEN data END`
  const nodesSql = `COALESCE(json_extract(${dataSql}, '$.nodes'), '[]')`

  // The search conditions, shared by every store; visibility is added per store below.
  const conditions = []
  const bindings = []

  const q = String(query || '').trim()
  if (q) {
    const pattern = `%${q.toLowerCase().replace(/\*/g, '%')}%`
    // A graph whose node never got stamped with publishedDomain is still findable by its
    // hostname: the publish registry says which graphs serve it, and the caller resolved that
    // into ids. Same rule as the REST /searchGraphs endpoint.
    const ids = Array.isArray(domainMatchIds) ? domainMatchIds.filter(Boolean) : []
    const registryClause = ids.length ? ` OR id IN (${ids.map(() => '?').join(',')})` : ''
    conditions.push(`(
      LOWER(COALESCE(json_extract(${dataSql}, '$.metadata.title'), title, '')) LIKE ?
      OR LOWER(COALESCE(json_extract(${dataSql}, '$.metadata.description'), '')) LIKE ?
      OR LOWER(COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '')) LIKE ?
      OR EXISTS (
        SELECT 1 FROM json_each(${nodesSql})
        WHERE LOWER(COALESCE(json_extract(value, '$.label'), '')) LIKE ?
           OR LOWER(COALESCE(json_extract(value, '$.info'), '')) LIKE ?
           OR LOWER(COALESCE(json_extract(value, '$.publishedDomain'), '')) LIKE ?
      )${registryClause}
    )`)
    bindings.push(pattern, pattern, pattern, pattern, pattern, pattern, ...ids)
  }

  const areaFilter = metaAreaTagFilter(dataSql, metaArea)
  if (areaFilter) {
    conditions.push(areaFilter.sql)
    bindings.push(areaFilter.binding)
  }

  if (nodeType) {
    conditions.push(`EXISTS (SELECT 1 FROM json_each(${nodesSql}) WHERE json_extract(value, '$.type') = ?)`)
    bindings.push(String(nodeType))
  }

  const vis = visibilityClause(actor)
  const whereFor = (store) => {
    // On the platform the usual rule; in a World store the actor is already admitted.
    const c = store.kind === 'world' ? [...conditions] : [...(vis.sql ? [vis.sql] : []), ...conditions]
    const b = store.kind === 'world' ? [...bindings] : [...vis.bindings, ...bindings]
    return { whereSql: c.length ? `WHERE ${c.join(' AND ')}` : '', bindings: b }
  }
  const { total, rows } = await queryAcrossStores(env, actor, {
    whereFor,
    lim,
    off,
    selectSql: `
      SELECT
        id,
        COALESCE(json_extract(${dataSql}, '$.metadata.title'), title, '') AS title,
        COALESCE(json_extract(${dataSql}, '$.metadata.description'), '') AS description,
        COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '') AS meta_area,
        COALESCE(json_extract(${dataSql}, '$.metadata.publicationState'), 'private') AS publication_state,
        COALESCE(json_extract(${dataSql}, '$.metadata.version'), 0) AS version,
        COALESCE(json_extract(${dataSql}, '$.metadata.createdBy'), created_by, '') AS created_by,
        COALESCE(json_array_length(${nodesSql}), 0) AS node_count,
        COALESCE((
          SELECT GROUP_CONCAT(DISTINCT json_extract(value, '$.publishedDomain'))
          FROM json_each(${nodesSql})
          WHERE json_extract(value, '$.publishedDomain') IS NOT NULL
        ), '') AS published_domains_csv,
        created_date,
        updated_at
      FROM knowledge_graphs`,
  })

  if (total === 0) return { ok: true, results: [], total: 0, limit: lim, offset: off, hasMore: false }

  const results = rows.map((r) => ({
    graphId: r.id,
    title: r.title || null,
    description: r.description || null,
    metaArea: r.meta_area || null,
    publicationState: r.publication_state || 'private',
    version: r.version ?? null,
    nodeCount: r.node_count ?? 0,
    createdAt: r.created_date || null,
    updatedAt: r.updated_at || null,
    isMine: Boolean(actor.email && String(r.created_by || '').toLowerCase() === actor.email),
    // The node's own stamp only. The caller merges it with the publish registry, which is the
    // authority on who serves a host today — the same two-step the REST listings do.
    publishedDomainsCsv: r.published_domains_csv || '',
    world: r._world || null,
    ...graphLinks(r.id, r._world),
  }))

  return { ok: true, results, total, limit: lim, offset: off, hasMore: off + results.length < total }
}

/** The actor's own graphs, newest first. A thin, explicit case of searchGraphs. */
export async function listMyGraphs(env, { limit = 20, offset = 0, metaArea = null, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!actor.email) {
    return fail(ERR.FORBIDDEN_GRAPH, 'This token has no user identity, so it owns no graphs.')
  }

  const lim = clampLimit(limit, 20, OWN_GRAPHS_MAX_LIMIT)
  const off = Math.max(Number.parseInt(offset ?? '', 10) || 0, 0)
  const dataSql = `CASE WHEN json_valid(data) THEN data END`
  const nodesSql = `COALESCE(json_extract(${dataSql}, '$.nodes'), '[]')`

  // "Mine" on the platform means created by me. In a World store it means the World's graphs —
  // they are the founder's whoever typed them in — except for a Superadmin who is not that World's
  // founder: theirs there is still only what they created.
  const areaFilter = metaAreaTagFilter(dataSql, metaArea)
  const areaClause = areaFilter ? [areaFilter.sql] : []
  const areaBind = areaFilter ? [areaFilter.binding] : []
  const founderOf = new Set()
  if (actor.isSuperadmin) {
    for (const ws of await worldStoresFor(env, { ...actor, isSuperadmin: false })) founderOf.add(ws.world)
  }
  const whereFor = (store) => {
    const ownAll = store.kind === 'world' && (!actor.isSuperadmin || founderOf.has(store.world))
    const c = [...(ownAll ? [] : [`LOWER(COALESCE(creator_email, '')) = ?`]), ...areaClause]
    const b = [...(ownAll ? [] : [actor.email]), ...areaBind]
    return { whereSql: c.length ? `WHERE ${c.join(' AND ')}` : '', bindings: b }
  }

  const { total, rows } = await queryAcrossStores(env, actor, {
    whereFor,
    lim,
    off,
    selectSql: `
      SELECT
        id,
        COALESCE(json_extract(${dataSql}, '$.metadata.title'), title, '') AS title,
        COALESCE(json_extract(${dataSql}, '$.metadata.description'), '') AS description,
        COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '') AS meta_area,
        COALESCE(json_extract(${dataSql}, '$.metadata.publicationState'), 'private') AS publication_state,
        COALESCE(json_extract(${dataSql}, '$.metadata.version'), 0) AS version,
        COALESCE(json_array_length(${nodesSql}), 0) AS node_count,
        COALESCE((
          SELECT GROUP_CONCAT(DISTINCT json_extract(value, '$.publishedDomain'))
          FROM json_each(${nodesSql})
          WHERE json_extract(value, '$.publishedDomain') IS NOT NULL
        ), '') AS published_domains_csv,
        created_date,
        updated_at
      FROM knowledge_graphs`,
  })

  const results = rows.map((r) => ({
    graphId: r.id,
    title: r.title || null,
    description: r.description || null,
    metaArea: r.meta_area || null,
    publicationState: r.publication_state || 'private',
    version: r.version ?? null,
    nodeCount: r.node_count ?? 0,
    createdAt: r.created_date || null,
    updatedAt: r.updated_at || null,
    isMine: true,
    // The node's own stamp only. The caller merges it with the publish registry, which is the
    // authority on who serves a host today — the same two-step the REST listings do.
    publishedDomainsCsv: r.published_domains_csv || '',
    world: r._world || null,
    ...graphLinks(r.id, r._world),
  }))

  return { ok: true, results, total, limit: lim, offset: off, hasMore: off + results.length < total }
}

/**
 * Patch named fields of one node — the implementation behind POST /patchNode.
 *
 * Its concurrency control is DIFFERENT from addNode's and that difference is deliberate, so it
 * is preserved verbatim rather than homogenised:
 *
 *   addNode reads MAX(version) from the history table and appends.
 *   updateNode reads metadata.version out of the graph JSON, and guards the write with that
 *   version in the SQL WHERE clause — so two concurrent patches cannot both succeed, even if
 *   they read the same version a microsecond apart. The read-check is the fast path; the
 *   conditional UPDATE is what actually makes it safe.
 *
 * expectedVersion is REQUIRED. This is a read-modify-write over the whole graph JSON, so
 * without it a concurrent write is silently clobbered. Omitting it is a 400, never a success.
 *
 * The node's `id` is never patchable: renaming a node id out from under the edges that point at
 * it would silently orphan them.
 */
export async function updateNode(env, { graphId, nodeId, fields, expectedVersion, actor = null , caller = undefined}) {
  if (!graphId || !nodeId || !fields || typeof fields !== 'object' || !Number.isInteger(expectedVersion)) {
    return fail(ERR.INVALID_INPUT, 'graphId, nodeId, fields (object), and expectedVersion (integer) are required.')
  }

  const located = await storeFor(env, { graphId, actor: caller === undefined ? actor : caller })
  if (located.error) return located.error
  const { store } = located
  return guarded(async () => {
  const result = await store.getRow(graphId)
  if (!result) return fail(ERR.GRAPH_NOT_FOUND, 'Graph not found.')

  const graphData = JSON.parse(result.data)
  if (!Array.isArray(graphData.nodes)) graphData.nodes = []

  const nodeIndex = graphData.nodes.findIndex((n) => n.id === nodeId)
  if (nodeIndex === -1) {
    return fail(ERR.GRAPH_NOT_FOUND, `Node ${nodeId} not found in graph ${graphId}.`, { graphId, nodeId })
  }

  const patch = { ...fields }
  if (graphData.nodes[nodeIndex].type === 'data-node' && patch.info && env.ENCRYPTION_MASTER_KEY) {
    patch.info = await encryptDataNodeInfo(patch.info, env.ENCRYPTION_MASTER_KEY)
  }

  const current = Number(graphData.metadata?.version || 0)
  if (current !== expectedVersion) {
    // Message kept verbatim from the pre-refactor REST handler: a client may match on it.
    return fail(ERR.VERSION_CONFLICT, 'Version mismatch. Reload the graph and retry the patch.', {
      currentVersion: current,
      expectedVersion,
    })
  }

  const { id: _ignoreId, ...safeFields } = patch
  const now = new Date().toISOString()
  const target = graphData.nodes[nodeIndex]
  const faceBefore = nodeFace(target)
  const stampBefore = target.metadata && typeof target.metadata === 'object' ? target.metadata.updatedAt : null
  Object.assign(target, safeFields)
  // The node's own update time: now when its content changed; a move alone keeps the old time.
  // A metadata sent in the patch replaces the node's metadata, so the time is put back either way.
  if (target.metadata && typeof target.metadata === 'object' && !Array.isArray(target.metadata)) target.metadata = { ...target.metadata }
  setNodeUpdatedAt(target, nodeFace(target) !== faceBefore ? now : typeof stampBefore === 'string' && stampBefore ? stampBefore : null)

  const newVersion = current + 1
  if (!graphData.metadata) graphData.metadata = {}
  graphData.metadata.version = newVersion

  const committed = await store.commit({
    id: graphId,
    data: JSON.stringify(graphData),
    version: newVersion,
    casVersion: expectedVersion,
    now,
  })

  // A conflict means another request won the race between the read above and this write.
  if (committed.conflict) {
    const latest = await store.getRow(graphId)
    let latestVersion = 0
    try {
      latestVersion = Number(JSON.parse(latest?.data || '{}')?.metadata?.version || 0)
    } catch { /* an unparseable graph reports version 0 */ }
    return fail(ERR.VERSION_CONFLICT, 'Version mismatch. Graph was updated by another request.', {
      currentVersion: latestVersion,
      expectedVersion,
    })
  }

  return {
    ok: true,
    graphId,
    nodeId,
    currentVersion: current,
    newVersion,
    updatedFields: Object.keys(safeFields),
    title: graphData.metadata?.title || null,
    metaArea: graphData.metadata?.metaArea || null,
    publicationState: graphData.metadata?.publicationState || 'private',
    ...graphLinks(graphId, store.world),
  }
  })
}

/**
 * Set the reading order of a graph's nodes — what the viewer's "Reorder" dialog does.
 *
 * The viewer sorts nodes by `order`, and a node without one falls back to its position in the
 * array (index + 1). So a node appended later always lands last, under a closing "Sources" node,
 * and nothing but this (or the dialog) can move it. `nodeIds` lists the nodes in the order
 * wanted; they get 1..k. Every node NOT listed keeps its current relative place and follows
 * after them, so moving one node up never scrambles the rest. All nodes get an explicit order,
 * because a mix of set and unset orders sorts unpredictably in the viewer.
 *
 * Same concurrency control as updateNode: expectedVersion required, CAS on commit.
 */
export async function reorderNodes(env, { graphId, nodeIds, expectedVersion, actor = null, caller = undefined }) {
  if (!graphId || !Array.isArray(nodeIds) || nodeIds.length === 0 || !Number.isInteger(expectedVersion)) {
    return fail(ERR.INVALID_INPUT, 'graphId, nodeIds (non-empty array), and expectedVersion (integer) are required.')
  }
  if (new Set(nodeIds).size !== nodeIds.length) {
    return fail(ERR.INVALID_INPUT, 'nodeIds lists the same node more than once.')
  }

  const located = await storeFor(env, { graphId, actor: caller === undefined ? actor : caller })
  if (located.error) return located.error
  const { store } = located
  return guarded(async () => {
  const result = await store.getRow(graphId)
  if (!result) return fail(ERR.GRAPH_NOT_FOUND, 'Graph not found.')

  const graphData = JSON.parse(result.data)
  if (!Array.isArray(graphData.nodes)) graphData.nodes = []

  const known = new Set(graphData.nodes.map((n) => n.id))
  const missing = nodeIds.filter((id) => !known.has(id))
  if (missing.length) {
    return fail(ERR.GRAPH_NOT_FOUND, `Node(s) not found in graph ${graphId}: ${missing.join(', ')}.`, { graphId, missing })
  }

  const current = Number(graphData.metadata?.version || 0)
  if (current !== expectedVersion) {
    return fail(ERR.VERSION_CONFLICT, 'Version mismatch. Reload the graph and retry the reorder.', {
      currentVersion: current,
      expectedVersion,
    })
  }

  // The order the viewer shows today: explicit order first, else array position. Stable on ties.
  const shown = graphData.nodes
    .map((n, i) => ({ n, key: Number(n.order) > 0 ? Number(n.order) : i + 1, i }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((x) => x.n)
  const listed = new Set(nodeIds)
  const byId = new Map(graphData.nodes.map((n) => [n.id, n]))
  const final = [...nodeIds.map((id) => byId.get(id)), ...shown.filter((n) => !listed.has(n.id))]
  final.forEach((n, i) => { n.order = i + 1 })
  // The array itself is reordered too: the Knowledge-Editor viewer (editor.vegvisr.org/view)
  // ignores `order` and shows nodes in array order, so both viewers only agree if both match.
  graphData.nodes = final

  const newVersion = current + 1
  if (!graphData.metadata) graphData.metadata = {}
  graphData.metadata.version = newVersion

  const committed = await store.commit({
    id: graphId,
    data: JSON.stringify(graphData),
    version: newVersion,
    casVersion: expectedVersion,
    now: new Date().toISOString(),
  })
  if (committed.conflict) {
    const latest = await store.getRow(graphId)
    let latestVersion = 0
    try {
      latestVersion = Number(JSON.parse(latest?.data || '{}')?.metadata?.version || 0)
    } catch { /* an unparseable graph reports version 0 */ }
    return fail(ERR.VERSION_CONFLICT, 'Version mismatch. Graph was updated by another request.', {
      currentVersion: latestVersion,
      expectedVersion,
    })
  }

  return {
    ok: true,
    graphId,
    currentVersion: current,
    newVersion,
    order: final.map((n) => ({ id: n.id, label: n.label ?? null, order: n.order })),
    title: graphData.metadata?.title || null,
    metaArea: graphData.metadata?.metaArea || null,
    publicationState: graphData.metadata?.publicationState || 'private',
    ...graphLinks(graphId, store.world),
  }
  })
}


/**
 * Which meta areas the actor's own graphs use, and how many graphs each covers.
 *
 * The tokenisation is deliberately identical to GET /getmetaareas in index.js — split on '#',
 * trim, uppercase, drop empties — because metaArea is one string holding several tags
 * ("#NIBI #VEGR.AI") and any other splitting would make the two surfaces disagree about the
 * same data. That endpoint counts across every graph in the system; this one is the owner's,
 * which is why it is a separate query rather than a call to it.
 *
 * A graph with several tags counts toward each of them, so the counts sum to more than the
 * number of graphs. `untagged` is the graphs with no meta area at all, which is the one number
 * the per-area counts cannot show.
 */
export async function listMetaAreas(env, { actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!actor.email) {
    return fail(ERR.FORBIDDEN_GRAPH, 'This token has no user identity, so it owns no graphs.')
  }

  const dataSql = `CASE WHEN json_valid(data) THEN data END`
  const rows = await platformStore(env).db
    .prepare(`
      SELECT COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '') AS meta_area
      FROM knowledge_graphs
      WHERE LOWER(COALESCE(creator_email, '')) = ?
    `)
    .bind(actor.email)
    .all()

  const counts = new Map()
  let untagged = 0
  let totalGraphs = 0

  for (const row of rows.results || []) {
    totalGraphs += 1
    const areas = String(row.meta_area || '')
      .split('#')
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean)
    if (!areas.length) {
      untagged += 1
      continue
    }
    // A graph listing the same tag twice must not count twice.
    for (const area of new Set(areas)) counts.set(area, (counts.get(area) || 0) + 1)
  }

  const metaAreas = [...counts.entries()]
    .map(([name, graphCount]) => ({ metaArea: `#${name}`, graphCount }))
    .sort((a, b) => b.graphCount - a.graphCount || a.metaArea.localeCompare(b.metaArea))

  return { ok: true, metaAreas, count: metaAreas.length, untagged, totalGraphs }
}

// ─────────────────────────────────────────────────────────────────────────────
// Moving a platform graph into a World's own store (G6, 2026-10-15)
// ─────────────────────────────────────────────────────────────────────────────

async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text ?? '')))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Move one graph from the platform into a World's own store. Superadmin only.
 *
 * Order, chosen so no step can lose the graph:
 *   1. export the platform row and every history row
 *   2. claim the id for the World (locator 'pending' — reads still go to the platform)
 *   3. import row + history into the World in one batch (all or nothing)
 *   4. read it back from the World and compare SHA-256 of the row and of every version
 *   5. only then point the locator at the World ('active')
 *   6. copy the platform original to the platform trash (30 days) and remove it
 * A failure before 5 undoes the World copy and the claim, and leaves the platform untouched.
 *
 * The platform history may hold two rows with the same version (an old non-atomic write path);
 * a World store refuses that, so the newest row per version is kept and the rest reported.
 */
// defer: optional (promise) => void, e.g. ctx.waitUntil. When given, the old copy is moved to the
// trash after the answer; without it (tests, REST) that happens before returning, as before.
export async function moveGraphToWorld(env, { graphId, world, actor, defer = null }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!actor.isSuperadmin) return fail(ERR.FORBIDDEN_GRAPH, 'Only a Superadmin may move a graph into a World.')
  if (!graphId || !world) return fail(ERR.INVALID_INPUT, 'graphId and world are required.')
  const domain = String(world).trim().toLowerCase()

  const source = await storeFor(env, { graphId, actor })
  if (source.error) return source.error
  if (source.store.kind !== 'platform') {
    if (source.store.world === domain) return fail(ERR.INVALID_INPUT, `Graph ${graphId} is already in ${domain}.`)
    return moveGraphBetweenWorlds(env, { graphId, from: source.store, domain, actor, defer })
  }
  const target = await storeFor(env, { world: domain, actor })
  if (target.error) return target.error
  const platform = source.store
  const worldStore = target.store

  const exported = await platform.exportGraph(graphId)
  if (!exported) return fail(ERR.GRAPH_NOT_FOUND, `Graph ${graphId} not found.`)
  let meta = {}
  try { meta = JSON.parse(exported.row.data)?.metadata || {} } catch { /* keep going: the bytes are what is moved */ }
  if (/#EMAIL-/i.test(String(meta.metaArea || ''))) {
    return fail(ERR.INVALID_INPUT, 'A #EMAIL- system graph is read from the platform by the e-mail worker and cannot be moved into a World.')
  }

  // Newest row per version (history is ordered version, timestamp ascending, so later wins).
  const byVersion = new Map()
  for (const h of exported.history) byVersion.set(h.version, h)
  const history = [...byVersion.values()]
  const duplicatesDropped = exported.history.length - history.length

  const now = new Date().toISOString()
  await reserveLocation(env, graphId, domain, now)
  const undo = async (why) => {
    try { await worldStore.deleteGraph(graphId) } catch { /* nothing to undo, or the store is down */ }
    await dropPendingLocation(env, graphId)
    return fail(ERR.STORE_UNAVAILABLE, `Graph ${graphId} was NOT moved: ${why} The platform copy is untouched.`)
  }

  try {
    await worldStore.importGraph({ row: exported.row, history })
  } catch (e) {
    return undo(`the import into ${domain} failed (${e.message}).`)
  }

  // Verify from the World, not from the import's own report.
  let verified
  try {
    const back = await worldStore.exportGraph(graphId)
    if (!back) return undo(`the graph could not be read back from ${domain}.`)
    const rowOk = (await sha256Hex(back.row.data)) === (await sha256Hex(exported.row.data))
    const want = new Map()
    for (const h of history) want.set(h.version, await sha256Hex(h.data))
    const got = new Map()
    for (const h of back.history) got.set(h.version, await sha256Hex(h.data))
    const versionsOk = want.size === got.size && [...want].every(([v, hash]) => got.get(v) === hash)
    if (!rowOk || !versionsOk) return undo(`the copy in ${domain} does not match the original (row ${rowOk ? 'ok' : 'differs'}, versions ${versionsOk ? 'ok' : 'differ'}).`)
    verified = { rowSha256: await sha256Hex(back.row.data), versions: [...got.keys()].sort((a, b) => a - b) }
  } catch (e) {
    return undo(`reading it back from ${domain} failed (${e.message}).`)
  }

  await activateLocation(env, graphId)

  // The platform original goes to the platform trash for 30 days, then is removed.
  if (defer) {
    defer((async () => {
      try {
        await platform.trashCopy({ id: graphId, data: exported.row.data, deletedBy: `move_graph_to_world:${actor.email || 'superadmin'}` })
        await platform.deleteGraph(graphId)
      } catch (e) {
        console.error(`[move] ${graphId}: platform original NOT removed after the move to ${domain}: ${e.message} (unreachable — reads go to ${domain})`)
      }
    })())
    const note = `going to the platform trash for 30 days (done after this answer)`
    return {
      ok: true, graphId, world: domain, title: meta.title ?? null, version: meta.version ?? null, history: verified.versions.length,
      duplicatesDropped, verified, platformCopy: note, from: 'platform', originalCopy: note, ...graphLinks(graphId, domain),
    }
  }
  let trash = null
  try {
    trash = await platform.trashCopy({ id: graphId, data: exported.row.data, deletedBy: `move_graph_to_world:${actor.email || 'superadmin'}` })
    await platform.deleteGraph(graphId)
  } catch (e) {
    // The World copy is live and verified; the locator already routes there. A platform row left
    // behind is unreachable, not a second live copy — report it rather than fail the move.
    return {
      ok: true, graphId, world: domain, version: meta.version ?? null, history: verified.versions.length,
      duplicatesDropped, verified, platformCopy: `NOT removed: ${e.message} (unreachable — reads go to ${domain})`,
      ...graphLinks(graphId, domain),
    }
  }

  return {
    ok: true,
    graphId,
    world: domain,
    title: meta.title ?? null,
    version: meta.version ?? null,
    history: verified.versions.length,
    duplicatesDropped,
    verified,
    platformCopy: `in the platform trash until ${trash.expiresAt} (${trash.trashId})`,
    from: 'platform',
    originalCopy: `in the platform trash until ${trash.expiresAt} (${trash.trashId})`,
    ...graphLinks(graphId, domain),
  }
}

/**
 * Move a graph from one World's own store to another's (2026-11-15). Same rules as a move from the
 * platform: copy row and every version, read it back from the new World and compare SHA-256, and
 * only then point the graph's id there — in one update of its location row, so until that moment
 * every read still goes to the old World and a failure leaves it exactly where it was. The old
 * World's copy goes to that World's trash for 30 days, as a backup: restore_graph follows the
 * graph's location, which is now the new World, so it does not bring that copy back by itself.
 */
async function moveGraphBetweenWorlds(env, { graphId, from, domain, actor, defer = null }) {
  const target = await storeFor(env, { world: domain, actor })
  if (target.error) return target.error
  const worldStore = target.store

  return guarded(async () => {
    // Read the source and check the target at the same time: two different stores.
    const [exported, taken] = await Promise.all([from.exportGraph(graphId), worldStore.exists(graphId)])
    if (!exported) return fail(ERR.GRAPH_NOT_FOUND, `Graph ${graphId} not found in ${from.world}.`)
    let meta = {}
    try { meta = JSON.parse(exported.row.data)?.metadata || {} } catch { /* the bytes are what is moved */ }
    if (/#EMAIL-/i.test(String(meta.metaArea || ''))) {
      return fail(ERR.INVALID_INPUT, 'A #EMAIL- system graph is read from the platform by the e-mail worker and cannot be moved into a World.')
    }
    // Never touch a graph that already sits in the target under this id: the undo below deletes
    // what this move put there, and must not delete something it did not put there.
    if (taken) {
      return fail(ERR.INVALID_INPUT, `A graph with id ${graphId} already exists in ${domain}. Nothing was moved.`)
    }

    const byVersion = new Map()
    for (const h of exported.history) byVersion.set(h.version, h)
    const history = [...byVersion.values()]
    const duplicatesDropped = exported.history.length - history.length

    const undo = async (why) => {
      try { await worldStore.deleteGraph(graphId) } catch { /* nothing to undo, or the store is down */ }
      return fail(ERR.STORE_UNAVAILABLE, `Graph ${graphId} was NOT moved: ${why} It is still in ${from.world}, untouched.`)
    }

    try {
      await worldStore.importGraph({ row: exported.row, history })
    } catch (e) {
      return undo(`the import into ${domain} failed (${e.message}).`)
    }

    let verified
    try {
      const back = await worldStore.exportGraph(graphId)
      if (!back) return undo(`the graph could not be read back from ${domain}.`)
      const rowOk = (await sha256Hex(back.row.data)) === (await sha256Hex(exported.row.data))
      const want = new Map()
      for (const h of history) want.set(h.version, await sha256Hex(h.data))
      const got = new Map()
      for (const h of back.history) got.set(h.version, await sha256Hex(h.data))
      const versionsOk = want.size === got.size && [...want].every(([v, hash]) => got.get(v) === hash)
      if (!rowOk || !versionsOk) return undo(`the copy in ${domain} does not match the original (row ${rowOk ? 'ok' : 'differs'}, versions ${versionsOk ? 'ok' : 'differ'}).`)
      verified = { rowSha256: await sha256Hex(back.row.data), versions: [...got.keys()].sort((a, b) => a - b) }
    } catch (e) {
      return undo(`reading it back from ${domain} failed (${e.message}).`)
    }

    try {
      await relocateGraph(env, graphId, domain)
    } catch (e) {
      return undo(`its location could not be switched to ${domain} (${e.message}).`)
    }

    const base = {
      ok: true, graphId, world: domain, from: from.world, title: meta.title ?? null, version: meta.version ?? null,
      history: verified.versions.length, duplicatesDropped, verified, ...graphLinks(graphId, domain),
    }
    const cleanup = async () => {
      const trash = await from.trashCopy({ id: graphId, data: exported.row.data, deletedBy: `move_graph_to_world:${actor.email || 'superadmin'}` })
      await from.deleteGraph(graphId)
      return trash
    }
    if (defer) {
      defer(cleanup().catch((e) => console.error(`[move] ${graphId}: copy in ${from.world} NOT removed after the move to ${domain}: ${e.message} (unreachable — reads go to ${domain})`)))
      return { ...base, originalCopy: `going to the trash of ${from.world} for 30 days (done after this answer) — a backup; the graph itself now lives in ${domain}` }
    }
    try {
      const trash = await cleanup()
      return { ...base, originalCopy: `in the trash of ${from.world} until ${trash.expiresAt} (${trash.trashId}) — a backup; the graph itself now lives in ${domain}` }
    } catch (e) {
      // The new copy is live and verified and the locator routes there; a row left in the old
      // World is unreachable, not a second live copy — report it rather than fail the move.
      return { ...base, originalCopy: `NOT removed from ${from.world}: ${e.message} (unreachable — reads go to ${domain})` }
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Deleting a graph, and bringing it back (2026-11-14)
// ─────────────────────────────────────────────────────────────────────────────
//
// The first MCP tools to use graph:delete. A delete here is a move to the store's trash, where the
// graph and its whole history are kept for 30 days (graph-store.js), and it never happens without
// that copy: on the REST route the platform deletes even when the trash copy fails; here a failed
// copy stops the delete, for every store.
//
// Unlike POST /deleteknowgraph this does not remove the graph's chat sessions or work notes. They
// are small, harmless without their graph, and a restore that brought back a graph with its
// conversations gone would not be a restore.

/** True when `actor` is the person the graph row names as its creator. */
function createdByActor(actor, owner, row) {
  return Boolean((owner && actor.email && owner === actor.email) || (row?.user_id && actor.userId && row.user_id === actor.userId))
}

/**
 * Move a graph to the trash. Only its creator or a Superadmin may: in a World's shared store every
 * member can change every graph, and that must not extend to removing someone else's.
 * `liveDomains` (from the publish registry) refuses a graph that serves a live page.
 */
export async function deleteGraph(env, { graphId, actor, liveDomains = [] }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!graphId) return fail(ERR.INVALID_INPUT, 'graphId is required.')

  const access = await checkAccess(env, actor, graphId, 'write')
  if (!access.ok) return access
  if (!actor.isSuperadmin && !createdByActor(actor, access.owner, access.graph)) {
    return fail(ERR.FORBIDDEN_GRAPH, `Only the person who created graph ${graphId}, or a Superadmin, can delete it.`)
  }
  if (liveDomains.length) {
    return fail(ERR.INVALID_INPUT, `Graph ${graphId} serves a live page at ${liveDomains.join(', ')}. It was NOT deleted: the page would stop working. Take the page down first.`, { liveDomains })
  }

  const located = await storeFor(env, { graphId, actor })
  if (located.error) return located.error
  const { store } = located
  return guarded(async () => {
    const row = access.graph
    let meta = {}
    let nodeCount = 0
    try {
      const parsed = JSON.parse(row.data)
      meta = parsed?.metadata || {}
      nodeCount = Array.isArray(parsed?.nodes) ? parsed.nodes.length : 0
    } catch { /* an unparseable graph is still trashed as it is */ }

    let trash
    try {
      trash = await store.trashCopy({ id: graphId, data: row.data, deletedBy: actor.email || actor.userId || 'unknown' })
    } catch (e) {
      if (e instanceof GraphStoreError) throw e
      return fail(ERR.INTERNAL_ERROR, `Graph ${graphId} was NOT deleted: its trash copy failed (${e.message}).`)
    }
    await store.deleteGraph(graphId)
    if (store.kind === 'world') await setLocationStatus(env, graphId, 'trashed')

    return {
      ok: true,
      graphId,
      title: meta.title || row.title || null,
      nodeCount,
      trashId: trash.trashId,
      restorableUntil: trash.expiresAt,
      world: store.world || null,
    }
  })
}

/** The graphs the actor has deleted that are still in a trash (a Superadmin sees every entry), newest first. */
export async function listDeletedGraphs(env, { actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  return guarded(async () => {
    const stores = [platformStore(env), ...(await worldStoresFor(env, actor))]
    const deleted = []
    for (const store of stores) {
      for (const t of await store.listTrash()) {
        const by = String(t.deleted_by || '').toLowerCase()
        if (!actor.isSuperadmin && !(actor.email && by === actor.email) && !(actor.userId && t.deleted_by === actor.userId)) continue
        deleted.push({
          trashId: t.id,
          graphId: t.graph_id,
          title: t.title || null,
          deletedBy: t.deleted_by || null,
          deletedAt: t.deleted_at || null,
          restorableUntil: t.expires_at || null,
          world: store.world || null,
        })
      }
    }
    deleted.sort((a, b) => String(b.deletedAt || '').localeCompare(String(a.deletedAt || '')))
    return { ok: true, total: deleted.length, deleted }
  })
}

/**
 * Put a trashed graph back, with its history. Named by trashId, or by graphId (its newest trash
 * entry). Refused when a graph with that id exists again — the store's restore would overwrite it.
 * The graph returns with the created date of its first saved version: the trash keeps the graph
 * and its history, not the row, so a created date set by hand afterwards is not kept.
 */
export async function restoreGraph(env, { trashId = null, graphId = null, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!trashId && !graphId) return fail(ERR.INVALID_INPUT, 'trashId or graphId is required.')

  let id = trashId ? String(trashId) : null
  if (!id) {
    const listed = await listDeletedGraphs(env, { actor })
    if (!listed.ok) return listed
    const hit = listed.deleted.find((d) => d.graphId === graphId)
    if (!hit) return fail(ERR.GRAPH_NOT_FOUND, `No deleted graph ${graphId} of yours is in the trash. It may be older than 30 days.`)
    id = hit.trashId
  }
  const originalId = graphIdOfTrashId(id)
  if (!originalId) return fail(ERR.INVALID_INPUT, `"${id}" is not a trash id.`)

  const located = await storeFor(env, { graphId: originalId, actor })
  if (located.error) return located.error
  const { store } = located
  return guarded(async () => {
    const entry = await store.getTrashEntry(id)
    if (!entry) return fail(ERR.GRAPH_NOT_FOUND, 'Trash entry not found, or older than 30 days.')

    let meta = {}
    try {
      meta = JSON.parse(entry.graph_data)?.metadata || {}
    } catch { /* restored as it is */ }
    const creator = String(meta.createdBy || '').toLowerCase()
    const deleter = String(entry.deleted_by || '').toLowerCase()
    if (!actor.isSuperadmin && !(actor.email && (creator === actor.email || deleter === actor.email))) {
      return fail(ERR.FORBIDDEN_GRAPH, 'Only the person who created or deleted that graph, or a Superadmin, can restore it.')
    }
    if (await store.getRow(entry.graph_id)) {
      return fail(ERR.INVALID_INPUT, `A graph with id ${entry.graph_id} exists again, so the trashed one was NOT restored over it.`)
    }

    await store.restoreFromTrash(entry)
    if (store.kind === 'world') await setLocationStatus(env, entry.graph_id, 'active')
    return {
      ok: true,
      graphId: entry.graph_id,
      title: meta.title || entry.title || null,
      world: store.world || null,
      ...graphLinks(entry.graph_id, store.world),
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Sharing a World's graph with another World (2026-11-19)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Where a graph is, for sharing: only a graph in a World store, and only a member of THAT World
 * (or whoever runs it, or a Superadmin) may share it — not someone who reaches it through a share.
 */
async function shareableGraph(env, actor, graphId) {
  if (!actor) return { error: fail(ERR.UNAUTHENTICATED, 'Authentication required.') }
  if (!graphId) return { error: fail(ERR.INVALID_INPUT, 'graphId is required.') }
  const located = await storeFor(env, { graphId, actor })
  if (located.error) return located
  const { store } = located
  if (store.kind !== 'world') return { error: fail(ERR.INVALID_INPUT, `Graph ${graphId} is in the platform's shared storage. Only a graph stored in a World can be shared with another World.`) }
  if (store.sharedVia) return { error: fail(ERR.FORBIDDEN_GRAPH, `Graph ${graphId} is in ${store.world}; it is shared with you through ${store.sharedVia}, and only members of ${store.world} may share it on.`) }
  if (!(await store.exists(graphId))) return { error: fail(ERR.GRAPH_NOT_FOUND, `Graph ${graphId} not found.`) }
  return { store }
}

export async function shareGraphWithWorld(env, { graphId, world, mode = 'read', actor }) {
  const at = await shareableGraph(env, actor, graphId)
  if (at.error) return at.error
  return guarded(async () => {
    if (!SHARE_MODES.includes(mode)) return fail(ERR.INVALID_INPUT, `mode must be "read" or "write".`)
    const domain = await knownWorld(env, world)
    if (!domain) return fail(ERR.INVALID_INPUT, `${world} is not a World.`)
    if (domain === at.store.world) return fail(ERR.INVALID_INPUT, `Graph ${graphId} is stored in ${domain}; its members reach it already.`)
    await putShare(env, { graphId, world: domain, mode, sharedBy: actor.email || null })
    return { ok: true, graphId, world: at.store.world, sharedWith: domain, mode, shares: (await sharesOf(env, [graphId])).get(graphId) || [] }
  })
}

export async function unshareGraphFromWorld(env, { graphId, world, actor }) {
  const at = await shareableGraph(env, actor, graphId)
  if (at.error) return at.error
  return guarded(async () => {
    const domain = String(world || '').trim().toLowerCase()
    const removed = await dropShare(env, { graphId, world: domain })
    return { ok: true, graphId, world: at.store.world, removed, unsharedFrom: domain, shares: (await sharesOf(env, [graphId])).get(graphId) || [] }
  })
}

export async function listGraphShares(env, { graphId, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  const access = await checkAccess(env, actor, graphId, 'read')
  if (!access.ok) return access
  return guarded(async () => ({ ok: true, graphId, world: access.world || null, shares: (await sharesOf(env, [graphId])).get(graphId) || [] }))
}

// ─────────────────────────────────────────────────────────────────────────────
// The whole collection in one read (2026-11-13)
// ─────────────────────────────────────────────────────────────────────────────

const INDEX_MAX_GRAPHS = 20000
// 300 until 2026-11-14; raised when #MYSTMKRA arrived with 337 graphs. A trial value: the owner asked
// for 600 "to see if it works". Node lists carry id, label and type only, never content.
const INDEX_NODES_MAX_GRAPHS = 600

/**
 * The WHERE of "every graph the actor owns" (all = false) or "may see" (all = true), per store,
 * with the caller's own clauses added. One rule for graph_index and search_text, so a search can
 * never reach a graph the index would not list.
 */
async function indexWhereFor(env, actor, all, clauses = [], binds = []) {
  if (all) {
    const vis = visibilityClause(actor)
    return (store) => {
      const c = store.kind === 'world' ? [...clauses] : [...(vis.sql ? [vis.sql] : []), ...clauses]
      const b = store.kind === 'world' ? [...binds] : [...vis.bindings, ...binds]
      return { whereSql: c.length ? `WHERE ${c.join(' AND ')}` : '', bindings: b }
    }
  }
  // The same "mine" as listMyGraphs: created by me on the platform; in a World store the
  // World's graphs — except for a Superadmin who is not that World's founder.
  const founderOf = new Set()
  if (actor.isSuperadmin) {
    for (const ws of await worldStoresFor(env, { ...actor, isSuperadmin: false })) founderOf.add(ws.world)
  }
  return (store) => {
    const ownAll = store.kind === 'world' && (!actor.isSuperadmin || founderOf.has(store.world))
    const c = [...(ownAll ? [] : [`LOWER(COALESCE(creator_email, '')) = ?`]), ...clauses]
    const b = [...(ownAll ? [] : [actor.email]), ...binds]
    return { whereSql: c.length ? `WHERE ${c.join(' AND ')}` : '', bindings: b }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Text search over the stored content of the graphs (2026-11-18)
// ────────────────────────────────────────────────────────────────────────

// How much stored graph content one search may read. A word that stands in most of a large
// collection would otherwise pull every graph through the Worker; past this the answer says so.
const SEARCH_MAX_BYTES = 60 * 1024 * 1024
const SEARCH_CHUNK_BYTES = 3 * 1024 * 1024
const SEARCH_CHUNK_ROWS = 40
// Spelling help reads every graph that was searched, so it is given for a map, not a collection.
const SUGGEST_MAX_GRAPHS = 600
// Up to this many graphIds are looked up by key; more than that is cheaper as one pass.
const SEARCH_IDS_BY_KEY = 800

/**
 * Which graphs contain the text, and in which nodes.
 *
 * Two steps, no index. The database names the candidates: the rows whose stored JSON contains the
 * longest fixed part of the search text anywhere (instr, so no LIKE pattern and no 50-byte limit).
 * The Worker then reads those rows a few at a time and decides: a whole-word match, in a text value
 * of a node whose type is searched (mcp/search-text.js). A hit that stands only in an html-node,
 * a field name or an address is no hit.
 *
 * graphIds narrows the search to those graphs (the map a client is showing). Who may see what is
 * graph_index's rule, through the same indexWhereFor.
 *
 * With no hit and one plain word, the answer carries the closest words that DO exist in the
 * searched graphs. That reads those graphs once more, so it is done only for graphIds of at most
 * SUGGEST_MAX_GRAPHS.
 */
export async function searchText(env, { query, scope = 'all', graphIds = null, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  const all = scope !== 'mine'
  if (!all && !actor.email) {
    return fail(ERR.FORBIDDEN_GRAPH, 'This token has no user identity, so it owns no graphs.')
  }
  const q = parseQuery(query)
  if (q.error) return fail(ERR.INVALID_INPUT, q.error)
  const only = Array.isArray(graphIds) ? new Set(graphIds.map(String)) : null

  return guarded(async () => {
    const lowerData = `LOWER(data)`
    const textClause = `(${q.literals.map(() => `instr(${lowerData}, ?) > 0`).join(' OR ')})`
    const whereCandidates = await indexWhereFor(env, actor, all, [textClause], q.literals)
    const whereAny = await indexWhereFor(env, actor, all)
    const stores = [platformStore(env), ...(await worldStoresFor(env, actor))]

    let budget = SEARCH_MAX_BYTES
    let partial = false
    // Read the named graphs of one store a few at a time, smallest first, until the budget is spent.
    // items: [{ id, size? }]. With sizes a query stays near SEARCH_CHUNK_BYTES; without them the
    // chunks are small, since one stored graph can be 2 MB.
    const readGraphs = async (store, where, items, each) => {
      let i = 0
      while (i < items.length) {
        if (budget <= 0) {
          partial = true
          return
        }
        const chunk = []
        let bytes = 0
        while (i < items.length && chunk.length < SEARCH_CHUNK_ROWS) {
          const size = items[i].size ?? SEARCH_CHUNK_BYTES / 8
          if (chunk.length && bytes + size > SEARCH_CHUNK_BYTES) break
          bytes += size
          chunk.push(items[i].id)
          i++
        }
        const idSql = `id IN (${chunk.map(() => '?').join(',')})`
        const rows = await store.all(
          `SELECT id, data FROM knowledge_graphs ${where.whereSql ? `${where.whereSql} AND ${idSql}` : `WHERE ${idSql}`}`,
          [...where.bindings, ...chunk],
        )
        for (const r of rows) {
          budget -= typeof r.data === 'string' ? r.data.length : 0
          let graph = null
          try {
            graph = JSON.parse(r.data)
          } catch {
            continue
          }
          each(String(r.id), graph)
        }
      }
    }

    const matched = []
    let candidates = 0
    let examined = 0
    for (const store of stores) {
      const w = whereCandidates(store)
      if (!w) continue
      // A map of a few hundred graphs is asked for by id, so only those rows are read; a larger
      // set (or none) is one pass over the store, narrowed afterwards. 80 ids a query keeps under
      // D1's 100 bound parameters.
      let named = []
      if (only && only.size <= SEARCH_IDS_BY_KEY) {
        const ids = [...only]
        for (let i = 0; i < ids.length; i += 80) {
          const part = ids.slice(i, i + 80)
          const idSql = `id IN (${part.map(() => '?').join(',')})`
          named.push(...(await store.all(`SELECT id, LENGTH(data) AS size FROM knowledge_graphs ${w.whereSql} AND ${idSql}`, [...w.bindings, ...part])))
        }
      } else {
        named = await store.all(`SELECT id, LENGTH(data) AS size FROM knowledge_graphs ${w.whereSql}`, w.bindings)
      }
      const mine = named.filter((r) => !only || only.has(String(r.id))).sort((a, b) => (a.size || 0) - (b.size || 0))
      candidates += mine.length
      const items = mine.map((r) => ({ id: String(r.id), size: r.size || 0 }))
      await readGraphs(store, whereAny(store), items, (id, graph) => {
        examined++
        const hit = matchGraph(graph, q.rx)
        if (hit) {
          matched.push({
            graphId: id,
            title: graph?.metadata?.title || null,
            world: store.world || null,
            inTitle: hit.inTitle,
            nodeIds: hit.nodeIds,
          })
        }
      })
    }

    // Spelling help: the nearest words that exist in the graphs that were searched.
    let suggestions = []
    let suggestionNote = null
    if (!matched.length && q.plain && !partial) {
      if (!only) suggestionNote = 'No spelling help without graphIds: it reads every searched graph.'
      else if (only.size > SUGGEST_MAX_GRAPHS) suggestionNote = `No spelling help for more than ${SUGGEST_MAX_GRAPHS} graphs.`
      else {
        const vocab = new Map()
        const items = [...only].map((id) => ({ id }))
        for (const store of stores) {
          const w = whereAny(store)
          if (!w) continue
          await readGraphs(store, w, items, (_id, graph) => collectWords(graph, vocab))
        }
        if (partial) suggestionNote = 'Spelling help read only a part of the graphs.'
        suggestions = suggest(q.query, vocab)
      }
    }

    matched.sort((a, b) => Number(b.inTitle) - Number(a.inTitle) || b.nodeIds.length - a.nodeIds.length || String(a.title || '').localeCompare(String(b.title || '')))
    return {
      ok: true,
      query: q.query,
      scope: all ? 'all' : 'mine',
      total: matched.length,
      candidates,
      examined,
      partial,
      suggestions,
      suggestionNote,
      matched,
    }
  })
}

/**
 * Every graph the actor owns (scope 'mine') or may see (scope 'all'), oldest first, in ONE query
 * per store and with light fields only.
 *
 * Why it exists: a map of the collection needs every graph, and paging search_graphs for it cost
 * 31 requests for 1,510 graphs — each of which re-read all earlier pages (queryAcrossStores takes
 * the newest offset+limit rows per store) and ran a json_each over every graph's nodes for the
 * published domains. This reads each store once — one pass, so the node types and the published
 * domains of each graph are affordable here — and skips the description.
 *
 * includeNodes adds each graph's nodes (id, label, type) and edges (source, target) — never node
 * content. It needs a metaArea or a nodeType and is refused above INDEX_NODES_MAX_GRAPHS graphs, so
 * one call cannot pull the node lists of the whole collection.
 *
 * nodeType (2026-11-14) keeps only the graphs that contain a node of that type, across all meta
 * areas. With includeNodes it returns ALL nodes of those graphs, not only the nodes of that type:
 * a map asked for "graphs with a micro-story" still draws each such graph whole. Before it, a map
 * had to make one includeNodes call per meta area to get there.
 *
 * Who sees what is exactly listMyGraphs' rule ('mine') or searchGraphs' rule ('all').
 */
// The address of a ![Header|…](address) element; only https addresses are passed on.
function headerImageOf(text) {
  const m = /^!\[Header[^\]]*\]\(\s*(https:\/\/[^)\s]+)\s*\)/.exec(typeof text === 'string' ? text : '')
  return m ? m[1] : null
}

export async function graphIndex(env, { scope = 'mine', metaArea = null, nodeType = null, includeNodes = false, graphIds = null, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  const all = scope === 'all'
  if (!all && !actor.email) {
    return fail(ERR.FORBIDDEN_GRAPH, 'This token has no user identity, so it owns no graphs.')
  }

  const dataSql = `CASE WHEN json_valid(data) THEN data END`
  const nodesSql = `COALESCE(json_extract(${dataSql}, '$.nodes'), '[]')`
  const edgesSql = `COALESCE(json_extract(${dataSql}, '$.edges'), '[]')`

  const areaFilter = metaAreaTagFilter(dataSql, metaArea)
  const typeFilter = String(nodeType ?? '').trim()
  // graphIds (2026-11-19): the graphs a map is SHOWING. Garnet filters by World, dates and more on
  // its own side; "graphs created today with a fulltext node" is five graphs there, but the node
  // type alone covers 1,792, and the node lists were refused for a selection that was never large.
  // The ids narrow the read itself, so the limit below counts what was asked for. They select
  // among the graphs the caller may see — the visibility clause still applies to every one.
  const idList = Array.isArray(graphIds) ? [...new Set(graphIds.map((x) => String(x || '').trim()).filter(Boolean))] : null
  if (idList && idList.length > INDEX_NODES_MAX_GRAPHS) {
    return fail(ERR.INVALID_INPUT, `graphIds takes at most ${INDEX_NODES_MAX_GRAPHS} graphs at a time.`)
  }
  const idFilter = idList && idList.length ? idList : null
  if (includeNodes && !areaFilter && !typeFilter && !idFilter) {
    return fail(ERR.INVALID_INPUT, 'includeNodes needs a metaArea, a nodeType or graphIds: node lists are returned for one meta area, one node type or one selection of graphs at a time.')
  }
  // The same test search_graphs uses for its nodeType filter. The ids go in as ONE bound value
  // (a JSON list read with json_each): D1 allows 100 bound values in a statement, and a map can
  // show 600 graphs.
  const areaClause = [
    ...(areaFilter ? [areaFilter.sql] : []),
    ...(typeFilter ? [`EXISTS (SELECT 1 FROM json_each(${nodesSql}) WHERE json_extract(value, '$.type') = ?)`] : []),
    ...(idFilter ? [`id IN (SELECT value FROM json_each(?))`] : []),
  ]
  const areaBind = [
    ...(areaFilter ? [areaFilter.binding] : []),
    ...(typeFilter ? [typeFilter] : []),
    ...(idFilter ? [JSON.stringify(idFilter)] : []),
  ]

  const whereFor = await indexWhereFor(env, actor, all, areaClause, areaBind)

  const nodeCols = includeNodes
    ? `,
        (SELECT json_group_array(json_object(
            'id', json_extract(value, '$.id'),
            'label', json_extract(value, '$.label'),
            'type', json_extract(value, '$.type'),
            'updatedAt', json_extract(value, '$.metadata.updatedAt')))
          FROM json_each(${nodesSql})) AS nodes_json,
        (SELECT json_group_array(json_object(
            'source', json_extract(value, '$.source'),
            'target', json_extract(value, '$.target')))
          FROM json_each(${edgesSql})) AS edges_json`
    : ''
  const selectSql = `
      SELECT
        id,
        COALESCE(json_extract(${dataSql}, '$.metadata.title'), title, '') AS title,
        COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '') AS meta_area,
        COALESCE(json_extract(${dataSql}, '$.metadata.publicationState'), 'private') AS publication_state,
        COALESCE(json_array_length(${nodesSql}), 0) AS node_count,
        COALESCE(CAST(json_extract(${dataSql}, '$.metadata.version') AS INTEGER), 0) AS version,
        (SELECT json_group_array(DISTINCT json_extract(value, '$.type'))
          FROM json_each(${nodesSql})
          WHERE json_extract(value, '$.type') IS NOT NULL) AS node_types_json,
        COALESCE((
          SELECT GROUP_CONCAT(DISTINCT json_extract(value, '$.publishedDomain'))
          FROM json_each(${nodesSql})
          WHERE json_extract(value, '$.publishedDomain') IS NOT NULL
        ), '') AS published_domains_csv,
        (SELECT json_extract(value, '$.path')
          FROM json_each(${nodesSql})
          WHERE json_extract(value, '$.type') = 'portfolio-image'
            AND json_extract(value, '$.path') IS NOT NULL
          LIMIT 1) AS image_path,
        CASE WHEN instr(data, '![Header') > 0 THEN (
          SELECT substr(json_extract(value, '$.info'), instr(json_extract(value, '$.info'), '![Header'), 900)
          FROM json_each(${nodesSql})
          WHERE instr(COALESCE(json_extract(value, '$.info'), ''), '![Header') > 0
          LIMIT 1) END AS header_md,
        created_date,
        updated_at${nodeCols}
      FROM knowledge_graphs`

  const cap = includeNodes ? INDEX_NODES_MAX_GRAPHS : INDEX_MAX_GRAPHS
  const stores = [platformStore(env), ...(await worldStoresFor(env, actor))]
  const rows = []
  for (const store of stores) {
    const w = whereFor(store)
    if (!w) continue
    const page = await store.all(`${selectSql} ${w.whereSql} ORDER BY created_date ASC LIMIT ?`, [...w.bindings, cap + 1])
    for (const r of page) rows.push({ ...r, _world: store.world })
  }
  // Graphs shared INTO the caller's Worlds from a World whose store the caller cannot otherwise
  // use (graph_shares, 2026-11-19): asked of that store by id, with the same filters.
  const sharedIn = await sharedInFor(env, actor, stores.filter((s) => s.kind === 'world'))
  for (const [home, list] of sharedIn) {
    const store = await sharedWorldStore(env, home)
    if (!store) continue
    const by = new Map(list.map((x) => [x.graphId, x]))
    const ids = [...by.keys()]
    const c = [`id IN (${ids.map(() => '?').join(', ')})`, ...areaClause]
    const page = await store.all(`${selectSql} WHERE ${c.join(' AND ')} ORDER BY created_date ASC LIMIT ?`, [...ids, ...areaBind, cap + 1])
    for (const r of page) rows.push({ ...r, _world: home, _sharedVia: by.get(r.id)?.via, _sharedMode: by.get(r.id)?.mode })
  }
  const shareMap = await sharesOf(env)
  if (includeNodes && rows.length > INDEX_NODES_MAX_GRAPHS) {
    return fail(ERR.INVALID_INPUT, `That ${areaFilter ? 'meta area' : 'node type'}${areaFilter && typeFilter ? ' and node type' : ''} covers more than ${INDEX_NODES_MAX_GRAPHS} graphs; node lists are returned for at most ${INDEX_NODES_MAX_GRAPHS} graphs at a time. Pass graphIds to ask for a smaller selection.`)
  }
  rows.sort((a, b) => String(a.created_date || '').localeCompare(String(b.created_date || '')))

  const parseList = (text) => {
    try {
      const v = JSON.parse(text || '[]')
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }
  const graphs = rows.slice(0, INDEX_MAX_GRAPHS).map((r) => ({
    graphId: r.id,
    title: r.title || null,
    metaArea: r.meta_area || null,
    publicationState: r.publication_state || 'private',
    nodeCount: r.node_count ?? 0,
    // The graph's version number as the graph itself carries it (metadata.version), read in the
    // same pass as the other fields (2026-11-18: a map lights graphs up by version, and one history
    // read per graph is 1,300+ requests). The history's newest number is the one writes compare
    // against; the two agree for all but a handful of graphs. Null: the graph carries no number.
    version: Number(r.version) > 0 ? Number(r.version) : null,
    createdAt: r.created_date || null,
    updatedAt: r.updated_at || null,
    world: r._world || null,
    // Shared with the caller's World from another (graph_shares): through which World, read or write.
    ...(r._sharedVia ? { sharedVia: r._sharedVia, sharedMode: r._sharedMode } : {}),
    // Every World this graph is shared with. Absent when it is shared with none.
    ...(shareMap.has(r.id) ? { sharedWith: shareMap.get(r.id).map((x) => ({ world: x.world, mode: x.mode })) } : {}),
    // Which node types the graph contains, so a map can filter on "has a youtube-video".
    nodeTypes: parseList(r.node_types_json).filter((t) => t != null).map(String).sort(),
    // The graph's card image: the path of its first portfolio-image node, exactly as
    // /getknowgraphsummaries picks portfolioImagePath. A map draws it on a course (2026-11-16).
    image: typeof r.image_path === 'string' && r.image_path ? r.image_path : null,
    // The graph's header image: the address in the first ![Header|…](address) of its nodes, as
    // the viewers show it on top of the graph. A map draws it inside the graph's circle when
    // the circle is large on screen (2026-11-19). Null: no node has a header image.
    headerImage: headerImageOf(r.header_md),
    // The node's own stamp only; the caller merges it with the publish registry, as the lists do.
    publishedDomainsCsv: r.published_domains_csv || '',
    ...(includeNodes
      ? {
          nodes: parseList(r.nodes_json)
            .filter((n) => n && n.id != null)
            // updatedAt: when the node's content last changed (node.metadata.updatedAt). Null for a
            // node written before 2026-11-20, when nodes began to carry a time of their own.
            .map((n) => ({ id: String(n.id), label: n.label == null ? null : String(n.label), type: n.type == null ? null : String(n.type), updatedAt: typeof n.updatedAt === 'string' && n.updatedAt ? n.updatedAt : null })),
          edges: parseList(r.edges_json)
            .filter((e) => e && e.source != null && e.target != null)
            .map((e) => ({ source: String(e.source), target: String(e.target) })),
        }
      : {}),
  }))

  // Every World the caller can use, also one with no graphs yet, so a map can offer it as a
  // place to move a graph to (2026-11-17).
  const worlds = stores.filter((s) => s.kind === 'world' && s.world).map((s) => s.world)
  return { ok: true, scope: all ? 'all' : 'mine', metaArea: areaFilter ? String(metaArea) : null, nodeType: typeFilter || null, total: graphs.length, worlds, graphs }
}
