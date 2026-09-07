// Chat Durable Object - Persistent chat room for each Knowledge Graph
// Each graph gets its own isolated chat room with message history

export class Chat {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.sessions = new Set() // Active WebSocket connections
    this.graphId = null
  }

  async fetch(request) {
    const url = new URL(request.url)
    const { pathname } = url

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
      // WebSocket upgrade handling
      if (request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocketUpgrade(request)
      }

      // REST API endpoints
      if (pathname.includes('/api/chat/')) {
        const parts = pathname.split('/')
        const graphId = parts[3] // /api/chat/{graphId}/{action}
        const action = parts[4]

        this.graphId = graphId

        switch (action) {
          case 'history':
            return this.getChatHistory(request, corsHeaders)
          case 'info':
            return this.getRoomInfo(corsHeaders)
          case 'send':
            return this.sendMessage(request, corsHeaders)
          default:
            return new Response('Invalid action', { status: 400, headers: corsHeaders })
        }
      }

      // Room info endpoint
      if (pathname.includes('/room-info/')) {
        const graphId = pathname.split('/room-info/')[1]
        this.graphId = graphId
        return this.getRoomInfo(corsHeaders)
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders })
    } catch (error) {
      console.error('Chat Error:', error)
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }
  }

  async handleWebSocketUpgrade(request) {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const userName = url.searchParams.get('userName') || 'Anonymous'

    if (!userId) {
      return new Response('User ID required', { status: 400 })
    }

    // Extract graph ID from path /chat/{graphId}
    const graphId = url.pathname.split('/chat/')[1]
    this.graphId = graphId

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    // Accept the WebSocket connection
    server.accept()

    // Create session object
    const session = {
      webSocket: server,
      userId,
      userName,
      graphId,
      joinedAt: new Date().toISOString(),
    }

    // Add to active sessions
    this.sessions.add(session)

    // Set up event handlers
    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data)
        await this.handleMessage(session, message)
      } catch (error) {
        console.error('Message handling error:', error)
        server.send(
          JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
          }),
        )
      }
    })

    server.addEventListener('close', () => {
      this.sessions.delete(session)
      this.broadcastToRoom(
        {
          type: 'user_left',
          userId: session.userId,
          userName: session.userName,
          timestamp: new Date().toISOString(),
          activeUsers: this.getActiveUsers(),
        },
        session,
      )
    })

    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error)
      this.sessions.delete(session)
    })

    // Send welcome message and room info
    server.send(
      JSON.stringify({
        type: 'connected',
        graphId: this.graphId,
        userId: session.userId,
        activeUsers: this.getActiveUsers(),
        timestamp: new Date().toISOString(),
      }),
    )

    // Broadcast user joined
    this.broadcastToRoom(
      {
        type: 'user_joined',
        userId: session.userId,
        userName: session.userName,
        timestamp: new Date().toISOString(),
        activeUsers: this.getActiveUsers(),
      },
      session,
    )

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  async handleMessage(session, message) {
    switch (message.type) {
      case 'chat_message':
        await this.processChatMessage(session, message)
        break
      case 'typing':
        this.broadcastTyping(session, message)
        break
      case 'ping':
        session.webSocket.send(JSON.stringify({ type: 'pong' }))
        break
      default:
        console.warn('Unknown message type:', message.type)
    }
  }

  async processChatMessage(session, message) {
    const chatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'chat_message',
      graphId: this.graphId,
      userId: session.userId,
      userName: session.userName,
      content: message.content,
      timestamp: new Date().toISOString(),
      nodeReference: message.nodeReference || null, // Reference to specific graph node
    }

    // Store message in Durable Object storage
    await this.state.storage.put(`message_${chatMessage.id}`, chatMessage)

    // Update message count
    const messageCount = (await this.state.storage.get('messageCount')) || 0
    await this.state.storage.put('messageCount', messageCount + 1)

    // Broadcast to all connected users
    this.broadcastToRoom(chatMessage)
  }

  broadcastTyping(session, message) {
    const typingMessage = {
      type: 'typing',
      userId: session.userId,
      userName: session.userName,
      isTyping: message.isTyping,
      timestamp: new Date().toISOString(),
    }

    // Broadcast to all users except sender
    this.broadcastToRoom(typingMessage, session)
  }

  broadcastToRoom(message, excludeSession = null) {
    const messageStr = JSON.stringify(message)

    this.sessions.forEach((session) => {
      if (session !== excludeSession && session.webSocket.readyState === 1) {
        try {
          session.webSocket.send(messageStr)
        } catch (error) {
          console.error('Error broadcasting message:', error)
          this.sessions.delete(session)
        }
      }
    })
  }

  getActiveUsers() {
    return Array.from(this.sessions).map((session) => ({
      userId: session.userId,
      userName: session.userName,
      joinedAt: session.joinedAt,
    }))
  }

  async getChatHistory(request, corsHeaders) {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit')) || 50
    const offset = parseInt(url.searchParams.get('offset')) || 0

    // Get all messages from storage
    const messages = []
    const list = await this.state.storage.list({ prefix: 'message_' })

    for (const [key, message] of list) {
      messages.push(message)
    }

    // Sort by timestamp (newest first)
    messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    // Apply pagination
    const paginatedMessages = messages.slice(offset, offset + limit)

    return new Response(
      JSON.stringify({
        messages: paginatedMessages.reverse(), // Reverse to show oldest first in UI
        total: messages.length,
        limit,
        offset,
        hasMore: offset + limit < messages.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  async getRoomInfo(corsHeaders) {
    const messageCount = (await this.state.storage.get('messageCount')) || 0
    const activeUsers = this.getActiveUsers()

    return new Response(
      JSON.stringify({
        graphId: this.graphId,
        activeUsers,
        activeUserCount: activeUsers.length,
        totalMessages: messageCount,
        roomCreated: new Date().toISOString(), // Could store actual creation time
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  async sendMessage(request, corsHeaders) {
    // REST API for sending messages (alternative to WebSocket)
    const { userId, userName, content, nodeReference } = await request.json()

    if (!userId || !content) {
      return new Response('userId and content required', { status: 400, headers: corsHeaders })
    }

    const chatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'chat_message',
      graphId: this.graphId,
      userId,
      userName: userName || 'Anonymous',
      content,
      timestamp: new Date().toISOString(),
      nodeReference: nodeReference || null,
    }

    // Store message
    await this.state.storage.put(`message_${chatMessage.id}`, chatMessage)

    // Update message count
    const messageCount = (await this.state.storage.get('messageCount')) || 0
    await this.state.storage.put('messageCount', messageCount + 1)

    // Broadcast to all connected WebSocket users
    this.broadcastToRoom(chatMessage)

    return new Response(
      JSON.stringify({
        success: true,
        messageId: chatMessage.id,
      }),
      {
        status: 200,
        headers: corsHeaders,
      },
    )
  }
}
