// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token, X-Email',
}

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    }),
  )
}

const clearCookie = (name, opts = {}) => {
  const parts = [`${name}=`]
  parts.push(`Path=${opts.path || '/'}`)
  if (opts.domain) parts.push(`Domain=${opts.domain}`)
  parts.push('HttpOnly')
  parts.push('Secure')
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`)
  parts.push('Max-Age=0')
  return parts.join('; ')
}

const setCookie = (name, value, opts = {}) => {
  const parts = [`${name}=${value}`]
  parts.push(`Path=${opts.path || '/'}`)
  if (opts.domain) parts.push(`Domain=${opts.domain}`)
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.httpOnly !== false) parts.push('HttpOnly')
  if (opts.secure !== false) parts.push('Secure')
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`)
  return parts.join('; ')
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
        scope:
          'openid email profile https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
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

    // OpenAPI 3.0 specification
    if (url.pathname === '/openapi.json') {
      const spec = {
        openapi: '3.0.0',
        info: {
          title: 'Auth Worker API',
          version: '1.0.0',
          description: 'Centralized OAuth authentication worker for Google (Photos Picker, Gmail, Calendar) and LinkedIn services. Manages token exchange, credential storage in KV, and image proxying.',
        },
        servers: [{ url: 'https://auth.vegvisr.org' }],
        paths: {
          '/': {
            get: {
              summary: 'Health check (root)',
              operationId: 'healthRoot',
              responses: { '200': { description: 'Worker is running', content: { 'text/plain': { schema: { type: 'string', example: 'Auth worker running' } } } } },
            },
          },
          '/health': {
            get: {
              summary: 'Health check',
              operationId: 'health',
              responses: { '200': { description: 'Worker is running', content: { 'text/plain': { schema: { type: 'string', example: 'Auth worker running' } } } } },
            },
          },
          '/openapi.json': {
            get: {
              summary: 'OpenAPI specification',
              operationId: 'getOpenApiSpec',
              responses: { '200': { description: 'OpenAPI 3.0 JSON spec', content: { 'application/json': { schema: { type: 'object' } } } } },
            },
          },
          '/auth/google/login': {
            get: {
              summary: 'Start Google OAuth login flow',
              operationId: 'googleLogin',
              description: 'Redirects to Google OAuth consent screen with openid, email, profile and Photos Picker scopes.',
              responses: { '302': { description: 'Redirect to Google OAuth consent screen' } },
            },
          },
          '/auth/google/callback': {
            get: {
              summary: 'Google OAuth callback',
              operationId: 'googleCallback',
              description: 'Handles Google OAuth callback, exchanges code for tokens, and redirects to frontend with tokens in query params.',
              parameters: [
                { name: 'code', in: 'query', required: false, schema: { type: 'string' }, description: 'Authorization code from Google' },
                { name: 'error', in: 'query', required: false, schema: { type: 'string' }, description: 'Error code if user denied consent' },
                { name: 'error_description', in: 'query', required: false, schema: { type: 'string' }, description: 'Human-readable error description' },
              ],
              responses: {
                '302': { description: 'Redirect to frontend with tokens or error in query params' },
              },
            },
          },
          '/auth/google/token': {
            post: {
              summary: 'Exchange authorization code for tokens',
              operationId: 'googleTokenExchange',
              description: 'Frontend-facing endpoint to exchange a Google authorization code for access/refresh tokens.',
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string', description: 'Google authorization code' } } } } },
              },
              responses: {
                '200': { description: 'Tokens returned', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, access_token: { type: 'string' }, refresh_token: { type: 'string' }, expires_in: { type: 'integer' } } } } } },
                '400': { description: 'Missing code or token exchange failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
              },
            },
          },
          '/picker/auth': {
            get: {
              summary: 'Start Google Photos Picker OAuth flow',
              operationId: 'pickerAuth',
              description: 'Redirects to Google OAuth for Photos Picker read-only access.',
              responses: { '302': { description: 'Redirect to Google OAuth consent screen' } },
            },
          },
          '/picker/callback': {
            get: {
              summary: 'Google Photos Picker OAuth callback',
              operationId: 'pickerCallback',
              description: 'Handles Picker OAuth callback, exchanges code for tokens, fetches user email, stores credentials in KV, and redirects to frontend.',
              parameters: [
                { name: 'code', in: 'query', required: false, schema: { type: 'string' }, description: 'Authorization code from Google' },
                { name: 'error', in: 'query', required: false, schema: { type: 'string' }, description: 'Error code' },
                { name: 'error_description', in: 'query', required: false, schema: { type: 'string' }, description: 'Error description' },
              ],
              responses: { '302': { description: 'Redirect to frontend with success or error' } },
            },
          },
          '/picker/store-credentials': {
            post: {
              summary: 'Store Google Picker credentials',
              operationId: 'pickerStoreCredentials',
              description: 'Stores access token and API key in KV keyed by user email.',
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['access_token', 'user_email'], properties: { access_token: { type: 'string' }, user_email: { type: 'string', format: 'email' } } } } },
              },
              responses: {
                '200': { description: 'Credentials stored', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } } },
                '400': { description: 'Missing required fields', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
              },
            },
          },
          '/picker/get-credentials': {
            post: {
              summary: 'Get Google Picker credentials',
              operationId: 'pickerGetCredentials',
              description: 'Retrieves stored Picker credentials from KV. Returns 410 if expired.',
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['user_email'], properties: { user_email: { type: 'string', format: 'email' } } } } },
              },
              responses: {
                '200': { description: 'Credentials returned', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, api_key: { type: 'string' }, access_token: { type: 'string' }, client_id: { type: 'string' } } } } } },
                '400': { description: 'Missing user_email', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '404': { description: 'No credentials found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorWithSuccess' } } } },
                '410': { description: 'Credentials expired', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorWithSuccess' } } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
              },
            },
          },
          '/picker/delete-credentials': {
            post: {
              summary: 'Delete Google Picker credentials',
              operationId: 'pickerDeleteCredentials',
              description: 'Deletes stored Picker credentials from KV for a user.',
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['user_email'], properties: { user_email: { type: 'string', format: 'email' } } } } },
              },
              responses: {
                '200': { description: 'Credentials deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } } },
                '400': { description: 'Missing user_email', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
              },
            },
          },
          '/picker/proxy-image': {
            post: {
              summary: 'Proxy Google Photos image',
              operationId: 'pickerProxyImage',
              description: 'Fetches a Google Photos image using stored credentials and returns the binary image data. Avoids CORS issues for the frontend.',
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['baseUrl', 'user_email'], properties: { baseUrl: { type: 'string', format: 'uri', description: 'Google Photos base URL for the image' }, user_email: { type: 'string', format: 'email' } } } } },
              },
              responses: {
                '200': { description: 'Image binary data', content: { 'image/*': { schema: { type: 'string', format: 'binary' } } } },
                '400': { description: 'Missing required fields', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '404': { description: 'No credentials found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
              },
            },
          },
          '/gmail/auth': {
            get: {
              summary: 'Start Gmail OAuth flow',
              operationId: 'gmailAuth',
              description: 'Redirects to Google OAuth consent screen with Gmail read, modify, and labels scopes.',
              responses: { '302': { description: 'Redirect to Google OAuth consent screen' } },
            },
          },
          '/gmail/callback': {
            get: {
              summary: 'Gmail OAuth callback',
              operationId: 'gmailCallback',
              description: 'Handles Gmail OAuth callback, exchanges code for tokens, fetches user email, stores credentials in KV (keyed as gmail:<email>), and redirects to frontend.',
              parameters: [
                { name: 'code', in: 'query', required: false, schema: { type: 'string' }, description: 'Authorization code from Google' },
                { name: 'error', in: 'query', required: false, schema: { type: 'string' }, description: 'Error code' },
                { name: 'error_description', in: 'query', required: false, schema: { type: 'string' }, description: 'Error description' },
              ],
              responses: { '302': { description: 'Redirect to frontend with success or error' } },
            },
          },
          '/gmail/get-credentials': {
            post: {
              summary: 'Get Gmail credentials',
              operationId: 'gmailGetCredentials',
              description: 'Retrieves Gmail credentials from KV. Automatically refreshes token if within 5 minutes of expiry.',
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['user_email'], properties: { user_email: { type: 'string', format: 'email' } } } } },
              },
              responses: {
                '200': { description: 'Credentials returned (may include refreshed: true)', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, access_token: { type: 'string' }, user_email: { type: 'string' }, refreshed: { type: 'boolean' } } } } } },
                '400': { description: 'Missing user_email', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '401': { description: 'Token refresh failed or no refresh token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorWithSuccess' } } } },
                '404': { description: 'No credentials found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorWithSuccess' } } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
              },
            },
          },
          '/gmail/delete-credentials': {
            post: {
              summary: 'Delete Gmail credentials',
              operationId: 'gmailDeleteCredentials',
              description: 'Deletes stored Gmail credentials from KV for a user.',
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['user_email'], properties: { user_email: { type: 'string', format: 'email' } } } } },
              },
              responses: {
                '200': { description: 'Credentials deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } } },
                '400': { description: 'Missing user_email', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
              },
            },
          },
          '/gmail/test-fetch': {
            post: {
              summary: 'Fetch latest Gmail email',
              operationId: 'gmailTestFetch',
              description: 'Test endpoint that fetches the latest email from the user\'s Gmail inbox. Automatically refreshes token if needed.',
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['user_email'], properties: { user_email: { type: 'string', format: 'email' } } } } },
              },
              responses: {
                '200': { description: 'Latest email returned', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, email: { type: 'object', properties: { id: { type: 'string' }, threadId: { type: 'string' }, subject: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, date: { type: 'string' }, snippet: { type: 'string' } } } } } } } },
                '400': { description: 'Missing user_email', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '401': { description: 'Token refresh failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '404': { description: 'No credentials found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
              },
            },
          },
          '/calendar/auth': {
            get: {
              summary: 'Start Google Calendar OAuth flow',
              operationId: 'calendarAuth',
              description: 'Redirects to Google OAuth consent screen with Calendar events and read-only scopes.',
              responses: { '302': { description: 'Redirect to Google OAuth consent screen' } },
            },
          },
          '/calendar/callback': {
            get: {
              summary: 'Google Calendar OAuth callback',
              operationId: 'calendarCallback',
              description: 'Handles Calendar OAuth callback, exchanges code for tokens, fetches user email, stores credentials in KV (keyed as calendar:<email>), and redirects to calendar.vegvisr.org.',
              parameters: [
                { name: 'code', in: 'query', required: false, schema: { type: 'string' }, description: 'Authorization code from Google' },
                { name: 'error', in: 'query', required: false, schema: { type: 'string' }, description: 'Error code' },
                { name: 'error_description', in: 'query', required: false, schema: { type: 'string' }, description: 'Error description' },
              ],
              responses: { '302': { description: 'Redirect to calendar frontend with success or error' } },
            },
          },
          '/calendar/get-credentials': {
            post: {
              summary: 'Get Calendar credentials',
              operationId: 'calendarGetCredentials',
              description: 'Retrieves Calendar credentials from KV. Automatically refreshes token if within 5 minutes of expiry.',
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['user_email'], properties: { user_email: { type: 'string', format: 'email' } } } } },
              },
              responses: {
                '200': { description: 'Credentials returned', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, access_token: { type: 'string' }, user_email: { type: 'string' }, refreshed: { type: 'boolean' } } } } } },
                '400': { description: 'Missing user_email', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '401': { description: 'Token refresh failed or no refresh token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorWithSuccess' } } } },
                '404': { description: 'No credentials found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorWithSuccess' } } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
              },
            },
          },
          '/calendar/delete-credentials': {
            post: {
              summary: 'Delete Calendar credentials',
              operationId: 'calendarDeleteCredentials',
              description: 'Deletes stored Calendar credentials from KV for a user.',
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object', required: ['user_email'], properties: { user_email: { type: 'string', format: 'email' } } } } },
              },
              responses: {
                '200': { description: 'Credentials deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } } },
                '400': { description: 'Missing user_email', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
              },
            },
          },
          '/auth/linkedin/login': {
            get: {
              summary: 'Start LinkedIn OAuth login flow',
              operationId: 'linkedinLogin',
              description: 'Redirects to LinkedIn OAuth consent screen. Supports personal_only and return_url query params.',
              parameters: [
                { name: 'personal_only', in: 'query', required: false, schema: { type: 'string', enum: ['true', 'false'] }, description: 'If true, skip organization access' },
                { name: 'return_url', in: 'query', required: false, schema: { type: 'string', format: 'uri' }, description: 'URL to redirect back to after auth (default: https://www.vegvisr.org/)' },
              ],
              responses: { '302': { description: 'Redirect to LinkedIn OAuth consent screen' } },
            },
          },
          '/auth/linkedin/callback': {
            get: {
              summary: 'LinkedIn OAuth callback',
              operationId: 'linkedinCallback',
              description: 'Handles LinkedIn OAuth callback, exchanges code for tokens, fetches profile, stores credentials in KV, and redirects to return URL with profile data.',
              parameters: [
                { name: 'code', in: 'query', required: false, schema: { type: 'string' }, description: 'Authorization code from LinkedIn' },
                { name: 'error', in: 'query', required: false, schema: { type: 'string' }, description: 'Error code' },
                { name: 'error_description', in: 'query', required: false, schema: { type: 'string' }, description: 'Error description' },
                { name: 'state', in: 'query', required: false, schema: { type: 'string' }, description: 'Base64-encoded JSON with returnUrl and personalOnly' },
              ],
              responses: { '302': { description: 'Redirect to return URL with tokens and profile data or error' } },
            },
          },
          '/auth/linkedin/profile': {
            get: {
              summary: 'Get LinkedIn profile',
              operationId: 'linkedinProfile',
              description: 'Fetches LinkedIn user profile using a Bearer token.',
              parameters: [
                { name: 'Authorization', in: 'header', required: true, schema: { type: 'string' }, description: 'Bearer <access_token>' },
              ],
              responses: {
                '200': { description: 'Profile returned', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, profile: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, givenName: { type: 'string' }, familyName: { type: 'string' }, email: { type: 'string' }, emailVerified: { type: 'boolean' }, picture: { type: 'string' }, locale: { type: 'object' } } } } } } } },
                '401': { description: 'Missing or invalid authorization', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
              },
            },
          },
          '/user/linkedin-token': {
            get: {
              summary: 'Get LinkedIn token for a user',
              operationId: 'userLinkedinToken',
              description: 'Retrieves stored LinkedIn access token and person URN from KV using x-user-email header.',
              parameters: [
                { name: 'x-user-email', in: 'header', required: true, schema: { type: 'string', format: 'email' }, description: 'User email to look up credentials for' },
              ],
              responses: {
                '200': { description: 'Token returned', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, access_token: { type: 'string' }, linkedin_person_urn: { type: 'string' }, linkedin_organizations: { type: 'array', items: { type: 'object' } }, expires_in: { type: 'integer' } } } } } },
                '400': { description: 'Missing x-user-email header', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '404': { description: 'No credentials found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
              },
            },
          },
        },
        components: {
          schemas: {
            Error: {
              type: 'object',
              properties: { error: { type: 'string' } },
            },
            ErrorWithSuccess: {
              type: 'object',
              properties: { success: { type: 'boolean', example: false }, error: { type: 'string' } },
            },
            SuccessMessage: {
              type: 'object',
              properties: { success: { type: 'boolean', example: true }, message: { type: 'string' } },
            },
          },
        },
      }

      return new Response(JSON.stringify(spec, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // 5. Google Picker OAuth flow
    if (url.pathname === '/picker/auth' && request.method === 'GET') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: 'https://auth.vegvisr.org/picker/callback',
        response_type: 'code',
        scope: 'email https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
        access_type: 'offline',
        prompt: 'consent',
      })
      return Response.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        302,
      )
    }

    // 6. Google Picker OAuth callback
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

        console.log('User data from Google:', userData)

        if (!userEmail) {
          console.error('No email found in user data:', userData)
          throw new Error('Could not retrieve user email from Google')
        }

        // Store credentials in KV automatically
        const credentials = {
          api_key: env.GOOGLE_API_KEY,
          access_token: tokenData.access_token,
          client_id: clientId,
          stored_at: Date.now(),
          expires_at: Date.now() + 3600 * 1000, // 1 hour from now
        }

        await env.GOOGLE_CREDENTIALS.put(userEmail, JSON.stringify(credentials))
        console.log('Stored credentials for user:', userEmail)

        // Redirect back to frontend with success (no token in URL anymore!)
        const successUrl = new URL('https://www.vegvisr.org/')
        successUrl.searchParams.set('picker_auth_success', 'true')
        successUrl.searchParams.set('user_email', userEmail)

        return Response.redirect(successUrl.toString(), 302)
      } catch (error) {
        return Response.redirect(
          `https://www.vegvisr.org/?picker_auth_error=${encodeURIComponent(error.message)}`,
          302,
        )
      }
    }

    // 7. Store Google Picker credentials in KV
    if (url.pathname === '/picker/store-credentials' && request.method === 'POST') {
      try {
        const { access_token, user_email } = await request.json()

        if (!access_token || !user_email) {
          return createResponse(
            JSON.stringify({ error: 'Access token and user email required' }),
            400,
          )
        }

        // Store credentials in KV with user email as key
        const credentials = {
          api_key: env.GOOGLE_API_KEY,
          access_token: access_token,
          client_id: clientId,
          stored_at: Date.now(),
          expires_at: Date.now() + 3600 * 1000, // 1 hour from now
        }

        await env.GOOGLE_CREDENTIALS.put(user_email, JSON.stringify(credentials))

        return createResponse(
          JSON.stringify({
            success: true,
            message: 'Credentials stored successfully',
          }),
        )
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // 8. Get Google Picker credentials from KV
    if (url.pathname === '/picker/get-credentials' && request.method === 'POST') {
      try {
        const { user_email } = await request.json()

        if (!user_email) {
          return createResponse(JSON.stringify({ error: 'User email required' }), 400)
        }

        // Get credentials from KV
        const storedCredentials = await env.GOOGLE_CREDENTIALS.get(user_email)

        if (!storedCredentials) {
          return createResponse(
            JSON.stringify({
              success: false,
              error: 'No credentials found for user',
            }),
            404,
          )
        }

        const credentials = JSON.parse(storedCredentials)

        // Check if credentials are still valid
        if (credentials.expires_at <= Date.now()) {
          // Remove expired credentials
          await env.GOOGLE_CREDENTIALS.delete(user_email)
          return createResponse(
            JSON.stringify({
              success: false,
              error: 'Credentials expired',
            }),
            410,
          )
        }

        // Return valid credentials
        return createResponse(
          JSON.stringify({
            success: true,
            api_key: credentials.api_key,
            access_token: credentials.access_token,
            client_id: credentials.client_id,
          }),
        )
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // 9. Delete Google Picker credentials from KV
    if (url.pathname === '/picker/delete-credentials' && request.method === 'POST') {
      try {
        const { user_email } = await request.json()

        if (!user_email) {
          return createResponse(JSON.stringify({ error: 'User email required' }), 400)
        }

        // Delete credentials from KV
        await env.GOOGLE_CREDENTIALS.delete(user_email)

        return createResponse(
          JSON.stringify({
            success: true,
            message: 'Credentials deleted successfully',
          }),
        )
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // 10. Proxy Google Photos images with authentication
    if (url.pathname === '/picker/proxy-image' && request.method === 'POST') {
      try {
        const { baseUrl, user_email } = await request.json()

        if (!baseUrl || !user_email) {
          return createResponse(JSON.stringify({ error: 'Base URL and user email required' }), 400)
        }

        // Get user's credentials
        const storedCredentials = await env.GOOGLE_CREDENTIALS.get(user_email)
        if (!storedCredentials) {
          return createResponse(JSON.stringify({ error: 'No credentials found for user' }), 404)
        }

        const credentials = JSON.parse(storedCredentials)

        // Fetch image with authentication
        const imageResponse = await fetch(baseUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${credentials.access_token}`,
          },
        })

        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`)
        }

        // Return the image with proper headers
        const imageData = await imageResponse.arrayBuffer()
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'

        return new Response(imageData, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            ...corsHeaders,
          },
        })
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // ============================================
    // GMAIL OAUTH ENDPOINTS (for inbox sync)
    // ============================================

    // Gmail OAuth - Start OAuth flow
    if (url.pathname === '/gmail/auth' && request.method === 'GET') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: 'https://auth.vegvisr.org/gmail/callback',
        response_type: 'code',
        scope: 'email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels',
        access_type: 'offline',
        prompt: 'consent',
      })
      return Response.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        302,
      )
    }

    // Gmail OAuth callback
    if (url.pathname === '/gmail/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        const errorDescription = url.searchParams.get('error_description') || error
        return Response.redirect(
          `https://www.vegvisr.org/?gmail_auth_error=${encodeURIComponent(errorDescription)}`,
          302,
        )
      }

      if (!code) {
        return Response.redirect(
          `https://www.vegvisr.org/?gmail_auth_error=${encodeURIComponent('No authorization code received')}`,
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
            redirect_uri: 'https://auth.vegvisr.org/gmail/callback',
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
          throw new Error(`Failed to get user info: ${userResponse.status}`)
        }

        const userData = await userResponse.json()
        const userEmail = userData.email

        if (!userEmail) {
          throw new Error('Could not retrieve user email from Google')
        }

        // Store credentials in KV with refresh token
        const credentials = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
          stored_at: Date.now(),
          user_email: userEmail,
          scopes: ['gmail.readonly', 'gmail.modify', 'gmail.labels'],
        }

        await env.GOOGLE_CREDENTIALS.put(`gmail:${userEmail}`, JSON.stringify(credentials))
        console.log('Stored Gmail credentials for user:', userEmail)

        // Redirect back to frontend with success
        const successUrl = new URL('https://www.vegvisr.org/')
        successUrl.searchParams.set('gmail_auth_success', 'true')
        successUrl.searchParams.set('user_email', userEmail)

        return Response.redirect(successUrl.toString(), 302)
      } catch (error) {
        return Response.redirect(
          `https://www.vegvisr.org/?gmail_auth_error=${encodeURIComponent(error.message)}`,
          302,
        )
      }
    }

    // Get Gmail credentials from KV
    if (url.pathname === '/gmail/get-credentials' && request.method === 'POST') {
      try {
        const { user_email } = await request.json()

        if (!user_email) {
          return createResponse(JSON.stringify({ error: 'User email required' }), 400)
        }

        // Get credentials from KV
        const storedCredentials = await env.GOOGLE_CREDENTIALS.get(`gmail:${user_email}`)

        if (!storedCredentials) {
          return createResponse(
            JSON.stringify({
              success: false,
              error: 'No Gmail credentials found for user',
            }),
            404,
          )
        }

        const credentials = JSON.parse(storedCredentials)

        // Check if token needs refresh (refresh 5 minutes before expiry)
        if (credentials.expires_at <= Date.now() + 5 * 60 * 1000) {
          // Refresh token using refresh_token
          if (!credentials.refresh_token) {
            return createResponse(
              JSON.stringify({
                success: false,
                error: 'No refresh token available. Please re-authenticate.',
              }),
              401,
            )
          }

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

          if (!refreshData.access_token) {
            return createResponse(
              JSON.stringify({
                success: false,
                error: 'Token refresh failed. Please re-authenticate.',
              }),
              401,
            )
          }

          // Update credentials with new access token
          const updatedCredentials = {
            ...credentials,
            access_token: refreshData.access_token,
            expires_at: Date.now() + (refreshData.expires_in || 3600) * 1000,
          }

          await env.GOOGLE_CREDENTIALS.put(`gmail:${user_email}`, JSON.stringify(updatedCredentials))

          return createResponse(
            JSON.stringify({
              success: true,
              access_token: updatedCredentials.access_token,
              user_email: updatedCredentials.user_email,
              refreshed: true,
            }),
          )
        }

        // Return valid credentials
        return createResponse(
          JSON.stringify({
            success: true,
            access_token: credentials.access_token,
            user_email: credentials.user_email,
          }),
        )
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // Delete Gmail credentials from KV
    if (url.pathname === '/gmail/delete-credentials' && request.method === 'POST') {
      try {
        const { user_email } = await request.json()

        if (!user_email) {
          return createResponse(JSON.stringify({ error: 'User email required' }), 400)
        }

        await env.GOOGLE_CREDENTIALS.delete(`gmail:${user_email}`)

        return createResponse(
          JSON.stringify({
            success: true,
            message: 'Gmail credentials deleted successfully',
          }),
        )
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // Test endpoint - Fetch latest Gmail email
    if (url.pathname === '/gmail/test-fetch' && request.method === 'POST') {
      try {
        const { user_email } = await request.json()

        if (!user_email) {
          return createResponse(JSON.stringify({ error: 'User email required' }), 400)
        }

        // Get credentials from KV
        const storedCredentials = await env.GOOGLE_CREDENTIALS.get(`gmail:${user_email}`)

        if (!storedCredentials) {
          return createResponse(
            JSON.stringify({ error: 'No Gmail credentials found. Please authenticate first.' }),
            404,
          )
        }

        let credentials = JSON.parse(storedCredentials)

        // Check token expiry and refresh if needed
        if (credentials.expires_at <= Date.now() + 5 * 60 * 1000) {
          if (!credentials.refresh_token) {
            return createResponse(
              JSON.stringify({ error: 'No refresh token. Please re-authenticate.' }),
              401,
            )
          }

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

          if (!refreshData.access_token) {
            return createResponse(
              JSON.stringify({ error: 'Token refresh failed. Please re-authenticate.' }),
              401,
            )
          }

          credentials = {
            ...credentials,
            access_token: refreshData.access_token,
            expires_at: Date.now() + (refreshData.expires_in || 3600) * 1000,
          }

          await env.GOOGLE_CREDENTIALS.put(`gmail:${user_email}`, JSON.stringify(credentials))
        }

        // Fetch latest message
        const listRes = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1',
          {
            headers: {
              Authorization: `Bearer ${credentials.access_token}`,
            },
          }
        )

        if (!listRes.ok) {
          const errorText = await listRes.text()
          throw new Error(`Gmail API error: ${listRes.status} - ${errorText}`)
        }

        const listData = await listRes.json()

        if (!listData.messages || listData.messages.length === 0) {
          return createResponse(
            JSON.stringify({
              success: true,
              message: 'No emails found in Gmail inbox',
            }),
          )
        }

        const messageId = listData.messages[0].id

        // Fetch full message
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
          {
            headers: {
              Authorization: `Bearer ${credentials.access_token}`,
            },
          }
        )

        if (!msgRes.ok) {
          const errorText = await msgRes.text()
          throw new Error(`Gmail API error: ${msgRes.status} - ${errorText}`)
        }

        const message = await msgRes.json()

        // Parse headers
        const headers = message.payload.headers
        const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)'
        const from = headers.find(h => h.name === 'From')?.value || 'unknown'
        const to = headers.find(h => h.name === 'To')?.value || 'unknown'
        const date = headers.find(h => h.name === 'Date')?.value || 'unknown'

        return createResponse(
          JSON.stringify({
            success: true,
            message: 'Successfully fetched latest Gmail email',
            email: {
              id: message.id,
              threadId: message.threadId,
              subject,
              from,
              to,
              date,
              snippet: message.snippet,
            },
          }),
        )
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // ============================================
    // GOOGLE CALENDAR OAUTH ENDPOINTS
    // ============================================

    // Calendar OAuth - Start flow
    if (url.pathname === '/calendar/auth' && request.method === 'GET') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: 'https://auth.vegvisr.org/calendar/callback',
        response_type: 'code',
        scope: 'email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
        access_type: 'offline',
        prompt: 'consent',
      })
      return Response.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        302,
      )
    }

    // Calendar OAuth callback
    if (url.pathname === '/calendar/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        const errorDescription = url.searchParams.get('error_description') || error
        return Response.redirect(
          `https://calendar.vegvisr.org/?calendar_auth_error=${encodeURIComponent(errorDescription)}`,
          302,
        )
      }

      if (!code) {
        return Response.redirect(
          `https://calendar.vegvisr.org/?calendar_auth_error=${encodeURIComponent('No authorization code received')}`,
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
            redirect_uri: 'https://auth.vegvisr.org/calendar/callback',
          }),
        })

        const tokenData = await tokenRes.json()

        if (!tokenData.access_token) {
          throw new Error(tokenData.error_description || 'Failed to get access token')
        }

        // Get user email from Google
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })

        if (!userResponse.ok) {
          throw new Error(`Failed to get user info: ${userResponse.status}`)
        }

        const userData = await userResponse.json()
        const userEmail = userData.email

        if (!userEmail) {
          throw new Error('Could not retrieve user email from Google')
        }

        // Store credentials in KV
        const credentials = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
          stored_at: Date.now(),
          user_email: userEmail,
          scopes: ['calendar.events', 'calendar.readonly'],
        }

        await env.GOOGLE_CREDENTIALS.put(`calendar:${userEmail}`, JSON.stringify(credentials))
        console.log('Stored Calendar credentials for user:', userEmail)

        // Redirect back to calendar app
        const successUrl = new URL('https://calendar.vegvisr.org/')
        successUrl.searchParams.set('calendar_auth_success', 'true')
        successUrl.searchParams.set('user_email', userEmail)

        return Response.redirect(successUrl.toString(), 302)
      } catch (error) {
        return Response.redirect(
          `https://calendar.vegvisr.org/?calendar_auth_error=${encodeURIComponent(error.message)}`,
          302,
        )
      }
    }

    // Get Calendar credentials from KV
    if (url.pathname === '/calendar/get-credentials' && request.method === 'POST') {
      try {
        const { user_email } = await request.json()

        if (!user_email) {
          return createResponse(JSON.stringify({ error: 'User email required' }), 400)
        }

        const storedCredentials = await env.GOOGLE_CREDENTIALS.get(`calendar:${user_email}`)

        if (!storedCredentials) {
          return createResponse(
            JSON.stringify({ success: false, error: 'No Calendar credentials found for user' }),
            404,
          )
        }

        const credentials = JSON.parse(storedCredentials)

        // Check if token needs refresh (5 minutes before expiry)
        if (credentials.expires_at <= Date.now() + 5 * 60 * 1000) {
          if (!credentials.refresh_token) {
            return createResponse(
              JSON.stringify({ success: false, error: 'No refresh token available. Please re-authenticate.' }),
              401,
            )
          }

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

          if (!refreshData.access_token) {
            return createResponse(
              JSON.stringify({ success: false, error: 'Token refresh failed. Please re-authenticate.' }),
              401,
            )
          }

          const updatedCredentials = {
            ...credentials,
            access_token: refreshData.access_token,
            expires_at: Date.now() + (refreshData.expires_in || 3600) * 1000,
          }

          await env.GOOGLE_CREDENTIALS.put(`calendar:${user_email}`, JSON.stringify(updatedCredentials))

          return createResponse(
            JSON.stringify({ success: true, access_token: updatedCredentials.access_token, user_email: updatedCredentials.user_email, refreshed: true }),
          )
        }

        return createResponse(
          JSON.stringify({ success: true, access_token: credentials.access_token, user_email: credentials.user_email }),
        )
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // Delete Calendar credentials from KV
    if (url.pathname === '/calendar/delete-credentials' && request.method === 'POST') {
      try {
        const { user_email } = await request.json()

        if (!user_email) {
          return createResponse(JSON.stringify({ error: 'User email required' }), 400)
        }

        await env.GOOGLE_CREDENTIALS.delete(`calendar:${user_email}`)

        return createResponse(
          JSON.stringify({ success: true, message: 'Calendar credentials deleted successfully' }),
        )
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // ============================================
    // LINKEDIN OAUTH ENDPOINTS
    // ============================================

    // LinkedIn Login - Start OAuth flow
    if (url.pathname === '/auth/linkedin/login') {
      const linkedinClientId = env.LINKEDIN_CLIENT_ID
      const redirectUri = env.LINKEDIN_REDIRECT_URI

      // Check if user only wants personal posting (no organization access)
      const personalOnly = url.searchParams.get('personal_only') === 'true'

      // Store return URL in state parameter (supports localhost:5173 for dev)
      const returnUrl = url.searchParams.get('return_url') || 'https://www.vegvisr.org/'
      const state = btoa(JSON.stringify({ returnUrl, personalOnly }))

      const scopes = 'openid profile email w_member_social'

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: linkedinClientId,
        redirect_uri: redirectUri,
        state: state,
        scope: scopes,
      })

      return Response.redirect(
        `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
        302,
      )
    }

    // LinkedIn Callback - Handle OAuth callback
    if (url.pathname === '/auth/linkedin/callback') {
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      const errorDescription = url.searchParams.get('error_description')
      const state = url.searchParams.get('state')

      // Parse state to get return URL (can be localhost:5173 for dev)
      let returnUrl = 'https://www.vegvisr.org/'
      let personalOnly = false
      try {
        if (state) {
          const stateData = JSON.parse(atob(state))
          returnUrl = stateData.returnUrl || returnUrl
          personalOnly = stateData.personalOnly || false
        }
      } catch (e) {
        console.error('Failed to parse state:', e)
      }

      // Handle OAuth errors
      if (error) {
        const errorMsg = errorDescription || error
        return Response.redirect(
          `${returnUrl}?linkedin_auth_error=${encodeURIComponent(errorMsg)}`,
          302,
        )
      }

      if (!code) {
        return Response.redirect(
          `${returnUrl}?linkedin_auth_error=${encodeURIComponent('No authorization code received')}`,
          302,
        )
      }

      try {
        const linkedinClientId = env.LINKEDIN_CLIENT_ID
        const linkedinClientSecret = env.LINKEDIN_CLIENT_SECRET
        const redirectUri = env.LINKEDIN_REDIRECT_URI

        // Exchange code for access token
        const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: linkedinClientId,
            client_secret: linkedinClientSecret,
            redirect_uri: redirectUri,
          }),
        })

        const tokenData = await tokenRes.json()

        if (!tokenData.access_token) {
          throw new Error(tokenData.error_description || tokenData.error || 'Failed to get access token')
        }

        // Fetch user profile using OpenID Connect userinfo endpoint
        const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        })

        const profile = await profileRes.json()

        if (profile.error) {
          throw new Error(profile.error_description || profile.error)
        }

        let organizations = []

        // Store LinkedIn credentials with organizations
        const credentials = {
          linkedin_access_token: tokenData.access_token,
          linkedin_refresh_token: tokenData.refresh_token,
          linkedin_expires_in: tokenData.expires_in || 3600,
          linkedin_person_urn: `urn:li:person:${profile.sub}`,
          linkedin_profile: profile,
          linkedin_organizations: organizations,
          updated_at: new Date().toISOString()
        }

        await env.GOOGLE_CREDENTIALS.put(profile.email, JSON.stringify(credentials))

        // Redirect back to frontend with profile data
        const successUrl = new URL(returnUrl)
        successUrl.searchParams.set('linkedin_auth_success', 'true')
        successUrl.searchParams.set('linkedin_access_token', tokenData.access_token)
        successUrl.searchParams.set('linkedin_expires_in', tokenData.expires_in || '3600')

        // Include basic profile info
        if (profile.sub) successUrl.searchParams.set('linkedin_id', profile.sub)
        if (profile.name) successUrl.searchParams.set('linkedin_name', encodeURIComponent(profile.name))
        if (profile.email) successUrl.searchParams.set('linkedin_email', encodeURIComponent(profile.email))
        if (profile.picture) successUrl.searchParams.set('linkedin_picture', encodeURIComponent(profile.picture))

        return Response.redirect(successUrl.toString(), 302)
      } catch (error) {
        return Response.redirect(
          `${returnUrl}?linkedin_auth_error=${encodeURIComponent(error.message)}`,
          302,
        )
      }
    }

    // LinkedIn Profile - Fetch profile with existing token
    if (url.pathname === '/auth/linkedin/profile' && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization')

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return createResponse(JSON.stringify({ error: 'Authorization header required' }), 401)
      }

      const accessToken = authHeader.replace('Bearer ', '')

      try {
        // Fetch user profile
        const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        const profile = await profileRes.json()

        if (profile.error) {
          return createResponse(JSON.stringify({
            error: profile.error_description || profile.error
          }), 401)
        }

        return createResponse(JSON.stringify({
          success: true,
          profile: {
            id: profile.sub,
            name: profile.name,
            givenName: profile.given_name,
            familyName: profile.family_name,
            email: profile.email,
            emailVerified: profile.email_verified,
            picture: profile.picture,
            locale: profile.locale,
          }
        }))
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // Get LinkedIn token for a user
    if (url.pathname === '/user/linkedin-token' && request.method === 'GET') {
      try {
        const userEmail = request.headers.get('x-user-email')
        if (!userEmail) {
          return createResponse(JSON.stringify({ error: 'Missing x-user-email header' }), 400)
        }

        // Get LinkedIn credentials from KV
        const credentials = await env.GOOGLE_CREDENTIALS.get(userEmail)
        if (!credentials) {
          return createResponse(JSON.stringify({ error: 'No LinkedIn credentials found for user' }), 404)
        }

        const creds = JSON.parse(credentials)
        if (!creds.linkedin_access_token) {
          return createResponse(JSON.stringify({ error: 'No LinkedIn access token found' }), 404)
        }

        return createResponse(JSON.stringify({
          success: true,
          access_token: creds.linkedin_access_token,
          linkedin_person_urn: creds.linkedin_person_urn,
          linkedin_organizations: creds.linkedin_organizations || [],
          expires_in: creds.linkedin_expires_in || 3600
        }))
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
