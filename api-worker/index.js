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
      if (pathname === '/upload' && request.method === 'POST') {
        try {
          console.log('Received POST /upload request')
          const { MY_R2_BUCKET } = env
          const formData = await request.formData()
          const file = formData.get('file')

          console.log('Form data:', { file })

          if (!file) {
            console.error('Missing file')
            return new Response(JSON.stringify({ error: 'Missing file' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            })
          }

          const fileExtension = file.name ? file.name.split('.').pop().toLowerCase() : ''
          if (!fileExtension || !['jpg', 'jpeg', 'png', 'svg'].includes(fileExtension)) {
            console.error('Invalid file type')
            return new Response(
              JSON.stringify({
                error: 'Invalid file type. Only .jpg, .jpeg, .png, and .svg are allowed.',
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              },
            )
          }

          const fileName = `${Date.now()}.${fileExtension}`
          console.log('Uploading file to R2:', fileName)

          const contentType = fileExtension === 'svg' ? 'image/svg+xml' : file.type

          await MY_R2_BUCKET.put(fileName, file.stream(), {
            httpMetadata: {
              contentType: contentType,
            },
          })

          const fileUrl = `https://www.vegvisr.org/${fileName}`
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
