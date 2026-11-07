// VEGR Flows phase 2: schedules. Real SQL (node:sqlite through the same D1 adapter the MCP
// server's tests use), the real worker, a fake KG_WORKER and Workflows binding.
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { D1Like } from '../../dev-worker/test/d1-adapter.mjs'
import { parseCron, nextRun, scheduleTriggers } from '../schedule.js'
register(`data:text/javascript,${encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,' + encodeURIComponent('export class WorkflowEntrypoint { constructor(ctx, env) { this.ctx = ctx; this.env = env } }'), shortCircuit: true }
    return next(specifier, context)
  }
`)}`)
const { default: worker, runDueTriggers, FlowRunner } = await import('../index.js')

const OWNER = 'tor@example.no'
const ALIASES = [{ alias: 'fast', model: 'claude-haiku-5-5', fallbackAlias: 'smart' }, { alias: 'smart', model: 'claude-sonnet-5-5' }]

function flowGraph({ triggers = [{ id: 't_morgen', type: 'schedule', cron: '0 7 * * *', timezone: 'Europe/Oslo' }], status = 'active', approval = false } = {}) {
  const nodes = [
    { id: 'flow', type: 'flow', label: 'Morgenflow', metadata: { kind: 'vegr-flow', status, triggers, notify: { fromEmail: 'post@vegr.ai' } } },
    { id: 'les', type: 'flow-step', label: 'Les', metadata: { kind: 'action', toolName: 'list_my_graphs', params: { limit: 3 } } },
  ]
  const edges = [{ source: 'flow', target: 'les' }]
  if (approval) {
    nodes.push(
      { id: 'godkjenn', type: 'flow-step', label: 'Godkjenn', metadata: { kind: 'approval', payload: { tekst: 'Hei fra flowen' } } },
      { id: 'send', type: 'flow-step', label: 'Send', metadata: { kind: 'action', toolName: 'send_email', params: { fromEmail: 'post@vegr.ai', toEmail: '{{owner.email}}', subject: 'x', bodyHtml: 'x' } } },
    )
    edges.push({ source: 'les', target: 'godkjenn' }, { source: 'godkjenn', target: 'send', label: 'approved' })
  }
  return { id: 'g-flow', version: 1, nodes, edges }
}

function makeEnv({ graph = flowGraph(), loadStatus = 200, runInline = false } = {}) {
  const raw = new DatabaseSync(':memory:')
  raw.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'))
  const env = { DB: new D1Like(raw) }
  const kgCalls = []
  env.KG_WORKER = {
    calls: kgCalls,
    fetch: async (url, init) => {
      const body = JSON.parse(init.body)
      kgCalls.push({ path: new URL(url).pathname, ...body })
      if (new URL(url).pathname === '/internal/flows/load') {
        if (loadStatus !== 200) return new Response(JSON.stringify({ error: 'not yours' }), { status: loadStatus })
        return new Response(JSON.stringify({ ok: true, graph: env.currentGraph, aliases: ALIASES }), { status: 200 })
      }
      if (body.toolName === 'list_my_graphs') return new Response(JSON.stringify({ ok: true, structured: { results: [] }, text: '' }), { status: 200 })
      if (body.toolName === 'send_email') return new Response(JSON.stringify({ ok: true, structured: { sent: true }, text: 'sent' }), { status: 200 })
      return new Response(JSON.stringify({ ok: false, error: 'unexpected' }), { status: 400 })
    },
  }
  env.currentGraph = graph
  const created = []
  env.FLOW_RUNNER = {
    created,
    async create({ id, params }) {
      created.push(id)
      if (!runInline) return { id }
      const step = {
        do: async (_n, a, b) => (typeof a === 'function' ? a() : b()),
        waitForEvent: async () => { throw new Error('timed out') }, // nobody answers: rejected
      }
      await new FlowRunner({}, env).run({ payload: params }, step).catch(() => {})
      return { id }
    },
    async get() { return { status: async () => ({ status: 'complete' }) } },
  }
  return { env, raw }
}

const call = (env, path, body) => worker.fetch(new Request(`https://flows-worker${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), env)
const activate = (env, active = true, graph = env.currentGraph) => call(env, '/flows/activate', { graph, aliases: ALIASES, actor: { email: OWNER }, active })
const seedFinishedRun = (raw) => raw.prepare("INSERT INTO flow_runs (id, flow_graph_id, owner_email, dry_run, status, spec_json, created_at) VALUES ('r0', 'g-flow', ?, 1, 'succeeded', '{}', '2026-11-06T00:00:00Z')").run(OWNER)

test('cron: fields, ranges, steps, weekdays and Oslo time across summer time', () => {
  assert.throws(() => parseCron('0 7 * *'), /5 fields/)
  assert.throws(() => parseCron('0 24 * * *'), /outside hour/)
  const after = new Date('2026-11-07T07:30:00Z') // Saturday 08:30 in Oslo (CET)
  assert.equal(nextRun('0 7 * * *', 'Europe/Oslo', after).toISOString(), '2026-11-08T06:00:00.000Z')
  assert.equal(nextRun('*/15 * * * *', 'Europe/Oslo', after).toISOString(), '2026-11-07T07:45:00.000Z')
  assert.equal(nextRun('0 8 * * 1-5', 'Europe/Oslo', after).toISOString(), '2026-11-09T07:00:00.000Z', 'Monday')
  assert.equal(nextRun('0 7 * * *', 'Europe/Oslo', new Date('2026-03-28T07:00:00Z')).toISOString(), '2026-03-29T05:00:00.000Z', '07:00 in summer time is 05:00 UTC')
  assert.equal(nextRun('0 0 31 2 *', 'Europe/Oslo', after), null, '31 February never comes')
  assert.match(scheduleTriggers({ triggers: [{ id: 'x', type: 'schedule', cron: '0 7 * * *', timezone: 'Mars/Olympus' }] }).errors[0], /unknown time zone/)
})

test('activation needs a schedule, a flow that has run once, and gives the next run in Oslo time', async () => {
  const { env, raw } = makeEnv()
  let r = await activate(env)
  assert.equal(r.status, 409)
  assert.match((await r.json()).errors[0], /Run the flow once first/)

  seedFinishedRun(raw)
  r = await activate(env)
  const body = await r.json()
  assert.equal(r.status, 200, JSON.stringify(body))
  assert.equal(body.triggers.length, 1)
  assert.equal(body.triggers[0].enabled, true)
  assert.match(body.triggers[0].nextRunLocal, /kl\. 07:00/)

  const none = makeEnv({ graph: flowGraph({ triggers: [] }) })
  seedFinishedRun(none.raw)
  r = await activate(none.env)
  assert.equal(r.status, 422)
  assert.match((await r.json()).errors[0], /no schedule/)

  r = await activate(env, false)
  assert.equal((await r.json()).triggers[0].enabled, false, 'pausing turns the schedule off')
})

test('a due schedule starts one live run, read fresh from the graph, and moves on to the next slot', async () => {
  const { env, raw } = makeEnv()
  seedFinishedRun(raw)
  await activate(env)
  const due = new Date(raw.prepare('SELECT next_run_at FROM flow_triggers').get().next_run_at)

  assert.equal((await runDueTriggers(env, new Date(due.getTime() - 60000))).length, 0, 'nothing before its time')
  const started = await runDueTriggers(env, due)
  assert.equal(started.length, 1)
  assert.match(started[0].result, /^started run/)
  assert.equal(env.FLOW_RUNNER.created.length, 1)
  const run = raw.prepare('SELECT * FROM flow_runs WHERE id = ?').get(started[0].runId)
  assert.equal(run.trigger_id, 't_morgen')
  assert.equal(run.dry_run, 0, 'scheduled runs are live')
  assert.ok(env.KG_WORKER.calls.some((c) => c.path === '/internal/flows/load' && c.email === OWNER && c.graphId === 'g-flow'))
  const t = raw.prepare('SELECT * FROM flow_triggers').get()
  assert.equal(new Date(t.next_run_at).getTime() - due.getTime(), 86400000, 'the next slot is tomorrow')

  assert.equal((await runDueTriggers(env, due)).length, 0, 'the same slot never starts twice')
})

test('a slot is skipped while the previous run is still going (concurrency 1)', async () => {
  const { env, raw } = makeEnv()
  seedFinishedRun(raw)
  await activate(env)
  raw.prepare("INSERT INTO flow_runs (id, flow_graph_id, owner_email, dry_run, status, spec_json, created_at) VALUES ('busy', 'g-flow', ?, 0, 'waiting', '{}', '2026-11-07T00:00:00Z')").run(OWNER)
  const due = new Date(raw.prepare('SELECT next_run_at FROM flow_triggers').get().next_run_at)
  const [r] = await runDueTriggers(env, due)
  assert.match(r.result, /skipped: the previous run busy is still going/)
  assert.equal(env.FLOW_RUNNER.created.length, 0)
})

test('a flow that can no longer be read switches its schedule off instead of failing every minute', async () => {
  const { env, raw } = makeEnv({ loadStatus: 403 })
  seedFinishedRun(raw)
  await activate(env)
  const due = new Date(raw.prepare('SELECT next_run_at FROM flow_triggers').get().next_run_at)
  const [r] = await runDueTriggers(env, due)
  assert.match(r.result, /schedule switched off/)
  assert.equal(raw.prepare('SELECT enabled FROM flow_triggers').get().enabled, 0)
})

test('a scheduled run that waits for approval e-mails the owner once; a manual run does not', async () => {
  const { env, raw } = makeEnv({ graph: flowGraph({ approval: true }), runInline: true })
  seedFinishedRun(raw)
  await activate(env)
  const due = new Date(raw.prepare('SELECT next_run_at FROM flow_triggers').get().next_run_at)
  const [r] = await runDueTriggers(env, due)
  const notes = env.KG_WORKER.calls.filter((c) => c.toolName === 'send_email' && c.notify)
  assert.equal(notes.length, 1, JSON.stringify(env.KG_WORKER.calls.map((c) => c.toolName || c.path)))
  assert.equal(notes[0].args.toEmail, OWNER)
  assert.equal(notes[0].args.fromEmail, 'post@vegr.ai')
  assert.match(notes[0].args.subject, /venter på deg/)
  assert.match(notes[0].args.variables.tekst, /Hei fra flowen/)
  assert.deepEqual(notes[0].notify, { runId: r.runId, seq: 2 })
  assert.ok(!env.KG_WORKER.calls.some((c) => c.toolName === 'send_email' && c.approval), 'nobody answered: the flow\'s own send never ran')

  const manual = makeEnv({ graph: flowGraph({ approval: true }), runInline: true })
  await call(manual.env, '/flows/run', { graph: manual.env.currentGraph, aliases: ALIASES, actor: { email: OWNER }, dryRun: false })
  assert.ok(!manual.env.KG_WORKER.calls.some((c) => c.notify), 'you started it in chat, so no e-mail')
})
