// Verify the actual affiliate data in the database for your test graphs
console.log('🔍 Verifying affiliate data for test graphs...')

const testGraphs = ['graph_1744927233341', 'graph_1744994708985']

async function checkAffiliateData() {
  for (const graphId of testGraphs) {
    console.log(`\n📊 Checking affiliates for ${graphId}:`)

    try {
      // Use the new endpoint we created to check affiliate count
      const response = await fetch(
        `https://aff-worker.torarnehave.workers.dev/check-affiliate-deal?deal_name=${encodeURIComponent(graphId)}`,
      )

      if (response.ok) {
        const data = await response.json()
        console.log(`   Response:`, data)

        if (data.success) {
          if (data.hasAffiliates) {
            console.log(`   ✅ Found ${data.affiliateCount} active affiliates`)
            console.log(
              `   → Badge should show: "${data.affiliateCount} Affiliate${data.affiliateCount !== 1 ? 's' : ''}"`,
            )
          } else {
            console.log(`   ❌ No active affiliates found`)
            console.log(`   → No badge should be displayed`)
          }
        } else {
          console.log(`   ❌ API error: ${data.error}`)
        }
      } else {
        console.log(`   ❌ HTTP error: ${response.status}`)
      }
    } catch (error) {
      console.error(`   ❌ Network error:`, error)
    }
  }

  console.log('\n📋 Database vs Metadata Comparison:')
  console.log('   - Database shows actual affiliate registrations')
  console.log('   - Metadata approach should match database counts')
  console.log('   - Run test-metadata-approach.js to sync metadata with database')
}

checkAffiliateData().catch((error) => {
  console.error('❌ Fatal error:', error)
})
