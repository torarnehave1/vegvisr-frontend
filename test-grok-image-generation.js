#!/usr/bin/env node

/**
 * Test script for Grok image generation endpoint
 * Tests the new /images endpoint in grok-worker
 */

const BASE_URL = 'http://localhost:8787'; // Local dev worker
// const BASE_URL = 'https://grok.vegvisr.org'; // Production

async function testImageModels() {
  console.log('\n🎨 Testing GET /image-models...\n');

  try {
    const response = await fetch(`${BASE_URL}/image-models`);
    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.models && data.models.length > 0) {
      console.log('✅ Image models endpoint working!');
      return true;
    } else {
      console.log('❌ No models returned');
      return false;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function testImageGeneration(withUserId = false) {
  console.log(`\n🖼️  Testing POST /images ${withUserId ? 'with userId' : 'without userId'}...\n`);

  const payload = {
    prompt: 'A majestic Norwegian fjord with mountains reflected in crystal clear water at golden hour',
    size: '1024x1024',
    model: 'grok-2-image-beta',
    n: 1
  };

  // Add userId for testing user API key retrieval
  if (withUserId) {
    payload.userId = 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b';
  }

  try {
    console.log('Request payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${BASE_URL}/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('\nStatus:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok && data.data && data.data[0]) {
      console.log('\n✅ Image generation successful!');
      if (data.data[0].url) {
        console.log('📷 Image URL:', data.data[0].url);
      }
      return true;
    } else {
      console.log('❌ Image generation failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function testMissingPrompt() {
  console.log('\n🚫 Testing POST /images with missing prompt...\n');

  try {
    const response = await fetch(`${BASE_URL}/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        size: '1024x1024'
        // prompt is missing
      })
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 400 && data.error) {
      console.log('✅ Validation working correctly!');
      return true;
    } else {
      console.log('❌ Expected 400 error for missing prompt');
      return false;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function testDifferentSizes() {
  console.log('\n📐 Testing different image sizes...\n');

  const sizes = ['1024x1024', '1024x1792', '1792x1024'];
  const results = [];

  for (const size of sizes) {
    console.log(`\nTesting size: ${size}`);

    try {
      const response = await fetch(`${BASE_URL}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: 'A simple geometric pattern',
          size: size,
          model: 'grok-2-image-beta'
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ ${size} - Success`);
        results.push(true);
      } else {
        console.log(`❌ ${size} - Failed:`, data.error);
        results.push(false);
      }
    } catch (error) {
      console.error(`❌ ${size} - Error:`, error.message);
      results.push(false);
    }
  }

  return results.every(r => r);
}

async function testApiDocs() {
  console.log('\n📖 Testing GET /api/docs for image endpoints...\n');

  try {
    const response = await fetch(`${BASE_URL}/api/docs`);
    const data = await response.json();

    const hasImageEndpoints = data.paths &&
                              data.paths['/images'] &&
                              data.paths['/image-models'];

    if (hasImageEndpoints) {
      console.log('✅ Image endpoints documented in OpenAPI spec');
      console.log('\nImage endpoints found:');
      console.log('- /images:', data.paths['/images'].post.summary);
      console.log('- /image-models:', data.paths['/image-models'].get.summary);
      return true;
    } else {
      console.log('❌ Image endpoints not found in API docs');
      return false;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Grok Image Generation Tests\n');
  console.log('=' .repeat(60));

  const results = {
    imageModels: await testImageModels(),
    apiDocs: await testApiDocs(),
    missingPrompt: await testMissingPrompt(),
    imageGenerationNoUser: await testImageGeneration(false),
    imageGenerationWithUser: await testImageGeneration(true),
    differentSizes: await testDifferentSizes()
  };

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results Summary:\n');

  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
  });

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;

  console.log(`\n${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed');
  }
}

runAllTests();
