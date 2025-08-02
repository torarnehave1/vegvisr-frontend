// Check what email templates exist in database
console.log('Checking available email templates...')

fetch('https://aff-worker.torarnehave.workers.dev/admin/affiliates', {
  method: 'GET',
})
  .then((response) => response.json())
  .then((data) => {
    console.log('Admin endpoint test:', JSON.stringify(data, null, 2))
  })
  .catch((error) => {
    console.error('❌ Error:', error)
  })
