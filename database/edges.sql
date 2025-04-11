CREATE TABLE edges (
    id TEXT PRIMARY KEY,          -- Unique identifier for the edge
    graph_id TEXT NOT NULL,       -- ID of the Knowledge Graph this edge belongs to
    source TEXT NOT NULL,         -- Source node ID
    target TEXT NOT NULL,         -- Target node ID
    weight INTEGER DEFAULT 1,     -- Weight of the edge
    type TEXT,                    -- Type of the edge (e.g., "info")
    info TEXT,                    -- Additional information about the edge
    FOREIGN KEY (graph_id) REFERENCES knowledge_graphs (id), -- Links edge to its graph
    FOREIGN KEY (source) REFERENCES nodes (id),
    FOREIGN KEY (target) REFERENCES nodes (id)
);