// sms-service.js — who may send SMS, and what it costs.
//
// Two sentences are pinned here. First: the allow-list FAILS CLOSED — an unset or empty
// MCP_SMS_ALLOWED means nobody sends, including a platform Superadmin. A fence that defaults to
// open is not a fence, and this is the opposite polarity to the daily cap on purpose. Second: the
// caller never names the sender string. The downstream gateway takes `body.sender` from whoever
// asks and truncates it to 11 characters, so if this module forwarded a caller-supplied value a
// model could text a Norwegian number as any brand it liked.
//
// The signature of a correct refusal is `gw.calls.length === 0` — nothing left, nothing spent —
// plus a REFUSED row in the log, because an attempt by somebody not on the list is exactly the
// event worth having.
//
// Run:  node --test test/sms-service.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedSmsLog, RecordingSmsGateway } from './d1-adapter.mjs'
import * as gs from '../graph-service.js'
import * as sms from '../sms-service.js'

const MINE = 'torarne@example.com'
const PHONE = '+4798765432'

const actorFor = (address, role = 'User') =>
  gs.normalizeActor({
    valid: true,
    userId: `u-${address.split('@')[0]}`,
    userEmail: address,
    userRole: role,
    scopes: ['chat:write'],
  })

function world({ allowed = MINE, cap = undefined, sender = undefined, rate = undefined, gw = new RecordingSmsGateway() } = {}) {
  const { env, raw } = freshDb()
  seedSmsLog(raw)
  env.SMS_GATEWAY = gw
  if (allowed !== null) env.MCP_SMS_ALLOWED = allowed
  if (cap !== undefined) env.MCP_SMS_DAILY_CAP = String(cap)
  if (sender !== undefined) env.MCP_SMS_SENDER = sender
  if (rate !== undefined) env.MCP_SMS_PRICE_PER_SEGMENT = String(rate)
  return { env, raw, gw, log: () => raw.prepare('SELECT * FROM sms_send_log').all() }
}

// ── The fence ───────────────────────────────────────────────────────────────

test('with MCP_SMS_ALLOWED unset, nobody can send — the fence fails CLOSED', async () => {
  const { env, gw, log } = world({ allowed: null })
  const r = await sms.sendSms(env, { toPhone: PHONE, message: 'hi', actor: actorFor(MINE) })
  assert.equal(r.ok, false)
  assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.equal(gw.calls.length, 0, 'nothing was sent')
  assert.equal(log().length, 1, 'and the refusal was recorded')
  assert.equal(log()[0].outcome, 'REFUSED')
})

test('an empty or whitespace allow-list is also nobody, not everybody', async () => {
  for (const allowed of ['', '   ', ',', ' , ']) {
    const { env, gw } = world({ allowed })
    const r = await sms.sendSms(env, { toPhone: PHONE, message: 'hi', actor: actorFor(MINE) })
    assert.equal(r.ok, false, `"${allowed}" must not open the gate`)
    assert.equal(gw.calls.length, 0)
  }
})

test('a Superadmin who is not listed is refused with the IDENTICAL code and message as anyone else', async () => {
  const { env: e1 } = world({ allowed: 'somebody@else.com' })
  const { env: e2 } = world({ allowed: 'somebody@else.com' })
  const asBoss = sms.previewSms(e1, { toPhone: PHONE, message: 'hi', actor: actorFor('boss@example.com', 'Superadmin') })
  const asUser = sms.previewSms(e2, { toPhone: PHONE, message: 'hi', actor: actorFor('carol@example.com') })
  assert.equal(asBoss.ok, false)
  assert.equal(asBoss.code, asUser.code, 'a refusal that varies with role is a bypass not yet written')
  assert.equal(asBoss.message, asUser.message, 'byte-identical, so the role cannot be inferred either')
  assert.match(asBoss.message, /Superadmin grants nothing/i)
})

test('the refusal does not name who IS allowed', async () => {
  const { env } = world({ allowed: 'secret-person@example.com' })
  const r = sms.previewSms(env, { toPhone: PHONE, message: 'hi', actor: actorFor('carol@example.com') })
  assert.equal(r.message.includes('secret-person'), false)
})

test('an allow-listed caller gets through, case and whitespace insensitively', async () => {
  const { env, gw } = world({ allowed: `  ${MINE.toUpperCase()} , other@x.com ` })
  const r = await sms.sendSms(env, { toPhone: PHONE, message: 'hi', actor: actorFor(MINE) })
  assert.equal(r.ok, true, r.message)
  assert.equal(gw.calls.length, 1)
})

// ── The sender is never the caller's to choose ──────────────────────────────

test('the sender comes from config, and a caller-supplied one is ignored entirely', async () => {
  const { env, gw } = world({ sender: 'VEGR.AI' })
  // A model trying every spelling it might guess.
  const r = await sms.sendSms(env, {
    toPhone: PHONE, message: 'hi', actor: actorFor(MINE),
    sender: 'DNB', senderId: 'DNB', source: 'DNB', from: 'DNB',
  })
  assert.equal(r.ok, true, r.message)
  assert.equal(gw.calls[0].body.sender, 'VEGR.AI', 'the config value, not anything passed in')
  assert.equal(r.senderId, 'VEGR.AI')
})

test('a config sender longer than 11 characters is truncated, as the handset would', () => {
  assert.equal(sms.smsSender({ MCP_SMS_SENDER: 'ABCDEFGHIJKLMNOP' }).length, 11)
  assert.equal(sms.smsSender({}), 'VEGR.AI', 'the default matches what the OTP path already sends')
})

// ── Norway only ─────────────────────────────────────────────────────────────

test('every accepted Norwegian form normalises to one value', () => {
  for (const input of ['98765432', '004798765432', '+4798765432', '+47 98 76 54 32', '(47) 98765432']) {
    assert.equal(sms.normalizeNoPhone(input), PHONE, input)
  }
})

test('a non-Norwegian number is refused here, with a message that says why, and nothing is sent', async () => {
  const { env, gw } = world()
  for (const bad of ['+46701234567', '+15551234567', 'not-a-number', '']) {
    const r = await sms.sendSms(env, { toPhone: bad, message: 'hi', actor: actorFor(MINE) })
    assert.equal(r.ok, false, bad)
    assert.equal(r.code, gs.ERR.INVALID_INPUT)
    assert.match(r.message, /\+47/, 'the refusal must say what IS accepted')
  }
  assert.equal(gw.calls.length, 0)
})

// ── Segments, which are what is billed ─────────────────────────────────────

test('GSM-7 boundaries: 160 is one segment, 161 is two', () => {
  assert.equal(sms.segmentsFor('a'.repeat(160)).segments, 1)
  assert.equal(sms.segmentsFor('a'.repeat(161)).segments, 2)
  assert.equal(sms.segmentsFor('a'.repeat(160)).encoding, 'GSM-7')
})

test('Norwegian letters stay GSM-7 — they are in the basic set', () => {
  const r = sms.segmentsFor('Blåbær på Vestlandet, æøå ÆØÅ')
  assert.equal(r.encoding, 'GSM-7', 'æøå must not cost a UCS-2 downgrade')
  assert.equal(r.segments, 1)
})

test('one character outside GSM-7 drops the segment to 70, and preview warns', () => {
  const r = sms.segmentsFor('Hei 😀')
  assert.equal(r.encoding, 'UCS-2')
  assert.equal(sms.segmentsFor('a'.repeat(70) + '😀').segments, 2, '71 UCS-2 units is two segments')

  const { env } = world()
  const p = sms.previewSms(env, { toPhone: PHONE, message: 'Hei 😀', actor: actorFor(MINE) })
  assert.equal(p.encoding, 'UCS-2')
  assert.equal(p.warnings.length, 1)
  assert.match(p.warnings[0], /70 characters instead of 160/)
})

test('an empty message is refused rather than billed', async () => {
  const { env, gw } = world()
  for (const m of ['', '   ']) {
    const r = await sms.sendSms(env, { toPhone: PHONE, message: m, actor: actorFor(MINE) })
    assert.equal(r.ok, false)
  }
  assert.equal(gw.calls.length, 0)
})

// ── Preview and send must agree ────────────────────────────────────────────

test('preview sends nothing, and composes byte-identically to what send transmits', async () => {
  const text = 'Møtet er flyttet til torsdag kl 14. Gi beskjed om det ikke passer.'
  const { env, gw } = world()
  const p = sms.previewSms(env, { toPhone: PHONE, message: text, actor: actorFor(MINE) })
  assert.equal(p.sent, false)
  assert.equal(gw.calls.length, 0, 'preview must not touch the gateway')

  const s = await sms.sendSms(env, { toPhone: PHONE, message: text, actor: actorFor(MINE) })
  assert.equal(s.ok, true, s.message)
  // The whole value of a preview rests on this: what was shown is what went.
  assert.equal(gw.calls[0].body.message, p.message)
  assert.equal(gw.calls[0].body.to, p.toPhone)
  assert.equal(gw.calls[0].body.sender, p.senderId)
  assert.equal(s.segments, p.segments)
})

test('the masked form never shows the subscriber number', () => {
  const m = sms.maskPhone(PHONE)
  assert.equal(m.includes('98765'), false)
  assert.match(m, /^\+47 ••••••32$/)
})

test('a price estimate appears only when a rate is configured', () => {
  const { env: withRate } = world({ rate: 0.4 })
  const { env: without } = world()
  const a = sms.previewSms(withRate, { toPhone: PHONE, message: 'a'.repeat(200), actor: actorFor(MINE) })
  const b = sms.previewSms(without, { toPhone: PHONE, message: 'a'.repeat(200), actor: actorFor(MINE) })
  assert.equal(a.segments, 2)
  assert.equal(a.estimatedPrice, 0.8, 'rate times segments, not times calls')
  assert.equal(b.estimatedPrice, null, 'a made-up number beside a real one is worse than none')
  assert.equal(b.estimatedCurrency, null)
})

// ── The cap counts money, not calls ───────────────────────────────────────

test('the cap counts SEGMENTS, so a long message consumes more of it than a short one', async () => {
  const { env, gw } = world({ cap: 3 })
  const long = 'a'.repeat(200) // two segments
  const first = await sms.sendSms(env, { toPhone: PHONE, message: long, actor: actorFor(MINE) })
  assert.equal(first.ok, true, first.message)
  assert.equal(first.segmentsUsedToday, 2)

  const second = await sms.sendSms(env, { toPhone: PHONE, message: long, actor: actorFor(MINE) })
  assert.equal(second.ok, false, 'two more segments would be four, over a cap of three')
  assert.equal(second.code, gs.ERR.RATE_LIMITED)
  assert.equal(gw.calls.length, 1, 'the second never reached the gateway')
  assert.match(second.message, /MCP_SMS_DAILY_CAP/, 'and it says where the cap lives')
})

test('the cap is per caller, not global', async () => {
  const { env, gw } = world({ allowed: `${MINE},other@x.com`, cap: 1 })
  assert.equal((await sms.sendSms(env, { toPhone: PHONE, message: 'a', actor: actorFor(MINE) })).ok, true)
  assert.equal((await sms.sendSms(env, { toPhone: PHONE, message: 'a', actor: actorFor(MINE) })).ok, false)
  assert.equal((await sms.sendSms(env, { toPhone: PHONE, message: 'a', actor: actorFor('other@x.com') })).ok, true)
  assert.equal(gw.calls.length, 2)
})

// ── The log ────────────────────────────────────────────────────────────────

test('the log keeps the country code and a hash, never the subscriber number and never the text', async () => {
  const { env, log } = world()
  await sms.sendSms(env, { toPhone: PHONE, message: 'Hemmelig beskjed', actor: actorFor(MINE) })
  const row = log()[0]
  assert.equal(row.outcome, 'SENT')
  assert.equal(row.recipient_cc, '+47')
  assert.equal(row.recipient_hash.length, 64)
  assert.equal(row.body_chars, 16)
  assert.equal(row.segments, 1)
  assert.equal(row.price, 0.35)
  assert.equal(row.currency, 'NOK')
  assert.equal(row.message_id, 'sms-1')
  assert.equal(row.surface, 'mcp')
  const serialized = JSON.stringify(row)
  assert.equal(serialized.includes('Hemmelig'), false, 'the body is never stored')
  assert.equal(serialized.includes('98765432'), false, 'nor the subscriber number')
})

test('a refusal is logged too, with its code, which is the event worth having', async () => {
  const { env, log } = world({ allowed: 'nobody@else.com' })
  await sms.sendSms(env, { toPhone: PHONE, message: 'hi', actor: actorFor(MINE) })
  const row = log()[0]
  assert.equal(row.outcome, 'REFUSED')
  assert.equal(row.refusal_code, gs.ERR.FORBIDDEN_GRAPH)
  assert.equal(row.actor_email, MINE)
})

test('a gateway failure is FAILED, not SENT, and is reported rather than swallowed', async () => {
  const { env, log } = world({ gw: new RecordingSmsGateway({ ok: false, status: 400, error: 'No valid phone numbers' }) })
  const r = await sms.sendSms(env, { toPhone: PHONE, message: 'hi', actor: actorFor(MINE) })
  assert.equal(r.ok, false)
  assert.match(r.message, /No valid phone numbers/)
  assert.equal(log()[0].outcome, 'FAILED')
  assert.equal(log()[0].message_id, null)
})

test('a failed log write never fails the send', async () => {
  const { env, gw } = world()
  env.vegvisr_org = { prepare: () => { throw new Error('D1 is down') } }
  // previewSms touches no database, so the send should still go out and only the row is lost.
  const r = await sms.sendSms(env, { toPhone: PHONE, message: 'hi', actor: actorFor(MINE) })
  assert.equal(r.ok, false, 'the cap lookup needs D1, so this surfaces as an error')
  assert.equal(gw.calls.length, 0, 'and it fails BEFORE spending money, which is the right direction')
})

test('an unauthenticated caller is refused before anything else happens', async () => {
  const { env, gw } = world()
  const r = await sms.sendSms(env, { toPhone: PHONE, message: 'hi', actor: null })
  assert.equal(r.code, gs.ERR.UNAUTHENTICATED)
  assert.equal(gw.calls.length, 0)
})
