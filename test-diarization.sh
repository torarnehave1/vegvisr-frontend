#!/bin/bash

# Test Hugging Face Speaker Diarization Endpoint

echo "🎤 Testing Hugging Face Speaker Diarization..."

# Hugging Face Inference Endpoint (STABLE VERSION - pyannote.audio 3.1.1)
ENDPOINT="https://xr8h7vvrrtja455d.us-east-1.aws.endpoints.huggingface.cloud"

# Local audio file path
AUDIO_FILE="./audio/audio-converted.wav"

# Check if file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo "❌ Audio file not found: $AUDIO_FILE"
    exit 1
fi

echo "✅ Audio file found: $(ls -lh $AUDIO_FILE | awk '{print $5}')"

# Test diarization endpoint
echo ""
echo "🚀 Calling Hugging Face diarization endpoint..."
echo "Endpoint: $ENDPOINT"
echo ""

# Encode audio to base64 and create JSON payload
echo "Encoding audio to base64..."
AUDIO_BASE64=$(base64 -i "$AUDIO_FILE")

echo "Creating JSON payload..."
cat > /tmp/diarization-payload.json <<EOF
{
  "inputs": "$AUDIO_BASE64"
}
EOF

echo "Sending request..."
RESPONSE=$(curl -X POST \
  -H "Authorization: Bearer $HF_TOKEN" \
  -H "Content-Type: application/json" \
  --data @/tmp/diarization-payload.json \
  "$ENDPOINT")

rm -f /tmp/diarization-payload.json

echo ""
echo "📊 Response type check..."
echo "$RESPONSE" | head -c 100
echo ""
echo ""

# Try to parse as JSON
if echo "$RESPONSE" | jq '.' > /dev/null 2>&1; then
    echo "✅ Valid JSON response!"
    
    # Check if it has error
    if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
        echo "❌ Error from endpoint:"
        echo "$RESPONSE" | jq '.error'
    elif echo "$RESPONSE" | jq -e '.segments' > /dev/null 2>&1; then
        # New format with "segments" key
        echo "📊 Speaker segments found:"
        echo "$RESPONSE" | jq '.segments[0:10]'
        echo ""
        TOTAL=$(echo "$RESPONSE" | jq '.segments | length')
        echo "Total segments: $TOTAL"
    else
        # Old format (direct array)
        echo "📊 First 5 segments:"
        echo "$RESPONSE" | jq '.[0:5]'
    fi
else
    echo "❌ Not JSON - checking if base64 audio..."
    echo "First 200 chars of response:"
    echo "$RESPONSE" | head -c 200
    echo ""
    
    # Check if it's a WAV file
    if echo "$RESPONSE" | base64 -d 2>/dev/null | head -c 4 | xxd | grep -q "5249 4646"; then
        echo "⚠️  Response is still a base64-encoded WAV file!"
        echo "The endpoint handler needs to be updated."
    fi
fi

echo ""
echo "✅ Test complete"
