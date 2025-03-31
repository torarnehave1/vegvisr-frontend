import { Hono } from 'hono'
import { marked } from 'marked' // Ensure you have installed marked (npm install marked)

const app = new Hono()

// Middleware for CORS
app.use('*', async (c, next) => {
  await next()
  c.res.headers.set('Access-Control-Allow-Origin', '*')
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
})

// Handle OPTIONS preflight
app.options('*', (c) => {
  return c.text('', 204)
})

// Endpoint: /summary
app.get('/summary', async (c) => {
  const prompt = `Create a summary of this text: How older adults can reduce their risk of dementia by 60% with this one simple trick:

A new study published in the journal Neurology found that older adults who engaged in regular physical activity were 60% less likely to develop dementia than those who did not. The study followed over 1,600 adults with an average age of 79 for an average of 5 years. The participants were asked to report their physical activity levels, which included walking, swimming, and other forms of exercise. The researchers found that those who engaged in physical activity at least three times a week were significantly less likely to develop dementia than those who did not. The study also found that the protective effect of physical activity was independent of other factors such as age.

The researchers believe that physical activity may help reduce the risk of dementia by improving blood flow to the brain, reducing inflammation, and promoting the growth of new brain cells. They also note that physical activity has been shown to improve mood, sleep, and overall quality of life, which may also contribute to a lower risk of dementia. The researchers recommend that older adults engage in regular physical activity to reduce their risk of dementia and maintain their cognitive health.`

  const apiKey = c.env.OPENAI_API_KEY

  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set in environment variables')
    return c.text('Internal Server Error: API key missing', 500)
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4', // Updated to GPT-4
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'You are a helpful summary-assistant.' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const summary = data.choices[0].message.content.trim()

    return c.json({ summary: summary })
  } catch (error) {
    console.error('Error in /summary:', error)
    return c.text(`Internal Server Error: ${error.message}`, 500)
  }
})

// Endpoint: /save for saving markdown content
app.post('/save', async (c) => {
  try {
    const { markdown } = await c.req.json()
    if (!markdown) {
      return c.text('Markdown content is missing', 400)
    }
    // Generate a unique ID
    const id = crypto.randomUUID()
    // Store the markdown in KV using the unique ID as key, ensuring UTF-8 encoding
    await c.env.BINDING_NAME.put(id, markdown, { metadata: { encoding: 'utf-8' } })
    // Use the worker route base URL for the shareable link
    const shareableLink = `https://api.vegvisr.org/view/${id}`
    return c.json({ link: shareableLink })
  } catch (error) {
    console.error('Error in /save:', error)
    return c.text('Internal Server Error', 500)
  }
})

// Endpoint: /view/:id for viewing markdown content
app.get('/view/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const markdown = await c.env.BINDING_NAME.get(id)
    if (!markdown) {
      return c.text('Not Found', 404)
    }
    // Ensure the markdown content is treated as UTF-8
    const htmlContent = marked.parse(markdown)
    return c.html(htmlContent, 200)
  } catch (error) {
    console.error('Error in /view/:id:', error)
    return c.text('Internal Server Error', 500)
  }
})

// Endpoint: /blog-posts to fetch all blog posts
app.get('/blog-posts', async (c) => {
  try {
    const keys = await c.env.BINDING_NAME.list()
    const posts = []

    for (const key of keys.keys) {
      const markdown = await c.env.BINDING_NAME.get(key.name)
      if (markdown) {
        // Extract the first valid title line (ignoring image lines)
        const lines = markdown.split('\n')
        const titleLine = lines.find((line) => line.startsWith('#') && !line.includes('!['))
        const title = titleLine ? titleLine.replace(/^#\s*/, '') : 'Untitled'

        // Extract the first image URL from the markdown
        const imageMatch = markdown.match(/!\[.*?\]\((.*?)\)/)
        const imageUrl = imageMatch ? imageMatch[1] : null

        // Extract the first valid paragraph for the abstract
        const abstractLine = lines.find(
          (line) => line.trim() && !line.startsWith('#') && !line.includes('!['),
        )
        const abstract = abstractLine ? abstractLine.slice(0, 100) + '...' : ''

        posts.push({
          id: key.name,
          title: title, // Use the extracted title
          snippet: lines.slice(1, 3).join(' '), // Extract a snippet from the next lines
          abstract: abstract, // Add the abstract
          image: imageUrl || 'https://via.placeholder.com/150', // Use extracted image or a placeholder
        })
      }
    }

    return c.json(posts)
  } catch (error) {
    console.error('Error in /blog-posts:', error)
    return c.text('Internal Server Error', 500)
  }
})

// Endpoint: /snippets/add to add a snippet
app.post('/snippets/add', async (c) => {
  try {
    const { id, content } = await c.req.json()
    if (!id || !content) {
      return c.text('ID and content are required', 400)
    }
    await c.env.snippets.put(id, content)
    return c.text('Snippet added successfully', 200)
  } catch (error) {
    console.error('Error in /snippets/add:', error)
    return c.text('Internal Server Error', 500)
  }
})

// Endpoint: /snippets/:id to get a snippet
app.get('/snippets/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const snippet = await c.env.snippets.get(id)
    if (!snippet) {
      return c.text('Snippet not found', 404)
    }
    return c.json({ id, content: snippet })
  } catch (error) {
    console.error('Error in /snippets/:id:', error)
    return c.text('Internal Server Error', 500)
  }
})

// Endpoint: /snippets/delete/:id to delete a snippet
app.delete('/snippets/delete/:id', async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.snippets.delete(id)
    return c.text('Snippet deleted successfully', 200)
  } catch (error) {
    console.error('Error in /snippets/delete/:id:', error)
    return c.text('Internal Server Error', 500)
  }
})

// Endpoint: /snippets/list to list all snippet keys
app.get('/snippets/list', async (c) => {
  try {
    const keys = await c.env.snippets.list()
    return c.json({ keys: keys.keys })
  } catch (error) {
    console.error('Error in /snippets/list:', error)
    return c.text('Internal Server Error', 500)
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
