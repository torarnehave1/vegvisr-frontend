import fetch from 'node-fetch'

async function testApi() {
  const email = 'torarnehave@gmail.com'
  const apiToken = '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'
  const apiUrl = `https://slowyou.io/api/reg-user-vegvisr?email=${encodeURIComponent(email)}`

  console.log('API URL:', apiUrl)
  console.log('Authorization Header:', `Bearer ${apiToken}`)

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
  })

  console.log('Response status:', response.status)
  console.log('Response headers:', JSON.stringify([...response.headers]))
  const body = await response.text()
  console.log('Response body:', body)
}

testApi().catch(console.error)
