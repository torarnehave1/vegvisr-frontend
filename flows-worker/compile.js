/**
 * VEGR Flows — compiler and dry-run stepper (2026-11-06, phase 0/1 skeleton).
 *
 * compileFlow(graph, aliases) turns a #FLOWS graph (one `flow` node + `flow-step` nodes + edges)
 * into a pinned spec, or a list of errors. Everything a run relies on is checked here, once,
 * before anything runs — so the runner can stay simple and a bad flow never half-runs.
 *
 * dryRunStep(spec, stepId, state) says what one step WOULD do and which edge it would take.
 * Pure: no network, no clock, no randomness, so it is tested under plain Node.
 *
 * Node shapes are the registered types `flow` / `flow-step` (see list_node_types) and the design
 * in the "VEGR Flows" graph (node "datamodel").
 */

export const STEP_KINDS = ['action', 'agent', 'approval', 'route', 'wait', 'loop', 'subflow', 'note']

/** Tools that reach other people. The compiler refuses a path to these without an approval. */
export const EXTERNAL_TOOLS = new Set([
  'send_email', 'send_sms', 'send_sms_to_user', 'post_to_instagram', 'send_group_alert',
  'send_meeting_report', 'post_chat_message', 'send_group_message',
])

export const DEFAULT_LIMITS = { maxSteps: 80, maxCostUsd: 0.25, maxExternalSends: 5, dailyCostUsd: 1.0, concurrency: 1 }

const TEMPLATE = /\{\{\s*([a-zA-Z0-9_-]+)((?:\.[a-zA-Z0-9_-]+)*)\s*\}\}/g

/** Every {{stepId.result.x}} / {{inputs.x}} reference in a value, as [root, path]. */
export function templateRefs(value) {
  const refs = []
  const walk = (v) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(TEMPLATE)) refs.push([m[1], m[2].replace(/^\./, '')])
    } else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(value)
  return refs
}

function resolveModel(name, aliasMap) {
  if (!name || typeof name !== 'string') return null
  const a = aliasMap.get(name)
  if (!a) return { model: name, via: 'explicit' }
  return { model: a.model, via: `alias:${name}`, fallbackAlias: a.fallbackAlias || null }
}

export function compileFlow(graph, aliases = []) {
  const errors = []
  const warnings = []
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : []
  const edges = Array.isArray(graph?.edges) ? graph.edges : []
  const aliasMap = new Map(
    (aliases || []).filter((a) => a && a.alias && a.model).map((a) => [String(a.alias), a]),
  )

  // ── header ──
  const headers = nodes.filter((n) => n.type === 'flow')
  if (headers.length !== 1) {
    errors.push(`A flow graph needs exactly one node of type "flow" (found ${headers.length}).`)
    return { ok: false, errors, warnings }
  }
  const header = headers[0]
  const hm = header.metadata || {}
  if (hm.kind && hm.kind !== 'vegr-flow') errors.push(`The flow node's metadata.kind is "${hm.kind}", expected "vegr-flow".`)
  if (!hm.kind) warnings.push('The flow node has no metadata.kind; "vegr-flow" is assumed.')
  const status = hm.status || 'test'
  if (!['test', 'active', 'paused'].includes(status)) errors.push(`Unknown flow status "${status}" (test | active | paused).`)
  const triggers = Array.isArray(hm.triggers) && hm.triggers.length ? hm.triggers : [{ id: 't_manual', type: 'manual' }]
  const limits = { ...DEFAULT_LIMITS, ...(hm.limits || {}) }

  // ── steps ──
  const stepNodes = nodes.filter((n) => n.type === 'flow-step')
  if (!stepNodes.length) errors.push('A flow needs at least one node of type "flow-step".')
  const steps = {}
  for (const n of stepNodes) {
    const m = n.metadata || {}
    const kind = m.kind
    if (!STEP_KINDS.includes(kind)) {
      errors.push(`Step "${n.label || n.id}" (${n.id}): metadata.kind "${kind ?? ''}" is not one of ${STEP_KINDS.join(', ')}.`)
      continue
    }
    const step = { id: String(n.id), label: n.label || String(n.id), kind, ...m }
    if (kind === 'action') {
      if (!m.toolName || typeof m.toolName !== 'string') errors.push(`Action step "${step.label}": metadata.toolName is required.`)
      step.params = m.params && typeof m.params === 'object' ? m.params : {}
      step.external = EXTERNAL_TOOLS.has(m.toolName)
    }
    if (kind === 'agent') {
      if (!m.instructions) errors.push(`Agent step "${step.label}": metadata.instructions is required.`)
      const r = resolveModel(m.model || 'auto', aliasMap)
      step.resolvedModel = r
      if (m.fallbackModel) step.resolvedFallback = resolveModel(m.fallbackModel, aliasMap)
      else if (r?.fallbackAlias) step.resolvedFallback = resolveModel(r.fallbackAlias, aliasMap)
      if (!aliasMap.has(m.model || 'auto') && !/^(claude|gpt|o\d|gemini|grok)/i.test(m.model || '')) {
        errors.push(`Agent step "${step.label}": model "${m.model || 'auto'}" is neither a model alias (${[...aliasMap.keys()].join(', ') || 'none loaded'}) nor a model id.`)
      }
      step.tools = Array.isArray(m.tools) ? m.tools : []
      const ext = step.tools.filter((t) => EXTERNAL_TOOLS.has(t))
      if (ext.length) errors.push(`Agent step "${step.label}": agents may not hold tools that reach other people (${ext.join(', ')}). Use an action step after an approval.`)
    }
    if (kind === 'loop' && !(Number(m.maxItems) > 0 && Number(m.maxItems) <= 1000)) {
      errors.push(`Loop step "${step.label}": metadata.maxItems (1–1000) is required.`)
    }
    if (kind === 'wait' && !m.duration) errors.push(`Wait step "${step.label}": metadata.duration is required (e.g. "10 minutes").`)
    if (kind === 'subflow') errors.push(`Step "${step.label}": subflows come in phase 4 and cannot run yet.`)
    steps[step.id] = step
  }

  // ── edges ──
  const out = {}
  let entryFromHeader = null
  for (const e of edges) {
    const src = String(e.source)
    const tgt = String(e.target)
    const label = (e.label && String(e.label).trim()) || 'next'
    if (src === String(header.id)) {
      if (steps[tgt]) {
        if (entryFromHeader && entryFromHeader !== tgt) errors.push('The flow node points to more than one step; it may point to only the first.')
        entryFromHeader = tgt
      }
      continue
    }
    if (!steps[src] || !steps[tgt]) continue // edges to notes, docs etc. are not routing
    out[src] = out[src] || []
    if (out[src].some((x) => x.label === label)) errors.push(`Step "${steps[src].label}" has two edges labelled "${label}".`)
    out[src].push({ label, target: tgt })
  }

  let entry = entryFromHeader || (hm.entry && steps[hm.entry] ? String(hm.entry) : null)
  if (!entry) {
    const incoming = new Set(Object.values(out).flat().map((x) => x.target))
    const roots = Object.keys(steps).filter((id) => !incoming.has(id))
    if (roots.length === 1) entry = roots[0]
    else if (Object.keys(steps).length) {
      errors.push(roots.length
        ? `Cannot tell which step comes first: ${roots.map((id) => steps[id].label).join(', ')} have no step before them. Add an edge from the flow node to the first step.`
        : 'Every step has a step before it, so there is no first step. Add an edge from the flow node to the first step.')
    }
  }

  for (const s of Object.values(steps)) {
    const labels = (out[s.id] || []).map((x) => x.label)
    if (s.kind === 'approval' && labels.length && !labels.includes('approved')) {
      errors.push(`Approval step "${s.label}" needs an edge labelled "approved".`)
    }
    if (s.kind === 'route' && labels.length < 1) errors.push(`Route step "${s.label}" has no outgoing edges.`)
  }

  // ── template references point at real steps ──
  for (const s of Object.values(steps)) {
    for (const [root] of templateRefs({ params: s.params, input: s.input, instructions: s.instructions, payload: s.payload })) {
      if (root !== 'inputs' && root !== 'trigger' && !steps[root]) {
        errors.push(`Step "${s.label}" refers to {{${root}…}}, but there is no step with id "${root}".`)
      }
    }
  }

  if (entry && !errors.length) {
    // ── reachability, cycles, and the safety rule ──
    // Safety: an action that reaches other people must not be reachable from the start without
    // passing an approval. Walk from the entry without expanding approval steps; anything
    // external reached that way is unguarded.
    const unguarded = new Set()
    const stack = [entry]
    while (stack.length) {
      const id = stack.pop()
      if (unguarded.has(id)) continue
      unguarded.add(id)
      if (steps[id].kind === 'approval') continue
      for (const x of out[id] || []) stack.push(x.target)
    }
    for (const id of unguarded) {
      if (steps[id].external) {
        errors.push(`Action "${steps[id].label}" calls ${steps[id].toolName}, which reaches other people, and can be reached without an approval step. Put an approval step before it.`)
      }
    }

    // Cycles are allowed only through a loop step (it carries maxItems).
    const colour = {}
    const visit = (id, path) => {
      colour[id] = 1
      for (const x of out[id] || []) {
        if (colour[x.target] === 1) {
          const cyc = [...path.slice(path.indexOf(x.target)), x.target]
          if (!cyc.some((c) => steps[c].kind === 'loop')) {
            errors.push(`The steps ${cyc.map((c) => steps[c].label).join(' → ')} form a cycle with no loop step; it could run forever.`)
          }
        } else if (!colour[x.target]) visit(x.target, [...path, x.target])
      }
      colour[id] = 2
    }
    visit(entry, [entry])

    const reachable = new Set()
    const st = [entry]
    while (st.length) {
      const id = st.pop()
      if (reachable.has(id)) continue
      reachable.add(id)
      for (const x of out[id] || []) st.push(x.target)
    }
    for (const id of Object.keys(steps)) {
      if (!reachable.has(id)) warnings.push(`Step "${steps[id].label}" can never be reached from the first step.`)
    }
  }

  if (errors.length) return { ok: false, errors, warnings }
  return {
    ok: true,
    warnings,
    spec: {
      schema: 1,
      flowId: String(graph.id || ''),
      version: graph.version ?? null,
      name: header.label || graph.title || 'Flow',
      status,
      triggers,
      limits,
      inputs: hm.inputs || {},
      entry,
      steps,
      edges: out,
    },
  }
}

function render(value, state) {
  if (typeof value === 'string') {
    return value.replace(TEMPLATE, (_m, root, path) => {
      const keys = path.replace(/^\./, '').split('.').filter(Boolean)
      let v = root === 'inputs' ? state.inputs : root === 'trigger' ? state.trigger : state.results[root]
      for (const k of keys) v = v == null ? undefined : v[k]
      return v === undefined ? `{{${root}${path}}}` : (typeof v === 'string' ? v : JSON.stringify(v))
    })
  }
  if (Array.isArray(value)) return value.map((v) => render(v, state))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, render(v, state)]))
  return value
}

/**
 * What one step would do in a dry run, and the edge it would take. Nothing is called.
 * state = { inputs, trigger, results } — results[stepId] holds each earlier step's (placeholder)
 * result, so templates render as far as a dry run can know them.
 */
export function dryRunStep(spec, stepId, state) {
  const s = spec.steps[stepId]
  const edges = spec.edges[stepId] || []
  const pick = (...labels) => {
    for (const l of labels) {
      const e = edges.find((x) => x.label === l)
      if (e) return e
    }
    return edges[0] || null
  }
  let summary
  let detail
  let edge
  let result = { dryRun: true }

  switch (s.kind) {
    case 'action':
      detail = { toolName: s.toolName, params: render(s.params, state), external: !!s.external }
      summary = `would call ${s.toolName}${s.external ? ' (reaches other people — only after approval)' : ''}`
      edge = pick('next')
      break
    case 'agent':
      detail = {
        model: s.resolvedModel?.model, via: s.resolvedModel?.via, fallback: s.resolvedFallback?.model || null,
        tools: s.tools, input: render(s.input || {}, state), outputSchema: s.outputSchema || null,
      }
      summary = `would ask ${s.resolvedModel?.model} (${s.resolvedModel?.via})${s.tools.length ? ` with tools ${s.tools.join(', ')}` : ' with no tools'}`
      if (s.outputSchema?.route && Array.isArray(s.outputSchema.route)) result.route = s.outputSchema.route[0]
      edge = result.route ? pick(result.route, 'next') : pick('next')
      break
    case 'approval':
      detail = { approver: s.approver || 'owner', timeout: s.timeout || '24h', payload: render(s.payload || null, state) }
      summary = `would wait for ${detail.approver}'s approval (dry run continues as approved)`
      edge = pick('approved')
      break
    case 'route':
      detail = { conditions: s.conditions || null }
      summary = 'would choose a route (dry run takes the default)'
      edge = pick('next', 'default')
      break
    case 'wait':
      detail = { duration: s.duration }
      summary = `would wait ${s.duration} (not in a dry run)`
      edge = pick('next')
      break
    case 'loop':
      detail = { items: render(s.items ?? null, state), maxItems: s.maxItems }
      summary = `would repeat for up to ${s.maxItems} items (dry run passes through once)`
      edge = pick('next', 'done')
      break
    case 'note':
    default:
      detail = null
      summary = 'note — nothing to run'
      edge = pick('next')
      break
  }
  return { record: { nodeId: s.id, label: s.label, kind: s.kind, status: 'ok', summary, detail, edge: edge?.label || null }, result, nextId: edge?.target || null }
}

/** The whole dry run at once — what the runner does step by step. Used by tests and previews. */
export function dryRun(spec, { inputs = {}, trigger = { type: 'manual' } } = {}) {
  const state = { inputs, trigger, results: {} }
  const records = []
  let id = spec.entry
  while (id && records.length < spec.limits.maxSteps) {
    const { record, result, nextId } = dryRunStep(spec, id, state)
    state.results[id] = { result }
    records.push(record)
    id = nextId
  }
  return { records, stoppedByLimit: Boolean(id) }
}

/**
 * One step of a LIVE run (2026-11-06). Read-only action steps really run: callTool(toolName,
 * args) asks the MCP server to run that tool as the flow's owner, and refuses anything that
 * writes or sends. Everything else is not live yet and says so:
 *   - agent, route, wait, loop, note: simulated exactly as in a dry run;
 *   - approval: there is no way to approve yet (phase 3), so it is treated as REJECTED and the
 *     run follows the "rejected" edge — nothing after an approval can run;
 *   - an action that reaches other people is refused outright (the compiler already put an
 *     approval before it, so a live run normally never gets here).
 * A failed tool follows the step's "error" edge when it has one; otherwise the run stops there.
 */
export async function liveStep(spec, stepId, state, callTool) {
  const s = spec.steps[stepId]
  const edges = spec.edges[stepId] || []
  const byLabel = (l) => edges.find((x) => x.label === l) || null

  if (s.kind === 'action') {
    const args = render(s.params || {}, state)
    if (s.external) {
      return {
        record: { nodeId: s.id, label: s.label, kind: s.kind, status: 'refused', summary: `refused: ${s.toolName} reaches other people and cannot run live yet`, detail: { toolName: s.toolName }, edge: null },
        result: null, nextId: null, stop: `Step "${s.label}" would send with ${s.toolName}; sending is not possible in live runs yet.`,
      }
    }
    const r = await callTool(s.toolName, args)
    if (!r.ok || r.isError) {
      const why = r.error || r.text || 'the tool reported an error'
      const err = byLabel('error')
      return {
        record: { nodeId: s.id, label: s.label, kind: s.kind, status: 'error', summary: `${s.toolName} failed: ${String(why).slice(0, 300)}`, detail: { toolName: s.toolName, args }, edge: err ? 'error' : null },
        result: { error: why }, nextId: err?.target || null, stop: err ? null : `Step "${s.label}" failed: ${String(why).slice(0, 300)}`,
      }
    }
    const result = r.structured ?? { text: r.text }
    const next = byLabel('next') || edges[0] || null
    const size = JSON.stringify(result).length
    return {
      record: { nodeId: s.id, label: s.label, kind: s.kind, status: 'ok', summary: `ran ${s.toolName} (${size} chars of result)`, detail: { toolName: s.toolName, args, result: size > 8000 ? `${JSON.stringify(result).slice(0, 8000)}…` : result }, edge: next?.label || null },
      result, nextId: next?.target || null, stop: null,
    }
  }

  if (s.kind === 'approval') {
    const rej = byLabel('rejected')
    return {
      record: { nodeId: s.id, label: s.label, kind: s.kind, status: 'skipped', summary: 'approvals are not possible yet — treated as rejected, nothing after it runs', detail: { approver: s.approver || 'owner' }, edge: rej ? 'rejected' : null },
      result: { approved: false }, nextId: rej?.target || null, stop: null,
    }
  }

  const sim = dryRunStep(spec, stepId, state)
  return { ...sim, record: { ...sim.record, status: 'simulated', summary: `simulated — ${sim.record.summary}` }, stop: null }
}
