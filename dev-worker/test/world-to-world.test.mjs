/**
 * Moving a graph from one World's own store to another's (2026-11-15).
 * Run: node --test dev-worker/test/
 *
 * Three in-memory databases: the platform (vegvisr_org) and two Worlds, each behind the REAL
 * world-graphs-proxy. globalThis.fetch delivers graphs.<domain> to the proxy of that World, so
 * nothing is mocked between graph-service and each World's SQL except the network.
 */
import { test, describe, before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb } from './d1-adapter.mjs'
import * as gs from '../graph-service.js'
import proxy from '../world-graphs-proxy/index.js'
import { publicJwkOf } from '../world-graph-token.js'

const A = 'sodesign.no'
const B = 'vegr.ai'
const actor = (email, role = 'User') => gs.normalizeActor({ valid: true, userId: email, userEmail: email, userRole: role, authMethod: 'oauth', scopes: ['all'] })
const admin = actor('root@example.com', 'Superadmin')
const stine = actor('stine.oksvold@gmail.com', 'Admin')
const post = actor('post@vegr.ai', 'Admin')

let privateJwk
let env, dbs, down, realFetch

before(async () => {
  const k = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  privateJwk = await crypto.subtle.exportKey('jwk', k.privateKey)
})

beforeEach(() => {
  const { env: p } = freshDb()
  p.vegvisr_org.db.exec(`
    CREATE TABLE world_founders (id TEXT, founder_email TEXT, account_holder_email TEXT, hosting_model TEXT, cf_account_id TEXT, domain TEXT, created_at TEXT);
    INSERT INTO world_founders VALUES ('wa', 'stine.oksvold@gmail.com', 'stineoksvolddesign@gmail.com', 'own_account', 'aaaa', '${A}', '2026-10-15');
    INSERT INTO world_founders VALUES ('wb', 'post@vegr.ai', 'post@vegr.ai', 'own_account', 'bbbb', '${B}', '2026-09-23');
    CREATE TABLE world_graph_stores (domain TEXT PRIMARY KEY, cf_account_id TEXT, d1_database_id TEXT, d1_database_name TEXT, proxy_worker TEXT, endpoint_base TEXT, schema_version TEXT, template_version TEXT, status TEXT, provisioned_at TEXT, updated_at TEXT);
    INSERT INTO world_graph_stores VALUES ('${A}', 'aaaa', 'u1', 'world-graphs-sodesign', 'sodesign-graphs-proxy', 'https://graphs.${A}', 'v', '2', 'active', '', '');
    INSERT INTO world_graph_stores VALUES ('${B}', 'bbbb', 'u2', 'world-graphs-vegr', 'vegr-graphs-proxy', 'https://graphs.${B}', 'v', '2', 'active', '', '');
  `)
  env = { vegvisr_org: p.vegvisr_org, WORLD_GRAPH_SIGNING_KEY: JSON.stringify(privateJwk) }
  dbs = { [A]: freshDb().env.vegvisr_org, [B]: freshDb().env.vegvisr_org }
  down = new Set()
  realFetch = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    const domain = url.hostname.replace(/^graphs\./, '')
    if (!dbs[domain]) throw new Error(`unexpected fetch ${url}`)
    if (down.has(domain)) throw new Error('connect ECONNREFUSED')
    return proxy.fetch(new Request(url, { method: init.method, headers: init.headers, body: init.body }), {
      GRAPH_DB: dbs[domain], WORLD_DOMAIN: domain, PLATFORM_PUBLIC_KEY: JSON.stringify(publicJwkOf(privateJwk)),
    })
  }
})
afterEach(() => { globalThis.fetch = realFetch })

const rows = (domain, id) => dbs[domain].db.prepare('SELECT COUNT(*) AS n FROM knowledge_graphs WHERE id = ?').get(id).n
const history = (domain, id) => dbs[domain].db.prepare('SELECT version FROM knowledge_graph_history WHERE graph_id = ? ORDER BY version').all(id).map((r) => r.version)
const trashed = (domain, id) => dbs[domain].db.prepare('SELECT COUNT(*) AS n FROM graph_trash WHERE graph_id = ?').get(id).n
const locator = (id) => ({ ...env.vegvisr_org.db.prepare('SELECT world_domain, status FROM graph_locations WHERE graph_id = ?').get(id) })

async function graphInA() {
  const g = await gs.createGraph(env, { title: 'Strikk', metaArea: '#STINE', nodes: [{ id: 'n1', label: 'n1', info: 'v1' }], actor: admin, world: A })
  assert.equal(g.ok, true, g.message)
  await gs.updateNode(env, { graphId: g.graphId, nodeId: 'n1', fields: { info: 'v2' }, expectedVersion: 1, actor: admin })
  await gs.addNode(env, { graphId: g.graphId, node: { id: 'n2', label: 'n2' }, actor: admin })
  return g.graphId
}

describe('moving a graph from one World to another', () => {
  test('row and every version land in the new World, verified; the old copy goes to the old World\'s trash', async () => {
    const id = await graphInA()
    assert.deepEqual(locator(id), { world_domain: A, status: 'active' })
    const before = dbs[A].db.prepare('SELECT data FROM knowledge_graphs WHERE id = ?').get(id).data
    const r = await gs.moveGraphToWorld(env, { graphId: id, world: B, actor: admin })
    assert.equal(r.ok, true, r.message)
    assert.equal(r.from, A)
    assert.equal(r.world, B)
    assert.deepEqual(r.verified.versions, [1, 2, 3])
    assert.match(r.originalCopy, /in the trash of sodesign\.no/)
    assert.equal(dbs[B].db.prepare('SELECT data FROM knowledge_graphs WHERE id = ?').get(id).data, before)
    assert.deepEqual(history(B, id), [1, 2, 3])
    assert.equal(rows(A, id), 0)
    assert.deepEqual(history(A, id), [])
    assert.equal(trashed(A, id), 1)
    assert.deepEqual(locator(id), { world_domain: B, status: 'active' })
    // Same id, now read from and written to the new World.
    const read = await gs.getGraph(env, id, { caller: post })
    assert.equal(read.world, B)
    assert.equal(read.graph.nodes.length, 2)
    const upd = await gs.updateNode(env, { graphId: id, nodeId: 'n1', fields: { info: 'v4' }, expectedVersion: 3, actor: post })
    assert.equal(upd.newVersion, 4)
    assert.deepEqual(history(B, id), [1, 2, 3, 4])
  })

  test('only a Superadmin may move', async () => {
    const id = await graphInA()
    const r = await gs.moveGraphToWorld(env, { graphId: id, world: B, actor: stine })
    assert.equal(r.code, 'FORBIDDEN_GRAPH')
    assert.equal(rows(A, id), 1)
    assert.deepEqual(locator(id), { world_domain: A, status: 'active' })
  })

  test('moving to the World it is already in is refused', async () => {
    const id = await graphInA()
    const r = await gs.moveGraphToWorld(env, { graphId: id, world: A, actor: admin })
    assert.equal(r.code, 'INVALID_INPUT')
    assert.match(r.message, /already in sodesign\.no/)
    assert.equal(rows(A, id), 1)
  })

  test('a target World that is down leaves the graph where it was, nothing half-moved', async () => {
    const id = await graphInA()
    down.add(B)
    const r = await gs.moveGraphToWorld(env, { graphId: id, world: B, actor: admin })
    assert.equal(r.ok, false)
    assert.equal(rows(A, id), 1)
    assert.deepEqual(history(A, id), [1, 2, 3])
    assert.equal(trashed(A, id), 0)
    assert.deepEqual(locator(id), { world_domain: A, status: 'active' })
    down.delete(B)
    assert.equal(rows(B, id), 0)
  })

  test('a graph with the same id already in the target is never overwritten or deleted', async () => {
    const id = await graphInA()
    // Plant an unrelated row with that id in B directly.
    dbs[B].db.prepare("INSERT INTO knowledge_graphs (id, title, created_by, data) VALUES (?, 'other', 'post@vegr.ai', '{\"metadata\":{\"title\":\"other\"},\"nodes\":[],\"edges\":[]}')").run(id)
    const r = await gs.moveGraphToWorld(env, { graphId: id, world: B, actor: admin })
    assert.equal(r.code, 'INVALID_INPUT')
    assert.equal(rows(B, id), 1)
    assert.equal(dbs[B].db.prepare('SELECT title FROM knowledge_graphs WHERE id = ?').get(id).title, 'other')
    assert.equal(rows(A, id), 1)
    assert.deepEqual(locator(id), { world_domain: A, status: 'active' })
  })

  test('platform to World still works as before and says where it came from', async () => {
    const g = await gs.createGraph(env, { title: 'Plattform', metaArea: '#X', nodes: [{ id: 'n1', label: 'n1' }], actor: admin })
    const r = await gs.moveGraphToWorld(env, { graphId: g.graphId, world: B, actor: admin })
    assert.equal(r.ok, true, r.message)
    assert.equal(r.from, 'platform')
    assert.match(r.platformCopy, /platform trash/)
    assert.deepEqual(locator(g.graphId), { world_domain: B, status: 'active' })
  })
})
