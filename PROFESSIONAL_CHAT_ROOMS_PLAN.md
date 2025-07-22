# Professional Chat Rooms Implementation Plan

**Invitation-Based Chat System for Knowledge Graph Discussions**

_Transform from open-access to invitation-controlled professional chat rooms_

**Version:** 1.0  
**Date:** January 2025  
**Approach:** Dedicated Chat Interface with Graph Context

---

## 🎯 **Vision Statement**

> "Create professional discussion rooms where graph owners invite specific colleagues to have focused, contextual conversations around their knowledge graphs - like Telegram for professional insights."

### **Key Requirements**

- ✅ **Graph Owner Control**: Only graph creators can create and manage chat rooms
- ✅ **Invitation-Only Access**: Users must be invited to join discussions
- ✅ **Registered User Base**: Invite from existing `config` table users
- ✅ **Dedicated Interface**: Separate chat app (not embedded in graph viewer)
- ✅ **Graph Context**: Discussions tied to specific knowledge graphs
- ✅ **Professional UX**: Clean, business-appropriate interface like Telegram

---

## 🗄️ **Database Schema**

### **SQL Table Creation Commands**

**Execute these commands against the `vegvisr_org` D1 database:**

```sql
-- Chat Room Metadata
CREATE TABLE chat_rooms (
    room_id TEXT PRIMARY KEY,              -- Same as graph_id for simplicity
    graph_id TEXT NOT NULL,                -- References knowledge_graphs.id
    owner_id TEXT NOT NULL,                -- References config.user_id (graph creator)
    title TEXT NOT NULL,                   -- Room display name (defaults to graph title)
    description TEXT,                      -- Room purpose/description
    graph_title TEXT,                      -- Cached graph title for quick access
    graph_created_date TEXT,               -- Cached graph creation date
    room_status TEXT DEFAULT 'active',     -- 'active', 'archived', 'disabled'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chat Room Memberships and Invitations
CREATE TABLE chat_room_members (
    id TEXT PRIMARY KEY,                   -- UUID for membership record
    room_id TEXT NOT NULL,                 -- References chat_rooms.room_id
    user_id TEXT NOT NULL,                 -- References config.user_id
    invited_by TEXT NOT NULL,              -- References config.user_id (who sent invitation)
    role TEXT DEFAULT 'member',            -- 'owner', 'moderator', 'member'
    status TEXT DEFAULT 'invited',         -- 'invited', 'active', 'declined', 'removed', 'left'
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,                 -- When user accepted/declined
    joined_at DATETIME,                    -- When user first joined the room
    last_activity DATETIME,               -- Last message or activity
    invitation_message TEXT,               -- Personal message from inviter
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

-- Indexes for Performance
CREATE INDEX idx_chat_rooms_owner ON chat_rooms(owner_id);
CREATE INDEX idx_chat_rooms_graph ON chat_rooms(graph_id);
CREATE INDEX idx_chat_members_room ON chat_room_members(room_id);
CREATE INDEX idx_chat_members_user ON chat_room_members(user_id);
CREATE INDEX idx_chat_members_status ON chat_room_members(status);
CREATE INDEX idx_chat_members_invited_by ON chat_room_members(invited_by);

-- Initial Data Population
-- Automatically create chat rooms for existing graphs (owners can invite as needed)
INSERT INTO chat_rooms (room_id, graph_id, owner_id, title, description, graph_title)
SELECT
    id as room_id,
    id as graph_id,
    created_by as owner_id,
    title as title,
    'Professional discussion room for this knowledge graph' as description,
    title as graph_title
FROM knowledge_graphs
WHERE created_by IS NOT NULL;

-- Add room owners as active members
INSERT INTO chat_room_members (id, room_id, user_id, invited_by, role, status, joined_at)
SELECT
    room_id || '_owner' as id,
    room_id,
    owner_id as user_id,
    owner_id as invited_by,
    'owner' as role,
    'active' as status,
    datetime('now') as joined_at
FROM chat_rooms;
```

---

## 🏗️ **Backend Architecture**

### **Updated Chat Worker API Endpoints**

**Base URL**: `https://durable-chat-template.torarnehave.workers.dev`

#### **Room Management**

```javascript
// Create new chat room (graph owners only)
POST /create-room
{
  "graphId": "graph_123",
  "title": "Q4 Strategy Discussion",
  "description": "Collaborative analysis of Q4 market trends",
  "ownerId": "user_456"
}

// Get user's accessible chat rooms
GET /my-rooms?userId=user_123
Response: {
  "rooms": [
    {
      "roomId": "graph_123",
      "title": "Q4 Strategy Discussion",
      "description": "Collaborative analysis...",
      "graphTitle": "Market Analysis Q4 2024",
      "memberCount": 5,
      "unreadCount": 3,
      "lastActivity": "2025-01-15T10:30:00Z",
      "myRole": "owner"
    }
  ]
}

// Get room details and member list
GET /room/{roomId}/info
Response: {
  "room": {...},
  "members": [
    {
      "userId": "user_123",
      "userName": "Jane Smith",
      "role": "owner",
      "status": "active",
      "lastActivity": "2025-01-15T10:30:00Z"
    }
  ],
  "graph": {
    "id": "graph_123",
    "title": "Market Analysis Q4 2024",
    "nodeCount": 25
  }
}
```

#### **Invitation Management**

```javascript
// Invite users to chat room (owners/moderators only)
POST /invite-user
{
  "roomId": "graph_123",
  "userIds": ["user_789", "user_101"],
  "inviterId": "user_456",
  "message": "Join our Q4 strategy discussion!"
}

// Get user's pending invitations
GET /my-invitations?userId=user_123
Response: {
  "invitations": [
    {
      "roomId": "graph_123",
      "roomTitle": "Q4 Strategy Discussion",
      "graphTitle": "Market Analysis Q4 2024",
      "invitedBy": "Jane Smith",
      "inviterEmail": "jane@company.com",
      "message": "Join our Q4 strategy discussion!",
      "invitedAt": "2025-01-15T09:00:00Z"
    }
  ]
}

// Accept or decline invitation
POST /respond-invitation
{
  "roomId": "graph_123",
  "userId": "user_123",
  "response": "accept", // or "decline"
  "message": "Looking forward to the discussion!"
}

// Remove member from room (owners only)
DELETE /remove-member
{
  "roomId": "graph_123",
  "userId": "user_789",
  "removedBy": "user_456",
  "reason": "No longer on project team"
}
```

#### **User Discovery**

```javascript
// Search registered users for invitations
GET /search-users?query=jane&limit=10&excludeRoom=graph_123
Response: {
  "users": [
    {
      "userId": "user_789",
      "email": "jane@company.com",
      "name": "Jane Consultant",
      "bio": "Strategy consultant specializing in market analysis",
      "profileImage": "https://...",
      "alreadyInvited": false,
      "lastActive": "2025-01-14T15:30:00Z"
    }
  ]
}

// Check if user has access to room
GET /check-access?roomId=graph_123&userId=user_123
Response: {
  "hasAccess": true,
  "role": "member",
  "status": "active"
}
```

#### **Enhanced WebSocket & Chat**

```javascript
// WebSocket connection (now requires room membership)
wss://durable-chat-template.torarnehave.workers.dev/chat/{roomId}?userId={userId}&userName={userName}

// Connection validates membership before accepting
// Returns 403 if user not invited/accepted
```

### **Durable Object Updates**

**`ChatRoom.js` enhancements:**

```javascript
export class Chat {
  // Add access control to WebSocket connections
  async handleWebSocketUpgrade(request) {
    // Verify user has active membership in this room
    const hasAccess = await this.checkRoomAccess(userId, graphId)
    if (!hasAccess) {
      return new Response('Access denied', { status: 403 })
    }

    // Existing WebSocket logic...
  }

  async checkRoomAccess(userId, roomId) {
    // Query chat_room_members table via service binding
    const response = await this.env.MAIN_WORKER.fetch(
      new Request(`https://vegvisr-frontend.torarnehave.workers.dev/check-room-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roomId }),
      }),
    )
    const { hasAccess } = await response.json()
    return hasAccess
  }
}
```

---

## 🎨 **Frontend Components**

### **New Vue Components**

#### **1. ChatRoomList.vue** - Main Chat Interface

```vue
<template>
  <div class="chat-rooms-container">
    <!-- Header with user info -->
    <div class="chat-header">
      <h3>💬 Professional Chat Rooms</h3>
      <div class="user-status">
        <img :src="userStore.profileImage" class="profile-avatar" />
        <span>{{ userStore.user_name }}</span>
      </div>
    </div>

    <!-- Pending Invitations Alert -->
    <div v-if="pendingInvitations.length > 0" class="invitations-alert">
      <div class="alert alert-info">
        <strong>{{ pendingInvitations.length }} pending invitation(s)</strong>
        <button @click="showInvitations = true" class="btn btn-sm btn-outline-primary">
          View Invitations
        </button>
      </div>
    </div>

    <!-- Room List -->
    <div class="rooms-list">
      <div
        v-for="room in myRooms"
        :key="room.roomId"
        @click="openRoom(room.roomId)"
        class="room-item"
        :class="{ unread: room.unreadCount > 0 }"
      >
        <div class="room-info">
          <h5>{{ room.title }}</h5>
          <p class="room-description">{{ room.description }}</p>
          <small class="graph-link">📊 {{ room.graphTitle }}</small>
        </div>
        <div class="room-meta">
          <span v-if="room.unreadCount > 0" class="unread-badge">
            {{ room.unreadCount }}
          </span>
          <small class="last-activity">
            {{ formatTime(room.lastActivity) }}
          </small>
        </div>
      </div>
    </div>

    <!-- Create Room Button (for graph owners) -->
    <router-link to="/chat/create" class="btn btn-primary create-room-btn">
      <i class="bi bi-plus-circle"></i> Create Chat Room
    </router-link>
  </div>
</template>
```

#### **2. ChatRoomView.vue** - Individual Room Interface

```vue
<template>
  <div class="chat-room-view">
    <!-- Room Header -->
    <div class="room-header">
      <button @click="$router.push('/chat')" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-arrow-left"></i> Back
      </button>

      <div class="room-title-area">
        <h4>{{ roomInfo.title }}</h4>
        <small>
          📊
          <router-link :to="`/gnew-viewer?graphId=${roomInfo.graphId}`">
            {{ roomInfo.graphTitle }}
          </router-link>
        </small>
      </div>

      <div class="room-actions">
        <!-- Member count -->
        <span class="member-count">{{ roomInfo.memberCount }} members</span>

        <!-- Room settings (owners only) -->
        <button v-if="isOwner" @click="showSettings = true" class="btn btn-sm btn-outline-primary">
          <i class="bi bi-gear"></i>
        </button>
      </div>
    </div>

    <!-- Enhanced Chat Interface (reuse existing GraphChatPanel logic) -->
    <GraphChatPanel
      :graphId="roomInfo.graphId"
      :roomId="roomId"
      :graphData="graphData"
      :restricted="true"
    />
  </div>
</template>
```

#### **3. InviteUserModal.vue** - User Invitation Interface

```vue
<template>
  <div class="modal fade" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5>Invite Users to {{ roomTitle }}</h5>
        </div>

        <div class="modal-body">
          <!-- User Search -->
          <div class="mb-3">
            <label class="form-label">Search registered users:</label>
            <input
              v-model="searchQuery"
              @input="searchUsers"
              type="text"
              class="form-control"
              placeholder="Search by name or email..."
            />
          </div>

          <!-- User Results -->
          <div class="user-results">
            <div
              v-for="user in searchResults"
              :key="user.userId"
              class="user-item"
              :class="{ selected: selectedUsers.includes(user.userId) }"
              @click="toggleUser(user.userId)"
            >
              <img :src="user.profileImage" class="user-avatar" />
              <div class="user-info">
                <strong>{{ user.name }}</strong>
                <small>{{ user.email }}</small>
                <p class="user-bio">{{ user.bio }}</p>
              </div>
              <div class="user-status">
                <i
                  v-if="selectedUsers.includes(user.userId)"
                  class="bi bi-check-circle-fill text-primary"
                ></i>
                <span v-if="user.alreadyInvited" class="badge bg-secondary">Already invited</span>
              </div>
            </div>
          </div>

          <!-- Invitation Message -->
          <div class="mb-3">
            <label class="form-label">Personal message (optional):</label>
            <textarea
              v-model="invitationMessage"
              class="form-control"
              rows="3"
              placeholder="Join our professional discussion about..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="sendInvitations" class="btn btn-primary">
            Send {{ selectedUsers.length }} Invitation(s)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

#### **4. InvitationsModal.vue** - Pending Invitations

```vue
<template>
  <div class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5>Chat Room Invitations</h5>
        </div>

        <div class="modal-body">
          <div v-for="invitation in invitations" :key="invitation.roomId" class="invitation-item">
            <div class="invitation-details">
              <h6>{{ invitation.roomTitle }}</h6>
              <small>📊 {{ invitation.graphTitle }}</small>
              <p class="invitation-message">"{{ invitation.message }}"</p>
              <small class="invited-by">
                Invited by {{ invitation.invitedBy }} • {{ formatTime(invitation.invitedAt) }}
              </small>
            </div>

            <div class="invitation-actions">
              <button
                @click="respondToInvitation(invitation.roomId, 'accept')"
                class="btn btn-sm btn-success"
              >
                Accept
              </button>
              <button
                @click="respondToInvitation(invitation.roomId, 'decline')"
                class="btn btn-sm btn-outline-secondary"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

### **New Routes**

**`src/router/index.js` additions:**

```javascript
{
  path: '/chat',
  name: 'ChatRooms',
  component: () => import('@/views/ChatRoomsView.vue'),
  meta: { requiresAuth: true, layout: 'chat' }
},
{
  path: '/chat/room/:roomId',
  name: 'ChatRoom',
  component: () => import('@/views/ChatRoomView.vue'),
  meta: { requiresAuth: true, layout: 'chat' }
},
{
  path: '/chat/invitations',
  name: 'ChatInvitations',
  component: () => import('@/views/ChatInvitationsView.vue'),
  meta: { requiresAuth: true, layout: 'chat' }
}
```

---

## 🔗 **Integration Points**

### **1. Graph Viewer Integration**

**Add to `GNewViewer.vue`:**

```vue
<!-- Remove embedded chat panel, add room access button -->
<div class="graph-social-actions">
  <!-- Existing social interaction bar -->
  <SocialInteractionBar :graphId="currentGraphId" :graphData="graphData" />

  <!-- New chat room access -->
  <div class="chat-room-access" v-if="userStore.user_id">
    <button
      v-if="hasRoomAccess"
      @click="openChatRoom"
      class="btn btn-outline-primary btn-sm"
    >
      💬 Join Discussion ({{ roomMemberCount }} members)
    </button>

    <button
      v-else-if="isGraphOwner"
      @click="createChatRoom"
      class="btn btn-primary btn-sm"
    >
      💬 Create Discussion Room
    </button>

    <small v-else class="text-muted">
      💬 Discussion by invitation only
    </small>
  </div>
</div>
```

### **2. Navigation Updates**

**Add to main navigation:**

```vue
<!-- Desktop navigation -->
<li class="nav-item">
  <router-link to="/chat" class="nav-link">
    💬 Chat Rooms
    <span v-if="unreadChatCount > 0" class="badge bg-danger">{{ unreadChatCount }}</span>
  </router-link>
</li>

<!-- Mobile hamburger menu -->
<div class="mobile-nav-item">
  <router-link to="/chat">💬 Chat Rooms</router-link>
</div>
```

### **3. User Dashboard Integration**

**Add chat statistics to user dashboard:**

```vue
<div class="dashboard-section">
  <h5>💬 Chat Activity</h5>
  <div class="chat-stats">
    <div class="stat-item">
      <strong>{{ myRoomsCount }}</strong>
      <small>Active Rooms</small>
    </div>
    <div class="stat-item">
      <strong>{{ pendingInvitationsCount }}</strong>
      <small>Pending Invitations</small>
    </div>
    <div class="stat-item">
      <strong>{{ totalMessagesCount }}</strong>
      <small>Messages Sent</small>
    </div>
  </div>
</div>
```

---

## 📱 **User Experience Flow**

### **For Graph Owners (Room Creators)**

1. **Create Knowledge Graph** → Automatic chat room created
2. **Visit graph** → See "💬 Create Discussion Room" button
3. **Create room** → Set title/description, becomes room owner
4. **Invite colleagues** → Search users, select, add personal message
5. **Manage room** → View members, remove users, archive discussions

### **For Invited Users**

1. **Receive invitation** → Email notification + in-app alert
2. **Review invitation** → See room title, graph context, inviter message
3. **Accept/Decline** → Join room or decline with optional message
4. **Access chat** → Navigate to `/chat`, see room in list
5. **Participate** → Real-time discussions with graph context

### **Navigation Flow**

```
Graph Viewer → "💬 Join Discussion" → Chat Room View
     ↓
Main Menu → "💬 Chat Rooms" → Room List → Select Room → Chat Room View
     ↓
User Dashboard → "3 Pending Invitations" → Invitations Modal → Accept → Room List
```

---

## 🚀 **Implementation Phases**

### **Phase 1: Database & Core Backend (Week 1)**

1. **Database Setup**

   - Execute SQL table creation commands
   - Add indexes for performance
   - Populate initial room data for existing graphs

2. **Chat Worker Updates**

   - Add invitation management endpoints
   - Update WebSocket access control
   - Add user search functionality

3. **Main Worker Integration**
   - Add room access validation endpoints
   - User discovery and search APIs

### **Phase 2: Frontend Core Interface (Week 2)**

1. **New Vue Components**

   - `ChatRoomList.vue` - Room list interface
   - `ChatRoomView.vue` - Individual room view
   - `InviteUserModal.vue` - User invitation interface

2. **Routes & Navigation**

   - Add chat routes to router
   - Update main navigation with chat links
   - Add unread message counters

3. **Basic Room Management**
   - Create/join/leave room functionality
   - Member list and room info display

### **Phase 3: Advanced Features (Week 3)**

1. **Invitation System**

   - `InvitationsModal.vue` component
   - Accept/decline invitation flows
   - Email notifications (future)

2. **User Discovery**

   - Search registered users interface
   - Bulk invitation functionality
   - User profile previews

3. **Room Management**
   - Room settings and member management
   - Archive/disable rooms
   - Moderator roles

### **Phase 4: Integration & Polish (Week 4)**

1. **Graph Viewer Integration**

   - Remove embedded chat panel
   - Add "Join Discussion" buttons
   - Context switching between graph/chat

2. **Dashboard Integration**

   - Chat statistics in user dashboard
   - Recent activity feeds
   - Room recommendations

3. **Mobile Optimization**
   - Responsive chat interface
   - Touch-friendly room navigation
   - Mobile-specific UX improvements

---

## 🔧 **Technical Considerations**

### **Performance Optimizations**

- **Database Indexes** on room membership queries
- **Message Pagination** in chat history
- **User Search Debouncing** to limit API calls
- **Room List Caching** for faster navigation

### **Security Measures**

- **Access Control** validation on all endpoints
- **Owner-Only Actions** for room management
- **Rate Limiting** on invitations and messages
- **Input Sanitization** for room titles and messages

### **Scalability Patterns**

- **Durable Objects** scale per-room automatically
- **Service Bindings** for cross-worker communication
- **Database Connection Pooling** for high-volume queries
- **WebSocket Connection Limits** per room

---

## 🌐 **Site-Wide Branded Chat Rooms**

**Domain-Level Community Discussions with Admin Management**

_Expand from graph-specific rooms to site-wide community chat rooms for branded domains_

### **🎯 Vision Statement**

> "Create domain-wide community chat rooms where SuperAdmins and Admins can establish general discussion spaces for their branded sites - like Telegram channels but integrated with custom domain branding."

### **Key Features**

- ✅ **Domain-Wide Scope**: Chat rooms for entire branded sites (not tied to specific graphs)
- ✅ **Admin-Only Creation**: SuperAdmins and Admins can create and manage site rooms
- ✅ **Branding Integration**: Rooms inherit custom domain logos, themes, and styling
- ✅ **Easy Access**: Chat rooms accessible from main navigation on any page
- ✅ **Independent Interface**: Dedicated chat page with room list and management
- ✅ **Telegram-Like UX**: Simple room creation, member management, and discussion flow

### **🗄️ Extended Database Schema**

**Additional tables for site-wide chat rooms:**

```sql
-- Site-Wide Chat Rooms (separate from graph-specific rooms)
CREATE TABLE site_chat_rooms (
    room_id TEXT PRIMARY KEY,              -- UUID for site room
    domain_name TEXT NOT NULL,             -- References custom domain (e.g., "sweet.norsegong.com")
    room_name TEXT NOT NULL,               -- Display name (e.g., "General Discussion")
    room_description TEXT,                 -- Room purpose description
    room_type TEXT DEFAULT 'public',       -- 'public', 'private', 'announcement'
    created_by TEXT NOT NULL,              -- References config.user_id (Admin/SuperAdmin)
    room_status TEXT DEFAULT 'active',     -- 'active', 'archived', 'disabled'
    member_count INTEGER DEFAULT 0,        -- Cached member count
    last_message_at DATETIME,             -- Last activity timestamp
    room_settings JSON,                    -- Room configuration (notifications, permissions, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Site Room Memberships (extends chat_room_members pattern)
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

-- Domain Chat Configuration (ties rooms to branded domains)
CREATE TABLE domain_chat_config (
    domain_name TEXT PRIMARY KEY,          -- Custom domain (e.g., "sweet.norsegong.com")
    chat_enabled INTEGER DEFAULT 1,        -- 0/1 for disable/enable chat for domain
    default_room_id TEXT,                  -- Default room for new visitors
    welcome_message TEXT,                  -- Welcome message for new members
    domain_theme JSON,                     -- Chat-specific theming (colors, styles)
    moderation_settings JSON,              -- Auto-moderation rules
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX idx_site_rooms_domain ON site_chat_rooms(domain_name);
CREATE INDEX idx_site_rooms_creator ON site_chat_rooms(created_by);
CREATE INDEX idx_site_room_members_room ON site_room_members(room_id);
CREATE INDEX idx_site_room_members_user ON site_room_members(user_id);
CREATE INDEX idx_domain_chat_config_domain ON domain_chat_config(domain_name);
```

### **🏗️ Backend API Extensions**

**New endpoints for site-wide chat management:**

#### **Site Room Management (Admin/SuperAdmin Only)**

```javascript
// Create site-wide room (Admin/SuperAdmin only)
POST /create-site-room
Headers: { "x-user-role": "Superadmin", "x-domain": "sweet.norsegong.com" }
{
  "roomName": "General Discussion",
  "description": "Community discussion for Norse Gong enthusiasts",
  "roomType": "public",
  "domainName": "sweet.norsegong.com",
  "createdBy": "admin@norsegong.com"
}

// Get site rooms for domain
GET /site-rooms?domain=sweet.norsegong.com
Response: {
  "rooms": [
    {
      "roomId": "site_room_001",
      "roomName": "General Discussion",
      "description": "Community discussion...",
      "roomType": "public",
      "memberCount": 25,
      "lastActivity": "2025-01-15T14:30:00Z",
      "branding": {
        "logo": "https://vegvisr.imgix.net/norse-logo.png",
        "theme": "norse-gold",
        "domainTitle": "Norse Gong"
      }
    }
  ]
}

// Get site room details with member list
GET /site-room/{roomId}/details
Response: {
  "room": {...},
  "members": [...],
  "permissions": {
    "canManageRoom": true,
    "canInviteUsers": true,
    "canModerateMessages": false
  }
}

// Update site room (Admin/SuperAdmin only)
PUT /site-room/{roomId}
{
  "roomName": "Updated Discussion",
  "description": "New description",
  "roomType": "private"
}

// Delete site room (SuperAdmin only)
DELETE /site-room/{roomId}
```

#### **Site Room Membership Management**

```javascript
// Join site room (public rooms - any user)
POST /join-site-room
{
  "roomId": "site_room_001",
  "userId": "user_123"
}

// Invite users to site room (Admin/Moderators)
POST /invite-to-site-room
{
  "roomId": "site_room_001",
  "userIds": ["user_456", "user_789"],
  "inviterId": "admin_123",
  "message": "Join our community discussion!"
}

// Remove member from site room (Admin/Moderators)
POST /remove-from-site-room
{
  "roomId": "site_room_001",
  "userId": "user_456",
  "removedBy": "admin_123",
  "reason": "Violation of community guidelines"
}
```

### **🎨 Frontend Components**

#### **1. SiteChatRoomList.vue** - Main Site Chat Interface

```vue
<template>
  <div class="site-chat-container">
    <!-- Branded Header -->
    <div class="chat-header" :style="{ backgroundColor: currentTheme.primaryColor }">
      <img :src="currentLogo" class="site-logo" alt="Site Logo" />
      <div class="header-info">
        <h3>{{ currentSiteTitle }} Community</h3>
        <small>{{ domainName }}</small>
      </div>
      <button v-if="canCreateRooms" @click="showCreateRoom = true" class="btn btn-light btn-sm">
        <i class="bi bi-plus-circle"></i> Create Room
      </button>
    </div>

    <!-- Site Room List -->
    <div class="site-rooms-list">
      <div
        v-for="room in siteRooms"
        :key="room.roomId"
        @click="joinSiteRoom(room.roomId)"
        class="site-room-item"
        :class="{
          'has-activity': room.hasNewMessages,
          'admin-room': room.roomType === 'announcement',
        }"
      >
        <div class="room-icon">
          <i :class="getRoomIcon(room.roomType)"></i>
        </div>
        <div class="room-info">
          <h5>{{ room.roomName }}</h5>
          <p class="room-description">{{ room.description }}</p>
          <div class="room-meta">
            <span class="member-count"> <i class="bi bi-people"></i> {{ room.memberCount }} </span>
            <span class="last-activity">{{ formatTime(room.lastActivity) }}</span>
          </div>
        </div>
        <div class="room-status">
          <span v-if="room.hasNewMessages" class="activity-indicator"></span>
          <i v-if="room.roomType === 'private'" class="bi bi-lock text-muted"></i>
        </div>
      </div>
    </div>

    <!-- Admin Room Management (SuperAdmin/Admin only) -->
    <div v-if="canCreateRooms" class="admin-panel">
      <h6>🛠️ Room Management</h6>
      <div class="admin-actions">
        <button @click="showRoomAnalytics" class="btn btn-outline-info btn-sm">📊 Analytics</button>
        <button @click="showModerationPanel" class="btn btn-outline-warning btn-sm">
          🛡️ Moderation
        </button>
      </div>
    </div>
  </div>
</template>
```

#### **2. SiteChatRoomView.vue** - Individual Site Room Interface

```vue
<template>
  <div class="site-chat-room-view">
    <!-- Branded Room Header -->
    <div class="room-header" :style="{ backgroundColor: currentTheme.primaryColor }">
      <button @click="backToRoomList" class="btn btn-sm btn-light">
        <i class="bi bi-arrow-left"></i> Back
      </button>

      <div class="room-title-area">
        <h4>{{ roomInfo.roomName }}</h4>
        <small>{{ currentSiteTitle }} • {{ roomInfo.memberCount }} members</small>
      </div>

      <div class="room-actions">
        <button @click="showMemberList = true" class="btn btn-sm btn-outline-light">
          <i class="bi bi-people"></i>
        </button>
        <button
          v-if="canManageRoom"
          @click="showRoomSettings = true"
          class="btn btn-sm btn-outline-light"
        >
          <i class="bi bi-gear"></i>
        </button>
      </div>
    </div>

    <!-- Enhanced Chat Interface (reuse existing chat components) -->
    <SiteChatPanel :roomId="roomId" :roomInfo="roomInfo" :branding="currentBranding" />

    <!-- Member List Modal -->
    <SiteRoomMemberModal
      v-if="showMemberList"
      :roomId="roomId"
      :canManage="canManageRoom"
      @close="showMemberList = false"
    />

    <!-- Room Settings Modal (Admin only) -->
    <SiteRoomSettingsModal
      v-if="showRoomSettings && canManageRoom"
      :roomId="roomId"
      :roomInfo="roomInfo"
      @close="showRoomSettings = false"
      @room-updated="updateRoomInfo"
    />
  </div>
</template>
```

#### **3. CreateSiteRoomModal.vue** - Admin Room Creation

```vue
<template>
  <div class="modal fade" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5>Create New Community Room</h5>
          <small class="text-muted">for {{ domainName }}</small>
        </div>

        <div class="modal-body">
          <!-- Room Basic Info -->
          <div class="mb-3">
            <label class="form-label">Room Name:</label>
            <input
              v-model="roomData.roomName"
              type="text"
              class="form-control"
              placeholder="General Discussion, Announcements, Help..."
            />
          </div>

          <div class="mb-3">
            <label class="form-label">Description:</label>
            <textarea
              v-model="roomData.description"
              class="form-control"
              rows="3"
              placeholder="What is this room for?"
            ></textarea>
          </div>

          <!-- Room Type Selection -->
          <div class="mb-3">
            <label class="form-label">Room Type:</label>
            <div class="room-type-selection">
              <div class="form-check">
                <input
                  v-model="roomData.roomType"
                  type="radio"
                  value="public"
                  class="form-check-input"
                  id="type-public"
                />
                <label for="type-public" class="form-check-label">
                  <i class="bi bi-globe"></i> <strong>Public</strong>
                  <small class="d-block text-muted">Anyone can join and participate</small>
                </label>
              </div>

              <div class="form-check">
                <input
                  v-model="roomData.roomType"
                  type="radio"
                  value="private"
                  class="form-check-input"
                  id="type-private"
                />
                <label for="type-private" class="form-check-label">
                  <i class="bi bi-lock"></i> <strong>Private</strong>
                  <small class="d-block text-muted">Invitation only, for specific groups</small>
                </label>
              </div>

              <div class="form-check">
                <input
                  v-model="roomData.roomType"
                  type="radio"
                  value="announcement"
                  class="form-check-input"
                  id="type-announcement"
                />
                <label for="type-announcement" class="form-check-label">
                  <i class="bi bi-megaphone"></i> <strong>Announcement</strong>
                  <small class="d-block text-muted"
                    >Admin-only posting, community can view/react</small
                  >
                </label>
              </div>
            </div>
          </div>

          <!-- Room Preview -->
          <div class="room-preview">
            <h6>Preview:</h6>
            <div class="preview-room-item">
              <div class="room-icon">
                <i :class="getRoomIcon(roomData.roomType)"></i>
              </div>
              <div class="room-info">
                <h6>{{ roomData.roomName || 'Room Name' }}</h6>
                <small>{{ roomData.description || 'Room description...' }}</small>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="createRoom" class="btn btn-primary">
            <i class="bi bi-plus-circle"></i> Create Room
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

### **🔗 Navigation Integration**

#### **Main Navigation Update (TopBar.vue)**

```vue
<!-- Add to main navigation menu -->
<li class="nav-item">
  <router-link 
    :to="`/chat/${currentDomain}`" 
    class="nav-link"
    v-if="isCustomDomain"
  >
    💬 {{ currentSiteTitle }} Chat
    <span v-if="unreadSiteChatCount > 0" class="badge bg-danger">
      {{ unreadSiteChatCount }}
    </span>
  </router-link>
</li>

<!-- For main Vegvisr domain -->
<li class="nav-item">
  <router-link to="/site-chat" class="nav-link" v-else>
    💬 Community Chat
    <span v-if="unreadSiteChatCount > 0" class="badge bg-danger">
      {{ unreadSiteChatCount }}
    </span>
  </router-link>
</li>
```

#### **Floating Chat Button (Optional)**

```vue
<!-- Floating chat access button (like WhatsApp) -->
<div
  v-if="siteHasActiveRooms"
  class="floating-chat-btn"
  @click="toggleQuickChat"
  :style="{ backgroundColor: currentTheme.primaryColor }"
>
  <i class="bi bi-chat-dots"></i>
  <span v-if="unreadSiteChatCount > 0" class="chat-notification">
    {{ unreadSiteChatCount }}
  </span>
</div>
```

### **🎨 Branding Integration**

#### **Automatic Branding Inheritance**

```javascript
// useSiteChatBranding.js composable
export function useSiteChatBranding() {
  const { currentDomain, currentLogo, currentSiteTitle, currentTheme } = useBranding()

  const chatBranding = computed(() => ({
    logo: currentLogo.value,
    siteTitle: currentSiteTitle.value,
    domain: currentDomain.value,
    theme: {
      primary: currentTheme.value.primaryColor || '#007bff',
      secondary: currentTheme.value.secondaryColor || '#6c757d',
      accent: currentTheme.value.accentColor || '#28a745',
    },
    // Chat-specific styling
    chatTheme: {
      headerBackground: currentTheme.value.primaryColor || '#007bff',
      messageBackground: '#f8f9fa',
      userMessageBackground: currentTheme.value.accentColor || '#007bff',
      linkColor: currentTheme.value.primaryColor || '#007bff',
    },
  }))

  return {
    chatBranding,
    currentDomain,
    currentLogo,
    currentSiteTitle,
    currentTheme,
  }
}
```

### **🔐 Admin Permission System**

```javascript
// Site chat room permissions
const canCreateRooms = computed(() => {
  return userStore.role === 'Superadmin' || userStore.role === 'Admin'
})

const canManageRoom = computed(() => {
  if (!roomInfo.value) return false

  // SuperAdmin can manage any room
  if (userStore.role === 'Superadmin') return true

  // Admin can manage rooms on their domain
  if (userStore.role === 'Admin') {
    return isDomainOwner(currentDomain.value, userStore.user_id)
  }

  // Room creator can manage their room
  return roomInfo.value.createdBy === userStore.user_id
})
```

### **🚀 Implementation Strategy**

#### **Phase 1: Database and Backend (Week 1)**

1. **Execute Extended SQL Schema** - Add site chat tables
2. **Update Chat Worker** - Add site room management endpoints
3. **Admin API Integration** - Role-based room creation controls

#### **Phase 2: Basic Site Chat Interface (Week 2)**

1. **Core Components** - `SiteChatRoomList.vue`, `CreateSiteRoomModal.vue`
2. **Navigation Integration** - Add chat links to main menu
3. **Branding Integration** - Inherit domain theming automatically

#### **Phase 3: Advanced Features (Week 3)**

1. **Room Management** - Settings, member management, moderation
2. **Admin Tools** - Analytics, bulk operations, room templates
3. **Mobile Optimization** - Responsive design, touch-friendly interface

#### **Phase 4: Polish and Integration (Week 4)**

1. **Floating Chat Button** - Quick access from any page
2. **Notification System** - Real-time updates, email notifications
3. **Performance Optimization** - Caching, lazy loading, efficient queries

### **📱 User Experience Flows**

#### **For Site Visitors**

1. **Visit branded domain** → See "Community Chat" in navigation
2. **Click chat link** → View public room list for domain
3. **Join room** → Participate in domain-specific discussions
4. **Receive notifications** → Stay engaged with community

#### **For Admins/SuperAdmins**

1. **Access admin interface** → See "Create Room" button
2. **Create room** → Choose type (public/private/announcement)
3. **Manage community** → Invite users, moderate discussions
4. **Monitor engagement** → View analytics and member activity

### **🔗 Integration with Existing Chat System**

- **Coexistence**: Site rooms complement graph-specific rooms
- **Unified Interface**: Both accessible from main chat page
- **Shared Infrastructure**: Same WebSocket system and message storage
- **Clear Separation**: Different visual styling and access patterns

---

## 📊 **Success Metrics**

### **Engagement Metrics**

- Monthly active chat room users
- Average messages per room per day
- Invitation acceptance rate
- Room creation to active discussion ratio

### **Professional Network Growth**

- Cross-team room participation
- Knowledge graph discussion depth
- User retention in active rooms
- Professional connection formation

### **Business Impact**

- Increased knowledge graph engagement
- Extended session duration
- Professional network referrals
- Premium feature adoption

---

## 🎯 **Migration Strategy**

### **From Current System**

1. **Preserve Existing Data**

   - Current chat messages remain in Durable Objects
   - No disruption to current users

2. **Gradual Rollout**

   - Phase 1: Database setup (invisible to users)
   - Phase 2: New interface alongside existing chat
   - Phase 3: Migration prompt for graph owners
   - Phase 4: Deprecate embedded chat panel

3. **User Communication**
   - In-app notifications about new chat system
   - Tutorial for creating and joining rooms
   - Migration assistance for active discussions

### **Rollback Safety**

- **Independent Architecture** - New system doesn't affect existing chat
- **Database Isolation** - New tables don't modify existing data
- **Feature Flags** - Can disable new interface if issues arise
- **Gradual Adoption** - Users can continue with current system during transition

---

## 📋 **Next Steps**

1. **Execute Database Commands** - Create tables in `vegvisr_org` database
2. **Deploy Chat Worker Updates** - Add invitation management APIs
3. **Create Frontend Components** - Start with `ChatRoomList.vue`
4. **Test Invitation Flow** - Invite colleagues to test rooms
5. **Integration Testing** - Verify graph viewer connections

**Ready to transform knowledge graphs into collaborative professional discussion spaces! 🚀💬**
