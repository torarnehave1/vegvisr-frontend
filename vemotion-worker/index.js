const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
}

const PROJECT_PREFIX = 'vemotion:project:'

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...headers,
    },
  })

const error = (message, status = 400, extra = {}) =>
  json({ error: message, ...extra }, status)

const getProjectKey = (projectId) => `${PROJECT_PREFIX}${projectId}`

const normalizeTags = (value) => {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
}

const normalizeAssets = (value) => {
  if (!Array.isArray(value)) return []
  return value
    .map((asset, index) => {
      if (typeof asset === 'string') {
        return { id: `asset-${index + 1}`, src: asset, type: 'image' }
      }
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

const normalizeObject = (value) => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

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
    if (row.data) {
      try {
        extraData = JSON.parse(row.data)
      } catch {
        extraData = {}
      }
    }

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

async function readProject(env, projectId) {
  const raw = await env.VEMOTION_PROJECTS.get(getProjectKey(projectId))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function assertOwner(project, auth) {
  if (!project) throw new Error('Project not found')
  if (!auth?.userId || project.userId !== auth.userId) {
    const err = new Error('Forbidden')
    err.status = 403
    throw err
  }
}

function projectSummary(project) {
  return {
    projectId: project.projectId,
    title: project.title,
    description: project.description || '',
    compositionId: project.compositionId || project.templateId || 'VEmotionIntro',
    templateId: project.templateId || 'custom',
    status: project.status || 'draft',
    version: project.version || 1,
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
    assetCount: Array.isArray(project.assets) ? project.assets.length : 0,
  }
}

function buildProjectRecord(input, auth, env, existing = null) {
  const now = new Date().toISOString()
  const projectId = existing?.projectId || (typeof input.projectId === 'string' && input.projectId.trim() ? input.projectId.trim() : crypto.randomUUID())
  const requestedCompositionId =
    typeof input.compositionId === 'string' && input.compositionId.trim()
      ? input.compositionId.trim()
      : typeof input.templateId === 'string' && input.templateId.trim()
        ? input.templateId.trim()
        : ''
  const compositionId = requestedCompositionId || existing?.compositionId || existing?.templateId || 'VEmotionIntro'
  const templateId = typeof input.templateId === 'string' && input.templateId.trim() ? input.templateId.trim() : (existing?.templateId || compositionId)
  const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim() : (existing?.title || 'Untitled VEmotion Project')
  const description = typeof input.description === 'string' ? input.description.trim() : (existing?.description || '')
  const status = typeof input.status === 'string' && input.status.trim() ? input.status.trim() : (existing?.status || 'draft')
  const assets = input.assets !== undefined ? normalizeAssets(input.assets) : (existing?.assets || [])
  const props = input.props !== undefined ? normalizeObject(input.props) : (existing?.props || {})
  const scenes = input.scenes !== undefined ? (Array.isArray(input.scenes) ? input.scenes : []) : (existing?.scenes || [])
  const notes = typeof input.notes === 'string' ? input.notes.trim() : (existing?.notes || '')

  const accountId =
    auth?.data?.vemotion?.accountId ||
    auth?.cfAccountId ||
    env.CF_ACCOUNT_ID ||
    env.VEMOTION_DEFAULT_ACCOUNT_ID ||
    null
  const bucketName =
    auth?.data?.vemotion?.r2Bucket ||
    auth?.cfR2Bucket ||
    env.VEMOTION_ASSETS_BUCKET_NAME ||
    null

  return {
    projectId,
    userId: auth.userId,
    userEmail: auth.email,
    compositionId,
    templateId,
    title,
    description,
    status,
    assets,
    props,
    scenes,
    notes,
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
      templateId: project.templateId,
      updatedAt: project.updatedAt,
    },
  })
}

async function handleCreateProject(request, env, auth) {
  const input = await request.json()
  const project = buildProjectRecord(input, auth, env)
  await putProject(env, project)
  return json({
    ok: true,
    message: 'VEmotion project created',
    project,
    summary: projectSummary(project),
  }, 201)
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
  return json({
    ok: true,
    message: 'VEmotion project updated',
    project,
    summary: projectSummary(project),
  })
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
    if (!record) continue
    if (record.userId !== auth.userId) continue
    projects.push(projectSummary(record))
  }

  projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return json({
    ok: true,
    projects,
    count: projects.length,
    cursor: list.cursor || null,
    truncated: Boolean(list.cursor),
  })
}

function buildOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'VEmotion Worker API',
      version: '0.1.0',
      description: 'Bootstrap VEmotion project storage and orchestration API.',
    },
    paths: {
      '/health': { get: { summary: 'Health check' } },
      '/openapi.json': { get: { summary: 'OpenAPI spec' } },
      '/vemotion/projects': { get: { summary: 'List current user VEmotion projects' } },
      '/vemotion/project': { get: { summary: 'Get current user VEmotion project by id' } },
      '/vemotion/project/create': { post: { summary: 'Create a VEmotion project' } },
      '/vemotion/project/update': { post: { summary: 'Update a VEmotion project' } },
    },
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
      const url = new URL(request.url)
      const pathname = url.pathname

      if (pathname === '/health' && request.method === 'GET') {
        return json({
          status: 'healthy',
          worker: 'vemotion-worker',
          bindings: {
            kv: !!env.VEMOTION_PROJECTS,
            r2: !!env.VEMOTION_ASSETS,
            d1: !!env.vegvisr_org,
          },
          accountId: env.CF_ACCOUNT_ID || env.VEMOTION_DEFAULT_ACCOUNT_ID || null,
          assetsBucket: env.VEMOTION_ASSETS_BUCKET_NAME || null,
        })
      }

      if (pathname === '/openapi.json' && request.method === 'GET') {
        return json(buildOpenApiSpec())
      }

      const auth = await validateAuth(request, env)
      if (!auth.valid) return error(auth.error || 'Unauthorized', 401)

      if (pathname === '/vemotion/projects' && request.method === 'GET') {
        return await handleListProjects(url, env, auth)
      }

      if (pathname === '/vemotion/project' && request.method === 'GET') {
        return await handleGetProject(url, env, auth)
      }

      if (pathname === '/vemotion/project/create' && request.method === 'POST') {
        return await handleCreateProject(request, env, auth)
      }

      if (pathname === '/vemotion/project/update' && request.method === 'POST') {
        return await handleUpdateProject(request, env, auth)
      }

      return error('Not found', 404, { pathname })
    } catch (err) {
      console.error('vemotion-worker error', err)
      return error(err.message || 'Internal server error', err.status || 500)
    }
  },
}
