#!/bin/bash
# Test the new /diarize-audio endpoint

echo "🧪 Testing /diarize-audio endpoint..."
echo ""

# You'll need to replace this with an actual audio URL from your R2 bucket
# Example: https://audio.vegvisr.org/norwegian-audio/2025-10-31-audio.wav

AUDIO_URL="$1"

if [ -z "$AUDIO_URL" ]; then
  echo "❌ Usage: ./test-worker-diarization.sh <audio-url>"
  echo ""
  echo "Example:"
  echo "  ./test-worker-diarization.sh https://audio.vegvisr.org/norwegian-audio/2025-10-31-audio.wav"
  exit 1
fi

echo "📤 Testing diarization with audio: $AUDIO_URL"
echo ""

RESPONSE=$(curl -s -X POST \
  https://norwegian-transcription-worker.torarnehave.workers.dev/diarize-audio \
  -H "Content-Type: application/json" \
  -d "{\"audioUrl\": \"$AUDIO_URL\"}")

echo "📊 Response:"
echo "$RESPONSE" | jq

echo ""

# Check if successful
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  SEGMENT_COUNT=$(echo "$RESPONSE" | jq '.segments | length')
  echo "✅ Success! Found $SEGMENT_COUNT speaker segments"
  echo ""
  echo "First 5 segments:"
  echo "$RESPONSE" | jq '.segments[0:5]'
else
  echo "❌ Test failed"
  echo "$RESPONSE" | jq '.error // "Unknown error"'
fi
