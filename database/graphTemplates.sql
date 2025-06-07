CREATE TABLE IF NOT EXISTS graphTemplates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nodes TEXT NOT NULL,
    edges TEXT NOT NULL,
    ai_instructions TEXT,
    category TEXT DEFAULT 'General',
    thumbnail_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_graphTemplates_category ON graphTemplates(category);
CREATE INDEX IF NOT EXISTS idx_graphTemplates_created_at ON graphTemplates(created_at);

-- Create a trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_graphTemplates_timestamp
AFTER UPDATE ON graphTemplates
BEGIN
  UPDATE graphTemplates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Insert the Gantt template
INSERT OR REPLACE INTO graphTemplates (
    id,
    name,
    nodes,
    edges,
    ai_instructions,
    category,
    thumbnail_path
) VALUES (
    'gantt-template-001',
    'Gantt Chart Template',
    '[
        {
            "id": "gantt-node",
            "label": "Project Timeline",
            "type": "gantt",
            "info": "Create a Gantt chart to visualize your project timeline. Include tasks, start dates, end dates, and dependencies.",
            "color": "#4a90e2",
            "bibl": [],
            "imageWidth": "100%",
            "imageHeight": "400px",
            "visible": true
        }
    ]',
    '[]',
    'Generate a Gantt chart with the following structure:
1. Project phases and milestones
2. Task dependencies and relationships
3. Start and end dates for each task
4. Progress tracking indicators
5. Resource allocation if applicable

Format the data in a way that can be easily visualized as a Gantt chart.',
    'Project Management',
    'https://vegvisr.imgix.net/gantt.png?w=150&h=125&fit=crop&crop=entropy&auto=format,enhance&q=60'
);