/**
 * get_node_types — the shape of a standalone node, read from the node templates already in
 * graphTemplates (agreed 2026-10-29). Nothing new is stored.
 * Run: node --test dev-worker/test/node-templates.test.mjs
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { freshDb, seedTemplates } from './d1-adapter.mjs'
import { registerTools } from '../mcp/tools.js'
import * as tpl from '../templates-service.js'

// The YouTube row as it is in production (2026-10-29), recipe and contradiction included.
const YT_NODES = JSON.stringify([{ id: '', label: 'YouTube Video Node', color: '#FF0000', type: 'youtube-video', info: 'This is a new YouTube Video node.', bibl: ['https://youtu.be/1znlniWqyCQ'], imageWidth: '100%', imageHeight: '100%', visible: true, path: 'https://youtu.be/1znlniWqyCQ' }])
const YT_AI = { format: '![YOUTUBE src=https://www.youtube.com/embed/{videoId}]{videoTitle}[END YOUTUBE]', nodeStructure: { type: 'youtube-video', path: '' } }

function setup() {
  const { env, raw } = freshDb()
  seedTemplates(raw, [
    { id: 'elt-fancy', name: 'FANCY', ai: { trigger: '[FANCY]', format: '[FANCY]x[END FANCY]' } },
    { id: 'yt', name: 'YouTube', category: 'Video', nodes: YT_NODES, ai: YT_AI },
    { id: 'gantt', name: 'GanttChart', category: 'General', nodes: JSON.stringify([{ id: 'g1', type: 'mermaid-diagram', label: 'Gantt', info: 'gantt\n  title X' }]), ai: 'Write mermaid gantt syntax, no fences.' },
    { id: 'flow', name: 'FlowChart', category: 'General', nodes: JSON.stringify([{ id: '', type: 'mermaid-diagram', label: 'Flow', info: 'flowchart TD' }]) },
    { id: 'big', name: 'HTML Page Node', category: 'Layout Templates', plugin: 0, nodes: JSON.stringify([{ id: '', type: 'html-node', label: 'Page', info: '<p>' + 'x'.repeat(5000) + '</p>' }]) },
    { id: 'app', name: 'Some user app', category: 'My Apps', nodes: JSON.stringify([{ id: 'a', type: 'app-viewer', label: 'App', info: '<html></html>' }]) },
  ])
  return { env }
}

describe('listNodeTemplates', () => {
  test('groups templates by node type, skips fulltext elements and My Apps', async () => {
    const { env } = setup()
    const r = await tpl.listNodeTemplates(env)
    assert.equal(r.ok, true)
    assert.deepEqual(r.types.map((t) => t.type), ['html-node', 'mermaid-diagram', 'youtube-video'])
    assert.deepEqual(r.types.find((t) => t.type === 'mermaid-diagram').templates.map((x) => x.name).sort(), ['FlowChart', 'GanttChart'])
  })

  test('youtube-video: the template example and its ai_instructions, exactly as stored', async () => {
    const { env } = setup()
    const r = await tpl.listNodeTemplates(env, { type: 'youtube-video' })
    const t = r.types[0].templates[0]
    assert.deepEqual(t.aiInstructions, YT_AI)
    assert.equal(t.example.type, 'youtube-video')
    assert.equal(t.example.path, 'https://youtu.be/1znlniWqyCQ')
    assert.equal('id' in t.example, false, 'the template id is not part of the shape')
  })

  test('ai_instructions in prose is kept as text; none is null', async () => {
    const { env } = setup()
    const m = (await tpl.listNodeTemplates(env, { type: 'mermaid-diagram' })).types[0].templates
    assert.equal(m.find((x) => x.name === 'GanttChart').aiInstructions, 'Write mermaid gantt syntax, no fences.')
    assert.equal(m.find((x) => x.name === 'FlowChart').aiInstructions, null)
  })

  test('a long info is cut and says so', async () => {
    const { env } = setup()
    const info = (await tpl.listNodeTemplates(env, { type: 'html-node' })).types[0].templates[0].example.info
    assert.ok(info.length < 2200)
    assert.match(info, /\[cut: \d+ characters in the template\]$/)
  })

  test('name narrows; no match is an error that says how to see them all', async () => {
    const { env } = setup()
    assert.deepEqual((await tpl.listNodeTemplates(env, { name: 'gantt' })).types[0].templates.map((x) => x.name), ['GanttChart'])
    const miss = await tpl.listNodeTemplates(env, { type: 'no-such-type' })
    assert.equal(miss.ok, false)
    assert.match(miss.message, /without arguments/)
  })
})

describe('get_node_types (MCP)', () => {
  const ALICE = {
    auth: { token: 'redacted', audience: 'https://knowledge.vegvisr.org/mcp', scope: ['graph:read'], userId: 'alice@example.com', clientId: 'test' },
    props: { userId: 'alice@example.com', email: 'alice@example.com', role: 'User', authMethod: 'oauth_otp' },
  }
  async function connect(env, who) {
    const server = new McpServer({ name: 'test', version: '0.0.0' })
    registerTools(server, () => ({ auth: who.auth, env, props: who.props }))
    const client = new Client({ name: 'c', version: '0.0.0' })
    const [a, b] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(b), client.connect(a)])
    return client
  }

  test('a read-scoped user gets the recipe, in the text a client reads too', async () => {
    const { env } = setup()
    const c = await connect(env, ALICE)
    const r = await c.callTool({ name: 'get_node_types', arguments: { type: 'youtube-video' } })
    assert.equal(r.isError, undefined)
    assert.equal(r.structuredContent.count, 1)
    const text = r.content[0].text
    assert.match(text, /■ youtube-video/)
    assert.match(text, /template "YouTube" \(Video\)/)
    assert.match(text, /ai_instructions: \{"format":"!\[YOUTUBE src=https:\/\/www\.youtube\.com\/embed\/\{videoId\}\]/)
    assert.match(text, /example node: \{"label":"YouTube Video Node"/)
  })

  test('without graph:read it is refused', async () => {
    const { env } = setup()
    const c = await connect(env, { ...ALICE, auth: { ...ALICE.auth, scope: [] } })
    assert.equal((await c.callTool({ name: 'get_node_types', arguments: {} })).isError, true)
  })
})
