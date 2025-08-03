// Check which APIs are actually working
console.log('🔍 Checking API endpoint availability...')

const endpoints = [
  'https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraphs',
  'https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraph?id=graph_1744651836495',
  'https://aff-worker.torarnehave.workers.dev/dashboard?email=test@example.com',
  'https://aff-worker.torarnehave.workers.dev/health',
]

async function testEndpoint(url) {
  try {
    console.log(`\n🔗 Testing: ${url}`)
    const response = await fetch(url)
    console.log(`   Status: ${response.status}`)
    console.log(`   Content-Type: ${response.headers.get('content-type')}`)

    if (response.status === 200) {
      const text = await response.text()
      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        console.log('   ❌ Returns HTML (likely error page)')
        console.log(`   First 100 chars: ${text.substring(0, 100)}...`)
      } else {
        try {
          const data = JSON.parse(text)
          console.log('   ✅ Returns valid JSON')
          if (data.results) {
            console.log(`   📊 Contains ${data.results.length} results`)
          }
          if (data.metadata) {
            console.log('   📋 Has metadata field')
          }
        } catch (e) {
          console.log('   ⚠️ Not JSON format')
          console.log(`   Content: ${text.substring(0, 200)}...`)
        }
      }
    } else {
      const text = await response.text()
      console.log(`   ❌ Error response: ${text.substring(0, 200)}...`)
    }
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`)
  }
}

// Test all endpoints
for (const url of endpoints) {
  await testEndpoint(url)
}

console.log('\n📝 Endpoint Analysis Complete!')
console.log('🎯 Next step: Fix the broken endpoints or find alternatives')
