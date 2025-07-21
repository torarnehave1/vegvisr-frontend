# Chat Worker Deployment Guide

## 🚀 Quick Deployment

### Prerequisites

- Cloudflare Workers account with Durable Objects enabled
- Wrangler CLI installed and authenticated
- Existing vegvisr-frontend project structure

### Deploy Commands

```bash
# Navigate to chat-worker directory
cd chat-worker

# Deploy the chat worker (creates Durable Objects automatically)
wrangler deploy

# Verify deployment
curl https://chat-worker.torarnehave.workers.dev/health
```

**Expected Health Response:**

```json
{
  "status": "healthy",
  "service": "chat-worker",
  "timestamp": "2025-01-21T...",
  "durableObjects": "enabled"
}
```

## 🧪 Testing the Chat System

### 1. Test WebSocket Connection (Browser Console)

```javascript
// Open browser console and connect to a test chat room
const ws = new WebSocket(
  'wss://chat-worker.torarnehave.workers.dev/chat/test_graph_123?userId=test_user&userName=TestUser',
)

ws.onopen = () => console.log('✅ Connected to chat')
ws.onmessage = (event) => console.log('📨 Message:', JSON.parse(event.data))
ws.onclose = () => console.log('❌ Disconnected')

// Send a test message
ws.send(
  JSON.stringify({
    type: 'chat_message',
    content: 'Hello from browser console!',
    nodeReference: null,
  }),
)
```

### 2. Test REST API Endpoints

```bash
# Get chat room information
curl "https://chat-worker.torarnehave.workers.dev/api/chat/test_graph_123/info"

# Get chat history
curl "https://chat-worker.torarnehave.workers.dev/api/chat/test_graph_123/history?limit=10"

# Send message via REST (alternative to WebSocket)
curl -X POST "https://chat-worker.torarnehave.workers.dev/api/chat/test_graph_123/send" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user",
    "userName": "Test User",
    "content": "Hello from REST API!",
    "nodeReference": "node_123"
  }'
```

### 3. Test Multiple Users (Open 2+ Browser Tabs)

1. Open multiple browser tabs
2. Connect each tab to the same chat room with different user IDs
3. Send messages from one tab → See instant delivery in other tabs
4. Test typing indicators by typing (without sending)

## 🔧 Configuration & Troubleshooting

### Wrangler.toml Explanation

```toml
name = "chat-worker"                    # Worker name in Cloudflare dashboard
main = "index.js"                       # Entry point file
compatibility_date = "2025-01-21"      # Latest compatibility date
workers_dev = true                      # Deploy to workers.dev subdomain

# Durable Objects configuration
[[durable_objects.bindings]]
name = "CHAT_ROOMS"                     # Binding name used in code (env.CHAT_ROOMS)
class_name = "ChatRoom"                 # Durable Object class name

# Automatic migration for new Durable Objects
[[migrations]]
tag = "v1"                              # Migration version
new_classes = ["ChatRoom"]              # New classes to create

# Service bindings for integration (optional)
[[services]]
binding = "MAIN_WORKER"
service = "vegvisr-frontend"

[[services]]
binding = "DEV_WORKER"
service = "knowledge-graph-worker"
```

### Common Issues & Solutions

**❌ Error: "Durable Objects not enabled"**

```bash
# Solution: Enable Durable Objects in your Cloudflare Workers dashboard
# Go to: Workers & Pages → Settings → Durable Objects → Enable
```

**❌ Error: "WebSocket upgrade failed"**

```bash
# Check that you're using wss:// not ws:// for production
# Verify the URL format: wss://chat-worker.torarnehave.workers.dev/chat/{graphId}?userId={userId}&userName={userName}
```

**❌ Error: "ChatRoom class not found"**

```bash
# Redeploy to trigger Durable Objects migration
wrangler deploy --force
```

**❌ Error: "CORS issues in browser"**

```bash
# CORS is configured in the worker, but check browser console for specific errors
# Ensure you're connecting from allowed origins
```

### Performance Testing

**Load Testing with Multiple Connections:**

```javascript
// Browser console script to test multiple connections
const connections = []

for (let i = 0; i < 5; i++) {
  const ws = new WebSocket(
    `wss://chat-worker.torarnehave.workers.dev/chat/test_room?userId=user_${i}&userName=User${i}`,
  )

  ws.onopen = () => console.log(`✅ User ${i} connected`)
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    console.log(`📨 User ${i} received:`, msg.type, msg.content)
  }

  connections.push(ws)
}

// Send messages from all connections
connections.forEach((ws, i) => {
  setTimeout(() => {
    ws.send(
      JSON.stringify({
        type: 'chat_message',
        content: `Message from User ${i}`,
      }),
    )
  }, i * 1000) // Stagger messages
})
```

## 🔗 Integration with Frontend

### GraphChatPanel.vue Integration

The chat system integrates with your Vue.js frontend via the `GraphChatPanel.vue` component:

1. **Replace NodeCommentSection** - Swap static comments with real-time chat
2. **WebSocket Connection** - Automatic connection when user is authenticated
3. **Professional Context** - Messages can reference specific graph nodes
4. **Responsive Design** - Works on desktop and mobile

### Integration Points

```javascript
// In GNewViewer.vue, replace:
<NodeCommentSection />

// With:
<GraphChatPanel
  :graphId="currentGraphId"
  :graphData="graphData"
/>
```

### Environment Variables (Optional)

```bash
# Add to wrangler.toml if you need custom configuration
[vars]
CHAT_URL_BASE = "https://chat-worker.torarnehave.workers.dev"
MAX_MESSAGE_LENGTH = "1000"
MAX_USERS_PER_ROOM = "100"
TYPING_TIMEOUT_MS = "1000"
```

## 📊 Monitoring & Analytics

### Built-in Monitoring

```bash
# Check worker logs
wrangler tail chat-worker

# View Durable Objects analytics in Cloudflare dashboard:
# Workers & Pages → chat-worker → Metrics → Durable Objects
```

### Custom Analytics (Future Enhancement)

```javascript
// Track message volume, active users, popular rooms
// Add to ChatRoom.js for usage analytics
await this.state.storage.put('daily_stats', {
  date: new Date().toISOString().split('T')[0],
  messageCount: totalMessages,
  uniqueUsers: uniqueUserCount,
  peakConcurrentUsers: maxActiveUsers,
})
```

## 🌍 Global Deployment Benefits

**Durable Objects Advantages:**

- **Automatic Global Distribution** - Each chat room runs in the region closest to users
- **Zero Configuration** - No need to manage regional deployments
- **Consistent Performance** - Sub-100ms latency worldwide
- **Infinite Scalability** - Each room scales independently

**Production Ready Features:**

- **Automatic Failover** - Durable Objects handle server failures transparently
- **Message Persistence** - All data survives outages and restarts
- **Connection Recovery** - WebSocket reconnection built into frontend
- **Professional Grade** - Enterprise-ready reliability and security

## 🎯 Next Steps

1. **Deploy and Test** - Use the commands above to deploy and verify
2. **Integrate Frontend** - Add GraphChatPanel.vue to your knowledge graph views
3. **Test User Experience** - Open multiple browsers, test real-time messaging
4. **Scale Testing** - Try with multiple graph rooms and concurrent users
5. **Plan Standalone Product** - Consider multi-tenant features for external communities

**Your real-time professional discussion platform is ready to launch! 🚀💬**
