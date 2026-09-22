// /world-chat-groups (2026-09-22, architect's decisions 1C/2A/3A): a World's groups are the groups
// owned by the World founder plus the World's main group, and a member sees only those they belong
// to. Names play no part. Real SQLite via fixture(); world_founders added to the identity database.
//
// Run:  node test-world-chat-groups.mjs   (runs the base direct-chat test first)
import assert from 'node:assert/strict';
import { fixture } from './test-direct-chat.mjs';

const { chat, identities, call } = fixture();
identities.db.exec(`CREATE TABLE world_founders (domain TEXT, world_name TEXT, founder_email TEXT, main_chat_group_id TEXT);
  INSERT INTO config VALUES ('founder', 'token-founder', 'Post Nibi', 'post@nibi.test', '{}');
  INSERT INTO config VALUES ('cofounder', 'token-cofounder', 'Medgrunnlegger', 'co@nibi.test', '{}');
  INSERT INTO world_founders VALUES ('nibi.test', 'Nibi', 'post@nibi.test', 'felles');
  INSERT INTO world_founders VALUES ('two.test', 'Two', 'post@nibi.test', NULL);
  INSERT INTO world_founders VALUES ('two.test', 'Two', 'co@nibi.test', NULL);
  INSERT INTO world_founders VALUES ('ghost.test', 'Ghost', 'nobody@ghost.test', NULL);`);
chat.db.exec(`INSERT INTO groups(id,name,created_by,created_at,updated_at,archived_at) VALUES
    ('felles','NIBI FELLES','founder',1,5,NULL),
    ('kurs','Kurs 2026','founder',1,4,NULL),
    ('hemmelig','Styret','founder',1,3,NULL),
    ('tor-nibi','nibi venner','tor',1,6,NULL),
    ('gammel','Gammel NIBI','founder',1,2,99),
    ('co-gruppe','Medgrunnleggers gruppe','cofounder',1,1,NULL);
  INSERT INTO group_members(group_id,user_id,role,joined_at) VALUES
    ('felles','founder','owner',1),('felles','tor','member',1),('felles','inger','member',1),
    ('kurs','founder','owner',1),('kurs','tor','member',1),
    ('hemmelig','founder','owner',1),
    ('tor-nibi','tor','owner',1),
    ('gammel','founder','owner',1),('gammel','tor','member',1),
    ('co-gruppe','cofounder','owner',1),('co-gruppe','tor','member',1);`);

const list = async (user, domain, header = 'X-API-Token') => {
  const response = await call(null, 'GET', `/world-chat-groups${domain === undefined ? '' : '?domain=' + encodeURIComponent(domain)}`, null,
    user ? { [header]: header === 'Authorization' ? 'Bearer token-' + user : 'token-' + user } : {});
  return { status: response.status, ...(await response.json()) };
};

// Owner rule + member-only (1C): founder-owned, not archived, not private, caller is a member.
const tor = await list('tor', 'nibi.test');
assert.equal(tor.status, 200);
assert.deepEqual(tor.groups.map(group => group.id), ['felles', 'kurs'], 'founder-owned groups Tor belongs to, newest first');
assert.equal(tor.groups[0].role, 'member');
assert.equal(tor.main_chat_group_id, 'felles');
assert.equal(tor.world_member, true, 'member of the main group = World member (2A)');
assert.equal(tor.owner_email, 'post@nibi.test');
assert.equal(tor.world_name, 'Nibi');
assert.ok(!tor.groups.some(group => group.id === 'tor-nibi'), 'a name containing "nibi" does not make a World group');
assert.ok(!tor.groups.some(group => group.id === 'hemmelig'), 'founder groups the caller is not in stay hidden (1C)');
assert.ok(!tor.groups.some(group => group.id === 'gammel'), 'archived groups are left out');
assert.deepEqual((await list('tor', 'WWW.Nibi.Test')).groups.map(group => group.id), ['felles', 'kurs'], 'www. and case are ignored');
assert.deepEqual((await list('tor', 'nibi.test', 'Authorization')).groups.map(group => group.id), ['felles', 'kurs'], 'Bearer also accepted');

// Other members see only their own memberships.
const inger = await list('inger', 'nibi.test');
assert.deepEqual([inger.groups.map(group => group.id), inger.world_member], [['felles'], true]);
const outsider = await list('outsider', 'nibi.test');
assert.deepEqual([outsider.groups, outsider.world_member], [[], false]);

// The main group counts even if someone else owns it (it was set explicitly for the World).
chat.db.exec("UPDATE groups SET created_by = 'inger' WHERE id = 'felles'");
assert.deepEqual((await list('tor', 'nibi.test')).groups.map(group => group.id), ['felles', 'kurs']);
chat.db.exec("UPDATE groups SET created_by = 'founder' WHERE id = 'felles'");

// Two registry rows for one domain: both founders' groups count; no main group configured.
const two = await list('tor', 'two.test');
assert.deepEqual(two.groups.map(group => group.id).sort(), ['co-gruppe', 'felles', 'kurs']);
assert.deepEqual([two.main_chat_group_id, two.world_member], [null, false]);

// Errors
assert.equal((await list('tor', 'unknown.test')).status, 404);
assert.equal((await list('tor', '')).status, 400);
assert.equal((await list('tor', undefined)).status, 400);
assert.equal((await list('tor', 'ghost.test')).status, 409, 'founder email without an account');
assert.equal((await list(null, 'nibi.test')).status, 401);
assert.equal((await call(null, 'GET', '/world-chat-groups?domain=nibi.test', null, { 'X-API-Token': 'nope' })).status, 401);

const spec = await (await call(null, 'GET', '/openapi.json')).json();
assert.equal(spec.paths['/world-chat-groups'].get.operationId, 'listWorldChatGroups');

console.log('PASS world-chat-groups: founder-owned + main group, member-only, names ignored, archived/private excluded, www/case, Bearer, several founders, 400/401/404/409, documented');
