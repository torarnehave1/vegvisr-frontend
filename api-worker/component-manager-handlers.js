// Component Manager API Handlers
import { editComponentWithAI, restoreComponentVersion, regenerateComponentDocumentation } from './component-ai-editor.js'
import { syncComponentsToAPIRegistry } from './component-sync.js'

/**
 * Handle component manager API requests
 */
export async function handleComponentManagerAPI(request, env, pathname) {
  const url = new URL(request.url)

  // POST /api/components/sync - Sync web_components to apiForApps
  if (pathname === '/api/components/sync' && request.method === 'POST') {
    return syncComponentsToAPIRegistry(env)
  }

  // POST /api/components/:name/create - Create a new component (R2 + D1 seed)
  if (pathname.match(/^\/api\/components\/[^\/]+\/create$/) && request.method === 'POST') {
    const componentName = pathname.split('/')[3]
    return handleCreateComponent(request, componentName, env)
  }

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
 * Create a new component (initial R2 object + D1 rows)
 */
async function handleCreateComponent(request, componentName, env) {
  try {
    const body = await request.json()
    const {
      code,
      description = 'Custom web component',
      category = 'components',
      tags = [],
      status = 'active',
      userId = 'anonymous',
      sync = false
    } = body

    // Basic validation: custom elements must include a dash
    if (!/^([a-z0-9]+-)+[a-z0-9-]+$/.test(componentName)) {
      return new Response(JSON.stringify({ success: false, error: 'componentName must be kebab-case and include a dash' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Prevent duplicates
    const existing = await env.vegvisr_org.prepare(
      'SELECT id FROM web_components WHERE id = ? OR name = ? OR slug = ?'
    ).bind(componentName, componentName, componentName).first()

    if (existing) {
      return new Response(JSON.stringify({ success: false, error: 'Component already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const initialCode = (typeof code === 'string' && code.trim().length > 0)
      ? code
      : generateHelloWorldComponent(componentName)

    // Write initial files to R2
    const version = 1
    const versionPath = `${componentName}/v${version}_${Date.now()}.js`

    await env.WEB_COMPONENTS.put(versionPath, initialCode, {
      httpMetadata: { contentType: 'application/javascript' },
      customMetadata: {
        version: version.toString(),
        createdBy: userId,
        source: 'create-endpoint'
      }
    })

    await env.WEB_COMPONENTS.put(`${componentName}.js`, initialCode, {
      httpMetadata: { contentType: 'application/javascript' }
    })

    // Insert into web_components
    await env.vegvisr_org.prepare(`
      INSERT INTO web_components (id, name, slug, description, category, tags, r2_path, current_version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      componentName,
      componentName,
      componentName,
      description,
      category,
      Array.isArray(tags) ? JSON.stringify(tags) : (tags || '[]'),
      `${componentName}.js`,
      version,
      status
    ).run()

    // Insert initial version row
    await env.vegvisr_org.prepare(`
      INSERT INTO component_versions (component_id, version_number, r2_path, change_description, changed_by)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      componentName,
      version,
      versionPath,
      'Initial version (created via API)',
      userId
    ).run()

    let syncResult = null
    if (sync) {
      // Run sync to apiForApps; unwrap JSON for inclusion
      const syncResponse = await syncComponentsToAPIRegistry(env)
      syncResult = await syncResponse.json()
    }

    return new Response(JSON.stringify({
      success: true,
      component: componentName,
      version,
      message: 'Component created in R2 and D1',
      r2: {
        currentPath: `${componentName}.js`,
        versionPath
      },
      sync: syncResult
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (error) {
    console.error('❌ Error creating component:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
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
    const { userRequest, userId, generateDocs, includeDocs } = body

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
      generateDocs: generateDocs || false,
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

/**
 * Generate a minimal Hello World component as a fallback
 */
function generateHelloWorldComponent(componentName) {
  const className = componentName
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

  return `class ${className} extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    if (!this.shadowRoot) return
    this.shadowRoot.innerHTML = '
      <style>
        :host {
          display: block;
          padding: 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          font-family: system-ui, -apple-system, sans-serif;
          text-align: center;
          background: #fafafa;
          color: #111827;
        }
      </style>
      <div>Hello World</div>
    '
  }
}

if (!customElements.get('${componentName}')) {
  customElements.define('${componentName}', ${className})
}
`
}
