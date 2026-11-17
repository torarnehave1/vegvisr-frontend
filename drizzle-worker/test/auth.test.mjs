// Unit tests for drizzle-worker/src/auth.js — the login + ownership gate (2026-11-17).
// Run: node --test drizzle-worker/test/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorize, isInternalRequest, readToken, ownsGraph } from '../src/auth.js';

const USERS = {
  'tok-owner': { userId: 'user-1', oauthId: 'oauth-1', email: 'owner@example.com', role: 'Admin' },
  'tok-other': { userId: 'user-2', oauthId: null, email: 'other@example.com', role: 'Realtime' },
  'tok-super': { userId: 'user-9', oauthId: null, email: 'super@example.com', role: 'Superadmin' },
};
const TABLES = { 'tbl-1': 'user-1', 'tbl-oauth': 'oauth-1', 'tbl-2': 'user-2', 'tbl-demo': 'a1b2c3d4-demo' };

let lookups;
const deps = {
  lookupCaller: async (t) => { lookups.caller++; return USERS[t] || null; },
  lookupTableOwner: async (id) => { lookups.table++; return TABLES[id] || null; },
};
const PUBLIC = 'https://drizzle.vegvisr.org';
const INTERNAL = 'https://drizzle-worker';

function req(base, method, path, { token, body, header = 'Authorization' } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers[header] = header === 'Authorization' ? `Bearer ${token}` : token;
  return new Request(base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}
async function run(base, method, path, opts) {
  lookups = { caller: 0, table: 0 };
  const request = req(base, method, path, opts);
  const result = await authorize({ request, ...deps });
  return { result, request };
}

test('internal host is recognised; anything else is public', () => {
  assert.equal(isInternalRequest(new Request('https://drizzle-worker/query')), true);
  assert.equal(isInternalRequest(new Request('https://drizzle.vegvisr.org/query')), false);
  assert.equal(isInternalRequest(new Request('https://drizzle-worker.someone.workers.dev/query')), false);
  assert.equal(isInternalRequest(new Request('https://drizzle-worker.evil.example/query')), false);
});

test('token is read from Authorization: Bearer or X-API-Token', () => {
  assert.equal(readToken(new Request(PUBLIC, { headers: { Authorization: 'Bearer abc' } })), 'abc');
  assert.equal(readToken(new Request(PUBLIC, { headers: { 'X-API-Token': 'xyz' } })), 'xyz');
  assert.equal(readToken(new Request(PUBLIC)), '');
  assert.equal(readToken(new Request(PUBLIC, { headers: { Authorization: 'Bearer ' } })), '');
});

test('internal (service binding) calls pass without a token and without lookups', async () => {
  for (const [m, p, body] of [
    ['POST', '/query', { tableId: 'tbl-2' }],
    ['POST', '/raw-query', { sql: 'SELECT 1' }],
    ['GET', '/tables', undefined],
    ['POST', '/drop-table', { tableId: 'tbl-1' }],
  ]) {
    const { result } = await run(INTERNAL, m, p, { body });
    assert.deepEqual(result, { ok: true, internal: true, caller: null });
    assert.deepEqual(lookups, { caller: 0, table: 0 });
  }
});

test('public: /health and /openapi.json are open', async () => {
  assert.equal((await run(PUBLIC, 'GET', '/health')).result.ok, true);
  assert.equal((await run(PUBLIC, 'GET', '/openapi.json')).result.ok, true);
});

test('public without a token is refused on every data route (401)', async () => {
  const routes = [
    ['GET', '/tables'], ['GET', '/table/tbl-1'], ['GET', '/databases'], ['GET', '/d1-tables'],
    ['POST', '/query', { tableId: 'tbl-1' }], ['POST', '/insert', { tableId: 'tbl-1', record: {} }],
    ['POST', '/bulk-insert', { tableId: 'tbl-1', records: [] }], ['POST', '/update', { tableId: 'tbl-1', id: 'x', record: {} }],
    ['POST', '/delete-records', { tableId: 'tbl-1', ids: ['x'] }], ['POST', '/add-column', { tableId: 'tbl-1' }],
    ['POST', '/create-table', { graphId: 'user-1', displayName: 'x', columns: [] }],
    ['POST', '/drop-table', { tableId: 'tbl-1' }], ['POST', '/raw-query', { sql: 'SELECT * FROM config' }],
    ['GET', '/chat-groups'], ['GET', '/group-messages?groupId=1'], ['POST', '/send-group-message', { email: 'a@b.c' }],
    ['GET', '/something-new'],
  ];
  for (const [m, p, body] of routes) {
    const { result } = await run(PUBLIC, m, p, { body });
    assert.equal(result.ok, false, `${m} ${p}`);
    assert.equal(result.status, 401, `${m} ${p}`);
  }
});

test('public with an unknown token is refused (401)', async () => {
  const { result } = await run(PUBLIC, 'POST', '/query', { token: 'nope', body: { tableId: 'tbl-1' } });
  assert.equal(result.status, 401);
});

test('owner may use own table — also when the table is keyed on the oauth id, and via X-API-Token', async () => {
  for (const p of ['/query', '/insert', '/bulk-insert', '/update', '/delete-records', '/add-column']) {
    assert.equal((await run(PUBLIC, 'POST', p, { token: 'tok-owner', body: { tableId: 'tbl-1' } })).result.ok, true, p);
  }
  assert.equal((await run(PUBLIC, 'POST', '/query', { token: 'tok-owner', body: { tableId: 'tbl-oauth' } })).result.ok, true);
  assert.equal((await run(PUBLIC, 'GET', '/table/tbl-1', { token: 'tok-owner' })).result.ok, true);
  assert.equal((await run(PUBLIC, 'POST', '/query', { token: 'tok-owner', header: 'X-API-Token', body: { tableId: 'tbl-1' } })).result.ok, true);
});

test("another user's table, a demo table and an unknown table are all refused the same way (403)", async () => {
  for (const tableId of ['tbl-2', 'tbl-demo', 'does-not-exist']) {
    for (const p of ['/query', '/update', '/delete-records', '/insert']) {
      const { result } = await run(PUBLIC, 'POST', p, { token: 'tok-owner', body: { tableId } });
      assert.equal(result.status, 403, `${p} ${tableId}`);
      assert.match(result.error, /do not own/);
    }
    assert.equal((await run(PUBLIC, 'GET', `/table/${tableId}`, { token: 'tok-owner' })).result.status, 403);
  }
});

test('a userId in the body cannot be used to claim ownership', async () => {
  const { result } = await run(PUBLIC, 'POST', '/query', { token: 'tok-other', body: { tableId: 'tbl-1', userId: 'user-1' } });
  assert.equal(result.status, 403);
});

test('the route handler can still read the body after the gate read it', async () => {
  const { result, request } = await run(PUBLIC, 'POST', '/query', { token: 'tok-owner', body: { tableId: 'tbl-1', limit: 5 } });
  assert.equal(result.ok, true);
  assert.deepEqual(await request.json(), { tableId: 'tbl-1', limit: 5 });
});

test('GET /tables: a user sees only their own; asking for someone else is refused', async () => {
  let r = (await run(PUBLIC, 'GET', '/tables', { token: 'tok-owner' })).result;
  assert.equal(r.ok, true); assert.equal(r.listGraphId, 'user-1');
  r = (await run(PUBLIC, 'GET', '/tables?graphId=user-1', { token: 'tok-owner' })).result;
  assert.equal(r.listGraphId, 'user-1');
  r = (await run(PUBLIC, 'GET', '/tables?graphId=oauth-1', { token: 'tok-owner' })).result;
  assert.equal(r.listGraphId, 'oauth-1');
  r = (await run(PUBLIC, 'GET', '/tables?userId=user-2', { token: 'tok-owner' })).result;
  assert.equal(r.status, 403);
});

test('GET /tables: Superadmin gets what was asked for (all when nothing asked)', async () => {
  let r = (await run(PUBLIC, 'GET', '/tables', { token: 'tok-super' })).result;
  assert.equal(r.ok, true); assert.equal(r.listGraphId, null);
  r = (await run(PUBLIC, 'GET', '/tables?graphId=user-2', { token: 'tok-super' })).result;
  assert.equal(r.listGraphId, 'user-2');
});

test('create-table: only under your own id', async () => {
  assert.equal((await run(PUBLIC, 'POST', '/create-table', { token: 'tok-owner', body: { graphId: 'user-1' } })).result.ok, true);
  assert.equal((await run(PUBLIC, 'POST', '/create-table', { token: 'tok-owner', body: { graphId: 'user-2' } })).result.status, 403);
  assert.equal((await run(PUBLIC, 'POST', '/create-table', { token: 'tok-owner', body: {} })).result.status, 403);
  assert.equal((await run(PUBLIC, 'POST', '/create-table', { token: 'tok-super', body: { graphId: 'user-2' } })).result.ok, true);
});

test('admin routes: ordinary users 403, Superadmin ok', async () => {
  const routes = [
    ['POST', '/raw-query', { sql: 'SELECT 1' }], ['GET', '/d1-tables'], ['GET', '/databases'],
    ['POST', '/drop-table', { tableId: 'tbl-1' }], ['GET', '/chat-groups'], ['POST', '/add-user-to-group', {}],
    ['GET', '/group-messages'], ['GET', '/group-stats'], ['POST', '/send-group-message', {}],
    ['POST', '/create-chat-group', {}], ['POST', '/register-chat-bot', {}], ['GET', '/group-bots'],
    ['POST', '/unregister-chat-bot', {}], ['GET', '/agent-bot-groups'], ['GET', '/group-members'],
  ];
  for (const [m, p, body] of routes) {
    assert.equal((await run(PUBLIC, m, p, { token: 'tok-owner', body })).result.status, 403, `${m} ${p}`);
    assert.equal((await run(PUBLIC, m, p, { token: 'tok-super', body })).result.ok, true, `${m} ${p}`);
  }
});

test('another database is Superadmin only, even on an own-table route', async () => {
  assert.equal((await run(PUBLIC, 'POST', '/query?database=hallo_vegvisr_chat', { token: 'tok-owner', body: { tableId: 'tbl-1' } })).result.status, 403);
  assert.equal((await run(PUBLIC, 'POST', '/query?database=vegvisr_org', { token: 'tok-owner', body: { tableId: 'tbl-1' } })).result.ok, true);
  assert.equal((await run(PUBLIC, 'GET', '/tables?database=calendar_db', { token: 'tok-super' })).result.ok, true);
});

test('Superadmin may use any table', async () => {
  assert.equal((await run(PUBLIC, 'POST', '/query', { token: 'tok-super', body: { tableId: 'tbl-2' } })).result.ok, true);
  assert.equal((await run(PUBLIC, 'GET', '/table/tbl-demo', { token: 'tok-super' })).result.ok, true);
});

test('ownsGraph', () => {
  assert.equal(ownsGraph(USERS['tok-owner'], 'user-1'), true);
  assert.equal(ownsGraph(USERS['tok-owner'], 'oauth-1'), true);
  assert.equal(ownsGraph(USERS['tok-other'], null), false);
  assert.equal(ownsGraph(null, 'user-1'), false);
});
