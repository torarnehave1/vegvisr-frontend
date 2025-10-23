# YouTube Worker API Endpoints

## Overview
The YouTube Worker now supports video upload, download (metadata), and channel management.

## Authentication Endpoints

### 1. Health Check
```bash
GET https://youtube.vegvisr.org/health
```

### 2. Start OAuth Flow
```bash
GET https://youtube.vegvisr.org/auth
```

### 3. Get User Credentials
```bash
POST https://youtube.vegvisr.org/credentials
Content-Type: application/json

{
  "user_email": "user@example.com"
}
```

## NEW Video Management Endpoints

### 4. Upload Video to YouTube
```bash
POST https://youtube.vegvisr.org/upload
Content-Type: multipart/form-data

Form Fields:
- user_email: string (required)
- video: file (required) 
- title: string (optional, default: "Untitled Video")
- description: string (optional)
- privacy: string (optional, default: "private") - values: private, unlisted, public
- tags: string (optional, comma-separated)
```

**Response:**
```json
{
  "success": true,
  "video_id": "dQw4w9WgXcQ",
  "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "My Video Title",
  "description": "Video description",
  "privacy_status": "private",
  "upload_status": "uploaded"
}
```

### 5. Get Video Information (Download Metadata)
```bash
POST https://youtube.vegvisr.org/download
Content-Type: application/json

{
  "user_email": "user@example.com",
  "video_id": "dQw4w9WgXcQ"
}
```
OR
```json
{
  "user_email": "user@example.com", 
  "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response:**
```json
{
  "success": true,
  "video_id": "dQw4w9WgXcQ",
  "title": "Video Title",
  "description": "Video description",
  "channel_title": "Channel Name",
  "duration": "PT3M33S",
  "view_count": "1000000",
  "like_count": "50000",
  "privacy_status": "public",
  "thumbnails": {...},
  "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "note": "For actual video file download, additional permissions and third-party tools may be required due to YouTube ToS"
}
```

### 6. Get User's Channel Videos
```bash
POST https://youtube.vegvisr.org/videos
Content-Type: application/json

{
  "user_email": "user@example.com",
  "max_results": 25,
  "page_token": "optional_pagination_token"
}
```

**Response:**
```json
{
  "success": true,
  "channel_id": "UCxxxxxxxxxxxxx",
  "total_results": 100,
  "results_per_page": 25,
  "next_page_token": "token_for_next_page",
  "videos": [
    {
      "video_id": "dQw4w9WgXcQ",
      "title": "Video Title",
      "description": "Video description",
      "published_at": "2023-01-01T00:00:00Z",
      "thumbnails": {...},
      "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ"
    }
  ]
}
```

## Usage Examples

### JavaScript Upload Example
```javascript
const formData = new FormData();
formData.append('user_email', 'user@example.com');
formData.append('video', videoFile);
formData.append('title', 'My Awesome Video');
formData.append('description', 'This is a great video!');
formData.append('privacy', 'unlisted');
formData.append('tags', 'tutorial,demo,awesome');

const response = await fetch('https://youtube.vegvisr.org/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Upload result:', result);
```

### JavaScript Download Example
```javascript
const response = await fetch('https://youtube.vegvisr.org/download', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    user_email: 'user@example.com',
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  })
});

const videoInfo = await response.json();
console.log('Video info:', videoInfo);
```

## Notes

1. **Authentication Required**: All video endpoints require valid YouTube credentials obtained through the OAuth flow.

2. **File Size Limits**: Video uploads are subject to Cloudflare Worker memory limits (~128MB) and YouTube API limits.

3. **Download Limitations**: The download endpoint provides metadata only. Actual video file downloads require additional tools due to YouTube's Terms of Service.

4. **Privacy Settings**: Uploaded videos default to "private" for security. Change to "unlisted" or "public" as needed.

5. **Rate Limits**: Subject to YouTube API quota limits and Cloudflare Worker request limits.

## Error Handling

All endpoints return consistent error responses:
```json
{
  "success": false,
  "error": "Error description",
  "needs_auth": true,
  "auth_url": "https://youtube.vegvisr.org/auth"
}
```