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
        const { email, data, profileimage } = body

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

        // Normalize structure to avoid hard failures when optional keys are missing
        const normalizedData = {
          ...data,
          profile: data.profile && typeof data.profile === 'object' ? data.profile : {},
          settings: data.settings && typeof data.settings === 'object' ? data.settings : {},
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

    // Default route for unmatched paths
    return new Response('Not Found', { status: 404, headers: corsHeaders })
  },
}
