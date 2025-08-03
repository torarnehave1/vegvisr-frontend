// Test the actual graph validation endpoint used by the worker
console.log('🔍 Testing graph validation endpoint...')

const testGraphIds = ['test', 'default', 'ai', 'automation', 'vegvisr']

async function testGraphId(graphId) {
  console.log(`\nTesting graph ID: "${graphId}"`)
  try {
    const response = await fetch(`https://knowledge.vegvisr.org/graph/${graphId}`)
    console.log(`Status: ${response.status}`)
    console.log(`OK: ${response.ok}`)
    
    if (response.ok) {
      const data = await response.text() // Use text() in case it's not JSON
      console.log(`Response preview: ${data.substring(0, 200)}...`)
      return true
    }
    return false
  } catch (error) {
    console.log(`Error: ${error.message}`)
    return false
  }
}

// Test each graph ID
for (const graphId of testGraphIds) {
  const isValid = await testGraphId(graphId)
  if (isValid) {
    console.log(`\n🎯 Found valid graph ID: "${graphId}"`)
    break
  }
}

console.log('\n✅ Graph validation test complete')
