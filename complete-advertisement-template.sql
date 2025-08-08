-- Complete Advertisement Manager Template
-- This can be used to either INSERT a new template or UPDATE the existing one

-- Option 1: Update existing template (if you want to keep the same created_at date)
UPDATE graphtemplates 
SET 
    id = 'advertisement-manager-template-001',
    nodes = '[{"id":"advertisement_manager_001","label":"Advertisement Manager","type":"advertisement_manager","color":"#4caf50","info":"Central hub for managing advertisements bound to this knowledge graph. Create, monitor, and optimize advertisement campaigns directly from your knowledge graph.","bibl":[],"imageWidth":"100%","imageHeight":"100%","visible":true,"position":{"x":400,"y":300},"data":{"manager_type":"knowledge_graph","graph_binding":true,"api_endpoint":"https://advertisement-worker.torarnehave.workers.dev/api"}}]',
    ai_instructions = '{"format":{"structure":{"type":"advertisement_manager","color":"#4caf50","imageWidth":"100%","imageHeight":"100%","visible":true},"data_format":{"data":{"manager_type":"string - type of advertisement manager","graph_binding":"boolean - whether ads are bound to specific graph","api_endpoint":"string - API endpoint for advertisement worker"}}},"validation":{"required_fields":["label","type"],"manager_types":["knowledge_graph","general","campaign_specific"]},"features":["create_advertisements","manage_campaigns","view_analytics","api_integration"]}',
    description = 'Create and manage advertisements specifically bound to this knowledge graph. Integrate with advertisement worker API for campaign management.',
    category = 'Advertisement',
    thumbnail_path = '/thumbnails/advertisement_manager.png',
    standard_question = 'Create an advertisement manager for this knowledge graph to handle campaign creation and management'
WHERE name = 'Advertisement Manager' AND (id IS NULL OR id = '');

-- Option 2: Insert new template (if the update doesn't work or you want to start fresh)
INSERT OR REPLACE INTO graphtemplates (
    id, 
    name, 
    nodes, 
    edges, 
    created_at, 
    updated_at, 
    description, 
    category, 
    thumbnail_path, 
    standard_question,
    ai_instructions,
    type
) VALUES (
    'advertisement-manager-template-001',
    'Advertisement Manager',
    '[{"id":"advertisement_manager_001","label":"Advertisement Manager","type":"advertisement_manager","color":"#4caf50","info":"Central hub for managing advertisements bound to this knowledge graph. Create, monitor, and optimize advertisement campaigns directly from your knowledge graph.","bibl":[],"imageWidth":"100%","imageHeight":"100%","visible":true,"position":{"x":400,"y":300},"data":{"manager_type":"knowledge_graph","graph_binding":true,"api_endpoint":"https://advertisement-worker.torarnehave.workers.dev/api"}}]',
    '[]',
    datetime('now'),
    datetime('now'),
    'Create and manage advertisements specifically bound to this knowledge graph. Integrate with advertisement worker API for campaign management.',
    'Advertisement',
    '/thumbnails/advertisement_manager.png',
    'Create an advertisement manager for this knowledge graph to handle campaign creation and management',
    '{"format":{"structure":{"type":"advertisement_manager","color":"#4caf50","imageWidth":"100%","imageHeight":"100%","visible":true},"data_format":{"data":{"manager_type":"string - type of advertisement manager","graph_binding":"boolean - whether ads are bound to specific graph","api_endpoint":"string - API endpoint for advertisement worker"}}},"validation":{"required_fields":["label","type"],"manager_types":["knowledge_graph","general","campaign_specific"]},"features":["create_advertisements","manage_campaigns","view_analytics","api_integration"]}',
    'advertisement_manager'
);

-- Verify the template exists with correct ID
SELECT 
    id, 
    name, 
    type, 
    category, 
    description,
    standard_question,
    created_at,
    updated_at
FROM graphtemplates 
WHERE id = 'advertisement-manager-template-001';
