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
function generateUniqueUsername() {
  const uniqueId = uuidv4()
  return `${uniqueId}`
}

// Function to generate a JWT using the Web Crypto API
async function generateJWT(payload, secret, expiresIn = '1h') {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = btoa(JSON.stringify(header))
  const encodedPayload = btoa(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 }),
  )
  const data = `${encodedHeader}.${encodedPayload}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))

  return `${data}.${encodedSignature}`
}

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
  try {
    const token = c.req.query('token')

    if (!token) {
      return c.json({ error: 'Missing token parameter' }, 400)
    }

    const response = await fetch('https://slowyou.io/api/verify-email?token=' + token)
    const responseBody = await response.text()
    console.log('Response body:', responseBody)
    const result = responseBody ? JSON.parse(responseBody) : {}
    console.log('Parsed response from external API:', result)

    // Add CORS headers to the response
    c.res.headers.set('Access-Control-Allow-Origin', '*')
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Create record in the database
    const db = c.env.vegvisr_org
    const user_id = generateUniqueUsername()

    const data = {
      email: result.email,
      emailVerificationToken: result.emailVerificationToken,
      emailVerified: true,
    }

    try {
      const query = `
      INSERT INTO config (user_id, email, emailVerificationToken, data)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(email) DO NOTHING;
      `
      const { changes } = await db
        .prepare(query)
        .bind(user_id, data.email, data.emailVerificationToken, JSON.stringify({}))
        .run()

      if (changes === 0) {
        return c.json({ error: 'Email is already registered' }, 409)
      }
    } catch (error) {
      console.error('Error inserting into database:', error)
      return c.json({ error: 'An unexpected error occurred' }, 500)
    }

    // Generate a JWT token using the Web Crypto API
    const jwtSecret = c.env.JWT_SECRET // Use a secret key from environment variables
    const jwtToken = await generateJWT(
      { email: result.email, user_id, emailVerificationToken: result.emailVerificationToken },
      jwtSecret,
    )

    // Redirect the user to the login view with the email pre-filled
    const token = c.env.token

    console.log('Raw token value:', token)

    if (!email) {
      console.error('Error in GET /sve2: Missing email parameter')
      return c.json({ error: 'Missing email parameter' }, 400)
    }

    if (!token) {
      console.error('Error in GET /sve2: Token is missing in environment variables')
      return c.json({ error: 'Server configuration error: Missing token' }, 500)
    }

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email }),
    }

    console.log('Sending POST request to external API:')
    console.log('URL:', 'https://slowyou.io/api/reg-user-vegvisr')
    console.log('Method:', requestOptions.method)
    console.log('Headers:', requestOptions.headers)
    console.log('Body:', requestOptions.body)

    const response = await fetch('https://slowyou.io/api/reg-user-vegvisr', requestOptions)

    // Log the status and raw body
    const responseBody = await response.text() // Use .text() to avoid JSON parsing
    // console.log('Response status:', response.status)
    console.log('Raw response body:', responseBody)

    if (!response.ok) {
      console.error(
        `Error in GET /sve2: HTTP error! status: ${response.status}, body: ${responseBody}`,
      )
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Only parse as JSON if the response is successful and has content
    const result = responseBody ? JSON.parse(responseBody) : {}
    console.log('Parsed response from external API:', result)

    c.res.headers.set('Access-Control-Allow-Origin', '*')
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    return c.json(result)
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

    const fileExtension = file.name.split('.').pop()
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

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx)
  },
}
