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

    // 1. Login endpoint: /auth/google/login
    if (url.pathname === '/auth/google/login') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile https://www.googleapis.com/auth/photoslibrary.readonly',
        access_type: 'offline',
        prompt: 'consent',
      })
      return Response.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        302,
      )
    }

    // 2. Callback endpoint: /auth/google/callback
    if (url.pathname === '/auth/google/callback') {
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      // Handle OAuth errors
      if (error) {
        const errorDescription = url.searchParams.get('error_description') || error
        // Redirect back to frontend with error
        return Response.redirect(
          `https://www.vegvisr.org/?google_auth_error=${encodeURIComponent(errorDescription)}`,
          302,
        )
      }

      if (!code) {
        return Response.redirect(
          `https://www.vegvisr.org/?google_auth_error=${encodeURIComponent('No authorization code received')}`,
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

        // Redirect back to frontend with success and token info
        const successUrl = new URL('https://www.vegvisr.org/')
        successUrl.searchParams.set('google_auth_success', 'true')
        successUrl.searchParams.set('google_access_token', tokenData.access_token)
        if (tokenData.refresh_token) {
          successUrl.searchParams.set('google_refresh_token', tokenData.refresh_token)
        }
        successUrl.searchParams.set('google_expires_in', tokenData.expires_in || '3600')

        return Response.redirect(successUrl.toString(), 302)
      } catch (error) {
        // Redirect back to frontend with error
        return Response.redirect(
          `https://www.vegvisr.org/?google_auth_error=${encodeURIComponent(error.message)}`,
          302,
        )
      }
    }

    // 3. Token exchange endpoint for frontend
    if (url.pathname === '/auth/google/token' && request.method === 'POST') {
      try {
        const { code } = await request.json()

        if (!code) {
          return createResponse(JSON.stringify({ error: 'Authorization code required' }), 400)
        }

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
          return createResponse(
            JSON.stringify({
              error: tokenData.error_description || 'Failed to get access token',
            }),
            400,
          )
        }

        return createResponse(
          JSON.stringify({
            success: true,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in,
          }),
        )
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // 4. Health check or fallback
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('Auth worker running', {
        status: 200,
        headers: corsHeaders,
      })
    }

    // 5. Google Picker initialization endpoint
    if (url.pathname === '/picker/init' && request.method === 'GET') {
      try {
        // Return configuration for Google Picker (without exposing API key directly)
        return createResponse(
          JSON.stringify({
            success: true,
            client_id: clientId,
            auth_url: `https://auth.vegvisr.org/picker/auth`,
            scope: 'https://www.googleapis.com/auth/photoslibrary.readonly',
          }),
        )
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // 6. Google Picker OAuth flow
    if (url.pathname === '/picker/auth' && request.method === 'GET') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: 'https://auth.vegvisr.org/picker/callback',
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/photoslibrary.readonly',
        access_type: 'offline',
        prompt: 'consent',
      })
      return Response.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        302,
      )
    }

    // 7. Google Picker OAuth callback
    if (url.pathname === '/picker/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        const errorDescription = url.searchParams.get('error_description') || error
        return Response.redirect(
          `https://www.vegvisr.org/?picker_auth_error=${encodeURIComponent(errorDescription)}`,
          302,
        )
      }

      if (!code) {
        return Response.redirect(
          `https://www.vegvisr.org/?picker_auth_error=${encodeURIComponent('No authorization code received')}`,
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
            redirect_uri: 'https://auth.vegvisr.org/picker/callback',
          }),
        })

        const tokenData = await tokenRes.json()

        if (!tokenData.access_token) {
          throw new Error(tokenData.error_description || 'Failed to get access token')
        }

        // Redirect back to frontend with picker auth success
        const successUrl = new URL('https://www.vegvisr.org/')
        successUrl.searchParams.set('picker_auth_success', 'true')
        successUrl.searchParams.set('picker_access_token', tokenData.access_token)
        successUrl.searchParams.set('picker_expires_in', tokenData.expires_in || '3600')

        return Response.redirect(successUrl.toString(), 302)
      } catch (error) {
        return Response.redirect(
          `https://www.vegvisr.org/?picker_auth_error=${encodeURIComponent(error.message)}`,
          302,
        )
      }
    }

    // 8. Google Picker token + API key endpoint
    if (url.pathname === '/picker/credentials' && request.method === 'POST') {
      try {
        const { access_token } = await request.json()

        if (!access_token) {
          return createResponse(JSON.stringify({ error: 'Access token required' }), 400)
        }

        // Return both API key and validated token for picker
        return createResponse(
          JSON.stringify({
            success: true,
            api_key: env.GOOGLE_API_KEY,
            access_token: access_token,
            client_id: clientId,
          }),
        )
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    return new Response('Not found', {
      status: 404,
      headers: corsHeaders,
    })
  },
}
