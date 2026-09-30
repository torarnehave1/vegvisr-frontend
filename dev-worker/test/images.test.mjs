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

  test('an out-of-range size is clamped to the model minimum and the change is reported', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    // This used to drop the number entirely, which let the model fall back to its own default
    // while the caller was told nothing. Clamping guesses too — 40 px was never going to be
    // honoured — but the difference that matters is that the caller now learns the number moved.
    const r = await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', width: 40, actor: ALICE })
    assert.deepEqual(env.AI.calls[0].input, { prompt: 'x', width: 256 })
    assert.match(r.notes.join(' '), /width 40 became 256/)
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

describe('style, lighting and format — the dropdowns a chat does not have', () => {
  test('the tokens match the chat UI verbatim, so both surfaces make the same picture', () => {
    // Copied from IMAGE_STYLE_PRESETS / IMAGE_LIGHTING_PRESETS in VegvisrAgentChat.tsx. If the UI
    // changes its wording, this fails — which is the point: a style that means one thing in one
    // surface and another elsewhere is worse than no preset at all.
    assert.equal(images.IMAGE_STYLES.cinematic, 'cinematic precision, dramatic composition, widescreen film still')
    assert.equal(images.IMAGE_STYLES['concept-art'], 'concept art, artstation quality, atmospheric visual development')
    assert.equal(images.IMAGE_LIGHTING['golden-hour'], 'golden hour, warm diffused natural light')
    assert.deepEqual(images.IMAGE_FORMATS['landscape-16:9'], { width: 1120, height: 630 })
  })

  test('subject first, then style, then lighting — the chat UI order', () => {
    assert.equal(
      images.composeImagePrompt({ prompt: 'en fjord', style: 'cinematic', lighting: 'golden-hour' }),
      'en fjord, cinematic precision, dramatic composition, widescreen film still, golden hour, warm diffused natural light',
    )
  })

  test('an omitted preset adds nothing', () => {
    assert.equal(images.composeImagePrompt({ prompt: 'en fjord' }), 'en fjord')
    assert.equal(images.composeImagePrompt({ prompt: 'en fjord', style: 'nonsense' }), 'en fjord')
  })

  test('the composed prompt is what reaches the model, and is reported back', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, {
      graphId, nodeId: 'n1', prompt: 'en norsk fjord', style: 'editorial', lighting: 'overcast', actor: ALICE,
    })
    assert.ok(r.ok, JSON.stringify(r))
    const sent = env.AI.calls[0].input.prompt
    assert.match(sent, /^en norsk fjord, editorial photography/)
    assert.match(sent, /matte editorial tone$/)
    assert.equal(r.finalPrompt, sent, 'the caller sees exactly what was sent')
  })

  test('a named format sets exact dimensions and is NOT rounded to a multiple of 8', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    await images.generateImageForNode(env, { graphId, nodeId: 'n1', prompt: 'x', format: 'landscape-16:9', actor: ALICE })
    // 630 is not a multiple of 8. The chat UI sends it and it works, so rounding it to 632 here
    // would quietly change an aspect ratio the caller asked for by name.
    assert.deepEqual(env.AI.calls[0].input, { prompt: 'x', width: 1120, height: 630 })
  })

  test('a named format wins over loose width and height', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    await images.generateImageForNode(env, {
      graphId, nodeId: 'n1', prompt: 'x', format: 'square-1:1', width: 300, height: 300, actor: ALICE,
    })
    assert.equal(env.AI.calls[0].input.width, 1024)
  })
})

describe('render traits and text in the image', () => {
  test('the tokens match the chat UI verbatim', () => {
    assert.equal(images.IMAGE_RENDER_TRAITS['long-exposure'], 'long exposure photograph')
    assert.equal(images.IMAGE_RENDER_TRAITS['anamorphic-lens-flare'], 'anamorphic lens flare')
    assert.equal(images.IMAGE_TEXT_TREATMENTS['gold-serif'], 'elegant serif lettering, gold foil embossed look')
    assert.equal(images.IMAGE_TEXT_TREATMENTS.logo, 'logo design, crisp letterforms, balanced mark composition')
    assert.equal(Object.keys(images.IMAGE_RENDER_TRAITS).length, 6, 'IMAGE_RENDER_TRAITS in the UI has six')
  })

  test('traits are emitted in table order, not the order the caller listed them', () => {
    // Determinism: the same set of choices must always produce the same string, whichever way
    // round a model happens to name them. The chat UI checks them in a fixed order too.
    const a = images.composeImagePrompt({ prompt: 'x', renderTraits: ['film-grain', 'long-exposure'] })
    const b = images.composeImagePrompt({ prompt: 'x', renderTraits: ['long-exposure', 'film-grain'] })
    assert.equal(a, b)
    assert.equal(a, 'x, long exposure photograph, film grain')
  })

  test('an unknown trait is dropped, not passed through as a stray prompt word', () => {
    assert.equal(images.composeImagePrompt({ prompt: 'x', renderTraits: ['tilt-shift', 'film-grain'] }), 'x, film grain')
  })

  test('text comes last and is quoted, with its treatment after it', () => {
    assert.equal(
      images.composeImagePrompt({ prompt: 'a poster', imageText: 'VEGR.AI', textTreatment: 'neon' }),
      'a poster, the text "VEGR.AI", neon glowing outline, illuminated signage',
    )
  })

  test('a treatment without text adds nothing — it describes lettering that is not there', () => {
    assert.equal(images.composeImagePrompt({ prompt: 'a poster', textTreatment: 'neon' }), 'a poster')
    assert.equal(images.composeImagePrompt({ prompt: 'a poster', imageText: '   ' }), 'a poster')
  })

  test('everything together lands in the order the UI uses', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, {
      graphId, nodeId: 'n1', prompt: 'en fjord', actor: ALICE,
      style: 'cinematic', lighting: 'low-key',
      renderTraits: ['film-grain', 'long-exposure'],
      imageText: 'VEGR.AI', textTreatment: 'gold-serif',
    })
    assert.ok(r.ok, JSON.stringify(r))
    assert.equal(
      r.finalPrompt,
      'en fjord, cinematic precision, dramatic composition, widescreen film still, ' +
        'low key lighting, moody high contrast shadows, long exposure photograph, film grain, ' +
        'the text "VEGR.AI", elegant serif lettering, gold foil embossed look',
    )
  })
})

/**
 * The per-model capability table.
 *
 * These numbers are pinned against the input schemas published at
 * developers.cloudflare.com/workers-ai/models/<name>/, read 2026-09-30. A test that only checked
 * "a payload came out" would not catch the thing that makes this table necessary: the models
 * disagree about which parameters EXIST and about their ranges, so a single passthrough sends
 * lucid-origin a negative_prompt it has no field for and phoenix a guidance below its floor.
 */
describe('model capabilities — what each model will actually accept', () => {
  test('every listed model has a capability row', () => {
    for (const m of images.IMAGE_MODELS) {
      assert.ok(images.MODEL_CAPABILITIES[m], `${m} is offered but has no capability row`)
    }
    assert.equal(Object.keys(images.MODEL_CAPABILITIES).length, images.IMAGE_MODELS.length)
  })

  test('the pinned limits match the published schemas', () => {
    const c = images.MODEL_CAPABILITIES
    assert.deepEqual(c['@cf/leonardo/lucid-origin'].stepsRange, [1, 40])
    assert.deepEqual(c['@cf/leonardo/lucid-origin'].guidanceRange, [0, 10])
    assert.deepEqual(c['@cf/leonardo/lucid-origin'].sizeRange, [256, 2500])
    assert.equal(c['@cf/leonardo/lucid-origin'].negativePrompt, false, 'lucid-origin has no negative_prompt')

    assert.deepEqual(c['@cf/leonardo/phoenix-1.0'].stepsRange, [1, 50])
    assert.deepEqual(c['@cf/leonardo/phoenix-1.0'].guidanceRange, [2, 10], 'phoenix floors guidance at 2, not 0')

    for (const m of ['@cf/stabilityai/stable-diffusion-xl-base-1.0', '@cf/bytedance/stable-diffusion-xl-lightning']) {
      assert.deepEqual(c[m].stepsRange, [1, 20])
      assert.equal(c[m].guidanceRange, null, 'the SDXL schemas document no guidance range')
      assert.equal(c[m].negativePrompt, true)
    }
  })

  test('an unrequested parameter sends nothing — Number(null) is 0, not NaN', () => {
    // The regression this pins: a bare Number.isFinite(Number(v)) test read an unset steps as a
    // deliberate 0, clamped it to the model minimum, and silently made every image a one-step
    // render. Nothing in a returned picture would have shown it.
    const { payload, notes } = images.resolveModelParams('@cf/leonardo/lucid-origin', {
      steps: null,
      guidance: null,
      seed: null,
      negativePrompt: null,
      width: null,
      height: null,
    })
    assert.deepEqual(payload, {})
    assert.deepEqual(notes, [])
  })

  test('seed 0 survives — it is a legal seed and a falsy number', () => {
    const { payload } = images.resolveModelParams('@cf/leonardo/lucid-origin', { seed: 0 })
    assert.equal(payload.seed, 0)
  })

  test('a negative seed is refused and said so, not sent', () => {
    const { payload, notes } = images.resolveModelParams('@cf/leonardo/lucid-origin', { seed: -5 })
    assert.equal(payload.seed, undefined)
    assert.match(notes.join(' '), /must be 0 or greater/)
  })

  test('lucid-origin drops a negative prompt it has no field for, and says so', () => {
    // Measured on the live API the same day: Lucid Origin answers 200 and IGNORES a
    // negative_prompt rather than rejecting it. Nothing fails loudly if this gate breaks — the
    // request simply stops doing what the caller asked, which is why it is pinned.
    const { payload, notes } = images.resolveModelParams('@cf/leonardo/lucid-origin', {
      format: 'landscape-16:9',
      quality: 'max',
      negativePrompt: 'blurry, watermark',
    })
    assert.equal(payload.negative_prompt, undefined)
    assert.deepEqual([payload.width, payload.height, payload.num_steps], [1120, 630, 40])
    assert.equal(notes.length, 1)
    assert.match(notes[0], /no negative_prompt parameter/)
  })

  test('every offered model accepts a size and a seed — the tool fills a sized placeholder', () => {
    // The reason flux-1-schnell was retired. generate_node_image only ever writes into an element
    // that already declared its own width, so a model that takes no width cannot serve this tool
    // however good its pictures are. If a future model without a size parameter is added to
    // IMAGE_MODELS, this fails rather than shipping a silently ignored format argument.
    for (const m of images.IMAGE_MODELS) {
      const caps = images.MODEL_CAPABILITIES[m]
      assert.notEqual(caps.sizeRange, false, `${m} cannot honour a format`)
      assert.equal(caps.seed, true, `${m} cannot reproduce an image`)
    }
  })

  test('a retired model is substituted AND reported, never swapped in silence', async () => {
    // A client that connected before the list changed still holds the old enum, so this is a
    // live path. `model` in the reply would otherwise read back as the caller's own choice.
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, {
      graphId,
      nodeId: 'n1',
      prompt: 'en fjord',
      actor: ALICE,
      model: '@cf/black-forest-labs/flux-1-schnell',
    })
    assert.ok(r.ok, JSON.stringify(r))
    assert.equal(r.model, images.DEFAULT_IMAGE_MODEL)
    assert.match(r.notes[0], /flux-1-schnell is not offered here/)
    assert.match(r.notes[0], /no width or height/, 'the reason travels with the substitution')
  })

  test('an unknown model name is substituted and reported too, without a stored reason', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, {
      graphId, nodeId: 'n1', prompt: 'x', actor: ALICE, model: '@cf/nobody/invented-2.0',
    })
    assert.ok(r.ok, JSON.stringify(r))
    assert.equal(r.model, images.DEFAULT_IMAGE_MODEL)
    assert.match(r.notes[0], /invented-2\.0 is not offered here\. Used lucid-origin instead\./)
  })

  test("phoenix raises guidance to its own floor rather than failing the call", () => {
    const { payload, notes } = images.resolveModelParams('@cf/leonardo/phoenix-1.0', { guidance: 1 })
    assert.equal(payload.guidance, 2)
    assert.match(notes.join(' '), /guidance 1 became 2/)
  })

  test('steps above the ceiling are lowered and reported, per model', () => {
    const hi = images.resolveModelParams('@cf/leonardo/lucid-origin', { steps: 99 })
    assert.equal(hi.payload.num_steps, 40)
    assert.match(hi.notes.join(' '), /steps 99 became 40/)

    const lo = images.resolveModelParams('@cf/bytedance/stable-diffusion-xl-lightning', { steps: 99 })
    assert.equal(lo.payload.num_steps, 20)
  })

  test('quality is named because the ceiling differs — max means each model\'s own ceiling', () => {
    for (const m of images.IMAGE_MODELS) {
      const caps = images.MODEL_CAPABILITIES[m]
      const { payload } = images.resolveModelParams(m, { quality: 'max' })
      assert.equal(payload[caps.stepsParam], caps.stepsRange[1], m)
    }
  })

  test('quality standard sends no step count, leaving the model default in place', () => {
    const { payload } = images.resolveModelParams('@cf/leonardo/lucid-origin', { quality: 'standard' })
    assert.equal(payload.num_steps, undefined)
  })

  test('an explicit steps number overrides a named quality level', () => {
    const { payload } = images.resolveModelParams('@cf/leonardo/lucid-origin', { quality: 'draft', steps: 33 })
    assert.equal(payload.num_steps, 33)
  })

  test('lucid-origin allows the 2500 px the others stop at 2048 for', () => {
    const lucid = images.resolveModelParams('@cf/leonardo/lucid-origin', { width: 2400 })
    assert.equal(lucid.payload.width, 2400)
    const sdxl = images.resolveModelParams('@cf/stabilityai/stable-diffusion-xl-base-1.0', { width: 2400 })
    assert.equal(sdxl.payload.width, 2048)
    assert.match(sdxl.notes.join(' '), /width 2400 became 2048/)
  })

  test('a named format is not rounded to a multiple of 8, but a loose number is', () => {
    const named = images.resolveModelParams('@cf/leonardo/lucid-origin', { format: 'landscape-16:9' })
    assert.deepEqual([named.payload.width, named.payload.height], [1120, 630])
    assert.deepEqual(named.notes, [], 'naming a format is not an adjustment')

    const loose = images.resolveModelParams('@cf/leonardo/lucid-origin', { width: 1021 })
    assert.equal(loose.payload.width, 1024)
  })

  test('the node path carries appliedParams and notes back to the caller', async () => {
    const { env, graphId } = await withGraph(HEADER_EL)
    const r = await images.generateImageForNode(env, {
      graphId,
      nodeId: 'n1',
      prompt: 'en fjord',
      actor: ALICE,
      model: '@cf/bytedance/stable-diffusion-xl-lightning',
      quality: 'high',
      steps: 99,
      seed: 7,
    })
    assert.ok(r.ok, JSON.stringify(r))
    assert.equal(r.appliedParams.num_steps, 20, 'clamped to this model\'s ceiling')
    assert.equal(r.appliedParams.seed, 7)
    assert.match(r.notes.join(' '), /steps 99 became 20/)
  })
})
