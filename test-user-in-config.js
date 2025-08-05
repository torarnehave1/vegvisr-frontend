// Test to verify the user was created in the config table
const testUserInConfigTable = async () => {
  // Since we can't directly query the Cloudflare D1 database from here,
  // let's create a test endpoint to check if the user exists

  const affWorkerUrl = 'https://aff-worker.torarnehave.workers.dev'
  const testEmail = 'slowyou.net@gmail.com'

  console.log('🔍 Testing if user exists in config table...')
  console.log('📧 Checking email:', testEmail)

  // We'll test this indirectly by trying to send another invitation to the same email
  // If the user exists, it should use the existing user template

  const testData = {
    recipientEmail: testEmail,
    recipientName: 'SlowYou Test User (Second Invite)',
    senderName: 'Torar Nemo Havé',
    siteName: 'Vegvisr',
    commissionRate: 20, // Different rate for the second test
    commissionType: 'percentage',
    domain: 'vegvisr.org',
    dealName: 'test-graph-id-456', // Different deal name
    inviterAffiliateId: null,
  }

  try {
    const response = await fetch(`${affWorkerUrl}/send-affiliate-invitation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    })

    const result = await response.json()

    if (response.ok) {
      console.log('\n✅ SUCCESS! Second invitation processed')
      console.log('📊 Debug Info:')
      console.log('   - Is Existing User:', result.debugInfo?.isExistingUser)
      console.log('   - User Created in Config:', result.debugInfo?.userCreatedInConfig)
      console.log('   - Template ID:', result.debugInfo?.templateId)

      if (result.debugInfo?.isExistingUser) {
        console.log('\n🎉 CONFIRMED: User exists in config table!')
        console.log('   - The system detected the user as existing')
        console.log('   - Used existing user template:', result.debugInfo?.templateId)
      } else {
        console.log('\n⚠️  UNEXPECTED: User still shows as new')
        console.log('   - This might indicate an issue with user detection')
      }
    } else {
      console.log('\n❌ FAILED! Second invitation failed')
      console.log('💥 Error:', JSON.stringify(result, null, 2))
    }
  } catch (error) {
    console.error('\n💥 Network/Parse Error:', error.message)
  }
}

// Run the test
testUserInConfigTable()
