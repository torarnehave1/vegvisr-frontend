# Norwegian Audio Transcription Worker

A Cloudflare Worker that provides audio transcription services specifically for Norwegian language content.

## Overview

This worker acts as a bridge between the Vegvisr frontend and the Norwegian transcription service at `http://46.62.149.157/transcribe`. It handles audio file uploads, storage in R2, and coordinates transcription requests.

## Features

- ✅ **Audio Upload**: Secure upload to Cloudflare R2 storage
- ✅ **Norwegian Transcription**: Integration with Norwegian transcription service
- ✅ **Format Support**: WAV, MP3, M4A, FLAC audio formats
- ✅ **Error Handling**: Comprehensive error handling and logging
- ✅ **CORS Support**: Cross-origin requests from frontend
- ✅ **Health Monitoring**: Service health check endpoint

## API Endpoints

### Health Check

```
GET /health
```

Returns service status and configuration information.

### Audio Upload

```
POST /upload
Content-Type: audio/*
X-File-Name: filename.wav

[audio file binary data]
```

Uploads audio file to R2 storage and returns audio URL.

### Norwegian Transcription

```
POST /transcribe-norwegian
Content-Type: application/json

{
  "audioUrl": "https://norwegian-audio.vegvisr.org/path/to/audio.wav"
}
```

Or via query parameter:

```
GET /transcribe-norwegian?url=https://norwegian-audio.vegvisr.org/path/to/audio.wav
```

## Configuration Requirements

### Environment Variables

The worker requires these bindings in `wrangler.toml`:

```toml
name = "norwegian-transcription-worker"

[env.production]
vars = { ACCOUNT_ID = "your-cloudflare-account-id" }

[[env.production.r2_buckets]]
binding = "NORWEGIAN_AUDIO_BUCKET"
bucket_name = "norwegian-audio-temp"
```

### R2 Bucket Setup

1. Create R2 bucket named `norwegian-audio-temp`
2. Configure custom domain `norwegian-audio.vegvisr.org` (optional)
3. Set appropriate CORS policies for frontend access

## Deployment

### Prerequisites

- Cloudflare account with Workers and R2 enabled
- Wrangler CLI installed and configured
- R2 bucket created and configured

### Deploy Commands

```bash
cd norwegian-transcription-worker
wrangler deploy
```

### Custom Domain Setup

```bash
# Map worker to custom domain
wrangler route put "norwegian-transcription.vegvisr.org/*" \
  --zone-id YOUR_ZONE_ID \
  --service norwegian-transcription-worker
```

## Usage

### Frontend Integration

The Norwegian transcription test interface is available at:

```
https://vegvisr.org/norwegian-transcription-test
```

### Programmatic Usage

```javascript
// Upload audio file
const uploadResponse = await fetch(
  'https://norwegian-transcription-worker.torarnehave.workers.dev/upload',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'audio/wav',
      'X-File-Name': 'audio.wav',
    },
    body: audioBlob,
  },
)

const { audioUrl } = await uploadResponse.json()

// Transcribe with Norwegian service
const transcribeResponse = await fetch(
  `https://norwegian-transcription-worker.torarnehave.workers.dev/transcribe-norwegian?url=${encodeURIComponent(audioUrl)}`,
)

const result = await transcribeResponse.json()
console.log('Norwegian transcription:', result.text)
```

## Response Format

### Upload Response

```json
{
  "success": true,
  "audioUrl": "https://norwegian-audio.vegvisr.org/norwegian-audio/2024-01-15T10-30-00-000Z-audio.wav",
  "r2Key": "norwegian-audio/2024-01-15T10-30-00-000Z-audio.wav",
  "fileName": "audio.wav",
  "size": 1234567,
  "contentType": "audio/wav",
  "message": "Audio uploaded successfully"
}
```

### Transcription Response

```json
{
  "success": true,
  "text": "Dette er en norsk transkripsjon av lydfilen.",
  "transcription": {
    "text": "Dette er en norsk transkripsjon av lydfilen."
    // Additional transcription metadata from Norwegian service
  },
  "language": "no",
  "service": "Norwegian Transcription Service",
  "metadata": {
    "fileSize": 1234567,
    "fileName": "audio.wav",
    "processedAt": "2024-01-15T10:30:00.000Z",
    "service": "Norwegian Transcription Service",
    "endpoint": "http://46.62.149.157/transcribe",
    "language": "Norwegian"
  }
}
```

## Architecture

### Request Flow

1. **Frontend Upload**: User selects audio file in test interface
2. **Worker Upload**: File uploaded to R2 via `/upload` endpoint
3. **R2 Storage**: Audio stored with timestamped key
4. **Transcription Request**: Frontend calls `/transcribe-norwegian` with R2 URL
5. **Audio Retrieval**: Worker downloads audio from R2
6. **Norwegian Service**: Worker calls external Norwegian transcription service
7. **Response**: Transcribed text returned to frontend

### Integration Points

- **External Service**: `http://46.62.149.157/transcribe`
- **Storage**: Cloudflare R2 bucket
- **Frontend**: Vue.js test interface at `/norwegian-transcription-test`

## Testing

### Health Check

```bash
curl https://norwegian-transcription-worker.torarnehave.workers.dev/health
```

### File Upload Test

```bash
curl -X POST https://norwegian-transcription-worker.torarnehave.workers.dev/upload \
  -H "Content-Type: audio/wav" \
  -H "X-File-Name: test.wav" \
  --data-binary @test.wav
```

### Integration Test

Visit the test interface:

```
https://vegvisr.org/norwegian-transcription-test
```

## Error Handling

The worker includes comprehensive error handling for:

- Invalid audio formats
- Missing required parameters
- R2 storage errors
- Norwegian service connectivity issues
- Network timeouts

All errors are logged with appropriate detail levels and return structured error responses.

## Related Components

- **Frontend**: `src/views/NorwegianTranscriptionTest.vue`
- **Router**: Route `/norwegian-transcription-test`
- **Base Architecture**: Based on `whisper-worker/index.js` patterns

## Monitoring

Monitor worker performance and errors through:

- Cloudflare Workers dashboard
- Real-time logs via `wrangler tail`
- Health check endpoint status
- R2 bucket metrics

## Notes

- Audio files are stored temporarily in R2 during processing
- Norwegian language code is hardcoded as `'no'`
- Service follows established Vegvisr audio processing patterns
- No authentication required for testing interface
- Production deployment requires proper domain configuration
