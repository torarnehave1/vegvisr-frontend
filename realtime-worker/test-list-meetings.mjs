// GET /realtime/list-meetings — whose meetings a caller is shown.
//
// The shared RealtimeKit app holds every user's meetings. Until 2026-11-15 this endpoint returned
// all of them to any signed-in user. Now, on the shared app, a caller sees only the meetings
// meeting_ownership records as theirs. A Superadmin still sees the whole app, and so does a user
// on their OWN RealtimeKit app. The personal and team room are left out for everyone, as before.
//
// Runs the real worker handler against an in-memory SQLite and a stubbed RealtimeKit.
//
// Run:  node test-list-meetings.mjs
import { DatabaseSync } from 'node:sqlite'
import assert from 'node:assert/strict'
import worker from './index.js'

const APP_MEETINGS = [
  { id: 'M-ALICE-ADHOC', title: 'Alice planning', status: 'ACTIVE', created_at: '2026-11-01T10:00:00Z' },
  { id: 'm-alice-personal', title: 'Alice', status: 'ACTIVE', created_at: '2026-01-01T10:00:00Z' },
  { id: 'm-bob-adhoc', title: 'Bob private', status: 'ACTIVE', created_at: '2026-11-02T10:00:00Z' },
  { id: 'm-orphan', status: 'INACTIVE', created_at: '2026-05-01T10:00:00Z' },
]

function world({ ownershipTable = true } = {}) {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE config(email TEXT PRIMARY KEY, user_id TEXT, Role TEXT, Systemowner INTEGER,
    emailVerificationToken TEXT, display_name TEXT, data TEXT,
    cf_account_id TEXT, cf_api_token TEXT, cf_rtk_app_id TEXT, cf_rtk_token TEXT, cf_r2_account_id TEXT,
    cf_r2_bucket TEXT, cf_r2_access_key_id TEXT, cf_r2_secret TEXT, cf_r2_public_base TEXT,
    cf_kv_namespace_id TEXT, cf_kv_token TEXT)`)
  const user = d.prepare('INSERT INTO config(email, user_id, Role, emailVerificationToken, data, cf_rtk_app_id, cf_rtk_token) VALUES (?,?,?,?,?,?,?)')
  user.run('alice@example.com', 'u-alice', 'User', 'sess-alice', JSON.stringify({ realtime: { personalMeetingId: 'm-alice-personal' } }), null, null)
  user.run('bob@example.com', 'u-bob', 'Admin', 'sess-bob', '{}', null, null)
  user.run('root@example.com', 'u-root', 'Superadmin', 'sess-root', '{}', null, null)
  user.run('own@example.com', 'u-own', 'User', 'sess-own', '{}', 'own-app', 'own-tok')
  user.run('nobody@example.com', 'u-nobody', 'User', 'sess-nobody', '{}', null, null)
  if (ownershipTable) {
    d.exec('CREATE TABLE meeting_ownership(meeting_id TEXT PRIMARY KEY, owner_email TEXT, room_type TEXT)')
    const own = d.prepare('INSERT INTO meeting_ownership VALUES (?,?,?)')
    own.run('m-alice-adhoc', 'Alice@Example.com', 'adhoc') // case differs on purpose, both columns
    own.run('m-alice-personal', 'alice@example.com', 'personal')
    own.run('m-bob-adhoc', 'bob@example.com', 'adhoc')
  }
  const env = {
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
  return env
}

const asked = []
globalThis.fetch = async (url) => {
  asked.push(String(url))
  return new Response(JSON.stringify({ data: APP_MEETINGS }), { status: 200 })
}

async function list(env, token) {
  const res = await worker.fetch(new Request('https://api.vegvisr.org/realtime/list-meetings', { headers: { 'X-API-Token': token } }), env)
  const body = await res.json()
  return { status: res.status, ids: (body.meetings || []).map((m) => m.id), filtered: body.filteredByOwner }
}

let n = 0
const check = async (name, fn) => { await fn(); n++; console.log(`ok    ${name}`) }
const quiet = console.error
console.error = () => {}

await check('a user sees only their own ad-hoc meetings, not another user\'s and not an ownerless one', async () => {
  const r = await list(world(), 'sess-alice')
  assert.equal(r.status, 200)
  assert.deepEqual(r.ids, ['M-ALICE-ADHOC'])
  assert.equal(r.filtered, true)
})

await check('an Admin is filtered like any other user', async () => {
  const r = await list(world(), 'sess-bob')
  assert.deepEqual(r.ids, ['m-bob-adhoc'])
})

await check('a user who owns nothing sees nothing', async () => {
  const r = await list(world(), 'sess-nobody')
  assert.deepEqual(r.ids, [])
  assert.equal(r.status, 200)
})

await check('a Superadmin sees every meeting in the app', async () => {
  const r = await list(world(), 'sess-root')
  assert.deepEqual(r.ids, APP_MEETINGS.map((m) => m.id))
  assert.equal(r.filtered, false)
})

await check('a user on their own RealtimeKit app sees all of that app, and it is that app that is asked', async () => {
  asked.length = 0
  const r = await list(world(), 'sess-own')
  assert.deepEqual(r.ids, APP_MEETINGS.map((m) => m.id))
  assert.equal(r.filtered, false)
  assert.match(asked[0], /\/realtime\/kit\/own-app\/meetings$/)
})

await check('if ownership cannot be read, nothing is listed (fails closed)', async () => {
  const r = await list(world({ ownershipTable: false }), 'sess-alice')
  assert.equal(r.status, 200)
  assert.deepEqual(r.ids, [])
})

await check('no token is refused', async () => {
  const res = await worker.fetch(new Request('https://api.vegvisr.org/realtime/list-meetings'), world())
  assert.equal(res.status, 401)
})

console.error = quiet
console.log(`\n${n} checks passed`)
