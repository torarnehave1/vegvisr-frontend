/**
 * What the server advertises, and what it therefore gets asked for.
 * Run: node --test dev-worker/test/scopes.test.mjs
 *
 * These exist because of a measured mistake. graph:publish was listed in scopesSupported, so it
 * appeared in the discovery document; ChatGPT asked for every scope named there, and a
 * connection meant to be read+write came back holding publish as well. Advertising is not
 * neutral — a client asks for what the server says it supports.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { CONNECT_SCOPES, KNOWN_SCOPES, SCOPE_TEXT, OPT_IN_SCOPES, OPT_IN_SCOPE_DETAIL, sanitizeOptIns, grantableScopes } from '../oauth/scopes.js'

describe('advertised scopes', () => {
  test('a normal connection is offered read and write only', () => {
    assert.deepEqual(CONNECT_SCOPES, ['graph:read', 'graph:write'])
  })


  test('publish and delete are understood but never advertised', () => {
    for (const s of ['graph:publish', 'graph:delete']) {
      assert.ok(KNOWN_SCOPES.includes(s), `${s} should still be a scope the server knows`)
      assert.equal(CONNECT_SCOPES.includes(s), false, `${s} must not be advertised in v1`)
    }
  })

  test('every advertised scope is one the server actually knows', () => {
    for (const s of CONNECT_SCOPES) assert.ok(KNOWN_SCOPES.includes(s), s)
  })
})

describe('granting', () => {
  test('a client asking for publish gets a token without it, not an error', () => {
    assert.deepEqual(grantableScopes(['graph:read', 'graph:write', 'graph:publish']), ['graph:read', 'graph:write'])
  })

  test('this is the exact request ChatGPT made on 2026-09-27', () => {
    // It was granted all three before this fix. The regression test is the whole point.
    const granted = grantableScopes(['graph:read', 'graph:write', 'graph:publish'])
    assert.equal(granted.includes('graph:publish'), false, 'publish was granted to a normal connection again')
  })

  test('delete is never granted, however it is asked for', () => {
    assert.equal(grantableScopes(['graph:delete']).includes('graph:delete'), false)
    assert.equal(grantableScopes(['graph:read', 'graph:delete']).includes('graph:delete'), false)
  })

  test('an unrecognised or empty request still yields a usable read-only token', () => {
    for (const req of [[], ['nonsense'], null, undefined, 'not-an-array']) {
      assert.deepEqual(grantableScopes(req), ['graph:read'], JSON.stringify(req))
    }
  })

  test('a read-only request stays read-only — nothing is added', () => {
    assert.deepEqual(grantableScopes(['graph:read']), ['graph:read'])
  })

  test('every known scope has text for the consent screen', () => {
    for (const s of KNOWN_SCOPES) assert.ok(SCOPE_TEXT[s], `${s} has no consent text`)
  })
})

describe('the opt-in step-up', () => {
  test('chat:write is an opt-in, and it is still not advertised', () => {
    assert.ok(OPT_IN_SCOPES.includes('chat:write'))
    assert.equal(CONNECT_SCOPES.includes('chat:write'), false, 'it leaked into what clients are offered')
    assert.ok(KNOWN_SCOPES.includes('chat:write'))
  })

  test('a client still cannot obtain it by asking', () => {
    assert.equal(grantableScopes(['graph:read', 'graph:write', 'chat:write']).includes('chat:write'), false)
  })

  test('only real opt-in scopes survive sanitising — the form is untrusted input', () => {
    assert.deepEqual(sanitizeOptIns(['chat:write']), ['chat:write'])
    assert.deepEqual(sanitizeOptIns(['graph:delete']), [], 'a scope that is not an opt-in was accepted')
    assert.deepEqual(sanitizeOptIns(['admin:all', 'chat:write', 'nonsense']), ['chat:write'])
    assert.deepEqual(sanitizeOptIns('chat:write'), ['chat:write'], 'a single checkbox arrives as a string')
    assert.deepEqual(sanitizeOptIns([]), [])
    assert.deepEqual(sanitizeOptIns(null), [])
    assert.deepEqual(sanitizeOptIns(undefined), [])
  })

  test('every opt-in scope has the longer copy a consent screen needs', () => {
    for (const s of OPT_IN_SCOPES) {
      assert.ok(SCOPE_TEXT[s], `${s} has no short label`)
      assert.ok((OPT_IN_SCOPE_DETAIL[s] || '').length > 80, `${s} needs real explanatory copy, not a one-liner`)
    }
  })

  test('the detail copy says the three things that make it outward-facing', () => {
    const d = OPT_IN_SCOPE_DETAIL['chat:write']
    assert.match(d, /AI/, 'must say an AI wrote it')
    assert.match(d, /boten er lagt til/, 'must say the bot gates which groups')
    assert.match(d, /ikke slettes/, 'must say it cannot be undone')
  })
})

describe('chat:read is consented to separately from chat:write', () => {
  test('both are opt-ins, neither is advertised', () => {
    assert.deepEqual(OPT_IN_SCOPES, ['chat:write', 'chat:read'])
    for (const s of OPT_IN_SCOPES) assert.equal(CONNECT_SCOPES.includes(s), false, `${s} leaked into the advertised set`)
  })

  test('granting one does not grant the other — that is the whole point of two boxes', () => {
    assert.deepEqual(sanitizeOptIns(['chat:write']), ['chat:write'])
    assert.deepEqual(sanitizeOptIns(['chat:read']), ['chat:read'])
    assert.deepEqual(sanitizeOptIns(['chat:write', 'chat:read']), ['chat:write', 'chat:read'])
  })

  test('the copy says reading exposes other people, and that addresses are withheld', () => {
    const d = OPT_IN_SCOPE_DETAIL['chat:read']
    assert.match(d, /andre deltakere/, 'must say it reads other participants')
    assert.match(d, /aldri e-postadresser/, 'must say e-mail addresses are withheld')
  })
})
