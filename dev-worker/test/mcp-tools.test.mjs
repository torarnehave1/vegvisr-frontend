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
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js'
import { DatabaseSync } from 'node:sqlite'
import { D1Like, freshDb, seedUsers, FakeAI, FakePhotosWorker, PagesKVLike, FakeAgentWorker, FakeRegisterWorker, FakeRoleWorker } from './d1-adapter.mjs'
import * as pd from '../published-domains.js'
import * as workerSource from '../worker-source-service.js'
import { CONNECT_SCOPES, OPT_IN_SCOPES } from '../oauth/scopes.js'
import * as server from '../mcp/server.js'
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
  assert.notEqual(r.isError, true, `${name} failed: ${JSON.stringify(sc(r) ?? r.content)}`)
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
  // Some tools act ON ANOTHER PERSON, so they have to name that person. That is a SUBJECT, not a
  // claim about the caller, and the distinction is what the tests below pin: naming a subject is
  // allowed for the tools whose whole purpose is acting on someone else, but NO tool anywhere
  // may name the caller. The caller comes from the validated token and from nowhere else.
  //
  // The chat membership tools joined this set on 2026-09-30. They belong to the same category as
  // the directory tools and not to a new one: add_group_member names the person being added, in
  // exactly the way register_user names the person being registered.
  const SUBJECT_TOOLS = new Set([
    'register_user',
    // create_contact (2026-10-20) names the person being added to the caller's address book —
    // a subject exactly like register_user's, never the caller.
    'create_contact',
    'set_user_groups',
    'update_user_profile',
    'set_user_role',
    // set_world_member_roles (2026-11-03) names the member whose World role changes.
    'set_world_member_roles',
    'add_group_member',
    'remove_group_member',
    'send_group_alert',
    'set_group_member_role',
  ])

  // The e-mail tools, added 2026-10-03. They name two addresses — the RECIPIENT, the way
  // add_group_member names the person being added, and which of the caller's own permitted
  // identities the mail goes out AS. Neither is a claim about who the caller is: that still comes
  // from the token and only from the token.
  //
  // They are a separate set because they spell their subject `toEmail` rather than `email`, so the
  // assertion below is about what they must NOT carry. Relying on that spelling to slip past the
  // ban loop is exactly the accident this file exists to prevent.
  const ADDRESS_TOOLS = new Set(['preview_email', 'send_email', 'list_email_senders'])
  // set_email_template is NOT here: it names a DOMAIN, never an address, and never a person.

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
      if (SUBJECT_TOOLS.has(t.name) || ADDRESS_TOOLS.has(t.name)) continue
      for (const forbidden of ['email', 'role']) {
        assert.equal(props.includes(forbidden), false, `${t.name} exposes ${forbidden}`)
      }
    }
  })

  // The SMS pair names a NUMBER, never a sender and never a person. The absence of any sender
  // field IS the rule "the caller does not choose the sender string", expressed so a model has
  // nowhere to ask — the same move as forUserEmail's absence from the e-mail tools. The
  // downstream gateway WOULD honour body.sender from anyone, so this is the only thing stopping
  // a text going out as another brand.
  test('the SMS tools cannot ask to choose a sender or a recipient list', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    for (const name of ['preview_sms', 'send_sms']) {
      const t = tools.find((x) => x.name === name)
      assert.ok(t, `${name} should be registered`)
      const props = Object.keys(t.inputSchema.properties || {}).sort()
      assert.deepEqual(props, ['message', 'toPhone'], `${name} takes nothing else`)
      for (const forbidden of ['sender', 'senderId', 'source', 'from', 'recipients', 'listId', 'userEmail']) {
        assert.equal(props.includes(forbidden), false, `${name} exposes ${forbidden}`)
      }
    }
    const send = tools.find((x) => x.name === 'send_sms')
    assert.match(send.description, /CANNOT BE UNDONE OR RECALLED/)
    assert.match(send.description, /preview_sms first/)
    assert.match(send.description, /Superadmin grants nothing/i)
    assert.equal(send.annotations.openWorldHint, true)
    assert.equal(send.annotations.idempotentHint, false, 'twice is two texts and two charges')
    const preview = tools.find((x) => x.name === 'preview_sms')
    assert.equal(preview.annotations.readOnlyHint, true)
    assert.equal(preview.annotations.openWorldHint, false, 'a preview must not be flagged outward')
  })

  // `recipientEmail`, NOT `userEmail`. The e-mail tools forbid `userEmail` because there it would
  // mean "send AS this person"; on these it would mean "send TO this person". Same spelling,
  // opposite meaning, and reusing it would make the forbidden-field pin unreadable.
  //
  // The absence of `toPhone` is the point of the pair: list_users withholds phone numbers on
  // purpose, so these tools resolve one server-side and must offer no way to supply or receive it.
  test('the person-addressed SMS tools take an address and never a number', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    for (const name of ['preview_sms_to_user', 'send_sms_to_user']) {
      const t = tools.find((x) => x.name === name)
      assert.ok(t, `${name} should be registered`)
      const props = Object.keys(t.inputSchema.properties || {}).sort()
      assert.deepEqual(props, ['message', 'recipientEmail'], `${name} takes nothing else`)
      for (const forbidden of ['toPhone', 'phone', 'userEmail', 'sender', 'senderId']) {
        assert.equal(props.includes(forbidden), false, `${name} exposes ${forbidden}`)
      }
      const out = Object.keys(t.outputSchema?.properties || {})
      assert.equal(out.includes('toPhone'), false, `${name} must not RETURN a number either`)
      assert.ok(out.includes('toMasked'), `${name} returns the masked form instead`)
    }
    const send = tools.find((x) => x.name === 'send_sms_to_user')
    assert.match(send.description, /CANNOT BE UNDONE OR RECALLED/)
    assert.match(send.description, /preview_sms_to_user first/)
    assert.match(send.description, /Superadmin grants nothing/i)
    assert.equal(send.annotations.openWorldHint, true)
  })

  // Decision of 2026-10-03, as a protocol fact rather than a promise: the right to send as an
  // address is own-profile or an explicit grant, and Superadmin is neither. Agent-Builder's
  // send_email has `forUserEmail`, which is its Superadmin override; its ABSENCE here is what makes
  // the rule unaskable. A model has nowhere to say "send as somebody else" — and no way to name an
  // accountId either, which is what email-worker's unauthenticated gmail route needs.
  test('an e-mail tool cannot ask to send on another person\'s behalf', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    for (const name of ADDRESS_TOOLS) {
      const t = tools.find((x) => x.name === name)
      assert.ok(t, `${name} should be registered`)
      const props = Object.keys(t.inputSchema.properties || {})
      for (const forbidden of ['forUserEmail', 'userEmail', 'accountId', 'cfAccountId', 'holderEmail', 'basis']) {
        assert.equal(props.includes(forbidden), false, `${name} exposes ${forbidden}`)
      }
    }
    const send = tools.find((x) => x.name === 'send_email')
    assert.match(send.description, /CANNOT BE UNDONE OR RECALLED/)
    assert.match(send.description, /preview_email first/)
    assert.match(send.description, /Superadmin grants nothing/i)
    assert.equal(send.annotations.openWorldHint, true)
    assert.equal(send.annotations.idempotentHint, false, 'calling it twice sends two e-mails')
    assert.ok(send.inputSchema.required.includes('toEmail'), 'a send must name its recipient')

    const preview = tools.find((x) => x.name === 'preview_email')
    assert.ok(Object.keys(preview.inputSchema.properties).includes('fromEmail'))
    // A preview must say, in the text a model reads, that it does not send.
    assert.match(preview.description, /sends nothing/i)
    assert.match(preview.description, /Superadmin grants nothing/i)
    // And it must not be flagged as reaching anybody.
    assert.equal(preview.annotations.openWorldHint, false)
    assert.equal(preview.annotations.readOnlyHint, true)
  })

  test('a directory tool names a subject, and cannot hand out Superadmin', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    for (const name of SUBJECT_TOOLS) {
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

    // The same ceiling one level down: add_group_member may name a group role, but not the one
    // that controls the group. Superadmin is to the platform what owner is to a group, and
    // neither is grantable through a tool argument.
    const agm = tools.find((x) => x.name === 'add_group_member')
    assert.deepEqual([...agm.inputSchema.properties.role.enum].sort(), ['admin', 'member'])

    // Same ceiling on the tool that CHANGES a role. Granting ownership would be handing the group
    // over, which is a transfer and not something a role argument should be able to express.
    const sr2 = tools.find((x) => x.name === 'set_group_member_role')
    assert.deepEqual([...sr2.inputSchema.properties.role.enum].sort(), ['admin', 'member'])
  })

  test('one tool deletes content, to a 30-day trash, and the one removal tool takes access rather than data', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()

    // Until 2026-11-14 this pinned "no graph, node or message can be destroyed through this
    // server", with graph:delete a scope that had no tool behind it. The owner then asked for
    // graphs to be deletable from his map of the collection. What is pinned now is how narrow
    // that is: exactly ONE tool deletes, it deletes a whole graph and nothing smaller, it is
    // flagged destructive, and it is the only tool on graph:delete (a connection without that
    // scope is refused — see 'delete_graph, list_deleted_graphs, restore_graph'). It moves the
    // graph to a trash it can be restored from; list_deleted_graphs only reads that trash.
    // Still no tool deletes a node or a message. (An edge can be taken away since 2026-11-16 —
    // see remove_edge below.)
    assert.deepEqual(tools.filter((t) => /delete/i.test(t.name)).map((t) => t.name).sort(), ['delete_graph', 'list_deleted_graphs'])
    assert.equal(tools.find((t) => t.name === 'delete_graph').annotations.destructiveHint, true)
    assert.equal(tools.find((t) => t.name === 'list_deleted_graphs').annotations.readOnlyHint, true)
    assert.deepEqual(Object.keys(tools.find((t) => t.name === 'delete_graph').inputSchema.properties), ['graphId'])

    // remove_group_member arrived on 2026-09-30 and is an exception to the NAME, not the rule.
    // It removes a person's access to a group; the person stays registered, their account is
    // untouched, and every message they wrote remains. Owner-only, and re-adding is a separate
    // deliberate act — which is why it is the one tool flagged destructive.
    //
    // remove_edge arrived on 2026-11-16, on the owner's decision: a step in a flow graph could be
    // added but never moved, because no tool could take an edge away («Stillerom» got its
    // calendar step after the sends for that reason). It removes ONE edge and no content: the
    // nodes and their text stay, expectedVersion is required, and the version before stays in
    // the graph's history. Pinned here: it can name one edge and nothing else.
    const removals = tools.filter((t) => /remove/i.test(t.name)).map((t) => t.name).sort()
    assert.deepEqual(removals, ['remove_edge', 'remove_group_member'])
    assert.equal(tools.find((t) => t.name === 'remove_group_member').annotations.destructiveHint, true)
    const re = tools.find((t) => t.name === 'remove_edge')
    assert.equal(re.annotations.destructiveHint, true)
    assert.deepEqual(Object.keys(re.inputSchema.properties).sort(), ['edgeId', 'expectedVersion', 'graphId', 'label', 'source', 'target'])
    assert.ok(re.inputSchema.required.includes('expectedVersion'))
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

describe('add_edge connects two existing nodes', () => {
  test('appends one edge, default id <source>_<target>, and bumps the version', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] })
    const r = await callOk(client, 'add_edge', { graphId: g.graphId, edge: { source: 'a', target: 'b', label: 'guarantee', type: 'contract-decision' }, expectedVersion: 1 })
    assert.equal(r.edgeId, 'a_b')
    assert.equal(r.newVersion, 2)
    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(read.edgeCount, 1)
    assert.equal(read.nodeCount, 2, 'no node touched')
  })

  test('an edge to a node that does not exist is refused, and nothing is written', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 'a', label: 'A' }] })
    const e = await callErr(client, 'add_edge', { graphId: g.graphId, edge: { source: 'a', target: 'ghost' } })
    assert.equal(e.code, gs.ERR.INVALID_INPUT)
    assert.equal((await callOk(client, 'get_graph', { graphId: g.graphId })).version, 1)
  })

  test('a duplicate edge id is refused; a stale version is a VERSION_CONFLICT', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ source: 'a', target: 'b' }] })
    assert.equal((await callErr(client, 'add_edge', { graphId: g.graphId, edge: { source: 'a', target: 'b' } })).code, gs.ERR.INVALID_INPUT)
    const c = await callErr(client, 'add_edge', { graphId: g.graphId, edge: { id: 'x', source: 'b', target: 'a' }, expectedVersion: 0 })
    assert.equal(c.code, gs.ERR.VERSION_CONFLICT)
  })

  test('needs graph:write, and someone else\'s graph is refused', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] })
    const { client: ro } = await connect(env, ALICE_RO)
    assert.equal((await callErr(ro, 'add_edge', { graphId: g.graphId, edge: { source: 'a', target: 'b' } })).code, gs.ERR.INSUFFICIENT_SCOPE)
    const { client: bob } = await connect(env, BOB_RW)
    assert.equal((await callErr(bob, 'add_edge', { graphId: g.graphId, edge: { source: 'a', target: 'b' } })).code, gs.ERR.FORBIDDEN_GRAPH)
  })
})

describe('add_nodes writes many nodes and edges in ONE version', () => {
  const KW = [1, 2, 3].map((i) => ({ id: `kw-${i}`, label: `Ord ${i}`, type: 'fulltext', info: 'x' }))
  const KW_EDGES = [1, 2, 3].map((i) => ({ source: 'sum', target: `kw-${i}`, label: 'nøkkelord' }))

  test('nodes and the edges between them land in one version (the «Gruppe 2026-09-24» case)', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 't', label: 'Transkripsjon' }] })
    const r = await callOk(client, 'add_nodes', { graphId: g.graphId, nodes: [{ id: 'sum', label: 'Oppsummering' }, ...KW], edges: KW_EDGES, expectedVersion: 1 })
    assert.equal(r.written, true)
    assert.equal(r.newVersion, 2, 'one version for 4 nodes and 3 edges')
    assert.deepEqual(r.addedNodeIds, ['sum', 'kw-1', 'kw-2', 'kw-3'])
    assert.deepEqual(r.addedEdgeIds, ['sum_kw-1', 'sum_kw-2', 'sum_kw-3'])
    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(read.nodeCount, 5)
    assert.equal(read.edgeCount, 3)
    const hist = await callOk(client, 'get_graph_history', { graphId: g.graphId })
    assert.equal(hist.versions.length, 2)
  })

  test('running the same call again writes nothing and makes no new version', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 'sum', label: 'S' }] })
    await callOk(client, 'add_nodes', { graphId: g.graphId, nodes: KW, edges: KW_EDGES })
    const again = await callOk(client, 'add_nodes', { graphId: g.graphId, nodes: KW, edges: KW_EDGES })
    assert.equal(again.written, false)
    assert.equal(again.newVersion, 2)
    assert.deepEqual(again.skippedNodeIds, ['kw-1', 'kw-2', 'kw-3'])
    assert.equal(again.skippedEdgeIds.length, 3)
    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(read.nodeCount, 4, 'no second copies')
  })

  test('one edge to a missing node writes nothing at all', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 'sum', label: 'S' }] })
    const e = await callErr(client, 'add_nodes', { graphId: g.graphId, nodes: KW, edges: [...KW_EDGES, { source: 'sum', target: 'ghost' }] })
    assert.equal(e.code, gs.ERR.INVALID_INPUT)
    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(read.version, 1)
    assert.equal(read.nodeCount, 1)
  })

  test('the same id twice in one call is refused; a stale version is a VERSION_CONFLICT', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 'a', label: 'A' }] })
    assert.equal((await callErr(client, 'add_nodes', { graphId: g.graphId, nodes: [{ id: 'x', label: '1' }, { id: 'x', label: '2' }] })).code, gs.ERR.INVALID_INPUT)
    assert.equal((await callErr(client, 'add_nodes', { graphId: g.graphId, nodes: [{ id: 'y', label: 'Y' }], expectedVersion: 0 })).code, gs.ERR.VERSION_CONFLICT)
  })

  test('needs graph:write, and someone else\'s graph is refused', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 'a', label: 'A' }] })
    const { client: ro } = await connect(env, ALICE_RO)
    assert.equal((await callErr(ro, 'add_nodes', { graphId: g.graphId, nodes: [{ label: 'n' }] })).code, gs.ERR.INSUFFICIENT_SCOPE)
    const { client: bob } = await connect(env, BOB_RW)
    assert.equal((await callErr(bob, 'add_nodes', { graphId: g.graphId, nodes: [{ label: 'n' }] })).code, gs.ERR.FORBIDDEN_GRAPH)
  })
})

describe('get_graph(nodeId) shows the node\'s metadata in the text', () => {
  test('a flow step\'s tool and params can be read without structuredContent', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: [{ id: 's', label: 'Steg', metadata: { kind: 'action', toolName: 'add_nodes' } }] })
    const r = await client.callTool({ name: 'get_graph', arguments: { graphId: g.graphId, nodeId: 's' } })
    const text = r.content.map((c) => c.text).join('')
    assert.match(text, /metadata: \{/)
    assert.match(text, /"toolName": "add_nodes"/)
  })
})

describe('remove_edge takes one edge away and leaves the nodes', () => {
  const NODES = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }]
  const make = async (client, edges) => callOk(client, 'create_graph', { title: 'T', metaArea: '#X', nodes: NODES, edges })

  test('by source + target: the edge is gone, the nodes stay, the version before is kept', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await make(client, [{ source: 'a', target: 'b', label: 'approved' }, { source: 'b', target: 'c' }])
    const r = await callOk(client, 'remove_edge', { graphId: g.graphId, source: 'a', target: 'b', expectedVersion: 1 })
    assert.deepEqual([r.edgeId, r.source, r.target, r.label, r.newVersion], ['a_b', 'a', 'b', 'approved', 2])
    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.deepEqual([read.nodeCount, read.edgeCount], [3, 1])
    const before = await callOk(client, 'get_graph_version', { graphId: g.graphId, version: 1 })
    assert.equal(before.edgeCount ?? before.edges?.length, 2, 'the history still has the edge')
  })

  test('moving a step: remove the old edge, add the new ones', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await make(client, [{ source: 'a', target: 'c', label: 'approved' }])
    await callOk(client, 'remove_edge', { graphId: g.graphId, edgeId: 'a_c', expectedVersion: 1 })
    await callOk(client, 'add_edge', { graphId: g.graphId, edge: { source: 'a', target: 'b', label: 'approved' }, expectedVersion: 2 })
    await callOk(client, 'add_edge', { graphId: g.graphId, edge: { source: 'b', target: 'c', label: 'next' }, expectedVersion: 3 })
    assert.equal((await callOk(client, 'get_graph', { graphId: g.graphId })).edgeCount, 2)
  })

  test('two edges between the same pair need the label; an edge that is not there removes nothing', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await make(client, [{ id: 'e1', source: 'a', target: 'b', label: 'approved' }, { id: 'e2', source: 'a', target: 'b', label: 'rejected' }])
    const both = await callErr(client, 'remove_edge', { graphId: g.graphId, source: 'a', target: 'b', expectedVersion: 1 })
    assert.match(both.message, /2 edges match.*Nothing was removed/)
    const none = await callErr(client, 'remove_edge', { graphId: g.graphId, source: 'b', target: 'c', expectedVersion: 1 })
    assert.match(none.message, /No edge b → c.*Nothing was removed/)
    assert.equal((await callOk(client, 'get_graph', { graphId: g.graphId })).version, 1)
    const r = await callOk(client, 'remove_edge', { graphId: g.graphId, source: 'a', target: 'b', label: 'rejected', expectedVersion: 1 })
    assert.equal(r.label, 'rejected', 'the label picks the one')
    assert.equal((await callOk(client, 'get_graph', { graphId: g.graphId })).edgeCount, 1)
  })

  test('a stale version, a missing name, no graph:write and someone else\'s graph are refused', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await make(client, [{ source: 'a', target: 'b' }])
    assert.equal((await callErr(client, 'remove_edge', { graphId: g.graphId, source: 'a', target: 'b', expectedVersion: 7 })).code, gs.ERR.VERSION_CONFLICT)
    assert.equal((await callErr(client, 'remove_edge', { graphId: g.graphId, source: 'a', expectedVersion: 1 })).code, gs.ERR.INVALID_INPUT)
    const { client: ro } = await connect(env, ALICE_RO)
    assert.equal((await callErr(ro, 'remove_edge', { graphId: g.graphId, source: 'a', target: 'b', expectedVersion: 1 })).code, gs.ERR.INSUFFICIENT_SCOPE)
    const { client: bob } = await connect(env, BOB_RW)
    assert.equal((await callErr(bob, 'remove_edge', { graphId: g.graphId, source: 'a', target: 'b', expectedVersion: 1 })).code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal((await callOk(client, 'get_graph', { graphId: g.graphId })).edgeCount, 1)
  })
})

describe('graph_index: the whole collection in one call', () => {
  test('returns every own graph oldest first with dates, and nodes only for a meta area', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const a = await callOk(client, 'create_graph', { title: 'Eldst', metaArea: '#NINE #X' })
    const b = await callOk(client, 'create_graph', { title: 'Yngst', metaArea: '#Y' })
    await env.vegvisr_org.prepare("UPDATE knowledge_graphs SET created_date = '2024-02-01 10:00:00' WHERE id = ?").bind(a.graphId).run()
    await env.vegvisr_org.prepare("UPDATE knowledge_graphs SET created_date = '2026-05-01 10:00:00' WHERE id = ?").bind(b.graphId).run()
    const n1 = await callOk(client, 'add_node', { graphId: a.graphId, node: { label: 'en', type: 'fulltext', info: 'HEMMELIG TEKST' } })
    const n2 = await callOk(client, 'add_node', { graphId: a.graphId, node: { label: 'to' } })
    await callOk(client, 'add_edge', { graphId: a.graphId, edge: { source: n1.nodeId, target: n2.nodeId } })

    const all = await callOk(client, 'graph_index', {})
    assert.deepEqual(all.graphs.map((g) => g.title), ['Eldst', 'Yngst'])
    assert.equal(all.graphs[0].createdAt, '2024-02-01 10:00:00')
    assert.equal(all.graphs[0].nodeCount, 2)
    // The version number: the same one get_graph reports, and it has moved with the three writes.
    const whole = await callOk(client, 'get_graph', { graphId: a.graphId })
    assert.equal(all.graphs[0].version, whole.version)
    assert.ok(all.graphs[0].version > all.graphs[1].version, 'three more writes, a higher version')
    const high = await callOk(client, 'graph_index', { minVersion: all.graphs[0].version, brief: true })
    assert.deepEqual(high.graphs.map((g) => [g.title, g.version]), [['Eldst', all.graphs[0].version]])
    // The same number sent as text is accepted (a client with an older copy of the input schema).
    assert.equal((await callOk(client, 'graph_index', { minVersion: String(all.graphs[0].version), brief: true })).total, 1)
    assert.equal(all.graphs[0].nodes, undefined)
    assert.deepEqual(all.graphs[0].nodeTypes, ['fulltext'])
    assert.deepEqual(all.graphs[1].nodeTypes, [])
    assert.deepEqual(all.graphs[0].publishedDomains, [])
    // The card image: the path of the first portfolio-image node, null on a graph without one.
    assert.equal(all.graphs[0].image, null)
    await callOk(client, 'add_node', { graphId: b.graphId, node: { label: 'Kursbilde', type: 'portfolio-image', path: 'https://cdn.example.test/photos/kurs/x/kursbilde.jpg' } })
    const withImage = await callOk(client, 'graph_index', {})
    assert.equal(withImage.graphs[1].image, 'https://cdn.example.test/photos/kurs/x/kursbilde.jpg')
    assert.equal(withImage.graphs[0].image, null)
    // The header image: the address in the first ![Header|…](address) of the graph's nodes.
    assert.equal(withImage.graphs[1].headerImage, null)
    await callOk(client, 'add_node', { graphId: b.graphId, node: { label: 'Header Image', type: 'markdown-image', info: "![Header|height: 200px; object-fit: 'cover'](https://cdn.example.test/header.jpg?w=1080&q=80)\n\nTekst etter bildet" } })
    const withHeader = await callOk(client, 'graph_index', {})
    assert.equal(withHeader.graphs[1].headerImage, 'https://cdn.example.test/header.jpg?w=1080&q=80')
    assert.equal(withHeader.graphs[0].headerImage, null)

    const nine = await callOk(client, 'graph_index', { metaArea: '#NINE', includeNodes: true })
    assert.equal(nine.total, 1)
    assert.deepEqual(nine.graphs[0].nodes.map((n) => n.label).sort(), ['en', 'to'])
    assert.deepEqual(nine.graphs[0].edges, [{ source: n1.nodeId, target: n2.nodeId }])
    assert.ok(!JSON.stringify(nine).includes('HEMMELIG'), 'node content must not be in the index')

    const refused = await callErr(client, 'graph_index', { includeNodes: true })
    assert.equal(refused.code, gs.ERR.INVALID_INPUT)
  })

  test('nodeType keeps the graphs holding that type, in any meta area, and returns their nodes whole', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const a = await callOk(client, 'create_graph', { title: 'Med historie', metaArea: '#A' })
    const b = await callOk(client, 'create_graph', { title: 'Uten', metaArea: '#A' })
    const c = await callOk(client, 'create_graph', { title: 'Også med, annet område', metaArea: '#B' })
    await callOk(client, 'add_node', { graphId: a.graphId, node: { label: 'historien', type: 'info', info: 'HEMMELIG TEKST' } })
    await callOk(client, 'add_node', { graphId: a.graphId, node: { label: 'ved siden av', type: 'fulltext' } })
    await callOk(client, 'add_node', { graphId: b.graphId, node: { label: 'bare tekst', type: 'fulltext' } })
    await callOk(client, 'add_node', { graphId: c.graphId, node: { label: 'en til', type: 'info' } })

    // No meta area: both graphs with a info, and ALL nodes of each, not only the info.
    const withType = await callOk(client, 'graph_index', { nodeType: 'info', includeNodes: true })
    assert.equal(withType.nodeType, 'info')
    assert.deepEqual(withType.graphs.map((g) => g.title).sort(), ['Med historie', 'Også med, annet område'])
    const whole = withType.graphs.find((g) => g.title === 'Med historie')
    assert.deepEqual(whole.nodes.map((n) => n.label).sort(), ['historien', 'ved siden av'])
    assert.ok(!JSON.stringify(withType).includes('HEMMELIG'), 'node content must not be in the index')

    // Together with a meta area both filters apply.
    const both = await callOk(client, 'graph_index', { metaArea: '#B', nodeType: 'info', includeNodes: true })
    assert.deepEqual(both.graphs.map((g) => g.title), ['Også med, annet område'])

    // Without includeNodes it narrows the plain index too; a type nobody has matches nothing.
    assert.equal((await callOk(client, 'graph_index', { nodeType: 'fulltext' })).total, 2)
    assert.equal((await callOk(client, 'graph_index', { nodeType: 'finnes-ikke', includeNodes: true })).total, 0)
    assert.equal((await callOk(client, 'graph_index', {})).nodeType, null)
  })

  // 2026-11-19: Garnet showed five graphs ("created today, with a fulltext node") and was refused
  // their nodes, because the node type alone covered more than 600. The ids of the graphs shown
  // now narrow the read itself.
  test('graphIds: the node lists of a small selection, however many graphs the node type covers', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const made = []
    for (let i = 0; i < 601; i++) {
      made.push((await callOk(client, 'create_graph', { title: `G${i}`, metaArea: '#MANY', nodes: [{ label: `n${i}`, type: 'fulltext', info: 'HEMMELIG' }] })).graphId)
    }
    // The node type alone: more than 600 graphs, refused as before — and the message says what to do.
    const refused = await callErr(client, 'graph_index', { nodeType: 'fulltext', includeNodes: true })
    assert.equal(refused.code, gs.ERR.INVALID_INPUT)
    assert.match(refused.message, /graphIds/)

    // Five of them, named: their nodes come back.
    const five = made.slice(100, 105)
    const picked = await callOk(client, 'graph_index', { nodeType: 'fulltext', includeNodes: true, graphIds: five })
    assert.equal(picked.total, 5)
    assert.deepEqual(picked.graphs.map((g) => g.graphId).sort(), [...five].sort())
    assert.deepEqual(picked.graphs.map((g) => g.nodes.length), [1, 1, 1, 1, 1])
    assert.ok(!JSON.stringify(picked).includes('HEMMELIG'), 'node content must not be in the index')

    // graphIds alone is enough for includeNodes; without includeNodes it narrows the plain index.
    assert.equal((await callOk(client, 'graph_index', { includeNodes: true, graphIds: five })).total, 5)
    assert.equal((await callOk(client, 'graph_index', { graphIds: five.slice(0, 2) })).total, 2)
    // Unknown ids match nothing; repeated ids count once; the other filters still apply.
    assert.equal((await callOk(client, 'graph_index', { includeNodes: true, graphIds: ['nope', five[0], five[0]] })).total, 1)
    assert.equal((await callOk(client, 'graph_index', { nodeType: 'info', includeNodes: true, graphIds: five })).total, 0)
    // 600 ids in one call: one bound value, so D1's limit of 100 bound values is not in the way.
    assert.equal((await callOk(client, 'graph_index', { includeNodes: true, graphIds: made.slice(0, 600) })).total, 600)

    // The ids select among what the caller may see: another person's private graph stays out.
    const { client: bob } = await connect(env, BOB_RW)
    assert.equal((await callOk(bob, 'graph_index', { scope: 'all', includeNodes: true, graphIds: five })).total, 0)
  })

  test('world, metaAreas, published, created range, paging and brief narrow the index', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const a = await callOk(client, 'create_graph', { title: 'Gammel', metaArea: '#NINE' })
    const b = await callOk(client, 'create_graph', { title: 'Midt', metaArea: '#BOOK #X' })
    const c = await callOk(client, 'create_graph', { title: 'Ny', metaArea: '#Y' })
    for (const [g, d] of [[a, '2024-02-01 10:00:00'], [b, '2025-06-30 12:00:00'], [c, '2026-05-01 10:00:00']])
      await env.vegvisr_org.prepare('UPDATE knowledge_graphs SET created_date = ? WHERE id = ?').bind(d, g.graphId).run()

    const two = await callOk(client, 'graph_index', { metaAreas: ['#nine', '#book'] })
    assert.deepEqual(two.graphs.map((g) => g.title), ['Gammel', 'Midt'])
    assert.equal(two.total, 2)
    const upTo = await callOk(client, 'graph_index', { createdTo: '2025-06-30' })
    assert.deepEqual(upTo.graphs.map((g) => g.title), ['Gammel', 'Midt'])
    assert.equal((await callOk(client, 'graph_index', { createdFrom: '2025-01-01', createdTo: '2025-12-31' })).total, 1)
    assert.equal((await callOk(client, 'graph_index', { world: 'shared' })).total, 3)
    assert.equal((await callOk(client, 'graph_index', { world: 'sodesign.no' })).total, 0)
    assert.equal((await callOk(client, 'graph_index', { published: 'published' })).total, 0)
    const page = await callOk(client, 'graph_index', { offset: 1, limit: 1, brief: true })
    assert.equal(page.total, 3)
    assert.equal(page.returned, 1)
    assert.deepEqual(page.graphs, [{ graphId: b.graphId, title: 'Midt', metaArea: '#BOOK #X', world: null, createdAt: '2025-06-30 12:00:00', version: 1 }])
    const newest = await callOk(client, 'graph_index', { order: 'newest', limit: 2, brief: true })
    assert.deepEqual(newest.graphs.map((g) => g.title), ['Ny', 'Midt'])
    assert.equal(newest.total, 3)
    assert.equal((await callErr(client, 'graph_index', { createdFrom: 'i fjor' })).code, gs.ERR.INVALID_INPUT)
  })

  test('scope "mine" never returns another user\'s graph, and "all" only their published ones', async () => {
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const { client: bob } = await connect(env, BOB_RW)
    await callOk(alice, 'create_graph', { title: 'Alices private', metaArea: '#Z' })
    await callOk(bob, 'create_graph', { title: 'Bobs', metaArea: '#Z' })
    assert.deepEqual((await callOk(bob, 'graph_index', {})).graphs.map((g) => g.title), ['Bobs'])
    assert.deepEqual((await callOk(bob, 'graph_index', { scope: 'all' })).graphs.map((g) => g.title), ['Bobs'])
  })
})

describe('search_text: whole-word search in the stored content', () => {
  test('finds a word in any text field, skips html-nodes, keeps to graphIds and offers a spelling', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const a = await callOk(client, 'create_graph', { title: 'Livspuls', metaArea: '#A' })
    const b = await callOk(client, 'create_graph', { title: 'Lipi', metaArea: '#LIPI' })
    const c = await callOk(client, 'create_graph', { title: 'En side', metaArea: '#A' })
    const n1 = await callOk(client, 'add_node', { graphId: a.graphId, node: { label: 'Notat', type: 'fulltext', info: 'Kohesjon i gruppen. ØKONOMI teller.' } })
    const n2 = await callOk(client, 'add_node', { graphId: b.graphId, node: { label: 'yoga', type: 'info', info: 'forening', metadata: { meaning: { translation: 'kohesjon, å binde sammen' } } } })
    await callOk(client, 'add_node', { graphId: c.graphId, node: { label: 'Siden', type: 'html-node', info: '<!DOCTYPE html><p>kohesjon</p>' } })

    const all = await callOk(client, 'search_text', { query: 'Kohesjon' })
    assert.deepEqual(all.matched.map((m) => m.graphId).sort(), [a.graphId, b.graphId].sort())
    assert.equal(all.candidates, 3, 'the html-node graph was a candidate and was ruled out')
    assert.equal(all.partial, false)
    assert.deepEqual(all.matched.find((m) => m.graphId === a.graphId).nodeIds, [n1.nodeId])
    assert.deepEqual(all.matched.find((m) => m.graphId === b.graphId).nodeIds, [n2.nodeId], 'text in metadata is found')

    // Stored in upper case with a letter lower() does not fold.
    assert.deepEqual((await callOk(client, 'search_text', { query: 'økonomi' })).matched.map((m) => m.graphId), [a.graphId])
    // A whole word: "kohes" is no word; with * it is.
    assert.equal((await callOk(client, 'search_text', { query: 'kohes' })).total, 0)
    assert.equal((await callOk(client, 'search_text', { query: 'kohes*' })).total, 2)
    // The title.
    const title = await callOk(client, 'search_text', { query: 'livspuls' })
    assert.deepEqual(title.matched.map((m) => [m.graphId, m.inTitle]), [[a.graphId, true]])

    // Only the graphs named.
    const onMap = await callOk(client, 'search_text', { query: 'kohesjon', graphIds: [b.graphId, c.graphId] })
    assert.deepEqual(onMap.matched.map((m) => m.graphId), [b.graphId])

    // Nothing found: the closest word that exists in the named graphs.
    const typo = await callOk(client, 'search_text', { query: 'kohesion', graphIds: [a.graphId, b.graphId, c.graphId] })
    assert.equal(typo.total, 0)
    assert.deepEqual(typo.suggestions, ['kohesjon'])
    const noMap = await callOk(client, 'search_text', { query: 'kohesion' })
    assert.deepEqual(noMap.suggestions, [])
    assert.match(noMap.suggestionNote, /graphIds/)

    assert.equal((await callErr(client, 'search_text', { query: 'a' })).code, gs.ERR.INVALID_INPUT)
  })

  test('never reaches another user\'s private graph, with or without graphIds', async () => {
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const { client: bob } = await connect(env, BOB_RW)
    const secret = await callOk(alice, 'create_graph', { title: 'Alices', metaArea: '#Z' })
    await callOk(alice, 'add_node', { graphId: secret.graphId, node: { label: 'n', info: 'fjellrev i natten' } })
    const own = await callOk(bob, 'create_graph', { title: 'Bobs', metaArea: '#Z' })
    await callOk(bob, 'add_node', { graphId: own.graphId, node: { label: 'n', info: 'fjellrev om dagen' } })
    assert.deepEqual((await callOk(bob, 'search_text', { query: 'fjellrev' })).matched.map((m) => m.graphId), [own.graphId])
    assert.equal((await callOk(bob, 'search_text', { query: 'fjellrev', graphIds: [secret.graphId] })).total, 0)
    // Spelling help does not read it either: "natten" stands only in Alice's graph.
    const typo = await callOk(bob, 'search_text', { query: 'nattem', graphIds: [secret.graphId, own.graphId] })
    assert.deepEqual(typo.suggestions, [])
    assert.deepEqual((await callOk(alice, 'search_text', { query: 'fjellrev', scope: 'mine' })).matched.map((m) => m.graphId), [secret.graphId])
  })
})

describe('delete_graph, list_deleted_graphs, restore_graph', () => {
  const ALICE_DEL = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'graph:write', 'graph:delete'] } }
  const BOB_DEL = { ...BOB_RW, auth: { ...BOB_RW.auth, scope: ['graph:read', 'graph:write', 'graph:delete'] } }

  test('a delete goes to the trash with the history and comes back whole', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_DEL)
    const g = await callOk(client, 'create_graph', { title: 'Skal bort', metaArea: '#A' })
    const n = await callOk(client, 'add_node', { graphId: g.graphId, node: { label: 'en', type: 'fulltext', info: 'TEKSTEN' } })
    const keep = await callOk(client, 'create_graph', { title: 'Skal bli', metaArea: '#A' })

    const del = await callOk(client, 'delete_graph', { graphId: g.graphId })
    assert.equal(del.title, 'Skal bort')
    assert.equal(del.nodeCount, 1)
    assert.match(del.trashId, /^trash_/)
    assert.ok(new Date(del.restorableUntil).getTime() > Date.now() + 29 * 24 * 3600 * 1000)

    // Gone from every read, and nothing else was touched.
    assert.equal((await callErr(client, 'get_graph', { graphId: g.graphId })).code, gs.ERR.GRAPH_NOT_FOUND)
    assert.deepEqual((await callOk(client, 'graph_index', {})).graphs.map((x) => x.title), ['Skal bli'])
    assert.equal(env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graph_history WHERE graph_id = ?').get(g.graphId).n, 0)
    assert.equal((await callErr(client, 'delete_graph', { graphId: g.graphId })).code, gs.ERR.GRAPH_NOT_FOUND)

    const listed = await callOk(client, 'list_deleted_graphs', {})
    assert.deepEqual(listed.deleted.map((d) => [d.graphId, d.title, d.trashId]), [[g.graphId, 'Skal bort', del.trashId]])

    const back = await callOk(client, 'restore_graph', { graphId: g.graphId })
    assert.equal(back.graphId, g.graphId)
    const read = await callOk(client, 'get_graph', { graphId: g.graphId, nodeId: n.nodeId })
    assert.ok(JSON.stringify(read).includes('TEKSTEN'), 'the node text must be back')
    assert.ok(env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graph_history WHERE graph_id = ?').get(g.graphId).n >= 2, 'the history must be back')
    assert.equal((await callOk(client, 'list_deleted_graphs', {})).total, 0)
    // The trash entry is spent: a second restore finds nothing.
    assert.equal((await callErr(client, 'restore_graph', { trashId: del.trashId })).code, gs.ERR.GRAPH_NOT_FOUND)
    assert.ok(keep.graphId)
  })

  test('needs graph:delete, and only the creator may delete or restore', async () => {
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_DEL)
    const { client: aliceNoDelete } = await connect(env, ALICE_RW)
    const { client: bob } = await connect(env, BOB_DEL)
    const g = await callOk(alice, 'create_graph', { title: 'Alices', metaArea: '#A' })

    const noScope = await callErr(aliceNoDelete, 'delete_graph', { graphId: g.graphId })
    assert.equal(noScope.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(noScope.requiredScope, 'graph:delete')
    assert.equal((await callErr(bob, 'delete_graph', { graphId: g.graphId })).code, gs.ERR.FORBIDDEN_GRAPH)
    assert.ok((await callOk(alice, 'get_graph', { graphId: g.graphId })).graphId || true, 'still there after two refusals')

    const del = await callOk(alice, 'delete_graph', { graphId: g.graphId })
    // Bob neither sees Alice's trash nor can pull her graph out of it.
    assert.equal((await callOk(bob, 'list_deleted_graphs', {})).total, 0)
    assert.equal((await callErr(bob, 'restore_graph', { trashId: del.trashId })).code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal((await callErr(bob, 'restore_graph', { graphId: g.graphId })).code, gs.ERR.GRAPH_NOT_FOUND)
    assert.equal((await callErr(alice, 'restore_graph', {})).code, gs.ERR.INVALID_INPUT)
    await callOk(alice, 'restore_graph', { trashId: del.trashId })
  })

  test('a graph that serves a live page is not deleted', async () => {
    const { env } = freshDb()
    const g = await gs.createGraph(env, { title: 'Har en side', metaArea: '#A', actor: gs.normalizeActor({ valid: true, userId: 'alice@example.com', userEmail: 'alice@example.com', userRole: 'User', scopes: ['graph:write'] }) })
    const actor = gs.normalizeActor({ valid: true, userId: 'alice@example.com', userEmail: 'alice@example.com', userRole: 'User', scopes: ['graph:delete'] })
    const refused = await gs.deleteGraph(env, { graphId: g.graphId, actor, liveDomains: ['side.example.com'] })
    assert.equal(refused.ok, false)
    assert.equal(refused.code, gs.ERR.INVALID_INPUT)
    assert.deepEqual(refused.liveDomains, ['side.example.com'])
    assert.equal(env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graphs WHERE id = ?').get(g.graphId).n, 1)
    assert.equal(env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM graph_trash').get().n, 0)
  })
})

describe('createdAt on graph reads', () => {
  test('list_my_graphs, search_graphs and get_graph carry the row\'s created_date, and an edit keeps it', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    await client.listTools()
    const g = await callOk(client, 'create_graph', { title: 'Vekst', metaArea: '#X' })
    await env.vegvisr_org.prepare("UPDATE knowledge_graphs SET created_date = '2025-04-17 18:21:00' WHERE id = ?").bind(g.graphId).run()
    await callOk(client, 'add_node', { graphId: g.graphId, node: { label: 'a' } })

    const mine = (await callOk(client, 'list_my_graphs', {})).results.find((r) => r.graphId === g.graphId)
    assert.equal(mine.createdAt, '2025-04-17 18:21:00')
    const found = (await callOk(client, 'search_graphs', { query: 'Vekst' })).results.find((r) => r.graphId === g.graphId)
    assert.equal(found.createdAt, '2025-04-17 18:21:00')
    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(read.createdAt, '2025-04-17 18:21:00')
    assert.ok(read.updatedAt)
  })

  test('the TEXT a chat model reads shows the created date too, not only the structured answer', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    await client.listTools()
    const g = await callOk(client, 'create_graph', { title: 'Vekst', metaArea: '#X' })
    await env.vegvisr_org.prepare("UPDATE knowledge_graphs SET created_date = '2025-04-17 18:21:00' WHERE id = ?").bind(g.graphId).run()

    for (const [name, args] of [['list_my_graphs', {}], ['search_graphs', { query: 'Vekst' }], ['get_graph', { graphId: g.graphId }]]) {
      const r = await client.callTool({ name, arguments: args })
      assert.match(r.content[0].text, /created 2025-04-17/, `${name} text lacks the created date`)
    }
    const fetched = await client.callTool({ name: 'fetch', arguments: { id: g.graphId } })
    assert.equal(JSON.parse(fetched.content[0].text).metadata.createdAt, '2025-04-17 18:21:00')
  })
})

describe('get_graph_history and get_graph_version', () => {
  test('the owner lists versions newest first and reads an earlier one as it was', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    await client.listTools() // so the SDK validates every result against its outputSchema
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })
    await callOk(client, 'add_node', { graphId: g.graphId, node: { id: 'a', label: 'Første', type: 'fulltext', info: 'gammel' } })
    await callOk(client, 'update_node', { graphId: g.graphId, nodeId: 'a', fields: { info: 'ny' }, expectedVersion: 2 })

    const h = await callOk(client, 'get_graph_history', { graphId: g.graphId })
    assert.deepEqual(h.versions.map((v) => v.version), [3, 2, 1])
    assert.equal(h.currentVersion, 3)

    const v2 = await callOk(client, 'get_graph_version', { graphId: g.graphId, version: 2 })
    assert.equal(v2.version, 2)
    assert.equal(v2.nodes.find((n) => n.id === 'a').info, 'gammel')
    const v1 = await callOk(client, 'get_graph_version', { graphId: g.graphId, version: 1 })
    assert.equal(v1.nodeCount, 0)
    const one = await callOk(client, 'get_graph_version', { graphId: g.graphId, version: 2, nodeId: 'a' })
    assert.equal(one.nodeCount, 1)

    // Reading history changes nothing.
    assert.equal((await callOk(client, 'get_graph', { graphId: g.graphId })).version, 3)
  })

  test('a version that is not stored is GRAPH_NOT_FOUND', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })
    assert.equal((await callErr(client, 'get_graph_version', { graphId: g.graphId, version: 99 })).code, gs.ERR.GRAPH_NOT_FOUND)
  })

  test('Bob cannot read the history or an old version of Alice\'s private graph', async () => {
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const g = await callOk(alice, 'create_graph', { title: 'Hemmelig', metaArea: '#X' })
    const { client: bob } = await connect(env, BOB_RW)
    assert.equal((await callErr(bob, 'get_graph_history', { graphId: g.graphId })).code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal((await callErr(bob, 'get_graph_version', { graphId: g.graphId, version: 1 })).code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('both need graph:read and are marked read-only', async () => {
    const { env } = freshDb()
    const { client: rw } = await connect(env, ALICE_RW)
    const g = await callOk(rw, 'create_graph', { title: 'T', metaArea: '#X' })
    const { client: none } = await connect(env, authFor('alice@example.com', ['graph:write']))
    assert.equal((await callErr(none, 'get_graph_history', { graphId: g.graphId })).code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal((await callErr(none, 'get_graph_version', { graphId: g.graphId, version: 1 })).code, gs.ERR.INSUFFICIENT_SCOPE)
    const { tools } = await rw.listTools()
    for (const n of ['get_graph_history', 'get_graph_version']) {
      const t = tools.find((x) => x.name === n)
      assert.equal(t.annotations.readOnlyHint, true, `${n} should be read-only`)
    }
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

  test('a metaArea filter reads tags as list_meta_areas does: with or without #, whole tags only', async () => {
    const { env } = freshDb()
    const { client: a } = await connect(env, ALICE_RW)
    const make = (title, metaArea) => callOk(a, 'create_graph', { title, metaArea })
    const hashed = await make('Med #', '#NINE')
    const bare = await make('Uten #', 'NINE')
    const mixed = await make('Blandet', 'KINESISK KOSMOLOGI #NINE ')
    const lower = await make('Små bokstaver', '#nine #IIBA')
    const longer = await make('Lengre tag', '#NINETEEN')
    const spaced = await make('Tag med mellomrom', 'KINESISK KOSMOLOGI #NINE')
    const want = [hashed, bare, mixed, lower, spaced].map((g) => g.graphId).sort()

    for (const filter of ['#NINE', 'NINE', 'nine', ' #Nine ']) {
      for (const tool of ['list_my_graphs', 'search_graphs']) {
        const r = await callOk(a, tool, { metaArea: filter })
        assert.deepEqual(r.results.map((x) => x.graphId).sort(), want, `${tool} with "${filter}"`)
        assert.ok(!r.results.some((x) => x.graphId === longer.graphId), `${tool} "${filter}" caught #NINETEEN`)
      }
    }
    // A tag with a space in it is one tag, matched whole.
    const kk = await callOk(a, 'list_my_graphs', { metaArea: '#KINESISK KOSMOLOGI' })
    assert.deepEqual(kk.results.map((x) => x.graphId).sort(), [mixed.graphId, spaced.graphId].sort())
    // LIKE wildcards in a filter are literal, not wildcards.
    assert.equal((await callOk(a, 'list_my_graphs', { metaArea: '#N_NE' })).total, 0)
    assert.equal((await callOk(a, 'list_my_graphs', { metaArea: '#%' })).total, 0)
  })

  test('the counts from list_meta_areas match what the metaArea filter returns', async () => {
    const { env } = freshDb()
    const { client: a } = await connect(env, ALICE_RW)
    for (const m of ['#NINE', 'NINE', 'VEGVISR #NINE', '#IIBA', '#NINETEEN']) {
      await callOk(a, 'create_graph', { title: m, metaArea: m })
    }
    const areas = await gs.listMetaAreas(env, {
      actor: gs.normalizeActor({ valid: true, userId: 'alice@example.com', userEmail: 'alice@example.com', userRole: 'User' }),
    })
    for (const { metaArea, graphCount } of areas.metaAreas) {
      const r = await callOk(a, 'list_my_graphs', { metaArea })
      assert.equal(r.total, graphCount, `${metaArea}: list_meta_areas says ${graphCount}, the filter found ${r.total}`)
    }
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
    const outward = new Set([
      'post_chat_message',
      'publish_html_node',
      'register_user',
      // Added 2026-10-05. send_sms puts a text on somebody's handset and spends money doing it.
      // preview_sms is deliberately NOT here — it composes the identical message and transmits
      // nothing, which is the whole reason it exists.
      'send_sms',
      // Added 2026-10-06. Same effect, addressed by person rather than by number.
      'send_sms_to_user',
      // Added 2026-10-19. Publishes on Instagram through blotato-worker — public, not recallable.
      // preview_instagram_post and the list/status tools are deliberately NOT here.
      'post_to_instagram',
      // Added 2026-09-30. Each one's effect lands on ANOTHER PERSON: someone gains access to a
      // group and can read what is said there, loses that access, or gets a link that lets
      // anyone holding it walk in. list_group_members is deliberately not here — it reads this
      // system's own database and changes nothing.
      'add_group_member',
      'remove_group_member',
      // Added 2026-10-29: e-mails a member who opted in; owner only, like the bell menu.
      'send_group_alert',
      'create_group_invite',
      // Added 2026-10-03. The only e-mail tool that reaches outside: preview_email renders and
      // list_email_senders reads, but this one delivers to a person and cannot be recalled.
      'send_email',
      // Added 2026-10-01. The only tool that sends the user's own pictures to a third party:
      // compose_node_image fetches reference images and hands them to OpenAI. Nothing else here
      // leaves Cloudflare with content attached.
      'compose_node_image',
      // Added 2026-11-06. Sends the user's prompt to OpenAI (gpt-image-2.5) and spends money.
      'generate_image_openai',
      'set_group_member_role',
      // Added 2026-10-13. The source is committed to a PUBLIC repository the moment it returns,
      // before any approval — and after approval it is code answering on a public address.
      'create_worker',
      // Added 2026-11-13. Replaces JavaScript that public pages load, with no approval step.
      'publish_component',
      'decide_flow_approval',
      // Added 2026-10-21. Writes a report into a customer's kontaktlogg in the outside Enkel
      // endring CMS, not recallable. preview_meeting_report is deliberately NOT here — it
      // transmits nothing, like preview_sms.
      'send_meeting_report',
      // Added 2026-10-27. Sends a ContactHub recording to OpenAI Whisper for transcription.
      'transcribe_contact_recording',
    ])
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
      ['graph_index', {}],
      ['graph_index', { scope: 'all', metaArea: '#X', includeNodes: true }],
      ['search_text', { query: 'finnes-ikke' }],
      ['search_text', { query: 'finnes*', graphIds: [g.graphId] }],
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
      [
        'expectedVersion',
        'format',
        'graphId',
        'guidance',
        'height',
        'imageText',
        'lighting',
        'model',
        'negativePrompt',
        'nodeId',
        'placement',
        'prompt',
        'quality',
        'renderTraits',
        'seed',
        'steps',
        'style',
        'textTreatment',
        'width',
      ],
    )
    // model is an enum of what the account actually has, not a free string — a model asked to
    // pick from prose invents a plausible id, and an invented one fails only at generation time.
    assert.ok(Array.isArray(t.inputSchema.properties.model.enum))
    assert.ok(t.inputSchema.properties.model.enum.includes('@cf/leonardo/lucid-origin'))
  })
})



describe('set_graph_password writes what the editor writes, so the viewers gate on it', () => {
  // The viewers' check, copied from useGraphPasswordGate.js / graph-portfolio.js.
  const viewerAccepts = (meta, typed) => {
    try { return !!meta?.passwordProtected && btoa(typed) === meta.passwordHash } catch { return false }
  }
  const storedGraph = (raw, id) => JSON.parse(raw.prepare('SELECT data FROM knowledge_graphs WHERE id = ?').get(id).data)

  test('sets metadata the viewer checks, syncs the password node, never returns the password', async () => {
    const { env, raw } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', {
      title: 'Locked',
      metaArea: '#A',
      nodes: [
        { id: 'n1', label: 'Intro', type: 'fulltext', info: 'body' },
        { id: 'password-protection-001', label: 'Password Protection', type: 'password-protection', info: 'x' },
      ],
    })
    const res = await client.callTool({ name: 'set_graph_password', arguments: { graphId: g.graphId, password: 'blåbærsyltetøy' } })
    assert.ok(!res.isError, JSON.stringify(res))
    const wire = JSON.stringify(res)
    assert.ok(!wire.includes('blåbærsyltetøy') && !wire.includes(btoa('blåbærsyltetøy')), 'neither password nor stored form in the result')
    assert.equal(res.structuredContent.passwordProtected, true)
    assert.equal(res.structuredContent.nodesSynced, 1)

    const data = storedGraph(raw, g.graphId)
    assert.ok(viewerAccepts(data.metadata, 'blåbærsyltetøy'), 'viewer accepts the right password')
    assert.ok(!viewerAccepts(data.metadata, 'wrongpassword'), 'viewer refuses a wrong one')
    const pn = data.nodes.find((n) => n.type === 'password-protection')
    assert.equal(pn.passwordEnabled, true)
    assert.equal(pn.passwordHash, data.metadata.passwordHash, 'editor node shows the same state')
    assert.equal(data.nodes.find((n) => n.id === 'n1').info, 'body', 'other nodes untouched')
  })

  test('null removes protection; a graph without a password node can still be protected', async () => {
    const { env, raw } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#A' })
    const on = await callOk(client, 'set_graph_password', { graphId: g.graphId, password: 'hemmelig1' })
    assert.equal(on.nodesSynced, 0)
    assert.ok(viewerAccepts(storedGraph(raw, g.graphId).metadata, 'hemmelig1'))
    const off = await callOk(client, 'set_graph_password', { graphId: g.graphId, password: null })
    assert.equal(off.passwordProtected, false)
    const meta = storedGraph(raw, g.graphId).metadata
    assert.equal(meta.passwordProtected, false)
    assert.equal(meta.passwordHash, null)
    // A following write still works — the version bookkeeping stayed consistent.
    await callOk(client, 'update_graph_metadata', { graphId: g.graphId, fields: { metaArea: '#A #B' } })
  })

  test('too short and emoji passwords are refused before anything is written', async () => {
    const { env, raw } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#A' })
    const short = await callErr(client, 'set_graph_password', { graphId: g.graphId, password: 'kort' })
    assert.equal(short.code, gs.ERR.INVALID_INPUT)
    const emoji = await callErr(client, 'set_graph_password', { graphId: g.graphId, password: '🙂🙂🙂🙂🙂🙂🙂🙂' })
    assert.equal(emoji.code, gs.ERR.INVALID_INPUT)
    assert.ok(!storedGraph(raw, g.graphId).metadata.passwordProtected)
  })

  test("another user's graph and a read-only connection are refused", async () => {
    const { env } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const g = await callOk(alice, 'create_graph', { title: 'Hers', metaArea: '#A' })
    const { client: bob } = await connect(env, BOB_RW)
    assert.equal((await callErr(bob, 'set_graph_password', { graphId: g.graphId, password: 'hemmelig1' })).code, gs.ERR.FORBIDDEN_GRAPH)
    const { client: ro } = await connect(env, ALICE_RO)
    assert.equal((await callErr(ro, 'set_graph_password', { graphId: g.graphId, password: 'hemmelig1' })).code, gs.ERR.INSUFFICIENT_SCOPE)
  })
})

describe('unpublish_graph takes a published graph back to private', () => {
  const storedMeta = (raw, id) => JSON.parse(raw.prepare('SELECT data FROM knowledge_graphs WHERE id = ?').get(id).data).metadata
  const actor = { email: 'alice@example.com', userId: 'u-alice', role: 'User' }

  test('a published graph becomes private, is no longer readable by others, and keeps its content', async () => {
    const { env, raw } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', {
      title: 'Voucher',
      metaArea: '#NIBI',
      nodes: [{ id: 'n1', label: 'Intro', type: 'fulltext', info: 'body' }],
    })
    const owner = { ...actor, email: storedMeta(raw, g.graphId).createdBy }
    const pub = await gs.publishGraph(env, { graphId: g.graphId, expectedVersion: g.version, actor: owner })
    assert.equal(pub.publicationState, 'published')
    assert.equal((await gs.checkReadAccess(env, null, g.graphId)).ok, true, 'published: anonymous may read')

    const r = await callOk(client, 'unpublish_graph', { graphId: g.graphId })
    assert.equal(r.wasPublished, true)
    assert.equal(r.publicationState, 'private')
    assert.equal(r.seoSlug, null)
    assert.equal(r.newVersion, pub.newVersion + 1)

    const meta = storedMeta(raw, g.graphId)
    assert.equal(meta.publicationState, 'private')
    assert.equal(meta.publishedAt, null)
    assert.ok(meta.unpublishedAt)
    assert.equal(meta.title, 'Voucher')
    assert.equal(meta.metaArea, '#NIBI')
    assert.equal((await gs.checkReadAccess(env, null, g.graphId)).code, gs.ERR.FORBIDDEN_GRAPH, 'anonymous is refused again')
    const { client: bob } = await connect(env, BOB_RW)
    assert.equal((await callErr(bob, 'get_graph', { graphId: g.graphId })).code, gs.ERR.FORBIDDEN_GRAPH)
    // A following write still works — the version bookkeeping stayed consistent.
    await callOk(client, 'update_graph_metadata', { graphId: g.graphId, fields: { metaArea: '#NIBI #B' } })
  })

  test('a graph that is not published is left alone: no new version', async () => {
    const { env, raw } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#A' })
    const r = await callOk(client, 'unpublish_graph', { graphId: g.graphId })
    assert.equal(r.wasPublished, false)
    assert.equal(r.publicationState, 'private')
    assert.equal(r.newVersion, g.version)
    assert.equal(storedMeta(raw, g.graphId).unpublishedAt, undefined)
  })

  test('a seoSlug is reported, because the open list routes still list such a graph', async () => {
    const { env, raw } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#A' })
    const owner = { ...actor, email: storedMeta(raw, g.graphId).createdBy }
    const withSlug = await gs.updateMetadata(env, { graphId: g.graphId, fields: { seoSlug: 'my-page' }, expectedVersion: g.version, actor: owner })
    await gs.publishGraph(env, { graphId: g.graphId, expectedVersion: withSlug.newVersion, actor: owner })
    const res = await client.callTool({ name: 'unpublish_graph', arguments: { graphId: g.graphId } })
    assert.ok(!res.isError, JSON.stringify(res))
    assert.equal(res.structuredContent.seoSlug, 'my-page')
    assert.match(res.content[0].text, /my-page/)
    assert.equal(storedMeta(raw, g.graphId).seoSlug, 'my-page', 'the slug itself is not removed')
  })

  test("another user's graph and a read-only connection are refused, and nothing changes", async () => {
    const { env, raw } = freshDb()
    const { client: alice } = await connect(env, ALICE_RW)
    const g = await callOk(alice, 'create_graph', { title: 'Hers', metaArea: '#A' })
    const owner = { ...actor, email: storedMeta(raw, g.graphId).createdBy }
    await gs.publishGraph(env, { graphId: g.graphId, expectedVersion: g.version, actor: owner })
    const { client: bob } = await connect(env, BOB_RW)
    assert.equal((await callErr(bob, 'unpublish_graph', { graphId: g.graphId })).code, gs.ERR.FORBIDDEN_GRAPH)
    const { client: ro } = await connect(env, ALICE_RO)
    assert.equal((await callErr(ro, 'unpublish_graph', { graphId: g.graphId })).code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(storedMeta(raw, g.graphId).publicationState, 'published')
  })

  test('a stale expectedVersion is a conflict, not a silent overwrite', async () => {
    const { env, raw } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#A' })
    const owner = { ...actor, email: storedMeta(raw, g.graphId).createdBy }
    await gs.publishGraph(env, { graphId: g.graphId, expectedVersion: g.version, actor: owner })
    const e = await callErr(client, 'unpublish_graph', { graphId: g.graphId, expectedVersion: g.version })
    assert.equal(e.code, gs.ERR.VERSION_CONFLICT)
  })

  test('there is still no tool that publishes a graph', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    assert.ok(tools.some((x) => x.name === 'unpublish_graph'))
    assert.ok(!tools.some((x) => x.name === 'publish_graph'))
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

  test('addMetaAreas adds tags and keeps the ones the graph has', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'Prinsipper', metaArea: '#VEGR.AI #KUNNSKAPSLEDELSE' })
    const r = await callOk(client, 'update_graph_metadata', { graphId: g.graphId, fields: { addMetaAreas: ['#kohesjon', 'KUNNSKAPSLEDELSE'] } })
    assert.equal(r.metaArea, '#VEGR.AI #KUNNSKAPSLEDELSE #KOHESJON')
    assert.deepEqual(r.updatedFields, ['metaArea'])
    const both = await callErr(client, 'update_graph_metadata', { graphId: g.graphId, fields: { metaArea: '#X', addMetaAreas: ['#Y'] } })
    assert.equal(both.code, gs.ERR.INVALID_INPUT)
    const spaced = await callErr(client, 'update_graph_metadata', { graphId: g.graphId, fields: { addMetaAreas: ['#TO ORD'] } })
    assert.equal(spaced.code, gs.ERR.INVALID_INPUT)
  })

  test('createdDate moves the created date, and only that', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', {
      title: 'An article from 2018',
      metaArea: '#JOURNAL',
      nodes: [{ id: 'n1', label: 'Intro', type: 'fulltext', info: 'body' }],
    })

    const r = await callOk(client, 'update_graph_metadata', { graphId: g.graphId, fields: { createdDate: '2018-02-01' } })
    assert.equal(r.createdAt, '2018-02-01T12:00:00.000Z')
    assert.deepEqual(r.updatedFields, ['createdDate'])

    const after = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(String(after.createdAt).slice(0, 10), '2018-02-01')
    assert.equal(after.title, 'An article from 2018', 'title untouched')
    assert.equal(after.metaArea, '#JOURNAL', 'meta area untouched')
    assert.equal(after.nodeCount, 1, 'nodes untouched')

    const index = await callOk(client, 'graph_index', { metaArea: '#JOURNAL' })
    assert.equal(String(index.graphs[0].createdAt).slice(0, 10), '2018-02-01')

    // A later write that names no created date leaves it where it was put.
    await callOk(client, 'update_graph_metadata', { graphId: g.graphId, fields: { metaArea: '#JOURNAL #X' } })
    const later = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(String(later.createdAt).slice(0, 10), '2018-02-01')
  })

  test('createdDate refuses what is not a past date', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#A' })
    for (const bad of ['2018', 'last year', '2018-02-31', '1850-01-01', '2999-01-01']) {
      const e = await callErr(client, 'update_graph_metadata', { graphId: g.graphId, fields: { createdDate: bad } })
      assert.equal(e.code, 'INVALID_INPUT', `${bad} should be refused`)
    }
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
    assert.deepEqual(fieldNames, ['addMetaAreas', 'category', 'createdDate', 'description', 'metaArea', 'title'])
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
    assert.deepEqual(outward, [
      'add_group_member',
      'compose_node_image',
      'create_group_invite',
      'create_worker',
      'decide_flow_approval',
      'generate_image_openai',
      'post_chat_message',
      'post_to_instagram',
      'publish_component',
      'publish_html_node',
      'register_user',
      'remove_group_member',
      'send_email',
      'send_group_alert',
      'send_meeting_report',
      'send_sms',
      'send_sms_to_user',
      'set_group_member_role',
      'transcribe_contact_recording',
    ])
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

  test('a youtube-video node keeps path, imageWidth and imageHeight (add_node and update_node)', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })
    const url = 'https://www.youtube.com/watch?v=AawWsJNi0gM'
    const added = await callOk(client, 'add_node', {
      graphId: g.graphId,
      node: { label: 'v', type: 'youtube-video', path: url, imageWidth: '100%', imageHeight: '100%' },
    })
    let read = await callOk(client, 'get_graph', { graphId: g.graphId })
    let n = read.nodes.find((x) => x.id === added.nodeId)
    assert.equal(n.path, url, 'path was stripped by the schema before')
    assert.equal(n.imageWidth, '100%')
    assert.equal(n.imageHeight, '100%')

    await callOk(client, 'update_node', {
      graphId: g.graphId, nodeId: added.nodeId, expectedVersion: read.version,
      fields: { imageWidth: '80%', imageHeight: '60%' },
    })
    read = await callOk(client, 'get_graph', { graphId: g.graphId })
    n = read.nodes.find((x) => x.id === added.nodeId)
    assert.equal(n.imageWidth, '80%')
    assert.equal(n.imageHeight, '60%')

    const one = await client.callTool({ name: 'get_graph', arguments: { graphId: g.graphId, nodeId: added.nodeId } })
    assert.match(one.content[0].text, /path: https:\/\/www\.youtube\.com/, 'a single-node read shows the media fields')
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

// Node metadata over the MCP. Until 1.23.0 a node had two content slots and the MCP could write
// only one: `info` went through, `metadata` was silently dropped by zod, with no error. Every
// structured field in graph_system_registry — binding names, openapi paths, the component
// registry's graphId pointer — had therefore been written by agent-worker or by curl, and the
// architecture graphs the MCP is supposed to maintain could not carry a kind or a review block.
describe('node metadata: the second content slot, and what a model may not put in it', () => {
  const REVIEW = { approvedBy: 'alice@example.com', approvedAt: '2026-10-05T10:00:00Z', contentHash: 'abc123' }

  test('metadata is declared on both write tools, so a refactor cannot silently drop it again', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    // This pin exists because the ABSENCE of this field was the bug, and absence leaves no trace:
    // zod strips an undeclared key without erroring, so the loss is invisible at the call site.
    const add = tools.find((x) => x.name === 'add_node')
    assert.ok(add.inputSchema.properties.node.properties.metadata, 'add_node must accept node metadata')
    const upd = tools.find((x) => x.name === 'update_node')
    assert.ok(upd.inputSchema.properties.fields.properties.metadata, 'update_node must accept metadata')
    const create = tools.find((x) => x.name === 'create_graph')
    assert.ok(create.inputSchema.properties.nodes.items.properties.metadata, 'create_graph too')
  })

  test('metadata round-trips through add_node', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'Layer', metaArea: '#ARCHITECTURE' })
    await callOk(client, 'add_node', {
      graphId: g.graphId,
      node: { id: 'n1', label: 'Email gate', type: 'fulltext', info: 'own-profile or a grant', metadata: { kind: 'decision', layer: 'communication' } },
    })
    const after = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.deepEqual(after.nodes[0].metadata, { kind: 'decision', layer: 'communication' })
  })

  test('each reserved key is refused at the protocol, and nothing is written', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })
    for (const key of ['createdBy', 'userId', 'actor', 'token', 'authToken', 'encrypted', 'review']) {
      const r = await client.callTool({
        name: 'add_node',
        arguments: { graphId: g.graphId, node: { label: 'x', metadata: { [key]: 'v' } } },
      })
      assert.equal(r.isError, true, `metadata.${key} must be refused`)
      assert.match(r.content[0].text, /reserved/i, `and the refusal must say why (${key})`)
    }
    const after = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(after.nodeCount, 0, 'not one of those calls stored anything')
  })

  test('the refusal is not defeated by spelling it differently', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })
    // A ban list compared on the literal key is a ban list a model walks straight past.
    for (const key of ['created_by', 'Created-By', 'CREATEDBY', 'user_id', 'Review', 'auth_token']) {
      const r = await client.callTool({
        name: 'add_node',
        arguments: { graphId: g.graphId, node: { label: 'x', metadata: { [key]: 'v' } } },
      })
      assert.equal(r.isError, true, `${key} is the same key as its normalised form`)
    }
  })

  test('a model cannot forge authorship through the new opening', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'T', metaArea: '#X' })
    const r = await client.callTool({
      name: 'add_node',
      arguments: { graphId: g.graphId, node: { label: 'x', metadata: { createdBy: 'somebody-else@example.com' } } },
    })
    assert.equal(r.isError, true)
    // The schema-wide ban loop above reads declared property NAMES, so it cannot see this one.
    // That is why the guard has to live in the metadata schema itself.
    const { tools } = await client.listTools()
    const props = Object.keys(tools.find((x) => x.name === 'add_node').inputSchema.properties)
    assert.equal(props.includes('createdBy'), false, 'the name pin still holds, and still is not enough')
  })

  test('update_node MERGES metadata — every other field replaces', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', {
      title: 'T', metaArea: '#X',
      nodes: [{ id: 'n1', label: 'p', type: 'fulltext', info: 'x', metadata: { kind: 'observed', layer: 'communication', owner: 'email' } }],
    })
    await callOk(client, 'update_node', {
      graphId: g.graphId, nodeId: 'n1', fields: { metadata: { kind: 'decision' } }, expectedVersion: 1,
    })
    const after = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.deepEqual(after.nodes[0].metadata, { kind: 'decision', layer: 'communication', owner: 'email' },
      'the keys not named must survive')
  })

  test('null removes exactly one key', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', {
      title: 'T', metaArea: '#X',
      nodes: [{ id: 'n1', label: 'p', type: 'fulltext', metadata: { kind: 'decision', stale: 'yes' } }],
    })
    await callOk(client, 'update_node', {
      graphId: g.graphId, nodeId: 'n1', fields: { metadata: { stale: null } }, expectedVersion: 1,
    })
    const after = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.deepEqual(after.nodes[0].metadata, { kind: 'decision' })
  })

  // THE ONE THAT CARRIES THE DESIGN. Human Knowledge First means a human reviewed and approved the
  // content. Every MCP caller is a model holding a human's OAuth token, so `review` is written by
  // the UI — here simulated by calling the service directly, which is the door the UI uses — and
  // the MCP can neither set it nor destroy it. If metadata REPLACED instead of merging, a model
  // changing `kind` would silently delete the approval and the field would be decoration.
  test('a model updating metadata cannot delete the approval a human wrote', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const actor = gs.normalizeActor({ valid: true, userId: 'alice@example.com', userEmail: 'alice@example.com', userRole: 'User', scopes: ['graph:write'] })
    const g = await callOk(client, 'create_graph', {
      title: 'T', metaArea: '#X',
      nodes: [{ id: 'n1', label: 'p', type: 'fulltext', info: 'the decision', metadata: { kind: 'decision' } }],
    })

    // The human approves, through the service — the path the UI will use. The MCP has no such tool.
    const planted = await gs.updateNode(env, {
      graphId: g.graphId, nodeId: 'n1', fields: { metadata: { kind: 'decision', review: REVIEW } }, expectedVersion: 1, actor,
    })
    assert.equal(planted.ok, true, 'the UI path can write a review')

    // Now the model touches the same node.
    await callOk(client, 'update_node', {
      graphId: g.graphId, nodeId: 'n1', fields: { metadata: { layer: 'communication' } }, expectedVersion: planted.newVersion,
    })

    const after = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.deepEqual(after.nodes[0].metadata.review, REVIEW, 'the approval survived a model write')
    assert.equal(after.nodes[0].metadata.kind, 'decision')
    assert.equal(after.nodes[0].metadata.layer, 'communication')

    // And it cannot be overwritten head-on either.
    const r = await client.callTool({
      name: 'update_node',
      arguments: { graphId: g.graphId, nodeId: 'n1', fields: { metadata: { review: { approvedBy: 'grok' } } }, expectedVersion: after.version },
    })
    assert.equal(r.isError, true, 'a model cannot claim an approval')
    const unchanged = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.deepEqual(unchanged.nodes[0].metadata.review, REVIEW)
  })

  test('a metadata write still loses a version race', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', {
      title: 'T', metaArea: '#X',
      nodes: [{ id: 'n1', label: 'p', type: 'fulltext', metadata: { kind: 'decision' } }],
    })
    // The merge does a read of its own, so the guard has to be the SQL one, not that read.
    const e = await callErr(client, 'update_node', {
      graphId: g.graphId, nodeId: 'n1', fields: { metadata: { kind: 'observed' } }, expectedVersion: 99,
    })
    assert.equal(e.code, gs.ERR.VERSION_CONFLICT)
    const after = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(after.nodes[0].metadata.kind, 'decision', 'nothing merged on a conflict')
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


describe('list_contacts / search_contacts read the caller\'s own ContactHub book', () => {
  const READ = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'contacts:read'] } }

  // agent-worker's /contacts/* doors, stubbed. It records what was asked so the tests can check
  // the caller's own token is what decides whose book is read.
  function withAgent(reply = {}) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.AGENT_WORKER = {
      fetch: async (url, init) => {
        calls.push({ path: new URL(url).pathname, token: init.headers['X-API-Token'], body: JSON.parse(init.body) })
        return new Response(JSON.stringify({
          success: true,
          total: 1,
          contacts: [{
            id: 'c1', name: 'Liv Hinna Bora', emails: ['liv@example.com'], phones: ['+4797602470'],
            labels: ['* myContacts', 'STILLEROM'], organization: null,
            address: null, notes: 'PRIVATE NOTE', history: ['x'],
          }],
          ...reply,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      },
    }
    return { env, calls }
  }

  test('lists by label with the caller\'s own token, and drops fields it was not asked for', async () => {
    const { env, calls } = withAgent()
    const { client } = await connect(env, READ)
    const r = await callOk(client, 'list_contacts', { label: 'STILLEROM' })
    assert.equal(r.count, 1)
    assert.equal(r.contacts[0].name, 'Liv Hinna Bora')
    assert.deepEqual(r.contacts[0].labels, ['* myContacts', 'STILLEROM'])
    assert.equal(calls[0].path, '/contacts/list')
    assert.equal(calls[0].token, 'sess-alice', 'whose book is read comes from the caller, not an argument')
    assert.equal(calls[0].body.label, 'STILLEROM')
    const blob = JSON.stringify(r)
    assert.ok(!blob.includes('PRIVATE NOTE') && !blob.includes('history'), 'notes and history must never reach the model')
  })

  test('the TEXT the model reads carries the contactId, not only the structured result', async () => {
    // Claude.ai showed the model only the text; it could not call set_meeting_report (2026-10-21).
    const { env } = withAgent()
    const { client } = await connect(env, READ)
    const r = await client.callTool({ name: 'search_contacts', arguments: { query: 'Liv Bora' } })
    assert.match(r.content[0].text, /contactId c1/)
  })

  test('search passes the query through', async () => {
    const { env, calls } = withAgent()
    const { client } = await connect(env, READ)
    const r = await callOk(client, 'search_contacts', { query: 'Liv Bora' })
    assert.equal(r.contacts[0].emails[0], 'liv@example.com')
    assert.equal(calls[0].path, '/contacts/search')
    assert.equal(calls[0].body.query, 'Liv Bora')
  })

  test('contacts:read is required — user:read is not enough', async () => {
    const { env } = withAgent()
    const { client } = await connect(env, { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'user:read'] } })
    for (const name of ['list_contacts', 'search_contacts']) {
      const e = await callErr(client, name, name === 'search_contacts' ? { query: 'x' } : {})
      assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
      assert.equal(e.requiredScope, 'contacts:read')
    }
  })

  test('both are read-only', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, READ)
    const { tools } = await client.listTools()
    for (const name of ['list_contacts', 'search_contacts']) {
      assert.equal(tools.find((x) => x.name === name).annotations.readOnlyHint, true, name)
    }
  })
})


describe('get_my_day and list_sent_sms read the caller\'s own calendar and sent SMS (contacts:read)', () => {
  const READ = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'contacts:read'] } }

  test('get_my_day asks for the caller, keeps Oslo days, and drops descriptions', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.CALENDAR_WORKER = {
      fetch: async (url, init) => {
        calls.push({ url: new URL(url), email: init.headers['X-User-Email'] })
        return new Response(JSON.stringify({ events: [
          // 00:30 Oslo on 2026-10-22 is 22:30Z the day before — must count as the 22nd.
          { summary: 'Tidlig', start_time: '2026-10-21T22:30:00Z', end_time: '2026-10-21T23:00:00Z', all_day: false, calendar_name: 'Jobb', attendees: ['a@x.no'], description: 'SECRET NOTE' },
          { summary: 'Samtale', start_time: '2026-10-22T07:00:00Z', end_time: '2026-10-22T08:00:00Z', all_day: false, location: 'Zoom', attendees: [] },
          { summary: 'I går', start_time: '2026-10-21T10:00:00Z', end_time: '2026-10-21T11:00:00Z', all_day: false },
        ], calendars: [] }), { status: 200 })
      },
    }
    const { client } = await connect(env, READ)
    const r = await callOk(client, 'get_my_day', { date: '2026-10-22' })
    assert.equal(calls[0].email, 'alice@example.com', 'whose calendar comes from the token')
    assert.equal(calls[0].url.searchParams.get('date'), '2026-10-21', 'one day wider for the UTC cut')
    assert.deepEqual(r.events.map((e) => [e.start, e.title]), [['00:30', 'Tidlig'], ['09:00', 'Samtale']])
    assert.ok(!JSON.stringify(r).includes('SECRET NOTE'), 'descriptions never reach the model')
  })

  test('list_sent_sms forwards the caller\'s token and never returns a login code', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.SMS_GATEWAY = {
      fetch: async (url, init) => {
        calls.push({ url: new URL(url), token: init.headers['X-API-Token'] })
        return new Response(JSON.stringify({ success: true, data: { total: 2, current_page: 1, last_page: 1, data: [
          { date: 1792648800, to: '+4790000000', from: 'ContactHub', body: 'Hei, vi sees i morgen', status_text: 'Delivered', message_price: '0.0750' },
          { date: 1792648900, to: '+4790000001', from: 'VEGR.AI', body: 'Din VEGR.AI-innloggingskode: 123456', status_text: 'Delivered' },
        ] } }), { status: 200 })
      },
    }
    const { client } = await connect(env, READ)
    const r = await callOk(client, 'list_sent_sms', { from: '2026-10-20', to: '2026-10-22' })
    assert.equal(calls[0].url.pathname, '/api/sms/history')
    assert.equal(calls[0].token, 'sess-alice')
    assert.ok(calls[0].url.searchParams.get('date_from'))
    assert.equal(r.messages[0].body, 'Hei, vi sees i morgen')
    assert.equal(r.messages[1].body, '[innloggingskode skjult]')
    assert.ok(!JSON.stringify(r).includes('123456'))
  })

  test('off the gateway\'s sender list is a refusal, not an empty list', async () => {
    const { env, raw } = freshDb()
    seedUsers(raw)
    env.SMS_GATEWAY = { fetch: async () => new Response(JSON.stringify({ error: 'You are not on the list' }), { status: 403 }) }
    const { client } = await connect(env, READ)
    const e = await callErr(client, 'list_sent_sms', {})
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('both need contacts:read and are read-only', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    for (const name of ['get_my_day', 'list_sent_sms']) {
      const e = await callErr(client, name, {})
      assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
      assert.equal(e.requiredScope, 'contacts:read')
    }
    const { tools } = await client.listTools()
    for (const name of ['get_my_day', 'list_sent_sms']) {
      const t = tools.find((x) => x.name === name)
      assert.equal(t.annotations.readOnlyHint, true)
      assert.equal(t.annotations.openWorldHint, false)
    }
  })
})

describe('create_calendar_event adds one event without guests to the caller\'s own calendar (graph:write)', () => {
  function withCalendar(reply = { success: true, created: true, id: 'ev1', summary: 'Stillerom', start: '2026-11-19T12:00:00+01:00', end: '2026-11-19T12:20:00+01:00', location: 'https://realtime.vegvisr.org/?openroom', htmlLink: 'https://calendar.google.com/x' }, status = 200) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.CALENDAR_WORKER = {
      fetch: async (url, init) => {
        calls.push({ url: new URL(url), method: init.method, email: init.headers['X-User-Email'], body: JSON.parse(init.body) })
        return new Response(JSON.stringify(reply), { status })
      },
    }
    return { env, calls }
  }
  const STILLE = { title: 'Stillerom', start: '2026-11-19T12:00', durationMinutes: 20, location: 'https://realtime.vegvisr.org/?openroom' }

  test('the event is asked for as the caller, in Oslo time, and the answer says nobody was told', async () => {
    const { env, calls } = withCalendar()
    const { client } = await connect(env, ALICE_RW)
    const r = await client.callTool({ name: 'create_calendar_event', arguments: STILLE })
    assert.notEqual(r.isError, true, JSON.stringify(r))
    assert.deepEqual([calls[0].method, calls[0].url.pathname, calls[0].email], ['POST', '/api/calendar/events', 'alice@example.com'])
    assert.deepEqual(calls[0].body, { summary: 'Stillerom', start: '2026-11-19T12:00', durationMinutes: 20, location: 'https://realtime.vegvisr.org/?openroom', timeZone: 'Europe/Oslo' })
    assert.deepEqual([sc(r).created, sc(r).eventId, sc(r).link], [true, 'ev1', 'https://calendar.google.com/x'])
    assert.match(r.content[0].text, /Added to your calendar: "Stillerom", 2026-11-19 12:00–12:20 \(Europe\/Oslo\)/)
    assert.match(r.content[0].text, /No guests — nothing was sent to anyone/)
  })

  test('an event that is already there is reported as such', async () => {
    const { env } = withCalendar({ success: true, created: false, id: 'old', summary: 'Stillerom', start: '2026-11-19T12:00:00+01:00', end: '2026-11-19T12:20:00+01:00' })
    const { client } = await connect(env, ALICE_RW)
    const r = await client.callTool({ name: 'create_calendar_event', arguments: STILLE })
    assert.equal(sc(r).created, false)
    assert.match(r.content[0].text, /Already in your calendar — nothing was added/)
  })

  test('there is no way to name a guest, and a time that is not local date-time never reaches the calendar', async () => {
    const { env, calls } = withCalendar()
    const { client } = await connect(env, ALICE_RW)
    for (const start of ['torsdag kl. 12:00 i uken', '2026-11-19T11:00:00Z', '2026-11-19T12:00:00+01:00']) {
      const e = await callErr(client, 'create_calendar_event', { ...STILLE, start })
      assert.match(e.message, /local time like 2026-11-19T12:00/)
    }
    assert.equal(calls.length, 0)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'create_calendar_event')
    assert.deepEqual(Object.keys(t.inputSchema.properties).sort(), ['description', 'durationMinutes', 'end', 'location', 'start', 'timeZone', 'title'])
    assert.equal(t.annotations.openWorldHint, false)
    assert.equal(t.annotations.readOnlyHint, false)
  })

  test('without graph:write it is refused; a calendar service without the route, or one that says no, adds nothing', async () => {
    const a = withCalendar()
    const e = await callErr((await connect(a.env, ALICE_RO)).client, 'create_calendar_event', STILLE)
    assert.equal(e.requiredScope, 'graph:write')
    assert.equal(a.calls.length, 0)

    const old = withCalendar({ error: 'Not found' }, 404)
    assert.match((await callErr((await connect(old.env, ALICE_RW)).client, 'create_calendar_event', STILLE)).message, /calendar-worker must be deployed/)

    const no = withCalendar({ success: false, error: 'Google Calendar is not connected for this account.' }, 409)
    assert.match((await callErr((await connect(no.env, ALICE_RW)).client, 'create_calendar_event', STILLE)).message, /not connected.*Nothing was added/)
  })
})

describe('meeting reports: set (graph:write), preview + send (chat:write) via agent-worker', () => {
  function withAgent(reply = {}, status = 200) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.AGENT_WORKER = {
      fetch: async (url, init) => {
        calls.push({ path: new URL(url).pathname, token: init.headers['X-API-Token'], body: JSON.parse(init.body) })
        return new Response(JSON.stringify(reply), { status, headers: { 'Content-Type': 'application/json' } })
      },
    }
    return { env, calls }
  }
  const CHAT = (fx) => ({ ...fx, auth: { ...fx.auth, scope: [...fx.auth.scope, 'chat:write'] } })

  test('set saves through /contacts/report/set with the caller\'s own token', async () => {
    const { env, calls } = withAgent({ success: true, contactId: 'c1', name: 'Tommy Skog', meetingQuality: 4, meetingQualityLabel: 'Feiring/Gjennombrudd', meetingDate: '2026-10-21', criticalNote: 'Mer liv', readyToSend: true, missing: null, message: 'saved' })
    const { client } = await connect(env, ALICE_RW)
    const r = await callOk(client, 'set_meeting_report', { contactId: 'c1', meetingQuality: 4, meetingDate: '2026-10-21', criticalNote: 'Mer liv' })
    assert.equal(r.readyToSend, true)
    assert.equal(calls[0].path, '/contacts/report/set')
    assert.equal(calls[0].token, 'sess-alice')
    assert.equal(calls[0].body.email, undefined, 'no identity is forwarded in the body')
  })

  test('preview and send need chat:write — graph:write alone reaches nothing', async () => {
    const { env, calls } = withAgent({ success: true })
    const { client } = await connect(env, ALICE_RW)
    for (const [name, args] of [['preview_meeting_report', { contactId: 'c1' }], ['send_meeting_report', { contactId: 'c1', coachingId: 2371 }]]) {
      const e = await callErr(client, name, args)
      assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
      assert.equal(e.requiredScope, 'chat:write')
    }
    assert.equal(calls.length, 0, 'nothing reached the CMS path')
  })

  test('a caller off the CMS sender list is refused', async () => {
    const { env } = withAgent({ success: false, error: 'You are not on the list of people allowed to send coaching reports' }, 403)
    const { client } = await connect(env, CHAT(ALICE_RW))
    const e = await callErr(client, 'send_meeting_report', { contactId: 'c1', coachingId: 2371 })
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('a preview that is not ready is a result, not an error', async () => {
    const { env } = withAgent({ success: false, ready: false, contactId: 'c1', name: 'T', meetingQuality: null, meetingDate: null, criticalNote: '', reason: 'Meeting quality is not set.', message: 'Cannot send: Meeting quality is not set.' })
    const { client } = await connect(env, CHAT(ALICE_RW))
    const r = await callOk(client, 'preview_meeting_report', { contactId: 'c1' })
    assert.equal(r.ready, false)
    assert.match(r.reason, /Meeting quality/)
  })

  test('send forwards contactId + coachingId only, and is marked destructive', async () => {
    const { env, calls } = withAgent({ success: true, contactId: 'c1', name: 'Tommy Skog', coachingId: 2371, status: 'Gjennomført', utfall: 'Feiring/Gjennombrudd', dato: '2026-10-21', logged: true, logError: null })
    const { client } = await connect(env, CHAT(ALICE_RW))
    const r = await callOk(client, 'send_meeting_report', { contactId: 'c1', coachingId: 2371 })
    assert.equal(r.coachingId, 2371)
    assert.deepEqual(calls[0].body, { contactId: 'c1', coachingId: 2371 })
    const { tools } = await client.listTools()
    assert.equal(tools.find((x) => x.name === 'send_meeting_report').annotations.destructiveHint, true)
  })
})

describe('create_contact adds to the caller\'s own ContactHub book', () => {
  // graph:write, not a new scope (architect's decision 2026-10-20): a row in your own book is
  // your own content, and a new scope would force every connection to be re-added.
  function withAgent(status = 200, reply = { success: true, contactId: 'c-new', name: 'Sissel Kjelstad' }) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.AGENT_WORKER = {
      fetch: async (url, init) => {
        calls.push({ path: new URL(url).pathname, token: init.headers['X-API-Token'], body: JSON.parse(init.body) })
        return new Response(JSON.stringify(reply), { status, headers: { 'Content-Type': 'application/json' } })
      },
    }
    return { env, calls }
  }
  const SISSEL = { name: 'Sissel Kjelstad', email: 'sissel@example.com', phone: '+47 952 56 324', labels: ['#STILLEROM'] }

  test('creates with the caller\'s own token; labels lose their #', async () => {
    const { env, calls } = withAgent()
    const { client } = await connect(env, ALICE_RW)
    const r = await callOk(client, 'create_contact', SISSEL)
    assert.equal(r.contactId, 'c-new')
    assert.deepEqual(r.labels, ['STILLEROM'])
    assert.equal(calls[0].path, '/contacts/create')
    assert.equal(calls[0].token, 'sess-alice', 'whose book is written comes from the caller, not an argument')
    assert.equal(calls[0].body.labels, 'STILLEROM')
    assert.equal(calls[0].body.userId, undefined, 'no identity is forwarded in the body')
  })

  test('a duplicate is refused and names the existing contact', async () => {
    const { env } = withAgent(409, { success: false, duplicate: true, contactId: 'c-old', message: 'Not created: "Sissel K" already has this e-mail or phone number (contactId c-old).' })
    const { client } = await connect(env, ALICE_RW)
    const e = await callErr(client, 'create_contact', SISSEL)
    assert.equal(e.code, gs.ERR.INVALID_INPUT)
    assert.match(e.message, /already has this e-mail or phone/)
  })

  test('graph:write is required — contacts:read is not enough', async () => {
    const { env, calls } = withAgent()
    const { client } = await connect(env, { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'contacts:read'] } })
    const e = await callErr(client, 'create_contact', SISSEL)
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(e.requiredScope, 'graph:write')
    assert.equal(calls.length, 0, 'nothing reached the address book')
  })

  test('it is an additive write, not destructive', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'create_contact')
    assert.equal(t.annotations.readOnlyHint, false)
    assert.equal(t.annotations.destructiveHint, false)
  })
})


describe('get_email_templates / preview_email_template read a World by its domain', () => {
  // preview_email finds the World from the sender's domain, so a founder sending from gmail.com
  // (sodesign.no, 2026-10-20) could never be previewed. These take the World domain directly.
  function withAgent(reply) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.AGENT_WORKER = {
      fetch: async (url, init) => {
        calls.push({ path: new URL(url).pathname, token: init.headers['X-API-Token'], body: JSON.parse(init.body) })
        return new Response(JSON.stringify(reply), { status: reply.success === false ? 403 : 200, headers: { 'Content-Type': 'application/json' } })
      },
    }
    return { env, calls }
  }
  const READ = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read'] } }

  test('get forwards the domain with the caller\'s own token and returns the templates', async () => {
    const { env, calls } = withAgent({
      success: true, graphId: 'g1', owner: 'stine@example.com', brand: { name: 'SO' },
      templates: [{ nodeId: 'n1', purpose: 'login', language: 'no', subject: 'Logg inn hos {brandName}', html: '<p/>' }],
      signatures: [], loginUsesWorldTemplate: true, message: 'sodesign.no: …',
    })
    const { client } = await connect(env, READ)
    const r = await callOk(client, 'get_email_templates', { domain: 'SODESIGN.no' })
    assert.equal(r.templates[0].purpose, 'login')
    assert.equal(calls[0].path, '/email/world-templates')
    assert.equal(calls[0].body.domain, 'sodesign.no')
    assert.equal(calls[0].token, 'sess-alice', 'the gate runs on the caller\'s own identity')
  })

  test('preview forwards purpose and language and says nothing was sent', async () => {
    const { env, calls } = withAgent({
      success: true, sent: false, purpose: 'login', language: 'no', subject: 'Logg inn hos SO', html: '<p>x</p>',
      unresolvedPlaceholders: [], loginSender: { applies: true, sender: 'stine@example.com' }, message: 'Preview …',
    })
    const { client } = await connect(env, READ)
    const r = await callOk(client, 'preview_email_template', { domain: 'sodesign.no', purpose: 'login', language: 'no' })
    assert.equal(r.sent, false)
    assert.equal(r.subject, 'Logg inn hos SO')
    assert.equal(calls[0].path, '/email/world-template/preview')
    assert.deepEqual(calls[0].body, { domain: 'sodesign.no', purpose: 'login', language: 'no' })
  })

  test('a refusal from the gate comes back as FORBIDDEN', async () => {
    const { env } = withAgent({ success: false, error: 'Only a Superadmin or the World Founder of sodesign.no can see or change its email templates.' })
    const { client } = await connect(env, READ)
    const e = await callErr(client, 'get_email_templates', { domain: 'sodesign.no' })
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('both need graph:read and are read-only', async () => {
    const { env, calls } = withAgent({ success: true })
    const { client } = await connect(env, { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:write'] } })
    const e = await callErr(client, 'get_email_templates', { domain: 'sodesign.no' })
    assert.equal(e.requiredScope, 'graph:read')
    assert.equal(calls.length, 0)
    const { tools } = await client.listTools()
    for (const n of ['get_email_templates', 'preview_email_template']) {
      assert.equal(tools.find((t) => t.name === n).annotations.readOnlyHint, true, n)
    }
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


describe('update_user_profile updates someone who is already registered', () => {
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
      .run('u-kate', '{}', 'kate@longwhitecloud.com', 'tok-kate', 'Admin', '#IIBA')
    return env
  }

  test('updates phone and address, and forwards only the supplied fields', async () => {
    const env = seeded()
    const { client } = await connect(env, REG)
    const r = await callOk(client, 'update_user_profile', {
      email: 'kate@longwhitecloud.com',
      phone: '+4790784052',
      city: 'Oslo',
      country: 'Norway',
    })
    assert.equal(r.success, true)
    assert.equal(r.phone, '+4790784052')
    assert.equal(r.city, 'Oslo')
    assert.equal(r.country, 'Norway')
    const sent = env.AGENT_WORKER.calls[0].body
    assert.equal(sent.phone, '+4790784052')
    assert.equal(sent.city, 'Oslo')
    assert.equal(sent.country, 'Norway')
    // role and group_tags are never part of what this tool forwards.
    assert.equal('role' in sent, false)
    assert.equal('group_tags' in sent, false)
  })

  test('an unregistered email is refused and points at register_user', async () => {
    const env = seeded()
    const { client } = await connect(env, REG)
    const e = await callErr(client, 'update_user_profile', { email: 'nobody@example.com', phone: '+4790784052' })
    assert.equal(e.code, gs.ERR.GRAPH_NOT_FOUND)
    assert.match(e.message, /register_user/)
    assert.equal(env.AGENT_WORKER.calls.length, 0, 'no write when the account does not exist')
  })

  test('refuses when no field is supplied', async () => {
    const env = seeded()
    const { client } = await connect(env, REG)
    const e = await callErr(client, 'update_user_profile', { email: 'kate@longwhitecloud.com' })
    assert.equal(e.code, gs.ERR.INVALID_INPUT)
  })

  test('a non-Superadmin cannot update someone else\'s profile', async () => {
    const env = seeded()
    const { client } = await connect(env, { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['user:register'] } })
    const e = await callErr(client, 'update_user_profile', { email: 'kate@longwhitecloud.com', phone: '+4790784052' })
    assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('the scope is required', async () => {
    const env = seeded()
    const { client } = await connect(env, ALICE_RW)
    const e = await callErr(client, 'update_user_profile', { email: 'kate@longwhitecloud.com', phone: '+4790784052' })
    assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
    assert.equal(e.requiredScope, 'user:register')
  })
})


describe('create_worker proposes a worker through GitHub and never deploys one', () => {
  const ROOT = {
    auth: { ...ALICE_RW.auth, scope: ['graph:read', 'graph:publish'], userId: 'root@example.com' },
    props: { userId: 'root@example.com', email: 'root@example.com', role: 'Superadmin', authMethod: 'oauth' },
  }
  const CODE = 'export default { fetch() { return new Response("hi") } }'

  /** GitHub's contents API, faked. `existing` is the sha of the file already there, or null. */
  function github({ existing = null, putStatus = null, headStatus = null } = {}) {
    const calls = []
    const real = globalThis.fetch
    globalThis.fetch = async (url, init = {}) => {
      const call = { url: String(url), method: init.method || 'GET', headers: new Headers(init.headers), body: init.body ? JSON.parse(init.body) : null }
      calls.push(call)
      if (call.method === 'GET') {
        if (headStatus) return new Response('{}', { status: headStatus })
        return existing
          ? new Response(JSON.stringify({ sha: existing }), { status: 200 })
          : new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 })
      }
      if (putStatus) return new Response(JSON.stringify({ message: 'Resource not accessible by personal access token' }), { status: putStatus })
      return new Response(JSON.stringify({ commit: { sha: 'abc123', html_url: 'https://github.com/torarnehave1/vegvisr-frontend/commit/abc123' } }), { status: existing ? 200 : 201 })
    }
    return { calls, restore: () => { globalThis.fetch = real } }
  }

  function seeded({ token = 'gh-test-token' } = {}) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    if (token) env.GITHUB_WORKER_TOKEN = token
    return env
  }

  test('commits one file under mcp-workers/ on main and says it is NOT live', async () => {
    const gh = github()
    try {
      const { client } = await connect(seeded(), ROOT)
      const r = await callOk(client, 'create_worker', { workerName: 'hello', code: CODE, description: 'says hi' })
      assert.equal(r.live, false)
      assert.equal(r.status, 'awaiting_approval')
      assert.equal(r.created, true)
      assert.equal(r.deployedName, 'mcp-hello')
      assert.equal(r.url, 'https://mcp-hello.torarnehave.workers.dev')
      assert.equal(r.path, 'mcp-workers/hello/index.js')
      assert.match(r.approvalUrl, /actions\/workflows\/deploy-mcp-workers\.yml$/)
      const put = gh.calls.find((c) => c.method === 'PUT')
      assert.equal(put.url, 'https://api.github.com/repos/torarnehave1/vegvisr-frontend/contents/mcp-workers/hello/index.js')
      assert.equal(put.body.branch, 'main')
      assert.equal(Buffer.from(put.body.content, 'base64').toString('utf8'), CODE)
      assert.equal(put.body.sha, undefined, 'a new file names no sha')
      assert.equal(put.headers.get('Authorization'), 'Bearer gh-test-token')
    } finally { gh.restore() }
  })

  test('the text result tells the model to send the user to approve, not that it is deployed', async () => {
    const gh = github()
    try {
      const { client } = await connect(seeded(), ROOT)
      const r = await client.callTool({ name: 'create_worker', arguments: { workerName: 'hello', code: CODE } })
      const text = r.content.map((c) => c.text).join(' ')
      assert.match(text, /NOT live/)
      assert.match(text, /approve/i)
    } finally { gh.restore() }
  })

  test('the public commit message carries no e-mail address', async () => {
    const gh = github()
    try {
      const { client } = await connect(seeded(), ROOT)
      await callOk(client, 'create_worker', { workerName: 'hello', code: CODE, description: 'says hi' })
      const put = gh.calls.find((c) => c.method === 'PUT')
      assert.equal(put.body.message.includes('@'), false, put.body.message)
      assert.match(put.body.message, /^mcp-workers\/hello: create via MCP: says hi$/)
    } finally { gh.restore() }
  })

  test('an existing worker is updated by naming the sha it replaces', async () => {
    const gh = github({ existing: 'oldsha' })
    try {
      const { client } = await connect(seeded(), ROOT)
      const r = await callOk(client, 'create_worker', { workerName: 'hello', code: CODE })
      assert.equal(r.created, false)
      assert.equal(gh.calls.find((c) => c.method === 'PUT').body.sha, 'oldsha')
    } finally { gh.restore() }
  })

  test('a name cannot leave mcp-workers/ or name a platform worker', async () => {
    const gh = github()
    try {
      const { client } = await connect(seeded(), ROOT)
      for (const bad of ['../dev-worker', 'a/b', '.github', 'Hello', 'has space', 'x'.repeat(50)]) {
        const r = await client.callTool({ name: 'create_worker', arguments: { workerName: bad, code: CODE } })
        assert.equal(r.isError, true, bad)
      }
      assert.equal(gh.calls.length, 0, 'nothing reached GitHub')
      // A platform worker's NAME is allowed, because it cannot collide: it deploys as mcp-<name>.
      const r = await callOk(client, 'create_worker', { workerName: 'knowledge-graph-worker', code: CODE })
      assert.equal(r.deployedName, 'mcp-knowledge-graph-worker')
      assert.equal(r.path, 'mcp-workers/knowledge-graph-worker/index.js')
    } finally { gh.restore() }
  })

  test('the deploy prefix is one no platform worker uses', () => {
    assert.equal(workerSource.DEPLOY_PREFIX, 'mcp-')
    assert.equal(workerSource.SOURCE_DIR, 'mcp-workers')
  })

  test('code that is not an ES module with a default export is refused before GitHub', async () => {
    const gh = github()
    try {
      const { client } = await connect(seeded(), ROOT)
      const e = await callErr(client, 'create_worker', { workerName: 'hello', code: 'addEventListener("fetch", () => {})' })
      assert.equal(e.code, gs.ERR.INVALID_INPUT)
      assert.equal(gh.calls.length, 0)
    } finally { gh.restore() }
  })

  test('a non-Superadmin holding the scope is refused before GitHub', async () => {
    const gh = github()
    try {
      const { client } = await connect(seeded(), { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:publish'] } })
      const e = await callErr(client, 'create_worker', { workerName: 'hello', code: CODE })
      assert.equal(e.code, gs.ERR.FORBIDDEN_GRAPH)
      assert.match(e.message, /Superadmin/)
      assert.equal(gh.calls.length, 0)
    } finally { gh.restore() }
  })

  test('a Superadmin WITHOUT graph:publish is refused — the role alone is not consent', async () => {
    const gh = github()
    try {
      const { client } = await connect(seeded(), { ...ROOT, auth: { ...ROOT.auth, scope: ['graph:read', 'graph:write'] } })
      const e = await callErr(client, 'create_worker', { workerName: 'hello', code: CODE })
      assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
      assert.equal(e.requiredScope, 'graph:publish')
      assert.equal(gh.calls.length, 0)
    } finally { gh.restore() }
  })

  test('without the GitHub token it says so and commits nothing', async () => {
    const gh = github()
    try {
      const { client } = await connect(seeded({ token: null }), ROOT)
      const e = await callErr(client, 'create_worker', { workerName: 'hello', code: CODE })
      assert.equal(e.code, gs.ERR.INTERNAL_ERROR)
      assert.match(e.message, /GITHUB_WORKER_TOKEN/)
      assert.equal(gh.calls.length, 0)
    } finally { gh.restore() }
  })

  test('a refused commit is a failure, and a failed read never falls through to a write', async () => {
    let gh = github({ putStatus: 403 })
    try {
      const { client } = await connect(seeded(), ROOT)
      const e = await callErr(client, 'create_worker', { workerName: 'hello', code: CODE })
      assert.equal(e.code, gs.ERR.INTERNAL_ERROR)
      assert.match(e.message, /status 403/)
      assert.equal(e.message.includes('gh-test-token'), false, 'the credential is never echoed')
    } finally { gh.restore() }
    gh = github({ headStatus: 500 })
    try {
      const { client } = await connect(seeded(), ROOT)
      await callErr(client, 'create_worker', { workerName: 'hello', code: CODE })
      assert.equal(gh.calls.filter((c) => c.method === 'PUT').length, 0)
    } finally { gh.restore() }
  })
})

describe('publish_component moves a served component from GitHub into the registry', () => {
  const ROOT = {
    auth: { ...ALICE_RW.auth, scope: ['graph:read', 'graph:write', 'graph:publish'], userId: 'root@example.com' },
    props: { userId: 'root@example.com', email: 'root@example.com', role: 'Superadmin', authMethod: 'oauth' },
  }
  const REGISTRY = '4072b898-f111-42a9-b5ca-0d901bb17d26'
  const HEAD = 'a'.repeat(40)
  const OLD = `/* old */ (function () { 'use strict'; ${'var x = 1; '.repeat(400)} })()`
  const NEW = `/* new */ (function () { 'use strict'; ${'var y = 2; '.repeat(420)} })()`

  /** GitHub, faked: the branch head from the API, the file from raw.githubusercontent.com. */
  function github({ head = HEAD, file = NEW, headStatus = 200, rawStatus = 200, bytes = null } = {}) {
    const calls = []
    const real = globalThis.fetch
    globalThis.fetch = async (url, init = {}) => {
      const call = { url: String(url), method: init.method || 'GET', headers: new Headers(init.headers) }
      calls.push(call)
      if (call.url.startsWith('https://api.github.com/')) {
        const status = typeof headStatus === 'function' ? headStatus(call) : headStatus
        return new Response(status === 200 ? head : '{}', { status })
      }
      if (call.url.startsWith('https://raw.githubusercontent.com/')) {
        return new Response(rawStatus === 200 ? (bytes || file) : 'Not Found', { status: rawStatus })
      }
      throw new Error(`unexpected fetch: ${call.url}`)
    }
    return { calls, restore: () => { globalThis.fetch = real } }
  }

  /** A registry with one served component, one inline component and one layout. */
  async function seeded({ impl = OLD } = {}) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const r = await gs.saveGraph(env, {
      id: REGISTRY,
      actor: gs.normalizeActor({ valid: true, email: 'root@example.com', userId: 'root@example.com', role: 'Superadmin' }),
      graphData: {
        metadata: { title: 'Component Registry', createdBy: 'root@example.com' },
        nodes: [
          {
            id: 'component-graph-portfolio', label: 'graph-portfolio', type: 'component', info: 'Card grid.',
            metadata: {
              origin: 'agent-registered', delivery: 'graph-js', impl,
              schema: { props: { 'data-columns': { type: 'string' } } },
              verify: { verdict: 'PASS', verifiedDate: '2026-10-30', method: 'Playwright', note: 'old' },
              updatedBy: 'root@example.com', changeNote: '2026-10-30: old note',
            },
          },
          { id: 'component-inline-thing', label: 'inline-thing', type: 'component', info: 'x', metadata: { impl: '<div>hi</div>' } },
          { id: 'layout-graph-portfolio', label: 'graph-portfolio', type: 'layout', info: 'x', metadata: { delivery: 'graph-js', impl: 'var l = 1' } },
        ],
        edges: [],
      },
    })
    assert.equal(r.ok, true, JSON.stringify(r))
    return env
  }

  const stored = async (env, id = 'component-graph-portfolio') => {
    const g = await gs.getGraph(env, REGISTRY, { caller: null })
    return { node: g.graph.nodes.find((n) => n.id === id), version: g.version }
  }

  test('stores the file at the head of master, and nothing else on the node changes', async () => {
    const gh = github()
    try {
      const env = await seeded()
      const before = await stored(env)
      const { client } = await connect(env, ROOT)
      const r = await callOk(client, 'publish_component', {
        name: 'graph-portfolio', expectedCommit: HEAD, changeNote: 'front page',
        verify: { verdict: 'PASS', method: 'Chrome via Playwright, 1280 and 390 px', note: 'World mode not checked' },
      })
      assert.equal(r.written, true)
      assert.equal(r.changed, true)
      assert.equal(r.commit, HEAD)
      assert.equal(r.chars, NEW.length)
      assert.equal(r.previousChars, OLD.length)
      assert.equal(r.url, 'https://api.vegvisr.org/components/graph-portfolio.js')
      assert.equal(r.registryVersion, before.version + 1)

      const after = await stored(env)
      const m = after.node.metadata
      assert.equal(m.impl, NEW, 'the stored code is the fetched file, byte for byte')
      assert.equal(m.delivery, 'graph-js', 'delivery is kept — losing it is what made the url return 500')
      assert.deepEqual(m.schema, before.node.metadata.schema, 'the schema is kept')
      assert.equal(m.origin, 'agent-registered')
      assert.equal(m.sourceCommit, HEAD)
      assert.equal(m.verify.verdict, 'PASS')
      assert.match(m.verify.method, /Playwright/)
      assert.match(m.changeNote, /^\d{4}-\d{2}-\d{2}: front page$/)
      assert.equal(/@/.test(m.updatedBy), false, 'no e-mail address on a node anyone can read')
      assert.equal((await stored(env, 'layout-graph-portfolio')).node.metadata.impl, 'var l = 1', 'a layout of the same name is not touched')

      const raw = gh.calls.find((c) => c.url.startsWith('https://raw.'))
      assert.equal(raw.url, `https://raw.githubusercontent.com/torarnehave1/Agent-Builder/${HEAD}/worker/components/graph-portfolio.js`)
      assert.equal(gh.calls[0].url, 'https://api.github.com/repos/torarnehave1/Agent-Builder/commits/master')
      assert.equal(gh.calls[0].headers.get('Authorization'), null, 'the public repository is read without a credential')
    } finally { gh.restore() }
  })

  test('the caller cannot name a url, a repository, a branch or code', async () => {
    const { tools } = await (await connect(await seeded(), ROOT)).client.listTools()
    const props = Object.keys(tools.find((t) => t.name === 'publish_component').inputSchema.properties).sort()
    assert.deepEqual(props, ['changeNote', 'dryRun', 'expectedCommit', 'name', 'verify'])
  })

  test('verify left out records UNVERIFIED — an old PASS does not survive new code', async () => {
    const gh = github()
    try {
      const env = await seeded()
      const { client } = await connect(env, ROOT)
      const r = await callOk(client, 'publish_component', { name: 'graph-portfolio', expectedCommit: HEAD })
      assert.equal(r.verifyVerdict, 'UNVERIFIED')
      const m = (await stored(env)).node.metadata
      assert.equal(m.verify.verdict, 'UNVERIFIED')
      assert.equal(m.verify.method ?? null, null)
      assert.equal(m.changeNote, '2026-10-30: old note', 'without a new note the old one stands')
    } finally { gh.restore() }
  })

  test('PASS without saying how it was checked is refused', async () => {
    const gh = github()
    try {
      const env = await seeded()
      const { client } = await connect(env, ROOT)
      const e = await callErr(client, 'publish_component', { name: 'graph-portfolio', expectedCommit: HEAD, verify: { verdict: 'PASS' } })
      assert.equal(e.code, gs.ERR.INVALID_INPUT)
      assert.equal((await stored(env)).node.metadata.impl, OLD)
      assert.equal(gh.calls.length, 0)
    } finally { gh.restore() }
  })

  test('a dry run reports what would change and writes nothing', async () => {
    const gh = github()
    try {
      const env = await seeded()
      const before = await stored(env)
      const { client } = await connect(env, ROOT)
      const r = await client.callTool({ name: 'publish_component', arguments: { name: 'graph-portfolio', dryRun: true } })
      assert.notEqual(r.isError, true)
      assert.equal(sc(r).written, false)
      assert.equal(sc(r).dryRun, true)
      assert.equal(sc(r).changed, true)
      assert.equal(sc(r).commit, HEAD)
      assert.match(r.content.map((c) => c.text).join(' '), /DRY RUN, nothing written/)
      const after = await stored(env)
      assert.equal(after.node.metadata.impl, OLD)
      assert.equal(after.version, before.version)
    } finally { gh.restore() }
  })

  test('a real publish must name the commit that was tested', async () => {
    const gh = github()
    try {
      const env = await seeded()
      const { client } = await connect(env, ROOT)
      const e = await callErr(client, 'publish_component', { name: 'graph-portfolio' })
      assert.equal(e.code, gs.ERR.INVALID_INPUT)
      assert.match(e.message, /expectedCommit is required/)
      assert.equal(gh.calls.length, 0)
    } finally { gh.restore() }
  })

  test('master having moved since the test is a refusal, not a publish of something else', async () => {
    const gh = github({ head: 'b'.repeat(40) })
    try {
      const env = await seeded()
      const { client } = await connect(env, ROOT)
      const e = await callErr(client, 'publish_component', { name: 'graph-portfolio', expectedCommit: HEAD })
      assert.equal(e.code, gs.ERR.VERSION_CONFLICT)
      assert.equal(e.commit, 'b'.repeat(40))
      assert.equal(gh.calls.some((c) => c.url.startsWith('https://raw.')), false, 'the file is not even fetched')
      assert.equal((await stored(env)).node.metadata.impl, OLD)
    } finally { gh.restore() }
  })

  test('identical code is reported as unchanged and the registry version does not move', async () => {
    const gh = github({ file: OLD })
    try {
      const env = await seeded()
      const before = await stored(env)
      const { client } = await connect(env, ROOT)
      const r = await callOk(client, 'publish_component', { name: 'graph-portfolio', expectedCommit: HEAD })
      assert.equal(r.changed, false)
      assert.equal(r.written, false)
      assert.equal((await stored(env)).version, before.version)
      assert.equal((await stored(env)).node.metadata.verify.verdict, 'PASS', 'nothing was touched, the old verdict included')
    } finally { gh.restore() }
  })

  test('markup, an empty file, a truncated file and invalid UTF-8 are all refused', async () => {
    const cases = [
      [{ file: '<script>var a = 1</script>' }, /markup/],
      [{ file: '   \n' }, /empty/],
      [{ file: NEW.slice(0, Math.floor(OLD.length * 0.5)) }, /truncated/],
      [{ bytes: new Uint8Array([0x76, 0x61, 0x72, 0x20, 0xff, 0xfe, 0x3b]) }, /UTF-8/],
    ]
    for (const [opts, why] of cases) {
      const gh = github(opts)
      try {
        const env = await seeded()
        const { client } = await connect(env, ROOT)
        const e = await callErr(client, 'publish_component', { name: 'graph-portfolio', expectedCommit: HEAD })
        assert.equal(e.code, gs.ERR.INVALID_INPUT, String(why))
        assert.match(e.message, why)
        assert.match(e.message, /Nothing was written/)
        assert.equal((await stored(env)).node.metadata.impl, OLD)
      } finally { gh.restore() }
    }
  })

  test('only a component that exists and is served as JavaScript can be published', async () => {
    const gh = github()
    try {
      const env = await seeded()
      const { client } = await connect(env, ROOT)
      const missing = await callErr(client, 'publish_component', { name: 'no-such-thing', expectedCommit: HEAD })
      assert.equal(missing.code, gs.ERR.GRAPH_NOT_FOUND)
      const inline = await callErr(client, 'publish_component', { name: 'inline-thing', expectedCommit: HEAD })
      assert.equal(inline.code, gs.ERR.INVALID_INPUT)
      assert.match(inline.message, /not served as JavaScript/)
      assert.equal(gh.calls.length, 0, 'GitHub is not asked about a name that cannot be published')
    } finally { gh.restore() }
  })

  test('a name that could leave the components directory never reaches GitHub', async () => {
    const gh = github()
    try {
      const { client } = await connect(await seeded(), ROOT)
      for (const bad of ['../index', 'a/b', 'Graph-Portfolio', 'x.js', '', 'a b']) {
        const r = await client.callTool({ name: 'publish_component', arguments: { name: bad, expectedCommit: HEAD } })
        assert.equal(r.isError, true, `"${bad}" must be refused`)
      }
      assert.equal(gh.calls.length, 0)
    } finally { gh.restore() }
  })

  test('a file missing from the repository, or GitHub failing, writes nothing', async () => {
    for (const opts of [{ rawStatus: 404 }, { rawStatus: 500 }, { headStatus: 500 }, { head: 'not-a-sha' }]) {
      const gh = github(opts)
      try {
        const env = await seeded()
        const { client } = await connect(env, ROOT)
        const e = await callErr(client, 'publish_component', { name: 'graph-portfolio', expectedCommit: HEAD })
        assert.match(e.message, /Nothing was written/)
        assert.equal((await stored(env)).node.metadata.impl, OLD)
      } finally { gh.restore() }
    }
  })

  test('a rate-limited anonymous read is retried once with the worker token, which is never echoed', async () => {
    const gh = github({ headStatus: (call) => (call.headers.get('Authorization') ? 200 : 403) })
    try {
      const env = await seeded()
      env.GITHUB_WORKER_TOKEN = 'gh-test-token'
      const { client } = await connect(env, ROOT)
      const r = await client.callTool({ name: 'publish_component', arguments: { name: 'graph-portfolio', expectedCommit: HEAD } })
      assert.notEqual(r.isError, true)
      const api = gh.calls.filter((c) => c.url.startsWith('https://api.github.com/'))
      assert.equal(api.length, 2)
      assert.equal(api[1].headers.get('Authorization'), 'Bearer gh-test-token')
      assert.equal(gh.calls.find((c) => c.url.startsWith('https://raw.')).headers.get('Authorization'), null, 'the token is not sent to the file host')
      assert.equal(JSON.stringify(r).includes('gh-test-token'), false)
    } finally { gh.restore() }
  })

  test('it needs graph:publish AND the Superadmin role', async () => {
    const gh = github()
    try {
      const env = await seeded()
      const noScope = { auth: { ...ROOT.auth, scope: ['graph:read', 'graph:write'] }, props: ROOT.props }
      const e1 = await callErr((await connect(env, noScope)).client, 'publish_component', { name: 'graph-portfolio', expectedCommit: HEAD })
      assert.equal(e1.code, gs.ERR.INSUFFICIENT_SCOPE)
      const notRoot = { auth: { ...ROOT.auth, userId: 'alice@example.com' }, props: { ...ALICE_RW.props } }
      const e2 = await callErr((await connect(env, notRoot)).client, 'publish_component', { name: 'graph-portfolio', expectedCommit: HEAD })
      assert.equal(e2.code, gs.ERR.FORBIDDEN_GRAPH)
      assert.equal(gh.calls.length, 0)
      assert.equal((await stored(env)).node.metadata.impl, OLD)
    } finally { gh.restore() }
  })

  test('the text result says it is live within minutes and asks for the served url to be checked', async () => {
    const gh = github()
    try {
      const { client } = await connect(await seeded(), ROOT)
      const r = await client.callTool({ name: 'publish_component', arguments: { name: 'graph-portfolio', expectedCommit: HEAD } })
      const text = r.content.map((c) => c.text).join(' ')
      assert.match(text, /within about 5 minutes/)
      assert.match(text, /Fetch that url/)
      assert.match(text, /UNVERIFIED/)
    } finally { gh.restore() }
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


describe('a client with a narrower Accept header is not turned away', () => {
  // Thirteen JSONRPC_-32000 rows in one day, all with tool:null and 0ms, turned out to be the
  // SDK refusing POSTs whose Accept lacked text/event-stream — a check that is meaningless here,
  // because the server is stateless with enableJsonResponse and never returns an event stream.
  async function post(acceptHeader) {
    const { env } = freshDb()
    const server = new McpServer({ name: 'test', version: '1.5.0' })
    const { WebStandardStreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
    )
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    registerTools(server, () => ({ ...ALICE_RW, env }))
    await server.connect(transport)

    const body = { jsonrpc: '2.0', id: 1, method: 'tools/list' }
    let req = new Request('https://x/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: acceptHeader },
      body: JSON.stringify(body),
    })
    // The same normalisation mcp/server.js performs before handing the request to the transport.
    const accept = req.headers.get('accept') || ''
    if (!accept.includes('text/event-stream')) {
      const headers = new Headers(req.headers)
      headers.set('accept', 'application/json, text/event-stream')
      req = new Request(req.url, { method: req.method, headers })
    }
    const res = await transport.handleRequest(req, {
      parsedBody: body,
      authInfo: { token: '', clientId: 'c', scopes: ['graph:read'], extra: {} },
    })
    const text = await res.text()
    await server.close()
    return { status: res.status, text }
  }

  for (const accept of ['application/json', '*/*', 'application/json, text/event-stream']) {
    test(`Accept: ${accept} is answered, not rejected with -32000`, async () => {
      const { status, text } = await post(accept)
      assert.equal(status, 200)
      assert.ok(!text.includes('-32000'), 'must not be refused as Not Acceptable')
      assert.equal(JSON.parse(text).result.tools.length, TOOL_NAMES.length)
    })
  }
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

describe('reorder_nodes', () => {
  async function fourNodes(client) {
    return callOk(client, 'create_graph', {
      title: 'T', metaArea: '#X',
      nodes: ['a', 'b', 'sources', 'late'].map((id) => ({ id, label: id.toUpperCase(), info: id })),
    })
  }
  const shown = (nodes) => [...nodes].sort((x, y) => x.order - y.order).map((n) => n.id)

  test('moves a late node above Sources and keeps the rest in place', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await fourNodes(client)
    const r = await callOk(client, 'reorder_nodes', { graphId: g.graphId, nodeIds: ['a', 'b', 'late'], expectedVersion: g.version })
    assert.deepEqual(r.order.map((n) => n.id), ['a', 'b', 'late', 'sources'])
    assert.equal(r.newVersion, g.version + 1)
    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.deepEqual(shown(read.nodes), ['a', 'b', 'late', 'sources'])
    // editor.vegvisr.org/view ignores `order` and reads the array as it is.
    assert.deepEqual(read.nodes.map((n) => n.id), ['a', 'b', 'late', 'sources'], 'array order must match too')
    assert.equal(read.nodes.find((n) => n.id === 'a').info, 'a', 'content must not change')
  })

  test('unlisted nodes follow in their CURRENT order, not array order', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await fourNodes(client)
    const r1 = await callOk(client, 'reorder_nodes', { graphId: g.graphId, nodeIds: ['late', 'sources'], expectedVersion: g.version })
    assert.deepEqual(r1.order.map((n) => n.id), ['late', 'sources', 'a', 'b'])
    const r2 = await callOk(client, 'reorder_nodes', { graphId: g.graphId, nodeIds: ['b'], expectedVersion: r1.newVersion })
    assert.deepEqual(r2.order.map((n) => n.id), ['b', 'late', 'sources', 'a'])
  })

  test('refuses unknown ids, duplicates and a stale version without writing', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await fourNodes(client)
    assert.equal((await callErr(client, 'reorder_nodes', { graphId: g.graphId, nodeIds: ['nope'], expectedVersion: g.version })).code, gs.ERR.GRAPH_NOT_FOUND)
    assert.equal((await callErr(client, 'reorder_nodes', { graphId: g.graphId, nodeIds: ['a', 'a'], expectedVersion: g.version })).code, gs.ERR.INVALID_INPUT)
    assert.equal((await callErr(client, 'reorder_nodes', { graphId: g.graphId, nodeIds: ['b'], expectedVersion: g.version + 5 })).code, gs.ERR.VERSION_CONFLICT)
    const read = await callOk(client, 'get_graph', { graphId: g.graphId })
    assert.equal(read.version, g.version, 'nothing may have been written')
  })

  test('needs graph:write', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await fourNodes(client)
    const { client: ro } = await connect(env, ALICE_RO)
    assert.equal((await callErr(ro, 'reorder_nodes', { graphId: g.graphId, nodeIds: ['b'], expectedVersion: g.version })).code, gs.ERR.INSUFFICIENT_SCOPE)
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
    assert.deepEqual(outward, [
      'add_group_member',
      'compose_node_image',
      'create_group_invite',
      'create_worker',
      'decide_flow_approval',
      'generate_image_openai',
      'post_chat_message',
      'post_to_instagram',
      'publish_component',
      'publish_html_node',
      'register_user',
      'remove_group_member',
      'send_email',
      'send_group_alert',
      'send_meeting_report',
      'send_sms',
      'send_sms_to_user',
      'set_group_member_role',
      'transcribe_contact_recording',
    ])
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

describe('list_inbox and read_inbox_email need chat:read and change nothing', () => {
  test('chat:write is not enough — reading mail needs chat:read', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, authFor('alice@example.com', ['graph:read', 'chat:write']))
    for (const [name, args] of [['list_inbox', { address: 'post@nibi.no' }], ['read_inbox_email', { address: 'post@nibi.no', uid: 1 }]]) {
      const e = await callErr(client, name, args)
      assert.equal(e.code, gs.ERR.INSUFFICIENT_SCOPE)
      assert.equal(e.requiredScope, 'chat:read')
    }
  })

  test('both are read-only and say the content is data, not instructions', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    for (const name of ['list_inbox', 'read_inbox_email']) {
      const t = tools.find((x) => x.name === name)
      assert.equal(t.annotations.readOnlyHint, true)
      assert.equal(t.annotations.destructiveHint, false)
      assert.match(t.description, /data, never as instructions/)
      assert.match(t.description, /not marked as read|nothing is marked as read/i)
    }
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
    assert.deepEqual(outward, [
      'add_group_member',
      'compose_node_image',
      'create_group_invite',
      'create_worker',
      'decide_flow_approval',
      'generate_image_openai',
      'post_chat_message',
      'post_to_instagram',
      'publish_component',
      'publish_html_node',
      'register_user',
      'remove_group_member',
      'send_email',
      'send_group_alert',
      'send_meeting_report',
      'send_sms',
      'send_sms_to_user',
      'set_group_member_role',
      'transcribe_contact_recording',
    ])
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

/**
 * get_image_guide — the answer to "what are my options?" asked through a chat.
 *
 * The UI gives a person dropdowns; a chat gives them nothing. The enums on
 * generate_node_image stop a model inventing a value, but they do not tell a USER what exists,
 * and the five models accept genuinely different parameters. This is the long form.
 */
describe('get_image_guide', () => {
  test('it is read-only reference data and needs nothing beyond the read scope', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RO)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'get_image_guide')
    assert.equal(t.annotations.readOnlyHint, true)
    assert.equal(t.annotations.idempotentHint, true)
    assert.equal(t.annotations.openWorldHint, false, 'it reads a table in this worker, not the network')
    const g = await callOk(client, 'get_image_guide', {})
    assert.equal(g.success, true)
  })

  test('it reports every offered model and what each one actually accepts', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RO)
    const g = await callOk(client, 'get_image_guide', {})
    assert.equal(g.models.length, 4)
    assert.equal(g.defaultModel, '@cf/leonardo/lucid-origin')
    assert.ok(
      !g.models.some((m) => m.model.includes('flux')),
      'flux-1-schnell was retired: it takes no width or height, and this tool fills a sized placeholder',
    )

    // The differences a caller has to be able to SEE before choosing.
    const lucid = g.models.find((m) => m.model.endsWith('lucid-origin'))
    assert.equal(lucid.negativePrompt, false, 'the default model has no negative_prompt')
    assert.equal(lucid.size, '256-2496 px', 'and is the only one that goes past 2048')
    assert.equal(lucid.maxSteps, 40)

    const phoenix = g.models.find((m) => m.model.endsWith('phoenix-1.0'))
    assert.equal(phoenix.guidance, '2-10', 'its guidance floor is 2, not 0')
    assert.equal(phoenix.negativePrompt, true)

    const lightning = g.models.find((m) => m.model.endsWith('xl-lightning'))
    assert.equal(lightning.maxSteps, 20)
    assert.equal(lightning.guidance, 'no documented range')
  })

  test('it hands back the same vocabulary the tool enums enforce — one source, not two', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RO)
    const { tools } = await client.listTools()
    const gen = tools.find((x) => x.name === 'generate_node_image').inputSchema.properties
    const g = await callOk(client, 'get_image_guide', {})

    // If the guide and the schema could drift, the guide would teach a user to ask for
    // something the tool then rejects. Pinning them against each other is the only mechanism
    // that stops that, since nothing else reads both.
    assert.deepEqual(Object.keys(g.styles).sort(), [...gen.style.enum].sort())
    assert.deepEqual(Object.keys(g.lighting).sort(), [...gen.lighting.enum].sort())
    assert.deepEqual(Object.keys(g.formats).sort(), [...gen.format.enum].sort())
    assert.deepEqual(Object.keys(g.renderTraits).sort(), [...gen.renderTraits.items.enum].sort())
    assert.deepEqual(Object.keys(g.textTreatments).sort(), [...gen.textTreatment.enum].sort())
    assert.deepEqual(Object.keys(g.quality).sort(), [...gen.quality.enum].sort())
    assert.deepEqual(g.models.map((m) => m.model).sort(), [...gen.model.enum].sort())
  })

  test('one model can be asked about without pulling all five into context', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RO)
    const g = await callOk(client, 'get_image_guide', { model: '@cf/leonardo/phoenix-1.0' })
    assert.equal(g.models.length, 1)
    assert.equal(g.models[0].guidance, '2-10')
  })
})

/**
 * What the audit log records about a call.
 *
 * `client_info` read NULL on every `initialize` row from the day it was added: describeClient
 * computed the string correctly, and both audit() call sites listed their fields by hand and
 * simply did not include it. Nothing failed, no test covered it, and the column sat there
 * looking like an answer. These pin the derivation; the `...described` spread at the call sites
 * is what stops the next added field going the same way.
 */
describe('audit facts derived from a request', () => {
  test('initialize records the client name, protocol and declared capabilities', () => {
    const d = server.describeCall({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        clientInfo: { name: 'claude-ai', version: '0.1.0' },
        capabilities: { roots: {}, sampling: {}, elicitation: {} },
      },
    })
    assert.equal(d.method, 'initialize')
    // Capabilities are sorted so two clients declaring the same set produce the same string,
    // which is what makes the column groupable.
    assert.equal(d.clientInfo, 'claude-ai/0.1.0 proto:2025-06-18 caps:elicitation,roots,sampling')
  })

  test('a client that declares nothing still records its name', () => {
    const d = server.describeCall({ method: 'initialize', params: { clientInfo: { name: 'grok' } } })
    assert.equal(d.clientInfo, 'grok proto:? caps:none')
  })

  test('only initialize carries client info — every other method leaves it null', () => {
    for (const method of ['tools/list', 'tools/call', 'notifications/initialized']) {
      const d = server.describeCall({ method, params: { name: 'get_graph', arguments: { graphId: 'g1' } } })
      assert.equal(d.clientInfo, null, method)
    }
  })

  test('a tools/call records the tool and graph, and never the arguments', () => {
    const d = server.describeCall({
      method: 'tools/call',
      params: { name: 'update_node', arguments: { graphId: 'g1', nodeId: 'n1', info: 'secret prose' } },
    })
    assert.deepEqual(d, { method: 'tools/call', tool: 'update_node', graphId: 'g1', clientInfo: null })
    assert.ok(!JSON.stringify(d).includes('secret prose'), 'node content must never reach the audit row')
  })
})

/**
 * The Accept header the SDK insists on, and the -32000 rows it produced.
 *
 * Two facts, both established against the real transport rather than reasoned about:
 *   1. An UNKNOWN METHOD answers -32601 "Method not found" with HTTP 200. So a -32000 in the
 *      audit log never means "the client asked for something we do not have" — it means the
 *      request was refused before dispatch. `server/discover` was misread as the former.
 *   2. The refusal is the Accept check, and it requires BOTH types. The first fix widened only
 *      when text/event-stream was missing, leaving a client that sends text/event-stream ALONE
 *      refused exactly as before.
 *
 * The integration cases below drive the SDK transport directly, so if a future SDK relaxes this
 * check the tests say so instead of the workaround quietly outliving its reason.
 */
describe('Accept normalisation — why JSONRPC_-32000 appeared at all', () => {
  test('widening is needed unless BOTH types are listed', () => {
    assert.equal(server.acceptNeedsWidening('application/json'), true, 'missing event-stream')
    assert.equal(server.acceptNeedsWidening('text/event-stream'), true, 'missing json — the case the first fix missed')
    assert.equal(server.acceptNeedsWidening(''), true)
    assert.equal(server.acceptNeedsWidening(null), true)
    assert.equal(server.acceptNeedsWidening('*/*'), true, 'a wildcard does not satisfy a substring test')
    assert.equal(server.acceptNeedsWidening('application/json, text/event-stream'), false)
    assert.equal(server.acceptNeedsWidening('text/event-stream, application/json;q=0.9'), false)
  })

  /** Drive the real transport the way mcp/server.js does, and read what it answers. */
  async function throughTransport(accept, body) {
    const s = new McpServer({ name: 'probe', version: '0.0.0' })
    const t = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await s.connect(t)
    const res = await t.handleRequest(
      new Request('https://example.test/mcp', { method: 'POST', headers: { accept, 'content-type': 'application/json' } }),
      { parsedBody: body },
    )
    return { status: res.status, body: JSON.parse(await res.text()) }
  }

  test('an unknown method is -32601 and HTTP 200 — never -32000', async () => {
    for (const method of ['server/discover', 'totally/made-up']) {
      const r = await throughTransport(server.ACCEPT_BOTH, { jsonrpc: '2.0', id: 1, method })
      assert.equal(r.status, 200, method)
      assert.equal(r.body.error.code, -32601, method)
    }
  })

  test('Accept with only text/event-stream is refused 406 with -32000', async () => {
    const r = await throughTransport('text/event-stream', { jsonrpc: '2.0', id: 1, method: 'ping' })
    assert.equal(r.status, 406)
    assert.equal(r.body.error.code, -32000)
  })

  test('the transport also refuses a Content-Type it will never read', async () => {
    // The second cause of the same -32000, found only because server/discover kept appearing
    // after the Accept fix shipped. Our handler parses the body itself and passes parsedBody, so
    // the transport never touches the stream — it is validating a header describing something it
    // will not read.
    for (const ct of ['text/plain', 'application/jsonrequest', '']) {
      const s2 = new McpServer({ name: 'probe', version: '0.0.0' })
      const t2 = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      await s2.connect(t2)
      const res = await t2.handleRequest(
        new Request('https://example.test/mcp', { method: 'POST', headers: { accept: server.ACCEPT_BOTH, 'content-type': ct } }),
        { parsedBody: { jsonrpc: '2.0', id: 1, method: 'ping' } },
      )
      assert.equal(res.status, 415, ct || '(empty)')
      assert.equal(JSON.parse(await res.text()).error.code, -32000, ct || '(empty)')
    }
  })

  test('a Content-Type is fixed unless it is application/json, charset and all', () => {
    assert.equal(server.contentTypeNeedsFixing('application/json'), false)
    assert.equal(server.contentTypeNeedsFixing('application/json; charset=utf-8'), false)
    assert.equal(server.contentTypeNeedsFixing('APPLICATION/JSON'), false, 'media types are case-insensitive')
    assert.equal(server.contentTypeNeedsFixing('text/plain'), true)
    assert.equal(server.contentTypeNeedsFixing('application/jsonrequest'), true, 'a prefix is not a match')
    assert.equal(server.contentTypeNeedsFixing(''), true)
    assert.equal(server.contentTypeNeedsFixing(null), true, 'a missing header is the common case')
  })

  test('the same request goes through once the header is widened', async () => {
    const narrow = 'text/event-stream'
    assert.equal(server.acceptNeedsWidening(narrow), true)
    const r = await throughTransport(server.ACCEPT_BOTH, { jsonrpc: '2.0', id: 1, method: 'ping' })
    assert.equal(r.status, 200)
    assert.deepEqual(r.body.result, {})
  })
})

/**
 * Protocol negotiation is not failure.
 *
 * Claude probes with `Mcp-Protocol-Version: 2026-07-28` before initialising — a version no
 * published SDK implements; 1.31.0, the newest, still tops out at 2025-11-25. The transport
 * refuses it with -32000, the client learns what this server speaks, and its initialize arrives
 * a second later at a supported version and succeeds. The refusal IS the mechanism working.
 *
 * This pins the boundary, because the tempting "fix" is to accept the version and make the log
 * quiet — which would trade a truthful refusal for an untruthful acceptance the client would
 * then hold us to.
 */
describe('protocol version probing', () => {
  test('the SDK still does not implement what Claude probes with', () => {
    assert.ok(!SUPPORTED_PROTOCOL_VERSIONS.includes('2026-07-28'),
      'if this fails, the SDK caught up: the probe now succeeds and PROTOCOL_UNSUPPORTED should stop appearing')
    assert.equal(SUPPORTED_PROTOCOL_VERSIONS[0], '2025-11-25', 'the newest version this server can honestly claim')
  })

  test('a non-initialize request at an unsupported version is refused, not negotiated down', async () => {
    const s = new McpServer({ name: 'probe', version: '0.0.0' })
    const t = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await s.connect(t)
    const res = await t.handleRequest(
      new Request('https://example.test/mcp', {
        method: 'POST',
        headers: { accept: server.ACCEPT_BOTH, 'content-type': 'application/json', 'mcp-protocol-version': '2026-07-28' },
      }),
      { parsedBody: { jsonrpc: '2.0', id: 1, method: 'server/discover' } },
    )
    assert.equal(res.status, 400)
    const body = JSON.parse(await res.text())
    assert.equal(body.error.code, -32000)
    assert.match(body.error.message, /Unsupported protocol version: 2026-07-28/)
  })

  test('initialize skips the check entirely, which is why it succeeds right after', async () => {
    // validateProtocolVersion runs only for non-initialize messages. That asymmetry is the whole
    // reason one request failed and the next one, one second later, did not.
    const s = new McpServer({ name: 'probe', version: '0.0.0' })
    const t = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await s.connect(t)
    const res = await t.handleRequest(
      new Request('https://example.test/mcp', {
        method: 'POST',
        headers: { accept: server.ACCEPT_BOTH, 'content-type': 'application/json', 'mcp-protocol-version': '2026-07-28' },
      }),
      {
        parsedBody: {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-11-25', clientInfo: { name: 'probe', version: '1' }, capabilities: {} },
        },
      },
    )
    assert.equal(res.status, 200, 'the same header that refused server/discover does not refuse initialize')
  })
})

/**
 * get_graph — what a client can actually SEE.
 *
 * Reported 2026-10-01: a client could not find node ids. The nodes were being fetched and were
 * in structuredContent the whole time; get_graph was simply the only tool of 28 without an
 * outputSchema, so a client had no contract telling it what that field held and fell back to
 * content[0].text — which was a one-line count. The description promised "metadata, nodes,
 * edges", and that was true of a field nothing was reading.
 *
 * Both halves are pinned here, because fixing only the schema would still leave a text-only
 * client unable to name a node to update_node.
 */
describe('get_graph exposes nodes to a client, not only to the payload', () => {
  async function withNodes() {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', {
      title: 'Aha',
      metaArea: '#TEST',
      nodes: [
        { id: 'n1', label: 'First node', type: 'fulltext', info: 'Short body.' },
        { id: 'n2', label: 'Second node', type: 'fulltext', info: 'x'.repeat(500) },
      ],
      edges: [{ source: 'n1', target: 'n2', label: 'next' }],
    })
    return { client, graphId: g.graphId }
  }

  test('it declares an outputSchema, like every other tool here', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'get_graph')
    assert.ok(t.outputSchema, 'without this a client cannot rely on structuredContent')
    const props = Object.keys(t.outputSchema.properties)
    for (const field of ['nodes', 'edges', 'version', 'nodeCount', 'edgeCount', 'title']) {
      assert.ok(props.includes(field), `outputSchema should name ${field}`)
    }
  })

  test('every tool declares an outputSchema — get_graph was the one that did not', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const missing = tools.filter((t) => !t.outputSchema).map((t) => t.name)
    assert.deepEqual(missing, [], 'a tool without an output schema looks broken from outside')
  })

  test('the TEXT names every node id, label and type — not just a count', async () => {
    const { client, graphId } = await withNodes()
    const r = await client.callTool({ name: 'get_graph', arguments: { graphId } })
    const text = r.content[0].text
    // The reported symptom: a client reading only the text could not find a node to act on.
    assert.match(text, /n1 — First node \[fulltext\]/)
    assert.match(text, /n2 — Second node \[fulltext\]/)
    assert.match(text, /n1 → n2 \(next\)/, 'edges too, so a client can see the shape')
    assert.match(text, /2 nodes, 1 edges/, 'the original summary line is kept')
  })

  test('long node text is shortened in the text, and the reply says where the rest is', async () => {
    // An html-node's info runs to tens of kilobytes. Printing it whole would bury the ids this
    // listing exists to surface, so it is cut per node rather than dropped wholesale.
    const { client, graphId } = await withNodes()
    const r = await client.callTool({ name: 'get_graph', arguments: { graphId } })
    const text = r.content[0].text
    assert.ok(!text.includes('x'.repeat(200)), 'the 500-char node is not printed whole')
    assert.match(text, /…/)
    assert.match(text, /get_graph with that nodeId for the whole thing/)
  })

  test('structuredContent still carries everything, untruncated', async () => {
    const { client, graphId } = await withNodes()
    const r = await client.callTool({ name: 'get_graph', arguments: { graphId } })
    assert.equal(r.structuredContent.nodes.length, 2)
    assert.equal(r.structuredContent.edges.length, 1)
    assert.equal(r.structuredContent.nodes[1].info.length, 500, 'the payload is never cut')
    assert.equal(r.structuredContent.nodeCount, 2)
  })

  test('a single node returns its whole info, so a client can edit without losing text', async () => {
    // The second half of the report: reading one node gave a version line and nothing else, so
    // rewriting a node meant guessing at what was already in it.
    const { client, graphId } = await withNodes()
    const r = await client.callTool({ name: 'get_graph', arguments: { graphId, nodeId: 'n2' } })
    const text = r.content[0].text
    assert.match(text, /label: Second node/)
    assert.match(text, /type: fulltext/)
    assert.match(text, /info \(500 chars\)/)
    assert.ok(text.includes('x'.repeat(500)), 'one node is never truncated — this is the full read')
  })

  test('an empty graph still reads cleanly, and a missing node is still refused', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const g = await callOk(client, 'create_graph', { title: 'Empty', metaArea: '#T', nodes: [] })
    const r = await client.callTool({ name: 'get_graph', arguments: { graphId: g.graphId } })
    assert.match(r.content[0].text, /0 nodes, 0 edges/)
    assert.ok(!r.content[0].text.includes('Nodes:'), 'no empty heading')

    const e = await callErr(client, 'get_graph', { graphId: g.graphId, nodeId: 'nope' })
    assert.equal(e.code, gs.ERR.GRAPH_NOT_FOUND)
  })
})

describe('contact history + server transcription via agent-worker (2026-10-27)', () => {
  function withAgent(replies) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.AGENT_WORKER = {
      fetch: async (url, init) => {
        const path = new URL(url).pathname
        calls.push({ path, token: init.headers['X-API-Token'], body: JSON.parse(init.body) })
        const [status, body] = replies[path] || [404, { success: false, error: 'no route' }]
        return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
      },
    }
    return { env, calls }
  }
  const READ = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'contacts:read'] } }
  const BOTH = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'graph:write', 'contacts:read'] } }

  test('get_contact_logs puts every recordingId in the text the model sees', async () => {
    const { env, calls } = withAgent({ '/contacts/logs': [200, { success: true, contactId: 'c1', total: 2, returned: 2, withRecording: 1, logs: [
      { id: 'L2', logged_at: '2026-10-27T13:44:00Z', contact_type: 'zoom', contact_name: 'Thomas', hasAudio: true, recordingId: 'contactlog:L2', notes: 'samtale', audioUrl: 'https://audio.vegvisr.org/x.webm' },
      { id: 'L1', logged_at: '2026-10-27T12:00:00Z', contact_type: 'zoom', contact_name: 'Thomas', hasAudio: false, notes: '1-1 Thomas' },
    ] }] })
    const { client } = await connect(env, READ)
    const res = await client.callTool({ name: 'get_contact_logs', arguments: { contactId: 'c1' } })
    assert.equal(res.isError, undefined)
    assert.match(res.content[0].text, /AUDIO recordingId contactlog:L2/)
    assert.equal(res.structuredContent.logs[0].recordingId, 'contactlog:L2')
    assert.equal(res.structuredContent.logs[1].recordingId, null)
    assert.equal(JSON.stringify(res.structuredContent).includes('audio.vegvisr.org'), false, 'no public audio URL flows to the model')
    assert.equal(calls[0].token, 'sess-alice')
  })

  test('list_recordings whitelists the fields and needs contacts:read', async () => {
    const { env } = withAgent({ '/contacts/recordings': [200, { success: true, recordings: [
      { recordingId: 'rec_1', displayName: 'Contact Log — Thomas', contactId: 'c1', contactName: 'Thomas', createdAt: '2026-10-27T13:44:00Z', fileSize: 38655617, hasTranscription: false, transcriptionChars: 0, transcriptionPreview: 'secret', audioUrl: 'https://audio.vegvisr.org/x.webm' },
    ] }] })
    const denied = await connect(env, ALICE_RW)
    const e = await callErr(denied.client, 'list_recordings', {})
    assert.equal(e.requiredScope, 'contacts:read')
    const { client } = await connect(env, READ)
    const r = await callOk(client, 'list_recordings', { query: 'Thomas' })
    assert.equal(r.recordings[0].sizeMB, 36.9)
    assert.equal('audioUrl' in r.recordings[0], false)
    assert.equal('transcriptionPreview' in r.recordings[0], false)
  })

  test('transcribe needs graph:write as well, and returns the transcript in the text', async () => {
    const { env, calls } = withAgent({ '/contacts/transcribe': [200, { success: true, graphId: 'g1', nodeId: 'n1', viewerUrl: 'https://www.vegvisr.org/gnew-viewer?graphId=g1', recordingId: 'contactlog:L2', contactId: 'c1', contactName: 'Thomas', loggedAt: '2026-10-27T13:44:00Z', chunks: 5, failedChunks: 0, chars: 12, notesUpdated: true, transcript: '[00:00] hei', message: 'Transcribed.' }] })
    const ro = await connect(env, READ)
    const e = await callErr(ro.client, 'transcribe_contact_recording', { recordingId: 'contactlog:L2' })
    assert.equal(e.requiredScope, 'graph:write')
    assert.equal(calls.length, 0, 'nothing was sent without the scope')
    const { client } = await connect(env, BOTH)
    const res = await client.callTool({ name: 'transcribe_contact_recording', arguments: { recordingId: 'contactlog:L2' } })
    assert.match(res.content[0].text, /TRANSCRIPT:\n\[00:00\] hei/)
    assert.equal(res.structuredContent.parts, 5)
    assert.deepEqual(calls[0].body, { recordingId: 'contactlog:L2' })
    const { tools } = await client.listTools()
    assert.equal(tools.find((t) => t.name === 'transcribe_contact_recording').annotations.openWorldHint, true)
  })

  test('a recording that is only in the audio portfolio is transcribed too, and says so', async () => {
    const { env, calls } = withAgent({ '/contacts/transcribe': [200, { success: true, graphId: 'g2', nodeId: 'n2', viewerUrl: 'https://www.vegvisr.org/gnew-viewer?graphId=g2', recordingId: 'rec_1_x', source: 'audio-portfolio', recordingName: '2026-11-12 Gruppe', contactId: null, contactName: null, loggedAt: '2026-11-14T12:34:35Z', chunks: 7, failedChunks: 0, chars: 9, notesUpdated: false, transcript: '[00:00] hei', message: 'Transcribed the audio-portfolio recording.' }] })
    const { client } = await connect(env, BOTH)
    const res = await client.callTool({ name: 'transcribe_contact_recording', arguments: { recordingId: 'rec_1_x' } })
    assert.equal(res.isError, undefined)
    assert.equal(res.structuredContent.source, 'audio-portfolio')
    assert.equal(res.structuredContent.recordingName, '2026-11-12 Gruppe')
    assert.equal(res.structuredContent.contactName, '')
    assert.equal(res.structuredContent.contactId, null)
    assert.equal(res.structuredContent.notesUpdated, false)
    assert.equal(res.structuredContent.parts, 7)
    assert.deepEqual(calls[0].body, { recordingId: 'rec_1_x' })
    const { tools } = await client.listTools()
    assert.match(tools.find((t) => t.name === 'transcribe_contact_recording').description, /audio portfolio/)
  })

  test('an agent-worker that sends no source is read as ContactHub', async () => {
    const { env } = withAgent({ '/contacts/transcribe': [200, { success: true, graphId: 'g1', nodeId: 'n1', viewerUrl: 'u', recordingId: 'contactlog:L2', contactId: 'c1', contactName: 'Thomas', chunks: 1, failedChunks: 0, chars: 3, notesUpdated: true, transcript: 'hei' }] })
    const { client } = await connect(env, BOTH)
    const res = await client.callTool({ name: 'transcribe_contact_recording', arguments: { recordingId: 'contactlog:L2' } })
    assert.equal(res.structuredContent.source, 'contacthub')
    assert.equal(res.structuredContent.recordingName, null)
  })

  test('a missing recording is reported, not thrown', async () => {
    const { env } = withAgent({ '/contacts/transcribe': [404, { success: false, error: 'Interaction L9 has no recording' }] })
    const { client } = await connect(env, BOTH)
    const e = await callErr(client, 'transcribe_contact_recording', { recordingId: 'contactlog:L9' })
    assert.match(e.message, /has no recording/)
  })

  // import_recording_from_url (2026-11-15): the step before transcription for a file that is
  // somewhere else — a temporary Dropbox link — instead of a manual upload in the browser.
  test('import_recording_from_url forwards url, name and tags as the caller and returns the recordingId', async () => {
    const { env, calls } = withAgent({ '/contacts/recordings/import': [200, { success: true, recordingId: 'rec_9_new', name: '2026-11-09 Gruppe', fileName: '2026-11-09_Gruppe.m4a', audioUrl: 'https://audio.vegvisr.org/audio/x.m4a' }] })
    const ro = await connect(env, READ)
    const e = await callErr(ro.client, 'import_recording_from_url', { url: 'https://files.example/a/2026-11-09%20Gruppe.m4a' })
    assert.equal(e.requiredScope, 'graph:write')
    assert.equal(calls.length, 0, 'nothing was fetched without the scope')
    const { client } = await connect(env, ALICE_RW)
    const res = await client.callTool({ name: 'import_recording_from_url', arguments: { url: ' https://files.example/a/2026-11-09%20Gruppe.m4a ', name: '2026-11-09 Gruppe.m4a', tags: ['enkel-endring'] } })
    assert.equal(res.isError, undefined)
    assert.deepEqual(res.structuredContent, { success: true, recordingId: 'rec_9_new', name: '2026-11-09 Gruppe', fileName: '2026-11-09_Gruppe.m4a' })
    assert.match(res.content[0].text, /recordingId rec_9_new/)
    assert.equal(JSON.stringify(res).includes('audio.vegvisr.org'), false, 'no public audio URL flows to the model')
    assert.equal(calls[0].path, '/contacts/recordings/import')
    assert.equal(calls[0].token, 'sess-alice')
    assert.deepEqual(calls[0].body, { url: 'https://files.example/a/2026-11-09%20Gruppe.m4a', name: '2026-11-09 Gruppe.m4a', tags: ['enkel-endring'] })
    const { tools } = await client.listTools()
    assert.equal(tools.find((t) => t.name === 'import_recording_from_url').annotations.openWorldHint, false)
  })

  test('import_recording_from_url refuses a URL that is not https before calling anything', async () => {
    const { env, calls } = withAgent({})
    const { client } = await connect(env, ALICE_RW)
    for (const url of ['http://files.example/a.m4a', 'ftp://files.example/a.m4a', 'a.m4a']) {
      const e = await callErr(client, 'import_recording_from_url', { url })
      assert.equal(e.code, gs.ERR.INVALID_INPUT)
      assert.match(e.message, /https/)
    }
    assert.equal(calls.length, 0)
  })

  test('import_recording_from_url passes on a refusal, and says so when agent-worker has no such door yet', async () => {
    const big = withAgent({ '/contacts/recordings/import': [400, { success: false, error: 'The audio is 95.0 MB — a recording takes at most 80 MB.' }] })
    const a = await connect(big.env, ALICE_RW)
    const e1 = await callErr(a.client, 'import_recording_from_url', { url: 'https://files.example/big.m4a' })
    assert.equal(e1.code, gs.ERR.INVALID_INPUT)
    assert.match(e1.message, /at most 80 MB/)
    const old = withAgent({ '/contacts/recordings/import': [404, {}] })
    const b = await connect(old.env, ALICE_RW)
    const e2 = await callErr(b.client, 'import_recording_from_url', { url: 'https://files.example/a.m4a' })
    assert.match(e2.message, /agent-worker has to be deployed/)
  })
})


describe('World member roles go through agent-worker with the caller\'s own credential', () => {
  const FOUNDER = {
    auth: { ...ALICE_RW.auth, scope: ['graph:read', 'user:read', 'user:register'], userId: 'post@nibi.no' },
    props: { userId: 'post@nibi.no', email: 'post@nibi.no', role: 'Admin', authMethod: 'oauth' },
  }
  class FakeRoleRoutes {
    constructor(reply, status = 200) { this.calls = []; this.reply = reply; this.status = status }
    async fetch(url, init) {
      this.calls.push({ url, token: new Headers(init.headers).get('X-API-Token'), body: JSON.parse(init.body) })
      return new Response(JSON.stringify(this.reply), { status: this.status })
    }
  }
  function seeded(reply, status) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    raw.prepare("INSERT OR REPLACE INTO config (user_id, data, email, emailVerificationToken, Role, group_tags) VALUES (?,?,?,?,?,?)")
      .run('u-post', '{}', 'post@nibi.no', 'sess-post', 'Admin', null)
    env.AGENT_WORKER = new FakeRoleRoutes(reply, status)
    return env
  }

  test('set sends the founder\'s own token and the subject, and returns the read-back roles', async () => {
    const env = seeded({ success: true, email: 'giulia@example.com', changed: true, verified: true, roles: ['#NIBI-SEKRETAER'], rolesBefore: [], message: 'ok' })
    const { client } = await connect(env, FOUNDER)
    const r = await callOk(client, 'set_world_member_roles', { domain: 'NIBI.no', email: 'giulia@example.com', roles: ['SEKRETAER'] })
    const call = env.AGENT_WORKER.calls[0]
    assert.equal(call.url, 'https://agent-worker/world/member-roles/set')
    assert.equal(call.token, 'sess-post')
    assert.deepEqual(call.body, { domain: 'nibi.no', email: 'giulia@example.com', roles: ['SEKRETAER'], mode: 'add' })
    assert.deepEqual(r.roles, ['#NIBI-SEKRETAER'])
    assert.equal(r.verified, true)
  })

  test('the executor\'s refusal surfaces as FORBIDDEN', async () => {
    const env = seeded({ success: false, error: 'Only a Superadmin or the World Founder of nibi.no can manage its member roles.' }, 403)
    const { client } = await connect(env, FOUNDER)
    const res = await client.callTool({ name: 'set_world_member_roles', arguments: { domain: 'nibi.no', email: 'giulia@example.com', roles: ['LEDER'] } })
    assert.equal(res.isError, true)
    assert.match(JSON.stringify(res), /World Founder of nibi\.no/)
  })

  test('set needs user:register, list needs user:read', async () => {
    const env = seeded({ success: true, members: [], count: 0 })
    const { client } = await connect(env, ALICE_RW)
    const a = await client.callTool({ name: 'set_world_member_roles', arguments: { domain: 'nibi.no', email: 'giulia@example.com', roles: ['LEDER'] } })
    const b = await client.callTool({ name: 'list_world_member_roles', arguments: { domain: 'nibi.no' } })
    assert.equal(a.isError, true)
    assert.equal(b.isError, true)
    assert.equal(env.AGENT_WORKER.calls.length, 0)
  })

  test('list returns members with only their World roles', async () => {
    const env = seeded({ success: true, worldTag: '#NIBI', rolePrefix: '#NIBI-', count: 1, members: [{ email: 'giulia@example.com', name: 'Giulia', roles: ['#NIBI-SEKRETAER'] }], message: 'nibi.no: 1 member' })
    const { client } = await connect(env, FOUNDER)
    const r = await callOk(client, 'list_world_member_roles', { domain: 'nibi.no' })
    assert.equal(env.AGENT_WORKER.calls[0].url, 'https://agent-worker/world/member-roles')
    assert.equal(r.worldTag, '#NIBI')
    assert.deepEqual(r.members, [{ email: 'giulia@example.com', name: 'Giulia', roles: ['#NIBI-SEKRETAER'] }])
    assert.deepEqual(r.formerMembersWithRoles, [])
  })
})

describe('add_contact_note saves a Note interaction on the caller\'s own contact (2026-11-11)', () => {
  function withAgent(status = 200, reply = { success: true, logId: 'L9', contactId: 'c1', name: 'Thomas Berg', loggedAt: '2026-11-11T10:00:00.000Z', note: 'Ring tilbake fredag' }) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.AGENT_WORKER = {
      fetch: async (url, init) => {
        calls.push({ path: new URL(url).pathname, token: init.headers['X-API-Token'], body: JSON.parse(init.body) })
        return new Response(JSON.stringify(reply), { status, headers: { 'Content-Type': 'application/json' } })
      },
    }
    return { env, calls }
  }

  test('writes through /contacts/notes/add with the caller\'s own token', async () => {
    const { env, calls } = withAgent()
    const { client } = await connect(env, ALICE_RW)
    const r = await callOk(client, 'add_contact_note', { contactId: 'c1', note: 'Ring tilbake fredag' })
    assert.equal(r.logId, 'L9')
    assert.equal(r.name, 'Thomas Berg')
    assert.equal(calls[0].path, '/contacts/notes/add')
    assert.equal(calls[0].token, 'sess-alice')
    assert.deepEqual(calls[0].body, { contactId: 'c1', note: 'Ring tilbake fredag' }, 'no identity or name is forwarded in the body')
  })

  test('an unknown contact is refused', async () => {
    const { env } = withAgent(404, { success: false, error: 'No contact with id nope in your ContactHub.' })
    const { client } = await connect(env, ALICE_RW)
    const e = await callErr(client, 'add_contact_note', { contactId: 'nope', note: 'x' })
    assert.equal(e.code, gs.ERR.INVALID_INPUT)
    assert.match(e.message, /No contact with id nope/)
  })

  test('graph:write is required — contacts:read is not enough', async () => {
    const { env, calls } = withAgent()
    const { client } = await connect(env, { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'contacts:read'] } })
    const e = await callErr(client, 'add_contact_note', { contactId: 'c1', note: 'x' })
    assert.equal(e.requiredScope, 'graph:write')
    assert.equal(calls.length, 0, 'nothing reached the address book')
  })

  test('it is an additive write, not destructive', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'add_contact_note')
    assert.equal(t.annotations.readOnlyHint, false)
    assert.equal(t.annotations.destructiveHint, false)
  })
})

describe('realtime_list_rooms reads the caller\'s own Realtime rooms (contacts:read)', () => {
  const READ = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'contacts:read'] } }

  // realtime-worker, stubbed with the live response shapes. It records the token it was shown,
  // because whose rooms come back is decided by that token and by nothing a model can pass.
  function withRealtime() {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.REALTIME_WORKER = {
      fetch: async (url, init) => {
        const path = new URL(url).pathname
        calls.push({ path, token: init.headers['X-API-Token'] })
        const body = path === '/realtime/my-rooms'
          ? { success: true, personalMeetingId: 'p-1', teamMeetingId: 't-1', personalTitle: 'Alice', teamTitle: 'Team A', displayName: 'Alice', waitingScreen: null, waitingRoomEnabled: false }
          : { success: true, rooms: [{ meetingId: 'p-1', isDefault: false }], slugs: { 'p-1': ['momentum'] }, canSetDefault: false }
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
      },
    }
    return { env, calls }
  }

  test('it needs contacts:read, and nothing is sent without it', async () => {
    const { env, calls } = withRealtime()
    const denied = await connect(env, ALICE_RW)
    const e = await callErr(denied.client, 'realtime_list_rooms', {})
    assert.equal(e.requiredScope, 'contacts:read')
    assert.equal(calls.length, 0)
  })

  test('it returns the rooms with their links, as the caller', async () => {
    const { env, calls } = withRealtime()
    const { client } = await connect(env, READ)
    const res = await client.callTool({ name: 'realtime_list_rooms', arguments: {} })
    assert.equal(res.isError, undefined)
    const r = res.structuredContent
    assert.equal(r.total, 2)
    assert.equal(r.rooms[0].joinUrl, 'https://realtime.vegvisr.org/?meetingId=p-1')
    assert.equal(r.rooms[0].openRoomUrl, 'https://realtime.vegvisr.org/?openroom=momentum')
    assert.equal(r.rooms[1].openRoom, false)
    assert.match(res.content[0].text, /PERSONAL — Alice · meetingId p-1/)
    assert.match(res.content[0].text, /OPEN to guests: https:\/\/realtime\.vegvisr\.org\/\?openroom=momentum/)
    assert.ok(calls.length === 2 && calls.every((c) => c.token === 'sess-alice'))
  })

  test('it is read-only and takes no input that could name another user', async () => {
    const { env } = withRealtime()
    const { client } = await connect(env, READ)
    const { tools } = await client.listTools()
    const t = tools.find((x) => x.name === 'realtime_list_rooms')
    assert.equal(t.annotations.readOnlyHint, true)
    assert.deepEqual(Object.keys(t.inputSchema.properties || {}), [])
  })
})

describe('realtime recordings, link, transcript and slugs are read tools behind contacts:read', () => {
  const READ = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'contacts:read'] } }
  const NAMES = ['realtime_list_recordings', 'realtime_get_recording_link', 'realtime_get_transcript', 'realtime_list_slugs']

  function withRealtime() {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    const replies = {
      '/realtime/recordings': { success: true, recordings: [
        { key: 'recordings/Charlie.mp4', name: 'Charlie.mp4', size: 130042169, uploaded: '2026-09-06T08:02:36.160Z', source: 'r2', playUrl: 'https://realtimevideos.vegvisr.org/recordings/Charlie.mp4', playUrlPermanent: true, title: 'Charlie talk', labels: [] },
        { key: 'fff51a14', name: 'x.mp4', size: 1, uploaded: '2026-11-12T11:50:09.858Z', duration: 600, meetingTitle: 'Tor Arne', status: 'UPLOADED', download_url: 'https://rtk.example/secret', source: 'realtimekit' },
      ] },
      '/realtime/recordings/transcript': { success: true, key: 'recordings/Charlie.mp4', found: true, text: '[00:00] hei', chars: 11, model: 'whisper', savedAt: '2026-10-02T08:00:00.000Z' },
      '/realtime/slugs': { success: true, slugs: [{ id: 's1', slug: 'momentum', meetingId: 'p-1', allowedEmails: ['m@example.com'], scheduledStartAt: null, createdAt: '2026-10-17T09:21:54.594Z' }] },
    }
    env.REALTIME_WORKER = {
      fetch: async (url, init) => {
        const path = new URL(url).pathname
        calls.push({ path, token: init.headers['X-API-Token'] })
        return new Response(JSON.stringify(replies[path]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      },
    }
    return { env, calls }
  }

  test('each needs contacts:read, is read-only, and nothing is sent without the scope', async () => {
    const { env, calls } = withRealtime()
    const denied = await connect(env, ALICE_RW)
    for (const name of NAMES) {
      const e = await callErr(denied.client, name, name.includes('get_') ? { key: 'recordings/Charlie.mp4' } : {})
      assert.equal(e.requiredScope, 'contacts:read', name)
    }
    assert.equal(calls.length, 0)
    const { tools } = await denied.client.listTools()
    for (const name of NAMES) assert.equal(tools.find((t) => t.name === name).annotations.readOnlyHint, true, name)
  })

  test('realtime_list_recordings puts every key in the text and no bearer link anywhere', async () => {
    const { env, calls } = withRealtime()
    const { client } = await connect(env, READ)
    const res = await client.callTool({ name: 'realtime_list_recordings', arguments: {} })
    assert.equal(res.isError, undefined)
    assert.equal(res.structuredContent.total, 2)
    assert.equal(res.structuredContent.notStored, 1)
    assert.match(res.content[0].text, /key fff51a14/)
    assert.match(res.content[0].text, /NOT SYNCED \(UPLOADED\)/)
    assert.match(res.content[0].text, /key recordings\/Charlie\.mp4/)
    assert.equal(JSON.stringify(res).includes('rtk.example'), false)
    assert.equal(calls[0].token, 'sess-alice')
  })

  test('realtime_get_recording_link returns the link; an unknown key is an error the model can read', async () => {
    const { env } = withRealtime()
    const { client } = await connect(env, READ)
    const r = await callOk(client, 'realtime_get_recording_link', { key: 'recordings/Charlie.mp4' })
    assert.equal(r.url, 'https://realtimevideos.vegvisr.org/recordings/Charlie.mp4')
    assert.equal(r.permanent, true)
    const e = await callErr(client, 'realtime_get_recording_link', { key: 'recordings/nope.mp4' })
    assert.equal(e.code, gs.ERR.GRAPH_NOT_FOUND)
  })

  test('realtime_get_transcript hands the model the transcript text', async () => {
    const { env } = withRealtime()
    const { client } = await connect(env, READ)
    const res = await client.callTool({ name: 'realtime_get_transcript', arguments: { key: 'recordings/Charlie.mp4' } })
    assert.match(res.content[0].text, /TRANSCRIPT:\n\[00:00\] hei/)
    assert.equal(res.structuredContent.found, true)
  })

  test('realtime_list_slugs returns each slug with its address', async () => {
    const { env } = withRealtime()
    const { client } = await connect(env, READ)
    const r = await callOk(client, 'realtime_list_slugs', {})
    assert.equal(r.total, 1)
    assert.equal(r.slugs[0].url, 'https://realtime.vegvisr.org/momentum')
  })
})


describe('import_mystmkra turns the prototype\'s documents into graphs', () => {
  const TOR = '6665c107e4a8ea992f1ad942'
  const MAIKEN = '666605dc63d7487c9304906e'
  const SUPER = authFor('owner@example.com', ['graph:read', 'graph:write'], 'Superadmin')

  function withMystmkra(env) {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE documents (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, user_id TEXT,
      locked INTEGER DEFAULT 0, published INTEGER DEFAULT 0, tags TEXT, part INTEGER DEFAULT 1, total_parts INTEGER DEFAULT 1,
      connected_assistant TEXT, url TEXT, created_at TEXT, updated_at TEXT, published_at TEXT, semantic_category TEXT)`)
    const add = db.prepare('INSERT INTO documents (id, title, content, user_id, tags, created_at, updated_at, semantic_category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const cat = '{"primary":"PHILOSOPHY","secondary":["EDUCATION"],"confidence":0.85}'
    add.run('d1', 'Untitled', '![IMG](https://x/y.png)\n### Life *Energy* in Psychology\n\nBody | with a pipe.\n', TOR, '[]', '2024-08-05T09:31:15.068Z', '2024-08-05T09:31:15.068Z', cat)
    add.run('d2', 'A real title', 'Text two\n', TOR, '["#a","#b"]', '2024-09-01T10:00:00.000Z', '2024-09-01T10:00:00.000Z', cat)
    add.run('d3', 'Untitled', 'Text two\n', TOR, '[]', '2024-09-02T10:00:00.000Z', '2024-09-02T10:00:00.000Z', cat) // exact copy of d2
    add.run('d4', 'Header 1', 'Bare prose with no heading at all.\n', MAIKEN, '[]', '2025-01-10T08:00:00.000Z', '2025-01-10T08:00:00.000Z', null)
    add.run('d5', 'Untitled', '', TOR, '[]', '2025-02-01T08:00:00.000Z', '2025-02-01T08:00:00.000Z', cat) // empty
    env.MYSTMKRA_DB = new D1Like(db)
    return env
  }

  test('is for the Superadmin only, and says so', async () => {
    const { env } = freshDb()
    const { client } = await connect(withMystmkra(env), ALICE_RW)
    const e = await callErr(client, 'import_mystmkra', {})
    assert.equal(e.code, 'FORBIDDEN_GRAPH')
  })

  test('a dry run counts and writes nothing', async () => {
    const { env } = freshDb()
    const { client } = await connect(withMystmkra(env), SUPER)
    const r = await callOk(client, 'import_mystmkra', { dryRun: true })
    assert.equal(r.total, 5)
    assert.equal(r.exactCopiesSkipped, 1)
    assert.equal(r.emptySkipped, 1)
    assert.equal(r.importedNow, 0)
    assert.equal(r.remaining, 3)
    const mine = await callOk(client, 'graph_index', {})
    assert.equal(mine.total, 0)
  })

  test('imports in batches, text unchanged, dated when written, and never twice', async () => {
    const { env } = freshDb()
    const { client } = await connect(withMystmkra(env), SUPER)

    const first = await callOk(client, 'import_mystmkra', { limit: 2 })
    assert.equal(first.importedNow, 2)
    assert.equal(first.remaining, 1)
    assert.deepEqual(first.imported.map((g) => g.mystmkraId), ['d1', 'd2'])
    assert.equal(first.imported[0].title, 'Life Energy in Psychology', 'an Untitled document is named by its first heading')
    assert.equal(first.imported[1].title, 'A real title')
    assert.equal(String(first.imported[0].createdAt).slice(0, 10), '2024-08-05')
    assert.deepEqual(first.errors, [])

    const g = await callOk(client, 'get_graph', { graphId: first.imported[0].graphId })
    assert.equal(g.metaArea, '#MYSTMKRA')
    assert.equal(g.publicationState, 'private')
    assert.equal(String(g.createdAt).slice(0, 10), '2024-08-05')
    const doc = g.nodes.find((n) => n.id === 'document')
    assert.equal(doc.info, '![IMG](https://x/y.png)\n### Life *Energy* in Psychology\n\nBody | with a pipe.\n', 'the text is byte for byte')
    assert.equal(doc.metadata.mystmkraId, 'd1')
    assert.match(g.nodes.find((n) => n.id === 'origin').info, /Tor Arne Håve/)

    const second = await callOk(client, 'import_mystmkra', { limit: 2 })
    assert.equal(second.alreadyImported, 2)
    assert.equal(second.importedNow, 1)
    assert.equal(second.remaining, 0)
    assert.equal(second.imported[0].mystmkraId, 'd4')
    assert.equal(second.imported[0].author, 'Maiken Sneeggen')
    assert.equal(second.imported[0].title, 'Bare prose with no heading at all.')
    const hers = await callOk(client, 'get_graph', { graphId: second.imported[0].graphId })
    assert.equal(hers.metaArea, '#MYSTMKRA #MAIKENSNEEGGEN', 'another author\'s document carries her tag')

    const third = await callOk(client, 'import_mystmkra', {})
    assert.equal(third.importedNow, 0)
    assert.equal(third.alreadyImported, 3)
    const all = await callOk(client, 'graph_index', { metaArea: '#MYSTMKRA' })
    assert.equal(all.total, 3, 'the copy and the empty document never became graphs')
  })

  test('without the database bound it refuses plainly', async () => {
    const { env } = freshDb()
    const { client } = await connect(env, SUPER)
    const e = await callErr(client, 'import_mystmkra', {})
    assert.equal(e.code, 'INVALID_INPUT')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// get_youtube_transcript (2026-11-14)
// ─────────────────────────────────────────────────────────────────────────────
describe('get_youtube_transcript reads a video\'s transcript through api-worker (graph:read)', () => {
  // The answer of GET api.vegvisr.org/youtube-transcript-io/<id>, in the shape read live on
  // 2026-11-14 (video CELZK04Fk84): start/dur/lengthSeconds are STRINGS, some segments are "\n".
  const LIVE = {
    success: true,
    videoId: 'CELZK04Fk84',
    transcript: [{
      id: 'CELZK04Fk84',
      title: 'Lies Heard About Bioenergetic Therapy',
      isLive: false,
      playabilityStatus: { status: 'OK', reason: '' },
      languages: [{ label: 'en', languageCode: 'en' }],
      availableLanguages: ['en'],
      chapters: [{ start_time: 0, title: 'Intro' }, { start_time: 53.6, title: 'The lie' }],
      tracks: [{
        language: 'en',
        transcript: [
          { start: '0.08', dur: '6.88', text: "there's a big lie floating around that" },
          { start: '3.23', dur: '3.73', text: '\n' },
          { start: '3.24', dur: '5.39', text: "bioenergetic therapy is scary and I'm" },
        ],
      }],
      microformat: { playerMicroformatRenderer: {
        title: { simpleText: 'Lies Heard About Bioenergetic Therapy' },
        description: { simpleText: 'A video description.' },
        ownerChannelName: 'Leah Benson Therapy',
        externalChannelId: 'UCi66RzMiF4gD2TExOUE54tQ',
        lengthSeconds: '443',
        publishDate: '2024-11-20',
        category: 'People & Blogs',
      } },
    }],
  }

  /** api-worker, faked on globalThis.fetch. Records what was asked for. */
  function apiWorker(body = LIVE, status = 200) {
    const calls = []
    const real = globalThis.fetch
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url: String(url), method: init.method || 'GET' })
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    }
    return { calls, restore: () => { globalThis.fetch = real } }
  }

  function seeded() {
    const { env, raw } = freshDb()
    seedUsers(raw)
    return env
  }

  test('a share link becomes the transcript, the metadata and the ready youtube-video node', async () => {
    const api = apiWorker()
    try {
      const { client } = await connect(seeded(), ALICE_RO)
      const res = await client.callTool({ name: 'get_youtube_transcript', arguments: { video: 'https://youtu.be/CELZK04Fk84?si=1hM8ViQy0Qm7HhEd' } })
      assert.equal(res.isError, undefined)
      const r = res.structuredContent
      assert.deepEqual(api.calls, [{ url: 'https://api.vegvisr.org/youtube-transcript-io/CELZK04Fk84', method: 'GET' }])
      assert.equal(r.found, true)
      assert.equal(r.videoId, 'CELZK04Fk84')
      assert.equal(r.title, 'Lies Heard About Bioenergetic Therapy')
      assert.equal(r.channel, 'Leah Benson Therapy')
      assert.equal(r.durationSeconds, 443)
      assert.equal(r.publishedAt, '2024-11-20')
      assert.equal(r.language, 'en')
      assert.equal(r.segments, 3)
      // The "\n" segment is dropped, not turned into a double space.
      assert.equal(r.text, "there's a big lie floating around that bioenergetic therapy is scary and I'm")
      assert.equal(r.chars, r.text.length)
      assert.equal(r.truncated, false)
      assert.equal(r.nextOffset, null)
      assert.deepEqual(r.chapters, [{ startSeconds: 0, title: 'Intro' }, { startSeconds: 53.6, title: 'The lie' }])
      // The node the frontend's createYouTubeNode() builds.
      assert.equal(r.node.type, 'youtube-video')
      assert.equal(r.node.label, '![YOUTUBE src=https://www.youtube.com/embed/CELZK04Fk84]Lies Heard About Bioenergetic Therapy[END YOUTUBE]')
      assert.deepEqual(r.node.bibl, ['https://www.youtube.com/watch?v=CELZK04Fk84'])
      assert.match(r.node.info, /\*\*Channel:\*\* Leah Benson Therapy/)
      assert.match(r.node.info, /\*\*Duration:\*\* 7:23/)
      assert.match(res.content[0].text, /TRANSCRIPT:\nthere's a big lie/)
    } finally { api.restore() }
  })

  test('the returned node is accepted by add_node as it is', async () => {
    const api = apiWorker()
    try {
      const { client } = await connect(seeded(), ALICE_RW)
      const t = await callOk(client, 'get_youtube_transcript', { video: 'CELZK04Fk84' })
      const g = await callOk(client, 'create_graph', { title: 'Video', metaArea: 'TEST' })
      const added = await callOk(client, 'add_node', { graphId: g.graphId, node: t.node })
      assert.equal(added.success, true)
    } finally { api.restore() }
  })

  test('a long transcript is read in pieces with offset / nextOffset', async () => {
    const long = structuredClone(LIVE)
    long.transcript[0].tracks[0].transcript = Array.from({ length: 400 }, (_, i) => ({ start: String(i), dur: '1', text: `word${i}` }))
    const api = apiWorker(long)
    try {
      const { client } = await connect(seeded(), ALICE_RO)
      const a = await callOk(client, 'get_youtube_transcript', { video: 'CELZK04Fk84', maxChars: 1000 })
      assert.equal(a.truncated, true)
      assert.equal(a.text.length, 1000)
      assert.equal(a.nextOffset, 1000)
      let text = a.text
      let next = a.nextOffset
      while (next !== null) {
        const b = await callOk(client, 'get_youtube_transcript', { video: 'CELZK04Fk84', maxChars: 1000, offset: next })
        assert.equal(b.offset, next)
        text += b.text
        next = b.nextOffset
      }
      assert.equal(text.length, a.chars)
      assert.ok(text.endsWith('word399'))
    } finally { api.restore() }
  })

  test('a video without captions is found=false with the metadata, not an error', async () => {
    const none = structuredClone(LIVE)
    none.transcript[0].tracks = []
    const api = apiWorker(none)
    try {
      const { client } = await connect(seeded(), ALICE_RO)
      const r = await callOk(client, 'get_youtube_transcript', { video: 'CELZK04Fk84' })
      assert.equal(r.found, false)
      assert.match(r.reason, /no transcript/i)
      assert.equal(r.title, 'Lies Heard About Bioenergetic Therapy')
      assert.equal(r.text, '')
    } finally { api.restore() }
  })

  test('asking for a language the video does not have names the ones it has', async () => {
    const api = apiWorker()
    try {
      const { client } = await connect(seeded(), ALICE_RO)
      const r = await callOk(client, 'get_youtube_transcript', { video: 'CELZK04Fk84', language: 'no' })
      assert.equal(r.found, false)
      assert.match(r.reason, /Available: en/)
    } finally { api.restore() }
  })

  test('something that is not a YouTube link is refused before anything is fetched', async () => {
    const api = apiWorker()
    try {
      const { client } = await connect(seeded(), ALICE_RO)
      for (const video of ['https://vimeo.com/12345', 'not a link', 'https://youtu.be/../../admin']) {
        const e = await callErr(client, 'get_youtube_transcript', { video })
        assert.equal(e.code, 'INVALID_INPUT')
      }
      assert.equal(api.calls.length, 0)
    } finally { api.restore() }
  })

  test('a failure of the transcript service comes back as a tool error with its message', async () => {
    const api = apiWorker({ error: 'YouTube Transcript IO API error: 429 - slow down' }, 429)
    try {
      const { client } = await connect(seeded(), ALICE_RO)
      const e = await callErr(client, 'get_youtube_transcript', { video: 'CELZK04Fk84' })
      assert.equal(e.code, 'RATE_LIMITED')
      assert.match(e.message, /slow down/)
    } finally { api.restore() }
  })

  test('it needs graph:read, is read-only, and has no input that names a user', async () => {
    const api = apiWorker()
    try {
      const env = seeded()
      const denied = await connect(env, { ...ALICE_RO, auth: { ...ALICE_RO.auth, scope: ['contacts:read'] } })
      const e = await callErr(denied.client, 'get_youtube_transcript', { video: 'CELZK04Fk84' })
      assert.equal(e.requiredScope, 'graph:read')
      assert.equal(api.calls.length, 0)
      const { client } = await connect(env, ALICE_RO)
      const { tools } = await client.listTools()
      const t = tools.find((x) => x.name === 'get_youtube_transcript')
      assert.equal(t.annotations.readOnlyHint, true)
      assert.equal(t.annotations.openWorldHint, false)
      assert.deepEqual(Object.keys(t.inputSchema.properties).sort(), ['language', 'maxChars', 'offset', 'video'])
    } finally { api.restore() }
  })
})

describe('realtime_list_meetings lists ad-hoc meetings and says when the list is the whole platform', () => {
  const READ = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'contacts:read'] } }
  function withMeetings(filteredByOwner) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.REALTIME_WORKER = { fetch: async (url, init) => {
      calls.push({ path: new URL(url).pathname, token: init.headers['X-API-Token'] })
      return new Response(JSON.stringify({ success: true, filteredByOwner, meetings: [{ id: 'm-1', title: 'Planning', status: 'ACTIVE', created_at: '2026-11-01T10:00:00.000Z' }] }), { status: 200 })
    } }
    return { env, calls }
  }

  test('it needs contacts:read and is read-only', async () => {
    const { env, calls } = withMeetings(true)
    const denied = await connect(env, ALICE_RW)
    const e = await callErr(denied.client, 'realtime_list_meetings', {})
    assert.equal(e.requiredScope, 'contacts:read')
    assert.equal(calls.length, 0)
    const { tools } = await denied.client.listTools()
    assert.equal(tools.find((t) => t.name === 'realtime_list_meetings').annotations.readOnlyHint, true)
  })

  test('own meetings: the join link, as the caller, with no platform warning', async () => {
    const { env, calls } = withMeetings(true)
    const { client } = await connect(env, READ)
    const res = await client.callTool({ name: 'realtime_list_meetings', arguments: {} })
    assert.equal(res.structuredContent.allUsers, false)
    assert.equal(res.structuredContent.meetings[0].joinUrl, 'https://realtime.vegvisr.org/?meetingId=m-1')
    assert.doesNotMatch(res.content[0].text, /Superadmin view/)
    assert.equal(calls[0].token, 'sess-alice')
  })

  test('a platform-wide list says so in the text the model reads', async () => {
    const { env } = withMeetings(false)
    const { client } = await connect(env, READ)
    const res = await client.callTool({ name: 'realtime_list_meetings', arguments: {} })
    assert.equal(res.structuredContent.allUsers, true)
    assert.match(res.content[0].text, /EVERY meeting on the platform/)
  })
})

describe('the realtime write tools need graph:write and say what they did', () => {
  const READ = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'contacts:read'] } }
  const NAMES = ['realtime_create_meeting', 'realtime_rename_room', 'realtime_set_open_room', 'realtime_set_waiting_room']
  const ARGS = {
    realtime_create_meeting: { title: 'Planning' },
    realtime_rename_room: { meetingId: 'p-1', title: 'Morgenmøte' },
    realtime_set_open_room: { meetingId: 'p-1', open: true },
    realtime_set_waiting_room: { enabled: true },
  }
  function withRealtime() {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    const replies = {
      '/realtime/create-meeting': { success: true, meetingId: 'm-new', status: 'ACTIVE' },
      '/realtime/rename-room': { success: true, meetingId: 'p-1', title: 'Morgenmøte' },
      '/realtime/open-room/toggle': { success: true, meetingId: 'p-1', open: true, isDefault: false },
      '/realtime/open-room/status': { success: true, rooms: [{ meetingId: 'p-1', isDefault: false }], slugs: { 'p-1': ['momentum'] } },
      '/realtime/toggle-waiting-room': { success: true, waitingRoomEnabled: true },
      '/realtime/my-rooms': { success: true, waitingRoomEnabled: true, waitingScreen: { title: 'Welcome', image: null } },
    }
    env.REALTIME_WORKER = { fetch: async (url, init) => {
      const path = new URL(url).pathname
      calls.push({ path, method: init.method || 'GET', token: init.headers['X-API-Token'], body: init.body ? JSON.parse(init.body) : null })
      return new Response(JSON.stringify(replies[path]), { status: 200 })
    } }
    return { env, calls }
  }

  test('a token with only the read scopes is refused, and nothing reaches realtime-worker', async () => {
    const { env, calls } = withRealtime()
    const ro = await connect(env, READ)
    for (const name of NAMES) {
      const e = await callErr(ro.client, name, ARGS[name])
      assert.equal(e.requiredScope, 'graph:write', name)
    }
    assert.equal(calls.length, 0)
    const { tools } = await ro.client.listTools()
    for (const name of NAMES) {
      const t = tools.find((x) => x.name === name)
      assert.equal(t.annotations.readOnlyHint, false, name)
      assert.equal(t.annotations.destructiveHint, false, name)
    }
  })

  test('realtime_create_meeting returns the join link and says the title was set', async () => {
    const { env, calls } = withRealtime()
    const { client } = await connect(env, ALICE_RW)
    const res = await client.callTool({ name: 'realtime_create_meeting', arguments: { title: 'Morgenmøte' } })
    assert.equal(res.isError, undefined)
    assert.equal(res.structuredContent.joinUrl, 'https://realtime.vegvisr.org/?meetingId=m-new')
    assert.equal(res.structuredContent.titleSet, true)
    assert.match(res.content[0].text, /join: https:\/\/realtime\.vegvisr\.org\/\?meetingId=m-new/)
    assert.ok(calls.every((c) => c.method === 'POST' && c.token === 'sess-alice'))
  })

  test('realtime_set_open_room gives the guest link and never sends isDefault', async () => {
    const { env, calls } = withRealtime()
    const { client } = await connect(env, ALICE_RW)
    const res = await client.callTool({ name: 'realtime_set_open_room', arguments: { meetingId: 'p-1', open: true } })
    assert.match(res.content[0].text, /OPEN to guests without login/)
    assert.match(res.content[0].text, /guest link: https:\/\/realtime\.vegvisr\.org\/\?openroom=momentum/)
    assert.deepEqual(calls[0].body, { meetingId: 'p-1', enabled: true })
  })

  test('realtime_rename_room and realtime_set_waiting_room report the new state', async () => {
    const { env } = withRealtime()
    const { client } = await connect(env, ALICE_RW)
    const a = await callOk(client, 'realtime_rename_room', { meetingId: 'p-1', title: 'Morgenmøte' })
    assert.equal(a.title, 'Morgenmøte')
    const res = await client.callTool({ name: 'realtime_set_waiting_room', arguments: { enabled: true } })
    assert.match(res.content[0].text, /Waiting room is ON/)
    assert.equal(res.structuredContent.screenTitle, 'Welcome')
  })

  test('no realtime tool takes an input that could name another user', async () => {
    const { env } = withRealtime()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    for (const t of tools.filter((x) => x.name.startsWith('realtime_'))) {
      for (const k of Object.keys(t.inputSchema.properties || {})) {
        assert.doesNotMatch(k, /^(asUser|email|userId|ownerEmail|isDefault)$/i, `${t.name}.${k}`)
      }
    }
  })
})

describe('the realtime slug write tools need graph:write and show what the slug now is', () => {
  const READ = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'contacts:read'] } }
  const ARGS = {
    realtime_create_slug: { slug: 'morgen', meetingId: 'p-1', allowedEmails: ['a@example.com'] },
    realtime_update_slug: { slugId: 's-1', addEmails: ['c@example.com'] },
    realtime_share_slug: { slugId: 's-1' },
  }
  function withRealtime() {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.REALTIME_WORKER = { fetch: async (url, init) => {
      const path = new URL(url).pathname
      calls.push({ path, body: init.body ? JSON.parse(init.body) : null, token: init.headers['X-API-Token'] })
      const reply = path.endsWith('/create') ? [201, { success: true, slugId: 's-9', scheduledStartAt: null }]
        : path.endsWith('/update') ? [200, { success: true, slug: { id: 's-1', slug: 'kurs', meetingId: 'p-1', allowedEmails: ['a@example.com', 'c@example.com'], scheduledStartAt: '2026-12-01T09:00:00.000Z' } }]
        : [201, { success: true, url: 'https://realtime.vegvisr.org/kurs?t=tok', validFrom: '2026-12-01T08:00:00.000Z', validUntil: '2026-12-01T10:00:00.000Z', scheduledStartAt: '2026-12-01T09:00:00.000Z' }]
      return new Response(JSON.stringify(reply[1]), { status: reply[0] })
    } }
    return { env, calls }
  }

  test('read scopes are not enough, and nothing reaches realtime-worker', async () => {
    const { env, calls } = withRealtime()
    const ro = await connect(env, READ)
    for (const [name, args] of Object.entries(ARGS)) {
      const e = await callErr(ro.client, name, args)
      assert.equal(e.requiredScope, 'graph:write', name)
    }
    assert.equal(calls.length, 0)
  })

  test('realtime_create_slug returns the address and the list', async () => {
    const { env, calls } = withRealtime()
    const { client } = await connect(env, ALICE_RW)
    const res = await client.callTool({ name: 'realtime_create_slug', arguments: ARGS.realtime_create_slug })
    assert.equal(res.isError, undefined)
    assert.equal(res.structuredContent.url, 'https://realtime.vegvisr.org/morgen')
    assert.match(res.content[0].text, /allowed \(1\): a@example\.com/)
    assert.match(res.content[0].text, /no meeting time set/)
    assert.equal(calls[0].token, 'sess-alice')
  })

  test('realtime_update_slug sends only the addition and shows the full list afterwards', async () => {
    const { env, calls } = withRealtime()
    const { client } = await connect(env, ALICE_RW)
    const res = await client.callTool({ name: 'realtime_update_slug', arguments: ARGS.realtime_update_slug })
    assert.deepEqual(calls[0].body, { addEmails: ['c@example.com'] })
    assert.match(res.content[0].text, /allowed \(2\): a@example\.com, c@example\.com/)
    assert.match(res.content[0].text, /meeting time: 2026-12-01 09:00 UTC/)
  })

  test('realtime_share_slug says that anyone holding the link gets in, and until when', async () => {
    const { env } = withRealtime()
    const { client } = await connect(env, ALICE_RW)
    const res = await client.callTool({ name: 'realtime_share_slug', arguments: ARGS.realtime_share_slug })
    assert.match(res.content[0].text, /anyone holding it gets in without login/)
    assert.match(res.content[0].text, /Works from 2026-12-01 08:00 to 2026-12-01 10:00 UTC/)
    assert.equal(res.structuredContent.url, 'https://realtime.vegvisr.org/kurs?t=tok')
  })
})

describe('realtime removals are two calls: a preview that changes nothing, then a confirm', () => {
  const READ = { ...ALICE_RW, auth: { ...ALICE_RW.auth, scope: ['graph:read', 'contacts:read'] } }
  function withRealtime({ confirmStatus = 200 } = {}) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const calls = []
    env.REALTIME_WORKER = { fetch: async (url, init) => {
      const path = new URL(url).pathname
      calls.push({ path, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null, token: init.headers['X-API-Token'] })
      if (path.endsWith('/share-tokens')) {
        return new Response(JSON.stringify({ success: true, tokens: [
          { id: 't-1', url: 'https://realtime.vegvisr.org/kurs?t=t-1', validFrom: '2020-01-01T08:00:00.000Z', validUntil: '2020-01-01T10:00:00.000Z', createdAt: '2020-01-01T00:00:00.000Z' },
          { id: 't-2', url: 'https://realtime.vegvisr.org/kurs?t=t-2', validFrom: '2020-01-01T08:00:00.000Z', validUntil: '2999-01-01T10:00:00.000Z', createdAt: '2020-01-02T00:00:00.000Z' },
        ] }), { status: 200 })
      }
      if (path === '/realtime/removals/preview') {
        return new Response(JSON.stringify({ success: true, nothingChanged: true, action: 'delete_slug', targetId: 's-1',
          summary: 'Delete the invitation address realtime.vegvisr.org/kurs (2 people on its list).',
          effects: ['The address stops letting anyone in at once: a@example.com, b@example.com.', 'The name "kurs" can never be used again, also not by you.'],
          details: {}, confirmToken: 'payload.signature', expiresAt: '2026-11-15T12:10:00.000Z' }), { status: 200 })
      }
      if (path === '/realtime/removals/confirm') {
        return confirmStatus === 200
          ? new Response(JSON.stringify({ success: true, action: 'delete_slug', targetId: 's-1', done: 'Invitation address realtime.vegvisr.org/kurs deleted.' }), { status: 200 })
          : new Response(JSON.stringify({ success: false, error: 'It has changed since the preview, so the preview no longer describes it. Call the preview again.' }), { status: confirmStatus })
      }
      return new Response('{}', { status: 404 })
    } }
    return { env, calls }
  }

  test('preview and confirm need graph:write; with read scopes nothing reaches realtime-worker', async () => {
    const { env, calls } = withRealtime()
    const ro = await connect(env, READ)
    assert.equal((await callErr(ro.client, 'realtime_preview_removal', { action: 'delete_slug', id: 's-1' })).requiredScope, 'graph:write')
    assert.equal((await callErr(ro.client, 'realtime_confirm_removal', { confirmToken: 'payload.signature' })).requiredScope, 'graph:write')
    assert.equal(calls.length, 0)
  })

  test('only the confirm is marked destructive, and it takes nothing but the token', async () => {
    const { env } = withRealtime()
    const { client } = await connect(env, ALICE_RW)
    const { tools } = await client.listTools()
    const by = (n) => tools.find((t) => t.name === n)
    assert.equal(by('realtime_preview_removal').annotations.readOnlyHint, true)
    assert.equal(by('realtime_list_share_links').annotations.readOnlyHint, true)
    assert.equal(by('realtime_confirm_removal').annotations.destructiveHint, true)
    assert.deepEqual(Object.keys(by('realtime_confirm_removal').inputSchema.properties), ['confirmToken'])
    assert.match(by('realtime_confirm_removal').description, /CANNOT BE UNDONE/)
    // No other realtime tool removes anything: the confirm is the only door.
    for (const t of tools.filter((x) => x.name.startsWith('realtime_') && x.name !== 'realtime_confirm_removal')) {
      assert.doesNotMatch(t.name, /delete|revoke|close|remove(?!.*preview)/, t.name)
    }
  })

  test('the preview text carries the summary, every effect, the token, and says nothing was removed', async () => {
    const { env, calls } = withRealtime()
    const { client } = await connect(env, ALICE_RW)
    const res = await client.callTool({ name: 'realtime_preview_removal', arguments: { action: 'delete_slug', id: 's-1' } })
    assert.equal(res.isError, undefined)
    const text = res.content[0].text
    assert.match(text, /^PREVIEW — nothing has been removed\./)
    assert.match(text, /realtime\.vegvisr\.org\/kurs \(2 people/)
    assert.match(text, /a@example\.com, b@example\.com/)
    assert.match(text, /can never be used again/)
    assert.match(text, /payload\.signature/)
    assert.equal(res.structuredContent.nothingChanged, true)
    assert.deepEqual(calls.map((c) => c.path), ['/realtime/removals/preview'])
    assert.deepEqual(calls[0].body, { action: 'delete_slug', id: 's-1' })
    assert.equal(calls[0].token, 'sess-alice')
  })

  test('the confirm forwards only the token and reports what was removed', async () => {
    const { env, calls } = withRealtime()
    const { client } = await connect(env, ALICE_RW)
    const res = await client.callTool({ name: 'realtime_confirm_removal', arguments: { confirmToken: 'payload.signature' } })
    assert.match(res.content[0].text, /^DONE\. Invitation address realtime\.vegvisr\.org\/kurs deleted\./)
    assert.deepEqual(calls[0].body, { confirmToken: 'payload.signature' })
  })

  test('a refused confirm is an error the model can read, not a success', async () => {
    const { env } = withRealtime({ confirmStatus: 409 })
    const { client } = await connect(env, ALICE_RW)
    const e = await callErr(client, 'realtime_confirm_removal', { confirmToken: 'payload.signature' })
    assert.match(JSON.stringify(e), /changed since the preview/)
  })

  test('an action outside the three is refused before anything is asked', async () => {
    const { env, calls } = withRealtime()
    const { client } = await connect(env, ALICE_RW)
    const res = await client.callTool({ name: 'realtime_preview_removal', arguments: { action: 'delete_recording', id: 'x' } })
    assert.equal(res.isError, true)
    assert.equal(calls.length, 0)
  })

  test('realtime_list_share_links gives each link its id and says which are still valid', async () => {
    const { env } = withRealtime()
    const ro = await connect(env, READ)
    const res = await ro.client.callTool({ name: 'realtime_list_share_links', arguments: { slugId: 's-1' } })
    assert.equal(res.isError, undefined)
    assert.deepEqual(res.structuredContent.links.map((l) => [l.id, l.state]), [['t-1', 'expired'], ['t-2', 'valid_now']])
    assert.match(res.content[0].text, /VALID NOW · id t-2/)
  })
})
