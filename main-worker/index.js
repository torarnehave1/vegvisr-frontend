import { Hono } from 'hono'

const app = new Hono()

// Endpoint: /hello
app.get('/hello', (c) => {
  const prompt = c.req.query('prompt') || 'Hello from Worker!'
  return c.json({ message: prompt })
})

// Endpoint: /greet
app.get('/greet', (c) => {
  const name = c.req.query('name') || 'Guest'
  return c.json({ greeting: `Greetings, ${name}!` })
})

// Endpoint: /default
app.get('/default', (c) => {
  return c.json({ message: 'This is the default endpoint.' })
})

// Endpoint: /error
app.get('/error', (c) => {
  return c.json({ error: 'This is an error message.' }, 500)
})

app.put('/config', async (c) => {
  try {
    const db = c.env.vegvisr_org
    const body = await c.req.json()
    const { user_id, setting_key, setting_value } = body

    if (!user_id || !setting_key || setting_value === undefined) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const query = `UPDATE config SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND setting_key = ?;`
    const { changes } = await db.prepare(query).bind(setting_value, user_id, setting_key).run()

    if (changes === 0) {
      return c.json({ error: 'Setting not found' }, 404)
    }

    return c.json({ success: true, message: 'Setting updated successfully' })
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

// ✅ DELETE /config - Remove a user setting
app.delete('/config', async (c) => {
  try {
    const db = c.env.vegvisr_org
    const body = await c.req.json()
    const { user_id, setting_key } = body

    if (!user_id || !setting_key) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const query = `DELETE FROM config WHERE user_id = ? AND setting_key = ?;`
    const { changes } = await db.prepare(query).bind(user_id, setting_key).run()

    if (changes === 0) {
      return c.json({ error: 'Setting not found' }, 404)
    }

    return c.json({ success: true, message: 'Setting deleted successfully' })
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

app.get('/config', async (c) => {
  try {
    const db = c.env.vegvisr_org
    const user_id = c.req.query('user_id')

    // Validate input
    if (!user_id) {
      return c.json({ error: 'Missing user_id parameter' }, 400)
    }

    // Fetch settings for the given user_id
    const query = `
      SELECT setting_key, setting_value FROM config WHERE user_id = ?;
    `
    const { results } = await db.prepare(query).bind(user_id).all()

    return c.json({ user_id, settings: results })
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

// ✅ New Endpoint: /config (POST) - Add a setting
app.post('/config', async (c) => {
  try {
    // Get the D1 database from the environment
    const db = c.env.vegvisr_org

    // Parse JSON request body
    const body = await c.req.json()
    const { user_id, setting_key, setting_value } = body

    // Validate input
    if (!user_id || !setting_key || setting_value === undefined) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    // Insert the setting into the D1 database
    const query = `
      INSERT INTO config (user_id, setting_key, setting_value)
      VALUES (?, ?, ?);
    `
    await db.prepare(query).bind(user_id, setting_key, setting_value).run()

    return c.json({ success: true, message: 'Setting saved successfully' })
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

// Endpoint: /get-settings
app.get('/get-settings', async (c) => {
  try {
    const db = c.env.vegvisr_org
    const user_id = c.req.query('user_id')

    if (!user_id) {
      return c.json({ error: 'Missing user_id parameter' }, 400)
    }

    const query = `SELECT setting_key, setting_value FROM config WHERE user_id = ?;`
    const { results } = await db.prepare(query).bind(user_id).all()

    return c.json({ settings: results })
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

// Endpoint: /set-settings
app.post('/set-settings', async (c) => {
  try {
    const db = c.env.vegvisr_org
    const body = await c.req.json()
    const { user_id, settings } = body

    if (!user_id || !settings) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const queries = settings.map(({ key, value }) => {
      return db
        .prepare(
          `INSERT INTO config (user_id, setting_key, setting_value) VALUES (?, ?, ?) ON CONFLICT(user_id, setting_key) DO UPDATE SET setting_value = ?;`,
        )
        .bind(user_id, key, value, value)
    })

    await Promise.all(queries.map((query) => query.run()))

    return c.json({ success: true, message: 'Settings updated successfully' })
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

// Catch-all route
app.all('*', (c) => {
  return c.text('Not Found', 404)
})

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx)
  },
}
