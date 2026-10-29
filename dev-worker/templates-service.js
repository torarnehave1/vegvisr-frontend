/**
 * templates-service.js — the graph-template catalog, read in one place.
 *
 * Extracted from the /plugin/templates* handler in index.js on 2026-09-28. The query behind
 * those five routes was about to be copied into an MCP tool; copying it is how two versions of
 * the same SQL drift apart, which is the whole reason graph-service.js exists. So the REST
 * routes and the MCP tool now call the same function.
 *
 * Two modes, kept exactly as the handler had them:
 *   fulltext-elements — the element grammar a fulltext node's `info` is written in
 *   node-templates    — every other template category
 */

import { ERR, statusForCode } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

const TEMPLATE_COLUMNS = `
  id,
  name,
  nodes,
  edges,
  ai_instructions,
  category,
  thumbnail_path,
  standard_question,
  gemini,
  tool,
  plugin
`

/**
 * List templates. `mode` is 'fulltext-elements' (default) or 'node-templates'; the latter
 * excludes the Fulltext Elements category rather than selecting it.
 *
 * Returns the rows shaped as the REST endpoint has always shaped them, so the route that wraps
 * this can keep its response byte-for-byte.
 */
export async function listTemplates(env, { plugin = 1, category = null, mode = 'fulltext-elements' } = {}) {
  const pluginValue = plugin ? 1 : 0
  const isNodeTemplates = mode === 'node-templates'
  const requestedCategory = isNodeTemplates ? category : category || 'Fulltext Elements'

  const query = isNodeTemplates
    ? `SELECT ${TEMPLATE_COLUMNS}
       FROM graphTemplates
       WHERE plugin = ?
         AND category != 'Fulltext Elements'
         AND (? IS NULL OR category = ?)
       ORDER BY category, name`
    : `SELECT ${TEMPLATE_COLUMNS}
       FROM graphTemplates
       WHERE plugin = ?
         AND (? IS NULL OR category = ?)
       ORDER BY category, name`

  const results = await env.vegvisr_org
    .prepare(query)
    .bind(pluginValue, requestedCategory, requestedCategory)
    .all()

  const templates = (results.results || []).map((template) => ({
    id: template.id,
    name: template.name,
    nodes: JSON.parse(template.nodes || '[]'),
    edges: JSON.parse(template.edges || '[]'),
    ai_instructions: template.ai_instructions || '',
    category: template.category || 'General',
    thumbnail_path: template.thumbnail_path || null,
    standard_question: template.standard_question || '',
    gemini: template.gemini || 0,
    tool: template.tool || 0,
    plugin: template.plugin || 0,
  }))

  return { ok: true, plugin: pluginValue, mode, category: requestedCategory, count: templates.length, results: templates }
}

// ─────────────────────────────────────────────────────────────────────────────
// The fulltext-element grammar, projected for a model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `ai_instructions` is a JSON string per row: { kind, trigger, insert_mode, format, parameters,
 * notes }. A row whose JSON will not parse is REPORTED rather than dropped — silently omitting
 * an element teaches a model that it does not exist.
 */
function parseInstructions(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * The element catalog, compacted for a model that is about to write node content.
 *
 * The REST endpoint answers with about 25 KB, most of it node templates a model does not need.
 * What it needs is the trigger, the format, the parameters and the notes; paying for the rest
 * in context on every call is what would stop it calling at all.
 */
export async function listFulltextElements(env, { name = null } = {}) {
  const all = await listTemplates(env, { plugin: 1, mode: 'fulltext-elements' })
  if (!all.ok) return all

  let rows = all.results

  if (name) {
    const needle = String(name).trim().toLowerCase()
    rows = rows.filter((r) => {
      const n = String(r.name || '').toLowerCase()
      return n === needle || n.includes(needle)
    })
    if (rows.length === 0) {
      return fail(
        ERR.GRAPH_NOT_FOUND,
        `No fulltext element matches "${name}". Call this without a name to see them all.`,
      )
    }
  }

  const elements = []
  const unreadable = []

  for (const r of rows) {
    const ai = parseInstructions(r.ai_instructions)
    if (!ai) {
      unreadable.push(r.name || r.id)
      continue
    }
    elements.push({
      name: r.name,
      trigger: ai.trigger ?? null,
      insertMode: ai.insert_mode ?? null,
      format: ai.format ?? null,
      parameters: ai.parameters ?? null,
      notes: ai.notes ?? null,
    })
  }

  return {
    ok: true,
    count: elements.length,
    elements,
    ...(unreadable.length ? { unreadable } : {}),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The node-template catalog, projected for a model — the counterpart of the element grammar
// ─────────────────────────────────────────────────────────────────────────────
//
// Added 2026-10-29. get_fulltext_elements gives a model the exact grammar for what goes INSIDE a
// fulltext node; nothing gave it the shape of a standalone node. The shapes already exist: every
// node template in graphTemplates holds an example node, and many an ai_instructions recipe. A
// youtube-video node was written three different ways that day while the YouTube template's
// recipe sat unread in this table. This reads it — nothing new is stored anywhere.
//
// Excluded: Fulltext Elements (get_fulltext_elements has them) and My Apps (users' own app-viewer
// pages, kilobytes of HTML each, not shapes).

const NODE_TEMPLATE_SQL = `SELECT id, name, category, nodes, ai_instructions
  FROM graphTemplates
  WHERE category NOT IN ('Fulltext Elements', 'My Apps')
  ORDER BY category, name`

const MAX_EXAMPLE_INFO = 2000

/** The first node of a template, without its empty id, with a long info cut and marked as cut. */
function exampleNode(raw) {
  let nodes = []
  try { nodes = JSON.parse(raw || '[]') } catch { return null }
  const n = Array.isArray(nodes) ? nodes[0] : null
  if (!n || typeof n !== 'object') return null
  const { id: _id, position: _p, ...rest } = n
  if (typeof rest.info === 'string' && rest.info.length > MAX_EXAMPLE_INFO) {
    rest.info = `${rest.info.slice(0, MAX_EXAMPLE_INFO)}… [cut: ${rest.info.length} characters in the template]`
  }
  return rest
}

/**
 * Recipes for standalone node types, grouped by type: { type, templates: [{ name, category,
 * aiInstructions, example }] }. `type` narrows to one node type ("youtube-video"); `name` to
 * templates whose name contains it. ai_instructions is returned parsed when it is JSON and as
 * text when it is not — some rows hold prose — so nothing a template says is lost.
 */
export async function listNodeTemplates(env, { type = null, name = null } = {}) {
  const res = await env.vegvisr_org.prepare(NODE_TEMPLATE_SQL).all()
  const wantType = type ? String(type).trim() : null
  const needle = name ? String(name).trim().toLowerCase() : null
  const byType = new Map()
  for (const r of res.results || []) {
    const example = exampleNode(r.nodes)
    const nodeType = example?.type ? String(example.type) : null
    if (!nodeType) continue
    if (wantType && nodeType !== wantType) continue
    if (needle && !String(r.name || '').toLowerCase().includes(needle)) continue
    const raw = r.ai_instructions == null ? '' : String(r.ai_instructions)
    const aiInstructions = raw.trim() ? (parseInstructions(raw) ?? raw.trim()) : null
    if (!byType.has(nodeType)) byType.set(nodeType, [])
    byType.get(nodeType).push({ name: r.name, category: r.category || 'General', aiInstructions, example })
  }
  if ((wantType || needle) && byType.size === 0) {
    return fail(ERR.GRAPH_NOT_FOUND, `No node template matches${wantType ? ` type "${wantType}"` : ''}${needle ? ` name "${name}"` : ''}. Call this without arguments to see them all.`)
  }
  const types = [...byType.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, templates]) => ({ type: t, templates }))
  return { ok: true, count: types.length, types }
}
