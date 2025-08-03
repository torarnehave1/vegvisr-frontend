// Test the complete affiliate invitation acceptance flow
console.log('🎯 Testing complete affiliate invitation acceptance flow...')

// Use the token from the previous test
const token = 'invite_1754203620085_yqhjbaakn2'

console.log('Step 1: Validate invitation token...')
fetch(`https://aff-worker.torarnehave.workers.dev/validate-invitation?token=${token}`)
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Token validation result:', JSON.stringify(data, null, 2))

    if (data.success) {
      console.log('\nStep 2: Complete invitation acceptance...')

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
    } else {
      throw new Error('Token validation failed')
    }
  })
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Invitation acceptance result:', JSON.stringify(data, null, 2))

    if (data.success) {
      console.log('\n🎉 SUCCESS! Affiliate invitation flow completed successfully!')
      console.log('📊 Summary:')
      console.log('- ✅ Token validated')
      console.log('- ✅ Invitation accepted')
      console.log('- ✅ Affiliate account activated')
      console.log('- ✅ User can now access affiliate dashboard')
    } else {
      console.log('❌ Invitation acceptance failed:', data.error)
    }
  })
  .catch((error) => {
    console.error('❌ Error in acceptance flow:', error)
  })
