// vemotion-service.js — VEmotion compositions via agent-worker, render jobs via vemotion-worker.
//
// Pinned: composition tools are forwarded AS the caller (their own token) to agent-worker's one
// implementation, never re-implemented here; a render job is only queued for an Instagram account
// the caller may post to, and carries that account's album as its target.
//
// Run:  node --test test/vemotion-service.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedUsers } from './d1-adapter.mjs'
import * as gs from '../graph-service.js'
import * as vm from '../vemotion-service.js'

const ALICE = gs.normalizeActor({ valid: true, userId: 'u-alice', userEmail: 'alice@example.com', userRole: 'User', scopes: ['chat:write'] })

class Recorder {
  constructor(handler) {
    this.calls = []
    this.handler = handler
  }
  async fetch(url, init = {}) {
    const body = init.body ? JSON.parse(init.body) : null
    this.calls.push({ url, method: init.method || 'GET', token: init.headers?.['X-API-Token'], body })
    return this.handler(new URL(url), body)
  }
}
const j = (b, s = 200) => new Response(JSON.stringify(b), { status: s })

function world() {
  const { env, raw } = freshDb()
  seedUsers(raw)
  env.AGENT_WORKER = new Recorder((u, b) =>
    b.tool === 'vemotion_save_composition' && !b.input.composition?.layers?.length
      ? j({ success: false, error: 'Provide either `composition` (with non-empty layers) OR `albumName`' }, 400)
      : j({ success: true, result: { compositionId: 'comp_x', message: 'ok' } }),
  )
  env.BLOTATO_WORKER = new Recorder(() => j({ success: true, data: { items: [{ id: '76189', platform: 'instagram', username: 'alice_ig' }] } }))
  env.VEMOTION_WORKER = new Recorder((u) =>
    u.pathname === '/vemotion/render' && u.searchParams.get('id')
      ? j({ jobId: 'render_abc_1', status: 'done', progress: 100, outputUrl: 'https://vegvisr.imgix.net/r.mp4', target: { album: 'ig-reels-alice_ig', accountId: '76189' } })
      : j({ ok: true, jobId: 'render_abc_1', status: 'queued', renderUrl: 'https://vemotion.vegvisr.org/?renderJob=render_abc_1' }, 202),
  )
  return env
}

test('composition tools forward to agent-worker as the caller, unchanged', async () => {
  const env = world()
  const r = await vm.runCompositionTool(env, { actor: ALICE, tool: 'vemotion_save_composition', input: { name: 'Reel', composition: { layers: [{ id: 'a' }] } } })
  assert.equal(r.ok, true, r.message)
  const [c] = env.AGENT_WORKER.calls
  assert.equal(c.url, 'https://agent-worker/vemotion/tool')
  assert.equal(c.token, 'sess-alice')
  assert.equal(c.body.tool, 'vemotion_save_composition')
  assert.deepEqual(c.body.input.composition.layers, [{ id: 'a' }])
})

test('agent-worker refusals (the composition gate) come back as the error', async () => {
  const env = world()
  const r = await vm.runCompositionTool(env, { actor: ALICE, tool: 'vemotion_save_composition', input: { name: 'x' } })
  assert.equal(r.ok, false)
  assert.match(r.message, /non-empty layers/)
})

test('refit is forwarded like the others, with its arguments unchanged', async () => {
  const env = world()
  const r = await vm.runCompositionTool(env, { actor: ALICE, tool: 'vemotion_refit_composition', input: { compositionId: 'comp_x', targetWidth: 1080, targetHeight: 1920, mode: 'fill', name: 'Reel' } })
  assert.equal(r.ok, true, r.message)
  assert.deepEqual(env.AGENT_WORKER.calls[0].body, { tool: 'vemotion_refit_composition', input: { compositionId: 'comp_x', targetWidth: 1080, targetHeight: 1920, mode: 'fill', name: 'Reel' } })
})

test('only the composition tools are forwarded', async () => {
  const env = world()
  const r = await vm.runCompositionTool(env, { actor: ALICE, tool: 'send_email', input: {} })
  assert.equal(r.code, gs.ERR.INVALID_INPUT)
  assert.equal(env.AGENT_WORKER.calls.length, 0)
})

test('a render job targets the account album and only an account the caller may post to', async () => {
  const env = world()
  const r = await vm.queueInstagramRender(env, { actor: ALICE, compositionId: 'comp_x', accountId: '76189' })
  assert.equal(r.ok, true, r.message)
  assert.equal(r.album, 'ig-reels-alice_ig')
  assert.equal(r.renderUrl, 'https://vemotion.vegvisr.org/?renderJob=render_abc_1')
  const [q] = env.VEMOTION_WORKER.calls
  assert.equal(q.token, 'sess-alice')
  assert.deepEqual(q.body, { compositionId: 'comp_x', target: { platform: 'instagram', accountId: '76189', username: 'alice_ig', album: 'ig-reels-alice_ig' } })

  const no = await vm.queueInstagramRender(env, { actor: ALICE, compositionId: 'comp_x', accountId: '45838' })
  assert.equal(no.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.equal(env.VEMOTION_WORKER.calls.length, 1)
})

test('get render job reads the brief record', async () => {
  const env = world()
  const r = await vm.getRenderJob(env, { actor: ALICE, jobId: 'render_abc_1' })
  assert.equal(r.status, 'done')
  assert.equal(r.outputUrl, 'https://vegvisr.imgix.net/r.mp4')
  assert.match(env.VEMOTION_WORKER.calls[0].url, /brief=1/)
  assert.equal((await vm.getRenderJob(env, { actor: ALICE, jobId: '../x' })).ok, false)
})

test('no credential, no call', async () => {
  const env = world()
  const nobody = gs.normalizeActor({ valid: true, userId: 'u-n', userEmail: 'nobody@example.com', userRole: 'User', scopes: [] })
  const r = await vm.runCompositionTool(env, { actor: nobody, tool: 'vemotion_list_compositions' })
  assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
  assert.equal(env.AGENT_WORKER.calls.length, 0)
})

test('the discover and check tools are forwarded like the others (2026-10-19)', async () => {
  for (const tool of ['get_vemotion_catalog', 'list_vemotion_library', 'get_vemotion_library_item', 'check_vemotion_composition']) {
    const env = world()
    const r = await vm.runCompositionTool(env, { actor: ALICE, tool, input: { kind: 'curves' } })
    assert.equal(r.ok, true, `${tool}: ${r.message}`)
    assert.equal(env.AGENT_WORKER.calls[0].body.tool, tool)
    assert.equal(env.AGENT_WORKER.calls[0].token, 'sess-alice')
  }
})

test('preview frames queue a frames job into vemotion-previews, times validated', async () => {
  const env = world()
  const r = await vm.queuePreviewFrames(env, { actor: ALICE, compositionId: 'comp_x', times: [0.5, 2, 4] })
  assert.equal(r.ok, true, r.message)
  assert.equal(r.album, 'vemotion-previews')
  assert.deepEqual(env.VEMOTION_WORKER.calls[0].body, { compositionId: 'comp_x', kind: 'frames', times: [0.5, 2, 4], target: { platform: 'preview', album: 'vemotion-previews' } })
  assert.equal((await vm.queuePreviewFrames(env, { actor: ALICE, compositionId: 'comp_x', times: [] })).code, gs.ERR.INVALID_INPUT)
  assert.equal((await vm.queuePreviewFrames(env, { actor: ALICE, compositionId: 'comp_x', times: Array(13).fill(1) })).code, gs.ERR.INVALID_INPUT)
  assert.equal(env.VEMOTION_WORKER.calls.length, 1)
})

test('frameImages inlines PNGs as MCP image content and skips what it cannot fetch', async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const fake = async (u) => u.endsWith('a.png')
    ? new Response(png, { headers: { 'content-type': 'image/png' } })
    : new Response('no', { status: 404 })
  const { images, skipped } = await vm.frameImages(['https://x/a.png', 'https://x/b.png'], fake)
  assert.equal(images.length, 1)
  assert.deepEqual(images[0], { type: 'image', data: btoa(String.fromCharCode(...png)), mimeType: 'image/png' })
  assert.equal(skipped.length, 1)
})
