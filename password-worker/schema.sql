-- Password Worker Database Schema
-- Create table for storing graph password hashes

CREATE TABLE IF NOT EXISTS graph_passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    graph_id TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    notes TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_graph_passwords_graph_id ON graph_passwords(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_passwords_created_at ON graph_passwords(created_at);

-- Insert demo protected graphs for testing
INSERT OR IGNORE INTO graph_passwords (graph_id, password_hash, notes) VALUES 
    ('demo-protected', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiS.lCc56.8O', 'Demo graph with password: demo123'),
    ('private-graph-123', '$2a$12$8K9PoLnF5q2HwQTzK6VQ6eaFvWwWR8YW3VtKj7fJ9mJxV8dT3pQ.e', 'Demo graph with password: secret456');

-- Select to verify data
SELECT * FROM graph_passwords;
