# RAG Manager Worker - Phase 1 Implementation

## Overview

The RAG Manager Worker is a Cloudflare Worker that enables **Knowledge Graph → RAG → Sandbox** functionality in Vegvisr.org. This is Phase 1 of the revolutionary RAG-first sandbox architecture that allows users to create RAG-enabled applications directly from their knowledge graphs.

## 🚀 Features

### Core RAG Functionality

- **Knowledge Graph Analysis**: Automatically analyzes knowledge graphs for executable content and RAG-worthy data
- **Vector Embedding Generation**: Creates vector embeddings using Cloudflare Workers AI (`@cf/baai/bge-base-en-v1.5`)
- **Code Extraction**: Intelligently extracts TypeScript/JavaScript code blocks and configuration files
- **RAG Sandbox Deployment**: Generates and deploys RAG-enabled worker code

### RAG Capabilities

- **Semantic Search**: Vector-based search through knowledge graph content
- **Context-Aware Responses**: AI responses powered by relevant knowledge graph context
- **Multi-Node Indexing**: Indexes all nodes from knowledge graphs for comprehensive RAG coverage
- **Metadata Preservation**: Maintains rich metadata for source attribution and scoring

## 📡 API Endpoints

### `/analyze-graph` [POST]

Analyzes a knowledge graph for RAG potential and executable content.

**Request:**

```json
{
  "graphData": {
    "nodes": [...],
    "edges": [...]
  }
}
```

**Response:**

```json
{
  "success": true,
  "analysis": {
    "platform": "cloudflare-workers",
    "hasExecutableContent": true,
    "executableFiles": ["index.js", "wrangler.toml"],
    "ragContent": 6,
    "totalNodes": 6
  },
  "extractedFiles": {
    "index.js": "// extracted code",
    "wrangler.toml": "name = \"sandbox\""
  },
  "ragContent": [...]
}
```

### `/create-rag-index` [POST]

Creates vector embeddings for knowledge graph content.

**Request:**

```json
{
  "graphData": { "nodes": [...] },
  "graphId": "autorag-demo",
  "userId": "user123"
}
```

**Response:**

```json
{
  "success": true,
  "indexId": "user_user123_graph_autorag-demo",
  "indexed": 6,
  "extractedCode": { "index.js": "..." },
  "hasExecutableContent": true
}
```

### `/create-rag-sandbox` [POST]

Deploys a RAG-enabled sandbox worker.

**Request:**

```json
{
  "indexId": "user_user123_graph_autorag-demo",
  "extractedCode": { "index.js": "..." },
  "userId": "user123",
  "graphId": "autorag-demo"
}
```

**Response:**

```json
{
  "success": true,
  "sandbox": {
    "sandboxId": "rag-1708123456789-abc123",
    "url": "https://rag-1708123456789-abc123.torarnehave.workers.dev",
    "expiresIn": "4 hours",
    "ragEnabled": true,
    "workerCode": "// generated worker code"
  }
}
```

### `/list-sandboxes` [GET]

Lists active sandbox deployments.

## 🧪 Generated RAG Sandbox Features

Each generated sandbox includes these endpoints:

### `/rag/query` [POST]

Main RAG query endpoint for asking questions about the knowledge graph.

**Request:**

```json
{
  "query": "How does Autorag work with Cloudflare Workers?",
  "includeContext": true
}
```

**Response:**

```json
{
  "response": "Autorag works with Cloudflare Workers by...",
  "sources": [
    {
      "content": "relevant node content",
      "source": "Node Label",
      "score": 0.85
    }
  ],
  "ragEnabled": true,
  "sandboxId": "rag-1708123456789-abc123",
  "timestamp": "2024-01-20T15:30:00Z"
}
```

### `/knowledge/search` [POST]

Vector search through the knowledge graph.

### `/execute` [POST]

Executes the original extracted code from the knowledge graph.

### `/health` [GET]

Health check endpoint.

## 🏗️ Architecture

### RAG Processing Pipeline

```
Knowledge Graph → Content Analysis → Code Extraction → Vector Indexing → Sandbox Generation → RAG Deployment
```

### Key Components

#### `RAGAnalyzer`

- Analyzes knowledge graph nodes for executable content
- Extracts code blocks (TypeScript, JavaScript)
- Extracts configuration files (wrangler.toml, package.json)
- Collects all text content for RAG indexing

#### `RAGIndexer`

- Creates vector embeddings using Workers AI
- Stores embeddings in Cloudflare Vectorize
- Maintains rich metadata for each embedding
- Enables semantic search and context retrieval

#### `RAGSandboxDeployer`

- Generates RAG-enabled worker code
- Combines extracted user code with RAG functionality
- Creates sandbox metadata and expiration handling
- Simulates deployment (returns code for manual deployment)

## 📋 Prerequisites

### Cloudflare Resources Required

- **Vectorize Index**: For storing vector embeddings
- **Workers AI**: For embedding generation and RAG responses
- **KV Namespace**: For sandbox metadata storage
- **R2 Bucket**: For file storage (optional)

### Environment Variables

```toml
# wrangler.toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "rag-index"

[[ai]]
binding = "AI"

[[kv_namespaces]]
binding = "SANDBOX_KV"
id = "rag_sandbox_kv"
```

## 🚀 Deployment

1. **Create Vectorize Index**:

```bash
wrangler vectorize create rag-index --dimensions=768 --metric=cosine
```

2. **Create KV Namespace**:

```bash
wrangler kv:namespace create "SANDBOX_KV"
```

3. **Deploy Worker**:

```bash
cd rag-manager-worker
wrangler deploy
```

## 🔗 Integration with Vegvisr.org

### Frontend Integration

The RAG Manager integrates with Vegvisr.org through:

1. **NodeControlBar**: Detects RAG-worthy content and shows sandbox button
2. **SandboxModal**: Provides user interface for creating and testing RAG sandboxes
3. **API Proxy**: Routes requests through api-worker to rag-manager-worker

### Detection Logic

RAG sandbox functionality is automatically enabled when nodes contain:

- Code blocks (`typescript, `javascript)
- Configuration files (wrangler.toml, package.json)
- RAG-related keywords (RAG, vector, embedding, Workers AI)

## 🎯 Use Cases

### Perfect for Cloudflare Autorag Demo

This implementation is specifically designed for knowledge graphs like the Cloudflare Autorag tutorial, where:

- Nodes contain executable TypeScript code
- Configuration examples are provided
- Educational content explains RAG concepts
- Users want to test the implementation

### Broader Applications

- **Technical Documentation**: Turn documentation into interactive RAG applications
- **Tutorial Content**: Create testable environments from tutorial knowledge graphs
- **Educational Materials**: Enable hands-on learning with automatic sandbox creation
- **Developer Resources**: Transform static content into interactive developer tools

## 🔮 Future Enhancements (Phase 2+)

- **Real Cloudflare Deployment**: Automatic worker deployment via API
- **Multi-Platform Support**: Support for other platforms beyond Cloudflare Workers
- **Advanced RAG Techniques**: Implement retrieval ranking, query expansion
- **Persistent Deployments**: Option for permanent RAG application deployment
- **Collaboration Features**: Shared RAG applications and team workspaces

## 📊 Current Status: Phase 1 Complete

✅ **RAG Manager Worker**: Fully implemented with analysis, indexing, and sandbox generation  
✅ **Frontend Integration**: NodeControlBar and SandboxModal components ready  
✅ **API Integration**: Proxy endpoints configured in api-worker  
✅ **Code Extraction**: Intelligent extraction of executable content  
✅ **Vector Indexing**: Full RAG indexing with Cloudflare Vectorize  
✅ **Sandbox Generation**: RAG-enabled worker code generation

## 🎉 Rollback ID: 2025-01-20-008

This implementation represents **Rollback ID: 2025-01-20-008** - Phase 1 RAG Index System completion.

Ready for user testing and feedback to inform Phase 2 development!
