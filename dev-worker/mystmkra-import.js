/**
 * One-time import of Mystmkra, the first prototype of the knowledge database (2024–2025), into
 * the current one. Mystmkra kept Markdown documents in the D1 database `mystmkra-db`, bound here
 * as MYSTMKRA_DB; the same files lie in Dropbox under /mystmkra/<user id>/<document id>.md.
 *
 * One document becomes one private graph in the caller's account:
 *   - node `document`: the Markdown, byte for byte as stored
 *   - node `origin`:   where it came from (old id, old title, category, tags, author)
 *   - created date:    the day the document was written, so it sits there in timelines
 *   - meta area:       #MYSTMKRA, plus the author's own tag when the author is not the importer
 *
 * The copying is done here, in the worker, and not by a model reading and retyping the text:
 * 2.2 million characters of history are to arrive as they are.
 *
 * Safe to run again. A document already imported is found by the `mystmkraId` its document node
 * carries and is skipped; exact copies of an earlier document (29 of 365 on 2026-11-14) are
 * skipped too, the earliest one kept. A call does a bounded batch, because each graph costs
 * several D1 statements and a worker invocation has a limit on them.
 */
import * as gs from './graph-service.js'

export const MYSTMKRA_TAG = '#MYSTMKRA'

/** Mystmkra's two accounts (MongoDB user ids), as the owner named them on 2026-11-14. */
export const MYSTMKRA_AUTHORS = {
  '6665c107e4a8ea992f1ad942': { name: 'Tor Arne Håve', tag: null },
  '666605dc63d7487c9304906e': { name: 'Maiken Sneeggen', tag: '#MAIKENSNEEGGEN' },
}

export const MYSTMKRA_BATCH_DEFAULT = 20
export const MYSTMKRA_BATCH_MAX = 40

const PLACEHOLDER_TITLES = new Set(['', 'untitled', 'header 1'])

/**
 * The graph title for a document. Mystmkra saved 169 of 365 as "Untitled" or "Header 1" (the
 * editor's defaults), so for those the first heading in the text is the title, then the first
 * line of prose, then the date.
 */
export function mystmkraTitle(doc) {
  const own = String(doc.title || '').trim()
  if (!PLACEHOLDER_TITLES.has(own.toLowerCase())) return own.slice(0, 200)

  const lines = String(doc.content || '').split('\n').map((l) => l.trim())
  const clean = (l) => l.replace(/^#+\s*/, '').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim()
  const heading = lines.find((l) => /^#{1,6}\s+\S/.test(l) && clean(l))
  if (heading) return clean(heading).slice(0, 200)
  // A line of prose: not an image, not a rule, not a fence, not a bare link.
  const prose = lines.find((l) => l && !/^(!\[|---|\*\*\*|```|<|\[.*\]\(.*\)$)/.test(l) && clean(l).length > 2)
  if (prose) {
    const t = clean(prose)
    return t.length > 80 ? `${t.slice(0, 77)}…` : t
  }
  return `Mystmkra document ${String(doc.created_at || '').slice(0, 10) || doc.id}`
}

function parseJson(text, fallback) {
  try {
    const v = JSON.parse(text)
    return v ?? fallback
  } catch {
    return fallback
  }
}

function originNode(doc, title, author, importedOn) {
  const category = parseJson(doc.semantic_category, null)
  const tags = parseJson(doc.tags, [])
  const cat = category?.primary
    ? [category.primary, ...(Array.isArray(category.secondary) ? category.secondary : [])].join(', ')
    : 'none'
  const ownTitle = String(doc.title || '').trim()
  const rows = [
    ['Written by', author.name],
    ['Written', String(doc.created_at || '').slice(0, 10) || 'unknown'],
    ['Mystmkra document id', doc.id],
    ['Title in Mystmkra', ownTitle === title ? ownTitle : `${ownTitle || '(none)'} — the graph title is taken from the text`],
    ['Category set in Mystmkra', cat],
    ['Tags in Mystmkra', Array.isArray(tags) && tags.length ? tags.join(' ') : 'none'],
    ['Imported', `${importedOn}, from the database mystmkra-db`],
  ]
  return {
    id: 'origin',
    label: 'Origin – imported from Mystmkra',
    type: 'fulltext',
    info:
      '# Origin\n\nThis document comes from **Mystmkra**, the first prototype of the knowledge database.\n\n' +
      '| | |\n|---|---|\n' +
      rows.map(([k, v]) => `| **${k}** | ${String(v).replace(/\|/g, '\\|')} |`).join('\n') +
      "\n\nThe text is imported unchanged. The graph's created date is the date the document was written.",
  }
}

/**
 * Import the next batch of Mystmkra documents as graphs owned by `actor`.
 *
 *   limit   how many graphs to create in this call (1–MYSTMKRA_BATCH_MAX)
 *   dryRun  count and list what would be imported, write nothing
 */
export async function importMystmkra(env, { actor, limit = MYSTMKRA_BATCH_DEFAULT, dryRun = false } = {}) {
  if (!actor) return { ok: false, code: gs.ERR.UNAUTHENTICATED, message: 'Authentication required.' }
  const src = env.MYSTMKRA_DB
  if (!src) return { ok: false, code: gs.ERR.INVALID_INPUT, message: 'The Mystmkra database is not bound to this worker (MYSTMKRA_DB).' }
  const batch = Math.max(1, Math.min(MYSTMKRA_BATCH_MAX, Number.isInteger(limit) ? limit : MYSTMKRA_BATCH_DEFAULT))

  // Everything but the text, oldest first.
  const docs = (
    await src
      .prepare(
        `SELECT id, title, user_id, created_at, updated_at, tags, semantic_category, url, LENGTH(content) AS len
         FROM documents ORDER BY created_at ASC, id ASC`,
      )
      .all()
  ).results || []

  // Exact copies of an earlier document. Compared in SQL so the texts never leave the database.
  const copies = new Set(
    ((
      await src
        .prepare(
          `SELECT d.id FROM documents d WHERE EXISTS (
             SELECT 1 FROM documents e
             WHERE e.content = d.content AND (e.created_at < d.created_at OR (e.created_at = d.created_at AND e.id < d.id)))`,
        )
        .all()
    ).results || []).map((r) => r.id),
  )

  // What is already here: every #MYSTMKRA graph names the document it came from on its node.
  const here = new Set(
    ((
      await env.vegvisr_org
        .prepare(
          `SELECT json_extract(j.value, '$.metadata.mystmkraId') AS mid
           FROM knowledge_graphs g, json_each(g.data, '$.nodes') j
           WHERE g.meta_area LIKE '%${MYSTMKRA_TAG}%' AND json_extract(j.value, '$.metadata.mystmkraId') IS NOT NULL`,
        )
        .all()
    ).results || []).map((r) => r.mid),
  )

  const empty = docs.filter((d) => !d.len).map((d) => d.id)
  const pending = docs.filter((d) => d.len && !copies.has(d.id) && !here.has(d.id))
  const todo = pending.slice(0, batch)
  const importedOn = new Date().toISOString().slice(0, 10)
  const imported = []
  const errors = []

  for (const meta of todo) {
    const author = MYSTMKRA_AUTHORS[meta.user_id] || { name: `Mystmkra user ${meta.user_id || 'unknown'}`, tag: null }
    if (dryRun) {
      imported.push({ mystmkraId: meta.id, graphId: null, title: null, createdAt: meta.created_at || null, author: author.name })
      continue
    }
    const row = await src.prepare('SELECT content FROM documents WHERE id = ?').bind(meta.id).first()
    const doc = { ...meta, content: row?.content ?? '' }
    if (!String(doc.content).trim()) {
      errors.push({ mystmkraId: meta.id, message: 'The document has no text.' })
      continue
    }
    const title = mystmkraTitle(doc)
    const created = await gs.createGraph(env, {
      title,
      description:
        `Document from Mystmkra, the first prototype of the knowledge database. Written by ${author.name}` +
        `${doc.created_at ? ` on ${String(doc.created_at).slice(0, 10)}` : ''}. Imported unchanged.`,
      metaArea: author.tag ? `${MYSTMKRA_TAG} ${author.tag}` : MYSTMKRA_TAG,
      nodes: [
        {
          id: 'document',
          label: title,
          type: 'fulltext',
          info: doc.content,
          metadata: {
            origin: 'mystmkra',
            mystmkraId: doc.id,
            mystmkraUserId: doc.user_id || null,
            author: author.name,
            originalTitle: String(doc.title || ''),
            createdAt: doc.created_at || null,
            updatedAt: doc.updated_at || null,
            semanticCategory: parseJson(doc.semantic_category, null),
            tags: parseJson(doc.tags, []),
            originalUrl: doc.url || null,
          },
        },
        originNode(doc, title, author, importedOn),
      ],
      edges: [{ source: 'document', target: 'origin', label: 'origin' }],
      actor,
    })
    if (!created.ok) {
      errors.push({ mystmkraId: meta.id, message: created.message || created.code || 'create failed' })
      continue
    }

    // The created date. A graph whose date cannot be set is still imported — the date is in
    // its origin node — and is reported, not rolled back.
    let createdAt = null
    const wanted = gs.normalizeCreatedDate(String(doc.created_at || ''))
    if (wanted) {
      const dated = await gs.updateMetadata(env, {
        graphId: created.graphId,
        fields: { createdDate: wanted },
        expectedVersion: await gs.currentVersion(env, created.graphId, actor),
        actor,
      })
      if (dated.ok) createdAt = dated.createdAt
      else errors.push({ mystmkraId: meta.id, graphId: created.graphId, message: `Imported, but the created date was not set: ${dated.message || dated.code}` })
    } else {
      errors.push({ mystmkraId: meta.id, graphId: created.graphId, message: 'Imported, but the document has no usable date.' })
    }
    imported.push({ mystmkraId: meta.id, graphId: created.graphId, title, createdAt, author: author.name })
  }

  return {
    ok: true,
    dryRun: Boolean(dryRun),
    total: docs.length,
    exactCopiesSkipped: copies.size,
    emptySkipped: empty.length,
    alreadyImported: docs.filter((d) => here.has(d.id)).length,
    importedNow: dryRun ? 0 : imported.length,
    remaining: pending.length - (dryRun ? 0 : imported.length),
    imported,
    errors,
  }
}
