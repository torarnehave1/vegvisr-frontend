CREATE TABLE graphWorkNotes (
    id SERIAL PRIMARY KEY,
    graph_id INT NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMES
);
