/**
 * Sharing a World's graph with another World (graph_shares, 2026-11-19): the graph stays in its
 * World; a share lets the members of another World read it, or read and change it.
 * Run: node --test dev-worker/test/world-shares.test.mjs
 *
 * The two-database harness of world-node-types.test.mjs: each World's D1 behind the real
 * world-graphs-proxy, reached through a fake fetch; tools driven through a real MCP client.
 */
import { test, describe, before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { freshDb } from './d1-adapter.mjs'
import proxy from '../world-graphs-proxy/index.js'
import { publicJwkOf } from '../world-graph-token.js'
import { registerTools } from '../mcp/tools.js'
import { readOnlyAllows } from '../graph-store.js'

const WORLD = 'test-world.example'
const OTHER = 'other-world.example'

const authFor = (email, role = 'User') => ({
  auth: { token: 'redacted', audience: 'https://knowledge.vegvisr.org/mcp', scope: ['graph:read', 'graph:write'], userId: email, clientId: 'test' },
  props: { userId: email, email, role, authMethod: 'oauth_otp' },
})
const FOUNDER = authFor('founder@example.com', 'Admin')
const OTHER_FOUNDER = authFor('other@example.com', 'Admin')
const STRANGER = authFor('someone@example.com', 'Admin')

let privateJwk, env, worldDbs, realFetch

before(async () => {
  const k = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  privateJwk = await crypto.subtle.exportKey('jwk', k.privateKey)
})

beforeEach(() => {
  const { env: p } = freshDb()
  p.vegvisr_org.db.exec(`
    CREATE TABLE world_founders (id TEXT, founder_email TEXT, account_holder_email TEXT, hosting_model TEXT, cf_account_id TEXT, domain TEXT, created_at TEXT);
    INSERT INTO world_founders VALUES ('a', 'founder@example.com', NULL, 'own_account', 'acc', '${WORLD}', '2026-10-18');
    INSERT INTO world_founders VALUES ('b', 'other@example.com', NULL, 'own_account', 'acc2', '${OTHER}', '2026-10-18');
    CREATE TABLE world_graph_stores (domain TEXT PRIMARY KEY, cf_account_id TEXT, d1_database_id TEXT, d1_database_name TEXT, proxy_worker TEXT, endpoint_base TEXT, schema_version TEXT, template_version TEXT, status TEXT, provisioned_at TEXT, updated_at TEXT);
    INSERT INTO world_graph_stores VALUES ('${WORLD}', 'acc', 'u1', 'world-graphs-test', 'test-graphs-proxy', 'https://graphs.${WORLD}', 'v', '1', 'active', '', '');
    INSERT INTO world_graph_stores VALUES ('${OTHER}', 'acc2', 'u2', 'world-graphs-other', 'other-graphs-proxy', 'https://graphs.${OTHER}', 'v', '1', 'active', '', '');
  `)
  env = { vegvisr_org: p.vegvisr_org, WORLD_GRAPH_SIGNING_KEY: JSON.stringify(privateJwk) }
  worldDbs = { [WORLD]: freshDb().env.vegvisr_org, [OTHER]: freshDb().env.vegvisr_org }
  realFetch = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    const domain = url.hostname.replace(/^graphs\./, '')
    if (!worldDbs[domain]) throw new Error(`unexpected fetch ${url}`)
    return proxy.fetch(new Request(url, { method: init.method, headers: init.headers, body: init.body }), {
      GRAPH_DB: worldDbs[domain], WORLD_DOMAIN: domain, PLATFORM_PUBLIC_KEY: JSON.stringify(publicJwkOf(privateJwk)),
    })
  }
})
afterEach(() => { globalThis.fetch = realFetch })

async function connect({ auth, props }) {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerTools(server, () => ({ auth, env, props }))
  const client = new Client({ name: 'c', version: '0.0.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(b), client.connect(a)])
  return client
}
const call = (client, name, args) => client.callTool({ name, arguments: args })
const sc = (r) => r.structuredContent
const code = (r) => sc(r)?.code ?? JSON.parse(r.content[0].text).code
const okr = (r) => { assert.notEqual(r.isError, true, JSON.stringify(sc(r) || r.content)); return sc(r) }

async function worldGraph() {
  const founder = await connect(FOUNDER)
  const r = okr(await call(founder, 'create_graph', { title: 'Shared plan', metaArea: '#PLAN', world: WORLD, nodes: [{ id: 'n1', label: 'One', type: 'fulltext', info: 'x' }] }))
  return { founder, id: r.graphId }
}

describe('share_graph_with_world', () => {
  test('without a share, a member of another World cannot open the graph', async () => {
    const { id } = await worldGraph()
    const other = await connect(OTHER_FOUNDER)
    assert.equal(code(await call(other, 'get_graph', { graphId: id })), 'FORBIDDEN_GRAPH')
  })

  test('a read share: the other World reads and lists it, and cannot change it', async () => {
    const { founder, id } = await worldGraph()
    const s = okr(await call(founder, 'share_graph_with_world', { graphId: id, world: OTHER }))
    assert.equal(s.mode, 'read')
    assert.equal(s.world, WORLD)
    assert.deepEqual(s.shares.map((x) => [x.world, x.mode]), [[OTHER, 'read']])

    const other = await connect(OTHER_FOUNDER)
    const g = okr(await call(other, 'get_graph', { graphId: id }))
    assert.equal(g.nodes.length, 1)
    const bad = await call(other, 'update_graph_metadata', { graphId: id, fields: { title: 'Changed' } })
    assert.equal(code(bad), 'FORBIDDEN_GRAPH')
    assert.equal(code(await call(other, 'add_node', { graphId: id, node: { id: 'n2', label: 'Two', type: 'fulltext', info: 'y' } })), 'FORBIDDEN_GRAPH')
    assert.equal(okr(await call(founder, 'get_graph', { graphId: id })).nodes.length, 1, 'nothing was written')

    const ix = okr(await call(other, 'graph_index', { scope: 'all' }))
    const row = ix.graphs.find((x) => x.graphId === id)
    assert.ok(row, 'the shared graph is in the index of the other World')
    assert.equal(row.world, WORLD)
    assert.equal(row.sharedVia, OTHER)
    assert.equal(row.sharedMode, 'read')
    const own = okr(await call(founder, 'graph_index', { scope: 'all' })).graphs.find((x) => x.graphId === id)
    assert.deepEqual(own.sharedWith, [{ world: OTHER, mode: 'read' }])
    assert.equal(own.sharedVia, undefined)
  })

  test('a write share lets the other World change it; unsharing takes the access away', async () => {
    const { founder, id } = await worldGraph()
    okr(await call(founder, 'share_graph_with_world', { graphId: id, world: OTHER, mode: 'write' }))
    const other = await connect(OTHER_FOUNDER)
    okr(await call(other, 'update_graph_metadata', { graphId: id, fields: { title: 'Changed by other' } }))
    assert.equal(okr(await call(founder, 'get_graph', { graphId: id })).title, 'Changed by other')

    const u = okr(await call(founder, 'unshare_graph_from_world', { graphId: id, world: OTHER }))
    assert.equal(u.removed, true)
    assert.deepEqual(u.shares, [])
    assert.equal(code(await call(other, 'get_graph', { graphId: id })), 'FORBIDDEN_GRAPH')
    assert.equal(okr(await call(other, 'graph_index', { scope: 'all' })).graphs.some((x) => x.graphId === id), false)
  })

  test('only members of the graph\'s own World may share it', async () => {
    const { founder, id } = await worldGraph()
    okr(await call(founder, 'share_graph_with_world', { graphId: id, world: OTHER, mode: 'write' }))
    const other = await connect(OTHER_FOUNDER)
    assert.equal(code(await call(other, 'share_graph_with_world', { graphId: id, world: OTHER })), 'FORBIDDEN_GRAPH', 'not through a share')
    assert.equal(code(await call(await connect(STRANGER), 'share_graph_with_world', { graphId: id, world: OTHER })), 'FORBIDDEN_GRAPH')
  })

  test('refused: an unknown World, the own World, a bad mode, a platform graph', async () => {
    const { founder, id } = await worldGraph()
    assert.equal(code(await call(founder, 'share_graph_with_world', { graphId: id, world: 'nowhere.example' })), 'INVALID_INPUT')
    assert.equal(code(await call(founder, 'share_graph_with_world', { graphId: id, world: WORLD })), 'INVALID_INPUT')
    // Someone with no World creates on the platform (a founder's new graph defaults to the World).
    const stranger = await connect(STRANGER)
    const plat = okr(await call(stranger, 'create_graph', { title: 'Platform one', metaArea: '#P' }))
    assert.equal(plat.world ?? null, null)
    assert.equal(code(await call(stranger, 'share_graph_with_world', { graphId: plat.graphId, world: OTHER })), 'INVALID_INPUT')
  })

  test('list_graph_shares names every share', async () => {
    const { founder, id } = await worldGraph()
    okr(await call(founder, 'share_graph_with_world', { graphId: id, world: OTHER }))
    const l = okr(await call(founder, 'list_graph_shares', { graphId: id }))
    assert.equal(l.world, WORLD)
    assert.deepEqual(l.shares.map((x) => x.world), [OTHER])
  })
})

describe('the read-only gate', () => {
  test('lets reads through and stops every write', () => {
    assert.equal(readOnlyAllows('getRow', ['x']), true)
    assert.equal(readOnlyAllows('all', ['SELECT id, created_date, updated_at FROM knowledge_graphs']), true)
    assert.equal(readOnlyAllows('all', ['UPDATE knowledge_graphs SET data = 1']), false)
    assert.equal(readOnlyAllows('first', ['SELECT 1; DELETE FROM knowledge_graphs']), false)
    for (const op of ['commit', 'putData', 'insertUnversioned', 'setAiInstructions', 'trashCopy', 'deleteGraph', 'importGraph', 'restoreFromTrash']) assert.equal(readOnlyAllows(op, []), false, op)
  })
})
