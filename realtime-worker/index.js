// realtime-worker — handles all /realtime/* endpoints for api.vegvisr.org

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role, X-API-Token, x-user-email, x-user-id, X-Email',
}

function createResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...headers },
  })
}

async function hashStringSha256(value) {
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function getUserCloudflareCredentials(email, env) {
  const defaults = {
    accountId: env.CF_ACCOUNT_ID,
    apiToken: env.REALTIMEKIT_API_TOKEN,
    appId: env.REALTIMEKIT_APP_ID,
    r2AccountId: null,
    r2Bucket: null,
    r2AccessKeyId: null,
    r2Secret: null,
  }
  if (!email) return defaults
  try {
    const row = await env.vegvisr_org
      .prepare('SELECT cf_account_id, cf_api_token, cf_rtk_app_id, cf_rtk_token, cf_r2_account_id, cf_r2_bucket, cf_r2_access_key_id, cf_r2_secret FROM config WHERE email = ?')
      .bind(email).first()
    if (!row) return defaults
    return {
      accountId: row.cf_account_id || defaults.accountId,
      apiToken: row.cf_rtk_token || row.cf_api_token || defaults.apiToken,
      appId: row.cf_rtk_app_id || defaults.appId,
      r2AccountId: row.cf_r2_account_id || row.cf_account_id || null,
      r2Bucket: row.cf_r2_bucket || null,
      r2AccessKeyId: row.cf_r2_access_key_id || null,
      r2Secret: row.cf_r2_secret || null,
    }
  } catch {
    return defaults
  }
}

async function signR2Request(method, bucket, key, accessKeyId, secretKey, accountId, body = null) {
  const host = `${accountId}.r2.cloudflarestorage.com`
  const url = `https://${host}/${bucket}${key ? '/' + key : ''}`
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const region = 'auto'
  const service = 's3'

  const payloadHash = body
    ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', typeof body === 'string' ? new TextEncoder().encode(body) : body))).map(b => b.toString(16).padStart(2, '0')).join('')
    : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

  const headers = {
    'host': host,
    'x-amz-date': timeStr,
    'x-amz-content-sha256': payloadHash,
  }
  if (body) headers['content-length'] = String(typeof body === 'string' ? new TextEncoder().encode(body).length : body.byteLength)

  const signedHeaders = Object.keys(headers).sort().join(';')
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}`).join('\n') + '\n'
  const canonicalRequest = [method, `/${bucket}${key ? '/' + key : ''}`, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')

  const credentialScope = `${dateStr}/${region}/${service}/aws4_request`
  const encoder = new TextEncoder()
  const stringToSign = ['AWS4-HMAC-SHA256', timeStr, credentialScope,
    Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest)))).map(b => b.toString(16).padStart(2, '0')).join('')
  ].join('\n')

  const sign = async (key, data) => {
    const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? encoder.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode(data)))
  }

  const signingKey = await sign(await sign(await sign(await sign(encoder.encode('AWS4' + secretKey), dateStr), region), service), 'aws4_request')
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',
    await crypto.subtle.importKey('raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    encoder.encode(stringToSign)
  ))).map(b => b.toString(16).padStart(2, '0')).join('')

  return {
    url,
    headers: {
      ...headers,
      'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`,
    }
  }
}

async function r2Put(bucket, key, body, contentType, metadata, accessKeyId, secretKey, accountId) {
  const { url, headers } = await signR2Request('PUT', bucket, key, accessKeyId, secretKey, accountId, body)
  return fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'content-type': contentType, ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`x-amz-meta-${k}`, v])) },
    body,
  })
}

async function r2List(bucket, prefix, accessKeyId, secretKey, accountId) {
  const host = `${accountId}.r2.cloudflarestorage.com`
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const queryString = `list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`
  const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timeStr}\n`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = ['GET', `/${bucket}`, queryString, canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const encoder = new TextEncoder()
  const credentialScope = `${dateStr}/auto/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', timeStr, credentialScope,
    Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest)))).map(b => b.toString(16).padStart(2, '0')).join('')
  ].join('\n')
  const sign = async (key, data) => {
    const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? encoder.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode(data)))
  }
  const signingKey = await sign(await sign(await sign(await sign(encoder.encode('AWS4' + secretKey), dateStr), 'auto'), 's3'), 'aws4_request')
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',
    await crypto.subtle.importKey('raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    encoder.encode(stringToSign)
  ))).map(b => b.toString(16).padStart(2, '0')).join('')
  const res = await fetch(`https://${host}/${bucket}?${queryString}`, {
    headers: {
      'host': host,
      'x-amz-date': timeStr,
      'x-amz-content-sha256': payloadHash,
      'Authorization': `AWS4-HMAC-SHA256 Credential=${secretKey}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`.replace(secretKey, accessKeyId),
    }
  })
  return res
}

async function validateWorkerApiToken(request, env) {
  const apiToken = request.headers.get('X-API-Token')
  if (!apiToken) return { valid: false, error: 'Missing X-API-Token header' }

  if (env.GEMINI_STUDIO_API_TOKEN && apiToken === env.GEMINI_STUDIO_API_TOKEN) {
    return { valid: true, userId: 'studio-integration', role: 'Service', source: 'env', scopes: ['ai:chat'] }
  }

  try {
    const configUser = await env.vegvisr_org
      .prepare('SELECT email, user_id, Role FROM config WHERE emailVerificationToken = ?')
      .bind(apiToken)
      .first()
    if (configUser) {
      return { valid: true, userId: configUser.user_id, email: configUser.email, role: configUser.Role, source: 'config', scopes: ['ai:chat'] }
    }

    const tokenHash = await hashStringSha256(apiToken)
    const tokenRecord = await env.vegvisr_org
      .prepare('SELECT id, user_id, scopes, is_active, expires_at FROM api_tokens WHERE token = ?')
      .bind(tokenHash)
      .first()
    if (!tokenRecord) return { valid: false, error: 'Invalid X-API-Token' }
    if (!tokenRecord.is_active) return { valid: false, error: 'API token is inactive' }
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) <= new Date()) return { valid: false, error: 'API token has expired' }

    let scopes = []
    try { scopes = tokenRecord.scopes ? JSON.parse(tokenRecord.scopes) : [] } catch { scopes = [] }

    return { valid: true, userId: tokenRecord.user_id, source: 'api_tokens', scopes }
  } catch (e) {
    return { valid: false, error: 'Token validation error: ' + e.message }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400' } })
    }

    // ── GET /realtime/my-rooms ─────────────────────────────────────────────────
    if (pathname === '/realtime/my-rooms' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!auth.email || !env.vegvisr_org) return createResponse(JSON.stringify({ error: 'Could not resolve user email or database' }), 400)

        const row = await env.vegvisr_org
          .prepare("SELECT json_extract(data, '$.realtime') as realtime, display_name FROM config WHERE email = ?")
          .bind(auth.email)
          .first()

        if (!row?.realtime) {
          return createResponse(JSON.stringify({ success: true, personalMeetingId: null, teamMeetingId: null, displayName: row?.display_name || null }))
        }

        const rt = JSON.parse(row.realtime)
        let personalId = rt.personalMeetingId || null
        let teamId = rt.teamMeetingId || null
        let personalTitle = null
        let teamTitle = null

        const appId = env.REALTIMEKIT_APP_ID
        const accountId = env.CF_ACCOUNT_ID
        const apiToken = env.REALTIMEKIT_API_TOKEN

        if (appId && accountId && apiToken) {
          const fetchRoomInfo = async (meetingId) => {
            if (!meetingId) return { valid: false, title: null }
            try {
              const r = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings/${meetingId}`,
                { headers: { Authorization: `Bearer ${apiToken}` } }
              )
              if (!r.ok) return { valid: false, title: null }
              const d = await r.json()
              return { valid: true, title: d?.data?.title || null }
            } catch { return { valid: false, title: null } }
          }

          const [personalInfo, teamInfo] = await Promise.all([fetchRoomInfo(personalId), fetchRoomInfo(teamId)])
          personalTitle = personalInfo.title
          teamTitle = teamInfo.title

          let needsUpdate = false
          if (personalId && !personalInfo.valid) { personalId = null; needsUpdate = true }
          if (teamId && !teamInfo.valid) { teamId = null; needsUpdate = true }
          if (needsUpdate) {
            const updatedRt = { ...rt, personalMeetingId: personalId, teamMeetingId: teamId }
            await env.vegvisr_org.prepare("UPDATE config SET data = json_set(data, '$.realtime', json(?)) WHERE email = ?")
              .bind(JSON.stringify(updatedRt), auth.email).run()
          }
        }

        return createResponse(JSON.stringify({
          success: true,
          personalMeetingId: personalId,
          teamMeetingId: teamId,
          personalTitle,
          teamTitle,
          displayName: row.display_name || null,
          waitingScreen: rt.waitingScreen || null,
          waitingRoomEnabled: rt.waitingRoomEnabled || false,
        }))
      } catch (e) {
        console.error('Error in /realtime/my-rooms:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/provision-rooms ─────────────────────────────────────────
    if (pathname === '/realtime/provision-rooms' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!auth.email || !env.vegvisr_org) return createResponse(JSON.stringify({ error: 'Could not resolve user email or database' }), 400)

        const appId = env.REALTIMEKIT_APP_ID
        const accountId = env.CF_ACCOUNT_ID
        const apiToken = env.REALTIMEKIT_API_TOKEN
        if (!appId || !accountId || !apiToken) return createResponse(JSON.stringify({ error: 'RealtimeKit not configured on server' }), 500)

        let bodyDisplayName = null
        try { const body = await request.json(); bodyDisplayName = body?.displayName || null } catch (_) {}

        const row = await env.vegvisr_org
          .prepare("SELECT json_extract(data, '$.realtime') as realtime, display_name FROM config WHERE email = ?")
          .bind(auth.email).first()

        let existing = {}
        if (row?.realtime) { try { existing = JSON.parse(row.realtime) } catch (_) {} }

        const userName = bodyDisplayName || row?.display_name || auth.email.split('@')[0]
        let personalMeetingId = existing.personalMeetingId || null
        let teamMeetingId = existing.teamMeetingId || null

        const isRoomValid = async (meetingId) => {
          if (!meetingId) return false
          try {
            const r = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings/${meetingId}`,
              { headers: { Authorization: `Bearer ${apiToken}` } }
            )
            return r.ok
          } catch { return false }
        }

        const createMeetingId = async () => {
          const resp = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings`,
            { method: 'POST', headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
          )
          if (!resp.ok) throw new Error('Failed to create meeting: ' + await resp.text())
          const d = await resp.json()
          return d?.data?.id
        }

        const patchMeetingTitle = async (meetingId, title) => {
          try {
            await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings/${meetingId}`,
              { method: 'PATCH', headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) }
            )
          } catch (_) {}
        }

        const [personalValid, teamValid] = await Promise.all([isRoomValid(personalMeetingId), isRoomValid(teamMeetingId)])
        if (!personalValid) {
          personalMeetingId = await createMeetingId()
          await patchMeetingTitle(personalMeetingId, `${userName} Personal Meeting Room`)
          try {
            await env.vegvisr_org.prepare('INSERT OR REPLACE INTO meeting_ownership (meeting_id, owner_email, room_type) VALUES (?, ?, ?)')
              .bind(personalMeetingId, auth.email, 'personal').run()
          } catch (e) { console.error('meeting_ownership insert (personal) failed:', e) }
        }
        if (!teamValid) {
          teamMeetingId = await createMeetingId()
          await patchMeetingTitle(teamMeetingId, `${userName} Team Room`)
          try {
            await env.vegvisr_org.prepare('INSERT OR REPLACE INTO meeting_ownership (meeting_id, owner_email, room_type) VALUES (?, ?, ?)')
              .bind(teamMeetingId, auth.email, 'team').run()
          } catch (e) { console.error('meeting_ownership insert (team) failed:', e) }
        }

        const updatedRealtime = { ...existing, personalMeetingId, teamMeetingId }
        await env.vegvisr_org.prepare("UPDATE config SET data = json_set(data, '$.realtime', json(?)) WHERE email = ?")
          .bind(JSON.stringify(updatedRealtime), auth.email).run()

        return createResponse(JSON.stringify({ success: true, personalMeetingId, teamMeetingId }))
      } catch (e) {
        console.error('Error in /realtime/provision-rooms:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/rename-room ─────────────────────────────────────────────
    if (pathname === '/realtime/rename-room' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!auth.email || !env.vegvisr_org) return createResponse(JSON.stringify({ error: 'Could not resolve user email or database' }), 400)

        const body = await request.json()
        const { meetingId, title } = body || {}
        if (!meetingId || typeof title !== 'string' || !title.trim()) return createResponse(JSON.stringify({ error: 'meetingId and title are required' }), 400)

        const row = await env.vegvisr_org
          .prepare("SELECT json_extract(data, '$.realtime') as realtime FROM config WHERE email = ?")
          .bind(auth.email).first()

        let rt = {}
        if (row?.realtime) { try { rt = JSON.parse(row.realtime) } catch (_) {} }

        if (meetingId !== rt.personalMeetingId && meetingId !== rt.teamMeetingId) {
          return createResponse(JSON.stringify({ error: 'You can only rename your own permanent rooms' }), 403)
        }

        const appId = env.REALTIMEKIT_APP_ID
        const accountId = env.CF_ACCOUNT_ID
        const apiToken = env.REALTIMEKIT_API_TOKEN
        if (!appId || !accountId || !apiToken) return createResponse(JSON.stringify({ error: 'RealtimeKit not configured on server' }), 500)

        const patchResp = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings/${meetingId}`,
          { method: 'PATCH', headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() }) }
        )
        if (!patchResp.ok) {
          const errText = await patchResp.text()
          return createResponse(JSON.stringify({ error: 'Failed to rename room', details: errText }), 502)
        }
        return createResponse(JSON.stringify({ success: true, meetingId, title: title.trim() }))
      } catch (e) {
        console.error('Error in /realtime/rename-room:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── GET /realtime/meeting-info ─────────────────────────────────────────────
    if (pathname === '/realtime/meeting-info' && request.method === 'GET') {
      try {
        const meetingId = url.searchParams.get('meetingId')
        if (!meetingId) return createResponse(JSON.stringify({ error: 'meetingId query parameter is required' }), 400)
        if (!env.vegvisr_org) return createResponse(JSON.stringify({ error: 'Database not available' }), 500)

        const rows = await env.vegvisr_org.prepare(
          `SELECT email, display_name, json_extract(data, '$.realtime') as realtime
           FROM config
           WHERE json_extract(data, '$.realtime.personalMeetingId') = ?
              OR json_extract(data, '$.realtime.teamMeetingId') = ?
           LIMIT 1`
        ).bind(meetingId, meetingId).all()

        let hostName = null, waitingTitle = null, waitingImage = null, roomType = null, waitingRoomEnabled = false
        if (rows.results && rows.results.length > 0) {
          const owner = rows.results[0]
          hostName = owner.display_name || owner.email.split('@')[0]
          if (owner.realtime) {
            try {
              const rt = JSON.parse(owner.realtime)
              if (rt.personalMeetingId === meetingId) roomType = 'personal'
              else if (rt.teamMeetingId === meetingId) roomType = 'team'
              const ws = rt.waitingScreen || {}
              waitingTitle = ws.title || null
              waitingImage = ws.image || null
              waitingRoomEnabled = !!rt.waitingRoomEnabled
            } catch {}
          }
        }

        let meetingTitle = null, hostOnline = null
        const appId = env.REALTIMEKIT_APP_ID
        const accountId = env.CF_ACCOUNT_ID
        const apiToken = env.REALTIMEKIT_API_TOKEN

        if (appId && accountId && apiToken) {
          const fetchMeetingTitle = fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings/${encodeURIComponent(meetingId)}`,
            { headers: { Authorization: `Bearer ${apiToken}` } }
          )
          const fetchLiveSessions = waitingRoomEnabled
            ? fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/sessions?status=LIVE`, { headers: { Authorization: `Bearer ${apiToken}` } })
            : Promise.resolve(null)

          const [titleResp, sessionsResp] = await Promise.all([fetchMeetingTitle, fetchLiveSessions])
          if (titleResp.ok) { const d = await titleResp.json(); meetingTitle = d?.data?.title || null }
          if (sessionsResp !== null) {
            try {
              if (sessionsResp.ok) {
                const sessionsData = await sessionsResp.json()
                const liveSessions = sessionsData?.data?.sessions || []
                const matchingSession = liveSessions.find((s) => s.associated_id === meetingId && (s.live_participants || 0) > 0)
                hostOnline = !!matchingSession
              }
            } catch { hostOnline = null }
          }
        }

        return createResponse(JSON.stringify({ success: true, meetingId, meetingTitle, hostName, roomType, waitingTitle, waitingImage, waitingRoomEnabled, hostOnline }))
      } catch (e) {
        console.error('Error in /realtime/meeting-info:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/update-waiting-screen ───────────────────────────────────
    if (pathname === '/realtime/update-waiting-screen' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!auth.email || !env.vegvisr_org) return createResponse(JSON.stringify({ error: 'Could not resolve user email or database' }), 400)

        const body = await request.json()
        const { title, image } = body || {}

        if (image && typeof image === 'string' && image.trim()) {
          try {
            const parsed = new URL(image.trim())
            if (!['http:', 'https:'].includes(parsed.protocol)) return createResponse(JSON.stringify({ error: 'Image URL must use http or https' }), 400)
          } catch { return createResponse(JSON.stringify({ error: 'Invalid image URL' }), 400) }
        }

        const row = await env.vegvisr_org.prepare('SELECT data FROM config WHERE email = ?').bind(auth.email).first()
        let configData = {}
        if (row?.data) { try { configData = JSON.parse(row.data) } catch { configData = {} } }
        if (!configData.realtime) configData.realtime = {}
        configData.realtime.waitingScreen = {
          title: title && typeof title === 'string' ? title.trim() : null,
          image: image && typeof image === 'string' ? image.trim() : null,
        }
        await env.vegvisr_org.prepare('UPDATE config SET data = ? WHERE email = ?').bind(JSON.stringify(configData), auth.email).run()
        return createResponse(JSON.stringify({ success: true, waitingScreen: configData.realtime.waitingScreen }))
      } catch (e) {
        console.error('Error in /realtime/update-waiting-screen:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/toggle-waiting-room ─────────────────────────────────────
    if (pathname === '/realtime/toggle-waiting-room' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!auth.email || !env.vegvisr_org) return createResponse(JSON.stringify({ error: 'Could not resolve user email or database' }), 400)

        const body = await request.json()
        const enabled = body?.enabled === true

        const row = await env.vegvisr_org.prepare('SELECT data FROM config WHERE email = ?').bind(auth.email).first()
        let configData = {}
        if (row?.data) { try { configData = JSON.parse(row.data) } catch { configData = {} } }
        if (!configData.realtime) configData.realtime = {}
        configData.realtime.waitingRoomEnabled = enabled
        await env.vegvisr_org.prepare('UPDATE config SET data = ? WHERE email = ?').bind(JSON.stringify(configData), auth.email).run()
        return createResponse(JSON.stringify({ success: true, waitingRoomEnabled: enabled }))
      } catch (e) {
        console.error('Error in /realtime/toggle-waiting-room:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/create-meeting ──────────────────────────────────────────
    if (pathname === '/realtime/create-meeting' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)

        const appId = env.REALTIMEKIT_APP_ID
        const accountId = env.CF_ACCOUNT_ID
        const apiToken = env.REALTIMEKIT_API_TOKEN
        if (!appId || !accountId || !apiToken) return createResponse(JSON.stringify({ error: 'RealtimeKit not configured on server' }), 500)

        const rtResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings`,
          { method: 'POST', headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
        )
        if (!rtResponse.ok) {
          const errText = await rtResponse.text()
          return createResponse(JSON.stringify({ error: 'RealtimeKit API error', details: errText }), 502)
        }
        const rtData = await rtResponse.json()
        const meetingId = rtData?.data?.id
        if (!meetingId) return createResponse(JSON.stringify({ error: 'No meetingId in RealtimeKit response', raw: rtData }), 502)
        return createResponse(JSON.stringify({ success: true, meetingId, status: rtData.data.status }))
      } catch (e) {
        console.error('Error in /realtime/create-meeting:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/close-meeting ───────────────────────────────────────────
    if (pathname === '/realtime/close-meeting' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)

        const body = await request.json()
        const { meetingId } = body
        if (!meetingId) return createResponse(JSON.stringify({ error: 'meetingId is required' }), 400)

        if (auth.email && env.vegvisr_org) {
          try {
            const configRow = await env.vegvisr_org.prepare("SELECT json_extract(data, '$.realtime') as realtime FROM config WHERE email = ?").bind(auth.email).first()
            if (configRow?.realtime) {
              const rt = JSON.parse(configRow.realtime)
              if (rt.personalMeetingId === meetingId || rt.teamMeetingId === meetingId) {
                return createResponse(JSON.stringify({ error: 'Cannot close a permanent room (personal or team).' }), 403)
              }
            }
          } catch (_) {}
        }

        const appId = env.REALTIMEKIT_APP_ID
        const accountId = env.CF_ACCOUNT_ID
        const apiToken = env.REALTIMEKIT_API_TOKEN
        if (!appId || !accountId || !apiToken) return createResponse(JSON.stringify({ error: 'RealtimeKit not configured on server' }), 500)

        const rtResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings/${encodeURIComponent(meetingId)}`,
          { method: 'PATCH', headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'INACTIVE' }) }
        )
        if (!rtResponse.ok) {
          const errText = await rtResponse.text()
          return createResponse(JSON.stringify({ error: 'RealtimeKit API error', details: errText }), 502)
        }
        return createResponse(JSON.stringify({ success: true, meetingId, status: 'INACTIVE' }))
      } catch (e) {
        console.error('Error in /realtime/close-meeting:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── GET /realtime/list-meetings ────────────────────────────────────────────
    if (pathname === '/realtime/list-meetings' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)

        const appId = env.REALTIMEKIT_APP_ID
        const accountId = env.CF_ACCOUNT_ID
        const apiToken = env.REALTIMEKIT_API_TOKEN
        if (!appId || !accountId || !apiToken) return createResponse(JSON.stringify({ error: 'RealtimeKit not configured on server' }), 500)

        const rtResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings`,
          { headers: { Authorization: `Bearer ${apiToken}` } }
        )
        if (!rtResponse.ok) {
          const errText = await rtResponse.text()
          return createResponse(JSON.stringify({ error: 'RealtimeKit API error', details: errText }), 502)
        }
        const rtData = await rtResponse.json()
        const allMeetings = rtData?.result || rtData?.data || []

        let permanentIds = []
        if (auth.email && env.vegvisr_org) {
          try {
            const configRow = await env.vegvisr_org.prepare("SELECT json_extract(data, '$.realtime') as realtime FROM config WHERE email = ?").bind(auth.email).first()
            if (configRow?.realtime) {
              const rt = JSON.parse(configRow.realtime)
              if (rt.personalMeetingId) permanentIds.push(rt.personalMeetingId)
              if (rt.teamMeetingId) permanentIds.push(rt.teamMeetingId)
            }
          } catch (_) {}
        }

        const meetings = allMeetings.filter((m) => !permanentIds.includes(m.id))
        return createResponse(JSON.stringify({ success: true, meetings }))
      } catch (e) {
        console.error('Error in /realtime/list-meetings:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/join-token ──────────────────────────────────────────────
    if (pathname === '/realtime/join-token' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)

        const body = await request.json()
        const { meetingId, clientData } = body
        if (!meetingId) return createResponse(JSON.stringify({ error: 'meetingId is required' }), 400)

        const appId = env.REALTIMEKIT_APP_ID
        const accountId = env.CF_ACCOUNT_ID
        const apiToken = env.REALTIMEKIT_API_TOKEN
        if (!appId || !accountId || !apiToken) return createResponse(JSON.stringify({ error: 'RealtimeKit not configured on server' }), 500)

        const clientPayload = clientData && typeof clientData === 'object' ? clientData : {}
        const participantId = clientPayload.customParticipantId || clientPayload.custom_participant_id || auth.userId

        let presetName = env.REALTIMEKIT_PRESET_NAME || 'group_call_participant'
        let isOwner = false

        const lookupId = auth.userId || auth.email
        if (lookupId && env.vegvisr_org) {
          try {
            const lookupCol = auth.userId ? 'user_id' : 'email'
            const cfgRow = await env.vegvisr_org.prepare(
              `SELECT json_extract(data, '$.realtime') as realtime FROM config WHERE ${lookupCol} = ?`
            ).bind(lookupId).first()
            if (cfgRow?.realtime) {
              const rt = JSON.parse(cfgRow.realtime)
              if (rt.personalMeetingId === meetingId || rt.teamMeetingId === meetingId) {
                presetName = 'group_call_host'
                isOwner = true
              }
            }
          } catch (e) { console.error('Preset lookup error (falling back to participant):', e) }
        }

        if (clientPayload.presetName) presetName = clientPayload.presetName

        const payload = {
          custom_participant_id: participantId,
          preset_name: presetName,
          name: clientPayload.name,
          picture: clientPayload.picture,
        }
        Object.keys(payload).forEach((key) => {
          if (payload[key] === undefined || payload[key] === null || payload[key] === '') delete payload[key]
        })

        const rtResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings/${encodeURIComponent(meetingId)}/participants`,
          { method: 'POST', headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        )
        if (!rtResponse.ok) {
          const errText = await rtResponse.text()
          return createResponse(JSON.stringify({ error: 'RealtimeKit API error', details: errText }), 502)
        }
        const rtData = await rtResponse.json()
        const authToken = rtData?.data?.token
        if (!authToken) return createResponse(JSON.stringify({ error: 'No token in RealtimeKit response', raw: rtData }), 502)

        console.log('[join-token] SUCCESS — preset:', presetName, '| isOwner:', isOwner)
        return createResponse(JSON.stringify({ success: true, authToken, isOwner }))
      } catch (e) {
        console.error('Error in /realtime/join-token:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── GET /realtime/recordings ───────────────────────────────────────────────
    if (pathname === '/realtime/recordings' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)

        const recordings = []
        const creds = await getUserCloudflareCredentials(auth.email, env)

        if (creds.r2AccessKeyId && creds.r2Secret && creds.r2Bucket && creds.r2AccountId) {
          // User has their own R2 bucket — list via S3 API
          try {
            const res = await r2List(creds.r2Bucket, 'recordings/', creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId)
            if (res.ok) {
              const xml = await res.text()
              const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1])
              for (const key of keys) {
                recordings.push({ key, name: key.replace('recordings/', ''), size: 0, source: 'r2-own' })
              }
            }
          } catch (r2Err) { console.error('R2 own list error:', r2Err) }
        } else if (env.MEETING_RECORDINGS) {
          // Fall back to shared R2 binding
          try {
            const listed = await env.MEETING_RECORDINGS.list({ prefix: 'recordings/', limit: 200 })
            for (const obj of listed.objects || []) {
              recordings.push({ key: obj.key, name: obj.key.replace('recordings/', ''), size: obj.size, uploaded: obj.uploaded, etag: obj.etag, customMetadata: obj.customMetadata || {}, source: 'r2' })
            }
            const rootListed = await env.MEETING_RECORDINGS.list({ limit: 200 })
            for (const obj of rootListed.objects || []) {
              if (!obj.key.startsWith('recordings/')) {
                recordings.push({ key: obj.key, name: obj.key, size: obj.size, uploaded: obj.uploaded, etag: obj.etag, customMetadata: obj.customMetadata || {}, source: 'r2' })
              }
            }
          } catch (r2Err) { console.error('R2 list error:', r2Err) }
        }

        const { appId, accountId, apiToken } = creds
        if (appId && accountId && apiToken) {
          try {
            const rtkResp = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/recordings`,
              { headers: { Authorization: `Bearer ${apiToken}` } }
            )
            if (rtkResp.ok) {
              const rtkData = await rtkResp.json()
              const r2Keys = new Set(recordings.map((r) => r.name))
              const userHasOwnR2 = !!(creds.r2AccessKeyId && creds.r2Secret && creds.r2Bucket && creds.r2AccountId)

              // Restrict RealtimeKit results to meetings owned by this user
              const ownedMeetingIds = new Set()
              try {
                const ownedRows = await env.vegvisr_org.prepare('SELECT meeting_id FROM meeting_ownership WHERE owner_email = ?').bind(auth.email).all()
                for (const r of ownedRows.results || []) ownedMeetingIds.add(r.meeting_id)
              } catch (e) { console.error('meeting_ownership lookup failed:', e) }

              for (const rec of rtkData.data || []) {
                if (ownedMeetingIds.size > 0 && !ownedMeetingIds.has(rec.meeting_id)) continue
                if (rec.output_file_name && r2Keys.has(rec.output_file_name)) continue
                recordings.push({
                  key: rec.id, name: rec.output_file_name || rec.id, size: rec.file_size || 0,
                  uploaded: rec.stopped_time || rec.started_time, duration: rec.recording_duration,
                  meetingId: rec.meeting_id, meetingTitle: rec.meeting?.title || null, status: rec.status,
                  download_url: rec.download_url || null, download_url_expiry: rec.download_url_expiry || null,
                  error: userHasOwnR2 ? null : (rec.err_message || null), source: 'realtimekit',
                })
              }
            }
          } catch (rtkErr) { console.error('RealtimeKit recordings API error:', rtkErr) }
        }

        return createResponse(JSON.stringify({ success: true, recordings }))
      } catch (e) {
        console.error('Error in /realtime/recordings:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/recordings/sync ─────────────────────────────────────────
    if (pathname === '/realtime/recordings/sync' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)

        const creds = await getUserCloudflareCredentials(auth.email, env)
        const { appId, accountId, apiToken, r2AccountId, r2Bucket, r2AccessKeyId, r2Secret } = creds
        const useOwnR2 = !!(r2AccessKeyId && r2Secret && r2Bucket && r2AccountId)

        if (!useOwnR2 && !env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)
        if (!appId || !accountId || !apiToken) return createResponse(JSON.stringify({ error: 'RealtimeKit not configured' }), 500)

        const rtkResp = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/recordings`,
          { headers: { Authorization: `Bearer ${apiToken}` } }
        )
        if (!rtkResp.ok) return createResponse(JSON.stringify({ error: 'Failed to fetch RealtimeKit recordings' }), 502)

        const rtkData = await rtkResp.json()
        const rtkRecordings = rtkData.data || []

        // Restrict to meetings owned by this user
        const ownedMeetingIds = new Set()
        try {
          const ownedRows = await env.vegvisr_org.prepare('SELECT meeting_id FROM meeting_ownership WHERE owner_email = ?').bind(auth.email).all()
          for (const r of ownedRows.results || []) ownedMeetingIds.add(r.meeting_id)
        } catch (e) { console.error('meeting_ownership lookup failed:', e) }

        let filterIds = null
        try { const body = await request.json(); if (body.recordingIds && Array.isArray(body.recordingIds)) filterIds = new Set(body.recordingIds) } catch {}

        const existingR2 = new Set()
        if (useOwnR2) {
          try {
            const res = await r2List(r2Bucket, 'recordings/', r2AccessKeyId, r2Secret, r2AccountId)
            if (res.ok) {
              const xml = await res.text()
              ;[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].forEach(m => existingR2.add(m[1].replace('recordings/', '')))
            }
          } catch {}
        } else {
          try {
            const prefixed = await env.MEETING_RECORDINGS.list({ prefix: 'recordings/', limit: 1000 })
            for (const obj of prefixed.objects || []) existingR2.add(obj.key.replace('recordings/', ''))
            const root = await env.MEETING_RECORDINGS.list({ limit: 1000 })
            for (const obj of root.objects || []) existingR2.add(obj.key)
          } catch {}
        }

        const results = []
        for (const rec of rtkRecordings) {
          if (filterIds && !filterIds.has(rec.id)) continue
          if (ownedMeetingIds.size > 0 && !ownedMeetingIds.has(rec.meeting_id)) {
            results.push({ id: rec.id, status: 'skipped', reason: 'not owned by user' }); continue
          }
          if (!rec.download_url) { results.push({ id: rec.id, status: 'skipped', reason: 'no download_url' }); continue }
          const fileName = rec.output_file_name || `${rec.id}.mp4`
          if (existingR2.has(fileName) || existingR2.has(`recordings/${fileName}`)) { results.push({ id: rec.id, name: fileName, status: 'already_exists' }); continue }
          try {
            const dlResp = await fetch(rec.download_url)
            if (!dlResp.ok) { results.push({ id: rec.id, name: fileName, status: 'download_failed', httpStatus: dlResp.status }); continue }
            const r2Key = `recordings/${fileName}`
            const metadata = { meetingId: rec.meeting_id || '', meetingTitle: rec.meeting?.title || '', duration: String(rec.recording_duration || ''), rtkRecordingId: rec.id, syncedAt: new Date().toISOString() }
            if (useOwnR2) {
              const videoData = await dlResp.arrayBuffer()
              await r2Put(r2Bucket, r2Key, videoData, 'video/mp4', metadata, r2AccessKeyId, r2Secret, r2AccountId)
            } else {
              await env.MEETING_RECORDINGS.put(r2Key, dlResp.body, { httpMetadata: { contentType: 'video/mp4' }, customMetadata: metadata })
            }
            results.push({ id: rec.id, name: fileName, r2Key, status: 'synced', size: rec.file_size, r2: useOwnR2 ? 'own' : 'shared' })
          } catch (err) { results.push({ id: rec.id, name: fileName, status: 'error', error: err.message }) }
        }

        const synced = results.filter((r) => r.status === 'synced').length
        const skipped = results.filter((r) => r.status === 'already_exists').length
        return createResponse(JSON.stringify({ success: true, synced, skipped, total: results.length, results }))
      } catch (e) {
        console.error('Error in /realtime/recordings/sync:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/recordings/rename ───────────────────────────────────────
    if (pathname === '/realtime/recordings/rename' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (auth.role !== 'Superadmin') return createResponse(JSON.stringify({ error: 'Superadmin access required' }), 403)
        if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)

        const body = await request.json()
        const { key, newName } = body || {}
        if (!key || !newName || typeof newName !== 'string' || !newName.trim()) return createResponse(JSON.stringify({ error: 'key and newName are required' }), 400)

        const sourceObj = await env.MEETING_RECORDINGS.get(key)
        if (!sourceObj) return createResponse(JSON.stringify({ error: 'Recording not found' }), 404)

        const newKey = 'recordings/' + newName.trim()
        await env.MEETING_RECORDINGS.put(newKey, sourceObj.body, { httpMetadata: sourceObj.httpMetadata, customMetadata: sourceObj.customMetadata || {} })
        await env.MEETING_RECORDINGS.delete(key)
        return createResponse(JSON.stringify({ success: true, oldKey: key, newKey }))
      } catch (e) {
        console.error('Error in /realtime/recordings/rename:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/recordings/delete ───────────────────────────────────────
    if (pathname === '/realtime/recordings/delete' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (auth.role !== 'Superadmin') return createResponse(JSON.stringify({ error: 'Superadmin access required' }), 403)
        if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)

        const body = await request.json()
        const { key } = body || {}
        if (!key) return createResponse(JSON.stringify({ error: 'key is required' }), 400)

        const obj = await env.MEETING_RECORDINGS.head(key)
        if (!obj) return createResponse(JSON.stringify({ error: 'Recording not found' }), 404)

        await env.MEETING_RECORDINGS.delete(key)
        return createResponse(JSON.stringify({ success: true, deleted: key }))
      } catch (e) {
        console.error('Error in /realtime/recordings/delete:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── GET /realtime/recordings/download ──────────────────────────────────────
    if (pathname === '/realtime/recordings/download' && request.method === 'GET') {
      try {
        const queryToken = url.searchParams.get('token')
        let downloadRequest = request
        if (queryToken && !request.headers.get('X-API-Token')) {
          downloadRequest = new Request(request.url, {
            method: request.method,
            headers: new Headers([...request.headers.entries(), ['X-API-Token', queryToken]]),
          })
        }
        const auth = await validateWorkerApiToken(downloadRequest, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)

        const key = url.searchParams.get('key')
        if (!key) return createResponse(JSON.stringify({ error: 'key query parameter is required' }), 400)

        const rtkUrl = url.searchParams.get('rtk_url')
        if (rtkUrl) return new Response(null, { status: 302, headers: { ...corsHeaders, Location: rtkUrl } })

        const obj = await env.MEETING_RECORDINGS.get(key)
        if (!obj) return createResponse(JSON.stringify({ error: 'Recording not found' }), 404)

        const fileName = key.split('/').pop() || 'recording'
        return new Response(obj.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': obj.httpMetadata?.contentType || 'video/mp4',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': obj.size,
          },
        })
      } catch (e) {
        console.error('Error in /realtime/recordings/download:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/recordings/transcribe ───────────────────────────────────
    if (pathname === '/realtime/recordings/transcribe' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'MEETING_RECORDINGS R2 bucket not configured' }), 500)
        if (!env.WHISPER_WORKER) return createResponse(JSON.stringify({ error: 'WHISPER_WORKER service binding not configured' }), 500)

        const body = await request.json()
        const { key } = body
        if (!key) return createResponse(JSON.stringify({ error: 'key is required (R2 key of the recording)' }), 400)

        const obj = await env.MEETING_RECORDINGS.get(key)
        if (!obj) return createResponse(JSON.stringify({ error: `Recording not found: ${key}` }), 404)

        const audioBuffer = await obj.arrayBuffer()
        const sizeMB = (audioBuffer.byteLength / 1024 / 1024).toFixed(2)
        const ext = key.split('.').pop()?.toLowerCase() || 'mp4'
        const contentType = obj.httpMetadata?.contentType || (ext === 'webm' ? 'audio/webm' : 'audio/mp4')

        const whisperResponse = await env.WHISPER_WORKER.fetch(
          new Request('https://whisper.vegvisr.org/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': contentType, 'X-File-Name': key.split('/').pop() || `recording.${ext}` },
            body: audioBuffer,
          })
        )
        const result = await whisperResponse.json()
        if (!whisperResponse.ok) return createResponse(JSON.stringify({ error: 'Transcription failed', details: result.error || result, sizeMB }), whisperResponse.status)
        return createResponse(JSON.stringify({ success: true, key, sizeMB, text: result.text || '', transcription: result.transcription || result, model: result.model || '@cf/openai/whisper' }))
      } catch (e) {
        console.error('Error in /realtime/recordings/transcribe:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/waiting-room/knock ──────────────────────────────────────
    if (pathname === '/realtime/waiting-room/knock' && request.method === 'POST') {
      try {
        const { meetingId, guestEmail, guestName } = await request.json()
        if (!meetingId || !guestEmail) return createResponse(JSON.stringify({ error: 'meetingId and guestEmail required' }), 400)
        const name = guestName || guestEmail
        const id = crypto.randomUUID()
        await env.vegvisr_org.prepare(
          `INSERT INTO realtime_waiting_room (id, meeting_id, guest_email, guest_name, status)
           VALUES (?, ?, ?, ?, 'waiting')
           ON CONFLICT(meeting_id, guest_email) DO UPDATE SET
             status = 'waiting', guest_name = excluded.guest_name, updated_at = unixepoch()`
        ).bind(id, meetingId, guestEmail, name).run()
        return createResponse(JSON.stringify({ success: true, guestEmail }))
      } catch (e) {
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── GET /realtime/waiting-room/status ──────────────────────────────────────
    if (pathname === '/realtime/waiting-room/status' && request.method === 'GET') {
      try {
        const meetingId = url.searchParams.get('meetingId')
        const guestEmail = url.searchParams.get('guestEmail')
        if (!meetingId || !guestEmail) return createResponse(JSON.stringify({ error: 'meetingId and guestEmail required' }), 400)
        const row = await env.vegvisr_org.prepare(
          `SELECT status FROM realtime_waiting_room WHERE meeting_id = ? AND guest_email = ? LIMIT 1`
        ).bind(meetingId, guestEmail).first()
        return createResponse(JSON.stringify({ success: true, status: row?.status || 'unknown' }))
      } catch (e) {
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── GET /realtime/waiting-room/list ────────────────────────────────────────
    if (pathname === '/realtime/waiting-room/list' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        const meetingId = url.searchParams.get('meetingId')
        if (!meetingId) return createResponse(JSON.stringify({ error: 'meetingId required' }), 400)
        const rows = await env.vegvisr_org.prepare(
          `SELECT id, guest_email, guest_name, status, created_at FROM realtime_waiting_room
           WHERE meeting_id = ? AND status = 'waiting' ORDER BY created_at ASC`
        ).bind(meetingId).all()
        return createResponse(JSON.stringify({ success: true, guests: rows.results || [] }))
      } catch (e) {
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/waiting-room/admit ──────────────────────────────────────
    if (pathname === '/realtime/waiting-room/admit' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        const { meetingId, guestEmail } = await request.json()
        if (!meetingId || !guestEmail) return createResponse(JSON.stringify({ error: 'meetingId and guestEmail required' }), 400)
        await env.vegvisr_org.prepare(
          `UPDATE realtime_waiting_room SET status = 'admitted', updated_at = unixepoch() WHERE meeting_id = ? AND guest_email = ?`
        ).bind(meetingId, guestEmail).run()
        return createResponse(JSON.stringify({ success: true }))
      } catch (e) {
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/waiting-room/deny ───────────────────────────────────────
    if (pathname === '/realtime/waiting-room/deny' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        const { meetingId, guestEmail } = await request.json()
        if (!meetingId || !guestEmail) return createResponse(JSON.stringify({ error: 'meetingId and guestEmail required' }), 400)
        await env.vegvisr_org.prepare(
          `UPDATE realtime_waiting_room SET status = 'denied', updated_at = unixepoch() WHERE meeting_id = ? AND guest_email = ?`
        ).bind(meetingId, guestEmail).run()
        return createResponse(JSON.stringify({ success: true }))
      } catch (e) {
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── 404 ────────────────────────────────────────────────────────────────────
    return createResponse(JSON.stringify({ error: 'Not found', pathname }), 404)
  },
}
