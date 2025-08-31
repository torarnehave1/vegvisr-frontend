# 🚀 Cloudflare Worker Image Proxy Setup

## Problem Solved
Google Earth images in KML files are blocked by CORS when accessed from web browsers. This Cloudflare Worker acts as a proxy to bypass these restrictions.

## Quick Deployment Steps

### 1. **Create the Worker**
```bash
# Navigate to Cloudflare Dashboard > Workers & Pages > Create Application > Create Worker
# Name it: image-proxy
# Replace default code with image-proxy-worker.js content
```

### 2. **Deploy Configuration**
```
Worker Name: image-proxy
Route: image-proxy.torarnehave.workers.dev
```

### 3. **Update MapViewer**
The MapViewer.vue has been updated to use:
```
https://image-proxy.torarnehave.workers.dev/?url=[encoded-google-earth-url]
```

## How It Works

### **Before (CORS Issue):**
```
Browser → Google Earth Image Server ❌ CORS Error
```

### **After (Worker Proxy):**
```
Browser → Cloudflare Worker → Google Earth Image Server ✅ Success
```

## Usage Example

```javascript
// Original Google Earth URL
const originalUrl = 'https://earth.usercontent.google.com/hostedimage/...'

// Proxied URL (bypasses CORS)
const proxiedUrl = `https://image-proxy.torarnehave.workers.dev/?url=${encodeURIComponent(originalUrl)}`
```

## Worker Features

✅ **CORS Headers**: Adds proper Access-Control-Allow-Origin headers  
✅ **Security**: Only allows Google Earth image URLs  
✅ **Caching**: 24-hour cache for performance  
✅ **Error Handling**: Graceful fallbacks for failed requests  
✅ **Fast**: Uses Cloudflare's global edge network  

## Test the Worker

After deployment, test with:
```bash
curl "https://image-proxy.torarnehave.workers.dev/?url=https%3A//earth.usercontent.google.com/hostedimage/..."
```

## Alternative Domains

If you prefer a custom domain:
1. Set up a custom domain in Cloudflare Workers
2. Update the proxy URL in MapViewer.vue
3. Example: `https://images.vegvisr.org/?url=...`

## Cost

- **Free Tier**: 100,000 requests/day
- **Paid**: $5/month for 10M requests
- Perfect for image proxying needs

## Security Notes

- Only allows `earth.usercontent.google.com` domains
- Validates URLs before proxying
- No logging of image content
- Standard Cloudflare security features

## Expected Results

After deployment:
1. Go to your map with Glunka KML
2. Click "Start og Slutt" marker
3. Image should now display properly! 🎉

The worker eliminates the CORS issue completely and provides a professional solution for displaying Google Earth images in your maps.
