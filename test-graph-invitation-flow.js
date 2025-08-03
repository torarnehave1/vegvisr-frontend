// Test sending invitation with deal_name and verifying the complete flow
console.log('🎯 Testing graph-specific affiliate invitation flow...')

const testGraphId = 'graph_test_1754203620085'

console.log('Step 1: Send invitation with specific graphId as dealName...')

fetch('https://aff-worker.torarnehave.workers.dev/send-affiliate-invitation', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    recipientEmail: 'test.ambassador@example.com',
    recipientName: 'Test Ambassador',
    senderName: 'Graph Creator',
    dealName: testGraphId, // This should be stored in the invitation
    commissionType: 'fixed',
    commissionAmount: '50.00',
    domain: 'vegvisr.org'
  }),
})
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Invitation sent:', JSON.stringify(data, null, 2))
    
    if (data.success && data.invitationToken) {
      const token = data.invitationToken
      console.log(`\nStep 2: Validate invitation token to check deal_name storage...`)
      
      return fetch(`https://aff-worker.torarnehave.workers.dev/validate-invitation?token=${token}`)
    } else {
      throw new Error('Failed to send invitation')
    }
  })
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Token validation result:', JSON.stringify(data, null, 2))
    
    if (data.success && data.invitation) {
      console.log('\n📋 Checking deal_name in invitation:')
      console.log(`- dealName: ${data.invitation.dealName}`)
      
      if (data.invitation.dealName === testGraphId) {
        console.log('✅ SUCCESS! GraphId properly stored as deal_name in invitation')
      } else {
        console.log(`❌ FAIL! Expected "${testGraphId}", got "${data.invitation.dealName}"`)
      }
      
      console.log('\nStep 3: Complete invitation acceptance to verify deal_name transfer...')
      
      return fetch('https://aff-worker.torarnehave.workers.dev/complete-invitation-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: data.invitation.token,
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
    
    if (data.success && data.affiliate) {
      console.log('\n📋 Checking deal_name in created affiliate:')
      console.log(`- deal_name: ${data.affiliate.deal_name}`)
      
      if (data.affiliate.deal_name === testGraphId) {
        console.log('✅ SUCCESS! GraphId properly transferred to affiliate record')
        console.log('\n🎉 COMPLETE SUCCESS! Graph-specific invitation flow works perfectly!')
        console.log('📊 Summary:')
        console.log('- ✅ Invitation sent with graphId as dealName')
        console.log('- ✅ GraphId stored in invitation record')
        console.log('- ✅ GraphId retrieved during validation')
        console.log('- ✅ GraphId transferred to affiliate on acceptance')
        console.log('- ✅ Affiliate is now ambassador for specific graph')
      } else {
        console.log(`❌ FAIL! Expected "${testGraphId}", got "${data.affiliate.deal_name}"`)
      }
    } else {
      console.log('❌ Invitation acceptance failed:', data.error)
    }
  })
  .catch((error) => {
    console.error('❌ Error in graph invitation flow:', error)
  })
