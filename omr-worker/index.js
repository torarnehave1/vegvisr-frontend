// omr-worker — sessions in KV, PDFs in R2, auth via D1 config table.
// Patterns mirror vemotion-worker/index.js for consistency with the rest of the fleet.
//
// Endpoints (all require X-API-Token header except OPTIONS):
//   GET    /sessions          → list current user's sessions
//   GET    /sessions/:id      → fetch one session JSON
//   PUT    /sessions/:id      → upsert one session JSON
//   DELETE /sessions/:id      → delete session + its PDF in R2
//   PUT    /pdfs/:id          → upload PDF binary to R2 (Content-Type: application/pdf)
//   GET    /pdfs/:id          → stream PDF back
//   GET    /health            → diagnostic ping (no auth)
//
// KV keys:   omr:session:{userId}:{sessionId}
// R2 keys:   omr/pdf/{userId}/{sessionId}.pdf

const SESSION_PREFIX = 'omr:session:'
const sessionKey = (userId, id) => `${SESSION_PREFIX}${userId}:${id}`
const pdfKey = (userId, id) => `omr/pdf/${userId}/${id}.pdf`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
  'Access-Control-Max-Age': '86400',
}

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...headers },
  })

const error = (message, status = 400, extra = {}) =>
  json({ error: message, ...extra }, status)

// ── Auth (matches vemotion-worker pattern) ───────────────────────────────────
async function validateAuth(request, env) {
  const apiToken = request.headers.get('X-API-Token')
  if (!apiToken) return { valid: false, error: 'Missing X-API-Token header' }
  try {
    const row = await env.vegvisr_org
      .prepare('SELECT user_id, Role, email FROM config WHERE emailVerificationToken = ?')
      .bind(apiToken)
      .first()
    if (!row) return { valid: false, error: 'Invalid authentication token' }
    return { valid: true, userId: row.user_id, email: row.email || null, role: row.Role || null }
  } catch (err) {
    console.error('Auth error', err)
    return { valid: false, error: 'Authentication error' }
  }
}

// ── KV / R2 helpers ──────────────────────────────────────────────────────────
async function readSession(env, userId, id) {
  const raw = await env.OMR_SESSIONS.get(sessionKey(userId, id))
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

async function writeSession(env, userId, id, payload) {
  // Stamp savedAt server-side regardless of what the client sent.
  const record = {
    ...payload,
    id,
    userId,
    savedAt: new Date().toISOString(),
  }
  await env.OMR_SESSIONS.put(sessionKey(userId, id), JSON.stringify(record))
  return record
}

async function deleteSession(env, userId, id) {
  // Best-effort: delete the linked PDF first, then KV.
  try { await env.OMR_PDFS.delete(pdfKey(userId, id)) } catch (_) {}
  await env.OMR_SESSIONS.delete(sessionKey(userId, id))
}

async function listSessions(env, userId, limit = 100) {
  const prefix = `${SESSION_PREFIX}${userId}:`
  const list = await env.OMR_SESSIONS.list({ prefix, limit })
  const entries = await Promise.all(
    list.keys.map(async (k) => {
      const raw = await env.OMR_SESSIONS.get(k.name)
      if (!raw) return null
      try {
        const s = JSON.parse(raw)
        return {
          id: s.id,
          filename: s.filename || s.meta?.pdfFilename || s.id,
          savedAt: s.savedAt,
          notes: Array.isArray(s.notes) ? s.notes.length : 0,
          meta: s.meta || null,
        }
      } catch { return null }
    })
  )
  return entries.filter(Boolean).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
}

// ── Router ───────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

    const url = new URL(request.url)
    const path = url.pathname

    // Health check — no auth, no DB hit.
    if (path === '/health' || path === '/') {
      return json({ ok: true, worker: 'omr-worker', at: new Date().toISOString() })
    }

    // Everything else requires auth.
    const auth = await validateAuth(request, env)
    if (!auth.valid) return error(auth.error || 'Unauthorized', 401)
    const { userId } = auth

    // /sessions and /sessions/:id
    const sessionMatch = path.match(/^\/sessions(?:\/([^/]+))?$/)
    if (sessionMatch) {
      const id = sessionMatch[1]
      if (!id) {
        if (request.method !== 'GET') return error('Method not allowed', 405)
        const list = await listSessions(env, userId)
        return json({ sessions: list })
      }

      switch (request.method) {
        case 'GET': {
          const s = await readSession(env, userId, id)
          if (!s) return error('Session not found', 404)
          return json(s)
        }
        case 'PUT': {
          let body
          try { body = await request.json() } catch { return error('Invalid JSON body', 400) }
          if (!body || typeof body !== 'object') return error('Body must be a JSON object', 400)
          const record = await writeSession(env, userId, id, body)
          return json({ ok: true, session: record }, 200)
        }
        case 'DELETE': {
          await deleteSession(env, userId, id)
          return json({ ok: true })
        }
        default:
          return error('Method not allowed', 405)
      }
    }

    // /pdfs/:id
    const pdfMatch = path.match(/^\/pdfs\/([^/]+)$/)
    if (pdfMatch) {
      const id = pdfMatch[1]
      const key = pdfKey(userId, id)

      switch (request.method) {
        case 'PUT': {
          // Read raw body as ArrayBuffer (PDF binary).
          const bytes = await request.arrayBuffer()
          if (!bytes || bytes.byteLength === 0) return error('Empty PDF body', 400)
          await env.OMR_PDFS.put(key, bytes, {
            httpMetadata: { contentType: 'application/pdf' },
          })
          return json({ ok: true, r2Key: key, bytes: bytes.byteLength })
        }
        case 'GET': {
          const obj = await env.OMR_PDFS.get(key)
          if (!obj) return error('PDF not found', 404)
          return new Response(obj.body, {
            headers: {
              ...corsHeaders,
              'Content-Type': obj.httpMetadata?.contentType || 'application/pdf',
              'Content-Length': String(obj.size),
              'Cache-Control': 'private, max-age=3600',
            },
          })
        }
        case 'DELETE': {
          await env.OMR_PDFS.delete(key)
          return json({ ok: true })
        }
        default:
          return error('Method not allowed', 405)
      }
    }

    return error('Not found', 404, { path })
  },
}
