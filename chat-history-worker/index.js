import { encryptText, decryptText } from './src/utils/encryption.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-user-email, x-user-role, X-API-Token',
  'Access-Control-Max-Age': '86400'
}

let schemaBootstrapped = false

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const { pathname } = url

    try {
      if (pathname === '/health' && request.method === 'GET') {
        return jsonResponse({
          status: 'healthy',
          worker: env.WORKER_NAME || 'chat-history-worker',
          schemaBootstrapped
        })
      }

      await ensureSchema(env)
      const user = getUserContext(request)

      if (pathname === '/sessions' && request.method === 'POST') {
        return await handleUpsertSession(request, env, user)
      }

      if (pathname === '/sessions' && request.method === 'GET') {
        return await handleListSessions(url, env, user)
      }

      if (pathname.startsWith('/sessions/') && request.method === 'GET') {
        const sessionId = pathname.split('/sessions/')[1]
        return await handleGetSession(sessionId, env, user)
      }

      if (pathname.startsWith('/sessions/') && request.method === 'DELETE') {
        const sessionId = pathname.split('/sessions/')[1]
        return await handleDeleteSession(sessionId, env, user)
      }

      if (pathname === '/messages' && request.method === 'POST') {
        return await handleCreateMessage(request, env, user)
      }

      if (pathname === '/messages' && request.method === 'GET') {
        return await handleListMessages(url, env, user)
      }

      return jsonResponse({ error: 'Not Found', path: pathname }, 404)
    } catch (error) {
      console.error('chat-history-worker error', error)
      return jsonResponse({ error: error.message || 'Internal Server Error' }, 500)
    }
  }
}

async function handleUpsertSession(request, env, user) {
  requireUser(user)
  const body = await parseJSON(request)
  const graphId = body.graphId || null
  const provider = body.provider || 'grok'
  const title = body.title || 'Untitled Session'
  const metadata = body.metadata || {}
  const sessionId = body.sessionId || crypto.randomUUID()

  const statement = `
    INSERT INTO chat_sessions (id, user_id, graph_id, provider, title, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      graph_id = excluded.graph_id,
      provider = excluded.provider,
      title = excluded.title,
      metadata = excluded.metadata,
      updated_at = CURRENT_TIMESTAMP
  `

  await env.DB.prepare(statement)
    .bind(sessionId, user.userId, graphId, provider, title, JSON.stringify(metadata))
    .run()

  const session = await env.DB.prepare('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, user.userId)
    .first()

  return jsonResponse({ session: normalizeSession(session) }, 201)
}

async function handleListSessions(url, env, user) {
  requireUser(user)
  const graphId = url.searchParams.get('graphId') || null
  let query = 'SELECT * FROM chat_sessions WHERE user_id = ?'
  const bindings = [user.userId]

  if (graphId) {
    query += ' AND graph_id = ?'
    bindings.push(graphId)
  }

  query += ' ORDER BY updated_at DESC LIMIT 100'

  const { results } = await env.DB.prepare(query).bind(...bindings).all()
  return jsonResponse({ sessions: results.map(normalizeSession) })
}

async function handleGetSession(sessionId, env, user) {
  requireUser(user)
  if (!sessionId) {
    throw new Error('Session id required')
  }

  const session = await env.DB.prepare('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, user.userId)
    .first()

  if (!session) {
    return jsonResponse({ error: 'Session not found' }, 404)
  }

  return jsonResponse({ session: normalizeSession(session) })
}

async function handleDeleteSession(sessionId, env, user) {
  requireUser(user)
  if (!sessionId) {
    throw new Error('Session id required')
  }

  const ownership = await env.DB.prepare('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, user.userId)
    .first()

  if (!ownership) {
    return jsonResponse({ error: 'Session not found' }, 404)
  }

  await env.DB.prepare('DELETE FROM chat_messages WHERE session_id = ?').bind(sessionId).run()
  await env.DB.prepare('DELETE FROM chat_sessions WHERE id = ?').bind(sessionId).run()

  return jsonResponse({ success: true, sessionId })
}

async function handleCreateMessage(request, env, user) {
  requireUser(user)
  const body = await parseJSON(request)
  const sessionId = body.sessionId
  const role = body.role || 'user'
  const plaintext = body.content
  const providedCiphertext = body.ciphertext
  const providedIv = body.iv
  const providedSalt = body.salt
  const selectionMeta = body.selectionMeta || null

  if (!sessionId) {
    throw new Error('sessionId is required')
  }

  const session = await env.DB.prepare('SELECT id, user_id FROM chat_sessions WHERE id = ?')
    .bind(sessionId)
    .first()

  if (!session || session.user_id !== user.userId) {
    return jsonResponse({ error: 'Session not found' }, 404)
  }

  let encrypted
  if (plaintext) {
    encrypted = await encryptText(plaintext, env.ENCRYPTION_MASTER_KEY)
  } else if (providedCiphertext && providedIv && providedSalt) {
    encrypted = {
      ciphertext: providedCiphertext,
      iv: providedIv,
      salt: providedSalt
    }
  } else {
    throw new Error('Provide plaintext content or ciphertext bundle')
  }

  const messageId = body.messageId || crypto.randomUUID()

  await env.DB.prepare(`
      INSERT INTO chat_messages (id, session_id, user_id, role, ciphertext, iv, salt, selection_meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      messageId,
      sessionId,
      user.userId,
      role,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.salt,
      selectionMeta ? JSON.stringify(selectionMeta) : null
    )
    .run()

  await env.DB.prepare('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(sessionId)
    .run()

  return jsonResponse({
    message: {
      id: messageId,
      sessionId,
      role,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      salt: encrypted.salt,
      selectionMeta,
      createdAt: new Date().toISOString()
    }
  }, 201)
}

async function handleListMessages(url, env, user) {
  requireUser(user)
  const sessionId = url.searchParams.get('sessionId')
  if (!sessionId) {
    throw new Error('sessionId query parameter required')
  }

  const decryptFlag = url.searchParams.get('decrypt') === '1'
  const limit = clampLimit(parseInt(url.searchParams.get('limit') || '50', 10))

  const session = await env.DB.prepare('SELECT id, user_id FROM chat_sessions WHERE id = ?')
    .bind(sessionId)
    .first()

  if (!session || session.user_id !== user.userId) {
    return jsonResponse({ error: 'Session not found' }, 404)
  }

  const { results } = await env.DB.prepare(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
  )
    .bind(sessionId, limit)
    .all()

  const messages = await Promise.all(
    results.map(async (row) => {
      const base = normalizeMessage(row)
      if (decryptFlag) {
        try {
          base.content = await decryptText(
            {
              ciphertext: row.ciphertext,
              iv: row.iv,
              salt: row.salt
            },
            env.ENCRYPTION_MASTER_KEY
          )
        } catch (error) {
          base.content = null
          base.decryptionError = error.message
        }
      }
      return base
    })
  )

  return jsonResponse({ messages })
}

function clampLimit(value) {
  if (!Number.isFinite(value) || value <= 0) return 50
  return Math.min(value, 200)
}

async function ensureSchema(env) {
  if (schemaBootstrapped) return

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      graph_id TEXT,
      provider TEXT,
      title TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id)').run()
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_chat_sessions_graph ON chat_sessions(graph_id)').run()

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      iv TEXT NOT NULL,
      salt TEXT NOT NULL,
      selection_meta TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `).run()

  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at)').run()
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id)').run()

  schemaBootstrapped = true
}

function getUserContext(request) {
  return {
    userId: request.headers.get('x-user-id'),
    email: request.headers.get('x-user-email'),
    role: request.headers.get('x-user-role') || 'User'
  }
}

function requireUser(user) {
  if (!user.userId) {
    throw new Error('x-user-id header required')
  }
}

async function parseJSON(request) {
  const text = await request.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error('Invalid JSON payload')
  }
}

function normalizeSession(row) {
  if (!row) return null
  return {
    id: row.id,
    graphId: row.graph_id,
    provider: row.provider,
    title: row.title,
    metadata: safeParseJSON(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function normalizeMessage(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    ciphertext: row.ciphertext,
    iv: row.iv,
    salt: row.salt,
    selectionMeta: safeParseJSON(row.selection_meta),
    createdAt: row.created_at
  }
}

function safeParseJSON(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch (error) {
    return null
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  })
}
