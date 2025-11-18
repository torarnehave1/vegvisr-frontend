-- API Token System Database Migration
-- Version: 1.0.0
-- Date: 2025-11-18

-- ============================================
-- Table: api_tokens
-- Stores API token information for users
-- ============================================
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  token_name TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '[]',
  rate_limit INTEGER DEFAULT 1000,
  expires_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,
  metadata TEXT DEFAULT '{}'
);

-- Indexes for api_tokens
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
CREATE INDEX IF NOT EXISTS idx_api_tokens_is_active ON api_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_api_tokens_expires_at ON api_tokens(expires_at);

-- ============================================
-- Table: api_token_usage
-- Tracks usage and analytics for API tokens
-- ============================================
CREATE TABLE IF NOT EXISTS api_token_usage (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for api_token_usage
CREATE INDEX IF NOT EXISTS idx_api_token_usage_token_id ON api_token_usage(token_id);
CREATE INDEX IF NOT EXISTS idx_api_token_usage_created_at ON api_token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_token_usage_user_id ON api_token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_token_usage_endpoint ON api_token_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_token_usage_status_code ON api_token_usage(status_code);

-- ============================================
-- Table: api_scopes
-- Defines available API scopes and permissions
-- ============================================
CREATE TABLE IF NOT EXISTS api_scopes (
  id TEXT PRIMARY KEY,
  scope_name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  requires_admin INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default scopes
INSERT OR IGNORE INTO api_scopes (id, scope_name, description, category, requires_admin) VALUES
  ('scope_ai_chat', 'ai:chat', 'Access to AI chat endpoints', 'AI', 0),
  ('scope_graph_read', 'graph:read', 'Read knowledge graphs', 'Graph', 0),
  ('scope_graph_write', 'graph:write', 'Create and update knowledge graphs', 'Graph', 0),
  ('scope_graph_delete', 'graph:delete', 'Delete knowledge graphs', 'Graph', 0),
  ('scope_node_create', 'node:create', 'Create nodes in graphs', 'Node', 0),
  ('scope_node_update', 'node:update', 'Update existing nodes', 'Node', 0),
  ('scope_node_delete', 'node:delete', 'Delete nodes', 'Node', 0),
  ('scope_template_read', 'template:read', 'Read templates', 'Template', 0),
  ('scope_template_write', 'template:write', 'Create and update templates', 'Template', 0),
  ('scope_template_delete', 'template:delete', 'Delete templates', 'Template', 0),
  ('scope_user_read', 'user:read', 'Read user profile', 'User', 0),
  ('scope_user_write', 'user:write', 'Update user profile', 'User', 0),
  ('scope_analytics_read', 'analytics:read', 'Access analytics data', 'Analytics', 0),
  ('scope_admin_all', 'admin:all', 'Full administrative access', 'Admin', 1);

-- ============================================
-- Table: api_rate_limits
-- Track rate limit consumption in real-time
-- ============================================
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for api_rate_limits
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_token_id ON api_rate_limits(token_id);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window ON api_rate_limits(window_start, window_end);

-- ============================================
-- Views for Analytics
-- ============================================

-- Daily usage statistics per token
CREATE VIEW IF NOT EXISTS v_token_daily_stats AS
SELECT 
  token_id,
  DATE(created_at) as usage_date,
  COUNT(*) as total_requests,
  SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_requests,
  SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failed_requests,
  AVG(response_time_ms) as avg_response_time,
  MAX(response_time_ms) as max_response_time,
  MIN(response_time_ms) as min_response_time
FROM api_token_usage
GROUP BY token_id, DATE(created_at);

-- Token usage summary
CREATE VIEW IF NOT EXISTS v_token_usage_summary AS
SELECT 
  t.id,
  t.token_name,
  t.token_prefix,
  t.user_id,
  t.rate_limit,
  t.is_active,
  t.last_used_at,
  t.created_at,
  COUNT(u.id) as total_requests,
  SUM(CASE WHEN u.created_at > datetime('now', '-1 hour') THEN 1 ELSE 0 END) as requests_last_hour,
  SUM(CASE WHEN u.created_at > datetime('now', '-1 day') THEN 1 ELSE 0 END) as requests_last_day
FROM api_tokens t
LEFT JOIN api_token_usage u ON t.id = u.token_id
GROUP BY t.id;

-- ============================================
-- Triggers
-- ============================================

-- Auto-update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS trg_api_tokens_updated_at
AFTER UPDATE ON api_tokens
FOR EACH ROW
BEGIN
  UPDATE api_tokens SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Clean up old usage data (keep last 90 days)
-- Note: This would typically be run as a scheduled job
-- CREATE TRIGGER IF NOT EXISTS trg_cleanup_old_usage
-- AFTER INSERT ON api_token_usage
-- BEGIN
--   DELETE FROM api_token_usage 
--   WHERE created_at < datetime('now', '-90 days');
-- END;

-- ============================================
-- Sample Queries for Testing
-- ============================================

-- Get all active tokens for a user
-- SELECT * FROM api_tokens WHERE user_id = ? AND is_active = 1;

-- Get token usage in last 24 hours
-- SELECT * FROM api_token_usage 
-- WHERE token_id = ? 
-- AND created_at > datetime('now', '-1 day')
-- ORDER BY created_at DESC;

-- Check if token has exceeded rate limit
-- SELECT COUNT(*) as requests_this_hour
-- FROM api_token_usage
-- WHERE token_id = ?
-- AND created_at > datetime('now', '-1 hour');

-- Get most used endpoints for a token
-- SELECT endpoint, COUNT(*) as count
-- FROM api_token_usage
-- WHERE token_id = ?
-- GROUP BY endpoint
-- ORDER BY count DESC
-- LIMIT 10;
