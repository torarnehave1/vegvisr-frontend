# Vector Search Worker

AI-powered vector search and knowledge graph discovery system for the Vegvisr platform.

## Overview

The Vector Search Worker provides semantic search capabilities for knowledge graphs using vector embeddings and AI-powered content analysis. It operates completely independently from existing workers and can be enabled/disabled without affecting current functionality.

## Features

- **Semantic Search**: Find knowledge graphs by meaning, not just keywords
- **Hybrid Search**: Combines vector similarity with keyword matching
- **Real-time Indexing**: Automatically indexes new content as it's created
- **Batch Processing**: Can index all existing knowledge graphs
- **Content Analysis**: Analyzes and categorizes different types of content
- **Analytics**: Tracks search patterns and performance metrics

## Setup Instructions

### 1. Database Setup

First, create the required database tables:

```powershell
npx wrangler d1 execute vegvisr_org --remote --config=vector-search-worker/wrangler.toml --file=database/vector_embeddings.sql
```

### 2. Vectorize Index Setup

Create the Vectorize index for vector storage:

```powershell
npx wrangler vectorize create vegvisr-knowledge-vectors --dimensions=384 --metric=cosine
```

### 3. Configuration

Update `vector-search-worker/wrangler.toml`:

1. Replace `your-database-id-here` with your actual D1 database ID
2. Ensure the Vectorize index name matches what you created
3. Adjust the route pattern if needed

### 4. Deployment

Deploy the worker:

```powershell
cd vector-search-worker
npx wrangler deploy
```

## API Endpoints

### POST `/index-graph`

Index a single knowledge graph for vector search.

**Request Body:**

```json
{
  "graphId": "graph_123",
  "graphData": {
    "id": "graph_123",
    "metadata": {
      "title": "Machine Learning Basics",
      "description": "Introduction to ML concepts",
      "category": "#AI #Education"
    },
    "nodes": [
      {
        "id": "node_1",
        "label": "Neural Networks",
        "info": "Neural networks are computing systems inspired by biological neural networks...",
        "type": "fulltext",
        "visible": true
      }
    ]
  },
  "action": "upsert"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Successfully indexed 3 content chunks",
  "vectorsCreated": 3,
  "graphId": "graph_123"
}
```

### POST `/search`

Perform hybrid search across all indexed knowledge graphs.

**Request Body:**

```json
{
  "query": "machine learning algorithms",
  "searchType": "hybrid",
  "limit": 10
}
```

**Search Types:**

- `"vector"` - Semantic search only
- `"keyword"` - Keyword search only
- `"hybrid"` - Combined vector + keyword search

**Response:**

```json
{
  "query": "machine learning algorithms",
  "searchType": "hybrid",
  "results": [
    {
      "graphId": "graph_123",
      "relevanceScore": 0.95,
      "matchType": "vector",
      "matchedContent": [
        {
          "nodeId": "node_1",
          "contentType": "node_content",
          "snippet": "Neural networks are computing systems...",
          "score": 0.95
        }
      ]
    }
  ],
  "totalResults": 1,
  "responseTime": 245,
  "suggestions": []
}
```

### POST `/reindex-all`

Batch index all existing knowledge graphs.

**Request Body:**

```json
{}
```

**Response:**

```json
{
  "success": true,
  "message": "Batch reindexing complete",
  "processed": 47,
  "errors": 2,
  "total": 49
}
```

### GET `/analyze-content`

Analyze existing content to understand vectorization needs.

**Response:**

```json
{
  "totalGraphs": 49,
  "totalNodes": 342,
  "contentTypes": {
    "text": 298,
    "structured": 44
  },
  "estimatedVectors": 342,
  "currentlyVectorized": 0,
  "needsVectorization": 49,
  "sampleContent": [
    {
      "graphId": "graph_123",
      "nodeId": "node_1",
      "nodeLabel": "Neural Networks",
      "contentPreview": "Neural networks are computing systems inspired by biological neural networks...",
      "contentType": "text"
    }
  ]
}
```

### GET `/health`

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "service": "vector-search-worker",
  "timestamp": "2024-12-19T10:30:00.000Z"
}
```

## Integration with Existing System

### Automatic Indexing

To enable automatic indexing when graphs are saved, add this to your existing save endpoints:

```javascript
// In dev-worker or wherever graphs are saved
async function saveGraph(graphData) {
  // ... existing save logic ...

  // NEW: Trigger vectorization (non-blocking)
  try {
    fetch('https://vector-search.vegvisr.workers.dev/index-graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphId: graphData.id,
        graphData: graphData,
        action: 'upsert',
      }),
    }).catch((error) => console.warn('Vectorization failed:', error))
  } catch (error) {
    // Don't fail the save if vectorization fails
    console.warn('Vectorization trigger failed:', error)
  }

  // ... rest of save logic ...
}
```

### Frontend Integration

Add vector search to your Vue.js components:

```vue
<template>
  <div class="search-container">
    <!-- Existing search -->
    <input v-model="keywordQuery" placeholder="Search graphs..." />

    <!-- New vector search toggle -->
    <div class="search-mode">
      <button @click="searchMode = 'keyword'" :class="{ active: searchMode === 'keyword' }">
        🔍 Keyword
      </button>
      <button @click="searchMode = 'vector'" :class="{ active: searchMode === 'vector' }">
        🧠 Smart
      </button>
    </div>

    <!-- Smart search input -->
    <input
      v-if="searchMode === 'vector'"
      v-model="vectorQuery"
      placeholder="Ask me anything about your knowledge..."
      @input="performVectorSearch"
    />
  </div>
</template>

<script>
export default {
  data() {
    return {
      searchMode: 'keyword',
      keywordQuery: '',
      vectorQuery: '',
      vectorResults: [],
    }
  },
  methods: {
    async performVectorSearch() {
      if (!this.vectorQuery.trim()) return

      try {
        const response = await fetch('https://vector-search.vegvisr.workers.dev/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: this.vectorQuery,
            searchType: 'hybrid',
            limit: 10,
          }),
        })

        const data = await response.json()
        this.vectorResults = data.results

        // Update UI with smart search results
        this.updateSearchResults(data.results)
      } catch (error) {
        console.error('Vector search failed:', error)
        // Fall back to keyword search
        this.searchMode = 'keyword'
      }
    },
  },
}
</script>
```

## Testing

### 1. Basic Health Check

```powershell
curl "https://vector-search.vegvisr.workers.dev/health"
```

### 2. Content Analysis

```powershell
curl "https://vector-search.vegvisr.workers.dev/analyze-content"
```

### 3. Test Search

```powershell
curl -X POST "https://vector-search.vegvisr.workers.dev/search" -H "Content-Type: application/json" -d '{"query": "machine learning", "searchType": "hybrid", "limit": 5}'
```

### 4. Initial Indexing

```powershell
curl -X POST "https://vector-search.vegvisr.workers.dev/reindex-all" -H "Content-Type: application/json" -d '{}'
```

## Performance Considerations

### Vector Storage

- Each vector: ~1.5KB storage
- 1000 graphs × 10 nodes average = ~15MB total
- Vectorize has generous limits for this scale

### Search Performance

- Vector search: ~100-200ms
- Keyword fallback: ~50-100ms
- Hybrid search: ~150-250ms

### Rate Limits

- Workers AI: 1000 requests/day free tier
- Vectorize: 30M queries/month free tier
- D1: 5M reads/month free tier

## Troubleshooting

### Common Issues

1. **"Missing AI binding"**

   - Ensure `[ai]` binding is in wrangler.toml
   - Redeploy the worker

2. **"Vectorize index not found"**

   - Create the index: `npx wrangler vectorize create vegvisr-knowledge-vectors --dimensions=384 --metric=cosine`
   - Check index name in wrangler.toml

3. **"Database table not found"**

   - Run the SQL file: `npx wrangler d1 execute vegvisr_org --remote --config=vector-search-worker/wrangler.toml --file=database/vector_embeddings.sql`

4. **"Search returns no results"**
   - Check if content is indexed: `GET /analyze-content`
   - Run initial indexing: `POST /reindex-all`

### Debug Logs

Enable debug logging in wrangler.toml:

```toml
[vars]
LOG_LEVEL = "debug"
```

## Rollback Strategy

If vector search causes issues:

1. **Disable in frontend** - Set search mode to keyword only
2. **Stop calling vector endpoints** - Remove integration calls
3. **Keep worker running** - For future use
4. **Complete removal** - Delete worker and database tables

The system is designed to degrade gracefully - if vector search fails, keyword search continues working.

## Security Notes

- All endpoints use CORS headers for cross-origin requests
- No authentication required for search (read-only)
- Indexing could be restricted with API tokens if needed
- Search analytics are anonymized by default

## Future Enhancements

- Natural language query processing
- Automatic content categorization
- Graph relationship discovery
- Personalized search results
- Advanced analytics dashboard

## Support

For issues or questions about the Vector Search Worker:

1. Check the troubleshooting section
2. Review worker logs in Cloudflare dashboard
3. Test individual endpoints with curl
4. Verify database table creation and Vectorize index setup
