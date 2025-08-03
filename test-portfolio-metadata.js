// Test if the portfolio can read affiliate metadata correctly
console.log('🧪 Testing GraphPortfolio metadata reading...')

const testGraphIds = ['graph_1744927233341', 'graph_1744994708985']

console.log('\n🔍 Checking graph metadata from API...')

// Test each graph
for (const graphId of testGraphIds) {
  console.log(`\n📊 Testing graph: ${graphId}`)

  try {
    // Fetch complete graph data (same as portfolio does)
    const response = await fetch(`https://knowledge.vegvisr.org/getknowgraph/${graphId}`)
    if (response.ok) {
      const graphData = await response.json()
      console.log(`✅ Graph data fetched successfully`)

      // Check if affiliates metadata exists
      if (graphData.metadata && graphData.metadata.affiliates) {
        console.log(
          `✅ Affiliates metadata found:`,
          JSON.stringify(graphData.metadata.affiliates, null, 2),
        )

        // Simulate what the GraphPortfolio hasAffiliate function does
        const affiliateInfo = graphData.metadata.affiliates
        const hasAffiliates =
          affiliateInfo.hasAffiliates === true && affiliateInfo.affiliateCount > 0

        console.log(`🎯 hasAffiliate() would return: ${hasAffiliates}`)
        console.log(`👥 Affiliate count: ${affiliateInfo.affiliateCount}`)
        console.log(`📅 Last updated: ${affiliateInfo.lastUpdated}`)

        if (hasAffiliates) {
          console.log(
            `🏷️ Badge should display: "${affiliateInfo.affiliateCount} Affiliate${affiliateInfo.affiliateCount !== 1 ? 's' : ''}"`,
          )
        }
      } else {
        console.log(`❌ No affiliates metadata found`)
        console.log(`📋 Available metadata fields:`, Object.keys(graphData.metadata || {}))
      }
    } else {
      console.log(`❌ Failed to fetch graph data: ${response.status}`)
    }
  } catch (error) {
    console.error(`❌ Error testing graph ${graphId}:`, error)
  }
}

console.log('\n📝 Test complete! Check the results above.')
console.log('💡 If you see affiliate metadata, the badges should now appear in GraphPortfolio!')
