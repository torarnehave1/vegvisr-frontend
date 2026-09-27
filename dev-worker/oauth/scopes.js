/**
 * scopes.js — what this authorization server advertises, and what it merely understands.
 *
 * Its own module, with no Workers-only imports, for two reasons: the distinction is a policy
 * decision that deserves one obvious home, and authorize.js pulls in
 * @cloudflare/workers-oauth-provider, which imports `cloudflare:workers` and therefore cannot be
 * loaded by a plain Node test. Constants that encode a security decision should be testable.
 */

/**
 * What a normal connection may ask for, and get, in version 1.
 *
 * This is the list the discovery document advertises — and advertising is not neutral: ChatGPT
 * requested every scope named there, so a connection meant to be read+write came back holding
 * graph:publish as well (measured on the live server, 2026-09-27). A client cannot be blamed for
 * asking for what the server says it supports, so the fix belongs here.
 */
export const CONNECT_SCOPES = ['graph:read', 'graph:write']

/**
 * Every scope the server understands. graph:publish and graph:delete are real — api_scopes
 * carries both rows and graphService.publishGraph() is implemented and tested — but nothing
 * advertises them, nothing requests them, and no tool uses them. They are what a step-up
 * authorization will ask for once a publish tool exists.
 *
 * chat:write is different in kind, not just in degree. Every graph scope touches the caller's
 * own data; chat:write sends a message to OTHER PEOPLE, and it cannot be taken back. It is
 * deliberately absent from CONNECT_SCOPES so no ordinary connection can even ask for it.
 */
export const KNOWN_SCOPES = ['graph:read', 'graph:write', 'graph:publish', 'graph:delete', 'chat:write']

/** Human text for the consent screen. Covers every known scope, advertised or not. */
export const SCOPE_TEXT = {
  'graph:read': 'Lese kunnskapsgrafene dine',
  'graph:write': 'Opprette og endre grafer og noder',
  'graph:publish': 'Publisere en graf offentlig',
  'graph:delete': 'Slette grafer',
  'chat:write': 'Poste meldinger i chattegrupper du er medlem av',
}

/**
 * The scopes to grant for a request: what the client asked for, intersected with what this
 * version offers. Intersected rather than merely validated — a client that asks for
 * graph:publish gets a token without it rather than an error, which is the OAuth-correct
 * behaviour: the authorization server decides what it grants, the client decides what to ask.
 *
 * A client that asks for nothing recognisable still gets a usable read-only connection rather
 * than a token carrying no scopes at all.
 */
export function grantableScopes(requested) {
  const asked = Array.isArray(requested) ? requested : []
  const granted = asked.filter((s) => CONNECT_SCOPES.includes(s))
  return granted.length ? granted : ['graph:read']
}
