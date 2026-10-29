/**
 * World node types (rendering engine phase 2, 2026-10-18): a World registers its own types in its
 * OWN store, its founder approves their renderers, and they apply only to that World's graphs.
 * Run: node --test dev-worker/test/world-node-types.test.mjs
 *
 * The same two-database harness as world-store.test.mjs: `platform` (vegvisr_org) and `world`
 * (the founder's D1) behind the real world-graphs-proxy, reached through a fake fetch. The tools
 * are driven through a real MCP client, built per request the way mcp/server.js builds them.
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
import * as gs from '../graph-service.js'
import {
  allowedNodeTypes, worldNodeTypes, nodeTypeRenderers, approvedRenderer, invalidateNodeTypeCache,
  REGISTRY_GRAPH_ID, REGISTRY_NODE_TYPE, WORLD_TYPES_TAG,
} from '../node-type-registry.js'

const WORLD = 'test-world.example'
const OTHER = 'other-world.example'
const IMPL = '<div id="x"></div><script>addEventListener("message",e=>{x.textContent=e.data.node.label})</script>'

const authFor = (email, role = 'User') => ({
  auth: { token: 'redacted', audience: 'https://knowledge.vegvisr.org/mcp', scope: ['graph:read', 'graph:write'], userId: email, clientId: 'test' },
  props: { userId: email, email, role, authMethod: 'oauth_otp' },
})
const SUPER = authFor('owner@example.com', 'Superadmin')
const FOUNDER = authFor('founder@example.com', 'Admin')
const OTHER_FOUNDER = authFor('other@example.com', 'Admin')
const STRANGER = authFor('someone@example.com', 'Admin')

let privateJwk, env, worldDbs, realFetch

before(async () => {
  const k = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  privateJwk = await crypto.subtle.exportKey('jwk', k.privateKey)
})

beforeEach(() => {
  invalidateNodeTypeCache()
  const { env: p, raw } = freshDb()
  p.vegvisr_org.db.exec(`
    CREATE TABLE world_founders (id TEXT, founder_email TEXT, account_holder_email TEXT, hosting_model TEXT, cf_account_id TEXT, domain TEXT, created_at TEXT);
    INSERT INTO world_founders VALUES ('a', 'founder@example.com', NULL, 'own_account', 'acc', '${WORLD}', '2026-10-18');
    INSERT INTO world_founders VALUES ('b', 'other@example.com', NULL, 'own_account', 'acc2', '${OTHER}', '2026-10-18');
    CREATE TABLE world_graph_stores (domain TEXT PRIMARY KEY, cf_account_id TEXT, d1_database_id TEXT, d1_database_name TEXT, proxy_worker TEXT, endpoint_base TEXT, schema_version TEXT, template_version TEXT, status TEXT, provisioned_at TEXT, updated_at TEXT);
    INSERT INTO world_graph_stores VALUES ('${WORLD}', 'acc', 'u1', 'world-graphs-test', 'test-graphs-proxy', 'https://graphs.${WORLD}', 'v', '1', 'active', '', '');
    INSERT INTO world_graph_stores VALUES ('${OTHER}', 'acc2', 'u2', 'world-graphs-other', 'other-graphs-proxy', 'https://graphs.${OTHER}', 'v', '1', 'active', '', '');
  `)
  // The platform registry, as it exists in production (a legacy non-UUID id, seeded raw).
  raw.prepare('INSERT INTO knowledge_graphs (id, title, created_by, data) VALUES (?,?,?,?)').run(
    REGISTRY_GRAPH_ID, 'System registry', 'owner@example.com',
    JSON.stringify({ metadata: { title: 'System registry', metaArea: '#SYSTEM', version: 1 }, nodes: [
      { id: 'nodetype-work-context', label: 'work-context', type: REGISTRY_NODE_TYPE, info: 'platform type', metadata: {} },
    ], edges: [] }),
  )
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

/** Built the way mcp/server.js builds it — the schema lists the platform's types plus the caller's Worlds'. */
async function connect({ auth, props }) {
  const { worldStoresFor } = await import('../graph-store.js')
  const actor = gs.normalizeActor({ valid: true, userId: props.email, userEmail: props.email, userRole: props.role, scopes: auth.scope })
  const types = await allowedNodeTypes(env)
  for (const s of await worldStoresFor(env, actor)) for (const t of await worldNodeTypes(env, s.world)) if (!types.includes(t)) types.push(t)
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerTools(server, () => ({ auth, env, props }), { nodeTypes: types })
  const client = new Client({ name: 'c', version: '0.0.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(b), client.connect(a)])
  return client
}
const call = (client, name, args) => client.callTool({ name, arguments: args })
const sc = (r) => r.structuredContent
const code = (r) => sc(r)?.code ?? JSON.parse(r.content[0].text).code
const worldGraphs = (d) => worldDbs[d].db.prepare('SELECT id, data FROM knowledge_graphs').all()
const platformGraphCount = () => env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graphs').get().n

async function registerTestCard(client, world = WORLD) {
  return call(client, 'register_node_type', { type: 'test-card', description: 'A card for the phase-2 proof.', consumer: 'vegvisr-node', world })
}

describe('register_node_type with world', () => {
  test("the founder registers: the registry graph is created in the World's own store, nowhere on the platform", async () => {
    const before = platformGraphCount()
    const r = await registerTestCard(await connect(FOUNDER))
    assert.notEqual(r.isError, true, JSON.stringify(sc(r)))
    assert.equal(sc(r).world, WORLD)
    assert.equal(sc(r).alreadyRegistered, false)
    const rows = worldGraphs(WORLD)
    assert.equal(rows.length, 1)
    const data = JSON.parse(rows[0].data)
    assert.equal(data.metadata.metaArea, WORLD_TYPES_TAG)
    assert.equal(data.nodes[0].label, 'test-card')
    assert.equal(data.nodes[0].type, REGISTRY_NODE_TYPE)
    assert.equal(data.nodes[0].metadata.scope, `world:${WORLD}`)
    assert.equal(platformGraphCount(), before, 'the platform D1 holds no graph row for it')
    assert.equal(worldGraphs(OTHER).length, 0)
  })

  test('a second type goes into the same registry graph; registering twice is reported', async () => {
    const f = await connect(FOUNDER)
    await registerTestCard(f)
    await call(f, 'register_node_type', { type: 'test-list', description: 'A second phase-2 type.', consumer: 'vegvisr-node', world: WORLD })
    const again = sc(await registerTestCard(f))
    assert.equal(again.alreadyRegistered, true)
    const rows = worldGraphs(WORLD)
    assert.equal(rows.length, 1)
    assert.deepEqual(JSON.parse(rows[0].data).nodes.map((n) => n.label).sort(), ['test-card', 'test-list'])
  })

  test('a World may not shadow a platform type, renderable or registered', async () => {
    const f = await connect(FOUNDER)
    for (const type of ['fulltext', 'work-context']) {
      const r = await call(f, 'register_node_type', { type, description: 'Trying to redefine it.', consumer: 'x-y-z', world: WORLD })
      assert.equal(r.isError, true, type)
      assert.equal(code(r), gs.ERR.INVALID_INPUT)
    }
    assert.equal(worldGraphs(WORLD).length, 0)
  })

  test('another World’s founder and a stranger are refused; a Superadmin may', async () => {
    for (const who of [OTHER_FOUNDER, STRANGER]) {
      const r = await registerTestCard(await connect(who))
      assert.equal(r.isError, true)
      assert.equal(code(r), gs.ERR.FORBIDDEN_GRAPH)
    }
    assert.equal(worldGraphs(WORLD).length, 0)
    assert.notEqual((await registerTestCard(await connect(SUPER))).isError, true)
  })

  test('without world the platform rule is unchanged: a founder may not register', async () => {
    const r = await call(await connect(FOUNDER), 'register_node_type', { type: 'test-card', description: 'A platform attempt.', consumer: 'x-y-z' })
    assert.equal(code(r), gs.ERR.FORBIDDEN_GRAPH)
  })

  test('a World with no graph store cannot hold types', async () => {
    const r = await registerTestCard(await connect(SUPER), 'no-store.example')
    assert.equal(r.isError, true)
  })
})

describe('World types apply only in their own World', () => {
  test("usable in the World's graphs; refused on the platform and in another World", async () => {
    await registerTestCard(await connect(FOUNDER))
    invalidateNodeTypeCache()
    const admin = await connect(SUPER) // sees both Worlds' types in its schema
    const inWorld = sc(await call(admin, 'create_graph', { title: 'Test', metaArea: '#TEST', world: WORLD }))
    const inOther = sc(await call(admin, 'create_graph', { title: 'Other', metaArea: '#TEST', world: OTHER }))
    const onPlatform = sc(await call(admin, 'create_graph', { title: 'Platform', metaArea: '#TEST' }))

    const ok = await call(admin, 'add_node', { graphId: inWorld.graphId, node: { id: 'c1', label: 'Card', type: 'test-card' } })
    assert.notEqual(ok.isError, true, JSON.stringify(sc(ok)))
    for (const g of [inOther, onPlatform]) {
      const r = await call(admin, 'add_node', { graphId: g.graphId, node: { label: 'Card', type: 'test-card' } })
      assert.equal(r.isError, true)
      assert.equal(code(r), gs.ERR.INVALID_INPUT)
    }
    // update_node and create_graph check the same way.
    const plain = sc(await call(admin, 'add_node', { graphId: onPlatform.graphId, node: { id: 'p1', label: 'P' } }))
    const changed = await call(admin, 'update_node', { graphId: onPlatform.graphId, nodeId: 'p1', expectedVersion: plain.newVersion, fields: { type: 'test-card' } })
    assert.equal(code(changed), gs.ERR.INVALID_INPUT)
    const created = await call(admin, 'create_graph', { title: 'X', metaArea: '#TEST', world: OTHER, nodes: [{ label: 'c', type: 'test-card' }] })
    assert.equal(code(created), gs.ERR.INVALID_INPUT)
    const createdHere = await call(admin, 'create_graph', { title: 'Y', metaArea: '#TEST', world: WORLD, nodes: [{ label: 'c', type: 'test-card' }] })
    assert.notEqual(createdHere.isError, true, JSON.stringify(sc(createdHere)))
  })

  test('the list with world adds the World types after the platform’s; without world it is unchanged', async () => {
    await registerTestCard(await connect(FOUNDER))
    invalidateNodeTypeCache()
    const plain = await allowedNodeTypes(env)
    assert.equal(plain.includes('test-card'), false)
    const withWorld = await allowedNodeTypes(env, { world: WORLD })
    assert.deepEqual(withWorld.slice(0, plain.length), plain)
    assert.equal(withWorld.at(-1), 'test-card')
    assert.equal((await allowedNodeTypes(env, { world: OTHER })).includes('test-card'), false)
  })

  test('a platform name planted in a World registry is ignored (no shadowing at read time either)', async () => {
    await registerTestCard(await connect(FOUNDER))
    // Write a "work-context" type node straight into the World's registry, past the tool's check.
    const row = worldGraphs(WORLD)[0]
    const data = JSON.parse(row.data)
    data.nodes.push({ id: 'nodetype-work-context', label: 'work-context', type: REGISTRY_NODE_TYPE, metadata: { renderer: { version: 9, impl: IMPL, status: 'approved' } } })
    worldDbs[WORLD].db.prepare('UPDATE knowledge_graphs SET data = ? WHERE id = ?').run(JSON.stringify(data), row.id)
    invalidateNodeTypeCache()
    assert.deepEqual(await worldNodeTypes(env, WORLD), ['test-card'])
    assert.equal(await approvedRenderer(env, 'work-context', { world: WORLD }), null, 'the platform entry (no renderer) wins')
  })
})

describe('World renderers: set → pending → founder approves → served with world only', () => {
  test('the full cycle, approvedBy the founder', async () => {
    const f = await connect(FOUNDER)
    await registerTestCard(f)
    const set1 = sc(await call(f, 'set_node_type_renderer', { type: 'test-card', impl: IMPL, world: WORLD }))
    assert.deepEqual([set1.version, set1.status], [1, 'pending'])
    invalidateNodeTypeCache()
    assert.deepEqual((await nodeTypeRenderers(env, { world: WORLD }))['test-card'], { version: 1, status: 'pending', scope: 'world' })
    assert.equal(await approvedRenderer(env, 'test-card', { world: WORLD }), null, 'pending is never served')

    const ok1 = sc(await call(f, 'approve_node_type_renderer', { type: 'test-card', version: 1, verifyMethod: 'Playwright screenshot', world: WORLD }))
    assert.equal(ok1.status, 'approved')
    invalidateNodeTypeCache()
    const served = await approvedRenderer(env, 'test-card', { world: WORLD })
    assert.deepEqual([served.version, served.impl], [1, IMPL])
    assert.equal(await approvedRenderer(env, 'test-card'), null, 'not served without world')
    assert.equal(await approvedRenderer(env, 'test-card', { world: OTHER }), null, 'not served for another World')
    assert.equal((await nodeTypeRenderers(env))['test-card'], undefined)

    const r = JSON.parse(worldGraphs(WORLD)[0].data).nodes.find((n) => n.label === 'test-card').metadata
    assert.equal(r.renderer.approvedBy, 'founder@example.com')
    assert.equal(r.renderer.scope, `world:${WORLD}`)
    assert.equal(r.consumer, 'vegvisr-node', 'other metadata kept')

    // New code un-serves it again.
    await call(f, 'set_node_type_renderer', { type: 'test-card', impl: IMPL + '<!-- v2 -->', world: WORLD })
    invalidateNodeTypeCache()
    assert.equal(await approvedRenderer(env, 'test-card', { world: WORLD }), null)
  })

  test('another World’s founder can neither set nor approve; a platform call does not find the type', async () => {
    const f = await connect(FOUNDER)
    await registerTestCard(f)
    await call(f, 'set_node_type_renderer', { type: 'test-card', impl: IMPL, world: WORLD })
    const other = await connect(OTHER_FOUNDER)
    assert.equal(code(await call(other, 'set_node_type_renderer', { type: 'test-card', impl: IMPL, world: WORLD })), gs.ERR.FORBIDDEN_GRAPH)
    assert.equal(code(await call(other, 'approve_node_type_renderer', { type: 'test-card', version: 1, verifyMethod: 'none at all', world: WORLD })), gs.ERR.FORBIDDEN_GRAPH)
    assert.equal(code(await call(f, 'approve_node_type_renderer', { type: 'test-card', version: 1, verifyMethod: 'platform path' })), gs.ERR.FORBIDDEN_GRAPH)
    const admin = await connect(SUPER)
    assert.equal((await call(admin, 'approve_node_type_renderer', { type: 'test-card', version: 1, verifyMethod: 'platform path' })).isError, true, 'not in graph_system_registry')
  })

  test('a World store that is down hides its types; the platform list stands', async () => {
    await registerTestCard(await connect(FOUNDER))
    invalidateNodeTypeCache()
    globalThis.fetch = async () => { throw new Error('connect ECONNREFUSED') }
    const types = await allowedNodeTypes(env, { world: WORLD })
    assert.equal(types.includes('work-context'), true)
    assert.equal(types.includes('test-card'), false)
  })
})

// ── node-type-service.js: the founder-facing rules behind Agent-Builder's "Nodetyper" (2026-10-18) ──
import * as nts from '../node-type-service.js'
import { worldTypeInfo } from '../node-type-registry.js'

const actorOf = ({ props }) => gs.normalizeActor({ valid: true, userId: props.email, userEmail: props.email, userRole: props.role, scopes: ['all'] })
const FIELDS = [
  { label: 'Tittel', kind: 'text' },
  { label: 'Beskrivelse', kind: 'longtext' },
  { label: 'Varighet', kind: 'number' },
  { label: 'Lærer navn', kind: 'text' },
]

describe('node-type-service', () => {
  test('a title becomes the type name; fields get keys; the World is the founder’s own', async () => {
    const r = await nts.createWorldType(env, actorOf(FOUNDER), { title: 'Kursmodul – del én', description: 'One module of a course.', fields: FIELDS })
    assert.equal(r.ok, true, r.message)
    assert.equal(r.world, WORLD, 'no world named: the one the founder founded')
    assert.equal(r.type, 'kursmodul-del-en')
    assert.equal(r.title, 'Kursmodul – del én')
    assert.deepEqual(r.fields.map((f) => f.key), ['tittel', 'beskrivelse', 'varighet', 'laererNavn'])
    assert.equal(r.look, null)
    invalidateNodeTypeCache()
    assert.deepEqual(await worldTypeInfo(env, WORLD), { 'kursmodul-del-en': { title: 'Kursmodul – del én', fields: r.fields } })
  })

  test('the same title twice gets -2; a platform name gets the World’s stem', async () => {
    const a = actorOf(FOUNDER)
    await nts.createWorldType(env, a, { title: 'Kort', description: 'A first card type.' })
    const again = await nts.createWorldType(env, a, { title: 'Kort', description: 'A second card type.' })
    assert.equal(again.type, 'kort-2')
    const shadow = await nts.createWorldType(env, a, { title: 'Work context', description: 'Would shadow a platform type.' })
    assert.equal(shadow.type, 'work-context-test-world')
  })

  test('bad fields are refused, naming the field', async () => {
    const r = await nts.createWorldType(env, actorOf(FOUNDER), { title: 'X type', description: 'A type with a bad field.', fields: [{ label: 'Pris', kind: 'money' }] })
    assert.equal(r.ok, false)
    assert.match(r.message, /Pris/)
  })

  test('look → draft (version 1, code visible to the founder only), use → served; a stale version is refused', async () => {
    const a = actorOf(FOUNDER)
    const t = await nts.createWorldType(env, a, { title: 'Kursmodul', description: 'One module of a course.', fields: FIELDS.slice(0, 2) })
    const d1 = await nts.setWorldTypeLook(env, a, { type: t.type, impl: IMPL, fields: FIELDS })
    assert.deepEqual([d1.look.version, d1.look.status], [1, 'pending'])
    assert.equal(d1.fields.length, 4, 'fields replaced with the look')
    const mine = await nts.listWorldTypes(env, a, {})
    assert.equal(mine.types.find((x) => x.type === t.type).look.impl, IMPL)
    const other = await nts.listWorldTypes(env, actorOf(OTHER_FOUNDER), { world: WORLD })
    assert.equal(other.ok, false, 'another founder never sees drafts')
    invalidateNodeTypeCache()
    assert.equal(await approvedRenderer(env, t.type, { world: WORLD }), null)

    const stale = await nts.useWorldType(env, a, { type: t.type, version: 2 })
    assert.equal(stale.code, gs.ERR.VERSION_CONFLICT)
    const used = await nts.useWorldType(env, a, { type: t.type, version: 1 })
    assert.equal(used.look.status, 'approved')
    assert.equal(used.look.approvedBy, 'founder@example.com')
    invalidateNodeTypeCache()
    assert.equal((await approvedRenderer(env, t.type, { world: WORLD })).impl, IMPL)
  })

  test('another World’s founder cannot create, change or use here; signed-out is refused', async () => {
    const a = actorOf(FOUNDER)
    const t = await nts.createWorldType(env, a, { title: 'Kursmodul', description: 'One module of a course.' })
    const o = actorOf(OTHER_FOUNDER)
    assert.equal((await nts.createWorldType(env, o, { world: WORLD, title: 'Y', description: 'Not theirs to make.' })).code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal((await nts.setWorldTypeLook(env, o, { world: WORLD, type: t.type, impl: IMPL })).code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal((await nts.useWorldType(env, o, { world: WORLD, type: t.type, version: 1 })).code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal((await nts.listWorldTypes(env, null, {})).code, gs.ERR.UNAUTHENTICATED)
  })

  test('a Superadmin who founded a World gets it without naming it (V4 A); one with none must name one', async () => {
    env.vegvisr_org.db.exec(`INSERT INTO world_founders VALUES ('c', 'boss@example.com', NULL, 'own_account', 'acc', '${WORLD}', '2026-10-18')`)
    const boss = actorOf(authFor('boss@example.com', 'Superadmin'))
    assert.equal((await nts.resolveTypeWorld(env, boss, null)).world, WORLD)
    assert.equal((await nts.resolveTypeWorld(env, actorOf(SUPER), null)).ok, false)
    assert.equal((await nts.resolveTypeWorld(env, actorOf(SUPER), OTHER)).world, OTHER)
  })

  test('slugFromTitle and normalizeFields edge cases', () => {
    assert.equal(nts.slugFromTitle('  Ærlig Øving på Åsen! '), 'aerlig-oving-pa-asen')
    assert.equal(nts.slugFromTitle('123 Go'), 'go')
    assert.equal(nts.slugFromTitle('!'), '')
    assert.equal(nts.normalizeFields([{ label: 'A', key: 'a' }, { label: 'B', key: 'a' }]).ok, false)
    assert.equal(nts.normalizeFields(new Array(21).fill({ label: 'x' })).ok, false)
  })
})

describe('list_node_types with world', () => {
  test("adds the World's own types after the platform's, by name and title only", async () => {
    await registerTestCard(await connect(FOUNDER))
    invalidateNodeTypeCache()
    const stranger = await connect(STRANGER)

    const withWorld = sc(await call(stranger, 'list_node_types', { world: WORLD }))
    const card = withWorld.registered.find((x) => x.type === 'test-card')
    assert.deepEqual(card, { type: 'test-card', scope: 'world', title: 'test-card', description: null, consumer: null, renderer: null },
      "a World's description stays in the World — the same public contract as GET /node-types?world=")
    assert.equal(withWorld.registered.findIndex((x) => x.type === 'work-context') < withWorld.registered.indexOf(card), true)

    const plain = sc(await call(stranger, 'list_node_types', {}))
    assert.equal(plain.registered.some((x) => x.type === 'test-card'), false)
    assert.equal(sc(await call(stranger, 'list_node_types', { world: OTHER })).registered.some((x) => x.type === 'test-card'), false)
  })
})
