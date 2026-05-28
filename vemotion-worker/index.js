const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
}

// ── KV key prefixes ───────────────────────────────────────────────────────────
const PROJECT_PREFIX = 'vemotion:project:'
const COMP_PREFIX = 'vemotion:comp:'
const COMP_VER_PREFIX = 'vemotion:compver:'
const RENDER_PREFIX = 'vemotion:render:'

// ── Response helpers ──────────────────────────────────────────────────────────
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...headers },
  })

const error = (message, status = 400, extra = {}) =>
  json({ error: message, ...extra }, status)

// ── KV key helpers ────────────────────────────────────────────────────────────
const getProjectKey = (id) => `${PROJECT_PREFIX}${id}`
const getCompKey = (id) => `${COMP_PREFIX}${id}`
const getCompVersionPrefix = (id) => `${COMP_VER_PREFIX}${id}:`
const getCompVersionKey = (id, version) => `${COMP_VER_PREFIX}${id}:${version}`
const getRenderKey = (id) => `${RENDER_PREFIX}${id}`

// ── Normalizers ───────────────────────────────────────────────────────────────
const normalizeTags = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((e) => (typeof e === 'string' ? e.trim() : '')).filter(Boolean)
}

const normalizeAssets = (value) => {
  if (!Array.isArray(value)) return []
  return value
    .map((asset, index) => {
      if (typeof asset === 'string') return { id: `asset-${index + 1}`, src: asset, type: 'image' }
      if (!asset || typeof asset !== 'object') return null
      const src = typeof asset.src === 'string' ? asset.src.trim() : ''
      if (!src) return null
      return {
        id: typeof asset.id === 'string' && asset.id.trim() ? asset.id.trim() : `asset-${index + 1}`,
        src,
        type: typeof asset.type === 'string' && asset.type.trim() ? asset.type.trim() : 'image',
        label: typeof asset.label === 'string' ? asset.label.trim() : null,
        role: typeof asset.role === 'string' ? asset.role.trim() : null,
        tags: normalizeTags(asset.tags),
      }
    })
    .filter(Boolean)
}

const normalizeObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function validateAuth(request, env) {
  const apiToken = request.headers.get('X-API-Token')
  if (!apiToken) return { valid: false, error: 'Missing X-API-Token header' }

  try {
    const row = await env.vegvisr_org
      .prepare('SELECT user_id, Role, email, cf_account_id, cf_r2_bucket, data FROM config WHERE emailVerificationToken = ?')
      .bind(apiToken)
      .first()

    if (!row) return { valid: false, error: 'Invalid authentication token' }

    let extraData = {}
    try { extraData = row.data ? JSON.parse(row.data) : {} } catch { extraData = {} }

    return {
      valid: true,
      authToken: apiToken,
      userId: row.user_id,
      email: row.email || null,
      role: row.Role || null,
      cfAccountId: row.cf_account_id || null,
      cfR2Bucket: row.cf_r2_bucket || null,
      data: extraData,
    }
  } catch (err) {
    console.error('Auth error', err)
    return { valid: false, error: 'Authentication error' }
  }
}

// ── Project helpers ───────────────────────────────────────────────────────────
async function readProject(env, projectId) {
  const raw = await env.VEMOTION_PROJECTS.get(getProjectKey(projectId))
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function assertOwner(record, auth) {
  if (!record) throw Object.assign(new Error('Not found'), { status: 404 })
  const owner = record.userId || record.userEmail
  const caller = auth?.userId || auth?.email
  if (!caller || (owner !== caller && record.userEmail !== auth?.email)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 })
  }
}

function projectSummary(p) {
  return {
    projectId: p.projectId,
    title: p.title,
    description: p.description || '',
    compositionId: p.compositionId || p.templateId || 'VEmotionIntro',
    templateId: p.templateId || 'custom',
    status: p.status || 'draft',
    version: p.version || 1,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    assetCount: Array.isArray(p.assets) ? p.assets.length : 0,
  }
}

function buildProjectRecord(input, auth, env, existing = null) {
  const now = new Date().toISOString()
  const projectId =
    existing?.projectId ||
    (typeof input.projectId === 'string' && input.projectId.trim() ? input.projectId.trim() : crypto.randomUUID())

  const compositionId =
    (typeof input.compositionId === 'string' && input.compositionId.trim() ? input.compositionId.trim() : null) ||
    (typeof input.templateId === 'string' && input.templateId.trim() ? input.templateId.trim() : null) ||
    existing?.compositionId || existing?.templateId || 'VEmotionIntro'

  const accountId =
    auth?.data?.vemotion?.accountId || auth?.cfAccountId || env.CF_ACCOUNT_ID || env.VEMOTION_DEFAULT_ACCOUNT_ID || null
  const bucketName =
    auth?.data?.vemotion?.r2Bucket || auth?.cfR2Bucket || env.VEMOTION_ASSETS_BUCKET_NAME || null

  return {
    projectId,
    userId: auth.userId,
    userEmail: auth.email,
    compositionId,
    templateId: typeof input.templateId === 'string' && input.templateId.trim() ? input.templateId.trim() : (existing?.templateId || compositionId),
    title: typeof input.title === 'string' && input.title.trim() ? input.title.trim() : (existing?.title || 'Untitled VEmotion Project'),
    description: typeof input.description === 'string' ? input.description.trim() : (existing?.description || ''),
    status: typeof input.status === 'string' && input.status.trim() ? input.status.trim() : (existing?.status || 'draft'),
    assets: input.assets !== undefined ? normalizeAssets(input.assets) : (existing?.assets || []),
    props: input.props !== undefined ? normalizeObject(input.props) : (existing?.props || {}),
    scenes: input.scenes !== undefined ? (Array.isArray(input.scenes) ? input.scenes : []) : (existing?.scenes || []),
    notes: typeof input.notes === 'string' ? input.notes.trim() : (existing?.notes || ''),
    accountId,
    bucketName,
    storage: {
      mode: 'bootstrap-account',
      kvNamespace: env.VEMOTION_PROJECTS_NAMESPACE_ID || null,
      assetsPrefix: `users/${auth.userId}/projects/${projectId}/assets/`,
      rendersPrefix: `users/${auth.userId}/projects/${projectId}/renders/`,
    },
    render: existing?.render || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    version: existing ? Number(existing.version || 1) + 1 : 1,
  }
}

async function putProject(env, project) {
  await env.VEMOTION_PROJECTS.put(getProjectKey(project.projectId), JSON.stringify(project), {
    metadata: {
      userId: project.userId,
      userEmail: project.userEmail,
      title: project.title,
      status: project.status,
      compositionId: project.compositionId,
      updatedAt: project.updatedAt,
    },
  })
}

// ── Project route handlers ────────────────────────────────────────────────────
async function handleCreateProject(request, env, auth) {
  const input = await request.json()
  const project = buildProjectRecord(input, auth, env)
  await putProject(env, project)
  return json({ ok: true, message: 'VEmotion project created', project, summary: projectSummary(project) }, 201)
}

async function handleUpdateProject(request, env, auth) {
  const input = await request.json()
  const projectId = typeof input.projectId === 'string' ? input.projectId.trim() : ''
  if (!projectId) return error('projectId is required', 400)
  const existing = await readProject(env, projectId)
  if (!existing) return error('Project not found', 404)
  assertOwner(existing, auth)
  const project = buildProjectRecord(input, auth, env, existing)
  await putProject(env, project)
  return json({ ok: true, message: 'VEmotion project updated', project, summary: projectSummary(project) })
}

async function handleGetProject(url, env, auth) {
  const projectId = url.searchParams.get('id') || ''
  if (!projectId) return error('id is required', 400)
  const project = await readProject(env, projectId)
  if (!project) return error('Project not found', 404)
  assertOwner(project, auth)
  return json({ ok: true, project, summary: projectSummary(project) })
}

async function handleListProjects(url, env, auth) {
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 100)
  const cursor = url.searchParams.get('cursor') || undefined
  const list = await env.VEMOTION_PROJECTS.list({ prefix: PROJECT_PREFIX, limit, cursor })

  const projects = []
  for (const item of list.keys) {
    const record = await readProject(env, item.name.slice(PROJECT_PREFIX.length))
    if (!record || record.userId !== auth.userId) continue
    projects.push(projectSummary(record))
  }
  projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return json({ ok: true, projects, count: projects.length, cursor: list.cursor || null, truncated: Boolean(list.cursor) })
}

async function handleDeleteProject(url, env, auth) {
  const projectId = url.searchParams.get('id') || ''
  if (!projectId) return error('id is required', 400)
  const existing = await readProject(env, projectId)
  if (!existing) return error('Project not found', 404)
  assertOwner(existing, auth)
  await env.VEMOTION_PROJECTS.delete(getProjectKey(projectId))
  return json({ ok: true, message: 'Project deleted', projectId })
}

// ── Composition helpers ───────────────────────────────────────────────────────
async function readComp(env, compId) {
  const raw = await env.VEMOTION_PROJECTS.get(getCompKey(compId))
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

async function listCompVersions(env, compId, limit = 30) {
  const prefix = getCompVersionPrefix(compId)
  const list = await env.VEMOTION_PROJECTS.list({ prefix, limit: Math.max(limit, 1) * 4 })
  const versions = []
  for (const item of list.keys) {
    const raw = await env.VEMOTION_PROJECTS.get(item.name)
    if (!raw) continue
    try { versions.push(JSON.parse(raw)) } catch { continue }
  }
  versions.sort((a, b) => Number(b.version || 0) - Number(a.version || 0))
  return versions.slice(0, limit)
}

async function trimCompVersions(env, compId, keep = 30) {
  const prefix = getCompVersionPrefix(compId)
  const list = await env.VEMOTION_PROJECTS.list({ prefix, limit: 500 })
  const keys = list.keys
    .map((item) => {
      const version = Number(item.name.slice(prefix.length))
      return Number.isFinite(version) ? { name: item.name, version } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.version - a.version)

  const stale = keys.slice(keep)
  await Promise.all(stale.map((item) => env.VEMOTION_PROJECTS.delete(item.name)))
}

function compSummary(c) {
  return {
    id: c.id,
    name: c.name,
    duration: c.composition?.duration,
    fps: c.composition?.fps,
    width: c.composition?.width,
    height: c.composition?.height,
    layerCount: Array.isArray(c.composition?.layers) ? c.composition.layers.length : 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    version: c.version || 1,
    // Inline meta in the list summary so portfolio clients don't need to
    // N+1-fetch each composition just to read its tags/category/area.
    // Pass through whatever's stored under composition.meta (may be undefined).
    meta: c.composition?.meta && typeof c.composition.meta === 'object'
      ? c.composition.meta
      : undefined,
  }
}

// ── Refit algorithm ───────────────────────────────────────────────────────────
// Pure transform: scale every layer's geometry to fit a new canvas size.
// Mirrors the frontend's src/lib/refit.ts exactly. The frontend's
// docs/AGENT_BRIEF.md §12 is the canonical spec — if you tweak the math
// here, sync the frontend copy and the brief.
const REFIT_UNIFORM_SCALABLE_PROPS = [
  'fontSize',
  'strokeWidth',
  'titleFontSize',
  'bodyFontSize',
  'padding',
  'gap',
  'borderRadius',
]

function refitComposition(composition, targetWidth, targetHeight, mode) {
  const oldW = composition.width
  const oldH = composition.height
  if (oldW <= 0 || oldH <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return composition
  }

  let sx
  let sy
  let offsetX
  let offsetY

  if (mode === 'stretch') {
    sx = targetWidth / oldW
    sy = targetHeight / oldH
    offsetX = 0
    offsetY = 0
  } else {
    const ratioX = targetWidth / oldW
    const ratioY = targetHeight / oldH
    const s = mode === 'fit' ? Math.min(ratioX, ratioY) : Math.max(ratioX, ratioY)
    sx = s
    sy = s
    // Centre the scaled content. For 'fill' the offset goes negative on the
    // overflow axis, which intentionally clips.
    offsetX = (targetWidth - oldW * s) / 2
    offsetY = (targetHeight - oldH * s) / 2
  }

  const fontScale = Math.min(sx, sy)
  const layers = Array.isArray(composition.layers) ? composition.layers : []

  return {
    ...composition,
    width: targetWidth,
    height: targetHeight,
    layers: layers.map((layer) => refitLayer(layer, sx, sy, offsetX, offsetY, fontScale)),
  }
}

function refitLayer(layer, sx, sy, ox, oy, fontScale) {
  const nextProperties = { ...(layer.properties || {}) }
  for (const key of REFIT_UNIFORM_SCALABLE_PROPS) {
    const v = nextProperties[key]
    if (typeof v === 'number') {
      nextProperties[key] = v * fontScale
    }
  }

  const next = {
    ...layer,
    position: {
      x: (layer.position?.x ?? 0) * sx + ox,
      y: (layer.position?.y ?? 0) * sy + oy,
    },
    size: {
      width: (layer.size?.width ?? 0) * sx,
      height: (layer.size?.height ?? 0) * sy,
    },
    properties: nextProperties,
  }

  if (layer.animation) next.animation = refitAnimation(layer.animation, sx, sy)
  if (Array.isArray(layer.animations)) next.animations = layer.animations.map((a) => refitAnimation(a, sx, sy))

  return next
}

function refitAnimation(anim, sx, sy) {
  if (!anim || typeof anim !== 'object') return anim
  // mask-wipe drives a 0..1 progress, not pixels — untouched.
  if (anim.kind === 'mask-wipe') return anim
  // Only pixel-valued layer properties scale.
  if (anim.property !== 'offsetX' && anim.property !== 'offsetY') return anim
  const factor = anim.property === 'offsetX' ? sx : sy
  const keyframes = Array.isArray(anim.keyframes) ? anim.keyframes : []
  return {
    ...anim,
    keyframes: keyframes.map((k) => ({
      ...k,
      value: typeof k.value === 'number' ? k.value * factor : k.value,
    })),
  }
}

// ── Composition route handlers ────────────────────────────────────────────────
async function handleListCompositions(url, env, auth) {
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 200)
  const cursor = url.searchParams.get('cursor') || undefined
  const list = await env.VEMOTION_PROJECTS.list({ prefix: COMP_PREFIX, limit, cursor })

  const compositions = []
  for (const item of list.keys) {
    const record = await readComp(env, item.name.slice(COMP_PREFIX.length))
    if (!record || record.userId !== auth.userId) continue
    compositions.push(compSummary(record))
  }
  compositions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return json({ ok: true, compositions, count: compositions.length, cursor: list.cursor || null, truncated: Boolean(list.cursor) })
}

async function handleGetComposition(url, env, auth) {
  const id = url.searchParams.get('id') || ''
  if (!id) return error('id is required', 400)
  const record = await readComp(env, id)
  if (!record) return error('Composition not found', 404)
  assertOwner(record, auth)
  return json({ ok: true, ...record })
}

async function handleGetCompositionHistory(url, env, auth) {
  const id = url.searchParams.get('id') || ''
  if (!id) return error('id is required', 400)
  const record = await readComp(env, id)
  if (!record) return error('Composition not found', 404)
  assertOwner(record, auth)
  const history = await listCompVersions(env, id, 30)
  return json({
    ok: true,
    id,
    history: history.map((entry) => ({
      id: entry.id,
      name: entry.name,
      version: entry.version || 1,
      updatedAt: entry.updatedAt,
      createdAt: entry.createdAt,
      duration: entry.composition?.duration,
      fps: entry.composition?.fps,
      width: entry.composition?.width,
      height: entry.composition?.height,
      layerCount: Array.isArray(entry.composition?.layers) ? entry.composition.layers.length : 0,
    })),
  })
}

async function handleSaveComposition(request, env, auth) {
  const input = await request.json()
  const { name, composition } = input
  if (!name || !composition) return error('name and composition are required', 400)
  if (!composition.duration || !composition.fps || !composition.width || !composition.height) {
    return error('composition must include duration, fps, width, height', 400)
  }
  if (!Array.isArray(composition.layers)) return error('composition.layers must be an array', 400)

  const now = new Date().toISOString()
  const id = (typeof input.id === 'string' && input.id.trim()) ? input.id.trim() : `comp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const existing = await readComp(env, id)

  if (existing) assertOwner(existing, auth)

  const trimmedName = String(name).trim()
  const changed = !existing ||
    existing.name !== trimmedName ||
    JSON.stringify(existing.composition) !== JSON.stringify(composition)

  if (!changed) {
    return json({ ok: true, id, summary: compSummary(existing), version: existing.version || 1, unchanged: true })
  }

  const record = {
    id,
    userId: auth.userId,
    userEmail: auth.email,
    name: trimmedName,
    composition,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    version: existing ? Number(existing.version || 1) + 1 : 1,
  }

  await env.VEMOTION_PROJECTS.put(getCompKey(id), JSON.stringify(record), {
    metadata: { userId: record.userId, name: record.name, updatedAt: record.updatedAt },
  })

  await env.VEMOTION_PROJECTS.put(getCompVersionKey(id, record.version), JSON.stringify(record), {
    metadata: { userId: record.userId, name: record.name, updatedAt: record.updatedAt, version: record.version },
  })

  await trimCompVersions(env, id, 30)

  return json({ ok: true, id, summary: compSummary(record), version: record.version }, existing ? 200 : 201)
}

async function handleDeleteComposition(url, env, auth) {
  const id = url.searchParams.get('id') || ''
  if (!id) return error('id is required', 400)
  const record = await readComp(env, id)
  if (!record) return error('Composition not found', 404)
  assertOwner(record, auth)
  await env.VEMOTION_PROJECTS.delete(getCompKey(id))
  return json({ ok: true, message: 'Composition deleted', id })
}

// Refit (reformat) a composition for a new canvas aspect.
// Two input shapes (exactly one of compositionId / composition required):
//   compositionId — load + owner-check + refit a saved composition.
//   composition   — refit an inline body without touching storage.
// Two output shapes:
//   name omitted  → 200 with { ok, composition } (pure transform, no write).
//   name provided → 201 with { ok, id, summary, version } (saved as NEW row;
//                    the source row, if any, is never modified).
async function handleRefitComposition(request, env, auth) {
  const input = await request.json()
  const { compositionId, composition: inlineComp, targetWidth, targetHeight, mode, name } = input

  if (compositionId && inlineComp) {
    return error('Provide exactly one of compositionId or composition, not both', 400)
  }
  if (!compositionId && !inlineComp) {
    return error('Provide exactly one of compositionId or composition', 400)
  }
  if (!Number.isFinite(Number(targetWidth)) || Number(targetWidth) <= 0) {
    return error('targetWidth must be a positive number', 400)
  }
  if (!Number.isFinite(Number(targetHeight)) || Number(targetHeight) <= 0) {
    return error('targetHeight must be a positive number', 400)
  }
  if (mode !== 'fit' && mode !== 'fill' && mode !== 'stretch') {
    return error('mode must be "fit", "fill", or "stretch"', 400)
  }

  let composition
  if (compositionId) {
    const record = await readComp(env, compositionId)
    if (!record) return error('Composition not found', 404)
    assertOwner(record, auth)
    composition = record.composition
  } else {
    if (!inlineComp || typeof inlineComp !== 'object') {
      return error('composition must be an object', 400)
    }
    if (!inlineComp.width || !inlineComp.height) {
      return error('composition must include width and height', 400)
    }
    if (!Array.isArray(inlineComp.layers)) {
      return error('composition.layers must be an array', 400)
    }
    composition = inlineComp
  }

  const refitted = refitComposition(composition, Number(targetWidth), Number(targetHeight), mode)

  // No name → pure transformation, no DB write.
  if (typeof name !== 'string' || !name.trim()) {
    return json({ ok: true, composition: refitted })
  }

  // Save as a NEW composition (always a fresh id; the source is not touched).
  const now = new Date().toISOString()
  const id = `comp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const trimmedName = name.trim()

  const record = {
    id,
    userId: auth.userId,
    userEmail: auth.email,
    name: trimmedName,
    composition: refitted,
    createdAt: now,
    updatedAt: now,
    version: 1,
  }

  await env.VEMOTION_PROJECTS.put(getCompKey(id), JSON.stringify(record), {
    metadata: { userId: record.userId, name: record.name, updatedAt: record.updatedAt },
  })
  await env.VEMOTION_PROJECTS.put(getCompVersionKey(id, record.version), JSON.stringify(record), {
    metadata: { userId: record.userId, name: record.name, updatedAt: record.updatedAt, version: record.version },
  })

  return json({ ok: true, id, summary: compSummary(record), version: record.version }, 201)
}

// ── Render route handlers ─────────────────────────────────────────────────────
async function handleQueueRender(request, env, auth) {
  const input = await request.json()

  // Accept either an inline composition or a reference to a saved one
  let composition = input.composition || null
  let compName = input.name || 'Render'

  if (!composition && input.compositionId) {
    const saved = await readComp(env, input.compositionId)
    if (!saved) return error('Composition not found', 404)
    assertOwner(saved, auth)
    composition = saved.composition
    compName = saved.name
  }

  if (!composition) return error('Provide composition or compositionId', 400)

  const jobId = `render_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()

  const job = {
    jobId,
    userId: auth.userId,
    userEmail: auth.email,
    status: 'queued',
    name: compName,
    composition,
    createdAt: now,
    updatedAt: now,
    outputUrl: null,
    error: null,
    progress: 0,
  }

  await env.VEMOTION_PROJECTS.put(getRenderKey(jobId), JSON.stringify(job), {
    expirationTtl: 86400, // 24 h TTL on render jobs
    metadata: { userId: job.userId, status: job.status, createdAt: job.createdAt },
  })

  return json({
    ok: true,
    jobId,
    status: 'queued',
    message: 'Render job queued. Poll GET /vemotion/render?id=<jobId> for status.',
  }, 202)
}

async function handleGetRender(url, env, auth) {
  const jobId = url.searchParams.get('id') || ''
  if (!jobId) return error('id is required', 400)

  const raw = await env.VEMOTION_PROJECTS.get(getRenderKey(jobId))
  if (!raw) return error('Render job not found', 404)

  let job
  try { job = JSON.parse(raw) } catch { return error('Corrupt job record', 500) }

  assertOwner(job, auth)

  return json({
    ok: true,
    jobId: job.jobId,
    status: job.status,
    name: job.name,
    progress: job.progress,
    outputUrl: job.outputUrl,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  })
}

async function handleListRenders(url, env, auth) {
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 100)
  const cursor = url.searchParams.get('cursor') || undefined
  const list = await env.VEMOTION_PROJECTS.list({ prefix: RENDER_PREFIX, limit, cursor })

  const jobs = []
  for (const item of list.keys) {
    const raw = await env.VEMOTION_PROJECTS.get(item.name)
    if (!raw) continue
    try {
      const job = JSON.parse(raw)
      if (job.userId !== auth.userId) continue
      jobs.push({ jobId: job.jobId, status: job.status, name: job.name, progress: job.progress, outputUrl: job.outputUrl, createdAt: job.createdAt, updatedAt: job.updatedAt })
    } catch { continue }
  }
  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return json({ ok: true, jobs, count: jobs.length, cursor: list.cursor || null, truncated: Boolean(list.cursor) })
}

// ── OpenAPI spec ──────────────────────────────────────────────────────────────
function buildOpenApiSpec(baseUrl) {
  const server = baseUrl ? [{ url: baseUrl }] : [{ url: 'https://api.vegvisr.org/vemotion' }]
  return {
    openapi: '3.1.0',
    info: {
      title: 'VEmotion Worker API',
      version: '1.0.0',
      description: 'CRUD API for VEmotion compositions, projects, and render jobs. All protected endpoints require X-API-Token.',
    },
    servers: server,
    components: {
      securitySchemes: {
        ApiToken: { type: 'apiKey', in: 'header', name: 'X-API-Token' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        Layer: {
          type: 'object',
          required: ['id', 'type', 'position', 'size', 'properties'],
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['text', 'shape', 'image', 'video', 'kg-shape', 'card'] },
            position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
            size: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } }, required: ['width', 'height'] },
            startTime: { type: 'number', description: 'Layer start time in seconds' },
            layerDuration: { type: 'number', description: 'Layer duration in seconds' },
            animation: {
              type: 'object',
              properties: {
                property: { type: 'string', enum: ['opacity', 'offsetX', 'offsetY'] },
                keyframes: {
                  type: 'array',
                  items: { type: 'object', properties: { time: { type: 'number' }, value: { type: 'number' } }, required: ['time', 'value'] },
                },
              },
            },
            properties: { type: 'object', additionalProperties: true, description: 'Layer-type-specific properties. For card layers see CardProperties schema.' },
          },
        },
        Composition: {
          type: 'object',
          required: ['duration', 'fps', 'width', 'height', 'layers'],
          properties: {
            duration: { type: 'number', description: 'Total duration in seconds' },
            fps: { type: 'number', description: 'Frames per second' },
            width: { type: 'number', description: 'Canvas width in pixels' },
            height: { type: 'number', description: 'Canvas height in pixels' },
            fontFamily: { type: 'string', description: 'Composition-level default font (e.g. Inter, Poppins, Caveat). Individual layers may override via properties.fontFamily.' },
            layers: { type: 'array', items: { '$ref': '#/components/schemas/Layer' } },
            meta: {
              type: 'object',
              description: 'Optional prose metadata. Lets an author (often an AI agent) bake intent + context into the composition so a future agent reading the JSON does not need an out-of-band explanation. Preserved round-trip through save/load.',
              properties: {
                description: { type: 'string', description: 'One paragraph explaining what the composition depicts and animates. See AGENT_BRIEF.md §16.' },
              },
            },
          },
        },
        CardProperties: {
          type: 'object',
          description: 'Properties for a card layer (type: card). Snapshotted from vemotion-cards KG graph.',
          properties: {
            title: { type: 'string', description: 'Card headline text' },
            body: { type: 'string', description: 'Card body / description text' },
            backgroundColor: { type: 'string', description: 'Hex background colour' },
            padding: { type: 'number', description: 'Inner padding in pixels (default 24)' },
            borderRadius: { type: 'number', description: 'Corner radius in pixels (default 12)' },
            titleFontSize: { type: 'number' },
            titleColor: { type: 'string' },
            titleFontWeight: { type: 'string', default: '700' },
            bodyFontSize: { type: 'number' },
            bodyColor: { type: 'string' },
            gap: { type: 'number', description: 'Gap between title and body in pixels (default 12)' },
            kgNodeId: { type: 'string', description: 'Source node id in vemotion-cards graph' },
            kgGraphId: { type: 'string', default: 'vemotion-cards' },
          },
        },
        CompositionSummary: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            duration: { type: 'number' },
            fps: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
            layerCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            version: { type: 'integer' },
            meta: {
              type: 'object',
              description: 'Inlined composition meta (description / tags / category / metaArea). Inlined here to save the portfolio client from N+1-fetching every composition individually. See AGENT_BRIEF.md §16.',
              properties: {
                description: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                category: { type: 'string' },
                metaArea: { type: 'string' },
              },
            },
          },
        },
        ProjectSummary: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            compositionId: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'published', 'archived'] },
            version: { type: 'integer' },
            updatedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            assetCount: { type: 'integer' },
          },
        },
        RenderJob: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            status: { type: 'string', enum: ['queued', 'processing', 'done', 'failed'] },
            name: { type: 'string' },
            progress: { type: 'number', minimum: 0, maximum: 100 },
            outputUrl: { type: 'string', nullable: true },
            error: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ ApiToken: [] }],
    paths: {
      '/health': {
        get: {
          operationId: 'healthCheck',
          summary: 'Health check',
          security: [],
          responses: {
            200: { description: 'Worker is healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, worker: { type: 'string' } } } } } },
          },
        },
      },
      '/openapi.json': {
        get: {
          operationId: 'getOpenApiSpec',
          summary: 'OpenAPI spec for this worker',
          security: [],
          responses: { 200: { description: 'OpenAPI 3.1 specification' } },
        },
      },

      // ── Compositions ──────────────────────────────────────────────────────
      '/vemotion/compositions': {
        get: {
          operationId: 'listCompositions',
          summary: 'List all compositions for the authenticated user',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'List of composition summaries',
              content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, compositions: { type: 'array', items: { '$ref': '#/components/schemas/CompositionSummary' } }, count: { type: 'integer' } } } } },
            },
          },
        },
      },
      '/vemotion/composition': {
        get: {
          operationId: 'getComposition',
          summary: 'Get a single composition by id',
          parameters: [{ name: 'id', in: 'query', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Full composition record', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, id: { type: 'string' }, name: { type: 'string' }, composition: { '$ref': '#/components/schemas/Composition' }, version: { type: 'integer' } } } } } },
            404: { description: 'Not found', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          },
        },
        delete: {
          operationId: 'deleteComposition',
          summary: 'Delete a composition',
          parameters: [{ name: 'id', in: 'query', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, id: { type: 'string' } } } } } },
            404: { description: 'Not found' },
          },
        },
      },
      '/vemotion/composition/save': {
        post: {
          operationId: 'saveComposition',
          summary: 'Create or update a composition. If id is omitted a new one is generated.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'composition'],
                  properties: {
                    id: { type: 'string', description: 'Omit to create new; provide to update' },
                    name: { type: 'string' },
                    composition: { '$ref': '#/components/schemas/Composition' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Updated' },
            201: { description: 'Created' },
          },
        },
      },
      '/vemotion/composition/refit': {
        post: {
          operationId: 'refitComposition',
          summary: 'Refit (reformat) a composition for a new canvas size.',
          description:
            'Pure transformation that scales every layer to suit a new target canvas size. ' +
            'Provide EXACTLY ONE of compositionId (refit a saved composition; owner check applies) or composition (refit an inline body). ' +
            'If name is provided, the result is saved as a NEW composition row (HTTP 201) and the source is not modified. ' +
            'If name is omitted, the refit composition body is returned inline (HTTP 200) with no DB write. ' +
            'Algorithm matches the canonical spec in the Vemotion app brief (docs/AGENT_BRIEF.md §12). ' +
            'KNOWN LIMITATION: math-shape and motionScenes formulas with hard-coded pixel constants do not auto-scale; only x0/y0/w/h references adapt.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['targetWidth', 'targetHeight', 'mode'],
                  properties: {
                    compositionId: { type: 'string', description: 'Refit a saved composition. Mutually exclusive with composition.' },
                    composition: { '$ref': '#/components/schemas/Composition', description: 'Refit an inline composition body. Mutually exclusive with compositionId.' },
                    targetWidth: { type: 'integer', minimum: 1, description: 'New canvas width in pixels.' },
                    targetHeight: { type: 'integer', minimum: 1, description: 'New canvas height in pixels.' },
                    mode: { type: 'string', enum: ['fit', 'fill', 'stretch'], description: 'fit = letterbox, fill = cover (default), stretch = independent xy scale.' },
                    name: { type: 'string', description: 'Optional. If provided, the refit composition is saved as a NEW row under this name and the response includes id+summary+version. If omitted, the composition is returned inline without persisting.' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Refit completed inline (no name was provided, nothing saved).',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      composition: { '$ref': '#/components/schemas/Composition' },
                    },
                  },
                },
              },
            },
            201: {
              description: 'Refit completed and saved as a new composition.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      id: { type: 'string' },
                      summary: { '$ref': '#/components/schemas/CompositionSummary' },
                      version: { type: 'integer' },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing or invalid input', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
            403: { description: 'Forbidden — compositionId belongs to a different user', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
            404: { description: 'compositionId not found', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          },
        },
      },
      '/vemotion/composition/history': {
        get: {
          operationId: 'getCompositionHistory',
          summary: 'List the latest 30 versions of a composition',
          parameters: [{ name: 'id', in: 'query', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Composition version history' },
            404: { description: 'Not found', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          },
        },
      },

      // ── Projects ──────────────────────────────────────────────────────────
      '/vemotion/projects': {
        get: {
          operationId: 'listProjects',
          summary: 'List VEmotion projects for the authenticated user',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Project list', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, projects: { type: 'array', items: { '$ref': '#/components/schemas/ProjectSummary' } }, count: { type: 'integer' } } } } } },
          },
        },
      },
      '/vemotion/project': {
        get: {
          operationId: 'getProject',
          summary: 'Get a single VEmotion project by id',
          parameters: [{ name: 'id', in: 'query', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Full project record' },
            404: { description: 'Not found' },
          },
        },
        delete: {
          operationId: 'deleteProject',
          summary: 'Delete a VEmotion project',
          parameters: [{ name: 'id', in: 'query', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Deleted' },
            404: { description: 'Not found' },
          },
        },
      },
      '/vemotion/project/create': {
        post: {
          operationId: 'createProject',
          summary: 'Create a new VEmotion project',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    compositionId: { type: 'string' },
                    status: { type: 'string', enum: ['draft', 'published', 'archived'] },
                    assets: { type: 'array' },
                    props: { type: 'object' },
                    scenes: { type: 'array' },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Created' } },
        },
      },
      '/vemotion/project/update': {
        post: {
          operationId: 'updateProject',
          summary: 'Update an existing VEmotion project',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['projectId'],
                  properties: {
                    projectId: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    status: { type: 'string' },
                    assets: { type: 'array' },
                    props: { type: 'object' },
                    scenes: { type: 'array' },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Updated' } },
        },
      },

      // ── Renders ───────────────────────────────────────────────────────────
      '/vemotion/renders': {
        get: {
          operationId: 'listRenders',
          summary: 'List render jobs for the authenticated user',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Render job list', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, jobs: { type: 'array', items: { '$ref': '#/components/schemas/RenderJob' } }, count: { type: 'integer' } } } } } },
          },
        },
      },
      '/vemotion/render': {
        get: {
          operationId: 'getRender',
          summary: 'Poll a render job status',
          parameters: [{ name: 'id', in: 'query', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Render job', content: { 'application/json': { schema: { '$ref': '#/components/schemas/RenderJob' } } } },
            404: { description: 'Not found' },
          },
        },
        post: {
          operationId: 'queueRender',
          summary: 'Queue a render job. Provide either an inline composition or a saved compositionId.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    compositionId: { type: 'string', description: 'ID of a saved composition to render' },
                    name: { type: 'string', description: 'Human-readable job name' },
                    composition: { '$ref': '#/components/schemas/Composition', description: 'Inline composition (alternative to compositionId)' },
                  },
                },
              },
            },
          },
          responses: {
            202: { description: 'Queued', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, jobId: { type: 'string' }, status: { type: 'string' }, message: { type: 'string' } } } } } },
          },
        },
      },
    },
  }
}

// ── Main fetch handler ────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
      const url = new URL(request.url)
      const { pathname, method } = { pathname: url.pathname, method: request.method }

      // Public endpoints (pathname includes the /vemotion/ route prefix)
      if ((pathname === '/vemotion/health' || pathname === '/health') && method === 'GET') {
        return json({
          status: 'healthy',
          worker: 'vemotion-worker',
          version: '1.0.0',
          bindings: { kv: !!env.VEMOTION_PROJECTS, r2assets: !!env.VEMOTION_ASSETS, r2renders: !!env.VEMOTION_RENDERS, d1: !!env.vegvisr_org },
        })
      }

      if ((pathname === '/vemotion/openapi.json' || pathname === '/openapi.json') && method === 'GET') {
        const origin = request.headers.get('origin') || `https://${new URL(request.url).hostname}`
        return json(buildOpenApiSpec(origin))
      }

      // All other routes require auth
      const auth = await validateAuth(request, env)
      if (!auth.valid) return error(auth.error || 'Unauthorized', 401)

      // ── Compositions ────────────────────────────────────────────────────
      if (pathname === '/vemotion/compositions' && method === 'GET')
        return await handleListCompositions(url, env, auth)

      if (pathname === '/vemotion/composition' && method === 'GET')
        return await handleGetComposition(url, env, auth)

      if (pathname === '/vemotion/composition/history' && method === 'GET')
        return await handleGetCompositionHistory(url, env, auth)

      if (pathname === '/vemotion/composition/save' && method === 'POST')
        return await handleSaveComposition(request, env, auth)

      if (pathname === '/vemotion/composition/refit' && method === 'POST')
        return await handleRefitComposition(request, env, auth)

      if (pathname === '/vemotion/composition' && method === 'DELETE')
        return await handleDeleteComposition(url, env, auth)

      // ── Projects ────────────────────────────────────────────────────────
      if (pathname === '/vemotion/projects' && method === 'GET')
        return await handleListProjects(url, env, auth)

      if (pathname === '/vemotion/project' && method === 'GET')
        return await handleGetProject(url, env, auth)

      if (pathname === '/vemotion/project' && method === 'DELETE')
        return await handleDeleteProject(url, env, auth)

      if (pathname === '/vemotion/project/create' && method === 'POST')
        return await handleCreateProject(request, env, auth)

      if (pathname === '/vemotion/project/update' && method === 'POST')
        return await handleUpdateProject(request, env, auth)

      // ── Renders ─────────────────────────────────────────────────────────
      if (pathname === '/vemotion/renders' && method === 'GET')
        return await handleListRenders(url, env, auth)

      if (pathname === '/vemotion/render' && method === 'GET')
        return await handleGetRender(url, env, auth)

      if (pathname === '/vemotion/render' && method === 'POST')
        return await handleQueueRender(request, env, auth)

      return error('Not found', 404, { pathname })
    } catch (err) {
      console.error('vemotion-worker error', err)
      return error(err.message || 'Internal server error', err.status || 500)
    }
  },
}
