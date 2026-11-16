// /getknowgraphsummaries?fields=card — the lean portfolio page (summary-card.js), run against a
// real SQLite engine with the real schema (d1-adapter), 2026-11-16.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb } from './d1-adapter.mjs'
import { cardSummaryQuery } from '../summary-card.js'

const ORDER = 'ORDER BY COALESCE(updated_at, created_date) DESC, id DESC'

function put(raw, id, data, updatedAt) {
  raw.prepare('INSERT INTO knowledge_graphs (id, title, data, created_date, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, `row-${id}`, typeof data === 'string' ? data : JSON.stringify(data), updatedAt, updatedAt, 'test')
}

async function page(env, limit = 50, offset = 0) {
  const r = await env.vegvisr_org.prepare(cardSummaryQuery('', ORDER)).bind(limit, offset).all()
  return Object.fromEntries((r.results || []).map((x) => [x.id, x]))
}

describe('card summary query', () => {
  test('picture columns: the first match in node order, each scan on its own', async () => {
    const { env, raw } = freshDb()
    put(raw, 'portfolio', { metadata: { title: 'P', metaArea: '#A' }, nodes: [
      { id: 'a', type: 'image', path: 'https://x/img.png' },
      { id: 'b', type: 'portfolio-image', path: 'https://x/portfolio.jpg' },
    ] }, '2026-11-16T10:00:00Z')
    put(raw, 'textfirst', { metadata: { title: 'T' }, nodes: [
      { id: 'a', type: 'fulltext', info: 'intro text' },
      { id: 'b', type: 'fulltext', info: 'before ![alt](https://x/md.png) after' },
      { id: 'c', type: 'image', path: 'https://x/second-image.png' },
      { id: 'd', type: 'image', path: 'https://x/third-image.png' },
    ] }, '2026-11-16T09:00:00Z')
    put(raw, 'quote', { metadata: { seoOgImage: 'https://x/og.png' }, nodes: [
      { id: 'a', type: 'fulltext', info: "x [IMAGEQUOTE backgroundImage:'https://x/q.jpg'] y" },
    ] }, '2026-11-16T08:00:00Z')
    put(raw, 'none', { metadata: { title: 'N' }, nodes: [{ id: 'a', type: 'fulltext', info: 'no pictures' }] }, '2026-11-16T07:00:00Z')
    put(raw, 'broken', '{not json', '2026-11-16T06:00:00Z')

    const rows = await page(env)
    assert.deepEqual(Object.keys(rows), ['portfolio', 'textfirst', 'quote', 'none', 'broken'])

    assert.equal(rows.portfolio.portfolio_image_path, 'https://x/portfolio.jpg')
    assert.equal(rows.portfolio.image_node_path, 'https://x/img.png')
    assert.equal(rows.portfolio.metadata_title, 'P')
    assert.equal(rows.portfolio.metadata_meta_area, '#A')

    assert.equal(rows.textfirst.image_node_path, 'https://x/second-image.png')
    assert.ok(rows.textfirst.image_info_snippet.startsWith(' ![alt](https://x/md.png)'), rows.textfirst.image_info_snippet)
    assert.equal(rows.textfirst.any_image_path, 'https://x/second-image.png')

    assert.equal(rows.quote.metadata_seo_og_image, 'https://x/og.png')
    assert.ok(rows.quote.image_info_snippet.includes("[IMAGEQUOTE backgroundImage:'https://x/q.jpg']"))

    for (const k of ['portfolio_image_path', 'image_node_path', 'image_info_snippet', 'any_image_path']) {
      assert.equal(rows.none[k], null, `none.${k}`)
      assert.equal(rows.broken[k], null, `broken.${k}`)
    }
    assert.equal(rows.broken.metadata_title, 'row-broken')
  })

  test('paging: LIMIT/OFFSET in the order the full summaries use', async () => {
    const { env, raw } = freshDb()
    for (let i = 0; i < 5; i++) put(raw, `g${i}`, { nodes: [] }, `2026-11-1${i}T00:00:00Z`)
    assert.deepEqual(Object.keys(await page(env, 2, 0)), ['g4', 'g3'])
    assert.deepEqual(Object.keys(await page(env, 2, 2)), ['g2', 'g1'])
    assert.deepEqual(Object.keys(await page(env, 2, 4)), ['g0'])
  })
})
