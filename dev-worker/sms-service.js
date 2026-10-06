/**
 * sms-service.js — who may send SMS from the MCP surface, and what it costs.
 *
 * WHY THIS IS AN ALLOW-LIST AND NOT THE E-MAIL MODEL
 * --------------------------------------------------
 * email-service.js gates on "own-profile OR a grant" because an e-mail address is a thing a
 * person holds: it sits in their `settings.emailAccounts[]` with a credential beside it, and
 * `post@nibi.no` is NIBI's in a way the data can express.
 *
 * SMS has none of that. There is ONE ClickSend account, its credentials live as secrets on
 * `sms-gateway`, and the "sender" is an alphanumeric string of at most 11 characters that the
 * provider accepts from anyone holding those credentials. Both existing callers send the same
 * one — `sender: 'VEGR.AI'` (dev-worker/oauth/otp.js:218, brand-worker/index.js:203). So there is
 * no sender to own and nothing to grant per address. A first version that invented
 * `smsSenderIds[]` and an `sms_sender_grants` table would be modelling a distinction the channel
 * does not have.
 *
 * What IS scarce is the right to use the capability at all, because every send costs money and
 * lands on somebody's handset. So the gate is a config allow-list, and it FAILS CLOSED: an unset
 * or empty `MCP_SMS_ALLOWED` means nobody may send. That polarity is deliberate and the opposite
 * of the daily cap's — a cap that defaults to a number is a safety net, a fence that defaults to
 * open is not a fence. Adding a person is a deliberate config change plus a deploy, which for one
 * or two people is a stronger control than a row somebody can write.
 *
 * `actor.isSuperadmin` is never consulted, for the same reason it is never consulted in
 * email-service.js: a refusal that varies with role is a bypass that has not been written yet.
 *
 * THE SENDER IS NEVER NAMED BY THE CALLER
 * ---------------------------------------
 * `MCP_SMS_SENDER` resolves it, exactly as `fromEmail` is deliberately not sent to email-worker.
 * The downstream gateway WILL take `body.sender` from whoever asks and truncate it to 11
 * characters, so if this module forwarded a caller-supplied value a model could text a Norwegian
 * number as any brand it liked. It does not forward one.
 */

import { ERR, statusForCode } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

function nowIso() {
  return new Date().toISOString()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Local copy. email-service.js has its own; neither imports the other, and the lint caught the
 *  moment this one was assumed to exist rather than written. */
function normalizeEmail(value) {
  const t = String(value || '').trim().toLowerCase()
  return EMAIL_RE.test(t) ? t : null
}

const DEFAULT_SENDER = 'VEGR.AI'
const DEFAULT_DAILY_CAP = 20
const SENDER_MAX = 11
const BODY_MAX = 1000

/** Comma-separated e-mails from config. Empty, missing or whitespace means NOBODY. */
export function allowedSenders(env) {
  return String(env?.MCP_SMS_ALLOWED || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function smsSender(env) {
  const s = String(env?.MCP_SMS_SENDER || DEFAULT_SENDER).trim()
  return s.slice(0, SENDER_MAX)
}

export function dailyCap(env) {
  const n = Number(env?.MCP_SMS_DAILY_CAP)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY_CAP
}

/**
 * Norway only, normalised to +47XXXXXXXX.
 *
 * The gateway already rejects everything else (sms-worker/index.js:265-300), but the check is
 * repeated here for two reasons: a refusal from this module can say what was wrong, where the
 * downstream one is an opaque 400; and preview must agree with send about what the recipient IS,
 * which it cannot do if normalisation happens somewhere else.
 */
export function normalizeNoPhone(input) {
  const cleaned = String(input || '').trim().replace(/[()\s-]/g, '')
  if (!cleaned) return null
  const digits = cleaned.replace(/\D/g, '')
  if (cleaned.startsWith('+')) return cleaned.startsWith('+47') ? `+${digits}` : null
  if (digits.startsWith('0047')) return `+${digits.slice(2)}`
  if (digits.startsWith('47') && digits.length === 10) return `+${digits}`
  if (digits.length === 8) return `+47${digits}`
  return null
}

/** +47 98 76 54 32 -> "+47 ••••••32". The log stores no more than this either. */
export function maskPhone(e164) {
  const s = String(e164 || '')
  return s.length < 4 ? '••' : `${s.slice(0, 3)} ••••••${s.slice(-2)}`
}

// GSM 03.38 basic set plus its extension table. Anything outside forces UCS-2, which cuts a
// segment from 160 characters to 70 — the single biggest surprise in SMS billing, and the reason
// preview reports segments rather than characters.
//
// ONE class body, two regexes derived from it. They were separate literals for about an hour and
// that is exactly how the whole-string test and the per-character test drift apart: a character
// allowed by one and rejected by the other produces a warning naming a character that is fine, or
// silence about one that is not.
const GSM7_BODY = '@£$¥èéùìòÇ\\nØø\\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\\u001bÆæßÉ !"#¤%&\'()*+,\\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\\f^{}\\\\\\[~\\]|€'
const GSM7 = new RegExp(`^[${GSM7_BODY}]*$`)
const GSM7_CHAR = new RegExp(`^[${GSM7_BODY}]$`)

// Names for the characters that actually turn up in Norwegian business prose. The invisible ones
// are why this exists at all: a non-breaking space or a soft hyphen doubles the price of a message
// with nothing on screen to see, and "contains a character outside the GSM-7 set" is useless
// advice when the character cannot be seen.
const CHAR_NAMES = {
  '—': 'em dash (long dash, often auto-inserted)',
  '–': 'en dash',
  '‘': 'left single quote',
  '’': 'right single quote / curly apostrophe',
  '“': 'left double quote',
  '”': 'right double quote',
  '…': 'ellipsis (one character, not three dots)',
  ' ': 'NON-BREAKING SPACE — invisible',
  '­': 'SOFT HYPHEN — invisible',
  '​': 'ZERO-WIDTH SPACE — invisible',
  '•': 'bullet',
  '−': 'minus sign (not a hyphen)',
  '´': 'acute accent',
  '′': 'prime',
  '°': 'degree sign',
  '←': 'left arrow',
  '→': 'right arrow',
  '«': 'left guillemet',
  '»': 'right guillemet',
}

const INVISIBLE = new Set([' ', '­', '​', '‌', '‍', '﻿'])

/**
 * Every distinct character in `text` that forces UCS-2, in order of first appearance.
 *
 * Returns `{ char, codePoint, name, invisible }` so a caller can print something a human can act
 * on. An invisible character is rendered as its name and code point only — printing the character
 * itself would show nothing, which is how it got into the message in the first place.
 */
export function nonGsmChars(text) {
  const seen = new Map()
  for (const ch of String(text || '')) {
    if (GSM7_CHAR.test(ch) || seen.has(ch)) continue
    const cp = `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`
    seen.set(ch, {
      char: ch,
      codePoint: cp,
      name: CHAR_NAMES[ch] || null,
      invisible: INVISIBLE.has(ch),
    })
  }
  return [...seen.values()]
}

/** How each offender should appear in a message to a human. */
export function describeChar(c) {
  if (c.invisible) return `${c.name || 'invisible character'} (${c.codePoint})`
  return c.name ? `"${c.char}" — ${c.name} (${c.codePoint})` : `"${c.char}" (${c.codePoint})`
}

/**
 * The warning, with the two things that make it actionable: WHICH characters, and what removing
 * them would save. A saving is only claimed when the segment count actually drops — on a short
 * message the downgrade costs nothing, and promising a saving that is not there is worse than
 * saying nothing.
 */
export function gsmWarning(text) {
  const offenders = nonGsmChars(text)
  if (offenders.length === 0) return null

  const shown = offenders.slice(0, 5).map(describeChar).join(', ')
  const more = offenders.length > 5 ? `, and ${offenders.length - 5} more` : ''

  const now = segmentsFor(text).segments
  const stripped = [...String(text)].filter((ch) => GSM7_CHAR.test(ch)).join('')
  const after = segmentsFor(stripped).segments
  const saving = after < now
    ? ` Replacing ${offenders.length === 1 ? 'it' : 'them'} would make this ${after} segment(s) instead of ${now}.`
    : ` The segment count is ${now} either way, so this costs nothing here — but it would on a longer message.`

  return (
    `${offenders.length} character${offenders.length === 1 ? '' : 's'} outside the GSM-7 set ` +
    `(${shown}${more}), so each segment holds 70 characters instead of 160.${saving}`
  )
}

export function segmentsFor(text) {
  const s = String(text || '')
  const gsm = GSM7.test(s)
  // The extension characters cost two septets each.
  const len = gsm ? s.length + (s.match(/[\f^{}\\[~\]|€]/g) || []).length : s.length
  const single = gsm ? 160 : 70
  const multi = gsm ? 153 : 67
  if (len === 0) return { segments: 0, encoding: gsm ? 'GSM-7' : 'UCS-2', chars: 0 }
  return {
    segments: len <= single ? 1 : Math.ceil(len / multi),
    encoding: gsm ? 'GSM-7' : 'UCS-2',
    chars: s.length,
  }
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ''))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sentToday(env, actorEmail) {
  const since = new Date(Date.now() - 86400000).toISOString()
  const row = await env.vegvisr_org
    .prepare("SELECT COALESCE(SUM(segments), 0) AS n FROM sms_send_log WHERE actor_email = ? AND outcome = 'SENT' AND ts > ?")
    .bind(actorEmail, since)
    .first()
  return Number(row?.n || 0)
}

/**
 * Record an attempt. Never throws into the request path — the same contract logSend uses. Losing
 * a log row must not turn into a failed send, and an audit write that can fail a send is an
 * availability bug wearing a compliance hat.
 */
export async function logSmsSend(env, row) {
  try {
    const to = row.toPhone || null
    await env.vegvisr_org
      .prepare(
        `INSERT INTO sms_send_log
           (id, ts, actor_email, sender_id, recipient_cc, recipient_hash, body_chars, segments,
            outcome, refusal_code, message_id, price, currency, surface, client_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(), nowIso(), row.actorEmail || 'unknown', row.senderId || null,
        to ? to.slice(0, 3) : null, to ? await sha256Hex(to) : null,
        row.bodyChars ?? null, row.segments ?? null, row.outcome,
        row.refusalCode || null, row.messageId || null,
        row.price ?? null, row.currency || null, row.surface || 'mcp', row.clientId || null,
      )
      .run()
  } catch (e) {
    console.error('[sms-service] send log failed:', e.message)
  }
}

/**
 * The gate. One basis only: the caller's address is on the config allow-list.
 *
 * `actor.isSuperadmin` is not read. A test asserts a Superadmin who is not listed gets the same
 * code and the same message string as anybody else.
 */
export function resolveSmsAccess(env, { actor }) {
  if (!actor || actor.anonymous) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  const callerEmail = String(actor.email || '').trim().toLowerCase()
  if (!callerEmail) {
    return fail(ERR.FORBIDDEN_GRAPH, 'This token has no e-mail identity, so it may not send SMS.')
  }
  const allowed = allowedSenders(env)
  if (!allowed.includes(callerEmail)) {
    // The message says nothing about who IS allowed. Same reasoning as noSenderAccess: a caller
    // without the capability has no business learning the roster.
    return fail(
      ERR.FORBIDDEN_GRAPH,
      'You may not send SMS from this server. Sending is limited to an explicit allow-list, and ' +
        'being a platform Superadmin grants nothing here. Ask the system owner to add you.',
    )
  }
  return { ok: true, actorEmail: callerEmail, basis: 'allow-list' }
}

/**
 * Compose exactly what send would transmit, and transmit nothing.
 *
 * This is the only way a human sees the text before it leaves, because no connected MCP client
 * declares `elicitation` — the same reason preview_email exists. `sent` is always false.
 *
 * Price is NOT estimated unless `MCP_SMS_PRICE_PER_SEGMENT` is configured. ClickSend returns the
 * real figure only in the send response, and a made-up number beside a real one is worse than no
 * number.
 */
export function previewSms(env, { toPhone, message, actor }) {
  const access = resolveSmsAccess(env, { actor })
  if (!access.ok) return access

  const to = normalizeNoPhone(toPhone)
  if (!to) {
    return fail(
      ERR.INVALID_INPUT,
      `"${toPhone}" is not a Norwegian mobile number. This gateway sends to +47 numbers only — ` +
        'give it as 8 digits, 0047…, or +47….',
    )
  }
  const body = String(message || '').trim()
  if (!body) return fail(ERR.INVALID_INPUT, 'message is required and cannot be empty.')
  if (body.length > BODY_MAX) {
    return fail(ERR.INVALID_INPUT, `message is ${body.length} characters; the limit here is ${BODY_MAX}.`)
  }

  const seg = segmentsFor(body)
  const rate = Number(env?.MCP_SMS_PRICE_PER_SEGMENT)
  const estimate = Number.isFinite(rate) && rate > 0 ? Number((rate * seg.segments).toFixed(4)) : null

  return {
    ok: true,
    sent: false,
    toPhone: to,
    toMasked: maskPhone(to),
    senderId: smsSender(env),
    message: body,
    chars: seg.chars,
    encoding: seg.encoding,
    segments: seg.segments,
    estimatedPrice: estimate,
    estimatedCurrency: estimate === null ? null : String(env?.MCP_SMS_CURRENCY || 'NOK'),
    basis: access.basis,
    warnings: [gsmWarning(body)].filter(Boolean),
  }
}

/**
 * Send the SMS previewSms just composed.
 *
 * Transport is the SMS_GATEWAY service binding, which dev-worker already declares. The public
 * hostname is deliberately not used: a worker-to-worker call over the public URL 502s from inside
 * a Worker, and the binding is also what makes the gateway's open public route closable later
 * without touching this caller.
 *
 * The cap counts SEGMENTS, not calls. A 400-character message is three segments and three times
 * the money, so counting calls would let an expensive day look like a quiet one.
 */
export async function sendSms(env, args) {
  const draft = previewSms(env, args)
  if (!draft.ok) {
    await logSmsSend(env, {
      actorEmail: String(args?.actor?.email || 'unknown').toLowerCase(),
      toPhone: normalizeNoPhone(args?.toPhone),
      bodyChars: String(args?.message || '').length,
      outcome: 'REFUSED',
      refusalCode: draft.code,
      surface: 'mcp',
      clientId: args?.clientId,
    })
    return draft
  }

  const cap = dailyCap(env)
  // If the count cannot be read, the cap cannot be enforced — so refuse rather than send
  // uncapped. This direction matters: the failure mode of a spend limit must be "no spend".
  // Found by a test that replaced D1 with a throwing stub; before this the throw propagated
  // out of the tool as an unhandled error.
  let used
  try {
    used = await sentToday(env, args.actor.email.toLowerCase())
  } catch (e) {
    console.error('[sms-service] cap lookup failed:', e.message)
    return fail(
      ERR.INTERNAL_ERROR,
      'Could not read how many SMS have been sent today, so the daily cap cannot be enforced. ' +
        'Nothing was sent. Try again shortly.',
    )
  }
  if (used + draft.segments > cap) {
    const refusal = fail(
      ERR.RATE_LIMITED,
      `That would be ${used + draft.segments} SMS segments in 24 hours and the cap is ${cap}. ` +
        `${used} already sent. The cap is MCP_SMS_DAILY_CAP in dev-worker's config.`,
      { segmentsUsed: used, cap },
    )
    await logSmsSend(env, {
      actorEmail: args.actor.email.toLowerCase(),
      senderId: draft.senderId,
      toPhone: draft.toPhone,
      bodyChars: draft.chars,
      segments: draft.segments,
      outcome: 'REFUSED',
      refusalCode: refusal.code,
      surface: 'mcp',
      clientId: args?.clientId,
    })
    return refusal
  }

  if (!env.SMS_GATEWAY?.fetch) {
    return fail(ERR.INTERNAL_ERROR, 'The SMS_GATEWAY service binding is not configured on this worker.')
  }

  let data = {}
  let res
  try {
    res = await env.SMS_GATEWAY.fetch('https://sms-gateway/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `sender` comes from config, never from args. One recipient per call.
      body: JSON.stringify({ to: draft.toPhone, message: draft.message, sender: draft.senderId }),
    })
    data = await res.json().catch(() => ({}))
  } catch (e) {
    console.error('[sms-service] gateway unreachable:', e.message)
    await logSmsSend(env, {
      actorEmail: args.actor.email.toLowerCase(), senderId: draft.senderId, toPhone: draft.toPhone,
      bodyChars: draft.chars, segments: draft.segments, outcome: 'FAILED',
      surface: 'mcp', clientId: args?.clientId,
    })
    return fail(ERR.INTERNAL_ERROR, `Could not reach the SMS gateway: ${e.message}`)
  }

  const okSend = !!res.ok && data?.success !== false
  const messageId = Array.isArray(data?.messageIds) ? data.messageIds[0] || null : null

  await logSmsSend(env, {
    actorEmail: args.actor.email.toLowerCase(),
    senderId: draft.senderId,
    toPhone: draft.toPhone,
    bodyChars: draft.chars,
    segments: draft.segments,
    outcome: okSend ? 'SENT' : 'FAILED',
    messageId,
    price: data?.totalPrice ?? null,
    currency: data?.currency || null,
    surface: 'mcp',
    clientId: args?.clientId,
  })

  if (!okSend) {
    return fail(
      ERR.INTERNAL_ERROR,
      data?.error ? `The SMS gateway refused the send: ${data.error}` : `The SMS gateway returned status ${res.status}.`,
    )
  }

  return {
    ok: true,
    sent: true,
    toMasked: draft.toMasked,
    senderId: draft.senderId,
    segments: draft.segments,
    encoding: draft.encoding,
    messageId,
    price: data?.totalPrice ?? null,
    currency: data?.currency || null,
    segmentsUsedToday: used + draft.segments,
    dailyCap: cap,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Addressing a PERSON instead of a number
// ─────────────────────────────────────────────────────────────────────────────
//
// `list_users` deliberately refuses to return phone numbers — "a phone book is not what was
// asked for" (users-service.js:200). That is the right call: the directory's output lands in a
// model's context. But it left the SMS tools unusable for the only audience they exist for, since
// send_sms needs a number the caller must already know. Measured 2026-10-06: 8 people tagged
// #NIBI, 7 with a verified phone, and no way to text any of them.
//
// So the number is resolved HERE, server-side, from an address the caller already knows, and it
// never travels back. The responses below are built field by field rather than copied from the
// number-addressed versions and filtered — a filter forgets the field somebody adds next year,
// an explicit object cannot.
//
// A phone that has never been verified is REFUSED. `phone_verified_at` means the person completed
// an SMS code, so the number demonstrably reaches them; an unverified one is a string somebody
// typed, possibly an admin registering someone else, and the cost of being wrong lands on whoever
// owns that number now.

/**
 * One registered person's number, or a refusal that says what to do about it.
 *
 * `phone` on the result is for internal use by the two functions below. Nothing that reaches a
 * caller includes it.
 */
export async function resolveRecipientUser(env, { recipientEmail }) {
  const email = normalizeEmail(recipientEmail)
  if (!email) return fail(ERR.INVALID_INPUT, 'recipientEmail must be a valid e-mail address.')

  const row = await env.vegvisr_org
    .prepare(`
      SELECT email,
             COALESCE(json_extract(data, '$.profile.name'), display_name, '') AS name,
             phone,
             phone_verified_at
      FROM config WHERE email = ? LIMIT 1
    `)
    .bind(email)
    .first()

  if (!row) {
    return fail(ERR.GRAPH_NOT_FOUND, `Nobody is registered with the address ${email}. list_users will show the spelling.`)
  }
  const name = row.name || null
  const who = name ? `${name} (${email})` : email

  if (!row.phone || !String(row.phone).trim()) {
    return fail(
      ERR.INVALID_INPUT,
      `${who} has no phone number on file, so there is nothing to send to. A Superadmin can add ` +
        'one with update_user_profile.',
      { recipientEmail: email, name },
    )
  }
  if (!row.phone_verified_at) {
    return fail(
      ERR.INVALID_INPUT,
      `${who} has a number on file, but it has never been verified by an SMS code — so there is ` +
        'no evidence it reaches them, and a wrong number means texting a stranger. They can ' +
        'verify it by signing in with an SMS code once.',
      { recipientEmail: email, name },
    )
  }

  const phone = normalizeNoPhone(row.phone)
  if (!phone) {
    return fail(
      ERR.INVALID_INPUT,
      `${who} has a number on file that is not a Norwegian mobile number, and this gateway sends ` +
        'to +47 only.',
      { recipientEmail: email, name },
    )
  }

  return { ok: true, recipientEmail: email, name, phone, masked: maskPhone(phone) }
}

/** previewSms, addressed by person. Composes identically; returns no number. */
export async function previewSmsToUser(env, { recipientEmail, message, actor }) {
  const access = resolveSmsAccess(env, { actor })
  if (!access.ok) return access

  const who = await resolveRecipientUser(env, { recipientEmail })
  if (!who.ok) return who

  const draft = previewSms(env, { toPhone: who.phone, message, actor })
  if (!draft.ok) return draft

  // Built field by field. `draft.toPhone` is deliberately not among them.
  return {
    ok: true,
    sent: false,
    recipientEmail: who.recipientEmail,
    recipientName: who.name,
    toMasked: who.masked,
    senderId: draft.senderId,
    message: draft.message,
    chars: draft.chars,
    encoding: draft.encoding,
    segments: draft.segments,
    estimatedPrice: draft.estimatedPrice,
    estimatedCurrency: draft.estimatedCurrency,
    basis: draft.basis,
    warnings: draft.warnings,
  }
}

/** sendSms, addressed by person. */
export async function sendSmsToUser(env, args) {
  const access = resolveSmsAccess(env, { actor: args?.actor })
  if (!access.ok) return access

  const who = await resolveRecipientUser(env, { recipientEmail: args?.recipientEmail })
  if (!who.ok) return who

  const result = await sendSms(env, { ...args, toPhone: who.phone })
  if (!result.ok) return result

  return {
    ok: true,
    sent: true,
    recipientEmail: who.recipientEmail,
    recipientName: who.name,
    toMasked: result.toMasked,
    senderId: result.senderId,
    segments: result.segments,
    encoding: result.encoding,
    messageId: result.messageId,
    price: result.price,
    currency: result.currency,
    segmentsUsedToday: result.segmentsUsedToday,
    dailyCap: result.dailyCap,
  }
}
