/**
 * The OAuth OTP challenge. Run: node --test dev-worker/test/otp.test.mjs
 *
 * Covers items 7–9 of the Fase 3 list (right code, wrong code, reuse, too many attempts) plus
 * the send throttles and the transaction binding, against a real SQL engine and a KV stub that
 * actually honours expirationTtl.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, KVLike, FakeSmsGateway, seedUsers } from './d1-adapter.mjs'
import * as otp from '../oauth/otp.js'

let clock = Date.now()
const now = () => clock

function setup({ smsOk = true } = {}) {
  clock = Date.now()
  const { env, raw } = freshDb()
  seedUsers(raw)
  const sms = new FakeSmsGateway({ ok: smsOk })
  env.OAUTH_KV = new KVLike(now)
  env.SMS_GATEWAY = sms
  return { env, sms, raw }
}

async function txFor(env, email) {
  const tx = await otp.createTx(env, { authRequest: { clientId: 'c1', scope: ['graph:read'] }, clientId: 'c1', clientName: 'Test client' })
  tx.email = email
  tx.userId = 'u-alice'
  tx.role = 'User'
  await otp.putTx(env, tx)
  return tx
}

describe('phone normalisation (same rule as the contact form)', () => {
  test('accepts the shapes Norwegian users actually type', () => {
    for (const input of ['90000001', '+4790000001', '004790000001', '4790000001', '900 00 001', '900-00-001']) {
      assert.equal(otp.normalizeNoPhone(input), '+4790000001', `failed on ${input}`)
    }
  })
  test('rejects anything else', () => {
    for (const bad of ['', null, '12345', '+4670000001', 'abc', '+47900000012']) {
      assert.equal(otp.normalizeNoPhone(bad), null, `should reject ${bad}`)
    }
  })
})

describe('7. OTP with the right and the wrong code', () => {
  test('the right code succeeds and moves the transaction to consent', async () => {
    const { env, sms } = setup()
    const tx = await txFor(env, 'alice@example.com')
    const sent = await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '1.1.1.1' })
    assert.equal(sent.ok, true)
    assert.equal(sent.sent, true)

    const code = sms.lastCode()
    assert.match(code, /^\d{6}$/)

    const fresh = await otp.getTx(env, tx.txId)
    const result = await otp.verifyChallenge(env, { tx: fresh, codeRaw: code })
    assert.equal(result.ok, true)

    const after = await otp.getTx(env, tx.txId)
    assert.equal(after.stage, 'consent')
  })

  test('a wrong code fails and reports the attempts left', async () => {
    const { env, sms } = setup()
    const tx = await txFor(env, 'alice@example.com')
    await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '1.1.1.1' })
    const real = sms.lastCode()
    const wrong = String((Number(real) + 1) % 1000000).padStart(6, '0')

    const fresh = await otp.getTx(env, tx.txId)
    const bad = await otp.verifyChallenge(env, { tx: fresh, codeRaw: wrong })
    assert.equal(bad.ok, false)
    assert.equal(bad.code, otp.OTP_ERR.WRONG_CODE)
    assert.equal(bad.remaining, 4)
  })

  test('a non-numeric code costs an attempt and never matches', async () => {
    const { env } = setup()
    const tx = await txFor(env, 'alice@example.com')
    await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '1.1.1.1' })
    const fresh = await otp.getTx(env, tx.txId)
    const r = await otp.verifyChallenge(env, { tx: fresh, codeRaw: 'abcdef' })
    assert.equal(r.code, otp.OTP_ERR.WRONG_CODE)
    assert.equal((await otp.getTx(env, tx.txId)).tries, 1)
  })

  test('the code is never returned to the caller', async () => {
    const { env, sms } = setup()
    const tx = await txFor(env, 'alice@example.com')
    const res = await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '1.1.1.1' })
    assert.equal(JSON.stringify(res).includes(sms.lastCode()), false, 'the send result leaked the code')
  })

  test('the code is never stored in cleartext', async () => {
    const { env, sms } = setup()
    const tx = await txFor(env, 'alice@example.com')
    await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '1.1.1.1' })
    const code = sms.lastCode()
    for (const [, entry] of env.OAUTH_KV.map) {
      assert.equal(String(entry.value).includes(code), false, 'the plaintext code is in KV')
    }
    const stored = await otp.getTx(env, tx.txId)
    assert.match(stored.codeHash, /^[0-9a-f]{64}$/)
  })
})

describe('8. a code used twice', () => {
  test('the second use of a correct code is refused', async () => {
    const { env, sms } = setup()
    const tx = await txFor(env, 'alice@example.com')
    await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '1.1.1.1' })
    const code = sms.lastCode()

    const first = await otp.verifyChallenge(env, { tx: await otp.getTx(env, tx.txId), codeRaw: code })
    assert.equal(first.ok, true)

    const second = await otp.verifyChallenge(env, { tx: await otp.getTx(env, tx.txId), codeRaw: code })
    assert.equal(second.ok, false)
    assert.equal(second.code, otp.OTP_ERR.NO_CHALLENGE)
  })

  test('a code from one transaction cannot be replayed into another', async () => {
    const { env, sms } = setup()
    const txA = await txFor(env, 'alice@example.com')
    await otp.sendChallenge(env, { tx: txA, phoneRaw: '90000001', clientIp: '1.1.1.1' })
    const codeA = sms.lastCode()

    const txB = await txFor(env, 'alice@example.com')
    await otp.sendChallenge(env, { tx: txB, phoneRaw: '90000001', clientIp: '1.1.1.2' })

    // codeA is a valid, unexpired, unspent code — just not for this transaction.
    const cross = await otp.verifyChallenge(env, { tx: await otp.getTx(env, txB.txId), codeRaw: codeA })
    assert.equal(cross.ok, false)
    assert.equal(cross.code, otp.OTP_ERR.WRONG_CODE)
  })

  test('an expired code is refused and cleared', async () => {
    const { env, sms } = setup()
    const tx = await txFor(env, 'alice@example.com')
    await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '1.1.1.1' })
    const code = sms.lastCode()

    // otp.js reads the real Date.now(), so the fake clock the KV stub uses cannot move the code
    // expiry. Age the stored challenge instead — that exercises the actual branch rather than a
    // simulation of it. (Getting this wrong made an earlier version of this test pass while the
    // code verified successfully.)
    const aged = await otp.getTx(env, tx.txId)
    aged.codeExpiresAt = Date.now() - 1000
    await otp.putTx(env, aged)

    const r = await otp.verifyChallenge(env, { tx: await otp.getTx(env, tx.txId), codeRaw: code })
    assert.equal(r.code, otp.OTP_ERR.EXPIRED)
    assert.equal((await otp.getTx(env, tx.txId)).codeHash, null)

    // And the now-cleared challenge cannot be revived by presenting the code again.
    const again = await otp.verifyChallenge(env, { tx: await otp.getTx(env, tx.txId), codeRaw: code })
    assert.equal(again.code, otp.OTP_ERR.NO_CHALLENGE)
  })
})

describe('9. too many OTP attempts', () => {
  test('the challenge dies after the fifth wrong guess, and the right code no longer works', async () => {
    const { env, sms } = setup()
    const tx = await txFor(env, 'alice@example.com')
    await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '1.1.1.1' })
    const real = sms.lastCode()
    const wrong = String((Number(real) + 7) % 1000000).padStart(6, '0')

    for (let i = 1; i <= otp.OTP_LIMITS.MAX_VERIFY_ATTEMPTS - 1; i++) {
      const r = await otp.verifyChallenge(env, { tx: await otp.getTx(env, tx.txId), codeRaw: wrong })
      assert.equal(r.code, otp.OTP_ERR.WRONG_CODE, `attempt ${i}`)
    }
    const last = await otp.verifyChallenge(env, { tx: await otp.getTx(env, tx.txId), codeRaw: wrong })
    assert.equal(last.code, otp.OTP_ERR.TOO_MANY_ATTEMPTS)

    // The real code is now worthless — this is the property that makes a 6-digit code safe.
    const afterLockout = await otp.verifyChallenge(env, { tx: await otp.getTx(env, tx.txId), codeRaw: real })
    assert.equal(afterLockout.ok, false)
    assert.equal(afterLockout.code, otp.OTP_ERR.NO_CHALLENGE)
  })
})

describe('send throttling', () => {
  test('a number is capped per hour', async () => {
    const { env } = setup()
    const tx = await txFor(env, 'alice@example.com')
    for (let i = 0; i < otp.OTP_LIMITS.MAX_SENDS_PER_PHONE_PER_HOUR; i++) {
      assert.equal((await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: `9.9.9.${i}` })).ok, true, `send ${i}`)
    }
    const over = await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '9.9.9.9' })
    assert.equal(over.code, otp.OTP_ERR.RATE_LIMITED)
  })

  test('one IP is capped across different numbers', async () => {
    const { env } = setup()
    const tx = await txFor(env, 'alice@example.com')
    let limited = false
    for (let i = 0; i < otp.OTP_LIMITS.MAX_SENDS_PER_IP_PER_HOUR + 2; i++) {
      const phone = `9000000${i % 10}`
      const r = await otp.sendChallenge(env, { tx, phoneRaw: phone, clientIp: '5.5.5.5' })
      if (r.code === otp.OTP_ERR.RATE_LIMITED) { limited = true; break }
    }
    assert.equal(limited, true, 'the per-IP ceiling never fired')
  })

  test('an invalid number is rejected before any counter or SMS', async () => {
    const { env, sms } = setup()
    const tx = await txFor(env, 'alice@example.com')
    const r = await otp.sendChallenge(env, { tx, phoneRaw: '123', clientIp: '1.1.1.1' })
    assert.equal(r.code, otp.OTP_ERR.BAD_PHONE)
    assert.equal(sms.sent.length, 0)
  })
})

describe('no enumeration of phone numbers or accounts', () => {
  test("a number that is not on the account looks exactly like success, and sends nothing", async () => {
    const { env, sms } = setup()
    const tx = await txFor(env, 'alice@example.com')
    const r = await otp.sendChallenge(env, { tx, phoneRaw: '90000002', clientIp: '1.1.1.1' }) // bob's number
    assert.equal(r.ok, true)
    assert.equal(sms.sent.length, 0, 'an SMS went to a number that is not on the account')
    assert.equal((await otp.getTx(env, tx.txId)).codeHash, null, 'a challenge was created for the wrong number')
  })

  test('a user with no phone on record gets the same answer', async () => {
    const { env, sms } = setup()
    const tx = await txFor(env, 'nophone@example.com')
    const r = await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '1.1.1.1' })
    assert.equal(r.ok, true)
    assert.equal(sms.sent.length, 0)
  })

  test('an unknown e-mail gets the same answer', async () => {
    const { env, sms } = setup()
    const tx = await txFor(env, 'nobody@example.com')
    assert.equal((await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '1.1.1.1' })).ok, true)
    assert.equal(sms.sent.length, 0)
  })
})

describe('the OTP never becomes a durable session', () => {
  test('a successful verification does not touch config.phone_verified_at', async () => {
    const { env, sms, raw } = setup()
    const tx = await txFor(env, 'alice@example.com')
    await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '1.1.1.1' })
    await otp.verifyChallenge(env, { tx: await otp.getTx(env, tx.txId), codeRaw: sms.lastCode() })

    const row = raw.prepare('SELECT phone_verified_at, phone_verification_code FROM config WHERE email = ?').get('alice@example.com')
    assert.equal(row.phone_verified_at, null, 'the OAuth OTP set the permanent verified flag')
    assert.equal(row.phone_verification_code, null, "the OAuth OTP wrote into sms-worker's column")
  })
})

describe('transaction lifetime', () => {
  test('an unknown or malformed transaction id resolves to nothing', async () => {
    const { env } = setup()
    for (const bad of ['', null, 'not-hex', 'x'.repeat(32), '../../etc']) {
      assert.equal(await otp.getTx(env, bad), null, `accepted ${bad}`)
    }
    assert.equal(await otp.getTx(env, 'a'.repeat(32)), null)
  })

  test('a transaction expires with its TTL', async () => {
    const { env } = setup()
    const tx = await txFor(env, 'alice@example.com')
    assert.ok(await otp.getTx(env, tx.txId))
    clock += (otp.OTP_LIMITS.TX_TTL_SECONDS + 1) * 1000
    assert.equal(await otp.getTx(env, tx.txId), null)
  })

  test('a failed SMS send reports it rather than pretending', async () => {
    const { env } = setup({ smsOk: false })
    const tx = await txFor(env, 'alice@example.com')
    const r = await otp.sendChallenge(env, { tx, phoneRaw: '90000001', clientIp: '1.1.1.1' })
    assert.equal(r.code, otp.OTP_ERR.SMS_FAILED)
  })
})
