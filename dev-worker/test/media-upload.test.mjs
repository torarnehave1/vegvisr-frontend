// media-upload-service.js — one-time upload tickets for reels and images.
//
// Pinned: the ticket is single-use, expires, is stored only as a hash, lands in the album of an
// Instagram account the caller may post to, and accepts only bytes that ARE an MP4/MOV/JPEG/PNG.
// The upload reaches photos-worker as the ticket's owner — never as anybody the uploader names.
//
// Run:  node --test test/media-upload.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedUsers, FakePhotosWorker } from './d1-adapter.mjs'
import * as gs from '../graph-service.js'
import * as mu from '../media-upload-service.js'

const ALICE = gs.normalizeActor({ valid: true, userId: 'u-alice', userEmail: 'alice@example.com', userRole: 'User', scopes: ['chat:write'] })

class FakeBlotato {
  async fetch() {
    return new Response(JSON.stringify({ success: true, data: { items: [{ id: '76189', platform: 'instagram', username: 'Alice.IG' }] } }))
  }
}

function world() {
  const { env, raw } = freshDb()
  seedUsers(raw)
  raw.exec(mu.MEDIA_UPLOAD_TABLE_SQL)
  env.BLOTATO_WORKER = new FakeBlotato()
  env.PHOTOS_WORKER = new FakePhotosWorker({ url: 'https://vegvisr.imgix.net/mcp-1.mp4' })
  return { env, raw }
}

const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 1, 2, 3, 4])
const put = (url, bytes, headers = {}) =>
  new Request(url, { method: 'PUT', body: bytes, headers: { 'Content-Length': String(bytes.byteLength), ...headers } })

test('a ticket goes to the account\'s own album and is stored only as a hash', async () => {
  const { env, raw } = world()
  const r = await mu.createMediaUpload(env, { actor: ALICE, accountId: '76189' })
  assert.equal(r.ok, true, r.message)
  assert.equal(r.album, 'ig-reels-alice.ig')
  const ticket = r.uploadUrl.split('/').pop()
  assert.match(ticket, /^[0-9a-f]{64}$/)
  const rows = raw.prepare('SELECT * FROM media_upload_tickets').all()
  assert.equal(rows.length, 1)
  assert.notEqual(rows[0].ticket_hash, ticket, 'the ticket itself is never stored')
  assert.equal(rows[0].email, 'alice@example.com')
})

test('an account the caller may not post to gets no ticket', async () => {
  const { env, raw } = world()
  const r = await mu.createMediaUpload(env, { actor: ALICE, accountId: '45838' })
  assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM media_upload_tickets').get().n, 0)
})

test('the upload lands as the ticket owner, in the fixed album, and the ticket works once', async () => {
  const { env } = world()
  const { uploadUrl } = await mu.createMediaUpload(env, { actor: ALICE, accountId: '76189' })
  const res = await mu.handleMediaUpload(put(uploadUrl, MP4), env)
  const body = await res.json()
  assert.equal(res.status, 200, JSON.stringify(body))
  assert.equal(body.url, 'https://vegvisr.imgix.net/mcp-1.mp4')
  assert.equal(body.contentType, 'video/mp4')
  const [u] = env.PHOTOS_WORKER.uploads
  assert.equal(u.token, 'sess-alice')
  assert.equal(u.album, 'ig-reels-alice.ig')
  assert.match(u.fileName, /\.mp4$/)

  const again = await mu.handleMediaUpload(put(uploadUrl, MP4), env)
  assert.equal(again.status, 404)
  assert.equal(env.PHOTOS_WORKER.uploads.length, 1)
})

test('a file that is not really media is refused and still spends the ticket', async () => {
  const { env } = world()
  const { uploadUrl } = await mu.createMediaUpload(env, { actor: ALICE, accountId: '76189' })
  const html = new TextEncoder().encode('<html><script>x</script></html>')
  const res = await mu.handleMediaUpload(put(uploadUrl, html, { 'Content-Type': 'video/mp4' }), env)
  assert.equal(res.status, 415)
  assert.equal(env.PHOTOS_WORKER.uploads.length, 0)
  assert.equal((await mu.handleMediaUpload(put(uploadUrl, MP4), env)).status, 404)
})

test('an expired ticket, an unknown ticket and an oversized file reach nothing', async () => {
  const { env, raw } = world()
  const { uploadUrl } = await mu.createMediaUpload(env, { actor: ALICE, accountId: '76189' })
  raw.exec('UPDATE media_upload_tickets SET expires_at = 1')
  assert.equal((await mu.handleMediaUpload(put(uploadUrl, MP4), env)).status, 404)
  assert.equal((await mu.handleMediaUpload(put(`https://knowledge.vegvisr.org/media-upload/${'a'.repeat(64)}`, MP4), env)).status, 404)
  assert.equal((await mu.handleMediaUpload(put('https://knowledge.vegvisr.org/media-upload/../x', MP4), env)).status, 404)
  const big = new Request(uploadUrl, { method: 'PUT', body: MP4, headers: { 'Content-Length': String(mu.MAX_BYTES + 1) } })
  assert.equal((await mu.handleMediaUpload(big, env)).status, 413)
  assert.equal(env.PHOTOS_WORKER.uploads.length, 0)
})

test('sniffMedia reads the bytes, not the name', () => {
  assert.equal(mu.sniffMedia(MP4).ext, 'mp4')
  assert.equal(mu.sniffMedia(new Uint8Array([0, 0, 0, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20])).ext, 'mov')
  assert.equal(mu.sniffMedia(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])).ext, 'jpg')
  assert.equal(mu.sniffMedia(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).ext, 'png')
  assert.equal(mu.sniffMedia(new TextEncoder().encode('GIF89a......')), null)
})
