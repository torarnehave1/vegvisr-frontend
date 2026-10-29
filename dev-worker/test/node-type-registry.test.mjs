/**
 * Data node types from graph_system_registry: register one, then add and change nodes of that
 * type through the real MCP schema (2026-10-17, work-context).
 * Run: node --test dev-worker/test/node-type-registry.test.mjs
 */
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { freshDb } from './d1-adapter.mjs'
import { registerTools } from '../mcp/tools.js'
import { NODE_TYPES } from '../node-types.js'
import * as gs from '../graph-service.js'
import {
  allowedNodeTypes, registeredNodeTypes, invalidateNodeTypeCache, REGISTRY_GRAPH_ID, REGISTRY_NODE_TYPE,
  nodeTypeRenderers, approvedRenderer, COMPONENT_REGISTRY_GRAPH_ID,
} from '../node-type-registry.js'

const authFor = (email, scope, role = 'User') => ({
  auth: { token: 'redacted', audience: 'https://knowledge.vegvisr.org/mcp', scope, userId: email, clientId: 'test' },
  props: { userId: email, email, role, authMethod: 'oauth_otp' },
})
const SUPER = authFor('owner@example.com', ['graph:read', 'graph:write'], 'Superadmin')
const ALICE = authFor('alice@example.com', ['graph:read', 'graph:write'])

/** Built the way mcp/server.js builds it: the type list is read for THIS request. */
async function connect(env, { auth, props }) {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerTools(server, () => ({ auth, env, props }), { nodeTypes: await allowedNodeTypes(env) })
  const client = new Client({ name: 'c', version: '0.0.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(b), client.connect(a)])
  return client
}
const call = (client, name, args) => client.callTool({ name, arguments: args })
const sc = (r) => r.structuredContent

/** The production registry predates UUID ids, so it is seeded as a raw row, as it exists. */
function seedRegistry(raw) {
  const data = JSON.stringify({
    metadata: { title: 'System registry', metaArea: '#SYSTEM', createdBy: 'owner@example.com', version: 1 },
    nodes: [{ id: 'nodetype-fulltext', label: 'fulltext', type: REGISTRY_NODE_TYPE, info: 'markdown' }],
    edges: [],
  })
  raw.prepare('INSERT INTO knowledge_graphs (id, title, created_by, data) VALUES (?,?,?,?)')
    .run(REGISTRY_GRAPH_ID, 'System registry', 'owner@example.com', data)
}

describe('registeredNodeTypes', () => {
  beforeEach(() => invalidateNodeTypeCache())

  test('labels of system-nodetype nodes, valid slugs only, no duplicates', async () => {
    const getGraph = async () => ({ ok: true, graph: { nodes: [
      { type: REGISTRY_NODE_TYPE, label: 'work-context' },
      { type: REGISTRY_NODE_TYPE, label: 'work-context' },
      { type: REGISTRY_NODE_TYPE, label: 'Not A Slug' },
      { type: 'fulltext', label: 'ignored' },
    ] } })
    assert.deepEqual(await registeredNodeTypes({}, { getGraph }), ['work-context'])
  })

  test('cached for a minute, re-read after that', async () => {
    let reads = 0
    const getGraph = async () => { reads += 1; return { ok: true, graph: { nodes: [] } } }
    await registeredNodeTypes({}, { getGraph, now: 1000 })
    await registeredNodeTypes({}, { getGraph, now: 30_000 })
    assert.equal(reads, 1)
    await registeredNodeTypes({}, { getGraph, now: 70_000 })
    assert.equal(reads, 2)
  })

  test('a registry that cannot be read leaves the renderable list working', async () => {
    const getGraph = async () => { throw new Error('d1 down') }
    assert.deepEqual(await allowedNodeTypes({}, { getGraph }), NODE_TYPES)
  })
})

describe('register_node_type → add_node / update_node with the new type', () => {
  beforeEach(() => invalidateNodeTypeCache())

  test('an unregistered data type is refused by the schema', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const alice = await connect(env, ALICE)
    const g = sc(await call(alice, 'create_graph', { title: 'T', metaArea: '#X' }))
    const r = await call(alice, 'add_node', { graphId: g.graphId, node: { label: 'c', type: 'work-context' } })
    assert.equal(r.isError, true)
  })

  test('only the Superadmin may register', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const alice = await connect(env, ALICE)
    const r = await call(alice, 'register_node_type', { type: 'work-context', description: 'An Agent-Builder card.', consumer: 'agent-worker' })
    assert.equal(r.isError, true)
    assert.equal(sc(r)?.code ?? JSON.parse(r.content[0].text).code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('registered, then added and changed to, with metadata kept', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const owner = await connect(env, SUPER)
    const reg = sc(await call(owner, 'register_node_type', {
      type: 'work-context', description: 'An Agent-Builder work-context card.', consumer: 'agent-worker GET /work-contexts',
    }))
    assert.equal(reg.success, true)
    assert.equal(reg.alreadyRegistered, false)
    assert.equal(reg.registryNodeId, 'nodetype-work-context')

    // A new request builds its schema from the registry — the type is there without a deploy.
    const alice = await connect(env, ALICE)
    const g = sc(await call(alice, 'create_graph', { title: 'T', metaArea: '#X' }))
    const added = await call(alice, 'add_node', { graphId: g.graphId, node: {
      id: 'ctx-1', label: 'Ctx', type: 'work-context', metadata: { tools: ['mcp_call'], order: 1 },
    } })
    assert.notEqual(added.isError, true, JSON.stringify(sc(added)))

    const plain = sc(await call(alice, 'add_node', { graphId: g.graphId, node: { id: 'n2', label: 'N', metadata: { order: 2 } } }))
    const changed = await call(alice, 'update_node', { graphId: g.graphId, nodeId: 'n2', expectedVersion: plain.newVersion, fields: { type: 'work-context' } })
    assert.notEqual(changed.isError, true, JSON.stringify(sc(changed)))

    const read = await gs.getGraph(env, g.graphId)
    const byId = Object.fromEntries(read.graph.nodes.map((n) => [n.id, n]))
    assert.equal(byId['ctx-1'].type, 'work-context')
    assert.deepEqual(byId['ctx-1'].metadata, { tools: ['mcp_call'], order: 1 })
    assert.equal(byId.n2.type, 'work-context')
    assert.deepEqual(byId.n2.metadata, { order: 2 }, 'changing the type must not touch metadata')
  })

  test('registering twice is reported, not duplicated', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const owner = await connect(env, SUPER)
    const args = { type: 'work-context', description: 'An Agent-Builder card.', consumer: 'agent-worker' }
    await call(owner, 'register_node_type', args)
    const again = sc(await call(owner, 'register_node_type', args))
    assert.equal(again.alreadyRegistered, true)
    const reg = await gs.getGraph(env, REGISTRY_GRAPH_ID)
    assert.equal(reg.graph.nodes.filter((n) => n.id === 'nodetype-work-context').length, 1)
  })

  test('a renderable type is not registered again', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const owner = await connect(env, SUPER)
    const r = sc(await call(owner, 'register_node_type', { type: 'html-node', description: 'Already renderable.', consumer: 'viewer' }))
    assert.equal(r.alreadyRegistered, true)
  })
})

describe('renderers: set → pending → approve → served', () => {
  beforeEach(() => invalidateNodeTypeCache())
  const IMPL = '<div id="x"></div><script>addEventListener("message",e=>{x.textContent=e.data.node.label})</script>'

  async function registered(env, raw) {
    seedRegistry(raw)
    const owner = await connect(env, SUPER)
    await call(owner, 'register_node_type', { type: 'work-context', description: 'An Agent-Builder card.', consumer: 'agent-worker' })
    return owner
  }

  test('a pending renderer is listed but never served; approval serves it; a new version un-serves it', async () => {
    const { env, raw } = freshDb()
    const owner = await registered(env, raw)

    const set1 = sc(await call(owner, 'set_node_type_renderer', { type: 'work-context', impl: IMPL }))
    assert.deepEqual([set1.version, set1.status], [1, 'pending'])
    invalidateNodeTypeCache()
    assert.deepEqual(await nodeTypeRenderers(env), { 'work-context': { version: 1, status: 'pending' } })
    assert.equal(await approvedRenderer(env, 'work-context'), null, 'pending must not be served')

    const stale = await call(owner, 'approve_node_type_renderer', { type: 'work-context', version: 2, verifyMethod: 'Playwright' })
    assert.equal(stale.isError, true, 'approving a version that is not current is refused')

    const ok1 = sc(await call(owner, 'approve_node_type_renderer', { type: 'work-context', version: 1, verifyMethod: 'Playwright screenshot', observed: 'renders label' }))
    assert.equal(ok1.status, 'approved')
    invalidateNodeTypeCache()
    const served = await approvedRenderer(env, 'work-context')
    assert.deepEqual([served.version, served.impl], [1, IMPL])

    const reg = await gs.getGraph(env, REGISTRY_GRAPH_ID)
    const r = reg.graph.nodes.find((n) => n.id === 'nodetype-work-context').metadata.renderer
    assert.equal(r.approvedBy, 'owner@example.com')
    assert.equal(r.verify.method, 'Playwright screenshot')
    assert.equal(reg.graph.nodes.find((n) => n.id === 'nodetype-work-context').metadata.consumer, 'agent-worker', 'other metadata kept')

    // New code → v2 pending; the approved v1 is NOT kept running alongside unreviewed code.
    const set2 = sc(await call(owner, 'set_node_type_renderer', { type: 'work-context', impl: IMPL + '<!-- v2 -->' }))
    assert.deepEqual([set2.version, set2.status], [2, 'pending'])
    invalidateNodeTypeCache()
    assert.equal(await approvedRenderer(env, 'work-context'), null)
  })

  test('only the Superadmin may set or approve', async () => {
    const { env, raw } = freshDb()
    await registered(env, raw)
    const alice = await connect(env, ALICE)
    assert.equal((await call(alice, 'set_node_type_renderer', { type: 'work-context', impl: IMPL })).isError, true)
    assert.equal((await call(alice, 'approve_node_type_renderer', { type: 'work-context', version: 1, verifyMethod: 'none at all' })).isError, true)
  })

  test('unregistered and built-in types are refused; exactly one of impl/component', async () => {
    const { env, raw } = freshDb()
    const owner = await registered(env, raw)
    assert.equal((await call(owner, 'set_node_type_renderer', { type: 'nope-type', impl: IMPL })).isError, true)
    assert.equal((await call(owner, 'set_node_type_renderer', { type: 'fulltext', impl: IMPL })).isError, true)
    assert.equal((await call(owner, 'set_node_type_renderer', { type: 'work-context' })).isError, true)
    assert.equal((await call(owner, 'set_node_type_renderer', { type: 'work-context', impl: IMPL, component: 'x-y' })).isError, true)
  })

  test('a renderer may name a Component Registry component', async () => {
    const { env, raw } = freshDb()
    const owner = await registered(env, raw)
    raw.prepare('INSERT INTO knowledge_graphs (id, title, created_by, data) VALUES (?,?,?,?)').run(
      COMPONENT_REGISTRY_GRAPH_ID, 'Component Registry', 'owner@example.com',
      JSON.stringify({ metadata: { title: 'Component Registry', version: 1 }, nodes: [
        { id: 'c_wc', label: 'render-work-context', type: 'component', metadata: { impl: IMPL } },
      ], edges: [] }),
    )
    const s1 = sc(await call(owner, 'set_node_type_renderer', { type: 'work-context', component: 'render-work-context' }))
    await call(owner, 'approve_node_type_renderer', { type: 'work-context', version: s1.version, verifyMethod: 'Playwright' })
    invalidateNodeTypeCache()
    const served = await approvedRenderer(env, 'work-context')
    assert.deepEqual([served.impl, served.component], [IMPL, 'render-work-context'])
  })
})

describe('list_node_types: every type, and what each registered one is for', () => {
  beforeEach(() => invalidateNodeTypeCache())
  const IMPL = '<div id="x"></div><script>addEventListener("message",e=>{x.textContent=e.data.node.label})</script>'

  test('read-only, graph:read only — and it lists the renderable types under their real names', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const reader = await connect(env, authFor('reader@example.com', ['graph:read']))
    const { tools } = await reader.listTools()
    const t = tools.find((x) => x.name === 'list_node_types')
    assert.equal(t.annotations.readOnlyHint, true)
    assert.equal(t.annotations.destructiveHint, false)

    const r = sc(await call(reader, 'list_node_types', {}))
    assert.deepEqual(r.renderable, NODE_TYPES)
    assert.equal(r.count, NODE_TYPES.length + r.registered.length)
    // The question this tool exists for (2026-10-21): the work-note type is spelled worknote.
    assert.equal(r.renderable.includes('worknote'), true)
    assert.equal(r.renderable.includes('work-note'), false)
    // The seeded registry row duplicates a renderable name; it is not listed twice.
    assert.equal(r.registered.some((x) => x.type === 'fulltext'), false)
  })

  test('a registered type carries its description, consumer and renderer status — never its code', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const owner = await connect(env, SUPER)
    await call(owner, 'register_node_type', { type: 'micro-story', description: 'One captured micro-narrative.', consumer: 'vegvisr-node' })
    invalidateNodeTypeCache()
    const alice = await connect(env, ALICE)

    const before = sc(await call(alice, 'list_node_types', {}))
    const ms = before.registered.find((x) => x.type === 'micro-story')
    assert.deepEqual(ms, { type: 'micro-story', scope: 'platform', title: null, description: 'One captured micro-narrative.', consumer: 'vegvisr-node', renderer: null })

    await call(owner, 'set_node_type_renderer', { type: 'micro-story', impl: IMPL })
    invalidateNodeTypeCache()
    assert.deepEqual(sc(await call(alice, 'list_node_types', {})).registered.find((x) => x.type === 'micro-story').renderer, { version: 1, status: 'pending' })

    await call(owner, 'approve_node_type_renderer', { type: 'micro-story', version: 1, verifyMethod: 'unit test' })
    invalidateNodeTypeCache()
    const after = await call(alice, 'list_node_types', {})
    assert.deepEqual(sc(after).registered.find((x) => x.type === 'micro-story').renderer, { version: 1, status: 'approved' })
    const all = JSON.stringify(after)
    assert.equal(all.includes('addEventListener'), false, 'renderer code must not leave through this tool')
    assert.match(after.content[0].text, /micro-story — One captured micro-narrative\. \[renderer v1 approved\] Read by: vegvisr-node\./)
  })

  test('without graph:read it is refused', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const none = await connect(env, authFor('nobody@example.com', []))
    assert.equal((await call(none, 'list_node_types', {})).isError, true)
  })

  test('a world with no registry adds nothing and is echoed back normalised', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const alice = await connect(env, ALICE)
    const r = sc(await call(alice, 'list_node_types', { world: '  No-Such.Example ' }))
    assert.equal(r.world, 'no-such.example')
    assert.equal(r.registered.some((x) => x.scope === 'world'), false)
  })
})
