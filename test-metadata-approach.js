// Test the metadata-based affiliate approach
console.log('🎯 Testing metadata-based affiliate badges...')

// Test with your actual graphs that have affiliate deals
const testGraphs = [
  {
    id: 'graph_1744927233341',
    expectedAffiliates: 1, // torarnehave@gmail.com with reference TOR0SI0IX
  },
  {
    id: 'graph_1744994708985',
    expectedAffiliates: 1, // Should have affiliate deals based on your setup
  },
]

console.log(`📊 Adding affiliate metadata to ${testGraphs.length} graphs...`)

// Process each graph
async function updateGraphMetadata(graphInfo) {
  try {
    console.log(`\n🔄 Processing graph ${graphInfo.id}...`)

    // Fetch current graph
    const response = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${graphInfo.id}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch graph ${graphInfo.id}: ${response.status}`)
    }

    const currentGraph = await response.json()
    console.log(
      `📋 Current metadata for ${graphInfo.id}:`,
      currentGraph.metadata?.affiliates || 'No affiliate metadata',
    )

    // Add affiliate metadata
    const updatedMetadata = {
      ...currentGraph.metadata,
      affiliates: {
        hasAffiliates: true,
        affiliateCount: graphInfo.expectedAffiliates,
        lastUpdated: new Date().toISOString(),
      },
    }

    console.log(`📝 Adding affiliate metadata: ${graphInfo.expectedAffiliates} affiliates`)

    // Update the graph with affiliate metadata
    const updateResponse = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: graphInfo.id,
        graphData: {
          ...currentGraph,
          metadata: updatedMetadata,
        },
        override: false, // Create new version
      }),
    })

    if (!updateResponse.ok) {
      throw new Error(`Failed to update graph ${graphInfo.id}: ${updateResponse.status}`)
    }

    const result = await updateResponse.json()
    console.log(`✅ Graph ${graphInfo.id} metadata updated successfully!`)
    console.log(
      `   Badge should show: "${graphInfo.expectedAffiliates} Affiliate${graphInfo.expectedAffiliates !== 1 ? 's' : ''}"`,
    )

    return { success: true, graphId: graphInfo.id, result }
  } catch (error) {
    console.error(`❌ Error updating graph ${graphInfo.id}:`, error)
    return { success: false, graphId: graphInfo.id, error }
  }
}

// Update all graphs sequentially
async function updateAllGraphs() {
  const results = []

  for (const graphInfo of testGraphs) {
    const result = await updateGraphMetadata(graphInfo)
    results.push(result)
  }

  console.log('\n🎉 SUMMARY:')
  console.log('=' * 50)

  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  if (successful.length > 0) {
    console.log(`✅ Successfully updated ${successful.length} graphs:`)
    successful.forEach((r) => {
      console.log(`   - ${r.graphId}`)
    })
  }

  if (failed.length > 0) {
    console.log(`❌ Failed to update ${failed.length} graphs:`)
    failed.forEach((r) => {
      console.log(`   - ${r.graphId}: ${r.error}`)
    })
  }

  console.log('\n🚀 Now refresh your GraphPortfolio page!')
  console.log('   Both graphs should now show affiliate badges with handshake icons')
  console.log('   Expected badges:')
  console.log('   - graph_1744927233341: "1 Affiliate"')
  console.log('   - graph_1744994708985: "1 Affiliate"')
}

// Run the test
updateAllGraphs().catch((error) => {
  console.error('❌ Fatal error:', error)
})
