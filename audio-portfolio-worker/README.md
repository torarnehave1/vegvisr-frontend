# Audio Portfolio Worker

A separate Cloudflare Worker service for managing audio recording portfolios. This worker is independent from the whisper-worker to preserve functional code and ensure scalability.

## Architecture Strategy

This worker follows the principle of **DO NOT DISRUPT EXISTING CODE** by keeping portfolio functionality separate from the working whisper transcription system.

- **Whisper Worker**: Handles audio transcription (unchanged)
- **Audio Portfolio Worker**: Manages recording metadata and portfolios (new)
- **UI Integration**: Optional "Save to Portfolio" button in GNewWhisperNode.vue

## API Endpoints

### Health Check

- **GET** `/health` - Check service health and KV binding status

### Portfolio Management

- **POST** `/save-recording` - Save recording metadata to portfolio
- **GET** `/list-recordings?userEmail=...` - Get user's recordings
- **GET** `/search-recordings?userEmail=...&query=...` - Search recordings
- **PUT** `/update-recording?userEmail=...&recordingId=...` - Update recording metadata
- **DELETE** `/delete-recording?userEmail=...&recordingId=...` - Delete recording

## Data Structure

### Recording Metadata

```json
{
  "userEmail": "user@example.com",
  "recordingId": "rec_1234567890_abcdef123",
  "fileName": "meeting_notes.wav",
  "displayName": "Team Meeting Notes",
  "r2Key": "audio/2025-01-20T10-15-30-123Z-meeting_notes.wav",
  "r2Url": "https://whisper-audio-temp.*.r2.cloudflarestorage.com/audio/...",
  "fileSize": 1024000,
  "duration": 180,
  "transcriptionText": "Full transcription text here...",
  "transcriptionExcerpt": "First 200 characters of transcription...",
  "tags": ["meeting", "project-alpha", "team"],
  "category": "business",
  "createdAt": "2025-01-20T10:15:30.123Z",
  "updatedAt": "2025-01-20T10:15:30.123Z",
  "audioFormat": "wav",
  "sampleRate": 16000,
  "channels": 1,
  "aiService": "openai",
  "aiModel": "whisper-1",
  "processingTime": 5.2
}
```

### User Index

```json
{
  "userEmail": "user@example.com",
  "totalRecordings": 5,
  "totalDuration": 900,
  "lastUpdated": "2025-01-20T10:15:30.123Z",
  "recordingIds": ["rec_1234567890_abcdef123", "rec_0987654321_xyz789"]
}
```

## KV Storage Keys

- **Recording**: `audio-recording:{userEmail}:{recordingId}`
- **User Index**: `audio-index:{userEmail}`

## Usage Example

### Save Recording to Portfolio

```javascript
const portfolioResponse = await fetch('https://audio-portfolio.vegvisr.org/save-recording', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userEmail: 'user@example.com',
    fileName: 'meeting.wav',
    displayName: 'Team Meeting',
    r2Key: 'audio/2025-01-20T10-15-30-123Z-meeting.wav',
    r2Url: 'https://whisper-audio-temp.*.r2.cloudflarestorage.com/audio/...',
    transcriptionText: 'Full transcription text...',
    fileSize: 1024000,
    duration: 180,
    tags: ['meeting', 'team'],
    category: 'business',
    aiService: 'openai',
    aiModel: 'whisper-1',
  }),
})
```

### List User Recordings

```javascript
const recordings = await fetch(
  'https://audio-portfolio.vegvisr.org/list-recordings?userEmail=user@example.com&limit=10',
)
```

### Search Recordings

```javascript
const searchResults = await fetch(
  'https://audio-portfolio.vegvisr.org/search-recordings?userEmail=user@example.com&query=meeting',
)
```

## Integration with GNewWhisperNode.vue

The UI integration should be implemented as an optional feature:

```vue
<!-- After successful transcription -->
<div v-if="transcriptionComplete" class="portfolio-actions">
  <button @click="saveToPortfolio" class="save-portfolio-btn">
    📁 Save to Portfolio
  </button>
</div>
```

## Deployment

```bash
cd audio-portfolio-worker
npm install
wrangler deploy
```

## Environment Variables

- **AUDIO_PORTFOLIO**: KV namespace binding (configured in wrangler.toml)

## Benefits of Separation

- ✅ **Transcription continues working** during portfolio development
- ✅ **Portfolio can be developed independently** without risk
- ✅ **Users can opt-in** to portfolio features
- ✅ **Rollback only affects new features** not existing functionality
- ✅ **Scalable architecture** allows multiple portfolio types
- ✅ **Testing isolation** - each system can be tested separately
