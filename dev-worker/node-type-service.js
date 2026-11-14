/**
 * node-type-service.js — a World's own node types: create, change the look, put to use, list.
 *
 * Phase 2 of the rendering engine (2026-10-18) put these behind three MCP tools. A founder should
 * not need MCP, JSON or the words "renderer" and "approve" (decided 2026-10-18, plan
 * PLAN-nodetyper-chat.md, option A): Agent-Builder's "Nodetyper" work context reaches the same rules
 * over REST. So the rules live here, once, and both doors call them:
 *
 *   MCP  register_node_type / set_node_type_renderer / approve_node_type_renderer  (with world)
 *   MCP  promote_node_type — a World's type lifted to the platform in one write (2026-11-14)
 *   REST GET /node-types/world/mine · POST /node-types/world/{create,look,use}     (index.js)
 *
 * Every function returns { ok: true, ... } or a graph-service failure { ok: false, code, message }.
 * Who may: mayManageWorld — the World's founder or account holder, a system owner, a Superadmin.
 *
 * A type node (system-nodetype in the World's #WORLD-NODE-TYPES registry graph) carries:
 *   label            the type name (slug), what a node's `type` holds
 *   info             what a node of this type holds
 *   metadata.title   the name a founder sees ("Kursmodul")
 *   metadata.fields  [{ key, label, kind }] — the node's metadata keys, edited as a form
 *   metadata.renderer { version, impl, status: pending|approved, scope, approvedBy, ... }
 */
import * as gs from './graph-service.js'
import { mayManageWorld, worldsFoundedBy, worldStoresFor } from './graph-store.js'
import { NODE_TYPES } from './node-types.js'
import {
  REGISTRY_GRAPH_ID, REGISTRY_NODE_TYPE, TYPE_NAME, WORLD_TYPES_TAG, normalizeWorld, registeredNodeTypes,
  worldRegistryGraph, invalidateNodeTypeCache,
} from './node-type-registry.js'

const ERR = gs.ERR
const fail = (code, message, extra = {}) => ({ ok: false, code, status: gs.statusForCode(code), message, ...extra })

/** The field kinds a type may declare (decided 2026-10-18, V3 A). */
export const FIELD_KINDS = Object.freeze(['text', 'longtext', 'number', 'date', 'link', 'image'])
const FIELD_KEY = /^[a-z][a-zA-Z0-9_]{0,39}$/
const MAX_FIELDS = 20
const MAX_IMPL = 200_000

/** "Kursmodul – del 1" → "kursmodul-del-1": the type name made from a title a founder typed. */
export function slugFromTitle(title) {
  const s = String(title || '')
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return s.length >= 2 ? s : ''
}

/** "Lærer navn" → "laererNavn": a field key made from its label when none is given. */
function keyFromLabel(label) {
  const parts = slugFromTitle(label).split('-').filter(Boolean)
  const k = parts.map((p, i) => (i ? p[0].toUpperCase() + p.slice(1) : p)).join('').slice(0, 40)
  return FIELD_KEY.test(k) ? k : ''
}

/** Validated, normalised fields, or a failure naming the first bad one. */
export function normalizeFields(fields) {
  if (fields == null) return { ok: true, fields: [] }
  if (!Array.isArray(fields)) return fail(ERR.INVALID_INPUT, 'fields must be a list of { label, kind }.')
  if (fields.length > MAX_FIELDS) return fail(ERR.INVALID_INPUT, `A type may have at most ${MAX_FIELDS} fields.`)
  const out = []
  const seen = new Set()
  for (const [i, f] of fields.entries()) {
    const label = String(f?.label || '').trim().slice(0, 60)
    if (!label) return fail(ERR.INVALID_INPUT, `fields[${i}] needs a label.`)
    const kind = String(f?.kind || 'text').trim().toLowerCase()
    if (!FIELD_KINDS.includes(kind)) return fail(ERR.INVALID_INPUT, `fields[${i}] ("${label}"): kind must be one of ${FIELD_KINDS.join(', ')}.`)
    const key = f?.key ? String(f.key).trim() : keyFromLabel(label)
    if (!FIELD_KEY.test(key)) return fail(ERR.INVALID_INPUT, `fields[${i}] ("${label}"): key must start with a letter and hold only letters, digits or _.`)
    if (seen.has(key)) return fail(ERR.INVALID_INPUT, `Two fields share the key "${key}".`)
    seen.add(key)
    out.push({ key, label, kind })
  }
  return { ok: true, fields: out }
}

/**
 * Which World an actor means. A named World is checked against mayManageWorld; with none, the Worlds
 * they founded or hold (V4 A) — exactly one is used, several must be named, none is refused.
 */
export async function resolveTypeWorld(env, actor, world) {
  if (!actor || actor.anonymous || !actor.email) return fail(ERR.UNAUTHENTICATED, 'Sign in to work with node types.')
  let domain = normalizeWorld(world)
  if (!domain) {
    const own = await worldsFoundedBy(env, actor.email)
    if (own.length === 1) domain = own[0]
    else if (own.length > 1) return fail(ERR.INVALID_INPUT, `You have several Worlds (${own.join(', ')}). Say which one.`, { worlds: own })
    else return fail(ERR.FORBIDDEN_GRAPH, 'You have no World with its own storage, so there is nowhere to keep your own node types.')
  }
  if (!(await mayManageWorld(env, actor, domain))) return fail(ERR.FORBIDDEN_GRAPH, `Node types in ${domain} are for that World's founder.`)
  return { ok: true, world: domain }
}

/** The World's registry, read fresh (writes merge into it): { graphId|null, nodes, version }. */
async function registryOf(env, domain) {
  const reg = await worldRegistryGraph(env, domain)
  if (!reg) return fail(ERR.INVALID_INPUT, `${domain} has no graph store, so it cannot hold its own node types.`)
  return { ok: true, graphId: reg.graphId, nodes: reg.graph?.nodes || [], version: reg.version }
}

export const typeEntryIn = (nodes, type) =>
  nodes.find((n) => n?.type === REGISTRY_NODE_TYPE && String(n.label || '').trim() === String(type).trim())

/** What a founder sees of one type — including the draft's code, which only they may read. */
function describe(node, world) {
  const m = node.metadata || {}
  const r = m.renderer || null
  return {
    type: String(node.label).trim(),
    title: m.title || String(node.label).trim(),
    description: node.info || '',
    fields: Array.isArray(m.fields) ? m.fields : [],
    world,
    look: r ? { version: r.version ?? 1, status: r.status || 'pending', impl: typeof r.impl === 'string' ? r.impl : null, approvedBy: r.approvedBy || null, approvedAt: r.approvedAt || null } : null,
  }
}

async function platformNames(env) {
  return new Set([...NODE_TYPES, ...(await registeredNodeTypes(env))])
}

/**
 * Create a World type. The name comes from `type`, else from the title; a name already used in
 * this World gets -2, -3 … when it came from a title, and is reported when it was asked for.
 * A platform name is never taken (no shadowing, D2 A). The registry graph is created on first use.
 */
export async function createWorldType(env, actor, { world, type, title, description, consumer, fields }) {
  const where = await resolveTypeWorld(env, actor, world)
  if (!where.ok) return where
  const domain = where.world
  const shownTitle = String(title || '').trim().slice(0, 80)
  const asked = type ? String(type).trim() : ''
  if (!asked && !shownTitle) return fail(ERR.INVALID_INPUT, 'Give the type a title (or a type name).')
  if (asked && !TYPE_NAME.test(asked)) return fail(ERR.INVALID_INPUT, `"${asked}" is not a valid type name: lowercase letters, digits, - or _, starting with a letter, 2–40 characters.`)
  const f = normalizeFields(fields)
  if (!f.ok) return f
  const desc = String(description || '').trim()
  if (desc.length < 10) return fail(ERR.INVALID_INPUT, 'Describe in a sentence what a node of this type holds.')

  const reg = await registryOf(env, domain)
  if (!reg.ok) return reg
  const taken = await platformNames(env)
  let name = asked || slugFromTitle(shownTitle)
  if (!name) return fail(ERR.INVALID_INPUT, `Could not make a type name from "${shownTitle}". Use letters in the title.`)
  if (taken.has(name)) {
    if (asked) return fail(ERR.INVALID_INPUT, `"${name}" is already a platform node type; a World cannot redefine it. Pick another name.`)
    name = `${name}-${domain.split('.')[0]}`.slice(0, 40)
  }
  const existing = reg.graphId ? typeEntryIn(reg.nodes, name) : null
  if (existing) {
    if (asked) return { ok: true, alreadyExisted: true, registryGraphId: reg.graphId, ...describe(existing, domain) }
    let n = 2
    while (typeEntryIn(reg.nodes, `${name}-${n}`) || taken.has(`${name}-${n}`)) n++
    name = `${name.slice(0, 37)}-${n}`
  }

  const node = {
    id: `nodetype-${name}`,
    label: name,
    type: REGISTRY_NODE_TYPE,
    info: desc,
    metadata: {
      title: shownTitle || name,
      fields: f.fields,
      consumer: String(consumer || 'vegvisr-node').trim(),
      scope: `world:${domain}`,
      renders: false,
      registeredAt: new Date().toISOString(),
    },
  }
  let registryGraphId = reg.graphId
  if (!registryGraphId) {
    const created = await gs.createGraph(env, {
      title: `Node types — ${domain}`,
      description: `The node types of ${domain}: system-nodetype nodes, each with its look in metadata.renderer and its fields in metadata.fields.`,
      metaArea: WORLD_TYPES_TAG,
      nodes: [node],
      actor,
      world: domain,
    })
    if (!created.ok) return created
    if (created.world !== domain) return fail(ERR.INTERNAL_ERROR, `The registry graph was stored in ${created.world || 'the platform'}, not ${domain}.`)
    registryGraphId = created.graphId
  } else {
    const added = await gs.addNode(env, { graphId: registryGraphId, node, actor })
    if (!added.ok) return added
  }
  invalidateNodeTypeCache(domain)
  return { ok: true, alreadyExisted: false, registryGraphId, ...describe(node, domain) }
}

/**
 * A new look (and optionally new fields or title) for a World type: saved as a DRAFT with the next
 * version. It is served nowhere until useWorldType — a changed look never inherits an approval.
 */
export async function setWorldTypeLook(env, actor, { world, type, impl, component, fields, title }) {
  const where = await resolveTypeWorld(env, actor, world)
  if (!where.ok) return where
  const domain = where.world
  if (!impl === !component) return fail(ERR.INVALID_INPUT, 'Pass exactly one of impl or component.')
  if (impl && String(impl).length > MAX_IMPL) return fail(ERR.INVALID_INPUT, `The look is larger than ${MAX_IMPL} characters.`)
  let newFields = null
  if (fields != null) {
    const f = normalizeFields(fields)
    if (!f.ok) return f
    newFields = f.fields
  }
  const reg = await registryOf(env, domain)
  if (!reg.ok) return reg
  const entry = reg.graphId ? typeEntryIn(reg.nodes, type) : null
  if (!entry) return fail(ERR.INVALID_INPUT, `"${type}" is not a node type of ${domain}. Create it first.`)
  const prev = entry.metadata?.renderer || {}
  const renderer = {
    version: (Number(prev.version) || 0) + 1,
    ...(impl ? { impl: String(impl) } : { component: String(component).trim() }),
    status: 'pending',
    scope: `world:${domain}`,
    updatedBy: actor.email || actor.userId,
    updatedAt: new Date().toISOString(),
  }
  const metadata = {
    ...(entry.metadata || {}),
    ...(newFields ? { fields: newFields } : {}),
    ...(title ? { title: String(title).trim().slice(0, 80) } : {}),
    renderer,
  }
  // gs.updateNode REPLACES metadata, so every other key is carried above.
  const result = await gs.updateNode(env, { graphId: reg.graphId, nodeId: entry.id, fields: { metadata }, expectedVersion: reg.version, actor })
  if (!result.ok) return result
  invalidateNodeTypeCache(domain)
  return { ok: true, ...describe({ ...entry, metadata }, domain) }
}

/**
 * Put one reviewed draft version to use (approve it). The version is required: if the look changed
 * after it was reviewed, the call is refused rather than approving code nobody saw.
 */
export async function useWorldType(env, actor, { world, type, version, verifyMethod, observed }) {
  const where = await resolveTypeWorld(env, actor, world)
  if (!where.ok) return where
  const domain = where.world
  const reg = await registryOf(env, domain)
  if (!reg.ok) return reg
  const entry = reg.graphId ? typeEntryIn(reg.nodes, type) : null
  const prev = entry?.metadata?.renderer
  if (!entry || !prev) return fail(ERR.INVALID_INPUT, `"${type}" has no look to put to use in ${domain}.`)
  if (Number(prev.version) !== Number(version)) {
    return fail(ERR.VERSION_CONFLICT, `The look of "${type}" is at version ${prev.version}, not ${version}. Look at the current one and use that.`, { currentVersion: prev.version })
  }
  const renderer = {
    ...prev,
    status: 'approved',
    approvedBy: actor.email || actor.userId,
    approvedAt: new Date().toISOString(),
    verify: { method: String(verifyMethod || 'Reviewed by the founder').slice(0, 300), ...(observed ? { observed: String(observed).slice(0, 1000) } : {}) },
  }
  const metadata = { ...(entry.metadata || {}), renderer }
  const result = await gs.updateNode(env, { graphId: reg.graphId, nodeId: entry.id, fields: { metadata }, expectedVersion: reg.version, actor })
  if (!result.ok) return result
  invalidateNodeTypeCache(domain)
  return { ok: true, ...describe({ ...entry, metadata }, domain) }
}

/** The World's own types as its founder sees them, drafts included. */
export async function listWorldTypes(env, actor, { world } = {}) {
  const where = await resolveTypeWorld(env, actor, world)
  if (!where.ok) return where
  const reg = await registryOf(env, where.world)
  if (!reg.ok) return reg
  const taken = await platformNames(env)
  const types = reg.nodes
    .filter((n) => n?.type === REGISTRY_NODE_TYPE && TYPE_NAME.test(String(n.label || '').trim()) && !taken.has(String(n.label).trim()))
    .map((n) => describe(n, where.world))
  return { ok: true, world: where.world, registryGraphId: reg.graphId, types }
}

// ─────────────────────────────────────────────────────────────────────────────
// One type for every World — promotion, and the guard that makes it the only way (2026-11-14)
// ─────────────────────────────────────────────────────────────────────────────
//
// What happened: sodesign.no had its own type "oppgave" with an approved renderer. A second World
// (NIBI) needed the same type, so "oppgave" was registered on the platform with register_node_type.
// The platform always wins a name (no shadowing, D2 A), and a freshly registered platform type has
// no title, no fields and no renderer — so from that request on, every "oppgave" node in sodesign.no
// was drawn without its look. Nothing warned: the tool answered "Registered".
//
// Two rules follow, and both live here so MCP and REST cannot disagree:
//   1. A platform type may not be registered under a name a World already uses (worldsHoldingType).
//   2. The way to share a World's type is promoteWorldType: its description, title, fields and
//      renderer are written to the platform registry in ONE write, so there is never a request
//      that sees the name without the look. The World's own node is left untouched — the platform
//      entry hides it, and it is the way back.

/**
 * Which Worlds already have a type named `name` in their own registry: { holding, unreachable }.
 * A store that does not answer is reported, not skipped — "nobody uses this name" must not be
 * concluded from a World that could not be asked.
 */
export async function worldsHoldingType(env, actor, name) {
  const holding = []
  const unreachable = []
  for (const store of await worldStoresFor(env, actor)) {
    try {
      const reg = await worldRegistryGraph(env, store.world)
      if (reg?.graphId && typeEntryIn(reg.graph?.nodes || [], name)) holding.push(store.world)
    } catch (e) {
      console.error(`[node-types] ${store.world} registry could not be read for "${name}":`, e.message)
      unreachable.push(store.world)
    }
  }
  return { holding, unreachable }
}

/**
 * The refusal for registering platform type `name` while a World uses that name, or null when the
 * name is free. `except` is the World being promoted from.
 */
export async function platformNameRefusal(env, actor, name, { except = null } = {}) {
  const { holding, unreachable } = await worldsHoldingType(env, actor, name)
  const others = holding.filter((w) => w !== except)
  if (others.length) {
    return fail(ERR.INVALID_INPUT,
      `"${name}" is already a node type of ${others.join(', ')}. A platform type of the same name would hide ` +
      `that World's type — its fields and its renderer — in every graph there. ` +
      (except
        ? `Only one World's "${name}" can become the platform's; settle which before promoting.`
        : `To make it one type for every World, use promote_node_type({ type: "${name}", world: "${others[0]}" }).`),
      { worlds: others })
  }
  if (unreachable.length) {
    return fail(ERR.INVALID_INPUT,
      `Could not check whether "${name}" is already a node type of ${unreachable.join(', ')}: the graph store did not answer. ` +
      'Nothing was registered. Try again when it is reachable.', { unreachable })
  }
  return null
}

/**
 * Lift a World's own type to the platform so every World can use it. Superadmin only.
 * One write to graph_system_registry carrying the World node's description, title, fields and
 * renderer; an approved renderer stays approved (the code is byte-identical, and the Superadmin
 * calling this is the platform's approver), a pending one stays pending. The World's node is not
 * changed. A leftover registry node with the type's id that is NOT a live type (for example one
 * neutralised by hand) is taken over rather than colliding.
 */
export async function promoteWorldType(env, actor, { world, type }) {
  if (!actor || actor.anonymous) return fail(ERR.UNAUTHENTICATED, 'Sign in to promote a node type.')
  if (!actor.isSuperadmin) return fail(ERR.FORBIDDEN_GRAPH, 'Promoting a node type to the platform is for the Superadmin only.')
  const domain = normalizeWorld(world)
  if (!domain) return fail(ERR.INVALID_INPUT, 'Say which World the type is promoted from, e.g. world: "sodesign.no".')
  const name = String(type || '').trim()
  if (!TYPE_NAME.test(name)) return fail(ERR.INVALID_INPUT, `"${name}" is not a valid type name.`)

  const reg = await registryOf(env, domain)
  if (!reg.ok) return reg
  const source = reg.graphId ? typeEntryIn(reg.nodes, name) : null
  if (!source) return fail(ERR.INVALID_INPUT, `"${name}" is not a node type of ${domain}, so there is nothing to promote.`)

  invalidateNodeTypeCache() // the checks below must see the registries as they are now
  if ((await platformNames(env)).has(name)) {
    return fail(ERR.INVALID_INPUT, `"${name}" is already a platform node type. Nothing was changed.`)
  }
  const refusal = await platformNameRefusal(env, actor, name, { except: domain })
  if (refusal) return refusal

  const now = new Date().toISOString()
  const who = actor.email || actor.userId
  const m = source.metadata || {}
  const from = m.renderer && (m.renderer.impl || m.renderer.component) ? m.renderer : null
  const approved = from?.status === 'approved'
  const renderer = from
    ? {
        version: Number(from.version) || 1,
        ...(typeof from.impl === 'string' && from.impl.trim() ? { impl: from.impl } : { component: String(from.component).trim() }),
        status: approved ? 'approved' : 'pending',
        scope: 'platform',
        updatedBy: who,
        updatedAt: now,
        ...(approved
          ? {
              approvedBy: who,
              approvedAt: now,
              verify: {
                method: `Promoted unchanged from ${domain} (renderer v${Number(from.version) || 1})`,
                observed: `Approved in ${domain} by ${from.approvedBy || 'its founder'}${from.approvedAt ? ` at ${from.approvedAt}` : ''}` +
                  (from.verify?.method ? `; checked there by: ${String(from.verify.method).slice(0, 300)}` : ''),
              },
            }
          : {}),
      }
    : null
  const node = {
    id: `nodetype-${name}`,
    label: name,
    type: REGISTRY_NODE_TYPE,
    info: String(source.info || '').trim(),
    metadata: {
      title: m.title || name,
      fields: Array.isArray(m.fields) ? m.fields : [],
      consumer: String(m.consumer || 'vegvisr-node').trim(),
      renders: false,
      registeredAt: now,
      promotedFrom: { world: domain, at: now, by: who, rendererVersion: from ? Number(from.version) || 1 : null },
      ...(renderer ? { renderer } : {}),
    },
  }

  const platform = await gs.getGraph(env, REGISTRY_GRAPH_ID)
  if (!platform.ok) return platform
  const leftover = (platform.graph?.nodes || []).find((n) => n?.id === node.id)
  const { id: _id, ...fields } = node
  const written = leftover
    ? await gs.updateNode(env, { graphId: REGISTRY_GRAPH_ID, nodeId: node.id, fields, expectedVersion: platform.version, actor })
    : await gs.addNode(env, { graphId: REGISTRY_GRAPH_ID, node, actor })
  if (!written.ok) return written
  invalidateNodeTypeCache()
  return {
    ok: true,
    type: name,
    world: domain,
    registryNodeId: node.id,
    replacedLeftover: Boolean(leftover),
    title: node.metadata.title,
    description: node.info,
    fields: node.metadata.fields,
    renderer: renderer ? { version: renderer.version, status: renderer.status } : null,
  }
}
