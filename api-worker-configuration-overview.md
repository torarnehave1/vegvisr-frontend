# API Worker Configuration Overview

## Required Environment Variables (API Keys)

### AI/ML Service API Keys
1. **OPENAI_API_KEY** - OpenAI API key for GPT models
   - Used for: Knowledge graph generation, text summarization, content processing, image generation
   - Functions: `handleCreateKnowledgeGraph`, `handleSummarize`, `handleGenerateHeaderImage`, `handleGPT4VisionImage`

2. **XAI_API_KEY** - xAI (Grok) API key
   - Used for: Grok AI model interactions, content generation, title/description suggestions
   - Functions: `handleGrokTest`, `handleAIAction`, `handleSuggestTitle`, `handleSuggestDescription`, `handleSuggestCategories`

3. **GOOGLE_GEMINI_API_KEY** - Google Gemini API key
   - Used for: Gemini AI model interactions, content generation
   - Functions: `handleGeminiTest`, `handleGenerateWorker`

4. **GOOGLE_API_KEY** - Google API key (general)
   - Used for: Google services integration, KML operations
   - Functions: `handleGetGoogleApiKey`, `handleAIAction`

5. **ANTHROPIC_API_KEY** - Anthropic Claude API key
   - Used for: Claude AI model interactions
   - Functions: `handleClaudeTest`

### Content & Media API Keys
6. **YOUTUBE_API_KEY** - YouTube Data API key
   - Used for: YouTube video search functionality
   - Functions: `handleYouTubeSearch`

7. **YOUTUBE_TRANSCRIPT_IO_TOKEN** - YouTube Transcript IO API token
   - Used for: Extracting YouTube video transcripts
   - Functions: `handleYouTubeTranscriptIO`

8. **DOWNDUB_API_TOKEN** - Downsub API token
   - Used for: Alternative transcript extraction service
   - Functions: `handleDownsubUrlTranscript`, `handleDownsubTranscript`

9. **PEXELS_API_KEY** - Pexels API key
   - Used for: Stock photo search and integration
   - Functions: `handlePexelsImageSearch`, `searchPexelsImages`

### Google Photos Integration
10. **GOOGLE_PHOTOS_CLIENT_ID** - Google Photos OAuth client ID
    - Used for: Google Photos authentication
    - Functions: `handleGooglePhotosAuth`

11. **GOOGLE_PHOTOS_CLIENT_SECRET** - Google Photos OAuth client secret
    - Used for: Google Photos authentication
    - Functions: `handleGooglePhotosAuth`

### Cloudflare Configuration
12. **CF_API_TOKEN** - Cloudflare API token (main)
    - Used for: Domain management, DNS operations
    - Functions: `handleCreateCustomDomain`, `handleDeleteCustomDomain`

13. **CF_API_TOKEN_SANDBOX** - Cloudflare API token for sandbox operations
    - Used for: Sandbox worker deployment
    - Functions: `handleDeploySandbox`, `handleGetSandboxCode`

14. **CF_ACCOUNT_ID** - Cloudflare account ID
    - Used for: Cloudflare API operations
    - Functions: `handleDeploySandbox`, `handleCreateSandboxDomain`

15. **CF_WORKERS_SUBDOMAIN** - Cloudflare Workers subdomain
    - Used for: Worker deployment configuration
    - Functions: `handleDeploySandbox`, `handleCreateSandboxDomain`

16. **SANDMAN_API_TOKEN** - Sandman API token
    - Used for: Sandman service updates
    - Functions: `handleUpdateSandman`

### Security & Authentication
17. **INT_TOKEN** - Internal authentication token
    - Used for: Internal API authentication
    - Functions: `handleGetGoogleApiKey`, `handleUpdateKml`

## Required Cloudflare Bindings

### KV Namespace Bindings
1. **BINDING_NAME** - Main KV namespace
   - Used for: Blog posts, snippets, site configurations, sandbox metadata
   - Operations: Store/retrieve blog content, user configurations, sandbox data

2. **snippets** - Snippets KV namespace
   - Used for: Code snippets storage and retrieval
   - Operations: Store/retrieve code snippets

3. **SITE_CONFIGS** - Site configurations KV namespace
   - Used for: Domain-specific configurations
   - Operations: Store/retrieve domain configurations

4. **KNOWLEDGE** - Knowledge worker service binding
   - Used for: Knowledge graph operations
   - Operations: Template fetching, graph data retrieval

### R2 Bucket Bindings
5. **MY_R2_BUCKET** - Main R2 storage bucket
   - Used for: Image storage, file uploads, header images
   - Operations: Store/retrieve images and files

6. **KLM_BUCKET** - KML files bucket
   - Used for: Geographic data (KML files) storage
   - Operations: Store/retrieve KML geographic data

### Database Bindings
7. **vegvisr_org** - D1 database binding
   - Used for: User data, domain configurations, ownership tracking
   - Operations: Store/retrieve user profiles, domain ownership data

## Domain Configuration Constants

The following domain-to-zone mappings are hardcoded in the worker:

```javascript
const DOMAIN_ZONE_MAPPING = {
  'norsegong.com': 'e577205b812b49d012af046535369808',
  'xyzvibe.com': '602067f0cf860426a35860a8ab179a47',
  'vegvisr.org': '9178eccd3a7e3d71d8ae09defb09422a',
  'slowyou.training': '1417691852abd0e8220f60184b7f4eca',
  'movemetime.com': 'abb39e8d56446afe3ac098abd5c21732',
}
```

## wrangler.toml Configuration Template

Based on the analysis, your `wrangler.toml` should include:

```toml
name = "api-worker"
main = "index.js"
compatibility_date = "2023-10-30"

[vars]
OPENAI_API_KEY = "your-openai-api-key"
XAI_API_KEY = "your-xai-api-key"
GOOGLE_GEMINI_API_KEY = "your-google-gemini-api-key"
GOOGLE_API_KEY = "your-google-api-key"
ANTHROPIC_API_KEY = "your-anthropic-api-key"
YOUTUBE_API_KEY = "your-youtube-api-key"
YOUTUBE_TRANSCRIPT_IO_TOKEN = "your-youtube-transcript-token"
DOWNDUB_API_TOKEN = "your-downdub-api-token"
PEXELS_API_KEY = "your-pexels-api-key"
GOOGLE_PHOTOS_CLIENT_ID = "your-google-photos-client-id"
GOOGLE_PHOTOS_CLIENT_SECRET = "your-google-photos-client-secret"
CF_API_TOKEN = "your-cloudflare-api-token"
CF_API_TOKEN_SANDBOX = "your-cloudflare-sandbox-token"
CF_ACCOUNT_ID = "your-cloudflare-account-id"
CF_WORKERS_SUBDOMAIN = "your-workers-subdomain"
SANDMAN_API_TOKEN = "your-sandman-api-token"
INT_TOKEN = "your-internal-token"

[[kv_namespaces]]
binding = "BINDING_NAME"
id = "your-main-kv-namespace-id"

[[kv_namespaces]]
binding = "snippets"
id = "your-snippets-kv-namespace-id"

[[kv_namespaces]]
binding = "SITE_CONFIGS"
id = "your-site-configs-kv-namespace-id"

[[r2_buckets]]
binding = "MY_R2_BUCKET"
bucket_name = "your-main-r2-bucket-name"

[[r2_buckets]]
binding = "KLM_BUCKET"
bucket_name = "your-kml-r2-bucket-name"

[[d1_databases]]
binding = "vegvisr_org"
database_name = "your-d1-database-name"
database_id = "your-d1-database-id"

[[services]]
binding = "KNOWLEDGE"
service = "knowledge-worker"
```

## Priority Order for Setup

1. **Essential for basic functionality:**
   - OPENAI_API_KEY
   - BINDING_NAME (KV namespace)
   - MY_R2_BUCKET
   - CF_API_TOKEN
   - CF_ACCOUNT_ID

2. **For AI features:**
   - XAI_API_KEY
   - GOOGLE_GEMINI_API_KEY
   - ANTHROPIC_API_KEY

3. **For content features:**
   - YOUTUBE_API_KEY
   - PEXELS_API_KEY
   - snippets (KV namespace)

4. **For advanced features:**
   - GOOGLE_PHOTOS_CLIENT_ID/SECRET
   - SITE_CONFIGS (KV namespace)
   - vegvisr_org (D1 database)
   - KNOWLEDGE (service binding)

## Notes

- Some API keys might be optional depending on which features you use
- The domain zone mappings are hardcoded and may need updates for your specific domains
- The INT_TOKEN is used for internal authentication - generate a secure random string
- Service bindings like KNOWLEDGE require other workers to be deployed first