/**
 * Mobile Apps Worker
 * Serves mobile app downloads (APK, IPA) from R2 storage
 * Also serves deep link verification files for iOS Universal Links and Android App Links
 */

// Apple App Site Association for iOS Universal Links
const appleAppSiteAssociation = {
  applinks: {
    apps: [],
    details: [
      {
        appID: 'M7F9SUU879.org.vegvisr.hallo',
        paths: ['/join/*'],
      },
    ],
  },
}

// Android Asset Links for App Links
const androidAssetLinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.example.hallo_vegvisr',
      // SHA256 fingerprint from your app signing key
      // To get this, run: keytool -list -v -keystore <your-keystore> -alias <alias>
      // Or check Play Console > Setup > App signing > App signing key certificate
      sha256_cert_fingerprints: [
        '6D:2B:12:59:8C:17:6A:D2:4D:19:1F:82:DA:83:BE:BB:50:24:20:5F:23:FC:F0:7F:0D:F2:56:A9:19:4C:CF:4E',
      ],
    },
  },
]

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Apple App Site Association for iOS Universal Links
    if (path === '/.well-known/apple-app-site-association' || path === '/apple-app-site-association') {
      return new Response(JSON.stringify(appleAppSiteAssociation), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    // Android Asset Links for App Links
    if (path === '/.well-known/assetlinks.json') {
      return new Response(JSON.stringify(androidAssetLinks), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    // Health check
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'mobile-apps-worker' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // List available apps
    if (path === '/list' || path === '/') {
      try {
        const list = await env.MOBILE_APPS.list()
        const apps = list.objects.map(obj => ({
          name: obj.key,
          size: obj.size,
          uploaded: obj.uploaded,
        }))
        return new Response(JSON.stringify({ success: true, apps }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Upload app (POST /upload)
    if (path === '/upload' && request.method === 'POST') {
      try {
        const formData = await request.formData()
        const file = formData.get('file')

        if (!file) {
          return new Response(JSON.stringify({ success: false, error: 'No file provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const fileName = formData.get('name') || file.name
        const arrayBuffer = await file.arrayBuffer()

        await env.MOBILE_APPS.put(fileName, arrayBuffer, {
          httpMetadata: {
            contentType: file.type || 'application/vnd.android.package-archive',
            contentDisposition: `attachment; filename="${fileName}"`,
          },
        })

        const downloadUrl = `https://apps.vegvisr.org/download/${fileName}`

        return new Response(JSON.stringify({
          success: true,
          fileName,
          size: arrayBuffer.byteLength,
          url: downloadUrl,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Download app (GET /download/:filename)
    if (path.startsWith('/download/')) {
      const fileName = decodeURIComponent(path.replace('/download/', ''))

      try {
        const object = await env.MOBILE_APPS.get(fileName)

        if (!object) {
          return new Response(JSON.stringify({ success: false, error: 'File not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('Content-Disposition', `attachment; filename="${fileName}"`)

        // Set appropriate content type for APK
        if (fileName.endsWith('.apk')) {
          headers.set('Content-Type', 'application/vnd.android.package-archive')
        }

        // Add CORS headers
        Object.entries(corsHeaders).forEach(([key, value]) => {
          headers.set(key, value)
        })

        return new Response(object.body, { headers })
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({
      success: false,
      error: 'Not found',
      availableRoutes: [
        'GET / - List available apps',
        'GET /health - Health check',
        'POST /upload - Upload an app (multipart form with "file" field)',
        'GET /download/:filename - Download an app',
      ]
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  },
}
