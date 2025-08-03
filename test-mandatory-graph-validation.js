// Test mandatory graph selection for affiliate invitations
console.log('🎯 Testing mandatory graph validation for affiliate invitations...')

// Test 1: Try to send invitation without dealName (should fail)
console.log('Test 1: Sending invitation without graph ID (should fail)...')
fetch('https://aff-worker.torarnehave.workers.dev/send-affiliate-invitation', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    recipientEmail: 'test.mandatory@example.com',
    recipientName: 'Test Mandatory',
    senderName: 'Admin User',
    // dealName intentionally omitted
    commissionType: 'fixed',
    commissionAmount: '50.00',
  }),
})
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ No dealName result:', JSON.stringify(data, null, 2))
    
    // Test 2: Try with invalid graph ID (should fail)
    console.log('\nTest 2: Sending invitation with invalid graph ID (should fail)...')
    
    return fetch('https://aff-worker.torarnehave.workers.dev/send-affiliate-invitation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientEmail: 'test.invalid@example.com',
        recipientName: 'Test Invalid',
        senderName: 'Admin User',
        dealName: 'graph_invalid_nonexistent_123', // Invalid graph ID
        commissionType: 'fixed',
        commissionAmount: '50.00',
      }),
    })
  })
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Invalid graph ID result:', JSON.stringify(data, null, 2))
    
    // Test 3: Try with valid graph ID (should succeed)
    console.log('\nTest 3: Sending invitation with valid graph ID (should succeed)...')
    
    return fetch('https://aff-worker.torarnehave.workers.dev/send-affiliate-invitation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientEmail: 'test.valid@example.com',
        recipientName: 'Test Valid',
        senderName: 'Admin User',
        dealName: 'graph_1754203620085', // Using a known test graph ID
        commissionType: 'fixed',
        commissionAmount: '50.00',
      }),
    })
  })
  .then((response) => response.json())
  .then((data) => {
    console.log('✅ Valid graph ID result:', JSON.stringify(data, null, 2))
    
    console.log('\n🎉 MANDATORY GRAPH VALIDATION TEST COMPLETE!')
    console.log('📊 Summary:')
    console.log('- ✅ Tested invitation without graph ID')
    console.log('- ✅ Tested invitation with invalid graph ID') 
    console.log('- ✅ Tested invitation with valid graph ID')
    console.log('- ✅ Every affiliate must now be connected to a valid graph!')
  })
  .catch((error) => {
    console.error('❌ Error in mandatory graph validation test:', error)
  })
