export const isDirectGroup = value => typeof value === 'string' && value.startsWith('dm_');

const sourceParameter = { name: 'source_group_id', in: 'query', required: true, schema: { type: 'string' }, description: 'Shared community group ID. Both people must remain members.' };
const directResponses = { 200: { description: 'Participant-scoped result' }, 400: { description: 'Invalid input' }, 401: { description: 'Missing or invalid bearer token' }, 403: { description: 'Not a participant or no longer a community member' } };
const directSecurity = [{ directSession: [] }];
const groupPath = { name: 'groupId', in: 'path', required: true, schema: { type: 'string' } };
const messagePath = { name: 'messageId', in: 'path', required: true, schema: { type: 'integer' } };
const pollPath = { name: 'pollId', in: 'path', required: true, schema: { type: 'string' } };
const jsonBody = (properties, required = []) => ({ required: true, content: { 'application/json': { schema: { type: 'object', required, properties } } } });

// Private media is never served by the public /media route. Readers get links signed for
// their participant slot; every fetch re-checks that both people are still in the community.
const MEDIA_LINK_SECONDS = 12 * 60 * 60;
const MAX_MEDIA_BYTES = 200 * 1024 * 1024;
const MAX_DURATION_MS = 6 * 60 * 60 * 1000;
const MEDIA_TYPES = { voice: 'audio/', image: 'image/', video: 'video/', pdf: 'application/pdf' };
const FORWARDABLE_TYPES = ['text', 'voice', 'image', 'video', 'pdf'];
const VALID_REACTIONS = ['thumbs_up', 'heart', 'smile'];
const TRANSCRIPTION_STATES = ['pending', 'complete', 'none', 'failed'];
const EXTENSIONS = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic',
  'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm',
  'application/pdf': '.pdf',
  'audio/webm': '.webm', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/x-wav': '.wav',
};
export const MESSAGE_COLUMNS = `id, group_id, user_id, body, created_at, message_type, audio_url, audio_duration_ms,
  transcript_text, transcript_lang, transcription_status, media_url, media_object_key, media_content_type, media_size,
  video_thumbnail_url, video_duration_ms, sender_avatar_url, reply_to_id,
  forwarded_from_message_id, forwarded_from_user_id, forwarded_from_user_name`;

/** Group id owning a chat media object key (media/<groupId>/<file>), or null. */
export const mediaGroupOf = key => (typeof key === 'string' && /^media\/[^/]+\/[^/]+$/.test(key) && !key.includes('..')) ? key.split('/')[1] : null;

const encoder = new TextEncoder();
const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64url = value => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
};
async function mediaSigningKey(env) {
  const secret = env.DIRECT_MEDIA_SECRET || env.INTERNAL_SHARED_SECRET;
  if (!secret) return null;
  return crypto.subtle.importKey('raw', encoder.encode('vegvisr-direct-media-v1:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signedMediaUrl(env, origin, key, reader) {
  const signingKey = await mediaSigningKey(env);
  if (!signingKey) return null;
  const exp = Math.floor(Date.now() / 1000) + MEDIA_LINK_SECONDS;
  const signature = await crypto.subtle.sign('HMAC', signingKey, encoder.encode(`${key}\n${reader}\n${exp}`));
  return `${origin}/direct/media?${new URLSearchParams({ key, r: reader, exp: String(exp), sig: base64url(signature) })}`;
}
async function verifyMediaSignature(env, key, reader, exp, signature) {
  const signingKey = await mediaSigningKey(env);
  if (!signingKey) return false;
  try {
    return await crypto.subtle.verify('HMAC', signingKey, fromBase64url(signature), encoder.encode(`${key}\n${reader}\n${exp}`));
  } catch { return false; }
}

const escapeAlertHtml = value => String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
async function sendDirectMessageAlerts(env, groupId, authorId, body) {
  if (!env.IDENTITY_DB || !env.EMAIL_WORKER?.fetch) return;
  try {
    const source = await env.CHAT_DB.prepare(
      `SELECT g2.id, g2.name FROM direct_chats d JOIN groups g2 ON g2.id = d.source_group_id
       WHERE d.group_id = ? AND g2.archived_at IS NULL`
    ).bind(groupId).first();
    if (!source || String(source.name || '').trim().toLocaleLowerCase('nb') !== 'nibi felles') return;
    const members = await env.CHAT_DB.prepare(
      "SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ? AND role != 'bot'"
    ).bind(groupId, authorId).all();
    const ids = (members.results || []).map(row => row.user_id).filter(Boolean);
    if (!ids.length) return;
    const profiles = await env.IDENTITY_DB.prepare(
      `SELECT user_id, email, data FROM config WHERE user_id IN (SELECT value FROM json_each(?))`
    ).bind(JSON.stringify(ids)).all();
    await Promise.all((profiles.results || []).flatMap(profile => {
      let data = {};
      try { data = profile.data ? JSON.parse(profile.data) : {}; } catch {}
      if (!profile.email || data?.nibi_notifications?.message_updates !== true) return [];
      const excerpt = escapeAlertHtml(String(body || '').trim().slice(0, 240));
      const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#0f172a;line-height:1.5"><p>Det er en ny privat melding i NIBI.</p><p>${excerpt}</p><p><a href="https://minside.nibi.no/" style="display:inline-block;padding:10px 18px;background:#17634b;color:#fff;border-radius:6px;text-decoration:none">Åpne Min side</a></p></div>`;
      return [env.EMAIL_WORKER.fetch('https://email-worker/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-auth': env.INTERNAL_SHARED_SECRET || '', 'x-internal-caller': 'post@nibi.no' },
        body: JSON.stringify({ fromEmail: 'post@nibi.no', toEmail: profile.email, subject: 'NIBI: Ny privat melding', html }),
      }).catch(error => console.warn('[NIBI alert] direct message email failed:', error?.message || error))];
    }));
  } catch (error) {
    console.warn('[NIBI alert] direct message notification failed:', error?.message || error);
  }
}
const alertExcerpt = (type, body) => ({
  voice: 'Talemelding', image: 'Bilde', video: 'Video', pdf: `PDF: ${body || 'dokument'}`, poll: `Avstemning: ${body}`,
}[type] || body);

export const directChatPaths = {
  '/direct/people': { get: {
    operationId: 'listDirectChatPeople', summary: 'List other people in a shared community', security: directSecurity,
    description: 'Returns people [{user_id,name}] and next_offset (null on the last page). Excludes the caller and bots. Search and pagination are server-side; no phone numbers or credentials are returned.',
    parameters: [sourceParameter, { name: 'q', in: 'query', schema: { type: 'string' } }, { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } }], responses: directResponses,
  } },
  '/direct/conversations': {
    get: { operationId: 'listDirectChats', summary: 'List my private conversations', security: directSecurity,
      description: 'Returns groups [{id,name,peer_id,kind,updated_at}]. name is the OTHER participant, kind is direct. Community administrators have no override.',
      parameters: [sourceParameter], responses: directResponses },
    post: { operationId: 'openDirectChat', summary: 'Open or create a fixed two-person conversation', security: directSecurity,
      description: 'Returns group {id,name,peer_id,kind,updated_at}. Idempotent for the unordered participant pair within source_group_id. Creation makes the conversation visible to both people. No joins, invitations, bots or third participants. Uses existing group/message storage, not end-to-end encryption.',
      requestBody: jsonBody({ source_group_id: { type: 'string' }, peer_id: { type: 'string' } }, ['source_group_id', 'peer_id']), responses: directResponses },
  },
  '/direct/{groupId}/messages': {
    parameters: [groupPath],
    get: { operationId: 'readDirectMessages', summary: 'Read participant-only messages', security: directSecurity,
      description: 'Returns messages (same fields as group messages) and paging {has_more,next_before}. latest=1 gives the newest page in chronological order; after polls newer messages by id; before pages older messages. Private media and voice come back as media_url/audio_url links signed for the caller (valid 12 h, re-checked on every fetch). Both people must remain members of the source community.',
      parameters: ['after', 'before', 'limit', 'latest'].map(name => ({ name, in: 'query', schema: { type: 'integer', minimum: name === 'limit' ? 1 : 0 } })), responses: directResponses },
    post: { operationId: 'sendDirectMessage', summary: 'Send a message to the other participant', security: directSecurity,
      description: 'Sender is derived from the bearer token, never from user_id, email, phone or role in the request. message_type text (body 1-10000 chars), voice, image, video or pdf. Media types need media_object_key from POST /direct/{groupId}/media by the same sender; URLs from the client are refused. Optional reply_to_id (same conversation), audio_duration_ms, video_duration_ms, transcript_text, transcript_lang, transcription_status. Returns 201 {message}.',
      requestBody: jsonBody({ body: { type: 'string', maxLength: 10000 }, message_type: { type: 'string', enum: ['text', 'voice', 'image', 'video', 'pdf'] }, media_object_key: { type: 'string' }, reply_to_id: { type: 'integer' }, audio_duration_ms: { type: 'integer' }, video_duration_ms: { type: 'integer' }, transcript_text: { type: 'string' }, transcript_lang: { type: 'string' }, transcription_status: { type: 'string' } }),
      responses: { ...directResponses, 201: { description: 'Message saved; returns message' } } },
  },
  '/direct/{groupId}/messages/{messageId}': {
    parameters: [groupPath, messagePath],
    patch: { operationId: 'editDirectMessage', summary: 'Edit my own message', security: directSecurity,
      description: 'Author only. body for text messages; transcript_text/transcript_lang/transcription_status for voice messages. Returns {message}.',
      requestBody: jsonBody({ body: { type: 'string' }, transcript_text: { type: 'string' }, transcript_lang: { type: 'string' }, transcription_status: { type: 'string' } }), responses: directResponses },
    delete: { operationId: 'deleteDirectMessage', summary: 'Delete my own message', security: directSecurity,
      description: 'Author only. Removes reactions, poll data and private media that no other message references.', responses: directResponses },
  },
  '/direct/{groupId}/media': { post: {
    operationId: 'uploadDirectMedia', summary: 'Upload a private attachment or voice recording', security: directSecurity,
    description: 'Raw body with Content-Type image/* (not SVG), video/*, audio/* or application/pdf, Content-Length and optional X-File-Name. Max 200 MB. Returns 201 {objectKey, mediaUrl (signed), contentType, size}. The object is stored under media/<groupId>/ and only served through signed participant links.',
    parameters: [groupPath], responses: { ...directResponses, 201: { description: 'Stored' }, 411: { description: 'Content-Length required' }, 413: { description: 'Too large' } },
  } },
  '/direct/media': { get: {
    operationId: 'readDirectMedia', summary: 'Serve private media through a signed participant link', security: [],
    description: 'Links come from direct message responses. Supports Range. Refused when the signature is wrong, the link expired, or either participant left the community.',
    parameters: ['key', 'r', 'exp', 'sig'].map(name => ({ name, in: 'query', required: true, schema: { type: 'string' } })), responses: { 200: { description: 'Media bytes' }, 206: { description: 'Partial content' }, 403: { description: 'Invalid, expired or revoked link' } },
  } },
  '/direct/{groupId}/transcribe': { post: {
    operationId: 'transcribeDirectAudio', summary: 'Transcribe a private recording', security: directSecurity,
    description: 'message_id (any participant; stores the transcript on that voice message) or object_key (a recording the caller uploaded to this conversation, for dictation). Audio never leaves the platform except to the transcription service. Returns {text, language, message?}.',
    parameters: [groupPath], requestBody: jsonBody({ message_id: { type: 'integer' }, object_key: { type: 'string' }, language: { type: 'string' } }), responses: directResponses,
  } },
  '/direct/{groupId}/reactions': { get: {
    operationId: 'listDirectReactions', summary: 'Reactions on messages in this conversation', security: directSecurity,
    description: 'message_ids is a comma-separated list (max 200). Ids from other conversations are ignored. Returns {reactions: {messageId: {counts, mine}}}.',
    parameters: [groupPath, { name: 'message_ids', in: 'query', schema: { type: 'string' } }], responses: directResponses,
  } },
  '/direct/{groupId}/messages/{messageId}/reactions': { post: {
    operationId: 'toggleDirectReaction', summary: 'Toggle my reaction', security: directSecurity,
    description: 'reaction is thumbs_up, heart or smile. Returns {reactions, my_reactions, added}.',
    parameters: [groupPath, messagePath], requestBody: jsonBody({ reaction: { type: 'string', enum: VALID_REACTIONS } }, ['reaction']), responses: directResponses,
  } },
  '/direct/{groupId}/polls': { post: {
    operationId: 'createDirectPoll', summary: 'Create a poll in this conversation', security: directSecurity,
    description: 'question (1-500 chars) and 2-6 options. Returns {poll, message}.',
    parameters: [groupPath], requestBody: jsonBody({ question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } }, ['question', 'options']), responses: directResponses,
  } },
  '/direct/{groupId}/polls/{pollId}': { get: {
    operationId: 'readDirectPoll', summary: 'Read a poll with vote counts and my vote', security: directSecurity,
    parameters: [groupPath, pollPath], responses: directResponses,
  } },
  '/direct/{groupId}/polls/{pollId}/vote': { post: {
    operationId: 'voteDirectPoll', summary: 'Vote or change my vote', security: directSecurity,
    parameters: [groupPath, pollPath], requestBody: jsonBody({ option_index: { type: 'integer' } }, ['option_index']), responses: directResponses,
  } },
  '/direct/{groupId}/polls/{pollId}/close': { post: {
    operationId: 'closeDirectPoll', summary: 'Close my poll', security: directSecurity,
    description: 'Poll creator only; there is no administrator override in private conversations.',
    parameters: [groupPath, pollPath], responses: directResponses,
  } },
  '/direct/forward': { post: {
    operationId: 'forwardWithDirectChat', summary: 'Forward a message into or out of a private conversation', security: directSecurity,
    description: 'The caller must be a participant (private) or member (group) of BOTH source_group_id and target_group_id. Private media is copied into the target, so the source stays private. Polls and system messages are not forwarded. Returns 201 {message}.',
    requestBody: jsonBody({ source_group_id: { type: 'string' }, message_id: { type: 'integer' }, target_group_id: { type: 'string' } }, ['source_group_id', 'message_id', 'target_group_id']), responses: directResponses,
  } },
  '/direct/forward-targets': { get: {
    operationId: 'listForwardTargets', summary: 'Groups and private conversations I can forward to', security: directSecurity,
    description: 'Returns groups: my non-archived groups (kind group) followed by my private conversations in source_group_id (kind direct, named after the other person).',
    parameters: [sourceParameter], responses: directResponses,
  } },
};

async function isCommunityMember(env, groupId, userId) {
  return Boolean(await env.CHAT_DB.prepare(
    `SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id
     WHERE gm.group_id = ? AND gm.user_id = ? AND gm.role != 'bot'
     AND (g.archived_at IS NULL OR g.archived_at = 0)`
  ).bind(groupId, userId).first());
}
async function directRow(env, groupId) {
  return env.CHAT_DB.prepare(
    `SELECT d.*, g.updated_at FROM direct_chats d JOIN groups g ON g.id = d.group_id WHERE d.group_id = ?`
  ).bind(groupId).first();
}
async function participantsStillMembers(env, row) {
  return Boolean(row) && await isCommunityMember(env, row.source_group_id, row.user_low) && await isCommunityMember(env, row.source_group_id, row.user_high);
}

async function serveSignedMedia(request, env, url, helpers, fail) {
  const key = url.searchParams.get('key') || '';
  const reader = url.searchParams.get('r') || '';
  const exp = Number(url.searchParams.get('exp'));
  const signature = url.searchParams.get('sig') || '';
  const groupId = mediaGroupOf(key);
  if (!groupId || !isDirectGroup(groupId) || !['l', 'h'].includes(reader) || !Number.isSafeInteger(exp) || !signature) return fail('Invalid media link');
  if (exp < Math.floor(Date.now() / 1000)) return fail('Media link expired', 403);
  if (!await verifyMediaSignature(env, key, reader, exp, signature)) return fail('Invalid media link', 403);
  if (!await participantsStillMembers(env, await directRow(env, groupId))) return fail('Not a conversation participant', 403);
  if (!helpers.serveMedia) return fail('Media serving not configured', 500);
  const served = await helpers.serveMedia(request, env, new URLSearchParams({ key }));
  const response = new Response(request.method === 'HEAD' ? null : served.body, served);
  response.headers.set('Cache-Control', 'private, max-age=300');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

export async function handleDirectChat(request, env, sendResponse, ctx, helpers = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/direct/')) return null;
  const respond = (data, status = 200) => {
    const response = sendResponse(data, status);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
  const fail = (error, status = 400) => respond({ success: false, error }, status);
  if (url.pathname === '/direct/media' && ['GET', 'HEAD'].includes(request.method)) return serveSignedMedia(request, env, url, helpers, fail);
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return fail('Sign in required', 401);
  const me = await env.IDENTITY_DB.prepare(
    'SELECT user_id FROM config WHERE emailVerificationToken = ?'
  ).bind(token).first();
  if (!me?.user_id) return fail('Invalid session', 401);

  const member = (groupId, userId) => isCommunityMember(env, groupId, userId);
  const profiles = async ids => {
    if (!ids.length) return new Map();
    const { results } = await env.IDENTITY_DB.prepare(
      'SELECT user_id, display_name, email, data FROM config WHERE user_id IN (SELECT value FROM json_each(?))'
    ).bind(JSON.stringify(ids)).all();
    return new Map(results.map(profile => {
      let data = {};
      try { data = JSON.parse(profile.data || '{}'); } catch {}
      return [profile.user_id, { user_id: profile.user_id, name: profile.display_name || data?.profile?.name || data?.profile?.displayName || profile.email }];
    }));
  };
  const present = async rows => {
    const names = await profiles(rows.map(row => row.user_low === me.user_id ? row.user_high : row.user_low));
    return rows.map(row => {
      const peer = row.user_low === me.user_id ? row.user_high : row.user_low;
      return { id: row.group_id, name: names.get(peer)?.name || 'Medlem', peer_id: peer, kind: 'direct', updated_at: row.updated_at };
    });
  };
  const access = async groupId => {
    const row = await directRow(env, groupId);
    if (!row || (row.user_low !== me.user_id && row.user_high !== me.user_id) || !await participantsStillMembers(env, row)) return null;
    return row;
  };
  // A conversation the caller may read and post to: a private one they take part in, or a group they belong to.
  const canUse = async groupId => isDirectGroup(groupId) ? Boolean(await access(groupId)) : member(groupId, me.user_id);
  const origin = url.origin;
  const presentMessage = async (row, groupId, slot) => {
    if (!row) return row;
    const message = { ...row };
    if (isDirectGroup(groupId) && mediaGroupOf(row.media_object_key) === groupId) {
      const link = await signedMediaUrl(env, origin, row.media_object_key, slot);
      if (row.message_type === 'voice') { message.audio_url = link; message.media_url = null; }
      else message.media_url = link;
    }
    return message;
  };
  const readMessage = (groupId, messageId) => env.CHAT_DB.prepare(
    `SELECT ${MESSAGE_COLUMNS} FROM group_messages WHERE id = ? AND group_id = ?`
  ).bind(messageId, groupId).first();
  const ownUpload = async (key, groupId) => {
    if (mediaGroupOf(key) !== groupId || !env.CHAT_MEDIA) return null;
    const head = await env.CHAT_MEDIA.head(key);
    if (!head || head.customMetadata?.groupId !== groupId || head.customMetadata?.userId !== me.user_id) return null;
    return { key, contentType: String(head.httpMetadata?.contentType || '').toLowerCase().split(';')[0].trim(), size: head.size, fileName: head.customMetadata?.originalFileName || '' };
  };
  const removeMediaIfUnused = async key => {
    if (!key || !env.CHAT_MEDIA || !isDirectGroup(mediaGroupOf(key))) return;
    const used = await env.CHAT_DB.prepare('SELECT 1 FROM group_messages WHERE media_object_key = ?').bind(key).first();
    if (!used) await env.CHAT_MEDIA.delete(key);
  };
  const readJsonBody = () => request.json().catch(() => null);
  const pollView = async poll => {
    const { results } = await env.CHAT_DB.prepare(
      'SELECT option_index, COUNT(*) AS cnt FROM poll_votes WHERE poll_id = ? GROUP BY option_index'
    ).bind(poll.id).all();
    const votes = {};
    let total = 0;
    for (const row of results || []) { votes[row.option_index] = row.cnt; total += row.cnt; }
    const mine = await env.CHAT_DB.prepare('SELECT option_index FROM poll_votes WHERE poll_id = ? AND user_id = ?').bind(poll.id, me.user_id).first();
    return { id: poll.id, message_id: poll.message_id, group_id: poll.group_id, question: poll.question, options: JSON.parse(poll.options), created_by: poll.created_by, created_at: poll.created_at, closed_at: poll.closed_at ?? null, votes, total_votes: total, my_vote: mine ? mine.option_index : null };
  };

  if (url.pathname === '/direct/people' && request.method === 'GET') {
    const source = url.searchParams.get('source_group_id');
    if (!source || isDirectGroup(source) || !await member(source, me.user_id)) return fail('Not a community member', 403);
    const { results: members } = await env.CHAT_DB.prepare(
      "SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ? AND role != 'bot' AND user_id NOT LIKE 'bot:%'"
    ).bind(source, me.user_id).all();
    const offset = Number(url.searchParams.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) return fail('Invalid offset');
    const search = (url.searchParams.get('q') || '').trim();
    const { results } = await env.IDENTITY_DB.prepare(
      `WITH people AS (SELECT user_id, COALESCE(NULLIF(display_name, ''),
       CASE WHEN json_valid(data) THEN COALESCE(json_extract(data, '$.profile.name'), json_extract(data, '$.profile.displayName')) END, email) AS name
       FROM config WHERE user_id IN (SELECT value FROM json_each(?)))
       SELECT user_id, name FROM people WHERE (? = '' OR instr(lower(name), lower(?)) > 0)
       ORDER BY name COLLATE NOCASE, user_id LIMIT 51 OFFSET ?`
    ).bind(JSON.stringify(members.map(item => item.user_id)), search, search, offset).all();
    return respond({ success: true, people: results.slice(0, 50), next_offset: results.length > 50 ? offset + 50 : null });
  }

  const listDirect = async source => (await env.CHAT_DB.prepare(
    `SELECT d.*, g.updated_at FROM direct_chats d JOIN groups g ON g.id = d.group_id
     JOIN group_members low ON low.group_id = d.source_group_id AND low.user_id = d.user_low
     JOIN group_members high ON high.group_id = d.source_group_id AND high.user_id = d.user_high
     WHERE d.source_group_id = ? AND (d.user_low = ? OR d.user_high = ?)
     AND low.role != 'bot' AND high.role != 'bot'
     ORDER BY g.updated_at DESC, d.group_id`
  ).bind(source, me.user_id, me.user_id).all()).results;

  if (url.pathname === '/direct/conversations' && request.method === 'GET') {
    const source = url.searchParams.get('source_group_id');
    if (!source || !await member(source, me.user_id)) return fail('Not a community member', 403);
    return respond({ success: true, groups: await present(await listDirect(source)) });
  }

  if (url.pathname === '/direct/conversations' && request.method === 'POST') {
    const body = await readJsonBody();
    const source = body?.source_group_id;
    const peer = body?.peer_id;
    if (typeof source !== 'string' || typeof peer !== 'string' || peer === me.user_id || peer.startsWith('bot:') || isDirectGroup(source)) return fail('Choose another community member');
    if (!await member(source, me.user_id) || !await member(source, peer)) return fail('Not a community member', 403);
    if (!(await profiles([peer])).has(peer)) return fail('Member profile unavailable', 404);
    const [low, high] = [me.user_id, peer].sort();
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify([source, low, high])));
    const groupId = 'dm_' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const now = Date.now();
    await env.CHAT_DB.batch([
      env.CHAT_DB.prepare("INSERT OR IGNORE INTO groups (id, name, created_by, created_at, updated_at) VALUES (?, 'Privat samtale', ?, ?, ?)").bind(groupId, me.user_id, now, now),
      env.CHAT_DB.prepare('INSERT OR IGNORE INTO direct_chats (group_id, source_group_id, user_low, user_high) VALUES (?, ?, ?, ?)').bind(groupId, source, low, high),
      ...[low, high].map(userId => env.CHAT_DB.prepare("INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)").bind(groupId, userId, now)),
    ]);
    const row = await access(groupId);
    if (!row) return fail('Community membership changed', 403);
    return respond({ success: true, group: (await present([row]))[0] });
  }

  if (url.pathname === '/direct/forward-targets' && request.method === 'GET') {
    const source = url.searchParams.get('source_group_id');
    if (!source || isDirectGroup(source) || !await member(source, me.user_id)) return fail('Not a community member', 403);
    const { results: groups } = await env.CHAT_DB.prepare(
      `SELECT g.id, g.name, g.created_by, g.image_url, g.posting_locked, g.created_at, g.updated_at FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = ? AND substr(g.id, 1, 3) != 'dm_' AND (g.archived_at IS NULL OR g.archived_at = 0)
       ORDER BY g.updated_at DESC`
    ).bind(me.user_id).all();
    return respond({ success: true, groups: [...groups.map(group => ({ ...group, kind: 'group' })), ...await present(await listDirect(source))] });
  }

  if (url.pathname === '/direct/forward' && request.method === 'POST') {
    const body = await readJsonBody();
    const source = body?.source_group_id;
    const target = body?.target_group_id;
    const messageId = Number(body?.message_id);
    if (typeof source !== 'string' || typeof target !== 'string' || !source || !target || source === target || !Number.isSafeInteger(messageId) || messageId <= 0) return fail('Choose another conversation');
    if (!isDirectGroup(source) && !isDirectGroup(target)) return fail('Use the group forward route for group-to-group forwarding');
    if (!await canUse(source)) return fail('Not a participant in the source conversation', 403);
    if (!await canUse(target)) return fail('Not a participant in the target conversation', 403);
    if (!isDirectGroup(target)) {
      const group = await env.CHAT_DB.prepare('SELECT posting_locked, created_by FROM groups WHERE id = ?').bind(target).first();
      if (group?.posting_locked && group.created_by !== me.user_id) return fail('Group is locked for posting — only the owner can post here', 403);
    }
    const original = await readMessage(source, messageId);
    if (!original) return fail('Message not found', 404);
    const type = original.message_type || 'text';
    if (!FORWARDABLE_TYPES.includes(type)) return fail('This message type cannot be forwarded');
    let { media_url: mediaUrl, audio_url: audioUrl, media_object_key: mediaKey } = original;
    if (isDirectGroup(source) && mediaGroupOf(mediaKey) === source) {
      // Private bytes are copied, never linked, so the source conversation stays private.
      const object = await env.CHAT_MEDIA?.get(mediaKey);
      if (!object) return fail('The attachment is no longer available', 404);
      const copyKey = `media/${target}/${crypto.randomUUID()}${(mediaKey.match(/\.[a-z0-9]+$/i) || [''])[0]}`;
      await env.CHAT_MEDIA.put(copyKey, await object.arrayBuffer(), {
        httpMetadata: object.httpMetadata,
        customMetadata: { ...(object.customMetadata || {}), groupId: target, userId: me.user_id, forwardedFrom: mediaKey, uploadedAt: String(Date.now()) },
      });
      mediaKey = copyKey;
      const publicUrl = !isDirectGroup(target) && helpers.publicMediaUrl ? helpers.publicMediaUrl(request, env, copyKey) : null;
      mediaUrl = type === 'voice' ? null : publicUrl;
      audioUrl = type === 'voice' ? publicUrl : null;
    }
    const author = original.user_id?.startsWith('bot:') ? null : (await profiles([original.user_id])).get(original.user_id)?.name || null;
    const createdAt = Date.now();
    const [inserted] = await env.CHAT_DB.batch([
      env.CHAT_DB.prepare(
        `INSERT INTO group_messages (group_id, user_id, body, created_at, message_type, audio_url, audio_duration_ms,
           transcript_text, transcript_lang, transcription_status, media_url, media_object_key, media_content_type, media_size,
           video_thumbnail_url, video_duration_ms, reply_to_id, forwarded_from_message_id, forwarded_from_user_id, forwarded_from_user_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
      ).bind(target, me.user_id, original.body || '', createdAt, type, audioUrl || null, original.audio_duration_ms ?? null,
        original.transcript_text ?? null, original.transcript_lang ?? null, original.transcription_status ?? null, mediaUrl || null, mediaKey || null,
        original.media_content_type ?? null, original.media_size ?? null, original.video_thumbnail_url ?? null, original.video_duration_ms ?? null,
        original.id, original.user_id, author),
      env.CHAT_DB.prepare('UPDATE groups SET updated_at = ? WHERE id = ?').bind(createdAt, target),
    ]);
    const forwarded = await readMessage(target, inserted.meta.last_row_id);
    if (isDirectGroup(target)) {
      if (ctx?.waitUntil) ctx.waitUntil(sendDirectMessageAlerts(env, target, me.user_id, alertExcerpt(type, original.body)));
      const row = await directRow(env, target);
      return respond({ success: true, message: await presentMessage(forwarded, target, row.user_low === me.user_id ? 'l' : 'h') }, 201);
    }
    return respond({ success: true, message: forwarded }, 201);
  }

  const scoped = url.pathname.match(/^\/direct\/([^/]+)\/(.+)$/);
  if (!scoped) return fail('Direct chat route not found', 404);
  const groupId = decodeURIComponent(scoped[1]);
  const rest = scoped[2];
  const conversation = await access(groupId);
  if (!conversation) return fail('Not a conversation participant', 403);
  const slot = conversation.user_low === me.user_id ? 'l' : 'h';
  const touch = now => env.CHAT_DB.prepare('UPDATE groups SET updated_at = ? WHERE id = ?').bind(now, groupId);

  if (rest === 'messages' && request.method === 'GET') {
    const after = Number(url.searchParams.get('after') || 0);
    const before = Number(url.searchParams.get('before') || 0);
    const limit = Math.min(Number(url.searchParams.get('limit') || 40), 200);
    if (![after, before, limit].every(Number.isSafeInteger) || after < 0 || before < 0 || limit < 1) return fail('Invalid cursor');
    const latest = url.searchParams.get('latest') === '1';
    const { results } = await env.CHAT_DB.prepare(
      `SELECT ${MESSAGE_COLUMNS} FROM group_messages
       WHERE group_id = ? AND id > ? AND (? = 0 OR id < ?)
       ORDER BY id ${latest ? 'DESC' : 'ASC'} LIMIT ?`
    ).bind(groupId, after, before, before, limit + 1).all();
    const page = results.slice(0, limit);
    if (latest) page.reverse();
    return respond({ success: true, messages: await Promise.all(page.map(row => presentMessage(row, groupId, slot))), paging: { has_more: results.length > limit, next_before: page[0]?.id || null } });
  }

  if (rest === 'messages' && request.method === 'POST') {
    const body = await readJsonBody();
    if (!body || typeof body !== 'object') return fail('Invalid JSON body');
    if (body.media_url || body.audio_url || body.video_thumbnail_url) return fail('Upload media to this conversation first; links are not accepted');
    const type = body.message_type || 'text';
    if (type !== 'text' && !MEDIA_TYPES[type]) return fail('Unsupported message type');
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (text.length > 10000 || (type === 'text' && !text)) return fail('Message must contain 1-10000 characters');
    let media = null;
    if (type === 'text') {
      if (body.media_object_key) return fail('Text messages cannot carry media');
    } else {
      media = await ownUpload(body.media_object_key, groupId);
      if (!media) return fail('Upload the file to this conversation first');
      if (type === 'pdf' ? media.contentType !== MEDIA_TYPES.pdf : !media.contentType.startsWith(MEDIA_TYPES[type])) return fail('The file does not match the message type');
    }
    const optionalInt = (value, max) => {
      if (value === undefined || value === null || value === '') return null;
      const number = Math.round(Number(value));
      return Number.isFinite(number) && number >= 0 && number <= max ? number : undefined;
    };
    const audioDuration = type === 'voice' ? optionalInt(body.audio_duration_ms, MAX_DURATION_MS) : null;
    const videoDuration = type === 'video' ? optionalInt(body.video_duration_ms, MAX_DURATION_MS) : null;
    if (audioDuration === undefined || videoDuration === undefined) return fail('Invalid duration');
    const replyTo = optionalInt(body.reply_to_id, Number.MAX_SAFE_INTEGER);
    if (replyTo === undefined) return fail('Invalid reply_to_id');
    if (replyTo !== null && !await readMessage(groupId, replyTo)) return fail('Reply target not found', 404);
    const transcript = type === 'voice' && typeof body.transcript_text === 'string' ? body.transcript_text.slice(0, 20000) : null;
    const transcriptLang = type === 'voice' && typeof body.transcript_lang === 'string' ? body.transcript_lang.slice(0, 16) : null;
    const transcriptionStatus = type !== 'voice' ? null : TRANSCRIPTION_STATES.includes(body.transcription_status) ? body.transcription_status : (transcript ? 'complete' : 'pending');
    const stored = type === 'pdf' ? (text || media.fileName || 'Dokument.pdf') : text;
    const now = Date.now();
    const [inserted] = await env.CHAT_DB.batch([
      env.CHAT_DB.prepare(
        `INSERT INTO group_messages (group_id, user_id, body, created_at, message_type, audio_duration_ms, transcript_text, transcript_lang,
           transcription_status, media_object_key, media_content_type, media_size, video_duration_ms, reply_to_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(groupId, me.user_id, stored, now, type, audioDuration, transcript, transcriptLang, transcriptionStatus,
        media?.key || null, media?.contentType || null, media?.size ?? null, videoDuration, replyTo),
      touch(now),
    ]);
    if (ctx?.waitUntil) ctx.waitUntil(sendDirectMessageAlerts(env, groupId, me.user_id, alertExcerpt(type, stored)));
    return respond({ success: true, message: await presentMessage(await readMessage(groupId, inserted.meta.last_row_id), groupId, slot) }, 201);
  }

  const single = rest.match(/^messages\/(\d+)$/);
  if (single && ['PATCH', 'DELETE'].includes(request.method)) {
    const existing = await readMessage(groupId, Number(single[1]));
    if (!existing) return fail('Message not found', 404);
    if (existing.user_id !== me.user_id) return fail('Only the author can change this message', 403);
    if (request.method === 'DELETE') {
      const polls = (await env.CHAT_DB.prepare('SELECT id FROM polls WHERE message_id = ? AND group_id = ?').bind(existing.id, groupId).all()).results || [];
      await env.CHAT_DB.batch([
        env.CHAT_DB.prepare('DELETE FROM message_reactions WHERE message_id = ?').bind(existing.id),
        ...polls.flatMap(poll => [
          env.CHAT_DB.prepare('DELETE FROM poll_votes WHERE poll_id = ?').bind(poll.id),
          env.CHAT_DB.prepare('DELETE FROM polls WHERE id = ?').bind(poll.id),
        ]),
        env.CHAT_DB.prepare('DELETE FROM group_messages WHERE id = ? AND group_id = ?').bind(existing.id, groupId),
      ]);
      await removeMediaIfUnused(existing.media_object_key);
      return respond({ success: true, deleted: existing.id });
    }
    const body = await readJsonBody();
    if (!body || typeof body !== 'object') return fail('Invalid JSON body');
    const fields = {};
    if (body.body !== undefined) {
      const text = typeof body.body === 'string' ? body.body.trim() : '';
      if ((existing.message_type || 'text') !== 'text') return fail('Only text messages can be edited');
      if (!text || text.length > 10000) return fail('Message must contain 1-10000 characters');
      fields.body = text;
    }
    for (const [field, max] of [['transcript_text', 20000], ['transcript_lang', 16], ['transcription_status', 16]]) {
      if (body[field] === undefined) continue;
      if (existing.message_type !== 'voice') return fail('Transcripts belong to voice messages');
      if (typeof body[field] !== 'string' || (field === 'transcription_status' && !TRANSCRIPTION_STATES.includes(body[field]))) return fail(`Invalid ${field}`);
      fields[field] = body[field].slice(0, max);
    }
    const names = Object.keys(fields);
    if (!names.length) return fail('Nothing to change');
    await env.CHAT_DB.prepare(`UPDATE group_messages SET ${names.map(name => `${name} = ?`).join(', ')} WHERE id = ? AND group_id = ?`)
      .bind(...names.map(name => fields[name]), existing.id, groupId).run();
    return respond({ success: true, message: await presentMessage(await readMessage(groupId, existing.id), groupId, slot) });
  }

  if (rest === 'media' && request.method === 'POST') {
    if (!env.CHAT_MEDIA) return fail('Media storage not configured', 500);
    if (!await mediaSigningKey(env)) return fail('Private media links are not configured', 500);
    const contentType = String(request.headers.get('Content-Type') || '').toLowerCase().trim();
    const baseType = contentType.split(';')[0].trim();
    const allowed = (baseType.startsWith('image/') && baseType !== 'image/svg+xml') || baseType.startsWith('video/') || baseType.startsWith('audio/') || baseType === MEDIA_TYPES.pdf;
    if (!allowed) return fail('Unsupported file type. Images, video, audio and PDF are allowed.');
    const length = Number(request.headers.get('Content-Length'));
    if (!request.headers.get('Content-Length') || !Number.isSafeInteger(length) || length < 0) return fail('Content-Length required', 411);
    if (length === 0 || !request.body) return fail('Empty upload');
    if (length > MAX_MEDIA_BYTES) return fail(`File too large. Max ${MAX_MEDIA_BYTES} bytes`, 413);
    const fileName = String(request.headers.get('X-File-Name') || 'upload').replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 200) || 'upload';
    const nameExt = (fileName.toLowerCase().match(/\.[a-z0-9]{1,5}$/) || [''])[0];
    const extension = EXTENSIONS[baseType] || nameExt || '.bin';
    const key = `media/${groupId}/${crypto.randomUUID()}${extension}`;
    await env.CHAT_MEDIA.put(key, request.body, {
      httpMetadata: { contentType: contentType || baseType },
      customMetadata: { groupId, userId: me.user_id, originalFileName: fileName, uploadedAt: String(Date.now()) },
    });
    return respond({ success: true, objectKey: key, mediaUrl: await signedMediaUrl(env, origin, key, slot), contentType: baseType, size: length }, 201);
  }

  if (rest === 'transcribe' && request.method === 'POST') {
    const body = await readJsonBody();
    if (!body || typeof body !== 'object') return fail('Invalid JSON body');
    const language = typeof body.language === 'string' && /^[a-z]{2}$/.test(body.language) ? body.language : null;
    let key;
    let target = null;
    if (body.message_id !== undefined && body.message_id !== null) {
      target = await readMessage(groupId, Number(body.message_id));
      if (!target || target.message_type !== 'voice') return fail('Voice message not found', 404);
      if (mediaGroupOf(target.media_object_key) !== groupId) return fail('This voice message has no private recording to transcribe');
      key = target.media_object_key;
    } else {
      const upload = await ownUpload(body.object_key, groupId);
      if (!upload || !upload.contentType.startsWith('audio/')) return fail('Upload the recording to this conversation first');
      key = upload.key;
    }
    if (!env.OPENAI_WORKER?.fetch) return fail('Transcription is not configured', 500);
    const object = await env.CHAT_MEDIA.get(key);
    if (!object) return fail('Recording not found', 404);
    const form = new FormData();
    form.append('file', new File([await object.arrayBuffer()], 'voice' + ((key.match(/\.[a-z0-9]+$/i) || ['.webm'])[0]), { type: object.httpMetadata?.contentType || 'audio/webm' }));
    form.append('model', 'whisper-1');
    if (language) form.append('language', language);
    const transcribed = await env.OPENAI_WORKER.fetch('https://openai-worker/audio', { method: 'POST', body: form });
    const result = await transcribed.json().catch(() => ({}));
    if (!transcribed.ok || typeof result.text !== 'string') {
      if (target) await env.CHAT_DB.prepare("UPDATE group_messages SET transcription_status = 'failed' WHERE id = ? AND group_id = ?").bind(target.id, groupId).run();
      return fail(`Transcription failed${typeof result.error === 'string' ? ': ' + result.error : ''}`, 502);
    }
    const text = result.text.trim();
    const detected = typeof result.language === 'string' ? result.language.slice(0, 16) : language;
    let message;
    if (target) {
      await env.CHAT_DB.prepare('UPDATE group_messages SET transcript_text = ?, transcript_lang = ?, transcription_status = ? WHERE id = ? AND group_id = ?')
        .bind(text || null, detected, text ? 'complete' : 'none', target.id, groupId).run();
      message = await presentMessage(await readMessage(groupId, target.id), groupId, slot);
    }
    return respond({ success: true, text, language: detected, ...(message ? { message } : {}) });
  }

  const reactionCounts = async ids => {
    const counts = await env.CHAT_DB.prepare(
      `SELECT r.message_id, r.reaction, COUNT(*) AS cnt FROM message_reactions r JOIN group_messages m ON m.id = r.message_id
       WHERE m.group_id = ? AND r.message_id IN (SELECT value FROM json_each(?)) GROUP BY r.message_id, r.reaction`
    ).bind(groupId, JSON.stringify(ids)).all();
    const mine = await env.CHAT_DB.prepare(
      `SELECT r.message_id, r.reaction FROM message_reactions r JOIN group_messages m ON m.id = r.message_id
       WHERE m.group_id = ? AND r.user_id = ? AND r.message_id IN (SELECT value FROM json_each(?))`
    ).bind(groupId, me.user_id, JSON.stringify(ids)).all();
    const reactions = {};
    for (const row of counts.results || []) (reactions[row.message_id] ||= { counts: {}, mine: [] }).counts[row.reaction] = row.cnt;
    for (const row of mine.results || []) (reactions[row.message_id] ||= { counts: {}, mine: [] }).mine.push(row.reaction);
    return reactions;
  };

  if (rest === 'reactions' && request.method === 'GET') {
    const ids = (url.searchParams.get('message_ids') || '').split(',').map(Number).filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 200);
    return respond({ success: true, reactions: ids.length ? await reactionCounts(ids) : {} });
  }

  const reactionMatch = rest.match(/^messages\/(\d+)\/reactions$/);
  if (reactionMatch && request.method === 'POST') {
    const messageId = Number(reactionMatch[1]);
    const body = await readJsonBody();
    const reaction = typeof body?.reaction === 'string' ? body.reaction.trim() : '';
    if (!VALID_REACTIONS.includes(reaction)) return fail('reaction must be one of: thumbs_up, heart, smile');
    if (!await readMessage(groupId, messageId)) return fail('Message not found', 404);
    const existing = await env.CHAT_DB.prepare('SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?').bind(messageId, me.user_id, reaction).first();
    if (existing) await env.CHAT_DB.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?').bind(messageId, me.user_id, reaction).run();
    else await env.CHAT_DB.prepare('INSERT INTO message_reactions (message_id, user_id, reaction, created_at) VALUES (?, ?, ?, ?)').bind(messageId, me.user_id, reaction, Date.now()).run();
    const current = (await reactionCounts([messageId]))[messageId] || { counts: {}, mine: [] };
    return respond({ success: true, message_id: messageId, reactions: current.counts, my_reactions: current.mine, toggled: reaction, added: !existing });
  }

  if (rest === 'polls' && request.method === 'POST') {
    const body = await readJsonBody();
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question || question.length > 500) return fail('question must contain 1-500 characters');
    const options = Array.isArray(body?.options) ? body.options.map(option => String(option).trim().slice(0, 200)).filter(Boolean) : [];
    if (options.length < 2 || options.length > 6) return fail('options must be an array of 2-6 strings');
    const now = Date.now();
    const pollId = crypto.randomUUID();
    const inserted = await env.CHAT_DB.prepare(
      "INSERT INTO group_messages (group_id, user_id, body, created_at, message_type) VALUES (?, ?, ?, ?, 'poll')"
    ).bind(groupId, me.user_id, `poll::${pollId}::${question}`, now).run();
    const messageId = inserted.meta.last_row_id;
    await env.CHAT_DB.batch([
      env.CHAT_DB.prepare('INSERT INTO polls (id, group_id, message_id, question, options, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(pollId, groupId, messageId, question, JSON.stringify(options), me.user_id, now),
      touch(now),
    ]);
    if (ctx?.waitUntil) ctx.waitUntil(sendDirectMessageAlerts(env, groupId, me.user_id, alertExcerpt('poll', question)));
    const poll = await env.CHAT_DB.prepare('SELECT * FROM polls WHERE id = ?').bind(pollId).first();
    return respond({ success: true, poll: await pollView(poll), message: await readMessage(groupId, messageId) }, 201);
  }

  const pollMatch = rest.match(/^polls\/([^/]+)(\/vote|\/close)?$/);
  if (pollMatch) {
    const poll = await env.CHAT_DB.prepare('SELECT * FROM polls WHERE id = ? AND group_id = ?').bind(decodeURIComponent(pollMatch[1]), groupId).first();
    if (!poll) return fail('Poll not found', 404);
    const action = pollMatch[2];
    if (!action && request.method === 'GET') return respond({ success: true, poll: await pollView(poll) });
    if (action === '/vote' && request.method === 'POST') {
      if (poll.closed_at) return fail('Poll is closed');
      const body = await readJsonBody();
      const index = Number(body?.option_index);
      if (!Number.isSafeInteger(index) || index < 0 || index >= JSON.parse(poll.options).length) return fail('Invalid option_index');
      const now = Date.now();
      await env.CHAT_DB.prepare(
        'INSERT INTO poll_votes (poll_id, user_id, option_index, voted_at) VALUES (?, ?, ?, ?) ON CONFLICT (poll_id, user_id) DO UPDATE SET option_index = ?, voted_at = ?'
      ).bind(poll.id, me.user_id, index, now, index, now).run();
      const view = await pollView(poll);
      return respond({ success: true, poll_id: poll.id, my_vote: view.my_vote, votes: view.votes, total_votes: view.total_votes });
    }
    if (action === '/close' && request.method === 'POST') {
      if (poll.created_by !== me.user_id) return fail('Only the poll creator can close it', 403);
      if (poll.closed_at) return fail('Poll already closed');
      await env.CHAT_DB.prepare('UPDATE polls SET closed_at = ? WHERE id = ?').bind(Date.now(), poll.id).run();
      return respond({ success: true, poll_id: poll.id, closed: true });
    }
  }
  return fail('Direct chat route not found', 404);
}

export async function blockLegacyDirectAccess(request, env) {
  const url = new URL(request.url);
  if (url.pathname.split('/').some(part => isDirectGroup(decodeURIComponent(part)))) return true;
  // The public /media route must never hand out private conversation media.
  if (isDirectGroup(mediaGroupOf(url.searchParams.get('key')))) return true;
  if (request.headers.get('Content-Type')?.includes('application/json') && !['GET', 'HEAD'].includes(request.method)) {
    const body = await request.clone().json().catch(() => null);
    if (body && Object.entries(body).some(([key, value]) => /group/i.test(key) && isDirectGroup(value))) return true;
  }
  const message = url.pathname.match(/\/messages\/(\d+)/);
  if (message) {
    const row = await env.CHAT_DB.prepare('SELECT group_id FROM group_messages WHERE id = ?').bind(Number(message[1])).first();
    if (isDirectGroup(row?.group_id)) return true;
  }
  return false;
}
