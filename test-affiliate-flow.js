// Test the fixed affiliate invitation flow
console.log('🧪 Testing affiliate invitation flow with existing user...')

const testPayload = {
  recipientEmail: 'post@universi.no',
  recipientName: 'Koan',
  senderName: 'Arne',
  siteName: 'movemetime.com',
  commissionType: 'fixed',
  commissionAmount: 75,
  domain: 'movemetime.com',
}

fetch('https://test.vegvisr.org/send-affiliate-invitation', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testPayload),
})
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Test Results:', JSON.stringify(data, null, 2))
    console.log('Status: Should now work for existing users!')
  })
  .catch((error) => {
    console.error('❌ Error:', error)
  })
