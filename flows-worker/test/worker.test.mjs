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
          if (sql.startsWith('INSERT INTO flow_runs')) runs.set(a[0], { id: a[0], flow_graph_id: a[1], flow_version: a[2], owner_email: a[3], dry_run: 1, status: 'queued', spec_json: a[4], inputs_json: a[5], created_at: a[6] })
          else if (sql.includes("SET status = 'running'")) runs.get(a[0]).status = 'running'
          else if (sql.includes("SET status = 'succeeded'")) Object.assign(runs.get(a[0]), { status: 'succeeded', digest: a[1], finished_at: a[2] })
          else if (sql.includes("SET status = 'failed'")) Object.assign(runs.get(a[0]), { status: 'failed', error: a[1], finished_at: a[2] })
          else if (sql.startsWith('INSERT OR REPLACE INTO flow_run_steps')) steps.push({ run_id: a[0], seq: a[1], node_id: a[2], kind: a[3], status: a[4], summary: a[5], detail_json: a[6], edge: a[7], at: a[8] })
          else throw new Error('unexpected SQL: ' + sql)
          return { success: true }
        },
        async first() {
          if (sql.includes('FROM flow_runs WHERE id')) return runs.get(a[0]) || null
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

/** A Workflows binding that runs the instance immediately, with a step that just calls fn. */
function fakeRunner(env) {
  const instances = new Map()
  return {
    instances,
    async create({ id, params }) {
      const wf = new FlowRunner({}, env)
      const step = { do: async (_name, fn) => fn() }
      let status = 'running'
      instances.set(id, { status: async () => ({ status }) })
      try { await wf.run({ payload: params }, step); status = 'complete' } catch { status = 'errored' }
      return { id }
    },
    async get(id) { return instances.get(id) },
  }
}

function makeEnv() {
  const env = { DB: fakeD1() }
  env.FLOW_RUNNER = fakeRunner(env)
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

test('live runs and missing actors are refused', async () => {
  const env = makeEnv()
  assert.equal((await post(env, { graph: GRAPH, aliases: ALIASES, actor: { email: 'a@b.no' }, dryRun: false })).status, 400)
  assert.equal((await post(env, { graph: GRAPH, aliases: ALIASES })).status, 400)
  assert.equal(env.DB.runs.size, 0)
})

test('a paused flow is not started', async () => {
  const env = makeEnv()
  const paused = { ...GRAPH, nodes: [{ ...GRAPH.nodes[0], metadata: { kind: 'vegr-flow', status: 'paused' } }, ...GRAPH.nodes.slice(1)] }
  assert.equal((await post(env, { graph: paused, aliases: ALIASES, actor: { email: 'a@b.no' } })).status, 409)
})
