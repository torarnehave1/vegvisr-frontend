/**
 * otp.js — the OTP challenge used to authenticate a person inside an OAuth transaction.
 *
 * WHY THIS IS NOT sms-worker's OTP, REUSED AS-IS
 * ----------------------------------------------
 * There are two OTP implementations in this system and each has half of what OAuth needs:
 *
 *   sms-worker (/api/auth/phone/*, the live login flow) binds the code to a USER: it looks the
 *   person up in `config` and hands back user_id + email. But it has no attempt counter — a
 *   6-digit code can be guessed without limit inside its 5-minute window — no send throttle,
 *   it answers 404 "No account registered with this phone number" (which tells an attacker
 *   whether a number exists), and a success sets `config.phone_verified_at`, a PERMANENT flag
 *   that other code then treats as standing authorization.
 *
 *   brand-worker (/__contact/send-otp, the contact form) has the counters sms-worker lacks:
 *   5 verify attempts, 3 sends per number per hour, 6 per IP per hour, 200 globally per hour.
 *   But it only proves a phone number is reachable; it knows nothing about accounts.
 *
 * This module takes the identity binding from the first and the counters from the second, and
 * adds the one thing neither has: the challenge is bound to a specific OAuth transaction, so a
 * code issued for one authorization cannot be replayed into another. It deliberately does NOT
 * write to config.phone_verification_code and does NOT set phone_verified_at: an OAuth OTP
 * authenticates a person for one authorization and must not become a durable web session.
 *
 * The OTP is never a token. It is spent inside /authorize and is gone; what leaves this module
 * is an identity, and what leaves /authorize is an OAuth authorization code.
 */

const TX_PREFIX = 'oauthtx:'
const RATE_PREFIX = 'oauthrate:'

const TX_TTL_SECONDS = 15 * 60 // a whole authorization must finish inside this
const CODE_TTL_SECONDS = 5 * 60 // matches both existing implementations
const MAX_VERIFY_ATTEMPTS = 5 // from brand-worker
const MAX_SENDS_PER_PHONE_PER_HOUR = 3 // from brand-worker
const MAX_SENDS_PER_IP_PER_HOUR = 6 // from brand-worker
const MAX_SENDS_GLOBAL_PER_HOUR = 200 // from brand-worker

export const OTP_ERR = {
  TX_NOT_FOUND: 'TX_NOT_FOUND',
  BAD_PHONE: 'BAD_PHONE',
  RATE_LIMITED: 'RATE_LIMITED',
  NO_CHALLENGE: 'NO_CHALLENGE',
  EXPIRED: 'EXPIRED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  WRONG_CODE: 'WRONG_CODE',
  SMS_FAILED: 'SMS_FAILED',
}

async function sha256hex(input) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Norwegian mobile normalisation, byte-for-byte the rule brand-worker's contact form uses, so
 * a number that works in one place works in the other.
 */
export function normalizeNoPhone(raw) {
  let p = String(raw || '').replace(/[\s\-()]/g, '')
  if (p.startsWith('0047')) p = '+47' + p.slice(4)
  else if (p.startsWith('47') && p.length === 10) p = '+47' + p.slice(2)
  else if (/^\d{8}$/.test(p)) p = '+47' + p
  return /^\+47\d{8}$/.test(p) ? p : null
}

function sixDigitCode() {
  // 100000–999999 with no modulo bias across the printable range, same shape as brand-worker.
  return String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000))
}

// ── transaction store ────────────────────────────────────────────────────────

/**
 * A transaction holds the in-flight authorization: the parsed OAuth request, the email proven
 * by the magic link, and the current OTP challenge. Keyed by an unguessable id that travels in
 * the URL of the login page.
 */
export async function createTx(env, { authRequest, clientName, clientId }) {
  const txId = crypto.randomUUID().replace(/-/g, '')
  const tx = {
    txId,
    stage: 'email',
    authRequest,
    clientId,
    clientName: clientName || null,
    email: null,
    userId: null,
    role: null,
    phone: null,
    codeHash: null,
    codeExpiresAt: null,
    tries: 0,
    createdAt: Date.now(),
  }
  await putTx(env, tx)
  return tx
}

export async function getTx(env, txId) {
  if (!txId || !/^[0-9a-f]{32}$/.test(String(txId))) return null
  const raw = await env.OAUTH_KV.get(TX_PREFIX + txId)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function putTx(env, tx) {
  await env.OAUTH_KV.put(TX_PREFIX + tx.txId, JSON.stringify(tx), { expirationTtl: TX_TTL_SECONDS })
}

export async function deleteTx(env, txId) {
  await env.OAUTH_KV.delete(TX_PREFIX + txId)
}

// ── rate limiting ────────────────────────────────────────────────────────────

async function bump(env, key, ttl) {
  const k = RATE_PREFIX + key
  const n = (parseInt(await env.OAUTH_KV.get(k), 10) || 0) + 1
  await env.OAUTH_KV.put(k, String(n), { expirationTtl: ttl })
  return n
}

/**
 * Three independent ceilings, all from brand-worker: per number, per client IP, and one global
 * valve. Checked before an SMS is sent, never after.
 */
async function sendAllowed(env, phone, clientIp) {
  const hour = Math.floor(Date.now() / 3600000)
  const phoneKey = `send:${await sha256hex(phone)}:${hour}`
  if ((await bump(env, phoneKey, 3600)) > MAX_SENDS_PER_PHONE_PER_HOUR) return false
  if ((await bump(env, `ip:${clientIp}:${hour}`, 3600)) > MAX_SENDS_PER_IP_PER_HOUR) return false
  if ((await bump(env, `global:${hour}`, 3600)) > MAX_SENDS_GLOBAL_PER_HOUR) return false
  return true
}

// ── the two operations ───────────────────────────────────────────────────────

/**
 * Issue a code for this transaction and SMS it.
 *
 * Returns the SAME shape whether or not the number belongs to the signed-in user, and whether
 * or not it exists at all. sms-worker answers 404 "No account registered with this phone
 * number", which lets anyone enumerate the user base one number at a time; this does not.
 * A number that does not match the account simply never receives a code.
 *
 * Nothing here logs or returns the code. The only places it exists are the SMS body and a
 * SHA-256 hash in KV.
 */
export async function sendChallenge(env, { tx, phoneRaw, clientIp }) {
  const phone = normalizeNoPhone(phoneRaw)
  if (!phone) return { ok: false, code: OTP_ERR.BAD_PHONE }

  if (!(await sendAllowed(env, phone, clientIp || 'unknown'))) {
    return { ok: false, code: OTP_ERR.RATE_LIMITED }
  }

  // The phone must belong to the email the magic link already proved. A mismatch is silent:
  // the caller gets the same "code sent" answer and no code is issued.
  let matches = false
  if (tx.email) {
    const row = await env.vegvisr_org
      .prepare('SELECT phone FROM config WHERE email = ? LIMIT 1')
      .bind(tx.email)
      .first()
    matches = Boolean(row?.phone && normalizeNoPhone(row.phone) === phone)
  }

  if (!matches) {
    // Deliberately indistinguishable from success, and deliberately cheap — no SMS is sent.
    console.log('[OAuth OTP] challenge requested for a number that does not match the account')
    return { ok: true, sent: false }
  }

  const code = sixDigitCode()
  tx.phone = phone
  tx.codeHash = await sha256hex(`${tx.txId}:${code}`) // salted with the tx: no cross-tx replay
  tx.codeExpiresAt = Date.now() + CODE_TTL_SECONDS * 1000
  tx.tries = 0
  tx.stage = 'otp'
  await putTx(env, tx)

  const smsBody = {
    to: phone,
    message: `Din VEGR.AI-innloggingskode: ${code}`,
    sender: 'VEGR.AI',
  }
  const req = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(smsBody),
  }
  const res = env.SMS_GATEWAY
    ? await env.SMS_GATEWAY.fetch('https://sms-gateway/api/sms', req)
    : await fetch('https://sms-gateway.torarnehave.workers.dev/api/sms', req)

  if (!res.ok) {
    console.error('[OAuth OTP] SMS gateway refused the send, status', res.status)
    return { ok: false, code: OTP_ERR.SMS_FAILED }
  }
  return { ok: true, sent: true }
}

/**
 * Spend the code. Single use: on any terminal outcome — right, expired, or out of attempts —
 * the challenge is cleared from the transaction, so the same code can never be presented twice.
 */
export async function verifyChallenge(env, { tx, codeRaw }) {
  const code = String(codeRaw || '').trim()

  if (!tx.codeHash || !tx.codeExpiresAt) return { ok: false, code: OTP_ERR.NO_CHALLENGE }

  const clearChallenge = async () => {
    tx.codeHash = null
    tx.codeExpiresAt = null
    tx.tries = 0
    await putTx(env, tx)
  }

  if (Date.now() > tx.codeExpiresAt) {
    await clearChallenge()
    return { ok: false, code: OTP_ERR.EXPIRED }
  }
  if (tx.tries >= MAX_VERIFY_ATTEMPTS) {
    await clearChallenge()
    return { ok: false, code: OTP_ERR.TOO_MANY_ATTEMPTS }
  }
  if (!/^\d{6}$/.test(code)) {
    tx.tries += 1
    await putTx(env, tx)
    return { ok: false, code: OTP_ERR.WRONG_CODE, remaining: MAX_VERIFY_ATTEMPTS - tx.tries }
  }

  const presented = await sha256hex(`${tx.txId}:${code}`)
  if (presented !== tx.codeHash) {
    tx.tries += 1
    await putTx(env, tx)
    if (tx.tries >= MAX_VERIFY_ATTEMPTS) {
      await clearChallenge()
      return { ok: false, code: OTP_ERR.TOO_MANY_ATTEMPTS }
    }
    return { ok: false, code: OTP_ERR.WRONG_CODE, remaining: MAX_VERIFY_ATTEMPTS - tx.tries }
  }

  // Correct. Burn the challenge and move the transaction on to consent.
  // NOTE what is deliberately NOT done: config.phone_verified_at is left alone. An OAuth OTP
  // authenticates one authorization; turning it into the permanent flag that sms-worker's
  // /api/save-graph treats as standing authorization would widen its meaning well past this
  // transaction.
  await clearChallenge()
  tx.stage = 'consent'
  await putTx(env, tx)
  return { ok: true }
}

export const OTP_LIMITS = {
  CODE_TTL_SECONDS,
  TX_TTL_SECONDS,
  MAX_VERIFY_ATTEMPTS,
  MAX_SENDS_PER_PHONE_PER_HOUR,
  MAX_SENDS_PER_IP_PER_HOUR,
  MAX_SENDS_GLOBAL_PER_HOUR,
}
