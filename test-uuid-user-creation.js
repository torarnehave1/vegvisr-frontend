// Test the updated user creation with UUID format and proper JSON structure
const testUpdatedUserCreation = async () => {
  const affWorkerUrl = 'https://aff-worker.torarnehave.workers.dev'

  const testData = {
    recipientEmail: 'test.uuid@example.com',
    recipientName: 'Test UUID User',
    senderName: 'Torar Nemo Havé',
    siteName: 'Vegvisr',
    commissionRate: 25,
    commissionType: 'percentage',
    commissionAmount: 100,
    domain: 'vegvisr.org',
    dealName: 'test-graph-uuid-789',
    inviterAffiliateId: null,
  }

  try {
    console.log('🧪 Testing updated user creation with UUID format...')
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
    const result = await response.json()

    if (response.ok) {
      console.log('\n✅ SUCCESS! Affiliate invitation with UUID user creation')
      console.log('📨 Basic Response Info:')
      console.log('   - Success:', result.success)
      console.log('   - Invitation Token:', result.invitationToken)
      console.log('   - Expires At:', result.expiresAt)

      console.log('\n📊 Debug Info:')
      console.log('   - Is Existing User:', result.debugInfo?.isExistingUser)
      console.log('   - User Created in Config:', result.debugInfo?.userCreatedInConfig)
      console.log('   - Template ID:', result.debugInfo?.templateId)

      console.log('\n📧 Email Result:')
      console.log('   - Email Status:', result.emailResult?.success ? '✅ Sent' : '❌ Failed')
      console.log('   - Email Message:', result.emailResult?.message)

      if (result.debugInfo?.userCreatedInConfig) {
        console.log('\n🎉 NEW USER CREATED WITH UUID FORMAT!')
        console.log('   - The system created a new user with UUID-style ID')
        console.log('   - Data structure should follow the harmonized JSON format')
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
testUpdatedUserCreation()
