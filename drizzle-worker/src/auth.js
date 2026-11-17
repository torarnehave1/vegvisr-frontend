/**
 * drizzle-worker — who may call what (2026-11-17).
 *
 * Until this file existed the worker answered ANYONE on drizzle.vegvisr.org: no login, and the
 * ownership check was skipped whenever the body left out `userId`. POST /raw-query ran any SELECT
 * against the whole vegvisr_org database (the config table with every user's token included),
 * and /update, /delete-records and /drop-table were just as open.
 *
 * Two kinds of caller:
 *
 *   INTERNAL — another worker through a service binding. agent-worker addresses us as
 *              https://drizzle-worker/…; that hostname can never arrive from the internet,
 *              because the only public way in is the route drizzle.vegvisr.org/* (workers.dev is
 *              off). Internal callers do their own authentication and are let through unchanged.
 *              The list is an allow-list on purpose: any hostname not on it is PUBLIC, so a new
 *              route or domain added later is closed by default.
 *
 *   PUBLIC   — everything else (browsers, curl). Must carry the signed-in user's token
 *              (config.emailVerificationToken) as `Authorization: Bearer …` or `X-API-Token`.
 *                · app-table routes: the table's graph_id must be the caller's own user id
 *                  (or oauth id), unless the caller is Superadmin
 *                · raw SQL, D1 table listing, drop-table, other databases and the chat-group
 *                  routes: Superadmin only
 *                · /health and /openapi.json stay open
 *
 * Pure functions + two injected lookups, so the rules are unit-tested without a database
 * (drizzle-worker/test/auth.test.mjs).
 */

export const INTERNAL_HOSTS = new Set(['drizzle-worker']);

export function isInternalRequest(request) {
  let host = '';
  try {
    host = new URL(request.url).hostname;
  } catch {
    return false;
  }
  return INTERNAL_HOSTS.has(host);
}

export function readToken(request) {
  const auth = (request.headers.get('Authorization') || '').trim();
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (m && m[1].trim()) return m[1].trim();
  return (request.headers.get('X-API-Token') || '').trim();
}

export const isSuperadmin = (caller) => !!caller && caller.role === 'Superadmin';

/** May this caller touch tables that belong to `graphId`? */
export function ownsGraph(caller, graphId) {
  if (!caller || !graphId) return false;
  if (isSuperadmin(caller)) return true;
  return graphId === caller.userId || (!!caller.oauthId && graphId === caller.oauthId);
}

const OPEN_ROUTES = new Set(['GET /health', 'GET /openapi.json']);

const SUPERADMIN_ROUTES = new Set([
  'POST /raw-query',
  'GET /d1-tables',
  'GET /databases',
  'POST /drop-table',
  'GET /chat-groups',
  'POST /add-user-to-group',
  'GET /group-messages',
  'GET /group-stats',
  'POST /send-group-message',
  'POST /create-chat-group',
  'POST /register-chat-bot',
  'GET /group-bots',
  'POST /unregister-chat-bot',
  'GET /agent-bot-groups',
  'GET /group-members',
]);

// Routes whose JSON body names the table (body.tableId).
const TABLE_BODY_ROUTES = new Set([
  'POST /insert',
  'POST /bulk-insert',
  'POST /update',
  'POST /query',
  'POST /add-column',
  'POST /delete-records',
]);

/**
 * Decide one request.
 *
 * @param {object} p
 * @param {Request} p.request
 * @param {(token: string) => Promise<{userId: string, oauthId?: string|null, email?: string|null, role?: string|null}|null>} p.lookupCaller
 * @param {(tableId: string) => Promise<string|null>} p.lookupTableOwner  graph_id of the app table, null when unknown
 * @returns {Promise<{ok: true, internal: boolean, caller: object|null, listGraphId?: string|null}
 *                  | {ok: false, status: number, error: string}>}
 *          listGraphId (GET /tables only): the graph id the listing must be limited to; null = no limit.
 */
export async function authorize({ request, lookupCaller, lookupTableOwner }) {
  if (isInternalRequest(request)) return { ok: true, internal: true, caller: null };

  const url = new URL(request.url);
  const path = url.pathname;
  const key = `${request.method} ${path}`;

  if (OPEN_ROUTES.has(key)) return { ok: true, internal: false, caller: null };

  const token = readToken(request);
  if (!token) {
    return { ok: false, status: 401, error: 'Login required: send your token as "Authorization: Bearer <token>".' };
  }
  const caller = await lookupCaller(token);
  if (!caller || !caller.userId) {
    return { ok: false, status: 401, error: 'Unknown or expired token — sign in again.' };
  }
  const admin = isSuperadmin(caller);

  // Any database other than the default is admin territory (chat, calendar, stats).
  const dbParam = url.searchParams.get('database');
  if (dbParam && dbParam !== 'vegvisr_org' && !admin) {
    return { ok: false, status: 403, error: 'Only a Superadmin may address another database.' };
  }

  if (SUPERADMIN_ROUTES.has(key)) {
    if (!admin) return { ok: false, status: 403, error: 'This route is for Superadmin only.' };
    return { ok: true, internal: false, caller };
  }

  if (key === 'GET /tables') {
    const asked = url.searchParams.get('graphId') || url.searchParams.get('userId');
    if (admin) return { ok: true, internal: false, caller, listGraphId: asked || null };
    if (asked && !ownsGraph(caller, asked)) {
      return { ok: false, status: 403, error: 'You can only list your own tables.' };
    }
    return { ok: true, internal: false, caller, listGraphId: asked || caller.userId };
  }

  if (key === 'POST /create-table') {
    const body = await readBody(request);
    if (!admin && !ownsGraph(caller, body && body.graphId)) {
      return { ok: false, status: 403, error: 'You can only create tables under your own user id.' };
    }
    return { ok: true, internal: false, caller };
  }

  let tableId = null;
  if (TABLE_BODY_ROUTES.has(key)) {
    const body = await readBody(request);
    tableId = body && typeof body.tableId === 'string' ? body.tableId : null;
  } else if (request.method === 'GET' && path.startsWith('/table/')) {
    tableId = decodeURIComponent(path.slice('/table/'.length)) || null;
  } else {
    // Not a route this worker has. Let the router answer 404 — to a signed-in caller only.
    return { ok: true, internal: false, caller };
  }

  if (!tableId) return { ok: true, internal: false, caller }; // the handler answers "tableId is required"
  if (admin) return { ok: true, internal: false, caller };

  const owner = await lookupTableOwner(tableId);
  // Unknown table and someone else's table get the same answer: do not confirm which ids exist.
  if (!owner || !ownsGraph(caller, owner)) {
    return { ok: false, status: 403, error: 'Access denied: you do not own this table.' };
  }
  return { ok: true, internal: false, caller };
}

/** Read the JSON body from a CLONE, so the route handler can still read the original. */
async function readBody(request) {
  try {
    return await request.clone().json();
  } catch {
    return null;
  }
}
