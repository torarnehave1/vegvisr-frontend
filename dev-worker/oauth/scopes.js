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
 *                  — and adding a person to the user's OWN address book (create_contact,
 *                  2026-10-20, architect's decision: a row in your own book is your own content;
 *                  contacts:write was declined because it would force every user to reconnect)
 *   graph:publish  making something reachable by people who are not signed in
 *   graph:delete   destroying content — delete_graph (2026-11-14), which moves a graph to the
 *                  trash for 30 days; reserved and unused until then
 *   chat:write     sending a message that reaches other people, in any channel
 *   chat:read      reading messages other people wrote
 *   user:register  creating or altering an account in the user directory
 *   user:read      seeing other people's names, addresses and roles
 *   contacts:read  reading the user's OWN address book (ContactHub)          ← the ninth
 *
 * contacts:read was added 2026-10-15 by the architect's explicit decision, with user:read
 * offered as the alternative and declined. The cost was paid knowingly: every connection that
 * wants list_contacts / search_contacts must be deleted and added again. The reason it is not
 * user:read: that scope is the PLATFORM directory — people who have accounts. An address book
 * is a different body of data (1800+ people who never signed up for anything here), and ticking
 * "see registered users" should not silently also mean "read my whole phone book".
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
 * graph:delete was reserved and unused until delete_graph (2026-11-14). It was listed from the
 * start so that the first delete tool cost a tool-list refresh rather than a new vocabulary.
 */
export const KNOWN_SCOPES = ['graph:read', 'graph:write', 'graph:publish', 'graph:delete', 'chat:write', 'chat:read', 'user:register', 'user:read', 'contacts:read']

/** Human text for the consent screen. Covers every known scope, advertised or not. */
export const SCOPE_TEXT = {
  // ENGLISH ONLY (owner decision 2026-11-19): the sign-in and consent pages are read by World
  // Founders outside Norway, and Norwegians read English. Do not add Norwegian copy back.
  'graph:read': 'Read your knowledge graphs',
  // Widened 2026-11-16 for create_calendar_event — same class: your own content, added to. The
  // event has no guests, so nothing reaches anyone; inviting people stays under chat:write.
  'graph:write': 'Create and change your content — graphs, nodes, images and metadata, add contacts to your own address book and events (without guests) to your own calendar',
  'graph:publish': 'Make content visible to people who are not signed in',
  'graph:delete': 'Delete graphs (they stay in the trash for 30 days, then they are gone)',
  'chat:write': 'Send messages that reach other people, and manage who is in your groups',
  'chat:read': 'Read messages other people have written — in the chat and in EMAIL INBOXES you can send from',
  'user:register': 'Create user accounts and change them — role and group',
  'user:read': 'See other registered people: name, email, role and group',
  'contacts:read': 'Read your own contact list (ContactHub): name, email, phone, address and labels — and your own CALENDAR and SMS you have sent',
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
  'contacts:read',
]

/** Longer copy for the consent screen: the one-liner is not enough for an outward-facing scope. */
export const OPT_IN_SCOPE_DETAIL = {
  'graph:delete':
    'Lets the assistant delete a whole graph when you ask for it. The graph moves to the trash ' +
    'with its whole history and can be restored for 30 days; after that it is gone for good. ' +
    'Only the person who created the graph, or a Superadmin, can delete it. Tick this only if ' +
    'you want to be able to delete graphs from here. Left empty, a delete is refused.',
  'user:read':
    'Lets the assistant list the registered users on the platform with name, email address, ' +
    'role and group. These are OTHER people\'s contact details, and they become part of your ' +
    'conversation at the AI provider. Sign-in keys are never shown. A separate box from ' +
    'creating users, because reading about others is not the same as adding one.',
  'contacts:read':
    'Lets the assistant read and search YOUR OWN contact list in ContactHub: names, email ' +
    'addresses, phone numbers, first address, organisation and labels. These are OTHER ' +
    'people\'s contact details — people who have not registered here themselves — and what is ' +
    'fetched becomes part of your conversation at the AI provider. Notes and conversation ' +
    'history are not included. It can never read other people\'s contact lists, and it cannot ' +
    'change or delete contacts. ' +
    // Widened 2026-10-22 for get_my_day and list_sent_sms — same class: your own data that names
    // other people. Both read only.
    'CALENDAR: it can also read YOUR OWN calendar (time, title, place, participants — not the ' +
    'description). SMS: it can read SMS sent from the platform\'s SMS account (recipient number, ' +
    'text, status, price) if you are on the list of SMS senders; sign-in codes are never shown. ' +
    'A separate box from seeing registered users, because an address book is not the user directory.',
  'user:register':
    'Lets the assistant write to the user directory on your behalf: create an account for ' +
    'another person with name and email, and change which groups registered people belong to. ' +
    'The person can then sign in to the platform with their email. The account cannot be given ' +
    'the Superadmin role from here, and an email that already exists is refused instead of ' +
    'changed — only the group tags can be changed afterwards.',
  'graph:publish':
    'Lets the assistant publish an html-node to a web address that is ALREADY set up, so that ' +
    'the page becomes visible to anyone on the internet. It cannot create new subdomains, and ' +
    'it can only publish to an address the node is already tied to — an attempt at another ' +
    'address is refused. A published page replaces what was there before. ' +
    // Widened 2026-10-13 for create_worker — same class: something reachable by people who are
    // not signed in. Named here because "publish a page" would not make anyone expect code.
    'It can also write CODE for a small standalone Cloudflare Worker and put it in the public ' +
    'GitHub repo. The code is visible there at once, but the worker does not go into production ' +
    'until the owner has approved it on GitHub. Such a worker has no access to database, ' +
    'storage or secrets. ' +
    // Widened 2026-11-13 for publish_component — the same class again, and the one case here
    // with NO approval step, so the copy has to say that in so many words.
    'It can also update a COMPONENT that your web pages load (for example the portfolio) with ' +
    'the code that is in the GitHub repo Agent-Builder. This happens WITHOUT approval on GitHub, ' +
    'and the new code runs on every page that uses the component within a few minutes. The ' +
    'assistant cannot send in code of its own here — only fetch what is already in the repo. ' +
    'Works for Superadmin only.',
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
    'Lets the assistant send messages that reach other people, on your behalf, and change who ' +
    'is in chat groups YOU own or are admin of. Today that means CHAT GROUPS you are a member ' +
    'of, EMAIL AND SMS. Email: it can send from addresses that are on your own profile, or that ' +
    'someone has expressly allowed you to use — never from an address you are merely ' +
    'Superadmin over, and a sent email cannot be called back. SMS: it can send a text message ' +
    'to Norwegian mobile numbers, limited to an express list of who may send, with a daily ' +
    'limit. Superadmin alone gives nothing here either, the sender name is chosen by the ' +
    'server, and a sent SMS cannot be called back. The preview shows the message, the number of ' +
    'segments and the price before sending. ' +
    // Widened 2026-10-21 for send_meeting_report — same class: it writes into a customer's
    // contact log in an outside CMS and cannot be called back.
    'COACHING REPORT: it can send the meeting report from ContactHub (status, outcome and note) ' +
    'to the Enkel endring CMS, where it is stored on the conversation and in the customer\'s ' +
    'contact log — only for people on an express list, after a preview, and it cannot be called ' +
    'back. The scope covers message channels in general, so a future tool in the same class ' +
    'will use it instead of asking you to authorize again. The messages are posted by the ' +
    'assistant\'s own bot and are always marked as written by an AI on your behalf. It can only ' +
    'post in groups where the bot has been added. Messages cannot be deleted by the assistant ' +
    'afterwards. It can only add people who are already registered VEGR.AI users, and only in ' +
    'groups where you yourself are owner or admin — not in groups you are merely a member of.',
  'chat:read':
    'Lets the assistant read messages — also from other participants — in groups you are a ' +
    'member of and where the assistant\'s bot has been added. It sees only what you already see ' +
    'in the chat, and gets display names, never email addresses. Give this if you want to ask ' +
    'it to summarise a conversation. It also lets it read EMAIL in the inbox of an address you ' +
    'have, or have been allowed to send from (for example a shared mailbox): sender, subject, ' +
    'text and names of attachments. It cannot delete, move or mark email as read.',
}

/** Validate a user's opt-in picks: only real opt-in scopes, never anything else. */
export function sanitizeOptIns(picked) {
  const list = Array.isArray(picked) ? picked : [picked].filter(Boolean)
  return list.map(String).filter((s) => OPT_IN_SCOPES.includes(s))
}
