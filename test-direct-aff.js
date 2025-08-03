// Test aff-worker directly to see if it works
console.log('🔬 Testing aff-worker directly...')

const testPayload = {
  recipientEmail: 'post@universi.no',
  recipientName: 'Koan',
  senderName: 'Arne',
  siteName: 'movemetime.com',
  commissionType: 'fixed',
  commissionAmount: 75,
  domain: 'movemetime.com',
}

fetch('https://aff-worker.torarnehave.workers.dev/send-affiliate-invitation', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testPayload),
})
  .then((response) => response.json())
  .then((data) => {
    console.log('🎯 Direct aff-worker Results:', JSON.stringify(data, null, 2))
  })
  .catch((error) => {
    console.error('❌ Error:', error)
  })
