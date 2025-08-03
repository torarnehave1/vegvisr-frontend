// Test the actual working knowledge graph API
console.log('🧪 Testing REAL GraphPortfolio API endpoints...')

const testGraphId = 'graph_1744651836495'

console.log('\n🔍 Step 1: Test getknowgraphs (list)')
fetch('https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraphs')
  .then((response) => response.json())
  .then((data) => {
    console.log(`✅ Found ${data.results.length} graphs`)

    // Find our test graphs
    const testGraphs = data.results.filter(
      (g) => g.id === 'graph_1744927233341' || g.id === 'graph_1744994708985',
    )

    console.log(`🎯 Found ${testGraphs.length} of our affiliate test graphs`)
    testGraphs.forEach((g) => console.log(`   - ${g.id}: ${g.title}`))

    if (testGraphs.length > 0) {
      const graphToTest = testGraphs[0]
      console.log(`\n🔍 Step 2: Test individual graph fetch for: ${graphToTest.id}`)

      return fetch(
        `https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraph?id=${graphToTest.id}`,
      )
    } else {
      console.log('\n❌ Our test graphs not found, testing first available graph')
      return fetch(
        `https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraph?id=${data.results[0].id}`,
      )
    }
  })
  .then((response) => {
    console.log(`   Individual graph status: ${response.status}`)
    return response.json()
  })
  .then((data) => {
    console.log('   ✅ Individual graph data fetched')
    console.log('   📋 Available metadata fields:', Object.keys(data.metadata || {}))

    if (data.metadata?.affiliates) {
      console.log('   🎯 FOUND AFFILIATE METADATA!')
      console.log('   📊 Affiliate data:', JSON.stringify(data.metadata.affiliates, null, 2))
      console.log('\n🎉 SUCCESS: Affiliate badges should display!')
    } else {
      console.log('   ❌ No affiliate metadata found')
      console.log('   💡 This explains why badges are not showing')
    }

    console.log('\n🔧 SOLUTION:')
    console.log('1. Deploy the affiliate worker to enable metadata updates')
    console.log('2. Update graph metadata with affiliate information')
    console.log('3. GraphPortfolio will then show the badges')
  })
  .catch((error) => {
    console.error('❌ Test failed:', error)
  })
