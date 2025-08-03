// Test affiliate invitation token validation
console.log('🔍 Testing affiliate invitation token validation...')

// Use the token from the previous test
const token = 'invite_1754203620085_yqhjbaakn2'

fetch(`https://aff-worker.torarnehave.workers.dev/validate-invitation?token=${token}`, {
  method: 'GET',
})
  .then(response => response.json())
  .then(data => {
    console.log('✅ Token Validation Results:', JSON.stringify(data, null, 2))
  })
  .catch(error => {
    console.error('❌ Error:', error)
  })
