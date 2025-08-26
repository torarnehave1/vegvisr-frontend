/**
 * Cloudflare Worker for Password Protection
 * This worker provides endpoints for graph password protection
 */

// Note: Install bcryptjs for Cloudflare Workers compatibility
// npm install bcryptjs

const bcrypt = require('bcryptjs');

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enable CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // Check if password is required for a graph
      if (path === '/checkpassword' && request.method === 'GET') {
        const graphId = url.searchParams.get('id');
        if (!graphId) {
          return new Response(JSON.stringify({ error: 'Graph ID required' }), {
            status: 400,
            headers
          });
        }

        // Check if graph has password protection in metadata
        // This would typically query your database/KV store
        // For now, simulate with some example protected graphs
        const protectedGraphs = ['demo-protected', 'private-graph-123'];
        const passwordRequired = protectedGraphs.includes(graphId);

        return new Response(JSON.stringify({ passwordRequired }), { headers });
      }

      // Verify password for a graph
      if (path === '/verifypassword' && request.method === 'POST') {
        const { graphId, password } = await request.json();

        if (!graphId || !password) {
          return new Response(JSON.stringify({
            verified: false,
            message: 'Graph ID and password required'
          }), {
            status: 400,
            headers
          });
        }

        // Get password hash from database/KV store
        // For demo purposes, using hardcoded hash for password "demo123"
        const demoHashes = {
          'demo-protected': '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiS.lCc56.8O', // "demo123"
          'private-graph-123': '$2a$12$8K9PoLnF5q2HwQTzK6VQ6eaFvWwWR8YW3VtKj7fJ9mJxV8dT3pQ.e' // "secret456"
        };

        const storedHash = demoHashes[graphId];
        if (!storedHash) {
          return new Response(JSON.stringify({
            verified: false,
            message: 'Graph not found or not password protected'
          }), {
            headers
          });
        }

        // Verify password
        const verified = await bcrypt.compare(password, storedHash);

        if (verified) {
          // Generate a simple session token (in production, use JWT or similar)
          const token = btoa(`${graphId}:${Date.now()}:verified`);

          return new Response(JSON.stringify({
            verified: true,
            token,
            message: 'Access granted'
          }), {
            headers
          });
        } else {
          return new Response(JSON.stringify({
            verified: false,
            message: 'Incorrect password'
          }), {
            headers
          });
        }
      }

      // Set password for a graph (admin only)
      if (path === '/setpassword' && request.method === 'POST') {
        const { graphId, password, adminKey } = await request.json();

        // Verify admin access (in production, use proper authentication)
        if (adminKey !== env.ADMIN_KEY) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Unauthorized'
          }), {
            status: 401,
            headers
          });
        }

        if (!graphId || !password) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Graph ID and password required'
          }), {
            status: 400,
            headers
          });
        }

        // Hash the password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Store in database/KV store (simulated)
        console.log(`Setting password for graph ${graphId}: ${hashedPassword}`);

        return new Response(JSON.stringify({
          success: true,
          message: 'Password set successfully',
          hash: hashedPassword // Remove in production
        }), {
          headers
        });
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error'
      }), {
        status: 500,
        headers
      });
    }
  }
};
