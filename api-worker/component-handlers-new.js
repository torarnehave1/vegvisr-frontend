import { readFileSync } from 'fs';
import { join } from 'path';

// Component serving handler - reads from separate files
export async function handleServeComponent(request, env, pathname) {
  try {
    // Extract component name from path: /components/knowledge-graph-viewer.js
    const componentName = pathname.replace('/components/', '').replace('.js', '')

    // List of available components
    const availableComponents = [
      'canvas-drawing',
      'mermaid-diagram',
      'knowledge-graph-viewer'
    ]

    if (!availableComponents.includes(componentName)) {
      return new Response('Component not found', { status: 404 })
    }

    // In production (Cloudflare Workers), read from R2 or import directly
    // For now, we'll keep the legacy approach for other components
    // but serve knowledge-graph-viewer from a cleaner source
    
    if (componentName === 'knowledge-graph-viewer') {
      // This will be bundled by wrangler
      const componentCode = await import('./components/knowledge-graph-viewer.js')
      return new Response(componentCode.default || componentCode, {
        headers: {
          'Content-Type': 'application/javascript',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Fallback to legacy string-based components
    const components = getLegacyComponents()
    const code = components[componentName]

    if (!code) {
      return new Response('Component not found', { status: 404 })
    }

    return new Response(code, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('Error serving component:', error)
    return new Response(`Error serving component: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}

// Legacy components stored as strings (to be migrated)
function getLegacyComponents() {
  return {
    // ... keep existing components here
  }
}
