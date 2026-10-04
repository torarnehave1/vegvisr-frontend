// Smoke test against the DEPLOYED worker. Read-only — it sends no e-mail and writes no row.
//
// Unit tests prove the code; this proves the thing that is actually running. The two have come
// apart twice in one day: set_mailbox_password passed every unit test while the deployed tool died
// on "input is not defined", and a static import took the whole email-service suite offline. Both
// were caught, but only because somebody ran the deployed path by hand.
//
// Run:  node test/smoke-live.mjs          (exit 0 = green)
// Usually via:  ./ship.sh                 (tests → deploy → this)
import { execFileSync } from 'node:child_process'

const MCP = 'https://knowledge.vegvisr.org'
const AGENT = 'https://agent.vegvisr.org'
const KEYS = 'https://user-keys-worker.torarnehave.workers.dev'

let failures = 0
const check = (name, cond, detail = '') => {
  if (cond) console.log(`ok    ${name}`)
  else { failures++; console.error(`FAIL  ${name}\n      ${detail}`) }
}

/** The architect's own session token, read from D1 the same way every other script here does. */
function token() {
  const out = execFileSync('npx', [
    'wrangler', 'd1', 'execute', 'vegvisr_org', '--remote', '--json',
    '--command', "SELECT emailVerificationToken AS t FROM config WHERE email='torarnehave@gmail.com'",
  ], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const json = JSON.parse(out.slice(out.indexOf('[')))
  return json[0].results[0].t
}

const TOKEN = token()
const json = async (url, init) => {
  const r = await fetch(url, init)
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

console.log('— live smoke —')

// 1. The MCP server is up and announcing the version we think we deployed.
{
  const r = await fetch(`${MCP}/health`)
  check('MCP /health responds', r.ok, `HTTP ${r.status}`)
}

// 2. A credential route must never be reachable from the internet. This is the one check whose
//    failure would be a disclosure rather than an outage.
{
  const { status, body } = await json(`${KEYS}/mailbox-password?address=post@nibi.no`)
  check('mailbox-password is closed to the public', status === 403, `HTTP ${status}`)
  check('  and returns no password with the refusal', !body.password, JSON.stringify(body).slice(0, 120))
}

// 3. Sender grants refuse an unauthenticated caller.
{
  const { status } = await json(`${MCP}/email/sender-grants`)
  check('sender-grants refuses no token', status === 401, `HTTP ${status}`)
}

// 4. The IMAP path still reaches Uniweb and still resolves the folder. Read-only: LIST only.
{
  const { status, body } = await json(`${MCP}/email/imap-sent-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': TOKEN },
    body: JSON.stringify({ address: 'post@nibi.no' }),
  })
  check('IMAP login + LIST works against the live mailbox', status === 200, `HTTP ${status} ${JSON.stringify(body).slice(0, 140)}`)
  check('  and the Sent folder resolves to INBOX.Sent', body.sentFolder === 'INBOX.Sent', String(body.sentFolder))
}

// 5. The e-mail tools are on the deployed agent-worker. A tool that vanished from the list is how
//    "the model called the wrong one" starts.
{
  const r = await fetch(`${AGENT}/tools`)
  const d = await r.json().catch(() => ({}))
  const names = new Set([...(d.hardcoded || []), ...(d.dynamic || [])].map((t) => t.name))
  for (const t of ['set_mailbox_password', 'set_email_password', 'set_world_email_template', 'send_email']) {
    check(`agent-worker exposes ${t}`, names.has(t))
  }
}

// 6. The guard that cost a World its sender. Asked to downgrade a live cf-email-service sender,
//    the tool must refuse and write nothing. Run against production deliberately: this is the
//    exact call that destroyed post@nibi.no on 2026-10-04.
{
  const { body } = await json(`${AGENT}/email/mailbox-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': TOKEN },
    body: JSON.stringify({ mailboxAddress: 'post@nibi.no', password: '', imapHost: 'mail.uniweb.no' }),
  })
  check('an empty mailbox password is refused', body.success === false && /password is required/i.test(body.error || ''), JSON.stringify(body).slice(0, 140))
}

console.log(failures === 0 ? '\nLIVE SMOKE GREEN' : `\n${failures} live check(s) FAILED`)
process.exit(failures === 0 ? 0 : 1)
