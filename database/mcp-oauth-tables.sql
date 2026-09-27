-- MCP / OAuth 2.1 support for knowledge-graph-worker (2026-09-27)
--
-- The OAuth token material itself is NOT here: @cloudflare/workers-oauth-provider keeps
-- clients, grants, authorization codes and tokens in KV (binding OAUTH_KV), hashed. The OTP
-- challenges bound to an authorization live in the same KV under the oauthtx: prefix, with a
-- 15-minute TTL, and are never written to config.phone_verification_code — an OAuth OTP must
-- not double as a durable web session.
--
-- So D1 needs exactly two things: the new scope, and the audit trail.

-- 1. graph:publish. graph:read / graph:write / graph:delete already exist as rows.
--    graph:delete is intentionally NOT granted by default and has no tool in version 1.
INSERT OR IGNORE INTO api_scopes (id, scope_name, description, category, is_active, requires_admin)
VALUES ('scope_graph_publish', 'graph:publish', 'Publish a knowledge graph publicly', 'Graph', 1, 0);

-- 2. The MCP audit trail.
--
-- Records who did what, to which graph, with what outcome and how fast. Deliberately holds NO
-- access token, refresh token, authorization code, OTP, Authorization header or node content:
-- the graph id is enough to find the data through the normal API, and a copy of the content
-- here would just be a second place for it to leak from.
CREATE TABLE IF NOT EXISTS mcp_audit_log (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,             -- ISO 8601, when the call was answered
  user_id TEXT,                 -- the VALIDATED user from the OAuth token, never a tool argument
  client_id TEXT,               -- the OAuth client (e.g. the ChatGPT connector)
  tool TEXT,                    -- MCP tool name, or NULL for tools/list and initialize
  graph_id TEXT,                -- the graph acted on, when the call named one
  result_code TEXT,             -- OK, or a structured code such as VERSION_CONFLICT
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_user_ts ON mcp_audit_log(user_id, ts);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_graph ON mcp_audit_log(graph_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_ts ON mcp_audit_log(ts);
