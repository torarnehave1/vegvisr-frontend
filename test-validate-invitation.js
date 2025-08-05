// Test to validate the invitation token created for slowyou.net@gmail.com
const testValidateInvitation = async () => {
  const affWorkerUrl = 'https://aff-worker.torarnehave.workers.dev'
  const invitationToken = 'invite_1754330892553_eyhtbwyl9xi' // Token from previous test

  try {
    console.log('🔍 Testing invitation token validation...')
    console.log('🎫 Token:', invitationToken)

    const response = await fetch(`${affWorkerUrl}/validate-invitation?token=${invitationToken}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log('\n📈 Response status:', response.status)
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()))

    const result = await response.json()

    if (response.ok) {
      console.log('\n✅ SUCCESS! Invitation token is valid')
      console.log('📋 Invitation details:', JSON.stringify(result, null, 2))
    } else {
      console.log('\n❌ FAILED! Invitation token validation failed')
      console.log('💥 Error:', JSON.stringify(result, null, 2))
    }
  } catch (error) {
    console.error('\n💥 Network/Parse Error:', error.message)
    console.error('🔍 Full error:', error)
  }
}

// Run the validation test
testValidateInvitation()
