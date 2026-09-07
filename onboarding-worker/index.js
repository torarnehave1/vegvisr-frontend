const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-user-email, x-user-role, X-API-Token',
  'Access-Control-Max-Age': '86400'
}

let schemaBootstrapped = false

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const { pathname } = url

    try {
      if (pathname === '/health' && request.method === 'GET') {
        return jsonResponse({
          status: 'healthy',
          service: env.WORKER_NAME || 'onboarding-worker',
          environment: env.ENVIRONMENT || 'production',
          schemaBootstrapped
        })
      }

      await ensureSchema(env)

      // Public
      if (pathname === '/apply' && request.method === 'POST') {
        const payload = await parseJSON(request)
        return await handleApply(env, payload)
      }

      if (pathname.startsWith('/invite/') && request.method === 'GET') {
        const code = decodeURIComponent(pathname.split('/invite/')[1] || '').split('/')[0]
        return await handleGetInvite(env, code)
      }

      if (pathname.startsWith('/invite/') && pathname.endsWith('/apply') && request.method === 'POST') {
        const code = decodeURIComponent(pathname.split('/invite/')[1] || '').split('/')[0]
        const payload = await parseJSON(request)
        return await handleInviteApply(env, code, payload)
      }

      // Admin
      if (pathname === '/admin/applications' && request.method === 'GET') {
        const user = getUserContext(request)
        requireAnyRole(user, ['Admin', 'Superadmin'])
        return await handleListApplications(env, url)
      }

      if (pathname.startsWith('/admin/applications/') && pathname.endsWith('/decision') && request.method === 'POST') {
        const user = getUserContext(request)
        requireAnyRole(user, ['Admin', 'Superadmin'])
        const applicationId = pathname.split('/admin/applications/')[1].split('/decision')[0]
        const payload = await parseJSON(request)
        return await handleDecision(env, applicationId, user, payload)
      }

      if (pathname === '/admin/invites' && request.method === 'POST') {
        const user = getUserContext(request)
        requireAnyRole(user, ['Admin', 'Superadmin'])
        const payload = await parseJSON(request)
        return await handleCreateInvite(env, user, payload)
      }

      if (pathname.startsWith('/admin/invites/') && pathname.endsWith('/disable') && request.method === 'POST') {
        const user = getUserContext(request)
        requireAnyRole(user, ['Admin', 'Superadmin'])
        const inviteId = pathname.split('/admin/invites/')[1].split('/disable')[0]
        return await handleDisableInvite(env, user, inviteId)
      }

      return jsonResponse({ success: false, error: 'Not Found', path: pathname }, 404)
    } catch (error) {
      console.error('onboarding-worker error', error)
      if (error instanceof HttpError) {
        return jsonResponse({ success: false, error: error.message }, error.status)
      }
      return jsonResponse({ success: false, error: error.message || 'Internal Server Error' }, 500)
    }
  }
}

async function handleApply(env, payload) {
  const now = Date.now()
  const applicationId = crypto.randomUUID()

  const persona = requiredString(payload.persona, 'persona')
  const goals = requiredString(payload.goals, 'goals')
  const success30Days = requiredString(payload.success_30_days || payload.success30Days, 'success_30_days')
  const weeklyCommitment = requiredString(payload.weekly_commitment || payload.weeklyCommitment, 'weekly_commitment')

  const applicantEmail = normalizeNullableString(payload.applicant_email || payload.email)
  const applicantPhone = normalizeNullableString(payload.applicant_phone || payload.phone)

  if (!applicantEmail && !applicantPhone) {
    return jsonResponse({ success: false, error: 'Either applicant_email or applicant_phone is required' }, 400)
  }

  const investorInterest = payload.investor_interest ? 1 : 0
  const wantsBrandedApp = payload.wants_branded_app ? 1 : 0

  await env.DB.prepare(`
    INSERT INTO onboarding_applications (
      id, created_at, updated_at, status, source, invite_id, brand_id,
      applicant_email, applicant_phone,
      persona, goals, success_30_days, weekly_commitment,
      investor_interest, wants_branded_app
    ) VALUES (?, ?, ?, 'pending', 'web_apply', NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    applicationId,
    now,
    now,
    applicantEmail,
    applicantPhone,
    persona,
    goals,
    success30Days,
    weeklyCommitment,
    investorInterest,
    wantsBrandedApp
  ).run()

  return jsonResponse({ success: true, applicationId, status: 'pending' }, 201)
}

async function handleGetInvite(env, code) {
  code = normalizeNullableString(code)
  if (!code) {
    return jsonResponse({ success: false, error: 'Invite code required' }, 400)
  }

  const invite = await env.DB.prepare(`
    SELECT id, code, type, brand_id, created_by_user_id, created_at, expires_at, max_uses, use_count, status
    FROM onboarding_invites
    WHERE code = ?
  `).bind(code).first()

  if (!invite) {
    return jsonResponse({ success: false, error: 'Invite not found' }, 404)
  }

  if (invite.status !== 'active') {
    return jsonResponse({ success: false, error: 'Invite is not active' }, 400)
  }

  if (invite.expires_at && Date.now() > invite.expires_at) {
    return jsonResponse({ success: false, error: 'Invite expired' }, 400)
  }

  if (invite.max_uses != null && invite.use_count != null && invite.use_count >= invite.max_uses) {
    return jsonResponse({ success: false, error: 'Invite has reached max uses' }, 400)
  }

  return jsonResponse({
    success: true,
    invite: {
      id: invite.id,
      code: invite.code,
      type: invite.type,
      brand_id: invite.brand_id,
      status: invite.status,
      expires_at: invite.expires_at,
      max_uses: invite.max_uses,
      use_count: invite.use_count
    }
  })
}

async function handleInviteApply(env, code, payload) {
  const now = Date.now()

  code = normalizeNullableString(code)
  if (!code) {
    return jsonResponse({ success: false, error: 'Invite code required' }, 400)
  }

  const invite = await env.DB.prepare(`
    SELECT id, code, type, brand_id, expires_at, max_uses, use_count, status
    FROM onboarding_invites
    WHERE code = ?
  `).bind(code).first()

  if (!invite) {
    return jsonResponse({ success: false, error: 'Invite not found' }, 404)
  }

  if (invite.status !== 'active') {
    return jsonResponse({ success: false, error: 'Invite is not active' }, 400)
  }

  if (invite.expires_at && Date.now() > invite.expires_at) {
    return jsonResponse({ success: false, error: 'Invite expired' }, 400)
  }

  if (invite.max_uses != null && invite.use_count != null && invite.use_count >= invite.max_uses) {
    return jsonResponse({ success: false, error: 'Invite has reached max uses' }, 400)
  }

  const applicationId = crypto.randomUUID()

  const persona = requiredString(payload.persona, 'persona')
  const goals = requiredString(payload.goals, 'goals')
  const success30Days = requiredString(payload.success_30_days || payload.success30Days, 'success_30_days')
  const weeklyCommitment = requiredString(payload.weekly_commitment || payload.weeklyCommitment, 'weekly_commitment')

  const applicantEmail = normalizeNullableString(payload.applicant_email || payload.email)
  const applicantPhone = normalizeNullableString(payload.applicant_phone || payload.phone)

  if (!applicantEmail && !applicantPhone) {
    return jsonResponse({ success: false, error: 'Either applicant_email or applicant_phone is required' }, 400)
  }

  const investorInterest = payload.investor_interest ? 1 : 0
  const wantsBrandedApp = payload.wants_branded_app ? 1 : 0

  const source = invite.type === 'brand' ? 'brand_invite' : 'platform_invite'

  await env.DB.prepare(`
    INSERT INTO onboarding_applications (
      id, created_at, updated_at, status, source, invite_id, brand_id,
      applicant_email, applicant_phone,
      persona, goals, success_30_days, weekly_commitment,
      investor_interest, wants_branded_app
    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    applicationId,
    now,
    now,
    source,
    invite.id,
    invite.brand_id,
    applicantEmail,
    applicantPhone,
    persona,
    goals,
    success30Days,
    weeklyCommitment,
    investorInterest,
    wantsBrandedApp
  ).run()

  await env.DB.prepare('UPDATE onboarding_invites SET use_count = COALESCE(use_count, 0) + 1 WHERE id = ?')
    .bind(invite.id)
    .run()

  return jsonResponse({ success: true, applicationId, status: 'pending', invite: { id: invite.id, code: invite.code } }, 201)
}

async function handleListApplications(env, url) {
  const status = normalizeNullableString(url.searchParams.get('status')) || 'pending'

  const allowed = new Set(['pending', 'approved', 'rejected', 'waitlisted', 'needs_info'])
  if (!allowed.has(status)) {
    return jsonResponse({ success: false, error: 'Invalid status' }, 400)
  }

  const { results } = await env.DB.prepare(`
    SELECT *
    FROM onboarding_applications
    WHERE status = ?
    ORDER BY created_at DESC
    LIMIT 200
  `).bind(status).all()

  return jsonResponse({ success: true, applications: results.map(normalizeApplication) })
}

async function handleDecision(env, applicationId, user, payload) {
  applicationId = normalizeNullableString(applicationId)
  if (!applicationId) {
    return jsonResponse({ success: false, error: 'Application id required' }, 400)
  }

  const decision = normalizeNullableString(payload.decision)
  const notesInternal = normalizeNullableString(payload.notes_internal || payload.notesInternal)

  const allowed = new Set(['approved', 'rejected', 'waitlisted', 'needs_info'])
  if (!allowed.has(decision)) {
    return jsonResponse({ success: false, error: 'Invalid decision' }, 400)
  }

  const now = Date.now()

  const existing = await env.DB.prepare('SELECT id, status FROM onboarding_applications WHERE id = ?')
    .bind(applicationId)
    .first()

  if (!existing) {
    return jsonResponse({ success: false, error: 'Application not found' }, 404)
  }

  await env.DB.prepare(`
    UPDATE onboarding_applications
    SET status = ?,
        notes_internal = ?,
        reviewed_by_user_id = ?,
        reviewed_at = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    decision,
    notesInternal,
    user.userId || user.email || 'admin',
    now,
    now,
    applicationId
  ).run()

  return jsonResponse({ success: true, applicationId, status: decision })
}

async function handleCreateInvite(env, user, payload) {
  const now = Date.now()
  const inviteId = crypto.randomUUID()

  const type = normalizeNullableString(payload.type) || 'platform'
  if (!['platform', 'brand'].includes(type)) {
    return jsonResponse({ success: false, error: 'Invalid invite type' }, 400)
  }

  const brandId = normalizeNullableString(payload.brand_id || payload.brandId)
  if (type === 'brand' && !brandId) {
    return jsonResponse({ success: false, error: 'brand_id is required for brand invites' }, 400)
  }

  const maxUses = payload.max_uses != null ? Number(payload.max_uses) : 1
  const expiresInDays = payload.expires_in_days != null ? Number(payload.expires_in_days) : 30

  if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 1000) {
    return jsonResponse({ success: false, error: 'max_uses must be 1..1000' }, 400)
  }

  if (!Number.isFinite(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) {
    return jsonResponse({ success: false, error: 'expires_in_days must be 1..365' }, 400)
  }

  const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000

  // Try a few times in case of rare collisions.
  let code = null
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateCode(10)
    const exists = await env.DB.prepare('SELECT id FROM onboarding_invites WHERE code = ?').bind(candidate).first()
    if (!exists) {
      code = candidate
      break
    }
  }

  if (!code) {
    return jsonResponse({ success: false, error: 'Failed to generate invite code' }, 500)
  }

  await env.DB.prepare(`
    INSERT INTO onboarding_invites (
      id, code, type, brand_id, created_by_user_id,
      created_at, expires_at, max_uses, use_count, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active')
  `).bind(
    inviteId,
    code,
    type,
    brandId,
    user.userId || user.email || 'admin',
    now,
    expiresAt,
    maxUses
  ).run()

  return jsonResponse({
    success: true,
    invite: {
      id: inviteId,
      code,
      type,
      brand_id: brandId,
      status: 'active',
      expires_at: expiresAt,
      max_uses: maxUses,
      use_count: 0
    }
  }, 201)
}

async function handleDisableInvite(env, user, inviteId) {
  inviteId = normalizeNullableString(inviteId)
  if (!inviteId) {
    return jsonResponse({ success: false, error: 'Invite id required' }, 400)
  }

  const existing = await env.DB.prepare('SELECT id, status FROM onboarding_invites WHERE id = ?').bind(inviteId).first()
  if (!existing) {
    return jsonResponse({ success: false, error: 'Invite not found' }, 404)
  }

  await env.DB.prepare('UPDATE onboarding_invites SET status = ?, updated_at = ? WHERE id = ?')
    .bind('disabled', Date.now(), inviteId)
    .run()

  return jsonResponse({ success: true, inviteId, status: 'disabled' })
}

async function ensureSchema(env) {
  if (schemaBootstrapped) return

  // Best-effort: avoid hard failures on first deploy.
  // Real migrations live in repo root (add-onboarding-tables.sql).
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS onboarding_invites (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL, -- platform|brand
      brand_id TEXT,
      created_by_user_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      expires_at INTEGER,
      max_uses INTEGER,
      use_count INTEGER DEFAULT 0,
      status TEXT NOT NULL -- active|disabled
    )
  `).run()

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS onboarding_applications (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status TEXT NOT NULL, -- pending|approved|rejected|waitlisted|needs_info
      source TEXT NOT NULL, -- web_apply|platform_invite|brand_invite
      invite_id TEXT,
      brand_id TEXT,
      applicant_email TEXT,
      applicant_phone TEXT,
      persona TEXT NOT NULL,
      goals TEXT NOT NULL,
      success_30_days TEXT NOT NULL,
      weekly_commitment TEXT NOT NULL,
      investor_interest INTEGER DEFAULT 0,
      wants_branded_app INTEGER DEFAULT 0,
      notes_internal TEXT,
      reviewed_by_user_id TEXT,
      reviewed_at INTEGER
    )
  `).run()

  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_onboarding_applications_status_created_at ON onboarding_applications(status, created_at)')
    .run()

  schemaBootstrapped = true
}

function getUserContext(request) {
  const userId = request.headers.get('x-user-id') || null
  const email = request.headers.get('x-user-email') || null
  const role = request.headers.get('x-user-role') || null
  return { userId, email, role }
}

function requireAnyRole(user, allowedRoles) {
  const role = (user?.role || '').trim()
  if (!role || !allowedRoles.includes(role)) {
    throw new HttpError(403, 'Forbidden')
  }
}

function normalizeApplication(row) {
  if (!row) return row
  return {
    ...row,
    investor_interest: Number(row.investor_interest || 0),
    wants_branded_app: Number(row.wants_branded_app || 0)
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    }
  })
}

async function parseJSON(request) {
  try {
    const text = await request.text()
    if (!text) return {}
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
}

function normalizeNullableString(value) {
  if (value == null) return null
  const s = String(value).trim()
  return s ? s : null
}

function requiredString(value, fieldName) {
  const s = normalizeNullableString(value)
  if (!s) {
    throw new HttpError(400, `${fieldName} is required`)
  }
  return s
}

function generateCode(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}
