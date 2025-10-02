# SEO Worker - Static Page Generator for Knowledge Graphs

This Cloudflare Worker generates SEO-optimized static HTML pages for knowledge graphs, enabling Google indexing and Facebook/Twitter sharing.

## Features

- **Crawler Detection**: Serves static HTML to search engine crawlers and social media bots
- **User Redirection**: Redirects human users to the interactive Vue app
- **Open Graph Tags**: Full support for Facebook, Twitter, LinkedIn sharing
- **JSON-LD**: Structured data for enhanced Google search results
- **KV Storage**: Stores generated pages in Cloudflare KV for fast retrieval

## Setup Instructions

### 1. Create KV Namespaces

Create two KV namespaces (development and production):

```bash
# Navigate to the worker directory
cd seo-worker

# Create development KV namespace
npx wrangler kv:namespace create "SEO_PAGES"

# Create production KV namespace
npx wrangler kv:namespace create "SEO_PAGES" --env production
```

After running these commands, Wrangler will output the namespace IDs. Copy these IDs.

### 2. Update wrangler.toml

Replace the placeholder IDs in `wrangler.toml` with your actual namespace IDs:

```toml
[[kv_namespaces]]
binding = "SEO_PAGES"
id = "abc123..."  # Replace with your dev namespace ID

[[env.production.kv_namespaces]]
binding = "SEO_PAGES"
id = "xyz789..."  # Replace with your production namespace ID
```

### 3. Deploy the Worker

```bash
# Deploy to development
npx wrangler deploy

# Deploy to production
npx wrangler deploy --env production
```

### 4. Configure Custom Domain Routes (Optional)

If you want to use your main domain instead of `seo.vegvisr.org`:

1. Go to Cloudflare Dashboard → Workers & Pages → seo-worker
2. Click "Triggers" tab
3. Add routes:
   - `www.vegvisr.org/graph/*`
   - `vegvisr.org/graph/*`

Or update `wrangler.toml`:

```toml
[env.production]
routes = [
  { pattern = "www.vegvisr.org/graph/*", zone_id = "9178eccd3a7e3d71d8ae09defb09422a" },
  { pattern = "vegvisr.org/graph/*", zone_id = "9178eccd3a7e3d71d8ae09defb09422a" }
]
```

### 5. Verify Deployment

Test the worker is running:

```bash
curl https://seo.vegvisr.org/health
# Should return: {"status":"ok","service":"seo-worker"}
```

## API Endpoints

### POST /generate

Generates and stores a static SEO page.

**Request Body:**
```json
{
  "graphId": "graph_1759133206105",
  "slug": "my-knowledge-graph",
  "title": "My Knowledge Graph",
  "description": "A comprehensive knowledge graph about...",
  "ogImage": "https://vegvisr.imgix.net/image.jpg",
  "keywords": "knowledge, graph, education",
  "graphData": {
    "nodes": [...],
    "edges": [...],
    "metadata": {...}
  }
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://www.vegvisr.org/graph/my-knowledge-graph",
  "slug": "my-knowledge-graph"
}
```

### GET /graph/{slug}

Serves the static page to crawlers or redirects users to the Vue app.

**Crawler Detection:**
- Facebook bot → Serves static HTML
- Google bot → Serves static HTML
- Twitter bot → Serves static HTML
- Regular users → Redirects to `/gnew-viewer?graphId={graphId}`

## Usage from SEO Admin

The SEO Admin interface (`/seo-admin`) provides a UI for:

1. Loading knowledge graphs
2. Configuring SEO metadata
3. Generating static pages
4. Testing with Facebook debugger
5. Copying shareable URLs

## Architecture

```
User Request → Worker
  ├─ Is Crawler?
  │   ├─ Yes → Serve static HTML (from KV)
  │   └─ No → Redirect to Vue app
  └─ KV Storage
      └─ graph:{slug} → Page data + HTML
```

## Testing

### Test with curl (mimics crawler)

```bash
curl -H "User-Agent: facebookexternalhit/1.1" \
  https://www.vegvisr.org/graph/my-knowledge-graph
```

### Test with Facebook Debugger

```bash
# Generate page via SEO Admin
# Then visit:
https://developers.facebook.com/tools/debug/?q=https://www.vegvisr.org/graph/my-knowledge-graph
```

### Test redirect (as user)

```bash
curl -L https://www.vegvisr.org/graph/my-knowledge-graph
# Should redirect to: https://www.vegvisr.org/gnew-viewer?graphId=...
```

## KV Storage Schema

### Key: `graph:{slug}`
```json
{
  "graphId": "graph_1759133206105",
  "slug": "my-knowledge-graph",
  "title": "My Knowledge Graph",
  "description": "...",
  "ogImage": "https://...",
  "keywords": "...",
  "html": "<html>...</html>",
  "createdAt": "2025-03-13T10:30:00Z"
}
```

### Key: `mapping:{graphId}`
```
Value: "my-knowledge-graph"
```

This allows looking up slugs by graph ID.

## Troubleshooting

### Worker not responding
- Check deployment: `npx wrangler tail` to see logs
- Verify routes in Cloudflare dashboard
- Check DNS settings

### KV errors
- Ensure KV namespaces are created
- Verify IDs in `wrangler.toml`
- Check binding name matches code (`SEO_PAGES`)

### Pages not generating
- Check SEO Admin console for errors
- Verify all required fields (slug, title, description, ogImage)
- Test `/health` endpoint

### Facebook not showing preview
- Use Facebook debugger to see what it fetches
- Check Open Graph tags in generated HTML
- Ensure image URLs are publicly accessible
- Images should be 1200x630px for best results

## Development

```bash
# Run locally with Miniflare
npx wrangler dev

# View logs
npx wrangler tail

# List KV keys
npx wrangler kv:key list --binding SEO_PAGES

# Get KV value
npx wrangler kv:key get "graph:my-slug" --binding SEO_PAGES

# Delete KV key
npx wrangler kv:key delete "graph:my-slug" --binding SEO_PAGES
```

## Environment Variables

None required. Configuration is in `wrangler.toml`.

## Dependencies

- Cloudflare Workers runtime
- Cloudflare KV (Workers KV)
- No external packages required (vanilla JS)

## License

Part of the Vegvisr platform.
