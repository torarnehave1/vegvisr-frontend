/**
 * Auth headers for Knowledge Graph API calls.
 *
 * WHY THIS EXISTS (2026-09-27, F2 stage 2)
 * ----------------------------------------
 * knowledge-graph-worker used to grant full scopes:['all'] to any request carrying
 * `Origin: https://www.vegvisr.org`. Origin is set by the browser but is equally settable by
 * curl, so that branch let anyone anywhere write to any graph with no login and no token —
 * measured, not theorised. Roughly thirty call sites in this app sent no auth header at all
 * and worked only because of it.
 *
 * These are the headers the worker's session-auth path actually validates: X-Session-Token is
 * looked up in config.emailVerificationToken, and the user's email and role are read from THAT
 * database row. The x-user-role header is advisory only — the worker ignores its value for
 * authorization — but the worker's session branch is gated on its presence, so both must be
 * sent together.
 *
 * Returns {} when nobody is logged in, so a read by an anonymous visitor is unchanged.
 */
export function kgAuthHeaders(userStore) {
  const token = userStore?.emailVerificationToken
  if (!token) return {}
  return {
    'x-user-role': userStore.role || 'User',
    'X-Session-Token': token,
  }
}
