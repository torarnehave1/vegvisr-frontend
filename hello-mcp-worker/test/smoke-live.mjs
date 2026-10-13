// Smoke test against the DEPLOYED hello-mcp worker. Read-only.
// Run: node hello-mcp-worker/test/smoke-live.mjs   (exit 0 = green)
// Retries for a short while, because a fresh deploy can take a few seconds to reach every edge.
const URL_MCP = process.env.HELLO_MCP_URL || 'https://hello-mcp.torarnehave.workers.dev/mcp'
const CODE_WORD = 'JippoJappo'

const call = async (body) => {
  const res = await fetch(URL_MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${URL_MCP}`)
  return res.json()
}

async function once() {
  const init = await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } } })
  if (init.result?.serverInfo?.name !== 'hello-mcp') throw new Error(`initialize: ${JSON.stringify(init)}`)
  const r = await call({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'hello', arguments: { codeWord: CODE_WORD } } })
  if (r.result?.content?.[0]?.text !== 'Hallo!') throw new Error(`hello: ${JSON.stringify(r)}`)
}

for (let attempt = 1; ; attempt++) {
  try {
    await once()
    console.log(`ok    ${URL_MCP} answers Hallo!`)
    process.exit(0)
  } catch (e) {
    if (attempt >= 6) {
      console.error(`FAIL  ${e.message}`)
      process.exit(1)
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
}
