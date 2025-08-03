// Test invitation flow with a simple graph ID
console.log('🎯 Testing invitation with simple graph ID...')

const invitationData = {
  recipientEmail: 'test@example.com',
  recipientName: 'Test User',
  senderName: 'Admin User',
  siteName: 'Vegvisr.org',
  selectedGraphId: 'test-graph', // Simple test ID
  dealName: 'test-graph',
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
    console.log('✅ Invitation result:', JSON.stringify(data, null, 2))
  })
  .catch((error) => {
    console.error('❌ Error:', error)
  })
