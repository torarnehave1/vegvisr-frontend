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
      return new Response(JSON.stringify({ error: 'Invalid file type. Only .jpg, .jpeg, .png, and .svg are allowed.' }), {
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

    const fileUrl = `https://vegvisr.org/${fileName}`
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
