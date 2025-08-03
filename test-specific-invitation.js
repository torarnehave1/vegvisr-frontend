// Test the specific invitation token: invite_1754223149172_yxsex53v4vn
console.log('🎯 Testing specific invitation token...')

const token = 'invite_1754223149172_yxsex53v4vn'
const invitationUrl = `https://www.vegvisr.org/affiliate-accept?token=${token}`

console.log('🔗 Testing invitation URL:', invitationUrl)
console.log('📧 Expected recipient: torarnehave@gmail.com (Joohn Soamoa)')
console.log('👤 Invited by: Maiken')
console.log('📊 Deal: graph_1744994708985')

console.log('\nStep 1: Validate invitation token...')
fetch(`https://aff-worker.torarnehave.workers.dev/validate-invitation?token=${token}`)
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Token validation result:', JSON.stringify(data, null, 2))

    if (data.success) {
      console.log('\n✅ Token is valid!')
      console.log('📋 Invitation details:')
      console.log('  - Recipient Email:', data.invitation.recipientEmail)
      console.log('  - Recipient Name:', data.invitation.recipientName)
      console.log('  - Invited By:', data.invitation.inviterName)
      console.log('  - Deal Name:', data.invitation.dealName)
      console.log('  - Commission Rate:', data.invitation.commissionRate + '%')
      console.log('  - Domain:', data.invitation.domain)
      console.log('  - Status:', data.invitation.status)

      console.log('\nStep 2: Test acceptance...')
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
      throw new Error(`Token validation failed: ${data.error}`)
    }
  })
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Invitation acceptance result:', JSON.stringify(data, null, 2))

    if (data.success) {
      console.log('\n🎉 SUCCESS! Invitation accepted successfully!')
      console.log('📊 New affiliate details:')
      console.log('  - Affiliate ID:', data.affiliate.affiliateId)
      console.log('  - Referral Code:', data.affiliate.referralCode)
      console.log('  - Status:', data.affiliate.status)
      console.log('  - Deal Name:', data.affiliate.dealName)

      console.log('\n🔗 Generated referral link:')
      const referralLink = `https://www.${data.affiliate.domain || 'vegvisr.org'}?ref=${data.affiliate.referralCode}&deal=${data.affiliate.dealName}`
      console.log(referralLink)
    } else {
      console.log('❌ Invitation acceptance failed:', data.error)
      console.log("💡 This might be why the Accept button doesn't work!")
    }
  })
  .catch((error) => {
    console.error('❌ Error in acceptance flow:', error)
    console.log('💡 This error might be causing the Accept button to fail!')
  })
