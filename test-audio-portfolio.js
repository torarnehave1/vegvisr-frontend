// Test script for Audio Portfolio System
// Run with: node test-audio-portfolio.js

const WHISPER_BASE_URL = 'https://whisper.vegvisr.org'
const TEST_USER_EMAIL = 'test@example.com'

// Test data
const testRecording = {
  userEmail: TEST_USER_EMAIL,
  fileName: 'test-recording.mp3',
  displayName: 'Test Recording',
  r2Key: 'test-key-123',
  r2Url: 'https://pub-test.r2.dev/test-recording.mp3',
  fileSize: 1024000,
  estimatedDuration: 60,
  transcription: {
    text: 'This is a test transcription of the audio recording.',
    service: 'OpenAI API',
    model: 'whisper-1',
    language: 'en',
  },
  tags: ['test', 'audio', 'transcription'],
  category: 'Test',
}

// Test functions
async function testPortfolioSave() {
  console.log('🧪 Testing portfolio save...')

  try {
    const response = await fetch(`${WHISPER_BASE_URL}/audio-portfolio/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testRecording),
    })

    if (!response.ok) {
      throw new Error(`Save failed: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('✅ Save successful:', result)
    return result.recordingId
  } catch (error) {
    console.error('❌ Save failed:', error)
    throw error
  }
}

async function testPortfolioList() {
  console.log('🧪 Testing portfolio list...')

  try {
    const response = await fetch(
      `${WHISPER_BASE_URL}/audio-portfolio/list?userEmail=${encodeURIComponent(TEST_USER_EMAIL)}`,
    )

    if (!response.ok) {
      throw new Error(`List failed: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('✅ List successful:', result)
    return result.recordings
  } catch (error) {
    console.error('❌ List failed:', error)
    throw error
  }
}

async function testPortfolioSearch() {
  console.log('🧪 Testing portfolio search...')

  try {
    const response = await fetch(
      `${WHISPER_BASE_URL}/audio-portfolio/search?userEmail=${encodeURIComponent(TEST_USER_EMAIL)}&q=test`,
    )

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('✅ Search successful:', result)
    return result.recordings
  } catch (error) {
    console.error('❌ Search failed:', error)
    throw error
  }
}

async function testPortfolioDelete(recordingId) {
  console.log('🧪 Testing portfolio delete...')

  try {
    const response = await fetch(
      `${WHISPER_BASE_URL}/audio-portfolio/delete?userEmail=${encodeURIComponent(TEST_USER_EMAIL)}&recordingId=${recordingId}`,
      {
        method: 'DELETE',
      },
    )

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('✅ Delete successful:', result)
    return result
  } catch (error) {
    console.error('❌ Delete failed:', error)
    throw error
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Audio Portfolio System Tests')
  console.log('='.repeat(50))

  try {
    // Test 1: Save recording
    const recordingId = await testPortfolioSave()

    // Test 2: List recordings
    const recordings = await testPortfolioList()

    // Test 3: Search recordings
    const searchResults = await testPortfolioSearch()

    // Test 4: Delete recording (cleanup)
    if (recordingId) {
      await testPortfolioDelete(recordingId)
    }

    console.log('='.repeat(50))
    console.log('🎉 All tests completed successfully!')
    console.log('✅ Portfolio system is working correctly')
  } catch (error) {
    console.log('='.repeat(50))
    console.error('💥 Test suite failed:', error)
    console.log('❌ Portfolio system needs attention')
  }
}

// Execute tests
runTests()
