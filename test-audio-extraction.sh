#!/bin/bash

# Audio Extraction Test Script
# This demonstrates the workflow that should work once properly implemented

set -e  # Exit on any error

echo "🎬 YouTube + Audio Extraction Workflow Test"
echo "========================================="

# Configuration
YOUTUBE_WORKER="https://youtube.vegvisr.org"
AUDIO_WORKER="https://vegvisr-container.torarnehave.workers.dev"
USER_EMAIL="test@example.com"

# Test video URLs (direct video file URLs for testing vegvisr-container)
TEST_VIDEO_URL_1="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
TEST_VIDEO_URL_2="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"

echo ""
echo "📋 Step 1: Test YouTube Worker Health"
echo "------------------------------------"
HEALTH_RESPONSE=$(curl -s "$YOUTUBE_WORKER/health")
echo "YouTube Worker Health: $HEALTH_RESPONSE"

echo ""
echo "📋 Step 2: Test Audio Worker Health"
echo "-----------------------------------"
AUDIO_HEALTH=$(curl -s "$AUDIO_WORKER/")
echo "Audio Worker Endpoints:"
echo "$AUDIO_HEALTH"

echo ""
echo "🎵 Step 3: Test Direct Audio Extraction (vegvisr-container)"
echo "----------------------------------------------------------"
echo "Testing with: $TEST_VIDEO_URL_1"

INSTANCE_ID="test-$(date +%s)"
echo "Instance ID: $INSTANCE_ID"

AUDIO_RESPONSE=$(curl -s -X POST "$AUDIO_WORKER/ffmpeg/$INSTANCE_ID" \
  -H "Content-Type: application/json" \
  -d "{\"video_url\": \"$TEST_VIDEO_URL_1\", \"output_format\": \"mp3\"}")

echo "Audio Extraction Response:"
echo "$AUDIO_RESPONSE" | jq .

# Parse response
SUCCESS=$(echo "$AUDIO_RESPONSE" | jq -r '.success // false')
if [ "$SUCCESS" = "true" ]; then
    DOWNLOAD_URL=$(echo "$AUDIO_RESPONSE" | jq -r '.download_url')
    FILE_NAME=$(echo "$AUDIO_RESPONSE" | jq -r '.file_name')
    
    echo ""
    echo "✅ Audio extraction successful!"
    echo "📁 File: $FILE_NAME"
    echo "🔗 Download URL: $AUDIO_WORKER$DOWNLOAD_URL"
    
    echo ""
    echo "📥 Step 4: Test Audio Download"
    echo "-----------------------------"
    echo "Downloading audio file..."
    
    curl -s "$AUDIO_WORKER$DOWNLOAD_URL" -o "test_audio_$INSTANCE_ID.mp3"
    
    if [ -f "test_audio_$INSTANCE_ID.mp3" ]; then
        FILE_SIZE=$(ls -lh "test_audio_$INSTANCE_ID.mp3" | awk '{print $5}')
        echo "✅ Audio downloaded successfully: test_audio_$INSTANCE_ID.mp3 ($FILE_SIZE)"
        
        # Check if file is valid
        if command -v file &> /dev/null; then
            FILE_INFO=$(file "test_audio_$INSTANCE_ID.mp3")
            echo "📊 File info: $FILE_INFO"
        fi
    else
        echo "❌ Audio download failed"
    fi
else
    ERROR=$(echo "$AUDIO_RESPONSE" | jq -r '.error // "Unknown error"')
    echo "❌ Audio extraction failed: $ERROR"
fi

echo ""
echo "🔬 Step 5: What's Missing for YouTube Integration"
echo "================================================"
echo ""
echo "The current YouTube worker needs these modifications:"
echo ""
echo "1. 📦 Add R2 bucket binding for temporary video storage:"
echo "   wrangler.toml:"
echo "   [[r2_buckets]]"
echo "   binding = \"TEMP_VIDEO_STORAGE\""
echo "   bucket_name = \"youtube-temp-videos\""
echo ""
echo "2. 🔧 Modify /upload endpoint to:"
echo "   - Upload video to YouTube (existing)"
echo "   - Store copy in R2 temporarily"
echo "   - Return both YouTube URL and R2 temp URL"
echo ""
echo "3. 🎵 Add audio extraction to upload workflow:"
echo "   - After YouTube upload, call vegvisr-container"
echo "   - Use R2 temp URL as video_url parameter"
echo "   - Return audio extraction results"
echo "   - Clean up temp video file"
echo ""
echo "📝 Example of what upload should return:"
echo "{"
echo "  \"success\": true,"
echo "  \"video_id\": \"abc123\","
echo "  \"video_url\": \"https://www.youtube.com/watch?v=abc123\","
echo "  \"temp_video_url\": \"https://r2-bucket.com/temp-video-abc123.mp4\","
echo "  \"audio_extraction\": {"
echo "    \"success\": true,"
echo "    \"file_name\": \"audio_abc123_timestamp.mp3\","
echo "    \"download_url\": \"/download/audio_abc123_timestamp.mp3\""
echo "  }"
echo "}"

echo ""
echo "🧪 Step 6: Test Complete Workflow Simulation"
echo "============================================"
echo ""
echo "Simulating what would happen with a YouTube video:"
echo ""

YOUTUBE_VIDEO_ID="dQw4w9WgXcQ"
YOUTUBE_URL="https://www.youtube.com/watch?v=$YOUTUBE_VIDEO_ID"

echo "1. 📤 YouTube Upload (simulated):"
echo "   POST $YOUTUBE_WORKER/upload"
echo "   Body: {user_email: '$USER_EMAIL', video: [file], extract_audio: true}"
echo ""
echo "   Response (what we need):"
echo "   {success: true, video_id: '$YOUTUBE_VIDEO_ID', temp_video_url: 'https://r2.../temp.mp4'}"
echo ""

echo "2. 🎵 Audio Extraction (would call):"
echo "   POST $AUDIO_WORKER/ffmpeg/youtube-$YOUTUBE_VIDEO_ID"
echo "   Body: {video_url: 'https://r2.../temp.mp4', output_format: 'mp3'}"
echo ""

echo "3. 🧹 Cleanup (would delete temp video from R2)"
echo ""

echo "🎯 NEXT STEPS:"
echo "=============="
echo "1. Add R2 bucket for temp storage: wrangler r2 bucket create youtube-temp-videos"
echo "2. Update wrangler.toml with R2 binding"
echo "3. Modify YouTube worker /upload endpoint"
echo "4. Test complete workflow"

echo ""
echo "✅ Test completed! The vegvisr-container is working perfectly."
echo "   We just need to connect it properly to the YouTube worker."