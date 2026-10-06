// blotato-worker — authenticated proxy to Blotato (https://backend.blotato.com).
//
// Auth: `X-API-Token` header (= `config.emailVerificationToken`), resolved
// against the vegvisr_org D1 config table — the same pattern the
// deployment-status-worker and realtime-worker use. NOTHING here is public
// except `/blotato/health`: before this gate existed, anyone who knew the URL
// could list the connected social accounts and publish to them.
//
// The Blotato API key is resolved PER CALLER from `config.blotato_api_key`, so
// each user posts with their own Blotato workspace. A Superadmin caller whose
// row has no key falls back to the worker's `BLOTATO_API_KEY` secret (the
// transitional path for the original single-tenant setup). A non-Superadmin
// without their own key is refused — no shared key by default.
//
// Authed responses carry `keySource: 'config' | 'secret'` so it is answerable
// which key actually served the call — the SOURCE only, never the key itself.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token, x-user-email, x-user-role',
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

/**
 * Resolve the caller from X-API-Token → email + role + their Blotato key.
 * Same shape as deployment-status-worker's `authenticate`.
 */
async function authenticate(request, env) {
  const apiToken = request.headers.get('X-API-Token')
  if (!apiToken) return { valid: false, error: 'Missing X-API-Token header' }
  try {
    const row = await env.vegvisr_org
      .prepare('SELECT email, Role, blotato_api_key FROM config WHERE emailVerificationToken = ?')
      .bind(apiToken)
      .first()
    if (!row) return { valid: false, error: 'Invalid X-API-Token' }
    return { valid: true, email: row.email, role: row.Role, blotatoKey: row.blotato_api_key || null }
  } catch (e) {
    return { valid: false, error: 'Token validation error: ' + e.message }
  }
}

/**
 * Blotato account ids this caller has been granted on the shared workspace
 * (`blotato_account_grants`). Fails closed: a read error yields no grants.
 */
async function grantedAccountIds(email, env) {
  try {
    const rs = await env.vegvisr_org
      .prepare('SELECT account_id FROM blotato_account_grants WHERE email = ?')
      .bind(email)
      .all()
    return (rs.results || []).map((r) => r.account_id)
  } catch {
    return []
  }
}

/**
 * Account ids granted to someone OTHER than this caller. A granted account
 * belongs to its grantee: it is hidden from, and refused to, everyone else —
 * including the workspace owner whose key can technically reach it.
 * Returns null on a read error so the caller can fail closed.
 */
async function accountIdsGrantedToOthers(email, env) {
  try {
    const rs = await env.vegvisr_org
      .prepare('SELECT DISTINCT account_id FROM blotato_account_grants WHERE email <> ?')
      .bind(email)
      .all()
    return (rs.results || []).map((r) => String(r.account_id))
  } catch {
    return null
  }
}

/**
 * The Blotato key this caller may use, and which accounts they may see:
 *  - their own row's key → their own workspace, all its accounts ('config')
 *  - Superadmin → worker secret, all accounts ('secret')
 *  - granted accounts → worker secret, but ONLY the granted account ids ('grant')
 * Anything else is refused. Returns { key, source, grants? } or { error, status }.
 */
async function resolveBlotatoKey(auth, env) {
  if (auth.blotatoKey) return { key: auth.blotatoKey, source: 'config' }
  if (auth.role === 'Superadmin' && env.BLOTATO_API_KEY) return { key: env.BLOTATO_API_KEY, source: 'secret' }
  const grants = await grantedAccountIds(auth.email, env)
  if (grants.length > 0 && env.BLOTATO_API_KEY) return { key: env.BLOTATO_API_KEY, source: 'grant', grants }
  return {
    error: `No Blotato API key or account grant is configured for ${auth.email}. Store a key in config.blotato_api_key or add a row to blotato_account_grants.`,
    status: 403,
  }
}

/** Call Blotato and wrap the response the way callers already expect. */
async function blotato(url, key, init = {}) {
  const upstream = await fetch(url, {
    ...init,
    headers: { 'blotato-api-key': key, ...(init.headers || {}) },
  })
  const text = await upstream.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  return { ok: upstream.ok, status: upstream.status, data }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const { pathname } = new URL(request.url)

    // Public — no caller data, only whether the worker is wired up.
    if (pathname === '/blotato/health' && request.method === 'GET') {
      return json({
        success: true,
        worker: 'blotato-worker',
        hasApiKey: Boolean(env.BLOTATO_API_KEY),
        hasDb: Boolean(env.vegvisr_org),
        time: new Date().toISOString(),
      })
    }

    const isAccounts = pathname === '/blotato/accounts' && request.method === 'GET'
    const isPost = pathname === '/blotato/post' && request.method === 'POST'
    if (!isAccounts && !isPost) return json({ success: false, error: 'Not found' }, 404)

    // Everything below reads or writes the caller's social accounts — authed.
    const auth = await authenticate(request, env)
    if (!auth.valid) return json({ success: false, error: auth.error || 'Unauthorized' }, 401)

    const resolved = await resolveBlotatoKey(auth, env)
    if (resolved.error) return json({ success: false, error: resolved.error }, resolved.status)
    const key = resolved.key
    const keySource = resolved.source
    const grants = resolved.grants || null
    // Own-key / Superadmin callers see the whole workspace EXCEPT accounts
    // granted to another user. A grantee's own filter (`grants`) already
    // excludes everything else, so this only applies when there is none.
    let reserved = []
    if (!grants) {
      reserved = await accountIdsGrantedToOthers(auth.email, env)
      if (reserved === null) return json({ success: false, error: 'Could not read account grants' }, 503)
    }

    if (isAccounts) {
      try {
        const r = await blotato('https://backend.blotato.com/v2/users/me/accounts', key)
        // Shared workspace: strip every account the caller was not granted before
        // the response leaves the worker.
        if (grants && r.ok && r.data && Array.isArray(r.data.items)) {
          r.data.items = r.data.items.filter((a) => grants.includes(a.id))
        } else if (reserved.length > 0 && r.ok && r.data && Array.isArray(r.data.items)) {
          r.data.items = r.data.items.filter((a) => !reserved.includes(String(a.id)))
        }
        return json({ success: r.ok, status: r.status, keySource, data: r.data }, r.ok ? 200 : r.status)
      } catch (e) {
        return json({ success: false, error: e.message }, 502)
      }
    }

    // POST /blotato/post — publishes immediately to the named account.
    let body
    try {
      body = await request.json()
    } catch {
      return json({ success: false, error: 'Invalid JSON body' }, 400)
    }
    if (!body || !body.post || !body.post.accountId || !body.post.content || !body.post.target) {
      return json({
        success: false,
        error: 'Body must include { post: { accountId, content, target }, scheduledTime?, useNextFreeSlot? }',
      }, 400)
    }
    if (grants && !grants.includes(body.post.accountId)) {
      return json({ success: false, error: 'This Instagram account is not granted to you' }, 403)
    }
    if (reserved.includes(String(body.post.accountId))) {
      return json({ success: false, error: 'This account is granted to another user' }, 403)
    }
    try {
      const r = await blotato('https://backend.blotato.com/v2/posts', key, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return json({ success: r.ok, status: r.status, keySource, data: r.data }, r.ok ? 200 : r.status)
    } catch (e) {
      return json({ success: false, error: e.message }, 502)
    }
  },
}
