import { createWorkersAI } from 'workers-ai-provider'
import { generateText } from 'ai'

/**
 * @typedef {Object} Env
 * @property {Ai} AI
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-user-role, X-API-Token, Accept, Origin',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
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
            Object.entries(obj)
              .filter(([, value]) => value !== null) // Exclude null values
              .map(([key, value]) => [
                key,
                typeof value === 'object' && value !== null && !Array.isArray(value)
                  ? sanitize(value)
                  : value,
              ]),
          )

        return {
          ...graphData,
          nodes: graphData.nodes.map((node) => ({
            ...sanitize(node),
            visible: node.visible !== false, // Default to true if not set
            position: node.position || { x: 0, y: 0 },
            imageWidth: node.imageWidth || null,
            imageHeight: node.imageHeight || null,
            path: node.path || null, // Ensure path is included
          })),
          edges: graphData.edges.map((edge) => {
            const sanitizedEdge = sanitize(edge)
            return {
              id: edge.id || `${edge.source}_${edge.target}`,
              source: edge.source,
              target: edge.target,
              ...(sanitizedEdge.label !== undefined && { label: sanitizedEdge.label }),
              ...(sanitizedEdge.type !== undefined && { type: sanitizedEdge.type }),
              ...(sanitizedEdge.info !== undefined && { info: sanitizedEdge.info }),
            }
          }),
        }
      }

      if (pathname === '/saveknowgraph' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          console.log('[Worker] Request body:', requestBody)

          let { id, graphData } = requestBody
          let newlyCreated = false

          // Generate an ID if it's missing
          if (!id) {
            id = `graph_${Date.now()}`
            console.log(`[Worker] Generated ID: ${id}`)
            newlyCreated = true
          }

          // Initialize graphData if missing
          if (!graphData) {
            console.warn(
              '[Worker] Missing graphData in request body. Initializing default graphData.',
            )
            graphData = {
              metadata: { title: '', description: '', createdBy: '' },
              nodes: [
                {
                  id: crypto.randomUUID(),
                  color: 'goldenrod',
                  label: 'Alpha',
                  type: null,
                  info: null,
                  bibl: [],
                  imageWidth: null,
                  imageHeight: null,
                  visible: true,
                },
                {
                  id: crypto.randomUUID(),
                  color: 'steelblue',
                  label: 'Hyper',
                  type: null,
                  info: null,
                  bibl: [],
                  imageWidth: null,
                  imageHeight: null,
                  visible: true,
                },
                {
                  id: crypto.randomUUID(),
                  color: 'lightcoral',
                  label: 'Vector',
                  type: null,
                  info: null,
                  bibl: [],
                  imageWidth: null,
                  imageHeight: null,
                  visible: true,
                },
              ],
            }
            newlyCreated = true
          }

          // Ensure there are at least two nodes and one edge
          if (!graphData.nodes || graphData.nodes.length < 2) {
            console.log('[Worker] Adding default nodes "Main" and "First".')
            graphData.nodes = [
              {
                id: crypto.randomUUID(),
                color: 'goldenrod',
                type: null,
                info: null,
                bibl: [],
                imageWidth: null,
                imageHeight: null,
                visible: true,
              },
              {
                id: crypto.randomUUID(),
                color: 'steelblue',
                type: null,
                info: null,
                bibl: [],
                imageWidth: null,
                imageHeight: null,
                visible: true,
              },
            ]
            newlyCreated = true
          }
          if (!graphData.edges || graphData.edges.length === 0) {
            console.log('[Worker] Adding default edge between "Main" and "First".')
            graphData.edges = [
              {
                id: crypto.randomUUID(),
                source: graphData.nodes[0].id,
                target: graphData.nodes[1].id,
                label: '1 to 2',
                type: null,
                info: null,
              },
              {
                id: crypto.randomUUID(),
                source: graphData.nodes[1].id,
                target: graphData.nodes[2].id,
                label: '2 to 3',
                type: null,
                info: null,
              },
              {
                id: crypto.randomUUID(),
                source: graphData.nodes[2].id,
                target: graphData.nodes[0].id,
                label: '3 to 1',
                type: null,
                info: null,
              },
            ]
            newlyCreated = true
          } else {
            // Ensure edges connect valid node IDs
            graphData.edges = graphData.edges.map((edge) => {
              const validSource = graphData.nodes.find((node) => node.id === edge.source)
              const validTarget = graphData.nodes.find((node) => node.id === edge.target)

              if (!validSource || !validTarget) {
                console.warn(
                  `[Worker] Invalid edge detected. Reconnecting edge ${edge.id} to valid nodes.`,
                )
                return {
                  ...edge,
                  source: graphData.nodes[0].id,
                  target: graphData.nodes[1].id,
                }
              }
              return edge
            })
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
            JSON.stringify({
              message: 'Knowledge graph saved successfully',
              id,
              newlyCreated,
            }),
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
      } else if (
        pathname.match(/^\/api\/graph\/[^/]+\/ai-instructions$/) &&
        request.method === 'GET'
      ) {
        const graphId = pathname.split('/')[3]

        try {
          const result = await env.vegvisr_org
            .prepare('SELECT ai_instructions FROM knowledge_graphs WHERE id = ?')
            .bind(graphId)
            .first()

          return new Response(JSON.stringify({ instructions: result?.ai_instructions || '' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching AI instructions:', error)
          return new Response(JSON.stringify({ error: 'Failed to fetch AI instructions' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } else if (
        pathname.match(/^\/api\/graph\/[^/]+\/ai-instructions$/) &&
        request.method === 'PUT'
      ) {
        const graphId = pathname.split('/')[3]
        const { instructions } = await request.json()

        try {
          await env.vegvisr_org
            .prepare('UPDATE knowledge_graphs SET ai_instructions = ? WHERE id = ?')
            .bind(instructions, graphId)
            .run()

          return new Response(JSON.stringify({ message: 'AI instructions updated successfully' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error updating AI instructions:', error)
          return new Response(JSON.stringify({ error: 'Failed to update AI instructions' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
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

          // 1. Determine allowed meta areas based on KV store configuration
          const hostname =
            request.headers.get('x-original-hostname') || new URL(request.url).hostname
          console.log('[Worker] Request hostname:', hostname)

          let allowedMetaAreas = null

          // Check KV store for site configuration
          try {
            const kvKey = `site-config:${hostname}`
            const siteConfigData = await env.SITE_CONFIGS.get(kvKey)

            if (siteConfigData) {
              const siteConfig = JSON.parse(siteConfigData)
              if (siteConfig.contentFilter && Array.isArray(siteConfig.contentFilter.metaAreas)) {
                allowedMetaAreas = siteConfig.contentFilter.metaAreas
                console.log(
                  `[Worker] Using KV-based meta area filter for ${hostname}:`,
                  allowedMetaAreas,
                )
              } else {
                console.log(`[Worker] No meta area filter found in KV for ${hostname}`)
              }
            } else {
              console.log(`[Worker] No site configuration found in KV for ${hostname}`)
            }
          } catch (error) {
            console.error(`[Worker] Error fetching site config from KV for ${hostname}:`, error)
          }

          // 2. Fetch all graphs
          const query = `SELECT id, title, data FROM knowledge_graphs`
          const results = await env.vegvisr_org.prepare(query).all()
          const allGraphs = results.results || results.rows || []
          console.log('[Worker] Total graphs fetched from database:', allGraphs.length)

          // 3. Filter by meta area if needed
          let filteredGraphs = allGraphs
          if (allowedMetaAreas) {
            console.log('[Worker] Applying meta area filter...')
            filteredGraphs = allGraphs.filter((row) => {
              try {
                const graphData = JSON.parse(row.data)
                const metaAreaString = graphData.metadata?.metaArea || ''
                const metaAreas = metaAreaString
                  .split('#')
                  .map((a) => a.trim().toUpperCase())
                  .filter(Boolean)
                const match = metaAreas.some((area) => allowedMetaAreas.includes(area))
                console.log(
                  `[Worker] Graph ${row.id} (${row.title}) - metaAreas:`,
                  metaAreas,
                  '- Match:',
                  match,
                )
                return match
              } catch (e) {
                console.log(`[Worker] Error parsing graph ${row.id}:`, e)
                return false
              }
            })
            console.log(
              '[Worker] Graphs after filtering:',
              filteredGraphs.length,
              'out of',
              allGraphs.length,
            )
          } else {
            console.log('[Worker] No filtering applied - returning all graphs')
          }

          // 4. Return only id and title (or whatever fields you want)
          const responseGraphs = filteredGraphs.map((row) => ({
            id: row.id,
            title: row.title,
          }))

          console.log('[Worker] Final response will contain', responseGraphs.length, 'graphs')
          console.log(
            '[Worker] Graph IDs being returned:',
            responseGraphs.map((g) => g.id),
          )
          return new Response(JSON.stringify({ results: responseGraphs }), {
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
            path: node.path || null, // Ensure path is included
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
              visible: node.visible !== false, // Default to true if not set
              path: node.path || null, // Ensure path is included
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

          // Update the main graph table - sync both JSON data and separate columns
          const updateGraphQuery = `
            UPDATE knowledge_graphs
            SET data = ?, title = ?, description = ?, created_by = ?
            WHERE id = ?
          `
          await env.vegvisr_org
            .prepare(updateGraphQuery)
            .bind(
              JSON.stringify(enrichedGraphData),
              enrichedGraphData.metadata.title,
              enrichedGraphData.metadata.description,
              enrichedGraphData.metadata.createdBy,
              id,
            )
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

          const graphData = JSON.parse(result.data)
          graphData.nodes = graphData.nodes.map((node) => ({
            ...node,
            visible: node.visible !== false, // Ensure visible field is included
            imageWidth: node.imageWidth || null, // Ensure imageWidth is included
            imageHeight: node.imageHeight || null, // Ensure imageHeight is included
            path: node.path || null, // Ensure path is included
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

      if (pathname === '/addTemplate' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { name, node, ai_instructions } = requestBody

          if (!name || !node) {
            return new Response(
              JSON.stringify({ error: 'Template name and node data are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Adding template: ${name}`)

          const templateId = crypto.randomUUID()

          const query = `
            INSERT INTO graphTemplates (
              id,
              name,
              nodes,
              edges,
              ai_instructions
            )
            VALUES (?, ?, ?, ?, ?)
          `
          await env.vegvisr_org
            .prepare(query)
            .bind(
              templateId,
              name,
              JSON.stringify([node]),
              JSON.stringify([]),
              ai_instructions || null,
            )
            .run()

          // If ai_instructions are provided, update the template with them
          if (ai_instructions) {
            const updateQuery = `
              UPDATE graphTemplates
              SET ai_instructions = ?
              WHERE id = ?
            `
            await env.vegvisr_org
              .prepare(updateQuery)
              .bind(JSON.stringify(ai_instructions), templateId)
              .run()
          }

          console.log('[Worker] Template added successfully')
          return new Response(
            JSON.stringify({ message: 'Template added successfully', id: templateId, name }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error('[Worker] Error adding template:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getTemplates' && request.method === 'GET') {
        try {
          console.log('[Worker] Fetching list of graph templates')

          const query = `SELECT id, name, nodes, edges FROM graphTemplates`
          const results = await env.vegvisr_org.prepare(query).all()

          console.log('[Worker] Graph templates fetched successfully')
          return new Response(JSON.stringify(results), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching graph templates:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/saveToGraphWorkNotes' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { graphId, note, name } = requestBody

          console.log('Saving work note:', { graphId, note, name }) // Debug log

          if (!graphId || !note || !name) {
            return new Response(
              JSON.stringify({ error: 'Graph ID, note, and name are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          const workNoteId = crypto.randomUUID() // Generate a unique ID for the work note

          const query = `
        INSERT INTO graphWorkNotes (id, graph_id, note, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `
          await env.vegvisr_org.prepare(query).bind(workNoteId, graphId, `${name}: ${note}`).run()

          console.log('Work note saved successfully') // Debug log
          return new Response(
            JSON.stringify({ message: 'Work note saved successfully', workNoteId }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error('Error saving work note:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getGraphWorkNotes' && request.method === 'GET') {
        try {
          const graphId = url.searchParams.get('graphId')
          if (!graphId) {
            return new Response(JSON.stringify({ error: 'Graph ID is required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log(`[Worker] Fetching work notes for graph ID: ${graphId}`)

          const query = `
            SELECT id, note, created_at
            FROM graphWorkNotes
            WHERE graph_id = ?
            ORDER BY created_at DESC
          `
          const results = await env.vegvisr_org.prepare(query).bind(graphId).all()

          console.log('[Worker] Work notes fetched successfully')
          return new Response(
            JSON.stringify({
              success: true,
              meta: { graphId },
              results: results || [], // Ensure results is always an array
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          console.error('[Worker] Error fetching work notes:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/insertWorkNoteIntoGraph' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { graphId, workNoteId } = requestBody

          if (!graphId || !workNoteId) {
            return new Response(
              JSON.stringify({ error: 'Graph ID and work note ID are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Inserting work note ID: ${workNoteId} into graph ID: ${graphId}`)

          const noteQuery = `
            SELECT note
            FROM graphWorkNotes
            WHERE id = ?
          `
          const noteResult = await env.vegvisr_org.prepare(noteQuery).bind(workNoteId).first()

          if (!noteResult) {
            return new Response(JSON.stringify({ error: 'Work note not found.' }), {
              status: 404,
              headers: corsHeaders,
            })
          }

          const graphQuery = `
            SELECT data
            FROM knowledge_graphs
            WHERE id = ?
          `
          const graphResult = await env.vegvisr_org.prepare(graphQuery).bind(graphId).first()

          if (!graphResult) {
            return new Response(JSON.stringify({ error: 'Graph not found.' }), {
              status: 404,
              headers: corsHeaders,
            })
          }

          const graphData = JSON.parse(graphResult.data)
          const newNode = {
            id: `workNote_${Date.now()}`,
            label: 'Work Note',
            color: '#f4e2d8',
            type: 'notes',
            info: noteResult.note,
          }
          graphData.nodes.push(newNode)

          const updateQuery = `
            UPDATE knowledge_graphs
            SET data = ?
            WHERE id = ?
          `
          await env.vegvisr_org.prepare(updateQuery).bind(JSON.stringify(graphData), graphId).run()

          console.log('[Worker] Work note inserted into graph successfully')
          return new Response(
            JSON.stringify({ message: 'Work note inserted into graph successfully', newNode }),
            { status: 200, headers: corsHeaders },
          )
        } catch (error) {
          console.error('[Worker] Error inserting work note into graph:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/generateText' && request.method === 'POST') {
        try {
          const workersai = createWorkersAI({ binding: env.AI })
          console.log('[Worker] Created workersai instance:', workersai)

          const requestBody = await request.json()
          const { prompt } = requestBody
          console.log('[Worker] Request body:', requestBody)
          console.log('[Worker] Prompt:', prompt)

          if (!prompt) {
            return new Response(JSON.stringify({ error: 'Prompt is required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log('[Worker] Received prompt:', prompt)

          const result = await generateText({
            model: workersai('@cf/meta/llama-3.2-1b-instruct'),
            max_tokens: 5000,
            prompt,
          })
          if (
            !result ||
            !result.response ||
            !result.response.messages ||
            !result.response.messages[0].content[0].text
          ) {
            throw new Error('Invalid response from Workers AI')
          }
          const summary = result.response.messages[0].content[0].text.trim()
          console.log('[Worker] Generated text:', result)

          // const summary = result.choices[0].message.content.trim()

          return new Response(
            JSON.stringify({
              id: `fulltext_${Date.now()}`,
              label: 'Summary',
              type: 'fulltext',
              info: summary,
              color: '#f9f9f9',
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          console.error('[Worker] Error generating text:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/migrateTemplatesAddUUIDs' && request.method === 'POST') {
        try {
          // 1. Fetch all templates without an id or with empty/null id
          const selectQuery = `SELECT rowid FROM graphTemplates WHERE id IS NULL OR id = ''`
          const result = await env.vegvisr_org.prepare(selectQuery).all()
          const templates = result.results || result.rows || result || []

          if (!Array.isArray(templates) || templates.length === 0) {
            return new Response(JSON.stringify({ message: 'No templates need migration.' }), {
              status: 200,
              headers: corsHeaders,
            })
          }

          // 2. For each, generate a UUID and update the row
          for (const template of templates) {
            const newId = crypto.randomUUID()
            const updateQuery = `UPDATE graphTemplates SET id = ? WHERE rowid = ?`
            await env.vegvisr_org.prepare(updateQuery).bind(newId, template.rowid).run()
          }

          return new Response(
            JSON.stringify({ message: `Migrated ${templates.length} templates with new UUIDs.` }),
            { status: 200, headers: corsHeaders },
          )
        } catch (error) {
          console.error('[Worker] Error migrating template UUIDs:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/deleteTemplate' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { id } = requestBody

          if (!id) {
            return new Response(JSON.stringify({ error: 'Template id is required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          const query = `DELETE FROM graphTemplates WHERE id = ?`
          await env.vegvisr_org.prepare(query).bind(id).run()

          return new Response(JSON.stringify({ message: 'Template deleted successfully', id }), {
            status: 200,
            headers: corsHeaders,
          })
        } catch (error) {
          console.error('[Worker] Error deleting template:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/deleteknowgraph' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { id } = requestBody

          console.log('[Worker] Delete request received:', { id, requestBody })

          if (!id) {
            console.log('[Worker] Error: No ID provided in request')
            return new Response(JSON.stringify({ error: 'Graph ID is required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log(`[Worker] Deleting graph with ID: ${id}`)

          // First check if the graph exists
          const checkQuery = `SELECT id FROM knowledge_graphs WHERE id = ?`
          console.log('[Worker] Checking if graph exists with query:', checkQuery)
          const graphExists = await env.vegvisr_org.prepare(checkQuery).bind(id).first()
          console.log('[Worker] Graph exists check result:', graphExists)

          if (!graphExists) {
            console.log('[Worker] Graph not found:', id)
            return new Response(JSON.stringify({ error: 'Graph not found.' }), {
              status: 404,
              headers: corsHeaders,
            })
          }

          // Delete related records first (in correct order)
          try {
            // 1. Delete from graphWorkNotes table first (most dependent)
            console.log('[Worker] Deleting from graphWorkNotes table')
            const deleteWorkNotesQuery = `DELETE FROM graphWorkNotes WHERE graph_id = ?`
            await env.vegvisr_org.prepare(deleteWorkNotesQuery).bind(id).run()
            console.log('[Worker] Deleted from graphWorkNotes table')

            // 2. Delete from knowledge_graph_history table
            console.log('[Worker] Deleting from knowledge_graph_history table')
            const deleteHistoryQuery = `DELETE FROM knowledge_graph_history WHERE graph_id = ?`
            await env.vegvisr_org.prepare(deleteHistoryQuery).bind(id).run()
            console.log('[Worker] Deleted from knowledge_graph_history table')

            // 3. Finally delete from knowledge_graphs table
            console.log('[Worker] Deleting from knowledge_graphs table')
            const deleteGraphQuery = `DELETE FROM knowledge_graphs WHERE id = ?`
            await env.vegvisr_org.prepare(deleteGraphQuery).bind(id).run()
            console.log('[Worker] Deleted from knowledge_graphs table')

            console.log('[Worker] Graph and all related records deleted successfully')
            return new Response(JSON.stringify({ message: 'Graph deleted successfully', id }), {
              status: 200,
              headers: corsHeaders,
            })
          } catch (error) {
            console.error('[Worker] Error during deletion process:', error)
            console.error('[Worker] Error details:', {
              message: error.message,
              stack: error.stack,
              name: error.name,
            })
            return new Response(
              JSON.stringify({
                error: 'Failed to delete graph and related records',
                details: error.message,
                type: error.name,
                stack: error.stack,
              }),
              {
                status: 500,
                headers: corsHeaders,
              },
            )
          }
        } catch (error) {
          console.error('[Worker] Unexpected error:', error)
        }
      }

      if (pathname === '/resetMetaAreas' && request.method === 'POST') {
        // Only allow Superadmin
        const userRole = request.headers.get('x-user-role') || ''
        if (userRole !== 'Superadmin') {
          return new Response(JSON.stringify({ error: 'Forbidden: Superadmin role required' }), {
            status: 403,
            headers: corsHeaders,
          })
        }
        try {
          // Fetch all graph IDs
          const query = `SELECT id, data FROM knowledge_graphs`
          const queryResult = await env.vegvisr_org.prepare(query).all()
          const results = queryResult.results || queryResult.rows || []
          let updated = 0
          let skipped = 0
          for (const row of results) {
            let graphData
            try {
              graphData = JSON.parse(row.data)
            } catch {
              console.log(`[Worker] Skipping graph ${row.id}: invalid JSON`)
              skipped++
              continue
            }
            if (
              graphData.metadata &&
              typeof graphData.metadata === 'object' &&
              graphData.metadata.metaArea !== ''
            ) {
              graphData.metadata.metaArea = ''
              // Update the graph
              const updateQuery = `UPDATE knowledge_graphs SET data = ? WHERE id = ?`
              await env.vegvisr_org
                .prepare(updateQuery)
                .bind(JSON.stringify(graphData), row.id)
                .run()
              updated++
            } else {
              skipped++
            }
          }
          return new Response(JSON.stringify({ success: true, updated, skipped }), {
            status: 200,
            headers: corsHeaders,
          })
        } catch (error) {
          console.error('[Worker] Error in /resetMetaAreas:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getAITemplates' && request.method === 'GET') {
        try {
          console.log('[Worker] Fetching list of AI templates')

          // Check if database binding exists
          if (!env.vegvisr_org) {
            console.error('[Worker] Database binding not found')
            return new Response(JSON.stringify({ error: 'Database connection not configured' }), {
              status: 500,
              headers: corsHeaders,
            })
          }

          const query = `
            SELECT
              id,
              name,
              nodes,
              edges,
              ai_instructions,
              category,
              thumbnail_path,
              standard_question
            FROM graphTemplates
          `
          console.log('[Worker] Executing query:', query)

          const results = await env.vegvisr_org.prepare(query).all()
          console.log('[Worker] Query results:', results)

          if (!results || !results.results) {
            console.error('[Worker] No results returned from database')
            return new Response(JSON.stringify({ error: 'No templates found' }), {
              status: 404,
              headers: corsHeaders,
            })
          }

          // Process and enrich the templates with additional AI-specific information
          const enrichedTemplates = results.results.map((template) => ({
            id: template.id,
            name: template.name,
            type: template.name.toLowerCase().replace(/\s+/g, '_'),
            nodes: JSON.parse(template.nodes || '[]'),
            edges: JSON.parse(template.edges || '[]'),
            ai_instructions: template.ai_instructions || '',
            category: template.category || 'General',
            thumbnail_path: template.thumbnail_path || null,
            standard_question: template.standard_question || '',
          }))

          console.log('[Worker] AI templates fetched successfully:', enrichedTemplates.length)
          return new Response(JSON.stringify({ results: enrichedTemplates }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching AI templates:', error)
          return new Response(
            JSON.stringify({
              error: 'Server error',
              details: error.message,
              stack: error.stack,
            }),
            { status: 500, headers: corsHeaders },
          )
        }
      }

      if (pathname === '/addAITemplate' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { name, node, ai_instructions, category, thumbnail_path } = requestBody

          if (!name || !node) {
            return new Response(
              JSON.stringify({ error: 'Template name and node data are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Adding AI template: ${name}`)

          const templateId = crypto.randomUUID()

          const query = `
            INSERT INTO graphTemplates (
              id,
              name,
              nodes,
              edges,
              ai_instructions,
              category,
              thumbnail_path
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
          await env.vegvisr_org
            .prepare(query)
            .bind(
              templateId,
              'AI Knowledge Node', // New name
              JSON.stringify([
                {
                  id: 'Node_Grok_Test',
                  label: 'https://api.vegvisr.org/groktest',
                  color: 'black',
                  type: 'action_test',
                  info: 'Ask a question about any topic to get an AI-generated response with references.',
                  bibl: [],
                  imageWidth: 250,
                  imageHeight: 250,
                  visible: true,
                },
              ]),
              JSON.stringify([]),
              ai_instructions ||
                "Generate a comprehensive response to the user's question. Include:\n1. A clear explanation of the topic\n2. Key concepts and their relationships\n3. Historical or cultural context if relevant\n4. 2-3 academic references in APA format\n\nKeep the response focused and well-structured, avoiding unnecessary jargon. The response should be informative while remaining accessible to a general audience.", // AI instructions
              category || 'General',
              thumbnail_path || null,
            )
            .run()

          // If ai_instructions are provided, update the template with them
          if (ai_instructions) {
            const updateQuery = `
              UPDATE graphTemplates
              SET ai_instructions = ?,
                  category = ?,
                  thumbnail_path = ?
              WHERE id = ?
            `
            await env.vegvisr_org
              .prepare(updateQuery)
              .bind(
                JSON.stringify(ai_instructions),
                category || 'General',
                thumbnail_path || null,
                templateId,
              )
              .run()
          }

          console.log('[Worker] AI template added successfully')
          return new Response(
            JSON.stringify({
              message: 'AI template added successfully',
              id: templateId,
              name: 'AI Knowledge Node',
              category: category || 'General',
              thumbnail_path: thumbnail_path || null,
            }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error('[Worker] Error adding AI template:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/generate-worker-ai' && request.method === 'POST') {
        try {
          console.log('[Worker] Starting AI worker generation...')

          const requestBody = await request.json()
          const { prompt, aiModel, selectedExamples, userPrompt, useCloudflareAI, workingExample } =
            requestBody

          if (!prompt) {
            return new Response(JSON.stringify({ error: 'Missing required parameter: prompt' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          // Check if Cloudflare AI binding is available
          if (!env.AI) {
            console.error('[Worker] AI binding not available')
            return new Response(JSON.stringify({ error: 'AI binding not configured' }), {
              status: 500,
              headers: corsHeaders,
            })
          }

          // Prepare context from selected examples
          let exampleContext = ''
          if (selectedExamples && selectedExamples.length > 0) {
            exampleContext = `\n\nSelected Code Examples:\n${selectedExamples
              .map((ex) => `// ${ex.title} (${ex.language})\n// ${ex.description}\n${ex.code}`)
              .join('\n\n// ---\n\n')}`
          }

          // Enhanced prompt with working example
          const enhancedPrompt = `You are an expert Cloudflare Worker developer. Generate a complete, production-ready Cloudflare Worker script.

CRITICAL: Follow this EXACT working pattern:

${workingExample}

User Request: ${userPrompt || 'Create a basic worker'}

RULES:
1. ALWAYS use: export default { async fetch(request, env, ctx) { ... } }
2. ALWAYS pass both request AND env parameters to helper functions
3. ALWAYS include proper CORS handling
4. ALWAYS use try-catch for error handling
5. ALWAYS include /debug endpoint for testing
6. DO NOT use import statements
7. DO NOT use addEventListener format

${exampleContext}

Generate ONLY the JavaScript code following the working example pattern. No markdown, no explanations.`

          console.log('[Worker] Using Cloudflare Workers AI for code generation...')

          // Use Cloudflare Workers AI
          const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
            messages: [
              {
                role: 'system',
                content:
                  'You are an expert Cloudflare Worker developer. Generate clean, production-ready JavaScript code using the modern export default format. Follow the provided working example exactly.',
              },
              {
                role: 'user',
                content: enhancedPrompt,
              },
            ],
            max_tokens: 3000,
            temperature: 0.3, // Lower temperature for more consistent code generation
          })

          let result = aiResponse.response || ''

          // Clean up the generated code
          let cleanCode = result
            .replace(/```javascript\n?/g, '')
            .replace(/```js\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()

          // Ensure it uses the modern format
          if (!cleanCode.includes('export default')) {
            console.log('[Worker] Adding export default wrapper...')
            cleanCode = `export default {
  async fetch(request, env, ctx) {
    ${cleanCode}
  }
}`
          }

          // Basic validation
          const hasExportDefault = cleanCode.includes('export default')
          const hasFetchFunction = cleanCode.includes('async fetch(request, env, ctx)')
          const hasDebugEndpoint = cleanCode.includes('/debug')

          const validation = {
            isValid: hasExportDefault && hasFetchFunction,
            errors: [],
            warnings: [],
            score: 0,
          }

          if (!hasExportDefault) validation.errors.push('Missing export default structure')
          if (!hasFetchFunction) validation.errors.push('Missing proper fetch function signature')
          if (!hasDebugEndpoint) validation.warnings.push('Missing /debug endpoint for testing')

          // Calculate score
          validation.score = Math.max(
            0,
            100 - validation.errors.length * 30 - validation.warnings.length * 10,
          )

          console.log('[Worker] AI worker generation completed successfully')
          return new Response(
            JSON.stringify({
              success: true,
              code: cleanCode,
              model: 'cloudflare-ai-llama-3.1-8b',
              timestamp: new Date().toISOString(),
              validation,
              usedCloudflareAI: true,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          console.error('[Worker] Cloudflare AI worker generation error:', error)
          return new Response(
            JSON.stringify({
              error: 'Worker generation failed',
              details: error.message,
              stack: error.stack,
            }),
            {
              status: 500,
              headers: corsHeaders,
            },
          )
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
