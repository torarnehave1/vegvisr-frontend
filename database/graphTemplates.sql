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

-- Insert the Menu Creator template
INSERT OR REPLACE INTO graphTemplates (
    id,
    name,
    nodes,
    edges,
    ai_instructions,
    category,
    thumbnail_path
) VALUES (
    'menu-creator-template-001',
    'Menu Creator',
    '[
        {
            "id": "menu-creator-001",
            "label": "📝 Menu Creator",
            "type": "menu_creator",
            "info": "{\"name\": \"New Menu Template\", \"description\": \"Create a new menu template with JSON editor and modal interface\", \"menuLevel\": \"graph\", \"items\": [{\"id\": \"home\", \"label\": \"Home\", \"icon\": \"🏠\", \"type\": \"route\", \"path\": \"/\", \"requiresRole\": null}, {\"id\": \"portfolio\", \"label\": \"Portfolio\", \"icon\": \"📁\", \"type\": \"route\", \"path\": \"/graph-portfolio\", \"requiresRole\": null}], \"style\": {\"layout\": \"horizontal\", \"theme\": \"default\", \"position\": \"top\", \"buttonStyle\": \"hamburger\"}}",
            "color": "#f0f8ff",
            "bibl": [],
            "imageWidth": "100%",
            "imageHeight": "100%",
            "visible": true,
            "path": null
        }
    ]',
    '[]',
    'Create and edit menu templates directly in the knowledge graph. Use the JSON editor to customize menu items, styles, and behavior. The modal interface provides advanced editing capabilities with validation and preview features.',
    'Interactive',
    null
);

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