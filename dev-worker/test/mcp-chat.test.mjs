/**
 * /mcp/chat (mcp/chat.js): the chat loop that runs on the MCP server.
 * Run: node --test dev-worker/test/mcp-chat.test.mjs
 *
 * The model is scripted (a fake anthropic-worker); the tools are the real ones, on SQLite with the
 * production schema. What must hold:
 *   - a read-only tool runs at once;
 *   - a tool that changes something does NOT run until the person says yes: the stream ends with
 *     an `approval` event, and the graph is unchanged;
 *   - resuming with yes runs it; resuming with no does not, and the model hears the refusal;
 *   - a tool the connection is not offered does not exist for the chat either.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedUsers } from './d1-adapter.mjs'
import * as chat from '../mcp/chat.js'
import * as gs from '../graph-service.js'

const ALICE = {
  auth: { token: 'redacted', audience: 'https://knowledge.vegvisr.org/mcp', scope: ['graph:read', 'graph:write'], userId: 'alice@example.com', clientId: 'login-token' },
  props: { userId: 'u-alice', email: 'alice@example.com', role: 'User', authMethod: 'login-token' },
}
const ALICE_RO = { auth: { ...ALICE.auth, scope: ['graph:read'] }, props: ALICE.props }

/** A fake anthropic-worker answering from a script; the classifier call gets "simple". */
class ScriptedModel {
  constructor(answers) {
    this.answers = [...answers]
    this.asked = []
  }
  async fetch(_url, init) {
    const body = JSON.parse(init.body)
    if (body.max_tokens === 60) {
      return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"tier":"simple"}' }], stop_reason: 'end_turn' }))
    }
    this.asked.push(body)
    const next = this.answers.shift() || { content: [{ type: 'text', text: 'Done.' }], stop_reason: 'end_turn' }
    return new Response(JSON.stringify(next))
  }
}

const useTool = (id, name, args) => ({ type: 'tool_use', id, name: 'call_tool', input: { name, arguments: args } })

async function readEvents(res) {
  const raw = await res.text()
  return raw.split('\n\n').filter(Boolean).map((block) => {
    const ev = /^event: (.+)$/m.exec(block)?.[1]
    const data = JSON.parse(/^data: (.+)$/m.exec(block)?.[1] || '{}')
    return { ev, data }
  })
}

async function post(env, who, body) {
  const waits = []
  const ctx = { waitUntil: (p) => waits.push(p) }
  const req = new Request('https://knowledge.vegvisr.org/mcp/chat', { method: 'POST', body: JSON.stringify(body) })
  const res = await chat.handleChat(req, env, ctx, who.auth, who.props)
  const events = await readEvents(res)
  await Promise.all(waits)
  return events
}

async function seededWithGraph() {
  const { env, raw } = freshDb()
  seedUsers(raw)
  const actor = gs.normalizeActor({ valid: true, userId: 'u-alice', userEmail: 'alice@example.com', userRole: 'User' })
  const r = await gs.createGraph(env, { actor, title: 'Chat test', metaArea: '#TEST', nodes: [{ id: 'n1', label: 'One', info: 'first' }] })
  assert.ok(r.ok, JSON.stringify(r))
  return { env, graphId: r.graphId, actor }
}

describe('pure parts', () => {
  test('a tool without readOnlyHint is a write', () => {
    assert.equal(chat.isWriteTool({ annotations: { readOnlyHint: true } }), false)
    assert.equal(chat.isWriteTool({ annotations: { readOnlyHint: false } }), true)
    assert.equal(chat.isWriteTool({}), true)
  })
  test('the classifier label', () => {
    assert.equal(chat.parseTier('{"tier":"simple"}'), 'simple')
    assert.equal(chat.parseTier('nonsense'), null)
    assert.equal(chat.modelForTier('simple'), chat.MODEL_SIMPLE)
    assert.equal(chat.modelForTier('complex'), chat.MODEL_COMPLEX)
  })
  test('a paused state must end in an assistant message with a tool call', () => {
    assert.equal(chat.checkState({ turns: [{ role: 'assistant', content: [{ type: 'text', text: 'x' }] }] }), null)
    assert.ok(chat.checkState({ turns: [{ role: 'assistant', content: [useTool('a', 'get_graph', {})] }] }))
    assert.equal(chat.checkState({ turns: [{ role: 'system', content: [] }] }), null)
  })
})

describe('the loop', () => {
  test('a read runs at once and its result reaches the model', async () => {
    const { env, graphId } = await seededWithGraph()
    env.ANTHROPIC = new ScriptedModel([
      { content: [useTool('t1', 'get_graph', { graphId })], stop_reason: 'tool_use' },
      { content: [{ type: 'text', text: 'It has one node.' }], stop_reason: 'end_turn' },
    ])
    const events = await post(env, ALICE, { messages: [{ role: 'user', content: 'What is in the graph?' }] })
    const kinds = events.map((e) => e.ev)
    assert.deepEqual(kinds, ['model', 'tool_call', 'tool_result', 'text', 'done'])
    assert.equal(events[0].data.model, chat.MODEL_SIMPLE)
    assert.equal(events[2].data.ok, true)
    const second = env.ANTHROPIC.asked[1].messages
    assert.equal(second.at(-1).content[0].type, 'tool_result')
    assert.match(second.at(-1).content[0].content, /One/)
  })

  test('a write pauses: nothing changes before yes, and yes runs it', async () => {
    const { env, graphId, actor } = await seededWithGraph()
    const v = (await gs.getGraph(env, graphId, { caller: actor })).version
    const write = useTool('w1', 'update_node', { graphId, nodeId: 'n1', expectedVersion: v, fields: { label: 'Renamed' } })
    env.ANTHROPIC = new ScriptedModel([{ content: [{ type: 'text', text: 'I will rename it.' }, write], stop_reason: 'tool_use' }])
    const first = await post(env, ALICE, { messages: [{ role: 'user', content: 'Rename n1' }] })
    const approval = first.find((e) => e.ev === 'approval')
    assert.ok(approval, 'an approval event')
    assert.equal(approval.data.calls[0].name, 'update_node')
    assert.equal(first.some((e) => e.ev === 'tool_result'), false, 'nothing ran')
    let g = await gs.getGraph(env, graphId, { caller: actor })
    assert.equal(g.graph.nodes[0].label, 'One')

    env.ANTHROPIC = new ScriptedModel([{ content: [{ type: 'text', text: 'Renamed.' }], stop_reason: 'end_turn' }])
    const second = await post(env, ALICE, {
      messages: [{ role: 'user', content: 'Rename n1' }],
      resume: { state: approval.data.state, decisions: { w1: true } },
    })
    const result = second.find((e) => e.ev === 'tool_result')
    assert.equal(result.data.ok, true, JSON.stringify(result))
    g = await gs.getGraph(env, graphId, { caller: actor })
    assert.equal(g.graph.nodes[0].label, 'Renamed')
  })

  test('no means no: the tool does not run and the model is told', async () => {
    const { env, graphId, actor } = await seededWithGraph()
    const write = useTool('w2', 'update_node', { graphId, nodeId: 'n1', fields: { label: 'Nope' } })
    env.ANTHROPIC = new ScriptedModel([{ content: [write], stop_reason: 'tool_use' }])
    const first = await post(env, ALICE, { messages: [{ role: 'user', content: 'Rename n1' }] })
    const state = first.find((e) => e.ev === 'approval').data.state
    env.ANTHROPIC = new ScriptedModel([{ content: [{ type: 'text', text: 'Left as it was.' }], stop_reason: 'end_turn' }])
    const second = await post(env, ALICE, { messages: [{ role: 'user', content: 'Rename n1' }], resume: { state, decisions: { w2: false } } })
    assert.equal(second.find((e) => e.ev === 'tool_result').data.ok, false)
    assert.match(env.ANTHROPIC.asked[0].messages.at(-1).content[0].content, /pressed No/)
    const g = await gs.getGraph(env, graphId, { caller: actor })
    assert.equal(g.graph.nodes[0].label, 'One')
  })

  test('a tool the connection is not offered does not exist for the chat', async () => {
    const { env, graphId } = await seededWithGraph()
    env.ANTHROPIC = new ScriptedModel([
      { content: [useTool('w3', 'update_node', { graphId, nodeId: 'n1', fields: { label: 'X' } })], stop_reason: 'tool_use' },
      { content: [{ type: 'text', text: 'I cannot.' }], stop_reason: 'end_turn' },
    ])
    const events = await post(env, ALICE_RO, { messages: [{ role: 'user', content: 'Rename n1' }] })
    assert.equal(events.some((e) => e.ev === 'approval'), false)
    assert.equal(events.find((e) => e.ev === 'tool_result').data.ok, false)
  })

  test('a model failure is reported, and the stream still ends', async () => {
    const { env } = await seededWithGraph()
    env.ANTHROPIC = { fetch: async (_u, init) => (JSON.parse(init.body).max_tokens === 60
      ? new Response(JSON.stringify({ content: [{ type: 'text', text: '{"tier":"complex"}' }] }))
      : new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 529 })) }
    const events = await post(env, ALICE, { messages: [{ role: 'user', content: 'Hi' }] })
    assert.equal(events.at(-1).ev, 'done')
    assert.match(events.find((e) => e.ev === 'error').data.error, /overloaded/)
  })
})

describe('links to a graph in a World whose editor is not set up', () => {
  test('no link at all, and a note that says what must be done', async () => {
    const seen = []
    await gs.checkWorldEditors(['ready.example', 'missing.example'], async (url) => {
      seen.push(url)
      if (url.includes('missing.example')) throw new Error('no such host')
      return new Response('ok', { status: 200 })
    })
    assert.deepEqual(seen.sort(), ['https://editor.missing.example/', 'https://editor.ready.example/'])
    assert.equal(gs.graphLinks('g1', 'ready.example').editorUrl, 'https://editor.ready.example/?graphId=g1')
    const missing = gs.graphLinks('g1', 'missing.example')
    assert.match(missing.editorUrl, /^NO LINK: the editor for the World missing\.example is not set up/)
    assert.doesNotMatch(missing.viewerUrl, /vegvisr\.org/)
    assert.equal(gs.graphLinks('g1', null).editorUrl, 'https://editor.vegvisr.org/?graphId=g1')
  })
  test('a 404 from the host counts as not set up; the answer is remembered', async () => {
    let calls = 0
    const f = async () => { calls++; return new Response('', { status: 404 }) }
    await gs.checkWorldEditors(['nf.example'], f)
    await gs.checkWorldEditors(['nf.example'], f)
    assert.equal(calls, 1)
    assert.equal(gs.worldEditorState('nf.example'), false)
  })
})
