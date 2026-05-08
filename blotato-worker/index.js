const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-email, x-user-role',
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const { pathname } = new URL(request.url)

    if (pathname === '/blotato/health' && request.method === 'GET') {
      return json({
        success: true,
        worker: 'blotato-worker',
        hasApiKey: Boolean(env.BLOTATO_API_KEY),
        time: new Date().toISOString(),
      })
    }

    if (pathname === '/blotato/accounts' && request.method === 'GET') {
      if (!env.BLOTATO_API_KEY) {
        return json({ success: false, error: 'BLOTATO_API_KEY secret not set' }, 500)
      }
      try {
        const upstream = await fetch('https://backend.blotato.com/v2/users/me/accounts', {
          headers: { 'blotato-api-key': env.BLOTATO_API_KEY },
        })
        const text = await upstream.text()
        let data
        try { data = JSON.parse(text) } catch { data = text }
        return json({ success: upstream.ok, status: upstream.status, data }, upstream.ok ? 200 : upstream.status)
      } catch (e) {
        return json({ success: false, error: e.message }, 502)
      }
    }

    if (pathname === '/blotato/post' && request.method === 'POST') {
      if (!env.BLOTATO_API_KEY) {
        return json({ success: false, error: 'BLOTATO_API_KEY secret not set' }, 500)
      }
      let body
      try {
        body = await request.json()
      } catch {
        return json({ success: false, error: 'Invalid JSON body' }, 400)
      }
      if (!body || !body.post || !body.post.accountId || !body.post.content || !body.post.target) {
        return json({
          success: false,
          error: 'Body must include { post: { accountId, content, target }, scheduledTime?, useNextFreeSlot? }',
        }, 400)
      }
      try {
        const upstream = await fetch('https://backend.blotato.com/v2/posts', {
          method: 'POST',
          headers: {
            'blotato-api-key': env.BLOTATO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        const text = await upstream.text()
        let data
        try { data = JSON.parse(text) } catch { data = text }
        return json({ success: upstream.ok, status: upstream.status, data }, upstream.ok ? 200 : upstream.status)
      } catch (e) {
        return json({ success: false, error: e.message }, 502)
      }
    }

    return json({ success: false, error: 'Not found' }, 404)
  },
}
