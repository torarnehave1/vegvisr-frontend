-- knowledge_graph_history had no index on graph_id: every save and version lookup scanned all
-- versions (15,343 rows, 704 MB, 2026-11-22) — ~1,750 scans a day in D1 insights, part of the
-- "D1 DB is overloaded" errors. World stores already carry ux_wg_history_graph_version (unique);
-- here it is non-unique so an old duplicate version row can never block it.
CREATE INDEX IF NOT EXISTS idx_kgh_graph_version ON knowledge_graph_history (graph_id, version);
