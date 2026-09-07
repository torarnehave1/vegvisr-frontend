/**
 * Videostream Worker
 *
 * Proxy for Cloudflare Stream API — handles video uploads, playback URLs,
 * and stream management for Vegvisr apps.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const path = url.pathname

    const ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID
    const TOKEN = env.CLOUDFLARE_STREAM_TOKEN
    const STREAM_API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream`

    // OpenAPI spec
    if (path === '/openapi.json') {
      const spec = {
        openapi: '3.0.3',
        info: {
          title: 'Videostream Worker API',
          version: '1.0.0',
          description: 'Proxy for Cloudflare Stream API — handles video uploads, playback URLs, and stream management for Vegvisr apps.',
        },
        paths: {
          '/list': {
            get: {
              summary: 'List all uploaded videos',
              description: 'Returns up to 1000 videos from Cloudflare Stream.',
              responses: {
                '200': {
                  description: 'Cloudflare Stream API response with video list',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
          },
          '/video/{videoId}': {
            get: {
              summary: 'Get video details',
              description: 'Returns full details for a single video.',
              parameters: [
                { name: 'videoId', in: 'path', required: true, schema: { type: 'string' }, description: 'Cloudflare Stream video ID' },
              ],
              responses: {
                '200': {
                  description: 'Video details',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
          },
          '/playback/{videoId}': {
            get: {
              summary: 'Get playback URLs',
              description: 'Returns HLS, DASH, thumbnail, and preview URLs for a video.',
              parameters: [
                { name: 'videoId', in: 'path', required: true, schema: { type: 'string' }, description: 'Cloudflare Stream video ID' },
              ],
              responses: {
                '200': {
                  description: 'Playback URLs and video status',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          videoId: { type: 'string' },
                          hls: { type: 'string', nullable: true },
                          dash: { type: 'string', nullable: true },
                          thumbnail: { type: 'string', nullable: true },
                          preview: { type: 'string', nullable: true },
                          duration: { type: 'number' },
                          readyToStream: { type: 'boolean' },
                          status: { type: 'object' },
                          meta: { type: 'object' },
                        },
                      },
                    },
                  },
                },
                '400': {
                  description: 'Video not found or Stream API error',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
          },
          '/embed/{videoId}': {
            get: {
              summary: 'Get HTML embed code',
              description: 'Returns an HTML embed snippet from the Cloudflare Stream embed endpoint.',
              parameters: [
                { name: 'videoId', in: 'path', required: true, schema: { type: 'string' }, description: 'Cloudflare Stream video ID' },
              ],
              responses: {
                '200': {
                  description: 'HTML embed code',
                  content: { 'text/html': { schema: { type: 'string' } } },
                },
                '400': {
                  description: 'Embed not available',
                  content: { 'text/html': { schema: { type: 'string' } } },
                },
              },
            },
          },
          '/token/{videoId}': {
            post: {
              summary: 'Generate signed URL token',
              description: 'Generates a signed token for accessing a video. Accepts optional body parameters forwarded to the Stream token API.',
              parameters: [
                { name: 'videoId', in: 'path', required: true, schema: { type: 'string' }, description: 'Cloudflare Stream video ID' },
              ],
              requestBody: {
                required: false,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      description: 'Optional token parameters (e.g. exp, nbf, accessRules)',
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Signed token',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
                '400': {
                  description: 'Token generation failed',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
          },
          '/upload-url': {
            post: {
              summary: 'Upload video from URL',
              description: 'Tells Cloudflare Stream to fetch and ingest a video from a given URL.',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['url'],
                      properties: {
                        url: { type: 'string', description: 'Public URL of the video to ingest' },
                        meta: { type: 'object', description: 'Optional metadata to attach to the video' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Upload initiated',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
                '400': {
                  description: 'Missing url or Stream API error',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
                },
              },
            },
          },
          '/direct-upload': {
            post: {
              summary: 'Get a one-time upload URL',
              description: 'Returns a one-time upload URL that the client can use to upload a video directly to Cloudflare Stream.',
              requestBody: {
                required: false,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        maxDurationSeconds: { type: 'integer', default: 3600, description: 'Maximum allowed video duration in seconds' },
                        meta: { type: 'object', description: 'Optional metadata to attach to the video' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'One-time upload URL',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
                '400': {
                  description: 'Stream API error',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
          },
          '/delete/{videoId}': {
            delete: {
              summary: 'Delete a video',
              description: 'Permanently deletes a video from Cloudflare Stream.',
              parameters: [
                { name: 'videoId', in: 'path', required: true, schema: { type: 'string' }, description: 'Cloudflare Stream video ID' },
              ],
              responses: {
                '200': {
                  description: 'Video deleted',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          message: { type: 'string' },
                        },
                      },
                    },
                  },
                },
                '400': {
                  description: 'Delete failed',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
          },
          '/live/list': {
            get: {
              summary: 'List all live inputs',
              description: 'Returns all configured live inputs (RTMP/SRT ingest points).',
              responses: {
                '200': {
                  description: 'List of live inputs',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
          },
          '/live/create': {
            post: {
              summary: 'Create a new live input',
              description: 'Creates a new live input with RTMP/SRT ingest credentials.',
              requestBody: {
                required: false,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      description: 'Live input configuration (e.g. meta, recording settings)',
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Live input created',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
                '400': {
                  description: 'Creation failed',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
          },
          '/live/{inputId}': {
            get: {
              summary: 'Get live input details',
              description: 'Returns details for a single live input including RTMP/SRT credentials.',
              parameters: [
                { name: 'inputId', in: 'path', required: true, schema: { type: 'string' }, description: 'Live input ID' },
              ],
              responses: {
                '200': {
                  description: 'Live input details',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
            put: {
              summary: 'Update live input config',
              description: 'Updates configuration for an existing live input.',
              parameters: [
                { name: 'inputId', in: 'path', required: true, schema: { type: 'string' }, description: 'Live input ID' },
              ],
              requestBody: {
                required: false,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      description: 'Updated live input configuration',
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Live input updated',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
                '400': {
                  description: 'Update failed',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
            delete: {
              summary: 'Delete a live input',
              description: 'Permanently deletes a live input.',
              parameters: [
                { name: 'inputId', in: 'path', required: true, schema: { type: 'string' }, description: 'Live input ID' },
              ],
              responses: {
                '200': {
                  description: 'Live input deleted',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          message: { type: 'string' },
                        },
                      },
                    },
                  },
                },
                '400': {
                  description: 'Delete failed',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
          },
          '/live/{inputId}/outputs': {
            get: {
              summary: 'List outputs (simulcast destinations)',
              description: 'Lists all simulcast/restream outputs for a live input.',
              parameters: [
                { name: 'inputId', in: 'path', required: true, schema: { type: 'string' }, description: 'Live input ID' },
              ],
              responses: {
                '200': {
                  description: 'List of outputs',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
            post: {
              summary: 'Add simulcast output',
              description: 'Adds a simulcast/restream destination to a live input.',
              parameters: [
                { name: 'inputId', in: 'path', required: true, schema: { type: 'string' }, description: 'Live input ID' },
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        url: { type: 'string', description: 'RTMP URL of the restream destination' },
                        streamKey: { type: 'string', description: 'Stream key for the destination' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Output added',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
                '400': {
                  description: 'Failed to add output',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/StreamResponse' } } },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            StreamResponse: {
              type: 'object',
              description: 'Standard Cloudflare Stream API response envelope',
              properties: {
                success: { type: 'boolean' },
                errors: { type: 'array', items: { type: 'object' } },
                messages: { type: 'array', items: { type: 'object' } },
                result: { type: 'object', description: 'Response payload (varies by endpoint)' },
              },
            },
            ErrorResponse: {
              type: 'object',
              properties: {
                error: { type: 'string', description: 'Error message' },
              },
            },
          },
        },
      }
      return new Response(JSON.stringify(spec, null, 2), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    try {
      // List videos
      if (path === '/list' && request.method === 'GET') {
        const res = await fetch(STREAM_API, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        })
        const data = await res.json()
        return json(data)
      }

      // Get video details
      if (path.startsWith('/video/') && request.method === 'GET') {
        const videoId = path.replace('/video/', '')
        const res = await fetch(`${STREAM_API}/${videoId}`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        })
        const data = await res.json()
        return json(data)
      }

      // Get playback URLs (HLS, DASH, embed, thumbnail) from API response
      if (path.startsWith('/playback/') && request.method === 'GET') {
        const videoId = path.replace('/playback/', '')
        const res = await fetch(`${STREAM_API}/${videoId}`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        })
        const data = await res.json()
        if (!data.success) return json(data, 400)

        const video = data.result
        return json({
          success: true,
          videoId,
          hls: video.playback?.hls || null,
          dash: video.playback?.dash || null,
          thumbnail: video.thumbnail || null,
          preview: video.preview || null,
          duration: video.duration,
          readyToStream: video.readyToStream,
          status: video.status,
          meta: video.meta,
        })
      }

      // Get HTML embed code from Stream API
      if (path.startsWith('/embed/') && request.method === 'GET') {
        const videoId = path.replace('/embed/', '')
        const res = await fetch(`${STREAM_API}/${videoId}/embed`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        })
        const html = await res.text()
        return new Response(html, {
          status: res.ok ? 200 : 400,
          headers: { 'Content-Type': 'text/html', ...CORS_HEADERS },
        })
      }

      // Generate signed token for a video
      if (path.startsWith('/token/') && request.method === 'POST') {
        const videoId = path.replace('/token/', '')
        const body = await request.json().catch(() => ({}))
        const res = await fetch(`${STREAM_API}/${videoId}/token`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        return json(data, res.ok ? 200 : 400)
      }

      // Upload via URL
      if (path === '/upload-url' && request.method === 'POST') {
        const body = await request.json()
        if (!body.url) return json({ error: 'url is required' }, 400)

        const res = await fetch(STREAM_API + '/copy', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: body.url,
            meta: body.meta || {},
          }),
        })
        const data = await res.json()
        return json(data, res.ok ? 200 : 400)
      }

      // Direct upload — returns a one-time upload URL for the client
      if (path === '/direct-upload' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const res = await fetch(STREAM_API + '/direct_upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            maxDurationSeconds: body.maxDurationSeconds || 3600,
            meta: body.meta || {},
          }),
        })
        const data = await res.json()
        return json(data, res.ok ? 200 : 400)
      }

      // ── Live Inputs ──────────────────────────────────────────────

      // List live inputs
      if (path === '/live/list' && request.method === 'GET') {
        const res = await fetch(`${STREAM_API}/live_inputs`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        })
        const data = await res.json()
        return json(data)
      }

      // Get live input details
      if (path.startsWith('/live/') && !path.includes('/outputs') && request.method === 'GET') {
        const inputId = path.replace('/live/', '')
        const res = await fetch(`${STREAM_API}/live_inputs/${inputId}`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        })
        const data = await res.json()
        return json(data)
      }

      // Create live input
      if (path === '/live/create' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const res = await fetch(`${STREAM_API}/live_inputs`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        return json(data, res.ok ? 200 : 400)
      }

      // Update live input
      if (path.startsWith('/live/') && !path.includes('/outputs') && request.method === 'PUT') {
        const inputId = path.replace('/live/', '')
        const body = await request.json().catch(() => ({}))
        const res = await fetch(`${STREAM_API}/live_inputs/${inputId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        return json(data, res.ok ? 200 : 400)
      }

      // Delete live input
      if (path.startsWith('/live/') && !path.includes('/outputs') && request.method === 'DELETE') {
        const inputId = path.replace('/live/', '')
        const res = await fetch(`${STREAM_API}/live_inputs/${inputId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${TOKEN}` },
        })
        if (res.ok) return json({ success: true, message: `Deleted live input ${inputId}` })
        const data = await res.json()
        return json(data, 400)
      }

      // List outputs for a live input
      if (path.match(/^\/live\/[^/]+\/outputs$/) && request.method === 'GET') {
        const inputId = path.split('/')[2]
        const res = await fetch(`${STREAM_API}/live_inputs/${inputId}/outputs`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        })
        const data = await res.json()
        return json(data)
      }

      // Create output for a live input (simulcast/restream)
      if (path.match(/^\/live\/[^/]+\/outputs$/) && request.method === 'POST') {
        const inputId = path.split('/')[2]
        const body = await request.json()
        const res = await fetch(`${STREAM_API}/live_inputs/${inputId}/outputs`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        return json(data, res.ok ? 200 : 400)
      }

      // Delete video
      if (path.startsWith('/delete/') && request.method === 'DELETE') {
        const videoId = path.replace('/delete/', '')
        const res = await fetch(`${STREAM_API}/${videoId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${TOKEN}` },
        })
        if (res.ok) return json({ success: true, message: `Deleted ${videoId}` })
        const data = await res.json()
        return json(data, 400)
      }

      return json({
        endpoints: {
          videos: {
            'GET /list': 'List all uploaded videos (up to 1000)',
            'GET /video/:id': 'Get video details',
            'GET /playback/:id': 'Get playback URLs (HLS, DASH, thumbnail, preview)',
            'GET /embed/:id': 'Get HTML embed code',
            'POST /token/:id': 'Generate signed URL token',
            'POST /upload-url': 'Upload video from URL { url, meta? }',
            'POST /direct-upload': 'Get a one-time upload URL { maxDurationSeconds?, meta? }',
            'DELETE /delete/:id': 'Delete a video',
          },
          live: {
            'GET /live/list': 'List all live inputs',
            'GET /live/:id': 'Get live input details (RTMP/SRT credentials)',
            'POST /live/create': 'Create a new live input',
            'PUT /live/:id': 'Update live input config',
            'DELETE /live/:id': 'Delete a live input',
            'GET /live/:id/outputs': 'List outputs (simulcast destinations)',
            'POST /live/:id/outputs': 'Add simulcast output { url, streamKey }',
          },
        },
      })
    } catch (err) {
      return json({ error: err.message }, 500)
    }
  },
}
