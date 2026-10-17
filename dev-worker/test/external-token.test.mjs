/**
 * The account's login token at /mcp, for Agent-Builder's mcp_call and "Login as" (2026-10-17).
 * Run: node --test dev-worker/test/external-token.test.mjs
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { resolveLoginToken, scopesFromGrants } from '../oauth/external-token.js'

const RESOURCE = 'https://knowledge.vegvisr.org/mcp'

const env = (rows) => ({
  vegvisr_org: {
    prepare: () => ({ bind: (token) => ({ first: async () => rows[token] || null }) }),
  },
})
const grants = (items) => async () => ({ items })
const STINE = { user_id: 'u-stine', email: 'stine@example.test', Role: 'Admin' }

describe('resolveLoginToken', () => {
  test('a known login token resolves to that user, bound to this resource', async () => {
    const r = await resolveLoginToken(
      { token: 'tok-stine', env: env({ 'tok-stine': STINE }) },
      { resource: RESOURCE, listUserGrants: grants([{ scope: ['graph:read', 'graph:write', 'chat:read'], resource: RESOURCE }]) },
    )
    assert.equal(r.audience, RESOURCE)
    assert.deepEqual(r.props, {
      userId: 'u-stine', email: 'stine@example.test', role: 'Admin', authMethod: 'login-token',
      scopes: ['graph:read', 'graph:write', 'chat:read'],
    })
  })

  test('an unknown token is a plain 401', async () => {
    const r = await resolveLoginToken({ token: 'nope', env: env({}) }, { resource: RESOURCE, listUserGrants: grants([]) })
    assert.equal(r, null)
  })

  test('an internal-format token is never looked up as a login token', async () => {
    let looked = false
    const e = { vegvisr_org: { prepare: () => { looked = true; return { bind: () => ({ first: async () => STINE }) } } } }
    const r = await resolveLoginToken({ token: 'a:b:c', env: e }, { resource: RESOURCE, listUserGrants: grants([]) })
    assert.equal(r, null)
    assert.equal(looked, false)
  })

  test('a failing grant listing falls back to the connect scopes, not to nothing or everything', async () => {
    const r = await resolveLoginToken(
      { token: 'tok-stine', env: env({ 'tok-stine': STINE }) },
      { resource: RESOURCE, listUserGrants: async () => { throw new Error('kv down') } },
    )
    assert.deepEqual(r.props.scopes, ['graph:read', 'graph:write'])
  })
})

describe('scopesFromGrants', () => {
  test('union across grants, in KNOWN_SCOPES order', async () => {
    const s = await scopesFromGrants(grants([
      { scope: ['graph:write'], resource: RESOURCE },
      { scope: ['contacts:read', 'graph:read'], resource: [RESOURCE] },
    ]), 'u', RESOURCE)
    assert.deepEqual(s, ['graph:read', 'graph:write', 'contacts:read'])
  })

  test('expired grants, other resources and unknown scope strings count for nothing', async () => {
    const s = await scopesFromGrants(grants([
      { scope: ['graph:delete'], resource: RESOURCE, expiresAt: 100 },
      { scope: ['graph:publish'], resource: 'https://other.example/mcp' },
      { scope: ['admin:everything', 'graph:read'], resource: RESOURCE },
    ]), 'u', RESOURCE, 1000)
    assert.deepEqual(s, ['graph:read'])
  })

  test('no grants at all: what a new connection gets', async () => {
    assert.deepEqual(await scopesFromGrants(grants([]), 'u', RESOURCE), ['graph:read', 'graph:write'])
  })

  test('a legacy grant with no resource still counts', async () => {
    assert.deepEqual(await scopesFromGrants(grants([{ scope: ['chat:write'] }]), 'u', RESOURCE), ['chat:write'])
  })

  test('pages are followed', async () => {
    const pages = [{ items: [{ scope: ['graph:read'] }], cursor: 'c2' }, { items: [{ scope: ['user:read'] }] }]
    let i = 0
    const s = await scopesFromGrants(async () => pages[i++], 'u', RESOURCE)
    assert.deepEqual(s, ['graph:read', 'user:read'])
  })
})
