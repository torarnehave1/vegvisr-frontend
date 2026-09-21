// Group message edits (2026-09-21): only the author edits text; transcripts are voice-only,
// any member may fill an empty one (web + Flutter transcribe other people's voice notes),
// only the author changes an existing one. Real SQLite via fixture().
//
// Run:  node test-group-message-edit.mjs   (runs the base direct-chat test first)
import assert from 'node:assert/strict';
import { fixture } from './test-direct-chat.mjs';

const { chat, call } = fixture();
// The fixture's sms-gateway fake answers every login with role Superadmin: an override would show here.
chat.db.exec(`INSERT INTO groups(id,name,created_by,created_at,updated_at) VALUES ('kor','Koret','tor',1,1);
  INSERT INTO group_members(group_id,user_id,role,joined_at) VALUES ('kor','tor','owner',1),('kor','inger','member',1);
  INSERT INTO group_messages(group_id,user_id,body,created_at,message_type,reply_to_id) VALUES ('kor','tor','Original',1,'text',NULL);
  INSERT INTO group_messages(group_id,user_id,body,created_at,message_type,audio_url) VALUES ('kor','inger','Talemelding',2,'voice','https://voice.vegvisr.org/audio?key=voice%2Fkor%2F1.webm');
  INSERT INTO group_messages(group_id,user_id,body,created_at,message_type) VALUES ('kor','inger','Ingers tekst',3,'text');
  INSERT INTO group_messages(group_id,user_id,body,created_at,message_type) VALUES ('kor','tor','poll::p1::Spørsmål?',4,'poll');`);
const id = body => chat.db.prepare('SELECT id FROM group_messages WHERE body = ?').get(body).id;
const [text, voice, ingerText, poll] = ['Original', 'Talemelding', 'Ingers tekst', 'poll::p1::Spørsmål?'].map(id);
const patch = (user, messageId, fields) => call(null, 'PATCH', `/groups/kor/messages/${messageId}`, { user_id: user, phone: '123', ...fields });
const json = async response => ({ status: response.status, ...(await response.json()) });
const stored = messageId => chat.db.prepare('SELECT body, transcript_text, transcript_lang, transcription_status FROM group_messages WHERE id = ?').get(messageId);

// Text: author only, no owner/Superadmin override.
assert.equal((await patch('inger', text, { body: 'Endret av Inger' })).status, 403, 'member cannot edit another member\'s text');
assert.equal((await patch('tor', ingerText, { body: 'Endret av eieren' })).status, 403, 'group owner (Superadmin) cannot edit another member\'s text');
assert.equal(stored(text).body, 'Original');
assert.equal(stored(ingerText).body, 'Ingers tekst');
const own = await json(await patch('tor', text, { body: 'Rettet av Tor' }));
assert.equal(own.status, 200);
assert.equal(own.message.body, 'Rettet av Tor');
assert.ok('reply_to_id' in own.message && 'media_url' in own.message, 'response carries the full message');
assert.equal((await patch('tor', text, { body: '   ' })).status, 400, 'empty text refused');
assert.equal((await patch('tor', poll, { body: 'poll::p2::kapret' })).status, 400, 'poll bodies are not editable');
assert.equal((await patch('outsider', text, { body: 'x' })).status, 403, 'non-member refused');

// Transcripts: voice only; any member fills an empty one; only the author changes it afterwards.
assert.equal((await patch('tor', text, { transcript_text: 'x' })).status, 400, 'no transcript on text messages');
const filled = await json(await patch('tor', voice, { transcript_text: 'Hei fra Inger', transcript_lang: 'no', transcription_status: 'complete' }));
assert.equal(filled.status, 200, 'another member may fill an empty transcript (web + Flutter transcribe flow)');
assert.equal(stored(voice).transcript_text, 'Hei fra Inger');
assert.equal((await patch('tor', voice, { transcript_text: 'Hei fra Inger', transcription_status: 'complete' })).status, 200, 'repeating the stored transcript is allowed (Flutter re-save)');
assert.equal((await patch('tor', voice, { transcript_text: 'Forfalsket' })).status, 403, 'another member cannot change an existing transcript');
assert.equal((await patch('tor', voice, { transcription_status: 'failed' })).status, 403, 'another member cannot downgrade a finished transcript');
assert.equal((await patch('tor', voice, { transcript_lang: 'en' })).status, 403, 'another member cannot change its language');
assert.equal(stored(voice).transcript_text, 'Hei fra Inger');
assert.equal((await patch('inger', voice, { transcript_text: 'Hei fra Inger, rettet' })).status, 200, 'the author corrects her own transcript');
assert.equal(stored(voice).transcript_text, 'Hei fra Inger, rettet');
assert.equal((await patch('inger', voice, { body: 'Ny tittel' })).status, 200, 'the author renames her voice message');

console.log('PASS group message edit: author-only text (no owner/Superadmin override), full message returned, empty/poll bodies refused, voice-only transcripts, members fill empty transcripts, only the author changes existing ones');
