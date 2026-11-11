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
