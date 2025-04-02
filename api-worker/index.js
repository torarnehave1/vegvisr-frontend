import { marked } from 'marked' // Ensure you have installed marked (npm install marked)

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url

    // Middleware for CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response('', { status: 204, headers: corsHeaders })
    }

    try {
      if (pathname === '/summary' && request.method === 'GET') {
        const prompt = `Create a summary of this text: How older adults can reduce their risk of dementia by 60% with this one simple trick:

A new study published in the journal Neurology found that older adults who engaged in regular physical activity were 60% less likely to develop dementia than those who did not. The study followed over 1,600 adults with an average age of 79 for an average of 5 years. The participants were asked to report their physical activity levels, which included walking, swimming, and other forms of exercise. The researchers found that those who engaged in physical activity at least three times a week were significantly less likely to develop dementia than those who did not. The study also found that the protective effect of physical activity was independent of other factors such as age.

The researchers believe that physical activity may help reduce the risk of dementia by improving blood flow to the brain, reducing inflammation, and promoting the growth of new brain cells. They also note that physical activity has been shown to improve mood, sleep, and overall quality of life, which may also contribute to a lower risk of dementia. The researchers recommend that older adults engage in regular physical activity to reduce their risk of dementia and maintain their cognitive health.`

        const apiKey = env.OPENAI_API_KEY

        if (!apiKey) {
          console.error('OPENAI_API_KEY is not set in environment variables')
          return new Response('Internal Server Error: API key missing', { status: 500 })
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4',
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

        return new Response(JSON.stringify({ summary }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      if (pathname === '/save' && request.method === 'POST') {
        const { markdown } = await request.json()
        if (!markdown) {
          return new Response('Markdown content is missing', { status: 400 })
        }

        const id = crypto.randomUUID()
        await env.BINDING_NAME.put(id, markdown, { metadata: { encoding: 'utf-8' } })
        const shareableLink = `https://api.vegvisr.org/view/${id}`

        return new Response(JSON.stringify({ link: shareableLink }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      if (pathname.startsWith('/view/') && request.method === 'GET') {
        const id = pathname.split('/').pop()
        const markdown = await env.BINDING_NAME.get(id)
        if (!markdown) {
          return new Response('Not Found', { status: 404 })
        }

        const fullUrl = `https://api.vegvisr.org/view/${id}`

        const htmlContent = marked.parse(markdown)

        const shareButton = `
          <div style="text-align: center; margin-top: 20px;">
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}" target="_blank" class="btn btn-primary">
          Share on Facebook
        </a>
          </div>
        `

        const finalHtml = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>View Markdown</title>
          </head>
          <body>
        ${htmlContent}
        ${shareButton}
          </body>
          </html>
        `

        return new Response(finalHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html', ...corsHeaders },
        })
      }

      if (pathname === '/blog-posts' && request.method === 'GET') {
        const keys = await env.BINDING_NAME.list()
        const posts = []

        for (const key of keys.keys) {
          const markdown = await env.BINDING_NAME.get(key.name)
          if (markdown) {
            const lines = markdown.split('\n')
            const titleLine = lines.find((line) => line.startsWith('#') && !line.includes('!['))
            const title = titleLine ? titleLine.replace(/^#\s*/, '') : 'Untitled'

            const imageMatch = markdown.match(/!\[.*?\]\((.*?)\)/)
            const imageUrl = imageMatch ? imageMatch[1] : null

            const abstractLine = lines.find(
              (line) => line.trim() && !line.startsWith('#') && !line.includes('!['),
            )
            const abstract = abstractLine ? abstractLine.slice(0, 100) + '...' : ''

            posts.push({
              id: key.name,
              title,
              snippet: lines.slice(1, 3).join(' '),
              abstract,
              image: imageUrl || 'https://via.placeholder.com/150',
            })
          }
        }

        return new Response(JSON.stringify(posts), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      if (pathname.startsWith('/blogpostdelete/') && request.method === 'DELETE') {
        const id = pathname.split('/').pop()
        if (!id) {
          return new Response('Blog post ID is required', { status: 400, headers: corsHeaders })
        }

        await env.BINDING_NAME.delete(id)
        return new Response('Blog post deleted successfully', { status: 200, headers: corsHeaders })
      }

      if (pathname === '/snippetadd' && request.method === 'POST') {
        const { id, content } = await request.json()
        if (!id || !content) {
          return new Response('ID and content are required', { status: 400 })
        }

        await env.snippets.put(id, content)
        return new Response('Snippet added successfully', { status: 200, headers: corsHeaders })
      }

      if (pathname.startsWith('/snippets/') && request.method === 'GET') {
        const id = pathname.split('/').pop()
        const snippet = await env.snippets.get(id)
        if (!snippet) {
          return new Response('Snippet not found', { status: 404 })
        }

        return new Response(JSON.stringify({ id, content: snippet }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      if (pathname.startsWith('/snippetdelete') && request.method === 'DELETE') {
        const id = pathname.split('/').pop()
        await env.snippets.delete(id)
        return new Response('Snippet deleted successfully', { status: 200, headers: corsHeaders })
      }

      if (pathname === '/snippetlist' && request.method === 'GET') {
        const keys = await env.snippets.list() // Ensure it uses the "snippets" KV namespace
        if (!keys.keys || keys.keys.length === 0) {
          return new Response(JSON.stringify({ keys: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        return new Response(JSON.stringify({ keys: keys.keys }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      if (pathname === '/upload' && request.method === 'POST') {
        try {
          console.log('Received POST /upload request')
          const { MY_R2_BUCKET } = env
          const formData = await request.formData()
          const file = formData.get('file')

          console.log('Form data:', { file })

          if (!file) {
            console.error('Missing file or email')
            return new Response(JSON.stringify({ error: 'Missing file or email' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
          }

          const fileExtension = file.name ? file.name.split('.').pop() : ''
          if (!fileExtension) {
            console.error('Invalid file name or extension')
            return new Response(JSON.stringify({ error: 'Invalid file name or extension' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
          }

          const fileName = `${Date.now()}.${fileExtension}`
          console.log('Uploading file to R2:', fileName)

          const contentType = fileExtension === 'svg' ? 'image/svg+xml' : file.type

          await MY_R2_BUCKET.put(fileName, file.stream(), {
            httpMetadata: {
              contentType: contentType,
            },
          })

          const fileUrl = `https://blog.vegvisr.org/${fileName}`
          console.log('File uploaded to R2:', fileUrl)

          return new Response(JSON.stringify({ url: fileUrl }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        } catch (error) {
          console.error('Error in /upload:', error)
          return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders })
    } catch (error) {
      console.error('Error:', error)
      return new Response('Internal Server Error', { status: 500, headers: corsHeaders })
    }
  },
}

// Helper function to parse multipart form data
function parseMultipartFormData(body, boundary) {
  const decoder = new TextDecoder()
  const text = decoder.decode(body) // Convert ArrayBuffer to string
  const parts = text.split(`--${boundary}`).filter((part) => part.trim() && !part.includes('--'))

  return parts.map((part) => {
    const [headers, ...rest] = part.split('\r\n\r\n')
    const headerLines = headers.split('\r\n')
    const contentDisposition = headerLines.find((line) => line.startsWith('Content-Disposition'))
    const contentType = headerLines.find((line) => line.startsWith('Content-Type'))?.split(': ')[1]

    const nameMatch = contentDisposition?.match(/name="([^"]+)"/)
    const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/)

    const name = nameMatch ? nameMatch[1] : null
    const filename = filenameMatch ? filenameMatch[1] : null
    const data = rest.join('\r\n\r\n').trim()

    console.log('Parsed part:', { name, filename, contentType })

    return {
      name,
      filename,
      contentType,
      data: new Uint8Array([...data].map((char) => char.charCodeAt(0))), // Convert string to Uint8Array
    }
  })
}
