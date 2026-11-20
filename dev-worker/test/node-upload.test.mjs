// node-upload-service.js — one-time upload tickets for the text of one node.
//
// Pinned: the ticket is single-use, expires, is stored only as a hash, writes ONE node of ONE graph
// fixed when it was made, acts as the person who made it (write access checked at both ends), sets
// `info` only, and stores the text byte for byte.
//
// Run:  node --test test/node-upload.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { freshDb, seedUsers } from './d1-adapter.mjs'
import * as gs from '../graph-service.js'
import * as nu from '../node-upload-service.js'

const actorOf = (id, email) => gs.normalizeActor({ valid: true, userId: id, userEmail: email, userRole: 'User', scopes: ['graph:read', 'graph:write'] })
const ALICE = actorOf('u-alice', 'alice@example.com')
const BOB = actorOf('u-bob', 'bob@example.com')

async function world() {
  const { env, raw } = freshDb()
  seedUsers(raw)
  const g = await gs.createGraph(env, {
    title: 'App', description: '', metaArea: '#APP', actor: ALICE,
    nodes: [{ id: 'page', label: 'Page', type: 'html-node', info: '<p>old</p>', metadata: { keep: 'me' } }, { id: 'story', label: 'Story', type: 'info', info: 'x' }],
  })
  assert.equal(g.ok, true, g.message)
  return { env, raw, graphId: g.graphId }
}

const put = (url, text, headers = {}) => {
  const bytes = new TextEncoder().encode(text)
  return new Request(url, { method: 'PUT', body: bytes, headers: { 'Content-Length': String(bytes.byteLength), ...headers } })
}
const HTML = '<!DOCTYPE html>\n<script>var re=/\\\\d+\\s"\'/g; // æøå \\n ✓</script>\n'

test('an upload replaces the text of an existing node, byte for byte, and keeps the rest of it', async () => {
  const { env, raw, graphId } = await world()
  const t = await nu.createNodeUpload(env, { actor: ALICE, graphId, nodeId: 'page' })
  assert.equal(t.ok, true, t.message)
  assert.equal(t.creates, false)
  const ticket = t.uploadUrl.split('/').pop()
  const rows = raw.prepare('SELECT * FROM node_upload_tickets').all()
  assert.equal(rows.length, 1)
  assert.notEqual(rows[0].ticket_hash, ticket, 'the ticket itself is never stored')

  const res = await nu.handleNodeUpload(put(t.uploadUrl, HTML), env)
  const body = await res.json()
  assert.equal(res.status, 200, JSON.stringify(body))
  assert.equal(body.created, false)
  assert.equal(body.sha256, createHash('sha256').update(HTML).digest('hex'))

  const read = await gs.getGraph(env, graphId, { caller: ALICE })
  const node = read.graph.nodes.find((n) => n.id === 'page')
  assert.equal(node.info, HTML)
  assert.equal(node.label, 'Page')
  assert.equal(node.type, 'html-node')
  // metadata.updatedAt is the server's own stamp (2026-11-20), set aside here.
  const { updatedAt: _t, ...kept } = node.metadata
  assert.deepEqual(kept, { keep: 'me' })
  assert.equal(read.version, body.version)

  // Once only.
  const again = await nu.handleNodeUpload(put(t.uploadUrl, 'second'), env)
  assert.equal(again.status, 404)
  assert.equal((await gs.getGraph(env, graphId, { caller: ALICE })).graph.nodes.find((n) => n.id === 'page').info, HTML)
})

test('an unknown node id creates the node with the label and type of the ticket', async () => {
  const { env, graphId } = await world()
  const none = await nu.createNodeUpload(env, { actor: ALICE, graphId, nodeId: 'app' })
  assert.equal(none.code, gs.ERR.INVALID_INPUT, 'a new node needs a label')
  const t = await nu.createNodeUpload(env, { actor: ALICE, graphId, nodeId: 'app', label: 'Garnet' })
  assert.equal(t.ok, true, t.message)
  assert.equal(t.creates, true)
  assert.equal(t.type, 'html-node')
  const res = await nu.handleNodeUpload(put(t.uploadUrl, HTML), env)
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()))
  const node = (await gs.getGraph(env, graphId, { caller: ALICE })).graph.nodes.find((n) => n.id === 'app')
  assert.equal(node.label, 'Garnet')
  assert.equal(node.type, 'html-node')
  assert.equal(node.info, HTML)
})

test('no ticket for a graph the caller may not write, or for a node whose content is not its text', async () => {
  const { env, raw, graphId } = await world()
  const bob = await nu.createNodeUpload(env, { actor: BOB, graphId, nodeId: 'page' })
  assert.equal(bob.ok, false)
  const data = await nu.createNodeUpload(env, { actor: ALICE, graphId, nodeId: 'story' })
  assert.equal(data.code, gs.ERR.INVALID_INPUT)
  const missing = await nu.createNodeUpload(env, { actor: ALICE, graphId: 'nope', nodeId: 'page' })
  assert.equal(missing.ok, false)
  const n = raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'node_upload_tickets'").get().n
  if (n) assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM node_upload_tickets').get().n, 0)
})

test('expired, malformed, oversized, empty and non-text uploads are refused and write nothing', async () => {
  const { env, raw, graphId } = await world()
  const info = async () => (await gs.getGraph(env, graphId, { caller: ALICE })).graph.nodes.find((n) => n.id === 'page').info
  const fresh = async () => (await nu.createNodeUpload(env, { actor: ALICE, graphId, nodeId: 'page' })).uploadUrl

  assert.equal((await nu.handleNodeUpload(put('https://knowledge.vegvisr.org/node-upload/abc', 'x'), env)).status, 404)
  assert.equal((await nu.handleNodeUpload(put('https://knowledge.vegvisr.org/node-upload/' + 'a'.repeat(64), 'x'), env)).status, 404)

  const expired = await fresh()
  raw.exec('UPDATE node_upload_tickets SET expires_at = 1')
  assert.equal((await nu.handleNodeUpload(put(expired, 'x'), env)).status, 404)

  const big = await fresh()
  assert.equal((await nu.handleNodeUpload(put(big, 'x', { 'Content-Length': String(nu.MAX_BYTES + 1) }), env)).status, 413)

  const empty = await fresh()
  assert.equal((await nu.handleNodeUpload(put(empty, '   \n'), env)).status, 400)

  const binary = await fresh()
  const bad = new Uint8Array([0xff, 0xfe, 0x00, 0xc3])
  const res = await nu.handleNodeUpload(new Request(binary, { method: 'PUT', body: bad, headers: { 'Content-Length': '4' } }), env)
  assert.equal(res.status, 415)

  assert.equal(await info(), '<p>old</p>')
})
