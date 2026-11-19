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
import { startWorldHandoff, redeemWorldHandoff, WORLD_ERR } from './world-login.js'
import { knownWorld } from '../graph-store.js'
import { STARTER_TOOLS, sanitizeToolSet } from '../mcp/tool-sets.js'
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
    // ENGLISH ONLY (owner decision 2026-11-19): these pages are read by World Founders outside
    // Norway, and Norwegians read English. Do not add Norwegian copy back.
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
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
  return page('Sign in', `
<h1>Sign in</h1>
<p class="sub"><span class="client">${esc(tx.clientName || tx.clientId)}</span> wants to connect to your knowledge graphs.</p>
${error ? `<div class="err">${esc(error)}</div>` : ''}
${hint ? `<div class="ok">${esc(hint)}</div>` : ''}
<form method="POST" action="/authorize">
  <input type="hidden" name="tx" value="${esc(tx.txId)}">
  <input type="hidden" name="action" value="send-otp">
  <label for="phone">Norwegian mobile number</label>
  <input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required autofocus
         placeholder="+47 000 00 000">
  <button type="submit">Send code</button>
</form>
<p class="sub" style="margin-top:18px">You get a 6-digit code by SMS. The number must be registered on your VEGR.AI account. Norwegian numbers only.</p>
<hr style="border:0;border-top:1px solid var(--line);margin:22px 0">
<p class="sub" style="margin-bottom:0"><strong>Do you have your own World?</strong> Then you can sign in there instead, without an SMS code.</p>
<form method="POST" action="/authorize">
  <input type="hidden" name="tx" value="${esc(tx.txId)}">
  <input type="hidden" name="action" value="world-start">
  <label for="world">The address of your World</label>
  <input id="world" name="world" type="text" inputmode="url" autocapitalize="none" autocomplete="off" spellcheck="false"
         required placeholder="yourdomain.com">
  <button class="secondary" type="submit">Sign in with your World</button>
</form>`)
}

function codeForm(tx, error, notice) {
  return page('Enter the code', `
<h1>Enter the code</h1>
<p class="sub">We have sent a 6-digit code by SMS. It is valid for ${OTP_LIMITS.CODE_TTL_SECONDS / 60} minutes.</p>
${error ? `<div class="err">${esc(error)}</div>` : ''}
${notice ? `<div class="ok">${esc(notice)}</div>` : ''}
<form method="POST" action="/authorize" id="codeform">
  <input type="hidden" name="tx" value="${esc(tx.txId)}">
  <input type="hidden" name="action" value="verify-otp">
  <label for="code">Code</label>
  <input id="code" name="code" class="otp" inputmode="numeric" autocomplete="one-time-code"
         pattern="[0-9]{6}" maxlength="6" required autofocus>
  <button type="submit">Confirm</button>
</form>
<form method="POST" action="/authorize">
  <input type="hidden" name="tx" value="${esc(tx.txId)}">
  <input type="hidden" name="action" value="send-otp">
  <input type="hidden" name="phone" value="${esc(tx.phone || '')}">
  <button class="secondary" type="submit">Send a new code</button>
</form>
<p class="sub" style="margin-top:14px">No code? The number must be registered on your account.
Add it under your profile at vegvisr.org, and try again.</p>
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
  return page('Give access', `
<h1>Give access</h1>
<p class="sub"><span class="client">${esc(tx.clientName || tx.clientId)}</span> asks for access to the account
<strong>${esc(tx.email)}</strong>.</p>
<ul class="scopes">
  ${scopes.map((s) => `<li>${esc(SCOPE_TEXT[s] || s)}<br><code>${esc(s)}</code></li>`).join('')}
</ul>
<form method="POST" action="/authorize">
  <input type="hidden" name="tx" value="${esc(tx.txId)}">
  <input type="hidden" name="action" value="approve">
  <p class="sub" style="margin:18px 0 0"><strong>Which tools should it get?</strong></p>
  <label class="optin">
    <input type="radio" name="toolset" value="starter">
    <span><strong>Starter</strong><br>
    <span class="detail">Graphs, nodes, node types, images and albums — for working with the editor and Garnet.
    About ${STARTER_TOOLS.length} tools. Of the boxes below, only "Delete graphs" adds anything to Starter.</span></span>
  </label>
  <label class="optin">
    <input type="radio" name="toolset" value="all" checked>
    <span><strong>Everything</strong><br>
    <span class="detail">Every tool that the access above and the boxes you tick below allow.</span></span>
  </label>
  <p class="sub" style="margin:18px 0 0"><strong>Extra access</strong> — tick only what you need.</p>
  ${OPT_IN_SCOPES.map((s) => `
  <label class="optin">
    <input type="checkbox" name="optin" value="${esc(s)}">
    <span><strong>${esc(SCOPE_TEXT[s] || s)}</strong> <code>${esc(s)}</code><br>
    <span class="detail">${esc(OPT_IN_SCOPE_DETAIL[s] || '')}</span></span>
  </label>`).join('')}
  <button type="submit">Approve access</button>
</form>
<script>
// A second submit cannot be honoured: approving deletes the transaction, so the next POST finds
// nothing and can only say so. The two POSTs a second apart that produced the 2026-09-30 error
// page came from here, after the grant had already succeeded. Disabling on submit removes the
// cause; expiredPage() handles whatever still gets through.
for (const form of document.querySelectorAll('form')) {
  form.addEventListener('submit', () => {
    for (const b of form.querySelectorAll('button')) { b.disabled = true }
    const go = form.querySelector('button[type=submit]')
    if (go) { go.textContent = 'One moment…' }
  }, { once: true })
}
</script>
<form method="POST" action="/authorize">
  <input type="hidden" name="tx" value="${esc(tx.txId)}">
  <input type="hidden" name="action" value="deny">
  <button class="secondary" type="submit">Decline</button>
</form>
<p class="sub" style="margin-top:18px">You can withdraw the access later. The access covers only the graphs you own yourself.</p>`)
}

/**
 * The transaction is gone. Called whenever getTx returns nothing.
 *
 * This function was referenced from two places and never written. Both references sit behind
 * `if (!tx)`, which is not the common path, so it survived every walkthrough of the flow and
 * threw a ReferenceError in production instead — the Error 1101 seen at 15:25 and again at 20:06
 * on 2026-09-30. The error boundary added in between named it in twelve seconds.
 *
 * TWO DIFFERENT SITUATIONS ARRIVE HERE AND CANNOT BE TOLD APART. The transaction may have
 * expired after its 15-minute TTL, or it may have been approved a moment ago and deleted on the
 * way out — which is exactly what happened: an approve at 20:06:41 granted the scopes and removed
 * the transaction, and a second submit one second later found nothing. Keeping a spent
 * transaction in KV so the two could be distinguished would leave a replayable consent sitting
 * around for the rest of its TTL, which is the thing deleteTx exists to prevent.
 *
 * So the page covers both, and tells the likelier one first: someone reading it has almost
 * certainly just clicked Approve.
 */
function expiredPage() {
  return page(
    'This window is done',
    `<h1>This window is done</h1>
     <p class="sub">If you have just approved access, the connection is already active — close the
     window and go back to the app. You do not need to do anything more.</p>
     <p class="sub">Otherwise the sign-in has expired. It lasts 15 minutes. Start the connection
     again from the app.</p>`,
    { status: 400 },
  )
}

const OTP_MESSAGES = {
  [OTP_ERR.BAD_PHONE]: 'Enter a valid Norwegian mobile number. No Norwegian number? Use "Sign in with your World" below.',
  [OTP_ERR.RATE_LIMITED]: 'Too many code requests. Try again later.',
  [OTP_ERR.NO_CHALLENGE]: 'No active code. Ask for a new one.',
  [OTP_ERR.EXPIRED]: 'The code has expired. Ask for a new one.',
  [OTP_ERR.TOO_MANY_ATTEMPTS]: 'Too many attempts. Ask for a new code.',
  [OTP_ERR.WRONG_CODE]: 'Wrong code.',
  [OTP_ERR.SMS_FAILED]: 'Could not send the SMS. Try again.',
  [OTP_ERR.TX_NOT_FOUND]: 'The sign-in has expired. Start again from the app.',
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function handleAuthorize(request, env, ctx) {
  const url = new URL(request.url)
  // Filled in by handlePost once the form is parsed. A POST carries its action and tx in the
  // BODY, which cannot be read again from inside the catch — the stream is already consumed — so
  // the step that failed has to be recorded on the way past or it is lost.
  const trace = { action: request.method, txId: '-' }
  try {
    if (request.method === 'GET') return await handleGet(request, env, url)
    if (request.method === 'POST') return await handlePost(request, env, url, trace)
    return page('Error', '<h1>Method not supported</h1>', { status: 405 })
  } catch (error) {
    return authorizeFailure(trace, error)
  }
}

/**
 * The error boundary this page did not have.
 *
 * Nothing on the POST path was wrapped: sendChallenge talks to the SMS gateway, verifyChallenge
 * and putTx talk to KV, and completeAuthorization talks to the OAuth provider's own storage. A
 * throw from any of them left the runtime to answer, so the user got Cloudflare's raw
 * "Error 1101 — Worker threw exception" page (seen 2026-09-30 15:25 UTC, mid-reconnect). That
 * page is the worst of both worlds: it tells the user nothing they can act on, it loses the
 * form they were filling in, and it leaves no line in the logs naming which step failed — so
 * the same failure is undiagnosable the next time too.
 *
 * What is deliberately NOT done here: retrying, or redirecting to the client's redirect_uri with
 * an error. A redirect needs a redirect_uri that has been VALIDATED against the registered
 * client, and at this point we may be holding an exception from before that validation happened.
 * Bouncing a user to an unvalidated address on the strength of a query parameter is how an open
 * redirect is built. So the failure is rendered here, on our own origin, and the user restarts
 * from the client.
 *
 * The log line carries the action, the transaction id and the error — never the phone number,
 * never the code, never a token. The tx id is random and short-lived, and it is the only thing
 * that makes one report findable among the rest.
 */
function authorizeFailure(trace, error) {
  console.error(
    `[OAuth authorize] uncaught ${error?.name || 'Error'} on ${trace.action} tx=${trace.txId}: ${error?.message || String(error)}`,
    error?.stack || '',
  )
  return page(
    'Something went wrong',
    `<h1>Something went wrong</h1>
     <p class="sub">The connection was not completed. No access has been given, and you can safely try again.</p>
     <p class="sub">Close this window and start the connection again from the app. If it happens again, give the time
     ${esc(new Date().toISOString())} — the error is logged.</p>`,
    { status: 500 },
  )
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
      return page('Invalid request', `<h1>Invalid request</h1><p class="sub">${esc(error.description)}</p><p><code>${esc(error.code)}</code></p>`, { status: 400 })
    }
    const redirect = new URL(error.redirectUri)
    redirect.searchParams.set('error', error.code)
    redirect.searchParams.set('error_description', error.description)
    if (error.state) redirect.searchParams.set('state', error.state)
    if (error.issuer) redirect.searchParams.set('iss', error.issuer)
    return Response.redirect(redirect.href, 302)
  }

  const client = await oauth.lookupClient(authRequest.clientId)
  if (!client) return page('Unknown client', '<h1>Unknown OAuth client</h1>', { status: 400 })

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

async function handlePost(request, env, url, trace = {}) {
  let form
  try {
    form = await request.formData()
  } catch {
    return page('Error', '<h1>Invalid form</h1>', { status: 400 })
  }
  const action = String(form.get('action') || '')
  const txId = String(form.get('tx') || '')
  // Recorded before anything can throw, so the error boundary can name the step. The tx id is
  // random and expires in 15 minutes; the phone number and the code never go anywhere near a log.
  trace.action = action || 'POST'
  trace.txId = txId || '-'

  // Coming back from a World's editor (oauth/world-login.js). This POST is cross-site by design
  // and carries no tx: the one-time hand-off id stands in for it, so the transaction id — the
  // CSRF token of every other action — never leaves this origin.
  if (action === 'world-token') {
    const result = await redeemWorldHandoff(env, { handoff: form.get('handoff'), token: form.get('token') })
    if (result.ok) {
      trace.txId = result.tx.txId
      console.log(`[OAuth] session from the World ${result.world} recognised; skipping the code step`)
      return consentForm(result.tx, grantableScopes(result.tx))
    }
    if (result.code === WORLD_ERR.BAD_TOKEN) {
      return phoneForm(result.tx, 'The sign-in from your World was not recognised. Sign in there again, and try once more.', null)
    }
    return expiredPage()
  }

  // The transaction id doubles as the CSRF token: it is 128 bits of randomness that only this
  // server and this browser have seen, so a cross-site form post cannot produce it.
  const tx = await getTx(env, txId)
  if (!tx) return expiredPage()

  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown'

  if (action === 'world-start') {
    // Only before anyone is identified: at consent there is nothing left to sign in to.
    if (tx.stage === 'consent') return renderStage(env, tx)
    const result = await startWorldHandoff(env, tx, form.get('world'), { knownWorld })
    if (!result.ok) {
      const msg = result.code === WORLD_ERR.UNKNOWN_WORLD
        ? 'Found no World with that address. Type the domain, for example yourdomain.com.'
        : 'Type the address of your World, for example yourdomain.com.'
      return phoneForm(tx, msg, null)
    }
    return Response.redirect(result.redirectTo, 302)
  }

  if (action === 'send-otp') {
    const result = await sendChallenge(env, { tx, phoneRaw: form.get('phone'), clientIp })
    if (!result.ok) {
      const msg = OTP_MESSAGES[result.code] || 'Could not send the code.'
      return tx.stage === 'otp' ? codeForm(tx, msg, null) : phoneForm(tx, msg, null)
    }
    // result.sent is false when the number does not match the account. The page must not say
    // so — it would reveal which number is on the account.
    if (tx.stage !== 'otp') {
      tx.stage = 'otp'
      await putTx(env, tx)
    }
    return codeForm(tx, null, 'Code sent, if the number matches the account.')
  }

  if (action === 'verify-otp') {
    const result = await verifyChallenge(env, { tx, codeRaw: form.get('code') })
    if (!result.ok) {
      const base = OTP_MESSAGES[result.code] || 'Wrong code.'
      const msg = result.remaining ? `${base} ${result.remaining} attempts left.` : base
      return result.code === OTP_ERR.WRONG_CODE ? codeForm(tx, msg, null) : phoneForm(tx, msg, null)
    }
    return consentForm(tx, grantableScopes(tx))
  }

  if (action === 'deny') {
    const redirectUri = tx.authRequest?.redirectUri
    await deleteTx(env, tx.txId)
    if (!redirectUri) return page('Declined', '<h1>Access declined</h1><p class="sub">You can close this window.</p>')
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
    // Starter or Everything (mcp/tool-sets.js). Chosen by the person on this page, stored on the
    // grant beside the identity — it narrows what the grant shows and grants nothing.
    const toolSet = sanitizeToolSet(form.get('toolset'))
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
        toolSet,
      },
    })

    // The transaction has served its purpose; leaving it in KV would leave a replayable
    // consent sitting around for the rest of its TTL.
    await deleteTx(env, tx.txId)
    console.log(`[OAuth] authorization granted to client=${tx.clientId} scopes=${scope.join(',')} toolSet=${toolSet}`)
    return Response.redirect(redirectTo, 302)
  }

  return page('Error', '<h1>Unknown action</h1>', { status: 400 })
}

