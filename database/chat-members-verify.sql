-- Chat Room Member Management - Verification Queries
-- Execute against vegvisr_org D1 database
-- Step 4: Verify tables and data were created successfully

-- Check that all tables were created
SELECT name FROM sqlite_master 
WHERE type='table' AND (
    name='site_room_members' OR 
    name='chat_room_members' OR 
    name='user_chat_preferences'
)
ORDER BY name;

-- Check that all indexes were created
SELECT name FROM sqlite_master 
WHERE type='index' AND name LIKE '%chat%'
ORDER BY name;

-- Count records in each table
SELECT 
    'site_room_members' as table_name, 
    COUNT(*) as record_count 
FROM site_room_members
UNION ALL
SELECT 
    'chat_room_members' as table_name, 
    COUNT(*) as record_count 
FROM chat_room_members
UNION ALL
SELECT 
    'user_chat_preferences' as table_name, 
    COUNT(*) as record_count 
FROM user_chat_preferences;

-- Show sample of populated data
SELECT 
    srm.room_id,
    scr.room_name,
    srm.user_id,
    srm.role,
    srm.status,
    srm.joined_at
FROM site_room_members srm
LEFT JOIN site_chat_rooms scr ON srm.room_id = scr.room_id
LIMIT 10; 