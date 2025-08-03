// Test if the user exists in the config table
console.log('🔍 Checking if user exists in the system...')

const userEmail = 'torarnehave@gmail.com'

console.log('Testing user registration status...')
fetch(`https://dash-worker.torarnehave.workers.dev/userdata?email=${encodeURIComponent(userEmail)}`)
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ User data response:', JSON.stringify(data, null, 2))

    if (data.user_id) {
      console.log(`✅ User exists in system with ID: ${data.user_id}`)
      console.log(`   This should allow affiliate registration to work`)
    } else {
      console.log(`❌ User does not exist in the system!`)
      console.log(
        `   User needs to register first at: https://vegvisr.org/register?email=${userEmail}`,
      )
      console.log(`   This is why the affiliate invitation acceptance fails!`)
    }

    console.log('\n📋 User details:')
    console.log(`   - Email: ${data.email || 'Not set'}`)
    console.log(`   - User ID: ${data.user_id || 'Not set'}`)
    console.log(`   - Role: ${data.role || 'Not set'}`)
    console.log(`   - Email Verified: ${data.emailVerificationToken ? 'Pending' : 'Unknown'}`)
  })
  .catch((error) => {
    console.error('❌ Error checking user registration:', error)
  })
