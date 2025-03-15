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

// Catch-all route
app.all('*', (c) => {
  return c.text('Not Found', 404)
})

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx)
  },
}
