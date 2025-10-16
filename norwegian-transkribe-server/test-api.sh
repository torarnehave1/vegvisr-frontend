#!/bin/bash

# Test script for Norwegian Whisper API
# Usage: ./test-api.sh [server-ip]

SERVER_IP=${1:-localhost}
BASE_URL="http://${SERVER_IP}"

echo "🧪 Testing Norwegian Whisper API at ${BASE_URL}"
echo "================================================"

# Test 1: Health Check
echo "Test 1: Health Check"
echo "GET ${BASE_URL}/health"
curl -s -f "${BASE_URL}/health" | jq . || echo "❌ Health check failed"
echo -e "\n"

# Test 2: Service Status
echo "Test 2: Service Status"
echo "GET ${BASE_URL}/status"
curl -s -f "${BASE_URL}/status" | jq . || echo "❌ Status check failed"
echo -e "\n"

# Test 3: Root Endpoint
echo "Test 3: Root Endpoint"
echo "GET ${BASE_URL}/"
curl -s -f "${BASE_URL}/" | jq . || echo "❌ Root endpoint failed"
echo -e "\n"

# Test 4: Create test audio file (if ffmpeg is available)
if command -v ffmpeg &> /dev/null; then
    echo "Test 4: Creating test audio file"
    
    # Create a short test audio file with Norwegian speech
    echo "Generating test audio..."
    ffmpeg -f lavfi -i "sine=frequency=1000:duration=2" -ac 1 -ar 16000 test-audio.wav -y -loglevel quiet
    
    if [ -f "test-audio.wav" ]; then
        echo "Test 5: Audio Transcription"
        echo "POST ${BASE_URL}/transcribe"
        
        curl -s -f -X POST "${BASE_URL}/transcribe" \
            -F "audio=@test-audio.wav" \
            -F "language=no" | jq . || echo "❌ Transcription test failed"
        
        # Clean up
        rm -f test-audio.wav
    else
        echo "❌ Could not create test audio file"
    fi
else
    echo "ℹ️ FFmpeg not available, skipping audio test"
fi

echo -e "\n🎉 API testing completed!"
echo -e "\nTo test with your own audio file:"
echo "curl -X POST ${BASE_URL}/transcribe -F \"audio=@your-file.wav\" -F \"language=no\" | jq ." 