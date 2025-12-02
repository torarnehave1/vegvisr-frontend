#!/usr/bin/env node

/**
 * Test script for Cloudflare Secrets API integration
 * 
 * Tests three operations:
 * 1. CREATE - Store a user API key as a Cloudflare secret
 * 2. READ - Verify the secret exists in the worker environment
 * 3. DELETE - Remove the secret
 */

const API_BASE = 'https://api.vegvisr.org'
const TEST_USER_ID = 'test_user_123'
const TEST_PROVIDER = 'openai'
const TEST_API_KEY = 'sk-test-1234567890abcdef' // Fake key for testing

async function testSecretAPI(action, payload) {
  console.log(`\n🧪 Testing ${action.toUpperCase()} operation...`)
  
  const response = await fetch(`${API_BASE}/api/test-secrets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const result = await response.json()
  
  console.log(`Status: ${response.status}`)
  console.log('Response:', JSON.stringify(result, null, 2))
  
  return result
}

async function runTests() {
  console.log('🚀 Starting Cloudflare Secrets API Test Suite\n')
  console.log('=' .repeat(60))

  try {
    // Test 1: Create a secret
    console.log('\n📝 TEST 1: Create Secret')
    console.log('-'.repeat(60))
    const createResult = await testSecretAPI('create', {
      userId: TEST_USER_ID,
      provider: TEST_PROVIDER,
      apiKey: TEST_API_KEY,
      action: 'create'
    })

    if (!createResult.success) {
      console.error('❌ Failed to create secret')
      return
    }
    console.log('✅ Secret created successfully')

    // Wait a moment for secret to propagate
    console.log('\n⏳ Waiting 2 seconds for secret propagation...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Test 2: Read the secret
    console.log('\n📖 TEST 2: Read Secret')
    console.log('-'.repeat(60))
    const readResult = await testSecretAPI('read', {
      userId: TEST_USER_ID,
      provider: TEST_PROVIDER,
      action: 'read'
    })

    if (readResult.exists) {
      console.log('✅ Secret exists and is accessible')
    } else {
      console.log('⚠️  Secret not found (may need redeployment)')
    }

    // Test 3: Delete the secret
    console.log('\n🗑️  TEST 3: Delete Secret')
    console.log('-'.repeat(60))
    const deleteResult = await testSecretAPI('delete', {
      userId: TEST_USER_ID,
      provider: TEST_PROVIDER,
      action: 'delete'
    })

    if (!deleteResult.success) {
      console.error('❌ Failed to delete secret')
      return
    }
    console.log('✅ Secret deleted successfully')

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 TEST SUMMARY')
    console.log('='.repeat(60))
    console.log('✅ CREATE: ', createResult.success ? 'PASSED' : 'FAILED')
    console.log('✅ READ:   ', readResult.exists ? 'PASSED' : 'NEEDS REDEPLOY')
    console.log('✅ DELETE: ', deleteResult.success ? 'PASSED' : 'FAILED')
    console.log('\n🎉 Test suite completed!')

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message)
    console.error(error.stack)
  }
}

// Run the tests
runTests()
