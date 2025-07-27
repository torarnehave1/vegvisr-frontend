-- Chat Room Member Management - Performance Indexes
-- Execute against vegvisr_org D1 database
-- Step 2: Create indexes for fast query performance

-- Indexes for site_room_members
CREATE INDEX idx_site_room_members_room ON site_room_members(room_id);
CREATE INDEX idx_site_room_members_user ON site_room_members(user_id);
CREATE INDEX idx_site_room_members_status ON site_room_members(status);

-- Indexes for chat_room_members
CREATE INDEX idx_chat_room_members_room ON chat_room_members(room_id);
CREATE INDEX idx_chat_room_members_user ON chat_room_members(user_id);
CREATE INDEX idx_chat_room_members_status ON chat_room_members(status);
CREATE INDEX idx_chat_room_members_invited_by ON chat_room_members(invited_by);

-- Indexes for user_chat_preferences
CREATE INDEX idx_user_chat_preferences_user ON user_chat_preferences(user_id); 