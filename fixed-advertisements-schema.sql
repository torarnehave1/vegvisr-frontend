-- Fixed advertisements table schema
CREATE TABLE advertisements (
  id TEXT PRIMARY KEY,
  knowledge_graph_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience TEXT,
  campaign_name TEXT,
  budget REAL,
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  aspect_ratio VARCHAR(20) DEFAULT 'default',
  FOREIGN KEY (knowledge_graph_id) REFERENCES knowledge_graphs(id)
);

-- If you need to add the aspect_ratio column to an existing table:
ALTER TABLE advertisements ADD COLUMN aspect_ratio VARCHAR(20) DEFAULT 'default';

-- Update existing records to have default aspect_ratio if NULL
UPDATE advertisements SET aspect_ratio = 'default' WHERE aspect_ratio IS NULL;
