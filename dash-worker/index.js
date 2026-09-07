export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url

    // Middleware to handle CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token, x-user-role, x-user-email',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const getTokenFromRequest = () => {
      const authHeader = request.headers.get('Authorization') || ''
      const bearerToken = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null
      const apiToken = request.headers.get('X-API-Token')
      const cookieHeader = request.headers.get('Cookie') || ''
      const cookieToken = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('vegvisr_token='))
        ?.split('=')
        .slice(1)
        .join('=')

      return bearerToken || apiToken || (cookieToken ? decodeURIComponent(cookieToken) : null)
    }

    if (pathname === '/' || pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'vegvisr-dash-worker' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (pathname === '/version') {
      return new Response(JSON.stringify({ version: '1.0.0' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (pathname === '/auth/validate-token' && request.method === 'GET') {
      try {
        const token = getTokenFromRequest()

        if (!token) {
          return new Response(JSON.stringify({ valid: false, error: 'Missing token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const db = env.vegvisr_org
        const user = await db
          .prepare('SELECT email, user_id, oauth_id, Role FROM config WHERE emailVerificationToken = ?')
          .bind(token)
          .first()

        if (!user) {
          return new Response(JSON.stringify({ valid: false, error: 'Invalid token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(
          JSON.stringify({
            valid: true,
            email: user.email,
            user_id: user.user_id || null,
            oauth_id: user.oauth_id || null,
            role: user.role || user.Role || null,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      } catch (error) {
        console.error('Error in GET /auth/validate-token:', error)
        return new Response(JSON.stringify({ valid: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (pathname === '/userdata-from-token' && request.method === 'GET') {
      try {
        const token = getTokenFromRequest()
        if (!token) {
          return new Response(JSON.stringify({ error: 'Missing token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const db = env.vegvisr_org
        const row = await db
          .prepare(
            `SELECT email, user_id, oauth_id, bio, profileimage, emailVerificationToken, role, data, phone, phone_verified_at
             FROM config
             WHERE emailVerificationToken = ?
             LIMIT 1;`,
          )
          .bind(token)
          .first()

        if (!row) {
          return new Response(JSON.stringify({ error: 'Invalid token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const parsedData = row.data ? JSON.parse(row.data) : {}
        const response = {
          email: row.email,
          user_id: row.user_id || null,
          oauth_id: row.oauth_id || row.user_id || null,
          bio: row.bio || '',
          profileimage: row.profileimage || '',
          emailVerificationToken: row.emailVerificationToken || null,
          role: row.role || row.Role || null,
          phone: row.phone || null,
          phoneVerifiedAt: row.phone_verified_at || null,
          data: parsedData,
        }

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('Error in GET /userdata-from-token:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Helper: load/derive crypto key for app password encryption
    const getAppPassCryptoKey = async () => {
      const secret = env.APP_PASSWORD_KEY
      if (!secret) return null
      const raw = Uint8Array.from(atob(secret), c => c.charCodeAt(0))
      return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
    }

    const encryptAppPassword = async (plaintext) => {
      const key = await getAppPassCryptoKey()
      if (!key) return null
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const enc = new TextEncoder().encode(plaintext)
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc)
      return {
        iv: btoa(String.fromCharCode(...iv)),
        ct: btoa(String.fromCharCode(...new Uint8Array(ct))),
      }
    }

    const decryptAppPassword = async (bundle) => {
      const key = await getAppPassCryptoKey()
      if (!key || !bundle?.iv || !bundle?.ct) return null
      const iv = Uint8Array.from(atob(bundle.iv), c => c.charCodeAt(0))
      const ct = Uint8Array.from(atob(bundle.ct), c => c.charCodeAt(0))
      const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
      return new TextDecoder().decode(plainBuf)
    }

    const emailWorkerUrl = env.EMAIL_WORKER_URL || 'https://email-worker.torarnehave.workers.dev'

    if (pathname === '/userdata' && request.method === 'GET') {
      try {
        console.log('Received GET /userdata request with query:', url.searchParams.toString())
        const email = url.searchParams.get('email')
        if (!email) {
          console.error('Missing email parameter in GET /userdata request')
          return new Response(JSON.stringify({ error: 'Missing email parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const db = env.vegvisr_org
  const query = `SELECT user_id, bio, profileimage, emailVerificationToken, role, data, phone, phone_verified_at FROM config WHERE email = ?;`
        console.log('Executing database query:', query, 'with email:', email)
        const row = await db.prepare(query).bind(email).first()

        if (!row) {
          console.warn('No data found for email:', email)
          // If no data exists, return a default structure
          const response = {
            email,
            user_id: null,
            bio: '',
            profileimage: '',
            emailVerificationToken: null,
            role: null,
            phone: null,
            phoneVerifiedAt: null,
          }
          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const parsedData = row.data ? JSON.parse(row.data) : {}
        const response = {
          email,
          user_id: row.user_id,
          bio: row.bio || '', // Include bio field
          profileimage: row.profileimage,
          emailVerificationToken: row.emailVerificationToken,
          role: row.role,
          phone: row.phone || null,
          phoneVerifiedAt: row.phone_verified_at || null,
          data: parsedData,
        }
        console.log('Returning response for GET /userdata:', JSON.stringify(response, null, 2))
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('Error in GET /userdata:', error.message)
        console.error('Stack trace:', error.stack)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // NEW ENDPOINT: List all domains from KV by owner email
    if (pathname === '/domains/list' && request.method === 'GET') {
      try {
        const email = url.searchParams.get('email')
        if (!email) {
          return new Response(JSON.stringify({ error: 'Missing email parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        console.log('Fetching all domains from KV for owner:', email)

        // List all keys in the SITE_CONFIGS KV namespace
        const listResult = await env.SITE_CONFIGS.list({ prefix: 'site-config:' })
        console.log('Found', listResult.keys.length, 'total site-config entries in KV')

        // Fetch each config and filter by owner
        const userDomains = []
        for (const key of listResult.keys) {
          try {
            const configJson = await env.SITE_CONFIGS.get(key.name)
            if (configJson) {
              const config = JSON.parse(configJson)
              if (config.owner === email) {
                userDomains.push(config)
                console.log('Found user domain:', config.domain)
              }
            }
          } catch (parseError) {
            console.warn('Error parsing KV entry:', key.name, parseError.message)
          }
        }

        console.log('Total domains for user', email, ':', userDomains.length)

        return new Response(JSON.stringify({
          success: true,
          domains: userDomains,
          count: userDomains.length
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('Error fetching domains from KV:', error.message)
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (pathname === '/upload' && request.method === 'POST') {
      try {
        console.log('Received POST /upload request')
        const { MY_R2_BUCKET, vegvisr_org } = env
        const formData = await request.formData()
        const file = formData.get('file')
        const email = formData.get('email')

        console.log('Form data:', { file, email })

        if (!file || !email) {
          console.error('Missing file or email')
          return new Response(JSON.stringify({ error: 'Missing file or email' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const fileExtension = file.name ? file.name.split('.').pop() : ''
        if (!fileExtension) {
          console.error('Invalid file name or extension')
          return new Response(JSON.stringify({ error: 'Invalid file name or extension' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const fileName = `${email}-${Date.now()}.${fileExtension}`
        console.log('Uploading file to R2:', fileName)

        const contentType = fileExtension === 'svg' ? 'image/svg+xml' : file.type

        await MY_R2_BUCKET.put(fileName, file.stream(), {
          httpMetadata: {
            contentType: contentType,
          },
        })

        const fileUrl = `https://profile.vegvisr.org/${fileName}`
        console.log('File uploaded to R2:', fileUrl)

        const query = `
          INSERT INTO config (email, profileimage, data)
          VALUES (?, ?, COALESCE((SELECT data FROM config WHERE email = ?), '{}'))
          ON CONFLICT(email) DO UPDATE SET profileimage = ?, data = COALESCE(data, '{}');
        `
        console.log('Query:', query)

        console.log('Updating database with profile image URL')
        await vegvisr_org.prepare(query).bind(email, fileUrl, email, fileUrl).run()

        console.log('Returning success response')
        return new Response(JSON.stringify({ success: true, fileUrl }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('Error in POST /upload:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (pathname === '/userdata' && request.method === 'PUT') {
      try {
        const db = env.vegvisr_org
        const body = await request.json()
        console.log('Received PUT /userdata request:', JSON.stringify(body, null, 2))
        const { email, data, profileimage, appPassword, saveAppPassword } = body

        // Validate required fields
        if (!email || !data) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: email or data' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        }

        // Load existing data to avoid wiping unrelated fields when only a subset is sent
        const existingRow = await db
          .prepare('SELECT data, profileimage FROM config WHERE email = ?')
          .bind(email)
          .first()
        const existingData = existingRow?.data ? JSON.parse(existingRow.data) : {}

        const incomingProfile = data.profile && typeof data.profile === 'object' ? data.profile : {}
        const incomingSettings = data.settings && typeof data.settings === 'object' ? data.settings : {}

        const normalizedData = {
          ...existingData,
          ...data,
          profile: {
            ...(existingData.profile || {}),
            ...incomingProfile,
          },
          settings: {
            ...(existingData.settings || {}),
            ...incomingSettings,
          },
        }

        // Handle optional app password encryption and storage
        if (appPassword && saveAppPassword) {
          const encrypted = await encryptAppPassword(appPassword)
          if (!encrypted) {
            return new Response(JSON.stringify({ error: 'Encryption key not configured' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          normalizedData.settings.emailAppPasswordEnc = encrypted
        }

        const resolvedProfileImage = profileimage || ''

        const dataJson = JSON.stringify(normalizedData)
        const query = `
          INSERT INTO config (email, data, profileimage)
          VALUES (?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET data = ?, profileimage = ?;
        `
        await db.prepare(query).bind(email, dataJson, resolvedProfileImage, dataJson, resolvedProfileImage).run()
        return new Response(
          JSON.stringify({ success: true, message: 'User data updated successfully' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      } catch (error) {
        console.error('Error in PUT /userdata:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (pathname === '/get-role' && request.method === 'GET') {
      try {
        const email = url.searchParams.get('email')
        if (!email) {
          return new Response(JSON.stringify({ error: 'Missing email parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const db = env.vegvisr_org
        const query = `SELECT Role FROM config WHERE email = ?;` // Ensure column name matches database schema
        const row = await db.prepare(query).bind(email).first()

        if (!row || !row.Role) {
          // Use the correct case for the column name
          return new Response(JSON.stringify({ error: 'Role not found for the given email' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ email, role: row.Role }), {
          // Use the correct case here as well
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('Error in GET /get-role:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (pathname === '/send-gmail-email' && request.method === 'POST') {
      try {
        const { email, authEmail, fromEmail, toEmail, subject, html, appPassword, savePassword } = await request.json()

        if (!email || !authEmail || !toEmail || !subject || !html) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Debug logging (redacted password)
        console.log('[dash-worker /send-gmail-email] incoming', {
          email,
          authEmail,
          fromEmail,
          toEmail,
          subject,
          savePassword: !!savePassword,
          appPasswordLength: appPassword ? appPassword.length : 0,
        })

        // Resolve app password: use provided, else decrypt stored
        let resolvedPassword = appPassword || null
        let userDataRow = null

        if (!resolvedPassword) {
          userDataRow = await env.vegvisr_org
            .prepare('SELECT data, profileimage FROM config WHERE email = ?')
            .bind(email)
            .first()
          const storedData = userDataRow?.data ? JSON.parse(userDataRow.data) : {}
          const bundle = storedData?.settings?.emailAppPasswordEnc
          resolvedPassword = await decryptAppPassword(bundle)
        }

        if (!resolvedPassword) {
          return new Response(JSON.stringify({ error: 'App password not found. Please provide and save it.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Optionally persist new password
        if (appPassword && savePassword) {
          const encrypted = await encryptAppPassword(appPassword)
          if (encrypted) {
            const currentData = userDataRow?.data ? JSON.parse(userDataRow.data) : {}
            const merged = {
              ...currentData,
              settings: {
                ...(currentData.settings || {}),
                emailAppPasswordEnc: encrypted,
              },
            }
            await env.vegvisr_org
              .prepare('UPDATE config SET data = ? WHERE email = ?')
              .bind(JSON.stringify(merged), email)
              .run()
          }
        }

        const payload = {
          authEmail,
          senderEmail: authEmail,
          fromEmail: fromEmail || authEmail,
          toEmail,
          subject,
          html,
          appPassword: resolvedPassword,
        }

        console.log('[dash-worker /send-gmail-email] forwarding to email-worker', {
          authEmail: payload.authEmail,
          senderEmail: payload.senderEmail,
          fromEmail: payload.fromEmail,
          toEmail: payload.toEmail,
          subject: payload.subject,
          appPasswordLength: payload.appPassword ? payload.appPassword.length : 0,
        })

        const ewResponse = await fetch(`${emailWorkerUrl}/send-gmail-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const ewText = await ewResponse.text()
        let ewJson = null
        try {
          ewJson = JSON.parse(ewText)
        } catch {
          ewJson = { raw: ewText }
        }

        if (!ewResponse.ok || !ewJson.success) {
          return new Response(JSON.stringify({ error: ewJson.error || 'Email send failed', details: ewJson }), {
            status: ewResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ success: true, result: ewJson }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('Error in /send-gmail-email proxy:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Public: auto-register a new Realtime user (called after magic link verification)
    // Idempotent — if user already exists, returns their existing data
    if (pathname === '/register-realtime-user' && request.method === 'POST') {
      try {
        const body = await request.json()
        const email = (body.email || '').trim().toLowerCase()
        if (!email) {
          return new Response(JSON.stringify({ error: 'Email is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const db = env.vegvisr_org

        // Idempotent: if user already exists, return their data
        const existing = await db
          .prepare('SELECT user_id, email, emailVerificationToken, Role FROM config WHERE email = ?')
          .bind(email)
          .first()
        if (existing) {
          return new Response(JSON.stringify({
            success: true,
            created: false,
            user_id: existing.user_id,
            email: existing.email,
            emailVerificationToken: existing.emailVerificationToken,
            role: existing.Role,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // New user — register with Role = 'Realtime'
        const user_id = crypto.randomUUID()
        const emailVerificationToken = Array.from(crypto.getRandomValues(new Uint8Array(20)))
          .map(b => b.toString(16).padStart(2, '0')).join('')
        const data = JSON.stringify({ profile: { user_id, email }, settings: {} })

        await db.prepare(`
          INSERT INTO config (user_id, email, emailVerificationToken, Role, data)
          VALUES (?, ?, ?, ?, ?)
        `).bind(user_id, email, emailVerificationToken, 'Realtime', data).run()

        return new Response(JSON.stringify({
          success: true,
          created: true,
          user_id,
          email,
          emailVerificationToken,
          role: 'Realtime',
        }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('Error in POST /register-realtime-user:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Admin: register a user directly (Superadmin only)
    if (pathname === '/admin/register-user' && request.method === 'POST') {
      try {
        const callerRole = (request.headers.get('x-user-role') || '').trim()
        if (callerRole !== 'Superadmin') {
          return new Response(JSON.stringify({ error: 'Superadmin role required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const body = await request.json()
        const email = (body.email || '').trim().toLowerCase()
        const name = (body.name || '').trim() || null
        const phone = (body.phone || '').trim() || null
        const role = (body.role || 'Admin').trim()

        if (!email) {
          return new Response(JSON.stringify({ error: 'Email is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const db = env.vegvisr_org

        // Check if user already exists
        const existing = await db.prepare('SELECT email FROM config WHERE email = ?').bind(email).first()
        if (existing) {
          return new Response(JSON.stringify({ error: 'User with this email already exists' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Generate user_id and emailVerificationToken
        const user_id = crypto.randomUUID()
        const emailVerificationToken = Array.from(crypto.getRandomValues(new Uint8Array(20)))
          .map(b => b.toString(16).padStart(2, '0')).join('')

        const data = JSON.stringify({ profile: { user_id, email, name, phone }, settings: {} })

        await db.prepare(`
          INSERT INTO config (user_id, email, emailVerificationToken, Role, phone, data)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(user_id, email, emailVerificationToken, role, phone, data).run()

        return new Response(JSON.stringify({
          success: true,
          user_id,
          email,
          name,
          phone,
          role,
          emailVerificationToken,
        }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('Error in POST /admin/register-user:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Default route for unmatched paths
    return new Response('Not Found', { status: 404, headers: corsHeaders })
  },
}
