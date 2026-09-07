// deployment-status-worker
// Reads Cloudflare Pages deployment metadata and build logs on behalf of the
// caller, so a frontend / agent / CLI can show "live" build status without
// each holding a Cloudflare API token of its own.
//
// Routes (all under api.vegvisr.org/ops/deployments):
//   GET /ops/deployments?project=<name>&limit=10  → list, newest first
//   GET /ops/deployments/latest?project=<name>    → most recent only
//   GET /ops/deployments/<id>?project=<name>      → one deployment + latest_stage
//   GET /ops/deployments/<id>/log?project=<name>  → build log lines
//
// Auth: X-API-Token header (= config.emailVerificationToken). Caller must be
// Superadmin. CORS open to '*' for browser usage.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role, X-API-Token, x-user-email',
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', ...corsHeaders },
})

/**
 * Resolve the caller from X-API-Token → email + role from the config table.
 * Returns { valid, email, role, error }. Same shape as realtime-worker's
 * validateWorkerApiToken so behaviour matches what callers already know.
 */
async function authenticate(request, env) {
  const apiToken = request.headers.get('X-API-Token')
  if (!apiToken) return { valid: false, error: 'Missing X-API-Token header' }
  try {
    const row = await env.vegvisr_org
      .prepare('SELECT email, Role FROM config WHERE emailVerificationToken = ?')
      .bind(apiToken).first()
    if (!row) return { valid: false, error: 'Invalid X-API-Token' }
    return { valid: true, email: row.email, role: row.Role }
  } catch (e) {
    return { valid: false, error: 'Token validation error: ' + e.message }
  }
}

/**
 * Thin wrapper around the Cloudflare REST API. Always GET. The token only
 * has Pages: Read scope, so anything mutating returns 403 from Cloudflare —
 * which is what we want.
 */
async function cfGet(path, env) {
  const url = `https://api.cloudflare.com/client/v4${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = { raw: text } }
  return { ok: res.ok, status: res.status, body }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400' } })
    }
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405)
    }

    // Auth
    const auth = await authenticate(request, env)
    if (!auth.valid) return json({ error: auth.error || 'Unauthorized' }, 401)
    if (auth.role !== 'Superadmin') return json({ error: 'Forbidden: Superadmin role required' }, 403)

    // Require CF_API_TOKEN secret to be set
    if (!env.CF_API_TOKEN) {
      return json({ error: 'CF_API_TOKEN secret is not configured on this worker' }, 500)
    }

    const accountId = env.CF_ACCOUNT_ID
    const project = url.searchParams.get('project')

    // ── /ops/deployments/<id>/log ─────────────────────────────────────────────
    {
      const m = pathname.match(/^\/ops\/deployments\/([^/]+)\/log$/)
      if (m) {
        if (!project) return json({ error: 'project query param is required' }, 400)
        const id = m[1]
        const cf = await cfGet(`/accounts/${accountId}/pages/projects/${encodeURIComponent(project)}/deployments/${encodeURIComponent(id)}/history/logs`, env)
        if (!cf.ok) return json({ error: 'Cloudflare API error', status: cf.status, details: cf.body }, 502)
        // CF response shape: { result: { total, data: [{ts, line}, ...] }, success, errors, messages }
        const data = cf.body?.result?.data || []
        return json({ success: true, deploymentId: id, total: cf.body?.result?.total ?? data.length, lines: data })
      }
    }

    // ── /ops/deployments/latest ───────────────────────────────────────────────
    if (pathname === '/ops/deployments/latest') {
      if (!project) return json({ error: 'project query param is required' }, 400)
      const cf = await cfGet(`/accounts/${accountId}/pages/projects/${encodeURIComponent(project)}/deployments?per_page=1`, env)
      if (!cf.ok) return json({ error: 'Cloudflare API error', status: cf.status, details: cf.body }, 502)
      const dep = (cf.body?.result || [])[0] || null
      return json({ success: true, deployment: dep ? summarizeDeployment(dep) : null })
    }

    // ── /ops/deployments/<id> ─────────────────────────────────────────────────
    {
      const m = pathname.match(/^\/ops\/deployments\/([^/]+)$/)
      if (m) {
        if (!project) return json({ error: 'project query param is required' }, 400)
        const id = m[1]
        const cf = await cfGet(`/accounts/${accountId}/pages/projects/${encodeURIComponent(project)}/deployments/${encodeURIComponent(id)}`, env)
        if (!cf.ok) return json({ error: 'Cloudflare API error', status: cf.status, details: cf.body }, 502)
        return json({ success: true, deployment: summarizeDeployment(cf.body?.result) })
      }
    }

    // ── /ops/deployments (list) ───────────────────────────────────────────────
    if (pathname === '/ops/deployments') {
      if (!project) return json({ error: 'project query param is required' }, 400)
      const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 1), 50)
      const cf = await cfGet(`/accounts/${accountId}/pages/projects/${encodeURIComponent(project)}/deployments?per_page=${limit}`, env)
      if (!cf.ok) return json({ error: 'Cloudflare API error', status: cf.status, details: cf.body }, 502)
      const deployments = (cf.body?.result || []).map(summarizeDeployment)
      return json({ success: true, project, deployments })
    }

    return json({ error: 'Not Found', pathname }, 404)
  },
}

/**
 * Compact a Cloudflare deployment object into just the fields a caller needs.
 * The raw object has 20+ fields most callers don't want to deal with.
 */
function summarizeDeployment(d) {
  if (!d) return null
  return {
    id: d.id,
    url: d.url,
    environment: d.environment,
    branch: d.deployment_trigger?.metadata?.branch,
    commit: d.deployment_trigger?.metadata?.commit_hash,
    commitMessage: d.deployment_trigger?.metadata?.commit_message,
    createdOn: d.created_on,
    modifiedOn: d.modified_on,
    isSkipped: !!d.is_skipped,
    latestStage: d.latest_stage
      ? { name: d.latest_stage.name, status: d.latest_stage.status, startedOn: d.latest_stage.started_on, endedOn: d.latest_stage.ended_on }
      : null,
    stages: (d.stages || []).map(s => ({ name: s.name, status: s.status, startedOn: s.started_on, endedOn: s.ended_on })),
  }
}
