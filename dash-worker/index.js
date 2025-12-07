export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url

    // Middleware to handle CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
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
        const query = `SELECT user_id, bio, profileimage, emailVerificationToken, role, data FROM config WHERE email = ?;`
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

    // Default route for unmatched paths
    return new Response('Not Found', { status: 404, headers: corsHeaders })
  },
}
