// Test the new check-affiliate-deal endpoint
console.log('🎯 Testing affiliate deal check...')

// Test with the data you provided:
// deal_name: graph_1744927233341
// Should return hasAffiliates: true (regardless of who is checking)

const dealName = 'graph_1744927233341'

console.log(`📋 Testing with:`)
console.log(`   Deal Name: ${dealName}`)
console.log(`   (No email needed - checking if graph has ANY affiliates)`)

const url = `https://aff-worker.torarnehave.workers.dev/check-affiliate-deal?deal_name=${encodeURIComponent(dealName)}`

console.log(`🌐 Calling: ${url}`)

fetch(url)
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Response:', JSON.stringify(data, null, 2))

    if (data.success) {
      if (data.hasAffiliates) {
        console.log('🎉 SUCCESS! Graph has affiliate partners:')
        console.log(`   Affiliate Count: ${data.affiliateCount}`)
        console.log('   → Badge should be displayed')
      } else {
        console.log('❌ Graph has no affiliate partners')
        console.log('   → No badge should be displayed')
      }
    } else {
      console.log('❌ API call failed:', data.error)
    }
  })
  .catch((error) => {
    console.error('❌ Error:', error)
  })
