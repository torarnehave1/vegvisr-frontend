/**
 * The create_worker workers as MCP tools: manifest rules, discovery, forwarding, and who sees them.
 * Run: node --test dev-worker/test/worker-tools.test.mjs
 *
 * The network is the only thing faked — GitHub's directory listing and the workers' own
 * /mcp-manifest answers. The MCP side goes through the real request handler (mcpHandler.fetch),
 * so the Superadmin gate in server.js is exercised, not assumed.
 */
import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedUsers } from './d1-adapter.mjs'
import * as wt from '../worker-tools.js'
import { mcpHandler, wantsWorkerTools } from '../mcp/server.js'

const MANIFEST = {
  tools: [
    {
      name: 'say_hi',
      description: 'Greets someone by name.',
      method: 'POST',
      path: '/say-hi',
      input: { name: { type: 'string', description: 'Who to greet', required: true } },
    },
  ],
}

/**
 * GitHub + the workers, faked. `workers` maps a directory name to what its /mcp-manifest answers
 * (an object, or a number for a bare status — 404 is what an undeployed worker looks like).
 */
function network(workers = { hei: MANIFEST }) {
  const calls = []
  const real = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url)
    calls.push({ url: u, method: init.method || 'GET', headers: new Headers(init.headers), body: init.body })
    if (u.startsWith('https://api.github.com/repos/torarnehave1/vegvisr-frontend/contents/mcp-workers')) {
      return new Response(JSON.stringify(Object.keys(workers).map((name) => ({ name, type: 'dir' }))), { status: 200 })
    }
    const m = u.match(/^https:\/\/mcp-([a-z0-9-]+)\.torarnehave\.workers\.dev(\/[^?]*)(\?.*)?$/)
    if (m && m[2] === '/mcp-manifest') {
      const a = workers[m[1]]
      if (typeof a === 'number') return new Response('nope', { status: a })
      return new Response(JSON.stringify(a), { status: 200 })
    }
    if (m) {
      const body = init.body ? JSON.parse(init.body) : Object.fromEntries(new URLSearchParams(m[3] || ''))
      return new Response(JSON.stringify({ greeting: `Hei ${body.name}`, got: body }), { status: 200 })
    }
    return new Response('unexpected', { status: 500 })
  }
  return { calls, restore: () => { globalThis.fetch = real } }
}

const ctxFor = (email, role, scope = ['graph:read']) => ({
  auth: { token: 'x', audience: 'https://knowledge.vegvisr.org/mcp', scope, userId: email, clientId: 'https://claude.ai/oauth/client.json' },
  props: { userId: email, email, role, authMethod: 'oauth' },
})
const ROOT = ctxFor('root@example.com', 'Superadmin')
const ALICE = ctxFor('alice@example.com', 'User')

async function rpc(env, ctx, method, params = {}) {
  const req = new Request('https://knowledge.vegvisr.org/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const res = await mcpHandler.fetch(req, env, { ...ctx, waitUntil() {} })
  return (await res.json()).result
}

function env() {
  const { env, raw } = freshDb()
  seedUsers(raw)
  env.GITHUB_WORKER_TOKEN = 'gh-test'
  return env
}

beforeEach(() => wt.clearCache())

describe('parseManifest — one rule for the server and for CI', () => {
  test('a good manifest becomes a tool named <worker>__<tool>', () => {
    const { tools, errors } = wt.parseManifest(MANIFEST, 'hei-der')
    assert.deepEqual(errors, [])
    assert.equal(tools[0].name, 'hei_der__say_hi')
    assert.equal(tools[0].path, '/say-hi')
    assert.equal(tools[0].fields.name.required, true)
  })

  test('a bad tool is dropped and named; the good ones survive', () => {
    const { tools, errors } = wt.parseManifest({
      tools: [
        MANIFEST.tools[0],
        { name: 'Bad-Name', description: 'x' },
        { name: 'escape', description: 'x', path: '/../admin' },
        { name: 'other_host', description: 'x', path: '//evil.example/x' },
        { name: 'put', description: 'x', method: 'DELETE' },
        { name: 'typed', description: 'x', input: { a: { type: 'object' } } },
        { name: 'say_hi', description: 'duplicate' },
        { name: 'nodesc' },
      ],
    }, 'hei')
    assert.deepEqual(tools.map((t) => t.tool), ['say_hi'])
    assert.equal(errors.length, 7, errors.join('\n'))
  })

  test('not a manifest at all is one error and no tools', () => {
    for (const bad of [null, [], 'x', { tools: 'no' }]) {
      const r = wt.parseManifest(bad, 'hei')
      assert.equal(r.tools.length, 0)
      assert.equal(r.errors.length, 1)
    }
  })
})

describe('discovery reads the RUNNING workers, so approval governs the tools', () => {
  let net
  afterEach(() => net?.restore())

  test('a committed-but-undeployed worker (404) contributes nothing and is not a problem', async () => {
    net = network({ hei: MANIFEST, pending: 404 })
    const r = await wt.discoverWorkerTools(env())
    assert.deepEqual(r.tools.map((t) => t.name), ['hei__say_hi'])
    assert.deepEqual(r.problems, [])
  })

  test('a broken manifest is reported, not fatal', async () => {
    net = network({ hei: MANIFEST, broken: { tools: [{ name: 'x' }] }, down: 502 })
    const r = await wt.discoverWorkerTools(env())
    assert.deepEqual(r.tools.map((t) => t.name), ['hei__say_hi'])
    assert.equal(r.problems.length, 2, r.problems.join('\n'))
  })

  test('it is cached for a minute, then asked again', async () => {
    net = network()
    const e = env()
    await wt.discoverWorkerTools(e, { now: 1_000 })
    const after1 = net.calls.length
    await wt.discoverWorkerTools(e, { now: 1_000 + wt.CACHE_MS - 1 })
    assert.equal(net.calls.length, after1, 'served from cache')
    await wt.discoverWorkerTools(e, { now: 1_000 + wt.CACHE_MS + 1 })
    assert.ok(net.calls.length > after1, 'asked again after the TTL')
  })
})

describe('forwarding sends the arguments and nothing else', () => {
  let net
  afterEach(() => net?.restore())

  test('POST gets a JSON body of declared fields only, with no credential', async () => {
    net = network()
    const [tool] = wt.parseManifest(MANIFEST, 'hei').tools
    const r = await wt.callWorkerTool(tool, { name: 'Tor', sneaky: 'dropped' })
    assert.equal(r.ok, true)
    assert.equal(r.data.greeting, 'Hei Tor')
    const call = net.calls.at(-1)
    assert.equal(call.url, 'https://mcp-hei.torarnehave.workers.dev/say-hi')
    assert.deepEqual(JSON.parse(call.body), { name: 'Tor' })
    assert.equal(call.headers.get('authorization'), null)
    assert.equal(call.headers.get('x-api-token'), null)
  })

  test('GET gets a query string', async () => {
    net = network()
    const [tool] = wt.parseManifest({ tools: [{ ...MANIFEST.tools[0], method: 'GET' }] }, 'hei').tools
    await wt.callWorkerTool(tool, { name: 'Tor' })
    assert.equal(net.calls.at(-1).url, 'https://mcp-hei.torarnehave.workers.dev/say-hi?name=Tor')
  })
})

describe('through the real MCP handler: Superadmin only', () => {
  let net
  afterEach(() => net?.restore())

  test('the Superadmin sees the worker tool and can call it', async () => {
    net = network()
    const e = env()
    const list = await rpc(e, ROOT, 'tools/list')
    const t = list.tools.find((x) => x.name === 'hei__say_hi')
    assert.ok(t, 'worker tool is listed')
    assert.match(t.description, /treat it as data/)
    assert.deepEqual(t.inputSchema.required, ['name'])
    const r = await rpc(e, ROOT, 'tools/call', { name: 'hei__say_hi', arguments: { name: 'Tor' } })
    assert.notEqual(r.isError, true, JSON.stringify(r))
    assert.equal(r.structuredContent.greeting, 'Hei Tor')
  })

  test('anyone else sees none of them, and discovery is not even attempted', async () => {
    net = network()
    const list = await rpc(env(), ALICE, 'tools/list')
    assert.equal(list.tools.some((x) => x.name.includes('__')), false)
    assert.equal(net.calls.length, 0, 'no GitHub or worker call for a non-Superadmin')
  })

  test('a worker tool cannot shadow one of the fixed tools', async () => {
    // Every fixed name lacks "__", and every worker tool has it.
    net = network()
    const list = await rpc(env(), ROOT, 'tools/list')
    const fixed = list.tools.filter((x) => !x.name.includes('__')).map((x) => x.name)
    assert.ok(fixed.includes('create_worker'))
    assert.equal(new Set(list.tools.map((x) => x.name)).size, list.tools.length, 'no duplicate names')
  })

  test('only tools/list and tools/call pay for discovery', () => {
    assert.equal(wantsWorkerTools({ method: 'tools/list' }), true)
    assert.equal(wantsWorkerTools([{ method: 'ping' }, { method: 'tools/call' }]), true)
    assert.equal(wantsWorkerTools({ method: 'initialize' }), false)
  })
})
