// @name rag-manager-worker
// @description RAG Manager Worker for creating and managing RAG-enabled sandboxes from knowledge graphs
// @version 1.0
// @author Tor Arne Håve
// @license MIT

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, x-user-role, X-API-Token, x-user-email',
}

// Utility functions
const createResponse = (body, status = 200, headers = {}) => {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...headers },
  })
}

const createErrorResponse = (message, status) => {
  console.error(`[RAG Manager] Error: ${message}`)
  return createResponse(JSON.stringify({ error: message }), status)
}

// RAG Knowledge Graph Analyzer
class RAGAnalyzer {
  static analyze(graphData) {
    console.log('[RAG Manager] Analyzing knowledge graph for executable content')

    const extractedFiles = {}
    const ragContent = []
    let detectedPlatform = 'cloudflare-workers'

    // Analyze each node for content and code
    graphData.nodes.forEach((node) => {
      if (!node.info || !node.visible) return

      // Extract TypeScript/JavaScript code blocks
      const codeBlocks = this.extractCodeBlocks(node.info)
      if (codeBlocks.length > 0) {
        extractedFiles['index.js'] =
          (extractedFiles['index.js'] || '') + '\n\n' + codeBlocks.join('\n\n')
      }

      // Extract configuration files
      if (node.info.includes('wrangler.toml')) {
        const tomlConfig = this.extractConfigFile(node.info, 'toml')
        if (tomlConfig) extractedFiles['wrangler.toml'] = tomlConfig
      }

      if (node.info.includes('package.json')) {
        const packageConfig = this.extractConfigFile(node.info, 'json')
        if (packageConfig) extractedFiles['package.json'] = packageConfig
      }

      // Collect all text content for RAG indexing
      ragContent.push({
        nodeId: node.id,
        label: node.label,
        content: node.info,
        type: node.type || 'text',
      })
    })

    return {
      platform: detectedPlatform,
      files: extractedFiles,
      ragContent,
      hasExecutableContent: Object.keys(extractedFiles).length > 0,
      totalNodes: ragContent.length,
    }
  }

  static extractCodeBlocks(content) {
    const codeBlockRegex = /```(?:typescript|javascript|js|ts)\n([\s\S]*?)\n```/gi
    const blocks = []
    let match

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push(match[1].trim())
    }

    return blocks
  }

  static extractConfigFile(content, type) {
    const regex = type === 'toml' ? /```toml\n([\s\S]*?)\n```/gi : /```json\n([\s\S]*?)\n```/gi

    const match = regex.exec(content)
    return match ? match[1].trim() : null
  }
}

// RAG Vector Indexer
class RAGIndexer {
  static async createVectorEmbeddings(ragContent, graphId, userId, env) {
    console.log(`[RAG Manager] Creating vector embeddings for ${ragContent.length} nodes`)

    const embeddings = []

    for (const content of ragContent) {
      try {
        // Create text for embedding (combine label and content)
        const textForEmbedding = `${content.label}\n\n${content.content}`

        // Generate embedding using Workers AI
        const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: textForEmbedding,
        })

        // Store embedding with rich metadata
        embeddings.push({
          id: `${graphId}_${content.nodeId}`,
          values: embedding.data[0],
          metadata: {
            userId,
            graphId,
            nodeId: content.nodeId,
            nodeLabel: content.label,
            nodeType: content.type,
            nodeContent: content.content,
            indexed: new Date().toISOString(),
          },
        })
      } catch (error) {
        console.error(`[RAG Manager] Failed to create embedding for node ${content.nodeId}:`, error)
      }
    }

    // Store embeddings in Vectorize
    if (embeddings.length > 0) {
      try {
        await env.VECTORIZE.upsert(embeddings)
        console.log(`[RAG Manager] Successfully stored ${embeddings.length} embeddings`)
      } catch (error) {
        console.error('[RAG Manager] Failed to store embeddings:', error)
        throw error
      }
    }

    return {
      indexed: embeddings.length,
      vectorIndex: `user_${userId}_graph_${graphId}`,
    }
  }
}

// RAG Sandbox Deployer
class RAGSandboxDeployer {
  static async createRAGSandbox(extractedData, vectorConfig, env) {
    const sandboxId = `rag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    console.log(`[RAG Manager] Creating RAG sandbox: ${sandboxId}`)

    // Generate RAG-enabled worker code
    const workerCode = this.generateRAGWorkerCode(extractedData, vectorConfig, sandboxId)

    // Store sandbox metadata
    const sandboxMetadata = {
      id: sandboxId,
      type: 'rag-sandbox',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
      userId: vectorConfig.userId,
      graphId: vectorConfig.graphId,
      platform: extractedData.platform,
      status: 'active',
      ragEnabled: true,
    }

    await env.SANDBOX_KV.put(`sandbox:${sandboxId}`, JSON.stringify(sandboxMetadata))

    // In a real implementation, this would deploy to Cloudflare Workers
    // For now, we'll simulate the deployment
    const sandboxUrl = `https://${sandboxId}.torarnehave.workers.dev`

    return {
      sandboxId,
      url: sandboxUrl,
      expiresIn: '4 hours',
      ragEnabled: true,
      workerCode, // Return for manual deployment or testing
    }
  }

  static generateRAGWorkerCode(extractedData, vectorConfig, sandboxId) {
    const userCode = extractedData.files['index.js'] || '// No executable code found'

    return `
// Generated RAG-Enabled Sandbox Worker
// Sandbox ID: ${sandboxId}
// Generated: ${new Date().toISOString()}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // RAG Query Endpoint - Main Feature
      if (url.pathname === '/rag/query') {
        const { query, includeContext = true } = await request.json()

        // Search vector database for relevant context
        const vectorResults = await env.VECTORIZE.query(query, {
          filter: { userId: '${vectorConfig.userId}', graphId: '${vectorConfig.graphId}' },
          topK: 5
        })

        const context = vectorResults.matches.map(match => ({
          content: match.metadata.nodeContent,
          source: match.metadata.nodeLabel,
          score: match.score
        }))

        // Generate RAG response using context
        const ragResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            {
              role: "system",
              content: \`You are a helpful assistant with access to the user's knowledge graph about "${vectorConfig.graphId}". Use the following context to answer questions: \${JSON.stringify(context)}\`
            },
            { role: "user", content: query }
          ]
        })

        return new Response(JSON.stringify({
          response: ragResponse.response,
          sources: includeContext ? context : [],
          ragEnabled: true,
          sandboxId: '${sandboxId}',
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Knowledge Graph Search
      if (url.pathname === '/knowledge/search') {
        const { query } = await request.json()

        const vectorResults = await env.VECTORIZE.query(query, {
          filter: { userId: '${vectorConfig.userId}', graphId: '${vectorConfig.graphId}' },
          topK: 10
        })

        return new Response(JSON.stringify({
          results: vectorResults.matches.map(match => ({
            nodeId: match.metadata.nodeId,
            label: match.metadata.nodeLabel,
            content: match.metadata.nodeContent,
            score: match.score
          })),
          total: vectorResults.matches.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Original extracted code functionality
      if (url.pathname === '/execute') {
        ${userCode}

        return new Response(JSON.stringify({
          message: 'Extracted code executed successfully',
          sandboxId: '${sandboxId}'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          sandboxId: '${sandboxId}',
          ragEnabled: true,
          vectorIndex: '${vectorConfig.vectorIndex}',
          createdAt: '${new Date().toISOString()}'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({
        message: 'RAG Sandbox Worker',
        endpoints: ['/rag/query', '/knowledge/search', '/execute', '/health'],
        sandboxId: '${sandboxId}'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        sandboxId: '${sandboxId}'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }
}
    `.trim()
  }
}

// Request handlers
const handleAnalyzeGraph = async (request, env) => {
  try {
    const { graphData } = await request.json()

    if (!graphData || !graphData.nodes) {
      return createErrorResponse('Invalid graph data', 400)
    }

    const analysis = RAGAnalyzer.analyze(graphData)

    return createResponse(
      JSON.stringify({
        success: true,
        analysis: {
          platform: analysis.platform,
          hasExecutableContent: analysis.hasExecutableContent,
          executableFiles: Object.keys(analysis.files),
          ragContent: analysis.ragContent.length,
          totalNodes: analysis.totalNodes,
        },
        extractedFiles: analysis.files,
        ragContent: analysis.ragContent,
      }),
    )
  } catch (error) {
    return createErrorResponse(`Analysis failed: ${error.message}`, 500)
  }
}

const handleCreateRAGIndex = async (request, env) => {
  try {
    const { graphData, graphId, userId } = await request.json()

    if (!graphData || !graphId || !userId) {
      return createErrorResponse('Missing required fields: graphData, graphId, userId', 400)
    }

    // Analyze graph for content
    const analysis = RAGAnalyzer.analyze(graphData)

    // Create vector embeddings
    const vectorResult = await RAGIndexer.createVectorEmbeddings(
      analysis.ragContent,
      graphId,
      userId,
      env,
    )

    return createResponse(
      JSON.stringify({
        success: true,
        indexId: vectorResult.vectorIndex,
        indexed: vectorResult.indexed,
        extractedCode: analysis.files,
        hasExecutableContent: analysis.hasExecutableContent,
      }),
    )
  } catch (error) {
    return createErrorResponse(`RAG indexing failed: ${error.message}`, 500)
  }
}

const handleCreateRAGSandbox = async (request, env) => {
  try {
    const { indexId, extractedCode, userId, graphId } = await request.json()

    if (!indexId || !userId || !graphId) {
      return createErrorResponse('Missing required fields: indexId, userId, graphId', 400)
    }

    const vectorConfig = {
      userId,
      graphId,
      vectorIndex: indexId,
    }

    const extractedData = {
      platform: 'cloudflare-workers',
      files: extractedCode || {},
    }

    const sandbox = await RAGSandboxDeployer.createRAGSandbox(extractedData, vectorConfig, env)

    return createResponse(
      JSON.stringify({
        success: true,
        sandbox,
      }),
    )
  } catch (error) {
    return createErrorResponse(`Sandbox creation failed: ${error.message}`, 500)
  }
}

const handleListSandboxes = async (request, env) => {
  try {
    const keys = await env.SANDBOX_KV.list({ prefix: 'sandbox:' })
    const sandboxes = []

    for (const key of keys.keys) {
      const metadata = await env.SANDBOX_KV.get(key.name)
      if (metadata) {
        sandboxes.push(JSON.parse(metadata))
      }
    }

    return createResponse(
      JSON.stringify({
        success: true,
        sandboxes: sandboxes.filter((s) => s.status === 'active'),
      }),
    )
  } catch (error) {
    return createErrorResponse(`Failed to list sandboxes: ${error.message}`, 500)
  }
}

// Main worker export
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    console.log(`[RAG Manager] ${request.method} ${url.pathname}`)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response('', { status: 204, headers: corsHeaders })
    }

    try {
      switch (url.pathname) {
        case '/analyze-graph':
          return await handleAnalyzeGraph(request, env)

        case '/create-rag-index':
          return await handleCreateRAGIndex(request, env)

        case '/create-rag-sandbox':
          return await handleCreateRAGSandbox(request, env)

        case '/list-sandboxes':
          return await handleListSandboxes(request, env)

        case '/health':
          return createResponse(
            JSON.stringify({
              status: 'healthy',
              service: 'rag-manager-worker',
              timestamp: new Date().toISOString(),
            }),
          )

        default:
          return createErrorResponse('Endpoint not found', 404)
      }
    } catch (error) {
      console.error('[RAG Manager] Unhandled error:', error)
      return createErrorResponse('Internal server error', 500)
    }
  },
}
