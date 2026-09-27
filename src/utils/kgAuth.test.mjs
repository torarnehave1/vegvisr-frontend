/**
 * Run: node --test src/utils/kgAuth.test.mjs
 * These are the headers the whole F2-stage-2 change depends on, so they get their own test.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { kgAuthHeaders } from './kgAuth.js'

describe('kgAuthHeaders', () => {
  test('sends the pair the worker session branch requires', () => {
    const h = kgAuthHeaders({ emailVerificationToken: 'sess-abc', role: 'Superadmin' })
    assert.deepEqual(h, { 'x-user-role': 'Superadmin', 'X-Session-Token': 'sess-abc' })
  })

  test('both headers are needed together — the worker gates on the role header being present', () => {
    const h = kgAuthHeaders({ emailVerificationToken: 'sess-abc', role: 'User' })
    assert.ok('x-user-role' in h, 'role header missing: the session branch would not fire')
    assert.ok('X-Session-Token' in h, 'session token missing: the role branch would 401')
  })

  test('defaults the role when the store has none (role is advisory; the DB row decides)', () => {
    assert.equal(kgAuthHeaders({ emailVerificationToken: 't' })['x-user-role'], 'User')
  })

  test('returns nothing when nobody is logged in, so anonymous reads are unchanged', () => {
    assert.deepEqual(kgAuthHeaders({}), {})
    assert.deepEqual(kgAuthHeaders({ emailVerificationToken: null }), {})
    assert.deepEqual(kgAuthHeaders({ emailVerificationToken: '' }), {})
    assert.deepEqual(kgAuthHeaders(null), {})
    assert.deepEqual(kgAuthHeaders(undefined), {})
  })

  test('spreads cleanly into a headers literal without clobbering Content-Type', () => {
    const headers = { 'Content-Type': 'application/json', ...kgAuthHeaders({ emailVerificationToken: 't', role: 'User' }) }
    assert.equal(headers['Content-Type'], 'application/json')
    assert.equal(headers['X-Session-Token'], 't')
  })

  test('spreading an empty result leaves the literal untouched', () => {
    const headers = { 'Content-Type': 'application/json', ...kgAuthHeaders({}) }
    assert.deepEqual(headers, { 'Content-Type': 'application/json' })
  })
})
