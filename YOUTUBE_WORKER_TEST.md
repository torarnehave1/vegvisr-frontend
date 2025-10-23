# YouTube Worker Test Interface

## Access

The YouTube Worker Test interface is available at:
**`/youtube-worker-test`**

**Requirements:**
- ✅ User must be logged in
- ✅ User must have `Superadmin` role
- 🌐 Access at: `https://www.vegvisr.org/youtube-worker-test`

## Features

### 🏥 Health Monitoring
- **Worker Status**: Real-time health check of the YouTube worker
- **Authentication Status**: Shows current login state and credentials

### 🔐 Authentication Testing  
- **OAuth Flow**: Start YouTube authentication process
- **Credentials Check**: Verify stored YouTube credentials
- **Credentials Management**: Delete stored credentials

### 📤 Video Upload Testing
- **File Upload**: Test video file uploads to YouTube
- **Metadata Configuration**: Set title, description, privacy, tags
- **Upload Progress**: Visual progress indicator
- **Upload Results**: Display video ID, URL, and status

### 📥 Video Information Testing
- **Video Metadata**: Get comprehensive video information
- **URL Support**: Accept YouTube URLs or video IDs
- **Rich Display**: Show thumbnails, stats, descriptions

### 📺 Channel Management
- **Channel Videos**: List all videos from authenticated user's channel
- **Pagination**: Navigate through large video collections
- **Quick Actions**: Direct links to videos and info retrieval

### 🔧 Raw API Testing
- **Endpoint Testing**: Test any worker endpoint directly
- **Custom Payloads**: Send custom JSON requests
- **Response Inspection**: View raw API responses

## Usage Workflow

### 1. Initial Setup
1. Navigate to `/youtube-worker-test`
2. Enter your email address
3. Click "Start OAuth Flow" to authenticate with YouTube
4. Complete Google OAuth consent process
5. Return to the test interface (authentication status updates automatically)

### 2. Test Video Upload
1. Select a video file (common formats: MP4, MOV, AVI)
2. Configure metadata (title, description, privacy, tags)
3. Click "Upload Video"
4. Monitor upload progress
5. View results with YouTube URL

### 3. Test Video Information
1. Enter a YouTube URL or video ID
2. Click "Get Video Info"
3. View comprehensive video metadata and statistics

### 4. Test Channel Management
1. Set maximum results (10, 25, or 50)
2. Click "Get My Videos"
3. Browse your channel's videos
4. Use pagination for large collections

### 5. Raw API Testing
1. Select endpoint from dropdown
2. Modify JSON payload as needed
3. Click "Test API"
4. Inspect raw response data

## API Endpoints Tested

All endpoints from the YouTube Worker are available for testing:

- **`GET /health`** - Worker health check
- **`GET /auth`** - Start OAuth flow  
- **`POST /credentials`** - Get/check user credentials
- **`DELETE /credentials`** - Delete user credentials
- **`POST /upload`** - Upload video to YouTube
- **`POST /download`** - Get video information
- **`POST /videos`** - List channel videos
- **`GET /admin/users`** - List all authenticated users (admin only)

## File Size Limits

- **Video Upload**: Limited by Cloudflare Worker memory (~128MB)
- **Supported Formats**: MP4, MOV, AVI, WEBM, and other common video formats
- **Recommendation**: Use compressed videos for testing

## Error Handling

The interface provides comprehensive error handling:
- ❌ **Authentication Errors**: Clear messages for OAuth issues
- ❌ **Upload Errors**: Detailed feedback for upload failures  
- ❌ **API Errors**: Raw error responses for debugging
- ❌ **Network Errors**: Connection and timeout handling

## Security Notes

- 🔒 **Superadmin Only**: Interface restricted to superadmin users
- 🔒 **Secure Storage**: Credentials stored in Cloudflare KV
- 🔒 **OAuth2**: Industry-standard YouTube authentication
- 🔒 **CORS Enabled**: Cross-origin requests properly configured

## Development Testing

For local development:
1. Ensure YouTube Worker is deployed to `https://youtube.vegvisr.org`
2. Update Google OAuth origins to include `http://localhost:5173`
3. Access test interface at `http://localhost:5173/youtube-worker-test`

## Troubleshooting

### Common Issues:
1. **Authentication Failed**: Check Google OAuth configuration
2. **Upload Failed**: Verify file size and format
3. **Access Denied**: Ensure user has Superadmin role
4. **Worker Offline**: Check worker deployment status

### Debug Steps:
1. Check browser console for errors
2. Use "Raw API Testing" to test individual endpoints
3. Verify worker health with `/health` endpoint
4. Check network tab for request/response details

This test interface provides comprehensive testing capabilities for all YouTube Worker functionality! 🎬