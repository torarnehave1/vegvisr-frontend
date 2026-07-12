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
    r2PublicBase: null,
    kvNamespaceId: null,
    kvToken: null,
  }
  if (!email) return defaults
  try {
    const row = await env.vegvisr_org
      .prepare('SELECT cf_account_id, cf_api_token, cf_rtk_app_id, cf_rtk_token, cf_r2_account_id, cf_r2_bucket, cf_r2_access_key_id, cf_r2_secret, cf_r2_public_base, cf_kv_namespace_id, cf_kv_token FROM config WHERE email = ?')
      .bind(email).first()
    if (!row) return defaults
    // RealtimeKit self-host is opt-in via the RTK-specific columns ONLY: a user
    // is on their own RealtimeKit app only when BOTH cf_rtk_app_id AND
    // cf_rtk_token are set. cf_account_id / cf_api_token are NOT RealtimeKit
    // credentials — the Agent-Builder "World" onboarding (set_world_credentials,
    // tool-executors.js) writes a brand-proxy Workers/KV/DNS token into those two
    // columns, and that token 403s (code=10000) against the RealtimeKit API. They
    // must never leak into RTK resolution; otherwise a World founder's room
    // provisioning breaks (account+app mismatch). When not self-hosting RTK, fall
    // back fully to the shared env app.
    const hasOwnRtk = !!(row.cf_rtk_app_id && row.cf_rtk_token)
    return {
      accountId: hasOwnRtk ? (row.cf_account_id || defaults.accountId) : defaults.accountId,
      apiToken: hasOwnRtk ? row.cf_rtk_token : defaults.apiToken,
      appId: hasOwnRtk ? row.cf_rtk_app_id : defaults.appId,
      r2AccountId: row.cf_r2_account_id || row.cf_account_id || null,
      r2Bucket: row.cf_r2_bucket || null,
      r2AccessKeyId: row.cf_r2_access_key_id || null,
      r2Secret: row.cf_r2_secret || null,
      // Permanent public origin for this owner's recordings bucket (R2 custom
      // domain or r2.dev). Set → node playUrls are permanent; null → fall back
      // to short-lived presigned URLs.
      r2PublicBase: row.cf_r2_public_base || null,
      // Per-owner KV for participant telemetry. KV needs its own token —
      // cf_rtk_token is RealtimeKit-scoped and will NOT authorize KV writes.
      kvNamespaceId: row.cf_kv_namespace_id || null,
      kvToken: row.cf_kv_token || null,
    }
  } catch {
    return defaults
  }
}

// Cloudflare Stream API credentials for a founder's account.
// Resolver shape (per-founder token slots in later without a rewrite): today it
// returns the central secret only. A per-founder override via config.cf_stream_token
// is added when the first own-account World streams — kept OUT of the SELECT for now
// so the column is not required to exist.
async function getStreamCredentials(email, env) {
  return {
    // Optional override; else the account the worker already runs in.
    accountId: env.CF_STREAM_ACCOUNT_ID || env.CF_ACCOUNT_ID || null,
    apiToken: env.CF_STREAM_API_TOKEN || null,
  }
}

// Producer: enqueue a founder's Cloudflare Stream recordings into the existing
// r2-sync-queue, targeting the `stream-recordings/` prefix with type:'stream'
// metadata. The queue consumer (patched to honor keyPrefix + metadata) does the
// actual copy into the owner's R2 (own or shared), byte-for-byte reusing the
// realtime pipeline. opts.liveInputId scopes to one live input; absent = all
// live-origin videos in the account.
async function enqueueStreamRecordings(email, env, opts = {}) {
  let { accountId, apiToken } = await getStreamCredentials(email, env)
  if (!apiToken) {
    return { error: 'Stream API not configured (set CF_STREAM_API_TOKEN)' }
  }
  // Auto-resolve the account from the token when CF_STREAM_ACCOUNT_ID is unset —
  // a Stream-scoped token belongs to exactly one account.
  if (!accountId) {
    try {
      const acctResp = await fetch('https://api.cloudflare.com/client/v4/accounts', {
        headers: { Authorization: `Bearer ${apiToken}` },
      })
      const acctJson = await acctResp.json().catch(() => ({}))
      accountId = acctJson?.result?.[0]?.id || null
    } catch {}
    if (!accountId) {
      return { error: 'Could not resolve Stream account from token; set CF_STREAM_ACCOUNT_ID' }
    }
  }

  // R2 target for this owner — reuse the existing per-owner resolver.
  const creds = await getUserCloudflareCredentials(email, env)
  const { r2AccountId, r2Bucket, r2AccessKeyId, r2Secret, r2PublicBase } = creds
  const useOwnR2 = !!(r2AccessKeyId && r2Secret && r2Bucket && r2AccountId)
  if (!useOwnR2 && !env.MEETING_RECORDINGS) {
    return { error: 'No R2 target configured for user' }
  }

  // 1. List the Stream recordings (videos). Enumerate the live input(s), then
  //    each input's recorded videos — `?type=live` does not reliably return them.
  let liveInputIds = []
  if (opts.liveInputId) {
    liveInputIds = [opts.liveInputId]
  } else {
    const liResp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    )
    const liJson = await liResp.json().catch(() => ({}))
    if (!liResp.ok || liJson.success === false) {
      return { error: `live_inputs_list_failed http=${liResp.status}`, cfErrors: liJson.errors || [] }
    }
    liveInputIds = (liJson.result || []).map(li => li.uid).filter(Boolean)
  }
  const videos = []
  for (const liId of liveInputIds) {
    const vResp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${liId}/videos`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    )
    const vJson = await vResp.json().catch(() => ({}))
    if (!vResp.ok || vJson.success === false) continue
    for (const v of (vJson.result || [])) videos.push({ ...v, _liveInputId: liId })
  }

  // 2. Dedupe against what is already in R2 under stream-recordings/.
  const existing = new Set()
  if (useOwnR2) {
    try {
      const res = await r2List(r2Bucket, 'stream-recordings/', r2AccessKeyId, r2Secret, r2AccountId)
      if (res.ok) {
        const xml = await res.text()
        ;[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].forEach(m => existing.add(m[1].replace('stream-recordings/', '')))
      }
    } catch {}
  } else {
    try {
      const p = await env.MEETING_RECORDINGS.list({ prefix: 'stream-recordings/', limit: 1000 })
      for (const o of p.objects || []) existing.add(o.key.replace('stream-recordings/', ''))
    } catch {}
  }

  // 3. For each ready video: enable MP4, enqueue when the download is ready.
  const jobs = []
  for (const v of videos) {
    const uid = v.uid
    if (!uid) continue
    if (v.readyToStream === false) { jobs.push({ uid, status: 'skipped', reason: 'not_ready_to_stream' }); continue }
    const fileName = `${uid}.mp4`
    if (existing.has(fileName)) { jobs.push({ uid, name: fileName, status: 'already_exists' }); continue }

    // Enable/generate the MP4 download (async on Cloudflare's side).
    const dlResp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/downloads`,
      { method: 'POST', headers: { Authorization: `Bearer ${apiToken}` } }
    )
    const dlJson = await dlResp.json().catch(() => ({}))
    const dl = dlJson?.result?.default
    if (!dl || !dl.url) { jobs.push({ uid, status: 'skipped', reason: 'no_download_url' }); continue }
    if (dl.status !== 'ready') {
      // MP4 still transcoding — re-run (button or cron) picks it up next pass.
      jobs.push({ uid, name: fileName, status: 'download_processing', percent: dl.percentComplete })
      continue
    }

    // Enqueue into the existing R2 copy queue with stream prefix + metadata.
    const jobId = crypto.randomUUID()
    const liveInputId = v._liveInputId || opts.liveInputId || ''
    const meetingTitle = v.meta?.name || v.meta?.title || liveInputId || uid
    try {
      await env.vegvisr_org.prepare(
        `INSERT INTO r2_sync_jobs (job_id, owner_email, rtk_recording_id, meeting_id, file_name, status, message, bytes_total, r2_target)
         VALUES (?, ?, ?, ?, ?, 'queued', NULL, ?, ?)`
      ).bind(jobId, email, uid, liveInputId || null, fileName, v.size || null, useOwnR2 ? 'own' : 'shared').run()
      await env.R2_SYNC_QUEUE.send({
        jobId,
        ownerEmail: email,
        fileName,
        downloadUrl: dl.url,
        keyPrefix: 'stream-recordings/',
        metadata: {
          type: 'stream',
          streamVideoId: uid,
          liveInputId,
          meetingTitle,
          duration: v.duration != null ? String(v.duration) : '',
        },
      })
      jobs.push({ jobId, uid, name: fileName, status: 'queued' })
    } catch (err) {
      jobs.push({ uid, name: fileName, status: 'enqueue_failed', error: err.message })
    }
  }

  return {
    ok: true,
    target: useOwnR2 ? 'own' : 'shared',
    publicBase: r2PublicBase || null,
    queued: jobs.filter(j => j.status === 'queued').length,
    processing: jobs.filter(j => j.status === 'download_processing').length,
    skipped: jobs.filter(j => j.status === 'already_exists' || j.status === 'skipped').length,
    total: jobs.length,
    jobs,
  }
}

// Resolve the RealtimeKit credentials of the app that OWNS a given meeting.
// Meetings live in their creator's app; ownership is tracked in meeting_ownership.
// Falls back to the shared/default app when ownership is unknown (legacy meetings
// created before per-user apps existed).
async function getMeetingOwnerCredentials(meetingId, env) {
  let ownerEmail = null
  try {
    const row = await env.vegvisr_org
      .prepare('SELECT owner_email FROM meeting_ownership WHERE meeting_id = ?')
      .bind(meetingId).first()
    ownerEmail = row?.owner_email || null
  } catch { /* ignore — fall back to shared defaults */ }
  return getUserCloudflareCredentials(ownerEmail, env)
}

// ── Per-owner KV (participant telemetry) via Cloudflare REST API ──────────────
// The worker cannot bind a foreign account's KV namespace, so it reads/writes the
// owner's namespace over REST using the owner's KV-edit token. `creds` comes from
// getUserCloudflareCredentials → { accountId, kvNamespaceId, kvToken }.
function kvConfigured(creds) {
  return !!(creds && creds.accountId && creds.kvNamespaceId && creds.kvToken)
}
function kvBaseUrl(creds) {
  return `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/storage/kv/namespaces/${creds.kvNamespaceId}`
}
async function kvPut(creds, key, value, { expirationTtl } = {}) {
  let url = `${kvBaseUrl(creds)}/values/${encodeURIComponent(key)}`
  if (expirationTtl) url += `?expiration_ttl=${expirationTtl}`
  return fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${creds.kvToken}`, 'Content-Type': 'text/plain' },
    body: typeof value === 'string' ? value : JSON.stringify(value),
  })
}
async function kvGet(creds, key) {
  return fetch(`${kvBaseUrl(creds)}/values/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${creds.kvToken}` },
  })
}
async function kvDelete(creds, key) {
  return fetch(`${kvBaseUrl(creds)}/values/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${creds.kvToken}` },
  })
}
async function kvList(creds, prefix) {
  let url = `${kvBaseUrl(creds)}/keys?limit=1000`
  if (prefix) url += `&prefix=${encodeURIComponent(prefix)}`
  return fetch(url, { headers: { Authorization: `Bearer ${creds.kvToken}` } })
}

// Reduce a session's sorted event log into a per-participant summary. The log is
// a state machine: join/leave bound "present" intervals; speaking/audio/video
// booleans bound talk/mute/video-off intervals inside them. Dangling intervals
// (still open at session end) are closed at endedAt. This is the analytics core
// shared by the rollup endpoint and the future read API (Slice 4).
function computeSessionSummary(meetingId, sessionId, hostEmail, events, startedAt, endedAt) {
  const sorted = events.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0))
  const byId = new Map()
  const ensure = (pid, name) => {
    let s = byId.get(pid)
    if (!s) {
      s = { pid, name: name || '', presentMs: 0, talkMs: 0, mutedMs: 0, videoOffMs: 0,
            joins: 0, firstJoin: null, lastLeave: null,
            _present: false, _joinTs: 0, _speaking: false, _speakTs: 0,
            _muted: false, _muteTs: 0, _videoOff: false, _videoTs: 0 }
      byId.set(pid, s)
    }
    if (name) s.name = name
    return s
  }
  for (const e of sorted) {
    if (!e || !e.pid) continue
    const s = ensure(e.pid, e.name)
    const t = e.ts || 0
    if (e.type === 'join') {
      if (!s._present) { s._present = true; s._joinTs = t; s.joins++; if (s.firstJoin == null) s.firstJoin = t }
    } else if (e.type === 'leave') {
      if (s._present) {
        s.presentMs += t - s._joinTs; s._present = false; s.lastLeave = t
        if (s._speaking) { s.talkMs += t - s._speakTs; s._speaking = false }
        if (s._muted) { s.mutedMs += t - s._muteTs; s._muted = false }
        if (s._videoOff) { s.videoOffMs += t - s._videoTs; s._videoOff = false }
      }
    } else if (e.type === 'speaking') {
      if (e.value && !s._speaking) { s._speaking = true; s._speakTs = t }
      else if (!e.value && s._speaking) { s.talkMs += t - s._speakTs; s._speaking = false }
    } else if (e.type === 'audio') {
      const muted = e.value === false
      if (muted && !s._muted) { s._muted = true; s._muteTs = t }
      else if (!muted && s._muted) { s.mutedMs += t - s._muteTs; s._muted = false }
    } else if (e.type === 'video') {
      const off = e.value === false
      if (off && !s._videoOff) { s._videoOff = true; s._videoTs = t }
      else if (!off && s._videoOff) { s.videoOffMs += t - s._videoTs; s._videoOff = false }
    }
  }
  for (const s of byId.values()) {
    if (s._present) { s.presentMs += endedAt - s._joinTs; if (s.lastLeave == null) s.lastLeave = endedAt }
    if (s._speaking) s.talkMs += endedAt - s._speakTs
    if (s._muted) s.mutedMs += endedAt - s._muteTs
    if (s._videoOff) s.videoOffMs += endedAt - s._videoTs
  }
  const participants = [...byId.values()].map((s) => ({
    pid: s.pid, name: s.name,
    presentMs: s.presentMs, talkMs: s.talkMs, mutedMs: s.mutedMs, videoOffMs: s.videoOffMs,
    talkPct: s.presentMs > 0 ? Math.round((s.talkMs / s.presentMs) * 100) : 0,
    joins: s.joins, firstJoin: s.firstJoin, lastLeave: s.lastLeave,
  }))
  return { meetingId, sessionId, hostEmail, startedAt, endedAt, participants }
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

async function r2Head(bucket, key, accessKeyId, secretKey, accountId) {
  const { url, headers } = await signR2Request('HEAD', bucket, key, accessKeyId, secretKey, accountId)
  return fetch(url, {
    method: 'HEAD',
    headers,
  })
}

async function r2Get(bucket, key, accessKeyId, secretKey, accountId) {
  const { url, headers } = await signR2Request('GET', bucket, key, accessKeyId, secretKey, accountId)
  return fetch(url, {
    method: 'GET',
    headers,
  })
}

async function r2Delete(bucket, key, accessKeyId, secretKey, accountId) {
  const { url, headers } = await signR2Request('DELETE', bucket, key, accessKeyId, secretKey, accountId)
  return fetch(url, {
    method: 'DELETE',
    headers,
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
  // SigV4 requires canonical query params sorted by name: list-type, max-keys, prefix.
  const queryString = `list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`
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

function buildManualRecordingTarget(filename, contentType, subFolder = '') {
  const originalName = sanitizeUploadName(filename || 'upload.mp4')
  const fallbackBase = `manual-upload-${Date.now()}`
  const preferredName = originalName || fallbackBase
  const hasExtension = /\.[A-Za-z0-9]{2,6}$/.test(preferredName)
  const defaultExt = (String(contentType || 'video/mp4').split('/')[1] || 'mp4').replace(/[^A-Za-z0-9]/g, '') || 'mp4'
  const finalName = hasExtension ? preferredName : `${preferredName}.${defaultExt}`
  // Optional sub-folder under recordings/ (e.g. 'academy' for training videos shown in the Learn tab).
  const folder = String(subFolder || '').replace(/[^a-z0-9-]/gi, '').toLowerCase()
  const prefix = folder ? `recordings/${folder}/` : 'recordings/'
  return {
    name: finalName,
    key: `${prefix}${finalName}`,
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

// Recording-management actions (rename, edit metadata, delete) operate ONLY on
// the caller's own bucket (asUser stays Superadmin-only) and are allowed for
// both Admin and Superadmin. Manual multipart upload stays Superadmin-only
// until it supports per-user buckets.
function canManageRecordings(role) {
  return role === 'Superadmin' || role === 'Admin'
}

// Parse JSON, returning null instead of throwing on malformed input.
function safeJsonParse(str) {
  try { return JSON.parse(str) } catch { return null }
}

// Coerce a date input to an ISO 8601 string, or '' when empty/invalid.
// Accepts ISO strings, date-only strings, or epoch ms.
function normalizeIsoOrEmpty(value) {
  if (value === null || value === undefined || value === '') return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

// Custom room slugs are owner-scoped (create stamps owner_email = caller; list
// filters by owner_email; update/delete/share-token re-check ownership), so an
// Admin may manage their OWN slugs alongside Superadmin without seeing others'.
function canManageSlugs(role) {
  return role === 'Superadmin' || role === 'Admin'
}

// OpenAPI 3.1 spec — curated READ subset, so this worker can be registered in
// graph_system_registry and its read endpoints auto-exposed as agent tools.
// operationId → tool name (with the registry node's tool_prefix, e.g. rt_).
// Auth is X-API-Token (the caller's emailVerificationToken); the endpoints
// resolve the user from the token via validateWorkerApiToken.
function buildRealtimeOpenApiSpec(origin) {
  const okJson = (desc) => ({ 200: { description: desc, content: { 'application/json': { schema: { type: 'object' } } } } })
  return {
    openapi: '3.1.0',
    info: {
      title: 'Realtime Worker API (read subset)',
      version: '1.0.0',
      description: 'Curated read-only endpoints of the Vegvisr realtime worker: academy/recordings listing + room/meeting context. Auth: X-API-Token header (the caller\'s emailVerificationToken).',
    },
    servers: [{ url: origin }],
    security: [{ apiToken: [] }],
    paths: {
      '/realtime/openapi.json': {
        get: { operationId: 'getRealtimeOpenApiSpec', summary: 'This OpenAPI spec', security: [], responses: okJson('OpenAPI 3.1 specification') },
      },
      '/realtime/recordings/academy': {
        get: {
          operationId: 'getAcademyRecordings',
          summary: 'List academy recordings — the World Founder Learn-tab video feed',
          parameters: [{ name: 'admin', in: 'query', required: false, schema: { type: 'string' }, description: 'Optional admin flag' }],
          responses: okJson('Academy recordings list'),
        },
      },
      '/realtime/recordings': {
        get: { operationId: 'listRecordings', summary: 'List the authenticated user\'s recordings', responses: okJson('Recordings list') },
      },
      '/realtime/recordings/play-url': {
        get: {
          operationId: 'getRecordingPlayUrl',
          summary: 'Get a time-limited playback URL for a recording key',
          parameters: [
            { name: 'key', in: 'query', required: true, schema: { type: 'string' }, description: 'Recording R2 key' },
            { name: 'expires', in: 'query', required: false, schema: { type: 'integer' }, description: 'URL TTL in seconds' },
          ],
          responses: okJson('Signed playback URL'),
        },
      },
      '/realtime/list-meetings': {
        get: { operationId: 'listMeetings', summary: 'List the authenticated user\'s meetings', responses: okJson('Meetings list') },
      },
      '/realtime/my-rooms': {
        get: { operationId: 'getMyRooms', summary: 'List the authenticated user\'s realtime rooms', responses: okJson('Rooms list') },
      },
    },
    components: {
      securitySchemes: { apiToken: { type: 'apiKey', in: 'header', name: 'X-API-Token' } },
    },
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400' } })
    }

    // ── GET /realtime/openapi.json — spec for registry auto-discovery ──────────
    if ((pathname === '/realtime/openapi.json' || pathname === '/openapi.json') && request.method === 'GET') {
      const origin = request.headers.get('origin') || `https://${url.hostname}`
      return createResponse(JSON.stringify(buildRealtimeOpenApiSpec(origin)))
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

        // Validate the caller's rooms against THEIR OWN RealtimeKit app
        // (falls back to the shared app for users without their own).
        const { appId, accountId, apiToken } = await getUserCloudflareCredentials(auth.email, env)

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

        // Provision the caller's permanent rooms in THEIR OWN RealtimeKit app.
        const { appId, accountId, apiToken } = await getUserCloudflareCredentials(auth.email, env)
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
          if (!resp.ok) {
            // Surface the Cloudflare error code/message so a stale/expired
            // user token (code 10000 = "Authentication error") is diagnosable
            // from the browser console instead of looking like a generic 500.
            const body = await resp.text()
            let cfMsg = body
            try {
              const j = JSON.parse(body)
              const e = j?.errors?.[0]
              if (e) cfMsg = `Cloudflare ${resp.status} code=${e.code} ${e.message}`
            } catch { /* leave raw */ }
            throw new Error(`Failed to create meeting in user's RealtimeKit app (account=${accountId}, app=${appId}): ${cfMsg}`)
          }
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

        // The meeting lives in its owner's app — operate there.
        const { appId, accountId, apiToken } = await getMeetingOwnerCredentials(meetingId, env)
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
        const { appId, accountId, apiToken } = await getMeetingOwnerCredentials(meetingId, env)

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

        // Ad-hoc meetings are created in the caller's OWN app (ownership row below).
        const { appId, accountId, apiToken } = await getUserCloudflareCredentials(auth.email, env)
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

        try {
          await env.vegvisr_org.prepare('INSERT OR REPLACE INTO meeting_ownership (meeting_id, owner_email, room_type) VALUES (?, ?, ?)')
            .bind(meetingId, auth.email, 'adhoc').run()
        } catch (e) { console.error('meeting_ownership insert failed for adhoc meeting:', e) }

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

        // Close the meeting in its owner's app.
        const { appId, accountId, apiToken } = await getMeetingOwnerCredentials(meetingId, env)
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

        // List meetings from the caller's OWN app.
        const { appId, accountId, apiToken } = await getUserCloudflareCredentials(auth.email, env)
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

        // Mint the join token in the app that OWNS this meeting (where it lives),
        // not the caller's app — a guest joining another user's room must get a
        // token for the owner's app.
        const { appId, accountId, apiToken } = await getMeetingOwnerCredentials(meetingId, env)
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
          .prepare('SELECT email, user_id, Role, Systemowner, display_name, emailVerificationToken, phone, phone_verified_at FROM config WHERE email = ?')
          .bind(targetEmail).first()
        if (!target) return createResponse(JSON.stringify({ error: 'User not found' }), 404)
        if (!target.emailVerificationToken) {
          return createResponse(JSON.stringify({ error: 'Target user has no auth token (never logged in via magic link). Send them a magic link first.' }), 400)
        }

        console.log(`[impersonate] systemowner=${auth.email} took over account=${target.email} (role=${target.Role})`)

        // Phone is consumer-app specific (chat reads localStorage.user.phone
        // to decide whether to render the messaging UI). Include it so an
        // impersonated user actually gets the same view they would on their
        // own login — without it, every impersonated session looks "no phone
        // linked" even when the target's row has one.
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
            phone: target.phone || null,
            phoneVerifiedAt: target.phone_verified_at || null,
          },
        }))
      } catch (e) {
        console.error('Error in /realtime/admin/impersonate:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── GET /realtime/debug/rtk-recordings ────────────────────────────────────
    // Raw RealtimeKit API response for debugging
    if (pathname === '/realtime/debug/rtk-recordings' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)

        const eff = await resolveEffectiveEmail(request, auth)
        if (!eff.ok) return createResponse(JSON.stringify({ error: eff.error }), eff.status)
        const effectiveEmail = eff.email

        const creds = await getUserCloudflareCredentials(effectiveEmail, env)
        const { appId, accountId, apiToken } = creds

        if (!appId || !accountId || !apiToken) {
          return createResponse(JSON.stringify({ error: 'RealtimeKit not configured', creds: { appId: !!appId, accountId: !!accountId, apiToken: !!apiToken } }), 400)
        }

        const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/recordings`
        console.error(`[DEBUG] Calling RealtimeKit API: ${url}`)
        const rtkResp = await fetch(url, { headers: { Authorization: `Bearer ${apiToken}` } })
        const rtkData = await rtkResp.json()

        console.error(`[DEBUG] RTK Response status: ${rtkResp.status}, recordings count: ${(rtkData.data || []).length}`)

        return createResponse(JSON.stringify({
          status: rtkResp.status,
          ok: rtkResp.ok,
          url,
          user: effectiveEmail,
          credentials: { appId: creds.appId, accountId: creds.accountId },
          realtimekit_response: rtkData,
        }), 200, { 'Content-Type': 'application/json' })
      } catch (e) {
        console.error('Error in /realtime/debug/rtk-recordings:', e)
        return createResponse(JSON.stringify({ error: e.message, stack: e.stack }), 500)
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
            // List realtime recordings AND stream recordings (Cloudflare Stream
            // broadcasts copied in under stream-recordings/). type distinguishes them.
            for (const prefix of ['recordings/', 'stream-recordings/']) {
              const isStream = prefix === 'stream-recordings/'
              const res = await r2List(creds.r2Bucket, prefix, creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId)
              if (!res.ok) continue
              const xml = await res.text()
              const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1])
              for (const key of keys) {
                // Skip the folder placeholder (a 0-byte marker object).
                if (!key || key === prefix || key.endsWith('/')) continue
                let playUrl = null
                let metadata = { title: '', labels: [], thumbnailUrl: '' }
                let size = 0
                let uploaded = null
                if (creds.r2PublicBase) {
                  // Permanent public URL (custom domain / r2.dev) — safe to embed in a node.
                  playUrl = `${creds.r2PublicBase.replace(/\/+$/, '')}/${key}`
                } else {
                  try {
                    playUrl = await r2PresignGet(creds.r2Bucket, key, creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId, 3600)
                  } catch (presignErr) { console.error('presign failed for', key, presignErr) }
                }
                try {
                  const headResp = await r2Head(creds.r2Bucket, key, creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId)
                  if (headResp.ok) {
                    metadata = normalizeRecordingMetadata({
                      title: headResp.headers.get('x-amz-meta-title') || '',
                      labels: headResp.headers.get('x-amz-meta-labels') || '',
                      thumbnailUrl: headResp.headers.get('x-amz-meta-thumbnailurl') || '',
                    })
                    size = Number(headResp.headers.get('content-length') || '0') || 0
                    uploaded = headResp.headers.get('last-modified') || null
                  }
                } catch (headErr) { console.error('own R2 head failed for', key, headErr) }
                recordings.push({
                  key,
                  name: key.replace(prefix, ''),
                  size,
                  uploaded,
                  source: isStream ? 'stream' : 'r2-own',
                  type: isStream ? 'stream' : 'realtime',
                  playUrl,
                  title: metadata.title,
                  labels: metadata.labels,
                  thumbnailUrl: metadata.thumbnailUrl,
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
            const rootListed = await env.MEETING_RECORDINGS.list({ limit: 200, include: ['customMetadata'] })
            for (const obj of rootListed.objects || []) {
              if (obj.key.startsWith('recordings/') || obj.key.endsWith('/')) continue
              const isStream = obj.key.startsWith('stream-recordings/')
              const name = isStream ? obj.key.replace('stream-recordings/', '') : obj.key
              const meta = normalizeRecordingMetadata(obj.customMetadata || {})
              recordings.push({
                key: obj.key,
                name,
                size: obj.size,
                uploaded: obj.uploaded,
                etag: obj.etag,
                customMetadata: obj.customMetadata || {},
                source: isStream ? 'stream' : 'r2',
                type: isStream ? 'stream' : 'realtime',
                // Build the URL without encoding the '/' between prefix and file.
                playUrl: isStream
                  ? `https://realtimevideos.vegvisr.org/stream-recordings/${encodeURIComponent(name)}`
                  : `https://realtimevideos.vegvisr.org/${encodeURIComponent(obj.key)}`,
                title: meta.title,
                labels: meta.labels,
                thumbnailUrl: meta.thumbnailUrl,
              })
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
              console.error(`[DEBUG] RealtimeKit API returned ${(rtkData.data || []).length} recordings for user ${effectiveEmail}`)
              const r2Keys = new Set(recordings.map((r) => r.name))
              const userHasOwnR2 = !!(creds.r2AccessKeyId && creds.r2Secret && creds.r2Bucket && creds.r2AccountId)

              // Restrict the RealtimeKit listing to meetings the effective user
              // owns — for impersonation AND for any non-Superadmin viewing their
              // own recordings. Only a Superadmin's own (non-impersonated) view
              // sees the full shared account. Without this, a non-Superadmin (e.g.
              // an Admin) would see EVERY recording in the shared RealtimeKit
              // account, not just their own.
              const filterByOwnership = eff.isImpersonating || auth.role !== 'Superadmin'
              const ownedMeetingIds = new Set()
              if (filterByOwnership) {
                try {
                  const ownedRows = await env.vegvisr_org.prepare('SELECT meeting_id FROM meeting_ownership WHERE owner_email = ?').bind(effectiveEmail).all()
                  for (const r of ownedRows.results || []) ownedMeetingIds.add(r.meeting_id)
                } catch (e) { console.error('meeting_ownership lookup failed:', e) }
              }

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
                if (!rec.meeting_id) {
                  console.error(`[DEBUG] Skipping recording ${rec.id}: no meeting_id`)
                  continue
                }
                // Show only recordings from owned meetings (except a Superadmin's
                // own unfiltered view — see filterByOwnership above).
                if (filterByOwnership && !ownedMeetingIds.has(rec.meeting_id)) {
                  console.error(`[DEBUG] Skipping recording ${rec.id} for meeting ${rec.meeting_id}: not owned by ${effectiveEmail}`)
                  continue
                }
                // For own-R2 users the R2 listing above is authoritative and already
                // carries a PERMANENT public playUrl. Skip the RealtimeKit duplicate of a
                // file already synced to R2 — its key is the RTK recording id (not the R2
                // object key), so it would otherwise surface a second entry whose playUrl
                // resolves to the wrong shared host. Shared-account users keep old behaviour.
                if (userHasOwnR2 && rec.output_file_name && r2Keys.has(rec.output_file_name)) {
                  console.error(`[DEBUG] Skipping RealtimeKit dup ${rec.id}: ${rec.output_file_name} already in own R2`)
                  continue
                }
                console.error(`[DEBUG] Adding recording ${rec.id} from meeting ${rec.meeting_id} (${rec.meeting?.title})`)
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
          // Always enforce ownership: only sync recordings of meetings this
          // user owns. If they own none, sync nothing (never copy the whole
          // shared RealtimeKit account into a user's bucket).
          if (!ownedMeetingIds.has(rec.meeting_id)) {
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

    // ── POST /realtime/recordings/stream-sync ──────────────────────────────────
    // Manual "sync now" for Cloudflare Stream recordings → R2 (mirrors /sync).
    // Body: { ownerEmail?, liveInputId? }. Defaults ownerEmail to the caller.
    if (pathname === '/realtime/recordings/stream-sync' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ success: false, error: auth.error }), 401)
        const body = await request.json().catch(() => ({}))
        const email = body.ownerEmail || auth.email
        if (!email) return createResponse(JSON.stringify({ success: false, error: 'No owner email' }), 400)
        const result = await enqueueStreamRecordings(email, env, { liveInputId: body.liveInputId || null })
        if (result.error) return createResponse(JSON.stringify({ success: false, ...result }), 400)
        return createResponse(JSON.stringify({ success: true, ...result }))
      } catch (e) {
        console.error('Error in /realtime/recordings/stream-sync:', e)
        return createResponse(JSON.stringify({ success: false, error: e.message }), 500)
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

        if (creds.r2PublicBase) {
          // Permanent public URL (custom domain / r2.dev) — no expiry, safe to embed.
          return createResponse(JSON.stringify({
            success: true,
            url: `${creds.r2PublicBase.replace(/\/+$/, '')}/${normalizedKey}`,
            source: 'r2-own',
            expiresAt: null,
          }))
        }

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

        const { filename, contentType, size, folder, title, labels } = await request.json()
        if (!filename || typeof filename !== 'string') return createResponse(JSON.stringify({ error: 'filename is required' }), 400)
        if (!size || typeof size !== 'number') return createResponse(JSON.stringify({ error: 'size is required' }), 400)
        const effectiveSize = Math.trunc(size)
        if (effectiveSize <= 0) return createResponse(JSON.stringify({ error: 'Uploaded file is empty' }), 400)
        if (effectiveSize > 25 * 1024 * 1024 * 1024) return createResponse(JSON.stringify({ error: 'Upload exceeds 25 GB limit' }), 400)
        const effectiveType = typeof contentType === 'string' && contentType.trim() ? contentType.trim() : 'video/mp4'
        if (!effectiveType.startsWith('video/')) {
          return createResponse(JSON.stringify({ error: 'Only video uploads are supported' }), 400)
        }

        // Only 'academy' (training videos for the Learn tab) is an allowed sub-folder; anything else
        // falls back to the flat recordings/ prefix.
        const subFolder = String(folder || '').trim().toLowerCase() === 'academy' ? 'academy' : ''
        const target = buildManualRecordingTarget(filename, effectiveType, subFolder)
        const customMetadata = {
          uploadedBy: auth.email || '',
          uploadedAt: new Date().toISOString(),
          source: subFolder === 'academy' ? 'vemotion-training' : 'manual',
          originalFilename: filename || target.name,
        }
        if (typeof title === 'string' && title.trim()) customMetadata.title = title.trim().slice(0, 200)
        const labelStr = typeof labels === 'string' && labels.trim() ? labels.trim() : (subFolder === 'academy' ? 'academy' : '')
        if (labelStr) customMetadata.labels = labelStr.slice(0, 200)
        const upload = await env.MEETING_RECORDINGS.createMultipartUpload(target.key, {
          httpMetadata: { contentType: effectiveType },
          customMetadata,
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
        if (!canManageRecordings(auth.role)) return createResponse(JSON.stringify({ error: 'Admin or Superadmin access required' }), 403)

        const body = await request.json()
        const { key, newName } = body || {}
        if (!key || !newName || typeof newName !== 'string' || !newName.trim()) return createResponse(JSON.stringify({ error: 'key and newName are required' }), 400)

        // Operate on the caller's own bucket; asUser is Superadmin-only.
        const eff = await resolveEffectiveEmail(request, auth, body?.asUser)
        if (!eff.ok) return createResponse(JSON.stringify({ error: eff.error }), eff.status)
        const creds = await getUserCloudflareCredentials(eff.email, env)
        const useOwnR2 = !!(creds.r2AccessKeyId && creds.r2Secret && creds.r2Bucket && creds.r2AccountId)

        const newKey = 'recordings/' + newName.trim()
        if (useOwnR2) {
          const getResp = await r2Get(creds.r2Bucket, key, creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId)
          if (!getResp.ok) return createResponse(JSON.stringify({ error: 'Recording not found in user R2 bucket' }), 404)
          const contentType = getResp.headers.get('content-type') || 'video/mp4'
          const bodyBuffer = await getResp.arrayBuffer()
          const meta = {}
          for (const [hk, hv] of getResp.headers.entries()) {
            if (hk.startsWith('x-amz-meta-')) meta[hk.slice('x-amz-meta-'.length)] = hv
          }
          const putResp = await r2Put(creds.r2Bucket, newKey, bodyBuffer, contentType, meta, creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId)
          if (!putResp.ok) {
            const t = await putResp.text()
            return createResponse(JSON.stringify({ error: 'Failed to write renamed object to user R2 bucket', details: t }), 502)
          }
          const delResp = await r2Delete(creds.r2Bucket, key, creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId)
          if (!delResp.ok && delResp.status !== 404) {
            const t = await delResp.text()
            return createResponse(JSON.stringify({ error: 'Renamed copy created but failed to delete original', details: t }), 502)
          }
        } else {
          if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)
          const sourceObj = await env.MEETING_RECORDINGS.get(key)
          if (!sourceObj) return createResponse(JSON.stringify({ error: 'Recording not found' }), 404)
          await env.MEETING_RECORDINGS.put(newKey, sourceObj.body, { httpMetadata: sourceObj.httpMetadata, customMetadata: sourceObj.customMetadata || {} })
          await env.MEETING_RECORDINGS.delete(key)
        }
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
        if (!canManageRecordings(auth.role)) return createResponse(JSON.stringify({ error: 'Admin or Superadmin access required' }), 403)

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
        const effEm = await resolveEffectiveEmail(request, auth, body?.asUser)
        if (!effEm.ok) return createResponse(JSON.stringify({ error: effEm.error }), effEm.status)
        const effectiveEmail = effEm.email
        const creds = await getUserCloudflareCredentials(effectiveEmail, env)

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

        const customMetadata = {
          title,
          labels: labels.join(', '),
          thumbnailUrl,
          updatedBy: auth.email || '',
          updatedAt: new Date().toISOString(),
        }

        if (creds.r2AccessKeyId && creds.r2Secret && creds.r2Bucket && creds.r2AccountId) {
          const getResp = await r2Get(creds.r2Bucket, key, creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId)
          if (!getResp.ok) return createResponse(JSON.stringify({ error: 'Recording not found in user R2 bucket' }), 404)
          const contentType = getResp.headers.get('content-type') || 'video/mp4'
          const bodyBuffer = await getResp.arrayBuffer()
          const putResp = await r2Put(
            creds.r2Bucket,
            key,
            bodyBuffer,
            contentType,
            customMetadata,
            creds.r2AccessKeyId,
            creds.r2Secret,
            creds.r2AccountId
          )
          if (!putResp.ok) {
            const errText = await putResp.text()
            return createResponse(JSON.stringify({ error: 'Failed to update user R2 metadata', details: errText }), 502)
          }
        } else {
          if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)
          const obj = await env.MEETING_RECORDINGS.get(key)
          if (!obj) return createResponse(JSON.stringify({ error: 'Recording not found' }), 404)

          await env.MEETING_RECORDINGS.put(key, obj.body, {
            httpMetadata: obj.httpMetadata,
            customMetadata: {
              ...(obj.customMetadata || {}),
              ...customMetadata,
            },
          })
        }

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

    // ── Academy (training-video) lifecycle ─────────────────────────────────────
    // Academy videos always live in the shared MEETING_RECORDINGS bucket under
    // recordings/academy/ (the upload endpoints force that bucket). These three
    // endpoints therefore operate ONLY on MEETING_RECORDINGS — they do NOT branch
    // on per-user R2 creds, so an admin who has personal R2 creds can still manage
    // academy videos. Lifecycle fields live in the R2 object's customMetadata:
    //   status     'draft' | 'published'   (absent ⇒ treated as 'published')
    //   audience   JSON string: {"mode":"all"} | {"mode":"founders"} | {"mode":"emails","list":[...]}
    //   releaseAt  ISO 8601 or ''           (hidden before this instant)
    //   endAt      ISO 8601 or ''           (hidden after this instant)

    // GET /realtime/recordings/academy[?admin=1]
    // Viewer mode (default): any authenticated caller; returns only videos visible
    // to them (published + in-window + audience match). admin=1: Admin/Superadmin
    // only; returns ALL academy videos with their full lifecycle metadata.
    if (pathname === '/realtime/recordings/academy' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)

        const url = new URL(request.url)
        const adminMode = url.searchParams.get('admin') === '1'
        if (adminMode && !canManageRecordings(auth.role)) {
          return createResponse(JSON.stringify({ error: 'Admin or Superadmin access required' }), 403)
        }

        // List the academy prefix with customMetadata. The academy set is small,
        // so a single (paginated) listing with client-side filtering is fine.
        const items = []
        let cursor
        do {
          const page = await env.MEETING_RECORDINGS.list({
            prefix: 'recordings/academy/',
            include: ['customMetadata', 'httpMetadata'],
            limit: 1000,
            cursor,
          })
          for (const obj of page.objects) {
            if (obj.key.endsWith('/')) continue // skip folder placeholder
            items.push(obj)
          }
          cursor = page.truncated ? page.cursor : undefined
        } while (cursor)

        const viewerEmail = String(auth.email || '').trim().toLowerCase()
        let viewerIsFounder = null // resolved lazily, once, only if a 'founders' video is seen
        const isFounder = async () => {
          if (viewerIsFounder !== null) return viewerIsFounder
          if (!viewerEmail) { viewerIsFounder = false; return false }
          try {
            const row = await env.vegvisr_org
              .prepare("SELECT 1 AS ok FROM world_founders WHERE lower(founder_email) = ? AND status = 'active' LIMIT 1")
              .bind(viewerEmail)
              .first()
            viewerIsFounder = !!row
          } catch (e) {
            console.error('world_founders lookup failed:', e)
            viewerIsFounder = false
          }
          return viewerIsFounder
        }

        const nowMs = Date.now()
        const out = []
        for (const obj of items) {
          const meta = obj.customMetadata || {}
          const status = (meta.status || 'published').toLowerCase() // absent ⇒ published
          let audience = { mode: 'all' }
          if (meta.audience) {
            try {
              const parsed = JSON.parse(meta.audience)
              if (parsed && typeof parsed.mode === 'string') audience = parsed
            } catch { /* malformed ⇒ treat as all */ }
          }
          const releaseAt = String(meta.releaseAt || '')
          const endAt = String(meta.endAt || '')
          const name = obj.key.replace(/^recordings\//, '')
          const labels = String(meta.labels || '')
            .split(',').map((s) => s.trim()).filter(Boolean)
          const playUrl = `https://realtimevideos.vegvisr.org/${obj.key}`
          const base = {
            key: obj.key,
            name,
            // `url` / `fileName` / `thumbnailUrl` / `duration` mirror the field
            // names the me-page Learn-tab template already renders, so swapping it
            // to this endpoint needs no template-render changes.
            url: playUrl,
            fileName: name,
            title: meta.title || name,
            labels,
            playUrl,
            thumbnailUrl: meta.thumbnailUrl || '',
            duration: meta.duration ? Number(meta.duration) : undefined,
            uploaded: obj.uploaded,
            size: obj.size,
          }

          if (adminMode) {
            out.push({
              ...base,
              status,
              audience,
              releaseAt,
              endAt,
              uploadedBy: meta.uploadedBy || '',
            })
            continue
          }

          // Viewer mode — apply the full visibility gate.
          if (status === 'draft') continue
          if (releaseAt && nowMs < Date.parse(releaseAt)) continue
          if (endAt && nowMs > Date.parse(endAt)) continue
          let visible = false
          if (audience.mode === 'all') {
            visible = true
          } else if (audience.mode === 'founders') {
            visible = await isFounder()
          } else if (audience.mode === 'emails') {
            const list = Array.isArray(audience.list) ? audience.list.map((e) => String(e).trim().toLowerCase()) : []
            visible = !!viewerEmail && list.includes(viewerEmail)
          }
          if (visible) out.push(base)
        }

        // Newest first.
        out.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime())
        return createResponse(JSON.stringify({ success: true, recordings: out }))
      } catch (e) {
        console.error('Error in GET /realtime/recordings/academy:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // POST /realtime/recordings/academy/meta — patch lifecycle fields on one academy
    // video. Only the provided fields are changed; existing customMetadata (title,
    // labels, uploadedBy, …) is preserved (Lesson 21: merge, never rebuild).
    if (pathname === '/realtime/recordings/academy/meta' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!canManageRecordings(auth.role)) return createResponse(JSON.stringify({ error: 'Admin or Superadmin access required' }), 403)
        if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)

        const body = await request.json()
        const key = String(body.key || '')
        if (!key.startsWith('recordings/academy/')) {
          return createResponse(JSON.stringify({ error: 'key must be an academy recording (recordings/academy/…)' }), 400)
        }

        // Build a patch of ONLY the provided fields.
        const patch = {}
        if (body.status !== undefined) {
          const status = String(body.status).toLowerCase()
          if (status !== 'draft' && status !== 'published') {
            return createResponse(JSON.stringify({ error: "status must be 'draft' or 'published'" }), 400)
          }
          patch.status = status
        }
        if (body.audience !== undefined) {
          const a = typeof body.audience === 'string' ? safeJsonParse(body.audience) : body.audience
          if (!a || typeof a.mode !== 'string' || !['all', 'founders', 'emails'].includes(a.mode)) {
            return createResponse(JSON.stringify({ error: "audience.mode must be 'all', 'founders', or 'emails'" }), 400)
          }
          const normalized = { mode: a.mode }
          if (a.mode === 'emails') {
            const list = Array.isArray(a.list) ? a.list : []
            normalized.list = list
              .map((e) => String(e || '').trim().toLowerCase())
              .filter((e) => e.includes('@'))
              .slice(0, 500)
          }
          patch.audience = JSON.stringify(normalized)
        }
        if (body.releaseAt !== undefined) {
          patch.releaseAt = normalizeIsoOrEmpty(body.releaseAt)
        }
        if (body.endAt !== undefined) {
          patch.endAt = normalizeIsoOrEmpty(body.endAt)
        }
        if (Object.keys(patch).length === 0) {
          return createResponse(JSON.stringify({ error: 'No fields to update' }), 400)
        }
        patch.updatedBy = auth.email || ''
        patch.updatedAt = new Date().toISOString()

        const obj = await env.MEETING_RECORDINGS.get(key)
        if (!obj) return createResponse(JSON.stringify({ error: 'Recording not found' }), 404)
        await env.MEETING_RECORDINGS.put(key, obj.body, {
          httpMetadata: obj.httpMetadata,
          customMetadata: {
            ...(obj.customMetadata || {}), // preserve title/labels/uploadedBy/etc
            ...patch,
          },
        })

        const merged = { ...(obj.customMetadata || {}), ...patch }
        return createResponse(JSON.stringify({
          success: true,
          key,
          status: merged.status || 'published',
          audience: merged.audience ? safeJsonParse(merged.audience) || { mode: 'all' } : { mode: 'all' },
          releaseAt: merged.releaseAt || '',
          endAt: merged.endAt || '',
        }))
      } catch (e) {
        console.error('Error in POST /realtime/recordings/academy/meta:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // POST /realtime/recordings/academy/delete — delete one academy video from the
    // shared bucket (no per-user R2 branch, unlike /recordings/delete).
    if (pathname === '/realtime/recordings/academy/delete' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!canManageRecordings(auth.role)) return createResponse(JSON.stringify({ error: 'Admin or Superadmin access required' }), 403)
        if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)

        const body = await request.json()
        const key = String(body.key || '')
        if (!key.startsWith('recordings/academy/')) {
          return createResponse(JSON.stringify({ error: 'key must be an academy recording (recordings/academy/…)' }), 400)
        }
        await env.MEETING_RECORDINGS.delete(key)
        return createResponse(JSON.stringify({ success: true, key }))
      } catch (e) {
        console.error('Error in POST /realtime/recordings/academy/delete:', e)
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/recordings/delete ───────────────────────────────────────
    if (pathname === '/realtime/recordings/delete' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        if (!canManageRecordings(auth.role)) return createResponse(JSON.stringify({ error: 'Admin or Superadmin access required' }), 403)

        const body = await request.json()
        const { key } = body || {}
        if (!key) return createResponse(JSON.stringify({ error: 'key is required' }), 400)

        // Operate on the caller's own bucket; asUser is Superadmin-only.
        const eff = await resolveEffectiveEmail(request, auth, body?.asUser)
        if (!eff.ok) return createResponse(JSON.stringify({ error: eff.error }), eff.status)
        const creds = await getUserCloudflareCredentials(eff.email, env)
        const useOwnR2 = !!(creds.r2AccessKeyId && creds.r2Secret && creds.r2Bucket && creds.r2AccountId)

        if (useOwnR2) {
          const headResp = await r2Head(creds.r2Bucket, key, creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId)
          if (!headResp.ok) return createResponse(JSON.stringify({ error: 'Recording not found in user R2 bucket' }), 404)
          const delResp = await r2Delete(creds.r2Bucket, key, creds.r2AccessKeyId, creds.r2Secret, creds.r2AccountId)
          if (!delResp.ok && delResp.status !== 404) {
            const t = await delResp.text()
            return createResponse(JSON.stringify({ error: 'Failed to delete from user R2 bucket', details: t }), 502)
          }
        } else {
          if (!env.MEETING_RECORDINGS) return createResponse(JSON.stringify({ error: 'Recordings bucket not configured' }), 500)
          const obj = await env.MEETING_RECORDINGS.head(key)
          if (!obj) return createResponse(JSON.stringify({ error: 'Recording not found' }), 404)
          await env.MEETING_RECORDINGS.delete(key)
        }
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

    // ── GET /realtime/telemetry/selftest ─ Slice 1: per-owner KV provisioning check
    // Proves KV access with a PUT → GET → DELETE round-trip against the owner's own
    // namespace. Superadmin / System Owner may target another owner via ?email=;
    // everyone else tests their own creds. No "done" without this passing (Lesson 1).
    if (pathname === '/realtime/telemetry/selftest' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        const isPriv = auth.isSystemOwner || auth.role === 'Superadmin'
        const targetEmail = (isPriv && url.searchParams.get('email')) || auth.email
        const creds = await getUserCloudflareCredentials(targetEmail, env)
        if (!kvConfigured(creds)) {
          return createResponse(JSON.stringify({
            success: false, configured: false, email: targetEmail,
            error: `No KV creds for ${targetEmail} — set cf_kv_namespace_id + cf_kv_token in config`,
          }), 400)
        }
        const probeKey = `tel:selftest:${targetEmail}`
        const probeVal = JSON.stringify({ ok: true, by: auth.email })
        const put = await kvPut(creds, probeKey, probeVal)
        if (!put.ok) {
          return createResponse(JSON.stringify({ success: false, step: 'put', status: put.status, body: await put.text() }), 502)
        }
        const get = await kvGet(creds, probeKey)
        const got = get.ok ? await get.text() : null
        const del = await kvDelete(creds, probeKey)
        const after = await kvGet(creds, probeKey)
        return createResponse(JSON.stringify({
          success: put.ok && get.ok && got === probeVal && del.ok && after.status === 404,
          email: targetEmail, namespaceId: creds.kvNamespaceId,
          put: put.status, get: get.status, matched: got === probeVal,
          delete: del.status, afterDelete: after.status,
        }))
      } catch (e) {
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/telemetry ─ Slice 2: host-browser capture sink ─────────
    // The host's browser batches participant events (join/leave/mute/video/
    // speaking) and flushes them here every ~10 s. Events land in the MEETING
    // OWNER's KV (getMeetingOwnerCredentials), keyed by meetingId + sessionId, as
    // an append-only batch (new key per flush — no read-modify-write race on the
    // log). Owners without KV creds are a silent no-op, not an error.
    // Trust model (PLAN anti-goal): we trust the host client; any valid token may
    // POST for a meetingId. Tightening to verified-host is a later slice.
    if (pathname === '/realtime/telemetry' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        const { meetingId, sessionId, events } = await request.json()
        if (!meetingId || !sessionId || !Array.isArray(events)) {
          return createResponse(JSON.stringify({ error: 'meetingId, sessionId, events[] required' }), 400)
        }
        if (events.length === 0) return createResponse(JSON.stringify({ success: true, stored: 0 }))
        const creds = await getMeetingOwnerCredentials(meetingId, env)
        if (!kvConfigured(creds)) {
          return createResponse(JSON.stringify({ success: true, stored: 0, reason: 'owner has no telemetry KV' }))
        }
        const batchTs = Date.now()
        const key = `tel:${meetingId}:${sessionId}:events:${batchTs}`
        const put = await kvPut(creds, key, JSON.stringify({ meetingId, sessionId, writtenAt: batchTs, by: auth.email, events }))
        if (!put.ok) {
          return createResponse(JSON.stringify({ success: false, step: 'put', status: put.status, body: await put.text() }), 502)
        }
        // Lightweight session index so the read API (Slice 4) can enumerate
        // sessions without a full KV list. RMW is safe under 1A (single host).
        try {
          const idxKey = `tel:${meetingId}:index`
          const idxResp = await kvGet(creds, idxKey)
          let idx = { sessions: {} }
          if (idxResp.ok) { try { idx = JSON.parse(await idxResp.text()) } catch { idx = { sessions: {} } } }
          if (!idx.sessions) idx.sessions = {}
          const s = idx.sessions[sessionId] || { startedAt: batchTs, hostEmail: auth.email }
          s.lastSeen = batchTs
          s.eventCount = (s.eventCount || 0) + events.length
          idx.sessions[sessionId] = s
          await kvPut(creds, idxKey, JSON.stringify(idx))
        } catch (e) { console.error('[telemetry] index upsert failed:', e) }
        return createResponse(JSON.stringify({ success: true, stored: events.length, key }))
      } catch (e) {
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── POST /realtime/telemetry/rollup ─ Slice 3: session summary on close ────
    // Called when the host leaves/closes. Optional `events` = the host's final
    // un-flushed buffer (written as a last batch so nothing is lost). Then reads
    // every events:* batch for the session, computes the per-participant summary,
    // writes `tel:{meetingId}:{sessionId}:summary`, and stamps `endedAt` on the
    // session index. Idempotent — re-running just recomputes from the same log.
    if (pathname === '/realtime/telemetry/rollup' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) return createResponse(JSON.stringify({ error: auth.error }), 401)
        const { meetingId, sessionId, events, endedAt: bodyEndedAt } = await request.json()
        if (!meetingId || !sessionId) {
          return createResponse(JSON.stringify({ error: 'meetingId and sessionId required' }), 400)
        }
        const creds = await getMeetingOwnerCredentials(meetingId, env)
        if (!kvConfigured(creds)) {
          return createResponse(JSON.stringify({ success: true, stored: false, reason: 'owner has no telemetry KV' }))
        }
        // Persist the final tail batch first, so the rollup sees the last events.
        if (Array.isArray(events) && events.length) {
          const ts = Date.now()
          await kvPut(creds, `tel:${meetingId}:${sessionId}:events:${ts}`,
            JSON.stringify({ meetingId, sessionId, writtenAt: ts, by: auth.email, events }))
        }
        // Gather the whole event log for this session.
        const listResp = await kvList(creds, `tel:${meetingId}:${sessionId}:events:`)
        let keys = []
        if (listResp.ok) { try { keys = ((await listResp.json()).result || []).map((k) => k.name) } catch { keys = [] } }
        const all = []
        for (const k of keys) {
          const r = await kvGet(creds, k)
          if (r.ok) { try { const b = JSON.parse(await r.text()); if (Array.isArray(b.events)) all.push(...b.events) } catch { /* skip bad batch */ } }
        }
        // startedAt / hostEmail from the index when available.
        let startedAt = null, hostEmail = auth.email
        let idx = { sessions: {} }
        try {
          const ir = await kvGet(creds, `tel:${meetingId}:index`)
          if (ir.ok) { idx = JSON.parse(await ir.text()); if (!idx.sessions) idx.sessions = {} }
          const si = idx.sessions[sessionId]
          if (si) { startedAt = si.startedAt ?? null; hostEmail = si.hostEmail || hostEmail }
        } catch { idx = { sessions: {} } }
        const tsList = all.map((e) => e && e.ts).filter((n) => typeof n === 'number')
        const maxTs = tsList.length ? Math.max(...tsList) : null
        if (startedAt == null) startedAt = tsList.length ? Math.min(...tsList) : Date.now()
        // endedAt: client's close time wins (true tail), else a prior rollup's
        // value (stable on recompute), else last event. Never before last event.
        const existingEnded = idx.sessions?.[sessionId]?.endedAt
        let endedAt = (typeof bodyEndedAt === 'number') ? bodyEndedAt
          : (existingEnded != null ? existingEnded : (maxTs != null ? maxTs : startedAt))
        if (maxTs != null) endedAt = Math.max(endedAt, maxTs)
        const summary = computeSessionSummary(meetingId, sessionId, hostEmail, all, startedAt, endedAt)
        await kvPut(creds, `tel:${meetingId}:${sessionId}:summary`, JSON.stringify(summary))
        // Stamp endedAt + summarized on the index.
        try {
          if (!idx.sessions) idx.sessions = {}
          const si = idx.sessions[sessionId] || { startedAt, hostEmail }
          si.endedAt = endedAt; si.summarized = true
          idx.sessions[sessionId] = si
          await kvPut(creds, `tel:${meetingId}:index`, JSON.stringify(idx))
        } catch (e) { console.error('[telemetry] rollup index stamp failed:', e) }
        return createResponse(JSON.stringify({ success: true, batches: keys.length, events: all.length, summary }))
      } catch (e) {
        return createResponse(JSON.stringify({ error: e.message }), 500)
      }
    }

    // ── Custom Slug Endpoints ─────────────────────────────────────────────────
    if (pathname === '/realtime/validate-slug' && request.method === 'POST') {
      try {
        const { slug, userEmail, requestJoinToken, shareToken } = await request.json()
        if (!slug) {
          return createResponse(JSON.stringify({ success: false, error: 'Missing slug' }), 400)
        }

        // ── Share-token path: bypasses email allowlist entirely ───────────────
        // The token is valid only inside [valid_from, valid_until] and only if
        // the slug is still active. We snapshot meeting_id at mint time so
        // re-pointing the slug afterwards doesn't change behaviour for tokens
        // already in the wild.
        if (shareToken) {
          const tokRow = await env.vegvisr_org
            .prepare(`SELECT t.id, t.meeting_id, t.valid_from, t.valid_until, t.revoked_at,
                             s.slug as slug_name, s.owner_email, s.active
                      FROM slug_share_tokens t
                      JOIN custom_room_slugs s ON s.id = t.slug_id
                      WHERE t.id = ?`)
            .bind(shareToken).first()
          if (!tokRow) {
            return createResponse(JSON.stringify({ success: false, error: 'Invalid or unknown share link' }), 403)
          }
          if (tokRow.revoked_at) {
            return createResponse(JSON.stringify({ success: false, error: 'This share link has been revoked' }), 403)
          }
          if (!tokRow.active) {
            return createResponse(JSON.stringify({ success: false, error: 'This room has been deactivated' }), 403)
          }
          if (tokRow.slug_name !== slug) {
            return createResponse(JSON.stringify({ success: false, error: 'Share link does not match this room' }), 403)
          }
          const nowIso = new Date().toISOString()
          if (nowIso < tokRow.valid_from) {
            return createResponse(JSON.stringify({ success: false, error: 'This share link is not active yet', validFrom: tokRow.valid_from }), 403)
          }
          if (nowIso > tokRow.valid_until) {
            return createResponse(JSON.stringify({ success: false, error: 'This share link has expired', validUntil: tokRow.valid_until }), 403)
          }

          // Mint a RealtimeKit participant token using the owner's RTK config
          const ownerCreds = await getUserCloudflareCredentials(tokRow.owner_email, env)
          if (!ownerCreds.appId || !ownerCreds.accountId || !ownerCreds.apiToken) {
            return createResponse(JSON.stringify({ success: false, error: 'RealtimeKit not configured for room owner' }), 500)
          }
          const guestSuffix = shareToken.slice(0, 8)
          const presetName = env.REALTIMEKIT_PRESET_NAME || 'group_call_participant'
          const payload = {
            custom_participant_id: `slug-share-${guestSuffix}`,
            preset_name: presetName,
            name: 'Guest',
          }
          const rtResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${ownerCreds.accountId}/realtime/kit/${ownerCreds.appId}/meetings/${encodeURIComponent(tokRow.meeting_id)}/participants`,
            { method: 'POST', headers: { Authorization: `Bearer ${ownerCreds.apiToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
          )
          if (!rtResponse.ok) {
            const errText = await rtResponse.text()
            return createResponse(JSON.stringify({ success: false, error: 'RealtimeKit API error', details: errText }), 502)
          }
          const rtData = await rtResponse.json()
          const authToken = rtData?.data?.token
          if (!authToken) {
            return createResponse(JSON.stringify({ success: false, error: 'No token in RealtimeKit response' }), 502)
          }
          return createResponse(JSON.stringify({
            success: true,
            meetingId: tokRow.meeting_id,
            ownerEmail: tokRow.owner_email,
            authToken,
            displayName: 'Guest',
            isRegisteredUser: false,
            viaShareToken: true,
          }), 200)
        }

        // ── Email-allowlist path (original behaviour) ──────────────────────────
        if (!userEmail) {
          return createResponse(JSON.stringify({ success: false, error: 'Missing userEmail' }), 400)
        }
        const normalizedEmail = String(userEmail).trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          return createResponse(JSON.stringify({ success: false, error: 'Invalid email format' }), 400)
        }
        const row = await env.vegvisr_org
          .prepare('SELECT id, meeting_id, owner_email, allowed_emails FROM custom_room_slugs WHERE slug = ? AND active = 1')
          .bind(slug).first()
        if (!row) {
          return createResponse(JSON.stringify({ success: false, error: 'Slug not found' }), 400)
        }
        const allowedEmails = JSON.parse(row.allowed_emails).map(e => String(e).trim().toLowerCase())
        if (!allowedEmails.includes(normalizedEmail)) {
          return createResponse(JSON.stringify({
            success: false,
            ownerEmail: row.owner_email,
            error: 'Not approved for this slug',
          }), 403)
        }

        // Look up the email in config table — if registered, use their display_name and user_id.
        // Otherwise use email's local-part and a guest-prefixed participant id.
        let displayName = normalizedEmail.split('@')[0]
        let registeredUserId = null
        let isRegisteredUser = false
        try {
          const userRow = await env.vegvisr_org
            .prepare('SELECT user_id, display_name FROM config WHERE LOWER(email) = ?')
            .bind(normalizedEmail).first()
          if (userRow) {
            isRegisteredUser = true
            registeredUserId = userRow.user_id || null
            if (userRow.display_name) displayName = userRow.display_name
          }
        } catch (e) {
          console.error('config lookup error (falling back to email local-part):', e)
        }

        // Only generate a RealtimeKit participant token when the caller asks for it (guest flow).
        // Logged-in users will fetch their own token via /realtime/join-token afterwards.
        if (!requestJoinToken) {
          return createResponse(JSON.stringify({
            success: true,
            meetingId: row.meeting_id,
            ownerEmail: row.owner_email,
            displayName,
            isRegisteredUser,
          }), 200)
        }

        // Approved + guest mode — generate RealtimeKit participant token using owner's RealtimeKit config
        const ownerCreds = await getUserCloudflareCredentials(row.owner_email, env)
        const appId = ownerCreds.appId
        const accountId = ownerCreds.accountId
        const apiToken = ownerCreds.apiToken
        if (!appId || !accountId || !apiToken) {
          return createResponse(JSON.stringify({ success: false, error: 'RealtimeKit not configured for room owner' }), 500)
        }

        const presetName = env.REALTIMEKIT_PRESET_NAME || 'group_call_participant'
        const participantId = registeredUserId || `slug-guest-${normalizedEmail}`
        const payload = {
          custom_participant_id: participantId,
          preset_name: presetName,
          name: displayName,
        }

        const rtResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings/${encodeURIComponent(row.meeting_id)}/participants`,
          { method: 'POST', headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        )
        if (!rtResponse.ok) {
          const errText = await rtResponse.text()
          return createResponse(JSON.stringify({ success: false, error: 'RealtimeKit API error', details: errText }), 502)
        }
        const rtData = await rtResponse.json()
        const authToken = rtData?.data?.token
        if (!authToken) {
          return createResponse(JSON.stringify({ success: false, error: 'No token in RealtimeKit response' }), 502)
        }

        return createResponse(JSON.stringify({
          success: true,
          meetingId: row.meeting_id,
          ownerEmail: row.owner_email,
          authToken,
          displayName,
          isRegisteredUser,
        }), 200)
      } catch (e) {
        return createResponse(JSON.stringify({ success: false, error: e.message }), 500)
      }
    }

    if (pathname === '/realtime/slugs/create' && request.method === 'POST') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) {
          return createResponse(JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }), 401)
        }
        if (!canManageSlugs(auth.role)) {
          return createResponse(JSON.stringify({ success: false, error: 'Forbidden: Admin or Superadmin role required' }), 403)
        }
        const user = { email: auth.email }
        const { slug, meetingId, allowedEmails, scheduledStartAt } = await request.json()
        if (!slug || !meetingId || !allowedEmails) {
          return createResponse(JSON.stringify({ success: false, error: 'Missing required fields' }), 400)
        }
        if (!/^[a-z0-9\-]{3,50}$/.test(slug) || /^-|-$|--/.test(slug)) {
          return createResponse(JSON.stringify({ success: false, error: 'Invalid slug format' }), 400)
        }
        if (!Array.isArray(allowedEmails) || allowedEmails.length === 0) {
          return createResponse(JSON.stringify({ success: false, error: 'allowedEmails must be a non-empty array' }), 400)
        }
        for (const email of allowedEmails) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return createResponse(JSON.stringify({ success: false, error: `Invalid email format: ${email}` }), 400)
          }
        }
        // Optional scheduledStartAt: ISO datetime string. We just store what we're given.
        let scheduledIso = null
        if (scheduledStartAt != null && scheduledStartAt !== '') {
          const d = new Date(scheduledStartAt)
          if (isNaN(d.getTime())) {
            return createResponse(JSON.stringify({ success: false, error: 'Invalid scheduledStartAt (not a date)' }), 400)
          }
          scheduledIso = d.toISOString()
        }
        const existing = await env.vegvisr_org.prepare('SELECT id FROM custom_room_slugs WHERE slug = ?').bind(slug).first()
        if (existing) {
          return createResponse(JSON.stringify({ success: false, error: 'Slug already exists' }), 409)
        }
        const slugId = crypto.randomUUID()
        const now = new Date().toISOString()
        await env.vegvisr_org
          .prepare('INSERT INTO custom_room_slugs (id, slug, meeting_id, owner_email, allowed_emails, created_at, updated_at, active, scheduled_start_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)')
          .bind(slugId, slug, meetingId, user.email, JSON.stringify(allowedEmails), now, now, scheduledIso).run()
        return createResponse(JSON.stringify({ success: true, slugId }), 201)
      } catch (e) {
        return createResponse(JSON.stringify({ success: false, error: e.message }), 500)
      }
    }

    if (pathname === '/realtime/slugs' && request.method === 'GET') {
      try {
        const auth = await validateWorkerApiToken(request, env)
        if (!auth.valid) {
          return createResponse(JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }), 401)
        }
        if (!canManageSlugs(auth.role)) {
          return createResponse(JSON.stringify({ success: false, error: 'Forbidden: Admin or Superadmin role required' }), 403)
        }
        const user = { email: auth.email }
        const result = await env.vegvisr_org
          .prepare('SELECT id, slug, meeting_id, owner_email, allowed_emails, active, created_at, scheduled_start_at FROM custom_room_slugs WHERE owner_email = ? AND active = 1 ORDER BY created_at DESC')
          .bind(user.email).all()
        const slugs = result.results.map(row => ({
          id: row.id,
          slug: row.slug,
          meetingId: row.meeting_id,
          ownerEmail: row.owner_email,
          allowedEmails: JSON.parse(row.allowed_emails),
          active: row.active === 1,
          createdAt: row.created_at,
          scheduledStartAt: row.scheduled_start_at,
        }))
        return createResponse(JSON.stringify({ success: true, slugs }), 200)
      } catch (e) {
        return createResponse(JSON.stringify({ success: false, error: e.message }), 500)
      }
    }

    {
      const updateMatch = pathname.match(/^\/realtime\/slugs\/([^/]+)\/update$/)
      if (updateMatch && request.method === 'POST') {
        try {
          const slugId = updateMatch[1]
          const auth = await validateWorkerApiToken(request, env)
          if (!auth.valid) {
            return createResponse(JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }), 401)
          }
          if (!canManageSlugs(auth.role)) {
            return createResponse(JSON.stringify({ success: false, error: 'Forbidden: Admin or Superadmin role required' }), 403)
          }
          const user = { email: auth.email }
          const ownerRow = await env.vegvisr_org.prepare('SELECT owner_email FROM custom_room_slugs WHERE id = ?').bind(slugId).first()
          if (!ownerRow) return createResponse(JSON.stringify({ success: false, error: 'Slug not found' }), 404)
          if (ownerRow.owner_email !== user.email) return createResponse(JSON.stringify({ success: false, error: 'Forbidden: You do not own this slug' }), 403)
          const { allowedEmails, meetingId, scheduledStartAt } = await request.json()
          const updates = []
          const binds = []
          if (allowedEmails !== undefined) {
            if (!Array.isArray(allowedEmails) || allowedEmails.length === 0) {
              return createResponse(JSON.stringify({ success: false, error: 'allowedEmails must be a non-empty array' }), 400)
            }
            for (const email of allowedEmails) {
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return createResponse(JSON.stringify({ success: false, error: `Invalid email format: ${email}` }), 400)
              }
            }
            updates.push('allowed_emails = ?')
            binds.push(JSON.stringify(allowedEmails))
          }
          if (meetingId !== undefined) {
            updates.push('meeting_id = ?')
            binds.push(meetingId)
          }
          if (scheduledStartAt !== undefined) {
            if (scheduledStartAt === null || scheduledStartAt === '') {
              updates.push('scheduled_start_at = NULL')
            } else {
              const d = new Date(scheduledStartAt)
              if (isNaN(d.getTime())) {
                return createResponse(JSON.stringify({ success: false, error: 'Invalid scheduledStartAt (not a date)' }), 400)
              }
              updates.push('scheduled_start_at = ?')
              binds.push(d.toISOString())
            }
          }
          if (updates.length === 0) {
            return createResponse(JSON.stringify({ success: false, error: 'No fields to update' }), 400)
          }
          updates.push('updated_at = ?')
          binds.push(new Date().toISOString())
          binds.push(slugId)
          await env.vegvisr_org.prepare(`UPDATE custom_room_slugs SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run()
          return createResponse(JSON.stringify({ success: true }), 200)
        } catch (e) {
          return createResponse(JSON.stringify({ success: false, error: e.message }), 500)
        }
      }
    }

    {
      const deleteMatch = pathname.match(/^\/realtime\/slugs\/([^/]+)$/)
      if (deleteMatch && request.method === 'DELETE') {
        try {
          const slugId = deleteMatch[1]
          const auth = await validateWorkerApiToken(request, env)
          if (!auth.valid) {
            return createResponse(JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }), 401)
          }
          if (!canManageSlugs(auth.role)) {
            return createResponse(JSON.stringify({ success: false, error: 'Forbidden: Admin or Superadmin role required' }), 403)
          }
          const user = { email: auth.email }
          const ownerRow = await env.vegvisr_org.prepare('SELECT owner_email FROM custom_room_slugs WHERE id = ?').bind(slugId).first()
          if (!ownerRow) return createResponse(JSON.stringify({ success: false, error: 'Slug not found' }), 404)
          if (ownerRow.owner_email !== user.email) return createResponse(JSON.stringify({ success: false, error: 'Forbidden: You do not own this slug' }), 403)
          await env.vegvisr_org.prepare('UPDATE custom_room_slugs SET active = 0, updated_at = ? WHERE id = ?').bind(new Date().toISOString(), slugId).run()
          return createResponse(JSON.stringify({ success: true }), 200)
        } catch (e) {
          return createResponse(JSON.stringify({ success: false, error: e.message }), 500)
        }
      }
    }

    // POST /realtime/slugs/{slugId}/share-token — owner mints a new share link
    {
      const mintMatch = pathname.match(/^\/realtime\/slugs\/([^/]+)\/share-token$/)
      if (mintMatch && request.method === 'POST') {
        try {
          const slugId = mintMatch[1]
          const auth = await validateWorkerApiToken(request, env)
          if (!auth.valid) return createResponse(JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }), 401)
          if (!canManageSlugs(auth.role)) return createResponse(JSON.stringify({ success: false, error: 'Forbidden: Admin or Superadmin role required' }), 403)
          const slugRow = await env.vegvisr_org
            .prepare('SELECT slug, meeting_id, owner_email, active, scheduled_start_at FROM custom_room_slugs WHERE id = ?')
            .bind(slugId).first()
          if (!slugRow) return createResponse(JSON.stringify({ success: false, error: 'Slug not found' }), 404)
          if (slugRow.owner_email !== auth.email) return createResponse(JSON.stringify({ success: false, error: 'Forbidden: You do not own this slug' }), 403)
          if (!slugRow.active) return createResponse(JSON.stringify({ success: false, error: 'Slug is inactive' }), 400)
          if (!slugRow.scheduled_start_at) {
            return createResponse(JSON.stringify({ success: false, error: 'Set a meeting time on this slug before generating a share link' }), 400)
          }
          const startMs = new Date(slugRow.scheduled_start_at).getTime()
          if (isNaN(startMs)) {
            return createResponse(JSON.stringify({ success: false, error: 'Slug has an invalid scheduled_start_at value' }), 500)
          }
          const validFrom = new Date(startMs - 60 * 60 * 1000).toISOString()
          const validUntil = new Date(startMs + 60 * 60 * 1000).toISOString()
          const tokenId = crypto.randomUUID()
          const nowIso = new Date().toISOString()
          await env.vegvisr_org
            .prepare('INSERT INTO slug_share_tokens (id, slug_id, meeting_id, valid_from, valid_until, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(tokenId, slugId, slugRow.meeting_id, validFrom, validUntil, auth.email, nowIso).run()
          const url = `https://realtime.vegvisr.org/${slugRow.slug}?t=${tokenId}`
          return createResponse(JSON.stringify({
            success: true,
            token: tokenId,
            url,
            validFrom,
            validUntil,
            scheduledStartAt: slugRow.scheduled_start_at,
          }), 201)
        } catch (e) {
          return createResponse(JSON.stringify({ success: false, error: e.message }), 500)
        }
      }
    }

    // GET /realtime/slugs/{slugId}/share-tokens — list active share tokens for a slug
    {
      const listMatch = pathname.match(/^\/realtime\/slugs\/([^/]+)\/share-tokens$/)
      if (listMatch && request.method === 'GET') {
        try {
          const slugId = listMatch[1]
          const auth = await validateWorkerApiToken(request, env)
          if (!auth.valid) return createResponse(JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }), 401)
          if (!canManageSlugs(auth.role)) return createResponse(JSON.stringify({ success: false, error: 'Forbidden: Admin or Superadmin role required' }), 403)
          const slugRow = await env.vegvisr_org
            .prepare('SELECT slug, owner_email FROM custom_room_slugs WHERE id = ?')
            .bind(slugId).first()
          if (!slugRow) return createResponse(JSON.stringify({ success: false, error: 'Slug not found' }), 404)
          if (slugRow.owner_email !== auth.email) return createResponse(JSON.stringify({ success: false, error: 'Forbidden: You do not own this slug' }), 403)
          const result = await env.vegvisr_org
            .prepare('SELECT id, valid_from, valid_until, created_at FROM slug_share_tokens WHERE slug_id = ? AND revoked_at IS NULL ORDER BY created_at DESC')
            .bind(slugId).all()
          const tokens = (result.results || []).map(r => ({
            id: r.id,
            url: `https://realtime.vegvisr.org/${slugRow.slug}?t=${r.id}`,
            validFrom: r.valid_from,
            validUntil: r.valid_until,
            createdAt: r.created_at,
          }))
          return createResponse(JSON.stringify({ success: true, tokens }), 200)
        } catch (e) {
          return createResponse(JSON.stringify({ success: false, error: e.message }), 500)
        }
      }
    }

    // DELETE /realtime/share-tokens/{tokenId} — owner revokes a share token
    {
      const revokeMatch = pathname.match(/^\/realtime\/share-tokens\/([^/]+)$/)
      if (revokeMatch && request.method === 'DELETE') {
        try {
          const tokenId = revokeMatch[1]
          const auth = await validateWorkerApiToken(request, env)
          if (!auth.valid) return createResponse(JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }), 401)
          if (!canManageSlugs(auth.role)) return createResponse(JSON.stringify({ success: false, error: 'Forbidden: Admin or Superadmin role required' }), 403)
          const tokRow = await env.vegvisr_org
            .prepare(`SELECT t.id, t.revoked_at, s.owner_email
                      FROM slug_share_tokens t
                      JOIN custom_room_slugs s ON s.id = t.slug_id
                      WHERE t.id = ?`)
            .bind(tokenId).first()
          if (!tokRow) return createResponse(JSON.stringify({ success: false, error: 'Share token not found' }), 404)
          if (tokRow.owner_email !== auth.email) return createResponse(JSON.stringify({ success: false, error: 'Forbidden: You do not own this share token' }), 403)
          if (tokRow.revoked_at) {
            return createResponse(JSON.stringify({ success: true, alreadyRevoked: true }), 200)
          }
          await env.vegvisr_org
            .prepare('UPDATE slug_share_tokens SET revoked_at = ? WHERE id = ?')
            .bind(new Date().toISOString(), tokenId).run()
          return createResponse(JSON.stringify({ success: true }), 200)
        } catch (e) {
          return createResponse(JSON.stringify({ success: false, error: e.message }), 500)
        }
      }
    }

    if (pathname === '/realtime/slug-contact-owner' && request.method === 'POST') {
      try {
        const { slug, ownerEmail, visitorEmail, message } = await request.json()
        if (!slug || !ownerEmail || !visitorEmail || !message) {
          return createResponse(JSON.stringify({ success: false, error: 'Missing required fields' }), 400)
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail)) {
          return createResponse(JSON.stringify({ success: false, error: 'Invalid visitor email format' }), 400)
        }
        if (typeof message !== 'string' || message.trim().length === 0) {
          return createResponse(JSON.stringify({ success: false, error: 'Message cannot be empty' }), 400)
        }
        const messageId = crypto.randomUUID()
        const now = new Date().toISOString()
        await env.vegvisr_org
          .prepare('INSERT INTO slug_contact_messages (id, slug, from_email, to_email, message, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, NULL)')
          .bind(messageId, slug, visitorEmail, ownerEmail, message, now).run()
        return createResponse(JSON.stringify({ success: true }), 200)
      } catch (e) {
        return createResponse(JSON.stringify({ success: false, error: e.message }), 500)
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
      const { jobId, ownerEmail, recordingId, meetingId, meetingTitle, fileName, downloadUrl, fileSize, recordingDuration, keyPrefix, metadata: metaOverride } = msg.body || {}
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
        // keyPrefix + metaOverride let non-realtime producers (e.g. Cloudflare
        // Stream recordings) target a different prefix / metadata shape.
        // Absent ⇒ legacy realtime behavior, byte-for-byte unchanged.
        const r2Key = `${keyPrefix || 'recordings/'}${fileName}`
        const metadata = {
          ...(metaOverride || {
            meetingId: meetingId || '',
            meetingTitle: meetingTitle || '',
            duration: String(recordingDuration || ''),
            rtkRecordingId: recordingId || '',
          }),
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

  // Scheduled safety-net sweep: copy Cloudflare Stream recordings → R2 before the
  // auto-delete window, catching anything the manual button missed. Today sweeps
  // the central account (one Stream token) for CF_STREAM_SWEEP_OWNER; iterate
  // world_founders here once per-founder Stream tokens exist. Reuses the same
  // proven enqueueStreamRecordings core as the manual /stream-sync route.
  async scheduled(event, env, ctx) {
    const owner = env.CF_STREAM_SWEEP_OWNER || null
    if (!owner) { console.log('[stream-cron] CF_STREAM_SWEEP_OWNER unset; skipping'); return }
    try {
      const r = await enqueueStreamRecordings(owner, env, {})
      console.log('[stream-cron]', JSON.stringify({
        owner, queued: r.queued, processing: r.processing, skipped: r.skipped, error: r.error || null,
      }))
    } catch (e) {
      console.error('[stream-cron] error:', e && e.message)
    }
  },
}
