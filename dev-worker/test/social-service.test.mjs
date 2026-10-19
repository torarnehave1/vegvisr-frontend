// social-service.js — Instagram posting through blotato-worker, AS the caller.
//
// Pinned: (1) blotato-worker is called with the CALLER's own token, never a shared one, so its
// access model (own key / Superadmin / blotato_account_grants) is the only gate; (2) preview and
// every refusal send nothing — the signature is no POST /post reaching the fake worker; (3) an
// account the worker does not show this caller is refused before anything is posted.
//
// Run:  node --test test/social-service.test.mjs
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedUsers } from './d1-adapter.mjs'
import * as gs from '../graph-service.js'
import * as social from '../social-service.js'

const actorFor = (email) =>
  gs.normalizeActor({ valid: true, userId: `u-${email}`, userEmail: email, userRole: 'User', scopes: ['chat:write'] })
const ALICE = actorFor('alice@example.com')
const IMG = 'https://cdn.example.com/a.jpg'
const VID = 'https://cdn.example.com/v.mp4'

class FakeBlotato {
  constructor({ accounts = [{ id: '76189', platform: 'instagram', username: 'alice_ig' }, { id: '1', platform: 'facebook' }], postStatus = 201, statusData = null } = {}) {
    this.calls = []
    this.accounts = accounts
    this.postStatus = postStatus
    this.statusData = statusData
  }
  async fetch(url, init = {}) {
    const u = new URL(url)
    this.calls.push({ path: u.pathname, method: init.method || 'GET', token: init.headers?.['X-API-Token'], body: init.body ? JSON.parse(init.body) : null })
    const j = (b, s = 200) => new Response(JSON.stringify(b), { status: s })
    if (u.pathname === '/blotato/accounts') return j({ success: true, data: { items: this.accounts } })
    if (u.pathname === '/blotato/post') {
      if (this.postStatus === 403) return j({ success: false, error: 'This account is granted to another user' }, 403)
      return j({ success: true, data: { postSubmissionId: 'sub-12345678' } }, 201)
    }
    if (u.pathname.startsWith('/blotato/post/')) return j({ success: true, data: this.statusData })
    return j({ success: false }, 404)
  }
  get posts() {
    return this.calls.filter((c) => c.path === '/blotato/post')
  }
}

function world(opts) {
  const { env, raw } = freshDb()
  seedUsers(raw)
  env.BLOTATO_WORKER = new FakeBlotato(opts)
  return env
}

const realFetch = globalThis.fetch
let media
beforeEach(() => {
  media = { [IMG]: { status: 200, type: 'image/jpeg' }, [VID]: { status: 200, type: 'video/mp4' } }
  globalThis.fetch = async (url) => {
    const m = media[url] || { status: 404, type: 'text/html' }
    return new Response(null, { status: m.status, headers: { 'content-type': m.type } })
  }
})
afterEach(() => {
  globalThis.fetch = realFetch
})

const POST = { accountId: '76189', text: 'Hei #vegr', mediaUrls: [IMG] }

test('lists only Instagram accounts, called with the caller\'s own token', async () => {
  const env = world()
  const r = await social.listInstagramAccounts(env, { actor: ALICE })
  assert.equal(r.ok, true)
  assert.deepEqual(r.accounts, [{ accountId: '76189', username: 'alice_ig', name: null }])
  assert.equal(env.BLOTATO_WORKER.calls[0].token, 'sess-alice')
})

test('preview posts nothing', async () => {
  const env = world()
  const r = await social.previewInstagramPost(env, { ...POST, actor: ALICE })
  assert.equal(r.ok, true, r.message)
  assert.equal(r.posted, false)
  assert.equal(r.username, 'alice_ig')
  assert.equal(r.shape, 'image post')
  assert.equal(r.hashtags, 1)
  assert.equal(env.BLOTATO_WORKER.posts.length, 0)
})

test('post forwards the exact Blotato body as the caller', async () => {
  const env = world()
  const r = await social.postToInstagram(env, { ...POST, firstComment: 'link', actor: ALICE })
  assert.equal(r.ok, true, r.message)
  assert.equal(r.postSubmissionId, 'sub-12345678')
  const [p] = env.BLOTATO_WORKER.posts
  assert.equal(p.token, 'sess-alice')
  assert.deepEqual(p.body, {
    post: {
      accountId: '76189',
      content: { text: 'Hei #vegr', mediaUrls: [IMG], platform: 'instagram' },
      target: { targetType: 'instagram', firstComment: 'link' },
    },
  })
})

test('an account the worker does not show this caller is refused, nothing posted', async () => {
  const env = world()
  const r = await social.postToInstagram(env, { ...POST, accountId: '45838', actor: ALICE })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.equal(env.BLOTATO_WORKER.posts.length, 0)
})

test('unreachable or non-media URLs are refused before posting', async () => {
  const env = world()
  const r = await social.postToInstagram(env, { ...POST, mediaUrls: ['https://cdn.example.com/missing.jpg'], actor: ALICE })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.INVALID_INPUT)
  assert.match(r.message, /HTTP 404/)
  assert.equal(env.BLOTATO_WORKER.posts.length, 0)
})

test('Instagram limits: media required, story = 1 item, reel = video, past schedule', async () => {
  const env = world()
  for (const bad of [
    { mediaUrls: [] },
    { mediaType: 'story', mediaUrls: [IMG, IMG] },
    { mediaType: 'reel', mediaUrls: [IMG] },
    { scheduledTime: '2020-01-01T00:00:00Z' },
    { scheduledTime: '2099-01-01T00:00:00' },
    { mediaUrls: ['http://cdn.example.com/a.jpg'] },
    { text: '#a '.repeat(31) },
  ]) {
    const r = await social.previewInstagramPost(env, { ...POST, ...bad, actor: ALICE })
    assert.equal(r.ok, false, JSON.stringify(bad))
    assert.equal(r.code, gs.ERR.INVALID_INPUT, JSON.stringify(bad))
  }
  assert.equal(env.BLOTATO_WORKER.posts.length, 0)
})

test('a story sends an empty caption and mediaType story; a schedule is forwarded', async () => {
  const env = world()
  const r = await social.postToInstagram(env, { ...POST, mediaType: 'story', scheduledTime: '2099-01-01T09:00:00+02:00', actor: ALICE })
  assert.equal(r.ok, true, r.message)
  const [p] = env.BLOTATO_WORKER.posts
  assert.equal(p.body.post.content.text, '')
  assert.equal(p.body.post.target.mediaType, 'story')
  assert.equal(p.body.scheduledTime, '2099-01-01T07:00:00.000Z')
})

test('a caller with no platform credential reaches nothing', async () => {
  const env = world()
  const r = await social.listInstagramAccounts(env, { actor: actorFor('nobody@example.com') })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.equal(env.BLOTATO_WORKER.calls.length, 0)
})

test('a 403 from blotato-worker surfaces as a refusal with its reason', async () => {
  const env = world({ postStatus: 403 })
  const r = await social.postToInstagram(env, { ...POST, actor: ALICE })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.match(r.message, /granted to another user/)
})

test('status maps Blotato\'s answer', async () => {
  const env = world({ statusData: { postSubmissionId: 'sub-12345678', status: 'published', publicUrl: 'https://instagram.com/p/x' } })
  const r = await social.getInstagramPostStatus(env, { actor: ALICE, postSubmissionId: 'sub-12345678' })
  assert.equal(r.ok, true)
  assert.equal(r.status, 'published')
  assert.equal(r.publicUrl, 'https://instagram.com/p/x')
  assert.equal(env.BLOTATO_WORKER.calls[0].path, '/blotato/post/sub-12345678')
  const bad = await social.getInstagramPostStatus(env, { actor: ALICE, postSubmissionId: '../x' })
  assert.equal(bad.ok, false)
})
