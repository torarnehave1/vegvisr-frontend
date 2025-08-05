// Test send-affiliate-invitation endpoint with slowyou.net@gmail.com
const testSendAffiliateInvitation = async () => {
  const affWorkerUrl = 'https://aff-worker.torarnehave.workers.dev'

  const testData = {
    recipientEmail: 'slowyou.net@gmail.com',
    recipientName: 'SlowYou Test User',
    senderName: 'Tor Arne Håve',
    siteName: 'Vegvisr',
    commissionRate: 15,
    commissionType: 'percentage',
    domain: 'vegvisr.org',
    dealName: 'graph_1754371544928', // Required field for graph-specific affiliates
    inviterAffiliateId: null,
  }

  try {
    console.log('🧪 Testing send-affiliate-invitation endpoint...')
    console.log('📧 Target email:', testData.recipientEmail)
    console.log('📊 Request data:', JSON.stringify(testData, null, 2))

    const response = await fetch(`${affWorkerUrl}/send-affiliate-invitation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    })

    console.log('\n📈 Response status:', response.status)
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()))

    const result = await response.json()

    if (response.ok) {
      console.log('\n✅ SUCCESS! Affiliate invitation sent successfully')
      console.log('📨 Response:', JSON.stringify(result, null, 2))

      if (result.invitationToken) {
        console.log('\n🔑 Invitation Token:', result.invitationToken)
        console.log('⏰ Expires At:', result.expiresAt)
      }

      if (result.emailResult) {
        console.log('\n📧 Email Status:', result.emailResult.success ? '✅ Sent' : '❌ Failed')
        console.log('📧 Email Message:', result.emailResult.message)
        if (result.emailResult.error) {
          console.log('📧 Email Error:', result.emailResult.error)
        }
      }
    } else {
      console.log('\n❌ FAILED! Affiliate invitation failed')
      console.log('💥 Error:', JSON.stringify(result, null, 2))
    }
  } catch (error) {
    console.error('\n💥 Network/Parse Error:', error.message)
    console.error('🔍 Full error:', error)
  }
}

// Run the test
testSendAffiliateInvitation()
