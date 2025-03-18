import { Hono } from 'hono'

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

// GET /userdata - Retrieve full user data blob
app.get('/userdata', async (c) => {
  try {
    const db = c.env.vegvisr_org
    const user_id = c.req.query('user_id')
    if (!user_id) {
      return c.json({ error: 'Missing user_id parameter' }, 400)
    }
    const query = `SELECT data, profileimage FROM config WHERE user_id = ?;`
    const row = await db.prepare(query).bind(user_id).first()
    if (!row) {
      // If no data exists, return a default structure
      return c.json({ user_id, data: { profile: {}, settings: {} }, profileimage: '' })
    }
    return c.json({ user_id, data: JSON.parse(row.data), profileimage: row.profileimage })
  } catch (error) {
    console.error('Error in GET /userdata:', error)
    return c.json({ error: error.message }, 500)
  }
})

// PUT /userdata - Update or insert full user data blob
app.put('/userdata', async (c) => {
  try {
    const db = c.env.vegvisr_org
    const body = await c.req.json()
    console.log('Received PUT /userdata request:', JSON.stringify(body, null, 2))
    const { user_id, data, profileimage } = body

    if (!user_id || data === undefined || profileimage === undefined) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const dataJson = JSON.stringify(data)
    const query = `
      INSERT INTO config (user_id, data, profileimage)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET data = ?, profileimage = ?;
    `
    await db.prepare(query).bind(user_id, dataJson, profileimage, dataJson, profileimage).run()
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
    const user_id = formData.get('user_id')

    console.log('Form data:', { file, user_id })

    if (!file || !user_id) {
      console.error('Missing file or user_id')
      return c.json({ error: 'Missing file or user_id' }, 400)
    }

    const fileExtension = file.name.split('.').pop()
    const fileName = `${user_id}/profileimage.${fileExtension}`
    console.log('Uploading file to R2:', fileName)
    await MY_R2_BUCKET.put(fileName, file.stream())

    const fileUrl = `https://vegvisr.org/${fileName}`
    console.log('File uploaded to R2:', fileUrl)

    // Update the user profile image URL in the database
    const query = `
      INSERT INTO config (user_id, profileimage)
      VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET profileimage = ?;
    `
    console.log('Query:', query)

    console.log('Updating database with profile image URL')
    await vegvisr_org.prepare(query).bind(user_id, fileUrl, fileUrl).run()

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

app.all('*', (c) => {
  return c.text('Not Found', 404)
})

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx)
  },
}
