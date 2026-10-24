/**
 * checkReadAccess() — the gate behind KG_ENFORCE_READ_AUTH on the open REST read routes
 * (/getknowgraph, /getknowgraphversion, /public-graph). Owner decision 2026-10-24: a graph is
 * read only from approved sources. Run: node --test dev-worker/test/
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb } from './d1-adapter.mjs'
import * as gs from '../graph-service.js'

const alice = gs.normalizeActor({ valid: true, userId: 'alice@example.com', userEmail: 'alice@example.com', userRole: 'User', authMethod: 'session_token', scopes: ['all'] })
const bob = gs.normalizeActor({ valid: true, userId: 'bob@example.com', userEmail: 'bob@example.com', userRole: 'User', authMethod: 'session_token', scopes: ['all'] })
const admin = gs.normalizeActor({ valid: true, userId: 'root@example.com', userEmail: 'root@example.com', userRole: 'Superadmin', authMethod: 'session_token', scopes: ['all'] })
// What a browser component or a trusted origin is: valid, with no identity.
const trustedOrigin = gs.normalizeActor({ valid: true, userId: null, scopes: ['graph:read'], authMethod: 'trusted_origin' })
// A server source holding its own API token, owned by the account that issued it.
const serverSource = gs.normalizeActor({ valid: true, userId: 'alice@example.com', scopes: ['graph:read'], authMethod: 'api_token' })

async function privateGraph(env, actor = alice) {
  const r = await gs.createGraph(env, { title: 'T', description: 'D', metaArea: '#X', actor })
  assert.equal(r.ok, true, `createGraph failed: ${r.message}`)
  return r
}

async function publishedGraph(env) {
  const r = await privateGraph(env)
  const p = await gs.publishGraph(env, { graphId: r.graphId, expectedVersion: r.version, actor: alice })
  assert.equal(p.ok, true, `publishGraph failed: ${p.message}`)
  return r
}

describe('checkReadAccess — a private graph', () => {
  test('no caller at all is refused', async () => {
    const { env } = freshDb()
    const { graphId } = await privateGraph(env)
    const r = await gs.checkReadAccess(env, null, graphId)
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('an anonymous caller (trusted origin, browser component) is refused', async () => {
    const { env } = freshDb()
    const { graphId } = await privateGraph(env)
    const r = await gs.checkReadAccess(env, trustedOrigin, graphId)
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('its owner reads it', async () => {
    const { env } = freshDb()
    const { graphId } = await privateGraph(env)
    assert.equal((await gs.checkReadAccess(env, alice, graphId)).ok, true)
  })

  test('a server source with its owner\'s token reads it', async () => {
    const { env } = freshDb()
    const { graphId } = await privateGraph(env)
    assert.equal((await gs.checkReadAccess(env, serverSource, graphId)).ok, true)
  })

  test('another signed-in user is refused', async () => {
    const { env } = freshDb()
    const { graphId } = await privateGraph(env)
    const r = await gs.checkReadAccess(env, bob, graphId)
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('a Superadmin reads it', async () => {
    const { env } = freshDb()
    const { graphId } = await privateGraph(env)
    assert.equal((await gs.checkReadAccess(env, admin, graphId)).ok, true)
  })
})

describe('checkReadAccess — a published graph', () => {
  test('everyone reads it: nobody, anonymous, another user', async () => {
    const { env } = freshDb()
    const { graphId } = await publishedGraph(env)
    for (const caller of [null, trustedOrigin, bob]) {
      const r = await gs.checkReadAccess(env, caller, graphId)
      assert.equal(r.ok, true, `refused for ${caller?.authMethod || 'no caller'}: ${r.message}`)
    }
  })
})

describe('checkReadAccess — edges', () => {
  test('a graph that does not exist is GRAPH_NOT_FOUND, for anonymous and identified alike', async () => {
    const { env } = freshDb()
    const id = crypto.randomUUID()
    assert.equal((await gs.checkReadAccess(env, null, id)).code, gs.ERR.GRAPH_NOT_FOUND)
    assert.equal((await gs.checkReadAccess(env, alice, id)).code, gs.ERR.GRAPH_NOT_FOUND)
  })

  test('no id is INVALID_INPUT', async () => {
    const { env } = freshDb()
    assert.equal((await gs.checkReadAccess(env, alice, '')).code, gs.ERR.INVALID_INPUT)
  })

  test('the check reads nothing it should not change: the graph is untouched', async () => {
    const { env } = freshDb()
    const { graphId, version } = await privateGraph(env)
    await gs.checkReadAccess(env, null, graphId)
    const g = await gs.getGraph(env, graphId)
    assert.equal(g.graph.metadata.version, version)
    assert.equal(g.graph.metadata.publicationState, 'private')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// readGate() — the switch itself
// ─────────────────────────────────────────────────────────────────────────────
import { readGate, readGateMode } from '../read-gate.js'

const req = (host = 'knowledge.vegvisr.org', headers = {}) => new Request(`https://${host}/getknowgraph?id=x`, { headers })
const withMode = (env, mode) => ({ ...env, KG_ENFORCE_READ_AUTH: mode })

describe('readGate — the switch', () => {
  test('mode: unset, empty, junk are off; report and true are read case-insensitively', () => {
    assert.equal(readGateMode({}), 'off')
    assert.equal(readGateMode({ KG_ENFORCE_READ_AUTH: '' }), 'off')
    assert.equal(readGateMode({ KG_ENFORCE_READ_AUTH: 'yes' }), 'off')
    assert.equal(readGateMode({ KG_ENFORCE_READ_AUTH: ' Report ' }), 'report')
    assert.equal(readGateMode({ KG_ENFORCE_READ_AUTH: 'TRUE' }), 'true')
  })

  test('off: lets a private graph through and never resolves the caller', async () => {
    const { env } = freshDb()
    const { graphId } = await privateGraph(env)
    let resolved = false
    const r = await readGate(req(), env, graphId, { resolveCaller: async () => { resolved = true; return null } })
    assert.equal(r, null)
    assert.equal(resolved, false)
  })

  test('report: never refuses, but logs what it would refuse', async () => {
    const { env } = freshDb()
    const { graphId } = await privateGraph(env)
    const lines = []
    const warn = console.warn
    console.warn = (m) => lines.push(m)
    try {
      const r = await readGate(req('knowledge.vegvisr.org', { Origin: 'https://example.org' }), withMode(env, 'report'), graphId)
      assert.equal(r, null)
    } finally { console.warn = warn }
    assert.equal(lines.length, 1)
    assert.match(lines[0], /\[read-gate\] would refuse graph=\S+ from=example\.org auth=none/)
  })

  test('true: an anonymous read of a private graph is a 404', async () => {
    const { env } = freshDb()
    const { graphId } = await privateGraph(env)
    assert.deepEqual(await readGate(req(), withMode(env, 'true'), graphId), { status: 404, message: 'Graph not found.' })
  })

  test('true: a refused read and a missing graph look the same', async () => {
    const { env } = freshDb()
    const { graphId } = await privateGraph(env)
    const refused = await readGate(req(), withMode(env, 'true'), graphId)
    const missing = await readGate(req(), withMode(env, 'true'), crypto.randomUUID())
    assert.deepEqual(refused, missing)
  })

  test('true: owner, Superadmin and the service binding read a private graph; another user does not', async () => {
    const { env: base } = freshDb()
    const env = withMode(base, 'true')
    const { graphId } = await privateGraph(base)
    assert.equal(await readGate(req(), env, graphId, { caller: alice }), null)
    assert.equal(await readGate(req(), env, graphId, { caller: admin }), null)
    assert.equal(await readGate(req('knowledge-graph-worker'), env, graphId), null)
    assert.equal((await readGate(req(), env, graphId, { caller: bob }))?.status, 404)
  })

  test('true: anyone reads a published graph', async () => {
    const { env: base } = freshDb()
    const { graphId } = await publishedGraph(base)
    assert.equal(await readGate(req(), withMode(base, 'true'), graphId), null)
  })

  test('true: an old version is never served anonymously, even of a published graph', async () => {
    const { env: base } = freshDb()
    const env = withMode(base, 'true')
    const { graphId } = await publishedGraph(base)
    assert.equal((await readGate(req(), env, graphId, { history: true }))?.status, 404)
    assert.equal(await readGate(req(), env, graphId, { caller: alice, history: true }), null)
    assert.equal(await readGate(req(), env, crypto.randomUUID(), { caller: admin, history: true }), null)
  })

  test('true: a forged binding header over the internet does not help', async () => {
    const { env: base } = freshDb()
    const { graphId } = await privateGraph(base)
    const r = await readGate(req('knowledge.vegvisr.org', { 'x-acting-user-email': 'alice@example.com', Host: 'knowledge-graph-worker' }), withMode(base, 'true'), graphId)
    assert.equal(r?.status, 404)
  })
})
