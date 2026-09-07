const jsonResponse = (payload, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Cross-origin: the editor at www.vegvisr.org calls this on api.vegvisr.org.
      // The worker's global OPTIONS handler answers the preflight; the actual
      // response must also carry ACAO or the browser blocks reading it.
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Token',
    }
  })
}

const base64UrlEncode = (buffer) => {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const encodeJson = (value) => {
  return new TextEncoder().encode(JSON.stringify(value))
}

const signToken = async (payload, secret) => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerB64 = base64UrlEncode(encodeJson(header))
  const payloadB64 = base64UrlEncode(encodeJson(payload))
  const data = `${headerB64}.${payloadB64}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const signatureB64 = base64UrlEncode(signature)

  return `${data}.${signatureB64}`
}

const validateAuth = async (request, env) => {
  const apiToken = request.headers.get('X-API-Token')
  if (!apiToken) {
    return { valid: false, error: 'Missing X-API-Token header' }
  }

  try {
    const userRecord = await env.vegvisr_org.prepare(
      'SELECT user_id, Role, data FROM config WHERE emailVerificationToken = ?'
    ).bind(apiToken).first()

    if (!userRecord) {
      return { valid: false, error: 'Invalid authentication token' }
    }

    return {
      valid: true,
      userId: userRecord.user_id,
      role: userRecord.Role,
      data: userRecord.data
    }
  } catch (error) {
    return { valid: false, error: 'Authentication error' }
  }
}

export async function handleMintPublishToken(request, env) {
  if (!env.HTML_PUBLISH_SECRET) {
    return jsonResponse({ success: false, error: 'Missing HTML_PUBLISH_SECRET' }, 500)
  }

  const auth = await validateAuth(request, env)
  if (!auth.valid) {
    return jsonResponse({ success: false, error: auth.error }, 401)
  }

  const body = await request.json().catch(() => ({}))
  const appId = body.appId
  const hostname = String(body.hostname || '').trim().toLowerCase()
  const ttlDays = Number.isFinite(body.ttlDays) ? body.ttlDays : 30

  if (!appId) {
    return jsonResponse({ success: false, error: 'Missing required field: appId' }, 400)
  }
  if (!hostname) {
    return jsonResponse({ success: false, error: 'Missing required field: hostname' }, 400)
  }

  // Authorization: a Superadmin may publish to any hostname; a challenge
  // participant may publish only to the subdomain assigned on their profile
  // (config.data.publishSubdomain). The minted token is scoped to that hostname.
  let allowed = auth.role === 'Superadmin'
  if (!allowed) {
    let assigned = ''
    try {
      assigned = String((JSON.parse(auth.data || '{}') || {}).publishSubdomain || '')
        .trim()
        .toLowerCase()
    } catch (_) {
      assigned = ''
    }
    allowed = Boolean(assigned) && assigned === hostname
  }
  if (!allowed) {
    return jsonResponse(
      { success: false, error: 'Unauthorized: you may not publish to this hostname' },
      403,
    )
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const exp = nowSeconds + Math.max(1, ttlDays) * 24 * 60 * 60

  const payload = {
    uid: auth.userId,
    appId,
    hostname,
    scope: ['save', 'load', 'loadAll', 'delete'],
    exp
  }

  const token = await signToken(payload, env.HTML_PUBLISH_SECRET)
  return jsonResponse({ success: true, token, exp })
}

// Mint a short-lived, node-scoped token that authorizes writing the contact
// route for one graph node (brand-worker /__contact/route verifies it with the
// same HS256/HTML_PUBLISH_SECRET scheme). Gated to Admin/Superadmin; per-graph
// ownership is enforced upstream in the editor (only the owner/Superadmin edits
// the graph). Short TTL — the token is used immediately to write the KV route.
export async function handleMintContactRouteToken(request, env) {
  if (!env.HTML_PUBLISH_SECRET) {
    return jsonResponse({ success: false, error: 'Missing HTML_PUBLISH_SECRET' }, 500)
  }

  const auth = await validateAuth(request, env)
  if (!auth.valid) {
    return jsonResponse({ success: false, error: auth.error }, 401)
  }
  if (auth.role !== 'Superadmin' && auth.role !== 'Admin') {
    return jsonResponse({ success: false, error: 'Unauthorized: Admin or Superadmin required' }, 403)
  }

  const body = await request.json().catch(() => ({}))
  const graphId = String(body.graphId || '').trim()
  const nodeId = String(body.nodeId || '').trim()
  if (!graphId || !nodeId) {
    return jsonResponse({ success: false, error: 'Missing required fields: graphId and nodeId' }, 400)
  }

  const ttlMinutes = Number.isFinite(body.ttlMinutes) ? body.ttlMinutes : 15
  const nowSeconds = Math.floor(Date.now() / 1000)
  const exp = nowSeconds + Math.max(1, ttlMinutes) * 60

  const payload = {
    uid: auth.userId,
    graphId,
    nodeId,
    scope: ['contact-route'],
    exp,
  }

  const token = await signToken(payload, env.HTML_PUBLISH_SECRET)
  return jsonResponse({ success: true, token, exp })
}
