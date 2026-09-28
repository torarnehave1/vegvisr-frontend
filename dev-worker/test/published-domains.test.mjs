/**
 * published-domains: which live site a graph serves, and who is allowed to know.
 * Run: node --test dev-worker/test/published-domains.test.mjs
 *
 * The registry is KV and therefore global — every published host in the system is in it,
 * whoever owns the graph. So the access check is the point of these tests: a host whose graph
 * the caller cannot read must not appear, not even as a title.
 *
 * These also pin the extraction. readPublishedDomainRegistry and mergePublishedDomains were
 * closures inside index.js's request handler and had no tests at all; moving them out is what
 * made them testable, and the merge rule (a stale stamp loses to the registry) is subtle enough
 * to deserve one.
 */
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, PagesKVLike } from './d1-adapter.mjs'
import * as pd from '../published-domains.js'
import * as gs from '../graph-service.js'

const actorFor = (email, role = 'User') =>
  gs.normalizeActor({
    userId: email,
    userEmail: email,
    userRole: role,
    scopes: ['graph:read'],
    authMethod: 'oauth',
    valid: true,
  })

const ALICE = actorFor('alice@example.com')
const BOB = actorFor('bob@example.com')
const ROOT = actorFor('root@example.com', 'Superadmin')

const key = (host, graphId, nodeId = 'html-1', publishedAt = '2026-09-01T10:00:00.000Z') => ({
  name: `html:${host}`,
  metadata: { graphId, nodeId, publishedAt, publishedBy: 'someone' },
})

// The registry cache is module-scope by design — one isolate reads KV once a minute — so each
// test has to clear it or it would read the previous test's fixture.
beforeEach(() => pd.resetRegistryCache())

/** A graph row written straight to the table, so ownership and state are exact. */
async function putGraph(env, { id, owner, title, state = 'private', nodes = [] }) {
  const data = JSON.stringify({
    metadata: { title, createdBy: owner, publicationState: state, metaArea: '#X', version: 1 },
    nodes,
    edges: [],
  })
  await env.vegvisr_org
    .prepare('INSERT INTO knowledge_graphs (id, title, created_by, data, updated_at) VALUES (?,?,?,?,?)')
    .bind(id, title, owner, data, '2026-09-01T00:00:00Z')
    .run()
}

describe('readPublishedDomainRegistry', () => {
  test('maps hostname to graph and back, and keeps the node it is served from', async () => {
    const { env } = freshDb()
    env.HTML_PAGES = new PagesKVLike([key('a.vegvisr.org', 'g1', 'n-a'), key('b.vegvisr.org', 'g1', 'n-b')])

    const r = await pd.readPublishedDomainRegistry(env)
    assert.deepEqual([...r.byGraph.get('g1')].sort(), ['a.vegvisr.org', 'b.vegvisr.org'])
    assert.equal(r.ownerOf.get('a.vegvisr.org'), 'g1')
    assert.equal(r.details.get('b.vegvisr.org').nodeId, 'n-b')
  })

  test('malformed keys and keys with no graphId are skipped, not half-read', async () => {
    const { env } = freshDb()
    env.HTML_PAGES = new PagesKVLike([
      key('good.vegvisr.org', 'g1'),
      { name: 'html:https://pasted.example.com/page' }, // a pasted URL, from an older publish
      { name: 'html:no-metadata.example.com' }, // metadata never written
      { name: 'html:empty.example.com', metadata: { graphId: '', nodeId: '' } },
      { name: 'html:UPPER.example.com', metadata: { graphId: 'g2', nodeId: 'n' } },
    ])

    const r = await pd.readPublishedDomainRegistry(env)
    assert.deepEqual([...r.ownerOf.keys()].sort(), ['good.vegvisr.org', 'upper.example.com'])
  })

  test('a paginated listing is followed to the end', async () => {
    const { env } = freshDb()
    const many = Array.from({ length: 25 }, (_, i) => key(`h${i}.example.com`, `g${i}`))
    env.HTML_PAGES = new PagesKVLike(many, { pageSize: 10 })

    const r = await pd.readPublishedDomainRegistry(env)
    assert.equal(r.ownerOf.size, 25)
    assert.equal(env.HTML_PAGES.listCalls, 3)
  })

  test('the result is cached, so a listing does not re-read KV per graph', async () => {
    const { env } = freshDb()
    env.HTML_PAGES = new PagesKVLike([key('a.example.com', 'g1')])
    await pd.readPublishedDomainRegistry(env)
    await pd.readPublishedDomainRegistry(env)
    assert.equal(env.HTML_PAGES.listCalls, 1)
  })

  test('a KV failure degrades to an empty registry instead of failing the listing', async () => {
    const { env } = freshDb()
    env.HTML_PAGES = new PagesKVLike([], { throws: true })
    const r = await pd.readPublishedDomainRegistry(env)
    assert.equal(r.ownerOf.size, 0)
    // The shape still has to be right — mergePublishedDomains calls .get on it either way.
    assert.deepEqual(pd.mergePublishedDomains('g1', 'x.example.com', r), ['x.example.com'])
  })

  test('a missing binding returns a usable empty registry, not a bare Map', async () => {
    const { env } = freshDb()
    const r = await pd.readPublishedDomainRegistry(env)
    // The pre-extraction code returned `new Map()` here, which would have thrown on
    // registry.ownerOf. Unreachable in production, wrong everywhere else.
    assert.ok(r.ownerOf instanceof Map)
    assert.ok(r.byGraph instanceof Map)
  })
})

describe('mergePublishedDomains — the registry outranks the stamp', () => {
  test('a stamp the registry has given to another graph is dropped', async () => {
    const { env } = freshDb()
    env.HTML_PAGES = new PagesKVLike([key('shared.example.com', 'g2')])
    const r = await pd.readPublishedDomainRegistry(env)
    // g1 still carries the stamp from when it served the host; g2 serves it now.
    assert.deepEqual(pd.mergePublishedDomains('g1', 'shared.example.com', r), [])
    assert.deepEqual(pd.mergePublishedDomains('g2', 'shared.example.com', r), ['shared.example.com'])
  })

  test('a stamp the registry has no opinion about is kept', async () => {
    const { env } = freshDb()
    env.HTML_PAGES = new PagesKVLike([])
    const r = await pd.readPublishedDomainRegistry(env)
    assert.deepEqual(pd.mergePublishedDomains('g1', 'old.example.com', r), ['old.example.com'])
  })

  test('the registry adds hosts the node was never stamped with', async () => {
    const { env } = freshDb()
    env.HTML_PAGES = new PagesKVLike([key('new.example.com', 'g1')])
    const r = await pd.readPublishedDomainRegistry(env)
    assert.deepEqual(pd.mergePublishedDomains('g1', '', r), ['new.example.com'])
  })

  test('the result is sorted and de-duplicated', async () => {
    const { env } = freshDb()
    env.HTML_PAGES = new PagesKVLike([key('b.example.com', 'g1'), key('a.example.com', 'g1')])
    const r = await pd.readPublishedDomainRegistry(env)
    assert.deepEqual(
      pd.mergePublishedDomains('g1', 'b.example.com, a.example.com', r),
      ['a.example.com', 'b.example.com'],
    )
  })
})

describe('listPublishedSites', () => {
  async function seeded() {
    const { env } = freshDb()
    await putGraph(env, { id: 'g-alice', owner: 'alice@example.com', title: "Alice's site" })
    await putGraph(env, { id: 'g-bob', owner: 'bob@example.com', title: "Bob's private site" })
    await putGraph(env, {
      id: 'g-pub',
      owner: 'bob@example.com',
      title: "Bob's public site",
      state: 'published',
    })
    env.HTML_PAGES = new PagesKVLike([
      key('alice.vegvisr.org', 'g-alice', 'n-alice'),
      key('bob.vegvisr.org', 'g-bob', 'n-bob'),
      key('open.vegvisr.org', 'g-pub', 'n-pub'),
      key('ghost.vegvisr.org', 'g-deleted', 'n-gone'), // registry key, graph row gone
    ])
    return env
  }

  test('lists a host with the graph and html-node behind it', async () => {
    const env = await seeded()
    const r = await pd.listPublishedSites(env, { actor: ALICE })
    assert.ok(r.ok)
    const mine = r.sites.find((s) => s.hostname === 'alice.vegvisr.org')
    assert.equal(mine.graphId, 'g-alice')
    assert.equal(mine.nodeId, 'n-alice')
    assert.equal(mine.title, "Alice's site")
    assert.equal(mine.siteUrl, 'https://alice.vegvisr.org')
    assert.equal(mine.viewerUrl, gs.graphLinks('g-alice').viewerUrl)
    assert.equal(mine.publishedAt, '2026-09-01T10:00:00.000Z')
  })

  test("another user's private site is omitted entirely — not even its title leaks", async () => {
    const env = await seeded()
    const r = await pd.listPublishedSites(env, { actor: ALICE })
    const hosts = r.sites.map((s) => s.hostname)
    assert.ok(!hosts.includes('bob.vegvisr.org'), hosts.join(','))
    assert.ok(!JSON.stringify(r).includes("Bob's private site"))
  })

  test('a published graph is visible to everyone, because its page already is', async () => {
    const env = await seeded()
    const r = await pd.listPublishedSites(env, { actor: ALICE })
    assert.ok(r.sites.some((s) => s.hostname === 'open.vegvisr.org'))
  })

  test('the count of what is hidden is reported, so a short list is not mistaken for the truth', async () => {
    const env = await seeded()
    const r = await pd.listPublishedSites(env, { actor: ALICE })
    assert.equal(r.count, 2)
    assert.equal(r.totalRegistered, 4, 'four keys in the registry, two readable')
  })

  test('Superadmin sees every site whose graph still exists', async () => {
    const env = await seeded()
    const r = await pd.listPublishedSites(env, { actor: ROOT })
    assert.deepEqual(
      r.sites.map((s) => s.hostname),
      ['alice.vegvisr.org', 'bob.vegvisr.org', 'open.vegvisr.org'],
    )
    // g-deleted has a registry key but no row: it cannot be described, so it is not listed.
    assert.equal(r.totalRegistered, 4)
  })

  test('bob sees his own two and not alice\'s', async () => {
    const env = await seeded()
    const r = await pd.listPublishedSites(env, { actor: BOB })
    assert.deepEqual(r.sites.map((s) => s.hostname), ['bob.vegvisr.org', 'open.vegvisr.org'])
  })

  test('a domain filter matches a substring, and accepts a full URL', async () => {
    const env = await seeded()
    const bare = await pd.listPublishedSites(env, { actor: ROOT, domain: 'bob' })
    assert.deepEqual(bare.sites.map((s) => s.hostname), ['bob.vegvisr.org'])

    const url = await pd.listPublishedSites(env, { actor: ROOT, domain: 'https://open.vegvisr.org/some/page' })
    assert.deepEqual(url.sites.map((s) => s.hostname), ['open.vegvisr.org'])
  })

  test('a graphId filter answers "what does this graph publish?"', async () => {
    const env = await seeded()
    const r = await pd.listPublishedSites(env, { actor: ROOT, graphId: 'g-pub' })
    assert.deepEqual(r.sites.map((s) => s.hostname), ['open.vegvisr.org'])
    assert.equal(r.totalRegistered, 1)
  })

  test('results are ordered by hostname, so the list is stable between calls', async () => {
    const env = await seeded()
    const r = await pd.listPublishedSites(env, { actor: ROOT })
    assert.deepEqual([...r.sites.map((s) => s.hostname)].sort(), r.sites.map((s) => s.hostname))
  })

  test('no actor, no registry', async () => {
    const env = await seeded()
    const r = await pd.listPublishedSites(env, { actor: null })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.UNAUTHENTICATED)
  })
})
