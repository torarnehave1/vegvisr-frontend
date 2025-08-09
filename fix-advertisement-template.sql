-- Fix the Advertisement Manager template by adding a proper ID
-- This SQL will update the NULL id with a proper UUID-like identifier

UPDATE graphtemplates
SET id = 'advertisement-manager-template-001'
WHERE name = 'Advertisement Manager'
AND id IS NULL;

-- Verify the update
SELECT id, name, type, category, created_at
FROM graphtemplates
WHERE name = 'Advertisement Manager';
