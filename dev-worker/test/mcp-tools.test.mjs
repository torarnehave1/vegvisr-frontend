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

/**
 * A connected client/server pair whose tools see `auth` as the verified caller.
 *
 * The context is assembled exactly as mcp/server.js assembles it from the Workers request:
 * `auth` is ctx.auth, which is OAuthResourceAuth and carries NO props, and `props` is ctx.props,
 * which is what completeAuthorization() stored. An earlier version of this helper passed
 * `props: auth.props` and the fixtures carried a props key on auth — so the tests modelled the
 * assumption rather than the contract, and every tool shipped returning UNAUTHENTICATED in
 * production while 47 assertions stayed green.
 */
async function connect(env, { auth, props }) {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerTools(server, () => ({ auth, env, props }))
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  return { client, server }
}

/**
 * The real shapes. auth is what OAuthProvider hands the handler after validating the bearer
 * token; props is the application data it stored at authorization time. They are separate
 * objects and the tools must read the identity from props.
 */
const authFor = (email, scope, role = 'User') => ({
  auth: {
    token: 'redacted',
    audience: 'https://knowledge.vegvisr.org/mcp',
    scope,
    userId: email,
    clientId: 'https://chatgpt.com/oauth/client.json',
  },
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
    const { client } = await connect(env, { auth: { token: 't', audience: 'a', scope: ['graph:read', 'graph:write'] }, props: null })
    assert.equal((await callErr(client, 'create_graph', { title: 'T', metaArea: '#X' })).code, gs.ERR.UNAUTHENTICATED)
  })
})

describe('search, list and the deep-research pair', () => {
  /** Alice owns two graphs (one published), Bob owns one private. */
  async function corpus(env) {
    const { client: a } = await connect(env, ALICE_RW)
    const { client: b } = await connect(env, BOB_RW)
    const g1 = await callOk(a, 'create_graph', {
      title: 'Norsk historie', description: 'Vikingtid og middelalder', metaArea: '#HISTORY #NORWAY',
      nodes: [{ label: 'Vikingtid', type: 'fulltext', info: 'Om langskip og handel' }],
    })
    const g2 = await callOk(a, 'create_graph', { title: 'Botanikk', description: 'Planter', metaArea: '#NATURE' })
    const g3 = await callOk(b, 'create_graph', { title: 'Bobs hemmelige notater', metaArea: '#PRIVATE' })
    const actor = gs.normalizeActor({ valid: true, userId: 'alice@example.com', userEmail: 'alice@example.com', userRole: 'User', scopes: ['graph:publish'] })
    await gs.publishGraph(env, { graphId: g2.graphId, expectedVersion: g2.version, actor })
    return { a, b, g1, g2, g3 }
  }

  test('search_graphs finds a graph by title, description and node content', async () => {
    const { env } = freshDb()
    const { a, g1 } = await corpus(env)
    for (const q of ['historie', 'vikingtid', 'langskip', 'middelalder']) {
      const r = await callOk(a, 'search_graphs', { query: q })
      assert.ok(r.results.some((x) => x.graphId === g1.graphId), `"${q}" did not find the graph`)
    }
  })

  test('search_graphs never returns another user\'s private graph', async () => {
    const { env } = freshDb()
    const { a, g3 } = await corpus(env)
    const r = await callOk(a, 'search_graphs', { query: 'hemmelige' })
    assert.equal(r.results.some((x) => x.graphId === g3.graphId), false, "Bob's private graph leaked into Alice's search")
    assert.equal(r.total, 0)
  })

  test('a published graph IS visible to another user, and marked as not theirs', async () => {
    const { env } = freshDb()
    const { b, g2 } = await corpus(env)
    const r = await callOk(b, 'search_graphs', { query: 'Botanikk' })
    const hit = r.results.find((x) => x.graphId === g2.graphId)
    assert.ok(hit, 'the published graph was not visible')
    assert.equal(hit.isMine, false)
    assert.equal(hit.publicationState, 'published')
  })

  test('the visibility filter is applied in SQL, so total matches the rows', async () => {
    const { env } = freshDb()
    const { b } = await corpus(env)
    const r = await callOk(b, 'search_graphs', {})
    // Bob sees his own one plus Alice's published one — never Alice's private one.
    assert.equal(r.total, 2)
    assert.equal(r.results.length, 2)
    assert.equal(r.hasMore, false)
  })

  test('metaArea and nodeType narrow the result', async () => {
    const { env } = freshDb()
    const { a, g1 } = await corpus(env)
    const byArea = await callOk(a, 'search_graphs', { metaArea: '#NORWAY' })
    assert.deepEqual(byArea.results.map((x) => x.graphId), [g1.graphId])
    const byType = await callOk(a, 'search_graphs', { nodeType: 'fulltext' })
    assert.ok(byType.results.some((x) => x.graphId === g1.graphId))
    const noMatch = await callOk(a, 'search_graphs', { nodeType: 'mermaid-diagram' })
    assert.equal(noMatch.total, 0)
  })

  test('paging reports hasMore and does not repeat rows', async () => {
    const { env } = freshDb()
    const { a } = await corpus(env)
    const p1 = await callOk(a, 'search_graphs', { limit: 1, offset: 0 })
    const p2 = await callOk(a, 'search_graphs', { limit: 1, offset: 1 })
    assert.equal(p1.total, 2)
    assert.equal(p1.hasMore, true)
    assert.equal(p2.hasMore, false)
    assert.notEqual(p1.results[0].graphId, p2.results[0].graphId)
  })

  test('limit is clamped rather than trusted', async () => {
    const { env } = freshDb()
    const { a } = await corpus(env)
    assert.equal((await callOk(a, 'search_graphs', { limit: 9999 })).limit, 50)
    assert.equal((await callOk(a, 'search_graphs', { limit: -5 })).limit, 1)
  })

  test('list_my_graphs returns only what you own, private ones included', async () => {
    const { env } = freshDb()
    const { a, b, g1, g2, g3 } = await corpus(env)
    const mine = await callOk(a, 'list_my_graphs', {})
    assert.deepEqual(mine.results.map((x) => x.graphId).sort(), [g1.graphId, g2.graphId].sort())
    assert.ok(mine.results.every((x) => x.isMine))

    const bobs = await callOk(b, 'list_my_graphs', {})
    assert.deepEqual(bobs.results.map((x) => x.graphId), [g3.graphId])
  })

  test('search and fetch return the deep-research shape ChatGPT requires', async () => {
    const { env } = freshDb()
    const { a, g1 } = await corpus(env)

    const s = await callOk(a, 'search', { query: 'historie' })
    assert.ok(Array.isArray(s.results))
    const hit = s.results.find((x) => x.id === g1.graphId)
    assert.ok(hit, 'search did not find the graph')
    assert.deepEqual(Object.keys(hit).sort(), ['id', 'title', 'url'])
    assert.equal(hit.url, `https://editor.vegvisr.org/view?graphId=${g1.graphId}`)

    const f = await callOk(a, 'fetch', { id: g1.graphId })
    for (const k of ['id', 'title', 'text', 'url', 'metadata']) assert.ok(k in f, `fetch is missing ${k}`)
    assert.match(f.text, /Norsk historie/)
    assert.match(f.text, /langskip/, 'node content should be in the flattened text')
  })

  test('search and fetch also emit the JSON text copy the compatibility schema wants', async () => {
    const { env } = freshDb()
    const { a, g1 } = await corpus(env)
    const raw = await a.callTool({ name: 'search', arguments: { query: 'historie' } })
    const parsed = JSON.parse(raw.content[0].text)
    assert.deepEqual(parsed, raw.structuredContent)

    const rawF = await a.callTool({ name: 'fetch', arguments: { id: g1.graphId } })
    assert.deepEqual(JSON.parse(rawF.content[0].text), rawF.structuredContent)
  })

  test('fetch refuses another user\'s private graph', async () => {
    const { env } = freshDb()
    const { a, g3 } = await corpus(env)
    assert.equal((await callErr(a, 'fetch', { id: g3.graphId })).code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('all four new tools need graph:read', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, authFor('alice@example.com', ['graph:write']))
    for (const name of ['search_graphs', 'list_my_graphs']) {
      assert.equal((await callErr(client, name, {})).code, gs.ERR.INSUFFICIENT_SCOPE, name)
    }
    assert.equal((await callErr(client, 'search', { query: 'x' })).code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal((await callErr(client, 'fetch', { id: 'x' })).code, gs.ERR.INSUFFICIENT_SCOPE)
  })
})

describe('annotations tell the client the truth about each tool', () => {
  test('the six read-only tools are marked read-only', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]))
    for (const n of ['get_graph', 'get_graph_links', 'search_graphs', 'list_my_graphs', 'search', 'fetch']) {
      assert.equal(byName[n].annotations?.readOnlyHint, true, `${n} should be read-only`)
      assert.equal(byName[n].annotations?.destructiveHint, false, `${n} should not be destructive`)
    }
  })

  test('add_node is a write but NOT destructive — it appends and never overwrites', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const a = tools.find((t) => t.name === 'add_node')
    assert.equal(a.annotations.readOnlyHint, false)
    assert.equal(a.annotations.destructiveHint, false, 'ChatGPT showed this as DESTRUCTIVE before the hint was declared')
    assert.equal(a.annotations.idempotentHint, false, 'calling it twice adds two nodes')
  })

  test('create_graph is a non-destructive write', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const c = tools.find((t) => t.name === 'create_graph')
    assert.equal(c.annotations.readOnlyHint, false)
    assert.equal(c.annotations.destructiveHint, false)
  })

  test('every graph tool stays inside this system; only chat reaches out', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    for (const t of tools) {
      const expected = t.name === 'post_chat_message'
      assert.equal(t.annotations?.openWorldHint, expected, `${t.name} openWorldHint`)
    }
  })

  test('every tool declares an output schema, so results are typed not opaque', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    // get_graph returns whole nodes and edges, which is deliberately loose; the rest are typed.
    for (const t of tools.filter((x) => x.name !== 'get_graph')) {
      assert.ok(t.outputSchema, `${t.name} has no outputSchema`)
      assert.equal(t.outputSchema.type, 'object')
    }
  })

  test('the declared output schema actually matches what the tools return', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    // The SDK validates structuredContent against outputSchema and errors on a mismatch, so a
    // successful call here is the proof — a wrong schema would fail the call, not pass silently.
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })
    await callOk(client, 'add_node', { graphId: g.graphId, node: { label: 'n' } })
    await callOk(client, 'get_graph_links', { graphId: g.graphId })
    await callOk(client, 'search_graphs', { query: 'T' })
    await callOk(client, 'list_my_graphs', {})
    await callOk(client, 'search', { query: 'T' })
    await callOk(client, 'fetch', { id: g.graphId })
  })
})


describe('the auth context is read the way the runtime actually supplies it', () => {
  test('identity comes from ctx.props, which is NOT a field of ctx.auth', async () => {
    const { env } = freshDb()
    // Exactly what OAuthProvider passes: auth with no props, props alongside it.
    const { client } = await connect(env, {
      auth: { token: 'redacted', audience: 'https://knowledge.vegvisr.org/mcp', scope: ['graph:read', 'graph:write'], userId: 'alice@example.com', clientId: 'c' },
      props: { userId: 'alice@example.com', email: 'alice@example.com', role: 'User', authMethod: 'oauth_otp' },
    })
    // This call returned UNAUTHENTICATED in production for every tool until 2026-09-27.
    const r = await callOk(client, 'list_my_graphs', {})
    assert.equal(r.success, true)
  })

  test('every tool resolves an actor from that shape, not just the first one', async () => {
    const { env } = freshDb()
    const ctx = {
      auth: { token: 'redacted', audience: 'a', scope: ['graph:read', 'graph:write'], userId: 'alice@example.com', clientId: 'c' },
      props: { userId: 'alice@example.com', email: 'alice@example.com', role: 'User' },
    }
    const { client } = await connect(env, ctx)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })
    for (const [name, args] of [
      ['get_graph', { graphId: g.graphId }],
      ['add_node', { graphId: g.graphId, node: { label: 'n' } }],
      ['get_graph_links', { graphId: g.graphId }],
      ['search_graphs', {}],
      ['list_my_graphs', {}],
      ['search', { query: 'T' }],
      ['fetch', { id: g.graphId }],
    ]) {
      const r = await client.callTool({ name, arguments: args })
      assert.notEqual(r.isError, true, `${name} failed: ${JSON.stringify(r.structuredContent || r.content)}`)
    }
  })

  test('no props at all still means UNAUTHENTICATED', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, { auth: { token: 't', audience: 'a', scope: ['graph:read'] }, props: null })
    assert.equal((await callErr(client, 'list_my_graphs', {})).code, gs.ERR.UNAUTHENTICATED)
  })

  test('scopes are read from auth, identity from props — mixing them up breaks one or the other', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, {
      auth: { token: 't', audience: 'a', scope: ['graph:read'] },           // read only
      props: { userId: 'alice@example.com', email: 'alice@example.com', role: 'User' },
    })
    await callOk(client, 'list_my_graphs', {})                               // identity works
    assert.equal((await callErr(client, 'create_graph', { title: 'T', metaArea: '#X' })).code, gs.ERR.INSUFFICIENT_SCOPE)
  })
})

describe('update_node', () => {
  async function graphWithNode(client) {
    const g = await callOk(client, 'create_graph', {
      title: 'T', metaArea: '#X',
      nodes: [{ id: 'n1', label: 'Original', type: 'fulltext', info: 'gammel tekst', color: '#111111' }],
    })
    return g
  }

  test('changes only the named fields and leaves the rest of the node alone', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await graphWithNode(client)

    const r = await callOk(client, 'update_node', {
      graphId: g.graphId, nodeId: 'n1', expectedVersion: g.version,
      fields: { info: 'ny tekst' },
    })
    assert.deepEqual(r.updatedFields, ['info'])
    assert.equal(r.newVersion, g.version + 1)

    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    const n = read.nodes[0]
    assert.equal(n.info, 'ny tekst')
    assert.equal(n.label, 'Original', 'label should not have been touched')
    assert.equal(n.color, '#111111', 'color should not have been touched')
    assert.equal(n.type, 'fulltext')
  })

  test('several fields at once', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await graphWithNode(client)
    const r = await callOk(client, 'update_node', {
      graphId: g.graphId, nodeId: 'n1', expectedVersion: g.version,
      fields: { label: 'Ny tittel', color: '#ff0000' },
    })
    assert.deepEqual(r.updatedFields.sort(), ['color', 'label'])
    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(read.nodes[0].label, 'Ny tittel')
    assert.equal(read.nodes[0].color, '#ff0000')
    assert.equal(read.nodes[0].info, 'gammel tekst')
  })

  test('the version-conflict message is the one the REST API always sent', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await graphWithNode(client)
    await callOk(client, 'update_node', { graphId: g.graphId, nodeId: 'n1', expectedVersion: g.version, fields: { info: 'a' } })
    const e = await callErr(client, 'update_node', { graphId: g.graphId, nodeId: 'n1', expectedVersion: g.version, fields: { info: 'b' } })
    // POST /patchNode predates this refactor and a client may match on the string.
    assert.equal(e.message, 'Version mismatch. Reload the graph and retry the patch.')
  })

  test('a stale expectedVersion is refused and reports the current one', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await graphWithNode(client)
    await callOk(client, 'update_node', { graphId: g.graphId, nodeId: 'n1', expectedVersion: g.version, fields: { info: 'a' } })

    const stale = await callErr(client, 'update_node', {
      graphId: g.graphId, nodeId: 'n1', expectedVersion: g.version, fields: { info: 'b' },
    })
    assert.equal(stale.code, gs.ERR.VERSION_CONFLICT)
    assert.equal(stale.currentVersion, g.version + 1)

    // The refused write must not have landed.
    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(read.nodes[0].info, 'a')
  })

  test('re-reading and retrying at the reported version works', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await graphWithNode(client)
    await callOk(client, 'update_node', { graphId: g.graphId, nodeId: 'n1', expectedVersion: g.version, fields: { info: 'a' } })
    const conflict = await callErr(client, 'update_node', { graphId: g.graphId, nodeId: 'n1', expectedVersion: g.version, fields: { info: 'b' } })
    const retry = await callOk(client, 'update_node', { graphId: g.graphId, nodeId: 'n1', expectedVersion: conflict.currentVersion, fields: { info: 'b' } })
    assert.equal(retry.ok, undefined)
    assert.equal(retry.success, true)
    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(read.nodes[0].info, 'b')
  })

  test('the node id cannot be changed, even by passing one', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await graphWithNode(client)
    // The schema does not expose id, so this goes through the service directly — the guard has
    // to live there, not only in the tool schema.
    const actor = gs.normalizeActor({ valid: true, userId: 'alice@example.com', userEmail: 'alice@example.com', userRole: 'User', scopes: ['graph:write'] })
    await gs.updateNode(env, { graphId: g.graphId, nodeId: 'n1', expectedVersion: g.version, fields: { id: 'hijacked', info: 'x' }, actor })
    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(read.nodes[0].id, 'n1', 'the node id was rewritten, which would orphan every edge')
  })

  test('a missing node is reported, not silently ignored', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await graphWithNode(client)
    const e = await callErr(client, 'update_node', { graphId: g.graphId, nodeId: 'ghost', expectedVersion: g.version, fields: { info: 'x' } })
    assert.equal(e.code, gs.ERR.GRAPH_NOT_FOUND)
  })

  test('empty fields is refused rather than bumping the version for nothing', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await graphWithNode(client)
    assert.equal((await callErr(client, 'update_node', { graphId: g.graphId, nodeId: 'n1', expectedVersion: g.version, fields: {} })).code, gs.ERR.INVALID_INPUT)
  })

  test('another user cannot patch your node', async () => {
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const g = await graphWithNode(alice)
    const { client: bob } = await connect(env, BOB_RW)
    assert.equal((await callErr(bob, 'update_node', { graphId: g.graphId, nodeId: 'n1', expectedVersion: g.version, fields: { info: 'pwn' } })).code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('graph:read alone is not enough', async () => {
    const { env } = freshDb()
    const { client: rw } = await connect(env, ALICE_RW)
    const g = await graphWithNode(rw)
    const { client: ro } = await connect(env, ALICE_RO)
    assert.equal((await callErr(ro, 'update_node', { graphId: g.graphId, nodeId: 'n1', expectedVersion: g.version, fields: { info: 'x' } })).code, gs.ERR.INSUFFICIENT_SCOPE)
  })

  test('expectedVersion is required by the schema, not merely recommended', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await graphWithNode(client)
    const r = await client.callTool({ name: 'update_node', arguments: { graphId: g.graphId, nodeId: 'n1', fields: { info: 'x' } } })
    assert.equal(r.isError, true)
    assert.match(r.content[0].text, /expectedVersion/)
  })

  test('it is marked destructive — unlike add_node, it replaces content', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const u = tools.find((t) => t.name === 'update_node')
    assert.equal(u.annotations.readOnlyHint, false)
    assert.equal(u.annotations.destructiveHint, true)
    assert.equal(u.annotations.idempotentHint, true)
  })
})

describe('post_chat_message is gated harder than everything else', () => {
  test('graph:write is not enough — it needs chat:write', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const e = await callErr(client, 'post_chat_message', { groupId: 'g1', text: 'hei' })
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(e.requiredScope, 'chat:write')
  })

  test('it is the only tool flagged as reaching outside this system', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const outward = tools.filter((t) => t.annotations?.openWorldHint === true).map((t) => t.name)
    assert.deepEqual(outward, ['post_chat_message'])
  })

  test('its description warns that the action cannot be undone', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'post_chat_message')
    assert.match(t.description, /CANNOT BE UNDONE/)
    assert.match(t.description, /other people/i)
  })

  test('the schema gives no way to write or suppress the attribution line', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const props = Object.keys(tools.find((x) => x.name === 'post_chat_message').inputSchema.properties)
    assert.deepEqual(props.sort(), ['botId', 'groupId', 'text'])
  })
})
