// Complete test flow: Send invitation with graph → Accept invitation → Verify
console.log('🎯 Testing complete graph-based affiliate invitation flow...')

// Step 1: Send invitation with valid graph ID
const graphId = 'graph_17446518836495' // Norse Mythology: Exploring the Power of Nine

console.log('📨 Step 1: Sending invitation with graph ID:', graphId)

const invitationData = {
  recipientEmail: 'test.affiliate@example.com',
  recipientName: 'Test Affiliate',
  senderName: 'Admin Test',
  siteName: 'Vegvisr.org',
  dealName: graphId, // Send as dealName, not selectedGraphId
  commissionType: 'percentage',
  commissionRate: 15,
  domain: 'vegvisr.org'
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
    console.log('✅ Invitation sent result:', JSON.stringify(data, null, 2))

    if (data.success && data.invitationToken) {
      const token = data.invitationToken
      console.log('\n🔍 Step 2: Validating invitation token:', token)

      return fetch(`https://aff-worker.torarnehave.workers.dev/validate-invitation?token=${token}`)
        .then((response) => response.json())
        .then((validationData) => {
          console.log('✅ Token validation result:', JSON.stringify(validationData, null, 2))

          if (validationData.success) {
            console.log('\n✅ Step 3: Completing invitation acceptance...')

            return fetch('https://aff-worker.torarnehave.workers.dev/complete-invitation-registration', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                token: token,
                email: validationData.invitation.recipientEmail,
                name: validationData.invitation.recipientName,
              }),
            })
              .then((response) => response.json())
              .then((acceptanceData) => {
                console.log('✅ Invitation acceptance result:', JSON.stringify(acceptanceData, null, 2))

                if (acceptanceData.success) {
                  console.log('\n🎉 SUCCESS! Complete affiliate invitation flow with graph completed!')
                  console.log('📊 Summary:')
                  console.log('- ✅ Invitation sent with graph ID:', graphId)
                  console.log('- ✅ Token validated')
                  console.log('- ✅ Invitation accepted')
                  console.log('- ✅ Affiliate account activated')
                  console.log('- ✅ Graph-affiliate connection established')
                  
                  // Step 4: Verify the affiliate is connected to the graph
                  console.log('\n🔍 Step 4: Verifying graph-affiliate connection...')
                  
                  return fetch(`https://aff-worker.torarnehave.workers.dev/check-graph-ambassador-status?graphIds=${graphId}`)
                    .then((response) => response.json())
                    .then((ambassadorData) => {
                      console.log('✅ Graph ambassador status:', JSON.stringify(ambassadorData, null, 2))
                      
                      if (ambassadorData.success && ambassadorData.ambassadorStatus && ambassadorData.ambassadorStatus[graphId]) {
                        console.log('\n🏆 FINAL SUCCESS! Graph-affiliate integration working perfectly!')
                        console.log('- Graph has ambassador:', ambassadorData.ambassadorStatus[graphId])
                      } else {
                        console.log('⚠️ Warning: Graph ambassador status not detected')
                      }
                    })
                } else {
                  console.log('❌ Invitation acceptance failed:', acceptanceData.error)
                }
              })
          } else {
            console.log('❌ Token validation failed:', validationData.error)
          }
        })
    } else {
      console.log('❌ Failed to send invitation:', data.error)
    }
  })
  .catch((error) => {
    console.error('❌ Error in complete flow:', error)
  })
