// Component Manager API Handlers
import { editComponentWithAI, restoreComponentVersion, regenerateComponentDocumentation } from './component-ai-editor.js'

/**
 * Handle component manager API requests
 */
export async function handleComponentManagerAPI(request, env, pathname) {
  const url = new URL(request.url)

  // GET /api/components - List all components
  if (pathname === '/api/components' && request.method === 'GET') {
    return listComponents(env)
  }

  // GET /api/components/:name - Get component details
  if (pathname.match(/^\/api\/components\/[^\/]+$/) && request.method === 'GET') {
    const componentName = pathname.split('/').pop()
    return getComponentDetails(componentName, env)
  }

  // GET /api/components/:name/versions - Get version history
  if (pathname.match(/^\/api\/components\/[^\/]+\/versions$/) && request.method === 'GET') {
    const componentName = pathname.split('/')[3]
    return getComponentVersions(componentName, env)
  }

  // POST /api/components/:name/edit - AI edit component
  if (pathname.match(/^\/api\/components\/[^\/]+\/edit$/) && request.method === 'POST') {
    const componentName = pathname.split('/')[3]
    return handleAIEdit(request, componentName, env)
  }

  // POST /api/components/:name/restore - Restore version
  if (pathname.match(/^\/api\/components\/[^\/]+\/restore$/) && request.method === 'POST') {
    const componentName = pathname.split('/')[3]
    return handleRestore(request, componentName, env)
  }

  // GET /api/components/:name/diff/:from/:to - Get diff between versions
  if (pathname.match(/^\/api\/components\/[^\/]+\/diff\/\d+\/\d+$/) && request.method === 'GET') {
    const parts = pathname.split('/')
    const componentName = parts[3]
    const fromVersion = parseInt(parts[5])
    const toVersion = parseInt(parts[6])
    return getVersionDiff(componentName, fromVersion, toVersion, env)
  }

  // GET /api/components/:name/version - Get current version number
  if (pathname.match(/^\/api\/components\/[^\/]+\/version$/) && request.method === 'GET') {
    const componentName = pathname.split('/')[3]
    return getComponentCurrentVersion(componentName, env)
  }

  // GET /api/components/:name/docs - Get current component documentation
  if (pathname.match(/^\/api\/components\/[^\/]+\/docs$/) && request.method === 'GET') {
    const componentName = pathname.split('/')[3]
    return getComponentDocumentation(componentName, env)
  }

  // GET /api/components/:name/docs/:version - Get version-specific documentation
  if (pathname.match(/^\/api\/components\/[^\/]+\/docs\/\d+$/) && request.method === 'GET') {
    const parts = pathname.split('/')
    const componentName = parts[3]
    const version = parseInt(parts[5])
    return getComponentDocumentation(componentName, env, version)
  }

  // POST /api/components/:name/regenerate-docs - Regenerate documentation
  if (pathname.match(/^\/api\/components\/[^\/]+\/regenerate-docs$/) && request.method === 'POST') {
    const componentName = pathname.split('/')[3]
    return handleRegenerateDocs(request, componentName, env)
  }

  return new Response('Not found', { status: 404 })
}

/**
 * List all components
 */
async function listComponents(env) {
  try {
    const result = await env.vegvisr_org.prepare(`
      SELECT c.*,
             (SELECT COUNT(*) FROM component_versions WHERE component_id = c.id) as version_count,
             (SELECT created_at FROM component_ai_edits WHERE component_id = c.id ORDER BY created_at DESC LIMIT 1) as last_ai_edit
      FROM web_components c
      WHERE status = 'active'
      ORDER BY updated_at DESC
    `).all()

    return new Response(JSON.stringify({
      success: true,
      components: result.results
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get component details
 */
async function getComponentDetails(componentName, env) {
  try {
    const component = await env.vegvisr_org.prepare(
      'SELECT * FROM web_components WHERE name = ?'
    ).bind(componentName).first()

    if (!component) {
      return new Response(JSON.stringify({ success: false, error: 'Component not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get current code
    const codeObject = await env.WEB_COMPONENTS.get(`${componentName}.js`)
    const code = codeObject ? await codeObject.text() : null

    return new Response(JSON.stringify({
      success: true,
      component,
      code
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get version history
 */
async function getComponentVersions(componentName, env) {
  try {
    const versions = await env.vegvisr_org.prepare(`
      SELECT v.*,
             e.user_request,
             e.changes_summary,
             e.ai_model as edit_ai_model
      FROM component_versions v
      LEFT JOIN component_ai_edits e ON e.component_id = v.component_id AND e.to_version = v.version_number
      WHERE v.component_id = ?
      ORDER BY v.version_number DESC
    `).bind(componentName).all()

    // Check if documentation exists for each version
    const versionsWithDocs = await Promise.all(
      versions.results.map(async (version) => {
        const docPath = `${componentName}-docs-v${version.version_number}.json`
        const docExists = await env.WEB_COMPONENTS.head(docPath)
        return {
          ...version,
          has_docs: docExists !== null
        }
      })
    )

    return new Response(JSON.stringify({
      success: true,
      versions: versionsWithDocs
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Handle AI edit request
 */
async function handleAIEdit(request, componentName, env) {
  try {
    const body = await request.json()
    const { userRequest, userId, includeDocs } = body

    if (!userRequest) {
      return new Response(JSON.stringify({ success: false, error: 'userRequest is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const result = await editComponentWithAI({
      componentName,
      userRequest,
      env,
      userId: userId || 'anonymous',
      includeDocs: includeDocs || false
    })

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get current version number for a component
 */
async function getComponentCurrentVersion(componentName, env) {
  try {
    const component = await env.vegvisr_org.prepare(
      'SELECT current_version FROM web_components WHERE name = ?'
    ).bind(componentName).first()

    if (!component) {
      return new Response(JSON.stringify({ success: false, error: 'Component not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      componentName,
      version: component.current_version
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
async function handleRestore(request, componentName, env) {
  try {
    const body = await request.json()
    const { versionNumber, userId } = body

    if (!versionNumber) {
      return new Response(JSON.stringify({ success: false, error: 'versionNumber is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const result = await restoreComponentVersion({
      componentName,
      versionNumber: parseInt(versionNumber),
      env,
      userId: userId || 'anonymous'
    })

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get diff between two versions
 */
async function getVersionDiff(componentName, fromVersion, toVersion, env) {
  try {
    const fromV = await env.vegvisr_org.prepare(
      'SELECT r2_path FROM component_versions WHERE component_id = ? AND version_number = ?'
    ).bind(componentName, fromVersion).first()

    const toV = await env.vegvisr_org.prepare(
      'SELECT r2_path FROM component_versions WHERE component_id = ? AND version_number = ?'
    ).bind(componentName, toVersion).first()

    if (!fromV || !toV) {
      return new Response(JSON.stringify({ success: false, error: 'Version not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const fromCode = await (await env.WEB_COMPONENTS.get(fromV.r2_path)).text()
    const toCode = await (await env.WEB_COMPONENTS.get(toV.r2_path)).text()

    return new Response(JSON.stringify({
      success: true,
      from: { version: fromVersion, code: fromCode },
      to: { version: toVersion, code: toCode }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get component documentation
 */
async function getComponentDocumentation(componentName, env, version = null) {
  try {
    const docPath = version
      ? `${componentName}-docs-v${version}.json`
      : `${componentName}-docs.json`

    const docObject = await env.WEB_COMPONENTS.get(docPath)

    if (!docObject) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Documentation not found. Try regenerating documentation.'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const documentation = await docObject.json()

    return new Response(JSON.stringify({
      success: true,
      documentation,
      version: version || 'current'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Handle documentation regeneration request
 */
async function handleRegenerateDocs(request, componentName, env) {
  try {
    const body = await request.json()
    const userId = body.userId || 'system'

    const result = await regenerateComponentDocumentation({
      componentName,
      env,
      userId
    })

    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: result.message,
      documentation: result.data
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
