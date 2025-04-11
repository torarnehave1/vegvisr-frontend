CREATE TABLE knowledge_graphs (
    id TEXT PRIMARY KEY,          -- Unique identifier for the Knowledge Graph
    title TEXT NOT NULL,          -- Title of the Knowledge Graph
    description TEXT,             -- Description of the Knowledge Graph
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP, -- Date the graph was created
    created_by TEXT NOT NULL,     -- Creator of the Knowledge Graph
    parent_graph_id TEXT,         -- ID of the parent graph if this is a subgraph
    data TEXT,                    -- Serialized graph data
    FOREIGN KEY (parent_graph_id) REFERENCES knowledge_graphs (id) -- Self-referencing for subgraphs
);