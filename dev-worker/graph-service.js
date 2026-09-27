/**
 * graph-service.js — the single internal service layer for Knowledge Graph operations.
 *
 *   REST-handler ─┐
 *                 ├── graphService ── D1 (vegvisr_org)
 *   MCP-verktøy ──┘
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

export function graphLinks(graphId) {
  return {
    graphId,
    editorUrl: `${EDITOR_BASE}/?graphId=${graphId}`,
    viewerUrl: `${EDITOR_BASE}/view?graphId=${graphId}`,
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
export async function currentVersion(env, graphId) {
  const row = await env.vegvisr_org
    .prepare('SELECT MAX(version) AS version FROM knowledge_graph_history WHERE graph_id = ?')
    .bind(graphId)
    .first()
  return row?.version || 0
}

/** History is capped at 20 versions per graph — drop the oldest once over. */
async function trimHistory(env, graphId) {
  const countResult = await env.vegvisr_org
    .prepare('SELECT COUNT(*) AS count FROM knowledge_graph_history WHERE graph_id = ?')
    .bind(graphId)
    .first()
  if (countResult?.count > 20) {
    await env.vegvisr_org
      .prepare(
        'DELETE FROM knowledge_graph_history WHERE graph_id = ? AND version = (SELECT MIN(version) FROM knowledge_graph_history WHERE graph_id = ?)',
      )
      .bind(graphId, graphId)
      .run()
  }
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

  const row = await env.vegvisr_org
    .prepare('SELECT data, created_by, user_id FROM knowledge_graphs WHERE id = ?')
    .bind(graphId)
    .first()
  if (!row) return fail(ERR.GRAPH_NOT_FOUND, `Graph ${graphId} not found.`)

  let meta = {}
  try {
    meta = JSON.parse(row.data)?.metadata || {}
  } catch {
    /* a graph with unparseable JSON is treated as having no metadata */
  }

  const isPublished = meta.publicationState === 'published'

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

  const result = await env.vegvisr_org
    .prepare('SELECT data, created_date, updated_at FROM knowledge_graphs WHERE id = ?')
    .bind(id)
    .first()
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

  return { ok: true, graph: graphData, version: graphData.metadata?.version ?? null }
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
export async function saveGraph(env, { id, graphData, override = false, actor = null }) {
  if (!id || !graphData) {
    return fail(ERR.INVALID_INPUT, 'Graph ID and graph data are required.')
  }

  const graphExists = await env.vegvisr_org
    .prepare('SELECT id FROM knowledge_graphs WHERE id = ?')
    .bind(id)
    .first()

  // UUID v4 required for NEW graphs. Existing graphs (semantic-named legacy ids are
  // common here) keep updating at their current id. Additive rule from 2026-05-28.
  if (!graphExists && !isUuidV4(id)) {
    return fail(ERR.INVALID_INPUT, 'New graph IDs must be a valid UUID v4. Existing graphs with non-UUID ids may still update at their current id.', {
      expected: 'UUID v4 (e.g., 550e8400-e29b-41d4-a716-446655440000)',
      received: id,
    })
  }

  const current = await currentVersion(env, id)

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

  if (graphExists) {
    await env.vegvisr_org
      .prepare(
        `UPDATE knowledge_graphs
         SET data = ?, title = COALESCE(?, title), description = COALESCE(?, description), created_by = COALESCE(?, created_by), updated_at = ?,
             user_id = COALESCE(?, user_id), source_app = COALESCE(?, source_app)
         WHERE id = ?`,
      )
      .bind(
        JSON.stringify(enriched),
        enriched.metadata.title || null,
        enriched.metadata.description || null,
        enriched.metadata.createdBy || null,
        now,
        userId,
        sourceApp,
        id,
      )
      .run()
  } else {
    await env.vegvisr_org
      .prepare(
        `INSERT INTO knowledge_graphs (id, title, description, created_by, data, created_date, updated_at, user_id, source_app)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        enriched.metadata.title || '',
        enriched.metadata.description || '',
        enriched.metadata.createdBy || '',
        JSON.stringify(enriched),
        now,
        now,
        userId,
        sourceApp,
      )
      .run()
  }

  await env.vegvisr_org
    .prepare('INSERT INTO knowledge_graph_history (id, graph_id, version, data, user_id, source_app) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), id, newVersion, JSON.stringify(enriched), userId, sourceApp)
    .run()

  await trimHistory(env, id)

  return { ok: true, id, newVersion, graphData: enriched, created: !graphExists }
}

/**
 * Create a brand-new private graph owned by `actor`. Thin, opinionated wrapper over
 * saveGraph() for the MCP create_graph tool.
 *
 * VEGR.AI rules applied here: UUID v4 id, createdBy from the authenticated user,
 * publicationState 'private' (rule 1 — never published without an explicit publish).
 */
export async function createGraph(env, { title, description = '', metaArea, nodes = [], edges = [], actor }) {
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

  const saved = await saveGraph(env, { id, graphData, override: false, actor })
  if (!saved.ok) return saved

  return {
    ok: true,
    graphId: id,
    title: graphData.metadata.title,
    metaArea: graphData.metadata.metaArea,
    publicationState: 'private',
    version: saved.newVersion,
    ...graphLinks(id),
  }
}

/**
 * Add one node to a graph. Wraps the historical insertNodeIntoGraph() behaviour and adds
 * OPTIONAL optimistic concurrency: pass expectedVersion to have a concurrent write refused
 * with VERSION_CONFLICT instead of silently interleaving. Omitting it preserves the
 * existing REST contract for POST /addNode, which never had the check.
 */
export async function addNode(env, { graphId, node, expectedVersion = null, actor = null }) {
  if (!graphId || !node || typeof node !== 'object') {
    return fail(ERR.INVALID_INPUT, 'graphId and node are required.')
  }

  const result = await env.vegvisr_org
    .prepare('SELECT data FROM knowledge_graphs WHERE id = ?')
    .bind(graphId)
    .first()
  if (!result) return fail(ERR.GRAPH_NOT_FOUND, 'Graph not found.')

  const graphData = JSON.parse(result.data)
  if (!Array.isArray(graphData.nodes)) graphData.nodes = []
  if (!Array.isArray(graphData.edges)) graphData.edges = []

  const current = await currentVersion(env, graphId)
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

  const now = new Date().toISOString()
  await env.vegvisr_org
    .prepare('UPDATE knowledge_graphs SET data = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(graphData), now, graphId)
    .run()

  await env.vegvisr_org
    .prepare('INSERT INTO knowledge_graph_history (id, graph_id, version, data) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), graphId, newVersion, JSON.stringify(graphData))
    .run()

  await trimHistory(env, graphId)

  return {
    ok: true,
    graphId,
    nodeId: nodeToInsert.id,
    currentVersion: current,
    newVersion,
    title: graphData.metadata?.title || null,
    metaArea: graphData.metadata?.metaArea || null,
    publicationState: graphData.metadata?.publicationState || 'private',
    ...graphLinks(graphId),
  }
}

/**
 * Update graph-level metadata under optimistic concurrency. Mirrors POST /patchGraphMetadata.
 * `allowPublicationState` gates the one field that must go through publishGraph() instead,
 * so publishing cannot happen as a side effect of an ordinary metadata edit (rule 2).
 */
export async function updateMetadata(env, { graphId, fields, expectedVersion, actor = null, allowPublicationState = false }) {
  if (!graphId || !fields || typeof fields !== 'object' || !Number.isInteger(expectedVersion)) {
    return fail(ERR.INVALID_INPUT, 'graphId, fields (object), and expectedVersion (integer) are required.')
  }
  if (!allowPublicationState && 'publicationState' in fields) {
    return fail(ERR.INVALID_INPUT, 'publicationState cannot be set through a metadata update — use the explicit publish action.')
  }

  const row = await env.vegvisr_org
    .prepare('SELECT data FROM knowledge_graphs WHERE id = ?')
    .bind(graphId)
    .first()
  if (!row) return fail(ERR.GRAPH_NOT_FOUND, 'Graph not found.')

  const current = await currentVersion(env, graphId)
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

  const now = new Date().toISOString()
  await env.vegvisr_org
    .prepare(
      `UPDATE knowledge_graphs
       SET data = ?, title = COALESCE(?, title), description = COALESCE(?, description), updated_at = ?
       WHERE id = ?`,
    )
    .bind(JSON.stringify(graphData), graphData.metadata.title || null, graphData.metadata.description || null, now, graphId)
    .run()

  await env.vegvisr_org
    .prepare('INSERT INTO knowledge_graph_history (id, graph_id, version, data) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), graphId, newVersion, JSON.stringify(graphData))
    .run()

  await trimHistory(env, graphId)

  return {
    ok: true,
    graphId,
    newVersion,
    title: graphData.metadata.title || null,
    metaArea: graphData.metadata.metaArea || null,
    publicationState: graphData.metadata.publicationState || 'private',
    ...graphLinks(graphId),
  }
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
export function graphResult(env, { graphId, title, metaArea, publicationState, version }) {
  return {
    success: true,
    graphId,
    title: title ?? null,
    metaArea: metaArea ?? null,
    publicationState: publicationState || 'private',
    version: version ?? null,
    ...graphLinks(graphId),
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

const SEARCH_MAX_LIMIT = 50

function clampLimit(limit, fallback = 20) {
  const n = Number.parseInt(limit ?? '', 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, 1), SEARCH_MAX_LIMIT)
}

/**
 * Free-text search across titles, descriptions, meta areas and node content, restricted to what
 * the actor may see. Mirrors the columns GET /searchGraphs matches on.
 */
export async function searchGraphs(env, { query, metaArea = null, nodeType = null, limit = 20, offset = 0, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')

  const lim = clampLimit(limit)
  const off = Math.max(Number.parseInt(offset ?? '', 10) || 0, 0)

  const dataSql = `CASE WHEN json_valid(data) THEN data END`
  const nodesSql = `COALESCE(json_extract(${dataSql}, '$.nodes'), '[]')`

  const conditions = []
  const bindings = []

  const vis = visibilityClause(actor)
  if (vis.sql) {
    conditions.push(vis.sql)
    bindings.push(...vis.bindings)
  }

  const q = String(query || '').trim()
  if (q) {
    const pattern = `%${q.toLowerCase().replace(/\*/g, '%')}%`
    conditions.push(`(
      LOWER(COALESCE(json_extract(${dataSql}, '$.metadata.title'), title, '')) LIKE ?
      OR LOWER(COALESCE(json_extract(${dataSql}, '$.metadata.description'), '')) LIKE ?
      OR LOWER(COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '')) LIKE ?
      OR EXISTS (
        SELECT 1 FROM json_each(${nodesSql})
        WHERE LOWER(COALESCE(json_extract(value, '$.label'), '')) LIKE ?
           OR LOWER(COALESCE(json_extract(value, '$.info'), '')) LIKE ?
      )
    )`)
    bindings.push(pattern, pattern, pattern, pattern, pattern)
  }

  if (metaArea) {
    conditions.push(`LOWER(COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '')) LIKE ?`)
    bindings.push(`%${String(metaArea).toLowerCase()}%`)
  }

  if (nodeType) {
    conditions.push(`EXISTS (SELECT 1 FROM json_each(${nodesSql}) WHERE json_extract(value, '$.type') = ?)`)
    bindings.push(String(nodeType))
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const totalRow = await env.vegvisr_org
    .prepare(`SELECT COUNT(*) AS total FROM knowledge_graphs ${whereSql}`)
    .bind(...bindings)
    .first()
  const total = Number(totalRow?.total || 0)

  if (total === 0) return { ok: true, results: [], total: 0, limit: lim, offset: off, hasMore: false }

  const rows = await env.vegvisr_org
    .prepare(`
      SELECT
        id,
        COALESCE(json_extract(${dataSql}, '$.metadata.title'), title, '') AS title,
        COALESCE(json_extract(${dataSql}, '$.metadata.description'), '') AS description,
        COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '') AS meta_area,
        COALESCE(json_extract(${dataSql}, '$.metadata.publicationState'), 'private') AS publication_state,
        COALESCE(json_extract(${dataSql}, '$.metadata.version'), 0) AS version,
        COALESCE(json_extract(${dataSql}, '$.metadata.createdBy'), created_by, '') AS created_by,
        COALESCE(json_array_length(${nodesSql}), 0) AS node_count,
        updated_at
      FROM knowledge_graphs
      ${whereSql}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `)
    .bind(...bindings, lim, off)
    .all()

  const results = (rows.results || []).map((r) => ({
    graphId: r.id,
    title: r.title || null,
    description: r.description || null,
    metaArea: r.meta_area || null,
    publicationState: r.publication_state || 'private',
    version: r.version ?? null,
    nodeCount: r.node_count ?? 0,
    updatedAt: r.updated_at || null,
    isMine: Boolean(actor.email && String(r.created_by || '').toLowerCase() === actor.email),
    ...graphLinks(r.id),
  }))

  return { ok: true, results, total, limit: lim, offset: off, hasMore: off + results.length < total }
}

/** The actor's own graphs, newest first. A thin, explicit case of searchGraphs. */
export async function listMyGraphs(env, { limit = 20, offset = 0, metaArea = null, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!actor.email) {
    return fail(ERR.FORBIDDEN_GRAPH, 'This token has no user identity, so it owns no graphs.')
  }

  const lim = clampLimit(limit)
  const off = Math.max(Number.parseInt(offset ?? '', 10) || 0, 0)
  const dataSql = `CASE WHEN json_valid(data) THEN data END`
  const nodesSql = `COALESCE(json_extract(${dataSql}, '$.nodes'), '[]')`

  const conditions = [`LOWER(COALESCE(creator_email, '')) = ?`]
  const bindings = [actor.email]
  if (metaArea) {
    conditions.push(`LOWER(COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '')) LIKE ?`)
    bindings.push(`%${String(metaArea).toLowerCase()}%`)
  }
  const whereSql = `WHERE ${conditions.join(' AND ')}`

  const totalRow = await env.vegvisr_org
    .prepare(`SELECT COUNT(*) AS total FROM knowledge_graphs ${whereSql}`)
    .bind(...bindings)
    .first()
  const total = Number(totalRow?.total || 0)

  const rows = await env.vegvisr_org
    .prepare(`
      SELECT
        id,
        COALESCE(json_extract(${dataSql}, '$.metadata.title'), title, '') AS title,
        COALESCE(json_extract(${dataSql}, '$.metadata.description'), '') AS description,
        COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '') AS meta_area,
        COALESCE(json_extract(${dataSql}, '$.metadata.publicationState'), 'private') AS publication_state,
        COALESCE(json_extract(${dataSql}, '$.metadata.version'), 0) AS version,
        COALESCE(json_array_length(${nodesSql}), 0) AS node_count,
        updated_at
      FROM knowledge_graphs
      ${whereSql}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `)
    .bind(...bindings, lim, off)
    .all()

  const results = (rows.results || []).map((r) => ({
    graphId: r.id,
    title: r.title || null,
    description: r.description || null,
    metaArea: r.meta_area || null,
    publicationState: r.publication_state || 'private',
    version: r.version ?? null,
    nodeCount: r.node_count ?? 0,
    updatedAt: r.updated_at || null,
    isMine: true,
    ...graphLinks(r.id),
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
export async function updateNode(env, { graphId, nodeId, fields, expectedVersion, actor = null }) {
  if (!graphId || !nodeId || !fields || typeof fields !== 'object' || !Number.isInteger(expectedVersion)) {
    return fail(ERR.INVALID_INPUT, 'graphId, nodeId, fields (object), and expectedVersion (integer) are required.')
  }

  const result = await env.vegvisr_org
    .prepare('SELECT data FROM knowledge_graphs WHERE id = ?')
    .bind(graphId)
    .first()
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

  const now = new Date().toISOString()
  const updateResult = await env.vegvisr_org
    .prepare(`
      UPDATE knowledge_graphs
      SET data = ?, updated_at = ?
      WHERE id = ?
        AND COALESCE(CAST(json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.metadata.version') AS INTEGER), 0) = ?
    `)
    .bind(JSON.stringify(graphData), now, graphId, expectedVersion)
    .run()

  // Zero rows changed means another request won the race between the read above and this write.
  if (!updateResult.meta?.changes) {
    const latest = await env.vegvisr_org
      .prepare('SELECT data FROM knowledge_graphs WHERE id = ?')
      .bind(graphId)
      .first()
    let latestVersion = 0
    try {
      latestVersion = Number(JSON.parse(latest?.data || '{}')?.metadata?.version || 0)
    } catch { /* an unparseable graph reports version 0 */ }
    return fail(ERR.VERSION_CONFLICT, 'Version mismatch. Graph was updated by another request.', {
      currentVersion: latestVersion,
      expectedVersion,
    })
  }

  await env.vegvisr_org
    .prepare('INSERT INTO knowledge_graph_history (id, graph_id, version, data) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), graphId, newVersion, JSON.stringify(graphData))
    .run()

  await trimHistory(env, graphId)

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
    ...graphLinks(graphId),
  }
}
