#!/bin/bash
# Deploy norwegian-transcription-worker with diarization support

echo "🚀 Deploying norwegian-transcription-worker..."
cd "$(dirname "$0")"

# Deploy to Cloudflare Workers
npx wrangler deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Available endpoints:"
echo "  - POST /diarize-audio - Speaker diarization (NEW)"
echo "  - POST /upload - Upload audio"
echo "  - POST /transcribe-from-url - Transcribe from R2"
echo "  - GET /health - Health check"
echo ""
echo "🧪 Test diarization:"
echo "  curl -X POST https://norwegian-transcription-worker.torarnehave.workers.dev/health | jq"
