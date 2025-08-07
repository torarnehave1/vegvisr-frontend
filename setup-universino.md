# Setup Guide for universi.no Domain

## Overview

This guide will help you set up `universi.no` as a fully functional custom domain in the Vegvisr branding system with affiliate support, DNS management, and automated subdomain creation.

## Prerequisites

- Domain `universi.no` is already proxied through Cloudflare
- You have access to Cloudflare API with Zone management permissions
- Access to the Vegvisr codebase and worker deployment capabilities

## Step 1: Configure Domain in API Worker

### 1.1 Add Zone ID to Domain Mapping

Add `universi.no` to the domain zone mapping in `api-worker/index.js`:

```javascript
// Domain to Zone ID mapping configuration
const DOMAIN_ZONE_MAPPING = {
  'norsegong.com': 'ZONE_ID_HERE',
  'xyzvibe.com': 'ZONE_ID_HERE',
  'vegvisr.org': 'ZONE_ID_HERE',
  'slowyou.training': 'ZONE_ID_HERE',
  'movemetime.com': 'ZONE_ID_HERE',
  'universi.no': 'YOUR_UNIVERSI_NO_ZONE_ID_HERE', // universi.no zone ID
}
```

**To find your Zone ID:**

1. Go to Cloudflare Dashboard
2. Select `universi.no` domain
3. Copy the Zone ID from the right sidebar

### 1.2 Configure Protected Subdomains

Add protected subdomains configuration:

```javascript
const PROTECTED_SUBDOMAINS = {
  'vegvisr.org': [
    'api',
    'www',
    'admin',
    'mail',
    'blog',
    'knowledge',
    'auth',
    'brand',
    'dash',
    'dev',
    'test',
    'staging',
    'cdn',
    'static',
  ],
  'norsegong.com': ['www', 'api', 'mail', 'admin', 'blog', 'cdn', 'static'],
  'xyzvibe.com': ['www', 'api', 'mail', 'admin', 'blog', 'cdn', 'static'],
  'slowyou.training': ['www', 'api', 'mail', 'admin', 'blog', 'cdn', 'static'],
  'movemetime.com': ['www', 'api', 'mail', 'admin', 'blog', 'cdn', 'static'],
  'universi.no': ['www', 'api', 'mail', 'admin', 'blog', 'cdn', 'static'],
}
```

## Step 2: Update Branding Modal Configuration

### 2.1 Add to Known Domains List

Add `universi.no` to the known domains in `src/components/BrandingModal.vue`:

```javascript
// In the loadExistingDomains method, add to knownDomains array:
knownDomains = [
  'vegvisr.norsegong.com',
  'movemetime.com',
  'www.movemetime.com',
  'universi.no',
  'www.universi.no',
]
```

## Step 3: DNS Configuration (Using Existing brand-worker)

### 3.1 Set Up DNS Records

Following the same pattern as `movemetime.com`, configure these DNS records in Cloudflare for `universi.no`:

**Root Domain Record:**

```
Type: Worker
Name: universi.no (or @)
Worker: brand-worker
Proxy: Yes (Orange Cloud)
```

**WWW Subdomain Record:**

```
Type: CNAME
Name: www
Content: brand-worker.torarnehave.workers.dev
Proxy: Yes (Orange Cloud)
```

**Wildcard Subdomain Record (for future subdomains):**

```
Type: CNAME
Name: *
Content: brand-worker.torarnehave.workers.dev
Proxy: Yes (Orange Cloud)
```

### 3.2 Verify DNS Setup

Your DNS records should look like this (similar to movemetime.com):

| Type   | Name        | Content                              | Proxy Status |
| ------ | ----------- | ------------------------------------ | ------------ |
| Worker | universi.no | brand-worker                         | Proxied      |
| CNAME  | www         | brand-worker.torarnehave.workers.dev | Proxied      |
| CNAME  | \*          | brand-worker.torarnehave.workers.dev | Proxied      |

## Step 4: Test Domain Configuration

### 4.1 Test Domain Access

Test that the domain is working with the existing brand-worker:

```bash
# Test main domain
curl -I https://universi.no

# Test www subdomain
curl -I https://www.universi.no

# Check that the x-original-hostname header is being set correctly
curl -H "Accept: application/json" https://universi.no/api/status
```

### 4.2 Test Automatic Subdomain Creation

Use the following curl command to test subdomain creation:

```bash
curl -X POST "https://api.vegvisr.org/create-custom-domain" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "subdomain": "test.universi.no"
  }'
```

### 4.3 Test Affiliate System Integration

Create a test file `test-affiliate-universi.js`:

```javascript
const payload = {
  recipientEmail: 'test@universi.no',
  recipientName: 'Test User',
  senderName: 'Admin',
  siteName: 'universi.no',
  commissionType: 'percentage',
  commissionRate: 15,
  domain: 'universi.no',
  dealName: 'universi-education',
}

fetch('https://universi.no/send-affiliate-invitation', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer YOUR_API_TOKEN',
  },
  body: JSON.stringify(payload),
})
  .then((response) => response.json())
  .then((data) => console.log('Success:', data))
  .catch((error) => console.error('Error:', error))
```

## Step 5: Configure Custom Branding

### 5.1 Set Up Domain Branding in User Dashboard

1. Log into your Vegvisr dashboard
2. Go to **Custom Domain Branding** section
3. Click **Add New Domain**
4. Configure:
   - **Domain**: `universi.no`
   - **Logo**: Upload your Universi logo
   - **Content Filter**: Choose appropriate categories
   - **Front Page**: Set custom knowledge graph if needed

### 5.2 Example Branding Configuration

```javascript
{
  "domainConfigs": [
    {
      "domain": "universi.no",
      "logo": "https://your-cdn.com/universi-logo.png",
      "contentFilter": "custom",
      "selectedCategories": ["EDUCATION", "UNIVERSITY", "RESEARCH"],
      "frontPage": "/gnew-viewer?graphId=your-education-graph-id"
    }
  ]
}
```

## Step 6: Update brand-worker Custom Domains (Optional)

### 6.1 Add Custom Domain to brand-worker

If you want to add `universi.no` as a custom domain to the brand-worker (like you may have done with other domains), you can add it to the worker's custom domains list in the Cloudflare dashboard:

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Select **brand-worker**
3. Go to **Settings** → **Custom Domains**
4. Add `universi.no` and `www.universi.no`

This step is optional since the DNS Worker/CNAME setup should work fine.

## Step 7: Test the Setup

### 7.1 Verify Domain Functionality

1. **Main Domain**: Visit `https://universi.no` - should show Vegvisr with custom branding
2. **WWW**: Visit `https://www.universi.no` - should work identically
3. **Subdomain**: Create `https://test.universi.no` via API and test access
4. **API**: Test affiliate invitation endpoints
5. **Branding**: Verify custom logo and site title appear correctly

### 7.2 Check DNS Propagation

```bash
# Verify DNS propagation
nslookup universi.no
nslookup www.universi.no

# Test that requests reach the brand-worker
curl -I https://universi.no
```

## Step 8: Integration with Affiliate System

### 8.1 Update Documentation

Add `universi.no` to your affiliate system documentation as a supported domain:

```markdown
### Supported Domains for Branding

- vegvisr.org (default)
- norsegong.com
- xyzvibe.com
- slowyou.training
- movemetime.com
- universi.no
```

### 8.2 Test Affiliate Flow

1. Send affiliate invitation from `universi.no`
2. Verify email contains correct branding
3. Test affiliate registration process
4. Confirm dashboard shows correct domain association

## Troubleshooting

### Common Issues

1. **Zone ID Not Found**: Verify the Zone ID is correct in DOMAIN_ZONE_MAPPING
2. **Worker Not Responding**: Check worker deployment and routes
3. **Branding Not Applied**: Verify KV store contains site configuration
4. **Subdomain Creation Fails**: Check API permissions and protected subdomain list

### Debug Commands

```bash
# Check brand-worker logs (since universi.no uses brand-worker)
wrangler tail brand-worker

# Test API endpoint
curl -I https://universi.no/api/status

# Verify DNS propagation
nslookup universi.no

# Test that original hostname is preserved
curl -v https://universi.no/ 2>&1 | grep -i "x-original-hostname"
```

## Security Considerations

1. **Protected Subdomains**: Ensure critical subdomains (api, admin, mail) are protected
2. **API Authentication**: Use proper Bearer tokens for API calls
3. **CORS Configuration**: Verify CORS settings for cross-origin requests
4. **Rate Limiting**: Consider implementing rate limiting for affiliate endpoints

## Next Steps

1. Configure the DNS records as specified in Step 3
2. Update the code configuration in Steps 1 and 2
3. Test all endpoints thoroughly using Step 4 tests
4. Configure custom branding in the dashboard
5. Set up monitoring and logging
6. Document any domain-specific customizations
7. Train users on the new domain capabilities

## Support

For issues with this setup:

1. Check brand-worker logs (since universi.no routes through it)
2. Verify DNS propagation with `nslookup`
3. Test API endpoints with curl
4. Review KV store entries for domain configuration
5. Check that `x-original-hostname` header is being set correctly
6. Contact the development team with specific error messages

---

**Note**: This setup uses the existing `brand-worker` infrastructure, following the same pattern as `movemetime.com`. No separate worker deployment is needed.
