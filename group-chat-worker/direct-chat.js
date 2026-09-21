export const isDirectGroup = value => typeof value === 'string' && value.startsWith('dm_');

const sourceParameter = { name: 'source_group_id', in: 'query', required: true, schema: { type: 'string' }, description: 'Shared community group ID. Both people must remain members.' };
const directResponses = { 200: { description: 'Participant-scoped result' }, 400: { description: 'Invalid input' }, 401: { description: 'Missing or invalid bearer token' }, 403: { description: 'Not a participant or no longer a community member' } };
const directSecurity = [{ directSession: [] }];
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
      description: 'Returns group {id,name,peer_id,kind,updated_at}. Idempotent for the unordered participant pair within source_group_id. Creation makes the conversation visible to both people. No joins, invitations, bots, attachments or third participants. Uses existing group/message storage, not end-to-end encryption.',
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['source_group_id', 'peer_id'], properties: { source_group_id: { type: 'string' }, peer_id: { type: 'string' } } } } } }, responses: directResponses },
  },
  '/direct/{groupId}/messages': {
    parameters: [{ name: 'groupId', in: 'path', required: true, schema: { type: 'string' } }],
    get: { operationId: 'readDirectMessages', summary: 'Read participant-only text messages', security: directSecurity,
      description: 'Returns messages and paging {has_more,next_before}. latest=1 gives the newest page in chronological order; after polls newer messages; before pages older messages. Both people must remain members of the source community.',
      parameters: ['after', 'before', 'limit', 'latest'].map(name => ({ name, in: 'query', schema: { type: 'integer', minimum: name === 'limit' ? 1 : 0 } })), responses: directResponses },
    post: { operationId: 'sendDirectMessage', summary: 'Send text to the other participant', security: directSecurity,
      description: 'Sender is derived from the bearer token, never from user_id, email, phone or role in the request. Text only, 1-10000 characters.',
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['body'], properties: { body: { type: 'string', minLength: 1, maxLength: 10000 } } } } } },
      responses: { ...directResponses, 201: { description: 'Message saved' } } },
  },
};

export async function handleDirectChat(request, env, sendResponse, ctx) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/direct/')) return null;
  const respond = (data, status = 200) => {
    const response = sendResponse(data, status);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
  const fail = (error, status = 400) => respond({ success: false, error }, status);
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return fail('Sign in required', 401);
  const me = await env.IDENTITY_DB.prepare(
    'SELECT user_id FROM config WHERE emailVerificationToken = ?'
  ).bind(token).first();
  if (!me?.user_id) return fail('Invalid session', 401);

  const member = async (groupId, userId) => Boolean(await env.CHAT_DB.prepare(
    `SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id
     WHERE gm.group_id = ? AND gm.user_id = ? AND gm.role != 'bot'
     AND (g.archived_at IS NULL OR g.archived_at = 0)`
  ).bind(groupId, userId).first());
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
    const row = await env.CHAT_DB.prepare(
      `SELECT d.*, g.updated_at FROM direct_chats d JOIN groups g ON g.id = d.group_id
       WHERE d.group_id = ? AND (d.user_low = ? OR d.user_high = ?)`
    ).bind(groupId, me.user_id, me.user_id).first();
    if (!row || !await member(row.source_group_id, row.user_low) || !await member(row.source_group_id, row.user_high)) return null;
    return row;
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

  if (url.pathname === '/direct/conversations' && request.method === 'GET') {
    const source = url.searchParams.get('source_group_id');
    if (!source || !await member(source, me.user_id)) return fail('Not a community member', 403);
    const { results } = await env.CHAT_DB.prepare(
      `SELECT d.*, g.updated_at FROM direct_chats d JOIN groups g ON g.id = d.group_id
       JOIN group_members low ON low.group_id = d.source_group_id AND low.user_id = d.user_low
       JOIN group_members high ON high.group_id = d.source_group_id AND high.user_id = d.user_high
       WHERE d.source_group_id = ? AND (d.user_low = ? OR d.user_high = ?)
      AND low.role != 'bot' AND high.role != 'bot'
       ORDER BY g.updated_at DESC, d.group_id`
    ).bind(source, me.user_id, me.user_id).all();
    return respond({ success: true, groups: await present(results) });
  }

  if (url.pathname === '/direct/conversations' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const source = body?.source_group_id;
    const peer = body?.peer_id;
    if (typeof source !== 'string' || typeof peer !== 'string' || peer === me.user_id || peer.startsWith('bot:') || isDirectGroup(source)) return fail('Choose another community member');
    if (!await member(source, me.user_id) || !await member(source, peer)) return fail('Not a community member', 403);
    if (!(await profiles([peer])).has(peer)) return fail('Member profile unavailable', 404);
    const [low, high] = [me.user_id, peer].sort();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([source, low, high])));
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

  const messages = url.pathname.match(/^\/direct\/([^/]+)\/messages$/);
  if (messages && ['GET', 'POST'].includes(request.method)) {
    const groupId = decodeURIComponent(messages[1]);
    if (!await access(groupId)) return fail('Not a conversation participant', 403);
    if (request.method === 'GET') {
      const after = Number(url.searchParams.get('after') || 0);
      const before = Number(url.searchParams.get('before') || 0);
      const limit = Math.min(Number(url.searchParams.get('limit') || 40), 200);
      if (![after, before, limit].every(Number.isSafeInteger) || after < 0 || before < 0 || limit < 1) return fail('Invalid cursor');
      const latest = url.searchParams.get('latest') === '1';
      const { results } = await env.CHAT_DB.prepare(
        `SELECT id, group_id, user_id, body, created_at, message_type FROM group_messages
         WHERE group_id = ? AND id > ? AND (? = 0 OR id < ?)
         ORDER BY id ${latest ? 'DESC' : 'ASC'} LIMIT ?`
      ).bind(groupId, after, before, before, limit + 1).all();
      const page = results.slice(0, limit);
      if (latest) page.reverse();
      return respond({ success: true, messages: page, paging: { has_more: results.length > limit, next_before: page[0]?.id || null } });
    }
    const body = await request.json().catch(() => null);
    if (typeof body?.body !== 'string' || !body.body.trim() || body.body.length > 10000) return fail('Message must contain 1-10000 characters');
    if ((body.message_type && body.message_type !== 'text') || body.media_url || body.audio_url) return fail('Only text messages are supported');
    const now = Date.now();
    await env.CHAT_DB.batch([
      env.CHAT_DB.prepare("INSERT INTO group_messages (group_id, user_id, body, created_at, message_type) VALUES (?, ?, ?, ?, 'text')").bind(groupId, me.user_id, body.body.trim(), now),
      env.CHAT_DB.prepare('UPDATE groups SET updated_at = ? WHERE id = ?').bind(now, groupId),
    ]);
    if (ctx?.waitUntil) ctx.waitUntil(sendDirectMessageAlerts(env, groupId, me.user_id, body.body.trim()));
    return respond({ success: true }, 201);
  }
  return fail('Direct chat route not found', 404);
}

export async function blockLegacyDirectAccess(request, env) {
  const url = new URL(request.url);
  if (url.pathname.split('/').some(part => isDirectGroup(decodeURIComponent(part)))) return true;
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