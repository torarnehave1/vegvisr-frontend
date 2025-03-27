import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid' // Import UUID library

const app = new Hono()

// Middleware to add CORS headers
app.use('*', async (c, next) => {
  await next()
  c.res.headers.set('Access-Control-Allow-Origin', '*')
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
})

// Handle OPTIONS requests
app.options('*', (c) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*')
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return c.text('', 204)
})

// Ensure the config table has the necessary columns
app.use('*', async (c, next) => {
  const db = c.env.vegvisr_org
  const query = `
    CREATE TABLE IF NOT EXISTS config (
      user_id TEXT PRIMARY KEY,
      data TEXT,
      profileimage TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `
  await db.prepare(query).run()
  await next()
})

// Function to generate a unique file name
function generateUniqueFileName(user_id, fileExtension) {
  const uniqueId = uuidv4()
  return `${user_id}/profileimage_${uniqueId}.${fileExtension}`
}

//Funtion to generate a unique username in 8 letters and numbers and speciac characters
//function generateUniqueUsername() {
// const uniqueId = uuidv4()
// return `${uniqueId}`
//}

// Function to generate a JWT using the Web Crypto API

// GET /userdata - Retrieve full user data blob
app.get('/userdata', async (c) => {
  try {
    const db = c.env.vegvisr_org
    const email = c.req.query('email')
    if (!email) {
      return c.json({ error: 'Missing email parameter' }, 400)
    }
    const query = `SELECT user_id, data, profileimage, emailVerificationToken FROM config WHERE email = ?;`
    const row = await db.prepare(query).bind(email).first()
    if (!row) {
      // If no data exists, return a default structure
      return c.json({
        email,
        user_id: null,
        data: { profile: {}, settings: {} },
        profileimage: '',
        emailVerificationToken: null,
      })
    }
    return c.json({
      email,
      user_id: row.user_id,
      data: JSON.parse(row.data),
      profileimage: row.profileimage,
      emailVerificationToken: row.emailVerificationToken,
    })
  } catch (error) {
    console.error('Error in GET /userdata:', error)
    return c.json({ error: error.message }, 500)
  }
})

//New sve enpoint to test if it is there
app.get('/verify-email', async (c) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*')
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  const emailToken = c.req.query('token')
  if (!emailToken) {
    return c.json({ error: 'Missing token parameter' }, 400)
  }
  try {
    console.log('Sending request to external verification API with token:', emailToken)
    const verifyResponse = await fetch(`https://slowyou.io/api/verify-email?token=${emailToken}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    console.log('External API response status:', verifyResponse.status)
    if (!verifyResponse.ok) {
      console.error(
        `Error from external API: ${verifyResponse.status} ${verifyResponse.statusText}`,
      )
      return c.json(
        {
          error: `Failed to verify email. External API returned status ${verifyResponse.status}.`,
        },
        500,
      )
    }
    const body = await verifyResponse.text()
    console.log('Response body from external API:', body)
    return c.json({
      status: verifyResponse.status,
      ok: verifyResponse.ok,
      body,
    })
  } catch (error) {
    console.error('Error fetching from external API:', error)
    return c.json({ error: 'Failed to contact verification API. Please try again later.' }, 500)
  }
})

app.get('/sve2', async (c) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*')
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  try {
    console.log('Received GET /sve2 request')

    // Get the email parameter from the query string
    const userEmail = c.req.query('email')
    const apiToken = c.env.token

    // Log the token for debugging
    console.log('API Token from environment:', apiToken)

    if (!apiToken) {
      console.error('Error in GET /sve2: Missing API token')
      return c.json({ error: 'Missing API token' }, 500)
    }

    // Validate the email parameter
    if (!userEmail) {
      console.error('Error in GET /sve2: Missing email parameter')
      return c.json({ error: 'Missing email parameter' }, 400)
    }

    // Log the request details
    const apiUrl = `https://slowyou.io/api/reg-user-vegvisr?email=${encodeURIComponent(userEmail)}`
    console.log('API URL:', apiUrl)
    console.log('Authorization Header:', `Bearer ${apiToken}`)

    // Create POST fetch request to external API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
    })

    // Log the response status and headers
    console.log('Response status:', response.status)
    console.log('Response headers:', JSON.stringify([...response.headers]))

    // Ensure the response is valid before accessing its body
    if (!response.ok) {
      console.error(`Error from external API: ${response.status} ${response.statusText}`)
      return c.json(
        { error: `Failed to register user. External API returned status ${response.status}.` },
        500,
      )
    }

    // Log and parse the raw response body
    const rawBody = await response.text()
    console.log('Raw response body:', rawBody)

    let responseBody
    try {
      responseBody = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('Error parsing response body:', parseError)
      return c.json({ error: 'Failed to parse response from external API.' }, 500)
    }

    // Validate the parsed response body
    if (!responseBody || typeof responseBody !== 'object') {
      console.error('Invalid response body:', responseBody)
      return c.json({ error: 'Invalid response from external API.' }, 500)
    }

    console.log('Parsed response body:', responseBody)

    // Return the response body
    return c.json({
      status: response.status,
      ok: response.ok,
      body: responseBody,
    })
  } catch (error) {
    console.error('Error in GET /sve2:', error)
    return c.json({ error: error.message }, 500)
  }
})

// PUT /userdata - Update or insert full user data blob
app.put('/userdata', async (c) => {
  try {
    const db = c.env.vegvisr_org
    const body = await c.req.json()
    console.log('Received PUT /userdata request:', JSON.stringify(body, null, 2))
    const { email, data, profileimage } = body

    // Validate required fields
    if (!email || !data || !profileimage) {
      return c.json({ error: 'Missing required fields: email, data, or profileimage' }, 400)
    }

    // Ensure `data` contains valid structure
    if (
      typeof data !== 'object' ||
      !data.profile ||
      !data.settings ||
      typeof data.profile !== 'object' ||
      typeof data.settings !== 'object'
    ) {
      return c.json({ error: 'Invalid data structure' }, 400)
    }

    const dataJson = JSON.stringify(data)
    const query = `
      INSERT INTO config (email, data, profileimage)
      VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET data = ?, profileimage = ?;
    `
    await db.prepare(query).bind(email, dataJson, profileimage, dataJson, profileimage).run()
    return c.json({ success: true, message: 'User data updated successfully' })
  } catch (error) {
    console.error('Error in PUT /userdata:', error)
    return c.json({ error: error.message }, 500)
  }
})

// DELETE /userdata - Delete user data blob (if needed)
app.delete('/userdata', async (c) => {
  try {
    const db = c.env.vegvisr_org
    const body = await c.req.json()
    const { user_id } = body

    if (!user_id) {
      return c.json({ error: 'Missing user_id parameter' }, 400)
    }

    const query = `DELETE FROM config WHERE user_id = ?;`
    const { changes } = await db.prepare(query).bind(user_id).run()
    if (changes === 0) {
      return c.json({ error: 'User data not found' }, 404)
    }
    return c.json({ success: true, message: 'User data deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /userdata:', error)
    return c.json({ error: error.message }, 500)
  }
})

// POST /upload - Upload a file to R2 bucket
app.post('/upload', async (c) => {
  try {
    console.log('Received POST /upload request')
    const { MY_R2_BUCKET, vegvisr_org } = c.env
    const formData = await c.req.formData()
    const file = formData.get('file')
    const email = formData.get('email')

    console.log('Form data:', { file, email })

    if (!file || !email) {
      console.error('Missing file or email')
      return c.json({ error: 'Missing file or email' }, 400)
    }

    // Ensure file.name is defined before splitting
    const fileExtension = file.name ? file.name.split('.').pop() : ''
    if (!fileExtension) {
      console.error('Invalid file name or extension')
      return c.json({ error: 'Invalid file name or extension' }, 400)
    }

    const fileName = generateUniqueFileName(email, fileExtension) // Use the unique file name generator
    console.log('Uploading file to R2:', fileName)

    // Set the correct Content-Type for SVG files
    const contentType = fileExtension === 'svg' ? 'image/svg+xml' : file.type

    await MY_R2_BUCKET.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: contentType,
      },
    })

    const fileUrl = `https://vegvisr.org/${fileName}`
    console.log('File uploaded to R2:', fileUrl)

    // Update the user profile image URL in the database
    const query = `
      INSERT INTO config (email, profileimage, data)
      VALUES (?, ?, COALESCE((SELECT data FROM config WHERE email = ?), '{}'))
      ON CONFLICT(email) DO UPDATE SET profileimage = ?, data = COALESCE(data, '{}');
    `
    console.log('Query:', query)

    console.log('Updating database with profile image URL')
    await vegvisr_org.prepare(query).bind(email, fileUrl, email, fileUrl).run()

    // Add CORS headers to the response
    c.res.headers.set('Access-Control-Allow-Origin', '*')
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    console.log('Returning success response')
    return c.json({ success: true, fileUrl })
  } catch (error) {
    console.error('Error in POST /upload:', error)
    console.error('Error details:', error)
    return c.json({ error: error.message }, 500)
  }
})

// POST /login - Validate email and token
app.post('/login', async (c) => {
  try {
    const db = c.env.vegvisr_org
    const { email, token } = await c.req.json()

    if (!email || !token) {
      return c.json({ error: 'Missing email or token parameter' }, 400)
    }

    const query = `SELECT emailVerificationToken FROM config WHERE email = ?;`
    const row = await db.prepare(query).bind(email).first()

    if (!row) {
      return c.json({ error: 'Email not found' }, 404)
    }

    if (row.emailVerificationToken !== token) {
      return c.json({ error: 'Invalid token' }, 401)
    }

    return c.json({ success: true, message: 'Login successful' })
  } catch (error) {
    console.error('Error in POST /login:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.all('*', (c) => {
  return c.text('Not Found', 404)
})

export default app

export async function fetch(request, env, ctx) {
  return app.fetch(request, env, ctx)
}
