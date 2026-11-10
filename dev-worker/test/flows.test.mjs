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
    for (const toolName of ['send_email', 'send_sms', 'run_flow', 'publish_html_node', 'set_graph_password', 'create_contact', 'post_chat_message', 'constructor']) {
      const r = await callToolForFlow(env, { email: 'alice@example.com', toolName, args: { title: 'x', metaArea: '#X' } })
      assert.equal(r.ok, false, toolName)
      assert.ok(r.status === 403 || r.status === 404, `${toolName}: ${r.status}`)
    }
    const graphs = raw.prepare('SELECT COUNT(*) n FROM knowledge_graphs').get().n
    assert.equal(graphs, 0, 'nothing was created')
  })

  // write-own (2026-11-10): «Samtalerapport» builds a graph, so a flow may change its owner's own graphs.
  test('write-own: a flow creates and fills a graph of its owner\'s, and cannot touch another user\'s', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const made = await callToolForFlow(env, { email: 'alice@example.com', toolName: 'create_graph', args: { title: 'Samtale med Test', metaArea: '#SAMTALE' } })
    assert.equal(made.ok, true, JSON.stringify(made))
    assert.equal(made.isError, false, made.text)
    const graphId = made.structured?.graphId
    assert.ok(graphId, `create_graph answers with the graph id: ${made.text}`)
    const row = raw.prepare('SELECT created_by FROM knowledge_graphs WHERE id = ?').get(graphId)
    assert.ok(row, 'the graph exists')

    const node = await callToolForFlow(env, { email: 'alice@example.com', toolName: 'add_node', args: { graphId, node: { id: 'oppsummering', label: 'Oppsummering', type: 'fulltext', info: 'Hei' } } })
    assert.equal(node.ok, true, JSON.stringify(node))
    assert.equal(node.isError, false, node.text)

    const bob = await callToolForFlow(env, { email: 'bob@example.com', toolName: 'add_node', args: { graphId, node: { id: 'x', label: 'x', type: 'fulltext', info: 'x' } } })
    assert.ok(bob.ok === false || bob.isError === true, `bob cannot write alice's graph: ${JSON.stringify(bob)}`)
    const after = await callToolForFlow(env, { email: 'alice@example.com', toolName: 'get_graph', args: { graphId } })
    assert.ok(!/\bx\b — x/.test(after.text) && !(after.structured?.nodes || []).some((n) => n.id === 'x'), 'bob\'s node is not there')
  })

  test('write-own lends graph:write for that one tool only', async () => {
    const { FLOW_WRITE_OWN_TOOLS } = await import('../flow-tools.js')
    assert.deepEqual(Object.keys(FLOW_WRITE_OWN_TOOLS).sort(), ['add_edge', 'add_node', 'create_graph', 'transcribe_contact_recording', 'update_graph_metadata', 'update_node'])
    assert.ok(Object.values(FLOW_WRITE_OWN_TOOLS).every((s) => s === 'graph:write'))
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

// ── The Workers runtime refuses code generated from strings (eval, new Function). The first live
//    flow failed on exactly that (Ajv inside the MCP client, 2026-11-06), while every test here
//    was green under plain Node. This runs callToolForFlow in a child Node with the same rule.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

describe('callToolForFlow under the Workers rule: no code generation from strings', () => {
  test('a read-only tool runs with --disallow-code-generation-from-strings', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url))
    const script = `
      import { freshDb, seedUsers } from ${JSON.stringify(dir + 'd1-adapter.mjs')}
      import { callToolForFlow } from ${JSON.stringify(dir + '../flow-tools.js')}
      const { env, raw } = freshDb()
      seedUsers(raw)
      const r = await callToolForFlow(env, { email: 'alice@example.com', toolName: 'list_my_graphs', args: { limit: 3 } })
      process.stdout.write(JSON.stringify({ ok: r.ok, isError: r.isError, error: r.error || null }))
    `
    const out = execFileSync(process.execPath, ['--disallow-code-generation-from-strings', '--input-type=module', '-e', script], { encoding: 'utf8' })
    const r = JSON.parse(out.trim().split('\n').pop())
    assert.deepEqual(r, { ok: true, isError: false, error: null })
  })
})

// ── An approved send (2026-11-06): send_email runs for a flow only with a claim + an approval ──
import { readFileSync } from 'node:fs'

describe('callToolForFlow — an approved send', () => {
  const SEND_RUN = '1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5'
  const ARGS = { fromEmail: 'alice@example.com', toEmail: 'alice@example.com', subject: 'Mine siste grafer', bodyHtml: '<p>{tekst}</p>', variables: { tekst: 'hei' } }

  function withRun({ runStatus = 'running', dry = 0, owner = 'alice@example.com', claim = 'sending', approval = 'approved', claimTool = 'send_email' } = {}) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    raw.exec(readFileSync(new URL('../../flows-worker/schema.sql', import.meta.url), 'utf8'))
    raw.prepare("INSERT INTO flow_runs (id, flow_graph_id, owner_email, dry_run, status, spec_json, created_at) VALUES (?,?,?,?,?,'{}','2026-11-06')")
      .run(SEND_RUN, FLOW_ID, owner, dry, runStatus)
    const step = raw.prepare('INSERT INTO flow_run_steps (run_id, seq, node_id, kind, status, detail_json, at) VALUES (?,?,?,?,?,?,?)')
    if (approval) step.run(SEND_RUN, 3, 'godkjenn', 'approval', approval, null, 'x')
    if (claim) step.run(SEND_RUN, 4, 'send', 'action', claim, JSON.stringify({ toolName: claimTool }), 'x')
    return { env, raw }
  }
  const send = (env, extra = {}) => callToolForFlow(env, { email: 'alice@example.com', toolName: 'send_email', args: ARGS, approval: { runId: SEND_RUN, seq: 4 }, ...extra })
  const claimStatus = (raw) => raw.prepare('SELECT status FROM flow_run_steps WHERE run_id = ? AND seq = 4').get(SEND_RUN)?.status

  test('with a claim and an approval the gate opens once, and the claim is consumed', async () => {
    const { env, raw } = withRun()
    const r = await send(env)
    assert.notEqual(r.status, 403, JSON.stringify(r))
    assert.equal(claimStatus(raw), 'calling', 'the claim was consumed before the tool ran')
    const again = await send(env)
    assert.equal(again.status, 403, 'the same claim cannot send twice')
  })

  test('no approval, a rejected approval, no claim, a wrong tool, a dry or finished run, or another owner: refused', async () => {
    for (const [why, opts] of [
      ['no approval', { approval: null }],
      ['rejected', { approval: 'rejected' }],
      ['no claim', { claim: null }],
      ['claim already used', { claim: 'calling' }],
      ['claim for another tool', { claimTool: 'send_sms' }],
      ['dry run', { dry: 1 }],
      ['finished run', { runStatus: 'succeeded' }],
      ['someone else\'s run', { owner: 'bob@example.com' }],
    ]) {
      const { env } = withRun(opts)
      const r = await send(env)
      assert.equal(r.ok, false, why)
      assert.equal(r.status, 403, why)
    }
  })

  test('a flow e-mail goes to the owner only, without cc or bcc', async () => {
    for (const args of [{ ...ARGS, toEmail: 'bob@example.com' }, { ...ARGS, cc: ['bob@example.com'] }, { ...ARGS, bcc: ['bob@example.com'] }]) {
      const { env, raw } = withRun()
      const r = await send(env, { args })
      assert.equal(r.status, 403)
      assert.match(r.error, /owner only/)
      assert.equal(claimStatus(raw), 'sending', 'a refused send leaves the claim unused')
    }
  })

  test('without an approval object every sending tool is still refused', async () => {
    const { env } = withRun()
    for (const toolName of ['send_email', 'send_sms', 'send_sms_to_user']) {
      const r = await callToolForFlow(env, { email: 'alice@example.com', toolName, args: ARGS })
      assert.equal(r.status, 403, toolName)
    }
    const sms = await callToolForFlow(env, { email: 'alice@example.com', toolName: 'send_sms', args: {}, approval: { runId: SEND_RUN, seq: 4 } })
    assert.equal(sms.status, 403, 'send_sms is not a flow send tool yet')
  })
})

describe('decide_flow_approval', () => {
  function fakeDecide({ status = 200, body = { ok: true, runId: RUN_ID, seq: 3, nodeId: 'godkjenn', approved: true, edited: false } } = {}) {
    const calls = []
    return {
      calls,
      fetch: async (url, init = {}) => {
        const u = new URL(url)
        calls.push({ host: u.hostname, path: u.pathname, body: init.body ? JSON.parse(init.body) : null })
        if (u.pathname === `/flows/runs/${RUN_ID}/decide`) return new Response(JSON.stringify(status === 200 ? body : { error: 'This run is not waiting for an approval (it is succeeded).' }), { status })
        if (u.pathname === `/flows/runs/${RUN_ID}`) {
          return new Response(JSON.stringify({ ok: true, run: { id: RUN_ID, flowGraphId: FLOW_ID, flowVersion: 1, flow: 'Hei, flow', status: 'succeeded', workflowStatus: 'complete', dryRun: false, digest: 'Live run of "Hei, flow": 4 steps, 1 sent.', error: null, createdAt: 'x', finishedAt: 'y' }, steps: [] }), { status: 200 })
        }
        return new Response('{}', { status: 404 })
      },
    }
  }
  const ALICE_CHAT = authFor('alice@example.com', ['graph:read', 'chat:write'])

  test('the owner\'s yes crosses the binding with the verified e-mail, and the finished run comes back', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.FLOWS_WORKER = fakeDecide()
    const r = await (await connect(env, ALICE_CHAT)).callTool({ name: 'decide_flow_approval', arguments: { runId: RUN_ID, approve: true, text: 'Min tekst' } })
    assert.notEqual(r.isError, true, JSON.stringify(r.structuredContent))
    assert.equal(r.structuredContent.status, 'succeeded')
    assert.match(r.content[0].text, /1 sent/)
    const d = env.FLOWS_WORKER.calls[0]
    assert.equal(d.host, 'flows-worker')
    assert.deepEqual(d.body, { email: 'alice@example.com', approved: true, text: 'Min tekst' })
  })

  test('without chat:write it is refused and nothing reaches the engine', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.FLOWS_WORKER = fakeDecide()
    const r = await (await connect(env, ALICE)).callTool({ name: 'decide_flow_approval', arguments: { runId: RUN_ID, approve: true } })
    assert.equal(r.isError, true)
    assert.equal(env.FLOWS_WORKER.calls.length, 0)
  })

  test('a run that is not waiting answers with the engine\'s reason', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.FLOWS_WORKER = fakeDecide({ status: 409 })
    const r = await (await connect(env, ALICE_CHAT)).callTool({ name: 'decide_flow_approval', arguments: { runId: RUN_ID, approve: false } })
    assert.equal(r.isError, true)
    assert.match(JSON.stringify(r), /not waiting/)
  })
})

describe('the owner approves the real e-mail: preview_email in a flow', () => {
  test('a flow may run preview_email (read-only; chat:write is lent for that one call), but still not send_email', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const r = await callToolForFlow(env, { email: 'alice@example.com', toolName: 'preview_email', args: { fromEmail: 'alice@example.com', toEmail: 'alice@example.com', subject: 'x', bodyHtml: '<p>x</p>' } })
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.doesNotMatch(r.text || '', /requires the chat:write scope/, 'the scope was lent')
    const s = await callToolForFlow(env, { email: 'alice@example.com', toolName: 'send_email', args: { fromEmail: 'alice@example.com', toEmail: 'alice@example.com', subject: 'x', bodyHtml: '<p>x</p>' } })
    assert.equal(s.status, 403, 'lending a scope to the preview does not open sending')
  })

  test('a run waiting on an approval with a preview shows the e-mail itself', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const preview = { senderEmail: 'post@vegr.ai', fromName: 'VEGR.AI', toEmail: 'alice@example.com', cc: [], subject: 'Mine siste grafer', textPreview: 'Hei Alice\n\nDette er sammendraget.' }
    env.FLOWS_WORKER = {
      fetch: async () => new Response(JSON.stringify({
        ok: true,
        run: { id: RUN_ID, flowGraphId: FLOW_ID, flowVersion: 1, flow: 'Hei, flow', status: 'waiting', workflowStatus: 'waiting', dryRun: false, digest: null, error: null, createdAt: 'x', finishedAt: null },
        steps: [{ seq: 4, nodeId: 'godkjenn', kind: 'approval', status: 'waiting', summary: 'waiting', edge: null, detail: { allowEdit: true, timeout: '24 hours', payload: { tekst: 'Dette er sammendraget.', epost: preview } }, at: 'x' }],
      }), { status: 200 }),
    }
    const r = await (await connect(env, ALICE)).callTool({ name: 'get_flow_run', arguments: { runId: RUN_ID } })
    const text = r.content[0].text
    assert.match(text, /WAITING for your approval/)
    assert.match(text, /Fra: VEGR\.AI <post@vegr\.ai>\nTil: alice@example\.com\nEmne: Mine siste grafer\n\nHei Alice/)
    assert.match(text, /decide_flow_approval/)
  })
})

// ── Phase 2: schedules — the flow loader, the owner notice, activate_flow / list_flows ──
import { loadFlowForOwner } from '../flow-tools.js'

describe('phase 2: a scheduled run is read and noticed as its owner', () => {
  test('loadFlowForOwner reads the flow graph and aliases for the owner, and refuses anyone else', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    seed(raw)
    const r = await loadFlowForOwner(env, { email: 'alice@example.com', graphId: FLOW_ID })
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.equal(r.graph.id, FLOW_ID)
    assert.equal(r.graph.nodes.length, 2)
    assert.equal(r.aliases.find((a) => a.alias === 'fast').model, 'claude-haiku-5-5')
    const bob = await loadFlowForOwner(env, { email: 'bob@example.com', graphId: FLOW_ID })
    assert.equal(bob.ok, false, 'not his flow')
    const nobody = await loadFlowForOwner(env, { email: 'nobody@example.com', graphId: FLOW_ID })
    assert.equal(nobody.status, 403)
  })

  const NOTE_RUN = '2d3e4f5a-6b7c-4d8e-9fa0-b1c2d3e4f5a6'
  const NOTE = { fromEmail: 'alice@example.com', toEmail: 'alice@example.com', subject: 'Flow venter', bodyHtml: '<p>{tekst}</p>', variables: { tekst: 'hei' } }
  function waitingRun({ runStatus = 'waiting', stepStatus = 'waiting' } = {}) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    raw.exec(readFileSync(new URL('../../flows-worker/schema.sql', import.meta.url), 'utf8'))
    raw.exec('CREATE TABLE IF NOT EXISTS flow_notifications (run_id TEXT NOT NULL, seq INTEGER NOT NULL, at TEXT, PRIMARY KEY (run_id, seq))')
    raw.prepare("INSERT INTO flow_runs (id, flow_graph_id, owner_email, dry_run, status, spec_json, created_at) VALUES (?,?,?,0,?,'{}','x')").run(NOTE_RUN, FLOW_ID, 'alice@example.com', runStatus)
    raw.prepare("INSERT INTO flow_run_steps (run_id, seq, node_id, kind, status, at) VALUES (?,2,'godkjenn','approval',?,'x')").run(NOTE_RUN, stepStatus)
    return { env, raw }
  }
  const notice = (env, extra = {}) => callToolForFlow(env, { email: 'alice@example.com', toolName: 'send_email', args: NOTE, notify: { runId: NOTE_RUN, seq: 2 }, ...extra })

  test('the owner is told once that a waiting run needs them', async () => {
    const { env, raw } = waitingRun()
    const r = await notice(env)
    assert.notEqual(r.status, 403, JSON.stringify(r))
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM flow_notifications').get().n, 1)
    assert.equal((await notice(env)).status, 403, 'only once per approval')
  })

  test('a notice to anyone else, for a run that is not waiting, or for a decided approval is refused', async () => {
    for (const [why, opts, extra] of [
      ['another recipient', {}, { args: { ...NOTE, toEmail: 'bob@example.com' } }],
      ['bcc', {}, { args: { ...NOTE, bcc: ['bob@example.com'] } }],
      ['run finished', { runStatus: 'succeeded' }, {}],
      ['already decided', { stepStatus: 'approved' }, {}],
      ['another tool', {}, { toolName: 'send_sms' }],
    ]) {
      const { env, raw } = waitingRun(opts)
      const r = await notice(env, extra)
      assert.equal(r.status, 403, why)
      assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM flow_notifications').get().n, 0, `${why}: nothing recorded`)
    }
  })
})

describe('activate_flow and list_flows', () => {
  function fakeSchedule({ status = 200, body = null } = {}) {
    const calls = []
    return {
      calls,
      fetch: async (url, init = {}) => {
        const u = new URL(url)
        calls.push({ path: u.pathname, search: u.search, body: init.body ? JSON.parse(init.body) : null })
        const trig = { flowGraphId: FLOW_ID, triggerId: 't_morgen', type: 'schedule', cron: '0 7 * * *', timezone: 'Europe/Oslo', enabled: true, nextRunAt: '2026-11-08T06:00:00.000Z', nextRunLocal: 'søndag 8. november kl. 07:00', lastFiredAt: null, lastRunId: null, lastResult: null }
        if (u.pathname === '/flows/activate') return new Response(JSON.stringify(body || (status === 200 ? { ok: true, active: true, flow: 'Hei, flow', triggers: [trig], warnings: [] } : { ok: false, errors: ['Run the flow once first (a dry run is enough).'] })), { status })
        if (u.pathname === '/flows/list') return new Response(JSON.stringify({ ok: true, triggers: [trig], recentRuns: [{ id: RUN_ID, flow_graph_id: FLOW_ID, trigger_id: 't_morgen', status: 'waiting', dry_run: 0, created_at: 'x', finished_at: null }] }), { status: 200 })
        return new Response('{}', { status: 404 })
      },
    }
  }
  const ALICE_W = authFor('alice@example.com', ['graph:read', 'graph:write'])

  test('the owner turns a schedule on: the graph and aliases cross the binding with the verified e-mail', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    seed(raw)
    env.FLOWS_WORKER = fakeSchedule()
    const r = await (await connect(env, ALICE_W)).callTool({ name: 'activate_flow', arguments: { graphId: FLOW_ID } })
    assert.notEqual(r.isError, true, JSON.stringify(r.structuredContent))
    assert.match(r.content[0].text, /is ON:[\s\S]*søndag 8\. november kl\. 07:00/)
    const sent = env.FLOWS_WORKER.calls[0].body
    assert.equal(sent.actor.email, 'alice@example.com')
    assert.equal(sent.graph.id, FLOW_ID)
    assert.equal(sent.active, true)
    assert.ok(sent.aliases.some((a) => a.alias === 'fast'))
  })

  test('someone else cannot switch the owner\'s flow on; graph:read alone cannot either', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    seed(raw)
    env.FLOWS_WORKER = fakeSchedule()
    const bob = await (await connect(env, authFor('bob@example.com', ['graph:read', 'graph:write']))).callTool({ name: 'activate_flow', arguments: { graphId: FLOW_ID } })
    assert.equal(bob.isError, true)
    const ro = await (await connect(env, ALICE)).callTool({ name: 'activate_flow', arguments: { graphId: FLOW_ID } })
    assert.equal(ro.isError, true)
    assert.equal(env.FLOWS_WORKER.calls.length, 0)
  })

  test('the engine\'s reason comes back when it refuses', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    seed(raw)
    env.FLOWS_WORKER = fakeSchedule({ status: 409 })
    const r = await (await connect(env, ALICE_W)).callTool({ name: 'activate_flow', arguments: { graphId: FLOW_ID } })
    assert.equal(r.isError, true)
    assert.match(JSON.stringify(r), /Run the flow once first/)
  })

  test('list_flows shows schedules and what waits for you', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.FLOWS_WORKER = fakeSchedule()
    const r = await (await connect(env, ALICE)).callTool({ name: 'list_flows', arguments: {} })
    assert.notEqual(r.isError, true, JSON.stringify(r))
    assert.match(r.content[0].text, /t_morgen: "0 7 \* \* \*" \(Europe\/Oslo\) — next: søndag/)
    assert.match(r.content[0].text, new RegExp(`Waiting for your approval: ${RUN_ID}`))
    assert.equal(env.FLOWS_WORKER.calls[0].search, '?email=alice%40example.com')
  })
})
