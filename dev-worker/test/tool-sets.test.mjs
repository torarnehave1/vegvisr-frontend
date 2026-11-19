/**
 * Which tools a connection is offered (mcp/tool-sets.js).
 * Run: node --test dev-worker/test/tool-sets.test.mjs
 *
 * The scope a tool needs is read from its description. That is only safe if the description is
 * true, so the first block checks every tool against what its handler actually refuses with.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedUsers } from './d1-adapter.mjs'
import { registerTools, TOOL_NAMES } from '../mcp/tools.js'
import { mcpHandler } from '../mcp/server.js'
import { KNOWN_SCOPES } from '../oauth/scopes.js'
import { STARTER_TOOLS, TOOL_SETS, scopesNamedBy, toolSetOf, sanitizeToolSet, toolIsOffered, offeredToolsOnly } from '../mcp/tool-sets.js'

/** Every tool as registered: its name, its description, its handler. */
function allTools(context = {}) {
  const seen = []
  registerTools({ registerTool: (name, config, handler) => { seen.push({ name, description: String(config?.description || ''), handler }) } }, () => context, {})
  return seen
}

const GRAPHS_ONLY = ['graph:read', 'graph:write']

describe('the scope a tool needs is read from its description', () => {
  test('the two sentence shapes in use', () => {
    assert.deepEqual(scopesNamedBy('Reads a graph. Requires the graph:read scope.'), ['graph:read'])
    assert.deepEqual(scopesNamedBy('X. Requires the contacts:read and chat:read scopes.'), ['contacts:read', 'chat:read'])
    assert.deepEqual(scopesNamedBy('X. Requires the user:read scope and the Superadmin role.'), ['user:read'])
    assert.deepEqual(scopesNamedBy('Says nothing about it.'), [])
    assert.deepEqual(scopesNamedBy(null), [])
  })

  test('every tool names at least one scope, and only scopes that exist', () => {
    for (const t of allTools()) {
      const named = scopesNamedBy(t.description)
      assert.ok(named.length > 0, `${t.name} does not say "Requires the … scope" — it would be offered to everyone`)
      for (const s of named) assert.ok(KNOWN_SCOPES.includes(s), `${t.name} names ${s}, which is not a scope`)
    }
  })

  test('what a tool says it needs is what it refuses without', async () => {
    // A connection that holds nothing. Every handler checks its scope before it looks at its
    // arguments, so an empty call is refused with the scope it wanted.
    const context = { auth: { scope: [], clientId: 'c' }, env: {}, props: { userId: 'u', email: 'u@example.com', role: 'User' }, ctx: {} }
    for (const t of allTools(context)) {
      const result = await t.handler({}, {})
      const refusedWith = result?.structuredContent?.requiredScope
      assert.ok(refusedWith, `${t.name} was not refused for a connection with no scopes`)
      assert.ok(scopesNamedBy(t.description).includes(refusedWith),
        `${t.name} refuses without ${refusedWith}, but its description names ${scopesNamedBy(t.description).join(', ')}`)
    }
  })
})

describe('the Starter set', () => {
  test('every starter tool is a real tool, listed once', () => {
    for (const name of STARTER_TOOLS) assert.ok(TOOL_NAMES.includes(name), `${name} is on the starter list but is not a tool`)
    assert.equal(new Set(STARTER_TOOLS).size, STARTER_TOOLS.length, 'a tool is on the starter list twice')
  })

  test('it holds graphs, nodes, images and albums — and none of the outward-facing tools', () => {
    const offered = allTools().filter((t) => toolIsOffered(t.name, t.description, { scopes: KNOWN_SCOPES, toolSet: 'starter' })).map((t) => t.name)
    assert.deepEqual(offered.sort(), [...STARTER_TOOLS].sort(), 'with every scope held, Starter is exactly the starter list')
    for (const kept of ['create_graph', 'add_node', 'register_node_type', 'album_list', 'generate_image']) assert.ok(offered.includes(kept), `${kept} belongs in Starter`)
    for (const out of ['send_email', 'send_sms', 'list_contacts', 'post_chat_message', 'list_users', 'publish_html_node', 'run_flow', 'realtime_create_meeting', 'vemotion_save_composition']) {
      assert.equal(offered.includes(out), false, `${out} must not be in Starter`)
    }
  })

  test('a starter tool still needs its scope: delete_graph only with the delete box', () => {
    const d = allTools().find((t) => t.name === 'delete_graph').description
    assert.equal(toolIsOffered('delete_graph', d, { scopes: GRAPHS_ONLY, toolSet: 'starter' }), false)
    assert.equal(toolIsOffered('delete_graph', d, { scopes: [...GRAPHS_ONLY, 'graph:delete'], toolSet: 'starter' }), true)
  })

  test('ticking every box does not widen Starter', () => {
    const tools = allTools()
    const count = (scopes) => tools.filter((t) => toolIsOffered(t.name, t.description, { scopes, toolSet: 'starter' })).length
    assert.equal(count(KNOWN_SCOPES), count([...GRAPHS_ONLY, 'graph:delete']))
  })
})

describe('Everything shows what the scopes allow, no more', () => {
  test('graph scopes alone leave out contacts, chat, e-mail, users and publishing', () => {
    const offered = allTools().filter((t) => toolIsOffered(t.name, t.description, { scopes: GRAPHS_ONLY, toolSet: 'all' })).map((t) => t.name)
    for (const out of ['list_contacts', 'send_email', 'send_sms', 'read_chat_messages', 'list_users', 'register_user', 'publish_html_node', 'delete_graph']) {
      assert.equal(offered.includes(out), false, `${out} needs a box that was not ticked`)
    }
    assert.ok(offered.includes('vemotion_save_composition'), 'graph:write covers VEmotion in Everything')
  })

  test('a tool that needs two scopes is offered only with both', () => {
    const d = allTools().find((t) => t.name === 'sms_overview').description
    assert.equal(toolIsOffered('sms_overview', d, { scopes: [...GRAPHS_ONLY, 'contacts:read'], toolSet: 'all' }), false)
    assert.equal(toolIsOffered('sms_overview', d, { scopes: [...GRAPHS_ONLY, 'contacts:read', 'chat:read'], toolSet: 'all' }), true)
  })

  test('with every scope, Everything is every tool', () => {
    const offered = allTools().filter((t) => toolIsOffered(t.name, t.description, { scopes: KNOWN_SCOPES, toolSet: 'all' }))
    assert.equal(offered.length, TOOL_NAMES.length)
  })
})

describe('the choice on the grant', () => {
  test('only an exact "starter" is Starter; an old grant is Everything', () => {
    assert.deepEqual(TOOL_SETS, ['starter', 'all'])
    assert.equal(toolSetOf({ toolSet: 'starter' }), 'starter')
    for (const props of [{}, null, undefined, { toolSet: 'all' }, { toolSet: 'STARTER' }, { toolSet: 'basic' }, { toolSet: ['starter'] }]) {
      assert.equal(toolSetOf(props), 'all')
    }
    assert.equal(sanitizeToolSet('starter'), 'starter')
    for (const v of ['all', '', null, undefined, 'everything', 'starter ']) assert.equal(sanitizeToolSet(v), 'all')
  })

  test('the stand-in server passes on offered tools and drops the rest', () => {
    const got = []
    const gate = offeredToolsOnly({ registerTool: (name) => { got.push(name); return 'registered' } }, { scopes: GRAPHS_ONLY, toolSet: 'starter' })
    assert.equal(gate.registerTool('get_graph', { description: 'Requires the graph:read scope.' }, () => {}), 'registered')
    assert.equal(gate.registerTool('send_email', { description: 'Requires the chat:write scope.' }, () => {}), undefined)
    assert.equal(gate.registerTool('run_flow', { description: 'Requires the graph:read scope.' }, () => {}), undefined)
    assert.deepEqual(got, ['get_graph'])
  })
})

describe('through the real request handler', () => {
  const ctxFor = (scope, toolSet) => ({
    auth: { token: 'x', audience: 'https://knowledge.vegvisr.org/mcp', scope, userId: 'alice@example.com', clientId: 'https://client.example/oauth.json' },
    props: { userId: 'alice@example.com', email: 'alice@example.com', role: 'User', authMethod: 'oauth_otp', ...(toolSet ? { toolSet } : {}) },
  })

  async function rpc(ctx, method, params = {}) {
    const { env, raw } = freshDb()
    seedUsers(raw)
    const req = new Request('https://knowledge.vegvisr.org/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    const res = await mcpHandler.fetch(req, env, { ...ctx, waitUntil() {} })
    return res.json()
  }

  test('tools/list for a Starter grant is the starter list minus what needs an unticked box', async () => {
    const body = await rpc(ctxFor(GRAPHS_ONLY, 'starter'), 'tools/list')
    const names = body.result.tools.map((t) => t.name).sort()
    assert.deepEqual(names, STARTER_TOOLS.filter((n) => n !== 'delete_graph').sort())
  })

  test('tools/list for an old grant (no tool set) shows everything its scopes allow', async () => {
    const body = await rpc(ctxFor(GRAPHS_ONLY), 'tools/list')
    const names = body.result.tools.map((t) => t.name)
    assert.ok(names.length > STARTER_TOOLS.length)
    assert.ok(names.includes('run_flow'))
    assert.equal(names.includes('send_email'), false)
  })

  test('a tool outside the Starter set cannot be called by name', async () => {
    const body = await rpc(ctxFor(KNOWN_SCOPES, 'starter'), 'tools/call', { name: 'list_contacts', arguments: {} })
    const text = JSON.stringify(body)
    assert.ok(body.error || body.result?.isError, 'the call must fail')
    assert.match(text, /not found|Unknown tool|disabled/i)
  })

  test('a starter tool still works', async () => {
    const body = await rpc(ctxFor(GRAPHS_ONLY, 'starter'), 'tools/call', { name: 'list_meta_areas', arguments: {} })
    assert.equal(body.error, undefined)
    assert.notEqual(body.result?.isError, true)
  })
})
