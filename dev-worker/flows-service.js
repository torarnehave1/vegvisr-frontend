/**
 * flows-service.js — run a VEGR Flow and read its runs, for MCP run_flow / get_flow_run
 * (2026-11-06, VEGR Flows phase 0/1).
 *
 * The engine is flows-worker, reached over the FLOWS_WORKER service binding only. This side does
 * what it already does for every graph: authenticate the user, check they may change the flow
 * graph (owner, or Superadmin — running a flow is acting on it, so read access is not enough),
 * read the graph and the model aliases, and send them across with the VERIFIED user's e-mail.
 * flows-worker never sees a token and never decides who someone is.
 *
 * Dry run (default): every step says what it would do; nothing is called.
 * Live (2026-11-06): read-only action steps really run — flows-worker calls the same MCP tool
 * back on this worker (POST /internal/flows/call-tool, binding only) as the flow's owner. Agent,
 * approval and wait steps are still simulated; anything that writes or sends is refused.
 */
import * as gs from './graph-service.js'

const REGISTRY = 'graph_system_registry'
const RUN_ID = /^[0-9a-f-]{36}$/

function fail(code, message, extra = {}) {
  return { ok: false, code, status: gs.statusForCode(code), message, ...extra }
}

async function callFlows(env, path, init) {
  if (!env.FLOWS_WORKER?.fetch) {
    return { res: null, data: null, error: fail(gs.ERR.INTERNAL_ERROR, 'The FLOWS_WORKER service binding is not configured on this worker.') }
  }
  try {
    const res = await env.FLOWS_WORKER.fetch(`https://flows-worker${path}`, init)
    const data = await res.json().catch(() => ({}))
    return { res, data, error: null }
  } catch (e) {
    console.error('[flows] flows-worker unreachable:', e.message)
    return { res: null, data: null, error: fail(gs.ERR.INTERNAL_ERROR, `Could not reach the flow engine: ${e.message}`) }
  }
}

/** The model-alias nodes from the system registry, as { alias, model, fallbackAlias }. */
export async function loadModelAliases(env) {
  const reg = await gs.getGraph(env, REGISTRY)
  if (!reg.ok) return []
  return (reg.graph.nodes || [])
    .filter((n) => n.type === 'model-alias' && n.metadata?.alias && n.metadata?.model)
    .map((n) => ({ alias: n.metadata.alias, model: n.metadata.model, fallbackAlias: n.metadata.fallbackAlias || null }))
}

export async function runFlow(env, { actor, graphId, inputs = {}, live = false }) {
  if (!actor?.email) return fail(gs.ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!graphId) return fail(gs.ERR.INVALID_INPUT, 'graphId is required.')

  const access = await gs.checkAccess(env, actor, graphId, 'run')
  if (!access.ok) return access
  const read = await gs.getGraph(env, graphId, { caller: actor })
  if (!read.ok) return read
  const g = read.graph
  const aliases = await loadModelAliases(env)

  const { res, data, error } = await callFlows(env, '/flows/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      graph: { id: graphId, version: g.metadata?.version ?? null, title: g.metadata?.title || null, nodes: g.nodes, edges: g.edges },
      aliases,
      actor: { email: actor.email },
      dryRun: !live,
      inputs: inputs && typeof inputs === 'object' ? inputs : {},
    }),
  })
  if (error) return error
  if (res.status === 422) {
    return fail(gs.ERR.INVALID_INPUT, `The flow does not compile:\n- ${(data.errors || []).join('\n- ')}`, { errors: data.errors || [], warnings: data.warnings || [] })
  }
  if (!res.ok) return fail(res.status === 409 ? gs.ERR.INVALID_INPUT : gs.ERR.INTERNAL_ERROR, data.error || (data.errors || []).join('; ') || `Flow engine answered HTTP ${res.status}.`)
  return { ok: true, runId: data.runId, status: data.status, dryRun: data.dryRun !== false, flow: data.flow, steps: data.steps, warnings: data.warnings || [], graphId }
}

/**
 * One run with its steps. With waitSeconds, polls until the run has finished (a dry run takes a
 * second or two) so "run it and tell me what happened" is one call.
 */
export async function getFlowRun(env, { actor, runId, waitSeconds = 0, until = null }) {
  if (!actor?.email) return fail(gs.ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!RUN_ID.test(String(runId || ''))) return fail(gs.ERR.INVALID_INPUT, 'runId must be the id run_flow returned.')
  const deadline = Date.now() + Math.min(Math.max(Number(waitSeconds) || 0, 0), 20) * 1000
  for (;;) {
    const { res, data, error } = await callFlows(env, `/flows/runs/${runId}?email=${encodeURIComponent(actor.email)}`)
    if (error) return error
    if (res.status === 404) return fail(gs.ERR.GRAPH_NOT_FOUND, 'Run not found.')
    if (!res.ok) return fail(gs.ERR.INTERNAL_ERROR, data.error || `Flow engine answered HTTP ${res.status}.`)
    // A run that waits for an approval has stopped too, as far as the caller is concerned.
    const done = until ? until(data) : ['succeeded', 'failed', 'waiting'].includes(data.run?.status)
    if (done || Date.now() >= deadline) return { ok: true, run: data.run, steps: data.steps || [] }
    await new Promise((r) => setTimeout(r, 1000))
  }
}

/**
 * The owner's decision on the approval a live run is waiting for. flows-worker checks that the
 * run is the caller's and is waiting, delivers the decision once, and the run goes on: approved →
 * the "approved" edge (a send after it runs, once); rejected → the "rejected" edge.
 */
export async function decideFlowApproval(env, { actor, runId, approve, text = null, waitSeconds = 10 }) {
  if (!actor?.email) return fail(gs.ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!RUN_ID.test(String(runId || ''))) return fail(gs.ERR.INVALID_INPUT, 'runId must be the id run_flow returned.')
  if (typeof approve !== 'boolean') return fail(gs.ERR.INVALID_INPUT, 'approve must be true or false.')
  const { res, data, error } = await callFlows(env, `/flows/runs/${runId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: actor.email, approved: approve, text: typeof text === 'string' ? text : null }),
  })
  if (error) return error
  if (res.status === 404) return fail(gs.ERR.GRAPH_NOT_FOUND, 'Run not found.')
  if (res.status === 409) return fail(gs.ERR.INVALID_INPUT, data.error || 'This run is not waiting for an approval.')
  if (!res.ok) return fail(gs.ERR.INTERNAL_ERROR, data.error || `Flow engine answered HTTP ${res.status}.`)
  // Read it back once it has moved past THIS approval: finished, or waiting at a later one.
  const seq = Number(data.seq)
  const read = await getFlowRun(env, {
    actor, runId, waitSeconds,
    until: (d) => ['succeeded', 'failed'].includes(d.run?.status) ||
      (d.run?.status === 'waiting' && (d.steps || []).some((x) => x.status === 'waiting' && x.seq > seq)),
  })
  return { ok: true, decided: { approved: data.approved, edited: data.edited === true, nodeId: data.nodeId }, run: read.ok ? read.run : null, steps: read.ok ? read.steps : [] }
}

/**
 * Turn a flow's schedule on or off (phase 2). On: flows-worker compiles the graph, reads the
 * schedule triggers in the flow node, requires that the flow has run once before, and works out
 * the next run in the trigger's time zone. Off: the schedule stops; the graph is untouched.
 */
export async function activateFlow(env, { actor, graphId, active = true }) {
  if (!actor?.email) return fail(gs.ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!graphId) return fail(gs.ERR.INVALID_INPUT, 'graphId is required.')
  const access = await gs.checkAccess(env, actor, graphId, 'run')
  if (!access.ok) return access
  const read = await gs.getGraph(env, graphId, { caller: actor })
  if (!read.ok) return read
  const g = read.graph
  const { res, data, error } = await callFlows(env, '/flows/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      graph: { id: graphId, version: g.metadata?.version ?? null, title: g.metadata?.title || null, nodes: g.nodes, edges: g.edges },
      aliases: await loadModelAliases(env),
      actor: { email: actor.email },
      active: active !== false,
    }),
  })
  if (error) return error
  if (!res.ok) return fail(res.status === 500 ? gs.ERR.INTERNAL_ERROR : gs.ERR.INVALID_INPUT, (data.errors || []).join('\n') || data.error || `Flow engine answered HTTP ${res.status}.`, { errors: data.errors || [] })
  return { ok: true, active: data.active, flow: data.flow || g.metadata?.title || null, triggers: data.triggers || [], warnings: data.warnings || [] }
}

/** The caller's scheduled flows (next and last run) and their recent runs. */
export async function listFlows(env, { actor }) {
  if (!actor?.email) return fail(gs.ERR.UNAUTHENTICATED, 'Authentication required.')
  const { res, data, error } = await callFlows(env, `/flows/list?email=${encodeURIComponent(actor.email)}`)
  if (error) return error
  if (!res.ok) return fail(gs.ERR.INTERNAL_ERROR, data.error || `Flow engine answered HTTP ${res.status}.`)
  return { ok: true, triggers: data.triggers || [], recentRuns: data.recentRuns || [] }
}
