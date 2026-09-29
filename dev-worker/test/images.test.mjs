/**
 * images-service: generating an image into a placeholder a node already carries.
 * Run: node --test dev-worker/test/images.test.mjs
 *
 * Workers AI and photos-worker are faked; D1 is real SQLite with the production schema, so the
 * placeholder search, the ownership check and the version handling are exercised for real.
 *
 * The two things these tests exist to pin:
 *   1. The upload carries the CALLER'S OWN token, read server-side. Agent-Builder's
 *      generate_image sends no header at all and gets 401 from photos-worker in production;
 *      a test that only checked "an image came back" would not have caught that.
 *   2. Nothing is written unless the placeholder was actually there and the image actually
 *      stored. A failed upload must not bump a version.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedUsers, FakeAI, FakePhotosWorker } from './d1-adapter.mjs'
import * as images from '../images-service.js'
import * as gs from '../graph-service.js'

const ALICE = gs.normalizeActor({
  userId: 'alice@example.com',
  userEmail: 'alice@example.com',
  userRole: 'User',
  scopes: ['graph:read', 'graph:write'],
  authMethod: 'oauth',
  valid: true,
})
const BOB = gs.normalizeActor({
  userId: 'bob@example.com',
  userEmail: 'bob@example.com',
  userRole: 'User',
  scopes: ['graph:read', 'graph:write'],
  authMethod: 'oauth',
  valid: true,
})

const HEADER_EL =
  "![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/HEADERIMG.png)"
const SIDE_EL =
  "![Leftside-2|width: 300px; height: 200px; object-fit: 'cover'](https://vegvisr.imgix.net/SIDEIMG.png)"

/** A graph owned by alice with one fulltext node whose info is `info`. */
async function withGraph(info, { owner = ALICE } = {}) {
  const { env, raw } = freshDb()
  seedUsers(raw)
  env.AI = new FakeAI()
  env.PHOTOS_WORKER = new FakePhotosWorker()

  const created = await gs.createGraph(env, {
    title: 'Test',
    description: 'd',
    metaArea: '#TEST',
    nodes: [{ id: 'n1', label: 'Intro', type: 'fulltext', info }],
    edges: [],
    actor: owner,
  })
  assert.ok(created.ok, JSON.stringify(created))
  return { env, raw, graphId: created.graphId }
}

describe('generate_node_image — the happy path', () => {
  test('replaces the header placeholder with the stored URL and bumps the version', async () => {
    const { env, graphId } = await withGraph(`${HEADER_EL}\n\nSome text.`)

    const r = await images.generateImageForNode(env, {
      graphId,
      nodeId: 'n1',
      prompt: 'a fjord at dawn',
      placement: 'header',
      actor: ALICE,
    })

    assert.ok(r.ok, JSON.stringify(r))
    assert.equal(r.imageUrl, 'https://vegvisr.imgix.net/mcp-1.jpg')
    assert.equal(r.replaced, images.PLACEHOLDERS.header)
    assert.equal(r.remainingPlaceholders, 0)
    assert.equal(r.newVersion, r.currentVersion + 1)

    const after = await gs.getGraph(env, graphId)
    const info = after.graph.nodes[0].info
    assert.ok(info.includes('mcp-1.jpg'), info)
    assert.ok(!info.includes('HEADERIMG.png'), 'the placeholder must be gone')
    // The element around it is untouched — only the URL moved.
    assert.ok(info.startsWith("![Header|height: 200px;"), info)
    assert.ok(info.includes('Some text.'), 'the rest of the node survives')
  })

  test('the prompt reaches the model, and a size is rounded to a multiple of 8', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    await images.generateImageForNode(env, {
      graphId,
      nodeId: 'n1',
      prompt: 'a fjord at dawn',
      width: 1021,
      height: 509,
      actor: ALICE,
    })
    assert.deepEqual(env.AI.calls[0].input, { prompt: 'a fjord at dawn', width: 1024, height: 512 })
  })

  test('an out-of-range size is dropped rather than guessed at', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', width: 40, actor: ALICE })
    assert.deepEqual(env.AI.calls[0].input, { prompt: 'x' })
  })

  test('the side placeholder is filled without disturbing the wrap count', async () => {
    const { env, graphId } = await withGraph(`${SIDE_EL}\n\nPara one.\n\nPara two.`)
    const r = await images.generateImageForNode(env, {
      graphId,
      nodeId: 'n1',
      prompt: 'a boat',
      placement: 'side',
      actor: ALICE,
    })
    assert.ok(r.ok, JSON.stringify(r))
    const after = await gs.getGraph(env, graphId)
    // Leftside-2 is the renderer's paragraphCount — it belongs to the element, not to this tool.
    assert.ok(after.graph.nodes[0].info.startsWith('![Leftside-2|'), after.graph.nodes[0].info)
  })

  test('only the first placeholder is replaced, so two pending images take two calls', async () => {
    const { env, graphId } = await withGraph(`${HEADER_EL}\n\nmid\n\n${HEADER_EL}`)
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })
    assert.equal(r.remainingPlaceholders, 1)
    const after = await gs.getGraph(env, graphId)
    const info = after.graph.nodes[0].info
    assert.equal(info.indexOf('HEADERIMG.png'), info.lastIndexOf('HEADERIMG.png'), 'exactly one left')
    assert.ok(info.indexOf('mcp-1.jpg') < info.indexOf('HEADERIMG.png'), 'the FIRST one was filled')
  })
})

describe("generate_node_image — the caller's own credential", () => {
  test("the upload carries the caller's emailVerificationToken, read from D1", async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })

    const [up] = env.PHOTOS_WORKER.uploads
    // This is the assertion that would have caught Agent-Builder's broken generate_image:
    // it sends no X-API-Token at all and photos-worker answers 401.
    assert.equal(up.token, 'sess-alice')
    assert.equal(up.fileName.endsWith('.jpg'), true)
    // The stem must not already carry .jpg — photos-worker appends the File's extension, which
    // is where the `.jpg.jpg` keys in the shared album came from.
    assert.ok(!up.filename.endsWith('.jpg'), up.filename)
    // 12, not 8: sniffImageType needs twelve bytes to rule out WebP's RIFF....WEBP header.
    assert.equal(up.size, 12)
  })

  test('no album is claimed — uploading into one would stamp createdBy and lock other users out', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })
    assert.equal(env.PHOTOS_WORKER.uploads[0].album, null)
  })

  test('a user with no config row cannot upload, and nothing is written', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const stranger = gs.normalizeActor({
      userId: 'ghost@example.com',
      userEmail: 'ghost@example.com',
      userRole: 'Superadmin', // passes checkAccess, still has no upload credential
      scopes: ['graph:write'],
      valid: true,
    })
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: stranger })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal(env.PHOTOS_WORKER.uploads.length, 0)

    const after = await gs.getGraph(env, graphId)
    assert.ok(after.graph.nodes[0].info.includes('HEADERIMG.png'), 'the node is untouched')
    assert.equal(after.graph.metadata.version, 1, 'a new graph starts at version 1')
  })
})

describe('generate_node_image — refusals', () => {
  test("a node with no placeholder is refused, and says which one it wanted", async () => {
    const { env, graphId } = await withGraph('Just some prose, no image element.')
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.INVALID_INPUT)
    assert.equal(r.expectedPlaceholder, images.PLACEHOLDERS.header)
    // Nothing was generated: the check runs before the model is called.
    assert.equal(env.AI.calls.length, 0)
  })

  test('asking for a placement the node does not have is refused, not substituted', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, {
      graphId,
      nodeId: 'n1',
      prompt: 'x',
      placement: 'fancy',
      actor: ALICE,
    })
    assert.equal(r.ok, false)
    assert.equal(r.expectedPlaceholder, images.PLACEHOLDERS.fancy)
  })

  test("another user's private graph is refused before anything is generated", async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: BOB })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal(env.AI.calls.length, 0)
    assert.equal(env.PHOTOS_WORKER.uploads.length, 0)
  })

  test('a missing node is a 404, not a silent no-op', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'nope', prompt: 'x', actor: ALICE })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.GRAPH_NOT_FOUND)
  })

  test('an unknown placement is rejected by name', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, {
      graphId,
      nodeId: 'n1',
      prompt: 'x',
      placement: 'banner',
      actor: ALICE,
    })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.INVALID_INPUT)
    assert.match(r.message, /header, side, fancy/)
  })

  test('an empty prompt is refused', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: '   ', actor: ALICE })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.INVALID_INPUT)
  })

  test('no actor means no work', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: null })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.UNAUTHENTICATED)
  })
})

describe('generate_node_image — failures leave the graph alone', () => {
  test('a non-image body from Workers AI is not stored', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    env.AI = new FakeAI({ bytes: new TextEncoder().encode('{"error":"model overloaded"}') })

    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })
    assert.equal(r.ok, false)
    assert.match(r.message, /non-image data/)
    assert.equal(env.PHOTOS_WORKER.uploads.length, 0)

    const after = await gs.getGraph(env, graphId)
    assert.ok(after.graph.nodes[0].info.includes('HEADERIMG.png'))
    assert.equal(after.graph.metadata.version, 1, 'a new graph starts at version 1')
  })

  test('a generation error is reported, not swallowed', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    env.AI = new FakeAI({ throws: 'capacity exceeded' })
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })
    assert.equal(r.ok, false)
    assert.match(r.message, /capacity exceeded/)
  })

  test('a refused upload does not bump the version', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    env.PHOTOS_WORKER = new FakePhotosWorker({ status: 401, error: 'Invalid authentication token' })

    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })
    assert.equal(r.ok, false)
    assert.match(r.message, /Invalid authentication token/)

    const after = await gs.getGraph(env, graphId)
    assert.equal(after.graph.metadata.version, 1, 'a new graph starts at version 1')
    assert.ok(after.graph.nodes[0].info.includes('HEADERIMG.png'))
  })

  test('a missing PHOTOS_WORKER binding is named, not reported as a generation failure', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    delete env.PHOTOS_WORKER
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })
    assert.equal(r.ok, false)
    assert.match(r.message, /PHOTOS_WORKER/)
  })

  test('a stale expectedVersion is a version conflict, and hands back the URL already paid for', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, {
      graphId,
      nodeId: 'n1',
      prompt: 'x',
      expectedVersion: 99,
      actor: ALICE,
    })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.VERSION_CONFLICT)
    // The image exists and is addressable. Returning the URL lets the caller retry the swap with
    // update_node instead of paying to generate a second, different picture.
    assert.equal(r.imageUrl, 'https://vegvisr.imgix.net/mcp-1.jpg')
  })
})

describe('generate_node_image — version defaulting', () => {
  test("the default expectedVersion comes from metadata.version, which is what updateNode compares", async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    // Move the graph on once so metadata.version is not 0 any more.
    const bump = await gs.updateNode(env, {
      graphId,
      nodeId: 'n1',
      fields: { label: 'Renamed' },
      expectedVersion: 1, // createGraph leaves a new graph at metadata.version 1

      actor: ALICE,
    })
    assert.ok(bump.ok, JSON.stringify(bump))

    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })
    assert.ok(r.ok, JSON.stringify(r))
    assert.equal(r.currentVersion, bump.newVersion)
  })
})

describe('choosing an image model', () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

  test('defaults to Lucid Origin, not the lightning model it inherited', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })
    assert.ok(r.ok, JSON.stringify(r))
    assert.equal(env.AI.calls[0].model, '@cf/leonardo/lucid-origin')
    assert.equal(r.model, '@cf/leonardo/lucid-origin')
  })

  test('an explicit model is honoured', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, {
      graphId, nodeId: 'n1', prompt: 'x', actor: ALICE,
      model: '@cf/bytedance/stable-diffusion-xl-lightning',
    })
    assert.equal(env.AI.calls[0].model, '@cf/bytedance/stable-diffusion-xl-lightning')
    assert.equal(r.model, '@cf/bytedance/stable-diffusion-xl-lightning')
  })

  test('an unknown model falls back rather than failing at generation time', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE, model: '@cf/made/up' })
    assert.equal(env.AI.calls[0].model, images.DEFAULT_IMAGE_MODEL)
  })

  test('a base64 envelope is decoded — the Leonardo models do not stream', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    env.AI = new FakeAI({ envelope: 'base64' })
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })
    assert.ok(r.ok, JSON.stringify(r))
    assert.equal(env.PHOTOS_WORKER.uploads[0].fileName.endsWith('.jpg'), true)
  })

  test('a PNG is stored as .png, not mislabelled .jpg', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    env.AI = new FakeAI({ bytes: PNG })
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })
    assert.ok(r.ok, JSON.stringify(r))
    // photos-worker names the object from the File's extension, so a wrong one would serve a
    // PNG as image/jpeg forever.
    assert.equal(env.PHOTOS_WORKER.uploads[0].fileName.endsWith('.png'), true)
  })

  test('something that is not an image at all is still refused', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    env.AI = new FakeAI({ bytes: new TextEncoder().encode('{"error":"model overloaded, try later"}') })
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', actor: ALICE })
    assert.equal(r.ok, false)
    assert.match(r.message, /non-image data/)
    assert.equal(env.PHOTOS_WORKER.uploads.length, 0)
  })
})
