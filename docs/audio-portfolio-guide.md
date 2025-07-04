# Audio Portfolio System Guide

## Overview

The Audio Portfolio System provides a comprehensive solution for managing audio recordings with AI-powered transcription capabilities. Users can organize, search, and manage their audio content with automatic transcription and metadata management.

## Features

### 🎤 Recording Management

- **Upload & Store**: Audio files are securely stored in Cloudflare R2
- **Transcription**: AI-powered transcription using OpenAI Whisper
- **Metadata**: Automatic extraction of file size, duration, and format information
- **Custom Naming**: Users can set custom display names for recordings

### 📊 Portfolio Interface

- **Card-based Layout**: Visual cards showing recording details
- **Audio Player**: Built-in audio player for each recording
- **Transcription Preview**: Quick excerpt view with full transcription modal
- **Search & Filter**: Powerful search across transcriptions, names, and tags

### 🏷️ Organization

- **Categories**: Organize recordings by type (Meeting, Interview, Notes, etc.)
- **Tags**: Add custom tags for better organization
- **Sorting**: Sort by date, name, duration, or category
- **Connected Graphs**: Track which knowledge graphs use the recording

### 🔍 Search Capabilities

- **Full-text Search**: Search within transcription text
- **Metadata Search**: Search by filename, category, or tags
- **Real-time Filtering**: Instant results as you type
- **Category Filtering**: Filter by specific categories

## System Architecture

### Backend (Cloudflare Workers)

- **whisper-worker**: Handles transcription and portfolio management
- **KV Storage**: User recordings stored in `env.AUDIO_PORTFOLIO` binding
- **R2 Storage**: Audio files stored in `env.WHISPER_BUCKET`

### Frontend (Vue.js)

- **AudioPortfolio.vue**: Main portfolio interface
- **GNewWhisperNode.vue**: Audio transcription component
- **Router Integration**: `/audio-portfolio` route

### Data Structure

```javascript
{
  id: "rec_1234567890_abcdefg",
  userEmail: "user@example.com",
  fileName: "meeting-recording.mp3",
  displayName: "Monday Team Meeting",
  r2Key: "audio/user@example.com/meeting-recording.mp3",
  r2Url: "https://pub-123.r2.dev/meeting-recording.mp3",
  fileSize: 5242880,
  estimatedDuration: 1800,
  transcription: {
    text: "Full transcription text...",
    excerpt: "First 200 characters...",
    service: "OpenAI API",
    model: "whisper-1",
    transcribedAt: "2025-01-20T10:30:00Z",
    language: "en"
  },
  metadata: {
    uploadedAt: "2025-01-20T10:25:00Z",
    tags: ["meeting", "team", "weekly"],
    category: "Meeting",
    connectedGraphIds: ["graph_123", "graph_456"],
    isTemporary: false
  }
}
```

## API Endpoints

### Portfolio Management

- `GET /audio-portfolio/list?userEmail={email}` - List user's recordings
- `POST /audio-portfolio/save` - Save new recording
- `PUT /audio-portfolio/update?userEmail={email}&recordingId={id}` - Update recording
- `DELETE /audio-portfolio/delete?userEmail={email}&recordingId={id}` - Delete recording
- `GET /audio-portfolio/search?userEmail={email}&q={query}` - Search recordings

### Audio Processing

- `POST /upload` - Upload audio file to R2
- `GET /transcribe?url={r2Url}&service=openai&model={model}&temperature={temp}` - Transcribe audio

## Usage Guide

### 1. Upload and Transcribe Audio

1. Navigate to the GNew Knowledge Graph Editor
2. Add an "Audio Transcription" node from the template sidebar
3. Configure transcription settings:
   - **Model**: Choose OpenAI model (whisper-1, gpt-4o-transcribe, etc.)
   - **Language**: Select language or use auto-detect
   - **Temperature**: Set accuracy level (0 = most accurate, 1 = most creative)
   - **Node Type**: Choose output format (fulltext, notes, worknote, actiontest)
4. Upload your audio file or record directly
5. Click "Transcribe Audio" - the system will:
   - Upload file to R2 storage
   - Transcribe using OpenAI API
   - Create a knowledge graph node
   - **Automatically save to your Audio Portfolio**

### 2. Manage Your Portfolio

1. Navigate to `/audio-portfolio` in your browser
2. View all your recordings in a card-based interface
3. Use the search bar to find specific recordings
4. Filter by category using the category buttons
5. Sort recordings by date, name, duration, or category

### 3. Edit Recording Details

1. Click the settings (⚙️) button on any recording card
2. Select "Edit" from the dropdown menu
3. Update:
   - **Display Name**: Custom name for the recording
   - **Category**: Organize by type (Meeting, Interview, Notes, etc.)
   - **Tags**: Add comma-separated tags for better organization
4. Click "Save" to update

### 4. View Full Transcriptions

1. Click "View Full Transcription" on any recording card
2. The modal will display:
   - Complete transcription text
   - Service and model information
   - Copy to clipboard functionality
3. Use the copy button to copy the full transcription text

### 5. Delete Recordings

1. Click the settings (⚙️) button on any recording card
2. Select "Delete" from the dropdown menu
3. Confirm deletion - this will:
   - Remove the recording from your portfolio
   - Delete the associated R2 file
   - Cannot be undone

## Integration with Knowledge Graphs

The Audio Portfolio system integrates seamlessly with the knowledge graph system:

- **Automatic Saving**: Every transcription automatically saves to your portfolio
- **Connected Graphs**: Track which graphs contain nodes from specific recordings
- **Cross-Reference**: From portfolio, see which graphs use specific recordings
- **Metadata Sync**: Changes to recording metadata can reflect in connected graphs

## Advanced Features

### Search Functionality

- **Text Search**: Search within transcription content
- **Metadata Search**: Search by filename, category, or tags
- **Boolean Search**: Use multiple terms for complex queries
- **Real-time Results**: Instant filtering as you type

### Category Management

- **Dynamic Categories**: Categories are automatically generated from your recordings
- **Custom Categories**: Create custom categories when editing recordings
- **Category Filtering**: Quick filter by clicking category buttons
- **Category Statistics**: See how many recordings in each category

### File Management

- **Secure Storage**: Files stored in Cloudflare R2 with secure access
- **Automatic Cleanup**: Deleted recordings also remove R2 files
- **File Size Tracking**: Monitor storage usage across recordings
- **Duration Estimation**: Automatic duration calculation from file size

## Troubleshooting

### Common Issues

**Portfolio Not Loading**

- Check that you're logged in with a valid email
- Verify the whisper-worker is deployed and accessible
- Check browser console for network errors

**Transcription Not Saving to Portfolio**

- Ensure KV binding `AUDIO_PORTFOLIO` is configured in worker
- Check that transcription completes successfully
- Verify user email is available in userStore

**Search Not Working**

- Check that recordings have been properly indexed
- Verify search terms are not too specific
- Try different search strategies (tags, categories, text)

### Worker Configuration

The whisper-worker needs these bindings in `wrangler.toml`:

```toml
# AI binding for transcription
[ai]
binding = "AI"

# R2 binding for audio files
[[r2_buckets]]
binding = "WHISPER_BUCKET"
bucket_name = "whisper-audio-temp"

# KV binding for portfolio storage
[[kv_namespaces]]
binding = "AUDIO_PORTFOLIO"
id = "your-audio-portfolio-kv-namespace-id"
```

**To set up the KV namespace:**

1. Create a new KV namespace in Cloudflare dashboard:

   ```bash
   wrangler kv:namespace create "AUDIO_PORTFOLIO"
   ```

2. Copy the namespace ID from the output and replace `your-audio-portfolio-kv-namespace-id` in wrangler.toml

3. For production environment, also create a preview namespace:

   ```bash
   wrangler kv:namespace create "AUDIO_PORTFOLIO" --preview
   ```

4. Update your wrangler.toml with both IDs:

   ```toml
   [[kv_namespaces]]
   binding = "AUDIO_PORTFOLIO"
   id = "your-production-namespace-id"
   preview_id = "your-preview-namespace-id"
   ```

5. Deploy the worker:
   ```bash
   wrangler deploy
   ```

## Future Enhancements

### Planned Features

- **Batch Operations**: Select multiple recordings for bulk operations
- **Export Options**: Export transcriptions in various formats
- **Sharing**: Share recordings with other users
- **Collaboration**: Multi-user access to recordings
- **Analytics**: Usage statistics and insights
- **Mobile App**: Dedicated mobile app for recording management

### Integration Possibilities

- **Calendar Integration**: Link recordings to calendar events
- **CRM Integration**: Connect recordings to customer records
- **Project Management**: Associate recordings with project tasks
- **Note-Taking Apps**: Sync transcriptions with note-taking applications

## Testing

Use the included test script to verify system functionality:

```bash
node test-audio-portfolio.js
```

The test script will:

- Create a test recording
- List recordings
- Search recordings
- Delete the test recording
- Verify all endpoints are working

---

**Last Updated**: January 20, 2025
**Version**: 1.0
**Author**: VEGVISR Development Team
