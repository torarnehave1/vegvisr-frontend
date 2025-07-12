# Custom Domain Setup Guide for Vegvisr.org Platform

## 📋 Overview

This guide provides comprehensive instructions for setting up custom domains with the Vegvisr platform. It covers both automated setup for supported domains and manual configuration for custom root domains.

## 🏗️ System Architecture

### Data Flow

```
User Request → DNS → Brand-Worker → KV Store → Backend Worker → Response
     ↓              ↓         ↓           ↓           ↓
  custom.domain   Hostname  Site Config  Content   Branded
                 Detection  Lookup       Filtering  Response
```

### Technical Components

#### **Frontend:**

- `BrandingModal.vue` - Domain configuration interface
- `useBranding.js` - Domain detection & branding logic
- `useContentFilter.js` - Content filtering composable

#### **Backend:**

- `main-worker` - Central API, SQL database, KV store sync
- `api-worker` - DNS/worker route automation
- `brand-worker` - Domain proxy with hostname preservation
- `dev-worker` - Content filtering & graph serving

#### **Storage:**

- SQL Database - User profiles with domainConfigs array
- KV Store - Fast site configuration retrieval (`site-config:domain.com`)

#### **Infrastructure:**

- Cloudflare DNS - Domain resolution
- Cloudflare Workers - Request routing
- Cloudflare KV - Configuration storage

## 🔍 Domain Compatibility Analysis

### **Supported Root Domains (Automated Setup)**

The system has built-in support for these domains:

- `norsegong.com`
- `xyzvibe.com`
- `vegvisr.org`
- `slowyou.training`

### **Custom Root Domains (Manual Setup Required)**

Any domain not in the supported list requires manual configuration or system extension.

### **Domain Types**

- **Subdomain Setup**: `subdomain.supporteddomain.com` (automated)
- **Custom Root Domain**: `www.yourdomain.com` (manual)
- **Full Custom Domain**: `yourdomain.com` (manual)

## 📝 Setup Options

### Option 1: Automated Setup (Supported Domains Only)

For domains like `subdomain.xyzvibe.com`:

1. **Configure in User Dashboard**

   - Go to User Dashboard → Custom Domain Branding
   - Click "Add New Domain"
   - Enter your subdomain (e.g., `mysite.xyzvibe.com`)
   - Configure logo, content filtering, front page
   - Click "Test Domain Setup" to verify
   - Save configuration

2. **Automatic Infrastructure**
   - DNS CNAME record created automatically
   - Worker route configured automatically
   - KV store updated automatically

### Option 2: Manual Setup (Custom Domains)

For custom domains like `www.yourdomain.com`:

## 📋 Manual Setup Guide

### **Phase 1: Prerequisites**

#### **Step 1: Gather Required Information**

- Your domain name (e.g., `www.yourdomain.com`)
- Cloudflare Zone ID for your domain
- Cloudflare API Token with DNS edit permissions

#### **Step 2: Get Cloudflare Zone ID**

1. Log into your Cloudflare dashboard
2. Select your domain
3. In the right sidebar, copy the **Zone ID**
4. Save this for later use

#### **Step 3: Get Cloudflare API Token**

1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Create token with permissions:
   - Zone:Edit for your domain
   - Workers:Edit (if using automated routes)

### **Phase 2: DNS Configuration**

#### **Step 1: Create DNS Record**

```bash
# Replace placeholders with your actual values
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/dns_records" \
  -H "Authorization: Bearer YOUR_CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "www.yourdomain.com",
    "content": "brand-worker.torarnehave.workers.dev",
    "proxied": true
  }'
```

#### **Step 2: Create Worker Route**

```bash
# Create worker route for your domain
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/workers/routes" \
  -H "Authorization: Bearer YOUR_CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "pattern": "www.yourdomain.com/*",
    "script": "brand-worker"
  }'
```

#### **Step 3: Verify DNS Propagation**

```bash
# Test DNS resolution
nslookup www.yourdomain.com

# Verify CNAME record
dig www.yourdomain.com

# Check if it points to Cloudflare
dig +trace www.yourdomain.com
```

### **Phase 3: System Configuration**

#### **Step 1: Configure Domain in User Dashboard**

1. Go to **User Dashboard** on Vegvisr
2. Open **Custom Domain Branding**
3. Click **Add New Domain**
4. Enter your domain: `www.yourdomain.com`
5. Configure settings:
   - **Logo**: Upload or enter URL for your logo
   - **Content Filter**:
     - `none` - Show all content
     - `custom` - Filter by specific categories
   - **Front Page**: Select a graph ID for custom landing page (optional)
   - **Menu Configuration**: Customize visible menu items
6. Click **Save Domain**

#### **Step 2: Verify Configuration Storage**

Test that your domain configuration is saved:

```bash
curl -s "https://vegvisr-frontend.torarnehave.workers.dev/site-config/www.yourdomain.com"
```

Expected response:

```json
{
  "domain": "www.yourdomain.com",
  "owner": "your-email@domain.com",
  "branding": {
    "mySite": "www.yourdomain.com",
    "myLogo": "https://your-logo-url.com/logo.png",
    "contentFilter": "none",
    "selectedCategories": [],
    "mySiteFrontPage": ""
  },
  "contentFilter": {
    "metaAreas": []
  },
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### **Phase 4: Testing & Verification**

#### **Test 1: Basic Connectivity**

```bash
# Test if site loads
curl -I "https://www.yourdomain.com"

# Should return 200 OK
```

#### **Test 2: Brand Worker Proxy**

```bash
# Test hostname preservation
curl -H "x-test-header: true" "https://www.yourdomain.com"

# Check for x-original-hostname header in response
```

#### **Test 3: Logo Display**

1. Visit `https://www.yourdomain.com`
2. Verify your custom logo appears in header
3. Check that site title is correct

#### **Test 4: Content Filtering (if configured)**

1. Navigate to Graph Portfolio
2. Verify only content from selected categories appears
3. Test search functionality with filtering

#### **Test 5: Custom Front Page (if configured)**

1. Visit your domain root
2. Should redirect to your specified graph
3. Verify graph loads correctly

## 🔧 System Extension (Advanced)

For frequently used custom domains, you can extend the system to support automated setup.

### **Step 1: Update DOMAIN_ZONE_MAPPING**

Edit `api-worker/index.js`:

```javascript
const DOMAIN_ZONE_MAPPING = {
  'norsegong.com': 'e577205b812b49d012af046535369808',
  'xyzvibe.com': '602067f0cf860426a35860a8ab179a47',
  'vegvisr.org': '9178eccd3a7e3d71d8ae09defb09422a',
  'slowyou.training': '1417691852abd0e8220f60184b7f4eca',
  'yourdomain.com': 'YOUR_DOMAIN_ZONE_ID', // Add your zone ID
}
```

### **Step 2: Add Protected Subdomains**

```javascript
const PROTECTED_SUBDOMAINS = {
  // ... existing domains ...
  'yourdomain.com': ['www', 'api', 'mail', 'admin', 'blog', 'cdn', 'static'],
}
```

### **Step 3: Deploy Updated Worker**

```bash
# Deploy the updated api-worker
wrangler deploy api-worker
```

### **Step 4: Use Automated API**

```bash
curl -X POST "https://api.vegvisr.org/create-custom-domain" \
  -H "Content-Type: application/json" \
  --data '{
    "subdomain": "www",
    "rootDomain": "yourdomain.com"
  }'
```

## 🚨 Troubleshooting

### **Common Issues & Solutions**

#### **1. DNS Not Resolving**

**Symptoms:**

- Domain doesn't load
- "Server not found" errors

**Solutions:**

- **Wait Time**: DNS propagation takes 5-10 minutes
- **Check Record**: Verify CNAME points to `brand-worker.torarnehave.workers.dev`
- **Clear Cache**: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
- **Test Tool**: Use https://dnschecker.org to verify global propagation

#### **2. Site Not Loading (DNS Resolves)**

**Symptoms:**

- DNS resolves but site shows errors
- 404 or 502 errors

**Solutions:**

- **Worker Route**: Ensure pattern is `yourdomain.com/*`
- **Script Name**: Verify route points to `brand-worker` script
- **SSL**: Check if SSL certificate is active in Cloudflare

#### **3. Logo Not Displaying**

**Symptoms:**

- Site loads but shows default Vegvisr logo
- Logo appears broken

**Solutions:**

- **KV Store**: Verify configuration saved using test command above
- **Image URL**: Ensure logo URL is publicly accessible
- **CORS**: Check if logo host allows cross-origin requests
- **Cache**: Clear browser cache and hard refresh (Ctrl+F5)

#### **4. Content Not Filtered Correctly**

**Symptoms:**

- All content shows despite filter settings
- Wrong content categories displayed

**Solutions:**

- **KV Config**: Check site-config contains correct metaAreas
- **Headers**: Verify `x-original-hostname` header is preserved
- **Backend**: Ensure backend workers read KV store correctly
- **Categories**: Verify selected categories exist in system

#### **5. Custom Front Page Not Working**

**Symptoms:**

- Domain loads default landing page
- Front page redirects to wrong graph

**Solutions:**

- **Graph ID**: Verify graph ID exists and is accessible
- **Validation**: Use graph validation in BrandingModal
- **Permissions**: Ensure graph is publicly accessible
- **URL Format**: Check front page URL format in configuration

### **Debug Commands**

#### **Check DNS Resolution**

```bash
# Basic lookup
nslookup yourdomain.com

# Detailed trace
dig +trace yourdomain.com

# Check specific record type
dig CNAME yourdomain.com
```

#### **Test API Endpoints**

```bash
# Test site configuration
curl -v "https://vegvisr-frontend.torarnehave.workers.dev/site-config/yourdomain.com"

# Test main logo fallback
curl -v "https://vegvisr-frontend.torarnehave.workers.dev/main-logo"

# Test graph existence (if using custom front page)
curl -v "https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraph?id=your_graph_id"
```

#### **Browser Developer Tools**

1. Open DevTools (F12)
2. **Network Tab**: Check for failed requests
3. **Console Tab**: Look for JavaScript errors
4. **Application Tab**: Check if site configuration is loaded

## ✅ Setup Checklist

### **Phase 1: Planning**

- [ ] Determine domain type (supported vs custom)
- [ ] Gather Cloudflare credentials
- [ ] Plan branding requirements (logo, colors, content filter)
- [ ] Prepare custom front page graph (optional)

### **Phase 2: DNS Setup** (Manual domains only)

- [ ] Get Cloudflare Zone ID
- [ ] Create CNAME record pointing to brand-worker
- [ ] Create worker route with correct pattern
- [ ] Wait for DNS propagation (5-10 minutes)
- [ ] Verify DNS resolution

### **Phase 3: System Configuration**

- [ ] Configure domain in User Dashboard
- [ ] Upload/set logo URL
- [ ] Configure content filtering
- [ ] Set custom front page (optional)
- [ ] Configure menu visibility
- [ ] Save configuration
- [ ] Verify KV store update

### **Phase 4: Testing**

- [ ] Test basic site loading
- [ ] Verify logo display
- [ ] Test content filtering (if configured)
- [ ] Test custom front page (if configured)
- [ ] Check mobile responsiveness
- [ ] Test from different browsers
- [ ] Verify SSL certificate

### **Phase 5: Documentation**

- [ ] Document final configuration
- [ ] Note any custom settings
- [ ] Create backup of DNS settings
- [ ] Document troubleshooting steps taken

## 📊 Configuration Examples

### **Example 1: Marketing Site**

```json
{
  "domain": "www.mybrand.com",
  "branding": {
    "myLogo": "https://mybrand.com/logo.png",
    "contentFilter": "custom",
    "selectedCategories": ["MARKETING", "BUSINESS"],
    "mySiteFrontPage": "graph_123456789"
  }
}
```

### **Example 2: Educational Platform**

```json
{
  "domain": "learn.university.edu",
  "branding": {
    "myLogo": "https://university.edu/assets/logo.svg",
    "contentFilter": "custom",
    "selectedCategories": ["EDUCATION", "RESEARCH"],
    "mySiteFrontPage": ""
  }
}
```

### **Example 3: Open Content Site**

```json
{
  "domain": "knowledge.community.org",
  "branding": {
    "myLogo": "https://community.org/branding/logo.png",
    "contentFilter": "none",
    "selectedCategories": [],
    "mySiteFrontPage": ""
  }
}
```

## 🔄 Maintenance & Updates

### **Regular Checks**

- **Monthly**: Verify DNS records are still active
- **Quarterly**: Check SSL certificate expiration
- **Annually**: Review content filtering categories

### **Logo Updates**

1. Upload new logo to accessible URL
2. Update configuration in User Dashboard
3. Clear CDN cache if needed
4. Test across all pages

### **Domain Changes**

1. Follow this guide for new domain setup
2. Update DNS records for old domain (redirect or remove)
3. Update any hardcoded references
4. Monitor for traffic changes

### **Content Filter Updates**

1. Review available categories in system
2. Update selected categories in BrandingModal
3. Test content filtering results
4. Verify front page content is appropriate

## 📞 Support & Resources

### **Technical Support**

- Check existing GitHub issues
- Review system logs in Cloudflare Workers dashboard
- Use browser developer tools for client-side debugging

### **Documentation References**

- [Cloudflare DNS API Documentation](https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-create-dns-record)
- [Cloudflare Workers Routes](https://developers.cloudflare.com/workers/platform/routing/routes/)
- [Vegvisr Architecture Documentation](./ARCHITECTURE.md)

### **Best Practices**

1. **Testing**: Always test in staging before production
2. **Monitoring**: Set up uptime monitoring for custom domains
3. **Documentation**: Keep records of all configuration changes
4. **Security**: Use least-privilege API tokens
5. **Performance**: Monitor loading times after setup

---

## 📝 Version History

- **v1.0** - Initial comprehensive guide
- **v1.1** - Added troubleshooting section and debug commands
- **v1.2** - Added configuration examples and maintenance procedures

---

_This guide covers the complete process for setting up custom domains with the Vegvisr platform. For questions or issues not covered here, please refer to the technical documentation or create a GitHub issue._
