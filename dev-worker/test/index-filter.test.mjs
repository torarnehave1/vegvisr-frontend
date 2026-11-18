// graph_index's extra filters (mcp/index-filter.js), without a database.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterIndexRows, pageRows, tagsOf, checkIndexFilters, briefRow } from '../mcp/index-filter.js'

const rows = [
  { graphId: 'a', title: 'A', metaArea: '#NINE #x', world: null, publicationState: 'published', publishedDomains: ['a.example'], createdAt: '2024-02-01 10:00:00' },
  { graphId: 'b', title: 'B', metaArea: '#BOOK', world: 'sodesign.no', publicationState: 'published', publishedDomains: [], createdAt: '2025-06-30 23:59:59' },
  { graphId: 'c', title: 'C', metaArea: '', world: 'sodesign.no', publicationState: 'private', publishedDomains: [], createdAt: '2026-01-01 00:00:00' },
  { graphId: 'd', title: 'D', metaArea: '#nine', world: 'torarnehave.no', publicationState: 'draft', publishedDomains: [], createdAt: null },
]
const ids = (f) => filterIndexRows(rows, f).map((g) => g.graphId).join('')

test('tags are read like the map reads them', () => {
  assert.deepEqual(tagsOf(' #nine  #X #nine'), ['#NINE', '#X'])
  assert.deepEqual(tagsOf('(none)'), [])
})
test('no filters keeps every row', () => assert.equal(ids({}), 'abcd'))
test('world, and "shared" for the platform storage', () => {
  assert.equal(ids({ world: 'sodesign.no' }), 'bc')
  assert.equal(ids({ world: 'shared' }), 'a')
})
test('metaAreas is any-of, case-insensitive', () => {
  assert.equal(ids({ metaAreas: ['#NINE'] }), 'ad')
  assert.equal(ids({ metaAreas: ['#book', '#X'] }), 'ab')
})
test('published: live, published, private', () => {
  assert.equal(ids({ published: 'live' }), 'a')
  assert.equal(ids({ published: 'published' }), 'ab')
  assert.equal(ids({ published: 'private' }), 'cd')
})
test('created range: a bare createdTo date includes the whole day; undated rows drop out', () => {
  assert.equal(ids({ createdFrom: '2025-01-01' }), 'bc')
  assert.equal(ids({ createdTo: '2025-06-30' }), 'ab')
  assert.equal(ids({ createdFrom: '2025-01-01', createdTo: '2025-12-31' }), 'b')
  assert.equal(ids({ createdTo: '2026-01-01T00:00:00Z' }), 'abc')
})
test('filters combine', () => assert.equal(ids({ world: 'sodesign.no', published: 'private' }), 'c'))
test('paging and brief rows', () => {
  assert.deepEqual(pageRows(rows, { offset: 1, limit: 2 }).map((g) => g.graphId), ['b', 'c'])
  assert.deepEqual(pageRows(rows, {}).length, 4)
  assert.deepEqual(Object.keys(briefRow(rows[0])), ['graphId', 'title', 'metaArea', 'world', 'createdAt', 'version'])
})
test('an unreadable date is refused in words', () => {
  assert.match(checkIndexFilters({ createdTo: 'last tuesday' }), /createdTo/)
  assert.equal(checkIndexFilters({ createdFrom: '2025-01-01', createdTo: '2025-02-01T12:00:00Z' }), null)
})

test('minVersion keeps graphs at that version or higher; a graph without a number drops out', () => {
  const v = [{ graphId: 'a', version: 3 }, { graphId: 'b', version: 51 }, { graphId: 'c', version: null }, { graphId: 'd' }]
  assert.equal(filterIndexRows(v, { minVersion: 51 }).map((g) => g.graphId).join(''), 'b')
  assert.equal(filterIndexRows(v, { minVersion: 1 }).map((g) => g.graphId).join(''), 'ab')
  assert.match(checkIndexFilters({ minVersion: 0 }), /minVersion/)
  assert.equal(checkIndexFilters({ minVersion: 51 }), null)
})
