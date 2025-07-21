// Complete social-worker microservice
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url
    const method = request.method

    // CORS handling
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
      // Professional connections
      if (pathname === '/follow-user' && method === 'POST') {
        const { followerId, followingId, action } = await request.json()
        const socialDb = env.vegvisr_org

        if (action === 'follow') {
          await socialDb
            .prepare(
              `
            INSERT OR REPLACE INTO professional_connections (id, follower_id, following_id, connection_type)
            VALUES (?, ?, ?, 'follow')
          `,
            )
            .bind(`${followerId}_${followingId}`, followerId, followingId)
            .run()
        } else {
          await socialDb
            .prepare(
              `
            DELETE FROM professional_connections
            WHERE follower_id = ? AND following_id = ?
          `,
            )
            .bind(followerId, followingId)
            .run()
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      if (pathname === '/user-connections' && method === 'GET') {
        const userId = url.searchParams.get('userId')
        const socialDb = env.vegvisr_org

        const followers = await socialDb
          .prepare(
            `
          SELECT follower_id, created_at FROM professional_connections
          WHERE following_id = ? AND connection_type = 'follow'
        `,
          )
          .bind(userId)
          .all()

        const following = await socialDb
          .prepare(
            `
          SELECT following_id, created_at FROM professional_connections
          WHERE follower_id = ? AND connection_type = 'follow'
        `,
          )
          .bind(userId)
          .all()

        return new Response(
          JSON.stringify({
            followers: followers.results || [],
            following: following.results || [],
            followerCount: followers.results?.length || 0,
            followingCount: following.results?.length || 0,
          }),
          { status: 200, headers: corsHeaders },
        )
      }

      if (pathname === '/connection-status' && method === 'GET') {
        const followerId = url.searchParams.get('followerId')
        const followingId = url.searchParams.get('followingId')
        const socialDb = env.vegvisr_org

        const connection = await socialDb
          .prepare(
            `
          SELECT id FROM professional_connections
          WHERE follower_id = ? AND following_id = ? AND connection_type = 'follow'
        `,
          )
          .bind(followerId, followingId)
          .first()

        return new Response(
          JSON.stringify({
            isFollowing: !!connection,
          }),
          { status: 200, headers: corsHeaders },
        )
      }

      // Enhanced graph engagement (9 professional reaction types)
      if (pathname === '/engage-graph' && method === 'POST') {
        const { graphId, userId, engagementType, commentary } = await request.json()
        const socialDb = env.vegvisr_org

        // Validate engagement type
        const validTypes = [
          'insightful',
          'inspired',
          'learning',
          'bookmark',
          'building',
          'validating',
          'repost',
          'question',
          'citing',
        ]
        if (!validTypes.includes(engagementType)) {
          return new Response(JSON.stringify({ error: 'Invalid engagement type' }), {
            status: 400,
            headers: corsHeaders,
          })
        }

        // Check if engagement already exists (toggle behavior)
        const existing = await socialDb
          .prepare(
            `
          SELECT id FROM graph_insights
          WHERE graph_id = ? AND user_id = ? AND insight_type = ?
        `,
          )
          .bind(graphId, userId, engagementType)
          .first()

        if (existing) {
          // Remove engagement (toggle off)
          await socialDb
            .prepare(
              `
            DELETE FROM graph_insights WHERE id = ?
          `,
            )
            .bind(existing.id)
            .run()
        } else {
          // Add engagement
          const engagementId = `${graphId}_${userId}_${engagementType}_${Date.now()}`
          await socialDb
            .prepare(
              `
            INSERT INTO graph_insights (id, graph_id, user_id, insight_type, repost_comment)
            VALUES (?, ?, ?, ?, ?)
          `,
            )
            .bind(engagementId, graphId, userId, engagementType, commentary || null)
            .run()
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      if (pathname === '/graph-engagement' && method === 'GET') {
        const graphId = url.searchParams.get('graphId')
        const socialDb = env.vegvisr_org

        const engagements = await socialDb
          .prepare(
            `
          SELECT insight_type, COUNT(*) as count
          FROM graph_insights
          WHERE graph_id = ?
          GROUP BY insight_type
        `,
          )
          .bind(graphId)
          .all()

        const engagementStats = {}
        engagements.results?.forEach((stat) => {
          engagementStats[stat.insight_type] = stat.count
        })

        return new Response(JSON.stringify({ engagements: engagementStats }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      if (pathname === '/user-engagements' && method === 'GET') {
        const userId = url.searchParams.get('userId')
        const socialDb = env.vegvisr_org

        const userEngagements = await socialDb
          .prepare(
            `
          SELECT graph_id, insight_type, repost_comment, created_at
          FROM graph_insights
          WHERE user_id = ?
          ORDER BY created_at DESC
        `,
          )
          .bind(userId)
          .all()

        return new Response(JSON.stringify({ engagements: userEngagements.results || [] }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      // Scalable node-level comments (respects creator settings)
      if (pathname === '/commentable-types' && method === 'GET') {
        const socialDb = env.vegvisr_org

        const types = await socialDb
          .prepare(
            `
          SELECT node_type, display_name, enabled
          FROM commentable_node_types
          WHERE enabled = 1
        `,
          )
          .all()

        return new Response(JSON.stringify({ types: types.results || [] }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      if (pathname === '/add-node-comment' && method === 'POST') {
        const { graphId, nodeId, nodeType, userId, commentText, parentId } = await request.json()
        const socialDb = env.vegvisr_org

        // Check if node type supports comments
        const nodeTypeSupported = await socialDb
          .prepare(
            `
          SELECT node_type FROM commentable_node_types
          WHERE node_type = ? AND enabled = 1
        `,
          )
          .bind(nodeType)
          .first()

        if (!nodeTypeSupported) {
          return new Response(JSON.stringify({ error: 'Node type does not support comments' }), {
            status: 400,
            headers: corsHeaders,
          })
        }

        // Check creator's engagement level for this graph
        const settings = await socialDb
          .prepare(
            `
          SELECT engagement_level FROM graph_social_settings WHERE graph_id = ?
        `,
          )
          .bind(graphId)
          .first()

        const engagementLevel = settings ? settings.engagement_level : 'hybrid' // Default if no record

        if (engagementLevel !== 'hybrid') {
          return new Response(JSON.stringify({ error: 'Comments not enabled for this graph' }), {
            status: 400,
            headers: corsHeaders,
          })
        }

        // Add comment
        const commentId = `${graphId}_${nodeId}_${userId}_${Date.now()}`
        await socialDb
          .prepare(
            `
          INSERT INTO node_discussions (id, graph_id, node_id, node_type, user_id, comment_text, parent_comment_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .bind(commentId, graphId, nodeId, nodeType, userId, commentText, parentId || null)
          .run()

        return new Response(JSON.stringify({ success: true, commentId }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      if (pathname === '/node-comments' && method === 'GET') {
        const graphId = url.searchParams.get('graphId')
        const nodeId = url.searchParams.get('nodeId')
        const socialDb = env.vegvisr_org

        const comments = await socialDb
          .prepare(
            `
          SELECT id, user_id, comment_text, parent_comment_id, created_at
          FROM node_discussions
          WHERE graph_id = ? AND node_id = ?
          ORDER BY created_at ASC
        `,
          )
          .bind(graphId, nodeId)
          .all()

        return new Response(JSON.stringify({ comments: comments.results || [] }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      if (pathname === '/edit-node-comment' && method === 'PUT') {
        const { commentId, userId, commentText } = await request.json()
        const socialDb = env.vegvisr_org

        // Verify user owns the comment
        const comment = await socialDb
          .prepare(
            `
          SELECT user_id FROM node_discussions WHERE id = ?
        `,
          )
          .bind(commentId)
          .first()

        if (!comment || comment.user_id !== userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 403,
            headers: corsHeaders,
          })
        }

        await socialDb
          .prepare(
            `
          UPDATE node_discussions SET comment_text = ? WHERE id = ?
        `,
          )
          .bind(commentText, commentId)
          .run()

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      if (pathname === '/delete-node-comment' && method === 'DELETE') {
        const commentId = url.searchParams.get('commentId')
        const userId = url.searchParams.get('userId')
        const socialDb = env.vegvisr_org

        // Verify user owns the comment
        const comment = await socialDb
          .prepare(
            `
          SELECT user_id FROM node_discussions WHERE id = ?
        `,
          )
          .bind(commentId)
          .first()

        if (!comment || comment.user_id !== userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 403,
            headers: corsHeaders,
          })
        }

        await socialDb
          .prepare(
            `
          DELETE FROM node_discussions WHERE id = ?
        `,
          )
          .bind(commentId)
          .run()

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      // Creator control (isolated social-worker table)
      if (pathname === '/graph-social-settings' && method === 'GET') {
        const graphId = url.searchParams.get('graphId')
        const socialDb = env.vegvisr_org

        const settings = await socialDb
          .prepare(
            `
          SELECT engagement_level, updated_at FROM graph_social_settings WHERE graph_id = ?
        `,
          )
          .bind(graphId)
          .first()

        return new Response(
          JSON.stringify({
            engagementLevel: settings ? settings.engagement_level : 'hybrid', // Default
            lastUpdated: settings ? settings.updated_at : null,
          }),
          { status: 200, headers: corsHeaders },
        )
      }

      if (pathname === '/graph-social-settings' && method === 'PUT') {
        const { graphId, creatorId, engagementLevel } = await request.json()
        const socialDb = env.vegvisr_org

        // Validate engagement level
        const validLevels = ['private', 'graph-only', 'hybrid']
        if (!validLevels.includes(engagementLevel)) {
          return new Response(JSON.stringify({ error: 'Invalid engagement level' }), {
            status: 400,
            headers: corsHeaders,
          })
        }

        await socialDb
          .prepare(
            `
          INSERT OR REPLACE INTO graph_social_settings (graph_id, creator_id, engagement_level, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `,
          )
          .bind(graphId, creatorId, engagementLevel)
          .run()

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      // Professional feed
      if (pathname === '/professional-feed' && method === 'GET') {
        const userId = url.searchParams.get('userId')
        const socialDb = env.vegvisr_org

        // Get followed users from social database
        const followedQuery = `
          SELECT following_id FROM professional_connections
          WHERE follower_id = ? AND connection_type = 'follow'
        `
        const followed = await socialDb.prepare(followedQuery).bind(userId).all()

        if (followed.results.length === 0) {
          return new Response(JSON.stringify({ insights: [] }), {
            status: 200,
            headers: corsHeaders,
          })
        }

        const followingIds = followed.results.map((f) => f.following_id)

        // Call main-worker to get user details (worker-to-worker communication)
        const userResponse = await env.MAIN_WORKER.fetch(
          new Request(`https://main.vegvisr.org/bulk-user-details`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: followingIds }),
          }),
        )

        // Call dev-worker to get knowledge graphs (worker-to-worker communication)
        const graphResponse = await env.DEV_WORKER.fetch(
          new Request(`https://knowledge-graph-worker.torarnehave.workers.dev/user-graphs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: followingIds }),
          }),
        )

        const userData = await userResponse.json()
        const graphData = await graphResponse.json()

        // Combine and return professional feed
        const combinedFeed =
          graphData.graphs?.map(async (graph) => ({
            ...graph,
            userDetails: userData.users?.find((u) => u.user_id === graph.created_by),
            socialStats: await getSocialStats(graph.id, socialDb),
          })) || []

        return new Response(JSON.stringify({ insights: combinedFeed }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      // Trending insights
      if (pathname === '/trending-insights' && method === 'GET') {
        const socialDb = env.vegvisr_org

        const trending = await socialDb
          .prepare(
            `
          SELECT graph_id, COUNT(*) as engagement_count
          FROM graph_insights
          WHERE created_at > date('now', '-7 days')
          GROUP BY graph_id
          ORDER BY engagement_count DESC
          LIMIT 20
        `,
          )
          .all()

        return new Response(JSON.stringify({ trending: trending.results || [] }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      // User discovery
      if (pathname === '/discover-professionals' && method === 'GET') {
        const searchTerm = url.searchParams.get('search')
        const socialDb = env.vegvisr_org

        // Get users with high engagement
        const activeUsers = await socialDb
          .prepare(
            `
          SELECT user_id, COUNT(*) as activity_count
          FROM graph_insights
          WHERE created_at > date('now', '-30 days')
          GROUP BY user_id
          ORDER BY activity_count DESC
          LIMIT 50
        `,
          )
          .all()

        return new Response(JSON.stringify({ professionals: activeUsers.results || [] }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      if (pathname === '/professional-stats' && method === 'GET') {
        const userId = url.searchParams.get('userId')
        const socialDb = env.vegvisr_org

        // Get user's social statistics
        const stats = await getSocialStats(null, socialDb, userId)

        return new Response(JSON.stringify({ stats }), { status: 200, headers: corsHeaders })
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders })
    } catch (error) {
      console.error('Social worker error:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: corsHeaders,
      })
    }
  },
}

// Helper function for social statistics
async function getSocialStats(graphId, db, userId = null) {
  if (graphId) {
    // Graph-specific stats
    const stats = await db
      .prepare(
        `
      SELECT insight_type, COUNT(*) as count
      FROM graph_insights
      WHERE graph_id = ?
      GROUP BY insight_type
    `,
      )
      .bind(graphId)
      .all()

    return (
      stats.results?.reduce((acc, stat) => {
        acc[stat.insight_type] = stat.count
        return acc
      }, {}) || {}
    )
  } else if (userId) {
    // User-specific stats
    const [engagementStats, connectionStats] = await Promise.all([
      db
        .prepare(
          `
        SELECT insight_type, COUNT(*) as count
        FROM graph_insights
        WHERE user_id = ?
        GROUP BY insight_type
      `,
        )
        .bind(userId)
        .all(),

      db
        .prepare(
          `
        SELECT
          (SELECT COUNT(*) FROM professional_connections WHERE follower_id = ?) as following_count,
          (SELECT COUNT(*) FROM professional_connections WHERE following_id = ?) as follower_count
      `,
        )
        .bind(userId, userId)
        .first(),
    ])

    const engagements =
      engagementStats.results?.reduce((acc, stat) => {
        acc[stat.insight_type] = stat.count
        return acc
      }, {}) || {}

    return {
      engagements,
      connections: connectionStats || { following_count: 0, follower_count: 0 },
    }
  }

  return {}
}
