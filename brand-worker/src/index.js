app.post('/create-custom-domain', async (c) => {
  console.log('=== Custom Domain Creation Request ===')
  const data = await c.req.json()
  console.log('Request data:', JSON.stringify(data, null, 2))

  try {
    // Validate input
    if (!data.subdomain) {
      console.log('Error: Missing subdomain in request')
      return c.json({ error: true, message: 'Subdomain is required' }, 400)
    }

    const subdomain = data.subdomain.toLowerCase()
    console.log('Processing subdomain:', subdomain)

    // Create CNAME record
    console.log('Creating CNAME record...')
    const dnsResult = await createCNAMERecord(subdomain)
    console.log('DNS setup result:', JSON.stringify(dnsResult, null, 2))

    // Create Worker route
    console.log('Creating Worker route...')
    const workerResult = await createWorkerRoute(subdomain)
    console.log('Worker setup result:', JSON.stringify(workerResult, null, 2))

    const response = {
      overallSuccess: dnsResult.success && workerResult.success,
      dnsSetup: dnsResult,
      workerSetup: workerResult,
    }
    console.log('Final response:', JSON.stringify(response, null, 2))
    return c.json(response)
  } catch (error) {
    console.error('Error in create-custom-domain:', error)
    return c.json(
      {
        error: true,
        message: error.message || 'Failed to create custom domain',
        details: error.toString(),
      },
      500,
    )
  }
})
