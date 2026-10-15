/**
 * world-graphs-proxy — the worker that runs in a World Founder's own Cloudflare account.
 * Run: node --test dev-worker/test/
 *
 * Exercised the way the KG worker and Agent-Builder will call it: HTTP requests with signed
 * tokens, against a real SQLite engine. The token rules are the security boundary of the whole
 * World graph store, so each one has a test that shows a wrong token being refused.
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { D1Like, freshDb } from './d1-adapter.mjs'
import proxy, { TEMPLATE_VERSION } from '../world-graphs-proxy/index.js'
import { signWorldGraphToken, publicJwkOf } from '../world-graph-token.js'

const WORLD = 'sodesign.no'
const ID = '22222222-2222-4222-8222-222222222222'
let privateJwk, otherPrivateJwk

before(async () => {
  const gen = async () => (await crypto.subtle.exportKey('jwk', (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey))
  privateJwk = await gen()
  otherPrivateJwk = await gen()
})

function seededEnv() {
  const { env } = freshDb()
  // freshDb already has the three graph tables; give it the meta row migrate would have written.
  return { GRAPH_DB: env.vegvisr_org, WORLD_DOMAIN: WORLD, PLATFORM_PUBLIC_KEY: JSON.stringify(publicJwkOf(privateJwk)) }
}

async function call(env, path, payload, { key = privateJwk, aud = WORLD, op = payload?.op ?? 'migrate', token } = {}) {
  const body = JSON.stringify(payload)
  const t = token ?? (await signWorldGraphToken(key, { aud, op, body }))
  const res = await proxy.fetch(new Request(`https://graphs.${WORLD}${path}`, { method: 'POST', body, headers: { Authorization: `Bearer ${t}` } }), env)
  return { status: res.status, body: await res.json() }
}
const rpc = (env, op, args, opts) => call(env, '/__graphs/rpc', { op, args }, opts)
const blob = (v) => JSON.stringify({ metadata: { version: v, title: 'T' }, nodes: [], edges: [] })

describe('check', () => {
  test('reports versions and bindings without any token', async () => {
    const env = seededEnv()
    const res = await proxy.fetch(new Request(`https://graphs.${WORLD}/__graphs/check`), env)
    const body = await res.json()
    assert.equal(body.template_version, TEMPLATE_VERSION)
    assert.equal(body.world, WORLD)
    assert.equal(body.db_bound, true)
    assert.equal(body.key_bound, true)
    assert.ok(body.tables.includes('knowledge_graphs'))
    assert.equal(body.ok, false, 'not ready until migrate has recorded a schema version')
  })
})

describe('migrate', () => {
  test('creates the tables in an empty database and records the schema version', async () => {
    const env = { GRAPH_DB: new D1Like(new DatabaseSync(':memory:')), WORLD_DOMAIN: WORLD, PLATFORM_PUBLIC_KEY: JSON.stringify(publicJwkOf(privateJwk)) }
    const statements = [
      'CREATE TABLE IF NOT EXISTS knowledge_graphs (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, created_date DATETIME, created_by TEXT NOT NULL, data TEXT, updated_at DATETIME, user_id TEXT, source_app TEXT, ai_instructions TEXT)',
      'CREATE TABLE IF NOT EXISTS knowledge_graph_history (id TEXT PRIMARY KEY, graph_id TEXT NOT NULL, version INTEGER NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, data TEXT NOT NULL, user_id TEXT, source_app TEXT)',
      'CREATE UNIQUE INDEX IF NOT EXISTS ux_history_graph_version ON knowledge_graph_history (graph_id, version)',
    ]
    const r = await call(env, '/__graphs/migrate', { statements, schema_version: '2026-10-15' })
    assert.deepEqual(r.body, { ok: true, applied: 3, schema_version: '2026-10-15' })
    const check = await (await proxy.fetch(new Request(`https://x/__graphs/check`), env)).json()
    assert.equal(check.schema_version, '2026-10-15')
    assert.equal(check.ok, true)
    // Running it again is harmless: every statement is IF NOT EXISTS.
    assert.equal((await call(env, '/__graphs/migrate', { statements, schema_version: '2026-10-15' })).body.ok, true)
  })
  test('refuses anything that is not CREATE … IF NOT EXISTS', async () => {
    const env = seededEnv()
    for (const bad of ['DROP TABLE knowledge_graphs', 'CREATE TABLE x (a)', 'DELETE FROM knowledge_graphs', 'ALTER TABLE knowledge_graphs ADD COLUMN z']) {
      const r = await call(env, '/__graphs/migrate', { statements: [bad], schema_version: '1' })
      assert.equal(r.status, 400, bad)
    }
  })
})

describe('rpc — the store over HTTP', () => {
  test('create, read, conflict and history work through the proxy', async () => {
    const env = seededEnv()
    const now = '2026-10-15T10:00:00.000Z'
    assert.equal((await rpc(env, 'commit', [{ id: ID, create: true, data: blob(1), version: 1, now, title: 'T', createdBy: 'stine.oksvold@gmail.com' }])).body.ok, true)
    assert.equal((await rpc(env, 'exists', [ID])).body.result, true)
    assert.equal((await rpc(env, 'currentVersion', [ID])).body.result, 1)
    assert.deepEqual((await rpc(env, 'commit', [{ id: ID, data: blob(2), version: 2, casVersion: 1, now }])).body.result, { ok: true })
    assert.deepEqual((await rpc(env, 'commit', [{ id: ID, data: blob(2), version: 2, casVersion: 1, now }])).body.result, { ok: false, conflict: true })
    const hist = (await rpc(env, 'historyList', [ID])).body.result
    assert.deepEqual(hist.results.map((r) => r.version), [2, 1])
    const row = (await rpc(env, 'getRow', [ID])).body.result
    assert.equal(JSON.parse(row.data).metadata.version, 2)
  })
  test('first/all accept one SELECT and nothing else', async () => {
    const env = seededEnv()
    assert.equal((await rpc(env, 'all', ['SELECT id FROM knowledge_graphs', []])).status, 200)
    for (const sql of ['DELETE FROM knowledge_graphs', 'SELECT 1; DELETE FROM knowledge_graphs', 'UPDATE knowledge_graphs SET data = 1']) {
      assert.equal((await rpc(env, 'all', [sql, []])).status, 400, sql)
    }
  })
  test('an op outside the store surface is refused', async () => {
    const env = seededEnv()
    assert.equal((await rpc(env, 'constructor', [])).status, 400)
    assert.equal((await rpc(env, 'db', [])).status, 400)
  })
})

describe('tokens — every wrong one is refused', () => {
  const payload = { op: 'getRow', args: [ID] }
  test('no token', async () => {
    const env = seededEnv()
    const res = await proxy.fetch(new Request(`https://x/__graphs/rpc`, { method: 'POST', body: JSON.stringify(payload) }), env)
    assert.equal(res.status, 401)
  })
  test('signed by another key', async () => {
    assert.equal((await call(seededEnv(), '/__graphs/rpc', payload, { key: otherPrivateJwk })).status, 401)
  })
  test('for another World', async () => {
    const r = await call(seededEnv(), '/__graphs/rpc', payload, { aud: 'stineoksvolddesign.no' })
    assert.equal(r.status, 401)
    assert.match(r.body.error, /another World/)
  })
  test('for another op', async () => {
    const r = await call(seededEnv(), '/__graphs/rpc', payload, { op: 'commit' })
    assert.equal(r.status, 401)
  })
  test('for another body', async () => {
    const env = seededEnv()
    const token = await signWorldGraphToken(privateJwk, { aud: WORLD, op: 'getRow', body: JSON.stringify({ op: 'getRow', args: ['other'] }) })
    assert.equal((await call(env, '/__graphs/rpc', payload, { token })).status, 401)
  })
  test('expired', async () => {
    const body = JSON.stringify(payload)
    const token = await signWorldGraphToken(privateJwk, { aud: WORLD, op: 'getRow', body, now: Date.now() - 10 * 60 * 1000 })
    const r = await call(seededEnv(), '/__graphs/rpc', payload, { token })
    assert.equal(r.status, 401)
    assert.match(r.body.error, /expired/)
  })
  test('a proxy without a public key refuses everything', async () => {
    const env = { ...seededEnv(), PLATFORM_PUBLIC_KEY: undefined }
    assert.equal((await call(env, '/__graphs/rpc', payload)).status, 401)
  })
})
