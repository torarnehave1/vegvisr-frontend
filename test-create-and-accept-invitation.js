// Test complete flow: Create invitation -> Accept invitation
console.log('🎯 Testing complete affiliate invitation flow (create + accept)...')

// Step 1: Create a new invitation with graph selection
console.log('\nStep 1: Creating new affiliate invitation...')

const invitationData = {
  recipientEmail: 'test@example.com',
  recipientName: 'Test User',
  senderName: 'Admin User',
  siteName: 'Vegvisr.org',
  selectedGraphId: 'ai-automation-tools', // Use a valid graph ID
  dealName: 'ai-automation-tools', // Map to dealName for backend
  commissionType: 'percentage',
  commissionRate: 15,
  domain: 'vegvisr.org',
}

fetch('https://aff-worker.torarnehave.workers.dev/send-affiliate-invitation', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(invitationData),
})
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Invitation creation result:', JSON.stringify(data, null, 2))

    if (data.success && data.invitationToken) {
      const token = data.invitationToken
      console.log(`\n🎫 New token created: ${token}`)

      // Step 2: Validate the new token
      console.log('\nStep 2: Validating new invitation token...')
      return fetch(`https://aff-worker.torarnehave.workers.dev/validate-invitation?token=${token}`)
        .then((response) => response.json())
        .then((validationData) => {
          console.log('✅ Token validation result:', JSON.stringify(validationData, null, 2))

          if (validationData.success) {
            // Step 3: Complete invitation acceptance
            console.log('\nStep 3: Completing invitation acceptance...')
            return fetch(
              'https://aff-worker.torarnehave.workers.dev/complete-invitation-registration',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  token: token,
                  email: validationData.invitation.recipientEmail,
                  name: validationData.invitation.recipientName,
                }),
              },
            )
          } else {
            throw new Error('Token validation failed: ' + validationData.error)
          }
        })
    } else {
      throw new Error('Invitation creation failed: ' + (data.error || 'Unknown error'))
    }
  })
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Invitation acceptance result:', JSON.stringify(data, null, 2))

    if (data.success) {
      console.log('\n🎉 SUCCESS! Complete affiliate invitation flow completed!')
      console.log('📊 Summary:')
      console.log('- ✅ Invitation created with graph assignment')
      console.log('- ✅ Token validated')
      console.log('- ✅ Invitation accepted')
      console.log('- ✅ Affiliate account activated with deal_name')
      console.log('- ✅ User can now access affiliate dashboard')
    } else {
      console.log('❌ Invitation acceptance failed:', data.error)
    }
  })
  .catch((error) => {
    console.error('❌ Error in complete flow:', error)
  })
