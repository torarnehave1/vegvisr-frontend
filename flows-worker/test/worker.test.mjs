// flows-worker routes + FlowRunner end to end, with a fake D1 and a fake Workflows engine that
// runs the instance inline. Plain Node: node --test flows-worker/test/*.test.mjs
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'

register(`data:text/javascript,${encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,' + encodeURIComponent('export class WorkflowEntrypoint { constructor(ctx, env) { this.ctx = ctx; this.env = env } }'), shortCircuit: true }
    return next(specifier, context)
  }
`)}`)
const { default: worker, FlowRunner } = await import('../index.js')

/** Just enough of D1 for flows-worker's own SQL. */
function fakeD1() {
  const runs = new Map()
  const steps = []
  const db = {
    runs, steps,
    prepare(sql) {
      let a = []
      const st = {
        bind: (...x) => { a = x; return st },
        async run() {
          if (sql.startsWith('INSERT INTO flow_runs')) runs.set(a[0], { id: a[0], flow_graph_id: a[1], flow_version: a[2], owner_email: a[3], dry_run: a[7], status: 'queued', spec_json: a[4], inputs_json: a[5], created_at: a[6] })
          else if (sql.includes("UPDATE flow_runs SET status = 'running'")) runs.get(a[0]).status = 'running'
          else if (sql.includes("UPDATE flow_runs SET status = 'waiting'")) runs.get(a[0]).status = 'waiting'
          else if (sql.startsWith("UPDATE flow_run_steps SET status = 'deciding'")) {
            const row = steps.find((x) => x.run_id === a[0] && x.seq === a[1] && x.status === 'waiting')
            if (row) row.status = 'deciding'
            return { success: true, meta: { changes: row ? 1 : 0 } }
          } else if (sql.startsWith("UPDATE flow_run_steps SET status = 'waiting'")) {
            const row = steps.find((x) => x.run_id === a[0] && x.seq === a[1]); if (row) row.status = 'waiting'
          }
          else if (sql.includes("SET status = 'succeeded'")) Object.assign(runs.get(a[0]), { status: 'succeeded', digest: a[1], finished_at: a[2] })
          else if (sql.includes("SET status = 'failed'")) Object.assign(runs.get(a[0]), { status: 'failed', error: a[1], finished_at: a[2] })
          else if (sql.startsWith('INSERT OR REPLACE INTO flow_run_steps')) {
            const i = steps.findIndex((x) => x.run_id === a[0] && x.seq === a[1])
            const row = { run_id: a[0], seq: a[1], node_id: a[2], kind: a[3], status: a[4], summary: a[5], detail_json: a[6], edge: a[7], at: a[8] }
            if (i >= 0) steps[i] = row; else steps.push(row)
          }
          else throw new Error('unexpected SQL: ' + sql)
          return { success: true }
        },
        async first() {
          if (sql.includes('FROM flow_runs WHERE id')) return runs.get(a[0]) || null
          if (sql.includes("FROM flow_run_steps WHERE run_id = ?1 AND status = 'waiting'")) {
            return steps.filter((x) => x.run_id === a[0] && x.status === 'waiting' && x.kind === 'approval').sort((x, y) => y.seq - x.seq)[0] || null
          }
          throw new Error('unexpected SQL: ' + sql)
        },
        async all() {
          if (sql.includes('FROM flow_run_steps')) return { results: steps.filter((s) => s.run_id === a[0]).sort((x, y) => x.seq - y.seq) }
          if (sql.includes('FROM flow_runs WHERE owner_email')) return { results: [...runs.values()].filter((r) => r.owner_email === a[0]) }
          throw new Error('unexpected SQL: ' + sql)
        },
      }
      return st
    },
  }
  return db
}

/**
 * A Workflows binding that runs the instance inline. create() returns when the run has finished
 * or is paused in waitForEvent; sendEvent() resumes it, and settled() waits for it to stop again.
 * With { timeoutApprovals: true } every waitForEvent times out (throws), as Workflows does.
 */
function fakeRunner(env, { timeoutApprovals = false } = {}) {
  const instances = new Map()
  const stepNames = []
  return {
    instances,
    stepNames,
    async create({ id, params }) {
      const wf = new FlowRunner({}, env)
      const inst = { status: 'running', waiters: new Map() }
      let pause = () => {}
      const pausedNow = () => new Promise((r) => { pause = r })
      inst.paused = pausedNow()
      const step = {
        do: async (name, a, b) => { stepNames.push(name); return typeof a === 'function' ? a() : b() },
        waitForEvent: async (name, { type, timeout }) => {
          stepNames.push(name)
          if (timeoutApprovals) throw new Error(`timed out after ${timeout}`)
          const got = new Promise((resolve) => inst.waiters.set(type, resolve))
          inst.status = 'waiting'
          const p = pause
          inst.paused = pausedNow()
          p()
          const ev = await got
          inst.status = 'running'
          return ev
        },
      }
      inst.done = wf.run({ payload: params }, step).then(() => { inst.status = 'complete' }, () => { inst.status = 'errored' })
      const handle = {
        status: async () => ({ status: inst.status }),
        sendEvent: async ({ type, payload }) => {
          const w = inst.waiters.get(type)
          if (!w) throw new Error(`no waiter for ${type}`)
          inst.waiters.delete(type)
          w({ type, payload, timestamp: new Date() })
        },
        settled: () => Promise.race([inst.done, inst.paused]),
      }
      instances.set(id, handle)
      await handle.settled()
      return { id }
    },
    async get(id) { return instances.get(id) },
  }
}

/** knowledge-graph-worker's /internal/flows/call-tool: read-only tools answer, the rest are refused. */
function fakeKG() {
  const calls = []
  return {
    calls,
    fetch: async (url, init) => {
      const u = new URL(url)
      const body = JSON.parse(init.body)
      calls.push({ host: u.hostname, path: u.pathname, ...body })
      if (body.toolName === 'send_email') {
        if (!body.approval) return new Response(JSON.stringify({ ok: false, status: 403, error: 'needs an approval' }), { status: 403 })
        return new Response(JSON.stringify({ ok: true, isError: false, structured: { success: true, sent: true, toEmail: body.args.toEmail }, text: 'sent' }), { status: 200 })
      }
      if (body.toolName === 'list_my_graphs') {
        return new Response(JSON.stringify({ ok: true, isError: false, structured: { success: true, results: [{ graphId: 'g1', title: 'Min graf' }] }, text: '1 graph' }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: false, status: 403, error: `"${body.toolName}" changes or sends something` }), { status: 403 })
    },
  }
}

/** anthropic-worker's /chat: answers with a fixed text and usage, or fails. */
function fakeAI({ fail = false, text = 'Grafene handler om Min graf.' } = {}) {
  const calls = []
  return {
    calls,
    fetch: async (url, init) => {
      const u = new URL(url)
      const body = JSON.parse(init.body)
      calls.push({ host: u.hostname, path: u.pathname, ...body })
      if (fail) return new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 529 })
      return new Response(JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 1000, output_tokens: 100 } }), { status: 200 })
    },
  }
}

function makeEnv(opts = {}) {
  const env = { DB: fakeD1(), KG_WORKER: fakeKG(), ANTHROPIC: fakeAI(opts.ai) }
  env.FLOW_RUNNER = fakeRunner(env, opts)
  return env
}

const ALIASES = [{ alias: 'fast', model: 'claude-haiku-5-5', fallbackAlias: 'smart' }, { alias: 'smart', model: 'claude-sonnet-5-5' }]
const GRAPH = {
  id: 'graph-hello', version: 2,
  nodes: [
    { id: 'f', type: 'flow', label: 'Hei, flow', metadata: { kind: 'vegr-flow', status: 'test' } },
    { id: 'les', type: 'flow-step', label: 'Les grafene mine', metadata: { kind: 'action', toolName: 'list_my_graphs', params: { limit: 3 } } },
    { id: 'oppsummer', type: 'flow-step', label: 'Oppsummer', metadata: { kind: 'agent', model: 'fast', instructions: 'Oppsummer', input: { g: '{{les.result}}' } } },
  ],
  edges: [{ source: 'f', target: 'les' }, { source: 'les', target: 'oppsummer' }],
}

const call = (env, path, init = {}, host = 'flows-worker') =>
  worker.fetch(new Request(`https://${host}${path}`, init), env).then(async (r) => ({ status: r.status, body: await r.json() }))
const post = (env, body, host) => call(env, '/flows/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, host)

test('health is public; everything else is refused from the internet', async () => {
  const env = makeEnv()
  assert.equal((await call(env, '/health', {}, 'flows-worker.torarnehave.workers.dev')).status, 200)
  const r = await post(env, { graph: GRAPH, aliases: ALIASES, actor: { email: 'a@b.no' } }, 'flows-worker.torarnehave.workers.dev')
  assert.equal(r.status, 403)
  assert.equal(env.DB.runs.size, 0)
})

test('a dry run is compiled, pinned, run step by step and readable by its owner', async () => {
  const env = makeEnv()
  const r = await post(env, { graph: GRAPH, aliases: ALIASES, actor: { email: 'Tor@Example.no' }, inputs: { x: 1 } })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  assert.equal(r.body.ok, true)
  assert.equal(r.body.steps, 2)

  const run = env.DB.runs.get(r.body.runId)
  assert.equal(run.status, 'succeeded')
  assert.equal(run.owner_email, 'tor@example.no')
  assert.match(run.digest, /Dry run of "Hei, flow": 2 steps/)

  const read = await call(env, `/flows/runs/${r.body.runId}?email=tor@example.no`)
  assert.equal(read.status, 200)
  assert.deepEqual(read.body.steps.map((s) => s.nodeId), ['les', 'oppsummer'])
  assert.match(read.body.steps[1].summary, /claude-haiku-5-5/)
  assert.equal(read.body.run.workflowStatus, 'complete')

  const other = await call(env, `/flows/runs/${r.body.runId}?email=someone@else.no`)
  assert.equal(other.status, 404, 'another user cannot read the run')

  const list = await call(env, '/flows/runs?email=tor@example.no')
  assert.equal(list.body.runs.length, 1)
})

test('a flow that does not compile is answered 422 with the reasons and never started', async () => {
  const env = makeEnv()
  const bad = { ...GRAPH, nodes: [...GRAPH.nodes, { id: 'send', type: 'flow-step', label: 'Send', metadata: { kind: 'action', toolName: 'send_email' } }], edges: [...GRAPH.edges, { source: 'oppsummer', target: 'send' }] }
  const r = await post(env, { graph: bad, aliases: ALIASES, actor: { email: 'a@b.no' } })
  assert.equal(r.status, 422)
  assert.match(r.body.errors.join('\n'), /without an approval/)
  assert.equal(env.DB.runs.size, 0)
})

test('a missing actor is refused', async () => {
  const env = makeEnv()
  assert.equal((await post(env, { graph: GRAPH, aliases: ALIASES })).status, 400)
  assert.equal(env.DB.runs.size, 0)
})

test('a live run calls the read-only tool as the owner and feeds its result to the next step', async () => {
  const env = makeEnv()
  const r = await post(env, { graph: GRAPH, aliases: ALIASES, actor: { email: 'Tor@Example.no' }, dryRun: false })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  assert.equal(r.body.dryRun, false)
  const run = env.DB.runs.get(r.body.runId)
  assert.equal(run.dry_run, 0)
  assert.equal(run.status, 'succeeded', run.error)
  assert.match(run.digest, /Live run of "Hei, flow"/)
  assert.deepEqual(env.KG_WORKER.calls.map((c) => [c.host, c.path, c.email, c.toolName]), [['knowledge-graph-worker', '/internal/flows/call-tool', 'tor@example.no', 'list_my_graphs']])
  const steps = env.DB.steps.filter((s) => s.run_id === r.body.runId)
  assert.equal(steps[0].status, 'ok')
  assert.equal(steps[1].status, 'ok', 'the agent step really asked the model')
  assert.match(steps[1].detail_json, /Min graf/, 'the agent step saw the real result of the read step')
  assert.equal(env.ANTHROPIC.calls.length, 1)
  assert.equal(env.ANTHROPIC.calls[0].host, 'anthropic-worker')
  assert.equal(env.ANTHROPIC.calls[0].model, 'claude-haiku-5-5', 'the alias "fast" resolved')
  assert.match(env.ANTHROPIC.calls[0].messages[0].content, /Min graf/)
})

const HEI = {
  ...GRAPH,
  nodes: [
    GRAPH.nodes[0], GRAPH.nodes[1],
    { id: 'oppsummer', type: 'flow-step', label: 'Oppsummer', metadata: { kind: 'agent', model: 'fast', instructions: 'Skriv ett avsnitt', input: { grafer: '{{les.result.results}}' } } },
    { id: 'godkjenn', type: 'flow-step', label: 'Godkjenn', metadata: { kind: 'approval', approver: 'owner', allowEdit: true, timeout: '24h', payload: { tekst: '{{oppsummer.result.text}}' } } },
    { id: 'send', type: 'flow-step', label: 'Send', metadata: { kind: 'action', toolName: 'send_email', params: { fromEmail: 'post@vegr.ai', toEmail: '{{owner.email}}', subject: 'Mine siste grafer', bodyHtml: '<p>{tekst}</p>', variables: { tekst: '{{godkjenn.result.text}}' } } } },
    { id: 'stopp', type: 'flow-step', label: 'Ikke sendt', metadata: { kind: 'note' } }],
  edges: [...GRAPH.edges, { source: 'oppsummer', target: 'godkjenn' }, { source: 'godkjenn', target: 'send', label: 'approved' }, { source: 'godkjenn', target: 'stopp', label: 'rejected' }],
}
const decideReq = (env, runId, body) => call(env, `/flows/runs/${runId}/decide`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('the full Hei, flow: reads, summarises with the model, waits for the owner, sends once after yes', async () => {
  const env = makeEnv()
  const r = await post(env, { graph: HEI, aliases: ALIASES, actor: { email: 'Tor@Example.no' }, dryRun: false })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  const runId = r.body.runId
  const run = env.DB.runs.get(runId)
  assert.equal(run.status, 'waiting', 'the run pauses at the approval')
  const waiting = env.DB.steps.find((s) => s.node_id === 'godkjenn')
  assert.equal(waiting.status, 'waiting')
  assert.match(waiting.detail_json, /Grafene handler om Min graf/, 'the owner sees the model\'s real text')
  assert.ok(!env.KG_WORKER.calls.some((c) => c.toolName === 'send_email'), 'nothing is sent before the decision')

  assert.equal((await decideReq(env, runId, { email: 'someone@else.no', approved: true })).status, 404, 'only the owner decides')
  const d = await decideReq(env, runId, { email: 'tor@example.no', approved: true, text: 'Min egen tekst <b>' })
  assert.equal(d.status, 200, JSON.stringify(d.body))
  assert.equal((await decideReq(env, runId, { email: 'tor@example.no', approved: true })).status, 409, 'a decision is delivered once')
  await (await env.FLOW_RUNNER.get(runId)).settled()

  assert.equal(run.status, 'succeeded', run.error)
  const sends = env.KG_WORKER.calls.filter((c) => c.toolName === 'send_email')
  assert.equal(sends.length, 1, 'sent exactly once')
  assert.equal(sends[0].args.toEmail, 'tor@example.no', 'the recipient is the owner, never model output')
  assert.equal(sends[0].args.variables.tekst, 'Min egen tekst <b>', 'the edited text is sent, as an escaped variable')
  const sendRow = env.DB.steps.find((s) => s.node_id === 'send')
  assert.deepEqual(sends[0].approval, { runId, seq: sendRow.seq }, 'the send carries its claim')
  assert.equal(sendRow.status, 'sent')
  assert.deepEqual(env.DB.steps.filter((s) => s.run_id === runId).map((s) => [s.node_id, s.status]),
    [['les', 'ok'], ['oppsummer', 'ok'], ['godkjenn', 'approved'], ['send', 'sent']])
  assert.match(run.digest, /1 sent/)
  assert.ok(env.FLOW_RUNNER.stepNames.includes(`send#4 claim`), 'the send is claimed in its own durable step')
})

test('a rejection follows the "rejected" edge and nothing is sent', async () => {
  const env = makeEnv()
  const r = await post(env, { graph: HEI, aliases: ALIASES, actor: { email: 'a@b.no' }, dryRun: false })
  const runId = r.body.runId
  assert.equal((await decideReq(env, runId, { email: 'a@b.no', approved: false })).status, 200)
  await (await env.FLOW_RUNNER.get(runId)).settled()
  const run = env.DB.runs.get(runId)
  assert.equal(run.status, 'succeeded', run.error)
  assert.deepEqual(env.DB.steps.map((s) => [s.node_id, s.status]), [['les', 'ok'], ['oppsummer', 'ok'], ['godkjenn', 'rejected'], ['stopp', 'simulated']])
  assert.ok(!env.KG_WORKER.calls.some((c) => c.toolName === 'send_email'))
})

test('an approval that times out counts as rejected', async () => {
  const env = makeEnv({ timeoutApprovals: true })
  const r = await post(env, { graph: HEI, aliases: ALIASES, actor: { email: 'a@b.no' }, dryRun: false })
  const run = env.DB.runs.get(r.body.runId)
  assert.equal(run.status, 'succeeded', run.error)
  assert.equal(env.DB.steps.find((s) => s.node_id === 'godkjenn').status, 'rejected')
  assert.ok(!env.KG_WORKER.calls.some((c) => c.toolName === 'send_email'))
})

test('a model that fails stops the run before anything waits or sends', async () => {
  const env = makeEnv({ ai: { fail: true } })
  const r = await post(env, { graph: HEI, aliases: ALIASES, actor: { email: 'a@b.no' }, dryRun: false })
  const run = env.DB.runs.get(r.body.runId)
  assert.equal(run.status, 'failed')
  assert.match(run.error, /did not answer/)
  assert.equal(env.ANTHROPIC.calls.length, 2, 'the fallback model was tried too')
  assert.equal(env.ANTHROPIC.calls[1].model, 'claude-sonnet-5-5')
})

test('a decision for a run that is not waiting is refused', async () => {
  const env = makeEnv()
  const r = await post(env, { graph: GRAPH, aliases: ALIASES, actor: { email: 'a@b.no' }, dryRun: false })
  assert.equal((await decideReq(env, r.body.runId, { email: 'a@b.no', approved: true })).status, 409)
})

test('a dry run of the full Hei, flow still calls nothing', async () => {
  const env = makeEnv()
  const r = await post(env, { graph: HEI, aliases: ALIASES, actor: { email: 'a@b.no' } })
  const run = env.DB.runs.get(r.body.runId)
  assert.equal(run.status, 'succeeded', run.error)
  assert.equal(env.KG_WORKER.calls.length, 0)
  assert.equal(env.ANTHROPIC.calls.length, 0)
})

test('a live tool that fails stops the run, or follows its "error" edge when it has one', async () => {
  const env = makeEnv()
  const failing = { ...GRAPH, nodes: [GRAPH.nodes[0], { id: 'les', type: 'flow-step', label: 'Les', metadata: { kind: 'action', toolName: 'create_graph', params: {} } }], edges: [{ source: 'f', target: 'les' }] }
  const r = await post(env, { graph: failing, aliases: ALIASES, actor: { email: 'a@b.no' }, dryRun: false })
  const run = env.DB.runs.get(r.body.runId)
  assert.equal(run.status, 'failed')
  assert.match(run.error, /create_graph/)

  const env2 = makeEnv()
  const withErr = { ...failing, nodes: [...failing.nodes, { id: 'oops', type: 'flow-step', label: 'Feil', metadata: { kind: 'note' } }], edges: [...failing.edges, { source: 'les', target: 'oops', label: 'error' }] }
  const r2 = await post(env2, { graph: withErr, aliases: ALIASES, actor: { email: 'a@b.no' }, dryRun: false })
  const run2 = env2.DB.runs.get(r2.body.runId)
  assert.equal(run2.status, 'succeeded', run2.error)
  assert.deepEqual(env2.DB.steps.map((s) => [s.node_id, s.status, s.edge]), [['les', 'error', 'error'], ['oops', 'simulated', null]])
})

test('a paused flow is not started', async () => {
  const env = makeEnv()
  const paused = { ...GRAPH, nodes: [{ ...GRAPH.nodes[0], metadata: { kind: 'vegr-flow', status: 'paused' } }, ...GRAPH.nodes.slice(1)] }
  assert.equal((await post(env, { graph: paused, aliases: ALIASES, actor: { email: 'a@b.no' } })).status, 409)
})
