// Unit tests for hello-mcp-worker. Run: node --test hello-mcp-worker/test/*.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker, { hello, CODE_WORD } from '../index.js'

const post = (body) =>
  worker.fetch(
    new Request('https://hello-mcp.test/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )

test('hello answers Hallo! to the right code word', () => {
  const r = hello(CODE_WORD)
  assert.equal(r.content[0].text, 'Hallo!')
  assert.equal(r.isError, undefined)
})

test('hello tolerates surrounding whitespace', () => {
  assert.equal(hello(`  ${CODE_WORD}\n`).content[0].text, 'Hallo!')
})

test('hello rejects a wrong or missing code word', () => {
  for (const w of ['feil', '', undefined, 123, CODE_WORD.toLowerCase()]) {
    const r = hello(w)
    assert.equal(r.isError, true, `should reject ${JSON.stringify(w)}`)
    assert.equal(r.content[0].text, 'Feil kodeord.')
  }
})

test('initialize negotiates a protocol version and reports the tools capability', async () => {
  const res = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.result.protocolVersion, '2025-06-18')
  assert.deepEqual(body.result.capabilities, { tools: {} })
  assert.equal(body.result.serverInfo.name, 'hello-mcp')
})

test('initialize with an unknown version falls back to the newest supported', async () => {
  const body = await (await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } })).json()
  assert.equal(body.result.protocolVersion, '2025-11-25')
})

test('notifications get 202 and no body', async () => {
  const res = await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
  assert.equal(res.status, 202)
  assert.equal(await res.text(), '')
})

test('tools/list lists exactly the hello tool', async () => {
  const body = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json()
  assert.deepEqual(body.result.tools.map((t) => t.name), ['hello'])
})

test('tools/call hello end to end', async () => {
  const good = await (await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'hello', arguments: { codeWord: CODE_WORD } } })).json()
  assert.equal(good.result.content[0].text, 'Hallo!')
  const bad = await (await post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'hello', arguments: { codeWord: 'nei' } } })).json()
  assert.equal(bad.result.isError, true)
})

test('unknown tool and unknown method are JSON-RPC errors', async () => {
  const t = await (await post({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope' } })).json()
  assert.equal(t.error.code, -32602)
  const m = await (await post({ jsonrpc: '2.0', id: 6, method: 'resources/list' })).json()
  assert.equal(m.error.code, -32601)
})

test('bad JSON is a parse error, GET /mcp is 405, other paths 404', async () => {
  assert.equal((await post('{nope')).status, 400)
  assert.equal((await worker.fetch(new Request('https://hello-mcp.test/mcp'))).status, 405)
  assert.equal((await worker.fetch(new Request('https://hello-mcp.test/x'))).status, 404)
  assert.equal((await worker.fetch(new Request('https://hello-mcp.test/'))).status, 200)
})
