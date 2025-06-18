# CURL Commands for Custom Domain Setup

## Environment Variables

First, set your environment variables:

```bash
# Your Cloudflare API Token (needs Zone:Edit and Workers:Edit permissions)
export CF_API_TOKEN="your_cloudflare_api_token_here"

# Zone IDs from your mapping
export NORSEGONG_ZONE_ID="e577205b812b49d012af046535369808"
export XYZVIBE_ZONE_ID="602067f0cf860426a35860a8ab179a47"
```

## 1. Create DNS Record for norsegong.com subdomain

```bash
# Example: Create subdomain "test.norsegong.com"
curl -X POST "https://api.cloudflare.com/client/v4/zones/${NORSEGONG_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "test.norsegong.com",
    "content": "brand-worker.torarnehave.workers.dev",
    "proxied": true
  }'
```

## 2. Create DNS Record for xyzvibe.com subdomain

```bash
# Example: Create subdomain "test.xyzvibe.com"
curl -X POST "https://api.cloudflare.com/client/v4/zones/${XYZVIBE_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "test.xyzvibe.com",
    "content": "brand-worker.torarnehave.workers.dev",
    "proxied": true
  }'
```

## 3. Create Worker Route for norsegong.com

```bash
# Create worker route for norsegong.com subdomain
curl -X POST "https://api.cloudflare.com/client/v4/zones/${NORSEGONG_ZONE_ID}/workers/routes" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "pattern": "test.norsegong.com/*",
    "script": "brand-worker"
  }'
```

## 4. Create Worker Route for xyzvibe.com

```bash
# Create worker route for xyzvibe.com subdomain
curl -X POST "https://api.cloudflare.com/client/v4/zones/${XYZVIBE_ZONE_ID}/workers/routes" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "pattern": "test.xyzvibe.com/*",
    "script": "brand-worker"
  }'
```

## 5. Test Using the API Endpoint

```bash
# Test creating a subdomain via your API (norsegong.com)
curl -X POST "https://api.vegvisr.org/create-custom-domain" \
  -H "Content-Type: application/json" \
  --data '{
    "subdomain": "test",
    "rootDomain": "norsegong.com"
  }'

# Test creating a subdomain via your API (xyzvibe.com)
curl -X POST "https://api.vegvisr.org/create-custom-domain" \
  -H "Content-Type: application/json" \
  --data '{
    "subdomain": "test",
    "rootDomain": "xyzvibe.com"
  }'
```

## 6. List Existing DNS Records (for debugging)

```bash
# List DNS records for norsegong.com
curl -X GET "https://api.cloudflare.com/client/v4/zones/${NORSEGONG_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json"

# List DNS records for xyzvibe.com
curl -X GET "https://api.cloudflare.com/client/v4/zones/${XYZVIBE_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json"
```

## 7. List Existing Worker Routes (for debugging)

```bash
# List worker routes for norsegong.com
curl -X GET "https://api.cloudflare.com/client/v4/zones/${NORSEGONG_ZONE_ID}/workers/routes" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json"

# List worker routes for xyzvibe.com
curl -X GET "https://api.cloudflare.com/client/v4/zones/${XYZVIBE_ZONE_ID}/workers/routes" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json"
```

## Common Issues and Troubleshooting

### 1. API Token Permissions

Your CF_API_TOKEN needs these permissions:

- Zone:Edit (for DNS records)
- Workers:Edit (for worker routes)
- Zone Resources: Include all zones or specific zones

### 2. Worker Script Name

Make sure your worker script is named exactly "brand-worker" in Cloudflare dashboard, or update the script name in the commands above.

### 3. Check Zone IDs

Verify your zone IDs are correct:

```bash
# List all your zones to verify IDs
curl -X GET "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json"
```

### 4. Check Worker Scripts

List your worker scripts:

```bash
# List all worker scripts
curl -X GET "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/workers/scripts" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json"
```

## Testing the Setup

After creating the DNS record and worker route, test your subdomain:

```bash
# Test if the subdomain resolves
curl -I "https://test.xyzvibe.com/"

# Check DNS resolution
nslookup test.xyzvibe.com

# Test with verbose output
curl -v "https://test.xyzvibe.com/"
```
