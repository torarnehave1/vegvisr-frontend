-- Test the graph creation versioning fix
-- This script can be used to verify the fix is working correctly

-- Step 1: Clean up any existing test graph
DELETE FROM knowledge_graph_history WHERE graph_id = 'test_graph_creation_fix';
DELETE FROM knowledge_graphs WHERE id = 'test_graph_creation_fix';

-- Step 2: Verify the graph doesn't exist
SELECT 'Before creation - Graph exists?' as step, 
       COUNT(*) as graph_count 
FROM knowledge_graphs 
WHERE id = 'test_graph_creation_fix';

SELECT 'Before creation - History exists?' as step, 
       COUNT(*) as history_count 
FROM knowledge_graph_history 
WHERE graph_id = 'test_graph_creation_fix';

-- Step 3: After running the frontend code to create a new graph, verify it worked:
-- (Run this AFTER creating the graph through the UI)

-- Check if the graph was created in the main table
SELECT 'After creation - Graph exists?' as step,
       id, title, created_by, created_date, updated_at
FROM knowledge_graphs 
WHERE id = 'test_graph_creation_fix';

-- Check if version 1 was created in the history table
SELECT 'After creation - History exists?' as step,
       graph_id, version, timestamp,
       json_extract(data, '$.metadata.version') as metadata_version,
       json_extract(data, '$.metadata.title') as title
FROM knowledge_graph_history 
WHERE graph_id = 'test_graph_creation_fix'
ORDER BY version DESC;

-- Expected results:
-- 1. Main table should have 1 row with the new graph
-- 2. History table should have 1 row with version = 1
-- 3. metadata.version in the data field should also be 1
