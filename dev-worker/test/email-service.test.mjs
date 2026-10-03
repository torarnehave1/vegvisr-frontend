// email-service.js — the gate that decides who may send e-mail as whom.
//
// What is actually being pinned here is one sentence: being a platform Superadmin grants nothing.
// Everything downstream of this module trusts it. email-worker's requireOwnership compares the
// identity WE supply against the sender WE name (email-worker/index.js:132-142), so for calls
// coming from here it is a tautology — the only real check is resolveSenderAccess, and it is
// unreviewed by anything else in the system.
//
// The signature of a correct refusal is that nothing was written and nothing left: for the grant
// writes, `rows()` is unchanged; for a send, `worker.calls.length === 0` (stage 4).
//
// Run:  node --test test/email-service.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedSenders, seedGrants } from './d1-adapter.mjs'
import * as gs from '../graph-service.js'
import * as email from '../email-service.js'

const actorFor = (address, role = 'User') =>
  gs.normalizeActor({
    valid: true,
    userId: `u-${address.split('@')[0]}`,
    userEmail: address,
    userRole: role,
    scopes: ['chat:write'],
  })

const NIBI = 'post@nibi.no'
const VEGR = 'post@vegr.ai'

/**
 * The live system, in miniature:
 *   torarne  holds post@vegr.ai                  → own-profile
 *   nibi     holds post@nibi.no, and nobody else → needs a grant
 *   carol    holds nothing                       → the plain-user control
 * `boss` is a Superadmin holding nothing, which is the whole point of the file.
 */
function world(grants = []) {
  const { env, raw } = freshDb()
  seedSenders(raw, 'torarne@example.com', [{ email: VEGR, name: 'VEGR.AI', verified: true }])
  seedSenders(raw, NIBI, [{ email: NIBI, name: 'NIBI', verified: true }], { role: 'Admin' })
  seedSenders(raw, 'carol@example.com', [])
  seedSenders(raw, 'boss@example.com', [], { role: 'Superadmin' })
  seedGrants(raw, grants)
  return { env, raw, rows: () => raw.prepare('SELECT * FROM email_sender_grants').all() }
}

const liveGrantRow = (over = {}) => ({
  id: 'g-live',
  sender_email: NIBI,
  holder_email: NIBI,
  grantee_email: 'torarne@example.com',
  granted_by: NIBI,
  ...over,
})

// ── The gate ────────────────────────────────────────────────────────────────

test('an address on your own profile needs no grant, and the grant table is not consulted', async () => {
  const { env } = world()
  const r = await email.resolveSenderAccess(env, { fromEmail: VEGR, actor: actorFor('torarne@example.com') })
  assert.equal(r.ok, true)
  assert.equal(r.basis, 'own-profile')
  assert.equal(r.holderEmail, 'torarne@example.com')
  assert.equal(r.grantId, null)
})

test('an address you do not hold, with no grant, is refused', async () => {
  const { env } = world()
  const r = await email.resolveSenderAccess(env, { fromEmail: NIBI, actor: actorFor('torarne@example.com') })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
})

// THE TEST THIS FILE EXISTS FOR.
//
// A refusal that varies with role is a bypass nobody has written down yet. Comparing the whole
// message, not just the code, is deliberate: if someone later adds "(you could override this as
// Superadmin)" to the text, the capability has changed even though the code has not.
test('a Superadmin with no grant is refused identically to a plain user', async () => {
  const { env } = world()
  const asBoss = await email.resolveSenderAccess(env, { fromEmail: NIBI, actor: actorFor('boss@example.com', 'Superadmin') })
  const asCarol = await email.resolveSenderAccess(env, { fromEmail: NIBI, actor: actorFor('carol@example.com') })

  assert.equal(asBoss.ok, false)
  assert.equal(asBoss.code, asCarol.code)
  assert.equal(asBoss.message, asCarol.message, 'the refusal must not vary with the caller role')
  assert.match(asBoss.message, /Superadmin grants nothing here/)
})

test('a live grant lets a non-holder send, and names the HOLDER as the identity to use', async () => {
  const { env } = world([liveGrantRow()])
  const r = await email.resolveSenderAccess(env, { fromEmail: NIBI, actor: actorFor('torarne@example.com') })
  assert.equal(r.ok, true)
  assert.equal(r.basis, 'grant')
  assert.equal(r.grantId, 'g-live')
  // The outgoing call authenticates as the holder, never as the caller. Stage 4 depends on this.
  assert.equal(r.holderEmail, NIBI)
  assert.equal(r.account.accountType, 'cf-email-service')
})

test('a revoked grant is refused', async () => {
  const { env } = world([liveGrantRow({ revoked_at: '2026-10-02T12:00:00.000Z', revoked_by: NIBI })])
  const r = await email.resolveSenderAccess(env, { fromEmail: NIBI, actor: actorFor('torarne@example.com') })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
})

test('an expired grant is refused, and the message names the date', async () => {
  const { env } = world([liveGrantRow({ expires_at: '2026-09-01T00:00:00.000Z' })])
  const r = await email.resolveSenderAccess(env, { fromEmail: NIBI, actor: actorFor('torarne@example.com') })
  assert.equal(r.ok, false)
  assert.match(r.message, /expired on 2026-09-01/)
})

// A grant is a claim about the past. The holder can remove the address, change its type, or lose
// the credential afterwards, and the row says nothing about any of that.
test('a grant whose holder no longer holds the address is refused as stale', async () => {
  const { env, raw } = world([liveGrantRow()])
  seedSenders(raw, NIBI, [], { role: 'Admin' }) // NIBI removed the account
  const r = await email.resolveSenderAccess(env, { fromEmail: NIBI, actor: actorFor('torarne@example.com') })
  assert.equal(r.ok, false)
  assert.match(r.message, /stale/)
})

test('a grant whose account lost its credential is refused as stale', async () => {
  const { env, raw } = world([liveGrantRow()])
  seedSenders(raw, NIBI, [{ email: NIBI, hasCredential: false }], { role: 'Admin' })
  const r = await email.resolveSenderAccess(env, { fromEmail: NIBI, actor: actorFor('torarne@example.com') })
  assert.equal(r.ok, false)
  assert.match(r.message, /no credential is stored/)
})

// Not arbitrary: email-worker's gmail route has no ownership check at all and the worker is
// public, so delegating through it would hand out something already reachable without us.
test('only cf-email-service accounts can be used', async () => {
  const { env, raw } = world()
  seedSenders(raw, 'torarne@example.com', [{ email: 'me@gmail.com', accountType: 'gmail' }])
  const r = await email.resolveSenderAccess(env, { fromEmail: 'me@gmail.com', actor: actorFor('torarne@example.com') })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.INVALID_INPUT)
})

test('an unauthenticated or e-mail-less actor is refused before any lookup', async () => {
  const { env } = world()
  assert.equal((await email.resolveSenderAccess(env, { fromEmail: VEGR, actor: null })).code, gs.ERR.UNAUTHENTICATED)
  const noEmail = gs.normalizeActor({ valid: true, userId: 'u-x', userEmail: null, userRole: 'User', scopes: [] })
  assert.equal((await email.resolveSenderAccess(env, { fromEmail: VEGR, actor: noEmail })).code, gs.ERR.FORBIDDEN_GRAPH)
})

test('a malformed fromEmail is INVALID_INPUT, not a forbidden', async () => {
  const { env } = world()
  const r = await email.resolveSenderAccess(env, { fromEmail: 'not-an-address', actor: actorFor('torarne@example.com') })
  assert.equal(r.code, gs.ERR.INVALID_INPUT)
})

// ── Listing ─────────────────────────────────────────────────────────────────

test('the sender list gives both bases, and never a credential or an account id', async () => {
  const { env } = world([liveGrantRow({ note: 'for the autumn newsletter' })])
  const r = await email.listSendableSenders(env, { actor: actorFor('torarne@example.com') })
  assert.equal(r.ok, true)
  assert.equal(r.count, 2)

  const own = r.senders.find((s) => s.email === VEGR)
  const granted = r.senders.find((s) => s.email === NIBI)
  assert.equal(own.basis, 'own-profile')
  assert.equal(granted.basis, 'grant')
  assert.equal(granted.grantedBy, NIBI)
  assert.equal(granted.note, 'for the autumn newsletter')

  // An accountId is what /send-gmail-email needs to impersonate a sender with no ownership check.
  // It must not be reachable from a model's context.
  const serialized = JSON.stringify(r)
  for (const leak of ['acct-', 'CREDENTIAL', 'cfAccountId', 'accountId', '5c34c130']) {
    assert.equal(serialized.includes(leak), false, `sender list leaked ${leak}`)
  }
})

test('a Superadmin sees only their own addresses, not everybody else’s', async () => {
  const { env } = world([liveGrantRow()])
  const r = await email.listSendableSenders(env, { actor: actorFor('boss@example.com', 'Superadmin') })
  assert.equal(r.ok, true)
  assert.equal(r.count, 0)
})

test('an expired grant does not appear in the list', async () => {
  const { env } = world([liveGrantRow({ expires_at: '2026-09-01T00:00:00.000Z' })])
  const r = await email.listSendableSenders(env, { actor: actorFor('torarne@example.com') })
  assert.equal(r.senders.some((s) => s.email === NIBI), false)
})

// ── Granting ────────────────────────────────────────────────────────────────

test('the holder can grant, and the row records who actually created it', async () => {
  const { env, rows } = world()
  const r = await email.createSenderGrant(env, {
    senderEmail: NIBI,
    granteeEmail: 'torarne@example.com',
    note: 'systemeier',
    actor: actorFor(NIBI, 'Admin'),
  })
  assert.equal(r.ok, true)
  assert.equal(r.alreadyGranted, false)
  assert.equal(r.holderEmail, NIBI)
  assert.equal(r.grantedBy, NIBI)
  assert.equal(rows().length, 1)
})

test('a non-holder cannot grant — and neither can a Superadmin', async () => {
  const { env, rows } = world()
  const byStranger = await email.createSenderGrant(env, {
    senderEmail: NIBI, granteeEmail: 'carol@example.com', actor: actorFor('torarne@example.com'),
  })
  assert.equal(byStranger.ok, false)
  assert.equal(byStranger.code, gs.ERR.FORBIDDEN_GRAPH)

  const byBoss = await email.createSenderGrant(env, {
    senderEmail: NIBI, granteeEmail: 'carol@example.com', actor: actorFor('boss@example.com', 'Superadmin'),
  })
  assert.equal(byBoss.ok, false)
  assert.equal(byBoss.message, byStranger.message, 'creating a grant must not vary with role either')
  assert.equal(rows().length, 0, 'nothing was written')
})

test('an unregistered grantee is refused before the row is written', async () => {
  const { env, rows } = world()
  const r = await email.createSenderGrant(env, {
    senderEmail: NIBI, granteeEmail: 'ghost@example.com', actor: actorFor(NIBI, 'Admin'),
  })
  assert.equal(r.code, gs.ERR.GRAPH_NOT_FOUND)
  assert.equal(rows().length, 0)
})

test('granting twice is not an error', async () => {
  const { env, rows } = world([liveGrantRow()])
  const r = await email.createSenderGrant(env, {
    senderEmail: NIBI, granteeEmail: 'torarne@example.com', actor: actorFor(NIBI, 'Admin'),
  })
  assert.equal(r.ok, true)
  assert.equal(r.alreadyGranted, true)
  assert.equal(r.grantId, 'g-live')
  assert.equal(rows().length, 1, 'no duplicate row')
})

test('expiresInDays is honoured and the grant resolves until it lapses', async () => {
  const { env } = world()
  const r = await email.createSenderGrant(env, {
    senderEmail: NIBI, granteeEmail: 'torarne@example.com', expiresInDays: 30, actor: actorFor(NIBI, 'Admin'),
  })
  assert.ok(new Date(r.expiresAt) > new Date())
  const access = await email.resolveSenderAccess(env, { fromEmail: NIBI, actor: actorFor('torarne@example.com') })
  assert.equal(access.ok, true)
})

// ── Revoking ────────────────────────────────────────────────────────────────

test('revoking is an UPDATE: the capability goes, the row stays', async () => {
  const { env, rows } = world([liveGrantRow()])
  const r = await email.revokeSenderGrant(env, { grantId: 'g-live', actor: actorFor(NIBI, 'Admin') })
  assert.equal(r.ok, true)

  assert.equal(rows().length, 1, 'the history must survive a revocation')
  assert.ok(rows()[0].revoked_at)
  assert.equal(rows()[0].revoked_by, NIBI)

  const access = await email.resolveSenderAccess(env, { fromEmail: NIBI, actor: actorFor('torarne@example.com') })
  assert.equal(access.ok, false)
})

test('the grantee may give up their own grant', async () => {
  const { env } = world([liveGrantRow()])
  const r = await email.revokeSenderGrant(env, { grantId: 'g-live', actor: actorFor('torarne@example.com') })
  assert.equal(r.ok, true)
})

// Deliberate asymmetry with createSenderGrant, and worth stating: revocation only ever REMOVES
// capability, so it can never become a bypass. Creation is where Superadmin counts for nothing.
test('a Superadmin may revoke, though they may not create', async () => {
  const { env } = world([liveGrantRow()])
  const r = await email.revokeSenderGrant(env, { grantId: 'g-live', actor: actorFor('boss@example.com', 'Superadmin') })
  assert.equal(r.ok, true)
})

test('an unrelated person may not revoke', async () => {
  const { env, rows } = world([liveGrantRow()])
  const r = await email.revokeSenderGrant(env, { grantId: 'g-live', actor: actorFor('carol@example.com') })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.equal(rows()[0].revoked_at, null)
})

test('revoking twice says so rather than failing', async () => {
  const { env } = world([liveGrantRow({ revoked_at: '2026-10-02T12:00:00.000Z', revoked_by: NIBI })])
  const r = await email.revokeSenderGrant(env, { grantId: 'g-live', actor: actorFor(NIBI, 'Admin') })
  assert.equal(r.ok, true)
  assert.equal(r.alreadyRevoked, true)
})

test('an unknown grant id is a 404', async () => {
  const { env } = world()
  const r = await email.revokeSenderGrant(env, { grantId: 'nope', actor: actorFor(NIBI, 'Admin') })
  assert.equal(r.code, gs.ERR.GRAPH_NOT_FOUND)
})

// ── Listing grants ──────────────────────────────────────────────────────────

test('each party sees the grant, and is told which side of it they are on', async () => {
  const { env } = world([liveGrantRow()])
  const asHolder = await email.listSenderGrants(env, { actor: actorFor(NIBI, 'Admin') })
  const asGrantee = await email.listSenderGrants(env, { actor: actorFor('torarne@example.com') })
  const asOutsider = await email.listSenderGrants(env, { actor: actorFor('carol@example.com') })

  assert.equal(asHolder.grants[0].yourRole, 'holder')
  assert.equal(asGrantee.grants[0].yourRole, 'grantee')
  assert.equal(asHolder.grants[0].live, true)
  assert.equal(asOutsider.count, 0, 'a grant between other people is nobody else’s business')
})

test('a revoked grant is hidden by default and visible on request', async () => {
  const { env } = world([liveGrantRow({ revoked_at: '2026-10-02T12:00:00.000Z' })])
  assert.equal((await email.listSenderGrants(env, { actor: actorFor(NIBI, 'Admin') })).count, 0)
  const all = await email.listSenderGrants(env, { actor: actorFor(NIBI, 'Admin'), includeRevoked: true })
  assert.equal(all.count, 1)
  assert.equal(all.grants[0].live, false)
})
