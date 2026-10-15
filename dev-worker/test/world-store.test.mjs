/**
 * World stores end to end (G3): graph-service → resolveGraphStore → WorldStore → signed HTTPS →
 * the real world-graphs-proxy → D1GraphStore over the World's own database.
 * Run: node --test dev-worker/test/
 *
 * Two in-memory databases stand for the two accounts: `platform` (vegvisr_org) and `world` (the
 * founder's D1). globalThis.fetch delivers graphs.<domain> to the proxy, so nothing is mocked
 * between graph-service and the World's SQL except the network.
 */
import { test, describe, before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { D1Like, freshDb } from './d1-adapter.mjs'
import * as gs from '../graph-service.js'
import proxy from '../world-graphs-proxy/index.js'
import { publicJwkOf } from '../world-graph-token.js'

const WORLD = 'sodesign.no'
const actor = (email, role = 'User') => gs.normalizeActor({ valid: true, userId: email, userEmail: email, userRole: role, authMethod: 'oauth', scopes: ['all'] })
const admin = actor('root@example.com', 'Superadmin')
const stine = actor('stine.oksvold@gmail.com', 'Admin')
const holder = actor('stineoksvolddesign@gmail.com')
const stranger = actor('someone@example.com', 'Admin')
const anon = gs.normalizeActor({ valid: true, userId: null, scopes: ['all'], authMethod: 'service_binding' })

let privateJwk
let env, world, proxyUp, realFetch

before(async () => {
  const k = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  privateJwk = await crypto.subtle.exportKey('jwk', k.privateKey)
})

beforeEach(() => {
  const { env: p } = freshDb()
  p.vegvisr_org.db.exec(`
    CREATE TABLE world_founders (id TEXT, founder_email TEXT, account_holder_email TEXT, hosting_model TEXT, cf_account_id TEXT, domain TEXT, created_at TEXT);
    INSERT INTO world_founders VALUES ('wf', 'stine.oksvold@gmail.com', 'stineoksvolddesign@gmail.com', 'own_account', 'b68b', '${WORLD}', '2026-10-15');
    CREATE TABLE world_graph_stores (domain TEXT PRIMARY KEY, cf_account_id TEXT, d1_database_id TEXT, d1_database_name TEXT, proxy_worker TEXT, endpoint_base TEXT, schema_version TEXT, template_version TEXT, status TEXT, provisioned_at TEXT, updated_at TEXT);
    INSERT INTO world_graph_stores VALUES ('${WORLD}', 'b68b', 'uuid', 'world-graphs-sodesign', 'sodesign-graphs-proxy', 'https://graphs.${WORLD}', 'v', '1', 'provisioned', '', '');
  `)
  env = { vegvisr_org: p.vegvisr_org, WORLD_GRAPH_SIGNING_KEY: JSON.stringify(privateJwk) }
  world = freshDb().env.vegvisr_org
  proxyUp = true
  realFetch = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    if (url.hostname !== `graphs.${WORLD}`) throw new Error(`unexpected fetch ${url}`)
    if (!proxyUp) throw new Error('connect ECONNREFUSED')
    return proxy.fetch(new Request(url, { method: init.method, headers: init.headers, body: init.body }), {
      GRAPH_DB: world, WORLD_DOMAIN: WORLD, PLATFORM_PUBLIC_KEY: JSON.stringify(publicJwkOf(privateJwk)),
    })
  }
})
afterEach(() => { globalThis.fetch = realFetch })

const platformRows = (id) => env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graphs WHERE id = ?').get(id).n
const worldRows = (id) => world.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graphs WHERE id = ?').get(id).n
const worldHistory = (id) => world.db.prepare('SELECT version FROM knowledge_graph_history WHERE graph_id = ? ORDER BY version').all(id).map((r) => r.version)
const locator = (id) => env.vegvisr_org.db.prepare('SELECT world_domain, status FROM graph_locations WHERE graph_id = ?').get(id)
const create = (who, over = {}) => gs.createGraph(env, { title: 'Strikk', metaArea: '#STINE', nodes: [{ id: 'n1', label: 'n1', info: 'v1' }], actor: who, world: WORLD, ...over })

describe('creating a graph in a World', () => {
  test('a Superadmin can: the row lands in the World database and nowhere on the platform', async () => {
    const r = await create(admin)
    assert.equal(r.ok, true, r.message)
    assert.equal(r.world, WORLD)
    assert.equal(r.version, 1)
    assert.equal(worldRows(r.graphId), 1)
    assert.equal(platformRows(r.graphId), 0)
    assert.deepEqual(worldHistory(r.graphId), [1])
    assert.deepEqual({ ...locator(r.graphId) }, { world_domain: WORLD, status: 'active' })
  })
  test("the World's founder can, and so can its account holder", async () => {
    assert.equal((await create(stine)).ok, true)
    assert.equal((await create(holder)).ok, true)
  })
  test('anyone else is refused, and nothing is written anywhere', async () => {
    for (const who of [stranger, anon]) {
      const r = await create(who)
      assert.equal(r.ok, false)
      assert.equal(r.code, 'FORBIDDEN_GRAPH')
    }
    assert.equal(world.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graphs').get().n, 0)
    assert.equal(env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graphs').get().n, 0)
  })
  test('a World with no graph store is an input error, not a silent platform write', async () => {
    const r = await create(admin, { world: 'example.org' })
    assert.equal(r.code, 'INVALID_INPUT')
    assert.equal(env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graphs').get().n, 0)
  })
  test('an unreachable store fails the create and leaves no row and no locator anywhere', async () => {
    proxyUp = false
    const r = await create(admin)
    assert.equal(r.ok, false)
    assert.equal(r.code, 'STORE_UNAVAILABLE')
    assert.equal(env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graphs').get().n, 0)
    // The store fails before the locator is ever claimed, so the table may not even exist yet.
    let pending = 0
    try { pending = env.vegvisr_org.db.prepare("SELECT COUNT(*) AS n FROM graph_locations").get().n } catch { /* no table, no locator */ }
    assert.equal(pending, 0)
  })
  test('without world, creation is exactly as before: the platform', async () => {
    const r = await create(stine, { world: null })
    assert.equal(r.ok, true)
    assert.equal(r.world, null)
    assert.equal(platformRows(r.graphId), 1)
  })
})

describe('working with a graph that lives in a World', () => {
  test('the founder reads and edits it; versions and history are kept in the World', async () => {
    const { graphId } = await create(admin)
    assert.equal((await gs.checkAccess(env, stine, graphId, 'write')).ok, true)
    const read = await gs.getGraph(env, graphId, { caller: stine })
    assert.equal(read.ok, true)
    assert.equal(read.world, WORLD)
    assert.equal(read.graph.nodes[0].info, 'v1')

    const upd = await gs.updateNode(env, { graphId, nodeId: 'n1', fields: { info: 'v2' }, expectedVersion: 1, actor: stine })
    assert.equal(upd.ok, true, upd.message)
    const add = await gs.addNode(env, { graphId, node: { id: 'n2', label: 'n2' }, actor: stine })
    assert.equal(add.newVersion, 3)
    const meta = await gs.updateMetadata(env, { graphId, fields: { title: 'Ny tittel' }, expectedVersion: 3, actor: stine })
    assert.equal(meta.newVersion, 4)
    assert.deepEqual(worldHistory(graphId), [1, 2, 3, 4])
    assert.equal(platformRows(graphId), 0)
  })
  test('a stale write is a version conflict and writes nothing', async () => {
    const { graphId } = await create(admin)
    await gs.updateNode(env, { graphId, nodeId: 'n1', fields: { info: 'v2' }, expectedVersion: 1, actor: stine })
    const stale = await gs.updateNode(env, { graphId, nodeId: 'n1', fields: { info: 'nope' }, expectedVersion: 1, actor: stine })
    assert.equal(stale.code, 'VERSION_CONFLICT')
    assert.deepEqual(worldHistory(graphId), [1, 2])
  })
  test('a stranger and an anonymous caller are refused on every path', async () => {
    const { graphId } = await create(admin)
    for (const who of [stranger, anon]) {
      assert.equal((await gs.checkAccess(env, who, graphId, 'read')).code, 'FORBIDDEN_GRAPH')
      assert.equal((await gs.getGraph(env, graphId, { caller: who })).code, 'FORBIDDEN_GRAPH')
      assert.equal((await gs.updateNode(env, { graphId, nodeId: 'n1', fields: { info: 'x' }, expectedVersion: 1, actor: who })).code, 'FORBIDDEN_GRAPH')
    }
    // A read that names nobody at all — the REST shape before a caller is passed — is refused too.
    assert.equal((await gs.getGraph(env, graphId)).code, 'FORBIDDEN_GRAPH')
    assert.deepEqual(worldHistory(graphId), [1])
  })
  test('an unreachable store is an error on reads too, never a fallback', async () => {
    const { graphId } = await create(admin)
    proxyUp = false
    const r = await gs.getGraph(env, graphId, { caller: stine })
    assert.equal(r.code, 'STORE_UNAVAILABLE')
  })
  test('world on an existing graph does not move it', async () => {
    const platformGraph = await create(admin, { world: null })
    const r = await gs.saveGraph(env, { id: platformGraph.graphId, graphData: { metadata: { version: 1 }, nodes: [], edges: [] }, actor: admin, world: WORLD })
    assert.equal(r.code, 'INVALID_INPUT')
    assert.equal(worldRows(platformGraph.graphId), 0)
  })
})

describe('lists and search reach the World stores the actor may use (G4)', () => {
  test("the founder's list_my_graphs includes the World's graphs, whoever created them", async () => {
    const w = await create(admin, { title: 'Fra Superadmin' })
    const p = await gs.createGraph(env, { title: 'Min plattformgraf', metaArea: '#X', actor: stine })
    const r = await gs.listMyGraphs(env, { actor: stine })
    assert.equal(r.ok, true, r.message)
    const ids = r.results.map((x) => x.graphId)
    assert.ok(ids.includes(w.graphId) && ids.includes(p.graphId))
    assert.equal(r.results.find((x) => x.graphId === w.graphId).world, WORLD)
    assert.equal(r.results.find((x) => x.graphId === p.graphId).world, null)
    assert.equal(r.total, 2)
  })
  test('a Superadmin who is not the founder sees only what they created there', async () => {
    const mine = await create(admin, { title: 'Admin sin' })
    await create(stine, { title: 'Stine sin' })
    const r = await gs.listMyGraphs(env, { actor: admin })
    assert.deepEqual(r.results.map((x) => x.graphId), [mine.graphId])
  })
  test('search finds a World graph by its node text for the founder, never for a stranger', async () => {
    const w = await create(admin, { title: 'Strikkeoppskrift', nodes: [{ id: 'n1', label: 'Mønster', info: 'Alpakkagarn i rosa' }] })
    const forStine = await gs.searchGraphs(env, { query: 'alpakka', actor: stine })
    assert.deepEqual(forStine.results.map((x) => [x.graphId, x.world]), [[w.graphId, WORLD]])
    const forStranger = await gs.searchGraphs(env, { query: 'alpakka', actor: stranger })
    assert.equal(forStranger.total, 0)
  })
  test('the merged page is newest first across stores, and total counts both', async () => {
    const a = await gs.createGraph(env, { title: 'A', metaArea: '#X', actor: stine })
    await new Promise((r) => setTimeout(r, 5))
    const b = await create(stine, { title: 'B' })
    await new Promise((r) => setTimeout(r, 5))
    const c = await gs.createGraph(env, { title: 'C', metaArea: '#X', actor: stine })
    const page1 = await gs.listMyGraphs(env, { actor: stine, limit: 2 })
    assert.deepEqual(page1.results.map((x) => x.graphId), [c.graphId, b.graphId])
    assert.equal(page1.total, 3)
    const page2 = await gs.listMyGraphs(env, { actor: stine, limit: 2, offset: 2 })
    assert.deepEqual(page2.results.map((x) => x.graphId), [a.graphId])
  })
  test('a #EMAIL- system graph is never placed in a World', async () => {
    const r = await create(admin, { metaArea: '#EMAIL-sodesign.no' })
    assert.equal(r.code, 'INVALID_INPUT')
  })
})

describe('moving a platform graph into a World (G6)', () => {
  async function platformGraphWithHistory() {
    const g = await gs.createGraph(env, { title: 'Gammel plan', metaArea: '#STINE', nodes: [{ id: 'n1', label: 'n1', info: 'v1' }], actor: admin })
    await gs.updateNode(env, { graphId: g.graphId, nodeId: 'n1', fields: { info: 'v2' }, expectedVersion: 1, actor: admin })
    await gs.addNode(env, { graphId: g.graphId, node: { id: 'n2', label: 'n2' }, actor: admin })
    return g.graphId
  }
  test('row and every version land in the World, verified; the platform copy goes to the trash', async () => {
    const id = await platformGraphWithHistory()
    const before = env.vegvisr_org.db.prepare('SELECT data FROM knowledge_graphs WHERE id = ?').get(id).data
    const r = await gs.moveGraphToWorld(env, { graphId: id, world: WORLD, actor: admin })
    assert.equal(r.ok, true, r.message)
    assert.equal(r.history, 3)
    assert.deepEqual(r.verified.versions, [1, 2, 3])
    assert.equal(world.db.prepare('SELECT data FROM knowledge_graphs WHERE id = ?').get(id).data, before)
    assert.deepEqual(worldHistory(id), [1, 2, 3])
    assert.equal(platformRows(id), 0)
    assert.equal(env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graph_history WHERE graph_id = ?').get(id).n, 0)
    assert.equal(env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM graph_trash WHERE graph_id = ?').get(id).n, 1)
    assert.deepEqual({ ...locator(id) }, { world_domain: WORLD, status: 'active' })
    // Same id, now served from the World to its founder.
    const read = await gs.getGraph(env, id, { caller: stine })
    assert.equal(read.world, WORLD)
    assert.equal(read.graph.nodes.length, 2)
    const upd = await gs.updateNode(env, { graphId: id, nodeId: 'n1', fields: { info: 'v4' }, expectedVersion: 3, actor: stine })
    assert.equal(upd.newVersion, 4)
  })
  test('only a Superadmin may move', async () => {
    const id = await platformGraphWithHistory()
    const r = await gs.moveGraphToWorld(env, { graphId: id, world: WORLD, actor: stine })
    assert.equal(r.code, 'FORBIDDEN_GRAPH')
    assert.equal(platformRows(id), 1)
  })
  test('a failing World leaves the platform graph untouched and no locator behind', async () => {
    const id = await platformGraphWithHistory()
    proxyUp = false
    const r = await gs.moveGraphToWorld(env, { graphId: id, world: WORLD, actor: admin })
    assert.equal(r.ok, false)
    assert.equal(platformRows(id), 1)
    assert.equal(locator(id), undefined)
  })
  test('duplicate platform history versions are collapsed to the newest and reported', async () => {
    const id = await platformGraphWithHistory()
    env.vegvisr_org.db.prepare("INSERT INTO knowledge_graph_history (id, graph_id, version, timestamp, data) VALUES ('dup', ?, 2, '2999-01-01 00:00:00', '{\"dup\":true}')").run(id)
    const r = await gs.moveGraphToWorld(env, { graphId: id, world: WORLD, actor: admin })
    assert.equal(r.ok, true, r.message)
    assert.equal(r.duplicatesDropped, 1)
    assert.equal(JSON.parse(world.db.prepare('SELECT data FROM knowledge_graph_history WHERE graph_id = ? AND version = 2').get(id).data).dup, true)
  })
  test('a graph already in a World, or a #EMAIL- graph, is refused', async () => {
    const w = await create(admin)
    assert.equal((await gs.moveGraphToWorld(env, { graphId: w.graphId, world: WORLD, actor: admin })).code, 'INVALID_INPUT')
    const e = await gs.createGraph(env, { title: 'Mal', metaArea: '#EMAIL-sodesign.no', actor: admin })
    assert.equal((await gs.moveGraphToWorld(env, { graphId: e.graphId, world: WORLD, actor: admin })).code, 'INVALID_INPUT')
    assert.equal(platformRows(e.graphId), 1)
  })
})

describe('default World for its founder (G7)', () => {
  const activate = () => env.vegvisr_org.db.prepare("UPDATE world_graph_stores SET status = 'active' WHERE domain = ?").run(WORLD)
  test("while the store is only 'provisioned', a founder's new graph stays on the platform", async () => {
    const r = await gs.createGraph(env, { title: 'Før', metaArea: '#X', actor: stine })
    assert.equal(r.world, null)
    assert.equal(platformRows(r.graphId), 1)
  })
  test("once 'active', the founder's and the account holder's new graphs go to the World without asking", async () => {
    activate()
    for (const who of [stine, holder]) {
      const r = await gs.createGraph(env, { title: 'Etter', metaArea: '#X', actor: who })
      assert.equal(r.ok, true, r.message)
      assert.equal(r.world, WORLD)
      assert.equal(worldRows(r.graphId), 1)
      assert.equal(platformRows(r.graphId), 0)
    }
  })
  test('a REST-style save naming the founder only as caller is defaulted too', async () => {
    activate()
    const id = '33333333-3333-4333-8333-333333333333'
    const r = await gs.saveGraph(env, { id, graphData: { metadata: { title: 'REST', version: 0, createdBy: 'stine.oksvold@gmail.com' }, nodes: [], edges: [] }, caller: stine })
    assert.equal(r.world, WORLD)
    assert.equal(worldRows(id), 1)
  })
  test('a Superadmin, a stranger, and an #EMAIL- system graph are never defaulted', async () => {
    activate()
    assert.equal((await gs.createGraph(env, { title: 'A', metaArea: '#X', actor: admin })).world, null)
    assert.equal((await gs.createGraph(env, { title: 'S', metaArea: '#X', actor: stranger })).world, null)
    const e = await gs.createGraph(env, { title: 'Mal', metaArea: '#EMAIL-sodesign.no', actor: stine })
    assert.equal(e.ok, true, e.message)
    assert.equal(e.world, null)
    assert.equal(platformRows(e.graphId), 1)
  })
  test('active but unreachable: the create fails and nothing lands on the platform', async () => {
    activate()
    proxyUp = false
    const before = env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graphs').get().n
    const r = await gs.createGraph(env, { title: 'Nede', metaArea: '#X', actor: stine })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'STORE_UNAVAILABLE')
    assert.equal(env.vegvisr_org.db.prepare('SELECT COUNT(*) AS n FROM knowledge_graphs').get().n, before)
  })
  test('a founder of two active Worlds is not guessed for', async () => {
    activate()
    env.vegvisr_org.db.exec(`
      INSERT INTO world_founders VALUES ('wf2', 'stine.oksvold@gmail.com', '', 'own_account', 'x', 'other.no', '2026-10-15');
      INSERT INTO world_graph_stores VALUES ('other.no', 'x', 'u2', 'world-graphs-other', 'other-graphs-proxy', 'https://graphs.other.no', 'v', '2', 'active', '', '');
    `)
    assert.equal((await gs.createGraph(env, { title: 'To', metaArea: '#X', actor: stine })).world, null)
  })
})

describe('platform graphs are untouched by any of this', () => {
  test('an anonymous REST-style read of a platform graph still works', async () => {
    const r = await gs.createGraph(env, { title: 'P', metaArea: '#X', actor: stranger })
    assert.equal((await gs.getGraph(env, r.graphId)).ok, true)
  })
})
