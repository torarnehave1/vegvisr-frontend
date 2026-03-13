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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-user-phone, x-user-email, X-File-Name, Range',
  'Access-Control-Expose-Headers': 'Content-Type, Content-Length, Accept-Ranges, Content-Range',
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

const MAX_MEDIA_BYTES = 200 * 1024 * 1024 // 200MB MVP limit

const buildMediaUrl = (request, env, objectKey) => {
  if (env.PUBLIC_MEDIA_BASE_URL) {
    return `${env.PUBLIC_MEDIA_BASE_URL}?key=${encodeURIComponent(objectKey)}`
  }
  const url = new URL(request.url)
  return `${url.origin}/media?key=${encodeURIComponent(objectKey)}`
}

const guessExtensionFromFileName = (fileName) => {
  if (!fileName) return ''
  const lower = String(fileName).toLowerCase()
  const dotIndex = lower.lastIndexOf('.')
  if (dotIndex === -1) return ''
  const ext = lower.substring(dotIndex)
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.webm', '.m4v']
  return allowed.includes(ext) ? ext : ''
}

const defaultContentTypeForExtension = (ext) => {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.mp4':
    case '.m4v':
      return 'video/mp4'
    case '.mov':
      return 'video/quicktime'
    case '.webm':
      return 'video/webm'
    default:
      return 'application/octet-stream'
  }
}

const isSupportedMediaType = (contentType, ext) => {
  const ct = (contentType || '').toLowerCase().split(';')[0].trim()
  if (ct.startsWith('image/')) return true
  if (ct.startsWith('video/')) return true
  if (ext) {
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.webm', '.m4v'].includes(ext)
  }
  return false
}

const handleMediaUpload = async (request, env, groupId, searchParams) => {
  const userId = (searchParams.get('user_id') || '').trim()
  const phone = (searchParams.get('phone') || '').trim()
  const email = (searchParams.get('email') || '').trim()

  if (!userId) return errorResponse('user_id required')
  if (!phone) return errorResponse('phone required')

  const auth = await validateUser(env, userId, phone, email)
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status)
  }

  const isMember = await ensureMember(env, groupId, userId)
  if (!isMember) {
    return errorResponse('Not a group member', 403)
  }

  if (!env.CHAT_MEDIA) {
    return errorResponse('CHAT_MEDIA bucket not configured', 500)
  }

  const fileName = request.headers.get('X-File-Name') || 'upload'
  const providedContentType = request.headers.get('Content-Type') || ''
  const ext = guessExtensionFromFileName(fileName)
  const contentType = (providedContentType || defaultContentTypeForExtension(ext))

  if (!isSupportedMediaType(contentType, ext)) {
    return errorResponse('Unsupported media type. Only image/* and video/* are allowed.', 400)
  }

  const contentLengthHeader = request.headers.get('Content-Length')
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null
  if (contentLength !== null && (!Number.isFinite(contentLength) || contentLength < 0)) {
    return errorResponse('Invalid Content-Length header', 400)
  }
  if (contentLength !== null && contentLength > MAX_MEDIA_BYTES) {
    return errorResponse(`Media too large. Max ${MAX_MEDIA_BYTES} bytes`, 413)
  }

  if (!request.body) {
    return errorResponse('Missing request body', 400)
  }

  const objectId = crypto.randomUUID()
  const safeExt = ext || (contentType.toLowerCase().startsWith('image/') ? '.jpg' : '.mp4')
  const objectKey = `media/${groupId}/${objectId}${safeExt}`

  let uploadedBytes = 0
  const limiter = new TransformStream({
    transform(chunk, controller) {
      const size = chunk?.byteLength ?? 0
      uploadedBytes += size
      if (uploadedBytes > MAX_MEDIA_BYTES) {
        throw new Error('Media too large')
      }
      controller.enqueue(chunk)
    },
  })

  const streamToPut = (contentLength === null)
    ? request.body.pipeThrough(limiter)
    : request.body

  try {
    await env.CHAT_MEDIA.put(objectKey, streamToPut, {
      httpMetadata: {
        contentType,
      },
      customMetadata: {
        groupId: String(groupId),
        userId: String(userId),
        originalFileName: String(fileName),
        uploadedAt: String(Date.now()),
      },
    })
  } catch (err) {
    const message = String(err?.message || err)
    if (message.toLowerCase().includes('too large')) {
      return errorResponse(`Media too large. Max ${MAX_MEDIA_BYTES} bytes`, 413)
    }
    throw err
  }

  return jsonResponse({
    success: true,
    objectKey,
    mediaUrl: buildMediaUrl(request, env, objectKey),
    size: (contentLength !== null ? contentLength : uploadedBytes),
    contentType,
  })
}

const handleMediaFetch = async (request, env, searchParams) => {
  const objectKey = searchParams.get('key')
  if (!objectKey) {
    return errorResponse('Missing required key parameter', 400)
  }
  if (!env.CHAT_MEDIA) {
    return errorResponse('CHAT_MEDIA bucket not configured', 500)
  }

  const isHead = request.method === 'HEAD'

  // Use HEAD metadata to avoid downloading large objects just to get size/type.
  const meta = await env.CHAT_MEDIA.head(objectKey)
  if (!meta) {
    return errorResponse('Media not found', 404)
  }
  const totalSize = meta.size
  const contentType = meta.httpMetadata?.contentType || 'application/octet-stream'

  const rangeHeader = request.headers.get('Range')

  // Defaults (no range)
  let responseStatus = 200
  let offset = 0
  let length = totalSize
  let extraHeaders = {}

  if (rangeHeader) {
    // Support common single-range patterns:
    // - bytes=START-END
    // - bytes=START-
    // - bytes=-SUFFIX_LEN (fetch last N bytes; important for MP4 moov-at-end)
    const explicitMatch = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader)
    const suffixMatch = /^bytes=-(\d+)$/.exec(rangeHeader)

    let start = null
    let end = null

    if (explicitMatch) {
      start = Number(explicitMatch[1])
      end = explicitMatch[2] ? Number(explicitMatch[2]) : null
      const safeEnd = end !== null ? Math.min(end, totalSize - 1) : totalSize - 1
      if (start >= totalSize || start < 0 || safeEnd < start) {
        return new Response(null, {
          status: 416,
          headers: {
            ...corsHeaders,
            'Content-Range': `bytes */${totalSize}`,
            'Accept-Ranges': 'bytes',
          },
        })
      }
      offset = start
      length = safeEnd - start + 1
      responseStatus = 206
      extraHeaders = {
        'Content-Range': `bytes ${start}-${safeEnd}/${totalSize}`,
        'Content-Length': String(length),
        'Accept-Ranges': 'bytes',
      }
    } else if (suffixMatch) {
      const suffixLen = Number(suffixMatch[1])
      if (!Number.isFinite(suffixLen) || suffixLen <= 0) {
        return new Response(null, {
          status: 416,
          headers: {
            ...corsHeaders,
            'Content-Range': `bytes */${totalSize}`,
            'Accept-Ranges': 'bytes',
          },
        })
      }
      const safeLen = Math.min(suffixLen, totalSize)
      const startPos = Math.max(totalSize - safeLen, 0)
      const endPos = totalSize - 1
      offset = startPos
      length = endPos - startPos + 1
      responseStatus = 206
      extraHeaders = {
        'Content-Range': `bytes ${startPos}-${endPos}/${totalSize}`,
        'Content-Length': String(length),
        'Accept-Ranges': 'bytes',
      }
    }
  }

  // HEAD requests should return headers only (no body), but with correct length/range metadata.
  if (isHead) {
    return new Response(null, {
      status: responseStatus,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Length': String(responseStatus === 206 ? length : totalSize),
        'Accept-Ranges': 'bytes',
        ...extraHeaders,
      },
    })
  }

  const mediaObject = (responseStatus === 206)
    ? await env.CHAT_MEDIA.get(objectKey, { range: { offset, length } })
    : await env.CHAT_MEDIA.get(objectKey)

  if (!mediaObject) {
    return errorResponse('Media not found', 404)
  }

  return new Response(mediaObject.body, {
    status: responseStatus,
    headers: {
      ...corsHeaders,
      'Content-Type': contentType,
      'Content-Length': String(responseStatus === 206 ? length : totalSize),
      'Accept-Ranges': 'bytes',
      ...extraHeaders,
    },
  })
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

      if (pathname === '/media' && (request.method === 'GET' || request.method === 'HEAD')) {
        const response = await handleMediaFetch(request, env, searchParams)
        if (request.method === 'HEAD') {
          return new Response(null, { status: response.status, headers: response.headers })
        }
        return response
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

        updates.push('updated_at = ?')
        values.push(Date.now())
        values.push(groupId)
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

        // Superadmins can request archived groups with include_archived=1
        const includeArchived = searchParams.get('include_archived') === '1'
        const isSuperAdmin = auth.role === 'Superadmin'

        let query = `SELECT g.*, gm.role, gm.joined_at
           FROM groups g
           JOIN group_members gm ON g.id = gm.group_id
           WHERE gm.user_id = ?`
        const params = [userId]

        // Filter out archived groups unless superadmin requests them
        if (!(includeArchived && isSuperAdmin)) {
          query += ' AND (g.archived_at IS NULL OR g.archived_at = 0)'
        }

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

      // POST /groups/{id}/archive - Soft-delete a group (superadmin only)
      const archiveMatch = pathname.match(/^\/groups\/([^/]+)\/archive$/)
      if (archiveMatch && request.method === 'POST') {
        const groupId = archiveMatch[1]
        const body = await readJson(request)
        if (!body) return errorResponse('Invalid JSON body')

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)
        if (auth.role !== 'Superadmin') {
          return errorResponse('Only superadmin can archive groups', 403)
        }

        await env.CHAT_DB.prepare(
          'UPDATE groups SET archived_at = ?, archived_by = ? WHERE id = ?'
        ).bind(Date.now(), userId, groupId).run()

        return jsonResponse({ success: true })
      }

      // POST /groups/{id}/restore - Restore an archived group (superadmin only)
      const restoreMatch = pathname.match(/^\/groups\/([^/]+)\/restore$/)
      if (restoreMatch && request.method === 'POST') {
        const groupId = restoreMatch[1]
        const body = await readJson(request)
        if (!body) return errorResponse('Invalid JSON body')

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)
        if (auth.role !== 'Superadmin') {
          return errorResponse('Only superadmin can restore groups', 403)
        }

        await env.CHAT_DB.prepare(
          'UPDATE groups SET archived_at = NULL, archived_by = NULL WHERE id = ?'
        ).bind(groupId).run()

        return jsonResponse({ success: true })
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
        const beforeRaw = searchParams.get('before')
        const before = beforeRaw ? Number(beforeRaw) : 0
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
        if (Number.isNaN(before) || before < 0) {
          return errorResponse('Invalid before value')
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
          // Cursor-based paging: use `before=<id>` to fetch older messages.
          // Implementation fetches (limit+1) rows to compute has_more.
          const pageSize = limit
          const fetchLimit = Math.min(pageSize + 1, 201)
          const baseSelect = `SELECT id, group_id, user_id, body, created_at,
                  message_type, audio_url, audio_duration_ms,
                  transcript_text, transcript_lang, transcription_status,
                  media_url, media_object_key, media_content_type, media_size,
                  video_thumbnail_url, video_duration_ms,
                  sender_avatar_url, reply_to_id
            FROM group_messages`

          const where = before > 0
            ? ` WHERE group_id = ? AND id < ?`
            : ` WHERE group_id = ?`

          const query = `${baseSelect}${where}
            ORDER BY id DESC
            LIMIT ?`

          const stmt = env.CHAT_DB.prepare(query)
          const data = before > 0
            ? await stmt.bind(groupId, before, fetchLimit).all()
            : await stmt.bind(groupId, fetchLimit).all()

          const desc = data.results || []
          const hasMore = desc.length > pageSize
          const sliceDesc = hasMore ? desc.slice(0, pageSize) : desc
          results = sliceDesc.reverse()

          const nextBefore = results.length > 0 ? results[0].id : null
          return jsonResponse({
            success: true,
            messages: results,
            paging: {
              has_more: hasMore,
              next_before: nextBefore,
            },
          })
        } else {
          const query = `SELECT id, group_id, user_id, body, created_at,
                  message_type, audio_url, audio_duration_ms,
                  transcript_text, transcript_lang, transcription_status,
                  media_url, media_object_key, media_content_type, media_size,
                  video_thumbnail_url, video_duration_ms,
                  sender_avatar_url, reply_to_id
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

      const mediaUploadMatch = pathname.match(/^\/groups\/([^/]+)\/media$/)
      if (mediaUploadMatch && request.method === 'POST') {
        const groupId = mediaUploadMatch[1]
        return handleMediaUpload(request, env, groupId, searchParams)
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
        const mediaUrl = body.media_url ? String(body.media_url).trim() : ''
        const mediaObjectKey = body.media_object_key ? String(body.media_object_key).trim() : ''
        const mediaContentType = body.media_content_type
          ? String(body.media_content_type).trim()
          : null
        const mediaSize = body.media_size ?? null
        const videoThumbnailUrl = body.video_thumbnail_url
          ? String(body.video_thumbnail_url).trim()
          : ''
        const videoDurationMs = body.video_duration_ms ?? null
        const transcriptionStatus = body.transcription_status
          ? String(body.transcription_status)
          : (messageType === 'voice' ? 'pending' : null)
        const replyToId = body.reply_to_id ? Number(body.reply_to_id) : null
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
        } else if (messageType === 'image' || messageType === 'video') {
          if (!mediaUrl) {
            return errorResponse('media_url required for image/video messages')
          }
          if (messageType === 'video') {
            if (videoDurationMs !== null) {
              const n = Number(videoDurationMs)
              if (Number.isNaN(n) || n < 0) {
                return errorResponse('video_duration_ms must be a non-negative number')
              }
            }
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
        const storedBody = (messageType === 'image' || messageType === 'video') ? (text || '') : text
        const result = await env.CHAT_DB.prepare(
          `INSERT INTO group_messages (
             group_id, user_id, body, created_at,
             message_type, audio_url, audio_duration_ms,
             transcript_text, transcript_lang, transcription_status,
             media_url, media_object_key, media_content_type, media_size,
             video_thumbnail_url, video_duration_ms, reply_to_id
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            groupId,
            userId,
            storedBody,
            createdAt,
            messageType,
            audioUrl || null,
            audioDurationMs,
            transcriptText,
            transcriptLang,
            transcriptionStatus,
            mediaUrl || null,
            mediaObjectKey || null,
            mediaContentType,
            mediaSize,
            (messageType === 'video' ? (videoThumbnailUrl || null) : null),
            (messageType === 'video' ? (videoDurationMs ?? null) : null),
            replyToId,
          )
          .run()

        await env.CHAT_DB.prepare(
          'UPDATE groups SET updated_at = ? WHERE id = ?'
        )
          .bind(createdAt, groupId)
          .run()

        // Check for bot @mentions and trigger bot responses in background
        const botUserId = userId.startsWith('bot:') ? userId : null
        if (!botUserId && storedBody && env.AGENT_WORKER) {
          const botMentions = storedBody.match(/@([a-z0-9_-]+)/g) || []
          if (botMentions.length > 0) {
            const usernames = botMentions.map(m => m.replace('@', ''))
            ctx.waitUntil((async () => {
              try {
                // Find matching bots in this group
                const placeholders = usernames.map(() => '?').join(',')
                const bots = await env.CHAT_DB.prepare(
                  `SELECT cb.* FROM group_bot_members gbm
                   JOIN chat_bots cb ON gbm.bot_id = cb.id
                   WHERE gbm.group_id = ? AND cb.username IN (${placeholders}) AND cb.is_active = 1`
                ).bind(groupId, ...usernames).all()

                if (bots.results && bots.results.length > 0) {
                  // Fetch recent messages for context
                  const recentMsgs = await env.CHAT_DB.prepare(
                    `SELECT id, group_id, user_id, body, created_at, message_type,
                            transcript_text, transcript_lang
                     FROM group_messages WHERE group_id = ?
                     ORDER BY id DESC LIMIT 20`
                  ).bind(groupId).all()

                  const group = await env.CHAT_DB.prepare(
                    'SELECT name FROM groups WHERE id = ?'
                  ).bind(groupId).first()

                  for (const bot of bots.results) {
                    console.log(`[Bot] Triggering @${bot.username} in group ${groupId}`)
                    await env.AGENT_WORKER.fetch('https://agent-worker/bot-respond', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        bot: bot,
                        group_id: groupId,
                        group_name: group?.name || 'Unknown',
                        trigger_message: {
                          id: result.meta.last_row_id,
                          user_id: userId,
                          body: storedBody,
                          created_at: createdAt,
                        },
                        recent_messages: (recentMsgs.results || []).reverse(),
                      }),
                    })
                  }
                }
              } catch (err) {
                console.error('[Bot] Error triggering bot:', err)
              }
            })())
          }
        }

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
                  : (messageType === 'image'
                    ? '📷 Photo'
                    : (messageType === 'video'
                      ? '🎬 Video'
                      : storedBody
                    )
                  )
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
            body: storedBody,
            created_at: createdAt,
            message_type: messageType,
            audio_url: audioUrl || null,
            audio_duration_ms: audioDurationMs,
            transcript_text: transcriptText,
            transcript_lang: transcriptLang,
            transcription_status: transcriptionStatus,
            media_url: mediaUrl || null,
            media_object_key: mediaObjectKey || null,
            media_content_type: mediaContentType,
            media_size: mediaSize,
            video_thumbnail_url: (messageType === 'video' ? (videoThumbnailUrl || null) : null),
            video_duration_ms: (messageType === 'video' ? (videoDurationMs ?? null) : null),
            reply_to_id: replyToId,
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
        const newBody = typeof body.body === 'string' ? body.body.trim() : null
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
        if (!newBody && !transcriptText && !transcriptLang && !transcriptionStatus) {
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
           SET body = COALESCE(?, body),
               transcript_text = COALESCE(?, transcript_text),
               transcript_lang = COALESCE(?, transcript_lang),
               transcription_status = COALESCE(?, transcription_status)
           WHERE id = ? AND group_id = ?`
        )
          .bind(newBody, transcriptText, transcriptLang, transcriptionStatus, messageId, groupId)
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

      if (messageUpdateMatch && request.method === 'DELETE') {
        const groupId = messageUpdateMatch[1]
        const messageId = Number(messageUpdateMatch[2])
        const userId = (searchParams.get('user_id') || '').trim()
        const phone = (searchParams.get('phone') || '').trim()
        const email = (searchParams.get('email') || '').trim()

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

        const existing = await env.CHAT_DB.prepare(
          `SELECT id, group_id, user_id, message_type, media_object_key
           FROM group_messages
           WHERE id = ? AND group_id = ?`
        )
          .bind(messageId, groupId)
          .first()

        if (!existing) {
          return errorResponse('Message not found', 404)
        }

        let canDelete = String(existing.user_id) === String(userId)
        if (!canDelete) {
          const member = await env.CHAT_DB.prepare(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?'
          )
            .bind(groupId, userId)
            .first()
          const groupRole = member?.role || ''
          if (groupRole === 'owner' || groupRole === 'admin') {
            canDelete = true
          }
        }
        if (!canDelete && (auth.role === 'Admin' || auth.role === 'Superadmin')) {
          canDelete = true
        }
        if (!canDelete) {
          return errorResponse('Not allowed to delete this message', 403)
        }

        // Best-effort cleanup of uploaded media from R2.
        const objectKey = existing.media_object_key ? String(existing.media_object_key) : ''
        if (objectKey && env.CHAT_MEDIA) {
          ctx.waitUntil((async () => {
            try {
              await env.CHAT_MEDIA.delete(objectKey)
            } catch (err) {
              console.error('Failed to delete media object:', objectKey, err)
            }
          })())
        }

        await env.CHAT_DB.prepare(
          'DELETE FROM group_messages WHERE id = ? AND group_id = ?'
        )
          .bind(messageId, groupId)
          .run()

        await env.CHAT_DB.prepare(
          'UPDATE groups SET updated_at = ? WHERE id = ?'
        )
          .bind(Date.now(), groupId)
          .run()

        return jsonResponse({
          success: true,
          deleted: {
            id: messageId,
            group_id: groupId,
          },
        })
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

      // ── Polls ──────────────────────────────────────────────────────

      // POST /groups/:id/polls — Create a poll (sends a 'poll' message)
      const pollCreateMatch = pathname.match(/^\/groups\/([^/]+)\/polls$/)
      if (pollCreateMatch && request.method === 'POST') {
        const groupId = pollCreateMatch[1]
        const body = await readJson(request)
        if (!body) return errorResponse('Invalid JSON body')

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        const question = (body.question || '').trim()
        const options = body.options // should be array of strings

        if (!userId || !phone) return errorResponse('user_id and phone required')
        if (!question) return errorResponse('question required')
        if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
          return errorResponse('options must be an array of 2-6 strings')
        }
        const cleanOptions = options.map(o => String(o).trim()).filter(Boolean)
        if (cleanOptions.length < 2) return errorResponse('At least 2 non-empty options required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)

        const isMember = await ensureMember(env, groupId, userId)
        if (!isMember) return errorResponse('Not a group member', 403)

        const createdAt = Date.now()
        const pollId = crypto.randomUUID()

        // Insert a message of type 'poll' — body contains poll_id::question for lookup
        const msgResult = await env.CHAT_DB.prepare(
          `INSERT INTO group_messages (group_id, user_id, body, created_at, message_type)
           VALUES (?, ?, ?, ?, 'poll')`
        ).bind(groupId, userId, `poll::${pollId}::${question}`, createdAt).run()

        const messageId = msgResult.meta.last_row_id

        // Insert the poll record
        await env.CHAT_DB.prepare(
          `INSERT INTO polls (id, group_id, message_id, question, options, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(pollId, groupId, messageId, question, JSON.stringify(cleanOptions), userId, createdAt).run()

        // Update group timestamp
        await env.CHAT_DB.prepare('UPDATE groups SET updated_at = ? WHERE id = ?')
          .bind(createdAt, groupId).run()

        return jsonResponse({
          success: true,
          poll: {
            id: pollId,
            message_id: messageId,
            group_id: groupId,
            question,
            options: cleanOptions,
            created_by: userId,
            created_at: createdAt,
            votes: {},
            total_votes: 0,
            my_vote: null,
          },
        })
      }

      // POST /polls/:id/vote — Vote on a poll
      const pollVoteMatch = pathname.match(/^\/polls\/([^/]+)\/vote$/)
      if (pollVoteMatch && request.method === 'POST') {
        const pollId = pollVoteMatch[1]
        const body = await readJson(request)
        if (!body) return errorResponse('Invalid JSON body')

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        const optionIndex = body.option_index

        if (!userId || !phone) return errorResponse('user_id and phone required')
        if (optionIndex === undefined || optionIndex === null) return errorResponse('option_index required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)

        // Get the poll
        const poll = await env.CHAT_DB.prepare('SELECT * FROM polls WHERE id = ?').bind(pollId).first()
        if (!poll) return errorResponse('Poll not found', 404)
        if (poll.closed_at) return errorResponse('Poll is closed')

        const options = JSON.parse(poll.options)
        const idx = Number(optionIndex)
        if (idx < 0 || idx >= options.length) return errorResponse('Invalid option_index')

        const isMember = await ensureMember(env, poll.group_id, userId)
        if (!isMember) return errorResponse('Not a group member', 403)

        // Upsert vote (replace if already voted)
        await env.CHAT_DB.prepare(
          `INSERT INTO poll_votes (poll_id, user_id, option_index, voted_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (poll_id, user_id) DO UPDATE SET option_index = ?, voted_at = ?`
        ).bind(pollId, userId, idx, Date.now(), idx, Date.now()).run()

        // Return updated results
        const votes = await env.CHAT_DB.prepare(
          'SELECT option_index, COUNT(*) as cnt FROM poll_votes WHERE poll_id = ? GROUP BY option_index'
        ).bind(pollId).all()

        const voteCounts = {}
        let totalVotes = 0
        for (const row of (votes.results || [])) {
          voteCounts[row.option_index] = row.cnt
          totalVotes += row.cnt
        }

        return jsonResponse({
          success: true,
          poll_id: pollId,
          my_vote: idx,
          votes: voteCounts,
          total_votes: totalVotes,
        })
      }

      // GET /polls/:id — Get poll with results
      const pollGetMatch = pathname.match(/^\/polls\/([^/]+)$/)
      if (pollGetMatch && request.method === 'GET') {
        const pollId = pollGetMatch[1]
        const userId = searchParams.get('user_id')
        const phone = searchParams.get('phone') || ''
        const email = searchParams.get('email') || ''
        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)

        const poll = await env.CHAT_DB.prepare('SELECT * FROM polls WHERE id = ?').bind(pollId).first()
        if (!poll) return errorResponse('Poll not found', 404)

        const isMember = await ensureMember(env, poll.group_id, userId)
        if (!isMember) return errorResponse('Not a group member', 403)

        const options = JSON.parse(poll.options)

        // Get vote counts
        const votes = await env.CHAT_DB.prepare(
          'SELECT option_index, COUNT(*) as cnt FROM poll_votes WHERE poll_id = ? GROUP BY option_index'
        ).bind(pollId).all()

        const voteCounts = {}
        let totalVotes = 0
        for (const row of (votes.results || [])) {
          voteCounts[row.option_index] = row.cnt
          totalVotes += row.cnt
        }

        // Get current user's vote
        const myVote = await env.CHAT_DB.prepare(
          'SELECT option_index FROM poll_votes WHERE poll_id = ? AND user_id = ?'
        ).bind(pollId, userId).first()

        return jsonResponse({
          success: true,
          poll: {
            id: poll.id,
            message_id: poll.message_id,
            group_id: poll.group_id,
            question: poll.question,
            options,
            created_by: poll.created_by,
            created_at: poll.created_at,
            closed_at: poll.closed_at,
            votes: voteCounts,
            total_votes: totalVotes,
            my_vote: myVote ? myVote.option_index : null,
          },
        })
      }

      // GET /groups/:id/polls/unanswered — Count of polls user hasn't voted on
      const pollUnansweredMatch = pathname.match(/^\/groups\/([^/]+)\/polls\/unanswered$/)
      if (pollUnansweredMatch && request.method === 'GET') {
        const groupId = pollUnansweredMatch[1]
        const userId = searchParams.get('user_id')
        const phone = searchParams.get('phone') || ''
        const email = searchParams.get('email') || ''
        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)

        const isMember = await ensureMember(env, groupId, userId)
        if (!isMember) return errorResponse('Not a group member', 403)

        const result = await env.CHAT_DB.prepare(
          `SELECT COUNT(*) as count FROM polls p
           WHERE p.group_id = ? AND p.closed_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM poll_votes pv WHERE pv.poll_id = p.id AND pv.user_id = ?
           )`
        ).bind(groupId, userId).first()

        return jsonResponse({
          success: true,
          group_id: groupId,
          unanswered_count: result?.count || 0,
        })
      }

      // POST /polls/:id/close — Close a poll (creator or superadmin)
      const pollCloseMatch = pathname.match(/^\/polls\/([^/]+)\/close$/)
      if (pollCloseMatch && request.method === 'POST') {
        const pollId = pollCloseMatch[1]
        const body = await readJson(request)
        if (!body) return errorResponse('Invalid JSON body')

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)

        const poll = await env.CHAT_DB.prepare('SELECT * FROM polls WHERE id = ?').bind(pollId).first()
        if (!poll) return errorResponse('Poll not found', 404)
        if (poll.closed_at) return errorResponse('Poll already closed')

        // Only creator or superadmin can close
        if (poll.created_by !== userId && auth.role !== 'Superadmin') {
          return errorResponse('Only poll creator or Superadmin can close a poll', 403)
        }

        await env.CHAT_DB.prepare(
          'UPDATE polls SET closed_at = ? WHERE id = ?'
        ).bind(Date.now(), pollId).run()

        return jsonResponse({ success: true, poll_id: pollId, closed: true })
      }

      // ── Reactions ────────────────────────────────────────────────────

      const VALID_REACTIONS = ['thumbs_up', 'heart', 'smile']

      // POST /messages/:id/reactions — Toggle a reaction on a message
      const reactionMatch = pathname.match(/^\/messages\/(\d+)\/reactions$/)
      if (reactionMatch && request.method === 'POST') {
        const messageId = Number(reactionMatch[1])
        const body = await readJson(request)
        if (!body) return errorResponse('Invalid JSON body')

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        const reaction = (body.reaction || '').trim()

        if (!userId || !phone) return errorResponse('user_id and phone required')
        if (!VALID_REACTIONS.includes(reaction)) {
          return errorResponse('reaction must be one of: thumbs_up, heart, smile')
        }

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)

        // Verify message exists and get group_id
        const msg = await env.CHAT_DB.prepare(
          'SELECT group_id FROM group_messages WHERE id = ?'
        ).bind(messageId).first()
        if (!msg) return errorResponse('Message not found', 404)

        const isMember = await ensureMember(env, msg.group_id, userId)
        if (!isMember) return errorResponse('Not a group member', 403)

        // Toggle: if already reacted, remove; otherwise add
        const existing = await env.CHAT_DB.prepare(
          'SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?'
        ).bind(messageId, userId, reaction).first()

        if (existing) {
          await env.CHAT_DB.prepare(
            'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?'
          ).bind(messageId, userId, reaction).run()
        } else {
          await env.CHAT_DB.prepare(
            'INSERT INTO message_reactions (message_id, user_id, reaction, created_at) VALUES (?, ?, ?, ?)'
          ).bind(messageId, userId, reaction, Date.now()).run()
        }

        // Return updated counts for this message
        const counts = await env.CHAT_DB.prepare(
          'SELECT reaction, COUNT(*) as cnt FROM message_reactions WHERE message_id = ? GROUP BY reaction'
        ).bind(messageId).all()

        const reactionCounts = {}
        for (const r of (counts.results || [])) {
          reactionCounts[r.reaction] = r.cnt
        }

        // Get user's active reactions
        const myReactions = await env.CHAT_DB.prepare(
          'SELECT reaction FROM message_reactions WHERE message_id = ? AND user_id = ?'
        ).bind(messageId, userId).all()
        const myList = (myReactions.results || []).map(r => r.reaction)

        return jsonResponse({
          success: true,
          message_id: messageId,
          reactions: reactionCounts,
          my_reactions: myList,
          toggled: reaction,
          added: !existing,
        })
      }

      // GET /groups/:id/reactions — Batch-fetch reactions for recent messages
      const groupReactionsMatch = pathname.match(/^\/groups\/([^/]+)\/reactions$/)
      if (groupReactionsMatch && request.method === 'GET') {
        const groupId = groupReactionsMatch[1]
        const userId = searchParams.get('user_id')
        const phone = searchParams.get('phone') || ''
        const email = searchParams.get('email') || ''
        const messageIds = searchParams.get('message_ids') // comma-separated

        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)

        const isMember = await ensureMember(env, groupId, userId)
        if (!isMember) return errorResponse('Not a group member', 403)

        if (!messageIds) return jsonResponse({ success: true, reactions: {} })

        const ids = messageIds.split(',').map(Number).filter(n => n > 0).slice(0, 200)
        if (ids.length === 0) return jsonResponse({ success: true, reactions: {} })

        const placeholders = ids.map(() => '?').join(',')

        // Get all reaction counts
        const allCounts = await env.CHAT_DB.prepare(
          `SELECT message_id, reaction, COUNT(*) as cnt
           FROM message_reactions WHERE message_id IN (${placeholders})
           GROUP BY message_id, reaction`
        ).bind(...ids).all()

        // Get user's own reactions
        const myCounts = await env.CHAT_DB.prepare(
          `SELECT message_id, reaction
           FROM message_reactions WHERE message_id IN (${placeholders}) AND user_id = ?`
        ).bind(...ids, userId).all()

        // Build response: { [messageId]: { counts: {reaction: n}, mine: [reaction] } }
        const result = {}
        for (const row of (allCounts.results || [])) {
          if (!result[row.message_id]) result[row.message_id] = { counts: {}, mine: [] }
          result[row.message_id].counts[row.reaction] = row.cnt
        }
        for (const row of (myCounts.results || [])) {
          if (!result[row.message_id]) result[row.message_id] = { counts: {}, mine: [] }
          result[row.message_id].mine.push(row.reaction)
        }

        return jsonResponse({ success: true, reactions: result })
      }

      // ── Bot CRUD (Superadmin-only) ────────────────────────────────

      // POST /bots — Create a bot
      if (pathname === '/bots' && request.method === 'POST') {
        const body = await readJson(request)
        if (!body) return errorResponse('Invalid JSON body')

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)
        if (auth.role !== 'Superadmin') return errorResponse('Only Superadmin can create bots', 403)

        const botName = (body.name || '').trim()
        const username = (body.username || '').trim().toLowerCase().replace(/^@/, '')
        const systemPrompt = (body.system_prompt || '').trim()
        const graphId = (body.graph_id || '').trim() || null
        const avatarUrl = (body.avatar_url || '').trim() || null
        const tools = body.tools || []
        const model = (body.model || 'claude-haiku-4-5-20251001').trim()
        const maxTurns = body.max_turns || 10
        const temperature = body.temperature ?? 0.7

        if (!botName) return errorResponse('Bot name required')
        if (!username) return errorResponse('Bot username required')
        if (!/^[a-z0-9_-]+$/.test(username)) return errorResponse('Username must be lowercase alphanumeric with - or _')

        const botId = crypto.randomUUID()
        const now = Date.now()

        try {
          await env.CHAT_DB.prepare(
            `INSERT INTO chat_bots (id, name, username, avatar_url, system_prompt, graph_id, created_by, tools, model, max_turns, temperature, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
          ).bind(botId, botName, username, avatarUrl, systemPrompt, graphId, userId, JSON.stringify(tools), model, maxTurns, temperature, now).run()
        } catch (err) {
          if (String(err).includes('UNIQUE')) return errorResponse('Bot username already taken', 409)
          throw err
        }

        return jsonResponse({
          success: true,
          bot: { id: botId, name: botName, username, avatar_url: avatarUrl, system_prompt: systemPrompt, graph_id: graphId, tools, model, max_turns: maxTurns, temperature, is_active: 1, created_at: now },
        }, 201)
      }

      // GET /bots — List all bots
      if (pathname === '/bots' && request.method === 'GET') {
        const userId = (searchParams.get('user_id') || '').trim()
        const phone = (searchParams.get('phone') || '').trim()
        const email = (searchParams.get('email') || '').trim()
        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)

        const bots = await env.CHAT_DB.prepare(
          'SELECT * FROM chat_bots WHERE is_active = 1 ORDER BY created_at DESC'
        ).all()

        return jsonResponse({ success: true, bots: bots.results || [] })
      }

      // GET /bots/:id — Get bot details
      const botDetailMatch = pathname.match(/^\/bots\/([^/]+)$/)
      if (botDetailMatch && request.method === 'GET') {
        const botId = botDetailMatch[1]
        const userId = (searchParams.get('user_id') || '').trim()
        const phone = (searchParams.get('phone') || '').trim()
        const email = (searchParams.get('email') || '').trim()
        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)

        const bot = await env.CHAT_DB.prepare('SELECT * FROM chat_bots WHERE id = ?').bind(botId).first()
        if (!bot) return errorResponse('Bot not found', 404)

        // Get groups this bot is in
        const groups = await env.CHAT_DB.prepare(
          `SELECT g.id, g.name, gbm.added_at FROM group_bot_members gbm
           JOIN groups g ON gbm.group_id = g.id
           WHERE gbm.bot_id = ?`
        ).bind(botId).all()

        return jsonResponse({ success: true, bot, groups: groups.results || [] })
      }

      // PUT /bots/:id — Update bot (Superadmin only)
      if (botDetailMatch && request.method === 'PUT') {
        const botId = botDetailMatch[1]
        const body = await readJson(request)
        if (!body) return errorResponse('Invalid JSON body')

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)
        if (auth.role !== 'Superadmin') return errorResponse('Only Superadmin can update bots', 403)

        const existing = await env.CHAT_DB.prepare('SELECT * FROM chat_bots WHERE id = ?').bind(botId).first()
        if (!existing) return errorResponse('Bot not found', 404)

        const name = body.name !== undefined ? String(body.name).trim() : existing.name
        const systemPrompt = body.system_prompt !== undefined ? String(body.system_prompt) : existing.system_prompt
        const graphId = body.graph_id !== undefined ? (String(body.graph_id).trim() || null) : existing.graph_id
        const avatarUrl = body.avatar_url !== undefined ? (String(body.avatar_url).trim() || null) : existing.avatar_url
        const tools = body.tools !== undefined ? JSON.stringify(body.tools) : existing.tools
        const model = body.model !== undefined ? String(body.model).trim() : existing.model
        const maxTurns = body.max_turns !== undefined ? body.max_turns : existing.max_turns
        const temperature = body.temperature !== undefined ? body.temperature : existing.temperature
        const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active

        await env.CHAT_DB.prepare(
          `UPDATE chat_bots SET name = ?, system_prompt = ?, graph_id = ?, avatar_url = ?,
           tools = ?, model = ?, max_turns = ?, temperature = ?, is_active = ?, updated_at = ?
           WHERE id = ?`
        ).bind(name, systemPrompt, graphId, avatarUrl, tools, model, maxTurns, temperature, isActive, Date.now(), botId).run()

        const updated = await env.CHAT_DB.prepare('SELECT * FROM chat_bots WHERE id = ?').bind(botId).first()
        return jsonResponse({ success: true, bot: updated })
      }

      // DELETE /bots/:id — Deactivate bot (Superadmin only)
      if (botDetailMatch && request.method === 'DELETE') {
        const botId = botDetailMatch[1]
        const userId = (searchParams.get('user_id') || '').trim()
        const phone = (searchParams.get('phone') || '').trim()
        const email = (searchParams.get('email') || '').trim()
        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)
        if (auth.role !== 'Superadmin') return errorResponse('Only Superadmin can delete bots', 403)

        // Rename username to free the UNIQUE constraint for reuse
        // Original username is preserved — can be restored on reactivation
        const bot = await env.CHAT_DB.prepare('SELECT username FROM chat_bots WHERE id = ?').bind(botId).first()
        const deletedUsername = bot ? `_deleted_${Date.now()}_${bot.username}` : `_deleted_${Date.now()}_${botId}`
        await env.CHAT_DB.prepare(
          'UPDATE chat_bots SET is_active = 0, username = ?, updated_at = ? WHERE id = ?'
        ).bind(deletedUsername, Date.now(), botId).run()
        return jsonResponse({ success: true, message: 'Bot deactivated', originalUsername: bot?.username })
      }

      // POST /groups/:groupId/bots — Add bot to group (Superadmin only)
      const groupBotMatch = pathname.match(/^\/groups\/([^/]+)\/bots$/)
      if (groupBotMatch && request.method === 'POST') {
        const groupId = groupBotMatch[1]
        const body = await readJson(request)
        if (!body) return errorResponse('Invalid JSON body')

        const userId = (body.user_id || '').trim()
        const phone = (body.phone || '').trim()
        const email = body.email ? String(body.email).trim() : ''
        const botId = (body.bot_id || '').trim()
        if (!userId || !phone) return errorResponse('user_id and phone required')
        if (!botId) return errorResponse('bot_id required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)
        if (auth.role !== 'Superadmin') return errorResponse('Only Superadmin can add bots to groups', 403)

        // Verify group and bot exist
        const group = await env.CHAT_DB.prepare('SELECT id, name FROM groups WHERE id = ?').bind(groupId).first()
        if (!group) return errorResponse('Group not found', 404)
        const bot = await env.CHAT_DB.prepare('SELECT id, name, username FROM chat_bots WHERE id = ? AND is_active = 1').bind(botId).first()
        if (!bot) return errorResponse('Bot not found or inactive', 404)

        // Check if already added
        const existing = await env.CHAT_DB.prepare(
          'SELECT 1 FROM group_bot_members WHERE group_id = ? AND bot_id = ?'
        ).bind(groupId, botId).first()
        if (existing) return jsonResponse({ success: true, already_member: true, message: `Bot @${bot.username} is already in this group` })

        await env.CHAT_DB.prepare(
          'INSERT INTO group_bot_members (group_id, bot_id, added_by, added_at) VALUES (?, ?, ?, ?)'
        ).bind(groupId, botId, userId, Date.now()).run()

        // Also add bot as a group member so it appears in member lists
        const botUserId = `bot:${botId}`
        const alreadyMember = await env.CHAT_DB.prepare(
          'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
        ).bind(groupId, botUserId).first()
        if (!alreadyMember) {
          await env.CHAT_DB.prepare(
            `INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'bot', ?)`
          ).bind(groupId, botUserId, Date.now()).run()
        }

        return jsonResponse({
          success: true,
          message: `Bot @${bot.username} added to group "${group.name}"`,
          bot: { id: bot.id, name: bot.name, username: bot.username },
        }, 201)
      }

      // DELETE /groups/:groupId/bots/:botId — Remove bot from group (Superadmin only)
      const groupBotRemoveMatch = pathname.match(/^\/groups\/([^/]+)\/bots\/([^/]+)$/)
      if (groupBotRemoveMatch && request.method === 'DELETE') {
        const groupId = groupBotRemoveMatch[1]
        const botId = groupBotRemoveMatch[2]
        const userId = (searchParams.get('user_id') || '').trim()
        const phone = (searchParams.get('phone') || '').trim()
        const email = (searchParams.get('email') || '').trim()
        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)
        if (auth.role !== 'Superadmin') return errorResponse('Only Superadmin can remove bots from groups', 403)

        await env.CHAT_DB.prepare('DELETE FROM group_bot_members WHERE group_id = ? AND bot_id = ?').bind(groupId, botId).run()
        await env.CHAT_DB.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').bind(groupId, `bot:${botId}`).run()

        return jsonResponse({ success: true, message: 'Bot removed from group' })
      }

      // GET /groups/:groupId/bots — List bots in group
      if (groupBotMatch && request.method === 'GET') {
        const groupId = groupBotMatch[1]
        const userId = (searchParams.get('user_id') || '').trim()
        const phone = (searchParams.get('phone') || '').trim()
        const email = (searchParams.get('email') || '').trim()
        if (!userId || !phone) return errorResponse('user_id and phone required')

        const auth = await validateUser(env, userId, phone, email)
        if (!auth.ok) return errorResponse(auth.error, auth.status)

        const bots = await env.CHAT_DB.prepare(
          `SELECT cb.*, gbm.added_at, gbm.added_by
           FROM group_bot_members gbm
           JOIN chat_bots cb ON gbm.bot_id = cb.id
           WHERE gbm.group_id = ? AND cb.is_active = 1`
        ).bind(groupId).all()

        return jsonResponse({ success: true, bots: bots.results || [] })
      }

      // POST /bot-message — Internal: bot posts a message (called by agent-worker)
      if (pathname === '/bot-message' && request.method === 'POST') {
        const body = await readJson(request)
        if (!body) return errorResponse('Invalid JSON body')

        const botId = (body.bot_id || '').trim()
        const groupId = (body.group_id || '').trim()
        const text = (body.body || '').trim()
        if (!botId || !groupId || !text) return errorResponse('bot_id, group_id, and body required')

        // Verify bot is in group
        const membership = await env.CHAT_DB.prepare(
          'SELECT 1 FROM group_bot_members WHERE group_id = ? AND bot_id = ?'
        ).bind(groupId, botId).first()
        if (!membership) return errorResponse('Bot is not a member of this group', 403)

        const bot = await env.CHAT_DB.prepare('SELECT name, username, avatar_url FROM chat_bots WHERE id = ? AND is_active = 1').bind(botId).first()
        if (!bot) return errorResponse('Bot not found or inactive', 404)

        const botUserId = `bot:${botId}`
        const createdAt = Date.now()
        const result = await env.CHAT_DB.prepare(
          `INSERT INTO group_messages (group_id, user_id, body, created_at, message_type, sender_avatar_url)
           VALUES (?, ?, ?, ?, 'text', ?)`
        ).bind(groupId, botUserId, text, createdAt, bot.avatar_url || null).run()

        await env.CHAT_DB.prepare('UPDATE groups SET updated_at = ? WHERE id = ?').bind(createdAt, groupId).run()

        return jsonResponse({
          success: true,
          message: {
            id: result.meta.last_row_id,
            group_id: groupId,
            user_id: botUserId,
            body: text,
            created_at: createdAt,
            message_type: 'text',
            bot_name: bot.name,
            bot_username: bot.username,
            sender_avatar_url: bot.avatar_url || null,
          },
        }, 201)
      }

      // GET /groups/:groupId/bots/check-mention?text=... — Check if message mentions a bot
      // Used by agent-worker to check before triggering
      const botMentionCheck = pathname.match(/^\/groups\/([^/]+)\/bots\/check-mention$/)
      if (botMentionCheck && request.method === 'GET') {
        const groupId = botMentionCheck[1]
        const text = searchParams.get('text') || ''
        const mentions = text.match(/@([a-z0-9_-]+)/g) || []
        const usernames = mentions.map(m => m.replace('@', ''))

        if (usernames.length === 0) return jsonResponse({ success: true, bots: [] })

        // Find matching bots in this group
        const placeholders = usernames.map(() => '?').join(',')
        const bots = await env.CHAT_DB.prepare(
          `SELECT cb.* FROM group_bot_members gbm
           JOIN chat_bots cb ON gbm.bot_id = cb.id
           WHERE gbm.group_id = ? AND cb.username IN (${placeholders}) AND cb.is_active = 1`
        ).bind(groupId, ...usernames).all()

        return jsonResponse({ success: true, bots: bots.results || [] })
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
