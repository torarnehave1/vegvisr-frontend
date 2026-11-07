/**
 * flows-worker — the VEGR Flows engine (2026-11-06, phase 0/1 skeleton).
 *
 * Reachable ONLY over a service binding (knowledge-graph-worker's FLOWS_WORKER). The caller has
 * already authenticated the user and checked they may read the flow graph; it sends the graph,
 * the model aliases and the actor. Nothing here trusts the internet: every route but /health
 * answers 403 unless the request came in by the binding name, a hostname that cannot be reached
 * from outside (same rule as user-keys-worker's /mailbox-password).
 *
 *   POST /flows/run          compile the graph, pin the spec in D1, start a FlowRunner instance
 *   POST /flows/runs/:id/decide   the owner's decision on the approval the run waits for
 *   GET  /flows/runs/:id     one run with its steps (owner only)
 *   GET  /flows/runs         the owner's recent runs, optionally for one graph
 *   POST /flows/activate     turn a flow's schedule on or off (phase 2)
 *   GET  /flows/list         the owner's scheduled flows, next and last runs
 *   GET  /health             public
 *   scheduled() every minute starts the flows whose schedule is due (phase 2, see schedule.js)
 *
 * Dry runs: every step says what it WOULD do; nothing is called.
 * Live runs (2026-11-06): action steps call the same MCP tool Claude uses, back on
 * knowledge-graph-worker (KG_WORKER binding, /internal/flows/call-tool) as the flow's owner;
 * agent steps ask a model through anthropic-worker (ANTHROPIC binding); approval steps pause the
 * run (step.waitForEvent) until the owner decides through MCP decide_flow_approval; a tool that
 * reaches other people runs only after a yes, once. Route/wait/loop are still simulated.
 */
import { WorkflowEntrypoint } from 'cloudflare:workers'
import { compileFlow, dryRunStep, liveStep, decideApproval } from './compile.js'
import { nextRun, describeTime, scheduleTriggers, DEFAULT_TIMEZONE } from './schedule.js'

const BINDING_HOST = 'flows-worker'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

const now = () => new Date().toISOString()

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/health') return json({ status: 'ok', worker: 'flows-worker', phase: '2 schedules' })
    if (url.hostname !== BINDING_HOST) {
      return json({ error: 'flows-worker is reachable only over a service binding.' }, 403)
    }

    try {
      await ensureSchema(env)
      if (path === '/flows/run' && request.method === 'POST') return await startRun(request, env)
      if (path === '/flows/activate' && request.method === 'POST') return await activate(request, env)
      if (path === '/flows/list' && request.method === 'GET') return await listFlows(env, url.searchParams.get('email'))

      const dec = path.match(/^\/flows\/runs\/([0-9a-f-]{36})\/decide$/)
      if (dec && request.method === 'POST') return await decide(request, env, dec[1])

      const one = path.match(/^\/flows\/runs\/([0-9a-f-]{36})$/)
      if (one && request.method === 'GET') return await readRun(env, one[1], url.searchParams.get('email'))

      if (path === '/flows/runs' && request.method === 'GET') {
        return await listRuns(env, url.searchParams.get('email'), url.searchParams.get('graphId'))
      }
      return json({ error: 'Not found' }, 404)
    } catch (e) {
      console.error('[flows-worker]', e)
      return json({ error: e.message || String(e) }, 500)
    }
  },

  // Phase 2: one minute-cron for every scheduled flow (Cloudflare cron is UTC-only and capped).
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runDueTriggers(env).catch((e) => console.error('[flows-worker] scheduled', e)))
  },
}

async function startRun(request, env) {
  const body = await request.json().catch(() => null)
  const graph = body?.graph
  const email = String(body?.actor?.email || '').trim().toLowerCase()
  if (!email) return json({ error: 'actor.email is required (set by the binding caller).' }, 400)
  if (!graph?.id || !Array.isArray(graph.nodes)) return json({ error: 'graph with id and nodes is required.' }, 400)
  const r = await createRun(env, { graph, aliases: body.aliases || [], email, dryRun: body.dryRun !== false, inputs: body.inputs })
  return json(r.body, r.status)
}

/** Compile, pin the spec in D1 and start a FlowRunner instance. Used by manual and scheduled runs. */
async function createRun(env, { graph, aliases, email, dryRun, inputs, triggerId = 'manual' }) {
  if (!dryRun && !env.KG_WORKER?.fetch) return { status: 500, body: { error: 'Live runs need the KG_WORKER binding.' } }
  const compiled = compileFlow(graph, aliases || [])
  if (!compiled.ok) return { status: 422, body: { ok: false, errors: compiled.errors, warnings: compiled.warnings } }
  const spec = compiled.spec
  if (spec.status === 'paused') return { status: 409, body: { ok: false, errors: ['This flow is paused.'] } }

  const runId = crypto.randomUUID()
  const ins = inputs && typeof inputs === 'object' ? inputs : {}
  await env.DB.prepare(
    `INSERT INTO flow_runs (id, flow_graph_id, flow_version, owner_email, trigger_id, dry_run, status, spec_json, inputs_json, created_at)
     VALUES (?1, ?2, ?3, ?4, ?9, ?8, 'queued', ?5, ?6, ?7)`,
  ).bind(runId, String(graph.id), spec.version, email, JSON.stringify(spec), JSON.stringify(ins), now(), dryRun ? 1 : 0, triggerId).run()

  await env.FLOW_RUNNER.create({ id: runId, params: { runId } })
  return {
    status: 200,
    body: { ok: true, runId, status: 'queued', dryRun, flow: spec.name, steps: Object.keys(spec.steps).length, warnings: compiled.warnings },
  }
}

// ── Phase 2: schedules ──────────────────────────────────────────────────────────────────────

/**
 * Tables this worker owns, created on first use (CREATE … IF NOT EXISTS is cheap and idempotent),
 * so a new deploy never depends on a migration someone has to remember to run.
 *   flow_triggers       one row per schedule trigger of an activated flow: when it runs next
 *   flow_notifications  one row per approval the owner was told about by e-mail (sent once)
 */
const schemaReady = new WeakSet() // per D1 binding object: once per isolate in production
export async function ensureSchema(env) {
  if (!env.DB?.batch || schemaReady.has(env.DB)) return
  await env.DB.batch([
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS flow_triggers (flow_graph_id TEXT NOT NULL, trigger_id TEXT NOT NULL, owner_email TEXT NOT NULL, ' +
      'type TEXT NOT NULL, cron TEXT, timezone TEXT, enabled INTEGER NOT NULL DEFAULT 1, next_run_at TEXT, last_fired_at TEXT, ' +
      'last_run_id TEXT, last_result TEXT, updated_at TEXT, PRIMARY KEY (flow_graph_id, trigger_id))',
    ),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_flow_triggers_due ON flow_triggers (enabled, next_run_at)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS flow_notifications (run_id TEXT NOT NULL, seq INTEGER NOT NULL, at TEXT, PRIMARY KEY (run_id, seq))'),
  ])
  schemaReady.add(env.DB)
}

/**
 * Turn a flow's schedule on (active: true) or off. On: the flow must compile, have at least one
 * schedule trigger, and have finished one run before (dry or live — VEGR Flows safety rule 7:
 * nothing runs unattended that has never been tried). The trigger rows are replaced by what the
 * flow node says now, so editing the schedule in the graph and activating again is all it takes.
 */
async function activate(request, env) {
  const body = await request.json().catch(() => null)
  const graph = body?.graph
  const email = String(body?.actor?.email || '').trim().toLowerCase()
  if (!email || !graph?.id) return json({ error: 'actor.email and graph are required.' }, 400)
  const graphId = String(graph.id)

  if (body.active === false) {
    await env.DB.prepare('UPDATE flow_triggers SET enabled = 0, updated_at = ?3 WHERE flow_graph_id = ?1 AND owner_email = ?2')
      .bind(graphId, email, now()).run()
    return json({ ok: true, active: false, triggers: await triggersOf(env, graphId, email) })
  }

  const compiled = compileFlow(graph, body.aliases || [])
  if (!compiled.ok) return json({ ok: false, errors: compiled.errors, warnings: compiled.warnings }, 422)
  if (compiled.spec.status === 'paused') return json({ ok: false, errors: ['The flow node says status "paused". Change it to "active" first.'] }, 409)
  const { triggers, errors } = scheduleTriggers(compiled.spec)
  if (errors.length) return json({ ok: false, errors }, 422)
  if (!triggers.length) {
    return json({ ok: false, errors: ['The flow has no schedule. Add one to the flow node, e.g. triggers: [{ "id": "t_morgen", "type": "schedule", "cron": "0 7 * * *", "timezone": "Europe/Oslo" }].'] }, 422)
  }
  const tried = await env.DB.prepare("SELECT id FROM flow_runs WHERE flow_graph_id = ?1 AND owner_email = ?2 AND status = 'succeeded' LIMIT 1")
    .bind(graphId, email).first()
  if (!tried) return json({ ok: false, errors: ['Run the flow once first (a dry run is enough) — a schedule only starts a flow that has run before.'] }, 409)

  const at = new Date()
  await env.DB.prepare('DELETE FROM flow_triggers WHERE flow_graph_id = ?1 AND owner_email = ?2').bind(graphId, email).run()
  for (const t of triggers) {
    await env.DB.prepare(
      `INSERT INTO flow_triggers (flow_graph_id, trigger_id, owner_email, type, cron, timezone, enabled, next_run_at, updated_at)
       VALUES (?1, ?2, ?3, 'schedule', ?4, ?5, 1, ?6, ?7)`,
    ).bind(graphId, t.id, email, t.cron, t.timezone, nextRun(t.cron, t.timezone, at).toISOString(), at.toISOString()).run()
  }
  const warnings = [...compiled.warnings]
  const hasApproval = Object.values(compiled.spec.steps).some((x) => x.kind === 'approval')
  if (hasApproval && !compiled.spec.notify?.fromEmail) {
    warnings.push('The flow has an approval but no notify.fromEmail in the flow node, so a scheduled run that waits for you will not e-mail you. Add e.g. notify: { "fromEmail": "post@vegr.ai" }.')
  }
  return json({ ok: true, active: true, flow: compiled.spec.name, triggers: await triggersOf(env, graphId, email), warnings })
}

async function triggersOf(env, graphId, email) {
  const rows = await env.DB.prepare('SELECT * FROM flow_triggers WHERE flow_graph_id = ?1 AND owner_email = ?2 ORDER BY trigger_id').bind(graphId, email).all()
  return (rows.results || []).map(shapeTrigger)
}

function shapeTrigger(t) {
  const tz = t.timezone || DEFAULT_TIMEZONE
  return {
    flowGraphId: t.flow_graph_id, triggerId: t.trigger_id, type: t.type, cron: t.cron, timezone: tz,
    enabled: t.enabled === 1, nextRunAt: t.enabled === 1 ? t.next_run_at : null,
    nextRunLocal: t.enabled === 1 && t.next_run_at ? describeTime(new Date(t.next_run_at), tz) : null,
    lastFiredAt: t.last_fired_at, lastRunId: t.last_run_id, lastResult: t.last_result,
  }
}

async function listFlows(env, email) {
  if (!email) return json({ error: 'email is required (set by the binding caller).' }, 400)
  const e = String(email).trim().toLowerCase()
  const rows = await env.DB.prepare('SELECT * FROM flow_triggers WHERE owner_email = ?1 ORDER BY flow_graph_id, trigger_id').bind(e).all()
  const recent = await env.DB.prepare(
    'SELECT id, flow_graph_id, trigger_id, status, dry_run, created_at, finished_at FROM flow_runs WHERE owner_email = ?1 ORDER BY created_at DESC LIMIT 30',
  ).bind(e).all()
  return json({ ok: true, triggers: (rows.results || []).map(shapeTrigger), recentRuns: recent.results || [] })
}

/**
 * Every minute: start the flows whose schedule is due. Each due trigger is CLAIMED first by
 * moving its next_run_at forward with a conditional UPDATE, so two overlapping cron invocations
 * can never start the same slot twice. A slot that cannot run is skipped, not queued:
 *   - the flow's previous run is still going (concurrency 1)
 *   - the flow already ran limits.maxRunsPerDay scheduled times today (default 24)
 * The flow is read fresh from its graph for every run, so an edit to a step applies next time.
 * A flow that can no longer be read or no longer compiles has its schedule switched off, with the
 * reason in last_result — it does not fail again every minute.
 */
export async function runDueTriggers(env, at = new Date()) {
  await ensureSchema(env)
  const due = await env.DB.prepare(
    'SELECT * FROM flow_triggers WHERE enabled = 1 AND next_run_at <= ?1 ORDER BY next_run_at LIMIT 25',
  ).bind(at.toISOString()).all()
  const started = []
  for (const t of due.results || []) {
    const next = nextRun(t.cron, t.timezone || DEFAULT_TIMEZONE, at)
    const claim = await env.DB.prepare(
      'UPDATE flow_triggers SET next_run_at = ?3, last_fired_at = ?4, updated_at = ?4 WHERE flow_graph_id = ?1 AND trigger_id = ?2 AND next_run_at = ?5 AND enabled = 1',
    ).bind(t.flow_graph_id, t.trigger_id, next ? next.toISOString() : null, at.toISOString(), t.next_run_at).run()
    if (!(claim?.meta?.changes > 0)) continue
    const result = await fireTrigger(env, t).catch((e) => ({ result: `error: ${e.message}` }))
    await env.DB.prepare(
      `UPDATE flow_triggers SET last_result = ?3, last_run_id = COALESCE(?4, last_run_id)${result.disable ? ', enabled = 0' : ''} WHERE flow_graph_id = ?1 AND trigger_id = ?2`,
    ).bind(t.flow_graph_id, t.trigger_id, String(result.result).slice(0, 500), result.runId || null).run()
    started.push({ flowGraphId: t.flow_graph_id, triggerId: t.trigger_id, ...result })
  }
  return started
}

async function fireTrigger(env, t) {
  const busy = await env.DB.prepare(
    "SELECT id FROM flow_runs WHERE flow_graph_id = ?1 AND owner_email = ?2 AND status IN ('queued', 'running', 'waiting') LIMIT 1",
  ).bind(t.flow_graph_id, t.owner_email).first()
  if (busy) return { result: `skipped: the previous run ${busy.id} is still going` }

  const res = await env.KG_WORKER.fetch('https://knowledge-graph-worker/internal/flows/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: t.owner_email, graphId: t.flow_graph_id }),
  })
  const loaded = await res.json().catch(() => ({}))
  if (!res.ok || !loaded.graph) return { result: `error: could not read the flow graph (${loaded.error || `HTTP ${res.status}`}); schedule switched off`, disable: true }

  const compiled = compileFlow(loaded.graph, loaded.aliases || [])
  if (!compiled.ok) return { result: `error: the flow no longer compiles (${compiled.errors.join('; ')}); schedule switched off`, disable: true }
  if (compiled.spec.status === 'paused') return { result: 'skipped: the flow node says status "paused"' }
  const maxPerDay = Number(compiled.spec.limits.maxRunsPerDay) > 0 ? Number(compiled.spec.limits.maxRunsPerDay) : 24
  const today = new Date().toISOString().slice(0, 10)
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM flow_runs WHERE flow_graph_id = ?1 AND owner_email = ?2 AND trigger_id != 'manual' AND created_at >= ?3",
  ).bind(t.flow_graph_id, t.owner_email, `${today}T00:00:00.000Z`).first()
  if ((count?.n || 0) >= maxPerDay) return { result: `skipped: already ${count.n} scheduled runs today (limits.maxRunsPerDay ${maxPerDay})` }

  const r = await createRun(env, { graph: loaded.graph, aliases: loaded.aliases, email: t.owner_email, dryRun: false, inputs: {}, triggerId: t.trigger_id })
  if (r.status !== 200) return { result: `error: ${r.body.error || (r.body.errors || []).join('; ')}` }
  return { result: `started run ${r.body.runId}`, runId: r.body.runId }
}

async function readRun(env, runId, email) {
  if (!email) return json({ error: 'email is required (set by the binding caller).' }, 400)
  const run = await env.DB.prepare('SELECT * FROM flow_runs WHERE id = ?1').bind(runId).first()
  if (!run || run.owner_email !== String(email).trim().toLowerCase()) return json({ error: 'Run not found.' }, 404)
  const steps = await env.DB.prepare(
    'SELECT seq, node_id, kind, status, summary, detail_json, edge, at FROM flow_run_steps WHERE run_id = ?1 ORDER BY seq',
  ).bind(runId).all()
  let workflow = null
  try {
    const inst = await env.FLOW_RUNNER.get(runId)
    workflow = (await inst.status())?.status || null
  } catch { /* instance may be gone after retention */ }
  const spec = JSON.parse(run.spec_json || '{}')
  return json({
    ok: true,
    run: {
      id: run.id, flowGraphId: run.flow_graph_id, flowVersion: run.flow_version, flow: spec.name || null,
      status: run.status, workflowStatus: workflow, dryRun: !!run.dry_run, trigger: run.trigger_id || 'manual', digest: run.digest, error: run.error,
      createdAt: run.created_at, finishedAt: run.finished_at,
    },
    steps: (steps.results || []).map((s) => ({
      seq: s.seq, nodeId: s.node_id, kind: s.kind, status: s.status, summary: s.summary,
      edge: s.edge, detail: s.detail_json ? JSON.parse(s.detail_json) : null, at: s.at,
    })),
  })
}

async function listRuns(env, email, graphId) {
  if (!email) return json({ error: 'email is required (set by the binding caller).' }, 400)
  const e = String(email).trim().toLowerCase()
  const rows = graphId
    ? await env.DB.prepare('SELECT id, flow_graph_id, status, dry_run, created_at, finished_at FROM flow_runs WHERE owner_email = ?1 AND flow_graph_id = ?2 ORDER BY created_at DESC LIMIT 20').bind(e, graphId).all()
    : await env.DB.prepare('SELECT id, flow_graph_id, status, dry_run, created_at, finished_at FROM flow_runs WHERE owner_email = ?1 ORDER BY created_at DESC LIMIT 20').bind(e).all()
  return json({ ok: true, runs: rows.results || [] })
}

/**
 * The owner's decision on the approval a run is waiting for (MCP decide_flow_approval). The step
 * row is moved from "waiting" to "deciding" with a conditional UPDATE first, so a decision can be
 * delivered once only; then the Workflow instance gets the event its waitForEvent is listening for.
 */
async function decide(request, env, runId) {
  const body = await request.json().catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  if (!email) return json({ error: 'email is required (set by the binding caller).' }, 400)
  const run = await env.DB.prepare('SELECT id, owner_email, status FROM flow_runs WHERE id = ?1').bind(runId).first()
  if (!run || run.owner_email !== email) return json({ error: 'Run not found.' }, 404)
  if (run.status !== 'waiting') return json({ error: `This run is not waiting for an approval (it is ${run.status}).` }, 409)
  const st = await env.DB.prepare(
    "SELECT seq, node_id, detail_json FROM flow_run_steps WHERE run_id = ?1 AND status = 'waiting' AND kind = 'approval' ORDER BY seq DESC LIMIT 1",
  ).bind(runId).first()
  if (!st) return json({ error: 'No approval is waiting in this run.' }, 409)
  const claimed = await env.DB.prepare(
    "UPDATE flow_run_steps SET status = 'deciding' WHERE run_id = ?1 AND seq = ?2 AND status = 'waiting'",
  ).bind(runId, st.seq).run()
  if (!(claimed?.meta?.changes > 0)) return json({ error: 'This approval has already been decided.' }, 409)
  const approved = body.approved === true
  const text = typeof body.text === 'string' ? body.text.slice(0, 20000) : null
  try {
    const inst = await env.FLOW_RUNNER.get(runId)
    await inst.sendEvent({ type: `approval-${st.seq}`, payload: { approved, text } })
  } catch (e) {
    await env.DB.prepare("UPDATE flow_run_steps SET status = 'waiting' WHERE run_id = ?1 AND seq = ?2").bind(runId, st.seq).run()
    return json({ error: `Could not deliver the decision to the run: ${e.message}` }, 500)
  }
  return json({ ok: true, runId, seq: st.seq, nodeId: st.node_id, approved, edited: text != null })
}

/**
 * One run of one flow. The spec is read from D1 (pinned when the run was started), so editing
 * the graph never changes a run that is already going. Each flow-step is its own durable step,
 * named after its node id and position, so a retry resumes where it stopped.
 *
 * Workflows replays run() from the top after every pause (an approval can wait 24 hours): a step
 * that already finished returns its cached result and its callback does NOT run again. So nothing
 * a later step depends on may be changed inside a callback — the run state (results, approved,
 * sends, cost) is folded from each step's returned outcome, outside the callbacks.
 *
 * Sending (an action that reaches other people) runs in two durable steps: a claim that records
 * the send as "sending", then the call itself with NO retries. knowledge-graph-worker only runs
 * the tool when that claim row exists and an approval in the same run said yes, so a message goes
 * out at most once even if the engine restarts mid-call.
 */
export class FlowRunner extends WorkflowEntrypoint {
  async run(event, step) {
    const { runId } = event.payload
    const db = this.env.DB

    const { spec, inputs, dryRun, owner, triggerId } = await step.do('load-spec', async () => {
      const row = await db.prepare('SELECT spec_json, inputs_json, dry_run, owner_email, trigger_id FROM flow_runs WHERE id = ?1').bind(runId).first()
      if (!row) throw new Error(`run ${runId} not found`)
      await db.prepare("UPDATE flow_runs SET status = 'running' WHERE id = ?1").bind(runId).run()
      return { spec: JSON.parse(row.spec_json), inputs: JSON.parse(row.inputs_json || '{}'), dryRun: row.dry_run !== 0, owner: row.owner_email, triggerId: row.trigger_id || 'manual' }
    })

    // A live action step calls the MCP tool back on knowledge-graph-worker, as the owner.
    const kg = this.env.KG_WORKER
    const callTool = async (toolName, args, approval, notify = null) => {
      try {
        const res = await kg.fetch('https://knowledge-graph-worker/internal/flows/call-tool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: owner, toolName, args, ...(approval ? { approval } : {}), ...(notify ? { notify } : {}) }),
        })
        return await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
      } catch (e) {
        return { ok: false, error: `could not reach the MCP server: ${e.message}` }
      }
    }

    // An agent step asks a model through anthropic-worker (binding: no token, the platform key).
    const ai = this.env.ANTHROPIC
    const callModel = ai?.fetch
      ? async ({ model, system, user, maxTokens }) => {
        try {
          const res = await ai.fetch('https://anthropic-worker/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, system, max_tokens: maxTokens, messages: [{ role: 'user', content: user }] }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(data.error || data).slice(0, 300)}` }
          const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim()
          if (!text) return { ok: false, error: 'the model returned no text' }
          return { ok: true, text, usage: data.usage || null }
        } catch (e) {
          return { ok: false, error: `could not reach the model: ${e.message}` }
        }
      }
      : null

    const writeStep = async (seqNo, r) => db.prepare(
      `INSERT OR REPLACE INTO flow_run_steps (run_id, seq, node_id, kind, status, summary, detail_json, edge, at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    ).bind(runId, seqNo, r.record.nodeId, r.record.kind, r.record.status, r.record.summary,
      r.record.detail ? JSON.stringify(r.record.detail) : null, r.record.edge, new Date().toISOString()).run()

    const state = { inputs, trigger: { type: 'manual' }, owner: { email: owner }, results: {}, approved: false, sends: 0, costUsd: 0 }
    const lines = []
    let id = spec.entry
    let seq = 0
    try {
      while (id) {
        if (seq >= spec.limits.maxSteps) throw new Error(`stopped after ${spec.limits.maxSteps} steps (limits.maxSteps)`)
        seq += 1
        const mySeq = seq
        const stepId = id
        const s = spec.steps[stepId]
        const sending = !dryRun && s.kind === 'action' && s.external && state.approved

        if (sending) {
          await step.do(`${stepId}#${mySeq} claim`, async () => {
            await writeStep(mySeq, { record: { nodeId: s.id, kind: s.kind, status: 'sending', summary: `sending with ${s.toolName}`, detail: { toolName: s.toolName }, edge: null } })
            return true
          })
        }

        let outcome = await step.do(
          `${stepId}#${mySeq}`,
          sending ? { retries: { limit: 0, delay: '1 second' } } : { retries: { limit: 1, delay: '2 seconds' } },
          async () => {
            const r = dryRun
              ? dryRunStep(spec, stepId, state)
              : await liveStep(spec, stepId, state, {
                callTool: (t, a, extra) => callTool(t, a, extra?.send ? { runId, seq: mySeq } : null),
                callModel,
              })
            await writeStep(mySeq, r)
            if (r.wait) await db.prepare("UPDATE flow_runs SET status = 'waiting' WHERE id = ?1").bind(runId).run()
            return r
          },
        )

        if (outcome.wait) {
          // A scheduled run has nobody watching: tell the owner by e-mail that it waits, once
          // (the one send a flow may make without an approval — to its owner, about itself).
          if (triggerId !== 'manual' && spec.notify?.fromEmail) {
            await step.do(`${stepId}#${mySeq} notify`, { retries: { limit: 0, delay: '1 second' } }, async () => {
              const p = outcome.wait.payload && typeof outcome.wait.payload === 'object' ? outcome.wait.payload : { tekst: outcome.wait.payload }
              const mail = p.epost && typeof p.epost === 'object' ? p.epost : null
              const text = [
                `Flowen «${spec.name}» startet av seg selv og venter nå på godkjenningen din.`,
                mail ? `\nE-posten som vil bli sendt:\nTil: ${mail.toEmail || '—'}\nEmne: ${mail.subject || '—'}` : '',
                `\n${typeof p.tekst === 'string' ? p.tekst : typeof p.text === 'string' ? p.text : mail?.textPreview || ''}`,
                `\nSvar i Claude: «Godkjenn ${spec.name}» eller «Ikke send». Den venter i ${outcome.wait.timeout}; uten svar sendes ingenting.`,
              ].join('\n')
              const r = await callTool('send_email', {
                fromEmail: spec.notify.fromEmail, toEmail: owner,
                subject: `VEGR Flow «${spec.name}» venter på deg`,
                bodyHtml: '<p style="white-space:pre-line">{tekst}</p>', variables: { tekst: text },
              }, null, { runId, seq: mySeq })
              if (!r.ok || r.isError) console.error('[flows-worker] notify failed', r.error || r.text)
              return { ok: !!(r.ok && !r.isError) }
            })
          }
          let decision = null
          try {
            const ev = await step.waitForEvent(`${stepId}#${mySeq} decision`, { type: `approval-${mySeq}`, timeout: outcome.wait.timeout })
            decision = ev?.payload || null
          } catch {
            decision = null // timed out: counts as rejected
          }
          outcome = await step.do(`${stepId}#${mySeq} decided`, async () => {
            const d = decideApproval(spec, stepId, state, decision)
            await writeStep(mySeq, d)
            await db.prepare("UPDATE flow_runs SET status = 'running' WHERE id = ?1").bind(runId).run()
            return d
          })
        }

        // Fold the finished step into the run state — outside the callbacks (see above).
        if (outcome.record.status === 'approved') state.approved = true
        if (outcome.record.status === 'sent') state.sends += 1
        state.costUsd += Number(outcome.record.detail?.costUsd || 0)
        state.results[stepId] = { result: outcome.result }
        lines.push(`${mySeq}. ${outcome.record.label} — ${outcome.record.summary}`)
        if (outcome.stop) throw new Error(outcome.stop)
        id = outcome.nextId
      }

      await step.do('finish', async () => {
        const head = dryRun
          ? `Dry run of "${spec.name}": ${seq} step${seq === 1 ? '' : 's'}, nothing was called.`
          : `Live run of "${spec.name}": ${seq} step${seq === 1 ? '' : 's'}${state.sends ? `, ${state.sends} sent` : ''}${state.costUsd ? `, model cost ~$${state.costUsd.toFixed(4)}` : ''}.`
        const digest = `${head}\n${lines.join('\n')}`
        await db.prepare("UPDATE flow_runs SET status = 'succeeded', digest = ?2, finished_at = ?3 WHERE id = ?1")
          .bind(runId, digest, new Date().toISOString()).run()
      })
      return { ok: true, steps: seq }
    } catch (e) {
      await step.do('fail', async () => {
        await db.prepare("UPDATE flow_runs SET status = 'failed', error = ?2, finished_at = ?3 WHERE id = ?1")
          .bind(runId, String(e.message || e), new Date().toISOString()).run()
      })
      throw e
    }
  }
}
