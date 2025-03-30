export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url

    // Middleware to handle CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (pathname === '/userdata' && request.method === 'GET') {
      try {
        const email = url.searchParams.get('email')
        if (!email) {
          return new Response(JSON.stringify({ error: 'Missing email parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const db = env.vegvisr_org
        const query = `SELECT user_id, data, profileimage, emailVerificationToken FROM config WHERE email = ?;`
        const row = await db.prepare(query).bind(email).first()

        if (!row) {
          // If no data exists, return a default structure
          const response = {
            email,
            user_id: null,
            data: { profile: {}, settings: {} },
            profileimage: '',
            emailVerificationToken: null,
          }
          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const response = {
          email,
          user_id: row.user_id, // Ensure user_id is included
          data: JSON.parse(row.data),
          profileimage: row.profileimage,
          emailVerificationToken: row.emailVerificationToken,
        }
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('Error in GET /userdata:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Default route for unmatched paths
    return new Response('Not Found', { status: 404, headers: corsHeaders })
  },
}
