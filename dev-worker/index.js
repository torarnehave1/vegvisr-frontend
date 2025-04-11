export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response('', { status: 204, headers: corsHeaders })
    }

    try {
      const url = new URL(request.url)
      const { pathname } = url

      if (pathname === '/saveknowgraph' && request.method === 'POST') {
        try {
          const { id, graphData } = await request.json()

          if (!id || !graphData) {
            return new Response(JSON.stringify({ error: 'ID and graph data are required' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          // Save the knowledge graph to the D1 database
          const query = `INSERT INTO knowledge_graphs (id, data) VALUES (?, ?)`
          await env.D1_DATABASE.prepare(query).bind(id, JSON.stringify(graphData)).run()

          // Return a JSON response with success message
          return new Response(
            JSON.stringify({ message: 'Knowledge graph saved successfully', id }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          return new Response(
            JSON.stringify({ error: 'Invalid JSON or server error', details: error.message }),
            {
              status: 500,
              headers: corsHeaders,
            },
          )
        }
      }

      // Create a JSON object to send back
      const data = { message: 'Knowledge Graph!' }

      // Return a JSON response with CORS header and proper content type
      const response = new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json', // Set Content-Type to JSON
          'Access-Control-Allow-Origin': '*', // Allow CORS
        },
      })

      return response
    } catch (error) {
      return new Response('Error: ' + error.message, { status: 500, headers: corsHeaders })
    }
  },
}
