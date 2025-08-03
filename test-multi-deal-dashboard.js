// Test updated affiliate dashboard API with multi-deal support
console.log('🔍 Testing updated affiliate dashboard API...')

const testEmail = 'torarnehave@gmail.com'

console.log('Testing new multi-deal affiliate dashboard API...')
fetch(
  `https://aff-worker.torarnehave.workers.dev/affiliate-dashboard?email=${encodeURIComponent(testEmail)}`,
)
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ New API Response:', JSON.stringify(data, null, 2))

    if (data.success) {
      console.log('\n📊 Multi-Deal Dashboard Data:')
      console.log('  - Affiliate Name:', data.affiliate.name)
      console.log('  - Total Deals:', data.affiliate.totalDeals)
      console.log('  - Overall Stats:', data.overallStatistics)

      console.log('\n🎯 Individual Deals:')
      data.deals.forEach((deal, index) => {
        console.log(`  Deal ${index + 1}:`)
        console.log(`    - Deal Name: ${deal.dealName}`)
        console.log(`    - Referral Code: ${deal.referralCode}`)
        console.log(`    - Commission Rate: ${deal.commissionRate}%`)
        console.log(`    - Domain: ${deal.domain}`)
        console.log(
          `    - Referral Link: https://www.${deal.domain}?ref=${deal.referralCode}&deal=${deal.dealName}`,
        )
        console.log(
          `    - Statistics: ${deal.statistics.totalReferrals} referrals, $${deal.statistics.totalEarnings} earnings`,
        )
      })
    } else {
      console.log('❌ API Error:', data.error)
    }
  })
  .catch((error) => {
    console.error('❌ Error testing updated API:', error)
  })
