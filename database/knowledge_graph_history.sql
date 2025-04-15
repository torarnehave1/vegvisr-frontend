CREATE TABLE knowledge_graph_history (
    id TEXT PRIMARY KEY,          -- Unique identifier for the history entry
    graph_id TEXT NOT NULL,       -- ID of the Knowledge Graph
    version INTEGER NOT NULL,     -- Version number of the graph
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, -- When the change was made
    data TEXT NOT NULL,           -- Serialized graph data (nodes, edges, metadata)
    FOREIGN KEY (graph_id) REFERENCES knowledge_graphs (id) -- Links to the main graph
);