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

import { platformStore, resolveGraphStore, GraphStoreError, reserveLocation, activateLocation, dropPendingLocation, worldStoresFor, defaultWorldFor } from './graph-store.js'

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
    edges: graphData.edges.map((edge) => ({
      ...edge,
      id: `${edge.source}_${edge.target}`,
      source: edge.source,
      target: edge.target,
    })),
  }
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidV4(id) {
  return UUID_V4_RE.test(String(id || ''))
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

  // A graph in a World store: resolveGraphStore() has already admitted this actor (Superadmin, or
  // the World's founder or account holder), and that is the whole rule there — the World's
  // graphs are the founder's, whoever typed them in.
  if (store.kind === 'world') return { ok: true, graph: row, owner: ownerOf(row, meta), isPublished, world: store.world }

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

  const graphData = sanitizeGraphData(JSON.parse(result.data))
  graphData.created_date = result.created_date
  graphData.updated_at = result.updated_at

  graphData.nodes = graphData.nodes.map((node) => ({
    ...node,
    imageWidth: node.imageWidth || null,
    imageHeight: node.imageHeight || null,
    path: node.path || null,
  }))
  graphData.edges = graphData.edges.map((edge) => ({
    ...edge,
    id: `${edge.source}_${edge.target}`,
    source: edge.source,
    target: edge.target,
  }))

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

  return { ok: true, graph: graphData, version: graphData.metadata?.version ?? null, world: store.world }
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

  graphData.nodes.push(nodeToInsert)

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
 * Update graph-level metadata under optimistic concurrency. Mirrors POST /patchGraphMetadata.
 * `allowPublicationState` gates the one field that must go through publishGraph() instead,
 * so publishing cannot happen as a side effect of an ordinary metadata edit (rule 2).
 */
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
  const { createdBy: _ignoredCreatedBy, version: _ignoredVersion, ...safeFields } = fields
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
  })

  return {
    ok: true,
    graphId,
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

  if (metaArea) {
    conditions.push(`LOWER(COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '')) LIKE ?`)
    bindings.push(`%${String(metaArea).toLowerCase()}%`)
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
  const areaClause = metaArea ? [`LOWER(COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '')) LIKE ?`] : []
  const areaBind = metaArea ? [`%${String(metaArea).toLowerCase()}%`] : []
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
  Object.assign(graphData.nodes[nodeIndex], safeFields)

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
export async function moveGraphToWorld(env, { graphId, world, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!actor.isSuperadmin) return fail(ERR.FORBIDDEN_GRAPH, 'Only a Superadmin may move a graph into a World.')
  if (!graphId || !world) return fail(ERR.INVALID_INPUT, 'graphId and world are required.')
  const domain = String(world).trim().toLowerCase()

  const source = await storeFor(env, { graphId, actor })
  if (source.error) return source.error
  if (source.store.kind !== 'platform') {
    return fail(ERR.INVALID_INPUT, `Graph ${graphId} is not on the platform${source.store.world ? ` — it is already in ${source.store.world}` : ''}.`)
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
    ...graphLinks(graphId, domain),
  }
}
