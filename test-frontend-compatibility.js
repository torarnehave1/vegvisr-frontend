// Test the affiliate dashboard with user authentication
console.log('🔍 Testing affiliate dashboard with multi-deal support...')

// Simulate how the frontend would call the API
const testUserEmail = 'torarnehave@gmail.com'

console.log('Testing frontend compatibility with new multi-deal API...')

fetch(
  `https://aff-worker.torarnehave.workers.dev/affiliate-dashboard?email=${encodeURIComponent(testUserEmail)}`,
)
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Multi-Deal API Response:', JSON.stringify(data, null, 2))

    if (data.success) {
      console.log('\n🎯 Frontend Data Structure:')
      console.log('affiliateInfo:', data.affiliate)
      console.log('affiliateDeals:', data.deals)
      console.log('stats (overall):', data.overallStatistics)

      console.log('\n📋 Referral Links Generated:')
      data.deals.forEach((deal, index) => {
        const domain = deal.domain || 'vegvisr.org'
        const referralLink = `https://www.${domain}?ref=${deal.referralCode}&deal=${deal.dealName}`
        console.log(`  Deal ${index + 1}: ${referralLink}`)
      })

      console.log('\n✅ Frontend should now display:')
      console.log(`  - User: ${data.affiliate.name}`)
      console.log(`  - Total Deals: ${data.affiliate.totalDeals}`)
      console.log(`  - Each deal with its own referral link`)
      console.log(`  - Individual deal statistics`)
    } else {
      console.log('❌ API Error:', data.error)
    }
  })
  .catch((error) => {
    console.error('❌ Error testing API:', error)
  })
