// Contact card in private conversations (2026-09-22, architect's decision B): phone and email are
// hidden unless the member opts in, per community. Real SQLite via fixture().
//
// Run:  node test-direct-contact.mjs   (runs the base direct-chat test first)
import assert from 'node:assert/strict';
import { fixture } from './test-direct-chat.mjs';

const { identities, call } = fixture();
identities.db.exec(`ALTER TABLE config ADD COLUMN phone TEXT; ALTER TABLE config ADD COLUMN profile_image_url TEXT; ALTER TABLE config ADD COLUMN profileimage TEXT;
  UPDATE config SET phone = '+4790000001' WHERE user_id = 'tor'; UPDATE config SET phone = '+4790000002' WHERE user_id = 'inger';`);
const json = async response => ({ status: response.status, ...(await response.json()) });
const dm = (await json(await call('tor', 'POST', '/direct/conversations', { source_group_id: 'nibi', peer_id: 'inger' }))).group.id;

// Default: nothing shared.
let card = await json(await call('tor', 'GET', `/direct/${dm}/peer`));
assert.equal(card.status, 200);
assert.deepEqual([card.name, card.phone, card.email, card.shares], ['Inger Hildrum', null, null, { phone: false, email: false }]);
let mine = await json(await call('inger', 'GET', '/direct/contact-sharing?source_group_id=nibi'));
assert.deepEqual([mine.phone, mine.email, mine.has_phone, mine.has_email], [false, false, true, true]);

// Inger shares her phone only.
mine = await json(await call('inger', 'PUT', '/direct/contact-sharing', { source_group_id: 'nibi', phone: true }));
assert.deepEqual([mine.status, mine.phone, mine.email], [200, true, false]);
card = await json(await call('tor', 'GET', `/direct/${dm}/peer`));
assert.deepEqual([card.phone, card.email], ['+4790000002', null]);
// Then email too; other profile data is kept.
identities.db.exec(`UPDATE config SET data = json_set(data, '$.nibi_notifications', json('{"message_updates":true}')) WHERE user_id = 'inger'`);
await call('inger', 'PUT', '/direct/contact-sharing', { source_group_id: 'nibi', email: true });
card = await json(await call('tor', 'GET', `/direct/${dm}/peer`));
assert.deepEqual([card.phone, card.email], ['+4790000002', 'inger@test.invalid']);
const stored = JSON.parse(identities.db.prepare("SELECT data FROM config WHERE user_id = 'inger'").get().data);
assert.deepEqual(stored.contact_sharing, { nibi: { phone: true, email: true } });
assert.equal(stored.profile.name, 'Inger Hildrum', 'profile kept');
assert.equal(stored.nibi_notifications.message_updates, true, 'other settings kept');
// Turning off hides again.
await call('inger', 'PUT', '/direct/contact-sharing', { source_group_id: 'nibi', phone: false, email: false });
card = await json(await call('tor', 'GET', `/direct/${dm}/peer`));
assert.deepEqual([card.phone, card.email], [null, null]);

// Access: only participants read a card; only community members set sharing; bad input refused.
assert.equal((await call('outsider', 'GET', `/direct/${dm}/peer`)).status, 403);
assert.equal((await call('outsider', 'PUT', '/direct/contact-sharing', { source_group_id: 'nibi', phone: true })).status, 403);
assert.equal((await call('inger', 'PUT', '/direct/contact-sharing', { source_group_id: 'nibi', phone: 'yes' })).status, 400);
assert.equal((await call('inger', 'PUT', '/direct/contact-sharing', { source_group_id: 'nibi"x', phone: true })).status, 403);
assert.equal((await call(null, 'GET', `/direct/${dm}/peer`)).status, 401);

console.log('PASS direct contact card: hidden by default, per-community opt-in for phone and email, other profile data kept, participants only');
