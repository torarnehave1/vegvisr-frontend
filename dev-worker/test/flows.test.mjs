/**
 * run_flow / get_flow_run (2026-11-06, VEGR Flows phase 0/1), through a real MCP client.
 * Run: node --test dev-worker/test/flows.test.mjs
 *
 * The engine itself (compiler, runner) is tested in flows-worker/test. Here: who may run what,
 * what crosses the FLOWS_WORKER binding (the graph, the aliases, the VERIFIED e-mail and nothing
 * the caller typed), and how answers come back.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { freshDb, seedUsers } from './d1-adapter.mjs'
import { registerTools } from '../mcp/tools.js'

async function connect(env, { auth, props }) {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerTools(server, () => ({ auth, env, props }))
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(b), client.connect(a)])
  return client
}
const authFor = (email, scope, role = 'User') => ({
  auth: { token: 'redacted', audience: 'https://knowledge.vegvisr.org/mcp', scope, userId: email, clientId: 'test' },
  props: { userId: email, email, role, authMethod: 'oauth_otp' },
})
const ALICE = authFor('alice@example.com', ['graph:read'])
const BOB = authFor('bob@example.com', ['graph:read'])
const NO_SCOPE = authFor('alice@example.com', [])

const FLOW_ID = '7c1c7b5e-0d5f-4a41-9b2e-6f1f3f0c1a01'
const RUN_ID = '0b9b8b2a-1111-4222-8333-944455556666'

/** The flow graph is raw-seeded too, with node types (flow, flow-step) a fresh test DB has not registered. */
function seed(raw) {
  const flow = JSON.stringify({
    metadata: { title: 'Hei, flow', metaArea: '#FLOWS', createdBy: 'alice@example.com', version: 1 },
    nodes: [
      { id: 'f', type: 'flow', label: 'Hei, flow', info: '', metadata: { kind: 'vegr-flow', status: 'test' } },
      { id: 'les', type: 'flow-step', label: 'Les', info: '', metadata: { kind: 'action', toolName: 'list_my_graphs' } },
    ],
    edges: [{ source: 'f', target: 'les' }],
  })
  raw.prepare('INSERT INTO knowledge_graphs (id, title, created_by, data) VALUES (?,?,?,?)')
    .run(FLOW_ID, 'Hei, flow', 'alice@example.com', flow)
  // The production registry predates UUID ids, so it is seeded as a raw row, as it exists.
  const reg = JSON.stringify({
    metadata: { title: 'Vegvisr System Registry', version: 1 },
    nodes: [
      { id: 'model-alias-fast', type: 'model-alias', label: 'fast', info: '', metadata: { alias: 'fast', model: 'claude-haiku-5-5', fallbackAlias: 'smart' } },
      { id: 'model-alias-smart', type: 'model-alias', label: 'smart', info: '', metadata: { alias: 'smart', model: 'claude-sonnet-5-5' } },
      { id: 'nodetype-flow', type: 'system-nodetype', label: 'flow', info: '' },
    ],
    edges: [],
  })
  raw.prepare('INSERT INTO knowledge_graphs (id, title, created_by, data) VALUES (?,?,?,?)')
    .run('graph_system_registry', 'Vegvisr System Registry', 'owner@example.com', reg)
}

/** A flows-worker that records what it was sent and answers like the real one. */
function fakeFlows({ compileErrors = null } = {}) {
  const calls = []
  return {
    calls,
    fetch: async (url, init = {}) => {
      const u = new URL(url)
      calls.push({ host: u.hostname, path: u.pathname, search: u.search, body: init.body ? JSON.parse(init.body) : null })
      if (u.pathname === '/flows/run') {
        if (compileErrors) return new Response(JSON.stringify({ ok: false, errors: compileErrors, warnings: [] }), { status: 422 })
        return new Response(JSON.stringify({ ok: true, runId: RUN_ID, status: 'queued', dryRun: true, flow: 'Hei, flow', steps: 1, warnings: [] }), { status: 200 })
      }
      if (u.pathname === `/flows/runs/${RUN_ID}`) {
        if (u.searchParams.get('email') !== 'alice@example.com') return new Response(JSON.stringify({ error: 'Run not found.' }), { status: 404 })
        return new Response(JSON.stringify({
          ok: true,
          run: { id: RUN_ID, flowGraphId: FLOW_ID, flowVersion: 1, flow: 'Hei, flow', status: 'succeeded', workflowStatus: 'complete', dryRun: true, digest: 'Dry run of "Hei, flow": 1 step, nothing was called.\n1. Les — would call list_my_graphs', error: null, createdAt: '2026-11-06T19:00:00Z', finishedAt: '2026-11-06T19:00:02Z' },
          steps: [{ seq: 1, nodeId: 'les', kind: 'action', status: 'ok', summary: 'would call list_my_graphs', edge: null, detail: { toolName: 'list_my_graphs' }, at: '2026-11-06T19:00:01Z' }],
        }), { status: 200 })
      }
      return new Response('{}', { status: 404 })
    },
  }
}

describe('run_flow / get_flow_run', () => {
  test('the owner runs a flow: graph + aliases + verified e-mail cross the binding, the finished run comes back', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    seed(raw)
    env.FLOWS_WORKER = fakeFlows()
    const client = await connect(env, ALICE)
    const r = await client.callTool({ name: 'run_flow', arguments: { graphId: FLOW_ID, inputs: { x: 1 }, waitSeconds: 2 } })
    assert.notEqual(r.isError, true, JSON.stringify(r.structuredContent))
    const sc = r.structuredContent
    assert.equal(sc.runId, RUN_ID)
    assert.equal(sc.status, 'succeeded')
    assert.equal(sc.steps.length, 1)
    assert.match(r.content[0].text, /nothing was called/)

    const sent = env.FLOWS_WORKER.calls[0]
    assert.equal(sent.host, 'flows-worker', 'only over the binding name')
    assert.equal(sent.body.actor.email, 'alice@example.com', 'the e-mail comes from the token')
    assert.equal(sent.body.dryRun, true)
    assert.deepEqual(sent.body.inputs, { x: 1 })
    assert.deepEqual(sent.body.graph.nodes.map((n) => n.type), ['flow', 'flow-step'])
    assert.deepEqual(sent.body.aliases.map((a) => [a.alias, a.model]), [['fast', 'claude-haiku-5-5'], ['smart', 'claude-sonnet-5-5']])
  })

  test('someone else cannot run your flow, and nothing reaches the engine', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    seed(raw)
    env.FLOWS_WORKER = fakeFlows()
    const client = await connect(env, BOB)
    const r = await client.callTool({ name: 'run_flow', arguments: { graphId: FLOW_ID } })
    assert.equal(r.isError, true)
    assert.equal(env.FLOWS_WORKER.calls.length, 0)
  })

  test('without graph:read the tools refuse', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    seed(raw)
    env.FLOWS_WORKER = fakeFlows()
    const client = await connect(env, NO_SCOPE)
    for (const [name, args] of [['run_flow', { graphId: FLOW_ID }], ['get_flow_run', { runId: RUN_ID }]]) {
      const r = await client.callTool({ name, arguments: args })
      assert.equal(r.isError, true, name)
    }
    assert.equal(env.FLOWS_WORKER.calls.length, 0)
  })

  test('a flow that does not compile returns the reasons', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    seed(raw)
    env.FLOWS_WORKER = fakeFlows({ compileErrors: ['Action "Send" calls send_email … Put an approval step before it.'] })
    const client = await connect(env, ALICE)
    const r = await client.callTool({ name: 'run_flow', arguments: { graphId: FLOW_ID } })
    assert.equal(r.isError, true)
    assert.match(JSON.stringify(r), /approval step/)
  })

  test('get_flow_run reads your own run; another user gets not found', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    seed(raw)
    env.FLOWS_WORKER = fakeFlows()
    const mine = await (await connect(env, ALICE)).callTool({ name: 'get_flow_run', arguments: { runId: RUN_ID } })
    assert.notEqual(mine.isError, true, JSON.stringify(mine.structuredContent))
    assert.equal(mine.structuredContent.run.status, 'succeeded')
    assert.match(mine.content[0].text, /1\. les \(action\) — would call list_my_graphs/)
    const theirs = await (await connect(env, BOB)).callTool({ name: 'get_flow_run', arguments: { runId: RUN_ID } })
    assert.equal(theirs.isError, true)
  })

  test('a malformed runId never reaches the engine', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.FLOWS_WORKER = fakeFlows()
    const r = await (await connect(env, ALICE)).callTool({ name: 'get_flow_run', arguments: { runId: '../../etc' } })
    assert.equal(r.isError, true)
    assert.equal(env.FLOWS_WORKER.calls.length, 0)
  })
})

// ── flow-tools: one read-only tool, run as the flow's owner (2026-11-06) ──
import { callToolForFlow, FLOW_SCOPES } from '../flow-tools.js'

describe('callToolForFlow — a flow runs MCP tools as its owner, read-only', () => {
  test('a read-only tool runs as the owner and sees only the owner\'s graphs', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    seed(raw) // alice owns the flow graph
    const r = await callToolForFlow(env, { email: 'Alice@Example.com', toolName: 'list_my_graphs', args: { limit: 5 } })
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.equal(r.isError, false, r.text)
    assert.ok(r.structured.results.some((g) => g.graphId === FLOW_ID), 'alice sees her flow graph')
    const bob = await callToolForFlow(env, { email: 'bob@example.com', toolName: 'list_my_graphs', args: {} })
    assert.equal(bob.ok, true)
    assert.ok(!bob.structured.results.some((g) => g.graphId === FLOW_ID), 'bob does not')
  })

  test('a tool that writes or sends is refused before it runs', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    for (const toolName of ['create_graph', 'send_email', 'send_sms', 'add_node', 'run_flow']) {
      const r = await callToolForFlow(env, { email: 'alice@example.com', toolName, args: { title: 'x', metaArea: '#X' } })
      assert.equal(r.ok, false, toolName)
      assert.equal(r.status, 403, toolName)
    }
    const graphs = raw.prepare('SELECT COUNT(*) n FROM knowledge_graphs').get().n
    assert.equal(graphs, 0, 'nothing was created')
  })

  test('an unknown owner, an unknown tool and a missing tool name are refused', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    assert.equal((await callToolForFlow(env, { email: 'nobody@example.com', toolName: 'list_my_graphs' })).status, 403)
    assert.equal((await callToolForFlow(env, { email: 'alice@example.com', toolName: 'no_such_tool' })).status, 404)
    assert.equal((await callToolForFlow(env, { email: 'alice@example.com' })).status, 400)
  })

  test('the flow principal holds read scopes only', () => {
    assert.deepEqual([...FLOW_SCOPES].sort(), ['contacts:read', 'graph:read'])
  })
})
