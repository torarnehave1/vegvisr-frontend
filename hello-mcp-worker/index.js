/**
 * hello-mcp-worker — the smallest possible MCP server, used to prove the pipeline
 * "Claude edits code → git push → GitHub Actions deploys → client reconnects".
 *
 * Deliberately has NO dependencies, NO wrangler.toml, NO bindings and NO secrets, so it can be
 * deployed from GitHub with nothing but command-line flags (see
 * .github/workflows/deploy-hello-mcp.yml). The repo's rule that *.toml stays out of git is
 * therefore untouched.
 *
 * Endpoint: POST https://hello-mcp.torarnehave.workers.dev/mcp
 * Transport: stateless Streamable HTTP — one POST carries one JSON-RPC message and is answered
 * with a single JSON body. Nothing is kept between requests.
 *
 * NOTE: the repository is public, so the code word below is readable by anyone who looks.
 * Fine for a hello test; do not reuse this pattern to protect anything real.
 */

export const CODE_WORD = 'JippoJappo'

const SERVER_INFO = { name: 'hello-mcp', version: '1.0.0' }
const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

const HELLO_TOOL = {
  name: 'hello',
  title: 'Say hello',
  description:
    'Answers "Hallo!" when given the right code word. Call it when the user gives you a code ' +
    'word for the hello server.',
  inputSchema: {
    type: 'object',
    properties: {
      codeWord: { type: 'string', description: 'The code word the user gave.' },
    },
    required: ['codeWord'],
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id',
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })

const rpcResult = (id, result) => json({ jsonrpc: '2.0', id, result })
const rpcError = (id, code, message, status = 200) =>
  json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, status)

/** Pure function so the test can call it without HTTP. */
export function hello(codeWord) {
  if (typeof codeWord === 'string' && codeWord.trim() === CODE_WORD) {
    return { content: [{ type: 'text', text: 'Hallo!' }] }
  }
  return { content: [{ type: 'text', text: 'Feil kodeord.' }], isError: true }
}

function handleRpc(msg) {
  const { id, method, params } = msg

  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion
      const protocolVersion = SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0]
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: 'Test server. One tool, hello, which answers "Hallo!" to the right code word.',
      })
    }
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, { tools: [HELLO_TOOL] })
    case 'tools/call': {
      if (params?.name !== 'hello') return rpcError(id, -32602, `Unknown tool: ${params?.name}`)
      return rpcResult(id, hello(params?.arguments?.codeWord))
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`)
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(`${SERVER_INFO.name} ${SERVER_INFO.version} — MCP endpoint at /mcp\n`, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS },
      })
    }

    if (url.pathname !== '/mcp') return new Response('Not found\n', { status: 404, headers: CORS })

    // Stateless server: there is no SSE stream to open and no session to delete.
    if (request.method !== 'POST') {
      return new Response('Method not allowed\n', { status: 405, headers: { Allow: 'POST', ...CORS } })
    }

    let msg
    try {
      msg = await request.json()
    } catch {
      return rpcError(null, -32700, 'Parse error', 400)
    }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0') {
      return rpcError(null, -32600, 'Invalid request', 400)
    }

    // Notifications and responses carry no id and get no body back.
    if (msg.id === undefined || msg.id === null) {
      return new Response(null, { status: 202, headers: CORS })
    }

    return handleRpc(msg)
  },
}
