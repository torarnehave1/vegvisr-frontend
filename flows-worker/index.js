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
 *   GET  /health             public
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

const BINDING_HOST = 'flows-worker'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

const now = () => new Date().toISOString()

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/health') return json({ status: 'ok', worker: 'flows-worker', phase: '1/3 live runs, agents, approvals' })
    if (url.hostname !== BINDING_HOST) {
      return json({ error: 'flows-worker is reachable only over a service binding.' }, 403)
    }

    try {
      if (path === '/flows/run' && request.method === 'POST') return await startRun(request, env)

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
}

async function startRun(request, env) {
  const body = await request.json().catch(() => null)
  const graph = body?.graph
  const email = String(body?.actor?.email || '').trim().toLowerCase()
  if (!email) return json({ error: 'actor.email is required (set by the binding caller).' }, 400)
  if (!graph?.id || !Array.isArray(graph.nodes)) return json({ error: 'graph with id and nodes is required.' }, 400)
  const dryRun = body.dryRun !== false
  if (!dryRun && !env.KG_WORKER?.fetch) return json({ error: 'Live runs need the KG_WORKER binding.' }, 500)

  const compiled = compileFlow(graph, body.aliases || [])
  if (!compiled.ok) return json({ ok: false, errors: compiled.errors, warnings: compiled.warnings }, 422)
  const spec = compiled.spec
  if (spec.status === 'paused') return json({ ok: false, errors: ['This flow is paused.'] }, 409)

  const runId = crypto.randomUUID()
  const inputs = body.inputs && typeof body.inputs === 'object' ? body.inputs : {}
  await env.DB.prepare(
    `INSERT INTO flow_runs (id, flow_graph_id, flow_version, owner_email, trigger_id, dry_run, status, spec_json, inputs_json, created_at)
     VALUES (?1, ?2, ?3, ?4, 'manual', ?8, 'queued', ?5, ?6, ?7)`,
  ).bind(runId, String(graph.id), spec.version, email, JSON.stringify(spec), JSON.stringify(inputs), now(), dryRun ? 1 : 0).run()

  await env.FLOW_RUNNER.create({ id: runId, params: { runId } })

  return json({
    ok: true,
    runId,
    status: 'queued',
    dryRun,
    flow: spec.name,
    steps: Object.keys(spec.steps).length,
    warnings: compiled.warnings,
  })
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
      status: run.status, workflowStatus: workflow, dryRun: !!run.dry_run, digest: run.digest, error: run.error,
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

    const { spec, inputs, dryRun, owner } = await step.do('load-spec', async () => {
      const row = await db.prepare('SELECT spec_json, inputs_json, dry_run, owner_email FROM flow_runs WHERE id = ?1').bind(runId).first()
      if (!row) throw new Error(`run ${runId} not found`)
      await db.prepare("UPDATE flow_runs SET status = 'running' WHERE id = ?1").bind(runId).run()
      return { spec: JSON.parse(row.spec_json), inputs: JSON.parse(row.inputs_json || '{}'), dryRun: row.dry_run !== 0, owner: row.owner_email }
    })

    // A live action step calls the MCP tool back on knowledge-graph-worker, as the owner.
    const kg = this.env.KG_WORKER
    const callTool = async (toolName, args, approval) => {
      try {
        const res = await kg.fetch('https://knowledge-graph-worker/internal/flows/call-tool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: owner, toolName, args, ...(approval ? { approval } : {}) }),
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
