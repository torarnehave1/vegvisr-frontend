/**
 * graph-service.js — automated tests against a real SQLite engine with the real schema.
 * Run: node --test dev-worker/test/
 *
 * Covers items 13–17 of the Fase 3 test list, plus the VEGR.AI server-side rules.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb } from './d1-adapter.mjs'
import * as gs from '../graph-service.js'

const alice = gs.normalizeActor({ valid: true, userId: 'alice@example.com', userEmail: 'alice@example.com', userRole: 'User', authMethod: 'oauth', scopes: ['graph:read', 'graph:write'] })
const bob = gs.normalizeActor({ valid: true, userId: 'bob@example.com', userEmail: 'bob@example.com', userRole: 'User', authMethod: 'oauth', scopes: ['graph:read', 'graph:write'] })
const admin = gs.normalizeActor({ valid: true, userId: 'root@example.com', userEmail: 'root@example.com', userRole: 'Superadmin', authMethod: 'oauth', scopes: ['all'] })
const anon = gs.normalizeActor({ valid: true, userId: null, scopes: ['all'], authMethod: 'trusted_origin' })

async function makeGraph(env, actor = alice, over = {}) {
  const r = await gs.createGraph(env, { title: 'T', description: 'D', metaArea: '#X', actor, ...over })
  assert.equal(r.ok, true, `createGraph failed: ${r.message}`)
  return r
}

describe('actor normalisation', () => {
  test('email is derived and lowercased; superadmin detected', () => {
    const a = gs.normalizeActor({ valid: true, userId: 'A@B.com', userRole: 'Superadmin' })
    assert.equal(a.email, 'a@b.com')
    assert.equal(a.isSuperadmin, true)
  })
  test('a service-binding actor is anonymous and can never own anything', () => {
    assert.equal(anon.anonymous, true)
    assert.equal(anon.email, null)
  })
  test('an invalid validation yields no actor', () => {
    assert.equal(gs.normalizeActor({ valid: false }), null)
  })
})

describe('13. create a private graph', () => {
  test('new graph is private, UUID v4, version 1, createdBy = authenticated user', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env)
    assert.equal(r.publicationState, 'private')
    assert.equal(r.version, 1)
    assert.equal(gs.isUuidV4(r.graphId), true)

    const g = await gs.getGraph(env, r.graphId)
    assert.equal(g.graph.metadata.createdBy, 'alice@example.com')
    assert.equal(g.graph.metadata.publicationState, 'private')
  })

  test('createdBy from the client body is OVERRIDDEN by the actor (rule 3)', async () => {
    const { env } = freshDb()
    const id = crypto.randomUUID()
    const r = await gs.saveGraph(env, {
      id,
      graphData: { metadata: { title: 'spoof', createdBy: 'victim@example.com' }, nodes: [], edges: [] },
      actor: alice,
    })
    assert.equal(r.ok, true)
    const g = await gs.getGraph(env, id)
    assert.equal(g.graph.metadata.createdBy, 'alice@example.com')
  })

  test('title and metaArea are required', async () => {
    const { env } = freshDb()
    const noTitle = await gs.createGraph(env, { title: '', metaArea: '#X', actor: alice })
    assert.equal(noTitle.code, gs.ERR.INVALID_INPUT)
    const noMeta = await gs.createGraph(env, { title: 'T', metaArea: '  ', actor: alice })
    assert.equal(noMeta.code, gs.ERR.INVALID_INPUT)
  })

  test('creating without an actor is refused', async () => {
    const { env } = freshDb()
    const r = await gs.createGraph(env, { title: 'T', metaArea: '#X', actor: null })
    assert.equal(r.code, gs.ERR.UNAUTHENTICATED)
    assert.equal(r.status, 401)
  })

  test('a new graph with a non-UUID id is refused', async () => {
    const { env } = freshDb()
    const r = await gs.saveGraph(env, { id: 'graph_12345', graphData: { metadata: { title: 'x' }, nodes: [], edges: [] } })
    assert.equal(r.code, gs.ERR.INVALID_INPUT)
    assert.match(r.message, /UUID v4/)
  })

  test('nodes and edges are validated; an edge to a missing node is refused', async () => {
    const { env } = freshDb()
    const bad = await gs.createGraph(env, {
      title: 'T', metaArea: '#X', actor: alice,
      nodes: [{ label: 'one' }],
      edges: [{ source: 'nope', target: 'alsonope' }],
    })
    assert.equal(bad.code, gs.ERR.INVALID_INPUT)
  })

  test('supplied nodes get UUID v4 ids and default type fulltext (rule 5)', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice, { nodes: [{ label: 'Intro', info: 'hello' }] })
    const g = await gs.getGraph(env, r.graphId)
    assert.equal(g.graph.nodes.length, 1)
    assert.equal(gs.isUuidV4(g.graph.nodes[0].id), true)
    assert.equal(g.graph.nodes[0].type, 'fulltext')
  })
})

describe('14. reading another user\'s private graph', () => {
  test('owner may read; a different user is refused with FORBIDDEN_GRAPH', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)

    const asOwner = await gs.checkAccess(env, alice, r.graphId, 'read')
    assert.equal(asOwner.ok, true)

    const asOther = await gs.checkAccess(env, bob, r.graphId, 'read')
    assert.equal(asOther.ok, false)
    assert.equal(asOther.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal(asOther.status, 403)
  })

  test('a different user cannot write either', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    const w = await gs.checkAccess(env, bob, r.graphId, 'write')
    assert.equal(w.code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('a PUBLISHED graph is readable by another user but still not writable', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    const pub = await gs.publishGraph(env, { graphId: r.graphId, expectedVersion: r.version, actor: alice })
    assert.equal(pub.ok, true)
    assert.equal(pub.publicationState, 'published')

    assert.equal((await gs.checkAccess(env, bob, r.graphId, 'read')).ok, true)
    assert.equal((await gs.checkAccess(env, bob, r.graphId, 'write')).code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('Superadmin passes both read and write', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    assert.equal((await gs.checkAccess(env, admin, r.graphId, 'read')).ok, true)
    assert.equal((await gs.checkAccess(env, admin, r.graphId, 'write')).ok, true)
  })

  test('an anonymous actor (service binding / trusted origin) owns nothing', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    assert.equal((await gs.checkAccess(env, anon, r.graphId, 'read')).code, gs.ERR.FORBIDDEN_GRAPH)
  })

  test('a graph whose creator is an APP NAME has no owner — only Superadmin reaches it', async () => {
    const { env } = freshDb()
    const id = crypto.randomUUID()
    await gs.saveGraph(env, { id, graphData: { metadata: { title: 'legacy', createdBy: 'my-app' }, nodes: [], edges: [] } })
    assert.equal((await gs.checkAccess(env, alice, id, 'read')).code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal((await gs.checkAccess(env, admin, id, 'read')).ok, true)
  })

  test('no actor at all is UNAUTHENTICATED, not FORBIDDEN', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    const x = await gs.checkAccess(env, null, r.graphId, 'read')
    assert.equal(x.code, gs.ERR.UNAUTHENTICATED)
  })

  test('a missing graph is GRAPH_NOT_FOUND', async () => {
    const { env } = freshDb()
    const x = await gs.checkAccess(env, alice, crypto.randomUUID(), 'read')
    assert.equal(x.code, gs.ERR.GRAPH_NOT_FOUND)
    assert.equal(x.status, 404)
  })
})

describe('15. node creation', () => {
  test('addNode appends, bumps the version and returns the new node id', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)

    const a = await gs.addNode(env, { graphId: r.graphId, node: { label: 'N1', type: 'fulltext', info: 'x' }, actor: alice })
    assert.equal(a.ok, true)
    assert.equal(a.newVersion, 2)
    assert.equal(gs.isUuidV4(a.nodeId), true)

    const g = await gs.getGraph(env, r.graphId)
    assert.equal(g.graph.nodes.length, 1)
    assert.equal(g.graph.metadata.version, 2)
  })

  test('addNode does not overwrite existing nodes', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice, { nodes: [{ label: 'first' }] })
    await gs.addNode(env, { graphId: r.graphId, node: { label: 'second' }, actor: alice })
    const g = await gs.getGraph(env, r.graphId)
    assert.deepEqual(g.graph.nodes.map((n) => n.label), ['first', 'second'])
  })

  test('a duplicate node id is refused with NODE_EXISTS', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    const fixed = crypto.randomUUID()
    await gs.addNode(env, { graphId: r.graphId, node: { id: fixed, label: 'a' }, actor: alice })
    const dup = await gs.addNode(env, { graphId: r.graphId, node: { id: fixed, label: 'b' }, actor: alice })
    assert.equal(dup.code, gs.ERR.NODE_EXISTS)
    assert.equal(dup.status, 409)
  })

  test('addNode on a missing graph is GRAPH_NOT_FOUND', async () => {
    const { env } = freshDb()
    const x = await gs.addNode(env, { graphId: crypto.randomUUID(), node: { label: 'x' }, actor: alice })
    assert.equal(x.code, gs.ERR.GRAPH_NOT_FOUND)
  })
})

describe('16. version conflict', () => {
  test('addNode with a stale expectedVersion is refused with currentVersion reported', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    await gs.addNode(env, { graphId: r.graphId, node: { label: 'a' }, actor: alice })

    const stale = await gs.addNode(env, { graphId: r.graphId, node: { label: 'b' }, expectedVersion: 1, actor: alice })
    assert.equal(stale.ok, false)
    assert.equal(stale.code, gs.ERR.VERSION_CONFLICT)
    assert.equal(stale.status, 409)
    assert.equal(stale.currentVersion, 2)
  })

  test('addNode with the right expectedVersion succeeds', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    const ok = await gs.addNode(env, { graphId: r.graphId, node: { label: 'a' }, expectedVersion: 1, actor: alice })
    assert.equal(ok.ok, true)
    assert.equal(ok.newVersion, 2)
  })

  test('omitting expectedVersion keeps the old permissive REST contract', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    await gs.addNode(env, { graphId: r.graphId, node: { label: 'a' } })
    const ok = await gs.addNode(env, { graphId: r.graphId, node: { label: 'b' } })
    assert.equal(ok.ok, true)
    assert.equal(ok.newVersion, 3)
  })

  test('saveGraph without override refuses a stale metadata.version', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    const stale = await gs.saveGraph(env, {
      id: r.graphId,
      graphData: { metadata: { title: 'T', version: 0 }, nodes: [], edges: [] },
      override: false,
    })
    assert.equal(stale.code, gs.ERR.VERSION_CONFLICT)
    assert.equal(stale.currentVersion, 1)
  })

  test('saveGraph with override:true bypasses the check and bumps the version', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    const forced = await gs.saveGraph(env, {
      id: r.graphId,
      graphData: { metadata: { title: 'T', version: 0 }, nodes: [], edges: [] },
      override: true,
    })
    assert.equal(forced.ok, true)
    assert.equal(forced.newVersion, 2)
  })

  test('updateMetadata enforces expectedVersion', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    const bad = await gs.updateMetadata(env, { graphId: r.graphId, fields: { description: 'new' }, expectedVersion: 99, actor: alice })
    assert.equal(bad.code, gs.ERR.VERSION_CONFLICT)
    const good = await gs.updateMetadata(env, { graphId: r.graphId, fields: { description: 'new' }, expectedVersion: 1, actor: alice })
    assert.equal(good.ok, true)
    assert.equal(good.newVersion, 2)
  })

  test('history rows accumulate one per version', async () => {
    const { env, raw } = freshDb()
    const r = await makeGraph(env, alice)
    await gs.addNode(env, { graphId: r.graphId, node: { label: 'a' } })
    await gs.addNode(env, { graphId: r.graphId, node: { label: 'b' } })
    const rows = raw.prepare('SELECT version FROM knowledge_graph_history WHERE graph_id = ? ORDER BY version').all(r.graphId)
    assert.deepEqual(rows.map((x) => x.version), [1, 2, 3])
  })

  test('history is capped at 20 versions', async () => {
    const { env, raw } = freshDb()
    const r = await makeGraph(env, alice)
    for (let i = 0; i < 25; i++) {
      await gs.addNode(env, { graphId: r.graphId, node: { label: `n${i}` } })
    }
    const { count } = raw.prepare('SELECT COUNT(*) AS count FROM knowledge_graph_history WHERE graph_id = ?').get(r.graphId)
    assert.ok(count <= 21, `expected the cap to hold, got ${count}`)
  })
})

describe('17. editor and viewer links', () => {
  test('exact formats required by the spec', () => {
    const l = gs.graphLinks('abc-123')
    assert.equal(l.editorUrl, 'https://editor.vegvisr.org/?graphId=abc-123')
    assert.equal(l.viewerUrl, 'https://editor.vegvisr.org/view?graphId=abc-123')
  })
  test('createGraph and addNode both return the links', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    assert.equal(r.editorUrl, `https://editor.vegvisr.org/?graphId=${r.graphId}`)
    assert.equal(r.viewerUrl, `https://editor.vegvisr.org/view?graphId=${r.graphId}`)
    const a = await gs.addNode(env, { graphId: r.graphId, node: { label: 'x' } })
    assert.equal(a.viewerUrl, `https://editor.vegvisr.org/view?graphId=${r.graphId}`)
  })
})

describe('publication is an explicit action only (rule 2)', () => {
  test('updateMetadata refuses to set publicationState', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    const x = await gs.updateMetadata(env, { graphId: r.graphId, fields: { publicationState: 'published' }, expectedVersion: 1, actor: alice })
    assert.equal(x.code, gs.ERR.INVALID_INPUT)
    assert.match(x.message, /explicit publish/)
  })
  test('publishGraph is the only route to published', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    const p = await gs.publishGraph(env, { graphId: r.graphId, expectedVersion: 1, actor: alice })
    assert.equal(p.publicationState, 'published')
    const g = await gs.getGraph(env, r.graphId)
    assert.ok(g.graph.metadata.publishedAt)
  })
  test('publishGraph without an actor is refused', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    assert.equal((await gs.publishGraph(env, { graphId: r.graphId, expectedVersion: 1, actor: null })).code, gs.ERR.UNAUTHENTICATED)
  })
  test('updateMetadata cannot rewrite createdBy', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice)
    await gs.updateMetadata(env, { graphId: r.graphId, fields: { createdBy: 'bob@example.com', description: 'z' }, expectedVersion: 1, actor: alice })
    const g = await gs.getGraph(env, r.graphId)
    assert.equal(g.graph.metadata.createdBy, 'alice@example.com')
  })
})

describe('getGraph shaping matches the REST contract', () => {
  test('missing id and missing graph produce distinct codes', async () => {
    const { env } = freshDb()
    assert.equal((await gs.getGraph(env, '')).code, gs.ERR.INVALID_INPUT)
    assert.equal((await gs.getGraph(env, crypto.randomUUID())).code, gs.ERR.GRAPH_NOT_FOUND)
  })
  test('edge ids are normalised to source_target and timestamps attached', async () => {
    const { env } = freshDb()
    const n1 = crypto.randomUUID()
    const n2 = crypto.randomUUID()
    const r = await makeGraph(env, alice, {
      nodes: [{ id: n1, label: 'a' }, { id: n2, label: 'b' }],
      edges: [{ source: n1, target: n2, label: 'next' }],
    })
    const g = await gs.getGraph(env, r.graphId)
    assert.equal(g.graph.edges[0].id, `${n1}_${n2}`)
    assert.equal(g.graph.edges[0].label, 'next')
    assert.ok(g.graph.created_date)
    assert.ok(g.graph.updated_at)
  })
  test('nodeId filter drops unrelated nodes and dangling edges', async () => {
    const { env } = freshDb()
    const n1 = crypto.randomUUID()
    const n2 = crypto.randomUUID()
    const r = await makeGraph(env, alice, {
      nodes: [{ id: n1, label: 'keep' }, { id: n2, label: 'drop' }],
      edges: [{ source: n1, target: n2 }],
    })
    const g = await gs.getGraph(env, r.graphId, { nodeId: n1 })
    assert.equal(g.graph.nodes.length, 1)
    assert.equal(g.graph.edges.length, 0)
  })
  test('nodeTitle filter matches on a label substring', async () => {
    const { env } = freshDb()
    const r = await makeGraph(env, alice, { nodes: [{ label: 'Introduction' }, { label: 'Appendix' }] })
    const g = await gs.getGraph(env, r.graphId, { nodeTitle: 'intro' })
    assert.equal(g.graph.nodes.length, 1)
    assert.equal(g.graph.nodes[0].label, 'Introduction')
  })
})

describe('status code mapping', () => {
  test('every error code maps to a sane HTTP status', () => {
    assert.equal(gs.statusForCode(gs.ERR.UNAUTHENTICATED), 401)
    assert.equal(gs.statusForCode(gs.ERR.INSUFFICIENT_SCOPE), 403)
    assert.equal(gs.statusForCode(gs.ERR.FORBIDDEN_GRAPH), 403)
    assert.equal(gs.statusForCode(gs.ERR.INVALID_INPUT), 400)
    assert.equal(gs.statusForCode(gs.ERR.GRAPH_NOT_FOUND), 404)
    assert.equal(gs.statusForCode(gs.ERR.VERSION_CONFLICT), 409)
    assert.equal(gs.statusForCode(gs.ERR.RATE_LIMITED), 429)
    assert.equal(gs.statusForCode(gs.ERR.INTERNAL_ERROR), 500)
  })
})
