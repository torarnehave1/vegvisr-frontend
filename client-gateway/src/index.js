/**
 * Client Gateway Worker
 *
 * Deploy this to each client's Cloudflare account.
 * Provides authenticated access to the client's KV, D1, and R2.
 *
 * Routes:
 *   GET/PUT/DELETE /kv/:key   — KV operations
 *   POST          /kv/list    — KV list keys
 *   POST          /d1/query   — D1 SQL query
 *   GET/PUT/DELETE /r2/:key   — R2 object operations
 *   GET           /health     — Health check (no auth)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Gateway-Token',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check (no auth required)
    if (url.pathname === '/health') {
      return json({
        ok: true,
        bindings: {
          kv: !!env.CLIENT_KV,
          d1: !!env.CLIENT_DB,
          r2: !!env.CLIENT_BUCKET,
        },
      });
    }

    // Authenticate
    const token = request.headers.get('X-Gateway-Token');
    if (!token || token !== env.GATEWAY_SECRET) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // Parse route: /<service>/<key-or-action>
    const parts = url.pathname.split('/').filter(Boolean);
    const service = parts[0];
    const key = parts.slice(1).join('/');

    try {
      if (service === 'kv') return await handleKV(request, env, key, url);
      if (service === 'd1') return await handleD1(request, env);
      if (service === 'r2') return await handleR2(request, env, key);
      return json({ error: 'Unknown service. Use /kv, /d1, or /r2' }, 404);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
};

// ─── KV ──────────────────────────────────────────────

async function handleKV(request, env, key, url) {
  if (!env.CLIENT_KV) return json({ error: 'KV not configured' }, 501);

  // LIST: POST /kv/list?prefix=xxx
  if (request.method === 'POST' && key === 'list') {
    const prefix = url.searchParams.get('prefix') || '';
    const limit = parseInt(url.searchParams.get('limit') || '1000', 10);
    const cursor = url.searchParams.get('cursor') || undefined;
    const result = await env.CLIENT_KV.list({ prefix, limit, cursor });
    return json(result);
  }

  if (!key) return json({ error: 'Missing key' }, 400);

  if (request.method === 'GET') {
    const { value, metadata } = await env.CLIENT_KV.getWithMetadata(key);
    return json({ key, value, metadata });
  }

  if (request.method === 'PUT') {
    const body = await request.text();
    const metaParam = url.searchParams.get('metadata');
    const opts = metaParam ? { metadata: JSON.parse(metaParam) } : undefined;
    await env.CLIENT_KV.put(key, body, opts);
    return json({ ok: true, key });
  }

  if (request.method === 'DELETE') {
    await env.CLIENT_KV.delete(key);
    return json({ ok: true, deleted: key });
  }

  return json({ error: 'Method not allowed' }, 405);
}

// ─── D1 ──────────────────────────────────────────────

async function handleD1(request, env) {
  if (!env.CLIENT_DB) return json({ error: 'D1 not configured' }, 501);
  if (request.method !== 'POST') return json({ error: 'Use POST with { sql, params }' }, 405);

  const { sql, params = [] } = await request.json();
  if (!sql) return json({ error: 'Missing sql' }, 400);

  // Safety: block destructive DDL unless explicitly allowed
  const upperSql = sql.trim().toUpperCase();
  if (upperSql.startsWith('DROP') || upperSql.startsWith('TRUNCATE')) {
    return json({ error: 'Destructive DDL blocked via gateway' }, 403);
  }

  const result = await env.CLIENT_DB.prepare(sql).bind(...params).all();
  return json(result);
}

// ─── R2 ──────────────────────────────────────────────

async function handleR2(request, env, key) {
  if (!env.CLIENT_BUCKET) return json({ error: 'R2 not configured' }, 501);

  // LIST: POST /r2/list?prefix=xxx
  if (request.method === 'POST' && key === 'list') {
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix') || '';
    const limit = parseInt(url.searchParams.get('limit') || '1000', 10);
    const cursor = url.searchParams.get('cursor') || undefined;
    const result = await env.CLIENT_BUCKET.list({ prefix, limit, cursor });
    const objects = result.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded?.toISOString() || null,
    }));
    return json({ objects, truncated: result.truncated, cursor: result.cursor });
  }

  if (!key) return json({ error: 'Missing key' }, 400);

  if (request.method === 'GET') {
    const obj = await env.CLIENT_BUCKET.get(key);
    if (!obj) return json({ error: 'Not found' }, 404);
    return new Response(obj.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Length': obj.size,
      },
    });
  }

  if (request.method === 'PUT') {
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
    await env.CLIENT_BUCKET.put(key, request.body, {
      httpMetadata: { contentType },
    });
    return json({ ok: true, key });
  }

  if (request.method === 'DELETE') {
    await env.CLIENT_BUCKET.delete(key);
    return json({ ok: true, deleted: key });
  }

  return json({ error: 'Method not allowed' }, 405);
}
