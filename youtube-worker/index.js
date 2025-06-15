// YouTube Authentication Worker
// Handles OAuth2 flows specifically for YouTube Data API v3 access

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const createResponse = (body, status = 200, headers = {}) => {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...headers },
  })
}

export default {
  async fetch(request, env) {
    const clientId = env.GOOGLE_CLIENT_ID
    const clientSecret = env.GOOGLE_CLIENT_SECRET
    const redirectUri = env.GOOGLE_REDIRECT_URI
    const url = new URL(request.url)

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    // 1. Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('YouTube Auth Worker running', {
        status: 200,
        headers: corsHeaders,
      })
    }

    // 2. Start YouTube OAuth flow
    if (url.pathname === '/auth' && request.method === 'GET') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email https://www.googleapis.com/auth/youtube.force-ssl',
        access_type: 'offline',
        prompt: 'consent',
      })
      return Response.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        302,
      )
    }

    // 3. Handle YouTube OAuth callback
    if (url.pathname === '/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        const errorDescription = url.searchParams.get('error_description') || error
        return Response.redirect(
          `https://www.vegvisr.org/?youtube_auth_error=${encodeURIComponent(errorDescription)}`,
          302,
        )
      }

      if (!code) {
        return Response.redirect(
          `https://www.vegvisr.org/?youtube_auth_error=${encodeURIComponent('No authorization code received')}`,
          302,
        )
      }

      try {
        // Exchange code for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        })

        const tokenData = await tokenRes.json()

        if (!tokenData.access_token) {
          throw new Error(tokenData.error_description || 'Failed to get access token')
        }

        // Get user email from Google
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        })

        if (!userResponse.ok) {
          console.error('Failed to get user info:', userResponse.status, userResponse.statusText)
          throw new Error(`Failed to get user info: ${userResponse.status}`)
        }

        const userData = await userResponse.json()
        const userEmail = userData.email

        console.log('YouTube auth - User data from Google:', userData)

        if (!userEmail) {
          console.error('No email found in user data:', userData)
          throw new Error('Could not retrieve user email from Google')
        }

        // Store YouTube credentials in KV
        const credentials = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          api_key: env.YOUTUBE_API_KEY,
          client_id: clientId,
          stored_at: Date.now(),
          expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
          scope: 'youtube.force-ssl',
        }

        await env.YOUTUBE_CREDENTIALS.put(userEmail, JSON.stringify(credentials))
        console.log('✅ Stored YouTube credentials for user:', userEmail)

        // Redirect back to frontend with success
        const successUrl = new URL('https://www.vegvisr.org/')
        successUrl.searchParams.set('youtube_auth_success', 'true')
        successUrl.searchParams.set('user_email', userEmail)

        return Response.redirect(successUrl.toString(), 302)
      } catch (error) {
        console.error('YouTube OAuth error:', error)
        return Response.redirect(
          `https://www.vegvisr.org/?youtube_auth_error=${encodeURIComponent(error.message)}`,
          302,
        )
      }
    }

    // 4. Get YouTube credentials for a user
    if (url.pathname === '/credentials' && request.method === 'POST') {
      try {
        const { user_email } = await request.json()

        if (!user_email) {
          return createResponse(JSON.stringify({ error: 'User email required' }), 400)
        }

        // Get YouTube credentials from KV
        const storedCredentials = await env.YOUTUBE_CREDENTIALS.get(user_email)

        if (!storedCredentials) {
          return createResponse(
            JSON.stringify({
              success: false,
              error: 'No YouTube credentials found for user',
              needs_auth: true,
              auth_url: 'https://youtube-auth.vegvisr.org/auth',
            }),
            404,
          )
        }

        const credentials = JSON.parse(storedCredentials)

        // Check if credentials are still valid
        if (credentials.expires_at <= Date.now()) {
          // Try to refresh the token if we have a refresh token
          if (credentials.refresh_token) {
            console.log('🔄 Refreshing expired YouTube token for user:', user_email)

            try {
              const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  client_id: clientId,
                  client_secret: clientSecret,
                  refresh_token: credentials.refresh_token,
                  grant_type: 'refresh_token',
                }),
              })

              const refreshData = await refreshRes.json()

              if (refreshData.access_token) {
                // Update stored credentials
                const updatedCredentials = {
                  ...credentials,
                  access_token: refreshData.access_token,
                  expires_at: Date.now() + (refreshData.expires_in || 3600) * 1000,
                  stored_at: Date.now(),
                }

                await env.YOUTUBE_CREDENTIALS.put(user_email, JSON.stringify(updatedCredentials))
                console.log('✅ Refreshed YouTube token for user:', user_email)

                return createResponse(
                  JSON.stringify({
                    success: true,
                    access_token: updatedCredentials.access_token,
                    api_key: updatedCredentials.api_key,
                    client_id: updatedCredentials.client_id,
                    scope: updatedCredentials.scope,
                  }),
                )
              }
            } catch (refreshError) {
              console.error('Failed to refresh token:', refreshError)
            }
          }

          // Remove expired credentials
          await env.YOUTUBE_CREDENTIALS.delete(user_email)
          return createResponse(
            JSON.stringify({
              success: false,
              error: 'YouTube credentials expired and could not be refreshed',
              needs_auth: true,
              auth_url: 'https://youtube-auth.vegvisr.org/auth',
            }),
            410,
          )
        }

        // Return valid credentials
        return createResponse(
          JSON.stringify({
            success: true,
            access_token: credentials.access_token,
            api_key: credentials.api_key,
            client_id: credentials.client_id,
            scope: credentials.scope,
          }),
        )
      } catch (error) {
        console.error('Error getting credentials:', error)
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // 5. Delete YouTube credentials
    if (url.pathname === '/credentials' && request.method === 'DELETE') {
      try {
        const { user_email } = await request.json()

        if (!user_email) {
          return createResponse(JSON.stringify({ error: 'User email required' }), 400)
        }

        // Delete YouTube credentials from KV
        await env.YOUTUBE_CREDENTIALS.delete(user_email)
        console.log('🗑️ Deleted YouTube credentials for user:', user_email)

        return createResponse(
          JSON.stringify({
            success: true,
            message: 'YouTube credentials deleted successfully',
          }),
        )
      } catch (error) {
        console.error('Error deleting credentials:', error)
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // 6. List all users with YouTube credentials (admin endpoint)
    if (url.pathname === '/admin/users' && request.method === 'GET') {
      try {
        // Get admin token from headers
        const adminToken = request.headers.get('Authorization')?.replace('Bearer ', '')

        // Simple admin check (in production, use proper admin authentication)
        if (!adminToken || adminToken !== env.ADMIN_TOKEN) {
          return createResponse(JSON.stringify({ error: 'Unauthorized' }), 401)
        }

        const list = await env.YOUTUBE_CREDENTIALS.list()

        const users = await Promise.all(
          list.keys.map(async (key) => {
            const credentials = JSON.parse(await env.YOUTUBE_CREDENTIALS.get(key.name))
            return {
              email: key.name,
              stored_at: credentials.stored_at,
              expires_at: credentials.expires_at,
              expired: credentials.expires_at <= Date.now(),
              scope: credentials.scope,
            }
          }),
        )

        return createResponse(
          JSON.stringify({
            success: true,
            total_users: users.length,
            users: users.sort((a, b) => b.stored_at - a.stored_at),
          }),
        )
      } catch (error) {
        console.error('Error listing users:', error)
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    return new Response('Not found', {
      status: 404,
      headers: corsHeaders,
    })
  },
}
