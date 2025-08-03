// Debug script to test affiliate dashboard authentication
console.log('🔍 Testing affiliate dashboard authentication...')

// Test the actual API call with the email
const testEmail = 'torarnehave@gmail.com'

console.log('Step 1: Testing affiliate dashboard API directly...')
fetch(`https://aff-worker.torarnehave.workers.dev/affiliate-dashboard?email=${encodeURIComponent(testEmail)}`)
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ API Response:', JSON.stringify(data, null, 2))
    
    if (data.success && data.affiliate) {
      console.log('✅ Affiliate found!')
      console.log('📊 Affiliate data:')
      console.log('  - ID:', data.affiliate.id)
      console.log('  - Name:', data.affiliate.name)
      console.log('  - Email:', data.affiliate.email)
      console.log('  - Referral Code:', data.affiliate.referralCode)
      console.log('  - Commission Rate:', data.affiliate.commissionRate + '%')
      console.log('  - Status:', data.affiliate.status)
    } else {
      console.log('❌ No affiliate found or API error')
    }
  })
  .catch((error) => {
    console.error('❌ Error testing affiliate dashboard:', error)
  })
