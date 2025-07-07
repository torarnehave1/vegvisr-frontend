// @name vector-search-worker
// @description Vector search and AI-powered knowledge graph discovery system
// @version 1.0
// @author Tor Arne Håve
// @license MIT
// @deployment https://vector-search-worker.torarnehave.workers.dev

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token, x-user-email',
}

// Utility functions
const createResponse = (body, status = 200, headers = {}) => {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...headers },
  })
}

const createErrorResponse = (message, status) => {
  console.error(`[Vector Search] Error: ${message}`)
  return createResponse(JSON.stringify({ error: message }), status)
}

// Content hash utility
async function hashContent(content) {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Content extraction for vectorization
async function extractContentForVectorization(graphData) {
  const contentChunks = []

  // 1. Graph-level content (metadata)
  const graphContent = {
    type: 'graph_summary',
    graphId: graphData.id,
    content: [
      graphData.metadata?.title || '',
      graphData.metadata?.description || '',
      graphData.metadata?.category || '',
    ]
      .filter(Boolean)
      .join(' '),
    metadata: {
      title: graphData.metadata?.title,
      createdBy: graphData.metadata?.createdBy,
      categories: graphData.metadata?.category?.split('#') || [],
    },
  }

  if (graphContent.content.trim()) {
    contentChunks.push(graphContent)
  }

  // 2. Node-level content
  if (graphData.nodes && Array.isArray(graphData.nodes)) {
    graphData.nodes.forEach((node) => {
      if (node.visible !== false) {
        // Node label as separate searchable content
        if (node.label) {
          contentChunks.push({
            type: 'node_label',
            graphId: graphData.id,
            nodeId: node.id,
            content: node.label,
            metadata: {
              nodeType: node.type,
              nodeColor: node.color,
            },
          })
        }

        // Node info content (the rich content)
        if (node.info) {
          contentChunks.push({
            type: 'node_content',
            graphId: graphData.id,
            nodeId: node.id,
            content: typeof node.info === 'string' ? node.info : JSON.stringify(node.info),
            metadata: {
              nodeLabel: node.label,
              nodeType: node.type,
              contentType: typeof node.info === 'string' ? 'text' : 'structured',
            },
          })
        }
      }
    })
  }

  return contentChunks
}

// Create truncated vector ID to ensure < 64 bytes
async function createTruncatedVectorId(graphId, contentType, nodeId) {
  // Calculate max lengths to stay under 64 bytes
  const maxLength = 63 // Leave 1 byte buffer
  const separators = 2 // Two underscores

  // Prioritize graphId and contentType, truncate nodeId if needed
  const graphIdPart = graphId.substring(0, 20) // Keep first 20 chars of graphId
  const contentTypePart = contentType.substring(0, 15) // Keep first 15 chars of contentType

  // Calculate remaining space for nodeId
  const usedLength = graphIdPart.length + contentTypePart.length + separators
  const remainingLength = maxLength - usedLength

  let nodeIdPart = nodeId
  if (nodeId.length > remainingLength) {
    // If nodeId is too long, use first 8 chars + hash of full nodeId
    const encoder = new TextEncoder()
    const data = encoder.encode(nodeId)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const shortHash = hashArray
      .slice(0, 4)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    nodeIdPart = nodeId.substring(0, Math.min(8, remainingLength - 8)) + shortHash
  }

  const vectorId = `${graphIdPart}_${contentTypePart}_${nodeIdPart}`

  // Validate length
  if (vectorId.length > 63) {
    console.warn(`[Vector Search] Generated ID still too long (${vectorId.length}): ${vectorId}`)
  }

  return vectorId
}

// Vector generation
async function generateVectors(contentChunks, env) {
  const vectors = []

  for (const chunk of contentChunks) {
    try {
      // Generate embedding using Workers AI
      const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: chunk.content,
      })

      // Create vector record with truncated ID to ensure < 64 bytes
      const vectorId = await createTruncatedVectorId(
        chunk.graphId,
        chunk.type,
        chunk.nodeId || 'graph',
      )
      vectors.push({
        id: vectorId,
        values: embedding.data[0], // The actual vector (768 dimensions for BGE model)
        metadata: {
          graphId: chunk.graphId,
          nodeId: chunk.nodeId,
          contentType: chunk.type,
          originalContent: chunk.content.substring(0, 500), // Store snippet
          originalNodeId: chunk.nodeId, // Preserve original node ID for reference
          ...chunk.metadata,
          createdAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      console.error(`[Vector Search] Failed to vectorize content for ${chunk.graphId}:`, error)
    }
  }

  return vectors
}

// Main handlers
async function handleIndexGraph(request, env) {
  try {
    const { graphId, graphData, action = 'upsert' } = await request.json()

    if (!graphId) {
      return createErrorResponse('Missing graphId', 400)
    }

    console.log(`[Vector Search] ${action} indexing graph: ${graphId}`)

    // Check if already vectorized (unless forcing re-index)
    if (action !== 'force') {
      const existing = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM vector_embeddings WHERE graph_id = ?`,
      )
        .bind(graphId)
        .first()

      if (existing.count > 0) {
        return createResponse(
          JSON.stringify({
            success: true,
            message: `Graph already vectorized with ${existing.count} vectors`,
            vectorsCreated: 0,
            graphId: graphId,
            alreadyVectorized: true,
          }),
        )
      }
    }

    // If graphData is provided, use it; otherwise fetch it
    let targetGraphData = graphData
    if (!targetGraphData) {
      console.log(`[Vector Search] Fetching graph data for: ${graphId}`)
      const graphResponse = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`)

      if (!graphResponse.ok) {
        return createErrorResponse(`Failed to fetch graph data: ${graphResponse.status}`, 500)
      }

      targetGraphData = await graphResponse.json()
      console.log(`[Vector Search] Fetched graph with ${targetGraphData.nodes?.length || 0} nodes`)
    }

    // Extract content for vectorization
    const contentChunks = await extractContentForVectorization(targetGraphData)

    if (contentChunks.length === 0) {
      return createResponse(
        JSON.stringify({
          success: true,
          message: 'No content to vectorize',
          vectorsCreated: 0,
        }),
      )
    }

    // Generate vectors
    const vectors = await generateVectors(contentChunks, env)

    if (vectors.length === 0) {
      return createResponse(
        JSON.stringify({
          success: false,
          message: 'Failed to generate vectors',
          vectorsCreated: 0,
        }),
      )
    }

    // Store vectors in Vectorize
    await env.VECTORIZE.upsert(vectors)

    // Store metadata in database
    for (const vector of vectors) {
      const contentHash = await hashContent(vector.metadata.originalContent)

      await env.DB.prepare(
        `
        INSERT OR REPLACE INTO vector_embeddings (
          id, graph_id, node_id, embedding_type, content_hash, content_preview,
          vector_id, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
        .bind(
          vector.id,
          vector.metadata.graphId,
          vector.metadata.nodeId || null,
          vector.metadata.contentType,
          contentHash,
          vector.metadata.originalContent,
          vector.id,
          JSON.stringify(vector.metadata),
        )
        .run()
    }

    return createResponse(
      JSON.stringify({
        success: true,
        message: `Successfully indexed ${vectors.length} content chunks`,
        vectorsCreated: vectors.length,
        graphId: graphId,
        contentChunks: contentChunks.length,
      }),
    )
  } catch (error) {
    console.error('[Vector Search] Error indexing graph:', error)
    return createErrorResponse(`Failed to index graph: ${error.message}`, 500)
  }
}

async function handleHybridSearch(request, env) {
  try {
    const { query, searchType = 'hybrid', limit = 10 } = await request.json()

    if (!query) {
      return createErrorResponse('Query is required', 400)
    }

    console.log(`[Vector Search] Performing ${searchType} search: "${query}"`)
    const startTime = Date.now()

    let results = []

    if (searchType === 'vector' || searchType === 'hybrid') {
      // Generate query embedding
      const queryEmbedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: query,
      })

      // DEBUG: Log the embedding response structure
      console.log(
        '[Vector Search] Query embedding response:',
        JSON.stringify({
          hasData: !!queryEmbedding.data,
          dataLength: queryEmbedding.data?.length,
          firstElementLength: queryEmbedding.data?.[0]?.length,
          responseKeys: Object.keys(queryEmbedding),
        }),
      )

      // Extract vector from response (handle different response formats)
      let queryVector = null
      if (queryEmbedding.data && queryEmbedding.data[0]) {
        queryVector = queryEmbedding.data[0]
      } else if (queryEmbedding.result && queryEmbedding.result.data) {
        queryVector = queryEmbedding.result.data[0]
      } else if (Array.isArray(queryEmbedding)) {
        queryVector = queryEmbedding[0]
      }

      if (!queryVector || queryVector.length === 0) {
        console.error('[Vector Search] Failed to extract query vector from AI response')
        return createErrorResponse('Failed to generate query vector', 500)
      }

      console.log(`[Vector Search] Query vector generated: ${queryVector.length} dimensions`)

      // DEFENSIVE LOGGING: Validate vector before Vectorize query
      if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
        console.error('[Vector Search] CRITICAL: Query vector is invalid before Vectorize query:', {
          isArray: Array.isArray(queryVector),
          length: queryVector?.length,
          type: typeof queryVector,
        })
        return createErrorResponse('Invalid query vector generated', 500)
      }

      // Log first few vector values to verify content
      console.log('[Vector Search] Vector preview:', {
        length: queryVector.length,
        firstValues: queryVector.slice(0, 5),
        lastValues: queryVector.slice(-5),
        hasNaN: queryVector.some((v) => isNaN(v)),
        hasNull: queryVector.some((v) => v === null || v === undefined),
      })

      // Check if we have any vectors to search
      const vectorCount = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM vector_embeddings`,
      ).first()

      if (vectorCount.count === 0) {
        console.log('[Vector Search] No vectors found in database - need to run reindexing first')
        return createResponse(
          JSON.stringify({
            query,
            searchType: 'keyword', // Fall back to keyword search
            results: [],
            totalResults: 0,
            responseTime: Date.now() - startTime,
            message: 'No vectors found - run reindexing first to enable vector search',
            suggestions: [
              'Run POST /reindex-all to vectorize your content',
              'Use keyword search for now',
            ],
          }),
        )
      }

      // Vector search with additional error handling
      console.log('[Vector Search] Calling Vectorize query with vector length:', queryVector.length)
      const vectorResults = await env.VECTORIZE.query(queryVector, {
        topK: limit * 2, // Get more results for hybrid ranking
        returnMetadata: 'all',
      })

      console.log('[Vector Search] Vectorize query completed:', {
        matchesCount: vectorResults.matches?.length || 0,
        totalCount: vectorResults.count || 0,
      })

      // Group results by graph
      const graphResults = {}
      vectorResults.matches.forEach((match) => {
        const graphId = match.metadata.graphId
        if (!graphResults[graphId]) {
          graphResults[graphId] = {
            graphId,
            matches: [],
            maxScore: 0,
          }
        }
        graphResults[graphId].matches.push(match)
        graphResults[graphId].maxScore = Math.max(graphResults[graphId].maxScore, match.score)
      })

      // Convert to results format
      results = Object.values(graphResults).map((result) => ({
        graphId: result.graphId,
        relevanceScore: result.maxScore,
        matchType: 'vector',
        matchedContent: result.matches.map((m) => ({
          nodeId: m.metadata.nodeId,
          contentType: m.metadata.contentType,
          snippet: m.metadata.originalContent,
          score: m.score,
        })),
      }))
    }

    if (searchType === 'keyword' || searchType === 'hybrid') {
      // Keyword search fallback (call existing API)
      try {
        const keywordResponse = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
        const allGraphs = await keywordResponse.json()

        const query_lower = query.toLowerCase()
        const keywordResults = allGraphs.results
          .filter((graph) => {
            return (
              graph.metadata?.title?.toLowerCase().includes(query_lower) ||
              graph.metadata?.description?.toLowerCase().includes(query_lower) ||
              graph.nodes?.some(
                (node) =>
                  node.label?.toLowerCase().includes(query_lower) ||
                  (typeof node.info === 'string' && node.info.toLowerCase().includes(query_lower)),
              )
            )
          })
          .slice(0, limit)

        // Merge with vector results or use as standalone
        if (searchType === 'keyword') {
          results = keywordResults.map((graph) => ({
            graphId: graph.id,
            relevanceScore: 0.8, // Default keyword relevance
            matchType: 'keyword',
            graph: graph,
          }))
        }
      } catch (error) {
        console.error('[Vector Search] Keyword search failed:', error)
      }
    }

    // Sort by relevance and limit results
    results.sort((a, b) => b.relevanceScore - a.relevanceScore)
    results = results.slice(0, limit)

    const responseTime = Date.now() - startTime

    // Log search analytics
    try {
      await env.DB.prepare(
        `
        INSERT INTO search_analytics (
          id, query, search_type, results_count, response_time_ms, metadata
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
        .bind(
          crypto.randomUUID(),
          query,
          searchType,
          results.length,
          responseTime,
          JSON.stringify({ timestamp: new Date().toISOString() }),
        )
        .run()
    } catch (analyticsError) {
      console.error('[Vector Search] Analytics logging failed:', analyticsError)
    }

    return createResponse(
      JSON.stringify({
        query,
        searchType,
        results,
        totalResults: results.length,
        responseTime: responseTime,
        suggestions:
          results.length === 0
            ? ['Try different keywords', 'Use more general terms', 'Check spelling']
            : [],
      }),
    )
  } catch (error) {
    console.error('[Vector Search] Error performing search:', error)
    return createErrorResponse(`Search failed: ${error.message}`, 500)
  }
}

async function handleReindexAll(request, env) {
  try {
    console.log('[Vector Search] Starting batch reindexing...')

    // Fetch list of graphs
    const allGraphsResponse = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
    const allGraphs = await allGraphsResponse.json()
    const graphList = allGraphs.results || allGraphs || []

    let processedCount = 0
    let errorCount = 0
    const batchSize = 1 // Process one at a time to avoid batch failures

    for (let i = 0; i < graphList.length; i += batchSize) {
      const batch = graphList.slice(i, i + batchSize)

      // Process sequentially to avoid Promise.all failure propagation
      for (const graphSummary of batch) {
        try {
          // Check if already indexed
          const existing = await env.DB.prepare(
            `SELECT id FROM vector_embeddings WHERE graph_id = ? LIMIT 1`,
          )
            .bind(graphSummary.id)
            .first()

          if (!existing) {
            console.log(`[Vector Search] Processing graph ${graphSummary.id}...`)
            // Fetch the full graph content
            const fullGraphResponse = await fetch(
              `https://knowledge.vegvisr.org/getknowgraph?id=${graphSummary.id}`,
            )

            if (fullGraphResponse.ok) {
              const fullGraph = await fullGraphResponse.json()
              const contentChunks = await extractContentForVectorization(fullGraph)

              if (contentChunks.length > 0) {
                const vectors = await generateVectors(contentChunks, env)

                if (vectors.length > 0) {
                  try {
                    await env.VECTORIZE.upsert(vectors)

                    // Store metadata with better error handling
                    let vectorsStored = 0
                    for (const vector of vectors) {
                      try {
                        const contentHash = await hashContent(vector.metadata.originalContent)

                        await env.DB.prepare(
                          `
                          INSERT INTO vector_embeddings (
                            id, graph_id, node_id, embedding_type, content_hash,
                            content_preview, vector_id, metadata
                          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `,
                        )
                          .bind(
                            vector.id,
                            vector.metadata.graphId,
                            vector.metadata.nodeId || null,
                            vector.metadata.contentType,
                            contentHash,
                            vector.metadata.originalContent.substring(0, 200), // Truncate to avoid size issues
                            vector.id,
                            JSON.stringify(vector.metadata),
                          )
                          .run()
                        vectorsStored++
                      } catch (dbError) {
                        console.error(
                          `[Vector Search] Database error for vector ${vector.id}:`,
                          dbError.message,
                        )
                        // Continue with other vectors
                      }
                    }

                    console.log(
                      `[Vector Search] Indexed graph ${graphSummary.id}: ${vectorsStored}/${vectors.length} vectors stored`,
                    )
                    processedCount++
                  } catch (vectorError) {
                    console.error(
                      `[Vector Search] Vectorize error for graph ${graphSummary.id}:`,
                      vectorError.message,
                    )
                    errorCount++
                  }
                }
              } else {
                console.log(`[Vector Search] No content to index in graph ${graphSummary.id}`)
              }
            } else {
              const errorText = await fullGraphResponse.text()
              console.error(
                `[Vector Search] Failed to fetch graph ${graphSummary.id}: ${fullGraphResponse.status} - ${errorText.substring(0, 200)}`,
              )
              errorCount++
            }
          } else {
            console.log(`[Vector Search] Graph ${graphSummary.id} already indexed, skipping`)
          }
        } catch (error) {
          console.error(`[Vector Search] Failed to process graph ${graphSummary.id}:`, error)
          errorCount++
        }
      }

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return createResponse(
      JSON.stringify({
        success: true,
        message: 'Batch reindexing complete',
        processed: processedCount,
        errors: errorCount,
        total: graphList.length,
        successRate: `${Math.round((processedCount / graphList.length) * 100)}%`,
        details: {
          totalGraphs: graphList.length,
          successful: processedCount,
          failed: errorCount,
          skipped: graphList.length - processedCount - errorCount,
        },
      }),
    )
  } catch (error) {
    console.error('[Vector Search] Error in batch reindexing:', error)
    return createErrorResponse(`Batch reindexing failed: ${error.message}`, 500)
  }
}

async function handleAnalyzeContent(request, env) {
  try {
    // Analyze existing content for vectorization planning
    const allGraphsResponse = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
    const allGraphs = await allGraphsResponse.json()

    // DEBUG: Log the structure to understand the API response
    console.log(
      '[Vector Search] API Response structure:',
      JSON.stringify(
        {
          hasResults: !!allGraphs.results,
          resultsLength: allGraphs.results?.length,
          firstGraphKeys: allGraphs.results?.[0]
            ? Object.keys(allGraphs.results[0])
            : 'no first graph',
          firstGraphNodes: allGraphs.results?.[0]?.nodes?.length || 'no nodes found',
          sampleGraph: allGraphs.results?.[0]
            ? JSON.stringify(allGraphs.results[0]).substring(0, 500)
            : 'no sample',
        },
        null,
        2,
      ),
    )

    const analysis = {
      totalGraphs: allGraphs.results?.length || 0,
      totalNodes: 0,
      contentTypes: {},
      estimatedVectors: 0,
      sampleContent: [],
      debugInfo: {
        apiStructure: {
          hasResults: !!allGraphs.results,
          firstGraphKeys: allGraphs.results?.[0] ? Object.keys(allGraphs.results[0]) : [],
          sampleResponse: allGraphs.results?.[0]
            ? JSON.stringify(allGraphs.results[0]).substring(0, 200)
            : null,
        },
      },
    }

    // The list API only returns summaries, we need to fetch individual graphs
    const graphList = allGraphs.results || allGraphs || []

    console.log(`[Vector Search] Found ${graphList.length} graphs, fetching sample for analysis...`)

    // Sample analysis - fetch first 5 graphs to understand content structure
    const sampleSize = Math.min(5, graphList.length)

    for (let i = 0; i < sampleSize; i++) {
      const graphSummary = graphList[i]

      try {
        // Fetch the full graph content
        console.log(`[Vector Search] Fetching graph ${graphSummary.id}...`)
        const fullGraphResponse = await fetch(
          `https://knowledge.vegvisr.org/getknowgraph?id=${graphSummary.id}`,
        )

        if (fullGraphResponse.ok) {
          const fullGraph = await fullGraphResponse.json()
          const nodes = fullGraph.nodes || []

          analysis.totalNodes += nodes.length

          nodes.forEach((node) => {
            if (node.info) {
              const contentType = typeof node.info === 'string' ? 'text' : 'structured'
              analysis.contentTypes[contentType] = (analysis.contentTypes[contentType] || 0) + 1
              analysis.estimatedVectors += 1

              if (analysis.sampleContent.length < 5) {
                analysis.sampleContent.push({
                  graphId: fullGraph.id,
                  nodeId: node.id,
                  nodeLabel: node.label,
                  contentPreview: (node.info || '').toString().substring(0, 100) + '...',
                  contentType,
                })
              }
            }
          })

          console.log(`[Vector Search] Graph ${graphSummary.id}: ${nodes.length} nodes`)
        } else {
          const errorText = await fullGraphResponse.text()
          console.error(
            `[Vector Search] Failed to fetch graph ${graphSummary.id}: ${fullGraphResponse.status} - ${errorText.substring(0, 200)}`,
          )
        }
      } catch (error) {
        console.error(`[Vector Search] Error fetching graph ${graphSummary.id}:`, error)
      }
    }

    // Estimate total content based on sample
    if (sampleSize > 0 && analysis.totalNodes > 0) {
      const avgNodesPerGraph = analysis.totalNodes / sampleSize
      const avgVectorsPerGraph = analysis.estimatedVectors / sampleSize

      analysis.estimatedTotalNodes = Math.round(avgNodesPerGraph * graphList.length)
      analysis.estimatedTotalVectors = Math.round(avgVectorsPerGraph * graphList.length)

      analysis.debugInfo.sampleAnalysis = {
        sampleSize: sampleSize,
        avgNodesPerGraph: Math.round(avgNodesPerGraph * 100) / 100,
        avgVectorsPerGraph: Math.round(avgVectorsPerGraph * 100) / 100,
        projectedTotal: `${analysis.estimatedTotalNodes} nodes, ${analysis.estimatedTotalVectors} vectors`,
      }
    }

    // Check current vectorization status
    const vectorizedCount = await env.DB.prepare(
      `
      SELECT COUNT(DISTINCT graph_id) as count FROM vector_embeddings
    `,
    ).first()

    analysis.currentlyVectorized = vectorizedCount?.count || 0
    analysis.needsVectorization = analysis.totalGraphs - analysis.currentlyVectorized

    return createResponse(JSON.stringify(analysis))
  } catch (error) {
    console.error('[Vector Search] Error analyzing content:', error)
    return createErrorResponse(`Content analysis failed: ${error.message}`, 500)
  }
}

// Main worker export
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname, searchParams } = url

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
      console.log(`[Vector Search] ${request.method} ${pathname}`)

      // Route handlers
      switch (pathname) {
        case '/index-graph':
          if (request.method === 'POST') {
            return await handleIndexGraph(request, env)
          }
          break

        case '/search':
          if (request.method === 'POST') {
            return await handleHybridSearch(request, env)
          }
          break

        case '/reindex-all':
          if (request.method === 'POST') {
            return await handleReindexAll(request, env)
          }
          break

        case '/analyze-content':
          if (request.method === 'GET') {
            return await handleAnalyzeContent(request, env)
          }
          break

        case '/test-embedding':
          if (request.method === 'POST') {
            const { text = 'test query' } = await request.json()
            const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text })
            return createResponse(
              JSON.stringify({
                input: text,
                embedding: {
                  hasData: !!embedding.data,
                  dataLength: embedding.data?.length,
                  firstElementLength: embedding.data?.[0]?.length,
                  responseKeys: Object.keys(embedding),
                  sample: embedding.data?.[0]?.slice(0, 5), // First 5 dimensions
                },
              }),
            )
          }
          break

        case '/debug-graph':
          if (request.method === 'POST') {
            const { graphId } = await request.json()
            if (!graphId) {
              return createErrorResponse('Graph ID is required', 400)
            }

            try {
              const fullGraphResponse = await fetch(
                `https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`,
              )
              const responseText = await fullGraphResponse.text()

              return createResponse(
                JSON.stringify({
                  graphId,
                  status: fullGraphResponse.status,
                  statusText: fullGraphResponse.statusText,
                  success: fullGraphResponse.ok,
                  responseSize: responseText.length,
                  contentPreview: responseText.substring(0, 500),
                  isJson: (() => {
                    try {
                      JSON.parse(responseText)
                      return true
                    } catch {
                      return false
                    }
                  })(),
                  timestamp: new Date().toISOString(),
                }),
              )
            } catch (error) {
              return createResponse(
                JSON.stringify({
                  graphId,
                  error: error.message,
                  stack: error.stack,
                  timestamp: new Date().toISOString(),
                }),
              )
            }
          }
          break

        case '/reindex-sample':
          if (request.method === 'POST') {
            const { count = 5 } = await request.json()

            try {
              const allGraphsResponse = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
              const allGraphs = await allGraphsResponse.json()
              const graphList = allGraphs.results || []

              const sampleGraphs = graphList.slice(0, count)

              let processedCount = 0
              let errorCount = 0

              for (const graphSummary of sampleGraphs) {
                try {
                  console.log(`[Vector Search] Processing sample graph ${graphSummary.id}...`)

                  // Check if already indexed
                  const existing = await env.DB.prepare(
                    `SELECT id FROM vector_embeddings WHERE graph_id = ? LIMIT 1`,
                  )
                    .bind(graphSummary.id)
                    .first()

                  if (!existing) {
                    const fullGraphResponse = await fetch(
                      `https://knowledge.vegvisr.org/getknowgraph?id=${graphSummary.id}`,
                    )

                    if (fullGraphResponse.ok) {
                      const fullGraph = await fullGraphResponse.json()
                      const contentChunks = await extractContentForVectorization(fullGraph)

                      if (contentChunks.length > 0) {
                        const vectors = await generateVectors(contentChunks, env)

                        if (vectors.length > 0) {
                          await env.VECTORIZE.upsert(vectors)

                          // Store metadata
                          for (const vector of vectors) {
                            const contentHash = await hashContent(vector.metadata.originalContent)
                            await env.DB.prepare(
                              `INSERT INTO vector_embeddings (
                                id, graph_id, node_id, embedding_type, content_hash,
                                content_preview, vector_id, metadata
                              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            )
                              .bind(
                                vector.id,
                                vector.metadata.graphId,
                                vector.metadata.nodeId || null,
                                vector.metadata.contentType,
                                contentHash,
                                vector.metadata.originalContent.substring(0, 200),
                                vector.id,
                                JSON.stringify(vector.metadata),
                              )
                              .run()
                          }

                          console.log(
                            `[Vector Search] Sample indexed ${graphSummary.id}: ${vectors.length} vectors`,
                          )
                          processedCount++
                        }
                      }
                    } else {
                      const errorText = await fullGraphResponse.text()
                      console.error(
                        `[Vector Search] Failed to fetch sample graph ${graphSummary.id}: ${fullGraphResponse.status}`,
                      )
                      errorCount++
                    }
                  } else {
                    console.log(`[Vector Search] Sample graph ${graphSummary.id} already indexed`)
                  }
                } catch (error) {
                  console.error(
                    `[Vector Search] Error processing sample graph ${graphSummary.id}:`,
                    error,
                  )
                  errorCount++
                }
              }

              return createResponse(
                JSON.stringify({
                  success: true,
                  message: 'Sample reindexing complete',
                  processed: processedCount,
                  errors: errorCount,
                  total: sampleGraphs.length,
                }),
              )
            } catch (error) {
              return createErrorResponse(`Sample reindexing failed: ${error.message}`, 500)
            }
          }
          break

        case '/get-graph-ids':
          if (request.method === 'GET') {
            try {
              const allGraphsResponse = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
              const allGraphs = await allGraphsResponse.json()
              const graphList = allGraphs.results || []

              return createResponse(
                JSON.stringify({
                  totalGraphs: graphList.length,
                  sampleIds: graphList.slice(0, 10).map((g) => ({
                    id: g.id,
                    title: g.title || 'No title',
                    createdAt: g.created_at || g.createdAt || 'Unknown',
                  })),
                  allIds: graphList.map((g) => g.id),
                }),
              )
            } catch (error) {
              return createErrorResponse(`Failed to fetch graph IDs: ${error.message}`, 500)
            }
          }
          break

        case '/vectorization-status':
          if (request.method === 'POST') {
            const { graphIds = [] } = await request.json()

            if (!Array.isArray(graphIds) || graphIds.length === 0) {
              return createErrorResponse('Graph IDs array is required', 400)
            }

            try {
              // Build placeholders for the IN clause
              const placeholders = graphIds.map(() => '?').join(',')

              const vectorizedGraphs = await env.DB.prepare(
                `SELECT DISTINCT graph_id, COUNT(*) as vector_count
                 FROM vector_embeddings
                 WHERE graph_id IN (${placeholders})
                 GROUP BY graph_id`,
              )
                .bind(...graphIds)
                .all()

              // Create status map
              const statusMap = {}
              graphIds.forEach((id) => {
                statusMap[id] = { isVectorized: false, vectorCount: 0 }
              })

              vectorizedGraphs.results.forEach((row) => {
                statusMap[row.graph_id] = {
                  isVectorized: true,
                  vectorCount: row.vector_count,
                }
              })

              return createResponse(
                JSON.stringify({
                  success: true,
                  statusMap,
                  totalGraphs: graphIds.length,
                  vectorizedCount: vectorizedGraphs.results.length,
                }),
              )
            } catch (error) {
              return createErrorResponse(
                `Failed to check vectorization status: ${error.message}`,
                500,
              )
            }
          }
          break

        case '/test-single-graph':
          if (request.method === 'POST') {
            const { graphId } = await request.json()
            if (!graphId) {
              return createErrorResponse('Graph ID is required', 400)
            }

            try {
              const result = {
                graphId,
                timestamp: new Date().toISOString(),
                steps: {},
              }

              // Step 1: Fetch the graph
              const fullGraphResponse = await fetch(
                `https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`,
              )
              result.steps.fetch = {
                status: fullGraphResponse.status,
                success: fullGraphResponse.ok,
                size: 0,
              }

              if (!fullGraphResponse.ok) {
                const errorText = await fullGraphResponse.text()
                result.steps.fetch.error = errorText.substring(0, 200)
                return createResponse(JSON.stringify(result))
              }

              const fullGraph = await fullGraphResponse.json()
              result.steps.fetch.size = JSON.stringify(fullGraph).length
              result.steps.fetch.nodeCount = fullGraph.nodes?.length || 0

              // Step 2: Extract content
              const contentChunks = await extractContentForVectorization(fullGraph)
              result.steps.extraction = {
                chunksFound: contentChunks.length,
                sampleChunk: contentChunks[0] || null,
              }

              // Step 3: Generate vectors (if content exists)
              if (contentChunks.length > 0) {
                const vectors = await generateVectors(contentChunks.slice(0, 1), env) // Just test one
                result.steps.vectorization = {
                  vectorsGenerated: vectors.length,
                  vectorDimensions: vectors[0]?.values?.length || 0,
                  vectorStructure: vectors[0] ? Object.keys(vectors[0]) : [],
                  sampleVector: vectors[0]
                    ? {
                        id: vectors[0].id,
                        hasValues: !!vectors[0].values,
                        valuesLength: vectors[0].values?.length,
                        hasMetadata: !!vectors[0].metadata,
                      }
                    : null,
                }
              }

              return createResponse(JSON.stringify(result))
            } catch (error) {
              return createErrorResponse(`Single graph test failed: ${error.message}`, 500)
            }
          }
          break

        case '/health':
          return createResponse(
            JSON.stringify({
              status: 'healthy',
              service: 'vector-search-worker',
              timestamp: new Date().toISOString(),
            }),
          )

        default:
          return createErrorResponse('Endpoint not found', 404)
      }

      return createErrorResponse('Method not allowed', 405)
    } catch (error) {
      console.error('[Vector Search] Unhandled error:', error)
      return createErrorResponse('Internal server error', 500)
    }
  },
}
