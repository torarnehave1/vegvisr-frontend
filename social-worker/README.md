# Social Worker - Professional Insights Network

**Dedicated microservice for professional networking features in the Vegvisr Knowledge Graph platform.**

## Overview

The social-worker is a completely independent Cloudflare Worker that provides professional social networking capabilities for knowledge graphs. It maintains complete isolation from existing functionality to ensure zero disruption to current systems.

## Features

### Professional Connections

- Follow/unfollow professionals
- Connection status tracking
- Professional network analytics

### Enhanced Graph Engagement (9 Types)

- 💡 **Insightful**: Valuable insights recognition
- ✨ **Inspired**: Professional inspiration sharing
- 📚 **Learning**: Knowledge acquisition acknowledgment
- 📎 **Bookmark**: Reference for future work
- 🏗️ **Building On**: Collaborative development (requires commentary)
- ✅ **Validating**: Experience confirmation
- 🔄 **Repost**: Network sharing (with commentary)
- ❓ **Question**: Discussion initiation (requires commentary)
- 📖 **Citing**: Work reference tracking

### Scalable Node-Level Comments

- Configurable commentable node types (fulltext, worknote, notes)
- Professional comment threading
- Creator control over engagement levels
- Expandable to new node types via database configuration

### Creator Control

- **Private**: No social engagement (personal/draft work)
- **Graph-only**: Professional reactions on entire insights only
- **Hybrid**: Full collaborative features with node-level comments (default)

## Architecture

### Complete Isolation

- Independent database schema within existing vegvisr_org database
- Separate worker deployment
- No modifications to existing systems
- Optional integration via frontend components

### Worker Communication

```
social-worker ←→ main-worker (user details)
social-worker ←→ dev-worker (knowledge graphs)
```

## Database Schema

Located in `/database/social-schema.sql` (added to existing vegvisr_org database):

- `professional_connections` - Follow/unfollow relationships
- `graph_insights` - Professional engagement tracking
- `node_discussions` - Node-level comment system
- `commentable_node_types` - Configurable node type support
- `graph_social_settings` - Creator engagement preferences

## API Endpoints

### Professional Connections

- `POST /follow-user` - Follow/unfollow professionals
- `GET /user-connections` - Get user's connections and followers
- `GET /connection-status` - Check follow status

### Graph Engagement

- `POST /engage-graph` - Add professional reactions
- `GET /graph-engagement` - Get engagement statistics
- `GET /user-engagements` - Get user's engagement history

### Node Comments

- `GET /commentable-types` - Get supported node types
- `POST /add-node-comment` - Add node-level comments
- `GET /node-comments` - Get comments for specific nodes
- `PUT /edit-node-comment` - Edit user's comments
- `DELETE /delete-node-comment` - Delete user's comments

### Creator Control

- `GET /graph-social-settings` - Get graph engagement settings
- `PUT /graph-social-settings` - Update engagement preferences

### Professional Feed

- `GET /professional-feed` - Timeline of followed users' insights
- `GET /trending-insights` - Popular insights by engagement

### Discovery

- `GET /discover-professionals` - Find professionals by activity
- `GET /professional-stats` - User's social statistics

## Setup Instructions

1. **Add Social Tables to Existing Database**:

   ```bash
   wrangler d1 execute vegvisr_org --file=../database/social-schema.sql --remote
   ```

2. **Deploy Worker**:

   ```bash
   wrangler deploy
   ```

   **Note**: The social-worker uses the existing `vegvisr_org` database with ID `507d1efd-1dda-45ef-971f-52d2c8e8afe8`, allowing for seamless integration with existing user and graph data while maintaining complete functional isolation.

## Integration with Frontend

The social worker integrates with the frontend through dedicated Vue components:

- `SocialInteractionBar.vue` - Professional engagement buttons
- `NodeCommentSection.vue` - Node-level comment interface
- `FollowButton.vue` - Professional connection management
- `ProfessionalFeed.vue` - Timeline of insights

These components are optional overlays that can be added to existing views without modifying core functionality.

## Rollback Safety

The social-worker can be completely disabled without affecting any existing functionality:

- Independent deployment
- Isolated database
- Optional frontend components
- No dependencies in existing code

## Default Behavior

- All existing graphs get 'hybrid' social features by default
- No changes required to existing knowledge graphs
- Creator can modify engagement levels anytime
- Zero impact on existing graph creation/viewing workflows
