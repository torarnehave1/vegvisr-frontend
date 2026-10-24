/**
 * The read gate for the REST routes that have always been open: /getknowgraph,
 * /getknowgraphversion, /public-graph and /slideshow.
 *
 * Owner decision 2026-10-24 (layer graph af6d576d-fcf3-4153-86af-040921c411d3, node
 * finding-private-graphs-readable-by-id): a graph is read only from approved sources.
 *
 * KG_ENFORCE_READ_AUTH (a var in wrangler.toml):
 *   unset / anything else  open, exactly as before — returns before doing anything at all
 *   'report'               still open, and never changes a response; each read that enforcing
 *                          WOULD refuse is logged as one [read-gate] line (graph id, the
 *                          Origin/Referer host, the auth method), so callers can be fixed first
 *   'true'                 enforced
 *
 * Enforced:
 *   - a service-binding call (host knowledge-graph-worker, unreachable from the internet) passes
 *   - everyone else goes through graph-service checkReadAccess(): an identified caller reads what
 *     checkAccess() allows (owner, Superadmin, published); an anonymous one, published only
 *   - an old version (history: true) is never served anonymously — a graph published today may
 *     have been private when that version was saved; a Superadmin reads any version
 *   - a refusal is a 404, the same as a graph that does not exist, so it does not confirm that a
 *     private id is real
 *
 * Returns null to let the read through, or { status, message } to refuse it.
 *
 * opts.caller         the caller, when the route has already resolved one
 * opts.resolveCaller  () => Promise<actor|null>, called only when the gate is on
 * opts.history        true for a route that serves an old version
 */
import { checkReadAccess, ERR } from './graph-service.js'

export const BINDING_HOST = 'knowledge-graph-worker'

export function readGateMode(env) {
  const mode = String(env?.KG_ENFORCE_READ_AUTH || '').trim().toLowerCase()
  return mode === 'true' || mode === 'report' ? mode : 'off'
}

export async function readGate(request, env, graphId, opts = {}) {
  const mode = readGateMode(env)
  if (mode === 'off') return null
  try {
    if (new URL(request.url).hostname === BINDING_HOST) return null
  } catch { /* an unparseable URL is not the binding */ }

  const caller = opts.caller || (opts.resolveCaller ? await opts.resolveCaller() : null)
  const notFound = { status: 404, message: 'Graph not found.' }
  const refuse = (why) => {
    if (mode === 'true') return notFound
    let from = null
    for (const h of ['Origin', 'Referer']) {
      try { from = from || new URL(request.headers.get(h)).host } catch { /* absent or not a URL */ }
    }
    let path = '-'
    try { path = new URL(request.url).pathname } catch { /* keep '-' */ }
    console.warn(`[read-gate] would refuse graph=${graphId} from=${from || '-'} auth=${caller?.authMethod || 'none'} path=${path} why=${why}`)
    return null
  }

  if (opts.history) {
    if (caller?.isSuperadmin) return null
    if (!caller || caller.anonymous) return refuse('history-anonymous')
  }

  const r = await checkReadAccess(env, caller, graphId)
  if (r.ok) return null
  if (r.code === ERR.STORE_UNAVAILABLE) return mode === 'true' ? { status: 503, message: r.message } : null
  if (r.code === ERR.GRAPH_NOT_FOUND) return mode === 'true' ? notFound : null
  return refuse(r.code)
}
