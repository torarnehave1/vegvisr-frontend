-- Vector Search Database Tables
-- This file contains the database schema for vector search functionality
-- Run with: npx wrangler d1 execute vegvisr_org --remote --config=vector-search-worker/wrangler.toml --file=database/vector_embeddings.sql

-- Table to track vectorized content metadata
-- Note: Actual vector embeddings are stored in Cloudflare Vectorize
-- This table tracks what content has been vectorized and provides metadata
CREATE TABLE vector_embeddings (
    id TEXT PRIMARY KEY,              -- Unique identifier for the embedding record
    graph_id TEXT NOT NULL,           -- ID of the knowledge graph
    node_id TEXT,                     -- ID of the specific node (NULL for graph-level embeddings)
    embedding_type TEXT NOT NULL,     -- Type: 'graph_summary', 'node_content', 'node_label', 'batch_index'
    content_hash TEXT NOT NULL,       -- SHA256 hash of the content to detect changes
    content_preview TEXT,             -- First 200 chars of content for debugging/preview
    vector_id TEXT NOT NULL,          -- ID used in Cloudflare Vectorize for the actual vector
    indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- When this content was vectorized
    metadata TEXT,                    -- JSON metadata about the embedding
    FOREIGN KEY (graph_id) REFERENCES knowledge_graphs (id) ON DELETE CASCADE
);

-- Table to track search analytics and usage patterns
CREATE TABLE search_analytics (
    id TEXT PRIMARY KEY,              -- Unique identifier for the search record
    user_id TEXT,                     -- ID of the user who performed the search (if available)
    query TEXT NOT NULL,              -- The search query
    search_type TEXT NOT NULL,        -- Type: 'vector', 'keyword', 'hybrid', 'smart'
    results_count INTEGER DEFAULT 0,  -- Number of results returned
    clicked_result_id TEXT,           -- ID of the graph the user clicked on
    response_time_ms INTEGER,         -- Time taken to process the search
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, -- When the search was performed
    session_id TEXT,                  -- Optional session identifier
    metadata TEXT                     -- JSON metadata about the search context
);

-- Indexes for performance optimization
CREATE INDEX idx_vector_embeddings_graph_id ON vector_embeddings(graph_id);
CREATE INDEX idx_vector_embeddings_type ON vector_embeddings(embedding_type);
CREATE INDEX idx_vector_embeddings_hash ON vector_embeddings(content_hash);
CREATE INDEX idx_vector_embeddings_indexed_at ON vector_embeddings(indexed_at);

CREATE INDEX idx_search_analytics_query ON search_analytics(query);
CREATE INDEX idx_search_analytics_type ON search_analytics(search_type);
CREATE INDEX idx_search_analytics_timestamp ON search_analytics(timestamp);
CREATE INDEX idx_search_analytics_user_id ON search_analytics(user_id);

-- Initial system record will be created when first graph is indexed
-- This avoids foreign key constraint issues during table creation 