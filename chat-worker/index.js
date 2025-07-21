// Chat Worker - Real-time messaging system for Knowledge Graph discussions
// Based on Cloudflare's Durable Objects Chat Template

export { Chat } from './ChatRoom.js'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url

    // CORS handling
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Protocol',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
      // Health check
      if (pathname === '/health') {
        return new Response(
          JSON.stringify({
            status: 'healthy',
            service: 'chat-worker',
            timestamp: new Date().toISOString(),
            durableObjects: 'enabled',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      // WebSocket upgrade for chat rooms
      if (pathname.startsWith('/chat/') && request.headers.get('Upgrade') === 'websocket') {
        const graphId = pathname.split('/chat/')[1]

        if (!graphId) {
          return new Response('Graph ID required', { status: 400, headers: corsHeaders })
        }

        // Get the Durable Object for this graph's chat room
        const id = env.CHAT_ROOMS.idFromName(graphId)
        const chatRoom = env.CHAT_ROOMS.get(id)

        // Forward the WebSocket upgrade to the Durable Object
        return chatRoom.fetch(request)
      }

      // REST API endpoints for chat management
      if (pathname.startsWith('/api/chat/')) {
        const graphId = pathname.split('/api/chat/')[1].split('/')[0]
        const action = pathname.split('/api/chat/')[1].split('/')[1]

        if (!graphId) {
          return new Response('Graph ID required', { status: 400, headers: corsHeaders })
        }

        const id = env.CHAT_ROOMS.idFromName(graphId)
        const chatRoom = env.CHAT_ROOMS.get(id)

        // Forward REST requests to the Durable Object
        return chatRoom.fetch(request)
      }

      // Chat room info endpoint
      if (pathname.startsWith('/room-info/')) {
        const graphId = pathname.split('/room-info/')[1]

        if (!graphId) {
          return new Response('Graph ID required', { status: 400, headers: corsHeaders })
        }

        const id = env.CHAT_ROOMS.idFromName(graphId)
        const chatRoom = env.CHAT_ROOMS.get(id)

        return chatRoom.fetch(request)
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders })
    } catch (error) {
      console.error('Chat Worker Error:', error)
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
  },
}
