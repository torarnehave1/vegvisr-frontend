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

// Streaming PUT — uses S3 UNSIGNED-PAYLOAD so we don't have to buffer/hash the whole body
// in Worker memory. Required for large files (Workers have ~128 MB memory limit).
async function r2PutStream(bucket, key, stream, contentLength, contentType, metadata, accessKeyId, secretKey, accountId) {
  const host = `${accountId}.r2.cloudflarestorage.com`
  const url = `https://${host}/${bucket}/${key}`
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const region = 'auto'
  const service = 's3'
  const payloadHash = 'UNSIGNED-PAYLOAD'

  const baseHeaders = {
    'host': host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': timeStr,
  }
  if (contentLength != null) baseHeaders['content-length'] = String(contentLength)

  const signedHeaderKeys = Object.keys(baseHeaders).sort()
  const signedHeaders = signedHeaderKeys.join(';')
  const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${baseHeaders[k]}`).join('\n') + '\n'
  const canonicalRequest = ['PUT', `/${bucket}/${key}`, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')

  const credentialScope = `${dateStr}/${region}/${service}/aws4_request`
  const encoder = new TextEncoder()
  const hashHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  const stringToSign = ['AWS4-HMAC-SHA256', timeStr, credentialScope,
    hashHex(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest)))
  ].join('\n')

  const sign = async (key, data) => {
    const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? encoder.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode(data)))
  }
  const signingKey = await sign(await sign(await sign(await sign(encoder.encode('AWS4' + secretKey), dateStr), region), service), 'aws4_request')
  const signature = hashHex(await crypto.subtle.sign('HMAC',
    await crypto.subtle.importKey('raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    encoder.encode(stringToSign)
  ))

  const headers = {
    ...baseHeaders,
    'content-type': contentType,
    'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`,
    ...Object.fromEntries(Object.entries(metadata || {}).map(([k, v]) => [`x-amz-meta-${k}`, v])),
  }
  return fetch(url, { method: 'PUT', headers, body: stream })
}

// Presign a GET URL for an R2 object using S3 SigV4 query-string signing.
// Returns a fully-formed https URL the browser can use directly (range/seek supported).
async function r2PresignGet(bucket, key, accessKeyId, secretKey, accountId, expiresSec = 3600) {
  const host = `${accountId}.r2.cloudflarestorage.com`
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const region = 'auto'
  const service = 's3'
  const credentialScope = `${dateStr}/${region}/${service}/aws4_request`
  const signedHeaders = 'host'

  // RFC3986-encode each path segment (R2 keys can contain spaces, parens, etc.)
  const encodePathSegment = (s) => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  const encodedKey = String(key).split('/').map(encodePathSegment).join('/')
  const canonicalUri = `/${bucket}/${encodedKey}`

  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': timeStr,
    'X-Amz-Expires': String(expiresSec),
    'X-Amz-SignedHeaders': signedHeaders,
  }
  const canonicalQuery = Object.keys(queryParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&')

  const canonicalHeaders = `host:${host}\n`
  const payloadHash = 'UNSIGNED-PAYLOAD'
  const canonicalRequest = ['GET', canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n')

  const encoder = new TextEncoder()
  const hashHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timeStr,
    credentialScope,
    hashHex(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest))),
  ].join('\n')

  const sign = async (key, data) => {
    const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? encoder.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode(data)))
  }
  const signingKey = await sign(await sign(await sign(await sign(encoder.encode('AWS4' + secretKey), dateStr), region), service), 'aws4_request')
  const signature = hashHex(await crypto.subtle.sign('HMAC',
    await crypto.subtle.importKey('raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    encoder.encode(stringToSign)
  ))

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`
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

function sanitizeUploadName(value) {
  return String(value || '')
    .trim()
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function buildManualRecordingTarget(filename, contentType) {
  const originalName = sanitizeUploadName(filename || 'upload.mp4')
  const fallbackBase = `manual-upload-${Date.now()}`
  const preferredName = originalName || fallbackBase
  const hasExtension = /\.[A-Za-z0-9]{2,6}$/.test(preferredName)
  const defaultExt = (String(contentType || 'video/mp4').split('/')[1] || 'mp4').replace(/[^A-Za-z0-9]/g, '') || 'mp4'
  const finalName = hasExtension ? preferredName : `${preferredName}.${defaultExt}`
  return {
    name: finalName,
    key: `recordings/${finalName}`,
  }
}

function normalizeRecordingMetadata(customMetadata = {}) {
  const title = String(customMetadata.title || '').trim()
  const labels = String(customMetadata.labels || '')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
  const thumbnailUrl = String(customMetadata.thumbnailUrl || '').trim()
  return { title, labels, thumbnailUrl }
}

async function validateWorkerApiToken(request, env) {
  const apiToken = request.headers.get('X-API-Token')
  if (!apiToken) return { valid: false, error: 'Missing X-API-Token header' }

  if (env.GEMINI_STUDIO_API_TOKEN && apiToken === env.GEMINI_STUDIO_API_TOKEN) {
    return { valid: true, userId: 'studio-integration', role: 'Service', source: 'env', scopes: ['ai:chat'] }
  }

  try {
    const configUser = await env.vegvisr_org
      .prepare('SELECT email, user_id, Role, Systemowner FROM config WHERE emailVerificationToken = ?')
      .bind(apiToken)
      .first()
    if (configUser) {
      return {
        valid: true,
        userId: configUser.user_id,
        email: configUser.email,
        role: configUser.Role,
        isSystemOwner: configUser.Systemowner === 1,
        source: 'config',
        scopes: ['ai:chat'],
      }
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

// Resolve which user's data this request should operate on.
// - If no `asUser` is supplied (query param or body), use the caller's own email.
// - If `asUser` is supplied AND caller is Superadmin, use that email.
// - Otherwise refuse.
async function resolveEffectiveEmail(request, auth, asUserOverride) {
  let asUser = asUserOverride
  if (!asUser) {
    try {
      const url = new URL(request.url)
      asUser = url.searchParams.get('asUser')
    } catch {}
  }
  if (!asUser || asUser === auth.email) {
    return { ok: true, email: auth.email, isImpersonating: false }
  }
  if (auth.role !== 'Superadmin') {
    return { ok: false, status: 403, error: 'Superadmin access required to act on behalf of another user' }
  }
  return { ok: true, email: asUser, isImpersonating: true }
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
        const { meetingId, title, asUser } = body || {}
        if (!meetingId || typeof title !== 'string' || !title.trim()) return createResponse(JSON.stringify({ error: 'meetingId and title are required' }), 400)

        const eff = await resolveEffectiveEmail(request, auth, asUser)
        if (!eff.ok) return createResponse(JSON.stringify({ error: eff.error }), eff.status)
        const effectiveEmail = eff.email

        // Allow rename if meeting is one of the effective user's permanent rooms…
        const row = await env.vegvisr_org
          .prepare("SELECT json_extract(data, '$.realtime') as realtime FROM config WHERE email = ?")
          .bind(effectiveEmail).first()
        let rt = {}
        if (row?.realtime) { try { rt = JSON.parse(row.realtime) } catch (_) {} }
        let allowed = (meetingId === rt.personalMeetingId || meetingId === rt.teamMeetingId)

        // …or any meeting they own (e.g. ad-hoc meetings recorded under this user).
        if (!allowed) {
          try {
            const ownRow = await env.vegvisr_org
              .prepare('SELECT 1 FROM meeting_ownership WHERE owner_email = ? AND meeting_id = ?')
              .bind(effectiveEmail, meetingId).first()
            if (ownRow) allowed = true
          } catch (_) {}
        }

        if (!allowed) return createResponse(JSON.stringify({ error: 'You can only rename rooms you own' }), 403)

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

    // ── GET /realtime/admin/superadmins ────────────────────────────────────────
    // Returns the list of Superadmin users (email + display data) so the UI can
    // show an account switcher. Caller MUST be a Superadmin.
    if (pathname === '/realtime/admin/superadmins' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (auth.role !== 'Superadmin') return createResponse(JSON.stringify({ error: 'Superadmin access required' }), 403)

        const rows = await env.vegvisr_org
          .prepare("SELECT email, user_id FROM config WHERE Role = 'Superadmin' ORDER BY email ASC")
          .all()
        const users = (rows.results || []).map(r => ({ email: r.email, userId: r.user_id }))
        return createResponse(JSON.stringify({
          success: true,
          users,
          currentEmail: auth.email,
          isSystemOwner: !!auth.isSystemOwner,
        }))
      } catch (e) {
        console.error('Error in /realtime/admin/superadmins:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── GET /realtime/admin/users ──────────────────────────────────────────────
    // Systemowner-only: list every user in the config table for the
    // "Login as…" picker. Returns email, role, display_name, isSystemOwner.
    if (pathname === '/realtime/admin/users' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!auth.isSystemOwner) return createResponse(JSON.stringify({ error: 'System Owner access required' }), 403)

        const rows = await env.vegvisr_org
          .prepare('SELECT email, user_id, Role, Systemowner, display_name FROM config ORDER BY Systemowner DESC, Role DESC, email ASC')
          .all()
        const users = (rows.results || []).map(r => ({
          email: r.email,
          userId: r.user_id,
          role: r.Role,
          displayName: r.display_name || null,
          isSystemOwner: r.Systemowner === 1,
        }))
        return createResponse(JSON.stringify({ success: true, users, total: users.length }))
      } catch (e) {
        console.error('Error in /realtime/admin/users:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/admin/impersonate ───────────────────────────────────────
    // Systemowner-only: returns the full auth payload of another user so the
    // frontend can store it in localStorage and "log in" as that user without
    // requiring a magic-link round-trip. The caller's original token is NOT
    // returned — the frontend keeps it in `originalUser` localStorage so the
    // user can return to their own account.
    if (pathname === '/realtime/admin/impersonate' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!auth.isSystemOwner) return createResponse(JSON.stringify({ error: 'System Owner access required' }), 403)

        const body = await request.json().catch(() => ({}))
        const targetEmail = (body?.email || '').trim()
        if (!targetEmail) return createResponse(JSON.stringify({ error: 'email is required' }), 400)
        if (targetEmail === auth.email) return createResponse(JSON.stringify({ error: 'Cannot impersonate yourself' }), 400)

        const target = await env.vegvisr_org
          .prepare('SELECT email, user_id, Role, Systemowner, display_name, emailVerificationToken FROM config WHERE email = ?')
          .bind(targetEmail).first()
        if (!target) return createResponse(JSON.stringify({ error: 'User not found' }), 404)
        if (!target.emailVerificationToken) {
          return createResponse(JSON.stringify({ error: 'Target user has no auth token (never logged in via magic link). Send them a magic link first.' }), 400)
        }

        console.log(`[impersonate] systemowner=${auth.email} took over account=${target.email} (role=${target.Role})`)

        return createResponse(JSON.stringify({
          success: true,
          impersonatedBy: auth.email,
          user: {
            email: target.email,
            user_id: target.user_id,
            role: target.Role,
            displayName: target.display_name || null,
            emailVerificationToken: target.emailVerificationToken,
            isSystemOwner: target.Systemowner === 1,
          },
        }))
      } catch (e) {
        console.error('Error in /realtime/admin/impersonate:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── GET /realtime/recordings ───────────────────────────────────────────────
    if (pathname === '/realtime/recordings' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)

        const eff = await resolveEffectiveEmail(request, auth)
        if (!eff.ok) return createResponse(JSON.stringify({ error: eff.error }), eff.status)
        const effectiveEmail = eff.email

        const recordings = []
        const creds = await getUserCloudflareCredentials(effectiveEmail, env)

        if (creds.r2AccessKeyId && creds.r2Secret && creds.r2Bucket && creds.r2AccountId) {
          // User has their own R2 bucket — list via S3 API
          try {
            const res = await r2List(creds.r2Bucket, 'recordings/', creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId)
            if (res.ok) {
              const xml = await res.text()
              const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1])
              for (const key of keys) {
                let playUrl = null
                try {
                  playUrl = await r2PresignGet(creds.r2Bucket, key, creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId, 3600)
                } catch (presignErr) { console.error('presign failed for', key, presignErr) }
                recordings.push({
                  key,
                  name: key.replace('recordings/', ''),
                  size: 0,
                  source: 'r2-own',
                  playUrl,
                  title: '',
                  labels: [],
                  thumbnailUrl: '',
                })
              }
            }
          } catch (r2Err) { console.error('R2 own list error:', r2Err) }
        } else if (env.MEETING_RECORDINGS) {
          // Fall back to shared R2 binding
          try {
            const listed = await env.MEETING_RECORDINGS.list({ prefix: 'recordings/', limit: 200 })
            for (const obj of listed.objects || []) {
              const name = obj.key.replace('recordings/', '')
              const meta = normalizeRecordingMetadata(obj.customMetadata || {})
              recordings.push({
                key: obj.key,
                name,
                size: obj.size,
                uploaded: obj.uploaded,
                etag: obj.etag,
                customMetadata: obj.customMetadata || {},
                source: 'r2',
                playUrl: `https://realtimevideos.vegvisr.org/recordings/${encodeURIComponent(name)}`,
                title: meta.title,
                labels: meta.labels,
                thumbnailUrl: meta.thumbnailUrl,
              })
            }
            const rootListed = await env.MEETING_RECORDINGS.list({ limit: 200 })
            for (const obj of rootListed.objects || []) {
              if (!obj.key.startsWith('recordings/')) {
                const meta = normalizeRecordingMetadata(obj.customMetadata || {})
                recordings.push({
                  key: obj.key,
                  name: obj.key,
                  size: obj.size,
                  uploaded: obj.uploaded,
                  etag: obj.etag,
                  customMetadata: obj.customMetadata || {},
                  source: 'r2',
                  playUrl: `https://realtimevideos.vegvisr.org/${encodeURIComponent(obj.key)}`,
                  title: meta.title,
                  labels: meta.labels,
                  thumbnailUrl: meta.thumbnailUrl,
                })
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
                const ownedRows = await env.vegvisr_org.prepare('SELECT meeting_id FROM meeting_ownership WHERE owner_email = ?').bind(effectiveEmail).all()
                for (const r of ownedRows.results || []) ownedMeetingIds.add(r.meeting_id)
              } catch (e) { console.error('meeting_ownership lookup failed:', e) }

              // Lookup meeting owners for all meetings in this batch
              let meetingOwners = {};
              try {
                const meetingIds = Array.from(new Set((rtkData.data || []).map(r => r.meeting_id).filter(Boolean)))
                if (meetingIds.length > 0) {
                  const placeholders = meetingIds.map(() => '?').join(',')
                  const ownerRows = await env.vegvisr_org.prepare(`SELECT meeting_id, owner_email FROM meeting_ownership WHERE meeting_id IN (${placeholders})`).bind(...meetingIds).all()
                  for (const row of ownerRows.results || []) {
                    meetingOwners[row.meeting_id] = row.owner_email
                  }
                }
              } catch (e) { console.error('meeting_ownership batch lookup failed:', e) }

              for (const rec of rtkData.data || []) {
                if (ownedMeetingIds.size > 0 && !ownedMeetingIds.has(rec.meeting_id)) continue
                if (rec.output_file_name && r2Keys.has(rec.output_file_name)) continue
                recordings.push({
                  key: rec.id, name: rec.output_file_name || rec.id, size: rec.file_size || 0,
                  uploaded: rec.stopped_time || rec.started_time, duration: rec.recording_duration,
                  meetingId: rec.meeting_id, meetingTitle: rec.meeting?.title || null, status: rec.status,
                  download_url: rec.download_url || null, download_url_expiry: rec.download_url_expiry || null,
                  error: userHasOwnR2 ? null : (rec.err_message || null), source: 'realtimekit',
                  ownerEmail: meetingOwners[rec.meeting_id] || null,
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
    // Async (Option A): enqueue jobs and return immediately. The queue consumer
    // (see queue() handler below) does the actual transfer in the background.
    // Poll GET /realtime/recordings/sync-status?jobIds=... for progress.
    if (pathname === '/realtime/recordings/sync' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!auth.email) return createResponse(JSON.stringify({ error: 'No email on token' }), 401)
        if (!env.R2_SYNC_QUEUE) return createResponse(JSON.stringify({ error: 'R2_SYNC_QUEUE binding not configured' }), 500)

        let bodyJson = {}
        try { bodyJson = await request.json() } catch {}
        const eff = await resolveEffectiveEmail(request, auth, bodyJson?.asUser)
        if (!eff.ok) return createResponse(JSON.stringify({ error: eff.error }), eff.status)
        const effectiveEmail = eff.email

        const creds = await getUserCloudflareCredentials(effectiveEmail, env)
        const { appId, accountId, apiToken, r2AccountId, r2Bucket, r2AccessKeyId, r2Secret } = creds
        const useOwnR2 = !!(r2AccessKeyId && r2Secret && r2Bucket && r2AccountId)
        if (!useOwnR2 && !env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)
        if (!appId || !accountId || !apiToken) return createResponse(JSON.stringify({ error: 'RealtimeKit not configured' }), 500)

        let filterIds = null
        if (bodyJson.recordingIds && Array.isArray(bodyJson.recordingIds)) filterIds = new Set(bodyJson.recordingIds)

        const rtkResp = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/recordings`,
          { headers: { Authorization: `Bearer ${apiToken}` } }
        )
        if (!rtkResp.ok) return createResponse(JSON.stringify({ error: 'Failed to fetch RealtimeKit recordings' }), 502)
        const rtkData = await rtkResp.json()
        const rtkRecordings = rtkData.data || []

        const ownedMeetingIds = new Set()
        try {
          const ownedRows = await env.vegvisr_org.prepare('SELECT meeting_id FROM meeting_ownership WHERE owner_email = ?').bind(effectiveEmail).all()
          for (const r of ownedRows.results || []) ownedMeetingIds.add(r.meeting_id)
        } catch (e) { console.error('meeting_ownership lookup failed:', e) }

        // Build set of files that are already in R2 so we can short-circuit.
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
          } catch {}
        }

        const jobs = []
        for (const rec of rtkRecordings) {
          if (filterIds && !filterIds.has(rec.id)) continue
          if (ownedMeetingIds.size > 0 && !ownedMeetingIds.has(rec.meeting_id)) {
            jobs.push({ recordingId: rec.id, status: 'skipped', reason: 'not owned by user' }); continue
          }
          if (!rec.download_url) { jobs.push({ recordingId: rec.id, status: 'skipped', reason: 'no download_url' }); continue }
          const fileName = rec.output_file_name || `${rec.id}.mp4`
          if (existingR2.has(fileName) || existingR2.has(`recordings/${fileName}`)) {
            jobs.push({ recordingId: rec.id, name: fileName, status: 'already_exists' }); continue
          }

          // Create job row + enqueue
          const jobId = crypto.randomUUID()
          try {
            await env.vegvisr_org.prepare(
              `INSERT INTO r2_sync_jobs (job_id, owner_email, rtk_recording_id, meeting_id, file_name, status, message, bytes_total, r2_target)
               VALUES (?, ?, ?, ?, ?, 'queued', NULL, ?, ?)`
            ).bind(jobId, effectiveEmail, rec.id, rec.meeting_id || null, fileName, rec.file_size || null, useOwnR2 ? 'own' : 'shared').run()
            await env.R2_SYNC_QUEUE.send({
              jobId,
              ownerEmail: effectiveEmail,
              recordingId: rec.id,
              meetingId: rec.meeting_id || null,
              meetingTitle: rec.meeting?.title || null,
              fileName,
              downloadUrl: rec.download_url,
              fileSize: rec.file_size || null,
              recordingDuration: rec.recording_duration || null,
            })
            jobs.push({ jobId, recordingId: rec.id, name: fileName, status: 'queued' })
          } catch (err) {
            jobs.push({ recordingId: rec.id, name: fileName, status: 'enqueue_failed', error: err.message })
          }
        }

        const queued = jobs.filter(j => j.status === 'queued').length
        const skipped = jobs.filter(j => j.status === 'already_exists' || j.status === 'skipped').length
        return createResponse(JSON.stringify({ success: true, queued, skipped, total: jobs.length, jobs }))
      } catch (e) {
        console.error('Error in /realtime/recordings/sync:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── GET /realtime/recordings/sync-status ───────────────────────────────────
    // Poll job status. Pass ?jobIds=a,b,c to get specific jobs, or no param to
    // get the user's most recent jobs (last 50).
    if (pathname === '/realtime/recordings/sync-status' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!auth.email) return createResponse(JSON.stringify({ error: 'No email on token' }), 401)

        const eff = await resolveEffectiveEmail(request, auth)
        if (!eff.ok) return createResponse(JSON.stringify({ error: eff.error }), eff.status)
        const effectiveEmail = eff.email

        const jobIdsParam = url.searchParams.get('jobIds')
        let rows
        if (jobIdsParam) {
          const ids = jobIdsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 100)
          if (ids.length === 0) return createResponse(JSON.stringify({ success: true, jobs: [] }))
          const placeholders = ids.map(() => '?').join(',')
          const stmt = env.vegvisr_org.prepare(
            `SELECT job_id, owner_email, rtk_recording_id, meeting_id, file_name, status, message, bytes_total, r2_target, created_at, updated_at
             FROM r2_sync_jobs WHERE owner_email = ? AND job_id IN (${placeholders})`
          ).bind(effectiveEmail, ...ids)
          rows = await stmt.all()
        } else {
          rows = await env.vegvisr_org.prepare(
            `SELECT job_id, owner_email, rtk_recording_id, meeting_id, file_name, status, message, bytes_total, r2_target, created_at, updated_at
             FROM r2_sync_jobs WHERE owner_email = ? ORDER BY created_at DESC LIMIT 50`
          ).bind(effectiveEmail).all()
        }

        const jobs = (rows.results || []).map(r => ({
          jobId: r.job_id,
          recordingId: r.rtk_recording_id,
          meetingId: r.meeting_id,
          fileName: r.file_name,
          status: r.status,
          message: r.message,
          bytesTotal: r.bytes_total,
          r2Target: r.r2_target,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }))
        return createResponse(JSON.stringify({ success: true, jobs }))
      } catch (e) {
        console.error('Error in /realtime/recordings/sync-status:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── GET /realtime/recordings/play-url ──────────────────────────────────────
    // Returns a short-lived URL the browser/agent can put directly into <video src>.
    // - r2-own users get a SigV4 presigned R2 URL (cross-account, range/seek works).
    // - Shared bucket users get the public realtimevideos.vegvisr.org URL.
    if (pathname === '/realtime/recordings/play-url' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)

        const key = url.searchParams.get('key')
        if (!key) return createResponse(JSON.stringify({ error: 'Missing key parameter' }), 400)

        const eff = await resolveEffectiveEmail(request, auth)
        if (!eff.ok) return createResponse(JSON.stringify({ error: eff.error }), eff.status)

        const expiresSec = Math.min(Math.max(parseInt(url.searchParams.get('expires') || '3600', 10) || 3600, 60), 24 * 3600)
        const creds = await getUserCloudflareCredentials(eff.email, env)
        const normalizedKey = key.startsWith('recordings/') ? key : `recordings/${key}`

        if (creds.r2AccessKeyId && creds.r2Secret && creds.r2Bucket && creds.r2AccountId) {
          const presigned = await r2PresignGet(creds.r2Bucket, normalizedKey, creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId, expiresSec)
          return createResponse(JSON.stringify({
            success: true,
            url: presigned,
            source: 'r2-own',
            expiresAt: new Date(Date.now() + expiresSec * 1000).toISOString(),
          }))
        }

        // Shared-bucket fallback (public Custom Domain)
        return createResponse(JSON.stringify({
          success: true,
          url: `https://realtimevideos.vegvisr.org/${encodeURIComponent(normalizedKey)}`,
          source: 'r2',
          expiresAt: null,
        }))
      } catch (e) {
        console.error('Error in /realtime/recordings/play-url:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/recordings/upload/init ──────────────────────────────────
    // Creates a multipart upload session for a manual Superadmin upload.
    if (pathname === '/realtime/recordings/upload/init' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (auth.role !== 'Superadmin') return createResponse(JSON.stringify({ error: 'Superadmin access required' }), 403)
        if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)

        const { filename, contentType, size } = await request.json()
        if (!filename || typeof filename !== 'string') return createResponse(JSON.stringify({ error: 'filename is required' }), 400)
        if (!size || typeof size !== 'number') return createResponse(JSON.stringify({ error: 'size is required' }), 400)
        const effectiveSize = Math.trunc(size)
        if (effectiveSize <= 0) return createResponse(JSON.stringify({ error: 'Uploaded file is empty' }), 400)
        if (effectiveSize > 25 * 1024 * 1024 * 1024) return createResponse(JSON.stringify({ error: 'Upload exceeds 25 GB limit' }), 400)
        const effectiveType = typeof contentType === 'string' && contentType.trim() ? contentType.trim() : 'video/mp4'
        if (!effectiveType.startsWith('video/')) {
          return createResponse(JSON.stringify({ error: 'Only video uploads are supported' }), 400)
        }

        const target = buildManualRecordingTarget(filename, effectiveType)
        const upload = await env.MEETING_RECORDINGS.createMultipartUpload(target.key, {
          httpMetadata: { contentType: effectiveType },
          customMetadata: {
            uploadedBy: auth.email || '',
            uploadedAt: new Date().toISOString(),
            source: 'manual',
            originalFilename: filename || target.name,
          },
        })

        return createResponse(JSON.stringify({
          success: true,
          uploadId: upload.uploadId,
          key: target.key,
          name: target.name,
          size: effectiveSize,
          contentType: effectiveType,
        }))
      } catch (e) {
        console.error('Error in /realtime/recordings/upload/init:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/recordings/upload/part ──────────────────────────────────
    // Uploads a single multipart chunk through the worker to R2.
    if (pathname === '/realtime/recordings/upload/part' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (auth.role !== 'Superadmin') return createResponse(JSON.stringify({ error: 'Superadmin access required' }), 403)
        if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)

        const url = new URL(request.url)
        const key = String(url.searchParams.get('key') || '')
        const uploadId = String(url.searchParams.get('uploadId') || '')
        const partNumber = Number(url.searchParams.get('partNumber') || '')
        if (!key.startsWith('recordings/')) return createResponse(JSON.stringify({ error: 'Invalid upload key' }), 400)
        if (!uploadId) return createResponse(JSON.stringify({ error: 'uploadId is required' }), 400)
        if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
          return createResponse(JSON.stringify({ error: 'partNumber must be an integer between 1 and 10000' }), 400)
        }

        const body = await request.arrayBuffer()
        if (!body.byteLength) return createResponse(JSON.stringify({ error: 'Upload part is empty' }), 400)

        const upload = env.MEETING_RECORDINGS.resumeMultipartUpload(key, uploadId)
        const uploadedPart = await upload.uploadPart(partNumber, body)

        return createResponse(JSON.stringify({
          success: true,
          part: uploadedPart,
        }))
      } catch (e) {
        console.error('Error in /realtime/recordings/upload/part:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/recordings/upload/complete ──────────────────────────────
    // Completes a multipart upload after the client has uploaded all parts.
    if (pathname === '/realtime/recordings/upload/complete' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (auth.role !== 'Superadmin') return createResponse(JSON.stringify({ error: 'Superadmin access required' }), 403)
        if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)

        const { key, uploadId, parts, name, size, contentType } = await request.json()
        if (!key || typeof key !== 'string' || !key.startsWith('recordings/')) return createResponse(JSON.stringify({ error: 'Valid key is required' }), 400)
        if (!uploadId || typeof uploadId !== 'string') return createResponse(JSON.stringify({ error: 'uploadId is required' }), 400)
        if (!Array.isArray(parts) || !parts.length) return createResponse(JSON.stringify({ error: 'parts are required' }), 400)

        const normalizedParts = parts
          .map((part) => ({
            partNumber: Number(part?.partNumber),
            etag: String(part?.etag || ''),
          }))
          .filter((part) => Number.isInteger(part.partNumber) && part.partNumber > 0 && part.etag)
          .sort((a, b) => a.partNumber - b.partNumber)

        if (!normalizedParts.length) return createResponse(JSON.stringify({ error: 'No valid parts were provided' }), 400)

        const upload = env.MEETING_RECORDINGS.resumeMultipartUpload(key, uploadId)
        await upload.complete(normalizedParts)

        return createResponse(JSON.stringify({
          success: true,
          key,
          name: typeof name === 'string' && name ? name : key.replace(/^recordings\//, ''),
          size: typeof size === 'number' ? size : null,
          contentType: typeof contentType === 'string' && contentType ? contentType : 'video/mp4',
          playUrl: `https://realtimevideos.vegvisr.org/${key}`,
        }))
      } catch (e) {
        console.error('Error in /realtime/recordings/upload/complete:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/recordings/upload/abort ─────────────────────────────────
    // Best-effort cleanup for an interrupted multipart upload.
    if (pathname === '/realtime/recordings/upload/abort' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (auth.role !== 'Superadmin') return createResponse(JSON.stringify({ error: 'Superadmin access required' }), 403)
        if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)

        const { key, uploadId } = await request.json()
        if (!key || typeof key !== 'string' || !key.startsWith('recordings/')) return createResponse(JSON.stringify({ error: 'Valid key is required' }), 400)
        if (!uploadId || typeof uploadId !== 'string') return createResponse(JSON.stringify({ error: 'uploadId is required' }), 400)

        const upload = env.MEETING_RECORDINGS.resumeMultipartUpload(key, uploadId)
        await upload.abort()

        return createResponse(JSON.stringify({ success: true }))
      } catch (e) {
        console.error('Error in /realtime/recordings/upload/abort:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/recordings/upload ───────────────────────────────────────
    // Kept for compatibility; large uploads should use the multipart flow above.
    if (pathname === '/realtime/recordings/upload' && request.method === 'POST') {
      try {
        return createResponse(JSON.stringify({
          error: 'Use /realtime/recordings/upload/init for multipart uploads',
        }), 410)
      } catch (e) {
        console.error('Error in /realtime/recordings/upload:', e)
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

    // ── POST /realtime/recordings/metadata ─────────────────────────────────────
    if (pathname === '/realtime/recordings/metadata' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (auth.role !== 'Superadmin') return createResponse(JSON.stringify({ error: 'Superadmin access required' }), 403)
        if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)

        const body = await request.json()
        const key = String(body.key || '')
        const title = String(body.title || '').trim()
        const thumbnailUrl = String(body.thumbnailUrl || '').trim()
        const labelsInput = Array.isArray(body.labels) ? body.labels : String(body.labels || '').split(',')
        const labels = labelsInput
          .map((label) => String(label || '').trim())
          .filter(Boolean)
          .slice(0, 20)

        if (!key) return createResponse(JSON.stringify({ error: 'key is required' }), 400)

        if (thumbnailUrl) {
          let parsed
          try {
            parsed = new URL(thumbnailUrl)
          } catch {
            return createResponse(JSON.stringify({ error: 'thumbnailUrl must be a valid URL' }), 400)
          }
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return createResponse(JSON.stringify({ error: 'thumbnailUrl must use http or https' }), 400)
          }
        }

        const obj = await env.MEETING_RECORDINGS.get(key)
        if (!obj) return createResponse(JSON.stringify({ error: 'Recording not found' }), 404)

        const customMetadata = {
          ...(obj.customMetadata || {}),
          title,
          labels: labels.join(', '),
          thumbnailUrl,
          updatedBy: auth.email || '',
          updatedAt: new Date().toISOString(),
        }

        await env.MEETING_RECORDINGS.put(key, obj.body, {
          httpMetadata: obj.httpMetadata,
          customMetadata,
        })

        return createResponse(JSON.stringify({
          success: true,
          key,
          title,
          labels,
          thumbnailUrl,
          customMetadata,
        }))
      } catch (e) {
        console.error('Error in /realtime/recordings/metadata:', e)
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
        const rtkUrl = url.searchParams.get('rtk_url')
        if (rtkUrl) {
          let parsedRtkUrl
          try {
            parsedRtkUrl = new URL(rtkUrl)
          } catch {
            return createResponse(JSON.stringify({ error: 'Invalid rtk_url parameter' }), 400)
          }
          if (parsedRtkUrl.protocol !== 'https:') return createResponse(JSON.stringify({ error: 'rtk_url must use https' }), 400)

          const upstream = await fetch(parsedRtkUrl.toString())
          if (!upstream.ok) {
            return createResponse(JSON.stringify({ error: `RealtimeKit download failed: ${upstream.status}` }), upstream.status)
          }
          const upstreamType = upstream.headers.get('content-type') || 'video/mp4'
          const contentDisposition = upstream.headers.get('content-disposition')
          const fallbackName = parsedRtkUrl.pathname.split('/').pop() || 'recording.mp4'
          return new Response(upstream.body, {
            headers: {
              ...corsHeaders,
              'Content-Type': upstreamType,
              'Content-Disposition': contentDisposition || `attachment; filename="${fallbackName}"`,
              ...(upstream.headers.get('content-length') ? { 'Content-Length': upstream.headers.get('content-length') } : {}),
            },
          })
        }

        if (!key) return createResponse(JSON.stringify({ error: 'key query parameter is required' }), 400)

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

  // ─── Cloudflare Queues consumer for r2-sync-queue ─────────────────────────
  // Each message is one recording to copy from RealtimeKit → R2.
  // Status is tracked in D1 r2_sync_jobs so the UI can poll progress.
  async queue(batch, env) {
    for (const msg of batch.messages) {
      const { jobId, ownerEmail, recordingId, meetingId, meetingTitle, fileName, downloadUrl, fileSize, recordingDuration } = msg.body || {}
      const setStatus = async (status, message) => {
        try {
          await env.vegvisr_org.prepare(
            `UPDATE r2_sync_jobs SET status = ?, message = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?`
          ).bind(status, message || null, jobId).run()
        } catch (e) { console.error('[r2-sync-queue] D1 update failed:', e) }
      }

      try {
        if (!jobId || !ownerEmail || !downloadUrl || !fileName) {
          await setStatus('failed', 'Missing required fields in queue message')
          msg.ack()
          continue
        }
        await setStatus('downloading', null)

        const creds = await getUserCloudflareCredentials(ownerEmail, env)
        const { r2AccountId, r2Bucket, r2AccessKeyId, r2Secret } = creds
        const useOwnR2 = !!(r2AccessKeyId && r2Secret && r2Bucket && r2AccountId)
        if (!useOwnR2 && !env.MEETING_RECORDINGS) {
          await setStatus('failed', 'No R2 target configured for user')
          msg.ack()
          continue
        }

        const dlResp = await fetch(downloadUrl)
        if (!dlResp.ok) {
          await setStatus('failed', `download_failed http=${dlResp.status}`)
          // Retry on 5xx, give up on 4xx
          if (dlResp.status >= 500) msg.retry()
          else msg.ack()
          continue
        }

        await setStatus('uploading', null)
        const r2Key = `recordings/${fileName}`
        const metadata = {
          meetingId: meetingId || '',
          meetingTitle: meetingTitle || '',
          duration: String(recordingDuration || ''),
          rtkRecordingId: recordingId || '',
          syncedAt: new Date().toISOString(),
        }

        if (useOwnR2) {
          const contentLength = dlResp.headers.get('content-length')
          const putResp = await r2PutStream(r2Bucket, r2Key, dlResp.body, contentLength, 'video/mp4', metadata, r2AccessKeyId, r2Secret, r2AccountId)
          if (!putResp.ok) {
            const errText = await putResp.text().catch(() => '')
            await setStatus('failed', `r2_put_failed http=${putResp.status} ${errText.slice(0, 300)}`)
            msg.retry()
            continue
          }
        } else {
          await env.MEETING_RECORDINGS.put(r2Key, dlResp.body, { httpMetadata: { contentType: 'video/mp4' }, customMetadata: metadata })
        }

        await setStatus('done', `Uploaded to ${useOwnR2 ? 'own' : 'shared'} R2 at ${r2Key}`)
        msg.ack()
      } catch (err) {
        console.error('[r2-sync-queue] error:', err)
        await setStatus('failed', err.message?.slice(0, 500) || 'unknown error')
        // Allow Cloudflare to retry up to max_retries
        msg.retry()
      }
    }
  },
}
