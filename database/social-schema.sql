-- Social Network Database Schema for Professional Insights Platform
-- Complete isolation from existing database schema

-- Professional connections
CREATE TABLE professional_connections (
    id TEXT PRIMARY KEY,
    follower_id TEXT NOT NULL,     -- References user_id from main-worker
    following_id TEXT NOT NULL,    -- References user_id from main-worker
    connection_type TEXT DEFAULT 'follow', -- 'follow', 'colleague', 'mentor'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Graph-level professional engagement (enhanced with 9 types)
CREATE TABLE graph_insights (
    id TEXT PRIMARY KEY,
    graph_id TEXT NOT NULL,        -- References knowledge_graphs.id from dev-worker
    user_id TEXT NOT NULL,         -- References config.user_id from main-worker
    insight_type TEXT NOT NULL,    -- 'insightful', 'inspired', 'learning', 'bookmark', 'building', 'validating', 'repost', 'question', 'citing'
    repost_comment TEXT,           -- Commentary when reposting/building/questioning
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Node-level professional comments (scalable)
CREATE TABLE node_discussions (
    id TEXT PRIMARY KEY,
    graph_id TEXT NOT NULL,        -- References knowledge_graphs.id
    node_id TEXT NOT NULL,         -- Specific node within the graph
    node_type TEXT NOT NULL,       -- Store node type for filtering ('fulltext', 'worknote', 'notes')
    user_id TEXT NOT NULL,         -- References config.user_id
    comment_text TEXT NOT NULL,
    parent_comment_id TEXT,        -- Threading support
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Configuration table for commentable node types (scalability)
CREATE TABLE commentable_node_types (
    node_type TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 1,     -- 0/1 for disable/enable
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Creator Control: Social engagement settings (isolated in social-worker)
CREATE TABLE graph_social_settings (
    graph_id TEXT PRIMARY KEY,      -- References knowledge_graphs.id from dev-worker
    creator_id TEXT NOT NULL,       -- References config.user_id from main-worker
    engagement_level TEXT DEFAULT 'hybrid', -- 'private', 'graph-only', 'hybrid'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initial commentable types (fulltext, worknote, notes to start)
INSERT INTO commentable_node_types (node_type, display_name) VALUES
    ('fulltext', 'Analysis'),
    ('worknote', 'Working Notes'),
    ('notes', 'Notes');

-- Indexes for performance
CREATE INDEX idx_professional_connections_follower ON professional_connections(follower_id);
CREATE INDEX idx_professional_connections_following ON professional_connections(following_id);
CREATE INDEX idx_graph_insights_graph ON graph_insights(graph_id);
CREATE INDEX idx_graph_insights_user ON graph_insights(user_id);
CREATE INDEX idx_graph_insights_type ON graph_insights(insight_type);
CREATE INDEX idx_node_discussions_graph_node ON node_discussions(graph_id, node_id);
CREATE INDEX idx_node_discussions_user ON node_discussions(user_id);
CREATE INDEX idx_graph_social_settings_creator ON graph_social_settings(creator_id); 