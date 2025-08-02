// Test affiliate invitation with percentage commission
const testData = {
  recipientEmail: 'test@example.com',
  recipientName: 'Test User',
  senderName: 'Admin',
  siteName: 'Test Site',
  commissionType: 'percentage',
  commissionRate: '25',
  domain: 'test.example.com',
}

console.log('Testing affiliate invitation with percentage commission...')

fetch('https://aff-worker.torarnehave.workers.dev/send-affiliate-invitation', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testData),
})
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Response:', JSON.stringify(data, null, 2))
  })
  .catch((error) => {
    console.error('❌ Error:', error)
  })
