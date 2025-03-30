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
        const email = url.searchParams.get('email')
        if (!email) {
          return new Response(JSON.stringify({ error: 'Missing email parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const db = env.vegvisr_org
        const query = `SELECT user_id, data, profileimage, emailVerificationToken FROM config WHERE email = ?;`
        const row = await db.prepare(query).bind(email).first()

        if (!row) {
          // If no data exists, return a default structure
          const response = {
            email,
            user_id: null,
            data: { profile: {}, settings: {} },
            profileimage: '',
            emailVerificationToken: null,
          }
          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const response = {
          email,
          user_id: row.user_id, // Ensure user_id is included
          data: JSON.parse(row.data),
          profileimage: row.profileimage,
          emailVerificationToken: row.emailVerificationToken,
        }
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('Error in GET /userdata:', error)
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

        const fileUrl = `https://vegvisr.org/${fileName}`
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
        if (!email || !data || !profileimage) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: email, data, or profileimage' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        }

        // Ensure `data` contains valid structure
        if (
          typeof data !== 'object' ||
          !data.profile ||
          !data.settings ||
          typeof data.profile !== 'object' ||
          typeof data.settings !== 'object'
        ) {
          return new Response(JSON.stringify({ error: 'Invalid data structure' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const dataJson = JSON.stringify(data)
        const query = `
          INSERT INTO config (email, data, profileimage)
          VALUES (?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET data = ?, profileimage = ?;
        `
        await db.prepare(query).bind(email, dataJson, profileimage, dataJson, profileimage).run()
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

    // Default route for unmatched paths
    return new Response('Not Found', { status: 404, headers: corsHeaders })
  },
}
