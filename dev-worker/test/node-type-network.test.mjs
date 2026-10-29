/**
 * A node type's recipe (fields, example) and network (an approved embed from one host) —
 * decided 2026-10-29, graph e1678d8c "Nodetyper med oppskrift og nettverk".
 * Run: node --test dev-worker/test/node-type-network.test.mjs
 */
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { freshDb } from './d1-adapter.mjs'
import { registerTools } from '../mcp/tools.js'
import * as gs from '../graph-service.js'
import {
  allowedNodeTypes, invalidateNodeTypeCache, REGISTRY_GRAPH_ID, REGISTRY_NODE_TYPE,
  nodeTypeRenderers, normalizeNetwork, approvedEmbed, embedIdFor, normalizeExample,
} from '../node-type-registry.js'

const authFor = (email, scope, role = 'User') => ({
  auth: { token: 'redacted', audience: 'https://knowledge.vegvisr.org/mcp', scope, userId: email, clientId: 'test' },
  props: { userId: email, email, role, authMethod: 'oauth_otp' },
})
const SUPER = authFor('owner@example.com', ['graph:read', 'graph:write'], 'Superadmin')
const ALICE = authFor('alice@example.com', ['graph:read', 'graph:write'])

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

function seedRegistry(raw) {
  const data = JSON.stringify({
    metadata: { title: 'System registry', metaArea: '#SYSTEM', createdBy: 'owner@example.com', version: 1 },
    nodes: [{ id: 'nodetype-fulltext', label: 'fulltext', type: REGISTRY_NODE_TYPE, info: 'markdown' }],
    edges: [],
  })
  raw.prepare('INSERT INTO knowledge_graphs (id, title, created_by, data) VALUES (?,?,?,?)')
    .run(REGISTRY_GRAPH_ID, 'System registry', 'owner@example.com', data)
}

const YT_NETWORK = { embed: 'https://www.youtube-nocookie.com/embed/{id}', idPattern: '[A-Za-z0-9_-]{11}', idField: 'videoId' }
const YT_FIELDS = [
  { key: 'videoId', label: 'Video ID', kind: 'text', hint: 'the 11-character YouTube id' },
  { key: 'channel', label: 'Channel', kind: 'text' },
  { key: 'watchUrl', label: 'Watch URL', kind: 'link' },
]
const YT_EXAMPLE = { label: 'What is Vedanta? | Swami Sarvapriyananda', info: 'An introduction to Vedanta.', metadata: { videoId: 'AawWsJNi0gM', channel: 'Vedanta Society of New York', watchUrl: 'https://www.youtube.com/watch?v=AawWsJNi0gM' } }

async function registerYoutube(env, extra = {}) {
  const owner = await connect(env, SUPER)
  const r = await call(owner, 'register_node_type', {
    type: 'youtube',
    description: 'A YouTube video. label = the video title, info = a short description in markdown.',
    consumer: 'vegvisr-node (embed)',
    fields: YT_FIELDS,
    example: YT_EXAMPLE,
    network: YT_NETWORK,
    ...extra,
  })
  invalidateNodeTypeCache()
  return { owner, r }
}

const registryNode = async (env, type) => (await gs.getGraph(env, REGISTRY_GRAPH_ID)).graph.nodes.find((n) => n.label === type)

describe('normalizeNetwork', () => {
  test('accepts a YouTube embed, strips anchors and a metadata. prefix', () => {
    const r = normalizeNetwork({ ...YT_NETWORK, idPattern: '^[A-Za-z0-9_-]{11}$', idField: 'metadata.videoId' })
    assert.equal(r.ok, true)
    assert.deepEqual(r.network, YT_NETWORK)
  })

  for (const [why, net] of [
    ['http', { ...YT_NETWORK, embed: 'http://www.youtube-nocookie.com/embed/{id}' }],
    ['no {id}', { ...YT_NETWORK, embed: 'https://www.youtube-nocookie.com/embed/x' }],
    ['two {id}', { ...YT_NETWORK, embed: 'https://a.com/{id}/{id}' }],
    ['{id} in the host', { ...YT_NETWORK, embed: 'https://{id}.example.com/x' }],
    ['{id} glued to the host', { ...YT_NETWORK, embed: 'https://example.com{id}' }],
    ['credentials', { ...YT_NETWORK, embed: 'https://u:p@example.com/{id}' }],
    ['other braces', { ...YT_NETWORK, embed: 'https://example.com/{id}?t={start}' }],
    ['a pattern that accepts /', { ...YT_NETWORK, idPattern: '.+' }],
    ['a pattern that accepts the empty id', { ...YT_NETWORK, idPattern: '[a-z]*' }],
    ['a broken pattern', { ...YT_NETWORK, idPattern: '[a-z' }],
    ['a bad field', { ...YT_NETWORK, idField: 'video id' }],
  ]) {
    test(`refuses ${why}`, () => assert.equal(normalizeNetwork(net).ok, false))
  }
})

describe('embedIdFor', () => {
  const embed = { url: YT_NETWORK.embed, idPattern: YT_NETWORK.idPattern, idField: 'videoId' }
  test('returns a matching id', () => assert.equal(embedIdFor(embed, { metadata: { videoId: 'AawWsJNi0gM' } }), 'AawWsJNi0gM'))
  test('refuses a wrong length, a missing id and a slash', () => {
    assert.equal(embedIdFor(embed, { metadata: { videoId: 'short' } }), null)
    assert.equal(embedIdFor(embed, { metadata: {} }), null)
    assert.equal(embedIdFor({ ...embed, idPattern: '[A-Za-z0-9_/-]{11}' }, { metadata: { videoId: 'Aaw/sJNi0gM' } }), null)
  })
})

describe('normalizeExample', () => {
  test('keeps label, info and metadata', () => assert.deepEqual(normalizeExample(YT_EXAMPLE).example, YT_EXAMPLE))
  test('refuses an empty or oversized example', () => {
    assert.equal(normalizeExample({}).ok, false)
    assert.equal(normalizeExample({ info: 'x'.repeat(5000) }).ok, false)
  })
})

describe('register_node_type with a recipe and network', () => {
  beforeEach(() => invalidateNodeTypeCache())

  test('stores fields, example and a PENDING network; list_node_types shows the recipe', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const { r } = await registerYoutube(env)
    assert.equal(r.isError, undefined)
    assert.deepEqual(sc(r).network, { version: 1, status: 'pending' })
    assert.match(r.content[0].text, /PENDING v1 .*approve_node_type_network/)

    const alice = await connect(env, ALICE)
    const listed = await call(alice, 'list_node_types', {})
    const yt = sc(listed).registered.find((x) => x.type === 'youtube')
    assert.deepEqual(yt.fields, YT_FIELDS)
    assert.deepEqual(yt.example, YT_EXAMPLE)
    assert.deepEqual(yt.network, { version: 1, status: 'pending', host: 'www.youtube-nocookie.com', ...YT_NETWORK })
    assert.match(listed.content[0].text, /fields \(node\.metadata\): videoId \(text\) — the 11-character YouTube id/)
    assert.match(listed.content[0].text, /example: \{"label":"What is Vedanta/)

    // Pending: nothing reaches a browser.
    assert.equal((await nodeTypeRenderers(env)).youtube, undefined)
  })

  test("a World's type may carry fields and an example but never network", async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const owner = await connect(env, SUPER)
    const r = await call(owner, 'register_node_type', { type: 'video-card', description: 'A video card in a World.', consumer: 'vegvisr-node', world: 'sodesign.no', network: YT_NETWORK })
    assert.equal(r.isError, true)
    assert.match(r.content[0].text, /cannot declare network/)
  })

  test('an invalid network refuses the whole registration', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const { r } = await registerYoutube(env, { network: { ...YT_NETWORK, embed: 'http://x.com/{id}' } })
    assert.equal(r.isError, true)
    assert.equal(await registryNode(env, 'youtube'), undefined)
  })
})

describe('approve_node_type_network', () => {
  beforeEach(() => invalidateNodeTypeCache())

  test('Superadmin only, per version; then the embed is public and the type counts as shown', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const { owner } = await registerYoutube(env)

    const alice = await connect(env, ALICE)
    assert.equal((await call(alice, 'approve_node_type_network', { type: 'youtube', version: 1, verifyMethod: 'unit test' })).isError, true)

    const wrong = await call(owner, 'approve_node_type_network', { type: 'youtube', version: 2, verifyMethod: 'unit test' })
    assert.equal(sc(wrong).code, 'VERSION_CONFLICT')

    const ok = await call(owner, 'approve_node_type_network', { type: 'youtube', version: 1, verifyMethod: 'host and id pattern reviewed' })
    assert.equal(ok.isError, undefined)
    assert.equal(sc(ok).host, 'www.youtube-nocookie.com')
    invalidateNodeTypeCache()

    const r = (await nodeTypeRenderers(env)).youtube
    // No renderer: no version/status — only the embed, which carries no code.
    assert.deepEqual(r, { embed: { version: 1, url: YT_NETWORK.embed, idPattern: YT_NETWORK.idPattern, idField: 'videoId' } })

    const listed = await call(alice, 'list_node_types', {})
    const yt = sc(listed).registered.find((x) => x.type === 'youtube')
    assert.equal(yt.renderer, null)
    assert.equal(yt.network.status, 'approved')
    assert.match(listed.content[0].text, /youtube — .*\[no renderer — shown as its embed\]/)

    const stored = (await registryNode(env, 'youtube')).metadata.network
    assert.equal(stored.approvedBy, 'owner@example.com')
    assert.deepEqual(stored.verify, { method: 'host and id pattern reviewed' })
  })

  test('a type without network has nothing to approve', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const owner = await connect(env, SUPER)
    await call(owner, 'register_node_type', { type: 'plain', description: 'A plain data type.', consumer: 'a program' })
    invalidateNodeTypeCache()
    const r = await call(owner, 'approve_node_type_network', { type: 'plain', version: 1, verifyMethod: 'unit test' })
    assert.equal(r.isError, true)
  })

  test('a stored approval whose declaration no longer validates is never served', () => {
    const tampered = { metadata: { network: { version: 1, status: 'approved', embed: 'https://{id}.evil.example/x', idPattern: '[a-z]+', idField: 'v' } } }
    assert.equal(approvedEmbed(tampered), null)
  })
})

describe('update_node_type', () => {
  beforeEach(() => invalidateNodeTypeCache())

  test('a changed network is a new PENDING version: the old approval does not carry over', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const { owner } = await registerYoutube(env)
    await call(owner, 'approve_node_type_network', { type: 'youtube', version: 1, verifyMethod: 'unit test' })
    invalidateNodeTypeCache()

    const r = await call(owner, 'update_node_type', { type: 'youtube', network: { ...YT_NETWORK, embed: 'https://www.youtube-nocookie.com/embed/{id}?rel=0' } })
    assert.equal(r.isError, undefined)
    assert.deepEqual(sc(r).network, { version: 2, status: 'pending' })
    assert.deepEqual(sc(r).changed, ['network'])
    invalidateNodeTypeCache()
    assert.equal((await nodeTypeRenderers(env)).youtube, undefined, 'the embed stops until v2 is approved')

    const stale = await call(owner, 'approve_node_type_network', { type: 'youtube', version: 1, verifyMethod: 'unit test' })
    assert.equal(sc(stale).code, 'VERSION_CONFLICT')
  })

  test('the same network again keeps its approval and changes nothing', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const { owner } = await registerYoutube(env)
    await call(owner, 'approve_node_type_network', { type: 'youtube', version: 1, verifyMethod: 'unit test' })
    invalidateNodeTypeCache()
    const r = await call(owner, 'update_node_type', { type: 'youtube', network: YT_NETWORK })
    assert.deepEqual(sc(r).changed, [])
    assert.deepEqual(sc(r).network, { version: 1, status: 'approved' })
  })

  test('description, consumer, fields and example change; other metadata is kept', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const { owner } = await registerYoutube(env)
    const r = await call(owner, 'update_node_type', {
      type: 'youtube',
      description: 'A YouTube video, shown as a player. label = title, info = description.',
      consumer: 'vegvisr-node v6',
      fields: [{ key: 'videoId', label: 'Video ID' }],
      example: { label: 'A video', metadata: { videoId: 'AawWsJNi0gM' } },
    })
    assert.equal(r.isError, undefined)
    assert.deepEqual(sc(r).changed.sort(), ['consumer', 'description', 'example', 'fields'])
    const node = await registryNode(env, 'youtube')
    assert.match(node.info, /shown as a player/)
    assert.equal(node.metadata.consumer, 'vegvisr-node v6')
    assert.deepEqual(node.metadata.fields, [{ key: 'videoId', label: 'Video ID', kind: 'text' }])
    assert.equal(node.metadata.network.version, 1, 'network untouched')
    assert.equal(typeof node.metadata.registeredAt, 'string', 'other keys carried')
  })

  test('removeNetwork takes the embed away at once', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const { owner } = await registerYoutube(env)
    await call(owner, 'approve_node_type_network', { type: 'youtube', version: 1, verifyMethod: 'unit test' })
    invalidateNodeTypeCache()
    const r = await call(owner, 'update_node_type', { type: 'youtube', removeNetwork: true })
    assert.deepEqual(sc(r).changed, ['network'])
    assert.equal(sc(r).network, null)
    invalidateNodeTypeCache()
    assert.equal((await nodeTypeRenderers(env)).youtube, undefined)
  })

  test('refused: a non-Superadmin on a platform type, an unknown type, a renderable type, nothing to change', async () => {
    const { env, raw } = freshDb()
    seedRegistry(raw)
    const { owner } = await registerYoutube(env)
    const alice = await connect(env, ALICE)
    assert.equal((await call(alice, 'update_node_type', { type: 'youtube', consumer: 'someone else' })).isError, true)
    assert.equal((await call(owner, 'update_node_type', { type: 'no-such-type', consumer: 'x program' })).isError, true)
    assert.equal((await call(owner, 'update_node_type', { type: 'youtube-video', consumer: 'x program' })).isError, true)
    const none = await call(owner, 'update_node_type', { type: 'youtube' })
    assert.deepEqual(sc(none).changed, [])
    assert.equal((await call(owner, 'update_node_type', { type: 'youtube', network: YT_NETWORK, removeNetwork: true })).isError, true)
  })
})
