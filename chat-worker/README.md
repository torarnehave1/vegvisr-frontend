# Chat Worker - Real-time Professional Discussions

**Real-time chat system for Knowledge Graph discussions using Cloudflare Durable Objects**

## 🌟 Features

### Core Chat Features

- **Real-time WebSocket Communication** - Instant messaging with sub-second latency
- **Persistent Chat Rooms** - Each knowledge graph gets its own dedicated chat room
- **Message History** - All messages stored permanently in Durable Objects
- **User Presence** - See who's online and typing indicators
- **Node References** - Link messages to specific graph nodes for context

### Professional Features

- **Graph-Specific Discussions** - Chat rooms isolated by graph ID
- **Professional Context** - Messages can reference specific nodes in the knowledge graph
- **User Authentication** - Integrated with existing user system
- **Scalable Architecture** - Each chat room is an independent Durable Object

### Standalone Product Potential

- **Multi-tenant Ready** - Can be deployed for other community builders
- **Zero Configuration** - Chat rooms created automatically
- **API-First Design** - Both WebSocket and REST API support
- **Community Building** - Real-time discussions around any content type

## 🏗️ Architecture

### Durable Objects Design

```
chat-worker (Entry Point)
    ↓
ChatRoom Durable Objects (One per Knowledge Graph)
    ├── graph_123 → ChatRoom instance (persistent)
    ├── graph_456 → ChatRoom instance (persistent)
    └── graph_789 → ChatRoom instance (persistent)
```

**Benefits:**

- **Automatic Scaling** - Each chat room scales independently
- **Persistence** - Messages survive server restarts
- **Global Distribution** - Chat rooms run close to users
- **Zero Configuration** - Rooms created on first access

### Integration with Existing System

```
Frontend (GNewViewer)
    ↓
chat-worker (WebSocket/REST)
    ↓
ChatRoom Durable Object
    ↓
Message Storage (Persistent)
```

**Connections:**

- **social-worker** - Professional reactions (💡 insightful, ✨ inspired)
- **main-worker** - User authentication and profiles
- **dev-worker** - Knowledge graph metadata and node information

## 📡 API Endpoints

### WebSocket Connection

**Connect to Chat Room:**

```
wss://chat-worker.torarnehave.workers.dev/chat/{graphId}?userId={userId}&userName={userName}
```

**Message Types:**

```javascript
// Send chat message
{
  type: 'chat_message',
  content: 'Discussion about this analysis...',
  nodeReference: 'node_123' // Optional reference to graph node
}

// Typing indicator
{
  type: 'typing',
  isTyping: true
}

// Ping/pong for connection health
{
  type: 'ping'
}
```

**Received Message Types:**

```javascript
// Connection established
{
  type: 'connected',
  graphId: 'graph_123',
  userId: 'user_456',
  activeUsers: [...],
  timestamp: '2025-01-21T...'
}

// New chat message
{
  type: 'chat_message',
  id: 'msg_123',
  userId: 'user_456',
  userName: 'John Doe',
  content: 'Great analysis!',
  nodeReference: 'node_789',
  timestamp: '2025-01-21T...'
}

// User presence updates
{
  type: 'user_joined',
  userId: 'user_789',
  userName: 'Jane Smith',
  activeUsers: [...],
  timestamp: '2025-01-21T...'
}

{
  type: 'typing',
  userId: 'user_456',
  userName: 'John Doe',
  isTyping: true,
  timestamp: '2025-01-21T...'
}
```

### REST API Endpoints

**Health Check:**

```
GET /health
Response: { status: 'healthy', service: 'chat-worker', durableObjects: 'enabled' }
```

**Get Chat History:**

```
GET /api/chat/{graphId}/history?limit=50&offset=0
Response: { messages: [...], total: 150, hasMore: true }
```

**Get Room Information:**

```
GET /api/chat/{graphId}/info
Response: {
  graphId: 'graph_123',
  activeUsers: [...],
  activeUserCount: 3,
  totalMessages: 45
}
```

**Send Message (REST Alternative):**

```
POST /api/chat/{graphId}/send
Body: { userId: 'user_123', userName: 'John', content: 'Message text', nodeReference: 'node_456' }
Response: { success: true, messageId: 'msg_789' }
```

## 🚀 Deployment

### Prerequisites

- Cloudflare Workers account with Durable Objects enabled
- Wrangler CLI installed and authenticated

### Deploy Command

```bash
cd chat-worker
wrangler deploy
```

### Configuration

The `wrangler.toml` includes:

- Durable Objects binding for chat rooms
- Service bindings to existing workers
- Migration configuration for ChatRoom class

### Health Check

```bash
curl https://chat-worker.torarnehave.workers.dev/health
```

## 🎯 Integration with Knowledge Graphs

### Professional Discussion Flow

1. **User opens Knowledge Graph** in GNewViewer
2. **Chat panel appears** with real-time discussion
3. **Users can reference specific nodes** in their messages
4. **Professional context maintained** throughout conversation
5. **Message history persists** for future reference

### Node-Specific Discussions

```javascript
// Message referencing a specific analysis node
{
  type: 'chat_message',
  content: 'I disagree with this conclusion about market trends',
  nodeReference: 'fulltext_node_456', // Links to specific node
  userId: 'user_123',
  userName: 'Expert Analyst'
}
```

### Professional Use Cases

- **Strategic Analysis** - Teams discussing business insights
- **Research Collaboration** - Academics reviewing research findings
- **Consulting Projects** - Client discussions around analysis
- **Educational Content** - Students and instructors discussing concepts
- **Community Building** - Subject matter experts sharing knowledge

## 🔌 Standalone Product Features

### Multi-Tenant Architecture

- **Isolated Chat Rooms** - Each room is completely independent
- **No Cross-Contamination** - Messages from different rooms never mix
- **Scalable Design** - Unlimited rooms without performance impact

### Community Builder Integration

```javascript
// Any system can create chat rooms
const chatUrl = `wss://chat-worker.torarnehave.workers.dev/chat/community_${id}`

// Flexible content references
{
  type: 'chat_message',
  content: 'Discussion about this topic...',
  nodeReference: 'article_123' // Could be articles, products, courses, etc.
}
```

### Revenue Potential

- **SaaS Licensing** - License to other community platforms
- **White-label Solution** - Branded chat for enterprise customers
- **API-as-a-Service** - Pay-per-message or per-room pricing
- **Premium Features** - Advanced moderation, analytics, integrations

## 🛡️ Security & Performance

### Security Features

- **User Authentication** - Requires valid userId for connections
- **Room Isolation** - Messages cannot leak between chat rooms
- **CORS Protection** - Configured for safe cross-origin access
- **Error Handling** - Graceful handling of invalid messages

### Performance Characteristics

- **Sub-second Latency** - WebSocket messages delivered instantly
- **Global Distribution** - Durable Objects run close to users
- **Automatic Scaling** - Handles any number of concurrent users
- **Persistent Storage** - Messages never lost, even during outages

### Monitoring

- **Health Endpoints** - Monitor worker and room status
- **Error Logging** - Comprehensive error tracking
- **Usage Analytics** - Message counts and active user metrics

## 💡 Future Enhancements

### Phase 2 Features

- **Message Reactions** - React to specific messages (👍, 🤔, 💡)
- **File Sharing** - Upload and share documents in chat
- **Voice Messages** - Audio messages for richer communication
- **Message Search** - Search through chat history
- **Moderation Tools** - Admin controls for community management

### Advanced Features

- **AI Integration** - AI-powered message summaries and insights
- **Translation** - Real-time message translation for global teams
- **Analytics Dashboard** - Community engagement metrics
- **API Webhooks** - External system integration for notifications

## 📊 Comparison with Current System

| Feature                  | Current Comments        | New Chat System                     |
| ------------------------ | ----------------------- | ----------------------------------- |
| **Real-time**            | ❌ Page refresh needed  | ✅ Instant WebSocket updates        |
| **Threading**            | ✅ Basic parent/child   | ✅ Flowing conversation             |
| **User Presence**        | ❌ No online indicators | ✅ See who's active/typing          |
| **Message History**      | ✅ Database stored      | ✅ Durable Object persistence       |
| **Scalability**          | ⚠️ Database bottleneck  | ✅ Durable Objects scale infinitely |
| **Professional Context** | ✅ Node-level comments  | ✅ Node references in chat          |
| **Standalone Product**   | ❌ Tied to graphs       | ✅ Multi-tenant ready               |

## 🎉 Getting Started

### For Developers

1. **Deploy the chat-worker** using wrangler
2. **Test WebSocket connection** with browser dev tools
3. **Integrate chat panel** into your frontend
4. **Customize for your use case** (community, education, business)

### For Community Builders

1. **License the chat system** for your platform
2. **Configure for your content type** (replace graph references)
3. **Style the chat UI** to match your brand
4. **Launch real-time discussions** for your community

**The future of professional discussions is real-time, contextual, and built for knowledge sharing! 🚀**
