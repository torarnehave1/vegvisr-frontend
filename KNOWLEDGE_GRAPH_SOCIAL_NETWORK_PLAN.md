# Knowledge Graph Social Network Plan

**Professional Insights Platform**

_Transforming Knowledge Graphs into Social Professional Content_

**Version:** 1.0  
**Date:** January 2025  
**Approach:** Simple, Additive, Non-Disruptive

---

## 🎯 Unique Positioning: "Professional Insights Network"

### Vision Statement

> "Turn your research, analysis, and professional insights into engaging visual content that colleagues want to follow, comment on, and build upon."

### Core Differentiation

**Not Another LinkedIn Clone** - We're creating something entirely new:

- **Rich Visual Insights**: Knowledge graphs are infinitely more valuable than text posts
- **AI-Enhanced Professionalism**: Auto-generate engaging summaries and professional formatting
- **Research-Driven Content**: Perfect for consultants, researchers, analysts, educators
- **Interactive Professional Content**: Followers can explore your insights node-by-node
- **Domain Expertise Showcase**: Visual demonstration of knowledge and thinking processes

**Target Audience:**

- Business analysts and consultants
- Researchers and academics
- Strategy professionals
- Knowledge workers who create visual insights
- Teams collaborating on complex topics

---

## 🏗️ Architecture Strategy: Dedicated Social Worker

**CRITICAL PRINCIPLE: COMPLETE ISOLATION FROM EXISTING FUNCTIONALITY**

### Current Working Systems (ZERO CHANGES)

- ✅ **main-worker**: User auth, profiles, core database operations
- ✅ **api-worker**: AI integrations, external APIs, advanced features
- ✅ **dev-worker**: Knowledge graph operations, AI content generation
- ✅ **GNewViewer**: Modern graph rendering and editing
- ✅ **Sharing System**: External social media sharing with AI summaries
- ✅ **Custom Domains**: Branded professional presentation

### New Dedicated Social Worker (COMPLETELY SEPARATE)

**social-worker** - Professional networking microservice:

- Professional connections (follow/unfollow)
- Insight interactions (like, comment, bookmark)
- Professional feed generation
- User discovery and recommendations
- Social analytics and metrics
- Professional comment threading

### Worker Communication Architecture

```
Frontend Components
    ↓
social-worker (New)     main-worker (Existing)     dev-worker (Existing)
    ↓                        ↓                           ↓
Social Database         User Database              Knowledge Graph Database
    ↓                        ↑                           ↑
Worker-to-Worker Communication for User/Graph Data
```

### Integration Points

```
GNewViewer → Calls social-worker → Gets social data → Displays social components
Social Feed → Calls social-worker → Gets timeline → Calls main-worker for user details
Profile View → Calls main-worker → Gets profile → Calls social-worker for social stats
```

---

## 🚀 Implementation Phases

### Phase 1: Social Worker Foundation (Week 1-2)

**Goal**: Create dedicated social-worker with complete isolation from existing systems

**New social-worker Structure:**

```
social-worker/
├── index.js              -- Main worker entry point
├── database/
│   └── social-schema.sql -- Dedicated social database schema
├── wrangler.toml         -- Worker configuration
└── README.md             -- Social worker documentation
```

**Social Database Tables (Added to Existing vegvisr_org Database):**

```sql
-- Professional connections
CREATE TABLE professional_connections (
    id TEXT PRIMARY KEY,
    follower_id TEXT NOT NULL,     -- References user_id from main-worker
    following_id TEXT NOT NULL,    -- References user_id from main-worker
    connection_type TEXT DEFAULT 'follow', -- 'follow', 'colleague', 'mentor'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Graph-level professional engagement (enhanced)
CREATE TABLE graph_insights (
    id TEXT PRIMARY KEY,
    graph_id TEXT NOT NULL,        -- References knowledge_graphs.id from dev-worker
    user_id TEXT NOT NULL,         -- References config.user_id from main-worker
    insight_type TEXT NOT NULL,    -- 'insightful', 'inspired', 'learning', 'bookmark', 'building', 'validating', 'repost', 'question', 'citing'
    repost_comment TEXT,           -- Commentary when reposting/building/questioning
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Node-level professional comments (scalable)
CREATE TABLE node_discussions (
    id TEXT PRIMARY KEY,
    graph_id TEXT NOT NULL,        -- References knowledge_graphs.id
    node_id TEXT NOT NULL,         -- Specific node within the graph
    node_type TEXT NOT NULL,       -- Store node type for filtering ('fulltext', 'worknote', 'notes')
    user_id TEXT NOT NULL,         -- References config.user_id
    comment_text TEXT NOT NULL,
    parent_comment_id TEXT,        -- Threading support
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Configuration table for commentable node types (scalability)
CREATE TABLE commentable_node_types (
    node_type TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 1,     -- 0/1 for disable/enable
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initial commentable types (fulltext, worknote, notes to start)
INSERT INTO commentable_node_types (node_type, display_name) VALUES
    ('fulltext', 'Analysis'),
    ('worknote', 'Working Notes'),
    ('notes', 'Notes');

-- Creator Control: Social engagement settings (isolated in social-worker)
CREATE TABLE graph_social_settings (
    graph_id TEXT PRIMARY KEY,      -- References knowledge_graphs.id from dev-worker
    creator_id TEXT NOT NULL,       -- References config.user_id from main-worker
    engagement_level TEXT DEFAULT 'hybrid', -- 'private', 'graph-only', 'hybrid'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- NO CHANGES to existing dev-worker knowledge_graphs table (complete isolation)
```

**Enhanced Professional Engagement Types:**

**Graph-Level Professional Reactions:**

```javascript
const professionalEngagement = {
  // Appreciation & Recognition
  insightful: '💡 Insightful analysis',
  inspired: '✨ This inspires my work', // Share professional inspiration!
  learning: '📚 Learned something valuable',

  // Professional Actions
  bookmark: '📎 Reference for future work',
  building: '🏗️ Building on this concept',
  validating: '✅ Confirms my experience',

  // Sharing & Discussion
  repost: '🔄 Share with commentary',
  question: '❓ Want to discuss approach',
  citing: '📖 Will reference this work',
}
```

**Node-Level Comments (Scalable with Creator Control):**

```javascript
// Configurable node types for professional comments
const commentableNodeTypes = [
  'fulltext', // Rich analysis (Phase 1)
  'worknote', // Working notes (Phase 1)
  'notes', // General notes (Phase 1)
  // Future: 'info', 'quote', 'analysis', etc. - easy to add via database config
]

// Skip visual/structural nodes
const nonCommentableTypes = ['background', 'markdown-image', 'REG', 'portfolio-image']

// Creator Control: Graph-level social engagement settings
const socialEngagementLevels = {
  private: 'No social engagement (personal/draft)',
  'graph-only': 'Professional reactions on entire insight only',
  hybrid: 'Reactions + comments on analysis nodes (fulltext, worknote, notes)',
}
```

**social-worker API Endpoints:**

```javascript
// social-worker/index.js - Complete microservice
// Base URL: https://social-worker.torarnehave.workers.dev
export default {
  async fetch(request, env, ctx) {
    // Health check
    GET  /health                -- Worker health status and database connection

    // Professional connections
    POST /follow-user           -- Follow/unfollow professionals
    GET  /user-connections      -- Get user's connections and followers
    GET  /connection-status     -- Check if user follows another user

    // Enhanced graph engagement (9 professional reaction types)
    POST /engage-graph          -- Professional reactions: insightful, inspired, learning, bookmark, building, validating, repost, question, citing
    GET  /graph-engagement      -- Get engagement counts and types for graphs
    GET  /user-engagements      -- Get user's engagement history

    // Citation tracking
    POST /track-citation        -- Track when users generate and copy APA citations

    // Scalable node-level comments (respects creator settings)
    GET  /commentable-types     -- Get list of commentable node types (configurable)
    POST /add-node-comment      -- Add comment to specific node (validates node type + creator settings)
    GET  /node-comments         -- Get comments for specific node (only if creator allows)
    PUT  /edit-node-comment     -- Edit user's own node comments
    DELETE /delete-node-comment -- Delete user's own node comments

    // Creator control (isolated social-worker table)
    GET  /graph-social-settings -- Get creator's engagement level (defaults to 'hybrid' if not set)
    PUT  /graph-social-settings -- Create/update creator's social engagement settings (creator only)

    // Professional feed
    GET  /professional-feed     -- Timeline of followed users' insights with engagement data
    GET  /graph-comment-count   -- Get comment counts for graphs

    // User discovery
    GET  /discover-professionals -- Find users by expertise/domain
    GET  /professional-stats     -- Get user's social statistics and engagement patterns
  }
}
```

**Frontend Components (Connect to social-worker):**

- `SocialInteractionBar.vue` - Calls social-worker endpoints directly
- `ProfessionalComments.vue` - Fetches comments from social-worker
- `FollowButton.vue` - Handles follow/unfollow via social-worker API

### Phase 2: Professional Feed (Week 3)

**Goal**: Timeline of professional insights from followed users

**New Components:**

- `ProfessionalFeed.vue` - Timeline view (copy GraphPortfolio.vue patterns)
- `InsightCard.vue` - Graph preview in feed (copy existing graph card patterns)
- `FeedNavigation.vue` - Filter by expertise areas (copy existing sidebar patterns)

**Feed Logic:**

```javascript
// Copy patterns from GraphPortfolio filtering
const feedItems = computed(() => {
  return followedUsersGraphs.value
    .filter((graph) => matchesExpertiseFilter(graph))
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
})
```

### Phase 3: Discovery & Analytics (Week 4)

**Goal**: Find professionals and track insight engagement

**Discovery Features:**

- Search professionals by expertise keywords
- Browse by knowledge domains/categories
- Trending insights in specific fields
- Suggested connections based on similar content

**Analytics Dashboard:**

- Insight engagement metrics (views, likes, comments)
- Follower growth and engagement
- Top-performing insights
- Professional network growth

---

## 🎨 User Experience Design

### Professional Insight Creation Flow (with Creator Control)

```
1. User creates knowledge graph (existing flow - unchanged)
2. User sets social engagement level (new graph-level setting)
   │
   ├─ 🔒 Private: No social features (personal/draft work)
   ├─ 💡 Professional Insight: Graph-level reactions only (final insights)
   └─ 💬 Collaborative Analysis: Enable node-level comments (seeking feedback)
3. User hits "Share as Professional Insight" (new button in GNewViewer)
4. AI generates professional summary (existing AI system - reuse)
5. User adds professional context/tags (new modal)
6. Insight shared to professional feed (respects engagement level setting)
```

### Creator Control UI Design

**Graph Creation/Settings Modal:**

```
📊 Create Professional Insight

Title: [Market Analysis Q1 2025              ]
Description: [Comprehensive analysis of...   ]

🔧 Professional Engagement Level:
○ 🔒 Private (No social features - personal/draft)
○ 💡 Professional Insight (Graph-level reactions only)
● 💬 Collaborative Analysis (Enable detailed feedback) ← DEFAULT

ℹ️ With Collaborative Analysis, colleagues can:
   • Add professional reactions to your entire insight
   • Comment on specific analysis nodes for detailed feedback
   • All engagement maintains professional context

[Cancel] [Create Professional Insight]
```

### Professional Feed Experience

```
📊 [User Avatar] Jane Smith - Strategy Consultant
    "Market Analysis: Q1 2025 Tech Trends"
    [Interactive Knowledge Graph Preview]
    💡 15 Insightful • ✨ 8 Inspired • 📚 5 Learning • 🏗️ 3 Building On • 💬 12 node comments

📈 [User Avatar] Dr. Mike Chen - Research Director
    "Consumer Behavior Pattern Analysis"
    [Interactive Knowledge Graph Preview]
    💡 24 Insightful • ✨ 12 Inspired • 📎 18 Bookmarked • ✅ 6 Validating • 💬 8 node comments
```

### Enhanced Professional Engagement Types

**Graph-Level Reactions:**

- **💡 Insightful**: "This analysis provides valuable insights"
- **✨ Inspired**: "This inspires my professional work" - Share inspiration with others!
- **📚 Learning**: "I learned something valuable from this"
- **📎 Bookmark**: "Reference for future professional work"
- **🏗️ Building On**: "I want to build on this concept" (requires commentary)
- **✅ Validating**: "This confirms my professional experience"
- **🔄 Repost**: "Share with my network" (with commentary)
- **❓ Question**: "I want to discuss this approach" (requires commentary)
- **📖 Citing**: "I will reference this in my work"

**Node-Level Professional Comments:**

- **Targeted Discussion**: Comment on specific nodes (fulltext, worknote, notes)
- **Threading Support**: Reply to comments for deeper professional discourse
- **Professional Tone**: Encourage thoughtful, work-relevant discussions
- **Scalable System**: Easy to add new node types via configuration

### Node-Level Comment Interface Example

```
[Fulltext Node: "Market Segmentation Analysis"]
[Rich analysis content here...]

💬 Professional Discussion (3 comments) • Only on: Analysis, Working Notes, Notes
├─ "Excellent segmentation approach, aligns with McKinsey framework" - Jane Consultant
│  └─ "Have you tested this with B2B markets?" - Mike Analyst (Reply)
├─ "This validates our Q3 findings. Worth citing in our report" - Sarah Director
└─ [Add professional comment...]
```

---

## 🔧 Technical Implementation

### Following Established Patterns

**Frontend Components Connect to social-worker:**

```javascript
// SocialInteractionBar.vue - Enhanced professional engagement
const engagementButtons = [
  { type: 'insightful', icon: '💡', label: 'Insightful', color: 'primary' },
  { type: 'inspired', icon: '✨', label: 'Inspiring', color: 'warning' },
  { type: 'learning', icon: '📚', label: 'Learning', color: 'info' },
  { type: 'bookmark', icon: '📎', label: 'Bookmark', color: 'secondary' },
  { type: 'building', icon: '🏗️', label: 'Building On', color: 'success', requiresComment: true },
  { type: 'validating', icon: '✅', label: 'Validates', color: 'success' },
  { type: 'question', icon: '❓', label: 'Question', color: 'primary', requiresComment: true },
]

const handleEngagementClick = async (engagementType, commentary = null) => {
  try {
    const response = await fetch('https://social-worker.torarnehave.workers.dev/engage-graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphId: props.graphId,
        userId: userStore.user_id,
        engagementType: engagementType,
        commentary: commentary, // For building/question/repost
      }),
    })

    if (response.ok) {
      await fetchEngagementStats()
      showSuccessMessage(`${engagementType} engagement updated!`)
    }
  } catch (error) {
    console.error('Error adding professional engagement:', error)
  }
}

// Fetch engagement statistics from social-worker
const fetchEngagementStats = async () => {
  try {
    const response = await fetch(
      `https://social-worker.torarnehave.workers.dev/graph-engagement?graphId=${props.graphId}`,
    )
    const stats = await response.json()
    engagementStats.value = stats.engagements || {}
  } catch (error) {
    console.error('Error fetching engagement stats:', error)
  }
}
```

**ProfessionalFeed.vue - Copy GraphPortfolio patterns, connect to social-worker:**

```javascript
// ProfessionalFeed.vue - Timeline from social-worker
const fetchFeedItems = async () => {
  try {
    const response = await fetch(
      `https://social-worker.torarnehave.workers.dev/professional-feed?userId=${userStore.user_id}`,
    )
    const data = await response.json()
    feedItems.value = data.insights || []
  } catch (error) {
    console.error('Error fetching professional feed:', error)
    feedItems.value = []
  }
}

// Filter and sort like GraphPortfolio does
const filteredFeed = computed(() => {
  return feedItems.value
    .filter((insight) => matchesExpertiseFilter(insight))
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
})
```

**FollowButton.vue - Simple follow functionality:**

```javascript
// FollowButton.vue - Professional connection management
const handleFollowToggle = async () => {
  try {
    isLoading.value = true
    const action = isFollowing.value ? 'unfollow' : 'follow'

    const response = await fetch('https://social-worker.torarnehave.workers.dev/follow-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        followerId: userStore.user_id,
        followingId: props.targetUserId,
        action: action,
      }),
    })

    if (response.ok) {
      isFollowing.value = !isFollowing.value
      await fetchConnectionStats()
    }
  } catch (error) {
    console.error('Error toggling follow:', error)
  } finally {
    isLoading.value = false
  }
}
```

**NodeCommentSection.vue - Scalable node-level comments:**

```javascript
// NodeCommentSection.vue - Professional comments on specific nodes
const props = defineProps({
  graphId: String,
  nodeId: String,
  nodeType: String, // fulltext, worknote, notes
})

// Check if this node type supports comments
const isCommentable = ref(false)
const nodeComments = ref([])

const checkCommentability = async () => {
  try {
    // First check if node type supports comments
    const typesResponse = await fetch(
      'https://social-worker.torarnehave.workers.dev/commentable-types',
    )
    const { types } = await typesResponse.json()
    const nodeTypeSupported = types.some((t) => t.node_type === props.nodeType)

    if (!nodeTypeSupported) {
      isCommentable.value = false
      return
    }

    // Then check creator's engagement level for this graph
    const settingsResponse = await fetch(
      `https://social-worker.torarnehave.workers.dev/graph-social-settings?graphId=${props.graphId}`,
    )
    const { engagementLevel } = await settingsResponse.json()

    // Comments only allowed if creator set 'hybrid' level
    isCommentable.value = engagementLevel === 'hybrid'

    if (isCommentable.value) {
      await fetchNodeComments()
    }
  } catch (error) {
    console.error('Error checking node commentability:', error)
  }
}

const addNodeComment = async (commentText, parentId = null) => {
  try {
    const response = await fetch('https://social-worker.torarnehave.workers.dev/add-node-comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphId: props.graphId,
        nodeId: props.nodeId,
        nodeType: props.nodeType,
        userId: userStore.user_id,
        commentText: commentText,
        parentId: parentId,
      }),
    })

    if (response.ok) {
      await fetchNodeComments()
      showSuccessMessage('Professional comment added!')
    }
  } catch (error) {
    console.error('Error adding node comment:', error)
  }
}

const fetchNodeComments = async () => {
  try {
    const response = await fetch(
      `https://social-worker.torarnehave.workers.dev/node-comments?graphId=${props.graphId}&nodeId=${props.nodeId}`,
    )
    const data = await response.json()
    nodeComments.value = data.comments || []
  } catch (error) {
    console.error('Error fetching node comments:', error)
  }
}

onMounted(() => {
  checkCommentability()
})
```

### social-worker Implementation (Complete Microservice)

**social-worker/index.js - Full Worker:**

```javascript
// Complete social-worker microservice
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url
    const method = request.method

    // CORS handling
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // Health check endpoint
    if (pathname === '/health' && method === 'GET') {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'social-worker',
        timestamp: new Date().toISOString(),
        database: env.vegvisr_org ? 'connected' : 'not connected',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Professional feed endpoint
    if (pathname === '/professional-feed' && method === 'GET') {
      const userId = url.searchParams.get('userId')

      // Get followed users from social database
      const socialDb = env.vegvisr_org
      const followedQuery = `
        SELECT following_id FROM professional_connections
        WHERE follower_id = ? AND connection_type = 'follow'
      `
      const followed = await socialDb.prepare(followedQuery).bind(userId).all()

      if (followed.results.length === 0) {
        return new Response(JSON.stringify({ insights: [] }),
          { status: 200, headers: corsHeaders })
      }

      const followingIds = followed.results.map(f => f.following_id)

      // Call main-worker to get user details (worker-to-worker communication)
      const userResponse = await env.MAIN_WORKER.fetch(
        new Request(`https://main.vegvisr.org/bulk-user-details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: followingIds })
        })
      )

      // Call dev-worker to get knowledge graphs (worker-to-worker communication)
      const graphResponse = await env.DEV_WORKER.fetch(
        new Request(`https://knowledge-graph-worker.torarnehave.workers.dev/user-graphs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: followingIds })
        })
      )

      const userData = await userResponse.json()
      const graphData = await graphResponse.json()

      // Combine and return professional feed
      const combinedFeed = graphData.graphs.map(graph => ({
        ...graph,
        userDetails: userData.users.find(u => u.user_id === graph.created_by),
        socialStats: await getSocialStats(graph.id, socialDb)
      }))

      return new Response(JSON.stringify({ insights: combinedFeed }),
        { status: 200, headers: corsHeaders })
    }

    // Follow user endpoint
    if (pathname === '/follow-user' && method === 'POST') {
      const { followerId, followingId, action } = await request.json()
      const socialDb = env.social_network_db

      if (action === 'follow') {
        await socialDb.prepare(`
          INSERT INTO professional_connections (id, follower_id, following_id)
          VALUES (?, ?, ?)
        `).bind(`${followerId}_${followingId}`, followerId, followingId).run()
      } else {
        await socialDb.prepare(`
          DELETE FROM professional_connections
          WHERE follower_id = ? AND following_id = ?
        `).bind(followerId, followingId).run()
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders })
    }

    // Graph interactions endpoint
    if (pathname === '/interact-graph' && method === 'POST') {
      const { graphId, userId, interactionType } = await request.json()
      const socialDb = env.social_network_db

      // Toggle interaction (like/unlike)
      const existing = await socialDb.prepare(`
        SELECT id FROM insight_interactions
        WHERE graph_id = ? AND user_id = ? AND interaction_type = ?
      `).bind(graphId, userId, interactionType).first()

      if (existing) {
        // Remove interaction
        await socialDb.prepare(`
          DELETE FROM insight_interactions WHERE id = ?
        `).bind(existing.id).run()
      } else {
        // Add interaction
        await socialDb.prepare(`
          INSERT INTO insight_interactions (id, graph_id, user_id, interaction_type)
          VALUES (?, ?, ?, ?)
        `).bind(`${graphId}_${userId}_${interactionType}`, graphId, userId, interactionType).run()
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders })
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders })
  }
}

// Helper function for social statistics
async function getSocialStats(graphId, db) {
  const stats = await db.prepare(`
    SELECT interaction_type, COUNT(*) as count
    FROM insight_interactions
    WHERE graph_id = ?
    GROUP BY interaction_type
  `).bind(graphId).all()

  return stats.results.reduce((acc, stat) => {
    acc[stat.interaction_type] = stat.count
    return acc
  }, {})
}
```

**Worker-to-Worker Communication Pattern:**

The social-worker communicates with existing workers using service bindings, maintaining complete separation while accessing needed data.

---

## 🎯 Unique Value Propositions

### For Individual Professionals

- **Showcase Expertise Visually**: Demonstrate analytical thinking through interactive graphs
- **Build Professional Following**: Gain recognition for insights and research quality
- **Engage with Industry Insights**: Meaningful discussions around professional content
- **Professional Knowledge Base**: Build searchable repository of your insights

### For Organizations

- **Team Knowledge Sharing**: Internal professional insights network
- **Client Engagement**: Share analysis and strategic thinking with clients
- **Thought Leadership**: Position organization experts as industry leaders
- **Knowledge Management**: Collective organizational intelligence

### For Consultants/Analysts

- **Portfolio of Thinking**: Demonstrate analytical capabilities to potential clients
- **Industry Recognition**: Build reputation through valuable insight sharing
- **Client Relationship Building**: Share relevant insights with client networks
- **Peer Learning**: Learn from other professionals' analytical approaches

---

## 📊 Success Metrics

### Professional Network Growth

- Monthly active insight creators
- Professional connections formed
- Cross-industry knowledge sharing
- Thought leadership recognition

### Content Quality Metrics

- Average engagement per insight
- Comment quality and depth
- Knowledge graph complexity and usefulness
- Professional discussion threads

### Business Impact

- User retention through social features
- Premium subscription conversions
- Professional network referrals
- Enterprise adoption

---

## 🛠️ Development Guidelines

### Code Quality Standards

- **Follow AI.md Protocol**: No code changes without approval
- **Preserve Existing Functionality**: All current features must continue working
- **Copy Established Patterns**: Use existing component and API patterns
- **Additive Architecture**: New features as optional enhancements
- **Simple First**: Start with basic social features, add complexity gradually

### Testing Strategy

- **Existing System Tests**: Verify no disruption to current functionality
- **Social Feature Tests**: Test new social interactions independently
- **Integration Tests**: Verify optional social features integrate cleanly
- **User Acceptance**: Professional users validate value proposition

### Rollback Safety

- **Independent Systems**: Social features can be disabled without affecting core graphs
- **Database Isolation**: New tables don't affect existing graph storage
- **Component Separation**: Social components can be removed without breaking graph viewing
- **Feature Flags**: Enable/disable social features per user or globally

---

## 🚀 Getting Started

### Phase 1 Immediate Actions

1. **Create social-worker Directory** - New dedicated microservice structure
2. **Setup Social Database Schema** - Independent database for social features
3. **Build Core social-worker Endpoints** - Professional connections and interactions
4. **Create Frontend Social Components** - Connect directly to social-worker
5. **Integrate Social Components into GNewViewer** - Optional social features overlay

### social-worker Development Setup

```bash
# Navigate to existing social-worker directory
cd social-worker

# Deploy the social-worker
wrangler deploy

# Add social tables to existing database
wrangler d1 execute vegvisr_org --file=../database/social-schema.sql --remote

# Test health endpoint
curl https://social-worker.torarnehave.workers.dev/health
```

**Wrangler.toml Configuration:**

```toml
name = "social-worker"
main = "index.js"
compatibility_date = "2025-02-14"
workers_dev = true

[[d1_databases]]
binding = "vegvisr_org"
database_name = "vegvisr_org"
database_id = "507d1efd-1dda-45ef-971f-52d2c8e8afe8"

# Service bindings for worker-to-worker communication
[[services]]
binding = "MAIN_WORKER"
service = "vegvisr-frontend"

[[services]]
binding = "DEV_WORKER"
service = "knowledge-graph-worker"

[vars]
ENVIRONMENT = "production"
```

### First Working Version Target

**Implementation Complete**: Full social-worker microservice with professional networking features.

**Success Criteria - COMPLETED**:

- ✅ **Complete Isolation**: social-worker runs independently at social-worker.torarnehave.workers.dev
- ✅ **Zero Disruption**: All existing graph creation/viewing works unchanged
- ✅ **Database Integration**: Uses existing vegvisr_org database with dedicated social tables
- ✅ **Enhanced Engagement**: 9 professional engagement types including ✨ "Inspired"
- ✅ **Scalable Comments**: Node-level comments on fulltext, worknote, notes (configurable)
- ✅ **Creator Control**: Simple graph-level settings with 'hybrid' default
- ✅ **Worker Communication**: Configured service bindings for main-worker and dev-worker
- ✅ **Professional Connections**: Users can follow other professionals via FollowButton
- ✅ **UI Integration**: Social components integrated into GNewViewer interface
- ✅ **Health Monitoring**: Health endpoint for deployment verification
- ✅ **Professional Feed**: Timeline of followed users' insights and activities

### Why This Enhanced social-worker Approach is Superior

**🎯 Professional Context**: 9 engagement types designed for knowledge workers (not casual social media)
**✨ Inspiration Sharing**: Dedicated "Inspired" engagement for professional inspiration flow
**📚 Learning Recognition**: "Learning" and "Building On" engagements for knowledge collaboration
**🔧 Scalable Architecture**: Easy to add new node types or engagement types via database configuration
**💼 Enterprise Ready**: Professional tone and features suitable for organizational networks
**🏗️ Microservices Excellence**: Follows established worker patterns with complete independence
**🛡️ Ultimate Safety**: Zero risk to existing functionality with complete architectural isolation
**📊 No Existing Disruption**: Works with all existing knowledge graphs without modification

### Default Behavior (No Existing Code Changes)

**Existing Knowledge Graphs:**

- All existing graphs immediately get 'hybrid' social features (full engagement + node comments)
- No database changes required to existing dev-worker tables
- Creators can set explicit social settings anytime via social-worker

**New Knowledge Graphs:**

- Default to 'hybrid' engagement level (encourages professional collaboration)
- Creator can change to 'private' or 'graph-only' if desired
- All social data stored in isolated social-worker database

**Implementation Logic:**

```javascript
// social-worker checks its own table first
const getEngagementLevel = async (graphId) => {
  const settings = await db
    .prepare('SELECT engagement_level FROM graph_social_settings WHERE graph_id = ?')
    .bind(graphId)
    .first()
  return settings ? settings.engagement_level : 'hybrid' // Default if no record
}
```

### Key Professional Differentiators

**Beyond LinkedIn**: Knowledge graphs are infinitely richer than text posts
**Professional Inspiration**: ✨ Share what inspires your professional work
**Targeted Discussion**: Comment on specific analysis nodes, not just entire posts
**Knowledge Building**: 🏗️ "Building On" engagement for collaborative professional development
**Creator Control**: Simple graph-level settings match creator intent and professional context
**Configurable Growth**: Add new professional engagement types and commentable node types easily

### Creator Control Benefits

**🎯 Matches Intent**:

- Draft work → Private (no social)
- Final insights → Professional reactions only
- Seeking feedback → Full collaborative features

**🔧 Simple UX**: One setting per graph, not dozens of node toggles

**💼 Professional Context**: Settings align with how knowledge workers think about sharing

**🔄 Flexible**: Creators can change engagement level anytime as work evolves

**🛡️ Safe Default**: 'Hybrid' encourages collaboration while creators can restrict as needed

This enhanced social-worker approach creates a unique "Professional Insights Network" that transforms knowledge graphs into a sophisticated platform for professional inspiration, learning, and collaboration.

---

## 🎯 **IMPLEMENTATION STATUS - PHASE 1 COMPLETED, PHASE 2 IN PROGRESS**

### **✅ Phase 1: Social-Worker Microservice (COMPLETED)**

**Deployment**: `https://social-worker.torarnehave.workers.dev`

**Health Check**: `GET /health`

- Status monitoring and database connection verification

**Core Endpoints Implemented**:

- Professional connections (follow/unfollow)
- Graph engagement (9 professional reaction types)
- Professional feed (timeline of followed users)
- Social statistics and analytics

### **🚀 Phase 2: Real-time Chat System (NEW - IN PROGRESS)**

**Revolutionary Upgrade**: Moving from static comments to **real-time professional discussions** using Cloudflare Durable Objects.

**New chat-worker System**:

**Deployment**: `https://chat-worker.torarnehave.workers.dev`

**Core Features**:

- **Real-time WebSocket Communication** - Instant messaging with sub-second latency
- **Persistent Chat Rooms** - Each knowledge graph gets dedicated Durable Object
- **Professional Context** - Messages can reference specific graph nodes
- **User Presence** - See who's online, typing indicators
- **Message History** - All conversations stored permanently
- **Standalone Product Potential** - Multi-tenant ready for other communities

**API Endpoints**:

```bash
# Health check
GET /health

# WebSocket connection (real-time)
wss://chat-worker.torarnehave.workers.dev/chat/{graphId}?userId={userId}&userName={userName}

# REST API alternatives
GET /api/chat/{graphId}/history    # Chat history
GET /api/chat/{graphId}/info       # Room information
POST /api/chat/{graphId}/send      # Send message via REST
```

### **✅ Frontend: UI Integration in GNewViewer**

**Where Social Features Are Visible:**

1. **Graph-Level Social Interaction Bar** (Bottom of graph content)

   - 💡 Insightful • ✨ Inspiring • 📚 Learning
   - 📎 Bookmark • 🏗️ Building On • ✅ Validates
   - 🔄 Repost • ❓ Question • 📖 Citing
   - Visible for both logged-in users (interactive) and public users (stats only)

2. **🆕 Real-time Chat Panel** (Replaces Static Comments)

   - **Live WebSocket Connection** - Instant message delivery
   - **Professional Discussions** - Flowing conversations, not isolated comments
   - **Node References** - Link messages to specific graph analysis nodes
   - **User Presence** - See who's online, typing indicators
   - **Message History** - Persistent conversations with pagination
   - **Professional Context** - Integrated with knowledge graph metadata

3. **Follow Button** (In Graph Status Bar)

   - Next to "Created By" information
   - Allows following graph creators directly
   - Shows connection statistics

4. **Professional Feed Access** (Navigation)

   - **Desktop**: "📊 Professional Feed" button in action toolbar
   - **Mobile**: Professional Feed option in hamburger menu
   - Timeline view of followed users' insights and activities

5. **APA Citation Generator** (📖 Citing Button)
   - Automatic APA 7th edition formatting for academic citations
   - Integrates with branding system for proper website names
   - Uses graph metadata (author, title, publication date)
   - One-click copy to clipboard functionality
   - Citation tracking for analytics

### **✅ Database: Social Tables Added**

**Database**: Existing `vegvisr_org` (ID: 507d1efd-1dda-45ef-971f-52d2c8e8afe8)

**Tables Added**:

- `professional_connections` - Follow relationships
- `graph_insights` - Professional engagement reactions
- ~~`node_discussions`~~ - **REPLACED by Durable Objects chat storage**
- `commentable_node_types` - Configuration for commentable nodes
- `graph_social_settings` - Creator control over engagement levels

**New Durable Objects Storage**:

- **ChatRoom instances** - One per knowledge graph, persistent message storage
- **Real-time message broadcasting** - WebSocket-based instant delivery
- **Automatic scaling** - Each chat room scales independently
- **Global distribution** - Chat rooms run close to users

### **🚀 Ready for Production - Next Generation Chat System**

**Phase 1 (Social Features):**

```bash
cd social-worker
wrangler deploy
```

**Phase 2 (Real-time Chat):**

```bash
cd chat-worker
wrangler deploy
```

**Database Setup**:

```bash
wrangler d1 execute vegvisr_org --file=../database/social-schema.sql --remote
```

**Verification**:

```bash
curl https://social-worker.torarnehave.workers.dev/health
curl https://chat-worker.torarnehave.workers.dev/health
```

The Professional Insights Network now features **real-time discussions** with standalone product potential! 🚀

---

## 📖 **APA Citation Feature - NEW**

### **Enhanced Professional Engagement: Citation Generation**

The **📖 Citing** button now provides comprehensive APA citation functionality, perfect for academic and professional use.

**Key Features:**

- **Automatic APA 7th Edition Formatting** - Proper webpage citation format
- **Branding Integration** - Uses custom domain names as website titles
- **Metadata Integration** - Extracts author, title, publication date from graph data
- **One-Click Copy** - Clipboard integration with success feedback
- **Citation Details View** - Breakdown of all citation components
- **Academic Note** - Reminds users to verify details for academic work

**Example Citation Output:**

```
Smith, J. (2025, January 14). Market Analysis Q1 2025. Norsegong. Retrieved January 14, 2025, from https://norsegong.com/gnew-viewer?graphId=graph_123
```

**Components Added:**

- `CitationModal.vue` - Professional citation interface with copy functionality
- `SocialInteractionBar.vue` - Enhanced citing button behavior
- `social-worker/index.js` - Citation tracking endpoint `/track-citation`

**Integration:**

- Automatically detects branded domains (e.g., "Norsegong" from `norsegong.com`)
- Handles anonymous authors and missing publication dates
- Tracks citation generation for analytics
- Works with all existing graph metadata

This feature transforms the knowledge graph platform into a citable academic resource, perfect for research and professional documentation! 🎓

---

## 💬 **CHAT-WORKER: REAL-TIME PROFESSIONAL DISCUSSIONS**

### **Revolutionary Architecture: Durable Objects Chat System**

**The Problem with Static Comments:**

- Users asked questions but got single database entries, not discussions
- No real-time interaction or flowing conversations
- Limited community building potential
- Difficult to scale for multiple communities

**The Durable Objects Solution:**

- **Each Knowledge Graph = Dedicated Chat Room** (Persistent Durable Object)
- **Real-time WebSocket Communication** (Sub-second message delivery)
- **Professional Context Integration** (Reference specific graph nodes)
- **Standalone Product Architecture** (Multi-tenant ready)
- **Infinite Scalability** (Each room scales independently)

### **chat-worker System Architecture**

```
Frontend (GraphChatPanel.vue)
    ↓ WebSocket Connection
chat-worker.torarnehave.workers.dev
    ↓ Route by Graph ID
ChatRoom Durable Objects (One per Graph)
    ├── graph_123 → Persistent chat room
    ├── graph_456 → Persistent chat room
    └── graph_789 → Persistent chat room
```

**Key Benefits:**

- **Zero Configuration** - Chat rooms created automatically on first access
- **Global Distribution** - Durable Objects run close to users worldwide
- **Persistent Storage** - Messages survive server restarts and outages
- **Professional Context** - Messages can reference specific analysis nodes
- **Community Building** - Real-time presence, typing indicators, user management

### **Professional Chat Features**

**Real-time Communication:**

- **WebSocket Connection** - `wss://chat-worker.torarnehave.workers.dev/chat/{graphId}`
- **Instant Message Delivery** - Sub-second latency globally
- **Typing Indicators** - See when users are composing messages
- **Online Presence** - View active users in each chat room
- **Connection Recovery** - Automatic reconnection on network issues

**Professional Context Integration:**

```javascript
// Messages can reference specific graph nodes
{
  type: 'chat_message',
  content: 'I disagree with this market analysis conclusion',
  nodeReference: 'fulltext_node_456', // Links to specific analysis
  userId: 'user_123',
  userName: 'Strategy Consultant'
}
```

**Message History & Persistence:**

- **Permanent Storage** - All messages stored in Durable Objects
- **Paginated History** - Load conversations from any time period
- **Cross-session Continuity** - Conversations persist across browser sessions
- **Search Ready** - Message structure prepared for future search features

### **Standalone Product Potential: "Community Chat-as-a-Service"**

**The Business Opportunity:**

1. **Multi-tenant Architecture** - Each community gets isolated chat rooms
2. **API-First Design** - Easy integration with any content platform
3. **Zero-Configuration** - Chat rooms created automatically
4. **Professional Grade** - Built for business, education, and professional communities

**Target Markets:**

- **Educational Platforms** - Course discussions, student collaboration
- **Professional Networks** - Industry-specific communities, expert consultations
- **Content Platforms** - Article discussions, research collaboration
- **Enterprise Teams** - Project discussions, knowledge sharing
- **Online Communities** - Topic-focused real-time discussions

**Revenue Model:**

```
Community Chat-as-a-Service Pricing:
- Starter: $29/month - 10 chat rooms, 1,000 messages
- Professional: $99/month - 100 chat rooms, 50,000 messages
- Enterprise: $299/month - Unlimited rooms, 500,000 messages
- White-label: Custom pricing for branded solutions
```

### **Comparison: Static Comments vs Real-time Chat**

| Feature                   | Old Static Comments      | New Real-time Chat                  |
| ------------------------- | ------------------------ | ----------------------------------- |
| **Message Delivery**      | Page refresh required    | ✅ Instant WebSocket delivery       |
| **User Presence**         | No online indicators     | ✅ See who's active, typing         |
| **Conversation Flow**     | Isolated comments        | ✅ Flowing professional discussions |
| **Scalability**           | Database bottleneck      | ✅ Infinite Durable Objects scaling |
| **Real-time Interaction** | ❌ None                  | ✅ Live collaboration               |
| **Professional Context**  | Node-level comments      | ✅ Node references in chat          |
| **Community Building**    | Limited engagement       | ✅ Real-time professional networks  |
| **Standalone Product**    | Tied to graphs only      | ✅ Multi-tenant, any content type   |
| **Global Performance**    | Single database location | ✅ Edge-distributed worldwide       |

### **Why This Chat System Will Succeed**

**✅ Proven Technology Foundation**

- Built on Cloudflare's battle-tested Durable Objects
- WebSocket reliability with automatic failover
- Global edge distribution for low latency

**✅ Professional Market Fit**

- Designed for business and educational discussions
- Professional context integration (not casual social media)
- Enterprise-ready security and reliability

**✅ Standalone Product Viability**

- Multi-tenant architecture from day one
- API-first design for easy integration
- Clear revenue model and target markets

**✅ Additive Architecture Success**

- Doesn't disrupt existing knowledge graph functionality
- Enhances professional insights with real-time collaboration
- Creates new revenue streams without cannibalizing existing features

**The chat-worker represents the evolution from static professional insights to dynamic community collaboration - a standalone product with massive market potential! 🚀💬**
