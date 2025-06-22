// Generated RAG-Enabled Sandbox Worker
// Sandbox ID: rag-1750541359947-aumexa5nq
// Generated: 2025-06-21T21:29:19.947Z

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // RAG Query Endpoint - Main Feature
      if (url.pathname === '/rag/query') {
        const { query, includeContext = true } = await request.json()

        // Generate embedding for the query
        const queryEmbedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: query,
        })

        // Search vector database for relevant context
        const vectorResults = await env.VECTORIZE.query(queryEmbedding.data[0], {
          filter: { userId: 'autorag-demo', graphId: 'graph_1750490454266' },
          topK: 5,
        })

        const context = vectorResults.matches.map((match) => ({
          content: match.metadata.nodeContent,
          source: match.metadata.nodeLabel,
          score: match.score,
        }))

        // Generate RAG response using context
        const ragResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant with access to the user's knowledge graph about "Cloudflare AUTORAG". Use the following context to answer questions: ${JSON.stringify(context)}`,
            },
            { role: 'user', content: query },
          ],
        })

        return new Response(
          JSON.stringify({
            response: ragResponse.response,
            sources: includeContext ? context : [],
            ragEnabled: true,
            sandboxId: 'rag-1750541359947-aumexa5nq',
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      // Knowledge Graph Search
      if (url.pathname === '/knowledge/search') {
        const { query } = await request.json()

        // Generate embedding for the query
        const queryEmbedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: query,
        })

        const vectorResults = await env.VECTORIZE.query(queryEmbedding.data[0], {
          filter: { userId: 'autorag-demo', graphId: 'graph_1750490454266' },
          topK: 10,
        })

        return new Response(
          JSON.stringify({
            results: vectorResults.matches.map((match) => ({
              nodeId: match.metadata.nodeId,
              label: match.metadata.nodeLabel,
              content: match.metadata.nodeContent,
              score: match.score,
            })),
            total: vectorResults.matches.length,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      // Original extracted code functionality
      if (url.pathname === '/execute') {
        // No executable code found

        return new Response(
          JSON.stringify({
            message: 'No executable code found in this knowledge graph',
            sandboxId: 'rag-1750541359947-aumexa5nq',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      // Health check
      if (url.pathname === '/health') {
        return new Response(
          JSON.stringify({
            status: 'healthy',
            sandboxId: 'rag-1750541359947-aumexa5nq',
            ragEnabled: true,
            vectorIndex: 'user_autorag-demo_graph_graph_1750490454266',
            createdAt: '2025-06-21T21:29:19.947Z',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      return new Response(
        JSON.stringify({
          message: 'RAG Sandbox Worker - Cloudflare AUTORAG Tutorial',
          endpoints: ['/rag/query', '/knowledge/search', '/execute', '/health'],
          sandboxId: 'rag-1750541359947-aumexa5nq',
          description: 'Interactive RAG-enabled sandbox for Cloudflare AUTORAG knowledge graph',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error.message,
          sandboxId: 'rag-1750541359947-aumexa5nq',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }
  },
}
