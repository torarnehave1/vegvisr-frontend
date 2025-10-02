# SEO Worker Deployment Guide

Follow these steps to deploy the SEO Worker to Cloudflare.

## Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI installed globally or via npx
- Access to the Vegvisr Cloudflare account

## Step-by-Step Deployment

### 1. Install Dependencies

```bash
cd seo-worker
npm install
```

### 2. Authenticate with Cloudflare

```bash
npx wrangler login
```

This will open a browser window to authorize Wrangler.

### 3. Create KV Namespaces

Create development KV namespace:

```bash
npx wrangler kv:namespace create "SEO_PAGES"
```

You'll get output like:
```
🌀 Creating namespace with title "seo-worker-SEO_PAGES"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "SEO_PAGES", id = "abc123def456..." }
```

Create production KV namespace:

```bash
npx wrangler kv:namespace create "SEO_PAGES" --env production
```

You'll get output like:
```
🌀 Creating namespace with title "seo-worker-production-SEO_PAGES"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "SEO_PAGES", id = "xyz789abc123..." }
```

### 4. Update wrangler.toml

Open `wrangler.toml` and replace the placeholder IDs:

**Before:**
```toml
[[kv_namespaces]]
binding = "SEO_PAGES"
id = "YOUR_KV_NAMESPACE_ID"

[[env.production.kv_namespaces]]
binding = "SEO_PAGES"
id = "YOUR_PRODUCTION_KV_NAMESPACE_ID"
```

**After:**
```toml
[[kv_namespaces]]
binding = "SEO_PAGES"
id = "abc123def456..."  # ID from step 3 (dev)

[[env.production.kv_namespaces]]
binding = "SEO_PAGES"
id = "xyz789abc123..."  # ID from step 3 (production)
```

### 5. Deploy to Development

```bash
npm run deploy
# or
npx wrangler deploy
```

You should see:
```
✨ Built successfully
✨ Uploaded seo-worker
✨ Deployed seo-worker
  https://seo-worker.vegvisr.workers.dev
```

### 6. Test Development Deployment

```bash
# Test health endpoint
curl https://seo-worker.vegvisr.workers.dev/health

# Should return:
# {"status":"ok","service":"seo-worker"}
```

### 7. Deploy to Production

```bash
npm run deploy:prod
# or
npx wrangler deploy --env production
```

The worker will be deployed to: `https://seo.vegvisr.org/*`

### 8. Verify Production Deployment

```bash
# Test health endpoint
curl https://seo.vegvisr.org/health

# Should return:
# {"status":"ok","service":"seo-worker"}
```

### 9. Configure Additional Routes (Optional)

If you want `/graph/*` on the main domain to use this worker:

#### Option A: Via Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com
2. Select your domain: `vegvisr.org`
3. Go to: Workers Routes
4. Add routes:
   - Route: `www.vegvisr.org/graph/*` → Worker: `seo-worker`
   - Route: `vegvisr.org/graph/*` → Worker: `seo-worker`

#### Option B: Via wrangler.toml

Add to the `[env.production]` section:

```toml
[env.production]
routes = [
  { pattern = "www.vegvisr.org/graph/*", zone_id = "9178eccd3a7e3d71d8ae09defb09422a" },
  { pattern = "vegvisr.org/graph/*", zone_id = "9178eccd3a7e3d71d8ae09defb09422a" }
]
```

Then redeploy:
```bash
npm run deploy:prod
```

### 10. Test End-to-End

Generate a test page via the SEO Admin UI:

1. Go to: https://www.vegvisr.org/seo-admin
2. Load a knowledge graph
3. Configure SEO settings
4. Click "Generate Static Page"
5. Test the generated URL

Test crawler detection:

```bash
# As a crawler (should serve HTML)
curl -H "User-Agent: facebookexternalhit/1.1" \
  https://www.vegvisr.org/graph/your-test-slug

# As a user (should redirect)
curl -L https://www.vegvisr.org/graph/your-test-slug
```

## Monitoring

### View Real-Time Logs

```bash
npx wrangler tail
# or for production
npx wrangler tail --env production
```

### List Stored Pages

```bash
# Development
npx wrangler kv:key list --binding SEO_PAGES

# Production
npx wrangler kv:key list --binding SEO_PAGES --env production
```

### View a Specific Page

```bash
npx wrangler kv:key get "graph:my-slug" --binding SEO_PAGES --env production
```

### Delete a Page

```bash
npx wrangler kv:key delete "graph:my-slug" --binding SEO_PAGES --env production
```

## Troubleshooting

### Error: "binding SEO_PAGES not found"

- Check that KV namespace IDs are correct in `wrangler.toml`
- Ensure you created the namespaces (step 3)
- Verify binding name is exactly `SEO_PAGES`

### Error: "route already exists"

- Another worker may be using the same route
- Check Cloudflare Dashboard → Workers Routes
- Remove conflicting route or choose a different pattern

### CORS Errors

- Worker has CORS enabled by default
- Check browser console for specific CORS error
- Verify Origin header is allowed

### Pages Not Generating

- Check SEO Admin console for errors
- Use `npx wrangler tail` to see worker logs
- Verify all required fields are provided
- Check KV storage with `kv:key list`

### Facebook Not Showing Preview

- Use Facebook debugger: https://developers.facebook.com/tools/debug/
- Ensure images are publicly accessible
- Check image dimensions (1200x630px recommended)
- Verify Open Graph tags in generated HTML

## Rollback

If you need to rollback:

```bash
# List deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback
```

## Cost Considerations

**Cloudflare Workers:**
- Free tier: 100,000 requests/day
- Paid: $5/mo for 10M requests

**KV Storage:**
- Free tier: 100,000 reads/day, 1,000 writes/day, 1 GB storage
- Paid: $0.50 per million reads, $5 per million writes

For Vegvisr's expected usage, the free tier should be sufficient.

## Security

- Worker runs in Cloudflare's edge network (secure by default)
- No sensitive data stored in KV
- CORS configured for public access
- No authentication required (read-only for public)

## Next Steps

1. Generate pages for existing graphs
2. Monitor performance via Cloudflare Analytics
3. Test Facebook/Twitter sharing
4. Submit URLs to Google Search Console
5. Monitor crawling in Cloudflare logs
