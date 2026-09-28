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
export const KNOWN_SCOPES = ['graph:read', 'graph:write', 'graph:publish', 'graph:delete', 'chat:write', 'chat:read']

/** Human text for the consent screen. Covers every known scope, advertised or not. */
export const SCOPE_TEXT = {
  'graph:read': 'Lese kunnskapsgrafene dine',
  'graph:write': 'Opprette og endre grafer og noder',
  'graph:publish': 'Publisere en graf offentlig',
  'graph:delete': 'Slette grafer',
  'chat:write': 'Poste meldinger i chattegrupper du er medlem av',
  'chat:read': 'Lese meldinger i chattegrupper du er medlem av',
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

/**
 * Scopes a user may add to an authorization by hand, even though no client asked for them.
 *
 * chat:write is deliberately absent from CONNECT_SCOPES, so it appears in no discovery document
 * and no client requests it. That makes it unobtainable — which was the point, and also a dead
 * end: there was no way for the user to grant it either.
 *
 * This is the way out, and it keeps the property that mattered. The scope stays unadvertised;
 * what changes is that the consent screen offers it as an explicitly unticked opt-in. Nothing
 * is granted by a client asking. It is granted only by a person ticking a box, on the screen
 * where they can read what it means, for one authorization at a time.
 *
 * RFC 6749 §3.3 allows an authorization server to issue a scope set different from the one
 * requested, as long as the token response reports what was actually granted — which the
 * provider does.
 */
export const OPT_IN_SCOPES = ['chat:write', 'chat:read', 'graph:publish']

/** Longer copy for the consent screen: the one-liner is not enough for an outward-facing scope. */
export const OPT_IN_SCOPE_DETAIL = {
  'graph:publish':
    'Lar assistenten publisere en html-node til en nettadresse som ALLEREDE er satt opp, slik ' +
    'at siden blir synlig for hvem som helst på internett. Den kan ikke opprette nye ' +
    'subdomener, og den kan bare publisere til en adresse noden allerede er knyttet til — et ' +
    'forsøk på en annen adresse blir avvist. En publisert side erstatter det som lå der fra før.',
  'chat:write':
    'Lar assistenten skrive meldinger i chattegrupper du er medlem av. Meldingene postes av ' +
    'assistentens egen bot og merkes alltid med at en AI skrev dem på dine vegne. Den kan bare ' +
    'poste i grupper der boten er lagt til. Meldinger kan ikke slettes av assistenten etterpå.',
  'chat:read':
    'Lar assistenten lese meldinger — også fra andre deltakere — i grupper du er medlem av og ' +
    'der assistentens bot er lagt til. Den ser bare det du selv allerede ser i chatten, og får ' +
    'visningsnavn, aldri e-postadresser. Gi dette hvis du vil be den oppsummere en samtale.',
}

/** Validate a user's opt-in picks: only real opt-in scopes, never anything else. */
export function sanitizeOptIns(picked) {
  const list = Array.isArray(picked) ? picked : [picked].filter(Boolean)
  return list.map(String).filter((s) => OPT_IN_SCOPES.includes(s))
}
