// Private-conversation parity (2026-09-21): voice, attachments, transcription, replies, reactions,
// edit/delete, polls and forwarding through the participant-scoped /direct API, with media served
// only through signed participant links. Real SQLite (node:sqlite) + in-memory R2 via fixture().
//
// Run:  node test-direct-chat-parity.mjs   (runs the base direct-chat test first)
import assert from 'node:assert/strict';
import { fixture } from './test-direct-chat.mjs';

const { chat, identities, media, transcriptions, call, upload, fetch } = fixture();
const json = async response => ({ status: response.status, ...(await response.json()) });
identities.db.prepare('INSERT INTO config VALUES (?, ?, ?, ?, ?)').run('ola', 'token-ola', 'Ola Nordmann', 'ola@test.invalid', '{}');
chat.db.exec(`INSERT INTO group_members(group_id,user_id,role,joined_at) VALUES ('nibi','ola','member',1);
  INSERT INTO groups(id,name,created_by,created_at,updated_at) VALUES ('kor','Koret','tor',1,1);
  INSERT INTO group_members(group_id,user_id,role,joined_at) VALUES ('kor','tor','owner',1);`);

const open = async (user, peer) => (await json(await call(user, 'POST', '/direct/conversations', { source_group_id: 'nibi', peer_id: peer }))).group.id;
const dm = await open('tor', 'inger');
const dmOla = await open('tor', 'ola');
const bytes = text => new TextEncoder().encode(text);

// Spec documents every new route.
const spec = await (await call(null, 'GET', '/openapi.json')).json();
for (const path of ['/direct/{groupId}/media', '/direct/media', '/direct/{groupId}/transcribe', '/direct/{groupId}/messages/{messageId}', '/direct/{groupId}/reactions', '/direct/{groupId}/messages/{messageId}/reactions', '/direct/{groupId}/polls', '/direct/{groupId}/polls/{pollId}/vote', '/direct/forward', '/direct/forward-targets']) {
  assert.ok(spec.paths[path], `openapi documents ${path}`);
}

// Text send now returns the saved message (the v0.2.0 client required it and failed without).
const text = await json(await call('tor', 'POST', `/direct/${dm}/messages`, { body: 'Hei Inger' }));
assert.equal(text.status, 201);
assert.equal(text.message.body, 'Hei Inger');
assert.equal(text.message.user_id, 'tor');

// Attachments: upload is participant-only, typed, sized, and stored under the conversation prefix.
assert.equal((await upload('outsider', dm, bytes('x'), 'image/png', 'a.png')).status, 403);
assert.equal((await upload('tor', dm, bytes('<svg/>'), 'image/svg+xml', 'a.svg')).status, 400);
assert.equal((await upload('tor', dm, bytes('<html>'), 'text/html', 'a.html')).status, 400);
assert.equal((await fetch(new Request(`https://chat.test/direct/${dm}/media`, { method: 'POST', headers: { Authorization: 'Bearer token-tor', 'Content-Type': 'image/png' }, body: bytes('x') }))).status, 411);
const image = await json(await upload('tor', dm, bytes('PNG-BYTES'), 'image/png', 'bilde.png'));
assert.equal(image.status, 201);
assert.match(image.objectKey, new RegExp(`^media/${dm}/[0-9a-f-]+\\.png$`));
assert.equal(media.objects.get(image.objectKey).customMetadata.userId, 'tor');
// Slots follow sorted user ids: inger = l (low), tor = h (high).
assert.match(image.mediaUrl, /\/direct\/media\?key=.*&r=h&exp=\d+&sig=/);

// Media messages must reference the sender's own upload in this conversation; client URLs are refused.
assert.equal((await call('tor', 'POST', `/direct/${dm}/messages`, { message_type: 'image', media_url: 'https://example.com/x.png' })).status, 400);
assert.equal((await call('inger', 'POST', `/direct/${dm}/messages`, { message_type: 'image', media_object_key: image.objectKey })).status, 400);
assert.equal((await call('tor', 'POST', `/direct/${dmOla}/messages`, { message_type: 'image', media_object_key: image.objectKey })).status, 400);
assert.equal((await call('tor', 'POST', `/direct/${dm}/messages`, { message_type: 'video', media_object_key: image.objectKey })).status, 400);
const imageMessage = await json(await call('tor', 'POST', `/direct/${dm}/messages`, { message_type: 'image', media_object_key: image.objectKey, body: 'Se her' }));
assert.equal(imageMessage.status, 201);
assert.equal(imageMessage.message.media_content_type, 'image/png');
assert.equal(imageMessage.message.media_size, 9);

// Signed links: the reader's history carries a link for their slot; it serves bytes without auth, supports Range.
const ingerHistory = await json(await call('inger', 'GET', `/direct/${dm}/messages?latest=1`));
const ingerImage = ingerHistory.messages.find(message => message.id === imageMessage.message.id);
assert.match(ingerImage.media_url, /&r=l&/);
const served = await fetch(new Request(ingerImage.media_url));
assert.equal(served.status, 200);
assert.equal(await served.text(), 'PNG-BYTES');
assert.equal(served.headers.get('Cache-Control'), 'private, max-age=300');
const ranged = await fetch(new Request(ingerImage.media_url, { headers: { Range: 'bytes=0-2' } }));
assert.equal(ranged.status, 206);
assert.equal(await ranged.text(), 'PNG');
assert.equal((await fetch(new Request(ingerImage.media_url.replace(/sig=[^&]+/, 'sig=AAAA')))).status, 403);
assert.equal((await fetch(new Request(ingerImage.media_url.replace('&r=l&', '&r=h&')))).status, 403);
const signingKey = await crypto.subtle.importKey('raw', new TextEncoder().encode('vegvisr-direct-media-v1:test-internal-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const past = Math.floor(Date.now() / 1000) - 10;
const pastSig = Buffer.from(await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(`${image.objectKey}\nl\n${past}`))).toString('base64url');
assert.equal((await fetch(new Request(`https://chat.test/direct/media?${new URLSearchParams({ key: image.objectKey, r: 'l', exp: String(past), sig: pastSig })}`))).status, 403, 'expired link refused');
assert.equal((await call(null, 'GET', `/media?key=${encodeURIComponent(image.objectKey)}`)).status, 403, 'public /media refuses private keys');

// Voice: private recording, signed audio_url, server-side transcription by the other participant.
const audio = await json(await upload('tor', dm, bytes('WEBM-AUDIO'), 'audio/webm;codecs=opus', 'voice_1.webm'));
assert.equal(audio.contentType, 'audio/webm');
const voice = await json(await call('tor', 'POST', `/direct/${dm}/messages`, { message_type: 'voice', media_object_key: audio.objectKey, audio_duration_ms: 4200, body: 'Talemelding' }));
assert.equal(voice.status, 201);
assert.match(voice.message.audio_url, /\/direct\/media\?/);
assert.equal(voice.message.media_url, null);
assert.equal(voice.message.transcription_status, 'pending');
assert.equal(voice.message.audio_duration_ms, 4200);
assert.equal((await call('outsider', 'POST', `/direct/${dm}/transcribe`, { message_id: voice.message.id })).status, 403);
const transcribed = await json(await call('inger', 'POST', `/direct/${dm}/transcribe`, { message_id: voice.message.id }));
assert.equal(transcribed.status, 200);
assert.equal(transcribed.message.transcript_text, 'Hei fra talemeldingen');
assert.equal(transcribed.message.transcription_status, 'complete');
assert.equal(transcriptions.at(-1).url, 'https://openai-worker/audio');
assert.equal(transcriptions.at(-1).name, 'voice.webm');
assert.equal(new TextDecoder().decode(transcriptions.at(-1).bytes), 'WEBM-AUDIO');
// Dictation: transcribe my own upload by key; another participant's upload key is refused.
const dictation = await json(await upload('tor', dm, bytes('DICTATE'), 'audio/mp4', 'dictate.m4a'));
assert.equal((await json(await call('tor', 'POST', `/direct/${dm}/transcribe`, { object_key: dictation.objectKey }))).text, 'Hei fra talemeldingen');
assert.equal((await call('inger', 'POST', `/direct/${dm}/transcribe`, { object_key: dictation.objectKey })).status, 400);

// Replies stay inside the conversation.
const reply = await json(await call('inger', 'POST', `/direct/${dm}/messages`, { body: 'Fint bilde', reply_to_id: imageMessage.message.id }));
assert.equal(reply.message.reply_to_id, imageMessage.message.id);
chat.db.exec("INSERT INTO group_messages(group_id,user_id,body,created_at) VALUES ('nibi','tor','Felles melding',5)");
const groupMessageId = chat.db.prepare("SELECT id FROM group_messages WHERE group_id='nibi'").get().id;
assert.equal((await call('inger', 'POST', `/direct/${dm}/messages`, { body: 'x', reply_to_id: groupMessageId })).status, 404);

// Reactions: toggle, list, scoped to this conversation; group route no longer reveals private counts.
const reacted = await json(await call('inger', 'POST', `/direct/${dm}/messages/${text.message.id}/reactions`, { reaction: 'heart' }));
assert.deepEqual([reacted.added, reacted.reactions, reacted.my_reactions], [true, { heart: 1 }, ['heart']]);
assert.equal((await call('inger', 'POST', `/direct/${dm}/messages/${groupMessageId}/reactions`, { reaction: 'heart' })).status, 404);
assert.equal((await call('outsider', 'POST', `/direct/${dm}/messages/${text.message.id}/reactions`, { reaction: 'heart' })).status, 403);
const listed = await json(await call('tor', 'GET', `/direct/${dm}/reactions?message_ids=${text.message.id},${groupMessageId}`));
assert.deepEqual(listed.reactions, { [text.message.id]: { counts: { heart: 1 }, mine: [] } });
const leak = await json(await call(null, 'GET', `/groups/nibi/reactions?user_id=tor&phone=123&message_ids=${text.message.id}`));
assert.deepEqual(leak.reactions, {}, 'group reactions route ignores private message ids');
assert.equal((await json(await call('inger', 'POST', `/direct/${dm}/messages/${text.message.id}/reactions`, { reaction: 'heart' }))).added, false);

// Edit and delete: author only; media is removed with the last message that uses it.
assert.equal((await call('inger', 'PATCH', `/direct/${dm}/messages/${text.message.id}`, { body: 'hacked' })).status, 403);
assert.equal((await json(await call('tor', 'PATCH', `/direct/${dm}/messages/${text.message.id}`, { body: 'Hei igjen, Inger' }))).message.body, 'Hei igjen, Inger');
assert.equal((await call('tor', 'PATCH', `/direct/${dm}/messages/${imageMessage.message.id}`, { body: 'x' })).status, 400);
assert.equal((await json(await call('tor', 'PATCH', `/direct/${dm}/messages/${voice.message.id}`, { transcript_text: 'Rettet tekst' }))).message.transcript_text, 'Rettet tekst');
assert.equal((await call('inger', 'DELETE', `/direct/${dm}/messages/${imageMessage.message.id}`)).status, 403);

// Polls: create, read, vote, creator-only close; legacy /polls routes stay closed to private polls.
const created = await json(await call('tor', 'POST', `/direct/${dm}/polls`, { question: 'Møtes fredag?', options: ['Ja', 'Nei'] }));
assert.equal(created.status, 201);
assert.equal(created.message.message_type, 'poll');
assert.equal(created.message.body, `poll::${created.poll.id}::Møtes fredag?`);
const voted = await json(await call('inger', 'POST', `/direct/${dm}/polls/${created.poll.id}/vote`, { option_index: 0 }));
assert.deepEqual([voted.my_vote, voted.votes, voted.total_votes], [0, { 0: 1 }, 1]);
assert.equal((await json(await call('tor', 'GET', `/direct/${dm}/polls/${created.poll.id}`))).poll.total_votes, 1);
assert.equal((await call('outsider', 'GET', `/direct/${dm}/polls/${created.poll.id}`)).status, 403);
assert.equal((await call(null, 'GET', `/polls/${created.poll.id}?user_id=inger&phone=123`)).status, 403);
assert.equal((await call('inger', 'POST', `/direct/${dm}/polls/${created.poll.id}/close`)).status, 403);
assert.equal((await call('tor', 'POST', `/direct/${dm}/polls/${created.poll.id}/close`)).status, 200);
assert.equal((await call('inger', 'POST', `/direct/${dm}/polls/${created.poll.id}/vote`, { option_index: 1 })).status, 400);

// Forwarding: both ends checked; private bytes are copied, never exposed through the source key.
const targets = await json(await call('tor', 'GET', '/direct/forward-targets?source_group_id=nibi'));
assert.deepEqual(targets.groups.map(group => [group.id, group.kind]).sort(), [[dm, 'direct'], [dmOla, 'direct'], ['kor', 'group'], ['nibi', 'group']].sort());
assert.equal(targets.groups.find(group => group.id === dmOla).name, 'Ola Nordmann');
assert.equal((await call('outsider', 'GET', '/direct/forward-targets?source_group_id=nibi')).status, 403);
const toGroup = await json(await call('tor', 'POST', '/direct/forward', { source_group_id: dm, message_id: imageMessage.message.id, target_group_id: 'kor' }));
assert.equal(toGroup.status, 201);
assert.match(toGroup.message.media_object_key, /^media\/kor\//);
assert.match(toGroup.message.media_url, /^https:\/\/chat\.test\/media\?key=media%2Fkor%2F/);
assert.equal(toGroup.message.forwarded_from_user_name, 'Tor Arne Have');
assert.equal(new TextDecoder().decode(media.objects.get(toGroup.message.media_object_key).bytes), 'PNG-BYTES');
assert.equal((await call(null, 'GET', `/media?key=${encodeURIComponent(image.objectKey)}`)).status, 403, 'source stays private after forward');
const toDirect = await json(await call('tor', 'POST', '/direct/forward', { source_group_id: dm, message_id: voice.message.id, target_group_id: dmOla }));
assert.match(toDirect.message.media_object_key, new RegExp(`^media/${dmOla}/`));
assert.match(toDirect.message.audio_url, /\/direct\/media\?/);
assert.equal(toDirect.message.transcript_text, 'Rettet tekst');
const fromGroup = await json(await call('inger', 'POST', '/direct/forward', { source_group_id: 'nibi', message_id: groupMessageId, target_group_id: dm }));
assert.equal(fromGroup.status, 201);
assert.equal(fromGroup.message.body, 'Felles melding');
assert.equal((await call('inger', 'POST', '/direct/forward', { source_group_id: dm, message_id: text.message.id, target_group_id: 'kor' })).status, 403, 'not a member of target');
assert.equal((await call('ola', 'POST', '/direct/forward', { source_group_id: dm, message_id: text.message.id, target_group_id: dmOla })).status, 403, 'not a participant of source');
assert.equal((await call('tor', 'POST', '/direct/forward', { source_group_id: dm, message_id: created.message.id, target_group_id: 'kor' })).status, 400, 'polls are not forwarded');
assert.equal((await call('tor', 'POST', '/direct/forward', { source_group_id: 'nibi', message_id: groupMessageId, target_group_id: 'kor' })).status, 400, 'group-to-group uses the group route');

// Delete removes reactions and the private object once nothing references it.
const imageKey = image.objectKey;
assert.equal((await call('tor', 'DELETE', `/direct/${dm}/messages/${imageMessage.message.id}`)).status, 200);
assert.equal(media.objects.has(imageKey), false);
assert.equal(media.objects.has(toGroup.message.media_object_key), true, 'the forwarded copy is independent');

// Revocation: once a participant leaves the community, links, uploads and actions stop working.
const liveLink = (await json(await call('tor', 'GET', `/direct/${dm}/messages?latest=1`))).messages.find(message => message.id === voice.message.id).audio_url;
assert.equal((await fetch(new Request(liveLink))).status, 200);
chat.db.prepare("DELETE FROM group_members WHERE group_id='nibi' AND user_id='inger'").run();
assert.equal((await fetch(new Request(liveLink))).status, 403);
assert.equal((await upload('tor', dm, bytes('x'), 'image/png', 'a.png')).status, 403);
assert.equal((await call('tor', 'POST', `/direct/${dm}/transcribe`, { message_id: voice.message.id })).status, 403);
assert.equal((await call('tor', 'GET', `/direct/${dm}/reactions?message_ids=${text.message.id}`)).status, 403);

console.log('PASS direct chat parity: text returns message, participant-only uploads, typed media messages, signed links (range, tamper, expiry, revocation), public /media refuses private keys, voice + server transcription + dictation, replies, reactions (scoped, group leak closed), author-only edit/delete with media cleanup, polls, forwarding with private copies and both-end checks');
