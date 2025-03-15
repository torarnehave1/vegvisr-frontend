import { Hono } from 'hono'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const app = new Hono()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const filePath = path.resolve(__dirname, '..', '..', 'json')

const outputPdfPath = path.join(filePath, 'book.json')

// Create an endpoin that is just  sending out the current directory path

app.get('/path', (c) => {
  return c.json({ path: __dirname })
})

// Endpoint : outputPdfPath
// Returns the content of the book.json file
app.get('/json/book.json', (c) => {
  const book = fs.readFileSync(outputPdfPath, 'utf8')
  return c.json(JSON.parse(book))
})

// Endpoint: /hello
// Returns the value of the "prompt" query parameter, or a default message.
app.get('/hello', (c) => {
  const prompt = c.req.query('prompt') || 'Hello from Worker!'
  return c.json({ message: prompt })
})

// Endpoint: /greet
// Returns a personalized greeting based on the "name" query parameter.
app.get('/greet', (c) => {
  const name = c.req.query('name') || 'Guest'
  return c.json({ greeting: `Greetings, ${name}!` })
})

// Endpoint: /default
// Returns a fixed default message.
app.get('/default', (c) => {
  return c.json({ message: 'This is the default endpoint.' })
})

// Endpoint: /error
// Returns an error response with a custom message.

app.get('/error', (c) => {
  return c.error('This is an error message.', 500)
})

//Create a endpoint for the   await axios.put('/json/book.json', { introText: introText.value })
app.put('/json/book.json', async (c) => {
  const { introText } = await c.req.json()
  const book = JSON.parse(fs.readFileSync(outputPdfPath, 'utf8'))
  book.introText = introText
  fs.writeFileSync(outputPdfPath, JSON.stringify(book, null, 2))
  return c.json(book)
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
