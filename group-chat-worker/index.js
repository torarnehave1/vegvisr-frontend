// Group Chat Worker - D1-backed polling chat API for Hallo Vegvisr

// Generate a short random invite code (8 chars)
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// -- FCM v1 helpers -------------------------------------------------------
let cachedAccessToken = null
let cachedAccessTokenExpiryMs = 0

const base64UrlEncode = (input) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const pemToArrayBuffer = (pem) => {
  const normalized = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

const getAccessToken = async (env) => {
  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY) {
    console.error('Missing FCM v1 credentials')
    return null
  }

  console.log('[FCM] Using project:', env.FCM_PROJECT_ID, 'service account:', env.FCM_CLIENT_EMAIL)

  const nowMs = Date.now()
  if (cachedAccessToken && nowMs < cachedAccessTokenExpiryMs - 30000) {
    console.log('[FCM] Using cached access token')
    return cachedAccessToken
  }

  const now = Math.floor(nowMs / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: env.FCM_CLIENT_EMAIL,
    sub: env.FCM_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    iat: now,
    exp: now + 55 * 60, // 55 minutes
  }

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`

  const privateKeyPem = env.FCM_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')
    ? env.FCM_PRIVATE_KEY
    : `-----BEGIN PRIVATE KEY-----\n${env.FCM_PRIVATE_KEY}\n-----END PRIVATE KEY-----`

  const keyBuffer = pemToArrayBuffer(privateKeyPem.replace(/\\n/g, '\n'))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  )
  const signedJwt = `${unsignedToken}.${base64UrlEncode(signatureBuffer)}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  })

  if (!tokenRes.ok) {
    console.error('FCM token exchange failed:', tokenRes.status, await tokenRes.text())
    return null
  }

  const tokenJson = await tokenRes.json().catch(() => null)
  cachedAccessToken = tokenJson?.access_token || null
  cachedAccessTokenExpiryMs = nowMs + (tokenJson?.expires_in ? tokenJson.expires_in * 1000 : 55 * 60 * 1000)
  return cachedAccessToken
}

// Send FCM push notification via v1 API
async function sendPushNotification(env, tokens, title, body, data = {}) {
  console.log('[FCM] sendPushNotification called with', tokens.length, 'tokens')
  if (!Array.isArray(tokens) || tokens.length === 0) {
    console.log('[FCM] No tokens to send to')
    return
  }

  const accessToken = await getAccessToken(env)
  if (!accessToken) {
    console.error('[FCM] Failed to get access token')
    return
  }
  console.log('[FCM] Got access token, sending to', tokens.length, 'devices')

  const endpoint = `https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`
  const dataStrings = Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)]))

  const sendOne = async (token) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title,
            body,
          },
          data: dataStrings,
          android: { priority: 'HIGH' },
          apns: {
            headers: { 'apns-priority': '10' },
            payload: { aps: { sound: 'default' } },
          },
        },
      }),
    })

    if (!response.ok) {
      console.error('[FCM] Send error:', response.status, await response.text())
    } else {
      console.log('[FCM] Successfully sent to token:', token.substring(0, 20) + '...')
    }
  }

  await Promise.allSettled(tokens.map(sendOne))
  console.log('[FCM] Finished sending to all tokens')
}

// Get FCM tokens for group members (excluding sender)
async function getGroupMemberTokens(env, groupId, excludeUserId) {
  console.log('[FCM] Getting tokens for group:', groupId, 'excluding:', excludeUserId)
  const { results } = await env.CHAT_DB.prepare(
    `SELECT dt.fcm_token
     FROM device_tokens dt
     JOIN group_members gm ON dt.user_id = gm.user_id
     WHERE gm.group_id = ? AND dt.user_id != ?`
  ).bind(groupId, excludeUserId).all()

  console.log('[FCM] Found', results.length, 'tokens for other group members')
  return results.map(r => r.fcm_token)
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-user-phone, x-user-email',
}

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const errorResponse = (message, status = 400) =>
  jsonResponse({ success: false, error: message }, status)

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function validateUser(env, userId, phone, email) {
  if (!env.SMS_WORKER?.fetch) {
    return { ok: false, status: 500, error: 'SMS worker service not configured' }
  }

  const response = await env.SMS_WORKER.fetch(
    'https://sms-gateway/api/auth/user/validate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        phone: phone || undefined,
        email: email || undefined,
      }),
    },
  )

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    return {
      ok: false,
      status: response.status,
      error: data?.error || 'User validation failed',
    }
  }

  const data = await response.json().catch(() => ({}))
  return { ok: true, role: data.role || 'User' }
}

async function ensureMember(env, groupId, userId) {
  const member = await env.CHAT_DB.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  )
    .bind(groupId, userId)
    .first()
  return !!member
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname, searchParams } = url

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
      if (pathname === '/health') {
        return jsonResponse({
          status: 'healthy',
          service: 'group-chat-worker',
          database: 'hallo_vegvisr_chat',
          timestamp: new Date().toISOString(),
        })
      }

      if (pathname === '/groups' && request.method === 'POST') {
        const body = await readJson(request)
        if (!body) {
          return errorResponse('Invalid JSON body')
        }

        const name = (body.name || '').trim()
        const createdBy = (body.created_by || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        const graphId = body.graph_id ? String(body.graph_id).trim() : null

        if (!name) {
          return errorResponse('Group name required')
        }
        if (!createdBy) {
          return errorResponse('created_by required')
        }
        if (!phone) {
          return errorResponse('phone required')
        }

        const auth = await validateUser(env, createdBy, phone, email)
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status)
        }

        const groupId = crypto.randomUUID()
        const createdAt = Date.now()

        await env.CHAT_DB.prepare(
          `INSERT INTO groups (id, name, created_by, graph_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(groupId, name, createdBy, graphId, createdAt, createdAt)
          .run()

        await env.CHAT_DB.prepare(
          `INSERT INTO group_members (group_id, user_id, role, joined_at)
           VALUES (?, ?, ?, ?)`
        )
          .bind(groupId, createdBy, 'owner', createdAt)
          .run()

        return jsonResponse({
          success: true,
          group: {
            id: groupId,
            name,
            created_by: createdBy,
            graph_id: graphId,
            created_at: createdAt,
            updated_at: createdAt,
          },
        }, 201)
      }

      // PUT /groups/{id} - Update group info (owner/admin only)
      const updateGroupMatch = pathname.match(/^\/groups\/([^/]+)$/)
      if (updateGroupMatch && request.method === 'PUT') {
        const groupId = updateGroupMatch[1]
        const body = await readJson(request)
        if (!body) {
          return errorResponse('Invalid JSON body')
        }

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''

        if (!userId || !phone) {
          return errorResponse('user_id and phone required')
        }

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status)
        }

        // Check if user is owner or admin
        const member = await env.CHAT_DB.prepare(
          'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?'
        ).bind(groupId, userId).first()

        if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
          return errorResponse('Only owner or admin can update group', 403)
        }

        // Build update query dynamically based on provided fields
        const updates = []
        const values = []

        if (body.name !== undefined) {
          const name = String(body.name).trim()
          if (name) {
            updates.push('name = ?')
            values.push(name)
          }
        }

        if (body.image_url !== undefined) {
          // Allow null/empty to clear the image
          const imageUrl = body.image_url ? String(body.image_url).trim() : null
          updates.push('image_url = ?')
          values.push(imageUrl)
        }

        if (updates.length === 0) {
          return errorResponse('No fields to update')
        }

        values.push(groupId)
        updates.push('updated_at = ?')
        values.push(Date.now())
        await env.CHAT_DB.prepare(
          `UPDATE groups SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...values).run()

        // Fetch updated group
        const group = await env.CHAT_DB.prepare(
          'SELECT * FROM groups WHERE id = ?'
        ).bind(groupId).first()

        return jsonResponse({ success: true, group })
      }

      if (pathname === '/groups' && request.method === 'GET') {
        const userId = searchParams.get('user_id')
        const phone = searchParams.get('phone') || ''
        const email = searchParams.get('email') || ''
        if (!userId) {
          return errorResponse('user_id required')
        }
        if (!phone) {
          return errorResponse('phone required')
        }

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status)
        }

        const sinceRaw = searchParams.get('since')
        const since = sinceRaw ? Number(sinceRaw) : null
        if (sinceRaw && (Number.isNaN(since) || since < 0)) {
          return errorResponse('Invalid since value')
        }

        let query = `SELECT g.*, gm.role, gm.joined_at
           FROM groups g
           JOIN group_members gm ON g.id = gm.group_id
           WHERE gm.user_id = ?`
        const params = [userId]
        if (since !== null) {
          query += ' AND g.updated_at > ?'
          params.push(since)
        }
        query += ' ORDER BY g.updated_at DESC'

        const { results } = await env.CHAT_DB.prepare(query)
          .bind(...params)
          .all()

        return jsonResponse({ success: true, groups: results })
      }

      const joinMatch = pathname.match(/^\/groups\/([^/]+)\/join$/)
      if (joinMatch && request.method === 'POST') {
        const groupId = joinMatch[1]
        const body = await readJson(request)
        if (!body) {
          return errorResponse('Invalid JSON body')
        }

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        const role = (body.role || 'member').trim()
        if (!userId) {
          return errorResponse('user_id required')
        }
        if (!phone) {
          return errorResponse('phone required')
        }

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status)
        }

        const group = await env.CHAT_DB.prepare('SELECT id FROM groups WHERE id = ?')
          .bind(groupId)
          .first()
        if (!group) {
          return errorResponse('Group not found', 404)
        }

        const joinedAt = Date.now()
        await env.CHAT_DB.prepare(
          `INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at)
           VALUES (?, ?, ?, ?)`
        )
          .bind(groupId, userId, role, joinedAt)
          .run()

        await env.CHAT_DB.prepare(
          'UPDATE groups SET updated_at = ? WHERE id = ?'
        )
          .bind(joinedAt, groupId)
          .run()

        return jsonResponse({ success: true, group_id: groupId, user_id: userId })
      }

      const membersMatch = pathname.match(/^\/groups\/([^/]+)\/members$/)
      if (membersMatch && request.method === 'GET') {
        const groupId = membersMatch[1]
        const userId = searchParams.get('user_id')
        const phone = searchParams.get('phone') || ''
        const email = searchParams.get('email') || ''
        if (!userId) {
          return errorResponse('user_id required')
        }
        if (!phone) {
          return errorResponse('phone required')
        }

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status)
        }

        const isMember = await ensureMember(env, groupId, userId)
        if (!isMember) {
          return errorResponse('Not a group member', 403)
        }

        const { results } = await env.CHAT_DB.prepare(
          `SELECT user_id, role, joined_at
           FROM group_members
           WHERE group_id = ?
           ORDER BY joined_at ASC`
        )
          .bind(groupId)
          .all()

        return jsonResponse({ success: true, members: results })
      }

      const messagesMatch = pathname.match(/^\/groups\/([^/]+)\/messages$/)
      if (messagesMatch && request.method === 'GET') {
        const groupId = messagesMatch[1]
        const userId = searchParams.get('user_id')
        const phone = searchParams.get('phone') || ''
        const email = searchParams.get('email') || ''
        const afterRaw = searchParams.get('after')
        const after = afterRaw ? Number(afterRaw) : 0
        const limitRaw = searchParams.get('limit')
        const latestRaw = searchParams.get('latest')
        const latest = latestRaw === '1' || latestRaw === 'true'
        let limit = limitRaw ? Number(limitRaw) : 50
        if (!userId) {
          return errorResponse('user_id required')
        }
        if (!phone) {
          return errorResponse('phone required')
        }
        if (Number.isNaN(after) || after < 0) {
          return errorResponse('Invalid after value')
        }
        if (Number.isNaN(limit) || limit <= 0) {
          limit = 50
        }
        limit = Math.min(limit, 200)

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status)
        }

        const isMember = await ensureMember(env, groupId, userId)
        if (!isMember) {
          return errorResponse('Not a group member', 403)
        }

        let results
        if (latest) {
          const query = `SELECT id, group_id, user_id, body, created_at,
                  message_type, audio_url, audio_duration_ms,
                  transcript_text, transcript_lang, transcription_status
            FROM group_messages
            WHERE group_id = ?
            ORDER BY id DESC
            LIMIT ?`
          const data = await env.CHAT_DB.prepare(query)
            .bind(groupId, limit)
            .all()
          results = (data.results || []).reverse()
        } else {
          const query = `SELECT id, group_id, user_id, body, created_at,
                  message_type, audio_url, audio_duration_ms,
                  transcript_text, transcript_lang, transcription_status
           FROM group_messages
           WHERE group_id = ? AND id > ?
           ORDER BY id ASC
           LIMIT ?`
          const data = await env.CHAT_DB.prepare(query)
            .bind(groupId, after, limit)
            .all()
          results = data.results || []
        }

        return jsonResponse({ success: true, messages: results })
      }

      if (messagesMatch && request.method === 'POST') {
        const groupId = messagesMatch[1]
        const body = await readJson(request)
        if (!body) {
          return errorResponse('Invalid JSON body')
        }

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        const text = (body.body || '').trim()
        const messageType = (body.message_type || body.type || 'text').trim()
        const audioUrl = body.audio_url ? String(body.audio_url).trim() : ''
        const audioDurationMs = body.audio_duration_ms ?? null
        const transcriptText = body.transcript_text ? String(body.transcript_text) : null
        const transcriptLang = body.transcript_lang ? String(body.transcript_lang) : null
        const transcriptionStatus = body.transcription_status
          ? String(body.transcription_status)
          : (messageType === 'voice' ? 'pending' : null)
        if (!userId) {
          return errorResponse('user_id required')
        }
        if (!phone) {
          return errorResponse('phone required')
        }
        if (messageType === 'voice') {
          if (!audioUrl) {
            return errorResponse('audio_url required for voice messages')
          }
        } else if (!text) {
          return errorResponse('Message body required')
        }

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status)
        }

        const isMember = await ensureMember(env, groupId, userId)
        if (!isMember) {
          return errorResponse('Not a group member', 403)
        }

        const createdAt = Date.now()
        const result = await env.CHAT_DB.prepare(
          `INSERT INTO group_messages (
             group_id, user_id, body, created_at,
             message_type, audio_url, audio_duration_ms,
             transcript_text, transcript_lang, transcription_status
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            groupId,
            userId,
            text,
            createdAt,
            messageType,
            audioUrl || null,
            audioDurationMs,
            transcriptText,
            transcriptLang,
            transcriptionStatus,
          )
          .run()

        await env.CHAT_DB.prepare(
          'UPDATE groups SET updated_at = ? WHERE id = ?'
        )
          .bind(createdAt, groupId)
          .run()

        // Send push notifications only if sender is Superadmin (to avoid notification spam)
        const isSuperadmin = auth.role === 'Superadmin'
        if (isSuperadmin) {
          console.log('[Push] Superadmin sending message, triggering push notifications')
          ctx.waitUntil((async () => {
            try {
              // Get group name for notification
              const group = await env.CHAT_DB.prepare(
                'SELECT name FROM groups WHERE id = ?'
              ).bind(groupId).first()
              const groupName = group?.name || 'Group Chat'

              // Get tokens for other members
              const tokens = await getGroupMemberTokens(env, groupId, userId)
              console.log('[Push] Got', tokens.length, 'tokens to notify')
              if (tokens.length > 0) {
                // Truncate message for notification
                const previewText = messageType === 'voice'
                  ? (transcriptText && transcriptText.trim().isNotEmpty
                    ? transcriptText.trim()
                    : '🎤 Voice message')
                  : text
                const preview =
                  previewText.length > 50 ? previewText.substring(0, 47) + '...' : previewText
                await sendPushNotification(
                  env,
                  tokens,
                  groupName,
                  preview,
                  {
                    group_id: groupId,
                    group_name: groupName,
                    message_id: String(result.meta.last_row_id),
                  }
                )
              }
            } catch (err) {
              console.error('[Push] Error in background task:', err)
            }
          })())
        } else {
          console.log('[Push] User role is', auth.role, '- skipping push notification')
        }

        return jsonResponse({
          success: true,
          message: {
            id: result.meta.last_row_id,
            group_id: groupId,
            user_id: userId,
            body: text,
            created_at: createdAt,
            message_type: messageType,
            audio_url: audioUrl || null,
            audio_duration_ms: audioDurationMs,
            transcript_text: transcriptText,
            transcript_lang: transcriptLang,
            transcription_status: transcriptionStatus,
          },
        }, 201)
      }

      const messageUpdateMatch = pathname.match(/^\/groups\/([^/]+)\/messages\/(\d+)$/)
      if (messageUpdateMatch && request.method === 'PATCH') {
        const groupId = messageUpdateMatch[1]
        const messageId = Number(messageUpdateMatch[2])
        const body = await readJson(request)
        if (!body) {
          return errorResponse('Invalid JSON body')
        }

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        const transcriptText = body.transcript_text ? String(body.transcript_text) : null
        const transcriptLang = body.transcript_lang ? String(body.transcript_lang) : null
        const transcriptionStatus = body.transcription_status
          ? String(body.transcription_status)
          : null

        if (!userId) {
          return errorResponse('user_id required')
        }
        if (!phone) {
          return errorResponse('phone required')
        }
        if (!transcriptText && !transcriptLang && !transcriptionStatus) {
          return errorResponse('No transcript fields provided')
        }

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status)
        }

        const isMember = await ensureMember(env, groupId, userId)
        if (!isMember) {
          return errorResponse('Not a group member', 403)
        }

        const existing = await env.CHAT_DB.prepare(
          `SELECT id FROM group_messages WHERE id = ? AND group_id = ?`
        )
          .bind(messageId, groupId)
          .first()
        if (!existing) {
          return errorResponse('Message not found', 404)
        }

        await env.CHAT_DB.prepare(
          `UPDATE group_messages
           SET transcript_text = COALESCE(?, transcript_text),
               transcript_lang = COALESCE(?, transcript_lang),
               transcription_status = COALESCE(?, transcription_status)
           WHERE id = ? AND group_id = ?`
        )
          .bind(transcriptText, transcriptLang, transcriptionStatus, messageId, groupId)
          .run()

        const updated = await env.CHAT_DB.prepare(
          `SELECT id, group_id, user_id, body, created_at,
                  message_type, audio_url, audio_duration_ms,
                  transcript_text, transcript_lang, transcription_status
           FROM group_messages
           WHERE id = ?`
        )
          .bind(messageId)
          .first()

        return jsonResponse({ success: true, message: updated })
      }

      // POST /groups/{id}/invite - Create invite link (owner/admin only)
      const inviteMatch = pathname.match(/^\/groups\/([^/]+)\/invite$/)
      if (inviteMatch && request.method === 'POST') {
        const groupId = inviteMatch[1]
        const body = await readJson(request)
        if (!body) {
          return errorResponse('Invalid JSON body')
        }

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        const expiresInDays = body.expires_in_days || 7

        if (!userId || !phone) {
          return errorResponse('user_id and phone required')
        }

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status)
        }

        // Check if user is owner or admin
        const member = await env.CHAT_DB.prepare(
          'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?'
        ).bind(groupId, userId).first()

        if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
          return errorResponse('Only owner or admin can create invite links', 403)
        }

        const code = generateInviteCode()
        const createdAt = Date.now()
        const expiresAt = createdAt + (expiresInDays * 24 * 60 * 60 * 1000)

        await env.CHAT_DB.prepare(
          `INSERT INTO invite_codes (code, group_id, created_by, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(code, groupId, userId, createdAt, expiresAt).run()

        return jsonResponse({
          success: true,
          invite: {
            code,
            group_id: groupId,
            invite_link: `https://hallo.vegvisr.org/join/${code}`,
            expires_at: expiresAt,
          },
        }, 201)
      }

      // GET /invite/{code} - Get invite info (no auth required)
      const inviteInfoMatch = pathname.match(/^\/invite\/([^/]+)$/)
      if (inviteInfoMatch && request.method === 'GET') {
        const code = inviteInfoMatch[1]

        const invite = await env.CHAT_DB.prepare(
          `SELECT ic.*, g.name as group_name,
                  (SELECT COUNT(*) FROM group_members WHERE group_id = ic.group_id) as member_count
           FROM invite_codes ic
           JOIN groups g ON ic.group_id = g.id
           WHERE ic.code = ?`
        ).bind(code).first()

        if (!invite) {
          return errorResponse('Invalid invite code', 404)
        }

        if (Date.now() > invite.expires_at) {
          return errorResponse('Invite link has expired', 410)
        }

        return jsonResponse({
          success: true,
          invite: {
            code: invite.code,
            group_id: invite.group_id,
            group_name: invite.group_name,
            member_count: invite.member_count,
            expires_at: invite.expires_at,
          },
        })
      }

      // POST /invite/{code}/join - Join group via invite link
      const inviteJoinMatch = pathname.match(/^\/invite\/([^/]+)\/join$/)
      if (inviteJoinMatch && request.method === 'POST') {
        const code = inviteJoinMatch[1]
        const body = await readJson(request)
        if (!body) {
          return errorResponse('Invalid JSON body')
        }

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''

        if (!userId || !phone) {
          return errorResponse('user_id and phone required')
        }

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status)
        }

        // Get invite and check validity
        const invite = await env.CHAT_DB.prepare(
          `SELECT ic.*, g.name as group_name
           FROM invite_codes ic
           JOIN groups g ON ic.group_id = g.id
           WHERE ic.code = ?`
        ).bind(code).first()

        if (!invite) {
          return errorResponse('Invalid invite code', 404)
        }

        if (Date.now() > invite.expires_at) {
          return errorResponse('Invite link has expired', 410)
        }

        // Check if already a member
        const existingMember = await env.CHAT_DB.prepare(
          'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
        ).bind(invite.group_id, userId).first()

        if (existingMember) {
          return jsonResponse({
            success: true,
            already_member: true,
            group_id: invite.group_id,
            group_name: invite.group_name,
          })
        }

        // Add as member
        const joinedAt = Date.now()
        await env.CHAT_DB.prepare(
          `INSERT INTO group_members (group_id, user_id, role, joined_at)
           VALUES (?, ?, 'member', ?)`
        ).bind(invite.group_id, userId, joinedAt).run()

        // Increment use count
        await env.CHAT_DB.prepare(
          'UPDATE invite_codes SET use_count = use_count + 1 WHERE code = ?'
        ).bind(code).run()

        return jsonResponse({
          success: true,
          joined: true,
          group_id: invite.group_id,
          group_name: invite.group_name,
        })
      }

      // POST /register-device - Register FCM token for push notifications
      if (pathname === '/register-device' && request.method === 'POST') {
        const body = await readJson(request)
        if (!body) {
          return errorResponse('Invalid JSON body')
        }

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        const fcmToken = (body.fcm_token || '').trim()
        const platform = (body.platform || 'android').trim()

        if (!userId || !phone || !fcmToken) {
          return errorResponse('user_id, phone, and fcm_token required')
        }

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status)
        }

        const now = Date.now()
        // Upsert device token
        await env.CHAT_DB.prepare(
          `INSERT INTO device_tokens (user_id, fcm_token, platform, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(fcm_token) DO UPDATE SET
             user_id = excluded.user_id,
             platform = excluded.platform,
             updated_at = excluded.updated_at`
        ).bind(userId, fcmToken, platform, now, now).run()

        return jsonResponse({ success: true, message: 'Device registered' })
      }

      // POST /unregister-device - Remove FCM token
      if (pathname === '/unregister-device' && request.method === 'POST') {
        const body = await readJson(request)
        if (!body) {
          return errorResponse('Invalid JSON body')
        }

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        const fcmToken = (body.fcm_token || '').trim()

        if (!userId || !phone || !fcmToken) {
          return errorResponse('user_id, phone, and fcm_token required')
        }

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status)
        }

        await env.CHAT_DB.prepare(
          'DELETE FROM device_tokens WHERE user_id = ? AND fcm_token = ?'
        ).bind(userId, fcmToken).run()

        return jsonResponse({ success: true, message: 'Device unregistered' })
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders })
    } catch (error) {
      console.error('Group Chat Worker Error:', error)
      return jsonResponse(
        {
          success: false,
          error: 'Internal Server Error',
        },
        500,
      )
    }
  },
}
