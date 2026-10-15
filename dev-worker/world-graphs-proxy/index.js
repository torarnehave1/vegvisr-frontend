/**
 * world-graphs-proxy — a World's knowledge graphs, inside the World Founder's OWN Cloudflare account.
 *
 * The KG worker (knowledge.vegvisr.org) is still the only door: MCP, the editor, the Vue app and
 * Agent-Builder all talk to it, and it decides where a graph lives. When a graph lives in a World,
 * the KG worker calls THIS worker, which runs the very same D1GraphStore the platform runs — over
 * the D1 database in the founder's account instead of the platform's. One SQL source for both.
 *
 *   GET  /__graphs/check    readiness, unauthenticated, no data: versions, bindings, tables
 *   POST /__graphs/rpc      { op, args } — one store method, token-gated per op
 *   POST /__graphs/migrate  { statements, schema_version } — create the tables, token-gated
 *
 * Bindings (stamped by Agent-Builder's provision_world_graphs):
 *   GRAPH_DB            D1  — the World's graph database
 *   WORLD_DOMAIN        text — e.g. sodesign.no; tokens for any other World are refused
 *   PLATFORM_PUBLIC_KEY text — Ed25519 public JWK; the private half never leaves the platform
 *
 * Built into ONE file by build.sh (it imports ../graph-store.js) and deployed from the
 * WORLD_TEMPLATES KV key template:world-graphs-proxy. The running copy is whatever was uploaded at
 * the last provisioning; /__graphs/check reports TEMPLATE_VERSION so drift is visible.
 */
import { D1GraphStore, STORE_RPC_OPS } from '../graph-store.js'
import { verifyWorldGraphToken } from '../world-graph-token.js'

export const TEMPLATE_VERSION = '1'

const META_DDL = 'CREATE TABLE IF NOT EXISTS graph_store_meta (key TEXT PRIMARY KEY, value TEXT)'
// Only reads may arrive through first/all, and only one statement.
const READ_ONLY = /^\s*(SELECT|WITH)\b/i
// The only DDL migrate accepts. Nothing that drops, alters or deletes.
const ALLOWED_DDL = /^\s*CREATE\s+(TABLE|(UNIQUE\s+)?INDEX)\s+IF\s+NOT\s+EXISTS\s/i

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

function isSingleRead(sql) {
  const s = String(sql || '').trim().replace(/;\s*$/, '')
  return READ_ONLY.test(s) && !s.includes(';')
}

async function authorize(request, env, op, body) {
  const header = request.headers.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return verifyWorldGraphToken(env.PLATFORM_PUBLIC_KEY, token, { aud: env.WORLD_DOMAIN, op, body })
}

async function check(env) {
  const out = {
    ok: true,
    template_version: TEMPLATE_VERSION,
    world: env.WORLD_DOMAIN || null,
    db_bound: Boolean(env.GRAPH_DB),
    key_bound: Boolean(env.PLATFORM_PUBLIC_KEY),
    schema_version: null,
    tables: [],
  }
  if (!env.GRAPH_DB) return { ...out, ok: false }
  try {
    const t = await env.GRAPH_DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all()
    out.tables = (t.results || []).map((r) => r.name)
    if (out.tables.includes('graph_store_meta')) {
      const v = await env.GRAPH_DB.prepare("SELECT value FROM graph_store_meta WHERE key = 'schema_version'").first()
      out.schema_version = v?.value ?? null
    }
  } catch (e) {
    return { ...out, ok: false, error: `database not readable: ${e.message}` }
  }
  out.ok = out.key_bound && out.schema_version !== null
  return out
}

async function migrate(env, payload) {
  const statements = Array.isArray(payload?.statements) ? payload.statements : []
  const version = String(payload?.schema_version ?? '').trim()
  if (!statements.length || !version) return json({ ok: false, error: 'statements[] and schema_version are required' }, 400)
  const refused = statements.filter((s) => !ALLOWED_DDL.test(String(s)))
  if (refused.length) return json({ ok: false, error: 'only CREATE TABLE/INDEX IF NOT EXISTS is accepted', refused }, 400)

  await env.GRAPH_DB.batch([
    env.GRAPH_DB.prepare(META_DDL),
    ...statements.map((s) => env.GRAPH_DB.prepare(String(s))),
    env.GRAPH_DB
      .prepare("INSERT INTO graph_store_meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(version),
  ])
  return json({ ok: true, applied: statements.length, schema_version: version })
}

async function rpc(env, payload) {
  const { op, args = [] } = payload || {}
  if (!STORE_RPC_OPS.includes(op)) return json({ ok: false, error: `unknown op ${op}` }, 400)
  if (!Array.isArray(args)) return json({ ok: false, error: 'args must be an array' }, 400)
  if ((op === 'first' || op === 'all') && !isSingleRead(args[0])) {
    return json({ ok: false, error: `${op} accepts a single SELECT statement only` }, 400)
  }
  const store = new D1GraphStore(env.GRAPH_DB, { kind: 'world', world: env.WORLD_DOMAIN, atomic: true })
  const result = await store[op](...args)
  return json({ ok: true, result: result === undefined ? null : result })
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)

    if (pathname === '/__graphs/check' && request.method === 'GET') return json(await check(env))

    const route = pathname === '/__graphs/rpc' ? 'rpc' : pathname === '/__graphs/migrate' ? 'migrate' : null
    if (!route || request.method !== 'POST') return json({ ok: false, error: 'not found' }, 404)
    if (!env.GRAPH_DB) return json({ ok: false, error: 'GRAPH_DB is not bound' }, 503)

    const body = await request.text()
    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      return json({ ok: false, error: 'body must be JSON' }, 400)
    }
    const op = route === 'migrate' ? 'migrate' : payload?.op
    const auth = await authorize(request, env, op, body)
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401)

    try {
      return route === 'migrate' ? await migrate(env, payload) : await rpc(env, payload)
    } catch (e) {
      return json({ ok: false, error: e.message }, 500)
    }
  },
}
