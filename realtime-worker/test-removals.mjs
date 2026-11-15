// Removals: POST /realtime/removals/preview and /realtime/removals/confirm (decision D3 = B).
//
// Revoking a share link, deleting a slug and closing a meeting take something away. For chat
// tools (Agent-Builder rt_*, MCP realtime_*) they exist only as preview + confirm. Pinned here:
//
//  1. preview changes nothing and says what would happen;
//  2. confirm cannot be reached without a preview: a made-up token, another user's token, an
//     expired token and a token for a target that changed afterwards are all refused;
//  3. confirm goes through the app's own endpoint, so its ownership rules decide;
//  4. the three raw endpoints are NOT in the OpenAPI spec (they would be chat tools with no
//     confirm step).
//
// Runs the real worker handler against an in-memory SQLite and a stubbed RealtimeKit.
//
// Run:  node test-removals.mjs
import { DatabaseSync } from 'node:sqlite'
import assert from 'node:assert/strict'
import worker from './index.js'

const HOUR = 3600 * 1000
const iso = (ms) => new Date(ms).toISOString()

function world() {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE config(email TEXT PRIMARY KEY, user_id TEXT, Role TEXT, Systemowner INTEGER, emailVerificationToken TEXT, display_name TEXT, data TEXT,
      cf_account_id TEXT, cf_api_token TEXT, cf_rtk_app_id TEXT, cf_rtk_token TEXT, cf_r2_account_id TEXT, cf_r2_bucket TEXT, cf_r2_access_key_id TEXT,
      cf_r2_secret TEXT, cf_r2_public_base TEXT, cf_kv_namespace_id TEXT, cf_kv_token TEXT);
    CREATE TABLE meeting_ownership(meeting_id TEXT PRIMARY KEY, owner_email TEXT, room_type TEXT);
    CREATE TABLE realtime_open_rooms(meeting_id TEXT PRIMARY KEY, owner_email TEXT, is_default INTEGER);
    CREATE TABLE custom_room_slugs (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, meeting_id TEXT NOT NULL, owner_email TEXT NOT NULL,
      allowed_emails JSON NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, active BOOLEAN DEFAULT 1, scheduled_start_at TEXT);
    CREATE TABLE slug_share_tokens (id TEXT PRIMARY KEY, slug_id TEXT NOT NULL, meeting_id TEXT NOT NULL, valid_from TEXT NOT NULL,
      valid_until TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT);`)
  const user = d.prepare('INSERT INTO config(email, user_id, Role, emailVerificationToken, data) VALUES (?,?,?,?,?)')
  user.run('admin@example.com', 'u-admin', 'Admin', 'sess-admin', JSON.stringify({ realtime: { personalMeetingId: 'm-admin-personal' } }))
  user.run('other@example.com', 'u-other', 'Admin', 'sess-other', '{}')
  user.run('root@example.com', 'u-root', 'Superadmin', 'sess-root', '{}')
  user.run('user@example.com', 'u-user', 'User', 'sess-user', '{}')
  const own = d.prepare('INSERT INTO meeting_ownership VALUES (?,?,?)')
  own.run('m-admin-adhoc', 'admin@example.com', 'adhoc')
  own.run('m-admin-personal', 'admin@example.com', 'personal')
  own.run('m-other-personal', 'other@example.com', 'personal')
  own.run('m-user-adhoc', 'user@example.com', 'adhoc')
  d.prepare('INSERT INTO realtime_open_rooms VALUES (?,?,?)').run('m-admin-adhoc', 'admin@example.com', 0)
  const slug = d.prepare('INSERT INTO custom_room_slugs VALUES (?,?,?,?,?,?,?,1,?)')
  slug.run('s-1', 'kurs', 'm-admin-adhoc', 'admin@example.com', JSON.stringify(['a@example.com', 'b@example.com']), '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z', null)
  slug.run('s-other', 'andre', 'm-other-personal', 'other@example.com', JSON.stringify(['c@example.com']), '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z', null)
  const tok = d.prepare('INSERT INTO slug_share_tokens VALUES (?,?,?,?,?,?,?,NULL)')
  const now = Date.now()
  tok.run('t-live', 's-1', 'm-admin-adhoc', iso(now - HOUR), iso(now + HOUR), 'admin@example.com', iso(now))
  tok.run('t-old', 's-1', 'm-admin-adhoc', iso(now - 9 * HOUR), iso(now - 7 * HOUR), 'admin@example.com', iso(now))
  tok.run('t-other', 's-other', 'm-other-personal', iso(now - HOUR), iso(now + HOUR), 'other@example.com', iso(now))
  const prep = (sql) => {
    const st = d.prepare(sql)
    const bound = (...v) => ({ first: async () => st.get(...v) ?? null, run: async () => st.run(...v), all: async () => ({ results: st.all(...v) }) })
    return { bind: bound, ...bound() }
  }
  return {
    env: { CF_ACCOUNT_ID: 'acc', REALTIMEKIT_APP_ID: 'shared-app', REALTIMEKIT_API_TOKEN: 'tok', vegvisr_org: { prepare: prep } },
    d,
    row: (t, id) => d.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(id),
  }
}

// RealtimeKit: every meeting is ACTIVE with a title until it is PATCHed INACTIVE.
const kit = { closed: new Set(), calls: [] }
globalThis.fetch = async (url, init = {}) => {
  const id = String(url).split('/meetings/')[1]
  kit.calls.push(`${init.method || 'GET'} ${id}`)
  if (id === 'm-gone') return new Response('{}', { status: 404 })
  if (init.method === 'PATCH') { kit.closed.add(id); return new Response(JSON.stringify({ success: true }), { status: 200 }) }
  return new Response(JSON.stringify({ success: true, data: { id, title: 'Planlegging', status: kit.closed.has(id) ? 'INACTIVE' : 'ACTIVE' } }), { status: 200 })
}

async function call(env, token, path, body, method = 'POST') {
  const res = await worker.fetch(new Request(`https://api.vegvisr.org/realtime/${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { 'X-API-Token': token } : {}) },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  }), env)
  return { status: res.status, body: await res.json() }
}
const preview = (env, token, action, id) => call(env, token, 'removals/preview', { action, id })
const confirm = (env, token, confirmToken) => call(env, token, 'removals/confirm', { confirmToken })

let n = 0
const check = async (name, fn) => { kit.closed.clear(); kit.calls.length = 0; await fn(); n++; console.log(`ok    ${name}`) }
const quiet = console.error
console.error = () => {}

// ── share link ───────────────────────────────────────────────────────────────
await check('share link: preview changes nothing and says what happens; confirm revokes it', async () => {
  const w = world()
  const p = await preview(w.env, 'sess-admin', 'revoke_share_link', 't-live')
  assert.equal(p.status, 200)
  assert.equal(p.body.nothingChanged, true)
  assert.match(p.body.summary, /realtime\.vegvisr\.org\/kurs/)
  assert.match(p.body.summary, /VALID RIGHT NOW/)
  assert.ok(p.body.effects.length >= 3)
  assert.equal(w.row('slug_share_tokens', 't-live').revoked_at, null)
  const c = await confirm(w.env, 'sess-admin', p.body.confirmToken)
  assert.equal(c.status, 200)
  assert.match(c.body.done, /revoked/)
  assert.ok(w.row('slug_share_tokens', 't-live').revoked_at)
  assert.equal(w.row('slug_share_tokens', 't-old').revoked_at, null)
})

await check('share link: the whole link works as id; an expired link says so', async () => {
  const w = world()
  const p = await preview(w.env, 'sess-admin', 'revoke_share_link', 'https://realtime.vegvisr.org/kurs?t=t-old')
  assert.equal(p.status, 200)
  assert.equal(p.body.targetId, 't-old')
  assert.match(p.body.summary, /expired already/)
})

await check('share link: someone else\'s is refused at preview, also for a Superadmin; a User has no slugs', async () => {
  const w = world()
  assert.equal((await preview(w.env, 'sess-admin', 'revoke_share_link', 't-other')).status, 403)
  assert.equal((await preview(w.env, 'sess-root', 'revoke_share_link', 't-other')).status, 403)
  assert.equal((await preview(w.env, 'sess-user', 'revoke_share_link', 't-live')).status, 403)
  assert.equal((await preview(w.env, 'sess-admin', 'revoke_share_link', 't-nope')).status, 404)
})

await check('the same confirmToken a second time is refused: it is already revoked', async () => {
  const w = world()
  const p = await preview(w.env, 'sess-admin', 'revoke_share_link', 't-live')
  assert.equal((await confirm(w.env, 'sess-admin', p.body.confirmToken)).status, 200)
  const again = await confirm(w.env, 'sess-admin', p.body.confirmToken)
  assert.equal(again.status, 409)
  assert.match(again.body.error, /already revoked/)
  assert.equal((await preview(w.env, 'sess-admin', 'revoke_share_link', 't-live')).status, 409)
})

// ── slug ─────────────────────────────────────────────────────────────────────
await check('slug: the preview names everyone who loses access, the live share links and the lost name', async () => {
  const w = world()
  const p = await preview(w.env, 'sess-admin', 'delete_slug', 's-1')
  assert.equal(p.status, 200)
  const text = p.body.effects.join('\n')
  assert.match(text, /a@example\.com, b@example\.com/)
  assert.match(text, /1 share link not yet expired stops working too/)
  assert.match(text, /"kurs" can never be used again/)
  assert.equal(p.body.details.liveShareLinks, 1)
  assert.equal(w.row('custom_room_slugs', 's-1').active, 1)
  const c = await confirm(w.env, 'sess-admin', p.body.confirmToken)
  assert.equal(c.status, 200)
  assert.equal(w.row('custom_room_slugs', 's-1').active, 0)
  assert.equal(w.row('custom_room_slugs', 's-other').active, 1)
  assert.equal((await preview(w.env, 'sess-admin', 'delete_slug', 's-1')).status, 409)
})

await check('slug: if the list changed after the preview, confirm refuses and nothing is deleted', async () => {
  const w = world()
  const p = await preview(w.env, 'sess-admin', 'delete_slug', 's-1')
  const u = await call(w.env, 'sess-admin', 'slugs/s-1/update', { addEmails: ['new@example.com'] })
  assert.equal(u.status, 200)
  const c = await confirm(w.env, 'sess-admin', p.body.confirmToken)
  assert.equal(c.status, 409)
  assert.match(c.body.error, /changed since the preview/)
  assert.equal(w.row('custom_room_slugs', 's-1').active, 1)
})

await check('slug: someone else\'s is refused', async () => {
  const w = world()
  assert.equal((await preview(w.env, 'sess-admin', 'delete_slug', 's-other')).status, 403)
  assert.equal((await preview(w.env, 'sess-root', 'delete_slug', 's-other')).status, 403)
})

// ── meeting ──────────────────────────────────────────────────────────────────
await check('meeting: the preview lists the slugs and the open room that die with it; confirm closes it', async () => {
  const w = world()
  const p = await preview(w.env, 'sess-admin', 'close_meeting', 'm-admin-adhoc')
  assert.equal(p.status, 200)
  assert.match(p.body.summary, /"Planlegging"/)
  const text = p.body.effects.join('\n')
  assert.match(text, /realtime\.vegvisr\.org\/kurs/)
  assert.match(text, /open room/)
  assert.doesNotMatch(text, /WARNING/)
  assert.deepEqual(kit.calls, ['GET m-admin-adhoc'])
  const c = await confirm(w.env, 'sess-admin', p.body.confirmToken)
  assert.equal(c.status, 200)
  assert.ok(kit.closed.has('m-admin-adhoc'))
  assert.equal((await preview(w.env, 'sess-admin', 'close_meeting', 'm-admin-adhoc')).status, 409)
})

await check('meeting: a slug put on it after the preview voids the preview', async () => {
  const w = world()
  const p = await preview(w.env, 'sess-admin', 'close_meeting', 'm-admin-adhoc')
  const s = await call(w.env, 'sess-admin', 'slugs/create', { slug: 'ny-dor', meetingId: 'm-admin-adhoc', allowedEmails: ['x@example.com'] })
  assert.equal(s.status, 201)
  const c = await confirm(w.env, 'sess-admin', p.body.confirmToken)
  assert.equal(c.status, 409)
  assert.ok(!kit.closed.has('m-admin-adhoc'))
})

await check('meeting: own permanent room, another user\'s meeting and a missing meeting are refused at preview', async () => {
  const w = world()
  const own = await preview(w.env, 'sess-admin', 'close_meeting', 'm-admin-personal')
  assert.equal(own.status, 403)
  assert.match(own.body.error, /permanent room/)
  assert.equal((await preview(w.env, 'sess-admin', 'close_meeting', 'm-user-adhoc')).status, 403)
  assert.equal((await preview(w.env, 'sess-root', 'close_meeting', 'm-gone')).status, 404)
  assert.equal(kit.calls.filter((c) => c.startsWith('PATCH')).length, 0)
})

await check('meeting: a Superadmin closing another user\'s permanent room is warned in the preview', async () => {
  const w = world()
  const p = await preview(w.env, 'sess-root', 'close_meeting', 'm-other-personal')
  assert.equal(p.status, 200)
  assert.match(p.body.effects[0], /WARNING: this meeting belongs to other@example\.com.*permanent personal room/)
})

// ── the confirm step cannot be skipped ───────────────────────────────────────
await check('confirm refuses: no token, a made-up token, a token altered to another target', async () => {
  const w = world()
  assert.equal((await confirm(w.env, 'sess-admin', '')).status, 400)
  assert.equal((await confirm(w.env, 'sess-admin', 'abc.def')).status, 403)
  const p = await preview(w.env, 'sess-admin', 'revoke_share_link', 't-old')
  const [, sig] = p.body.confirmToken.split('.')
  const forged = Buffer.from(JSON.stringify({ a: 'delete_slug', id: 's-1', e: 'admin@example.com', x: Date.now() + 60000, s: 'x' })).toString('base64url')
  assert.equal((await confirm(w.env, 'sess-admin', `${forged}.${sig}`)).status, 403)
  assert.equal(w.row('custom_room_slugs', 's-1').active, 1)
})

await check('confirm refuses a token that was issued to another account', async () => {
  const w = world()
  const p = await preview(w.env, 'sess-admin', 'delete_slug', 's-1')
  const c = await confirm(w.env, 'sess-other', p.body.confirmToken)
  assert.equal(c.status, 403)
  assert.equal(w.row('custom_room_slugs', 's-1').active, 1)
})

await check('confirm refuses a preview older than 10 minutes', async () => {
  const w = world()
  const p = await preview(w.env, 'sess-admin', 'delete_slug', 's-1')
  const realNow = Date.now
  Date.now = () => realNow() + 11 * 60 * 1000
  try {
    const c = await confirm(w.env, 'sess-admin', p.body.confirmToken)
    assert.equal(c.status, 410)
    assert.match(c.body.error, /expired/)
  } finally { Date.now = realNow }
  assert.equal(w.row('custom_room_slugs', 's-1').active, 1)
})

await check('preview refuses: no session, an unknown action, a missing id', async () => {
  const w = world()
  assert.equal((await preview(w.env, null, 'delete_slug', 's-1')).status, 401)
  assert.equal((await preview(w.env, 'sess-admin', 'delete_everything', 's-1')).status, 400)
  assert.equal((await preview(w.env, 'sess-admin', 'delete_slug', '')).status, 400)
})

// ── the tool surface ─────────────────────────────────────────────────────────
await check('the raw removal endpoints are not in the OpenAPI spec; the share-link list is', async () => {
  const spec = (await call({}, null, 'openapi.json', null, 'GET')).body
  const ops = Object.entries(spec.paths).flatMap(([path, m]) => Object.keys(m).map((method) => `${method.toUpperCase()} ${path}`))
  assert.ok(!ops.some((o) => o.startsWith('DELETE ')), 'no DELETE operation may be published')
  assert.ok(!ops.includes('POST /realtime/close-meeting'))
  assert.ok(ops.includes('POST /realtime/removals/preview'))
  assert.ok(ops.includes('POST /realtime/removals/confirm'))
  assert.ok(ops.includes('GET /realtime/slugs/{slugId}/share-tokens'))
})

await check('the share-link list gives the id that the preview takes', async () => {
  const w = world()
  const l = await call(w.env, 'sess-admin', 'slugs/s-1/share-tokens', null, 'GET')
  assert.equal(l.status, 200)
  assert.deepEqual(l.body.tokens.map((t) => t.id).sort(), ['t-live', 't-old'])
  assert.equal((await call(w.env, 'sess-admin', 'slugs/s-other/share-tokens', null, 'GET')).status, 403)
})

console.error = quiet
console.log(`\n${n} checks passed`)
