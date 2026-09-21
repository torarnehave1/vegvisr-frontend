import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './index.js';

function database(schema) {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  return {
    db,
    prepare(sql) {
      const statement = db.prepare(sql);
      return { bind(...values) {
        return {
          first: async () => statement.get(...values),
          all: async () => ({ results: statement.all(...values) }),
          run: () => { const result = statement.run(...values); return { meta: { last_row_id: Number(result.lastInsertRowid) } }; },
        };
      } };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.run());
        db.exec('COMMIT');
        return results;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}

export function fixture() {
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('./add-direct-chats.sql', import.meta.url), 'utf8');
  const chat = database(schema + ';ALTER TABLE groups ADD COLUMN archived_at INTEGER;' + migration);
  chat.db.exec(migration);
  const identities = database('CREATE TABLE config(user_id TEXT, emailVerificationToken TEXT, display_name TEXT, email TEXT, data TEXT);');
  for (const [id, name] of [['tor', 'Tor Arne Have'], ['inger', 'Inger Hildrum'], ['outsider', 'Other Admin']]) {
    identities.db.prepare('INSERT INTO config VALUES (?, ?, ?, ?, ?)').run(id, 'token-' + id, null, id + '@test.invalid', JSON.stringify({ profile: { name } }));
  }
  chat.db.exec("INSERT INTO groups(id,name,created_by,created_at,updated_at) VALUES ('nibi','NIBI FELLES','tor',1,1); INSERT INTO group_members VALUES ('nibi','tor','member',1),('nibi','inger','member',1);");
  const env = {
    CHAT_DB: chat,
    IDENTITY_DB: identities,
    SMS_WORKER: { fetch: async () => Response.json({ role: 'Superadmin' }) },
  };
  const call = async (user, method, route, body, extraHeaders = {}) => worker.fetch(new Request('https://chat.test' + route, {
    method,
    headers: { ...(user ? { Authorization: 'Bearer token-' + user } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {} });
  return { chat, identities, env, call, fetch: request => worker.fetch(request, env, { waitUntil() {} }) };
}

const { chat, identities, call } = fixture();
const spec = await (await call(null, 'GET', '/openapi.json')).json();
assert.equal(spec.paths['/direct/conversations'].post.operationId, 'openDirectChat');
assert.equal(spec.components.securitySchemes.directSession.scheme, 'bearer');
assert.equal((await call('tor', 'GET', '/direct/people?source_group_id=nibi')).headers.get('Cache-Control'), 'no-store');
assert.equal((await call(null, 'GET', '/direct/people?source_group_id=nibi')).status, 401);
assert.equal((await call('invalid', 'GET', '/direct/people?source_group_id=nibi')).status, 401);
assert.equal((await call('outsider', 'GET', '/direct/people?source_group_id=nibi')).status, 403);
const people = await (await call('tor', 'GET', '/direct/people?source_group_id=nibi')).json();
assert.deepEqual(people.people, [{ user_id: 'inger', name: 'Inger Hildrum' }]);
for (let index = 0; index < 55; index += 1) {
  const userId = 'extra-' + index;
  identities.db.prepare('INSERT INTO config VALUES (?, ?, ?, ?, ?)').run(userId, 'token-' + userId, 'Extra ' + index, userId + '@test.invalid', '{}');
  chat.db.prepare('INSERT INTO group_members VALUES (?, ?, ?, ?)').run('nibi', userId, 'member', 1);
}
const pageOne = await (await call('tor', 'GET', '/direct/people?source_group_id=nibi')).json();
const pageTwo = await (await call('tor', 'GET', '/direct/people?source_group_id=nibi&offset=50')).json();
assert.equal(pageOne.people.length, 50);
assert.equal(pageOne.next_offset, 50);
assert.equal(pageTwo.people.length, 6);
assert.equal(pageTwo.next_offset, null);
assert.equal(new Set([...pageOne.people, ...pageTwo.people].map(person => person.user_id)).size, 56);
assert.equal((await (await call('tor', 'GET', '/direct/people?source_group_id=nibi&q=Hildrum')).json()).people[0].user_id, 'inger');
assert.equal((await call('tor', 'POST', '/direct/conversations', { source_group_id: 'nibi', peer_id: 'tor' })).status, 400);
assert.equal((await call('tor', 'POST', '/direct/conversations', { source_group_id: 'nibi', peer_id: 'outsider' })).status, 403);
const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => call(index % 2 ? 'inger' : 'tor', 'POST', '/direct/conversations', {
  source_group_id: 'nibi', peer_id: index % 2 ? 'tor' : 'inger',
})));
const conversations = await Promise.all(responses.map(response => response.json()));
const groupId = conversations[0].group.id;
assert.equal(new Set(conversations.map(result => result.group.id)).size, 1);
assert.equal(conversations[0].group.name, 'Inger Hildrum');
assert.equal(conversations[1].group.name, 'Tor Arne Have');
assert.equal(chat.db.prepare('SELECT count(*) AS count FROM direct_chats').get().count, 1);
assert.equal(chat.db.prepare('SELECT count(*) AS count FROM group_members WHERE group_id = ?').get(groupId).count, 2);
assert.equal((await (await call('inger', 'GET', '/direct/conversations?source_group_id=nibi')).json()).groups[0].name, 'Tor Arne Have');
assert.equal((await call('tor', 'POST', `/direct/${groupId}/messages`, { body: 'Hei Inger', user_id: 'outsider' })).status, 201);
assert.equal((await call('inger', 'POST', `/direct/${groupId}/messages`, { body: 'Hei Tor' })).status, 201);
const history = await (await call('inger', 'GET', `/direct/${groupId}/messages?latest=1`)).json();
assert.deepEqual(history.messages.map(message => [message.user_id, message.body]), [['tor', 'Hei Inger'], ['inger', 'Hei Tor']]);
const firstId = history.messages[0].id;
assert.equal((await (await call('tor', 'GET', `/direct/${groupId}/messages?after=${firstId}`)).json()).messages.length, 1);
assert.equal((await call('outsider', 'GET', `/direct/${groupId}/messages`)).status, 403);
assert.equal((await call('outsider', 'POST', `/direct/${groupId}/messages`, { body: 'intrusion' })).status, 403);
assert.equal((await call(null, 'GET', `/direct/${groupId}/messages?user_id=tor&phone=123`)).status, 401);
assert.equal((await call('tor', 'POST', `/direct/${groupId}/messages`, { body: 'image', message_type: 'image', media_url: 'https://example.com/private' })).status, 400);
assert.equal((await call('tor', 'POST', `/direct/${groupId}/messages`, { body: ' ' })).status, 400);
assert.equal((await call('tor', 'GET', `/direct/${groupId}/messages?after=-1`)).status, 400);
for (const [method, route, body] of [
  ['GET', `/groups/${groupId}/messages?user_id=tor&phone=123`],
  ['POST', `/groups/${groupId}/join`, { user_id: 'outsider', phone: '123', role: 'owner' }],
  ['POST', `/groups/${groupId}/invite`, { user_id: 'tor', phone: '123' }],
  ['POST', `/groups/${groupId}/bots`, { user_id: 'tor', bot_id: 'bot' }],
  ['DELETE', `/groups/${groupId}/members/inger`, { user_id: 'tor', phone: '123' }],
  ['POST', `/groups/${groupId}/media`, { user_id: 'tor' }],
  ['POST', `/groups/${groupId}/messages/${firstId}/move`, { target_group_id: 'nibi', user_id: 'tor', phone: '123' }],
  ['POST', `/groups/nibi/messages/${firstId}/forward`, { target_group_id: groupId, user_id: 'tor', phone: '123' }],
  ['POST', '/bot-message', { group_id: groupId, body: 'injected', bot_id: 'bot' }],
  ['POST', `/messages/${firstId}/reactions`, { user_id: 'tor', phone: '123', reaction: 'like' }],
]) assert.equal((await call('tor', method, route, body)).status, 403, route);
const legacyGroups = await (await call(null, 'GET', '/groups?user_id=tor&phone=123')).json();
assert.equal(legacyGroups.groups.some(group => group.id === groupId), false);
assert.throws(() => chat.db.prepare('INSERT INTO group_members VALUES (?, ?, ?, ?)').run(groupId, 'outsider', 'member', 1));
assert.throws(() => chat.db.prepare("UPDATE group_members SET role='owner' WHERE group_id=?").run(groupId));
assert.throws(() => chat.db.prepare('DELETE FROM group_members WHERE group_id=?').run(groupId));
chat.db.prepare("DELETE FROM group_members WHERE group_id='nibi' AND user_id='inger'").run();
assert.equal((await call('inger', 'GET', `/direct/${groupId}/messages`)).status, 403);
assert.equal((await call('tor', 'POST', `/direct/${groupId}/messages`, { body: 'after removal' })).status, 403);
assert.equal((await (await call('tor', 'GET', '/direct/conversations?source_group_id=nibi')).json()).groups.length, 0);
assert.equal((await call(null, 'OPTIONS', '/direct/conversations')).headers.get('Access-Control-Allow-Headers').includes('Authorization'), true);
console.log('PASS direct chat: real SQLite, migration rerun, discovery/search/pagination, concurrent pair reuse, reciprocal names, two-way messages, spoofing denial, legacy-route isolation, fixed membership and revoked access');