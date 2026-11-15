// Slug writes: slugs/create, slugs/{id}/update, slugs/{id}/share-token.
//
// A slug is a door into a meeting: its allowlist and its share links let people in WITHOUT login,
// with a participant token this worker mints. Two things are pinned here (both 2026-11-15):
//
//  1. OWNERSHIP. create and update used to accept ANY meetingId, so an Admin could put a door on
//     someone else's room. The caller must now own the meeting (personal room, team room, or a
//     meeting_ownership row). No Superadmin exception.
//  2. PARTIAL CALLERS. These endpoints are Agent-Builder chat tools and MCP tools now. allowedEmails
//     replaces the whole list, so "add one person" from a caller that sent only that person locked
//     everyone else out. addEmails / removeEmails change the list in place.
//
// Runs the real worker handler against an in-memory SQLite.
//
// Run:  node test-slugs.mjs
import { DatabaseSync } from 'node:sqlite'
import assert from 'node:assert/strict'
import worker from './index.js'

function world() {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE config(email TEXT PRIMARY KEY, user_id TEXT, Role TEXT, Systemowner INTEGER, emailVerificationToken TEXT, display_name TEXT, data TEXT);
    CREATE TABLE meeting_ownership(meeting_id TEXT PRIMARY KEY, owner_email TEXT, room_type TEXT);
    CREATE TABLE custom_room_slugs (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, meeting_id TEXT NOT NULL, owner_email TEXT NOT NULL,
      allowed_emails JSON NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, active BOOLEAN DEFAULT 1, scheduled_start_at TEXT);
    CREATE TABLE slug_share_tokens (id TEXT PRIMARY KEY, slug_id TEXT NOT NULL, meeting_id TEXT NOT NULL, valid_from TEXT NOT NULL,
      valid_until TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT);`)
  const user = d.prepare('INSERT INTO config(email, user_id, Role, emailVerificationToken, data) VALUES (?,?,?,?,?)')
  user.run('admin@example.com', 'u-admin', 'Admin', 'sess-admin', JSON.stringify({ realtime: { personalMeetingId: 'm-admin-personal' } }))
  user.run('root@example.com', 'u-root', 'Superadmin', 'sess-root', '{}')
  user.run('user@example.com', 'u-user', 'User', 'sess-user', '{}')
  const own = d.prepare('INSERT INTO meeting_ownership VALUES (?,?,?)')
  own.run('m-admin-adhoc', 'Admin@Example.com', 'adhoc')
  own.run('m-other', 'other@example.com', 'personal')
  d.prepare('INSERT INTO custom_room_slugs VALUES (?,?,?,?,?,?,?,1,?)')
    .run('s-1', 'kurs', 'm-admin-adhoc', 'admin@example.com', JSON.stringify(['a@example.com', 'B@example.com']), '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z', null)
  const prep = (sql) => {
    const st = d.prepare(sql)
    const bound = (...v) => ({ first: async () => st.get(...v) ?? null, run: async () => st.run(...v), all: async () => ({ results: st.all(...v) }) })
    return { bind: bound, ...bound() }
  }
  const slug = (id) => { const r = d.prepare('SELECT * FROM custom_room_slugs WHERE id = ?').get(id); return r && { ...r, allowed_emails: JSON.parse(r.allowed_emails) } }
  const count = (t) => d.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n
  return { env: { vegvisr_org: { prepare: prep } }, slug, count }
}

async function post(env, token, path, body) {
  const res = await worker.fetch(new Request(`https://api.vegvisr.org/realtime/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Token': token }, body: JSON.stringify(body),
  }), env)
  return { status: res.status, body: await res.json() }
}

let n = 0
const check = async (name, fn) => { await fn(); n++; console.log(`ok    ${name}`) }
const quiet = console.error
console.error = () => {}

// ── create ───────────────────────────────────────────────────────────────────
await check('an Admin creates a slug on their own ad-hoc meeting and on their personal room', async () => {
  const w = world()
  const a = await post(w.env, 'sess-admin', 'slugs/create', { slug: 'morgen', meetingId: 'm-admin-adhoc', allowedEmails: ['x@example.com'], scheduledStartAt: '2026-12-01T10:00:00+01:00' })
  assert.equal(a.status, 201)
  assert.equal(a.body.url, 'https://realtime.vegvisr.org/morgen')
  assert.equal(a.body.scheduledStartAt, '2026-12-01T09:00:00.000Z')
  assert.equal(w.slug(a.body.slugId).owner_email, 'admin@example.com')
  const b = await post(w.env, 'sess-admin', 'slugs/create', { slug: 'mitt-rom', meetingId: 'm-admin-personal', allowedEmails: ['x@example.com'] })
  assert.equal(b.status, 201)
})

await check('a slug on someone else\'s meeting is refused — for an Admin and for a Superadmin', async () => {
  const w = world()
  for (const token of ['sess-admin', 'sess-root']) {
    const r = await post(w.env, token, 'slugs/create', { slug: 'kapret', meetingId: 'm-other', allowedEmails: ['x@example.com'] })
    assert.equal(r.status, 403, token)
    assert.match(r.body.error, /you own/)
  }
  assert.equal(w.count('custom_room_slugs'), 1)
})

await check('a slug on a meeting nobody is recorded as owning is refused', async () => {
  const w = world()
  assert.equal((await post(w.env, 'sess-admin', 'slugs/create', { slug: 'ukjent', meetingId: 'm-nowhere', allowedEmails: ['x@example.com'] })).status, 403)
})

await check('a plain user cannot create slugs; a taken slug is 409; a bad slug or e-mail is 400', async () => {
  const w = world()
  assert.equal((await post(w.env, 'sess-user', 'slugs/create', { slug: 'abc', meetingId: 'm-admin-adhoc', allowedEmails: ['x@example.com'] })).status, 403)
  assert.equal((await post(w.env, 'sess-admin', 'slugs/create', { slug: 'kurs', meetingId: 'm-admin-adhoc', allowedEmails: ['x@example.com'] })).status, 409)
  assert.equal((await post(w.env, 'sess-admin', 'slugs/create', { slug: 'Not Valid', meetingId: 'm-admin-adhoc', allowedEmails: ['x@example.com'] })).status, 400)
  assert.equal((await post(w.env, 'sess-admin', 'slugs/create', { slug: 'fine', meetingId: 'm-admin-adhoc', allowedEmails: ['not-an-email'] })).status, 400)
})

// ── update ───────────────────────────────────────────────────────────────────
await check('addEmails adds without dropping anyone, and does not add a duplicate in another case', async () => {
  const w = world()
  const r = await post(w.env, 'sess-admin', 'slugs/s-1/update', { addEmails: ['c@example.com', 'b@EXAMPLE.com'] })
  assert.equal(r.status, 200)
  assert.deepEqual(r.body.slug.allowedEmails, ['a@example.com', 'B@example.com', 'c@example.com'])
  assert.deepEqual(w.slug('s-1').allowed_emails, ['a@example.com', 'B@example.com', 'c@example.com'])
})

await check('removeEmails removes one, case-insensitively; removing everyone is refused', async () => {
  const w = world()
  const r = await post(w.env, 'sess-admin', 'slugs/s-1/update', { removeEmails: ['b@example.com'] })
  assert.deepEqual(r.body.slug.allowedEmails, ['a@example.com'])
  const all = await post(w.env, 'sess-admin', 'slugs/s-1/update', { removeEmails: ['a@example.com'] })
  assert.equal(all.status, 400)
  assert.deepEqual(w.slug('s-1').allowed_emails, ['a@example.com'])
})

await check('allowedEmails still replaces the whole list (what the app sends), and cannot be mixed with add/remove', async () => {
  const w = world()
  const r = await post(w.env, 'sess-admin', 'slugs/s-1/update', { allowedEmails: ['only@example.com'] })
  assert.deepEqual(r.body.slug.allowedEmails, ['only@example.com'])
  const mixed = await post(w.env, 'sess-admin', 'slugs/s-1/update', { allowedEmails: ['z@example.com'], addEmails: ['y@example.com'] })
  assert.equal(mixed.status, 400)
  assert.deepEqual(w.slug('s-1').allowed_emails, ['only@example.com'])
})

await check('an invalid address in addEmails is refused and nothing is written', async () => {
  const w = world()
  const r = await post(w.env, 'sess-admin', 'slugs/s-1/update', { addEmails: ['nope'] })
  assert.equal(r.status, 400)
  assert.deepEqual(w.slug('s-1').allowed_emails, ['a@example.com', 'B@example.com'])
})

await check('setting only the meeting time leaves the allowlist alone; null clears the time', async () => {
  const w = world()
  const r = await post(w.env, 'sess-admin', 'slugs/s-1/update', { scheduledStartAt: '2026-12-01T10:00:00Z' })
  assert.equal(r.body.slug.scheduledStartAt, '2026-12-01T10:00:00.000Z')
  assert.deepEqual(r.body.slug.allowedEmails, ['a@example.com', 'B@example.com'])
  const c = await post(w.env, 'sess-admin', 'slugs/s-1/update', { scheduledStartAt: null })
  assert.equal(c.body.slug.scheduledStartAt, null)
})

await check('re-pointing a slug at someone else\'s meeting is refused; at an own room it works', async () => {
  const w = world()
  assert.equal((await post(w.env, 'sess-admin', 'slugs/s-1/update', { meetingId: 'm-other' })).status, 403)
  assert.equal(w.slug('s-1').meeting_id, 'm-admin-adhoc')
  const okR = await post(w.env, 'sess-admin', 'slugs/s-1/update', { meetingId: 'm-admin-personal' })
  assert.equal(okR.body.slug.meetingId, 'm-admin-personal')
})

await check('someone else\'s slug cannot be updated, also not by a Superadmin', async () => {
  const w = world()
  assert.equal((await post(w.env, 'sess-root', 'slugs/s-1/update', { addEmails: ['x@example.com'] })).status, 403)
})

// ── share link ───────────────────────────────────────────────────────────────
await check('a share link needs a meeting time, and is valid one hour either side of it', async () => {
  const w = world()
  const none = await post(w.env, 'sess-admin', 'slugs/s-1/share-token', {})
  assert.equal(none.status, 400)
  assert.match(none.body.error, /meeting time/)
  await post(w.env, 'sess-admin', 'slugs/s-1/update', { scheduledStartAt: '2026-12-01T10:00:00Z' })
  const r = await post(w.env, 'sess-admin', 'slugs/s-1/share-token', {})
  assert.equal(r.status, 201)
  assert.equal(r.body.url, `https://realtime.vegvisr.org/kurs?t=${r.body.token}`)
  assert.deepEqual([r.body.validFrom, r.body.validUntil], ['2026-12-01T09:00:00.000Z', '2026-12-01T11:00:00.000Z'])
  assert.equal(w.count('slug_share_tokens'), 1)
})

await check('a share link for someone else\'s slug is refused', async () => {
  const w = world()
  assert.equal((await post(w.env, 'sess-root', 'slugs/s-1/share-token', {})).status, 403)
  assert.equal(w.count('slug_share_tokens'), 0)
})

console.error = quiet
console.log(`\n${n} checks passed`)
