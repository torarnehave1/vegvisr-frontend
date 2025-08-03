// Simple API test to see what's available
console.log('🔍 Testing knowledge graph API...')

console.log('\n1️⃣ Testing list endpoint...')
fetch('https://knowledge.vegvisr.org/getknowgraphs')
  .then((response) => {
    console.log('List endpoint status:', response.status)
    return response.json()
  })
  .then((data) => {
    console.log('✅ Available graphs:', data.results?.length || 0)

    if (data.results && data.results.length > 0) {
      console.log('\n📋 First few graphs:')
      data.results.slice(0, 3).forEach((graph) => {
        console.log(`- ID: ${graph.id}, Title: ${graph.title}`)
      })

      // Test fetching one specific graph
      const testId = data.results[0].id
      console.log(`\n2️⃣ Testing individual graph fetch for: ${testId}`)

      return fetch(`https://knowledge.vegvisr.org/getknowgraph/${testId}`)
    } else {
      console.log('❌ No graphs found in list')
    }
  })
  .then((response) => {
    if (response) {
      console.log('Individual graph status:', response.status)
      return response.json()
    }
  })
  .then((data) => {
    if (data) {
      console.log('✅ Individual graph fetched successfully')
      console.log('📋 Metadata fields:', Object.keys(data.metadata || {}))
      if (data.metadata?.affiliates) {
        console.log('🎯 FOUND affiliates metadata:', data.metadata.affiliates)
      } else {
        console.log('❌ No affiliates metadata in this graph')
      }
    }
  })
  .catch((error) => {
    console.error('❌ API test error:', error)
  })
