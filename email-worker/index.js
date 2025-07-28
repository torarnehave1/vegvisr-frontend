/**
 * Email Worker - Phase 2: Template Engine & Link Generation
 * Rollback ID: phase2-email-worker-template-engine-2025-07-27
 */

// Middleware to add CORS headers
function addCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With',
  )
  response.headers.set('Access-Control-Max-Age', '86400')
  return response
}

// Template rendering function
function renderTemplate(template, variables) {
  let renderedSubject = template.subject
  let renderedBody = template.body

  // Replace variables in subject and body
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`
    renderedSubject = renderedSubject.replace(new RegExp(placeholder, 'g'), value)
    renderedBody = renderedBody.replace(new RegExp(placeholder, 'g'), value)
  }

  return {
    subject: renderedSubject,
    body: renderedBody,
  }
}

// Generate invitation token
function generateInvitationToken() {
  return crypto.randomUUID()
}

// Generate slowyou.io registration link
function generateSlowyouLink(email, role, callbackUrl) {
  const baseUrl = 'https://slowyou.io/api/reg-user-vegvisr'
  const params = new URLSearchParams({
    email: email,
    role: role || 'subscriber',
    callback: callbackUrl,
  })
  return `${baseUrl}?${params.toString()}`
}

// Cloudflare Worker fetch handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    // Handle CORS preflight requests
    if (method === 'OPTIONS') {
      return addCorsHeaders(new Response(null, { status: 204 }))
    }

    try {
      // Basic health check endpoint
      if (path === '/health' && method === 'GET') {
        return addCorsHeaders(
          new Response(
            JSON.stringify({
              status: 'ok',
              worker: 'email-worker',
              phase: '2',
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }

      // Template rendering endpoint
      if (path === '/render-template' && method === 'POST') {
        try {
          const body = await request.json()
          const { templateId, variables } = body

          if (!templateId) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'templateId is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Get template from database
          const template = await env.vegvisr_org
            .prepare('SELECT * FROM email_templates WHERE id = ? AND is_active = 1')
            .bind(templateId)
            .first()

          if (!template) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Template not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Render template with variables
          const rendered = renderTemplate(template, variables || {})

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                template: {
                  id: template.id,
                  name: template.template_name,
                  type: template.template_type,
                  language: template.language_code,
                  subject: rendered.subject,
                  body: rendered.body,
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          console.error('Template rendering error:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Template rendering failed', details: error.message }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
      }

      // Generate invitation endpoint
      if (path === '/generate-invitation' && method === 'POST') {
        try {
          const body = await request.json()
          const { recipientEmail, roomId, inviterName, inviterUserId, invitationMessage } = body

          if (!recipientEmail || !roomId || !inviterName || !inviterUserId) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: 'recipientEmail, roomId, inviterName, and inviterUserId are required',
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          // Generate invitation token
          const invitationToken = generateInvitationToken()

          // Set expiration to 7 days from now
          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + 7)

          // Store invitation token in database
          try {
            await env.vegvisr_org
              .prepare(
                `
                INSERT INTO invitation_tokens
                (id, recipient_email, room_id, inviter_name, inviter_user_id, invitation_message, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
              )
              .bind(
                invitationToken,
                recipientEmail,
                roomId,
                inviterName,
                inviterUserId,
                invitationMessage || '',
                expiresAt.toISOString(),
              )
              .run()
          } catch (dbError) {
            console.error('Database error in invitation generation:', dbError)
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: 'Database error',
                  details: dbError.message || 'Failed to store invitation token',
                  code: 'DB_ERROR',
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          // Generate callback URL for slowyou.io
          const callbackUrl = `https://www.vegvisr.org/join-room?invitation=${invitationToken}`

          // Generate slowyou.io registration link
          const slowyouLink = generateSlowyouLink(recipientEmail, 'subscriber', callbackUrl)

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                invitationToken,
                slowyouLink,
                callbackUrl,
                expiresAt: expiresAt.toISOString(),
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          console.error('Invitation generation error:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Invitation generation failed', details: error.message }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
      }

      // Generate slowyou.io link endpoint
      if (path === '/generate-slowyou-link' && method === 'POST') {
        try {
          const body = await request.json()
          const { email, role, callbackUrl } = body

          if (!email || !callbackUrl) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'email and callbackUrl are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const slowyouLink = generateSlowyouLink(email, role, callbackUrl)

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                slowyouLink,
                email,
                role: role || 'subscriber',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          console.error('Slowyou link generation error:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Link generation failed', details: error.message }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
      }

      // List templates endpoint
      if (path === '/templates' && method === 'GET') {
        try {
          const language = url.searchParams.get('language') || 'en'
          const type = url.searchParams.get('type')

          let query = 'SELECT * FROM email_templates WHERE is_active = 1'
          const params = []

          if (language) {
            query += ' AND language_code = ?'
            params.push(language)
          }

          if (type) {
            query += ' AND template_type = ?'
            params.push(type)
          }

          query += ' ORDER BY template_name'

          const templates = await env.vegvisr_org
            .prepare(query)
            .bind(...params)
            .all()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                templates: templates.results,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          console.error('Template listing error:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Failed to list templates', details: error.message }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
      }

      // Get specific template endpoint
      if (path.startsWith('/templates/') && method === 'GET') {
        try {
          const templateId = path.split('/')[2]

          const template = await env.vegvisr_org
            .prepare('SELECT * FROM email_templates WHERE id = ? AND is_active = 1')
            .bind(templateId)
            .first()

          if (!template) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Template not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                template,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          console.error('Template retrieval error:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Failed to retrieve template', details: error.message }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
      }

      // Example of calling main-worker using binding
      if (path === '/test-main-worker' && method === 'GET') {
        try {
          const mainWorkerResponse = await env.MAIN_WORKER.fetch(
            'https://vegvisr-frontend.torarnehave.workers.dev/sve2?email=test@example.com',
          )
          const mainWorkerData = await mainWorkerResponse.text()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                message: 'Successfully called main-worker',
                mainWorkerResponse: mainWorkerData,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to call main-worker',
                details: error.message,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // Default response for unknown endpoints
      return addCorsHeaders(
        new Response(
          JSON.stringify({
            error: 'Endpoint not found',
            availableEndpoints: [
              '/health',
              '/test-main-worker',
              '/render-template (POST)',
              '/generate-invitation (POST)',
              '/generate-slowyou-link (POST)',
              '/templates (GET)',
              '/templates/{id} (GET)',
            ],
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
    } catch (error) {
      console.error('Email worker error:', error)
      return addCorsHeaders(
        new Response(
          JSON.stringify({
            error: 'Internal server error',
            details: error.message,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
    }
  },
}
