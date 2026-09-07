// openapi-worker — serves a live API-docs viewer at openapi.vegvisr.org
// Renders the Knowledge Graph worker's OpenAPI spec with Scalar, fetched at
// runtime from https://knowledge.vegvisr.org/openapi.json so it is never stale.

const SPEC_URL = 'https://knowledge.vegvisr.org/openapi.json'

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vegvisr Knowledge Graph API — Docs</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><text y=%2213%22 font-size=%2213%22>📘</text></svg>" />
  <style>
    body { margin: 0; }
  </style>
</head>
<body>
  <script
    id="api-reference"
    data-url="${SPEC_URL}"
    data-configuration='{"theme":"default","layout":"modern","hideDownloadButton":false,"metaData":{"title":"Vegvisr Knowledge Graph API"}}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    const url = new URL(request.url)

    // Lightweight health check for monitoring
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'openapi-worker', spec: SPEC_URL }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Serve the docs page for every other path so deep links resolve.
    return new Response(PAGE, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=300',
      },
    })
  },
}
