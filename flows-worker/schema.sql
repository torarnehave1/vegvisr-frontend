-- VEGR Flows run history (2026-11-06). Lives in vegvisr_org, next to the graphs.
-- The graph is the definition; runs live here so run logs never push the definition's own
-- versions out of the graph's 20-version history. See the "VEGR Flows" graph, node "engine".

CREATE TABLE IF NOT EXISTS flow_runs (
  id            TEXT PRIMARY KEY,          -- also the Workflow instance id
  flow_graph_id TEXT NOT NULL,             -- the #FLOWS graph that was run
  flow_version  INTEGER,                   -- the graph version the spec was compiled from
  owner_email   TEXT NOT NULL,             -- who ran it; only they can read the run
  trigger_id    TEXT NOT NULL DEFAULT 'manual',
  dry_run       INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL,             -- queued | running | waiting (for an approval) | succeeded | failed
  spec_json     TEXT NOT NULL,             -- the pinned, compiled spec this run executes
  inputs_json   TEXT,
  digest        TEXT,                      -- readable summary, written at the end
  error         TEXT,
  created_at    TEXT NOT NULL,
  finished_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_flow_runs_owner ON flow_runs (owner_email, created_at);
CREATE INDEX IF NOT EXISTS idx_flow_runs_graph ON flow_runs (flow_graph_id, created_at);

CREATE TABLE IF NOT EXISTS flow_run_steps (
  run_id      TEXT NOT NULL,
  seq         INTEGER NOT NULL,            -- order the steps ran in
  node_id     TEXT NOT NULL,               -- the flow-step node
  kind        TEXT NOT NULL,
  status      TEXT NOT NULL,               -- ok | simulated | error | refused | waiting | deciding | approved | rejected | sending | calling | sent
  summary     TEXT,                        -- one line for people
  detail_json TEXT,                        -- what was (or in a dry run: would be) done
  edge        TEXT,                        -- the edge label taken out of this step
  at          TEXT NOT NULL,
  PRIMARY KEY (run_id, seq)
);
