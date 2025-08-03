// Check the current schema of affiliate_invitations table
console.log('🔍 Checking affiliate_invitations table schema...')

const testToken = 'invite_1754203620085_yqhjbaakn2'

fetch(`https://aff-worker.torarnehave.workers.dev/validate-invitation?token=${testToken}`)
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Invitation validation response:', JSON.stringify(data, null, 2))

    if (data.success && data.invitation) {
      console.log('\n📋 Available fields in invitation object:')
      Object.keys(data.invitation).forEach((key) => {
        console.log(`- ${key}: ${data.invitation[key]}`)
      })

      // Check specifically for deal_name
      if ('deal_name' in data.invitation) {
        console.log('\n✅ deal_name field EXISTS in affiliate_invitations table!')
        console.log(`   Value: ${data.invitation.deal_name}`)
      } else {
        console.log('\n❌ deal_name field NOT FOUND in affiliate_invitations table')
      }
    } else {
      console.log('❌ Could not retrieve invitation data to check schema')
    }
  })
  .catch((error) => {
    console.error('❌ Error checking schema:', error)
  })
