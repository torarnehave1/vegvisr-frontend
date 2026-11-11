// GET /realtime/my-rooms — when a stored room id is cleared from the account, and when it is not.
//
// The endpoint checks the personal and team room against RealtimeKit on every call. Until
// 2026-11-11 ANY non-OK answer cleared the id, so one temporary Cloudflare error, or a wrong
// credential (the 2026-06-15 incident: a 403 with code 10000), erased a user's rooms. Now only a
// 404 — RealtimeKit saying the meeting does not exist — clears it. Measured on the live API that
// day: missing meeting → 404, rejected token → 400.
//
// Runs the real worker handler against an in-memory SQLite and a stubbed RealtimeKit.
//
// Run:  node test-my-rooms.mjs
import { DatabaseSync } from 'node:sqlite'
import assert from 'node:assert/strict'
import worker from './index.js'

function world() {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE config(email TEXT PRIMARY KEY, user_id TEXT, Role TEXT, Systemowner INTEGER,
    emailVerificationToken TEXT, display_name TEXT, data TEXT,
    cf_account_id TEXT, cf_api_token TEXT, cf_rtk_app_id TEXT, cf_rtk_token TEXT, cf_r2_account_id TEXT,
    cf_r2_bucket TEXT, cf_r2_access_key_id TEXT, cf_r2_secret TEXT, cf_r2_public_base TEXT,
    cf_kv_namespace_id TEXT, cf_kv_token TEXT)`)
  d.prepare('INSERT INTO config(email, user_id, Role, Systemowner, emailVerificationToken, display_name, data) VALUES (?,?,?,?,?,?,?)')
    .run('alice@example.com', 'u-alice', 'User', 0, 'sess-alice', 'Alice',
      JSON.stringify({ realtime: { personalMeetingId: 'p-1', teamMeetingId: 't-1', waitingRoomEnabled: true } }))
  const env = {
    CF_ACCOUNT_ID: 'acc', REALTIMEKIT_APP_ID: 'app', REALTIMEKIT_API_TOKEN: 'tok',
    vegvisr_org: {
      prepare(sql) {
        const st = d.prepare(sql)
        const bound = (...v) => ({
          first: async () => st.get(...v) ?? null,
          run: async () => st.run(...v),
          all: async () => ({ results: st.all(...v) }),
        })
        return { bind: bound, ...bound() }
      },
    },
  }
  const stored = () => JSON.parse(d.prepare('SELECT data FROM config WHERE email = ?').get('alice@example.com').data).realtime
  return { env, stored }
}

/** RealtimeKit, stubbed: `answers` maps a meeting id to an HTTP status, or to 'throw'. */
function rtk(answers) {
  globalThis.fetch = async (url) => {
    const id = String(url).split('/meetings/')[1]
    const a = answers[id] ?? 200
    if (a === 'throw') throw new Error('network down')
    return new Response(JSON.stringify(a === 200 ? { data: { title: `Title ${id}` } } : { success: false }), { status: a })
  }
}

async function myRooms(env) {
  const res = await worker.fetch(new Request('https://api.vegvisr.org/realtime/my-rooms', { headers: { 'X-API-Token': 'sess-alice' } }), env)
  return { status: res.status, body: await res.json() }
}

let n = 0
const check = async (name, fn) => { await fn(); n++; console.log(`ok    ${name}`) }
const quiet = console.warn
console.warn = () => {}

await check('both rooms known: ids and titles returned, nothing written', async () => {
  const { env, stored } = world()
  rtk({})
  const { status, body } = await myRooms(env)
  assert.equal(status, 200)
  assert.equal(body.personalMeetingId, 'p-1')
  assert.equal(body.teamMeetingId, 't-1')
  assert.equal(body.personalTitle, 'Title p-1')
  assert.equal(body.waitingRoomEnabled, true)
  assert.equal(stored().teamMeetingId, 't-1')
})

await check('404 from RealtimeKit: that room is cleared, the other is kept', async () => {
  const { env, stored } = world()
  rtk({ 't-1': 404 })
  const { body } = await myRooms(env)
  assert.equal(body.personalMeetingId, 'p-1')
  assert.equal(body.teamMeetingId, null)
  assert.equal(stored().teamMeetingId, null)
  assert.equal(stored().personalMeetingId, 'p-1')
  assert.equal(stored().waitingRoomEnabled, true, 'the rest of the realtime settings survive the write')
})

for (const failure of [500, 503, 429, 403, 400, 'throw']) {
  await check(`${failure} from RealtimeKit: both ids are kept, title is null`, async () => {
    const { env, stored } = world()
    rtk({ 'p-1': failure, 't-1': failure })
    const { status, body } = await myRooms(env)
    assert.equal(status, 200)
    assert.equal(body.personalMeetingId, 'p-1')
    assert.equal(body.teamMeetingId, 't-1')
    assert.equal(body.personalTitle, null)
    assert.equal(stored().personalMeetingId, 'p-1')
    assert.equal(stored().teamMeetingId, 't-1')
  })
}

console.warn = quiet
console.log(`\n${n} checks passed`)
