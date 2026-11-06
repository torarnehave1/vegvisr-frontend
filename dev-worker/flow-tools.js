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
 *   - and only tools annotated readOnlyHint. Anything that writes or sends is refused here, not
 *     merely discouraged by the flow compiler — sending comes with approvals in phase 3.
 *
 * Reachable only over the binding (hostname knowledge-graph-worker); the route checks that.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerTools } from './mcp/tools.js'

export const FLOW_SCOPES = ['graph:read', 'contacts:read']

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
export async function callToolForFlow(env, { email, toolName, args = {} }) {
  if (!toolName || typeof toolName !== 'string') return { ok: false, status: 400, error: 'toolName is required.' }
  const owner = await loadOwner(env, email)
  if (!owner) return { ok: false, status: 403, error: 'The flow owner is not a registered user.' }

  const auth = { token: 'flow-principal', audience: 'flows-worker', scope: [...FLOW_SCOPES], userId: owner.userId, clientId: 'flows-worker' }
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
      return { ok: false, status: 403, error: `"${toolName}" changes or sends something, so a flow cannot run it yet. Only read-only tools run live until approvals arrive (VEGR Flows phase 3).` }
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
