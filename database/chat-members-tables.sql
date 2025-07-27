-- Chat Room Member Management - Core Tables
-- Execute against vegvisr_org D1 database
-- Step 1: Create the essential tables for member management

-- Site Room Memberships (for current site_chat_rooms)
CREATE TABLE site_room_members (
    id TEXT PRIMARY KEY,                   -- UUID for membership record
    room_id TEXT NOT NULL,                 -- References site_chat_rooms.room_id
    user_id TEXT NOT NULL,                 -- References config.user_id
    role TEXT DEFAULT 'member',            -- 'owner', 'moderator', 'member'
    status TEXT DEFAULT 'active',          -- 'active', 'muted', 'banned', 'left'
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME,               -- Last message or activity
    notification_settings JSON,           -- Per-user notification preferences
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chat Room Memberships (for future professional/graph-specific rooms)
CREATE TABLE chat_room_members (
    id TEXT PRIMARY KEY,                   -- UUID for membership record
    room_id TEXT NOT NULL,                 -- References chat_rooms.room_id or site_chat_rooms.room_id
    user_id TEXT NOT NULL,                 -- References config.user_id
    invited_by TEXT,                       -- References config.user_id (who sent invitation)
    role TEXT DEFAULT 'member',            -- 'owner', 'moderator', 'member'
    status TEXT DEFAULT 'invited',         -- 'invited', 'active', 'declined', 'removed', 'left'
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,                 -- When user accepted/declined
    joined_at DATETIME,                    -- When user first joined the room
    last_activity DATETIME,               -- Last message or activity
    invitation_message TEXT,              -- Personal message from inviter
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Chat Preferences and Settings
CREATE TABLE user_chat_preferences (
    user_id TEXT PRIMARY KEY,             -- References config.user_id
    email_notifications INTEGER DEFAULT 1, -- 0/1 for disable/enable
    push_notifications INTEGER DEFAULT 1,  -- For future mobile app
    auto_join_rooms INTEGER DEFAULT 0,     -- Auto-accept invitations from followed users
    discovery_visible INTEGER DEFAULT 1,   -- Visible in user search for invitations
    preferred_name TEXT,                   -- Display name in chat (defaults to config data)
    status_message TEXT,                   -- Professional status message
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
); 