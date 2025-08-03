// Test the correct API endpoint format
console.log('🔍 Testing correct getknowgraph endpoint format...')

const testGraphId = 'graph_1744651836495'

console.log('\n❌ Testing BROKEN format: /getknowgraph/{id}')
fetch(`https://knowledge.vegvisr.org/getknowgraph/${testGraphId}`)
  .then((response) => {
    console.log(`   Status: ${response.status}`)
    return response.text()
  })
  .then((text) => {
    console.log(`   Response type: ${text.startsWith('<!DOCTYPE') ? 'HTML Error Page' : 'Other'}`)
  })
  .catch((error) => console.log(`   Error: ${error.message}`))

console.log('\n✅ Testing CORRECT format: /getknowgraph?id={id}')
fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${testGraphId}`)
  .then((response) => {
    console.log(`   Status: ${response.status}`)
    console.log(`   Content-Type: ${response.headers.get('content-type')}`)
    return response.json()
  })
  .then((data) => {
    console.log('   ✅ Valid JSON response!')
    console.log(`   📋 Metadata fields: ${Object.keys(data.metadata || {})}`)

    if (data.metadata?.affiliates) {
      console.log('   🎯 FOUND affiliates metadata!')
      console.log('   📊 Affiliate data:', JSON.stringify(data.metadata.affiliates, null, 2))
    } else {
      console.log('   ❌ No affiliates metadata in this graph')
    }
  })
  .catch((error) => {
    console.log(`   ❌ Error: ${error.message}`)
  })
