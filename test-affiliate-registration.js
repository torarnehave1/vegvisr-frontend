// Test the complete affiliate registration flow
const testAffiliateRegistration = async () => {
  const baseUrl = 'https://vegvisr-frontend.torarnehave.workers.dev'

  const testData = {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    domain: 'vegvisr.org',
  }

  try {
    console.log('Testing affiliate registration...')
    console.log('Request data:', JSON.stringify(testData, null, 2))

    const response = await fetch(`${baseUrl}/register-affiliate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    })

    const result = await response.json()

    if (response.ok) {
      console.log('\n✅ SUCCESS! Affiliate registered successfully')
      console.log('Response:', JSON.stringify(result, null, 2))

      // Test fetching the dashboard
      if (result.affiliate && result.affiliate.id) {
        console.log('\n📊 Testing dashboard fetch...')
        const dashboardResponse = await fetch(
          `${baseUrl}/affiliate-dashboard?affiliateId=${result.affiliate.id}`,
        )
        const dashboardData = await dashboardResponse.json()

        if (dashboardResponse.ok) {
          console.log('✅ Dashboard data retrieved successfully')
          console.log('Dashboard:', JSON.stringify(dashboardData, null, 2))
        } else {
          console.log('❌ Dashboard fetch failed:', dashboardData)
        }
      }
    } else {
      console.error('\n❌ ERROR:', result)
    }
  } catch (error) {
    console.error('\n❌ FETCH ERROR:', error.message)
  }
}

testAffiliateRegistration()
