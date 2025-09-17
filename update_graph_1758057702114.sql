-- SQL Script to Update Graph graph_1758057702114
-- This script fixes the version and metadata issues for the YouTube transcript-generated graph

-- =============================================
-- STEP 1: Check current state of the graph
-- =============================================
SELECT 
    id,
    json_extract(metadata, '$.version') as current_version,
    json_extract(metadata, '$.title') as title,
    json_extract(metadata, '$.createdBy') as created_by,
    json_extract(metadata, '$.updatedAt') as updated_at,
    length(nodes) as nodes_length,
    length(edges) as edges_length
FROM knowledge_graphs 
WHERE id = 'graph_1758057702114';

-- =============================================
-- STEP 2: Update the graph metadata with proper versioning
-- =============================================
UPDATE knowledge_graphs 
SET 
    metadata = json_set(
        COALESCE(metadata, '{}'),
        '$.version', 1,
        '$.updatedAt', datetime('now'),
        '$.title', COALESCE(json_extract(metadata, '$.title'), 'Transcript Knowledge Graph'),
        '$.description', COALESCE(json_extract(metadata, '$.description'), 'Generated from YouTube video transcript'),
        '$.category', COALESCE(json_extract(metadata, '$.category'), 'transcript,youtube,ai-generated'),
        '$.metaArea', COALESCE(json_extract(metadata, '$.metaArea'), 'knowledge extraction'),
        '$.createdBy', COALESCE(json_extract(metadata, '$.createdBy'), 'system'),
        '$.createdAt', COALESCE(json_extract(metadata, '$.createdAt'), datetime('now'))
    )
WHERE id = 'graph_1758057702114';

-- =============================================
-- STEP 3: Create initial version history entry
-- =============================================
INSERT OR REPLACE INTO knowledge_graph_history (
    graph_id,
    version,
    nodes,
    edges,
    metadata,
    saved_at,
    saved_by
)
SELECT 
    id as graph_id,
    1 as version,
    nodes,
    edges,
    metadata,
    datetime('now') as saved_at,
    COALESCE(json_extract(metadata, '$.createdBy'), 'system') as saved_by
FROM knowledge_graphs 
WHERE id = 'graph_1758057702114';

-- =============================================
-- STEP 4: Verify the update
-- =============================================
SELECT 
    id,
    json_extract(metadata, '$.version') as version,
    json_extract(metadata, '$.title') as title,
    json_extract(metadata, '$.createdBy') as created_by,
    json_extract(metadata, '$.updatedAt') as updated_at,
    json_extract(metadata, '$.category') as category,
    json_extract(metadata, '$.metaArea') as meta_area
FROM knowledge_graphs 
WHERE id = 'graph_1758057702114';

-- =============================================
-- STEP 5: Verify history entry was created
-- =============================================
SELECT 
    graph_id,
    version,
    saved_at,
    saved_by,
    json_extract(metadata, '$.title') as title
FROM knowledge_graph_history 
WHERE graph_id = 'graph_1758057702114'
ORDER BY version DESC;

-- =============================================
-- OPTIONAL: If you need to update specific metadata fields
-- =============================================

-- Update title if needed:
-- UPDATE knowledge_graphs 
-- SET metadata = json_set(metadata, '$.title', 'Your New Title Here')
-- WHERE id = 'graph_1758057702114';

-- Update description if needed:
-- UPDATE knowledge_graphs 
-- SET metadata = json_set(metadata, '$.description', 'Your New Description Here')
-- WHERE id = 'graph_1758057702114';

-- Update created by if needed:
-- UPDATE knowledge_graphs 
-- SET metadata = json_set(metadata, '$.createdBy', 'your-email@example.com')
-- WHERE id = 'graph_1758057702114';

-- =============================================
-- TROUBLESHOOTING: If the graph doesn't exist, create it
-- =============================================

-- Check if graph exists:
-- SELECT COUNT(*) as graph_exists FROM knowledge_graphs WHERE id = 'graph_1758057702114';

-- If it doesn't exist, you may need to create it:
-- INSERT INTO knowledge_graphs (id, nodes, edges, metadata)
-- VALUES (
--     'graph_1758057702114',
--     '[]', -- Empty nodes array - replace with actual nodes JSON
--     '[]', -- Empty edges array - replace with actual edges JSON
--     json('{"version": 1, "title": "Transcript Knowledge Graph", "description": "Generated from YouTube video transcript", "createdBy": "your-email@example.com", "createdAt": "' || datetime('now') || '", "updatedAt": "' || datetime('now') || '", "category": "transcript,youtube,ai-generated", "metaArea": "knowledge extraction"}')
-- );
