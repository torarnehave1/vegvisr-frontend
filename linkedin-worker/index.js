/**
 * LinkedIn Worker - Content Sharing & Profile Management
 *
 * Endpoints:
 * - GET /auth/status - Check user's LinkedIn connection status
 * - POST /share/article - Share article/URL with SEO page
 * - GET /posts/history - Get user's LinkedIn share history
 * - POST /analytics/sync - Sync post analytics from LinkedIn
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-user-email',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Check LinkedIn connection status
    if (url.pathname === '/auth/status') {
      return await handleAuthStatus(request, env, corsHeaders)
    }
    // Share article to LinkedIn
    if (url.pathname === '/share/article') {
      return await handleShareArticle(request, env, corsHeaders)
    }
    // Get user's LinkedIn share history
    if (url.pathname === '/posts/history') {
      return await handlePostsHistory(request, env, corsHeaders)
    }
    // Delete a LinkedIn post
    if (url.pathname === '/posts/delete') {
      return await handleDeletePost(request, env, corsHeaders)
    }
    // Get user's organizations
    if (url.pathname === '/organizations') {
      return await handleGetOrganizations(request, env, corsHeaders)
    }
    // Sync post analytics
    if (url.pathname === '/analytics/sync') {
      return await handleAnalyticsSync(request, env, corsHeaders)
    }

    // 404 fallback
    return new Response('Not Found', { status: 404, headers: corsHeaders })
  }
}

// --- Endpoint Handlers ---

async function handleAuthStatus(request, env, corsHeaders) {
  try {
    const userEmail = request.headers.get('x-user-email')
    if (!userEmail) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing x-user-email header'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user has LinkedIn token via auth-worker service binding
    const tokenData = await getUserLinkedInToken(env, userEmail)

    return new Response(JSON.stringify({
      success: true,
      connected: !!tokenData,
      profile: tokenData ? {
        personUrn: tokenData.linkedin_person_urn,
        profileData: tokenData.linkedin_profile_data ? JSON.parse(tokenData.linkedin_profile_data) : null
      } : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Auth status error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleShareArticle(request, env, corsHeaders) {
  try {
    const data = await request.json()
    const {
      userEmail,
      graphId,
      seoSlug,
      shareCommentary,
      visibility = 'PUBLIC',
      organizationId // Optional: for posting to business pages
    } = data

    if (!userEmail || !graphId || !seoSlug) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: userEmail, graphId, seoSlug'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Organization posting temporarily disabled
    if (organizationId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Business page posting is temporarily unavailable. Please post to your personal profile only.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Get user's LinkedIn token via auth-worker
    const tokenData = await getUserLinkedInToken(env, userEmail)
    if (!tokenData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'LinkedIn not connected. Please authorize LinkedIn access.'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Fetch SEO page metadata from KV
    const seoMetadata = await fetchSEOMetadata(env.SEO_PAGES, seoSlug)
    if (!seoMetadata) {
      return new Response(JSON.stringify({
        success: false,
        error: 'SEO page not found. Please generate SEO page first.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Check rate limit (150 posts/day per user)
    await checkRateLimit(env.DB, userEmail)

    // 4. Prepare LinkedIn post based on type
    let postData, apiEndpoint, apiVersion

    if (organizationId) {
      // Organization post using Shares API
      postData = {
        owner: `urn:li:organization:${organizationId}`,
        subject: shareCommentary || `Check out my latest knowledge graph: ${seoMetadata.title}`,
        text: {
          text: shareCommentary || `Check out my latest knowledge graph: ${seoMetadata.title}`
        },
        content: {
          contentEntities: [{
            entityLocation: `https://seo.vegvisr.org/graph/${seoSlug}`,
            thumbnails: [{
              resolvedUrl: seoMetadata.ogImage || `https://seo.vegvisr.org/graph/${seoSlug}`
            }]
          }],
          title: seoMetadata.title,
          description: seoMetadata.description
        },
        distribution: {
          linkedInDistributionTarget: {}
        }
      }
      apiEndpoint = 'https://api.linkedin.com/v2/shares'
      apiVersion = '2.0.0'
    } else {
      // Personal post using UGC Posts API
      postData = {
        author: tokenData.linkedin_person_urn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: shareCommentary || `Check out my latest knowledge graph: ${seoMetadata.title}`
            },
            shareMediaCategory: 'ARTICLE',
            media: [{
              status: 'READY',
              description: {
                text: seoMetadata.description
              },
              originalUrl: `https://seo.vegvisr.org/graph/${seoSlug}`,
              title: {
                text: seoMetadata.title
              }
            }]
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': visibility
        }
      }
      apiEndpoint = 'https://api.linkedin.com/v2/ugcPosts'
      apiVersion = '2.0.0'
    }

    // 5. Post to LinkedIn
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': apiVersion
      },
      body: JSON.stringify(postData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`LinkedIn API error: ${response.status} - ${errorText}`)
    }

    // 6. Get post ID from response
    let postId
    if (organizationId) {
      // Organization shares return ID in response body
      const responseData = await response.json()
      postId = responseData.id
    } else {
      // Personal UGC posts return ID in header
      postId = response.headers.get('X-RestLi-Id')
    }

    // 7. Store in database
    await storeLinkedInPost(env.DB, {
      id: crypto.randomUUID(),
      graph_id: graphId,
      user_email: userEmail,
      linkedin_post_id: postId,
      post_url: organizationId
        ? `https://www.linkedin.com/feed/update/${postId}`
        : `https://www.linkedin.com/feed/update/${postId}`,
      visibility,
      share_commentary: shareCommentary,
      og_image_url: seoMetadata.ogImage,
      organization_id: organizationId // Store organization info
    })

    // 8. Update graph metadata
    await updateGraphLinkedInMetadata(env.DB, graphId, postId)

    return new Response(JSON.stringify({
      success: true,
      postId,
      postUrl: `https://www.linkedin.com/feed/update/${postId}`,
      message: 'Successfully shared to LinkedIn!'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('LinkedIn share error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handlePostsHistory(request, env, corsHeaders) {
  try {
    const userEmail = request.headers.get('x-user-email')
    if (!userEmail) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing x-user-email header'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const posts = await getUserLinkedInPosts(env.DB, userEmail)

    return new Response(JSON.stringify({
      success: true,
      posts: posts.map(post => ({
        id: post.id,
        graphId: post.graph_id,
        postId: post.linkedin_post_id,
        postUrl: post.post_url,
        visibility: post.visibility,
        commentary: post.share_commentary,
        ogImage: post.og_image_url,
        createdAt: post.created_at
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Posts history error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleAnalyticsSync(request, env, corsHeaders) {
  try {
    const userEmail = request.headers.get('x-user-email')
    if (!userEmail) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing x-user-email header'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // TODO: Implement LinkedIn Analytics API sync
    // This would fetch impression/click data for user's posts
    return new Response(JSON.stringify({
      success: false,
      error: 'Analytics sync not yet implemented'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Analytics sync error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleDeletePost(request, env, corsHeaders) {
  try {
    const data = await request.json()
    const { userEmail, postId } = data

    if (!userEmail || !postId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: userEmail, postId'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Verify user owns this post
    const db = env.DB
    const post = await db.prepare(`
      SELECT * FROM linkedin_posts
      WHERE linkedin_post_id = ? AND user_email = ?
    `).bind(postId, userEmail).first()

    if (!post) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post not found or you do not have permission to delete it'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Get user's LinkedIn token
    const tokenData = await getUserLinkedInToken(env, userEmail)
    if (!tokenData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'LinkedIn not connected. Please re-authorize LinkedIn access.'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Delete from LinkedIn
    const deleteResponse = await fetch(`https://api.linkedin.com/v2/ugcPosts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    })

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text()
      throw new Error(`LinkedIn API delete error: ${deleteResponse.status} - ${errorText}`)
    }

    // 4. Mark as deleted in our database
    await db.prepare(`
      UPDATE linkedin_posts
      SET deleted_at = ?, deleted = 1
      WHERE linkedin_post_id = ? AND user_email = ?
    `).bind(new Date().toISOString(), postId, userEmail).run()

    // 5. Update graph metadata (decrement share count)
    if (post.graph_id) {
      await updateGraphLinkedInMetadata(env.DB, post.graph_id, null, true) // true = decrement
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Post deleted successfully',
      postId: postId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Delete post error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleGetOrganizations(request, env, corsHeaders) {
  try {
    const userEmail = request.headers.get('x-user-email')
    if (!userEmail) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing x-user-email header'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get user's LinkedIn token and organizations
    const tokenData = await getUserLinkedInToken(env, userEmail)
    if (!tokenData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'LinkedIn not connected'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      organizations: [],
      message: 'Business page access is temporarily unavailable. Only personal profile posting is supported.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Get organizations error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

// --- Helper Functions ---

async function getUserLinkedInToken(env, userEmail) {
  try {
    // Call auth-worker to get LinkedIn token
    const authResponse = await env.AUTH_WORKER.fetch('https://auth.vegvisr.org/user/linkedin-token', {
      method: 'GET',
      headers: {
        'x-user-email': userEmail
      }
    })

    if (!authResponse.ok) {
      return null
    }

    const tokenData = await authResponse.json()
    return tokenData.success ? tokenData : null
  } catch (error) {
    console.error('Error fetching LinkedIn token from auth-worker:', error)
    return null
  }
}

async function fetchSEOMetadata(seoPagesKV, slug) {
  try {
    const html = await seoPagesKV.get(`graph:${slug}`)
    if (!html) return null

    // Parse metadata from stored KV or fetch from mapping
    const mapping = await seoPagesKV.get(`slug:${slug}`, 'json')
    return mapping
  } catch (error) {
    console.error('Error fetching SEO metadata:', error)
    return null
  }
}

async function checkRateLimit(db, userEmail) {
  const today = new Date().toISOString().split('T')[0]

  const count = await db.prepare(`
    SELECT COUNT(*) as count
    FROM linkedin_posts
    WHERE user_email = ?
    AND DATE(created_at) = ?
  `).bind(userEmail, today).first()

  if (count.count >= 150) {
    throw new Error('Daily LinkedIn posting limit reached (150 posts/day)')
  }
}

async function storeLinkedInPost(db, postData) {
  await db.prepare(`
    INSERT INTO linkedin_posts (
      id, graph_id, user_email, linkedin_post_id,
      post_url, visibility, share_commentary, og_image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    postData.id,
    postData.graph_id,
    postData.user_email,
    postData.linkedin_post_id,
    postData.post_url,
    postData.visibility,
    postData.share_commentary,
    postData.og_image_url
  ).run()
}

async function updateGraphLinkedInMetadata(db, graphId, postId, decrement = false) {
  // Fetch current graph data
  const graph = await db.prepare(
    'SELECT graphData FROM graphs WHERE id = ?'
  ).bind(graphId).first()

  if (!graph) return

  const graphData = JSON.parse(graph.graphData)

  // Update metadata
  const currentCount = graphData.metadata?.linkedinShareCount || 0
  const newCount = decrement ? Math.max(0, currentCount - 1) : currentCount + 1

  graphData.metadata = {
    ...graphData.metadata,
    linkedinPostId: decrement ? null : postId,
    linkedinSharedAt: decrement ? null : new Date().toISOString(),
    linkedinShareCount: newCount
  }

  // Save back
  await db.prepare(
    'UPDATE graphs SET graphData = ? WHERE id = ?'
  ).bind(JSON.stringify(graphData), graphId).run()
}

async function getUserLinkedInPosts(db, userEmail) {
  const posts = await db.prepare(`
    SELECT * FROM linkedin_posts
    WHERE user_email = ?
    ORDER BY created_at DESC
  `).bind(userEmail).all()

  return posts.results || []
}
