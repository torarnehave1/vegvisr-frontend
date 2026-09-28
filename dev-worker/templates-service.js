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
