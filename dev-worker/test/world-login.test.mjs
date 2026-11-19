/**
 * Signing in to /authorize with a session from a World's editor.
 * Run: node --test dev-worker/test/world-login.test.mjs
 *
 * Against a real SQL engine and the KV stub that honours expirationTtl, like otp.test.mjs.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, KVLike, seedUsers } from './d1-adapter.mjs'
import * as otp from '../oauth/otp.js'
import { knownWorld } from '../graph-store.js'
import { normalizeWorldDomain, startWorldHandoff, redeemWorldHandoff, WORLD_ERR, HANDOFF_TTL_SECONDS } from '../oauth/world-login.js'

const WORLD = 'example-world.test'
let clock = Date.now()
const now = () => clock

function setup() {
  clock = Date.now()
  const { env, raw } = freshDb()
  seedUsers(raw)
  raw.exec(`
    CREATE TABLE world_founders (id TEXT, founder_email TEXT, account_holder_email TEXT, hosting_model TEXT, cf_account_id TEXT, domain TEXT, created_at TEXT);
    INSERT INTO world_founders VALUES ('wf', 'founder@example.com', NULL, 'own_account', 'acc', '${WORLD}', '2026-11-19');
  `)
  env.OAUTH_KV = new KVLike(now)
  return { env, raw }
}

const anonTx = (env) => otp.createTx(env, { authRequest: { clientId: 'c1', scope: ['graph:read'] }, clientId: 'c1', clientName: 'Test client' })
const handoffOf = (redirectTo) => new URL(redirectTo).searchParams.get('mcp_connect')

describe('the World address a person types', () => {
  test('accepts the bare domain, the editor address and a pasted link', () => {
    for (const input of [WORLD, `editor.${WORLD}`, `https://editor.${WORLD}/view?graphId=1`, `  ${WORLD.toUpperCase()}  `, `www.${WORLD}`, `http://${WORLD}#x`]) {
      assert.equal(normalizeWorldDomain(input), WORLD, `failed on ${input}`)
    }
  })

  test('refuses anything that is not a plain hostname', () => {
    for (const input of ['', null, 'localhost', 'evil.test:8443', 'user@evil.test', 'a b.test', 'evil.test\\@x', '-bad.test', 'javascript:alert(1)', '../x', 'x'.repeat(300) + '.test']) {
      assert.equal(normalizeWorldDomain(input), null, `accepted ${input}`)
    }
  })
})

describe('starting the hand-off', () => {
  test('a registered World gets a redirect to its own editor, with a one-time id', async () => {
    const { env } = setup()
    const tx = await anonTx(env)
    const r = await startWorldHandoff(env, tx, `editor.${WORLD}`, { knownWorld })
    assert.equal(r.ok, true)
    const url = new URL(r.redirectTo)
    assert.equal(url.origin, `https://editor.${WORLD}`)
    assert.match(handoffOf(r.redirectTo), /^[0-9a-f]{48}$/)
  })

  test('the transaction id is not in the redirect', async () => {
    const { env } = setup()
    const tx = await anonTx(env)
    const r = await startWorldHandoff(env, tx, WORLD, { knownWorld })
    assert.equal(r.redirectTo.includes(tx.txId), false)
  })

  test('a domain that is not a World is refused, and nothing is stored', async () => {
    const { env } = setup()
    const tx = await anonTx(env)
    const r = await startWorldHandoff(env, tx, 'not-a-world.test', { knownWorld })
    assert.deepEqual(r, { ok: false, code: WORLD_ERR.UNKNOWN_WORLD })
    assert.equal((await otp.getTx(env, tx.txId)).handoff, undefined)
  })

  test('a malformed address is refused before the registry is asked', async () => {
    const { env } = setup()
    const tx = await anonTx(env)
    let asked = false
    const r = await startWorldHandoff(env, tx, 'evil.test:8443', { knownWorld: async () => { asked = true; return 'x' } })
    assert.equal(r.code, WORLD_ERR.BAD_DOMAIN)
    assert.equal(asked, false)
  })
})

describe('coming back from the editor', () => {
  test('the right login token moves the transaction to consent as that account', async () => {
    const { env } = setup()
    const tx = await anonTx(env)
    const { redirectTo } = await startWorldHandoff(env, tx, WORLD, { knownWorld })
    const r = await redeemWorldHandoff(env, { handoff: handoffOf(redirectTo), token: 'sess-nophone' })
    assert.equal(r.ok, true)
    assert.equal(r.world, WORLD)
    const stored = await otp.getTx(env, tx.txId)
    assert.equal(stored.stage, 'consent')
    assert.equal(stored.userId, 'u-nophone')
    assert.equal(stored.handoff, undefined)
  })

  test('a hand-off works once', async () => {
    const { env } = setup()
    const tx = await anonTx(env)
    const { redirectTo } = await startWorldHandoff(env, tx, WORLD, { knownWorld })
    const id = handoffOf(redirectTo)
    assert.equal((await redeemWorldHandoff(env, { handoff: id, token: 'sess-alice' })).ok, true)
    const again = await redeemWorldHandoff(env, { handoff: id, token: 'sess-bob' })
    assert.equal(again.code, WORLD_ERR.NO_HANDOFF)
    assert.equal((await otp.getTx(env, tx.txId)).userId, 'u-alice')
  })

  test('a wrong token identifies nobody, and spends the hand-off', async () => {
    const { env } = setup()
    const tx = await anonTx(env)
    const { redirectTo } = await startWorldHandoff(env, tx, WORLD, { knownWorld })
    const id = handoffOf(redirectTo)
    for (const token of ['nope', '', 'null', 'undefined', null]) {
      const { redirectTo: again } = await startWorldHandoff(env, await otp.getTx(env, tx.txId), WORLD, { knownWorld })
      const r = await redeemWorldHandoff(env, { handoff: handoffOf(again), token })
      assert.equal(r.code, WORLD_ERR.BAD_TOKEN, `accepted ${token}`)
    }
    const stored = await otp.getTx(env, tx.txId)
    assert.notEqual(stored.stage, 'consent')
    assert.equal(stored.userId, null)
    assert.equal((await redeemWorldHandoff(env, { handoff: id, token: 'sess-alice' })).code, WORLD_ERR.NO_HANDOFF)
  })

  test('starting again retires the earlier id', async () => {
    const { env } = setup()
    const tx = await anonTx(env)
    const first = handoffOf((await startWorldHandoff(env, tx, WORLD, { knownWorld })).redirectTo)
    const second = handoffOf((await startWorldHandoff(env, await otp.getTx(env, tx.txId), WORLD, { knownWorld })).redirectTo)
    assert.notEqual(first, second)
    assert.equal((await redeemWorldHandoff(env, { handoff: first, token: 'sess-alice' })).code, WORLD_ERR.NO_HANDOFF)
    assert.equal((await redeemWorldHandoff(env, { handoff: second, token: 'sess-alice' })).ok, true)
  })

  test('an id that was never issued, or is the wrong shape, is refused', async () => {
    const { env } = setup()
    for (const handoff of ['', null, 'abc', 'f'.repeat(48), 'z'.repeat(48)]) {
      assert.equal((await redeemWorldHandoff(env, { handoff, token: 'sess-alice' })).code, WORLD_ERR.NO_HANDOFF)
    }
  })

  test('the transaction id cannot be used as a hand-off', async () => {
    const { env } = setup()
    const tx = await anonTx(env)
    await startWorldHandoff(env, tx, WORLD, { knownWorld })
    assert.equal((await redeemWorldHandoff(env, { handoff: tx.txId, token: 'sess-alice' })).code, WORLD_ERR.NO_HANDOFF)
  })

  test('the hand-off expires', async () => {
    const { env } = setup()
    const tx = await anonTx(env)
    const { redirectTo } = await startWorldHandoff(env, tx, WORLD, { knownWorld })
    clock += (HANDOFF_TTL_SECONDS + 1) * 1000
    assert.equal((await redeemWorldHandoff(env, { handoff: handoffOf(redirectTo), token: 'sess-alice' })).code, WORLD_ERR.NO_HANDOFF)
  })

  test('a code that was on its way for another number is dropped', async () => {
    const { env } = setup()
    const tx = await anonTx(env)
    tx.stage = 'otp'
    tx.phone = '+4790000002'
    tx.codeHash = 'abc'
    tx.codeExpiresAt = clock + 60000
    await otp.putTx(env, tx)
    const { redirectTo } = await startWorldHandoff(env, tx, WORLD, { knownWorld })
    await redeemWorldHandoff(env, { handoff: handoffOf(redirectTo), token: 'sess-alice' })
    const stored = await otp.getTx(env, tx.txId)
    assert.equal(stored.userId, 'u-alice')
    assert.equal(stored.phone, null)
    assert.equal(stored.codeHash, null)
  })
})
