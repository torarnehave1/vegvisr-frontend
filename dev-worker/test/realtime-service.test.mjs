// realtime-service.js — Vegvisr Realtime from the MCP surface, forwarded to realtime-worker.
//
// Pinned: every call goes out AS the caller (their own token) over the REALTIME_WORKER binding;
// the rooms list joins /realtime/my-rooms with /realtime/open-room/status and builds the links
// the way the app does; a refusal or an outage upstream becomes a stable error code, not a throw.
// The reply fixtures are the live response shapes read on 2026-11-11.
//
// Run:  node --test test/realtime-service.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedUsers } from './d1-adapter.mjs'
import * as gs from '../graph-service.js'
import * as rt from '../realtime-service.js'

const ALICE = gs.normalizeActor({ valid: true, userId: 'u-alice', userEmail: 'alice@example.com', userRole: 'User', scopes: ['contacts:read'] })
const j = (b, s = 200) => new Response(JSON.stringify(b), { status: s })

const MY_ROOMS = {
  success: true, personalMeetingId: 'p-1', teamMeetingId: 't-1', personalTitle: 'Alice', teamTitle: 'Team A',
  displayName: 'Alice', waitingScreen: null, waitingRoomEnabled: true,
}
const OPEN = {
  success: true,
  rooms: [{ meetingId: 'p-1', isDefault: true }, { meetingId: 'x-9', isDefault: false }],
  slugs: { 't-1': ['lyd'], 'p-1': ['momentum', 'nibi'], 'x-9': ['kurs'] },
  canSetDefault: true,
}

function world(replies = {}) {
  const { env, raw } = freshDb()
  seedUsers(raw)
  const calls = []
  env.REALTIME_WORKER = {
    fetch: async (url, init = {}) => {
      const u = new URL(url)
      calls.push({ path: u.pathname, method: init.method || 'GET', token: init.headers?.['X-API-Token'] })
      const r = replies[u.pathname] ?? ({ '/realtime/my-rooms': [200, MY_ROOMS], '/realtime/open-room/status': [200, OPEN] })[u.pathname]
      return j(r[1], r[0])
    },
  }
  return { env, calls }
}

test('listRooms asks realtime-worker as the caller, on both endpoints', async () => {
  const { env, calls } = world()
  const r = await rt.listRooms(env, { actor: ALICE })
  assert.equal(r.ok, true)
  assert.deepEqual(calls.map((c) => c.path).sort(), ['/realtime/my-rooms', '/realtime/open-room/status'])
  assert.ok(calls.every((c) => c.token === 'sess-alice' && c.method === 'GET'))
})

test('listRooms joins rooms, open state and slugs, and builds the links the app builds', async () => {
  const { env } = world()
  const r = await rt.listRooms(env, { actor: ALICE })
  assert.equal(r.displayName, 'Alice')
  assert.equal(r.waitingRoomEnabled, true)
  assert.equal(r.canSetDefaultOpenRoom, true)
  assert.deepEqual(r.rooms.map((x) => `${x.kind}:${x.meetingId}`), ['personal:p-1', 'team:t-1', 'other:x-9'])

  const [personal, team, other] = r.rooms
  assert.equal(personal.title, 'Alice')
  assert.equal(personal.joinUrl, 'https://realtime.vegvisr.org/?meetingId=p-1')
  assert.equal(personal.openRoom, true)
  assert.equal(personal.isDefaultOpenRoom, true)
  assert.equal(personal.openRoomUrl, 'https://realtime.vegvisr.org/?openroom')
  assert.deepEqual(personal.slugUrls, ['https://realtime.vegvisr.org/momentum', 'https://realtime.vegvisr.org/nibi'])

  assert.equal(team.openRoom, false)
  assert.equal(team.openRoomUrl, null, 'a room that is not open has no guest link')
  assert.deepEqual(team.slugs, ['lyd'])

  assert.equal(other.title, null)
  assert.equal(other.openRoomUrl, 'https://realtime.vegvisr.org/?openroom=kurs', 'an open room is addressed by its slug')
})

test('an account with no rooms yet answers an empty list, not an error', async () => {
  const { env } = world({
    '/realtime/my-rooms': [200, { success: true, personalMeetingId: null, teamMeetingId: null, displayName: null }],
    '/realtime/open-room/status': [200, { success: true, rooms: [], slugs: {}, canSetDefault: false }],
  })
  const r = await rt.listRooms(env, { actor: ALICE })
  assert.equal(r.ok, true)
  assert.deepEqual(r.rooms, [])
  assert.equal(r.waitingRoomEnabled, false)
})

test('a refusal upstream is FORBIDDEN_GRAPH, an outage INTERNAL_ERROR', async () => {
  const refused = world({ '/realtime/my-rooms': [401, { error: 'Invalid X-API-Token' }] })
  const a = await rt.listRooms(refused.env, { actor: ALICE })
  assert.equal(a.ok, false)
  assert.equal(a.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.match(a.message, /Invalid X-API-Token/)

  const down = world({ '/realtime/open-room/status': [500, { error: 'boom' }] })
  const b = await rt.listRooms(down.env, { actor: ALICE })
  assert.equal(b.code, gs.ERR.INTERNAL_ERROR)
})

test('nothing leaves this worker without a caller, a credential, or the binding', async () => {
  const { env, calls } = world()
  const anon = await rt.listRooms(env, { actor: null })
  assert.equal(anon.code, gs.ERR.UNAUTHENTICATED)

  const stranger = gs.normalizeActor({ valid: true, userId: 'u-x', userEmail: 'nobody@example.com', userRole: 'User', scopes: [] })
  const noToken = await rt.listRooms(env, { actor: stranger })
  assert.equal(noToken.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.equal(calls.length, 0)

  delete env.REALTIME_WORKER
  const unbound = await rt.listRooms(env, { actor: ALICE })
  assert.equal(unbound.code, gs.ERR.INTERNAL_ERROR)
  assert.match(unbound.message, /REALTIME_WORKER/)
})

// ── Slice 1: recordings, link, transcript, slugs ─────────────────────────────
// The recording fixtures are the three live item shapes read on 2026-11-13.
const RECORDINGS = { success: true, recordings: [
  { key: 'recordings/Charlie.mp4', name: 'Charlie.mp4', size: 130042169, uploaded: '2026-09-06T08:02:36.160Z', etag: 'e', customMetadata: {}, source: 'r2', playUrl: 'https://realtimevideos.vegvisr.org/recordings/Charlie.mp4', playUrlPermanent: true, title: 'Charlie talk', labels: ['kurs'], thumbnailUrl: '' },
  { key: 'stream-recordings/abc.mp4', name: 'abc.mp4', size: 992443, uploaded: '2026-08-05T03:00:56.014Z', etag: 'e', customMetadata: { type: 'stream' }, source: 'stream', type: 'stream', playUrl: 'https://realtimevideos.vegvisr.org/stream-recordings/abc.mp4', playUrlPermanent: true, title: '', labels: [], thumbnailUrl: '' },
  { key: 'fff51a14', name: 'p-1_1794481452185.mp4', size: 185379051, uploaded: '2026-11-12T11:50:09.858Z', duration: 2750.104, meetingId: 'p-1', meetingTitle: 'Tor Arne', status: 'UPLOADED', download_url: 'https://rtk-prod-recording.example/secret?sig=1', download_url_expiry: '2026-11-19T11:50:13.210Z', error: '[ERROR:0003] failed', source: 'realtimekit', ownerEmail: 'alice@example.com' },
  { key: 'recordings/own.mp4', name: 'own.mp4', size: 1048576, uploaded: '2026-10-01T10:00:00.000Z', source: 'r2-own', type: 'realtime', playUrl: 'https://presigned.example/own?sig=old', playUrlPermanent: false, title: '', labels: [], thumbnailUrl: '', hasTranscript: true },
  { key: 'stream-recordings/own-s.mp4', name: 'own-s.mp4', size: 1, uploaded: '2026-07-01T10:00:00.000Z', source: 'stream', type: 'stream', playUrl: 'https://presigned.example/own-s?sig=old', playUrlPermanent: false, title: '', labels: [] },
] }

function world2(replies = {}) {
  const { env, raw } = freshDb()
  seedUsers(raw)
  const calls = []
  const defaults = { '/realtime/recordings': [200, RECORDINGS] }
  env.REALTIME_WORKER = {
    fetch: async (url, init = {}) => {
      const u = new URL(url)
      calls.push({ path: u.pathname, q: Object.fromEntries(u.searchParams), token: init.headers?.['X-API-Token'] })
      const r = replies[u.pathname] ?? defaults[u.pathname]
      return j(r[1], r[0])
    },
  }
  return { env, calls }
}

test('listRecordings is newest first, whitelists fields and counts what is not stored', async () => {
  const { env, calls } = world2()
  const r = await rt.listRecordings(env, { actor: ALICE })
  assert.equal(r.ok, true)
  assert.equal(calls[0].token, 'sess-alice')
  assert.equal(calls[0].q.asUser, undefined, 'never asks on behalf of another user')
  assert.equal(r.total, 5)
  assert.equal(r.notStored, 1)
  assert.deepEqual(r.recordings.map((x) => x.key), ['fff51a14', 'recordings/own.mp4', 'recordings/Charlie.mp4', 'stream-recordings/abc.mp4', 'stream-recordings/own-s.mp4'])
  const cloud = r.recordings[0]
  assert.equal(cloud.stored, false)
  assert.equal(cloud.durationMinutes, 45.8)
  assert.equal(cloud.playUrl, null)
  assert.equal(JSON.stringify(r).includes('rtk-prod-recording'), false, 'the RealtimeKit bearer link never leaves this worker')
  const charlie = r.recordings[2]
  assert.equal(charlie.sizeMB, 124)
  assert.equal(charlie.playUrl, 'https://realtimevideos.vegvisr.org/recordings/Charlie.mp4')
  assert.equal(charlie.hasTranscript, null, 'unknown is null, not false')
  assert.equal(r.recordings[1].playUrl, null, 'a presigned link is not handed out from the list')
  assert.equal(r.recordings[1].hasTranscript, true)
})

test('listRecordings filters by query, source and limit', async () => {
  const { env } = world2()
  assert.deepEqual((await rt.listRecordings(env, { actor: ALICE, query: 'KURS' })).recordings.map((x) => x.key), ['recordings/Charlie.mp4'])
  assert.deepEqual((await rt.listRecordings(env, { actor: ALICE, query: 'tor arne' })).recordings.map((x) => x.key), ['fff51a14'])
  const s = await rt.listRecordings(env, { actor: ALICE, source: 'stream', limit: 1 })
  assert.equal(s.matched, 2)
  assert.equal(s.recordings.length, 1)
  const bad = await rt.listRecordings(env, { actor: ALICE, source: 'tape' })
  assert.equal(bad.code, gs.ERR.INVALID_INPUT)
})

test('getRecordingLink: a permanent link comes from the list, with no second call', async () => {
  const { env, calls } = world2()
  const r = await rt.getRecordingLink(env, { actor: ALICE, key: 'stream-recordings/abc.mp4' })
  assert.equal(r.url, 'https://realtimevideos.vegvisr.org/stream-recordings/abc.mp4')
  assert.equal(r.permanent, true)
  assert.equal(r.expiresAt, null)
  assert.deepEqual(calls.map((c) => c.path), ['/realtime/recordings'])
})

test('getRecordingLink: an own-bucket file gets a fresh presign for the asked lifetime', async () => {
  const { env, calls } = world2({ '/realtime/recordings/play-url': [200, { success: true, url: 'https://presigned.example/own?sig=new', source: 'r2-own', expiresAt: '2026-11-13T12:00:00.000Z' }] })
  const r = await rt.getRecordingLink(env, { actor: ALICE, key: 'recordings/own.mp4', expiresMinutes: 30 })
  assert.equal(r.url, 'https://presigned.example/own?sig=new')
  assert.equal(r.permanent, false)
  assert.equal(r.expiresAt, '2026-11-13T12:00:00.000Z')
  assert.deepEqual(calls[1].q, { key: 'recordings/own.mp4', expires: '1800' })
})

test('getRecordingLink: a Stream copy without a permanent address keeps the list link, play-url is not asked', async () => {
  const { env, calls } = world2()
  const r = await rt.getRecordingLink(env, { actor: ALICE, key: 'stream-recordings/own-s.mp4' })
  assert.equal(r.url, 'https://presigned.example/own-s?sig=old')
  assert.equal(r.permanent, false)
  assert.ok(r.expiresAt)
  assert.equal(calls.length, 1)
})

test('getRecordingLink refuses a key that is not in the caller\'s list, and one that is not stored', async () => {
  const { env, calls } = world2()
  const stranger = await rt.getRecordingLink(env, { actor: ALICE, key: 'recordings/someone-elses.mp4' })
  assert.equal(stranger.code, gs.ERR.GRAPH_NOT_FOUND)
  const cloud = await rt.getRecordingLink(env, { actor: ALICE, key: 'fff51a14' })
  assert.equal(cloud.code, gs.ERR.INVALID_INPUT)
  assert.match(cloud.message, /not been copied to storage/)
  assert.ok(calls.every((c) => c.path === '/realtime/recordings'), 'play-url was never asked')
  assert.equal((await rt.getRecordingLink(env, { actor: ALICE, key: ' ' })).code, gs.ERR.INVALID_INPUT)
})

test('getTranscript returns the text, cuts a long one, and reports found=false as an answer', async () => {
  const text = 'a'.repeat(3000)
  const { env, calls } = world2({ '/realtime/recordings/transcript': [200, { success: true, key: 'recordings/own.mp4', found: true, text, chars: 3000, model: 'whisper', source: 'app', savedBy: 'alice@example.com', savedAt: '2026-10-02T08:00:00.000Z' }] })
  const full = await rt.getTranscript(env, { actor: ALICE, key: 'recordings/own.mp4' })
  assert.equal(full.found, true)
  assert.equal(full.text.length, 3000)
  assert.equal(full.truncated, false)
  assert.equal('savedBy' in full, false)
  assert.deepEqual(calls[0].q, { key: 'recordings/own.mp4' })
  const cut = await rt.getTranscript(env, { actor: ALICE, key: 'recordings/own.mp4', maxChars: 1000 })
  assert.equal(cut.text.length, 1000)
  assert.equal(cut.truncated, true)
  assert.equal(cut.chars, 3000)

  const none = world2({ '/realtime/recordings/transcript': [200, { success: true, key: 'k', found: false }] })
  const n = await rt.getTranscript(none.env, { actor: ALICE, key: 'k' })
  assert.deepEqual({ ok: n.ok, found: n.found }, { ok: true, found: false })

  const cloud = world2({ '/realtime/recordings/transcript': [409, { error: 'This recording has no storage bucket (RealtimeKit cloud only).' }] })
  const c = await rt.getTranscript(cloud.env, { actor: ALICE, key: 'fff51a14' })
  assert.equal(c.code, gs.ERR.INVALID_INPUT)
  assert.match(c.message, /no storage bucket/)
})

test('listSlugs builds the slug address; a non-admin refusal is FORBIDDEN_GRAPH', async () => {
  const { env } = world2({ '/realtime/slugs': [200, { success: true, slugs: [
    { id: 's1', slug: 'stillerom', meetingId: 'p-1', ownerEmail: 'alice@example.com', allowedEmails: ['m@example.com'], active: true, createdAt: '2026-10-17T09:21:54.594Z', scheduledStartAt: '2026-10-22T10:00:00.000Z' },
  ] }] })
  const r = await rt.listSlugs(env, { actor: ALICE })
  assert.deepEqual(r.slugs, [{ id: 's1', slug: 'stillerom', url: 'https://realtime.vegvisr.org/stillerom', meetingId: 'p-1', allowedEmails: ['m@example.com'], scheduledStartAt: '2026-10-22T10:00:00.000Z', createdAt: '2026-10-17T09:21:54.594Z' }])

  const denied = world2({ '/realtime/slugs': [403, { success: false, error: 'Forbidden: Admin or Superadmin role required' }] })
  const d = await rt.listSlugs(denied.env, { actor: ALICE })
  assert.equal(d.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.match(d.message, /Admin or Superadmin/)
})

test('a transcript file is not a recording, and a synced recording is listed once', async () => {
  const { env } = world2({ '/realtime/recordings': [200, { success: true, recordings: [
    { key: 'recordings/m_1.mp4', name: 'm_1.mp4', size: 185379051, uploaded: '2026-11-13T07:39:00.000Z', source: 'r2', playUrl: 'https://realtimevideos.vegvisr.org/recordings/m_1.mp4', playUrlPermanent: true, title: '', labels: [] },
    { key: 'recordings/m_1.mp4.transcript.json', name: 'm_1.mp4.transcript.json', size: 4000, uploaded: '2026-11-13T08:00:00.000Z', source: 'r2', playUrl: 'https://realtimevideos.vegvisr.org/recordings/m_1.mp4.transcript.json', playUrlPermanent: true, title: '', labels: [] },
    { key: 'rtk-1', name: 'm_1.mp4', size: 185379051, uploaded: '2026-11-12T11:50:09.858Z', duration: 2750.104, meetingId: 'p-1', meetingTitle: 'Tor Arne', status: 'UPLOADED', download_url: 'https://rtk.example/s', source: 'realtimekit' },
    { key: 'rtk-2', name: 'm_2.mp4', size: 5, uploaded: '2026-11-01T10:00:00.000Z', duration: 60, meetingTitle: 'Team', status: 'UPLOADED', source: 'realtimekit' },
    { key: 'recordings/plain.mp4', name: 'plain.mp4', size: 5, uploaded: '2026-10-01T10:00:00.000Z', source: 'r2', playUrl: 'https://realtimevideos.vegvisr.org/recordings/plain.mp4', playUrlPermanent: true, title: '', labels: [] },
  ] }] })
  const r = await rt.listRecordings(env, { actor: ALICE })
  assert.deepEqual(r.recordings.map((x) => x.key), ['recordings/m_1.mp4', 'rtk-2', 'recordings/plain.mp4'])
  assert.equal(r.total, 3)
  assert.equal(r.notStored, 1, 'only the recording that really is not in storage')
  const m1 = r.recordings[0]
  assert.equal(m1.stored, true)
  assert.equal(m1.hasTranscript, true)
  assert.equal(m1.durationMinutes, 45.8, 'duration carried over from the cloud row')
  assert.equal(m1.meetingTitle, 'Tor Arne')
  assert.equal(r.recordings[2].hasTranscript, null)
  assert.equal((await rt.listRecordings(env, { actor: ALICE, query: 'tor arne' })).recordings[0].key, 'recordings/m_1.mp4')
  const gone = await rt.getRecordingLink(env, { actor: ALICE, key: 'recordings/m_1.mp4.transcript.json' })
  assert.equal(gone.code, gs.ERR.GRAPH_NOT_FOUND, 'no playback link for a transcript file')
})
