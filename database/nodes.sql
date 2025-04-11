CREATE TABLE nodes (
    id TEXT PRIMARY KEY,          -- Unique identifier for the node
    graph_id TEXT NOT NULL,       -- ID of the Knowledge Graph this node belongs to
    label TEXT NOT NULL,          -- Display label for the node
    color TEXT NOT NULL,          -- Color of the node
    category TEXT,                   -- Group or category of the node
    has_subgraph BOOLEAN DEFAULT 0, -- Indicates if the node has a subgraph
    size INTEGER DEFAULT 1,       -- Size of the node (e.g., degree or importance)
    type TEXT,                    -- Type of the node (e.g., 'infonode')
    info TEXT,                    -- Additional information about the node (optional)
    FOREIGN KEY (graph_id) REFERENCES knowledge_graphs (id) -- Links node to its graph
);