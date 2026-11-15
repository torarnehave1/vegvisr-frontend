// POST /realtime/close-meeting — who may close a meeting.
//
// Until 2026-11-15 the endpoint had no ownership check: any signed-in user could set any meeting
// INACTIVE by id (it refused only the caller's own personal and team room). Now the caller must
// own the meeting (meeting_ownership) or be a Superadmin. It fails closed: no ownership row, or an
// unreadable ownership table, is a refusal, and RealtimeKit is never asked.
//
// Runs the real worker handler against an in-memory SQLite and a stubbed RealtimeKit.
//
// Run:  node test-close-meeting.mjs
import { DatabaseSync } from 'node:sqlite'
import assert from 'node:assert/strict'
import worker from './index.js'

function world({ ownershipTable = true } = {}) {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE config(email TEXT PRIMARY KEY, user_id TEXT, Role TEXT, Systemowner INTEGER,
    emailVerificationToken TEXT, display_name TEXT, data TEXT,
    cf_account_id TEXT, cf_api_token TEXT, cf_rtk_app_id TEXT, cf_rtk_token TEXT, cf_r2_account_id TEXT,
    cf_r2_bucket TEXT, cf_r2_access_key_id TEXT, cf_r2_secret TEXT, cf_r2_public_base TEXT,
    cf_kv_namespace_id TEXT, cf_kv_token TEXT)`)
  const user = d.prepare('INSERT INTO config(email, user_id, Role, emailVerificationToken, data) VALUES (?,?,?,?,?)')
  user.run('alice@example.com', 'u-alice', 'User', 'sess-alice', JSON.stringify({ realtime: { personalMeetingId: 'm-alice-personal' } }))
  user.run('bob@example.com', 'u-bob', 'Admin', 'sess-bob', '{}')
  user.run('root@example.com', 'u-root', 'Superadmin', 'sess-root', '{}')
  if (ownershipTable) {
    d.exec('CREATE TABLE meeting_ownership(meeting_id TEXT PRIMARY KEY, owner_email TEXT, room_type TEXT)')
    const own = d.prepare('INSERT INTO meeting_ownership VALUES (?,?,?)')
    own.run('m-alice-adhoc', 'Alice@Example.com', 'adhoc')
    own.run('m-alice-personal', 'alice@example.com', 'personal')
    own.run('m-bob-adhoc', 'bob@example.com', 'adhoc')
  }
  return {
    CF_ACCOUNT_ID: 'acc', REALTIMEKIT_APP_ID: 'shared-app', REALTIMEKIT_API_TOKEN: 'tok',
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
}

const patched = []
globalThis.fetch = async (url, init = {}) => {
  patched.push({ url: String(url), method: init.method, body: init.body })
  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

async function close(env, token, meetingId) {
  patched.length = 0
  const res = await worker.fetch(new Request('https://api.vegvisr.org/realtime/close-meeting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-API-Token': token } : {}) },
    body: JSON.stringify({ meetingId }),
  }), env)
  return { status: res.status, body: await res.json(), asked: patched.length }
}

let n = 0
const check = async (name, fn) => { await fn(); n++; console.log(`ok    ${name}`) }
const quiet = console.error
console.error = () => {}

await check('the owner closes their own ad-hoc meeting', async () => {
  const r = await close(world(), 'sess-alice', 'm-alice-adhoc')
  assert.equal(r.status, 200)
  assert.equal(r.body.status, 'INACTIVE')
  assert.equal(r.asked, 1)
  assert.match(patched[0].url, /\/meetings\/m-alice-adhoc$/)
  assert.equal(patched[0].method, 'PATCH')
})

await check('another user\'s meeting is refused, and RealtimeKit is never asked', async () => {
  const r = await close(world(), 'sess-alice', 'm-bob-adhoc')
  assert.equal(r.status, 403)
  assert.match(r.body.error, /Only the owner/)
  assert.equal(r.asked, 0)
})

await check('an Admin is not an exception', async () => {
  const r = await close(world(), 'sess-bob', 'm-alice-adhoc')
  assert.equal(r.status, 403)
  assert.equal(r.asked, 0)
})

await check('a meeting with no owner on record is refused for a user', async () => {
  const r = await close(world(), 'sess-alice', 'm-orphan')
  assert.equal(r.status, 403)
  assert.equal(r.asked, 0)
})

await check('a Superadmin closes any meeting, also one with no owner on record', async () => {
  const env = world()
  assert.equal((await close(env, 'sess-root', 'm-bob-adhoc')).status, 200)
  assert.equal((await close(env, 'sess-root', 'm-orphan')).status, 200)
})

await check('the caller\'s own personal room still cannot be closed', async () => {
  const r = await close(world(), 'sess-alice', 'm-alice-personal')
  assert.equal(r.status, 403)
  assert.match(r.body.error, /permanent room/)
  assert.equal(r.asked, 0)
})

await check('if ownership cannot be read, a user is refused (fails closed)', async () => {
  const r = await close(world({ ownershipTable: false }), 'sess-bob', 'm-bob-adhoc')
  assert.equal(r.status, 403)
  assert.equal(r.asked, 0)
})

await check('no token is refused', async () => {
  const r = await close(world(), null, 'm-alice-adhoc')
  assert.equal(r.status, 401)
  assert.equal(r.asked, 0)
})

console.error = quiet
console.log(`\n${n} checks passed`)
