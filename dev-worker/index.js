export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    console.log(`[Worker] Incoming request: ${request.method} ${request.url}`)

    if (request.method === 'OPTIONS') {
      console.log('[Worker] Handling OPTIONS request')
      return new Response('', { status: 204, headers: corsHeaders })
    }

    try {
      const url = new URL(request.url)
      const { pathname } = url

      console.log(`[Worker] Request pathname: ${pathname}`)

      const sanitizeGraphData = (graphData) => {
        const sanitize = (obj) =>
          Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [
              key,
              value === null
                ? ''
                : typeof value === 'object' && value !== null && !Array.isArray(value)
                  ? sanitize(value)
                  : value,
            ]),
          )

        return {
          ...graphData,
          nodes: graphData.nodes.map((node) => ({
            ...sanitize(node),
            position: node.position || { x: 0, y: 0 },
            imageWidth: node.imageWidth || '', // Ensure imageWidth is not null
            imageHeight: node.imageHeight || '', // Ensure imageHeight is not null
          })),
          edges: graphData.edges.map((edge) => ({
            ...sanitize(edge),
            label: edge.label || '', // Ensure label is not null
            type: edge.type || '', // Ensure type is not null
            info: edge.info || '', // Ensure info is not null
          })),
        }
      }

      if (pathname === '/saveknowgraph' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          console.log('[Worker] Request body:', requestBody)

          let { id, graphData } = requestBody

          // Generate an ID if it's missing
          if (!id) {
            id = `graph_${Date.now()}`
            console.log(`[Worker] Generated ID: ${id}`)
          }

          // Initialize graphData if missing
          if (!graphData) {
            console.warn(
              '[Worker] Missing graphData in request body. Initializing default graphData.',
            )
            graphData = {
              metadata: { title: '', description: '', createdBy: '' },
              nodes: [
                { data: { id: 'main', label: 'Main Node' } },
                { data: { id: 'first', label: 'First Node' } },
              ],
              edges: [{ data: { source: 'main', target: 'first' } }],
            }
          }

          // Ensure there are at least two nodes and one edge
          if (!graphData.nodes || graphData.nodes.length < 2) {
            console.log('[Worker] Adding default nodes "Main" and "First".')
            graphData.nodes = [
              { data: { id: 'main', label: 'Main Node' } },
              { data: { id: 'first', label: 'First Node' } },
            ]
          }
          if (!graphData.edges || graphData.edges.length === 0) {
            console.log('[Worker] Adding default edge between "Main" and "First".')
            graphData.edges = [{ data: { source: 'main', target: 'first' } }]
          }

          // Ensure metadata fields are included
          graphData.metadata = {
            title: requestBody.metadata?.title || '',
            description: requestBody.metadata?.description || '',
            createdBy: requestBody.metadata?.createdBy || '',
          }

          console.log('[Worker] Final graphData:', graphData)

          console.log('[Worker] Saving knowledge graph to database')

          if (!env.vegvisr_org || !env.vegvisr_org.prepare) {
            console.error('[Worker] vegvisr_org is not defined or improperly configured.')
            return new Response(
              JSON.stringify({ error: 'Database connection is not available.' }),
              {
                status: 500,
                headers: corsHeaders,
              },
            )
          }

          const query = `INSERT INTO knowledge_graphs (id, title, description, created_by, data) VALUES (?, ?, ?, ?, ?)`
          await env.vegvisr_org
            .prepare(query)
            .bind(
              id,
              graphData.metadata.title,
              graphData.metadata.description,
              graphData.metadata.createdBy,
              JSON.stringify(graphData),
            )
            .run()

          console.log('[Worker] Knowledge graph saved successfully')
          return new Response(
            JSON.stringify({ message: 'Knowledge graph saved successfully', id }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error('[Worker] Error processing /saveknowgraph request:', error)
          return new Response(
            JSON.stringify({ error: 'Invalid JSON or server error', details: error.message }),
            {
              status: 500,
              headers: corsHeaders,
            },
          )
        }
      }

      if (pathname === '/updateknowgraph' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { id, graphData } = requestBody

          if (!id || !graphData) {
            return new Response(
              JSON.stringify({ error: 'Graph ID and graph data are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Updating graph with ID: ${id}`)

          const query = `UPDATE knowledge_graphs SET data = ? WHERE id = ?`
          await env.vegvisr_org.prepare(query).bind(JSON.stringify(graphData), id).run()

          console.log('[Worker] Graph updated successfully')
          return new Response(JSON.stringify({ message: 'Graph updated successfully', id }), {
            status: 200,
            headers: corsHeaders,
          })
        } catch (error) {
          console.error('[Worker] Error processing /updateknowgraph request:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getknowgraphs' && request.method === 'GET') {
        try {
          console.log('[Worker] Fetching list of knowledge graphs')

          const query = `SELECT id, title FROM knowledge_graphs`
          const results = await env.vegvisr_org.prepare(query).all()

          console.log('[Worker] Knowledge graphs fetched successfully')
          return new Response(JSON.stringify(results), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching knowledge graphs:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getknowgraph' && request.method === 'GET') {
        try {
          const id = url.searchParams.get('id')
          if (!id) {
            return new Response(JSON.stringify({ error: 'Graph ID is required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log(`[Worker] Fetching graph with ID: ${id}`)

          const query = `SELECT data FROM knowledge_graphs WHERE id = ?`
          const result = await env.vegvisr_org.prepare(query).bind(id).first()

          if (!result) {
            return new Response(JSON.stringify({ error: 'Graph not found.' }), {
              status: 404,
              headers: corsHeaders,
            })
          }

          const graphData = sanitizeGraphData(JSON.parse(result.data))
          graphData.nodes = graphData.nodes.map((node) => ({
            ...node,
            imageWidth: node.imageWidth || null, // Ensure imageWidth is included
            imageHeight: node.imageHeight || null, // Ensure imageHeight is included
          }))
          graphData.edges = graphData.edges.map(({ source, target }) => ({
            id: `${source}_${target}`, // Ensure edge ID is set
            source,
            target,
          }))

          console.log('[Worker] Graph fetched successfully')
          return new Response(JSON.stringify(graphData), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching graph:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/saveGraphWithHistory' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { id, graphData, override } = requestBody

          if (!id || !graphData) {
            return new Response(
              JSON.stringify({ error: 'Graph ID and graph data are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Saving graph with history for ID: ${id}`)

          // Fetch the current version of the graph
          const currentVersionQuery = `SELECT MAX(version) AS version FROM knowledge_graph_history WHERE graph_id = ?`
          const currentVersionResult = await env.vegvisr_org
            .prepare(currentVersionQuery)
            .bind(id)
            .first()
          const currentVersion = currentVersionResult?.version || 0

          // Check for version mismatch only if override is false
          if (!override && graphData.metadata.version !== currentVersion) {
            return new Response(
              JSON.stringify({
                error: 'Version mismatch. Please reload the latest version of the graph.',
                currentVersion,
              }),
              { status: 409, headers: corsHeaders },
            )
          }

          // Increment the version
          const newVersion = currentVersion + 1
          graphData.metadata.version = newVersion // Update the version in metadata

          // Ensure nodes include the bibl field
          const enrichedGraphData = {
            ...graphData,
            nodes: graphData.nodes.map((node) => ({
              ...node,
              bibl: Array.isArray(node.bibl) ? node.bibl : [], // Ensure bibl is included
              type: node.type || null, // Ensure type is included
              info: node.info || null, // Ensure info is included
              position: node.position || { x: 0, y: 0 }, // Ensure position is included
              imageWidth: node.imageWidth || null, // Include image-width
              imageHeight: node.imageHeight || null, // Include image-height
            })),
            edges: graphData.edges.map(({ source, target }) => ({
              id: `${source}_${target}`, // Ensure edge ID is set
              source,
              target,
            })),
          }

          // Insert the new version into the history table
          const insertHistoryQuery = `
            INSERT INTO knowledge_graph_history (id, graph_id, version, data)
            VALUES (?, ?, ?, ?)
          `
          await env.vegvisr_org
            .prepare(insertHistoryQuery)
            .bind(crypto.randomUUID(), id, newVersion, JSON.stringify(enrichedGraphData)) // Use crypto.randomUUID()
            .run()

          // Ensure no more than 20 versions are stored
          const countHistoryQuery = `SELECT COUNT(*) AS count FROM knowledge_graph_history WHERE graph_id = ?`
          const historyCountResult = await env.vegvisr_org
            .prepare(countHistoryQuery)
            .bind(id)
            .first()

          if (historyCountResult?.count > 20) {
            const deleteOldestQuery = `
              DELETE FROM knowledge_graph_history
              WHERE graph_id = ?
              AND version = (
                SELECT MIN(version)
                FROM knowledge_graph_history
                WHERE graph_id = ?
              )
            `
            await env.vegvisr_org.prepare(deleteOldestQuery).bind(id, id).run()
            console.log(`[Worker] Deleted oldest version for graph ID: ${id}`)
          }

          // Update the main graph table
          const updateGraphQuery = `
            UPDATE knowledge_graphs
            SET data = ?
            WHERE id = ?
          `
          await env.vegvisr_org
            .prepare(updateGraphQuery)
            .bind(JSON.stringify(enrichedGraphData), id)
            .run()

          console.log('[Worker] Graph with history saved successfully')
          return new Response(
            JSON.stringify({ message: 'Graph with history saved successfully', id, newVersion }),
            { status: 200, headers: corsHeaders },
          )
        } catch (error) {
          console.error('[Worker] Error processing /saveGraphWithHistory request:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getknowgraphhistory' && request.method === 'GET') {
        try {
          const graphId = url.searchParams.get('id')
          if (!graphId) {
            return new Response(JSON.stringify({ error: 'Graph ID is required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log(`[Worker] Fetching history for graph ID: ${graphId}`)

          const query = `
            SELECT version, timestamp
            FROM knowledge_graph_history
            WHERE graph_id = ?
            ORDER BY version DESC
          `
          const results = await env.vegvisr_org.prepare(query).bind(graphId).all()

          if (!results || results.length === 0) {
            return new Response(
              JSON.stringify({ error: `No history found for the given graph ID: ${graphId}.` }),
              {
                status: 404,
                headers: corsHeaders,
              },
            )
          }

          console.log('[Worker] History fetched successfully')
          return new Response(JSON.stringify({ graphId, history: results }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching graph history:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getknowgraphversion' && request.method === 'GET') {
        try {
          const graphId = url.searchParams.get('id')
          const version = url.searchParams.get('version')

          if (!graphId || !version) {
            return new Response(JSON.stringify({ error: 'Graph ID and version are required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log(`[Worker] Fetching version ${version} for graph ID: ${graphId}`)

          const query = `
            SELECT data
            FROM knowledge_graph_history
            WHERE graph_id = ? AND version = ?
          `
          const result = await env.vegvisr_org.prepare(query).bind(graphId, version).first()

          if (!result) {
            return new Response(
              JSON.stringify({
                error: `No data found for graph ID: ${graphId} and version: ${version}.`,
              }),
              { status: 404, headers: corsHeaders },
            )
          }

          const graphData = sanitizeGraphData(JSON.parse(result.data))
          graphData.nodes = graphData.nodes.map((node) => ({
            ...node,
            imageWidth: node.imageWidth || null, // Ensure imageWidth is included
            imageHeight: node.imageHeight || null, // Ensure imageHeight is included
          }))
          graphData.edges = graphData.edges.map(({ source, target }) => ({
            id: `${source}_${target}`, // Ensure edge ID is set
            source,
            target,
          }))

          console.log(`[Worker] Version ${version} for graph ID: ${graphId} fetched successfully`)
          return new Response(JSON.stringify(graphData), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching graph version:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      console.warn('[Worker] No matching route for pathname:', pathname)
      return new Response('Not Found', { status: 404, headers: corsHeaders })
    } catch (error) {
      console.error('[Worker] Unexpected error:', error)
      return new Response('Error: ' + error.message, { status: 500, headers: corsHeaders })
    }
  },
}
