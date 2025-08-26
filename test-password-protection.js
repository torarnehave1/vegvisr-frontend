/**
 * Test Password Protection Implementation
 * Run this to test the password protection features
 */

console.log('🔒 Testing Password Protection Implementation');

// Test cases
const testCases = [
  {
    name: 'Check password not required for public graph',
    graphId: 'public-graph-123',
    expectedPasswordRequired: false
  },
  {
    name: 'Check password required for protected graph',
    graphId: 'demo-protected',
    expectedPasswordRequired: true
  },
  {
    name: 'Verify correct password',
    graphId: 'demo-protected',
    password: 'demo123',
    expectedVerified: true
  },
  {
    name: 'Verify incorrect password',
    graphId: 'demo-protected',
    password: 'wrongpassword',
    expectedVerified: false
  }
];

// Test function for checking password requirement
async function testCheckPassword(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);

  try {
    const response = await fetch(`https://your-worker-domain.workers.dev/checkpassword?id=${testCase.graphId}`);
    const data = await response.json();

    console.log('Response:', data);

    if (data.passwordRequired === testCase.expectedPasswordRequired) {
      console.log('✅ Test passed');
    } else {
      console.log('❌ Test failed');
      console.log(`Expected: ${testCase.expectedPasswordRequired}, Got: ${data.passwordRequired}`);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Test function for password verification
async function testVerifyPassword(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);

  try {
    const response = await fetch('https://your-worker-domain.workers.dev/verifypassword', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        graphId: testCase.graphId,
        password: testCase.password
      })
    });

    const data = await response.json();
    console.log('Response:', data);

    if (data.verified === testCase.expectedVerified) {
      console.log('✅ Test passed');
      if (data.token) {
        console.log('🎟️ Session token received:', data.token);
      }
    } else {
      console.log('❌ Test failed');
      console.log(`Expected verified: ${testCase.expectedVerified}, Got: ${data.verified}`);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting password protection tests...\n');

  // Note: Update the worker domain before running tests
  console.log('⚠️  Make sure to update the worker domain in the test URLs');
  console.log('   Example: https://password-worker.your-subdomain.workers.dev');

  for (const testCase of testCases) {
    if (testCase.password !== undefined) {
      await testVerifyPassword(testCase);
    } else {
      await testCheckPassword(testCase);
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n🏁 Tests completed');
}

// Uncomment to run tests:
// runTests();

// Instructions for manual testing:
console.log(`
📋 Manual Testing Instructions:

1. Deploy the password-protection-worker.js to Cloudflare Workers
2. Update the worker domain in the test URLs above
3. Uncomment runTests() and run this script
4. Test in the browser by:
   - Opening a protected graph URL (e.g., /graph/demo-protected)
   - You should see the password modal
   - Enter password "demo123" to unlock
   - Session should persist until page refresh

🔧 Integration Steps:

1. Update API endpoints in GNewViewer.vue to point to your worker
2. Configure protected graphs in your worker's database/KV store
3. Add admin interface for setting passwords
4. Implement proper JWT tokens for production
5. Add password management UI for graph creators

🎯 Example protected graph URLs to test:
- /graph/demo-protected (password: demo123)
- /graph/private-graph-123 (password: secret456)
`);

module.exports = {
  testCases,
  testCheckPassword,
  testVerifyPassword,
  runTests
};
