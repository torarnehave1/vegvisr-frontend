-- Chat Room Member Management - Initial Data Population
-- Execute against vegvisr_org D1 database
-- Step 3: Populate existing room creators as owners

-- Add room creators as active members for existing site_chat_rooms
-- This ensures existing rooms have their creators as owners
INSERT INTO site_room_members (id, room_id, user_id, role, status, joined_at)
SELECT
    room_id || '_owner' as id,
    room_id,
    created_by as user_id,
    'owner' as role,
    'active' as status,
    created_at as joined_at
FROM site_chat_rooms
WHERE room_status = 'active'
  AND created_by IS NOT NULL
  AND created_by NOT IN (
    -- Avoid duplicates if this script is run multiple times
    SELECT user_id FROM site_room_members 
    WHERE room_id = site_chat_rooms.room_id 
    AND role = 'owner'
  ); 