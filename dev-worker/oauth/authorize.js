/**
 * authorize.js — the interactive half of OAuth 2.1. The library owns discovery, /token,
 * revocation and registration; authenticating the person and taking consent is ours, because
 * only this application knows what a VEGR.AI user is.
 *
 * FLOW (revised 2026-09-27): phone code only, with a shortcut for an existing session.
 *
 * The first version signed the user in with a magic link and THEN asked for an SMS code, which
 * is the order src/views/LoginView.vue uses. In a browser that is what people expect; inside an
 * OAuth popup it is two round trips through two different apps before anyone has approved
 * anything, and it was rejected in use as too heavy. It is gone.
 *
 *   GET  /authorize?<oauth params>  → if the browser carries a valid vegvisr.org session cookie,
 *                                     straight to consent; otherwise ask for a mobile number
 *   POST action=send-otp            → SMS a code bound to this transaction
 *   POST action=verify-otp          → spend the code; the number is the identity claim
 *   POST action=approve             → completeAuthorization() → redirect with the code
 *
 * The session shortcut costs nothing and removes all typing for the common case: userStore
 * already sets `vegvisr_token` on `.vegvisr.org` with a 30-day lifetime, holding the same
 * emailVerificationToken the worker validates everywhere else. SameSite=Lax means it rides along
 * on the top-level navigation into /authorize. Consent is still shown — a session says who you
 * are, not that you agreed to hand an AI client your graphs.
 *
 * A phone number nobody has registered is answered exactly like one that is registered, so this
 * page cannot be used to find out who has an account.
 *
 * The transaction id is unguessable, lives in KV with a 15-minute TTL, and is the CSRF token
 * for every POST: a cross-site form post cannot know it.
 */

import { createTx, getTx, putTx, deleteTx, sendChallenge, verifyChallenge, OTP_ERR, OTP_LIMITS } from './otp.js'
import { AuthorizationError } from '@cloudflare/workers-oauth-provider'
import { CONNECT_SCOPES, KNOWN_SCOPES, SCOPE_TEXT, OPT_IN_SCOPES, OPT_IN_SCOPE_DETAIL, sanitizeOptIns, grantableScopes as pickScopes } from './scopes.js'

export const ISSUER = 'https://knowledge.vegvisr.org'
export const MCP_RESOURCE = `${ISSUER}/mcp`

// Scope policy lives in ./scopes.js so it is testable without the Workers runtime.
export { CONNECT_SCOPES, KNOWN_SCOPES, SCOPE_TEXT, OPT_IN_SCOPES } from './scopes.js'

/** The name index.js imports for the discovery document. */
export const SUPPORTED_SCOPES = CONNECT_SCOPES

// ─────────────────────────────────────────────────────────────────────────────
// Pages
// ─────────────────────────────────────────────────────────────────────────────

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function page(title, body, { status = 200 } = {}) {
  return new Response(
    `<!doctype html><html lang="no"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} — VEGR.AI</title>
<style>
:root{--bg:#0f1720;--card:#16212c;--text:#e8eef4;--muted:#93a4b3;--line:#24323f;--accent:#4aa3df;--bad:#e06c75}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
 background:var(--bg);color:var(--text);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:28px;width:100%;max-width:420px}
h1{margin:0 0 4px;font-size:20px}
.sub{color:var(--muted);font-size:14px;margin:0 0 20px}
label{display:block;font-size:13px;color:var(--muted);margin:16px 0 6px}
input{width:100%;padding:11px 12px;border-radius:8px;border:1px solid var(--line);background:#0e1620;color:var(--text);font-size:16px}
input:focus{outline:2px solid var(--accent);outline-offset:1px}
button{width:100%;margin-top:20px;padding:12px;border:0;border-radius:8px;background:var(--accent);color:#05121c;font-size:15px;font-weight:600;cursor:pointer}
button.secondary{background:transparent;color:var(--muted);border:1px solid var(--line);margin-top:10px;font-weight:400}
.err{margin:14px 0 0;padding:10px 12px;border-radius:8px;background:rgba(224,108,117,.12);border:1px solid rgba(224,108,117,.35);color:#f2b8bd;font-size:14px}
.ok{margin:14px 0 0;padding:10px 12px;border-radius:8px;background:rgba(74,163,223,.1);border:1px solid rgba(74,163,223,.3);font-size:14px}
ul.scopes{list-style:none;padding:0;margin:16px 0}
ul.scopes li{padding:10px 12px;border:1px solid var(--line);border-radius:8px;margin-bottom:8px;font-size:14px}
.client{font-weight:600}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:var(--muted)}
.foot{margin-top:22px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}
.otp{letter-spacing:.35em;text-align:center;font-size:22px}
label.optin{display:flex;gap:10px;align-items:flex-start;margin:18px 0 0;padding:12px;
 border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.02);cursor:pointer;font-size:14px;color:var(--text)}
label.optin input{width:auto;margin:2px 0 0;flex:none}
label.optin .detail{color:var(--muted);font-size:13px;display:block;margin-top:4px}
</style></head><body><div class="card">${body}<div class="foot">VEGR.AI · knowledge.vegvisr.org</div></div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )
}

function phoneForm(tx, error, hint) {
  return page('Logg inn', `
<h1>Logg inn</h1>
<p class="sub"><span class="client">${esc(tx.clientName || tx.clientId)}</span> vil koble seg til kunnskapsgrafene dine.</p>
${error ? `<div class="err">${esc(error)}</div>` : ''}
${hint ? `<div class="ok">${esc(hint)}</div>` : ''}
<form method="POST" action="/authorize">
  <input type="hidden" name="tx" value="${esc(tx.txId)}">
  <input type="hidden" name="action" value="send-otp">
  <label for="phone">Mobilnummer</label>
  <input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required autofocus
         placeholder="+47 000 00 000">
  <button type="submit">Send kode</button>
</form>
<p class="sub" style="margin-top:18px">Du får en 6-sifret kode på SMS. Nummeret må være registrert på VEGR.AI-kontoen din.</p>`)
}

function codeForm(tx, error, notice) {
  return page('Skriv koden', `
<h1>Skriv koden</h1>
<p class="sub">Vi har sendt en 6-sifret kode på SMS. Den er gyldig i ${OTP_LIMITS.CODE_TTL_SECONDS / 60} minutter.</p>
${error ? `<div class="err">${esc(error)}</div>` : ''}
${notice ? `<div class="ok">${esc(notice)}</div>` : ''}
<form method="POST" action="/authorize" id="codeform">
  <input type="hidden" name="tx" value="${esc(tx.txId)}">
  <input type="hidden" name="action" value="verify-otp">
  <label for="code">Kode</label>
  <input id="code" name="code" class="otp" inputmode="numeric" autocomplete="one-time-code"
         pattern="[0-9]{6}" maxlength="6" required autofocus>
  <button type="submit">Bekreft</button>
</form>
<form method="POST" action="/authorize">
  <input type="hidden" name="tx" value="${esc(tx.txId)}">
  <input type="hidden" name="action" value="send-otp">
  <input type="hidden" name="phone" value="${esc(tx.phone || '')}">
  <button class="secondary" type="submit">Send ny kode</button>
</form>
<p class="sub" style="margin-top:14px">Får du ingen kode? Nummeret må være registrert på kontoen din.
Legg det inn under profilen din på vegvisr.org, og prøv igjen.</p>
<script>
// WebOTP: on Chrome for Android the browser reads the code out of the SMS itself, because the
// message ends with "@knowledge.vegvisr.org #<code>". Safari does the same through
// autocomplete="one-time-code" above. Both need the SMS to land on the SAME device as this
// page, so on a desktop OAuth window neither fires and the user types six digits.
//
// Progressive enhancement only: every branch is guarded, and a failure is silent.
(function () {
  if (!('OTPCredential' in window)) return;
  var input = document.getElementById('code');
  var form = document.getElementById('codeform');
  if (!input || !form) return;
  var ac = new AbortController();
  form.addEventListener('submit', function () { ac.abort(); });
  navigator.credentials
    .get({ otp: { transport: ['sms'] }, signal: ac.signal })
    .then(function (otp) {
      if (!otp || !otp.code) return;
      input.value = otp.code;
      form.submit();
    })
    .catch(function () { /* declined, unsupported or aborted — the field still works */ });
})();
</script>`)
}

function consentForm(tx, scopes) {
  return page('Gi tilgang', `
<h1>Gi tilgang</h1>
<p class="sub"><span class="client">${esc(tx.clientName || tx.clientId)}</span> ber om tilgang til kontoen
<strong>${esc(tx.email)}</strong>.</p>
<ul class="scopes">
  ${scopes.map((s) => `<li>${esc(SCOPE_TEXT[s] || s)}<br><code>${esc(s)}</code></li>`).join('')}
</ul>
<form method="POST" action="/authorize">
  <input type="hidden" name="tx" value="${esc(tx.txId)}">
  <input type="hidden" name="action" value="approve">
  ${OPT_IN_SCOPES.map((s) => `
  <label class="optin">
    <input type="checkbox" name="optin" value="${esc(s)}">
    <span><strong>${esc(SCOPE_TEXT[s] || s)}</strong> <code>${esc(s)}</code><br>
    <span class="detail">${esc(OPT_IN_SCOPE_DETAIL[s] || '')}</span></span>
  </label>`).join('')}
  <button type="submit">Godkjenn tilgang</button>
</form>
<form method="POST" action="/authorize">
  <input type="hidden" name="tx" value="${esc(tx.txId)}">
  <input type="hidden" name="action" value="deny">
  <button class="secondary" type="submit">Avslå</button>
</form>
<p class="sub" style="margin-top:18px">Du kan trekke tilgangen tilbake senere. Tilgangen gjelder bare grafene du selv eier.</p>`)
}

const OTP_MESSAGES = {
  [OTP_ERR.BAD_PHONE]: 'Oppgi et gyldig norsk mobilnummer.',
  [OTP_ERR.RATE_LIMITED]: 'For mange kodeforespørsler. Prøv igjen senere.',
  [OTP_ERR.NO_CHALLENGE]: 'Ingen aktiv kode. Be om en ny.',
  [OTP_ERR.EXPIRED]: 'Koden er utløpt. Be om en ny.',
  [OTP_ERR.TOO_MANY_ATTEMPTS]: 'For mange forsøk. Be om en ny kode.',
  [OTP_ERR.WRONG_CODE]: 'Feil kode.',
  [OTP_ERR.SMS_FAILED]: 'Kunne ikke sende SMS. Prøv igjen.',
  [OTP_ERR.TX_NOT_FOUND]: 'Innloggingen er utløpt. Start på nytt fra appen.',
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function handleAuthorize(request, env, ctx) {
  const url = new URL(request.url)
  if (request.method === 'GET') return handleGet(request, env, url)
  if (request.method === 'POST') return handlePost(request, env, url)
  return page('Feil', '<h1>Metoden støttes ikke</h1>', { status: 405 })
}

/**
 * Resolve the vegvisr.org session cookie to a user, or null.
 *
 * `vegvisr_token` is set by src/stores/userStore.js on `.vegvisr.org` with a 30-day lifetime and
 * holds the same emailVerificationToken the worker's session auth validates everywhere else.
 * SameSite=Lax, so it is sent on the top-level navigation into /authorize but not on a
 * cross-site POST — which is why it is only read here, on a GET, and never treated as consent.
 */
async function userFromSessionCookie(request, env) {
  const header = request.headers.get('Cookie') || ''
  let token = null
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === 'vegvisr_token' && rest.length) {
      token = decodeURIComponent(rest.join('='))
      break
    }
  }
  if (!token || token === 'null' || token === 'undefined' || !token.trim()) return null
  try {
    const row = await env.vegvisr_org
      .prepare('SELECT user_id, email, Role FROM config WHERE emailVerificationToken = ? LIMIT 1')
      .bind(token)
      .first()
    if (!row) return null
    return { userId: row.user_id || row.email, email: row.email, role: row.Role || 'User' }
  } catch (e) {
    console.error('[OAuth] session cookie lookup failed:', e.message)
    return null
  }
}

async function handleGet(request, env, url) {
  const txId = url.searchParams.get('tx')

  // Resuming a transaction already in flight.
  if (txId) {
    const tx = await getTx(env, txId)
    if (!tx) return expiredPage()
    return renderStage(env, tx)
  }

  // A fresh authorization request from an MCP client.
  const oauth = env.OAUTH_PROVIDER
  let authRequest
  try {
    authRequest = await oauth.parseAuthRequest(request)
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error
    // Without a validated redirect URI there is nothing safe to redirect to, so the error is
    // rendered here rather than bounced to a caller-supplied address.
    if (!error.redirectUri) {
      return page('Ugyldig forespørsel', `<h1>Ugyldig forespørsel</h1><p class="sub">${esc(error.description)}</p><p><code>${esc(error.code)}</code></p>`, { status: 400 })
    }
    const redirect = new URL(error.redirectUri)
    redirect.searchParams.set('error', error.code)
    redirect.searchParams.set('error_description', error.description)
    if (error.state) redirect.searchParams.set('state', error.state)
    if (error.issuer) redirect.searchParams.set('iss', error.issuer)
    return Response.redirect(redirect.href, 302)
  }

  const client = await oauth.lookupClient(authRequest.clientId)
  if (!client) return page('Ukjent klient', '<h1>Ukjent OAuth-klient</h1>', { status: 400 })

  const tx = await createTx(env, {
    authRequest,
    clientId: authRequest.clientId,
    clientName: client.clientName,
  })

  // Already signed in on vegvisr.org in this browser? Then there is nothing to prove and no
  // reason to make anyone type a phone number and wait for an SMS. Consent is still required.
  const session = await userFromSessionCookie(request, env)
  if (session) {
    tx.email = session.email
    tx.userId = session.userId
    tx.role = session.role
    tx.stage = 'consent'
    await putTx(env, tx)
    console.log('[OAuth] existing vegvisr.org session recognised; skipping the code step')
    return consentForm(tx, grantableScopes(tx))
  }

  return phoneForm(tx, null, null)
}

function renderStage(env, tx) {
  if (tx.stage === 'consent') return consentForm(tx, grantableScopes(tx))
  if (tx.stage === 'otp') return codeForm(tx, null, null)
  return phoneForm(tx, null, null)
}

/** Only scopes the client asked for AND this version offers are ever granted. */
function grantableScopes(tx) {
  return pickScopes(tx.authRequest?.scope)
}

async function handlePost(request, env, url) {
  let form
  try {
    form = await request.formData()
  } catch {
    return page('Feil', '<h1>Ugyldig skjema</h1>', { status: 400 })
  }
  const action = String(form.get('action') || '')
  const txId = String(form.get('tx') || '')

  // The transaction id doubles as the CSRF token: it is 128 bits of randomness that only this
  // server and this browser have seen, so a cross-site form post cannot produce it.
  const tx = await getTx(env, txId)
  if (!tx) return expiredPage()

  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown'

  if (action === 'send-otp') {
    const result = await sendChallenge(env, { tx, phoneRaw: form.get('phone'), clientIp })
    if (!result.ok) {
      const msg = OTP_MESSAGES[result.code] || 'Kunne ikke sende kode.'
      return tx.stage === 'otp' ? codeForm(tx, msg, null) : phoneForm(tx, msg, null)
    }
    // result.sent is false when the number does not match the account. The page must not say
    // so — it would reveal which number is on the account.
    if (tx.stage !== 'otp') {
      tx.stage = 'otp'
      await putTx(env, tx)
    }
    return codeForm(tx, null, 'Kode sendt, hvis nummeret stemmer med kontoen.')
  }

  if (action === 'verify-otp') {
    const result = await verifyChallenge(env, { tx, codeRaw: form.get('code') })
    if (!result.ok) {
      const base = OTP_MESSAGES[result.code] || 'Feil kode.'
      const msg = result.remaining ? `${base} ${result.remaining} forsøk igjen.` : base
      return result.code === OTP_ERR.WRONG_CODE ? codeForm(tx, msg, null) : phoneForm(tx, msg, null)
    }
    return consentForm(tx, grantableScopes(tx))
  }

  if (action === 'deny') {
    const redirectUri = tx.authRequest?.redirectUri
    await deleteTx(env, tx.txId)
    if (!redirectUri) return page('Avslått', '<h1>Tilgang avslått</h1><p class="sub">Du kan lukke dette vinduet.</p>')
    const redirect = new URL(redirectUri)
    redirect.searchParams.set('error', 'access_denied')
    redirect.searchParams.set('error_description', 'The user denied the request.')
    if (tx.authRequest?.state) redirect.searchParams.set('state', tx.authRequest.state)
    return Response.redirect(redirect.href, 302)
  }

  if (action === 'approve') {
    if (tx.stage !== 'consent') return renderStage(env, tx)

    // What the client asked for (intersected with CONNECT_SCOPES) plus anything the USER ticked.
    // The opt-ins are never requested by a client — they are unadvertised — so this is the only
    // way they can be granted, and it takes a person on this page to do it.
    const optedIn = sanitizeOptIns(form.getAll ? form.getAll('optin') : form.get('optin'))
    const scope = [...new Set([...grantableScopes(tx), ...optedIn])]
    if (optedIn.length) {
      console.log(`[OAuth] user opted in to ${optedIn.join(',')} for client=${tx.clientId}`)
    }
    const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
      request: tx.authRequest,
      userId: tx.userId,
      metadata: { clientName: tx.clientName, authenticatedAt: new Date().toISOString() },
      scope,
      // props is what every MCP tool call will see as its caller. It carries the identity the
      // magic link and the OTP established — never anything a tool argument could set.
      props: {
        userId: tx.userId,
        email: tx.email,
        role: tx.role,
        authMethod: 'oauth_otp',
      },
    })

    // The transaction has served its purpose; leaving it in KV would leave a replayable
    // consent sitting around for the rest of its TTL.
    await deleteTx(env, tx.txId)
    console.log(`[OAuth] authorization granted to client=${tx.clientId} scopes=${scope.join(',')}`)
    return Response.redirect(redirectTo, 302)
  }

  return page('Feil', '<h1>Ukjent handling</h1>', { status: 400 })
}

