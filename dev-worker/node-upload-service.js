/**
 * node-upload-service.js — put a large text (a whole HTML app, a stylesheet, a long document) into
 * a node without the text ever passing through the model.
 *
 * WHY A TICKET
 * ------------
 * An html-node holds a complete HTML document, often 50–300 KB. As a tool argument the model has to
 * write every character of it out again, which is slow, costs tens of thousands of tokens and can
 * change a character on the way — and a changed character in a script breaks the page silently.
 * The file already exists in the client's sandbox, so the sandbox sends it itself:
 *
 *   create_node_upload (MCP, authenticated, graph:write)  →  ticket
 *   PUT /node-upload/<ticket> (no other credential)       →  the node's `info` is the body
 *
 * Same shape as media-upload-service.js, and the same rule: the ticket is the ONLY credential the
 * sandbox holds. The user's login token never leaves this worker.
 *
 * WHAT A TICKET CAN DO — and nothing else
 * ---------------------------------------
 *  - one upload (the claim is a single conditional UPDATE, so two PUTs cannot both win)
 *  - within TICKET_TTL_SECONDS
 *  - of at most MAX_BYTES of UTF-8 text
 *  - into ONE node of ONE graph, both fixed when the ticket was made — never chosen by the uploader
 *  - as the person who made the ticket: write access to the graph is checked when the ticket is
 *    made AND again when it is used, so access lost in between is access lost
 * It sets `info` only. A node that exists keeps its label, type, metadata and edges; a node that
 * does not exist is created with the label and type fixed in the ticket.
 * Only the SHA-256 of the ticket is stored, so reading the table yields nothing usable.
 */

import * as gs from './graph-service.js'

const { ERR, statusForCode } = gs

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

export const TICKET_TTL_SECONDS = 600
// A graph is one row of JSON; D1 takes values up to 2 MB. 1 MB for one node leaves room for the rest.
export const MAX_BYTES = 1024 * 1024
export const UPLOAD_PATH = '/node-upload/'
// Types whose `info` IS a text document. Data types keep their content in metadata and are not for this.
export const UPLOAD_TYPES = ['html-node', 'css-node', 'fulltext']
const PUBLIC_ORIGIN = 'https://knowledge.vegvisr.org'

const TABLE_SQL = `CREATE TABLE IF NOT EXISTS node_upload_tickets (
  ticket_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT,
  graph_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  max_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  result_version INTEGER
)`
export { TABLE_SQL as NODE_UPLOAD_TABLE_SQL }

const now = () => Math.floor(Date.now() / 1000)

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

/**
 * Make a ticket for one upload into one node. Returns { ok, uploadUrl, graphId, nodeId, creates,
 * expiresAt, maxBytes, curl } — the ticket appears only in the URL.
 */
export async function createNodeUpload(env, { actor, graphId, nodeId, label, type }) {
  if (!actor || actor.anonymous || !actor.email) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  const gid = String(graphId || '').trim()
  const nid = String(nodeId || '').trim()
  if (!gid || !nid) return fail(ERR.INVALID_INPUT, 'graphId and nodeId are required.')
  if (nid.length > 120) return fail(ERR.INVALID_INPUT, 'nodeId is too long (at most 120 characters).')

  const access = await gs.checkAccess(env, actor, gid, 'write')
  if (!access.ok) return access
  const read = await gs.getGraph(env, gid, { caller: actor })
  if (!read.ok) return read
  const existing = (read.graph?.nodes || []).find((n) => n.id === nid) || null

  const nodeType = existing ? String(existing.type || 'fulltext') : String(type || 'html-node')
  if (!UPLOAD_TYPES.includes(nodeType)) {
    return fail(
      ERR.INVALID_INPUT,
      existing
        ? `Node ${nid} is of type "${nodeType}". An upload replaces a node's text, so it is only for ${UPLOAD_TYPES.join(', ')}.`
        : `type must be one of ${UPLOAD_TYPES.join(', ')}.`,
    )
  }
  const nodeLabel = existing ? String(existing.label || nid) : String(label || '').trim()
  if (!nodeLabel) return fail(ERR.INVALID_INPUT, `Node ${nid} does not exist yet, so a label is required to create it.`)

  const ticket = hex(crypto.getRandomValues(new Uint8Array(32)))
  const created = now()
  const expires = created + TICKET_TTL_SECONDS
  try {
    await env.vegvisr_org.prepare(TABLE_SQL).run()
    await env.vegvisr_org
      .prepare(
        'INSERT INTO node_upload_tickets (ticket_hash, email, role, graph_id, node_id, label, type, max_bytes, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      )
      .bind(await sha256(ticket), actor.email, actor.role || null, gid, nid, nodeLabel, nodeType, MAX_BYTES, created, expires)
      .run()
  } catch (e) {
    return fail(ERR.STORE_UNAVAILABLE, `Could not create the upload ticket: ${e.message}`)
  }

  const uploadUrl = `${PUBLIC_ORIGIN}${UPLOAD_PATH}${ticket}`
  return {
    ok: true,
    uploadUrl,
    graphId: gid,
    nodeId: nid,
    type: nodeType,
    creates: !existing,
    expiresAt: new Date(expires * 1000).toISOString(),
    maxBytes: MAX_BYTES,
    curl: `curl -sS -X PUT -H "Content-Type: text/plain; charset=utf-8" --data-binary @index.html "${uploadUrl}"`,
  }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/**
 * PUT /node-upload/<ticket>. The ticket is the whole authentication; it is claimed BEFORE the body
 * is read, so a refused or failed upload still spends it — a ticket is never retried.
 */
export async function handleNodeUpload(request, env) {
  if (request.method !== 'PUT' && request.method !== 'POST') return json({ error: 'PUT the text to this URL.' }, 405)
  const ticket = new URL(request.url).pathname.slice(UPLOAD_PATH.length)
  if (!/^[0-9a-f]{64}$/.test(ticket)) return json({ error: 'Unknown or expired upload ticket.' }, 404)

  const declared = Number(request.headers.get('Content-Length') || '')
  if (!Number.isFinite(declared) || declared <= 0) return json({ error: 'Send the text with a Content-Length (curl --data-binary @file).' }, 411)
  if (declared > MAX_BYTES) return json({ error: `The text is ${declared} bytes; the limit is ${MAX_BYTES}.` }, 413)

  const hash = await sha256(ticket)
  let row
  try {
    const t = now()
    // The table is made on first use, so a ticket presented before any was ever issued is simply unknown.
    await env.vegvisr_org.prepare(TABLE_SQL).run()
    const claim = await env.vegvisr_org
      .prepare('UPDATE node_upload_tickets SET used_at = ? WHERE ticket_hash = ? AND used_at IS NULL AND expires_at > ?')
      .bind(t, hash, t)
      .run()
    if (!claim?.meta?.changes) return json({ error: 'Unknown, expired or already used upload ticket.' }, 404)
    row = await env.vegvisr_org
      .prepare('SELECT email, role, graph_id, node_id, label, type, max_bytes FROM node_upload_tickets WHERE ticket_hash = ?')
      .bind(hash)
      .first()
  } catch (e) {
    return json({ error: `Upload tickets unavailable: ${e.message}` }, 503)
  }
  if (!row) return json({ error: 'Unknown upload ticket.' }, 404)

  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > row.max_bytes) return json({ error: `The text is larger than ${row.max_bytes} bytes.` }, 413)
  let text
  try {
    // fatal: bytes that are not UTF-8 are refused rather than stored with replacement characters.
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return json({ error: 'The body is not UTF-8 text.' }, 415)
  }
  if (!text.trim()) return json({ error: 'The body is empty.' }, 400)

  // The ticket's owner, with the role they had when they made it. Access is checked again NOW.
  const actor = gs.normalizeActor({
    valid: true,
    userId: row.email,
    userEmail: row.email,
    userRole: row.role || 'User',
    scopes: ['graph:read', 'graph:write'],
    authMethod: 'node-upload-ticket',
  })
  const access = await gs.checkAccess(env, actor, row.graph_id, 'write')
  if (!access.ok) return json({ error: access.message, code: access.code }, access.status || 403)
  const read = await gs.getGraph(env, row.graph_id, { caller: actor })
  if (!read.ok) return json({ error: read.message, code: read.code }, read.status || 404)

  const existing = (read.graph?.nodes || []).find((n) => n.id === row.node_id) || null
  let result
  if (existing) {
    // The type was checked when the ticket was made; a node retyped since then is not overwritten.
    if (String(existing.type || 'fulltext') !== row.type) {
      return json({ error: `Node ${row.node_id} is no longer of type "${row.type}". Make a new upload ticket.` }, 409)
    }
    result = await gs.updateNode(env, {
      graphId: row.graph_id,
      nodeId: row.node_id,
      fields: { info: text },
      expectedVersion: Number(read.version),
      actor,
    })
  } else {
    result = await gs.addNode(env, {
      graphId: row.graph_id,
      node: { id: row.node_id, label: row.label, type: row.type, info: text },
      expectedVersion: Number.isInteger(Number(read.version)) ? Number(read.version) : null,
      actor,
    })
  }
  if (!result.ok) return json({ error: result.message, code: result.code }, result.status || 500)

  try {
    await env.vegvisr_org.prepare('UPDATE node_upload_tickets SET result_version = ? WHERE ticket_hash = ?').bind(result.newVersion ?? null, hash).run()
  } catch {
    // The node is written and the answer below says so; a missing audit column is not a failure.
  }
  return json({
    ok: true,
    graphId: row.graph_id,
    nodeId: row.node_id,
    created: !existing,
    chars: text.length,
    bytes: bytes.byteLength,
    sha256: await sha256(text),
    version: result.newVersion ?? null,
    viewerUrl: result.viewerUrl || null,
  })
}
