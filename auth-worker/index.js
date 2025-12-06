import { createClient as createOpenAuthClient } from '@openauthjs/openauth/client'
import { createSubjects } from '@openauthjs/openauth/subject'
import { object, string } from 'valibot'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const buildOpenAuthClient = (env) => {
  const subjects = createSubjects({ user: object({ id: string() }) })
  const client = createOpenAuthClient({
    issuer: env.OPENAUTH_ISSUER || 'https://openauth-template.torarnehave.workers.dev',
    subjects,
    clientID: env.OPENAUTH_CLIENT_ID || 'vegvisr-app-auth',
  })
  return { client, subjects }
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

const clearCookie = (name) => `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`

const setCookie = (name, value, opts = {}) => {
  const parts = [`${name}=${value}`]
  parts.push(`Path=${opts.path || '/'}`)
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.httpOnly !== false) parts.push('HttpOnly')
  if (opts.secure !== false) parts.push('Secure')
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`)
  return parts.join('; ')
}

const generateVerificationCode = () => {
  const digits = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000
  return digits.toString().padStart(6, '0')
}

const sha256Hex = async (input) => {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const normalizePhoneNumber = (phone) => {
  if (!phone) return null

  let phoneStr = String(phone).trim()
  if (!phoneStr) return null

  const cleaned = phoneStr.replace(/[()\s-]/g, '')
  const digits = cleaned.replace(/\D/g, '')

  if (cleaned.startsWith('+')) {
    if (cleaned.startsWith('+47')) return '+' + digits
    return null
  }

  if (cleaned.startsWith('00')) {
    const after00 = digits.replace(/^00/, '')
    if (after00.startsWith('47')) return '+' + after00
    return null
  }

  if (digits.length === 8) return '+47' + digits
  if (digits.length === 10 && digits.startsWith('47')) return '+' + digits

  return null
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

    if (url.pathname === '/auth/openauth/session') {
      const { client, subjects } = buildOpenAuthClient(env)
      const cookies = parseCookies(request.headers.get('Cookie') || '')
      const access = cookies.oa_access
      const refresh = cookies.oa_refresh

      if (!access || !refresh) {
        return createResponse(JSON.stringify({ success: false, error: 'No session' }), 401)
      }

      const verified = await client.verify(subjects, access, { refresh })
      if (verified.err) {
        return createResponse(JSON.stringify({ success: false, error: 'Invalid session' }), 401)
      }

      const headers = { ...corsHeaders }
      if (verified.tokens?.access) {
        headers['Set-Cookie'] = setCookie('oa_access', verified.tokens.access, {
          maxAge: verified.tokens.expiresIn || 3600,
        })
      }

      return createResponse(
        JSON.stringify({ success: true, subject: verified.subject?.properties || {} }),
        200,
        headers,
      )
    }

    if (url.pathname === '/auth/phone/status' && request.method === 'GET') {
      try {
        const email = (url.searchParams.get('email') || '').trim().toLowerCase()
        if (!email) {
          return createResponse(JSON.stringify({ error: 'Email is required' }), 400)
        }

        const row = await env.VEGVISR_DB.prepare(
          'SELECT phone, phone_verified_at FROM config WHERE email = ?1',
        )
          .bind(email)
          .first()

        if (!row) {
          return createResponse(JSON.stringify({ success: false, error: 'User not found' }), 404)
        }

        return createResponse(
          JSON.stringify({
            success: true,
            phone: row.phone || null,
            phone_verified_at: row.phone_verified_at || null,
            verified: !!row.phone_verified_at,
          }),
        )
      } catch (error) {
        console.error('Error in /auth/phone/status', error)
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    if (url.pathname === '/auth/phone/send-code' && request.method === 'POST') {
      try {
        const body = await request.json()
        const email = (body.email || '').trim().toLowerCase()
        const phone = normalizePhoneNumber(body.phone)

        if (!email || !phone) {
          return createResponse(JSON.stringify({ error: 'Email and a Norwegian phone number are required' }), 400)
        }

        const code = generateVerificationCode()
        const codeHash = await sha256Hex(code)
        const expiresAt = Math.floor((Date.now() + 5 * 60 * 1000) / 1000)

        const existing = await env.VEGVISR_DB.prepare('SELECT email FROM config WHERE email = ?1')
          .bind(email)
          .first()

        if (existing) {
          await env.VEGVISR_DB.prepare(
            'UPDATE config SET phone = ?1, phone_verified_at = NULL, phone_verification_code = ?2, phone_verification_expires_at = ?3 WHERE email = ?4',
          )
            .bind(phone, codeHash, expiresAt, email)
            .run()
        } else {
          await env.VEGVISR_DB.prepare(
            "INSERT INTO config (email, data, phone, phone_verified_at, phone_verification_code, phone_verification_expires_at) VALUES (?1, '{}', ?2, NULL, ?3, ?4)",
          )
            .bind(email, phone, codeHash, expiresAt)
            .run()
        }

        const smsPayload = {
          to: phone,
          message: `Vegvisr verification code: ${code}`,
          sender: 'Vegvisr',
        }

        const smsBinding = env.SMS_GATEWAY || env.SMS_WORKER
        if (!smsBinding) {
          return createResponse(JSON.stringify({ error: 'SMS service binding missing' }), 500)
        }

        const smsResponse = await smsBinding.fetch('https://sms-gateway.internal/api/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(smsPayload),
        })

        let smsData = null
        try {
          smsData = await smsResponse.json()
        } catch (err) {
          console.error('Failed to parse SMS response', err)
        }

        if (!smsResponse.ok || !smsData?.success) {
          return createResponse(
            JSON.stringify({ error: 'Failed to send verification SMS', details: smsData?.error || smsData }),
            502,
          )
        }

        return createResponse(
          JSON.stringify({ success: true, phone, expires_at: expiresAt }),
          200,
        )
      } catch (error) {
        console.error('Error in /auth/phone/send-code', error)
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    if (url.pathname === '/auth/phone/verify-code' && request.method === 'POST') {
      try {
        const body = await request.json()
        const email = (body.email || '').trim().toLowerCase()
        const code = String(body.code || '').trim()

        if (!email || !code || !/^\d{6}$/.test(code)) {
          return createResponse(JSON.stringify({ error: 'Email and a 6-digit code are required' }), 400)
        }

        const row = await env.VEGVISR_DB.prepare(
          'SELECT phone, phone_verification_code, phone_verification_expires_at FROM config WHERE email = ?1',
        )
          .bind(email)
          .first()

        if (!row || !row.phone) {
          return createResponse(JSON.stringify({ error: 'No phone on record for this user' }), 404)
        }

        if (!row.phone_verification_code || !row.phone_verification_expires_at) {
          return createResponse(JSON.stringify({ error: 'No active verification code' }), 400)
        }

        const now = Math.floor(Date.now() / 1000)
        if (row.phone_verification_expires_at < now) {
          return createResponse(JSON.stringify({ error: 'Verification code expired' }), 400)
        }

        const codeHash = await sha256Hex(code)
        if (codeHash !== row.phone_verification_code) {
          return createResponse(JSON.stringify({ error: 'Invalid verification code' }), 401)
        }

        await env.VEGVISR_DB.prepare(
          'UPDATE config SET phone_verified_at = ?1, phone_verification_code = NULL, phone_verification_expires_at = NULL WHERE email = ?2',
        )
          .bind(now, email)
          .run()

        return createResponse(JSON.stringify({ success: true, phone: row.phone }), 200)
      } catch (error) {
        console.error('Error in /auth/phone/verify-code', error)
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
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

    // OpenAuth-protected endpoint and callback
    if (url.pathname === '/auth/openauth/login') {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: '/auth/openauth/protected',
        },
      })
    }

    if (url.pathname === '/auth/openauth/protected') {
      const { client } = buildOpenAuthClient(env)
      const [verifier, redirectUrl] = await client.pkce('https://auth.vegvisr.org/callback')

      return new Response(null, {
        status: 302,
        headers: {
          Location: redirectUrl,
          'Set-Cookie': `oa_verifier=${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        },
      })
    }

    if (url.pathname === '/callback') {
      const { client, subjects } = buildOpenAuthClient(env)
      const code = url.searchParams.get('code')
      const cookies = parseCookies(request.headers.get('Cookie') || '')
      const verifier = cookies.oa_verifier

      if (!code || !verifier) {
        return new Response('Missing code or verifier', { status: 400, headers: corsHeaders })
      }

      const exchanged = await client.exchange(
        code,
        'https://auth.vegvisr.org/callback',
        verifier,
      )
      if (exchanged.err) {
        return new Response('Authorization code invalid', { status: 401, headers: corsHeaders })
      }

      const verified = await client.verify(subjects, exchanged.tokens.access, {
        refresh: exchanged.tokens.refresh,
      })

      if (verified.err) {
        return new Response('Access token invalid', { status: 401, headers: corsHeaders })
      }

      const subject = verified.subject?.properties || {}

      // Persist oauth_id in config without disturbing existing user_id/data
      if (subject.id) {
        try {
          const existing = await env.VEGVISR_DB.prepare(
            'SELECT email FROM config WHERE email = ?1',
          )
            .bind(subject.email || '')
            .first()

          if (existing) {
            await env.VEGVISR_DB.prepare(
              'UPDATE config SET oauth_id = ?1 WHERE email = ?2',
            )
              .bind(subject.id, subject.email || '')
              .run()
          } else {
            await env.VEGVISR_DB.prepare(
              "INSERT INTO config (email, oauth_id, data) VALUES (?1, ?2, '{}')",
            )
              .bind(subject.email || '', subject.id)
              .run()
          }
        } catch (err) {
          console.error('Failed to sync oauth_id to config', err)
          // Continue without blocking login
        }
      }

      const headers = new Headers({ ...corsHeaders })
      const accessCookie = setCookie('oa_access', exchanged.tokens.access, {
        maxAge: exchanged.tokens.expiresIn || 3600,
      })
      const refreshCookie = exchanged.tokens.refresh
        ? setCookie('oa_refresh', exchanged.tokens.refresh, {
            maxAge: 60 * 60 * 24 * 30,
          })
        : null
      headers.append('Set-Cookie', clearCookie('oa_verifier'))
      headers.append('Set-Cookie', accessCookie)
      if (refreshCookie) headers.append('Set-Cookie', refreshCookie)

      const dashboardUrl = env.DASHBOARD_URL || 'https://www.vegvisr.org/user'
      headers.set('Location', dashboardUrl)

      return new Response(null, { status: 302, headers })
    }

    if (url.pathname === '/auth/openauth/logout') {
      const headers = new Headers({ ...corsHeaders })
      headers.append('Set-Cookie', clearCookie('oa_access'))
      headers.append('Set-Cookie', clearCookie('oa_refresh'))
      const loginUrl = 'https://auth.vegvisr.org/auth/openauth/login'
      headers.set('Location', loginUrl)
      return new Response(null, { status: 302, headers })
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
            scope: 'email https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
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
        scope: 'email https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
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

    // 8. Store Google Picker credentials in KV
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

    // 9. Get Google Picker credentials from KV
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

    // 10. Delete Google Picker credentials from KV
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

    // 11. Legacy endpoint for backward compatibility
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

    // 12. Proxy Google Photos images with authentication
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

    return new Response('Not found', {
      status: 404,
      headers: corsHeaders,
    })
  },
}
