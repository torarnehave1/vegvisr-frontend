/**
 * worker-tools.js — the workers made with create_worker, offered as MCP tools.
 *
 * Each worker under mcp-workers/ may describe its own tools at GET /mcp-manifest. This module
 * finds the workers (the directory listing on GitHub), asks each DEPLOYED one for its manifest,
 * and turns what it gets back into tool definitions the MCP server registers for that request.
 *
 * The manifest is read from the running worker on purpose, not from a file in git: a worker that
 * has been committed but not yet approved does not answer, so its tools do not exist. The
 * approval in deploy-mcp-workers.yml therefore governs tools as well as code, with nothing here
 * having to remember it.
 *
 * A call is forwarded with the model's arguments and NOTHING else — no session, no token, no
 * identity. These workers are public at their own address anyway, so reaching them through MCP
 * grants nothing new. What comes back was produced by model-written code and is handed to the
 * model as data.
 *
 * No zod and no Workers-only imports here: deploy-mcp-workers.yml imports parseManifest in plain
 * Node to check a manifest right after deploying it, so CI and the server judge it by one rule.
 */

export const REPO = 'torarnehave1/vegvisr-frontend'
export const SOURCE_DIR = 'mcp-workers'
export const DEPLOY_PREFIX = 'mcp-'
export const WORKER_NAME_RE = /^[a-z0-9][a-z0-9-]{0,48}$/
export const TOOL_NAME_RE = /^[a-z0-9][a-z0-9_]{0,39}$/
export const FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,40}$/
export const FIELD_TYPES = ['string', 'number', 'integer', 'boolean']
export const MAX_WORKERS = 20
export const MAX_TOOLS_PER_WORKER = 10
export const MAX_FIELDS = 20
export const CACHE_MS = 60_000
export const MAX_RESULT_CHARS = 20_000

export function workerOrigin(worker) {
  return `https://${DEPLOY_PREFIX}${worker}.torarnehave.workers.dev`
}

/** The MCP tool name: "<worker>__<tool>", hyphens folded so every client accepts it. */
export function mcpToolName(worker, tool) {
  return `${worker.replace(/-/g, '_')}__${tool}`.slice(0, 64)
}

/**
 * Validate one worker's manifest. Returns { tools, errors }: a bad tool is dropped and named in
 * errors, so one mistake does not take the worker's other tools with it.
 */
export function parseManifest(manifest, worker) {
  const errors = []
  const tools = []
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.tools)) {
    return { tools, errors: ['manifest must be an object with a "tools" array'] }
  }
  if (manifest.tools.length > MAX_TOOLS_PER_WORKER) errors.push(`only the first ${MAX_TOOLS_PER_WORKER} tools are used`)
  const seen = new Set()
  for (const [i, t] of manifest.tools.slice(0, MAX_TOOLS_PER_WORKER).entries()) {
    const where = `tools[${i}]`
    if (!t || typeof t !== 'object') { errors.push(`${where}: not an object`); continue }
    if (typeof t.name !== 'string' || !TOOL_NAME_RE.test(t.name)) { errors.push(`${where}: name must match ${TOOL_NAME_RE}`); continue }
    if (seen.has(t.name)) { errors.push(`${where}: duplicate name ${t.name}`); continue }
    if (typeof t.description !== 'string' || !t.description.trim()) { errors.push(`${t.name}: description is required`); continue }
    const path = t.path === undefined ? '/' : t.path
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('..') || /[\s?#\\]/.test(path)) {
      errors.push(`${t.name}: path must start with "/" and contain no "..", "?", "#", "\\" or spaces`); continue
    }
    const method = String(t.method || 'POST').toUpperCase()
    if (method !== 'GET' && method !== 'POST') { errors.push(`${t.name}: method must be GET or POST`); continue }

    const input = t.input === undefined ? {} : t.input
    if (!input || typeof input !== 'object' || Array.isArray(input)) { errors.push(`${t.name}: input must be an object of fields`); continue }
    const names = Object.keys(input)
    if (names.length > MAX_FIELDS) { errors.push(`${t.name}: at most ${MAX_FIELDS} input fields`); continue }
    const fields = {}
    let bad = null
    for (const f of names) {
      const spec = input[f]
      if (!FIELD_NAME_RE.test(f)) { bad = `field "${f}" has an invalid name`; break }
      if (!spec || typeof spec !== 'object' || !FIELD_TYPES.includes(spec.type)) { bad = `field "${f}": type must be one of ${FIELD_TYPES.join(', ')}`; break }
      if (spec.enum !== undefined && (spec.type !== 'string' || !Array.isArray(spec.enum) || !spec.enum.length || spec.enum.some((v) => typeof v !== 'string'))) {
        bad = `field "${f}": enum must be a non-empty list of strings on a string field`; break
      }
      fields[f] = {
        type: spec.type,
        description: typeof spec.description === 'string' ? spec.description.slice(0, 500) : '',
        required: spec.required === true,
        ...(spec.enum ? { enum: spec.enum.slice(0, 50) } : {}),
      }
    }
    if (bad) { errors.push(`${t.name}: ${bad}`); continue }

    seen.add(t.name)
    tools.push({
      worker,
      tool: t.name,
      name: mcpToolName(worker, t.name),
      description: t.description.trim().slice(0, 1000),
      path,
      method,
      fields,
    })
  }
  return { tools, errors }
}

async function withTimeout(promise, ms) {
  let timer
  try {
    return await Promise.race([promise, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms) })])
  } finally {
    clearTimeout(timer)
  }
}

let cache = null

/** Test hook: forget what was discovered. */
export function clearCache() { cache = null }

/** The worker directories under mcp-workers/ on main, read from GitHub. */
async function listWorkers(env, doFetch) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'vegvisr-mcp-server', 'X-GitHub-Api-Version': '2022-11-28' }
  if (env.GITHUB_WORKER_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_WORKER_TOKEN}`
  const res = await withTimeout(doFetch(`https://api.github.com/repos/${REPO}/contents/${SOURCE_DIR}?ref=main`, { headers }), 5000)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`GitHub listing answered ${res.status}`)
  const rows = await res.json()
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r?.type === 'dir' && WORKER_NAME_RE.test(r.name))
    .map((r) => r.name)
    .slice(0, MAX_WORKERS)
}

/**
 * Every tool every deployed worker offers. Cached for CACHE_MS per isolate. Never throws: if
 * discovery fails the server simply has no worker tools for that request, and keeps its own.
 */
export async function discoverWorkerTools(env, { fetchImpl, now = Date.now() } = {}) {
  const doFetch = fetchImpl || fetch
  if (cache && now - cache.at < CACHE_MS) return cache.result
  const result = { tools: [], problems: [] }
  try {
    const workers = await listWorkers(env, doFetch)
    const found = await Promise.all(workers.map(async (worker) => {
      try {
        const res = await withTimeout(doFetch(`${workerOrigin(worker)}/mcp-manifest`, { headers: { Accept: 'application/json' } }), 3000)
        if (!res.ok) return { tools: [], errors: res.status === 404 ? [] : [`${worker}: manifest answered ${res.status}`] }
        const parsed = parseManifest(await res.json(), worker)
        return { tools: parsed.tools, errors: parsed.errors.map((e) => `${worker}: ${e}`) }
      } catch (e) {
        return { tools: [], errors: [`${worker}: ${e.message}`] }
      }
    }))
    for (const f of found) { result.tools.push(...f.tools); result.problems.push(...f.errors) }
  } catch (e) {
    result.problems.push(e.message)
  }
  cache = { at: now, result }
  return result
}

/** Call one worker tool with the model's arguments, and nothing else. */
export async function callWorkerTool(tool, args, { fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch
  const clean = {}
  for (const k of Object.keys(tool.fields)) if (args?.[k] !== undefined) clean[k] = args[k]
  let url = `${workerOrigin(tool.worker)}${tool.path}`
  const init = { method: tool.method, headers: { Accept: 'application/json, text/plain;q=0.9' } }
  if (tool.method === 'GET') {
    const q = new URLSearchParams(Object.entries(clean).map(([k, v]) => [k, String(v)])).toString()
    if (q) url += `?${q}`
  } else {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(clean)
  }
  const res = await withTimeout(doFetch(url, init), 15000)
  const text = (await res.text()).slice(0, MAX_RESULT_CHARS)
  let data = null
  try { data = JSON.parse(text) } catch { data = null }
  return { ok: res.ok, status: res.status, text, data }
}
