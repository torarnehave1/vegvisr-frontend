-- knowledge_graphs metadata indexes  (applied to vegvisr_org remote 2026-09-12)
--
-- Why: every list/aggregate endpoint filtered or sorted on values pulled out of the
-- `data` JSON column. The table holds ~50 MB of graph JSON across ~1200 rows (largest
-- row 3.1 MB), so each of those queries read every blob off disk just to extract a few
-- short strings — a 0.3 s query that spiked to 5-10 s under contention.
--
-- These are SQLite EXPRESSION indexes. The planner only uses one when the query text
-- contains the SAME expression, so the json_valid() guard below must match the
-- `safeJsonDataSql` wrapper used in dev-worker/index.js verbatim. Change one, change both.
--
-- Verified with EXPLAIN QUERY PLAN after creation:
--   /getknowgraphs          -> SCAN USING COVERING INDEX idx_kg_list_cover
--   /getmetaareas           -> SCAN USING COVERING INDEX idx_kg_meta_cover
--   createdBy count         -> SEARCH USING COVERING INDEX idx_kg_created_by_json
-- "COVERING" is the point: the query is answered from the index and never opens `data`.

-- Sort order shared by every recent-first listing.
CREATE INDEX IF NOT EXISTS idx_kg_recent
  ON knowledge_graphs (COALESCE(updated_at, created_date) DESC);

-- Covers /getknowgraphs end to end: sort key, output columns, and the two fields its
-- published-only filter tests.
CREATE INDEX IF NOT EXISTS idx_kg_list_cover ON knowledge_graphs (
  COALESCE(updated_at, created_date) DESC,
  id,
  title,
  created_date,
  updated_at,
  json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.metadata.metaArea'),
  json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.metadata.publicationState'),
  json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.metadata.seoSlug')
);

-- Covers /getmetaareas and the meta-area/creator aggregates.
CREATE INDEX IF NOT EXISTS idx_kg_meta_cover ON knowledge_graphs (
  json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.metadata.metaArea'),
  json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.metadata.category'),
  json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.metadata.createdBy')
);

-- The unguarded form used by the createdBy count/list queries (/getGraphsByUser and
-- the graph-count endpoints), which pass json_extract(data, ...) without the guard.
CREATE INDEX IF NOT EXISTS idx_kg_created_by_json
  ON knowledge_graphs (json_extract(data, '$.metadata.createdBy'));

-- Rollback:
--   DROP INDEX idx_kg_recent;
--   DROP INDEX idx_kg_list_cover;
--   DROP INDEX idx_kg_meta_cover;
--   DROP INDEX idx_kg_created_by_json;
