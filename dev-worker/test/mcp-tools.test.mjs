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
import { freshDb, seedUsers, FakeAI, FakePhotosWorker, PagesKVLike, FakeAgentWorker, FakeRegisterWorker, FakeRoleWorker } from './d1-adapter.mjs'
import * as pd from '../published-domains.js'
import { CONNECT_SCOPES, OPT_IN_SCOPES } from '../oauth/scopes.js'
import { NODE_TYPES, suggestNodeType } from '../node-types.js'
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

  // The brief's rule: no client may choose role, email or user id through ordinary tool
  // arguments. It protects one thing — a model must not be able to claim it IS someone else.
  //
  // Two tools act ON ANOTHER PERSON, so they have to name that person. That is a subject, not a
  // claim about the caller, and the distinction is what the two tests below pin: a directory
  // tool may name a subject, but NO tool anywhere may name the caller.
  const DIRECTORY_TOOLS = new Set(['register_user', 'set_user_groups', 'set_user_role'])

  test('no tool lets a model ask to be someone else', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    for (const t of tools) {
      const props = Object.keys(t.inputSchema.properties || {})
      // Nothing, anywhere, may name the caller.
      for (const forbidden of ['userId', 'user_id', 'createdBy', 'actor', 'authToken', 'token']) {
        assert.equal(props.includes(forbidden), false, `${t.name} exposes ${forbidden}`)
      }
      // And outside the directory tools, a subject cannot be named either.
      if (DIRECTORY_TOOLS.has(t.name)) continue
      for (const forbidden of ['email', 'role']) {
        assert.equal(props.includes(forbidden), false, `${t.name} exposes ${forbidden}`)
      }
    }
  })

  test('a directory tool names a subject, and cannot hand out Superadmin', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    for (const name of DIRECTORY_TOOLS) {
      const t = tools.find((x) => x.name === name)
      assert.ok(t, `${name} should be registered`)
      assert.ok(Object.keys(t.inputSchema.properties).includes('email'), `${name} names its subject by email`)
    }
    const reg = tools.find((x) => x.name === 'register_user')
    assert.equal(reg.inputSchema.properties.role.enum.includes('Superadmin'), false)
    // set_user_groups cannot touch a role at all — it is one column wide.
    const grp = tools.find((x) => x.name === 'set_user_groups')
    assert.equal(Object.keys(grp.inputSchema.properties).includes('role'), false)
    // set_user_role may name a role, but not the one that runs the platform.
    const sr = tools.find((x) => x.name === 'set_user_role')
    assert.equal(sr.inputSchema.properties.role.enum.includes('Superadmin'), false)
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

  test('only the two tools whose effect leaves this system are flagged outward', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    // post_chat_message reaches other people; publish_html_node reaches the public internet.
    // Every other tool touches graphs the caller can already see, where a mistake is private
    // and undoable. Both outward tools are gated behind a scope no client can request.
    const outward = new Set(['post_chat_message', 'publish_html_node', 'register_user'])
    for (const t of tools) {
      assert.equal(t.annotations?.openWorldHint, outward.has(t.name), `${t.name} openWorldHint`)
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

  test('a client that has fetched the tool list can consume every read result', async () => {
    // The SDK client only validates structuredContent against outputSchema AFTER listTools, and
    // it THROWS rather than flagging. list_my_graphs and search_graphs both returned an extra
    // `ok` key — set to undefined, but a key all the same — so a strict client rejected the
    // response. Every real client fetches the tool list first, so this is the shape that matters.
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    await client.listTools()
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })
    for (const [name, args] of [
      ['list_my_graphs', {}],
      ['search_graphs', { query: 'T' }],
      ['list_meta_areas', {}],
      ['list_published_sites', {}],
      ['get_graph', { graphId: g.graphId }],
      ['get_graph_links', { graphId: g.graphId }],
      ['search', { query: 'T' }],
      ['fetch', { id: g.graphId }],
    ]) {
      await client.callTool({ name, arguments: args }) // throws if the schema is violated
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



describe('generate_node_image fills a placeholder the node already has', () => {
  const HEADER_EL =
    "![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/HEADERIMG.png)"

  /** A connected client whose env has a working AI binding and photo service. */
  async function withImages(authCtx = ALICE_RW) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.AI = new FakeAI()
    env.PHOTOS_WORKER = new FakePhotosWorker()
    const { client } = await connect(env, authCtx)
    return { client, env }
  }

  test('end to end over the protocol: prompt in, imgix URL in the node', async () => {
    const { client, env } = await withImages()
    const g = await callOk(client, 'create_graph', {
      title: 'Illustrated',
      metaArea: '#X',
      nodes: [{ id: 'n1', label: 'Intro', type: 'fulltext', info: `${HEADER_EL}\n\nBody text.` }],
    })

    const r = await callOk(client, 'generate_node_image', {
      graphId: g.graphId,
      nodeId: 'n1',
      prompt: 'a fjord at dawn, wide angle, soft light',
      placement: 'header',
    })

    assert.equal(r.success, true)
    assert.equal(r.imageUrl, 'https://vegvisr.imgix.net/mcp-1.jpg')
    assert.equal(r.remainingPlaceholders, 0)

    const after = await callOk(client, 'get_graph', { graphId: g.graphId })
    const info = after.nodes[0].info
    assert.ok(info.includes('mcp-1.jpg'))
    assert.ok(!info.includes('HEADERIMG.png'))
    // The upload ran as the user, on a credential read from D1 — never from a tool argument.
    assert.equal(env.PHOTOS_WORKER.uploads[0].token, 'sess-alice')
  })

  test('a read-only connection cannot generate anything', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.AI = new FakeAI()
    env.PHOTOS_WORKER = new FakePhotosWorker()
    const { client: rw } = await connect(env, ALICE_RW)
    const g = await callOk(rw, 'create_graph', {
      title: 'T',
      metaArea: '#X',
      nodes: [{ id: 'n1', label: 'a', type: 'fulltext', info: HEADER_EL }],
    })

    const { client: ro } = await connect(env, ALICE_RO)
    const e = await callErr(ro, 'generate_node_image', { graphId: g.graphId, nodeId: 'n1', prompt: 'x' })
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(e.requiredScope, 'graph:write')
    assert.equal(env.AI.calls.length, 0, 'scope is checked before anything is generated')
  })

  test("another user's graph is refused, and no image is paid for", async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.AI = new FakeAI()
    env.PHOTOS_WORKER = new FakePhotosWorker()
    const { client: alice } = await connect(env, ALICE_RW)
    const g = await callOk(alice, 'create_graph', {
      title: 'T',
      metaArea: '#X',
      nodes: [{ id: 'n1', label: 'a', type: 'fulltext', info: HEADER_EL }],
    })

    const { client: bob } = await connect(env, BOB_RW)
    const e = await callErr(bob, 'generate_node_image', { graphId: g.graphId, nodeId: 'n1', prompt: 'x' })
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal(env.AI.calls.length, 0)
  })

  test('a node with no placeholder is told what to write first, not guessed at', async () => {
    const { client } = await withImages()
    const g = await callOk(client, 'create_graph', {
      title: 'T',
      metaArea: '#X',
      nodes: [{ id: 'n1', label: 'a', type: 'fulltext', info: 'Plain prose.' }],
    })
    const e = await callErr(client, 'generate_node_image', { graphId: g.graphId, nodeId: 'n1', prompt: 'x' })
    assert.equal(e.code, gs.ERR.INVALID_INPUT)
    assert.match(e.message, /get_fulltext_elements/)
  })

  test('it is a write but not destructive — it only overwrites a placeholder it verified', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'generate_node_image')
    assert.equal(t.annotations.readOnlyHint, false)
    assert.equal(t.annotations.destructiveHint, false)
    assert.equal(t.annotations.idempotentHint, false, 'a second call would make a different picture')
    // The prompt is the only free text; there is no imageUrl input, so a model cannot smuggle
    // an arbitrary URL into someone's node through this tool.
    assert.deepEqual(
      Object.keys(t.inputSchema.properties).sort(),
      ['expectedVersion', 'graphId', 'height', 'nodeId', 'placement', 'prompt', 'width'],
    )
  })
})



describe('update_graph_metadata gives updateMetadata its first caller', () => {
  test('replaces metaArea and leaves title and nodes alone', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', {
      title: 'Living Art',
      metaArea: '#MAIKENSNEEGGEN #LIVINGART',
      nodes: [{ id: 'n1', label: 'Intro', type: 'fulltext', info: 'body' }],
    })

    const r = await callOk(client, 'update_graph_metadata', {
      graphId: g.graphId,
      fields: { metaArea: '#MAIKENSNEEGGEN #LIVINGART #MOVEMETIME #IAMAZINGPAGE' },
    })
    assert.equal(r.success, true)
    assert.equal(r.metaArea, '#MAIKENSNEEGGEN #LIVINGART #MOVEMETIME #IAMAZINGPAGE')
    assert.deepEqual(r.updatedFields, ['metaArea'])

    const after = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(after.title, 'Living Art', 'title untouched')
    assert.equal(after.nodeCount, 1, 'nodes untouched')
  })

  test('omitting expectedVersion works — it defaults to the source the service compares', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#A' })
    // Two updates in a row, neither passing a version. A default read from the wrong source
    // would make the second one conflict.
    await callOk(client, 'update_graph_metadata', { graphId: g.graphId, fields: { metaArea: '#A #B' } })
    const second = await callOk(client, 'update_graph_metadata', { graphId: g.graphId, fields: { metaArea: '#A #B #C' } })
    assert.equal(second.metaArea, '#A #B #C')
  })

  test('a stale expectedVersion is a conflict that reports the real version', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#A' })
    const e = await callErr(client, 'update_graph_metadata', {
      graphId: g.graphId,
      fields: { metaArea: '#B' },
      expectedVersion: 99,
    })
    assert.equal(e.code, gs.ERR.VERSION_CONFLICT)
    assert.equal(e.expectedVersion, 99)
    assert.equal(typeof e.currentVersion, 'number')
  })

  test('publicationState is not offered in the schema and is refused if forced', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'update_graph_metadata')
    const fieldNames = Object.keys(t.inputSchema.properties.fields.properties).sort()
    assert.deepEqual(fieldNames, ['category', 'description', 'metaArea', 'title'])
    assert.ok(!fieldNames.includes('publicationState'), 'publishing is its own action')
    assert.ok(!fieldNames.includes('createdBy'), 'a model cannot reassign authorship')
    assert.ok(!fieldNames.includes('version'))
  })

  test("another user's graph is refused", async () => {
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const g = await callOk(alice, 'create_graph', { title: 'Hers', metaArea: '#A' })
    const { client: bob } = await connect(env, BOB_RW)
    const e = await callErr(bob, 'update_graph_metadata', { graphId: g.graphId, fields: { metaArea: '#MINE' } })
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('a read-only connection cannot change metadata', async () => {
    const { env } = freshDb()
    const { client: rw } = await connect(env, ALICE_RW)
    const g = await callOk(rw, 'create_graph', { title: 'T', metaArea: '#A' })
    const { client: ro } = await connect(env, ALICE_RO)
    const e = await callErr(ro, 'update_graph_metadata', { graphId: g.graphId, fields: { metaArea: '#B' } })
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
  })

  test('empty fields is refused rather than bumping the version for nothing', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#A' })
    const e = await callErr(client, 'update_graph_metadata', { graphId: g.graphId, fields: {} })
    assert.equal(e.code, gs.ERR.INVALID_INPUT)
  })

  test('the version history keeps the previous metadata, so a wrong overwrite is recoverable', async () => {
    const { env, raw } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#KEEP #THIS' })
    // The exact mistake the tool description warns about: sending only the new tag.
    await callOk(client, 'update_graph_metadata', { graphId: g.graphId, fields: { metaArea: '#ONLYNEW' } })

    const rows = raw.prepare('SELECT version, data FROM knowledge_graph_history WHERE graph_id = ? ORDER BY version').all(g.graphId)
    const areas = rows.map((r) => JSON.parse(r.data).metadata.metaArea)
    assert.ok(areas.includes('#KEEP #THIS'), 'the old value is still in history')
    assert.equal(areas[areas.length - 1], '#ONLYNEW')
  })
})


describe('publish_html_node is the one tool that reaches the public internet', () => {
  const PUB = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'graph:write', 'graph:publish'] } }

  /** A graph with an html-node already associated with one host. */
  async function withPage(hosts = ['fonemer.vegvisr.org'], authCtx = PUB) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.AGENT_WORKER = new FakeAgentWorker()
    const { client } = await connect(env, authCtx)
    const g = await callOk(client, 'create_graph', {
      title: 'Site',
      metaArea: '#X',
      nodes: [{ id: 'page', label: 'Landing', type: 'html-node', info: '<h1>hi</h1>', bibl: hosts.map((h) => `https://${h}/`) }],
    })
    return { env, client, graphId: g.graphId }
  }

  test('republishes to the host the node already points at, as the caller', async () => {
    const { env, client, graphId } = await withPage()
    const r = await callOk(client, 'publish_html_node', { graphId, nodeId: 'page', host: 'fonemer.vegvisr.org' })
    assert.equal(r.success, true)
    assert.equal(r.verified, true)
    assert.equal(r.siteUrl, 'https://fonemer.vegvisr.org')

    const [call] = env.AGENT_WORKER.calls
    assert.equal(call.token, 'sess-alice', 'publishes as the caller, on a server-read token')
    assert.equal(call.body.host, 'fonemer.vegvisr.org')
    // The whole reason a model is allowed near this: the host guard cannot be overridden.
    assert.ok(!('force' in call.body), 'force must never be forwarded')
  })

  test('a host the node does not point at is refused, and the real ones are named', async () => {
    const { env, client, graphId } = await withPage(['fonemer.vegvisr.org'])
    const e = await callErr(client, 'publish_html_node', { graphId, nodeId: 'page', host: 'ponemer.vegvisr.org' })
    assert.equal(e.code, gs.ERR.INVALID_INPUT)
    assert.deepEqual(e.associatedHosts, ['fonemer.vegvisr.org'])
    assert.equal(env.AGENT_WORKER.calls.length, 0, 'refused before anything left this worker')
  })

  test('a node with no host at all cannot be used to claim one', async () => {
    const { env, client, graphId } = await withPage([])
    const e = await callErr(client, 'publish_html_node', { graphId, nodeId: 'page', host: 'brand-new.vegvisr.org' })
    assert.equal(e.code, gs.ERR.INVALID_INPUT)
    assert.equal(env.AGENT_WORKER.calls.length, 0)
  })

  test('a read+write connection cannot publish — the scope is not in CONNECT_SCOPES', async () => {
    const { env, client, graphId } = await withPage(['fonemer.vegvisr.org'], ALICE_RW)
    const e = await callErr(client, 'publish_html_node', { graphId, nodeId: 'page', host: 'fonemer.vegvisr.org' })
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(e.requiredScope, 'graph:publish')
    assert.equal(env.AGENT_WORKER.calls.length, 0)
  })

  test("another user's graph is refused even with the publish scope", async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.AGENT_WORKER = new FakeAgentWorker()
    const { client: alice } = await connect(env, ALICE_RW)
    const g = await callOk(alice, 'create_graph', {
      title: 'Hers', metaArea: '#X',
      nodes: [{ id: 'page', label: 'p', type: 'html-node', info: '<h1>x</h1>', bibl: ['https://hers.vegvisr.org/'] }],
    })
    const bobPub = { ...BOB_RW, auth: { ...BOB_RW.auth, scope: ['graph:read', 'graph:write', 'graph:publish'] } }
    const { client: bob } = await connect(env, bobPub)
    const e = await callErr(bob, 'publish_html_node', { graphId: g.graphId, nodeId: 'page', host: 'hers.vegvisr.org' })
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal(env.AGENT_WORKER.calls.length, 0)
  })

  test('only an html-node or css-node can be published', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.AGENT_WORKER = new FakeAgentWorker()
    const { client } = await connect(env, PUB)
    const g = await callOk(client, 'create_graph', {
      title: 'T', metaArea: '#X',
      nodes: [{ id: 'n1', label: 'prose', type: 'fulltext', info: 'text', bibl: ['https://x.vegvisr.org/'] }],
    })
    const e = await callErr(client, 'publish_html_node', { graphId: g.graphId, nodeId: 'n1', host: 'x.vegvisr.org' })
    assert.match(e.message, /html-node or css-node/)
  })

  test('verified:false is reported as NOT live rather than dressed up as success', async () => {
    const { env, client, graphId } = await withPage()
    env.AGENT_WORKER = new FakeAgentWorker({ verified: false })
    const r = await callOk(client, 'publish_html_node', { graphId, nodeId: 'page', host: 'fonemer.vegvisr.org' })
    assert.equal(r.verified, false)
  })

  test("a refusal from the publish service is passed through, not swallowed", async () => {
    const { env, client, graphId } = await withPage()
    env.AGENT_WORKER = new FakeAgentWorker({ ok: false, status: 400, error: 'Superadmin role required to publish an html-node.' })
    const e = await callErr(client, 'publish_html_node', { graphId, nodeId: 'page', host: 'fonemer.vegvisr.org' })
    assert.match(e.message, /Superadmin role required/)
  })

  test('it is the only tool besides chat that declares it reaches the outside world', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, PUB)
    const { tools } = await client.listTools()
    const outward = tools.filter((t) => t.annotations?.openWorldHint).map((t) => t.name).sort()
    assert.deepEqual(outward, ['post_chat_message', 'publish_html_node', 'register_user'])
    const t = tools.find((x) => x.name === 'publish_html_node')
    assert.equal(t.annotations.destructiveHint, true, 'it replaces the page that is there')
    // No force, and no way to name an arbitrary proxy.
    assert.deepEqual(Object.keys(t.inputSchema.properties).sort(), ['graphId', 'host', 'nodeId', 'versionPill'])
  })
})


describe('node types: a graph generated over MCP cannot carry a type that will not render', () => {
  test('the schema advertises the real types, so a model never has to guess', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'add_node')
    const typeSchema = t.inputSchema.properties.node.properties.type
    // An enum in the published schema, not a sentence with examples. This is the fix: the old
    // description said "e.g. fulltext, image, link, video, audio, mermaid-diagram" and left
    // html-node out, so ChatGPT and Grok both coined "html".
    assert.ok(Array.isArray(typeSchema.enum), 'type must be an enum in the wire schema')
    assert.ok(typeSchema.enum.includes('html-node'))
    assert.ok(typeSchema.enum.includes('css-node'))
    assert.equal(typeSchema.enum.includes('html'), false, '"html" must NOT be offered')
  })

  test('add_node refuses "html" at the protocol, before anything is stored', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })

    // The SDK does not throw — it returns isError with the valid options listed, which is more
    // useful to a model than an exception would be.
    const r = await client.callTool({ name: 'add_node', arguments: { graphId: g.graphId, node: { label: 'App', type: 'html' } } })
    assert.equal(r.isError, true, 'the invalid value must be rejected, not silently stored')
    assert.match(r.content[0].text, /Invalid option/, 'and the reply must say what is allowed')
    assert.match(r.content[0].text, /html-node/, 'the list it prints contains what was meant')

    const after = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(after.nodeCount, 0, 'nothing was written')
  })

  test('create_graph refuses a bad type in its initial nodes too', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const r = await client.callTool({
      name: 'create_graph',
      arguments: { title: 'T', metaArea: '#X', nodes: [{ id: 'n1', label: 'App', type: 'html' }] },
    })
    assert.equal(r.isError, true)
  })

  test('update_node cannot retype a node to something that will not render', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', {
      title: 'T', metaArea: '#X',
      nodes: [{ id: 'n1', label: 'p', type: 'fulltext', info: 'x' }],
    })
    const r = await client.callTool({
      name: 'update_node',
      arguments: { graphId: g.graphId, nodeId: 'n1', fields: { type: 'html' }, expectedVersion: 1 },
    })
    assert.equal(r.isError, true)

    const after = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(after.nodes[0].type, 'fulltext', 'the node keeps its valid type')
  })

  test('the right type is accepted and round-trips', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', {
      title: 'Site', metaArea: '#X',
      nodes: [{ id: 'page', label: 'App', type: 'html-node', info: '<h1>hi</h1>' }],
    })
    const after = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(after.nodes[0].type, 'html-node')
  })

  test('every wrong type seen in production maps to what was meant', () => {
    // These are the actual strings in the data, not invented cases.
    assert.equal(suggestNodeType('html'), 'html-node')
    assert.equal(suggestNodeType('fulltext-node'), 'fulltext')
    assert.equal(suggestNodeType('action_txt'), 'action_test')
    assert.equal(suggestNodeType('nonsense-xyz'), null, 'no confident guess means no guess')
  })

  test('openapi and the MCP schema cannot drift — they are the same list', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'add_node')
    assert.deepEqual(
      [...t.inputSchema.properties.node.properties.type.enum].sort(),
      [...NODE_TYPES].sort(),
      'the wire schema must be exactly node-types.js, which openapi.json also uses',
    )
  })
})


describe('register_user creates a login for a real person', () => {
  const REG = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'graph:write', 'user:register'] } }

  async function withRegistry(opts = {}, authCtx = REG) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.AGENT_WORKER = new FakeRegisterWorker(opts)
    const { client } = await connect(env, authCtx)
    return { env, client }
  }

  test('registers a name and an email, as the caller', async () => {
    const { env, client } = await withRegistry()
    const r = await callOk(client, 'register_user', { email: 'Ny.Bruker@Example.COM', name: 'Ny Bruker' })
    assert.equal(r.success, true)
    assert.equal(r.created, true)
    assert.equal(r.userId, 'uid-1')
    assert.equal(r.loginUrl, 'https://login.vegvisr.org')

    const [call] = env.AGENT_WORKER.calls
    assert.equal(call.token, 'sess-alice', 'runs on the caller\'s own credential')
    assert.equal(call.body.email, 'ny.bruker@example.com', 'email is normalised before it is stored')
    assert.equal(call.body.name, 'Ny Bruker')
  })

  test('the sign-in credential never reaches the model, even if the service returns one', async () => {
    const { client } = await withRegistry()
    const r = await callOk(client, 'register_user', { email: 'a@b.no', name: 'A' })
    const blob = JSON.stringify(r)
    assert.ok(!blob.includes('SHOULD-NEVER-REACH-A-MODEL'), 'the token must be stripped by the MCP layer')
    assert.ok(!/emailVerificationToken/i.test(blob))
  })

  test('an email that already exists is REFUSED, and nothing is forwarded', async () => {
    const { env, client } = await withRegistry()
    // seedUsers put alice@example.com in config. Registering her again must not quietly patch
    // her record — the whole point of checking here rather than in the executor.
    const e = await callErr(client, 'register_user', { email: 'Alice@Example.com', name: 'Someone Else' })
    assert.equal(e.code, gs.ERR.NODE_EXISTS)
    assert.equal(e.email, 'alice@example.com')
    assert.equal(e.existingRole, 'User')
    assert.match(e.message, /already registered/)
    assert.match(e.message, /Nothing was changed/)
    assert.equal(env.AGENT_WORKER.calls.length, 0, 'no write was attempted')
  })

  test('group tags are normalised to the house style', async () => {
    const { env, client } = await withRegistry()
    await callOk(client, 'register_user', { email: 'ny@example.com', name: 'Ny', groupTags: 'iiba, demo' })
    assert.equal(env.AGENT_WORKER.calls[0].body.group_tags, '#IIBA #DEMO')
  })

  test('a model cannot mint a Superadmin', async () => {
    const { env, client } = await withRegistry()
    const r = await client.callTool({
      name: 'register_user',
      arguments: { email: 'x@y.no', name: 'X', role: 'Superadmin' },
    })
    assert.equal(r.isError, true, 'Superadmin must not even be in the schema')
    assert.equal(env.AGENT_WORKER.calls.length, 0, 'nothing was forwarded')
  })

  test('the role enum offers only assignable roles', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, REG)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'register_user')
    // Only roles the code actually enforces. 'user' was removed after three accounts were created
    // with it: every `role === 'user'` in the frontend is a chat message role, so it granted
    // nothing — and a model registering "a user" picked the value with the matching name.
    assert.deepEqual([...t.inputSchema.properties.role.enum].sort(), ['Admin', 'ViewOnly'])
    assert.equal(t.inputSchema.properties.role.enum.includes('Superadmin'), false)
    assert.equal(t.inputSchema.properties.role.enum.includes('user'), false, 'a role that grants nothing must not be offered')
  })

  test('an ordinary read+write connection cannot register anyone', async () => {
    const { env, client } = await withRegistry({}, ALICE_RW)
    const e = await callErr(client, 'register_user', { email: 'x@y.no', name: 'X' })
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(e.requiredScope, 'user:register')
    assert.equal(env.AGENT_WORKER.calls.length, 0)
  })

  test('a malformed email is refused before anything leaves this worker', async () => {
    const { env, client } = await withRegistry()
    const e = await callErr(client, 'register_user', { email: 'not-an-email', name: 'X' })
    assert.equal(e.code, gs.ERR.INVALID_INPUT)
    assert.equal(env.AGENT_WORKER.calls.length, 0)
  })

  test('a non-Superadmin caller is told it is a permission problem', async () => {
    const { client } = await withRegistry({ ok: false, status: 403, error: 'Superadmin role required to register users' })
    const e = await callErr(client, 'register_user', { email: 'x@y.no', name: 'X' })
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.match(e.message, /Superadmin role required/)
  })

  test('it declares that its effect leaves the system, and is not destructive', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, REG)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'register_user')
    assert.equal(t.annotations.openWorldHint, true, 'it creates an account for a real person')
    assert.equal(t.annotations.destructiveHint, false, 'an existing account is completed, not replaced')
    assert.equal(t.annotations.idempotentHint, true)
  })
})


describe('list_users answers who is already registered', () => {
  const READ = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'user:read'] } }
  const ROOT_READ = {
    auth: { ...ALICE_RW.auth, scope: ['graph:read', 'user:read'], userId: 'root@example.com' },
    props: { userId: 'root@example.com', email: 'root@example.com', role: 'Superadmin', authMethod: 'oauth' },
  }

  function seeded() {
    const { env, raw } = freshDb()
    seedUsers(raw)
    raw.prepare("UPDATE config SET Role='Superadmin' WHERE email='alice@example.com'").run()
    raw.prepare("INSERT OR REPLACE INTO config (user_id, data, email, emailVerificationToken, Role, phone, group_tags) VALUES (?,?,?,?,?,?,?)")
      .run('u-root', '{"profile":{"name":"Root"}}', 'root@example.com', 'sess-root', 'Superadmin', '+4790000009', null)
    raw.prepare("INSERT OR REPLACE INTO config (user_id, data, email, emailVerificationToken, Role, phone, group_tags) VALUES (?,?,?,?,?,?,?)")
      .run('u-kate', '{"profile":{"name":"Kate Dent Rennie"}}', 'kate@longwhitecloud.com', 'tok-kate', 'Admin', null, '#IIBA #DEMO')
    raw.prepare("INSERT OR REPLACE INTO config (user_id, data, email, emailVerificationToken, Role, phone, group_tags) VALUES (?,?,?,?,?,?,?)")
      .run('u-garet', '{"profile":{"name":"Garet Bedrosian"}}', 'garet@garetbedrosian.com', 'tok-garet', 'Admin', '+4790000010', '#IIBA')
    return env
  }

  test('lists name, email, role and group — and no credential', async () => {
    const env = seeded()
    const { client } = await connect(env, ROOT_READ)
    const r = await callOk(client, 'list_users', {})
    const kate = r.users.find((u) => u.email === 'kate@longwhitecloud.com')
    assert.equal(kate.name, 'Kate Dent Rennie')
    assert.equal(kate.role, 'Admin')
    assert.equal(kate.groupTags, '#IIBA #DEMO')
    assert.equal(kate.canSignInBySms, false, 'no phone means no SMS sign-in')
    // The query never selects the token, and no phone number is returned either.
    const blob = JSON.stringify(r)
    assert.ok(!blob.includes('tok-kate') && !blob.includes('sess-root'))
    assert.ok(!blob.includes('+4790000010'), 'a phone book is not what was asked for')
  })

  test('a group tag filters, with or without the #', async () => {
    const env = seeded()
    const { client } = await connect(env, ROOT_READ)
    const withHash = await callOk(client, 'list_users', { groupTag: '#IIBA' })
    const without = await callOk(client, 'list_users', { groupTag: 'iiba' })
    assert.equal(withHash.count, 2)
    assert.deepEqual(withHash.users.map((u) => u.email).sort(), without.users.map((u) => u.email).sort())

    const demo = await callOk(client, 'list_users', { groupTag: 'DEMO' })
    assert.deepEqual(demo.users.map((u) => u.email), ['kate@longwhitecloud.com'])
  })

  test('free text matches email and name', async () => {
    const env = seeded()
    const { client } = await connect(env, ROOT_READ)
    const byName = await callOk(client, 'list_users', { query: 'bedrosian' })
    assert.deepEqual(byName.users.map((u) => u.email), ['garet@garetbedrosian.com'])
    const byEmail = await callOk(client, 'list_users', { query: 'longwhitecloud' })
    assert.deepEqual(byEmail.users.map((u) => u.email), ['kate@longwhitecloud.com'])
  })

  test('a non-Superadmin cannot read the directory even with the scope', async () => {
    const env = seeded()
    const { client } = await connect(env, READ) // alice, role User in props
    const e = await callErr(client, 'list_users', {})
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.match(e.message, /Superadmin/)
  })

  test('the scope is required and is not one an ordinary connection holds', async () => {
    const env = seeded()
    const { client } = await connect(env, ALICE_RW)
    const e = await callErr(client, 'list_users', {})
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(e.requiredScope, 'user:read')
  })

  test('it is read-only', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ROOT_READ)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'list_users')
    assert.equal(t.annotations.readOnlyHint, true)
    assert.equal(t.annotations.openWorldHint, false)
  })
})


describe('set_user_groups tags someone who is already registered', () => {
  const REG = {
    auth: { ...ALICE_RW.auth, scope: ['graph:read', 'user:register'], userId: 'root@example.com' },
    props: { userId: 'root@example.com', email: 'root@example.com', role: 'Superadmin', authMethod: 'oauth' },
  }

  function seeded() {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.AGENT_WORKER = new FakeRegisterWorker({ updated: true })
    raw.prepare("INSERT OR REPLACE INTO config (user_id, data, email, emailVerificationToken, Role, group_tags) VALUES (?,?,?,?,?,?)")
      .run('u-root', '{}', 'root@example.com', 'sess-root', 'Superadmin', null)
    raw.prepare("INSERT OR REPLACE INTO config (user_id, data, email, emailVerificationToken, Role, group_tags) VALUES (?,?,?,?,?,?)")
      .run('u-kate', '{}', 'kate@longwhitecloud.com', 'tok-kate', 'Admin', '#IIBA #DEMO')
    raw.prepare("INSERT OR REPLACE INTO config (user_id, data, email, emailVerificationToken, Role, group_tags) VALUES (?,?,?,?,?,?)")
      .run('u-garet', '{}', 'garet@garetbedrosian.com', 'tok-garet', 'Admin', null)
    return env
  }

  test("add keeps what they already have", async () => {
    const env = seeded()
    const { client } = await connect(env, REG)
    const r = await callOk(client, 'set_user_groups', { email: 'kate@longwhitecloud.com', groupTags: 'workshop' })
    assert.equal(r.before, '#IIBA #DEMO')
    assert.equal(r.groupTags, '#IIBA #DEMO #WORKSHOP')
    assert.equal(r.changed, true)
    assert.equal(env.AGENT_WORKER.calls[0].body.group_tags, '#IIBA #DEMO #WORKSHOP')
  })

  test('add is the default mode', async () => {
    const env = seeded()
    const { client } = await connect(env, REG)
    const r = await callOk(client, 'set_user_groups', { email: 'garet@garetbedrosian.com', groupTags: '#IIBA' })
    assert.equal(r.before, null)
    assert.equal(r.groupTags, '#IIBA')
  })

  test('replace sets exactly what was asked for', async () => {
    const env = seeded()
    const { client } = await connect(env, REG)
    const r = await callOk(client, 'set_user_groups', { email: 'kate@longwhitecloud.com', groupTags: 'alumni', mode: 'replace' })
    assert.equal(r.groupTags, '#ALUMNI')
  })

  test('remove takes one away and leaves the rest', async () => {
    const env = seeded()
    const { client } = await connect(env, REG)
    const r = await callOk(client, 'set_user_groups', { email: 'kate@longwhitecloud.com', groupTags: '#DEMO', mode: 'remove' })
    assert.equal(r.groupTags, '#IIBA')
  })

  test('removing the last tag clears the column rather than sending an empty string', async () => {
    const env = seeded()
    const { client } = await connect(env, REG)
    const r = await callOk(client, 'set_user_groups', { email: 'kate@longwhitecloud.com', groupTags: '#IIBA #DEMO', mode: 'remove' })
    assert.equal(r.groupTags, null)
    // The route's completion path reads '' as "leave alone", so a clear cannot go through it.
    assert.equal(env.AGENT_WORKER.calls.length, 0, 'cleared directly, not via the register route')
  })

  test('adding a tag they already have changes nothing and says so', async () => {
    const env = seeded()
    const { client } = await connect(env, REG)
    const r = await callOk(client, 'set_user_groups', { email: 'kate@longwhitecloud.com', groupTags: '#IIBA' })
    assert.equal(r.changed, false)
    assert.equal(env.AGENT_WORKER.calls.length, 0, 'no write for a no-op')
  })

  test('an unregistered email is refused and points at register_user', async () => {
    const env = seeded()
    const { client } = await connect(env, REG)
    const e = await callErr(client, 'set_user_groups', { email: 'nobody@example.com', groupTags: '#IIBA' })
    assert.equal(e.code, gs.ERR.GRAPH_NOT_FOUND)
    assert.match(e.message, /register_user/)
  })

  test('a non-Superadmin cannot change someone else\'s groups', async () => {
    const env = seeded()
    const { client } = await connect(env, { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['user:register'] } })
    const e = await callErr(client, 'set_user_groups', { email: 'kate@longwhitecloud.com', groupTags: '#X' })
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('the scope is required', async () => {
    const env = seeded()
    const { client } = await connect(env, ALICE_RW)
    const e = await callErr(client, 'set_user_groups', { email: 'kate@longwhitecloud.com', groupTags: '#X' })
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(e.requiredScope, 'user:register')
  })
})


describe('set_user_role is the only way to re-rank someone', () => {
  const ROOT = {
    auth: { ...ALICE_RW.auth, scope: ['graph:read', 'user:register'], userId: 'root@example.com' },
    props: { userId: 'root@example.com', email: 'root@example.com', role: 'Superadmin', authMethod: 'oauth' },
  }

  function seeded(opts = {}) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.AGENT_WORKER = new FakeRoleWorker(opts)
    raw.prepare("INSERT OR REPLACE INTO config (user_id, data, email, emailVerificationToken, Role) VALUES (?,?,?,?,?)")
      .run('u-root', '{}', 'root@example.com', 'sess-root', 'Superadmin')
    return env
  }

  test('changes the role and reports what it was before', async () => {
    const env = seeded()
    const { client } = await connect(env, ROOT)
    const r = await callOk(client, 'set_user_role', { email: 'ingrid.synnove.meyer@gmail.com', role: 'Admin' })
    assert.equal(r.changed, true)
    assert.equal(r.previousRole, 'Realtime')
    assert.equal(r.role, 'Admin')
    assert.equal(env.AGENT_WORKER.calls[0].token, 'sess-root', 'runs as the caller')
  })

  test('Superadmin is not in the schema, so it cannot be granted', async () => {
    const env = seeded()
    const { client } = await connect(env, ROOT)
    const r = await client.callTool({ name: 'set_user_role', arguments: { email: 'x@y.no', role: 'Superadmin' } })
    assert.equal(r.isError, true)
    assert.equal(env.AGENT_WORKER.calls.length, 0, 'refused by the protocol, nothing forwarded')
  })

  test("a refusal from the service reads as a permission problem, not an internal one", async () => {
    // agent-worker refuses to change a user who IS Superadmin — a model that could demote one
    // could lock the owner out of their own platform.
    const env = seeded({ ok: false, status: 400, error: "msneeggen@gmail.com is a Superadmin. Changing a Superadmin's role is not available here" })
    const { client } = await connect(env, ROOT)
    const e = await callErr(client, 'set_user_role', { email: 'msneeggen@gmail.com', role: 'ViewOnly' })
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.match(e.message, /is a Superadmin/)
  })

  test('setting the role they already have changes nothing and says so', async () => {
    const env = seeded({ changed: false, previousRole: 'Admin' })
    const { client } = await connect(env, ROOT)
    const r = await callOk(client, 'set_user_role', { email: 'a@b.no', role: 'Admin' })
    assert.equal(r.changed, false)
  })

  test('a non-Superadmin caller is refused before anything leaves this worker', async () => {
    const env = seeded()
    const { client } = await connect(env, { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['user:register'] } })
    const e = await callErr(client, 'set_user_role', { email: 'a@b.no', role: 'Admin' })
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal(env.AGENT_WORKER.calls.length, 0)
  })

  test('it declares that it can take access away', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ROOT)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'set_user_role')
    assert.equal(t.annotations.destructiveHint, true)
    assert.equal(t.annotations.idempotentHint, true)
  })
})


describe('surveying a large collection without opening every graph', () => {
  async function withGraphs(specs) {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    for (const [title, metaArea] of specs) {
      await callOk(client, 'create_graph', { title, metaArea })
    }
    return { env, client }
  }

  test('list_my_graphs shows the meta area on every line, and (none) when there is none', async () => {
    const { client } = await withGraphs([['A', '#NIBI #VEGR.AI'], ['B', '#NIBI']])
    const r = await client.callTool({ name: 'list_my_graphs', arguments: {} })
    const text = r.content[0].text
    // The structured result already carried metaArea; the TEXT a model reads did not.
    assert.match(text, /meta: #NIBI #VEGR\.AI/)
    assert.match(text, /meta: #NIBI(?! #)/)
    for (const g of r.structuredContent.results) assert.ok('metaArea' in g)
  })

  test('list_meta_areas counts each tag, and a graph with two tags counts in both', async () => {
    const { client } = await withGraphs([
      ['A', '#NIBI #VEGR.AI'], ['B', '#NIBI'], ['C', '#NIBI'], ['D', '#OTHER'],
    ])
    const r = await callOk(client, 'list_meta_areas', {})
    assert.equal(r.totalGraphs, 4)
    assert.deepEqual(r.metaAreas, [
      { metaArea: '#NIBI', graphCount: 3 },
      { metaArea: '#OTHER', graphCount: 1 },
      { metaArea: '#VEGR.AI', graphCount: 1 },
    ])
    assert.equal(r.untagged, 0)
    // Counts sum to more than the number of graphs, because A carries two tags.
    assert.equal(r.metaAreas.reduce((n, m) => n + m.graphCount, 0), 5)
  })

  test('it is sorted by count, most-used first', async () => {
    const { client } = await withGraphs([['A', '#RARE'], ['B', '#COMMON'], ['C', '#COMMON'], ['D', '#COMMON']])
    const r = await callOk(client, 'list_meta_areas', {})
    assert.deepEqual(r.metaAreas.map((m) => m.metaArea), ['#COMMON', '#RARE'])
  })

  test('tags are matched case-insensitively, the way /getmetaareas splits them', async () => {
    const { client } = await withGraphs([['A', '#nibi'], ['B', '#NIBI'], ['C', '#Nibi']])
    const r = await callOk(client, 'list_meta_areas', {})
    assert.deepEqual(r.metaAreas, [{ metaArea: '#NIBI', graphCount: 3 }])
  })

  test('a graph listing the same tag twice is counted once', async () => {
    const { client } = await withGraphs([['A', '#NIBI #NIBI']])
    const r = await callOk(client, 'list_meta_areas', {})
    assert.deepEqual(r.metaAreas, [{ metaArea: '#NIBI', graphCount: 1 }])
  })

  test("another user's graphs are not counted", async () => {
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const { client: bob } = await connect(env, BOB_RW)
    await callOk(alice, 'create_graph', { title: 'Mine', metaArea: '#MINE' })
    await callOk(bob, 'create_graph', { title: 'Theirs', metaArea: '#THEIRS' })
    const r = await callOk(alice, 'list_meta_areas', {})
    assert.deepEqual(r.metaAreas, [{ metaArea: '#MINE', graphCount: 1 }])
    assert.equal(r.totalGraphs, 1)
  })

  test('list_my_graphs now pages up to 200, while search_graphs stays at 50', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    assert.match(tools.find((t) => t.name === 'list_my_graphs').inputSchema.properties.limit.description, /1–200/)
    assert.match(tools.find((t) => t.name === 'search_graphs').inputSchema.properties.limit.description, /1–50/)

    const r = await callOk(client, 'list_my_graphs', { limit: 200 })
    assert.equal(r.limit, 200, 'a limit of 200 must not be clamped back to 50')
  })

  test('the metaArea filter still works unchanged', async () => {
    const { client } = await withGraphs([['A', '#NIBI'], ['B', '#OTHER']])
    const r = await callOk(client, 'list_my_graphs', { metaArea: '#NIBI' })
    assert.equal(r.results.length, 1)
    assert.equal(r.results[0].title, 'A')
  })
})

describe('the published-site registry reaches MCP the same way it reaches the portfolio', () => {
  const key = (host, graphId, nodeId = 'html-1') => ({
    name: `html:${host}`,
    metadata: { graphId, nodeId, publishedAt: '2026-09-01T10:00:00.000Z', publishedBy: 'someone' },
  })

  test('list_published_sites names the host, the graph and the node serving it', async () => {
    pd.resetRegistryCache()
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'Landing', metaArea: '#X' })
    env.HTML_PAGES = new PagesKVLike([key('landing.vegvisr.org', g.graphId, 'n-landing')])

    const r = await callOk(client, 'list_published_sites', {})
    assert.equal(r.count, 1)
    const [site] = r.sites
    assert.equal(site.hostname, 'landing.vegvisr.org')
    assert.equal(site.siteUrl, 'https://landing.vegvisr.org')
    assert.equal(site.graphId, g.graphId)
    assert.equal(site.nodeId, 'n-landing')
    assert.equal(site.viewerUrl, g.viewerUrl)
  })

  test("a site whose graph belongs to someone else is not listed, and the gap is counted", async () => {
    pd.resetRegistryCache()
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const { client: bob } = await connect(env, BOB_RW)
    const mine = await callOk(alice, 'create_graph', { title: 'Mine', metaArea: '#X' })
    const theirs = await callOk(bob, 'create_graph', { title: 'Theirs', metaArea: '#X' })
    env.HTML_PAGES = new PagesKVLike([
      key('mine.vegvisr.org', mine.graphId),
      key('theirs.vegvisr.org', theirs.graphId),
    ])

    const r = await callOk(alice, 'list_published_sites', {})
    assert.deepEqual(r.sites.map((s) => s.hostname), ['mine.vegvisr.org'])
    assert.equal(r.totalRegistered, 2, 'the caller is told one was withheld, not shown a short list')
    assert.ok(!JSON.stringify(r).includes('Theirs'))
  })

  test('a domain filter answers "who serves this host?"', async () => {
    pd.resetRegistryCache()
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const a = await callOk(client, 'create_graph', { title: 'A', metaArea: '#X' })
    const b = await callOk(client, 'create_graph', { title: 'B', metaArea: '#X' })
    env.HTML_PAGES = new PagesKVLike([key('a.vegvisr.org', a.graphId), key('b.example.com', b.graphId)])

    const r = await callOk(client, 'list_published_sites', { domain: 'example.com' })
    assert.deepEqual(r.sites.map((s) => s.graphId), [b.graphId])
  })

  test('search_graphs finds a graph by the hostname it serves, with no stamp on the node', async () => {
    pd.resetRegistryCache()
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    // The node carries no publishedDomain at all — only the registry knows.
    const g = await callOk(client, 'create_graph', {
      title: 'Nothing to do with the hostname',
      metaArea: '#X',
      nodes: [{ id: 'n1', label: 'page', type: 'html-node' }],
    })
    env.HTML_PAGES = new PagesKVLike([key('oppgaver.vegvisr.org', g.graphId)])

    const r = await callOk(client, 'search_graphs', { query: 'oppgaver.vegvisr.org' })
    assert.equal(r.total, 1)
    assert.equal(r.results[0].graphId, g.graphId)
    assert.deepEqual(r.results[0].publishedDomains, ['oppgaver.vegvisr.org'])
  })

  test('every listing reports where a graph is live, and says nothing when it is nowhere', async () => {
    pd.resetRegistryCache()
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const live = await callOk(client, 'create_graph', { title: 'Live', metaArea: '#X' })
    const draft = await callOk(client, 'create_graph', { title: 'Draft', metaArea: '#X' })
    env.HTML_PAGES = new PagesKVLike([key('live.vegvisr.org', live.graphId)])

    const mine = await callOk(client, 'list_my_graphs', {})
    const byId = Object.fromEntries(mine.results.map((g) => [g.graphId, g]))
    assert.deepEqual(byId[live.graphId].publishedDomains, ['live.vegvisr.org'])
    assert.deepEqual(byId[draft.graphId].publishedDomains, [])
    // The raw stamp CSV is an implementation detail of the merge and must not reach the client.
    assert.ok(!('publishedDomainsCsv' in byId[live.graphId]))
  })

  test('a stale stamp loses to the registry, all the way through the tool', async () => {
    pd.resetRegistryCache()
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const old = await callOk(client, 'create_graph', {
      title: 'Used to serve it',
      metaArea: '#X',
      nodes: [{ id: 'n1', label: 'page', type: 'html-node', publishedDomain: 'shared.vegvisr.org' }],
    })
    const now = await callOk(client, 'create_graph', { title: 'Serves it now', metaArea: '#X' })
    env.HTML_PAGES = new PagesKVLike([key('shared.vegvisr.org', now.graphId)])

    const mine = await callOk(client, 'list_my_graphs', {})
    const byId = Object.fromEntries(mine.results.map((g) => [g.graphId, g]))
    assert.deepEqual(byId[old.graphId].publishedDomains, [], 'the stamp is stale and must be dropped')
    assert.deepEqual(byId[now.graphId].publishedDomains, ['shared.vegvisr.org'])
  })

  test('it is read-only and needs only the scope every connection already has', async () => {
    pd.resetRegistryCache()
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RO)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'list_published_sites')
    assert.equal(t.annotations.readOnlyHint, true)
    const r = await callOk(client, 'list_published_sites', {})
    assert.equal(r.count, 0)
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
    const outward = tools.filter((t) => t.annotations?.openWorldHint === true).map((t) => t.name).sort()
    assert.deepEqual(outward, ['post_chat_message', 'publish_html_node', 'register_user'])
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
    assert.deepEqual(props.sort(), ['groupId', 'text'])
    // No botId either: the identity is designated by configuration, not chosen per call.
  })
})

describe('list_chat_groups is read-only but gated like posting', () => {
  test('it needs chat:write, the same scope posting needs', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const e = await callErr(client, 'list_chat_groups', {})
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(e.requiredScope, 'chat:write')
  })

  test('it is read-only, unlike the tool it pairs with', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const l = tools.find((t) => t.name === 'list_chat_groups')
    assert.equal(l.annotations.readOnlyHint, true)
    assert.equal(l.annotations.openWorldHint, false)
    assert.match(l.description, /Reading this list changes nothing/)
  })

  test('its description tells the model to use it instead of asking the user', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    assert.match(tools.find((t) => t.name === 'list_chat_groups').description, /rather than asking the user/)
  })
})

describe('read_chat_messages is gated apart from posting', () => {
  test('chat:write is not enough — reading needs chat:read', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, {
      auth: { token: 't', audience: 'a', scope: ['graph:read', 'chat:write'], clientId: 'c' },
      props: { userId: 'alice@example.com', email: 'alice@example.com', role: 'User' },
    })
    const e = await callErr(client, 'read_chat_messages', { groupId: 'g1' })
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(e.requiredScope, 'chat:read')
  })

  test('it is read-only and reaches nothing outside this system', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'read_chat_messages')
    assert.equal(t.annotations.readOnlyHint, true)
    assert.equal(t.annotations.openWorldHint, false)
    assert.match(t.description, /never their e-mail addresses/)
  })

  test('every outward-facing tool is gated behind a scope no client can request', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const outward = tools.filter((t) => t.annotations?.openWorldHint).map((t) => t.name).sort()
    assert.deepEqual(outward, ['post_chat_message', 'publish_html_node', 'register_user'])
    // The property that makes adding another one safe: no such scope is advertised, so every
    // one of them requires a person to tick a box on the consent screen.
    for (const scope of ['chat:write', 'graph:publish', 'user:register']) {
      assert.equal(CONNECT_SCOPES.includes(scope), false, `${scope} must stay unadvertised`)
      assert.equal(OPT_IN_SCOPES.includes(scope), true, `${scope} must be reachable by an opt-in`)
    }
  })
})

describe('get_fulltext_elements tells the model to read before it writes', () => {
  test('its description says to call it BEFORE writing node content', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'get_fulltext_elements')
    assert.match(t.description, /CALL THIS BEFORE/)
    assert.match(t.description, /copy the format verbatim/i)
    // The reason it matters: a wrong parameter renders as text, so nothing fails loudly.
    assert.match(t.description, /renders as literal text/)
  })

  test('it is read-only and needs only the scope every connection has', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RO)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'get_fulltext_elements')
    assert.equal(t.annotations.readOnlyHint, true)
    assert.equal(t.annotations.openWorldHint, false)
    // A read-only connection can reach it.
    const r = await client.callTool({ name: 'get_fulltext_elements', arguments: {} })
    assert.notEqual(r.structuredContent?.code, gs.ERR.INSUFFICIENT_SCOPE)
  })

  test('without graph:read it is refused like everything else', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, authFor('alice@example.com', ['graph:write']))
    assert.equal((await callErr(client, 'get_fulltext_elements', {})).code, gs.ERR.INSUFFICIENT_SCOPE)
  })
})
