const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role, X-API-Token',
}

const jsonResponse = (payload, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const base64UrlDecode = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (padded.length % 4)) % 4
  const normalized = padded + '='.repeat(padLength)
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const decodeJson = (bytes) => {
  const text = new TextDecoder().decode(bytes)
  return JSON.parse(text)
}

const verifyPublishToken = async (token, secret) => {
  if (!token) {
    return { valid: false, error: 'Missing publish token' }
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid token format' }
  }

  let header
  let payload
  try {
    header = decodeJson(base64UrlDecode(parts[0]))
    payload = decodeJson(base64UrlDecode(parts[1]))
  } catch {
    return { valid: false, error: 'Invalid token payload' }
  }

  if (header.alg !== 'HS256') {
    return { valid: false, error: 'Unsupported token algorithm' }
  }

  const data = `${parts[0]}.${parts[1]}`
  const signatureBytes = base64UrlDecode(parts[2])
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const verified = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    new TextEncoder().encode(data)
  )

  if (!verified) {
    return { valid: false, error: 'Invalid token signature' }
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && now > payload.exp) {
    return { valid: false, error: 'Token expired' }
  }

  return { valid: true, payload }
}

const normalizeJsonContent = (content) => {
  if (content === null || content === undefined) {
    throw new Error('Missing content')
  }

  if (typeof content === 'object') {
    return JSON.stringify(content, null, 2)
  }

  if (typeof content !== 'string') {
    throw new Error('Content must be JSON object or JSON string')
  }

  const trimmed = content.trim()
  const parsed = JSON.parse(trimmed)
  return JSON.stringify(parsed, null, 2)
}

const ensureApiRegistryEntry = async (env) => {
  const slug = 'json-node-update'
  const existing = await env.vegvisr_org.prepare(
    'SELECT id FROM apiForApps WHERE slug = ?'
  ).bind(slug).first()

  if (existing) return

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await env.vegvisr_org.prepare(`
    INSERT INTO apiForApps (
      id, name, slug, category, description, icon, color,
      function_name, function_signature, function_code,
      endpoint_url, docs_url, example_code, rate_limit,
      status, is_enabled_by_default, is_always_on, requires_auth,
      created_at, updated_at, capability_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    'JSON Node Update',
    slug,
    'knowledge-graph',
    'Update JSON-node content in a knowledge graph using a signed HTML publish token.',
    '🧾',
    '#2563eb',
    'updateJsonNode',
    'updateJsonNode(graphId, nodeId, content)',
    `async function updateJsonNode(graphId, nodeId, content, token) {
  const response = await fetch('https://api.vegvisr.org/api/json-node/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ graphId, nodeId, content })
  })
  return await response.json()
}`,
    'https://api.vegvisr.org/api/json-node/update',
    null,
    `curl -X POST "https://api.vegvisr.org/api/json-node/update" \\
  -H "Authorization: Bearer <HTML_PUBLISH_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"graphId":"GRAPH_ID","nodeId":"NODE_ID","content":{"title":"Example"}}'`,
    '30 req/min',
    'active',
    true,
    false,
    true,
    now,
    now,
    'api'
  ).run()
}

export async function handleJsonNodeUpdate(request, env) {
  if (!env.HTML_PUBLISH_SECRET) {
    return jsonResponse({ success: false, error: 'Missing HTML_PUBLISH_SECRET' }, 500)
  }

  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const verification = await verifyPublishToken(token, env.HTML_PUBLISH_SECRET)
  if (!verification.valid) {
    return jsonResponse({ success: false, error: verification.error }, 401)
  }

  const body = await request.json().catch(() => ({}))
  const { graphId, nodeId, content, json } = body

  if (!graphId || !nodeId) {
    return jsonResponse({ success: false, error: 'Missing graphId or nodeId' }, 400)
  }

  if (verification.payload?.appId && verification.payload.appId !== nodeId) {
    return jsonResponse({ success: false, error: 'Token appId does not match nodeId' }, 403)
  }

  const scope = Array.isArray(verification.payload?.scope) ? verification.payload.scope : []
  if (scope.length && !scope.includes('save')) {
    return jsonResponse({ success: false, error: 'Token missing save scope' }, 403)
  }

  let normalizedContent
  try {
    normalizedContent = normalizeJsonContent(json !== undefined ? json : content)
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 400)
  }

  await ensureApiRegistryEntry(env)

  const graphResponse = await fetch(
    `https://knowledge.vegvisr.org/getknowgraph?id=${encodeURIComponent(graphId)}`
  )

  if (!graphResponse.ok) {
    const errorText = await graphResponse.text()
    return jsonResponse({ success: false, error: `Failed to load graph: ${errorText}` }, 502)
  }

  const graphData = await graphResponse.json()
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []

  const targetNode = nodes.find((node) => node.id === nodeId)
  if (!targetNode) {
    return jsonResponse({ success: false, error: 'Node not found' }, 404)
  }

  if (targetNode.type !== 'json-node') {
    return jsonResponse({ success: false, error: 'Node is not json-node' }, 400)
  }

  targetNode.info = normalizedContent

  const updateResponse = await fetch('https://knowledge.vegvisr.org/updateknowgraph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: graphId,
      graphData: {
        ...graphData,
        nodes
      }
    })
  })

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text()
    return jsonResponse({ success: false, error: `Failed to update graph: ${errorText}` }, 502)
  }

  return jsonResponse({
    success: true,
    graphId,
    nodeId,
    node: targetNode
  })
}
