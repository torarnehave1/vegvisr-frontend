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
import { freshDb, seedSenders, seedGrants, seedEmailGraph, RecordingEmailWorker } from './d1-adapter.mjs'
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

// ── Composing ───────────────────────────────────────────────────────────────
//
// renderEmail is the whole of a preview and the first half of a send, which is deliberate: a
// preview nobody can trust is worse than no preview, so the two cannot be allowed to diverge.

const TEMPLATE = [
  '<div>',
  '  <!-- edit:heading:start --><h2 style="color:{brandAccent}">Hei {name}</h2><!-- edit:heading:end -->',
  '  <p>{message}</p>',
  '  <!-- edit:signature:start --><!-- edit:signature:end -->',
  '  <!-- edit:footer:start --><p>{brandFooter}</p><!-- edit:footer:end -->',
  '</div>',
].join('\n')

function worldWithGraph(grants = [], graph = {}) {
  const { env, raw } = freshDb()
  seedSenders(raw, 'torarne@example.com', [{ email: VEGR, name: 'VEGR.AI', verified: true }])
  seedSenders(raw, NIBI, [{ email: NIBI, name: 'NIBI', verified: true }], { role: 'Admin' })
  seedSenders(raw, 'boss@example.com', [], { role: 'Superadmin' })
  seedGrants(raw, grants)
  seedEmailGraph(raw, 'nibi.no', {
    brand: { name: 'NIBI', accent: '#1f3a5f', footer: 'NIBI · nibi.no', fromName: 'NIBI' },
    templates: [{ purpose: 'nyhetsbrev', language: 'no', subject: 'Nytt fra {brandName}', info: TEMPLATE }],
    signatures: [
      { name: 'tor-arne', language: 'no', isDefault: true, info: '<!-- edit:signature:start --><p>Tor Arne Håve</p><!-- edit:signature:end -->' },
      { name: 'drift', info: '<p>Drift</p>' },
    ],
    ...graph,
  })
  return { env, raw }
}

const asHolder = () => actorFor(NIBI, 'Admin')

test('a template, its brand and the default signature compose into one email', async () => {
  const { env } = worldWithGraph()
  const r = await email.renderEmail(env, {
    fromEmail: NIBI, toEmail: 'someone@example.com', templatePurpose: 'nyhetsbrev',
    variables: { name: 'Inger', message: 'Hei igjen' }, actor: asHolder(),
  })
  assert.equal(r.ok, true)
  assert.equal(r.sent, false, 'rendering must never claim to have sent')
  assert.equal(r.subject, 'Nytt fra NIBI')
  assert.match(r.html, /Hei Inger/)
  assert.match(r.html, /Tor Arne Håve/)
  assert.match(r.html, /NIBI · nibi\.no/)
  assert.equal(r.signatureName, 'tor-arne')
  assert.equal(r.templateSource, 'world-template:nyhetsbrev/no')
  assert.deepEqual(r.unresolvedPlaceholders, [])
  assert.equal(r.html.includes('<!-- edit:'), false, 'authoring markers never reach a recipient')
})

// The divergence from email-worker's renderTemplate, which does none of this. On the login path
// the only substituted value is a link the worker generated; here every value came from a model.
test('variable values are escaped, and bodyHtml is not', async () => {
  const { env } = worldWithGraph()
  const r = await email.renderEmail(env, {
    fromEmail: NIBI, subject: 'Hei', bodyHtml: '<p><b>bold</b> {note}</p>',
    variables: { note: '<script>alert(1)</script>' }, actor: asHolder(),
  })
  assert.equal(r.ok, true)
  assert.match(r.html, /<b>bold<\/b>/, 'bodyHtml is declared markup and stays markup')
  assert.equal(r.html.includes('<script>'), false, 'a model-supplied value must not become markup')
  assert.match(r.html, /&lt;script&gt;/)
})

test('renderTemplate fills both brace styles, repeats, and leaves unknown keys alone', () => {
  const out = email.renderTemplate(
    { subject: '{a} and {{a}}', body: '{a}-{a} {{b}} {c}' },
    { a: 'X', b: 'Y' },
  )
  assert.equal(out.subject, 'X and X')
  assert.equal(out.body, 'X-X Y {c}')
})

test('an unfilled placeholder is reported, named, and found in the subject too', async () => {
  const { env } = worldWithGraph()
  const r = await email.renderEmail(env, {
    fromEmail: NIBI, templatePurpose: 'nyhetsbrev', variables: { name: 'Inger' }, actor: asHolder(),
  })
  assert.equal(r.ok, true)
  assert.deepEqual(r.unresolvedPlaceholders, ['message'])
})

test('a named signature is matched exactly, and a miss lists what exists', async () => {
  const { env } = worldWithGraph()
  const hit = await email.renderEmail(env, {
    fromEmail: NIBI, templatePurpose: 'nyhetsbrev', signature: 'drift',
    variables: { name: 'x', message: 'y' }, actor: asHolder(),
  })
  assert.equal(hit.signatureName, 'drift')

  // Never fuzzy. suggestNodeType guesses a near miss because the cost there is a badly-typed
  // node; here the cost is the wrong person's name at the bottom of somebody's email.
  const miss = await email.renderEmail(env, {
    fromEmail: NIBI, templatePurpose: 'nyhetsbrev', signature: 'tor-arn',
    variables: { name: 'x', message: 'y' }, actor: asHolder(),
  })
  assert.equal(miss.ok, false)
  assert.equal(miss.code, gs.ERR.GRAPH_NOT_FOUND)
  assert.match(miss.message, /drift/)
  assert.match(miss.message, /tor-arne/)
})

test('"none" appends nothing and is not an error', async () => {
  const { env } = worldWithGraph()
  const r = await email.renderEmail(env, {
    fromEmail: NIBI, templatePurpose: 'nyhetsbrev', signature: 'none',
    variables: { name: 'x', message: 'y' }, actor: asHolder(),
  })
  assert.equal(r.ok, true)
  assert.equal(r.signatureName, null)
  assert.equal(r.html.includes('Tor Arne'), false)
})

// A composition the template author did not design is exactly what a preview exists to surface.
test('a template with no signature slot warns about where the signature went', async () => {
  const { env, raw } = freshDb()
  seedSenders(raw, NIBI, [{ email: NIBI }], { role: 'Admin' })
  seedGrants(raw)
  seedEmailGraph(raw, 'nibi.no', {
    brand: { name: 'NIBI' },
    templates: [{ purpose: 'kort', language: 'no', subject: 'Hei', info: '<div><p>Tekst</p><!-- edit:footer:start --><p>f</p><!-- edit:footer:end --></div>' }],
    signatures: [{ name: 'x', isDefault: true, info: '<p>SIG</p>' }],
  })
  const r = await email.renderEmail(env, { fromEmail: NIBI, templatePurpose: 'kort', actor: asHolder() })
  assert.equal(r.ok, true)
  assert.match(r.warnings.join(' '), /no signature slot/)
  assert.ok(r.html.indexOf('SIG') < r.html.indexOf('<p>f</p>'), 'the signature sits above the footer')
})

test('a World with no default signature says so rather than failing', async () => {
  const { env, raw } = freshDb()
  seedSenders(raw, NIBI, [{ email: NIBI }], { role: 'Admin' })
  seedGrants(raw)
  seedEmailGraph(raw, 'nibi.no', {
    brand: { name: 'NIBI' },
    templates: [{ purpose: 'kort', language: 'no', subject: 'Hei', info: '<p>Tekst</p>' }],
    signatures: [{ name: 'x', info: '<p>SIG</p>' }],
  })
  const r = await email.renderEmail(env, { fromEmail: NIBI, templatePurpose: 'kort', actor: asHolder() })
  assert.equal(r.ok, true)
  assert.equal(r.signatureName, null)
  assert.match(r.warnings.join(' '), /no default email signature/)
})

// email-worker's loadWorldEmailNodes takes results[0] from a summaries query and cannot tell one
// match from three, so two graphs for one World would resolve by row order. Reading D1 directly
// buys the ability to refuse, for free.
test('two graphs tagged for the same World is a refusal, not a coin toss', async () => {
  const { env, raw } = worldWithGraph()
  seedEmailGraph(raw, 'nibi.no', { id: 'g-duplicate', brand: { name: 'Other' }, templates: [] })
  const r = await email.renderEmail(env, { fromEmail: NIBI, templatePurpose: 'nyhetsbrev', actor: asHolder() })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.INVALID_INPUT)
  assert.match(r.message, /g-duplicate/)
})

test('a World with no email graph can still be written to directly', async () => {
  const { env } = worldWithGraph()
  const withTemplate = await email.renderEmail(env, {
    fromEmail: VEGR, templatePurpose: 'login', actor: actorFor('torarne@example.com'),
  })
  assert.equal(withTemplate.ok, false)
  assert.equal(withTemplate.code, gs.ERR.GRAPH_NOT_FOUND)
  assert.match(withTemplate.message, /set_world_email_template/)

  const direct = await email.renderEmail(env, {
    fromEmail: VEGR, subject: 'Hei', bodyHtml: '<p>Rett fram</p>', actor: actorFor('torarne@example.com'),
  })
  assert.equal(direct.ok, true)
  assert.equal(direct.templateSource, 'caller-html')
})

test('a direct email needs both a subject and a body', async () => {
  const { env } = worldWithGraph()
  const a = await email.renderEmail(env, { fromEmail: NIBI, bodyHtml: '<p>x</p>', actor: asHolder() })
  assert.equal(a.code, gs.ERR.INVALID_INPUT)
  const b = await email.renderEmail(env, { fromEmail: NIBI, subject: 'Hei', actor: asHolder() })
  assert.equal(b.code, gs.ERR.INVALID_INPUT)
})

// The gate runs first, so a caller who may not send as an address never learns what that World's
// templates or signatures are called.
test('rendering refuses on the sender before it reads any template', async () => {
  const { env } = worldWithGraph()
  const r = await email.renderEmail(env, {
    fromEmail: NIBI, templatePurpose: 'nyhetsbrev', actor: actorFor('boss@example.com', 'Superadmin'),
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.equal(r.message.includes('nyhetsbrev'), false, 'a refusal must not describe the World it refused')
})

test('a grant holder renders with the holder named, ready for the send to authenticate as them', async () => {
  const { env } = worldWithGraph([liveGrantRow()])
  const r = await email.renderEmail(env, {
    fromEmail: NIBI, templatePurpose: 'nyhetsbrev', variables: { name: 'x', message: 'y' },
    actor: actorFor('torarne@example.com'),
  })
  assert.equal(r.ok, true)
  assert.equal(r.basis, 'grant')
  assert.equal(r.grantId, 'g-live')
})

// ── The log ─────────────────────────────────────────────────────────────────

test('the log records the attempt without copying the message into it', async () => {
  const { env, raw } = worldWithGraph()
  await email.logSend(env, {
    actorEmail: 'torarne@example.com', senderEmail: NIBI, holderEmail: NIBI, basis: 'grant',
    toEmail: 'Inger.Hildrum@Example.COM', subjectChars: 12, bodyChars: 400,
    templateSource: 'world-template:nyhetsbrev/no', signatureName: 'tor-arne', outcome: 'SENT',
  })
  const row = raw.prepare('SELECT * FROM email_send_log').all()[0]
  assert.equal(row.recipient_domain, 'example.com')
  assert.equal(row.recipient_hash.length, 64)
  assert.equal(row.outcome, 'SENT')

  const all = JSON.stringify(row).toLowerCase()
  assert.equal(all.includes('inger.hildrum'), false, 'the local part is never stored')
  assert.equal(all.includes('hei'), false)
})

test('a failed log write never breaks the call', async () => {
  const { env } = freshDb()
  await email.logSend(env, { actorEmail: 'a@b.no', senderEmail: 'c@d.no', outcome: 'SENT' })
})

// ── Sending ─────────────────────────────────────────────────────────────────
//
// email-worker's requireOwnership is a tautology for these calls: it compares the sender we name
// against the identity we assert, and we supply both. So the assertions below are not belt and
// braces — resolveSenderAccess is the ONLY authorisation on this path, and `calls.length === 0`
// is the proof that a refusal happened before anything left this worker.

function sendWorld(grants = [], workerOpts = {}) {
  const { env, raw } = worldWithGraph(grants)
  const worker = new RecordingEmailWorker(workerOpts)
  env.EMAIL_WORKER = worker
  env.INTERNAL_SHARED_SECRET = 'shared-secret-never-logged'
  return { env, raw, worker }
}

const draft = (over = {}) => ({
  fromEmail: NIBI, toEmail: 'inger@example.com', subject: 'Hei', bodyHtml: '<p>Tekst</p>', ...over,
})

test('the holder can send, and the call authenticates AS the holder', async () => {
  const { env, worker } = sendWorld()
  const r = await email.sendEmail(env, { ...draft(), actor: asHolder() })
  assert.equal(r.ok, true)
  assert.equal(r.sent, true)
  assert.equal(r.messageId, 'msg-1')
  assert.equal(worker.calls.length, 1)
})

// THE INVARIANT. email-worker computes claimedOwner = userEmail and compares it against whoever
// resolveCaller says we are; the internal branch carries no role, so isSuper is false by
// construction and ownership can only pass on identity. If these two ever diverge we are leaning
// on the Superadmin bypass without saying so.
test('x-internal-caller always equals the body userEmail, and is never the graph-alert identity', async () => {
  const { env, worker } = sendWorld([liveGrantRow()])
  await email.sendEmail(env, { ...draft(), actor: asHolder() })
  await email.sendEmail(env, { ...draft(), actor: actorFor('torarne@example.com') })
  assert.equal(worker.calls.length, 2)
  for (const call of worker.calls) {
    assert.equal(call.internalCaller, call.body.userEmail, 'the asserted identity must match the claimed owner')
    assert.match(call.internalCaller, /^[^@\s]+@[^@\s]+$/, 'it must be an address, not a service name')
    assert.notEqual(call.internalCaller, 'knowledge-graph-worker', 'that branch pins the identity to post@nibi.no')
    assert.equal(call.body.fromEmail, undefined, 'the sender is derived from the account, not claimed twice')
  }
})

test('a grant holder sends as the HOLDER, not as themselves', async () => {
  const { env, worker } = sendWorld([liveGrantRow()])
  const r = await email.sendEmail(env, { ...draft(), actor: actorFor('torarne@example.com') })
  assert.equal(r.ok, true)
  assert.equal(r.basis, 'grant')
  assert.equal(worker.calls[0].internalCaller, NIBI, "the credential belongs to NIBI, so the call is NIBI's")
})

test('a Superadmin with no grant sends nothing at all', async () => {
  const { env, worker } = sendWorld()
  const r = await email.sendEmail(env, { ...draft(), actor: actorFor('boss@example.com', 'Superadmin') })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.equal(worker.calls.length, 0, 'refused before anything left this worker')
})

// The acceptance test. A send that works proves plumbing; a refusal that works proves the grant
// is load-bearing.
test('revoking the grant stops the send', async () => {
  const { env, worker } = sendWorld([liveGrantRow()])
  const before = await email.sendEmail(env, { ...draft(), actor: actorFor('torarne@example.com') })
  assert.equal(before.ok, true)

  await email.revokeSenderGrant(env, { grantId: 'g-live', actor: asHolder() })

  const after = await email.sendEmail(env, { ...draft(), actor: actorFor('torarne@example.com') })
  assert.equal(after.ok, false)
  assert.equal(after.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.equal(worker.calls.length, 1, 'only the first send ever reached the mail service')
})

// A literal "{name}" in somebody's inbox cannot be recalled, so this is a refusal where the
// preview is only a warning.
test('an unfilled placeholder is refused rather than delivered', async () => {
  const { env, worker } = sendWorld()
  const r = await email.sendEmail(env, {
    ...draft({ bodyHtml: '<p>Hei {navn}</p>' }), actor: asHolder(),
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.INVALID_INPUT)
  assert.match(r.message, /\{navn\}/)
  assert.equal(worker.calls.length, 0)

  // The same draft previews happily — that difference is the whole point of having both.
  const p = await email.renderEmail(env, { ...draft({ bodyHtml: '<p>Hei {navn}</p>' }), actor: asHolder() })
  assert.equal(p.ok, true)
  assert.deepEqual(p.unresolvedPlaceholders, ['navn'])
})

test('a send with no recipient is refused', async () => {
  const { env, worker } = sendWorld()
  const r = await email.sendEmail(env, { ...draft({ toEmail: undefined }), actor: asHolder() })
  assert.equal(r.code, gs.ERR.INVALID_INPUT)
  assert.equal(worker.calls.length, 0)
})

test('a missing shared secret is said plainly, and nothing is sent', async () => {
  const { env, worker } = sendWorld()
  delete env.INTERNAL_SHARED_SECRET
  const r = await email.sendEmail(env, { ...draft(), actor: asHolder() })
  assert.equal(r.code, gs.ERR.INTERNAL_ERROR)
  assert.match(r.message, /INTERNAL_SHARED_SECRET/)
  assert.equal(worker.calls.length, 0)
})

test('the mail service’s own refusal is passed through, not swallowed', async () => {
  const { env } = sendWorld([], { ok: false, status: 403, error: 'caller cannot act on behalf of x' })
  const r = await email.sendEmail(env, { ...draft(), actor: asHolder() })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.match(r.message, /cannot act on behalf/)
})

test('preview and send produce byte-identical subject and html', async () => {
  const { env } = sendWorld()
  const args = draft({ templatePurpose: 'nyhetsbrev', subject: undefined, bodyHtml: undefined, variables: { name: 'Inger', message: 'Hei' } })
  const preview = await email.renderEmail(env, { ...args, actor: asHolder() })
  const sent = await email.sendEmail(env, { ...args, actor: asHolder() })
  assert.equal(sent.subject, preview.subject)
  const { env: e2, worker } = sendWorld()
  await email.sendEmail(e2, { ...args, actor: asHolder() })
  assert.equal(worker.calls[0].body.html, preview.html, 'a preview nobody can trust is worse than none')
})

// ── The log, on the send path ───────────────────────────────────────────────

test('a send writes one row; a refusal writes one too', async () => {
  const { env, raw } = sendWorld()
  await email.sendEmail(env, { ...draft(), actor: asHolder() })
  await email.sendEmail(env, { ...draft(), actor: actorFor('boss@example.com', 'Superadmin') })

  const rows = raw.prepare('SELECT * FROM email_send_log ORDER BY outcome').all()
  assert.equal(rows.length, 2)
  const sent = rows.find((r) => r.outcome === 'SENT')
  const refused = rows.find((r) => r.outcome === gs.ERR.FORBIDDEN_GRAPH)
  assert.ok(sent && refused, JSON.stringify(rows.map((r) => r.outcome)))
  assert.equal(sent.message_id, 'msg-1')
  assert.equal(sent.recipient_domain, 'example.com')
  assert.equal(refused.actor_email, 'boss@example.com')

  const all = JSON.stringify(rows).toLowerCase()
  assert.equal(all.includes('tekst'), false, 'the body is never copied into the log')
  assert.equal(all.includes('inger@'), false, 'the recipient local part is never stored')
})

test('the daily cap refuses before anything leaves', async () => {
  const { env, raw, worker } = sendWorld()
  const ins = raw.prepare(
    "INSERT INTO email_send_log (id, ts, actor_email, sender_email, outcome, surface) VALUES (?,?,?,?,'SENT','mcp')",
  )
  for (let i = 0; i < 20; i++) ins.run(`r${i}`, new Date().toISOString(), NIBI, NIBI)
  const r = await email.sendEmail(env, { ...draft(), actor: asHolder() })
  assert.equal(r.code, gs.ERR.RATE_LIMITED)
  assert.equal(worker.calls.length, 0)
})

// The holder and the account id exist on the render result because sendEmail authenticates with
// them. preview_email whitelists its payload rather than spreading, so neither reaches a model —
// an accountId is precisely what email-worker's unauthenticated gmail route needs to impersonate
// a sender. This pins the service side of that contract.
test('the render result carries the holder and account for the send, and nothing else needs them', async () => {
  const { env } = sendWorld([liveGrantRow()])
  const r = await email.renderEmail(env, { ...draft(), actor: actorFor('torarne@example.com') })
  assert.equal(r.holderEmail, NIBI, 'sendEmail authenticates as the holder')
  assert.ok(r.account?.id, 'and resolves the credential by the account id')
  // The tool must not spread this. If someone changes preview_email back to a spread, the
  // mcp-tools pin on its outputSchema is what should fail — this comment is the pointer to why.
})
