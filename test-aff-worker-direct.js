// Test the aff-worker directly
const testAffWorkerDirect = async () => {
  const affWorkerUrl = 'https://aff-worker.torarnehave.workers.dev'

  const testData = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    domain: 'vegvisr.org',
  }

  try {
    console.log('Testing aff-worker directly...')
    console.log('Request data:', JSON.stringify(testData, null, 2))

    const response = await fetch(`${affWorkerUrl}/register-affiliate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    })

    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))

    const result = await response.json()

    if (response.ok) {
      console.log('\n✅ SUCCESS! Affiliate registered successfully')
      console.log('Response:', JSON.stringify(result, null, 2))
    } else {
      console.error('\n❌ ERROR:', result)
    }
  } catch (error) {
    console.error('\n❌ FETCH ERROR:', error.message)
  }
}

testAffWorkerDirect()
