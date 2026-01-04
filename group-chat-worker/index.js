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

// Send FCM push notification
async function sendPushNotification(env, tokens, title, body, data = {}) {
  if (!env.FCM_SERVER_KEY || tokens.length === 0) {
    return
  }

  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${env.FCM_SERVER_KEY}`,
      },
      body: JSON.stringify({
        registration_ids: tokens,
        notification: {
          title,
          body,
          sound: 'default',
        },
        data,
        priority: 'high',
      }),
    })

    if (!response.ok) {
      console.error('FCM send error:', await response.text())
    }
  } catch (error) {
    console.error('FCM error:', error)
  }
}

// Get FCM tokens for group members (excluding sender)
async function getGroupMemberTokens(env, groupId, excludeUserId) {
  const { results } = await env.CHAT_DB.prepare(
    `SELECT dt.fcm_token
     FROM device_tokens dt
     JOIN group_members gm ON dt.user_id = gm.user_id
     WHERE gm.group_id = ? AND dt.user_id != ?`
  ).bind(groupId, excludeUserId).all()

  return results.map(r => r.fcm_token)
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  return { ok: true }
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
          `INSERT INTO groups (id, name, created_by, graph_id, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
          .bind(groupId, name, createdBy, graphId, createdAt)
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

        const { results } = await env.CHAT_DB.prepare(
          `SELECT g.*, gm.role, gm.joined_at
           FROM groups g
           JOIN group_members gm ON g.id = gm.group_id
           WHERE gm.user_id = ?
           ORDER BY g.created_at DESC`
        )
          .bind(userId)
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

        const { results } = await env.CHAT_DB.prepare(
          `SELECT id, group_id, user_id, body, created_at
           FROM group_messages
           WHERE group_id = ? AND id > ?
           ORDER BY id ASC
           LIMIT ?`
        )
          .bind(groupId, after, limit)
          .all()

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
        if (!userId) {
          return errorResponse('user_id required')
        }
        if (!phone) {
          return errorResponse('phone required')
        }
        if (!text) {
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
          `INSERT INTO group_messages (group_id, user_id, body, created_at)
           VALUES (?, ?, ?, ?)`
        )
          .bind(groupId, userId, text, createdAt)
          .run()

        // Send push notifications to other group members (in background)
        ctx.waitUntil((async () => {
          try {
            // Get group name for notification
            const group = await env.CHAT_DB.prepare(
              'SELECT name FROM groups WHERE id = ?'
            ).bind(groupId).first()
            const groupName = group?.name || 'Group Chat'

            // Get tokens for other members
            const tokens = await getGroupMemberTokens(env, groupId, userId)
            if (tokens.length > 0) {
              // Truncate message for notification
              const preview = text.length > 50 ? text.substring(0, 47) + '...' : text
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
            console.error('Push notification error:', err)
          }
        })())

        return jsonResponse({
          success: true,
          message: {
            id: result.meta.last_row_id,
            group_id: groupId,
            user_id: userId,
            body: text,
            created_at: createdAt,
          },
        }, 201)
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
