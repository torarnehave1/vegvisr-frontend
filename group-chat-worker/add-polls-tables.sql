-- Polls: stored alongside messages via message_id reference
CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,        -- JSON array of option strings, e.g. ["Yes","No","Maybe"]
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  closed_at INTEGER,            -- NULL = still open
  FOREIGN KEY (group_id) REFERENCES groups(id)
);

-- One vote per user per poll
CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  option_index INTEGER NOT NULL, -- 0-based index into options array
  voted_at INTEGER NOT NULL,
  PRIMARY KEY (poll_id, user_id),
  FOREIGN KEY (poll_id) REFERENCES polls(id)
);

-- Index for fast lookup of unanswered polls per group
CREATE INDEX IF NOT EXISTS idx_polls_group ON polls(group_id, closed_at);
