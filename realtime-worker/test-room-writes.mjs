// The room write endpoints as a caller that is NOT the app sees them.
//
// Since 2026-11-15 /realtime/openapi.json documents these endpoints, which makes each of them an
// Agent-Builder chat tool (rt_*) and the base of an MCP tool (realtime_*). Those callers send only
// the fields they were asked to change. Two handlers used to treat a field that was left out as
// "clear it":
//   - open-room/toggle: enabled=true without isDefault took the default flag off the platform
//     default open room (the room the bare ?openroom link leads to).
//   - update-waiting-screen: sending only a title wiped the image.
// Both now leave an omitted field alone. The app always sends every field, so it is unaffected.
//
// Runs the real worker handler against an in-memory SQLite.
//
// Run:  node test-room-writes.mjs
import { DatabaseSync } from 'node:sqlite'
import assert from 'node:assert/strict'
import worker from './index.js'

function world() {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE config(email TEXT PRIMARY KEY, user_id TEXT, Role TEXT, Systemowner INTEGER,
    emailVerificationToken TEXT, display_name TEXT, data TEXT);
    CREATE TABLE meeting_ownership(meeting_id TEXT PRIMARY KEY, owner_email TEXT, room_type TEXT);
    CREATE TABLE realtime_open_rooms(meeting_id TEXT PRIMARY KEY, owner_email TEXT, is_default INTEGER NOT NULL DEFAULT 0);`)
  const user = d.prepare('INSERT INTO config(email, user_id, Role, Systemowner, emailVerificationToken, data) VALUES (?,?,?,?,?,?)')
  user.run('owner@example.com', 'u-owner', 'Superadmin', 1, 'sess-owner', JSON.stringify({ profile: { name: 'Owner' }, realtime: { personalMeetingId: 'm-default', waitingScreen: { title: 'Welcome', image: 'https://img.example/a.png' } } }))
  user.run('alice@example.com', 'u-alice', 'User', 0, 'sess-alice', '{}')
  const own = d.prepare('INSERT INTO meeting_ownership VALUES (?,?,?)')
  own.run('m-default', 'owner@example.com', 'personal')
  own.run('m-owner-2', 'owner@example.com', 'adhoc')
  own.run('m-alice', 'alice@example.com', 'adhoc')
  d.prepare('INSERT INTO realtime_open_rooms VALUES (?,?,?)').run('m-default', 'owner@example.com', 1)
  const prep = (sql) => {
    const st = d.prepare(sql)
    const bound = (...v) => ({
      first: async () => st.get(...v) ?? null,
      run: async () => st.run(...v),
      all: async () => ({ results: st.all(...v) }),
    })
    return { bind: bound, ...bound() }
  }
  const env = { vegvisr_org: { prepare: prep, batch: async (stmts) => { for (const s of stmts) await s.run() } } }
  const open = () => Object.fromEntries(d.prepare('SELECT meeting_id, is_default FROM realtime_open_rooms').all().map((r) => [r.meeting_id, r.is_default]))
  const settings = (email) => JSON.parse(d.prepare('SELECT data FROM config WHERE email = ?').get(email).data)
  return { env, open, settings }
}

async function post(env, token, path, body) {
  const res = await worker.fetch(new Request(`https://api.vegvisr.org/realtime/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Token': token }, body: JSON.stringify(body),
  }), env)
  return { status: res.status, body: await res.json() }
}

let n = 0
const check = async (name, fn) => { await fn(); n++; console.log(`ok    ${name}`) }

// ── open-room/toggle ────────────────────────────────────────────────────────
await check('opening the default room again WITHOUT isDefault keeps it the default', async () => {
  const w = world()
  const r = await post(w.env, 'sess-owner', 'open-room/toggle', { meetingId: 'm-default', enabled: true })
  assert.equal(r.status, 200)
  assert.deepEqual([r.body.open, r.body.isDefault], [true, true])
  assert.deepEqual(w.open(), { 'm-default': 1 })
})

await check('opening another room without isDefault opens it and leaves the default where it was', async () => {
  const w = world()
  const r = await post(w.env, 'sess-owner', 'open-room/toggle', { meetingId: 'm-owner-2', enabled: true })
  assert.deepEqual([r.body.open, r.body.isDefault], [true, false])
  assert.deepEqual(w.open(), { 'm-default': 1, 'm-owner-2': 0 })
})

await check('isDefault=false still takes the flag off (what the app sends when the box is unticked)', async () => {
  const w = world()
  const r = await post(w.env, 'sess-owner', 'open-room/toggle', { meetingId: 'm-default', enabled: true, isDefault: false })
  assert.equal(r.body.isDefault, false)
  assert.deepEqual(w.open(), { 'm-default': 0 })
})

await check('isDefault=true moves the default, one per platform', async () => {
  const w = world()
  const r = await post(w.env, 'sess-owner', 'open-room/toggle', { meetingId: 'm-owner-2', enabled: true, isDefault: true })
  assert.equal(r.body.isDefault, true)
  assert.deepEqual(w.open(), { 'm-default': 0, 'm-owner-2': 1 })
})

await check('isDefault=true from someone who is not the System Owner is refused', async () => {
  const w = world()
  const r = await post(w.env, 'sess-alice', 'open-room/toggle', { meetingId: 'm-alice', enabled: true, isDefault: true })
  assert.equal(r.status, 403)
  assert.deepEqual(w.open(), { 'm-default': 1 })
})

await check('a user opens and closes their own room', async () => {
  const w = world()
  assert.equal((await post(w.env, 'sess-alice', 'open-room/toggle', { meetingId: 'm-alice', enabled: true })).body.open, true)
  assert.deepEqual(w.open(), { 'm-default': 1, 'm-alice': 0 })
  const closed = await post(w.env, 'sess-alice', 'open-room/toggle', { meetingId: 'm-alice', enabled: false })
  assert.deepEqual([closed.body.open, closed.body.isDefault], [false, false])
  assert.deepEqual(w.open(), { 'm-default': 1 })
})

await check('someone else\'s room is refused, open or close', async () => {
  const w = world()
  assert.equal((await post(w.env, 'sess-alice', 'open-room/toggle', { meetingId: 'm-owner-2', enabled: true })).status, 403)
  assert.equal((await post(w.env, 'sess-alice', 'open-room/toggle', { meetingId: 'm-default', enabled: false })).status, 403)
  assert.deepEqual(w.open(), { 'm-default': 1 })
})

// ── update-waiting-screen / toggle-waiting-room ─────────────────────────────
await check('sending only a title keeps the image', async () => {
  const w = world()
  const r = await post(w.env, 'sess-owner', 'update-waiting-screen', { title: 'New title' })
  assert.deepEqual(r.body.waitingScreen, { title: 'New title', image: 'https://img.example/a.png' })
  assert.deepEqual(w.settings('owner@example.com').realtime.waitingScreen, { title: 'New title', image: 'https://img.example/a.png' })
})

await check('sending only an image keeps the title; null clears a field (what the app sends)', async () => {
  const w = world()
  const a = await post(w.env, 'sess-owner', 'update-waiting-screen', { image: 'https://img.example/b.png' })
  assert.deepEqual(a.body.waitingScreen, { title: 'Welcome', image: 'https://img.example/b.png' })
  const b = await post(w.env, 'sess-owner', 'update-waiting-screen', { title: null, image: null })
  assert.deepEqual(b.body.waitingScreen, { title: null, image: null })
})

await check('an image that is not an http(s) URL is refused and nothing is written', async () => {
  const w = world()
  const r = await post(w.env, 'sess-owner', 'update-waiting-screen', { image: 'javascript:alert(1)' })
  assert.equal(r.status, 400)
  assert.equal(w.settings('owner@example.com').realtime.waitingScreen.image, 'https://img.example/a.png')
})

await check('the waiting room switch changes only that setting', async () => {
  const w = world()
  const r = await post(w.env, 'sess-owner', 'toggle-waiting-room', { enabled: true })
  assert.equal(r.body.waitingRoomEnabled, true)
  const s = w.settings('owner@example.com')
  assert.equal(s.realtime.waitingRoomEnabled, true)
  assert.equal(s.realtime.personalMeetingId, 'm-default')
  assert.equal(s.profile.name, 'Owner', 'the rest of the account settings survive')
})

console.log(`\n${n} checks passed`)
