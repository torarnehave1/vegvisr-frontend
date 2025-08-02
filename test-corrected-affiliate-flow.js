// Test the corrected affiliate registration flow
const testCorrectedAffiliateFlow = async () => {
  const baseUrl = 'https://vegvisr-frontend.torarnehave.workers.dev'

  // First, test with a user that doesn't exist
  console.log('🧪 Testing affiliate registration for non-existent user...')

  const nonExistentUserData = {
    name: 'Non Existent User',
    email: 'nonexistent@example.com',
    domain: 'vegvisr.org',
  }

  try {
    const response1 = await fetch(`${baseUrl}/register-affiliate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nonExistentUserData),
    })

    const result1 = await response1.json()

    if (response1.status === 400 && result1.action === 'register_first') {
      console.log('✅ CORRECT: System properly requires user registration first')
      console.log('Response:', JSON.stringify(result1, null, 2))
    } else {
      console.log('❌ UNEXPECTED: System should require registration first')
      console.log('Response:', JSON.stringify(result1, null, 2))
    }
  } catch (error) {
    console.error('❌ Error testing non-existent user:', error.message)
  }

  console.log('\n' + '='.repeat(60) + '\n')

  // Test with existing verified user (from our previous tests)
  console.log('🧪 Testing affiliate registration for existing user...')

  const existingUserData = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    domain: 'vegvisr.org',
  }

  try {
    const response2 = await fetch(`${baseUrl}/register-affiliate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(existingUserData),
    })

    const result2 = await response2.json()

    if (response2.ok) {
      console.log('✅ SUCCESS: Existing user can become affiliate')
      console.log('Response:', JSON.stringify(result2, null, 2))
    } else if (response2.status === 409) {
      console.log('✅ EXPECTED: User is already an affiliate')
      console.log('Response:', JSON.stringify(result2, null, 2))
    } else {
      console.log('❌ UNEXPECTED RESPONSE:')
      console.log('Response:', JSON.stringify(result2, null, 2))
    }
  } catch (error) {
    console.error('❌ Error testing existing user:', error.message)
  }
}

testCorrectedAffiliateFlow()
