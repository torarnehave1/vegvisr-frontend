import { encryptText, decryptText } from './src/utils/encryption.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-user-email, x-user-role, X-API-Token',
  'Access-Control-Max-Age': '86400'
}

let schemaBootstrapped = false

export default {
  async fetch(request, env, ctx) {
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
        return await handleUpsertSession(request, env, user, ctx)
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
        return await handleDeleteSession(sessionId, env, user, ctx)
      }

      if (pathname === '/messages' && request.method === 'POST') {
        return await handleCreateMessage(request, env, user)
      }

      if (pathname === '/messages' && request.method === 'GET') {
        return await handleListMessages(url, env, user)
      }

      // Get session counts for multiple graphs (used by GraphPortfolio)
      if (pathname === '/session-counts' && request.method === 'POST') {
        return await handleSessionCounts(request, env, user)
      }

      // Migration endpoint to sync all chat session counts to Knowledge Graph metadata
      // POST /migrate-session-counts (requires Superadmin role)
      if (pathname === '/migrate-session-counts' && request.method === 'POST') {
        return await handleMigrateSessionCounts(env, user)
      }

      // Delete all sessions for a graph (called when graph is deleted)
      // DELETE /sessions-by-graph/:graphId
      if (pathname.startsWith('/sessions-by-graph/') && request.method === 'DELETE') {
        const graphId = pathname.split('/sessions-by-graph/')[1]
        return await handleDeleteSessionsByGraph(graphId, env)
      }

      return jsonResponse({ error: 'Not Found', path: pathname }, 404)
    } catch (error) {
      console.error('chat-history-worker error', error)
      return jsonResponse({ error: error.message || 'Internal Server Error' }, 500)
    }
  }
}

async function handleUpsertSession(request, env, user, ctx) {
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

  // Sync chat session count to Knowledge Graph metadata
  // Use waitUntil to keep worker alive until sync completes
  if (graphId && ctx) {
    ctx.waitUntil(
      syncChatSessionCountToGraph(graphId, env).catch(err => {
        console.error('Failed to sync chat session count:', err)
      })
    )
  }

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

async function handleDeleteSession(sessionId, env, user, ctx) {
  requireUser(user)
  if (!sessionId) {
    throw new Error('Session id required')
  }

  // Get the session to find its graph_id before deleting
  const session = await env.DB.prepare('SELECT id, graph_id FROM chat_sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, user.userId)
    .first()

  if (!session) {
    return jsonResponse({ error: 'Session not found' }, 404)
  }

  const graphId = session.graph_id

  await env.DB.prepare('DELETE FROM chat_messages WHERE session_id = ?').bind(sessionId).run()
  await env.DB.prepare('DELETE FROM chat_sessions WHERE id = ?').bind(sessionId).run()

  // Sync chat session count to Knowledge Graph metadata
  // Use waitUntil to keep worker alive until sync completes
  if (graphId && ctx) {
    ctx.waitUntil(
      syncChatSessionCountToGraph(graphId, env).catch(err => {
        console.error('Failed to sync chat session count after delete:', err)
      })
    )
  }

  return jsonResponse({ success: true, sessionId })
}

/**
 * Delete all chat sessions and messages for a specific graph.
 * Called by Knowledge Graph worker when a graph is deleted.
 * DELETE /sessions-by-graph/:graphId
 * Note: No user auth required - this is called via service binding from KG worker
 */
async function handleDeleteSessionsByGraph(graphId, env) {
  if (!graphId) {
    return jsonResponse({ error: 'Graph ID required' }, 400)
  }

  // Get all session IDs for this graph
  const { results: sessions } = await env.DB.prepare(
    'SELECT id FROM chat_sessions WHERE graph_id = ?'
  ).bind(graphId).all()

  const sessionIds = sessions.map(s => s.id)

  if (sessionIds.length === 0) {
    return jsonResponse({ success: true, deleted: 0, graphId })
  }

  // Delete all messages for these sessions
  const messagePlaceholders = sessionIds.map(() => '?').join(',')
  await env.DB.prepare(
    `DELETE FROM chat_messages WHERE session_id IN (${messagePlaceholders})`
  ).bind(...sessionIds).run()

  // Delete all sessions for this graph
  await env.DB.prepare(
    'DELETE FROM chat_sessions WHERE graph_id = ?'
  ).bind(graphId).run()

  return jsonResponse({
    success: true,
    deleted: sessionIds.length,
    graphId
  })
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

  // Build tool_metadata from any tool-related fields
  const toolMetadata = {}
  if (body.provider) toolMetadata.provider = body.provider
  if (body.usedProffAPI) toolMetadata.usedProffAPI = body.usedProffAPI
  if (body.proffData) toolMetadata.proffData = body.proffData
  if (body.usedSourcesAPI) toolMetadata.usedSourcesAPI = body.usedSourcesAPI
  if (body.sourcesData) toolMetadata.sourcesData = body.sourcesData
  if (body.imageData) toolMetadata.imageData = body.imageData

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

  const hasToolMetadata = Object.keys(toolMetadata).length > 0

  await env.DB.prepare(`
      INSERT INTO chat_messages (id, session_id, user_id, role, ciphertext, iv, salt, selection_meta, tool_metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      messageId,
      sessionId,
      user.userId,
      role,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.salt,
      selectionMeta ? JSON.stringify(selectionMeta) : null,
      hasToolMetadata ? JSON.stringify(toolMetadata) : null
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

/**
 * Get session counts for multiple graph IDs at once
 * Used by GraphPortfolio to display chat session badges efficiently
 * POST /session-counts with body: { graphIds: ['graph_123', 'graph_456', ...] }
 * Returns: { counts: { 'graph_123': 2, 'graph_456': 0, ... } }
 *
 * Note: Counts ALL sessions for each graph (not just current user's sessions)
 * since the badge should show total chat activity on a graph.
 */
async function handleSessionCounts(request, env, user) {
  requireUser(user)
  const body = await parseJSON(request)
  const graphIds = body.graphIds

  if (!Array.isArray(graphIds) || graphIds.length === 0) {
    return jsonResponse({ counts: {} })
  }

  // Limit to prevent abuse (max 100 graphs at once)
  const limitedGraphIds = graphIds.slice(0, 100)

  // Build query with placeholders for all graph IDs
  // Count ALL sessions for each graph, not just current user's
  const placeholders = limitedGraphIds.map(() => '?').join(',')
  const query = `
    SELECT graph_id, COUNT(*) as count
    FROM chat_sessions
    WHERE graph_id IN (${placeholders})
    GROUP BY graph_id
  `

  const { results } = await env.DB.prepare(query)
    .bind(...limitedGraphIds)
    .all()

  // Build counts object, defaulting to 0 for graphs with no sessions
  const counts = {}
  for (const graphId of limitedGraphIds) {
    counts[graphId] = 0
  }
  for (const row of results) {
    if (row.graph_id) {
      counts[row.graph_id] = row.count
    }
  }

  return jsonResponse({ counts })
}

/**
 * Migration endpoint to sync all chat session counts to Knowledge Graph metadata.
 * This is a one-time operation to populate existing graphs.
 * POST /migrate-session-counts (requires Superadmin role)
 */
async function handleMigrateSessionCounts(env, user) {
  requireUser(user)

  // Only allow Superadmin to run migration
  if (user.role !== 'Superadmin') {
    return jsonResponse({ error: 'Superadmin role required' }, 403)
  }

  if (!env.KNOWLEDGE_GRAPH_WORKER) {
    return jsonResponse({ error: 'Knowledge Graph service binding not configured' }, 500)
  }

  // Get all graphs with chat sessions
  const { results } = await env.DB.prepare(`
    SELECT graph_id, COUNT(*) as count
    FROM chat_sessions
    WHERE graph_id IS NOT NULL
    GROUP BY graph_id
  `).all()

  const migrated = []
  const failed = []

  for (const row of results) {
    const graphId = row.graph_id
    const chatSessionCount = row.count

    try {
      // Fetch the current graph data
      const getResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
        `https://knowledge-graph-worker/getknowgraph?id=${encodeURIComponent(graphId)}`,
        { method: 'GET' }
      )

      if (!getResponse.ok) {
        failed.push({ graphId, error: 'Graph not found' })
        continue
      }

      const graphData = await getResponse.json()
      if (!graphData || !graphData.metadata) {
        failed.push({ graphId, error: 'Invalid graph data' })
        continue
      }

      // Update metadata with chat session count
      const updatedGraphData = {
        ...graphData,
        metadata: {
          ...graphData.metadata,
          chatSessionCount
        }
      }

      // Save using saveGraphWithHistory
      const saveResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
        'https://knowledge-graph-worker/saveGraphWithHistory',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: graphId,
            graphData: updatedGraphData,
            override: true
          })
        }
      )

      if (saveResponse.ok) {
        migrated.push({ graphId, chatSessionCount })
      } else {
        const errorText = await saveResponse.text()
        failed.push({ graphId, error: errorText })
      }
    } catch (error) {
      failed.push({ graphId, error: error.message })
    }
  }

  return jsonResponse({
    success: true,
    migrated: migrated.length,
    failed: failed.length,
    details: { migrated, failed }
  })
}

/**
 * Sync the chat session count to the Knowledge Graph metadata.
 * Called after session create/delete to keep the count in sync.
 * This allows GraphPortfolio to display the badge without an extra API call.
 */
async function syncChatSessionCountToGraph(graphId, env) {
  if (!graphId || !env.KNOWLEDGE_GRAPH_WORKER) {
    console.log(`[syncChatSessionCount] Skipping - graphId: ${graphId}, binding available: ${!!env.KNOWLEDGE_GRAPH_WORKER}`)
    return // No graph to sync or no binding available
  }

  try {
    // Count all sessions for this graph
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM chat_sessions WHERE graph_id = ?'
    ).bind(graphId).first()
    const chatSessionCount = countResult?.count || 0
    console.log(`[syncChatSessionCount] Graph ${graphId} has ${chatSessionCount} sessions`)

    // Fetch the current graph data
    const getResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
      `https://knowledge-graph-worker/getknowgraph?id=${encodeURIComponent(graphId)}`,
      { method: 'GET' }
    )

    if (!getResponse.ok) {
      const errorText = await getResponse.text()
      console.error(`[syncChatSessionCount] Failed to fetch graph ${graphId}: ${getResponse.status} - ${errorText}`)
      return
    }

    const graphData = await getResponse.json()
    if (!graphData || !graphData.metadata) {
      console.log(`[syncChatSessionCount] Graph ${graphId} has no metadata, skipping`)
      return
    }

    const oldCount = graphData.metadata.chatSessionCount || 0
    if (oldCount === chatSessionCount) {
      console.log(`[syncChatSessionCount] Graph ${graphId} already has correct count (${chatSessionCount}), skipping save`)
      return
    }

    console.log(`[syncChatSessionCount] Updating graph ${graphId} chatSessionCount: ${oldCount} -> ${chatSessionCount}`)

    // Update metadata with new chat session count
    const updatedGraphData = {
      ...graphData,
      metadata: {
        ...graphData.metadata,
        chatSessionCount
      }
    }

    // Save using saveGraphWithHistory to track changes (increments version)
    const saveResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
      'https://knowledge-graph-worker/saveGraphWithHistory',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: graphId,
          graphData: updatedGraphData,
          override: true
        })
      }
    )

    if (!saveResponse.ok) {
      const errorText = await saveResponse.text()
      console.error(`[syncChatSessionCount] Failed to save graph ${graphId}: ${saveResponse.status} - ${errorText}`)
    } else {
      console.log(`[syncChatSessionCount] Successfully updated graph ${graphId} chatSessionCount to ${chatSessionCount}`)
    }
  } catch (error) {
    console.error('[syncChatSessionCount] Error:', error)
  }
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
      tool_metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )
  `).run()

  // Add tool_metadata column for existing databases
  try {
    await env.DB.prepare('ALTER TABLE chat_messages ADD COLUMN tool_metadata TEXT').run()
  } catch (e) { /* column may already exist */ }

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
  const toolMeta = safeParseJSON(row.tool_metadata) || {}
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    ciphertext: row.ciphertext,
    iv: row.iv,
    salt: row.salt,
    selectionMeta: safeParseJSON(row.selection_meta),
    createdAt: row.created_at,
    // Spread tool_metadata fields to top level for frontend compatibility
    provider: toolMeta.provider || null,
    usedProffAPI: toolMeta.usedProffAPI || false,
    proffData: toolMeta.proffData || null,
    usedSourcesAPI: toolMeta.usedSourcesAPI || false,
    sourcesData: toolMeta.sourcesData || null,
    imageData: toolMeta.imageData || null
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
