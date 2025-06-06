CREATE TABLE graphTemplates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    nodes JSONB NOT NULL,
    edges JSONB NOT NULL,
    ai_instructions TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);