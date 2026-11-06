/**
 * flow-tools.js — run ONE MCP tool for a VEGR Flow, as the flow's owner (2026-11-06).
 *
 * Decision (Tor Arne, 6 Nov 2026): flows use the same tools as this MCP server. An action step's
 * toolName is one of these tools, and flows-worker asks for it here over its KG_WORKER service
 * binding. So the tool, its checks and its output are exactly what Claude gets in chat — one
 * catalogue, one access control.
 *
 * How the call is made: the tool is invoked through a real McpServer + in-memory Client, built
 * the way a connected chat session is (registerTools with an auth/props context). Nothing is
 * re-implemented, so a tool cannot behave differently in a flow than in chat.
 *
 * Who the call acts as — the "flow principal":
 *   - the owner named by flows-worker, looked up in config; role from that row, never from the
 *     caller (same rule as validateAuth's x-acting-user-email on the binding path);
 *   - read scopes only (graph:read, contacts:read);
 *   - and only tools annotated readOnlyHint — with ONE exception, an approved send (2026-11-06):
 *     a tool in FLOW_SEND_TOOLS runs when, and only when, D1 shows that THIS run belongs to the
 *     owner, is live and running, has a step at the given seq claimed as "sending" for this very
 *     tool, and an earlier approval step in the same run that the owner approved. The claim is
 *     flipped to "calling" with a conditional UPDATE, so one claim sends one message. In this
 *     phase a flow e-mail may go to the owner only (no cc/bcc): the owner approved the text, and
 *     recipients are never taken from model output (VEGR Flows safety rule 3).
 *   Anything else that writes or sends is refused here, not merely discouraged by the compiler.
 *
 * Reachable only over the binding (hostname knowledge-graph-worker); the route checks that.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerTools } from './mcp/tools.js'

export const FLOW_SCOPES = ['graph:read', 'contacts:read']

/** Tools a flow may run after an approval, with the one scope each needs. */
export const FLOW_SEND_TOOLS = { send_email: 'chat:write' }

/**
 * Is this send approved? Returns null when it may run, otherwise the refusal. Consumes the claim.
 */
async function checkApprovedSend(env, owner, toolName, args, approval) {
  const deny = (error) => ({ ok: false, status: 403, error })
  const runId = String(approval?.runId || '')
  const seq = Number(approval?.seq)
  if (!/^[0-9a-f-]{36}$/.test(runId) || !Number.isInteger(seq) || seq < 1) return deny(`"${toolName}" sends something; a flow can run it only after an approval.`)
  const db = env.vegvisr_org
  const run = await db.prepare('SELECT owner_email, dry_run, status FROM flow_runs WHERE id = ?').bind(runId).first().catch(() => null)
  if (!run || String(run.owner_email).toLowerCase() !== owner.email || run.dry_run !== 0 || run.status !== 'running') {
    return deny('That flow run is not a live, running run of yours.')
  }
  const row = await db.prepare('SELECT kind, status, detail_json FROM flow_run_steps WHERE run_id = ? AND seq = ?').bind(runId, seq).first().catch(() => null)
  let claimedTool = null
  try { claimedTool = JSON.parse(row?.detail_json || '{}').toolName } catch { /* not a claim */ }
  if (!row || row.kind !== 'action' || row.status !== 'sending' || claimedTool !== toolName) {
    return deny('This send was not claimed by the flow run, or it has already been made.')
  }
  const approved = await db.prepare(
    "SELECT seq FROM flow_run_steps WHERE run_id = ? AND kind = 'approval' AND status = 'approved' AND seq < ? LIMIT 1",
  ).bind(runId, seq).first().catch(() => null)
  if (!approved) return deny('No approval in this run said yes before this send.')
  if (toolName === 'send_email') {
    const to = String(args?.toEmail || '').trim().toLowerCase()
    if (to !== owner.email || (Array.isArray(args?.cc) && args.cc.length) || (Array.isArray(args?.bcc) && args.bcc.length)) {
      return deny('A flow e-mail can go to the flow\'s owner only in this phase (toEmail = the owner, no cc/bcc).')
    }
  }
  const took = await db.prepare(
    "UPDATE flow_run_steps SET status = 'calling' WHERE run_id = ? AND seq = ? AND status = 'sending'",
  ).bind(runId, seq).run().catch(() => null)
  if (!(took?.meta?.changes > 0)) return deny('This send has already been made.')
  return null
}

/** A jsonSchemaValidator that never generates code: it accepts every value (see callToolForFlow). */
const ACCEPT_OUTPUT = { getValidator: () => (input) => ({ valid: true, data: input, errorMessage: undefined }) }
const MAX_RESULT_CHARS = 200_000

async function loadOwner(env, email) {
  const e = String(email || '').trim().toLowerCase()
  if (!e) return null
  const row = await env.vegvisr_org
    .prepare('SELECT user_id, email, Role FROM config WHERE LOWER(email) = ? LIMIT 1')
    .bind(e)
    .first()
    .catch(() => null)
  if (!row) return null
  return { userId: row.user_id || String(row.email).toLowerCase(), email: String(row.email).toLowerCase(), role: row.Role || 'User' }
}

/**
 * Run toolName with args as `email`. Returns
 *   { ok: true, isError, structured, text }           the tool ran (it may still report an error)
 *   { ok: false, status, error }                       refused before running
 */
export async function callToolForFlow(env, { email, toolName, args = {}, approval = null }) {
  if (!toolName || typeof toolName !== 'string') return { ok: false, status: 400, error: 'toolName is required.' }
  const owner = await loadOwner(env, email)
  if (!owner) return { ok: false, status: 403, error: 'The flow owner is not a registered user.' }

  // An approved send gets the one extra scope its tool needs — checked and consumed below, before it runs.
  const sendScope = approval && FLOW_SEND_TOOLS[toolName] ? FLOW_SEND_TOOLS[toolName] : null
  const auth = { token: 'flow-principal', audience: 'flows-worker', scope: [...FLOW_SCOPES, ...(sendScope ? [sendScope] : [])], userId: owner.userId, clientId: 'flows-worker' }
  const props = { userId: owner.userId, email: owner.email, role: owner.role, authMethod: 'flow' }

  const server = new McpServer({ name: 'vegr-flows', version: '1.0.0' })
  registerTools(server, () => ({ auth, env, props }))
  // The client's default output validator is Ajv, which compiles schemas with `new Function` —
  // refused by the Workers runtime ("Code generation from strings disallowed", seen live
  // 2026-11-06). Here the client only checks what our own server, in this same process, just
  // produced from zod-validated code, so that check adds nothing: accept the output as given.
  const client = new Client({ name: 'flows-worker', version: '1.0.0' }, { jsonSchemaValidator: ACCEPT_OUTPUT })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  try {
    await Promise.all([server.connect(serverSide), client.connect(clientSide)])
    const { tools } = await client.listTools()
    const tool = tools.find((t) => t.name === toolName)
    if (!tool) return { ok: false, status: 404, error: `There is no tool named "${toolName}".` }
    if (tool.annotations?.readOnlyHint !== true) {
      if (!sendScope) {
        return { ok: false, status: 403, error: `"${toolName}" changes or sends something, so a flow cannot run it. Flows run read-only tools, and ${Object.keys(FLOW_SEND_TOOLS).join(', ')} after an approval.` }
      }
      const refused = await checkApprovedSend(env, owner, toolName, args, approval)
      if (refused) return refused
    }
    const r = await client.callTool({ name: toolName, arguments: args && typeof args === 'object' ? args : {} })
    let text = (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
    if (text.length > MAX_RESULT_CHARS) text = `${text.slice(0, MAX_RESULT_CHARS)}… [cut at ${MAX_RESULT_CHARS} chars]`
    return { ok: true, isError: r.isError === true, structured: r.structuredContent ?? null, text }
  } finally {
    await client.close().catch(() => {})
    await server.close().catch(() => {})
  }
}
