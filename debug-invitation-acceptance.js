// Debug the invitation acceptance issue in detail
console.log('🔍 Debugging invitation acceptance failure...')

const token = 'invite_1754223149172_yxsex53v4vn'

console.log('Step 1: Check if user already exists for this deal...')

// First, let's check the current affiliate dashboard for this user
fetch(`https://aff-worker.torarnehave.workers.dev/affiliate-dashboard?email=torarnehave@gmail.com`)
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Current affiliate status:', JSON.stringify(data, null, 2))

    if (data.success && data.deals) {
      console.log('\n📊 Existing deals for this user:')
      data.deals.forEach((deal, index) => {
        console.log(`  Deal ${index + 1}: ${deal.dealName} (${deal.referralCode})`)
      })

      // Check if the deal already exists
      const existingDeal = data.deals.find((deal) => deal.dealName === 'graph_1744994708985')
      if (existingDeal) {
        console.log(`\n⚠️  CONFLICT FOUND: User already has deal "graph_1744994708985"`)
        console.log(`    Existing referral code: ${existingDeal.referralCode}`)
        console.log(`    This is likely why the invitation acceptance fails!`)
        return
      } else {
        console.log(`\n✅ No conflict: User doesn't have deal "graph_1744994708985" yet`)
      }
    }

    console.log('\nStep 2: Validate invitation token...')
    return fetch(`https://aff-worker.torarnehave.workers.dev/validate-invitation?token=${token}`)
  })
  .then((response) => response.json())
  .then((data) => {
    if (!data.success) {
      throw new Error(`Token validation failed: ${data.error}`)
    }

    console.log('✅ Token is valid, attempting registration...')

    console.log('\nStep 3: Test registration with detailed error handling...')
    return fetch('https://aff-worker.torarnehave.workers.dev/complete-invitation-registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token,
        email: data.invitation.recipientEmail,
        name: data.invitation.recipientName,
      }),
    })
  })
  .then((response) => {
    console.log('📡 Registration response status:', response.status)
    console.log('📡 Registration response headers:', [...response.headers.entries()])
    return response.json()
  })
  .then((data) => {
    console.log('✅ Registration response:', JSON.stringify(data, null, 2))

    if (data.success) {
      console.log('\n🎉 SUCCESS! Registration completed')
    } else {
      console.log('\n❌ Registration failed:', data.error)
      console.log("💡 This explains why the Accept Invitation button doesn't work")
    }
  })
  .catch((error) => {
    console.error('❌ Error during debugging:', error)
  })
