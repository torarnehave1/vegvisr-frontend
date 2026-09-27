/**
 * The MCP tools, exercised through a REAL MCP client over the protocol.
 * Run: node --test dev-worker/test/mcp-tools.test.mjs
 *
 * Client → InMemoryTransport → McpServer → registerTools → graph-service → SQLite with the
 * production schema. Nothing is stubbed except the network hop and the token: tools/list and
 * tools/call go through genuine JSON-RPC, so a schema the SDK would reject fails here too.
 *
 * Covers items 10 and 18 of the Fase 3 list (scope present/absent, tools/list) and re-checks
 * ownership and version conflict at the protocol level rather than the service level.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { freshDb } from './d1-adapter.mjs'
import { registerTools, TOOL_NAMES } from '../mcp/tools.js'
import * as gs from '../graph-service.js'

/** A connected client/server pair whose tools see `auth` as the verified caller. */
async function connect(env, auth) {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerTools(server, () => ({ auth, env, props: auth.props }))
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  return { client, server }
}

const authFor = (email, scope, role = 'User') => ({
  clientId: 'test-client-id',
  scope,
  props: { userId: email, email, role, authMethod: 'oauth_otp' },
})

const ALICE_RW = authFor('alice@example.com', ['graph:read', 'graph:write'])
const ALICE_RO = authFor('alice@example.com', ['graph:read'])
const BOB_RW = authFor('bob@example.com', ['graph:read', 'graph:write'])

/** The structured payload of a tool result, which is what a program consumes. */
const sc = (r) => r.structuredContent

async function callOk(client, name, args) {
  const r = await client.callTool({ name, arguments: args })
  assert.notEqual(r.isError, true, `${name} failed: ${JSON.stringify(sc(r))}`)
  return sc(r)
}

async function callErr(client, name, args) {
  const r = await client.callTool({ name, arguments: args })
  assert.equal(r.isError, true, `${name} unexpectedly succeeded: ${JSON.stringify(sc(r))}`)
  return sc(r)
}

describe('18. tools/list', () => {
  test('lists exactly the v1 tools, each with a described input schema', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()

    assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOL_NAMES].sort())
    for (const t of tools) {
      assert.ok(t.description && t.description.length > 30, `${t.name} needs a real description`)
      assert.equal(t.inputSchema.type, 'object')
    }
  })

  test('no tool accepts an identity argument — a model cannot ask to be someone else', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    for (const t of tools) {
      const props = Object.keys(t.inputSchema.properties || {})
      for (const forbidden of ['email', 'userId', 'user_id', 'createdBy', 'role', 'actor']) {
        assert.equal(props.includes(forbidden), false, `${t.name} exposes ${forbidden}`)
      }
    }
  })

  test('delete is not offered in v1', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    assert.equal(tools.some((t) => /delete|remove/i.test(t.name)), false)
  })
})

describe('10. scope enforcement', () => {
  test('create_graph without graph:write is refused with INSUFFICIENT_SCOPE', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RO)
    const e = await callErr(client, 'create_graph', { title: 'T', metaArea: '#X' })
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(e.requiredScope, 'graph:write')
  })

  test('add_node without graph:write is refused', async () => {
    const { env } = freshDb()
    const { client: rw } = await connect(env, ALICE_RW)
    const g = await callOk(rw, 'create_graph', { title: 'T', metaArea: '#X' })

    const { client: ro } = await connect(env, ALICE_RO)
    const e = await callErr(ro, 'add_node', { graphId: g.graphId, node: { label: 'n' } })
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
  })

  test('get_graph without graph:read is refused even for the owner', async () => {
    const { env } = freshDb()
    const { client: rw } = await connect(env, ALICE_RW)
    const g = await callOk(rw, 'create_graph', { title: 'T', metaArea: '#X' })

    const { client: none } = await connect(env, authFor('alice@example.com', ['graph:write']))
    const e = await callErr(none, 'get_graph', { graphId: g.graphId })
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(e.requiredScope, 'graph:read')
  })

  test('a token with graph:read may read but not write', async () => {
    const { env } = freshDb()
    const { client: rw } = await connect(env, ALICE_RW)
    const g = await callOk(rw, 'create_graph', { title: 'T', metaArea: '#X' })

    const { client: ro } = await connect(env, ALICE_RO)
    await callOk(ro, 'get_graph', { graphId: g.graphId })
    await callErr(ro, 'add_node', { graphId: g.graphId, node: { label: 'x' } })
  })
})

describe('13. create_graph', () => {
  test('creates a private graph owned by the token holder, with both links', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const r = await callOk(client, 'create_graph', {
      title: 'Norsk historie',
      description: 'Oversikt',
      metaArea: '#HISTORY #NORWAY',
      nodes: [{ label: 'Innledning', type: 'fulltext', info: '# Innledning' }],
    })

    assert.equal(r.success, true)
    assert.equal(r.publicationState, 'private')
    assert.equal(r.title, 'Norsk historie')
    assert.equal(r.metaArea, '#HISTORY #NORWAY')
    assert.equal(r.version, 1)
    assert.equal(gs.isUuidV4(r.graphId), true)
    assert.equal(r.editorUrl, `https://editor.vegvisr.org/?graphId=${r.graphId}`)
    assert.equal(r.viewerUrl, `https://editor.vegvisr.org/view?graphId=${r.graphId}`)

    const read = await callOk(client, 'get_graph', { graphId: r.graphId })
    assert.equal(read.createdBy, 'alice@example.com')
    assert.equal(read.nodeCount, 1)
  })

  test('the schema rejects a call with no title, before any tool code runs', async () => {
    const { env, raw } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const r = await client.callTool({ name: 'create_graph', arguments: { metaArea: '#X' } })

    // Measured, not assumed: the SDK reports a schema failure as an error RESULT carrying
    // JSON-RPC -32602, not as a thrown exception, and with no structuredContent because the
    // tool callback never ran.
    assert.equal(r.isError, true)
    assert.match(r.content[0].text, /-32602/)
    assert.match(r.content[0].text, /title/)
    assert.equal(r.structuredContent, undefined)

    // The proof that the tool body did not run: nothing was written.
    const { n } = raw.prepare('SELECT COUNT(*) AS n FROM knowledge_graphs').get()
    assert.equal(n, 0)
  })

  test('a metaArea of only whitespace is refused by the tool, not the schema', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const e = await callErr(client, 'create_graph', { title: 'T', metaArea: '   ' })
    assert.equal(e.code, gs.ERR.INVALID_INPUT)
  })

  test('an edge pointing at a node that is not in the payload is refused', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const e = await callErr(client, 'create_graph', {
      title: 'T', metaArea: '#X',
      nodes: [{ id: 'a', label: 'A' }],
      edges: [{ source: 'a', target: 'ghost' }],
    })
    assert.equal(e.code, gs.ERR.INVALID_INPUT)
  })

  test('nodes and edges survive the round trip with generated ids', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const r = await callOk(client, 'create_graph', {
      title: 'T', metaArea: '#X',
      nodes: [{ id: 'n1', label: 'One' }, { id: 'n2', label: 'Two' }],
      edges: [{ source: 'n1', target: 'n2', label: 'neste' }],
    })
    const read = await callOk(client, 'get_graph', { graphId: r.graphId })
    assert.equal(read.edgeCount, 1)
    assert.equal(read.edges[0].label, 'neste')
    assert.equal(read.edges[0].id, 'n1_n2')
  })
})

describe('14. reading another user\'s private graph', () => {
  test('Bob cannot read Alice\'s private graph', async () => {
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const g = await callOk(alice, 'create_graph', { title: 'Hemmelig', metaArea: '#X' })

    const { client: bob } = await connect(env, BOB_RW)
    const e = await callErr(bob, 'get_graph', { graphId: g.graphId })
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('Bob cannot add a node to it either', async () => {
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const g = await callOk(alice, 'create_graph', { title: 'Hemmelig', metaArea: '#X' })

    const { client: bob } = await connect(env, BOB_RW)
    const e = await callErr(bob, 'add_node', { graphId: g.graphId, node: { label: 'inject' } })
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('Bob cannot even get the links', async () => {
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const g = await callOk(alice, 'create_graph', { title: 'Hemmelig', metaArea: '#X' })

    const { client: bob } = await connect(env, BOB_RW)
    assert.equal((await callErr(bob, 'get_graph_links', { graphId: g.graphId })).code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('a published graph becomes readable by Bob but stays unwritable', async () => {
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const g = await callOk(alice, 'create_graph', { title: 'Offentlig', metaArea: '#X' })

    // Publishing is not an MCP tool in v1; it happens through the service layer.
    const actor = gs.normalizeActor({ valid: true, userId: 'alice@example.com', userEmail: 'alice@example.com', userRole: 'User', scopes: ['graph:publish'] })
    const pub = await gs.publishGraph(env, { graphId: g.graphId, expectedVersion: g.version, actor })
    assert.equal(pub.ok, true)

    const { client: bob } = await connect(env, BOB_RW)
    const read = await callOk(bob, 'get_graph', { graphId: g.graphId })
    assert.equal(read.publicationState, 'published')
    assert.equal((await callErr(bob, 'add_node', { graphId: g.graphId, node: { label: 'x' } })).code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('a graph that does not exist is GRAPH_NOT_FOUND, not FORBIDDEN', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    assert.equal((await callErr(client, 'get_graph', { graphId: crypto.randomUUID() })).code, gs.ERR.GRAPH_NOT_FOUND)
  })
})

describe('15 & 16. add_node and version conflict', () => {
  test('add_node appends and reports both versions', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })

    const a = await callOk(client, 'add_node', { graphId: g.graphId, node: { label: 'Første', type: 'fulltext', info: 'tekst' } })
    assert.equal(a.currentVersion, 1)
    assert.equal(a.newVersion, 2)
    assert.equal(gs.isUuidV4(a.nodeId), true)

    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(read.nodeCount, 1)
    assert.equal(read.version, 2)
  })

  test('a stale expectedVersion returns VERSION_CONFLICT with the current version', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })
    await callOk(client, 'add_node', { graphId: g.graphId, node: { label: 'a' } })

    const e = await callErr(client, 'add_node', { graphId: g.graphId, node: { label: 'b' }, expectedVersion: 1 })
    assert.equal(e.code, gs.ERR.VERSION_CONFLICT)
    assert.equal(e.currentVersion, 2)
  })

  test('re-reading and retrying at the reported version succeeds — the recovery loop works', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })
    await callOk(client, 'add_node', { graphId: g.graphId, node: { label: 'a' } })

    const conflict = await callErr(client, 'add_node', { graphId: g.graphId, node: { label: 'b' }, expectedVersion: 1 })
    const retry = await callOk(client, 'add_node', { graphId: g.graphId, node: { label: 'b' }, expectedVersion: conflict.currentVersion })
    assert.equal(retry.newVersion, 3)
  })

  test('add_node never overwrites an existing node', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 'keep', label: 'Keep me' }] })
    await callOk(client, 'add_node', { graphId: g.graphId, node: { label: 'New' } })

    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.deepEqual(read.nodes.map((n) => n.label), ['Keep me', 'New'])
  })

  test('a duplicate node id is NODE_EXISTS', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 'dup', label: 'A' }] })
    assert.equal((await callErr(client, 'add_node', { graphId: g.graphId, node: { id: 'dup', label: 'B' } })).code, gs.ERR.NODE_EXISTS)
  })
})

describe('get_graph nodeId filter', () => {
  test('returns just that node', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', {
      title: 'T', metaArea: '#X',
      nodes: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }],
    })
    const one = await callOk(client, 'get_graph', { graphId: g.graphId, nodeId: 'a' })
    assert.equal(one.nodeCount, 1)
    assert.equal(one.nodes[0].label, 'Alpha')
  })

  test('an unknown nodeId is an error, not an empty success', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 'a', label: 'A' }] })
    assert.equal((await callErr(client, 'get_graph', { graphId: g.graphId, nodeId: 'ghost' })).code, gs.ERR.GRAPH_NOT_FOUND)
  })
})

describe('17. links', () => {
  test('get_graph_links returns exactly the required formats', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })
    const l = await callOk(client, 'get_graph_links', { graphId: g.graphId })
    assert.equal(l.editorUrl, `https://editor.vegvisr.org/?graphId=${g.graphId}`)
    assert.equal(l.viewerUrl, `https://editor.vegvisr.org/view?graphId=${g.graphId}`)
  })
})

describe('results are readable by a model and by a program', () => {
  test('every result carries both a text block and structuredContent', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const created = await client.callTool({ name: 'create_graph', arguments: { title: 'T', metaArea: '#X' } })
    assert.equal(created.content[0].type, 'text')
    assert.ok(created.content[0].text.includes('private'), 'the text should say the graph is private')
    assert.ok(created.structuredContent.graphId)
  })

  test('an error carries its code in both channels', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RO)
    const r = await client.callTool({ name: 'create_graph', arguments: { title: 'T', metaArea: '#X' } })
    assert.equal(r.isError, true)
    assert.ok(r.content[0].text.startsWith(gs.ERR.INSUFFICIENT_SCOPE))
    assert.equal(r.structuredContent.code, gs.ERR.INSUFFICIENT_SCOPE)
  })

  test('no result leaks a token, a code or an Authorization header', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const r = await client.callTool({ name: 'create_graph', arguments: { title: 'T', metaArea: '#X' } })
    const blob = JSON.stringify(r).toLowerCase()
    for (const f of ['authorization', 'bearer', 'access_token', 'refresh_token', 'emailverificationtoken']) {
      assert.equal(blob.includes(f), false, `result mentions ${f}`)
    }
  })
})

describe('an unauthenticated call cannot reach a tool', () => {
  test('no props means UNAUTHENTICATED, whatever the scopes claim', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, { clientId: 'c', scope: ['graph:read', 'graph:write'], props: null })
    assert.equal((await callErr(client, 'create_graph', { title: 'T', metaArea: '#X' })).code, gs.ERR.UNAUTHENTICATED)
  })
})
