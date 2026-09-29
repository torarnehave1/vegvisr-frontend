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
  test('the scope vocabulary is FROZEN — changing this makes every user re-authorize', () => {
    // A grant is never widened: an existing connection keeps the scopes it was created with, so
    // a new scope string means every person must delete their connector and add it again.
    // ChatGPT will not even reuse the old connector name. Five scopes were added over two days
    // in September 2026 and each one cost that, because they were named after FEATURES.
    //
    // These eight are named after RISK CLASSES and are meant to be final. If this assertion
    // fails, that is the point: decide deliberately, and record the reason in the runbook.
    assert.deepEqual(KNOWN_SCOPES, [
      'graph:read', 'graph:write', 'graph:publish', 'graph:delete',
      'chat:write', 'chat:read', 'user:register', 'user:read',
    ])
  })

  test('consent copy describes the risk class, not just today\'s tool', () => {
    // Consent must never be narrower than what the scope permits, or the next tool placed in an
    // existing scope is doing something the user did not agree to.
    assert.match(SCOPE_TEXT['chat:write'], /andre mennesker/, 'not "chat groups" specifically')
    assert.match(SCOPE_TEXT['graph:write'], /innholdet ditt/, 'not "graphs and nodes" specifically')
    assert.match(OPT_IN_SCOPE_DETAIL['chat:write'], /meldingskanaler generelt/,
      'must say the scope covers the class, so a future tool does not need a new scope')
  })

  test('every opt-in stays out of the advertised set', () => {
    assert.deepEqual(OPT_IN_SCOPES, ['chat:write', 'chat:read', 'graph:publish', 'user:register', 'user:read'])
    for (const s of OPT_IN_SCOPES) assert.equal(CONNECT_SCOPES.includes(s), false, `${s} leaked into the advertised set`)
  })

  test('graph:publish cannot be obtained by a client asking for it', () => {
    // The invariant that makes an opt-in an opt-in: advertising is what made ChatGPT request
    // graph:publish in the first place, so it must be grantable ONLY by a ticked box.
    assert.deepEqual(grantableScopes(['graph:read', 'graph:write', 'graph:publish']), ['graph:read', 'graph:write'])
    assert.deepEqual(sanitizeOptIns(['graph:publish']), ['graph:publish'])
  })

  test('user:register is unobtainable by asking, and its copy says what it creates', () => {
    assert.deepEqual(grantableScopes(['graph:read', 'user:register']), ['graph:read'])
    assert.deepEqual(sanitizeOptIns(['user:register']), ['user:register'])
    const d = OPT_IN_SCOPE_DETAIL['user:register']
    assert.match(d, /opprette en konto/, 'must say an account is created')
    assert.match(d, /Superadmin/, 'must say the role ceiling')
    // The copy has to track the behaviour: a duplicate is REFUSED, not completed, and the scope
    // also covers changing group tags — set_user_groups rides on it rather than a sixth opt-in.
    assert.match(d, /avvist/, 'must say an existing email is refused')
    assert.match(d, /grupper/, 'must say it also covers group changes')
  })

  test('user:read is consented to separately from user:register', () => {
    // Same reason chat:read is separate from chat:write: reading exposes OTHER PEOPLE. Adding one
    // member is a smaller thing than pulling the whole directory into a model's context.
    assert.deepEqual(sanitizeOptIns(['user:read']), ['user:read'])
    assert.deepEqual(grantableScopes(['graph:read', 'user:read']), ['graph:read'])
    const d = OPT_IN_SCOPE_DETAIL['user:read']
    assert.match(d, /ANDRE personers/, 'must say whose data it exposes')
    assert.match(d, /Innloggingsnøkler vises aldri/)
  })

  test('the publish copy says the page becomes public and the host must already exist', () => {
    const d = OPT_IN_SCOPE_DETAIL['graph:publish']
    assert.ok(d && d.length > 80, 'an outward-facing scope needs real copy')
    assert.match(d, /hvem som helst/, 'must say the page becomes public')
    assert.match(d, /ikke opprette nye/, 'must say it cannot create subdomains')
    assert.match(d, /allerede er knyttet til/, 'must say the host is constrained to the node')
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
