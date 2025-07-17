# Norwegian Transcription Worker Architecture

## Overview

The Norwegian Transcription Worker is a sophisticated audio processing system built on Cloudflare Workers that provides specialized transcription services for Norwegian language content. This system orchestrates a complete workflow from audio upload to enhanced transcription, leveraging both external Norwegian transcription services and Cloudflare's AI capabilities.

## System Architecture

### Core Components

1. **Norwegian Transcription Worker** (`norwegian-transcription-worker`)

   - Main orchestration service
   - Handles audio uploads to R2 storage
   - Coordinates with external transcription services
   - Manages AI-powered text enhancement

2. **Frontend Test Interface** (`/norwegian-transcription-test`)

   - Vue.js-based testing interface
   - Real-time audio recording capabilities
   - Drag-and-drop file upload
   - Progress tracking for long audio processing

3. **External Services Integration**
   - Hetzner-hosted Norwegian transcription service
   - Cloudflare Workers AI for text enhancement
   - R2 storage for temporary audio files

### Service Endpoints

#### Health Check

```http
GET /health
```

Returns comprehensive service status and configuration:

```json
{
  "status": "healthy",
  "service": "Norwegian Transcription Worker",
  "version": "2.0.0",
  "features": ["transcription", "text_improvement", "upload"],
  "endpoints": {
    "transcribe": "/ (POST)",
    "upload": "/upload (POST)",
    "health": "/health (GET)"
  }
}
```

#### Audio Upload

```http
POST /upload
Content-Type: audio/*
X-File-Name: filename.wav
```

Uploads audio files to R2 with automatic format detection:

- **Supported formats**: WAV, MP3, M4A, FLAC, WebM
- **Storage**: Cloudflare R2 with timestamped keys
- **Response**: Audio URL for subsequent transcription

#### Norwegian Transcription

```http
POST /transcribe-from-url
Content-Type: application/json
{
  "audioUrl": "https://audio.vegvisr.org/path/to/audio.wav"
}
```

#### Direct Transcription (Main Endpoint)

```http
POST /
Content-Type: multipart/form-data
- audio: [audio file]
- model: "nb-whisper-small"
- context: "Optional context for AI enhancement"
```

## Technical Implementation

### Audio Processing Pipeline

1. **Upload Phase**

   - Validates audio format and file size
   - Generates timestamped R2 key: `norwegian-audio/2024-01-15T10-30-00-000Z-filename.wav`
   - Stores with metadata for service tracking

2. **Format Detection**

   - Automatic content type detection from file headers
   - Supports multiple audio formats with proper MIME type handling
   - Filename correction for optimal transcription service compatibility

3. **Transcription Phase**

   - Calls external Norwegian transcription service at `https://transcribe.vegvisr.org/transcribe`
   - Sends FormData with audio file and language code (`no`)
   - Includes API token authentication for service access

4. **Enhancement Phase**
   - Uses Cloudflare Workers AI (Llama 3.3 70B Fast) for text improvement
   - Processes raw transcription with contextual understanding
   - Returns both raw and enhanced text versions

### Chunked Processing for Large Files

The system implements intelligent chunking for audio files longer than 5 minutes:

1. **Audio Analysis**

   - Calculates duration before processing
   - Automatic chunk determination (30-second segments)
   - Progress tracking with real-time updates

2. **Parallel Processing**

   - Sequential chunk processing with status updates
   - Individual chunk transcription and enhancement
   - Combines results into complete transcription

3. **Error Handling**
   - Chunk-level error recovery
   - Partial results preservation
   - User-friendly progress indicators

### Advanced Features

#### Microphone Recording

- Real-time audio recording via WebRTC
- Automatic format conversion to WAV
- Duration tracking and file size monitoring
- Immediate transcription capability

#### Context-Aware AI Enhancement

The system accepts contextual information to improve transcription quality:

```
Example contexts:
- "Therapy session about somatic therapy and trauma work"
- "Business meeting about software development and agile methods"
- "Academic lecture on psychology with research terminology"
- "Medical consultation with clinical terms"
```

#### Drag-and-Drop Interface

- Modern file upload with visual feedback
- Format validation before upload
- Audio preview capabilities
- Progress tracking for all operations

## Integration Architecture

### Service Dependencies

1. **External Norwegian Transcription Service**

   - **URL**: `https://transcribe.vegvisr.org/transcribe`
   - **Method**: POST with FormData
   - **Authentication**: X-API-Token header
   - **Format**: Audio file + language code

2. **Cloudflare Workers AI Binding**

   - **Service**: `env.NORWEGIAN_TEXT_WORKER`
   - **Model**: Llama 3.3 70B Fast
   - **Purpose**: Text enhancement and improvement

3. **R2 Storage**
   - **Bucket**: `norwegian-audio-temp`
   - **Domain**: `audio.vegvisr.org`
   - **Retention**: Temporary storage during processing

### API Response Format

#### Single File Response

```json
{
  "success": true,
  "transcription": {
    "raw_text": "Dette er en norsk transkripsjon av lydfilen.",
    "improved_text": "Dette er en norsk transkripsjon av lydfilen [AI-enhanced].",
    "language": "no",
    "chunks": 1,
    "processing_time": 1500,
    "improvement_time": 800
  },
  "metadata": {
    "filename": "audio.wav",
    "model": "nb-whisper-small",
    "total_processing_time": 2300,
    "transcription_server": "Hetzner",
    "text_improvement": "Cloudflare Workers AI - Llama 3.3 70B Fast",
    "cloudflare_ai_available": true
  }
}
```

#### Chunked Processing Response

```json
{
  "success": true,
  "transcription": {
    "raw_text": "[Combined text from all chunks]",
    "improved_text": "[AI-enhanced combined text]",
    "language": "no",
    "chunks": 12,
    "processing_time": 18000,
    "improvement_time": 4200
  },
  "chunk_details": [
    {
      "index": 0,
      "startTime": 0,
      "endTime": 30,
      "raw_text": "First chunk transcription...",
      "improved_text": "Enhanced first chunk...",
      "processingTime": 1500
    }
  ]
}
```

## Frontend Integration

### Vue.js Test Interface

The Norwegian Transcription Test view (`/norwegian-transcription-test`) provides:

1. **Service Health Monitoring**

   - Real-time service status checks
   - Endpoint availability verification
   - Configuration display

2. **File Upload Methods**

   - Drag-and-drop file selection
   - Traditional file picker
   - Microphone recording with WebRTC
   - Audio format validation

3. **Processing Visualization**

   - Progress bars for chunked processing
   - Real-time chunk completion updates
   - Processing time statistics
   - Error handling with retry options

4. **Results Display**
   - Side-by-side raw and enhanced text
   - Metadata information display
   - Audio playback controls
   - Portfolio save functionality

### Router Configuration

```javascript
{
  path: '/norwegian-transcription-test',
  name: 'norwegian-transcription-test',
  component: () => import('../views/NorwegianTranscriptionTest.vue'),
  meta: { layout: null }
}
```

## Performance Optimization

### Processing Strategies

1. **Small Files (< 5 minutes)**

   - Direct single-file processing
   - Immediate transcription and enhancement
   - Minimal overhead

2. **Large Files (> 5 minutes)**

   - Automatic chunking into 30-second segments
   - Sequential processing with progress updates
   - Memory-efficient handling

3. **Real-time Recording**
   - WebRTC audio capture
   - Immediate processing upon stop
   - Format optimization for transcription

### Error Handling

1. **Network Resilience**

   - Retry logic for failed requests
   - Partial result preservation
   - User-friendly error messages

2. **Format Validation**

   - MIME type checking
   - File extension validation
   - Audio format compatibility

3. **Service Availability**
   - Health check integration
   - Fallback processing options
   - Status monitoring

## Security Considerations

### Authentication

- API token-based authentication for external services
- Secure service-to-service communication
- Environment variable protection

### Data Privacy

- Temporary R2 storage with automatic cleanup
- No permanent audio file retention
- Metadata anonymization

### CORS Configuration

- Proper cross-origin request handling
- Frontend integration security
- API endpoint protection

## Deployment and Configuration

### Environment Variables

```toml
[env.production]
vars = {
  ACCOUNT_ID = "your-cloudflare-account-id",
  TRANSCRIPTION_API_TOKEN = "your-hetzner-api-token"
}

[[env.production.r2_buckets]]
binding = "NORWEGIAN_AUDIO_BUCKET"
bucket_name = "norwegian-audio-temp"

[[env.production.services]]
binding = "NORWEGIAN_TEXT_WORKER"
service = "norwegian-text-worker"
```

### Custom Domain Setup

```bash
# Map worker to custom domain
wrangler route put "norwegian-transcription.vegvisr.org/*" \
  --zone-id YOUR_ZONE_ID \
  --service norwegian-transcription-worker
```

## Usage Examples

### Frontend Integration

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

// Transcribe with context
const formData = new FormData()
formData.append('audio', audioFile)
formData.append('context', 'Therapy session about somatic therapy')

const result = await fetch('https://norwegian-transcription-worker.torarnehave.workers.dev/', {
  method: 'POST',
  body: formData,
})
```

### cURL Examples

```bash
# Health check
curl https://norwegian-transcription-worker.torarnehave.workers.dev/health

# Upload audio
curl -X POST \
  -H "Content-Type: audio/wav" \
  -H "X-File-Name: test.wav" \
  --data-binary @test.wav \
  https://norwegian-transcription-worker.torarnehave.workers.dev/upload

# Transcribe with context
curl -X POST \
  -F "audio=@test.wav" \
  -F "context=Academic lecture on psychology" \
  https://norwegian-transcription-worker.torarnehave.workers.dev/
```

## Related Components

### Backend Workers

- `norwegian-text-worker`: AI text enhancement service
- `whisper-worker`: English transcription service (similar architecture)
- `audio-portfolio-worker`: Audio file management

### Frontend Components

- `NorwegianTranscriptionTest.vue`: Main test interface
- `WhisperTestView.vue`: Comparable English transcription interface
- `AudioRecordingSelector.vue`: Reusable recording component

## Monitoring and Debugging

### Logging Strategy

- Comprehensive console logging at each processing stage
- Error tracking with stack traces
- Performance metrics collection
- User action tracking

### Health Monitoring

- Service availability checks
- External service connectivity
- R2 storage accessibility
- AI service responsiveness

### Performance Metrics

- Transcription processing time
- AI enhancement duration
- File upload speeds
- Chunk processing rates

## Future Enhancements

### Planned Features

1. **Real-time Streaming Transcription**

   - WebSocket support for live audio
   - Continuous processing capability
   - Low-latency response

2. **Multi-language Support**

   - Dynamic language detection
   - Configurable target languages
   - Language-specific AI models

3. **Advanced AI Features**

   - Sentiment analysis
   - Topic extraction
   - Speaker identification
   - Automatic summarization

4. **Enterprise Features**
   - User authentication
   - Usage analytics
   - Custom model training
   - Bulk processing APIs

## Conclusion

The Norwegian Transcription Worker represents a sophisticated audio processing pipeline that combines modern cloud infrastructure with specialized Norwegian language AI capabilities. Its architecture provides a scalable, reliable, and user-friendly solution for Norwegian audio transcription needs, with advanced features like contextual AI enhancement and intelligent chunking for large files.

The system demonstrates best practices in:

- Cloudflare Workers development
- R2 storage integration
- External service orchestration
- Vue.js frontend integration
- Progressive enhancement techniques
- Error handling and resilience

This architecture serves as a model for similar language-specific transcription services and showcases the power of combining multiple AI and cloud services into a cohesive user experience.
