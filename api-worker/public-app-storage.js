/**
 * Public App Storage API - D1 JSON storage for public HTML node forms
 * No auth required. Use app_id + key for scoped data storage.
 */

const jsonHeaders = {
  'Content-Type': 'application/json'
}

const response = (payload, status = 200) => {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders })
}

const requireFields = (payload, fields) => {
  return fields.every((field) => payload && payload[field])
}

export async function setPublicData(request, env) {
  try {
    const body = await request.json()
    if (!requireFields(body, ['appId', 'key']) || body.value === undefined) {
      return response({ success: false, error: 'Missing required fields: appId, key, value' }, 400)
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const valueJson = JSON.stringify(body.value)
    const origin = request.headers.get('origin') || null
    const userAgent = request.headers.get('user-agent') || null
    const ip = request.headers.get('cf-connecting-ip') || null

    await env.vegvisr_org.prepare(`
      INSERT INTO public_app_storage (id, app_id, key, value, created_at, updated_at, origin, user_agent, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(app_id, key)
      DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(id, body.appId, body.key, valueJson, now, now, origin, userAgent, ip).run()

    return response({ success: true, id, appId: body.appId, key: body.key }, 200)
  } catch (error) {
    console.error('Public storage set error:', error)
    return response({ success: false, error: error.message }, 500)
  }
}

export async function getPublicData(request, env) {
  try {
    const url = new URL(request.url)
    const appId = url.searchParams.get('appId')
    const key = url.searchParams.get('key')

    if (!appId || !key) {
      return response({ success: false, error: 'Missing required parameters: appId, key' }, 400)
    }

    const result = await env.vegvisr_org.prepare(`
      SELECT id, app_id, key, value, created_at, updated_at
      FROM public_app_storage
      WHERE app_id = ? AND key = ?
    `).bind(appId, key).first()

    if (!result) {
      return response({ success: false, error: 'Data not found' }, 404)
    }

    return response({
      success: true,
      data: {
        id: result.id,
        appId: result.app_id,
        key: result.key,
        value: JSON.parse(result.value),
        createdAt: result.created_at,
        updatedAt: result.updated_at
      }
    })
  } catch (error) {
    console.error('Public storage get error:', error)
    return response({ success: false, error: error.message }, 500)
  }
}

export async function listPublicData(request, env) {
  try {
    const url = new URL(request.url)
    const appId = url.searchParams.get('appId')

    if (!appId) {
      return response({ success: false, error: 'Missing required parameter: appId' }, 400)
    }

    const result = await env.vegvisr_org.prepare(`
      SELECT id, app_id, key, value, created_at, updated_at
      FROM public_app_storage
      WHERE app_id = ?
      ORDER BY created_at DESC
    `).bind(appId).all()

    const items = (result.results || []).map((row) => ({
      id: row.id,
      appId: row.app_id,
      key: row.key,
      value: JSON.parse(row.value),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return response({ success: true, data: items })
  } catch (error) {
    console.error('Public storage list error:', error)
    return response({ success: false, error: error.message }, 500)
  }
}

export async function deletePublicData(request, env) {
  try {
    const body = await request.json()
    if (!requireFields(body, ['appId', 'key'])) {
      return response({ success: false, error: 'Missing required fields: appId, key' }, 400)
    }

    await env.vegvisr_org.prepare(`
      DELETE FROM public_app_storage
      WHERE app_id = ? AND key = ?
    `).bind(body.appId, body.key).run()

    return response({ success: true, appId: body.appId, key: body.key })
  } catch (error) {
    console.error('Public storage delete error:', error)
    return response({ success: false, error: error.message }, 500)
  }
}
