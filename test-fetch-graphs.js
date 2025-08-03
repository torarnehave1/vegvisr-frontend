// Test to fetch available graphs from knowledge graph API
console.log('🔍 Fetching available knowledge graphs...')

fetch('https://knowledge.vegvisr.org/api/graphs')
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Available graphs:', JSON.stringify(data, null, 2))
    
    if (data.graphs && Array.isArray(data.graphs)) {
      console.log(`\n📊 Found ${data.graphs.length} graphs:`)
      data.graphs.forEach((graph, index) => {
        console.log(`${index + 1}. ID: ${graph.id}`)
        console.log(`   Title: ${graph.metadata?.title || 'No title'}`)
        console.log(`   Nodes: ${graph.nodes?.length || 0}`)
        console.log('')
      })
      
      if (data.graphs.length > 0) {
        console.log(`🎯 Use this graph ID for testing: "${data.graphs[0].id}"`)
      }
    } else {
      console.log('❌ No graphs found or invalid response format')
    }
  })
  .catch((error) => {
    console.error('❌ Error fetching graphs:', error)
  })
