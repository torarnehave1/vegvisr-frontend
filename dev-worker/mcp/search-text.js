// search_text's rules, pure so they are tested without a database (2026-11-18).
//
// What the architect asked for: write a whole word, press Enter, and get the graphs on the map
// that contain it. The text of a node is not in one field: a fulltext node has it in `info`, a
// sanskrit-ord node in `metadata`, so the search reads every text value of every node, whatever its
// type. Node types that hold code, layout or configuration are left out (an html-node's page is
// not something to search in), and in every node the technical fields are skipped: ids, types,
// colours, positions and addresses.
//
// The lists below are the architect's starting point (graph Systemutviklingsplan, node 5a). They
// are the one place to change when a type should move.

/** Code, layout and configuration: a node of one of these types is not searched at all. */
export const EXCLUDED_NODE_TYPES = new Set([
  // pages and code
  'html-node', 'css-node', 'component', 'app-viewer', 'json-node', 'data-node',
  // layout and controls
  'layout', 'background', 'menu', 'menu_creator', 'button_row', 'password-protection',
  'audio-portfolio-selector', 'advertisement_manager', 'email-manager',
  // agent and system set-up
  'agent-config', 'agent-contract', 'agent-run', 'connector', 'model-alias', 'work-context',
  'world-brand', 'email-brand', 'graph-canvas', 'graph-type',
  // payment and tests
  'stripe-button', 'subscription', 'action_test', 'REG',
])

/** Diagrams and charts: `info` is the drawing's source or its data, so only the name is searched. */
export const LABEL_ONLY_NODE_TYPES = new Set([
  'mermaid-diagram', 'chart', 'linechart', 'piechart', 'bubblechart', 'network', 'person-network-canvas', 'map',
])

// Fields that never hold text for people. Media nodes (image, video, youtube-video …) need no rule
// of their own: with `path` and the sizes skipped, what is left of them is the name and the
// description.
const SKIP_KEYS = new Set([
  'id', 'type', 'color', 'colors', 'fonts', 'position', 'visible', 'path', 'imageWidth', 'imageHeight',
  'createdBy', 'userId', 'token', 'encrypted', 'key', 'sha256', 'bytes', 'url', 'publishedDomain',
  'kind', 'schema', 'status', 'lang', 'order',
])
const skipKey = (k) => SKIP_KEYS.has(k) || /(Url|Id|Ids|Key|Color|Path)$/.test(k)

// A value that is only an address, or one long unbroken string (a data URI, an encoded blob).
const skipValue = (s) => /^(https?:|data:|blob:)\S*$/.test(s) || (s.length > 200 && !/\s/.test(s))

const WORD_CHAR = '\\p{L}\\p{N}\\p{M}'
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Read what was typed. A whole word matches as a whole word; `*` stands for any letters, so
 * `puls*` finds "pulsen" and `*puls` finds "livspuls". Several words are a phrase.
 * @returns {{ error: string } | { query, rx: RegExp, literals: string[], plain: boolean }}
 *   literals: the spellings of the longest fixed part that a byte-wise search must try, because
 *   SQLite's lower() only folds a–z. plain: one word without `*`, the case spelling help covers.
 */
export function parseQuery(input) {
  const query = String(input ?? '').normalize('NFC').trim().replace(/\s+/g, ' ')
  if (!query) return { error: 'Write a word to search for.' }
  if (query.length > 100) return { error: 'The search text is longer than 100 characters.' }
  const tokens = query.split(' ')
  let longest = ''
  const parts = tokens.map((tok) => {
    const pieces = tok.split('*')
    for (const p of pieces) if (p.length > longest.length) longest = p
    return pieces.map(escapeRx).join(`[${WORD_CHAR}]*`)
  })
  if ([...longest].length < 2) return { error: 'Write at least two letters next to each other.' }
  const openLeft = tokens[0].startsWith('*')
  const openRight = tokens[tokens.length - 1].endsWith('*')
  const rx = new RegExp(
    (openLeft ? '' : `(?<![${WORD_CHAR}])`) + parts.join('\\s+') + (openRight ? '' : `(?![${WORD_CHAR}])`),
    'iu',
  )
  const lower = longest.toLowerCase()
  // "økonomi", "ØKONOMI" (stored upper case: lower() leaves the Ø) and "Økonomi".
  const caps = [...lower].map((c) => (c.charCodeAt(0) > 127 ? c.toUpperCase() : c)).join('')
  const first = [...lower]
  first[0] = first[0].toUpperCase()
  const literals = [...new Set([lower, caps, first.join('').replace(/^[A-Z]/, (c) => c.toLowerCase())])]
  return { query, rx, literals, plain: tokens.length === 1 && !query.includes('*') }
}

/** Every text value of a node that the search may read, with the technical fields left out. */
function* nodeTexts(node) {
  if (!node || typeof node !== 'object') return
  if (typeof node.label === 'string') yield node.label
  if (LABEL_ONLY_NODE_TYPES.has(node.type)) return
  yield* walk(node, 0, true)
}
function* walk(value, depth, top) {
  if (typeof value === 'string') {
    if (value && !skipValue(value)) yield value
    return
  }
  if (!value || typeof value !== 'object' || depth > 8) return
  if (Array.isArray(value)) {
    for (const v of value) yield* walk(v, depth + 1, false)
    return
  }
  for (const [k, v] of Object.entries(value)) {
    if (skipKey(k) || (top && k === 'label')) continue
    yield* walk(v, depth + 1, false)
  }
}

const searchable = (node) => node && typeof node === 'object' && !EXCLUDED_NODE_TYPES.has(node.type)

/**
 * Where in a graph the search text stands.
 * @returns {{ inTitle: boolean, nodeIds: string[] } | null} null when it stands nowhere.
 */
export function matchGraph(graph, rx) {
  const meta = graph?.metadata || {}
  const inTitle = [meta.title, meta.description].some((t) => typeof t === 'string' && rx.test(t.normalize('NFC')))
  const nodeIds = []
  for (const node of Array.isArray(graph?.nodes) ? graph.nodes : []) {
    if (!searchable(node)) continue
    for (const text of nodeTexts(node)) {
      if (rx.test(text.normalize('NFC'))) {
        if (node.id != null) nodeIds.push(String(node.id))
        break
      }
    }
  }
  return inTitle || nodeIds.length ? { inTitle, nodeIds } : null
}

/** Count the words of a graph into `vocab` (word in lower case → how often), for spelling help. */
export function collectWords(graph, vocab) {
  const add = (text) => {
    for (const m of text.normalize('NFC').matchAll(/\p{L}[\p{L}\p{M}\p{N}]*/gu)) {
      const w = m[0].toLowerCase()
      if (w.length >= 2 && w.length <= 40) vocab.set(w, (vocab.get(w) || 0) + 1)
    }
  }
  const meta = graph?.metadata || {}
  for (const t of [meta.title, meta.description]) if (typeof t === 'string') add(t)
  for (const node of Array.isArray(graph?.nodes) ? graph.nodes : []) {
    if (!searchable(node)) continue
    for (const text of nodeTexts(node)) add(text)
  }
}

// Edit distance with swapped neighbours counted as one slip, given up once it passes `max`.
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev2 = null
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1)
      cur[j] = d
      if (d < best) best = d
    }
    if (best > max) return max + 1
    prev2 = prev
    prev = cur
  }
  return prev[b.length]
}

/**
 * The words that exist in the searched graphs and lie closest to what was typed: one slip for a
 * short word, two for a longer one. Closest first, then the most used. Never the word itself.
 */
export function suggest(word, vocab, most = 3) {
  const w = [...String(word).normalize('NFC').toLowerCase()]
  const max = w.length <= 4 ? 1 : 2
  const found = []
  for (const [cand, count] of vocab) {
    if (cand === w.join('')) continue
    const d = distance(w, [...cand], max)
    if (d <= max) found.push({ word: cand, d, count })
  }
  return found.sort((a, b) => a.d - b.d || b.count - a.count || a.word.localeCompare(b.word)).slice(0, most).map((f) => f.word)
}
