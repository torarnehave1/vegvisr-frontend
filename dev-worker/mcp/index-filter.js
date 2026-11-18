// graph_index's extra filters, applied to the rows graphIndex returns (after publishedDomains are
// attached). Pure, so it is tested without a database.
//
// Added 2026-11-17 so a client that narrows the collection in its own UI (Garnet: World, several
// meta areas, published, created year, the time slider) can name that exact set as one call, and a
// chat model can pull it instead of being handed thousands of rows in its prompt.
//
//   world        a World domain, or "shared" for the platform's shared storage (world null)
//   metaAreas    any of these tags; "#A" matches a graph whose metaArea holds #A among others
//   published    "live" (served at a hostname) · "published" · "private" (anything not published)
//   createdFrom  createdAt >= this (ISO date or date-time, UTC)
//   createdTo    createdAt <= this; a bare date (YYYY-MM-DD) includes that whole day
//   minVersion   version >= this (2026-11-18); a graph with no version number drops out
//   offset/limit paging over the matches; total counts every match
//   brief        rows with graphId, title, metaArea, world, createdAt, version only

export const SHARED_WORLD = 'shared'

// "#a  #B" → ["#A", "#B"], the way the map and the tag lists read a metaArea string.
export function tagsOf(metaArea) {
  const s = String(metaArea || '').trim()
  if (!s || s === '(none)') return []
  const parts = s.includes('#') ? s.split('#') : [s]
  return [...new Set(parts.map((p) => p.trim().toUpperCase()).filter(Boolean).map((p) => '#' + p))]
}

// createdAt as stored ("2024-02-01 10:00:00", UTC without a zone) or ISO → ms, NaN when unreadable.
export function timeOf(value) {
  if (!value) return NaN
  const c = String(value).trim().replace(' ', 'T')
  return Date.parse(c + (/[zZ]|[+-]\d\d:?\d\d$/.test(c) || !/T/.test(c) ? '' : 'Z'))
}

function bound(value, end) {
  if (value === undefined || value === null || value === '') return null
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(s + 'T00:00:00Z') + (end ? 86400000 - 1 : 0)
  const t = timeOf(s)
  return isNaN(t) ? undefined : t
}

/** Validation errors in words, or null. */
export function checkIndexFilters(f) {
  if (f.createdFrom !== undefined && bound(f.createdFrom, false) === undefined) return `createdFrom is not a date: ${f.createdFrom}`
  if (f.createdTo !== undefined && bound(f.createdTo, true) === undefined) return `createdTo is not a date: ${f.createdTo}`
  if (f.minVersion !== undefined && !(Number.isInteger(f.minVersion) && f.minVersion >= 1)) return `minVersion must be a whole number from 1: ${f.minVersion}`
  return null
}

export function hasIndexFilters(f) {
  return Boolean(f.world || (f.metaAreas && f.metaAreas.length) || f.published || f.createdFrom || f.createdTo || f.minVersion)
}

export function filterIndexRows(rows, f) {
  const want = f.metaAreas && f.metaAreas.length ? new Set(f.metaAreas.flatMap(tagsOf)) : null
  const from = bound(f.createdFrom, false)
  const to = bound(f.createdTo, true)
  return rows.filter((g) => {
    if (f.world) {
      if (f.world === SHARED_WORLD ? g.world : g.world !== f.world) return false
    }
    if (want && !tagsOf(g.metaArea).some((t) => want.has(t))) return false
    if (f.published === 'live' && !(g.publishedDomains || []).length) return false
    if (f.published === 'published' && g.publicationState !== 'published') return false
    if (f.published === 'private' && g.publicationState === 'published') return false
    if (from !== null || to !== null) {
      const t = timeOf(g.createdAt)
      if (isNaN(t)) return false
      if (from !== null && t < from) return false
      if (to !== null && t > to) return false
    }
    if (f.minVersion && !(Number(g.version) >= f.minVersion)) return false
    return true
  })
}

export function pageRows(rows, { offset, limit }) {
  const start = Math.max(0, offset || 0)
  return limit ? rows.slice(start, start + limit) : rows.slice(start)
}

export const briefRow = (g) => ({ graphId: g.graphId, title: g.title, metaArea: g.metaArea, world: g.world, createdAt: g.createdAt, version: g.version ?? null })
