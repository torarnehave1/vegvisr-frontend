import { Hono } from 'hono'

const app = new Hono()

// Endpoint: /hello
// Returns the value of the "prompt" query parameter, or a default message.
app.get('/image', (c) => {
  const prompt = c.req.query('prompt') || 'Hello from AI Image Worker!'
  return c.json({ message: prompt })
})

// Endpoint: /greet
// Returns a personalized greeting based on the "name" query parameter.
app.get('/question', (c) => {
  const name = c.req.query('name') || 'Guest'
  return c.json({ greeting: `Greetings, ${name}!` })
})

// Endpoint: /default
// Returns a fixed default message.
app.get('/summary', () => {
  const data = { message: 'Hello World summary!' }

  const response = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json', // Set Content-Type to JSON
      'Access-Control-Allow-Origin': '*', // Allow CORS
    },
  })

  return response
})

// Endpoint: /error
// Returns an error response with a custom message.

app.get('/error', (c) => {
  return c.error('This is an error message.', 500)
})

// Catch-all route for any unmatched paths.
app.all('*', (c) => {
  return c.text('Not Found', 404)
})

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx)
  },
}
