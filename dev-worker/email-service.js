/**
 * email-service.js — who may send e-mail as whom, for the MCP surface.
 *
 * THE GUARD THAT ONLY EXISTS HERE
 * -------------------------------
 * Nothing downstream performs the check this module performs, and the shape of the problem is the
 * same one chat-members.js describes for group membership.
 *
 * email-worker's `/send-cf-email` resolves the stored Cloudflare token from `userEmail` +
 * `accountId` and then calls `requireOwnership(claimed = userEmail || fromEmail)`
 * (email-worker/index.js:1364-1399). `userEmail` MUST be the holder's address, because that is
 * whose profile holds the credential. So `requireOwnership` either matches on identity, or it
 * passes because the caller is a Superadmin (index.js:132-142). There is no third thing it can
 * check — it has never heard of a grant.
 *
 * Agent-Builder reaches that route by letting a Superadmin name anybody (`forUserEmail`,
 * worker/tool-executors.js:8077-8089). That is sound there, where every caller is the system's
 * own operator. It is NOT the rule wanted here: the System Owner is a World Founder on many sites
 * and not all of them want mail sent in their name. So on this path the right to send as an
 * address is one of exactly two things, and Superadmin is neither:
 *
 *   own-profile — the address is in the CALLER's own settings.emailAccounts[]
 *   grant       — its holder granted it to the caller, deliberately and revocably
 *
 * `resolveSenderAccess` never reads `actor.isSuperadmin`. A test asserts that a Superadmin with
 * no grant is refused with the same code AND the same message string as a plain user, because a
 * refusal that varies with role is a bypass that has not been written yet.
 *
 * WHY THE OUTGOING CALL USES x-internal-auth
 * ------------------------------------------
 * Three ways to authenticate to email-worker were on the table. Forwarding the CALLER's own
 * `emailVerificationToken` loses, because `resolveCaller`'s api-token branch returns `role`
 * (email-worker/index.js:95-106) — so `isSuper` goes live again and the bypass comes back in
 * through a different door, while any non-Superadmin grantee gets a 403. Forwarding the HOLDER's
 * token loses for the same reason plus a worse one: that column is a full platform bearer
 * credential, so a bug in the gate here would become credential disclosure rather than a
 * wrong-sender bug.
 *
 * `x-internal-auth` + `x-internal-caller: <holder's address>` wins on one decisive property:
 * that branch returns `{ ok: true, email, mode: 'internal' }` with NO role field
 * (email-worker/index.js:76-94), so `isSuper` is false BY CONSTRUCTION. The bypass cannot fire on
 * this path even by accident, which is not true of either alternative.
 *
 * The price, said plainly: dev-worker can now assert any identity to email-worker, and
 * `requireOwnership` is a tautology for our calls because we supply the value it compares
 * against. The real check is the one above, in this file. A reader who assumes email-worker is
 * checking something will under-test this module.
 */

import { ERR, statusForCode } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(value) {
  const s = String(value || '').trim().toLowerCase()
  return EMAIL_RE.test(s) ? s : null
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * The single refusal for "you may not send as that address".
 *
 * It is a function returning one string so that every caller produces the same bytes. The message
 * deliberately does not say WHY the address is out of reach — whether it exists, who holds it, or
 * whether a grant was revoked rather than never made. A caller who has no access to an address
 * has no business learning its holder, the same reasoning requireGroupRole uses for group ids
 * (chat-members.js:62-66).
 */
function noSenderAccess(senderEmail) {
  return fail(
    ERR.FORBIDDEN_GRAPH,
    `You may not send as ${senderEmail}. It is not on your own profile, and nobody has granted ` +
      'it to you. Being a platform Superadmin grants nothing here — ask the address holder for a ' +
      'grant. Use list_email_senders to see what you can send as.',
    { senderEmail },
  )
}

/**
 * One profile's sending accounts, with credentials reported as PRESENT or ABSENT and never read.
 *
 * `settings.emailAccountPasswords[id]` holds a Cloudflare API token in plaintext in D1
 * (email-worker/index.js:2317-2320). This function is the only place that touches that map, it
 * touches it with `IS NOT NULL`, and nothing it returns can carry the value. Keep it that way:
 * everything upstream of here ends up in a model's context.
 */
async function loadProfileAccounts(env, email) {
  const address = normalizeEmail(email)
  if (!address) return { ok: false, reason: 'not an e-mail address' }
  const row = await env.vegvisr_org
    .prepare('SELECT email, data FROM config WHERE lower(email) = ? LIMIT 1')
    .bind(address)
    .first()
  if (!row?.email) return { ok: false, reason: 'no account row' }

  let settings = {}
  try {
    settings = (JSON.parse(row.data || '{}') || {}).settings || {}
  } catch {
    return { ok: false, reason: 'profile data is not readable' }
  }
  const raw = Array.isArray(settings.emailAccounts) ? settings.emailAccounts : []
  const passwords = settings.emailAccountPasswords || {}
  const verified = settings.emailAccountVerifiedAt || {}

  const accounts = raw
    .filter((a) => a && a.email)
    .map((a) => ({
      id: a.id || null,
      email: String(a.email).toLowerCase(),
      name: a.name || '',
      accountType: a.accountType || 'gmail',
      cfAccountId: a.cfAccountId || '',
      isDefault: !!a.isDefault,
      // Presence only. The value is never read, returned, or logged.
      hasCredential: a.id ? passwords[a.id] != null : false,
      lastVerifiedAt: a.id ? verified[a.id] || null : null,
    }))

  return { ok: true, email: String(row.email).toLowerCase(), accounts }
}

/** The account for one address within a profile's list, or null. */
function findAccount(accounts, senderEmail) {
  return accounts.find((a) => a.email === senderEmail) || null
}

/**
 * Is this account actually usable as a sender right now?
 *
 * v1 is cf-email-service only, and the restriction is not arbitrary. The gmail route on
 * email-worker (`/send-gmail-email`, index.js:1204) has NO ownership check at all and the worker
 * is public, so routing a delegated send through it would hand out a capability that is already
 * reachable without us. `/send-cf-email` at least verifies what we tell it. Widening this is a
 * separate decision that should follow fixing that route, not precede it.
 */
function accountUsable(account) {
  if (!account) return { ok: false, message: 'no such sending account' }
  if (account.accountType !== 'cf-email-service') {
    return {
      ok: false,
      message:
        `sending accounts of type "${account.accountType}" cannot be used here — this surface ` +
        'sends only through Cloudflare Email Sending (cf-email-service)',
    }
  }
  if (!account.id) return { ok: false, message: 'the stored account has no id' }
  if (!account.cfAccountId) return { ok: false, message: 'the stored account has no Cloudflare account id' }
  if (!account.hasCredential) return { ok: false, message: 'no credential is stored for that account' }
  return { ok: true }
}

/** The live grant letting `grantee` send as `sender`, or null. Expiry is evaluated here, not in SQL. */
async function liveGrant(env, senderEmail, granteeEmail) {
  const row = await env.vegvisr_org
    .prepare(
      `SELECT id, sender_email, holder_email, grantee_email, granted_by, granted_at, expires_at, note
         FROM email_sender_grants
        WHERE sender_email = ? AND grantee_email = ? AND revoked_at IS NULL
        LIMIT 1`,
    )
    .bind(senderEmail, granteeEmail)
    .first()
  if (!row) return null
  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    return { ...row, expired: true }
  }
  return { ...row, expired: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// The gate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * May this actor send as this address, and on what basis?
 *
 * Order matters. The caller's own profile is checked FIRST and the grant table is not read at
 * all when it hits — so an address you hold yourself keeps working whatever happens to the grant
 * table, and the common case costs one query. post@vegr.ai resolves this way today; post@nibi.no
 * does not, which is the whole reason grants exist.
 *
 * `actor.isSuperadmin` is never consulted. If you are adding a case here, that stays true.
 */
export async function resolveSenderAccess(env, { fromEmail, actor }) {
  if (!actor || actor.anonymous) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  const callerEmail = normalizeEmail(actor.email)
  if (!callerEmail) {
    return fail(ERR.FORBIDDEN_GRAPH, 'This token has no e-mail identity, so it owns no sending addresses.')
  }
  const senderEmail = normalizeEmail(fromEmail)
  if (!senderEmail) return fail(ERR.INVALID_INPUT, 'fromEmail must be a valid e-mail address.')

  // 1. Own profile.
  const mine = await loadProfileAccounts(env, callerEmail)
  if (mine.ok) {
    const account = findAccount(mine.accounts, senderEmail)
    if (account) {
      const usable = accountUsable(account)
      if (!usable.ok) {
        return fail(
          ERR.INVALID_INPUT,
          `${senderEmail} is on your profile, but ${usable.message}.`,
          { senderEmail, basis: 'own-profile' },
        )
      }
      return {
        ok: true,
        senderEmail,
        holderEmail: callerEmail,
        account,
        basis: 'own-profile',
        grantId: null,
        grantedBy: null,
        grantExpiresAt: null,
      }
    }
  }

  // 2. A grant.
  const grant = await liveGrant(env, senderEmail, callerEmail)
  if (!grant) return noSenderAccess(senderEmail)
  if (grant.expired) {
    return fail(
      ERR.FORBIDDEN_GRAPH,
      `Your grant to send as ${senderEmail} expired on ${grant.expires_at}. Ask ${grant.holder_email} for a new one.`,
      { senderEmail, expiredAt: grant.expires_at },
    )
  }

  // 3. A live grant is a claim about the past. Verify it still describes the present: the holder
  //    may have removed the address, swapped its type, or lost the credential since.
  const holder = await loadProfileAccounts(env, grant.holder_email)
  if (!holder.ok) {
    return fail(
      ERR.FORBIDDEN_GRAPH,
      `Your grant to send as ${senderEmail} is stale: ${grant.holder_email} ${holder.reason}.`,
      { senderEmail, holderEmail: grant.holder_email },
    )
  }
  const account = findAccount(holder.accounts, senderEmail)
  const usable = accountUsable(account)
  if (!usable.ok) {
    return fail(
      ERR.FORBIDDEN_GRAPH,
      `Your grant to send as ${senderEmail} is stale: on ${grant.holder_email}'s profile, ${usable.message}.`,
      { senderEmail, holderEmail: grant.holder_email },
    )
  }

  return {
    ok: true,
    senderEmail,
    holderEmail: holder.email,
    account,
    basis: 'grant',
    grantId: grant.id,
    grantedBy: grant.granted_by,
    grantExpiresAt: grant.expires_at || null,
  }
}

/**
 * Every address this actor may send as, and why each one is allowed.
 *
 * Never returns an accountId, a cfAccountId or a credential — the id is what `/send-gmail-email`
 * needs to impersonate a sender without any ownership check (see accountUsable), so handing one
 * to a model would make that gap reachable from here.
 */
export async function listSendableSenders(env, { actor }) {
  if (!actor || actor.anonymous) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  const callerEmail = normalizeEmail(actor.email)
  if (!callerEmail) {
    return fail(ERR.FORBIDDEN_GRAPH, 'This token has no e-mail identity, so it owns no sending addresses.')
  }

  const senders = []
  const seen = new Set()

  const mine = await loadProfileAccounts(env, callerEmail)
  if (mine.ok) {
    for (const a of mine.accounts) {
      const usable = accountUsable(a)
      if (!usable.ok) continue
      seen.add(a.email)
      senders.push({
        email: a.email,
        fromName: a.name || null,
        basis: 'own-profile',
        holderEmail: callerEmail,
        grantedBy: null,
        expiresAt: null,
        note: null,
        lastVerifiedAt: a.lastVerifiedAt,
      })
    }
  }

  const { results } = await env.vegvisr_org
    .prepare(
      `SELECT id, sender_email, holder_email, granted_by, granted_at, expires_at, note
         FROM email_sender_grants
        WHERE grantee_email = ? AND revoked_at IS NULL
        ORDER BY granted_at DESC`,
    )
    .bind(callerEmail)
    .all()

  for (const g of results || []) {
    if (seen.has(g.sender_email)) continue
    if (g.expires_at && new Date(g.expires_at) <= new Date()) continue
    const holder = await loadProfileAccounts(env, g.holder_email)
    if (!holder.ok) continue
    const account = findAccount(holder.accounts, g.sender_email)
    if (!accountUsable(account).ok) continue
    seen.add(g.sender_email)
    senders.push({
      email: g.sender_email,
      fromName: account.name || null,
      basis: 'grant',
      holderEmail: g.holder_email,
      grantedBy: g.granted_by,
      expiresAt: g.expires_at || null,
      note: g.note || null,
      lastVerifiedAt: account.lastVerifiedAt,
    })
  }

  return { ok: true, senders, count: senders.length }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delegate one sending address to one person.
 *
 * ONLY THE HOLDER MAY DO THIS. Not a Superadmin, and deliberately not the World Founder of the
 * sender's domain either — the System Owner is a founder on many sites, so founder-on-paper must
 * not be a self-service route into a World's mailbox. If founder-granting is ever added it must
 * exclude self-grant for exactly that reason.
 *
 * The granter is the VALIDATED caller. There is no field in which to name somebody else.
 */
export async function createSenderGrant(env, { senderEmail, granteeEmail, expiresInDays, note, actor }) {
  if (!actor || actor.anonymous) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  const callerEmail = normalizeEmail(actor.email)
  if (!callerEmail) return fail(ERR.FORBIDDEN_GRAPH, 'This token has no e-mail identity.')

  const sender = normalizeEmail(senderEmail)
  if (!sender) return fail(ERR.INVALID_INPUT, 'senderEmail must be a valid e-mail address.')
  const grantee = normalizeEmail(granteeEmail)
  if (!grantee) return fail(ERR.INVALID_INPUT, 'granteeEmail must be a valid e-mail address.')
  if (grantee === callerEmail) {
    return fail(ERR.INVALID_INPUT, 'You already hold that address — a grant to yourself would change nothing.')
  }

  // The caller must hold the address. This is the whole authorisation.
  const mine = await loadProfileAccounts(env, callerEmail)
  if (!mine.ok) return fail(ERR.FORBIDDEN_GRAPH, `Your profile could not be read: ${mine.reason}.`)
  const account = findAccount(mine.accounts, sender)
  if (!account) {
    // Same non-enumeration rule as noSenderAccess: do not reveal who does hold it.
    return fail(
      ERR.FORBIDDEN_GRAPH,
      `${sender} is not a sending address on your profile, so it is not yours to delegate. ` +
        'Only the account holder can grant it; being a Superadmin grants nothing here.',
      { senderEmail: sender },
    )
  }
  const usable = accountUsable(account)
  if (!usable.ok) {
    return fail(ERR.INVALID_INPUT, `${sender} cannot be delegated: ${usable.message}.`, { senderEmail: sender })
  }

  // The grantee must be a real registered person, checked before the row is written.
  const target = await env.vegvisr_org
    .prepare('SELECT email FROM config WHERE lower(email) = ? LIMIT 1')
    .bind(grantee)
    .first()
  if (!target?.email) {
    return fail(
      ERR.GRAPH_NOT_FOUND,
      `${grantee} is not a registered user, so there is nobody to grant this to.`,
      { granteeEmail: grantee },
    )
  }

  const existing = await liveGrant(env, sender, grantee)
  if (existing && !existing.expired) {
    // Not an error — the same precedent addGroupMember sets for an existing member.
    return {
      ok: true,
      alreadyGranted: true,
      grantId: existing.id,
      senderEmail: sender,
      granteeEmail: grantee,
      holderEmail: existing.holder_email,
      grantedBy: existing.granted_by,
      grantedAt: existing.granted_at,
      expiresAt: existing.expires_at || null,
    }
  }
  if (existing && existing.expired) {
    // An expired row still occupies the live partial index, so retire it before writing a new one.
    await env.vegvisr_org
      .prepare('UPDATE email_sender_grants SET revoked_at = ?, revoked_by = ? WHERE id = ?')
      .bind(nowIso(), 'system:expired', existing.id)
      .run()
  }

  const days = Number(expiresInDays)
  const expiresAt =
    Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 86400000).toISOString()
      : null

  const id = crypto.randomUUID()
  const grantedAt = nowIso()
  await env.vegvisr_org
    .prepare(
      `INSERT INTO email_sender_grants
         (id, sender_email, holder_email, grantee_email, granted_by, granted_at, expires_at, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, sender, callerEmail, grantee, callerEmail, grantedAt, expiresAt, note ? String(note).slice(0, 500) : null)
    .run()

  return {
    ok: true,
    alreadyGranted: false,
    grantId: id,
    senderEmail: sender,
    granteeEmail: grantee,
    holderEmail: callerEmail,
    grantedBy: callerEmail,
    grantedAt,
    expiresAt,
  }
}

/**
 * Withdraw a grant. The row survives with revoked_at set, so the history is not destroyed.
 *
 * Holder, grantee or Superadmin. The Superadmin asymmetry is deliberate rather than an
 * inconsistency with createSenderGrant: revocation only ever REMOVES capability, so it can never
 * become a bypass. Creation is where Superadmin counts for nothing.
 */
export async function revokeSenderGrant(env, { grantId, actor }) {
  if (!actor || actor.anonymous) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  const callerEmail = normalizeEmail(actor.email)
  if (!callerEmail) return fail(ERR.FORBIDDEN_GRAPH, 'This token has no e-mail identity.')
  if (!grantId) return fail(ERR.INVALID_INPUT, 'grantId is required.')

  const row = await env.vegvisr_org
    .prepare('SELECT id, sender_email, holder_email, grantee_email, revoked_at FROM email_sender_grants WHERE id = ? LIMIT 1')
    .bind(grantId)
    .first()
  if (!row) return fail(ERR.GRAPH_NOT_FOUND, 'No such grant.', { grantId })

  const mayRevoke =
    row.holder_email === callerEmail || row.grantee_email === callerEmail || actor.isSuperadmin
  if (!mayRevoke) {
    return fail(ERR.FORBIDDEN_GRAPH, 'That grant is not yours to withdraw.', { grantId })
  }
  if (row.revoked_at) {
    return {
      ok: true,
      alreadyRevoked: true,
      grantId,
      senderEmail: row.sender_email,
      granteeEmail: row.grantee_email,
      revokedAt: row.revoked_at,
    }
  }

  const revokedAt = nowIso()
  await env.vegvisr_org
    .prepare('UPDATE email_sender_grants SET revoked_at = ?, revoked_by = ? WHERE id = ?')
    .bind(revokedAt, callerEmail, grantId)
    .run()

  return {
    ok: true,
    alreadyRevoked: false,
    grantId,
    senderEmail: row.sender_email,
    granteeEmail: row.grantee_email,
    revokedAt,
  }
}

/** Grants this actor is party to — as holder, as grantee, or as the person who made them. */
export async function listSenderGrants(env, { actor, includeRevoked }) {
  if (!actor || actor.anonymous) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  const callerEmail = normalizeEmail(actor.email)
  if (!callerEmail) return fail(ERR.FORBIDDEN_GRAPH, 'This token has no e-mail identity.')

  const where = includeRevoked ? '' : ' AND revoked_at IS NULL'
  const { results } = await env.vegvisr_org
    .prepare(
      `SELECT id, sender_email, holder_email, grantee_email, granted_by, granted_at,
              expires_at, revoked_at, revoked_by, note
         FROM email_sender_grants
        WHERE (holder_email = ? OR grantee_email = ? OR granted_by = ?)${where}
        ORDER BY granted_at DESC
        LIMIT 200`,
    )
    .bind(callerEmail, callerEmail, callerEmail)
    .all()

  const now = new Date()
  const grants = (results || []).map((g) => ({
    grantId: g.id,
    senderEmail: g.sender_email,
    holderEmail: g.holder_email,
    granteeEmail: g.grantee_email,
    grantedBy: g.granted_by,
    grantedAt: g.granted_at,
    expiresAt: g.expires_at || null,
    revokedAt: g.revoked_at || null,
    revokedBy: g.revoked_by || null,
    note: g.note || null,
    live: !g.revoked_at && (!g.expires_at || new Date(g.expires_at) > now),
    yourRole:
      g.holder_email === callerEmail ? 'holder' : g.grantee_email === callerEmail ? 'grantee' : 'granter',
  }))

  return { ok: true, grants, count: grants.length }
}
