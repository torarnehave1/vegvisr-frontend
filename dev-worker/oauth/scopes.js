/**
 * scopes.js — what this authorization server advertises, and what it merely understands.
 *
 * Its own module, with no Workers-only imports, for two reasons: the distinction is a policy
 * decision that deserves one obvious home, and authorize.js pulls in
 * @cloudflare/workers-oauth-provider, which imports `cloudflare:workers` and therefore cannot be
 * loaded by a plain Node test. Constants that encode a security decision should be testable.
 *
 * ── THIS LIST IS FROZEN ──────────────────────────────────────────────────────────────────────
 *
 * Adding a scope string is the most expensive change in this codebase, and the cost lands on
 * every user rather than on the developer. A grant is never widened: an existing connection
 * keeps exactly the scopes it was created with, so a new scope means every person must DELETE
 * their connector and add it again — and ChatGPT refuses to reuse the old connector name, so
 * they end up with "KM2". Five scopes were added over two days in September 2026 and each one
 * cost that.
 *
 * The mistake was naming scopes after FEATURES. chat:write arrived with chat, graph:publish with
 * publishing, user:register with the directory — so every new capability implied a new scope.
 *
 * The eight below are named after RISK CLASSES instead, and are meant to be final. A new tool
 * picks the class its damage belongs to; it does not get its own scope:
 *
 *   graph:read     reading content the user may already see
 *   graph:write    creating or changing the user's own content — including attaching files,
 *                  images and metadata to it
 *   graph:publish  making something reachable by people who are not signed in
 *   graph:delete   destroying content (reserved; no tool uses it yet)
 *   chat:write     sending a message that reaches other people, in any channel
 *   chat:read      reading messages other people wrote
 *   user:register  creating or altering an account in the user directory
 *   user:read      seeing other people's names, addresses and roles
 *
 * Before adding a ninth, answer: which of these does the new damage resemble? If the honest
 * answer is "none", the scope is justified — and the runbook must say what it cost. If the
 * answer is "one of them, roughly", use that one and widen its consent copy to match, because
 * consent must never be narrower than what the scope permits.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
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
 * Every scope the server understands — the frozen vocabulary described at the top of this file.
 *
 * A test pins this array exactly. That test failing is not a nuisance to be silenced: it means
 * someone is about to make every connected user re-authorize. Change it only with that
 * understood, and record the reason in MCP_OAUTH_DEPLOYMENT.md.
 *
 * graph:delete is reserved and unused. It is listed so the vocabulary is complete and so a
 * future delete tool costs a tool-list refresh rather than a re-authorization.
 */
export const KNOWN_SCOPES = ['graph:read', 'graph:write', 'graph:publish', 'graph:delete', 'chat:write', 'chat:read', 'user:register', 'user:read']

/** Human text for the consent screen. Covers every known scope, advertised or not. */
export const SCOPE_TEXT = {
  'graph:read': 'Lese kunnskapsgrafene dine',
  'graph:write': 'Opprette og endre innholdet ditt — grafer, noder, bilder og metadata',
  'graph:publish': 'Gjøre innhold synlig for folk som ikke er innlogget',
  'graph:delete': 'Slette innhold permanent',
  'chat:write': 'Sende meldinger som når andre mennesker, og styre hvem som er med i gruppene dine',
  'chat:read': 'Lese meldinger andre har skrevet',
  'user:register': 'Opprette brukerkontoer og endre dem — rolle og gruppe',
  'user:read': 'Se andre registrerte personer: navn, e-post, rolle og gruppe',
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
export const OPT_IN_SCOPES = [
  'chat:write',
  'chat:read',
  'graph:publish',
  'graph:delete',
  'user:register',
  'user:read',
]

/** Longer copy for the consent screen: the one-liner is not enough for an outward-facing scope. */
export const OPT_IN_SCOPE_DETAIL = {
  'graph:delete':
    'Lar assistenten slette innhold permanent. INGEN VERKTØY BRUKER DENNE ENNÅ — boksen finnes ' +
    'fordi et grant aldri utvides: uten den her ville det første slette-verktøyet tvunget alle ' +
    'til å koble fra og til på nytt. Kryss av bare hvis du vil at et slikt verktøy skal virke ' +
    'med én gang det finnes. Å la den stå tom koster ingenting i dag.',
  'user:read':
    'Lar assistenten liste de registrerte brukerne på plattformen med navn, e-postadresse, ' +
    'rolle og gruppe. Dette er ANDRE personers kontaktopplysninger, og de blir en del av ' +
    'samtalen din hos AI-leverandøren. Innloggingsnøkler vises aldri. Egen avkryssing fra ' +
    'det å opprette brukere, fordi det å lese om andre er noe annet enn å legge til én.',
  'user:register':
    'Lar assistenten skrive i brukerkatalogen på dine vegne: opprette en konto for en annen ' +
    'person med navn og e-post, og endre ' +
    'hvilke grupper registrerte personer tilhører. Personen kan deretter logge inn på ' +
    'plattformen med e-posten sin. Kontoen kan ikke gis Superadmin-rolle herfra, og en e-post ' +
    'som allerede finnes blir avvist i stedet for endret — bare gruppetaggene kan endres ' +
    'etterpå.',
  'graph:publish':
    'Lar assistenten publisere en html-node til en nettadresse som ALLEREDE er satt opp, slik ' +
    'at siden blir synlig for hvem som helst på internett. Den kan ikke opprette nye ' +
    'subdomener, og den kan bare publisere til en adresse noden allerede er knyttet til — et ' +
    'forsøk på en annen adresse blir avvist. En publisert side erstatter det som lå der fra før.',
  // Widened 2026-09-30 to name group membership, when the member tools landed. The TEXT is not
  // frozen — only the scope names are — so describing more of a risk class costs a consent
  // screen that reads correctly and nothing else. Naming it matters: someone reading only
  // "sende meldinger" would not expect an assistant to be able to add a person to a group.
  //
  // Widened again 2026-10-03 for e-mail. The scope was defined at the top of this file as
  // "sending a message that reaches other people, IN ANY CHANNEL", and the sentence above
  // promised that a future tool in the class would reuse it rather than ask for a new
  // authorisation — so this is the promise being kept, not stretched.
  //
  // THE HONEST COST, recorded rather than smoothed over: everyone who ticked this box before
  // today consented under wording that said nothing about e-mail, and widening the copy does not
  // reach back to them. What they actually gained is bounded by the own-profile rule — "my
  // assistant can send as MY OWN address" — which is new but is not somebody else's identity.
  // Sending as another World requires that World holder's deliberate, revocable grant, and no
  // amount of consent here produces one.
  'chat:write':
    'Lar assistenten sende meldinger som når andre mennesker, på dine vegne, og endre hvem som ' +
    'er med i chattegrupper DU eier eller er admin i. I dag betyr det chattegrupper du er ' +
    'medlem av, E-POST OG SMS. E-post: den kan sende fra adresser som står på din egen profil, ' +
    'eller som noen uttrykkelig har gitt deg lov til å bruke — aldri fra en adresse du bare er ' +
    'Superadmin over, og en sendt e-post kan ikke kalles tilbake. SMS: den kan sende tekstmelding ' +
    'til norske mobilnummer, og DETTE KOSTER PENGER per melding — betalt av plattformen, med en ' +
    'daglig grense. SMS er dessuten begrenset til en uttrykkelig liste over hvem som får sende i ' +
    'det hele tatt, så Superadmin alene gir ingenting her heller, og avsendernavnet velges av ' +
    'serveren og ikke av assistenten. En sendt SMS kan ikke kalles tilbake. Scopen dekker ' +
    'meldingskanaler generelt, så et framtidig verktøy i samme klasse ' +
    'vil bruke den i stedet for å be deg autorisere på nytt. Meldingene postes av ' +
    'assistentens egen bot og merkes alltid med at en AI skrev dem på dine vegne. Den kan bare ' +
    'poste i grupper der boten er lagt til. Meldinger kan ikke slettes av assistenten etterpå. ' +
    'Den kan bare legge til folk som allerede er registrerte VEGR.AI-brukere, og bare i grupper ' +
    'der du selv er eier eller admin — ikke i grupper du bare er medlem av.',
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
