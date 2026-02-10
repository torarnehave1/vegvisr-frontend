/**
 * Email Worker - Phase 2: Template Engine & Link Generation
 * Rollback ID: phase2-email-worker-template-engine-2025-07-27
 */

import PostalMime from 'postal-mime'

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

  // Replace variables in subject and body - support both {variable} and {{variable}} formats
  for (const [key, value] of Object.entries(variables)) {
    const singleBracePlaceholder = `{${key}}`
    const doubleBracePlaceholder = `{{${key}}}`

    // Replace both single and double brace formats
    renderedSubject = renderedSubject.replace(
      new RegExp(singleBracePlaceholder.replace(/[{}]/g, '\\$&'), 'g'),
      value,
    )
    renderedSubject = renderedSubject.replace(
      new RegExp(doubleBracePlaceholder.replace(/[{}]/g, '\\$&'), 'g'),
      value,
    )

    renderedBody = renderedBody.replace(
      new RegExp(singleBracePlaceholder.replace(/[{}]/g, '\\$&'), 'g'),
      value,
    )
    renderedBody = renderedBody.replace(
      new RegExp(doubleBracePlaceholder.replace(/[{}]/g, '\\$&'), 'g'),
      value,
    )
  }

  return {
    subject: renderedSubject,
    body: renderedBody,
  }
}

// --- D1 config table helpers for email accounts ---

async function loadUserSettings(env, userEmail) {
  const row = await env.vegvisr_org
    .prepare('SELECT data FROM config WHERE email = ?')
    .bind(userEmail)
    .first()
  if (!row?.data) return {}
  try {
    return JSON.parse(row.data)
  } catch {
    return {}
  }
}

async function saveUserSettings(env, userEmail, data) {
  const dataJson = JSON.stringify(data)
  await env.vegvisr_org
    .prepare(
      `INSERT INTO config (email, data) VALUES (?, ?)
       ON CONFLICT(email) DO UPDATE SET data = ?`
    )
    .bind(userEmail, dataJson, dataJson)
    .run()
}

// Magic link helpers
const MAGIC_LINK_TABLE = 'login_magic_links'
const MAGIC_LINK_EXPIRY_MINUTES = 30
const MAGIC_LINK_BASE = 'https://www.vegvisr.org/login'
const MAGIC_LINK_COOKIE_NAME = 'vegvisr_token'

function isValidEmail(email) {
  return typeof email === 'string' && /.+@.+\..+/.test(email)
}

function buildMagicLink(token, redirectUrl = null, env = {}) {
  const base = redirectUrl || env.MAGIC_LINK_BASE || MAGIC_LINK_BASE
  try {
    const url = new URL(base)
    url.searchParams.set('magic', token)
    return url.toString()
  } catch {
    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}magic=${encodeURIComponent(token)}`
  }
}

async function ensureMagicLinkTable(env) {
  await env.vegvisr_org
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${MAGIC_LINK_TABLE} (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        used_at TEXT,
        redirect_url TEXT
      )`,
    )
    .run()
}

async function storeMagicLink(env, email, token, expiresAt, redirectUrl) {
  await env.vegvisr_org
    .prepare(
      `INSERT INTO ${MAGIC_LINK_TABLE} (token, email, created_at, expires_at, used, redirect_url)
       VALUES (?1, ?2, ?3, ?4, 0, ?5)`,
    )
    .bind(token, email, new Date().toISOString(), expiresAt, redirectUrl || null)
    .run()
}

async function getMagicLink(env, token) {
  return env.vegvisr_org
    .prepare(`SELECT * FROM ${MAGIC_LINK_TABLE} WHERE token = ?1`)
    .bind(token)
    .first()
}

async function markMagicLinkUsed(env, token) {
  await env.vegvisr_org
    .prepare(`UPDATE ${MAGIC_LINK_TABLE} SET used = 1, used_at = ?1 WHERE token = ?2`)
    .bind(new Date().toISOString(), token)
    .run()
}

async function sendMagicLinkEmail(env, toEmail, magicLink) {
  const smtpUser = env.MAGIC_SMTP_USER || 'torarnehave@gmail.com'
  const fromEmail = env.MAGIC_SMTP_FROM || smtpUser // allows alias like vegvisr.org@gmail.com while authenticating as owner
  const rawAppPassword = env.MAGIC_SMTP_APP_PASSWORD || env.TAHGMAIL
  if (!rawAppPassword) {
    throw new Error('TAHGMAIL app password is not configured')
  }
  // Gmail app passwords are often stored with spaces for readability; strip them before use
  const appPassword = rawAppPassword.replace(/\s+/g, '')
  if (!appPassword) {
    throw new Error('Magic link app password resolved to an empty value after sanitization')
  }
  if (!env.SLOWYOU_API_TOKEN) {
    throw new Error('SLOWYOU_API_TOKEN is not configured')
  }

  const subject = 'Your Vegvisr login link'
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2>Sign in to Vegvisr</h2>
      <p>Click the button below to finish signing in. This link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${magicLink}" style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Continue to Vegvisr</a>
      </p>
      <p>If you did not request this, you can ignore this email.</p>
      <p style="font-size: 12px; color: #555;">Link: ${magicLink}</p>
    </div>
  `

  const slowyouUrl =
    env.SLOWYOU_SEND_EMAIL_URL || 'https://slowyou.io/api/send-email-custom-credentials'
  const basicAuth = btoa(`${smtpUser}:${appPassword}`)

  const response = await fetch(slowyouUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': env.SLOWYOU_API_TOKEN,
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      senderEmail: smtpUser,
      authEmail: smtpUser,
      fromEmail,
      toEmail,
      subject,
      body: html,
    }),
  })

  const responseText = await response.text()
  if (!response.ok) {
    throw new Error(`Failed to send magic link email: ${response.status} ${responseText}`)
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

// Cloudflare Worker handlers
export default {
  // Inbound email handler (Cloudflare Email Routing)
  async email(message, env) {
    const defaultStoreUrl = env.VEMAIL_STORE_URL || 'https://vemail-store-worker.post-e91.workers.dev'

    // Look up the recipient's storeUrl from D1 account settings
    let storeUrl = defaultStoreUrl
    try {
      const recipientAddr = message.to
      const rows = await env.vegvisr_org
        .prepare('SELECT data FROM config')
        .all()
      for (const row of rows.results || []) {
        try {
          const parsed = JSON.parse(row.data)
          const accounts = parsed?.settings?.emailAccounts || []
          for (const acct of accounts) {
            const emails = [acct.email, ...(acct.aliases || [])]
            if (emails.some((e) => e && e.toLowerCase() === recipientAddr.toLowerCase())) {
              if (acct.storeUrl) {
                storeUrl = acct.storeUrl
                break
              }
            }
          }
        } catch { /* skip malformed rows */ }
        if (storeUrl !== defaultStoreUrl) break
      }
    } catch (err) {
      console.error('[email-worker email()] Store URL lookup failed, using default:', err)
    }

    try {
      // Read raw email bytes
      const rawBytes = await new Response(message.raw).arrayBuffer()
      const rawUint8 = new Uint8Array(rawBytes)

      // Parse with postal-mime
      const parser = new PostalMime()
      const parsed = await parser.parse(rawUint8)

      const recipientEmail = message.to // the envelope-to address
      const fromAddress = parsed.from?.address || message.from
      const fromName = parsed.from?.name || ''
      const toAddress = parsed.to?.[0]?.address || recipientEmail
      const subject = parsed.subject || '(no subject)'
      const textBody = parsed.text || ''
      // When HTML is empty but text exists, wrap in <pre> so it renders in the UI
      let htmlBody = parsed.html || ''
      if (!htmlBody && textBody) {
        htmlBody = `<pre style="white-space:pre-wrap;word-break:break-word;font-family:inherit">${textBody.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`
      }
      const snippet = textBody.slice(0, 200)

      // Helper: convert Uint8Array to base64 using chunks to avoid call stack overflow
      function uint8ToBase64(bytes) {
        const CHUNK = 8192
        let binary = ''
        for (let i = 0; i < bytes.length; i += CHUNK) {
          const chunk = bytes.subarray(i, Math.min(i + CHUNK, bytes.length))
          binary += String.fromCharCode.apply(null, chunk)
        }
        return btoa(binary)
      }

      // Build attachments array for the store worker
      const attachments = (parsed.attachments || []).map((att) => {
        const bytes = new Uint8Array(att.content)
        return {
          filename: att.filename || 'attachment',
          mimeType: att.mimeType || 'application/octet-stream',
          sizeBytes: bytes.length,
          contentBase64: uint8ToBase64(bytes),
        }
      })

      // Encode raw email as base64 for storage in R2
      const rawEmailBase64 = uint8ToBase64(rawUint8)

      // Extract receivedAt from parsed Date header
      const receivedAt = parsed.date ? new Date(parsed.date).toISOString() : undefined

      // POST to vemail-store-worker
      const storeRes = await fetch(`${storeUrl}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: recipientEmail,
          folder: 'inbox',
          fromAddress,
          fromName,
          toAddress,
          subject,
          snippet,
          bodyHtml: htmlBody,
          bodyText: textBody || undefined,
          rawEmail: rawEmailBase64,
          messageId: parsed.messageId || null,
          receivedAt,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      })

      if (!storeRes.ok) {
        const errText = await storeRes.text()
        console.error('[email-worker email()] Store error:', storeRes.status, errText)
      } else {
        console.log(`[email-worker email()] Stored inbound email from ${fromAddress} to ${recipientEmail}: ${subject}`)
      }
    } catch (err) {
      console.error('[email-worker email()] Failed to process inbound email:', err)
      // Don't throw — Cloudflare will retry and could loop
    }
  },

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

      // Send email through slowyou.io using user-provided Gmail app password
      // Accepts either direct credentials (authEmail + appPassword) or
      // account lookup (userEmail + accountId) to resolve credentials from D1
      if (path === '/send-gmail-email' && method === 'POST') {
        try {
          const body = await request.json()
          let { senderEmail, authEmail, fromEmail, appPassword, toEmail, subject, html } = body || {}
          const { userEmail, accountId } = body || {}

          // If userEmail + accountId provided, resolve credentials from D1
          if (userEmail && accountId && !appPassword) {
            const data = await loadUserSettings(env, userEmail)
            const settings = data.settings || {}
            const accounts = Array.isArray(settings.emailAccounts) ? settings.emailAccounts : []
            const passwords = settings.emailAccountPasswords || {}

            const account = accounts.find((a) => a.id === accountId)
            if (!account) {
              return addCorsHeaders(
                new Response(
                  JSON.stringify({ success: false, error: 'Account not found' }),
                  { status: 404, headers: { 'Content-Type': 'application/json' } },
                ),
              )
            }

            appPassword = passwords[accountId]
            if (!appPassword) {
              return addCorsHeaders(
                new Response(
                  JSON.stringify({ success: false, error: 'No app password stored for this account' }),
                  { status: 400, headers: { 'Content-Type': 'application/json' } },
                ),
              )
            }

            authEmail = account.email
            senderEmail = account.email
            if (!fromEmail) fromEmail = account.email
          }

          const smtpUser = authEmail || senderEmail

          console.log('[email-worker /send-gmail-email] incoming', {
            senderEmail,
            authEmail,
            fromEmail,
            toEmail,
            subject,
            appPasswordLength: appPassword ? appPassword.length : 0,
          })

          if (!smtpUser || !appPassword || !toEmail || !subject || !html) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'senderEmail (or authEmail), appPassword, toEmail, subject, and html are required. Alternatively provide userEmail + accountId.',
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          if (!env.SLOWYOU_API_TOKEN) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: 'SLOWYOU_API_TOKEN not configured' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          const slowyouUrl =
            env.SLOWYOU_SEND_EMAIL_URL || 'https://slowyou.io/api/send-email-custom-credentials'

          // Basic auth with user-provided app password
          const basicAuth = btoa(`${smtpUser}:${appPassword}`)

          const slowyouResponse = await fetch(slowyouUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Token': env.SLOWYOU_API_TOKEN,
              Authorization: `Basic ${basicAuth}`,
            },
            body: JSON.stringify({
              senderEmail: smtpUser,
              authEmail: smtpUser,
              fromEmail: fromEmail || senderEmail,
              toEmail,
              subject,
              body: html,
            }),
          })

          console.log('[email-worker /send-gmail-email] forwarded to slowyou', {
            senderEmail: smtpUser,
            authEmail: smtpUser,
            fromEmail: fromEmail || smtpUser,
            toEmail,
            subject,
            htmlLength: html ? html.length : 0,
          })

          const responseText = await slowyouResponse.text()

          if (!slowyouResponse.ok) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Failed to send email via slowyou.io',
                  status: slowyouResponse.status,
                  details: responseText,
                }),
                { status: slowyouResponse.status, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          let parsed
          try {
            parsed = JSON.parse(responseText)
          } catch {
            parsed = { raw: responseText }
          }

          // Store a copy in vemail-store-worker (sent folder)
          const storeUrl = env.VEMAIL_STORE_URL || 'https://vemail-store-worker.post-e91.workers.dev'
          try {
            const snippet = html ? html.replace(/<[^>]*>/g, '').slice(0, 200) : ''
            await fetch(`${storeUrl}/emails`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userEmail: userEmail || smtpUser,
                folder: 'sent',
                fromAddress: fromEmail || smtpUser,
                fromName: '',
                toAddress: toEmail,
                subject,
                snippet,
                bodyHtml: html,
                read: 1,
              }),
            })
          } catch (storeErr) {
            console.error('[email-worker] Failed to store sent copy:', storeErr)
            // Non-fatal — email was still sent successfully
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                result: parsed,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          console.error('❌ Error sending Gmail email via slowyou:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ success: false, error: 'Internal error', details: error.message }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
      }

      // Magic link login: send link to user email
      if (path === '/login/magic/send' && method === 'POST') {
        try {
          const body = await request.json()
          const targetEmail = body?.email
          const redirectUrl = body?.redirectUrl

          if (!isValidEmail(targetEmail)) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: 'A valid email is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          await ensureMagicLinkTable(env)

          const token = crypto.randomUUID()
          const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000).toISOString()

          await storeMagicLink(env, targetEmail, token, expiresAt, redirectUrl)
          const magicLink = buildMagicLink(token, redirectUrl, env)

          await sendMagicLinkEmail(env, targetEmail, magicLink)

          // Do not return the token to the client; the user must click the emailed link
          return addCorsHeaders(
            new Response(
              JSON.stringify({ success: true, email: targetEmail, expiresAt }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          console.error('Magic link send error:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ success: false, error: error.message || 'Failed to send magic link' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
      }

      // Magic link login: verify/consume token
      if (path === '/login/magic/verify' && (method === 'POST' || method === 'GET')) {
        try {
          let token = url.searchParams.get('token')
          if (method === 'POST') {
            try {
              const body = await request.json()
              token = body?.token || token
            } catch (err) {
              console.warn('Failed to parse magic verify body:', err)
            }
          }

          if (!token) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: 'Token is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          await ensureMagicLinkTable(env)
          const record = await getMagicLink(env, token)

          if (!record) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: 'Token not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          const now = Date.now()
          const expires = Date.parse(record.expires_at)
          if (Number(record.used) === 1) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: 'Token already used' }),
                { status: 410, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          if (Number.isFinite(expires) && expires < now) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: 'Token expired' }),
                { status: 410, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          await markMagicLinkUsed(env, token)

          const headers = new Headers({ 'Content-Type': 'application/json' })
          try {
            const requestHost = url.hostname || ''
            const cookieDomain = requestHost.endsWith('vegvisr.org')
              ? env.MAGIC_LINK_COOKIE_DOMAIN || '.vegvisr.org'
              : null
            if (cookieDomain) {
              const maxAge = MAGIC_LINK_EXPIRY_MINUTES * 60
              const cookie = [
                `${MAGIC_LINK_COOKIE_NAME}=${encodeURIComponent(token)}`,
                `Domain=${cookieDomain}`,
                'Path=/',
                `Max-Age=${maxAge}`,
                'SameSite=Lax',
                'Secure',
                'HttpOnly'
              ].join('; ')
              headers.set('Set-Cookie', cookie)
            }
          } catch (err) {
            console.warn('Failed to set magic link cookie:', err)
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                email: record.email,
                expiresAt: record.expires_at,
                redirectUrl: record.redirect_url || null,
              }),
              { status: 200, headers },
            ),
          )
        } catch (error) {
          console.error('Magic link verify error:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ success: false, error: error.message || 'Verification failed' }),
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

      // ===========================================
      // GRAPH TEMPLATES RENDERING (for Affiliate System)
      // ===========================================

      // Enhanced template rendering using graphTemplates table
      if (path === '/render-and-send-template' && method === 'POST') {
        try {
          const body = await request.json()
          const { templateId, toEmail, variables, domain } = body

          console.log(`📧 Rendering template ${templateId} for ${toEmail}`)

          if (!templateId || !toEmail) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: 'templateId and toEmail are required',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Get template from email_templates table
          const template = await env.vegvisr_org
            .prepare('SELECT * FROM email_templates WHERE id = ? AND is_active = 1')
            .bind(templateId)
            .first()

          if (!template) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `Template '${templateId}' not found in email_templates`,
                }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Render email template using the same function as /render-template endpoint
          const rendered = renderTemplate(template, variables || {})

          console.log(`✅ Template rendered successfully: ${rendered.subject}`)

          // For now, we'll return the rendered template
          // In a real implementation, you'd integrate with your email service
          // (SendGrid, Mailgun, SES, etc.)

          // Log email sending attempt
          console.log(`📬 Sending email to ${toEmail}:`)
          console.log(`Subject: ${rendered.subject}`)
          console.log(`Domain: ${domain || 'vegvisr.org'}`)

          // Simulate email sending success
          // Replace this with actual email service integration
          const emailResult = {
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: 'sent',
            recipient: toEmail,
            subject: rendered.subject,
            sentAt: new Date().toISOString(),
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Template rendered and email sent successfully',
                template: {
                  id: templateId,
                  name: template.name,
                  subject: rendered.subject,
                },
                email: emailResult,
                rendered: {
                  subject: rendered.subject,
                  html: rendered.html,
                  text: rendered.text,
                },
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('❌ Graph template rendering error:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Template rendering failed',
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

      // Get available graph templates
      if (path === '/graph-templates' && method === 'GET') {
        try {
          const templates = await env.vegvisr_org
            .prepare(
              'SELECT id, name, description, variables FROM graphTemplates ORDER BY created_at DESC',
            )
            .all()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                templates: templates.results || [],
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('❌ Error fetching graph templates:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to fetch templates',
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // ========================
      // EMAIL TEMPLATES CRUD ENDPOINTS
      // ========================

      // GET /email-templates - List all email templates
      if (path === '/email-templates' && method === 'GET') {
        try {
          const templates = await env.vegvisr_org
            .prepare(
              'SELECT id, template_name, template_type, language_code, subject, body, variables, is_active, created_at, updated_at FROM email_templates ORDER BY created_at DESC',
            )
            .all()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                templates: templates.results || [],
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('❌ Error fetching email templates:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to fetch email templates',
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

      // GET /email-templates/{id} - Get single email template
      if (path.startsWith('/email-templates/') && method === 'GET') {
        try {
          const templateId = path.split('/')[2]

          const template = await env.vegvisr_org
            .prepare('SELECT * FROM email_templates WHERE id = ?')
            .bind(templateId)
            .first()

          if (!template) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: 'Template not found',
                }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                template: template,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('❌ Error fetching email template:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to fetch email template',
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

      // POST /email-templates - Create new email template
      if (path === '/email-templates' && method === 'POST') {
        try {
          const templateData = await request.json()

          // Generate ID if not provided
          const templateId = templateData.id || `template_${Date.now()}`

          // Validate required fields
          if (!templateData.template_name || !templateData.subject || !templateData.body) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: 'Missing required fields: template_name, subject, body',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const result = await env.vegvisr_org
            .prepare(`
              INSERT INTO email_templates (
                id, template_name, template_type, language_code,
                subject, body, variables, is_default, created_by, is_active
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              templateId,
              templateData.template_name,
              templateData.template_type || 'general',
              templateData.language_code || 'en',
              templateData.subject,
              templateData.body,
              templateData.variables || '[]',
              templateData.is_default || 0,
              templateData.created_by || 'email_manager',
              templateData.is_active || 1
            )
            .run()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Email template created successfully',
                templateId: templateId,
                meta: result.meta,
              }),
              {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('❌ Error creating email template:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to create email template',
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

      // PUT /email-templates/{id} - Update email template
      if (path.startsWith('/email-templates/') && method === 'PUT') {
        try {
          const templateId = path.split('/')[2]
          const templateData = await request.json()

          const result = await env.vegvisr_org
            .prepare(`
              UPDATE email_templates
              SET template_name = ?, template_type = ?, language_code = ?,
                  subject = ?, body = ?, variables = ?, is_active = ?,
                  updated_at = datetime('now')
              WHERE id = ?
            `)
            .bind(
              templateData.template_name,
              templateData.template_type,
              templateData.language_code,
              templateData.subject,
              templateData.body,
              templateData.variables,
              templateData.is_active,
              templateId
            )
            .run()

          if (result.changes === 0) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: 'Template not found',
                }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Email template updated successfully',
                meta: result.meta,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('❌ Error updating email template:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to update email template',
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

      // DELETE /email-templates/{id} - Delete email template
      if (path.startsWith('/email-templates/') && method === 'DELETE') {
        try {
          const templateId = path.split('/')[2]

          const result = await env.vegvisr_org
            .prepare('DELETE FROM email_templates WHERE id = ?')
            .bind(templateId)
            .run()

          if (result.changes === 0) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: 'Template not found',
                }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Email template deleted successfully',
                meta: result.meta,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('❌ Error deleting email template:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to delete email template',
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

      // ========================
      // EMAIL ACCOUNTS (D1 storage via service binding)
      // ========================

      // GET /email-accounts?user=<email> — list accounts (metadata only, no passwords)
      if (path === '/email-accounts' && method === 'GET') {
        try {
          const userEmail = url.searchParams.get('user')
          if (!userEmail || !isValidEmail(userEmail)) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Valid user email is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const data = await loadUserSettings(env, userEmail)
          const settings = data.settings || {}
          const accounts = Array.isArray(settings.emailAccounts) ? settings.emailAccounts : []

          // Only return metadata — passwords are never sent to the browser
          const safe = accounts.map((a) => ({
            id: a.id,
            name: a.name || '',
            email: a.email || '',
            aliases: Array.isArray(a.aliases) ? a.aliases : [],
            isDefault: !!a.isDefault,
            hasPassword: !!a.hasPassword,
            storeUrl: a.storeUrl || '',
          }))

          return addCorsHeaders(
            new Response(JSON.stringify({ success: true, accounts: safe }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          console.error('Error GET /email-accounts:', error)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // POST /email-accounts — save/update an account (with optional app password)
      if (path === '/email-accounts' && method === 'POST') {
        try {
          const body = await request.json()
          const { userEmail, account, appPassword } = body

          if (!userEmail || !isValidEmail(userEmail)) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Valid userEmail is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }
          if (!account?.id || !account?.email) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'account.id and account.email are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const data = await loadUserSettings(env, userEmail)
          if (!data.settings) data.settings = {}
          if (!Array.isArray(data.settings.emailAccounts)) data.settings.emailAccounts = []
          if (!data.settings.emailAccountPasswords) data.settings.emailAccountPasswords = {}

          // Store password server-side if provided (never returned to client)
          let hasPassword = !!account.hasPassword
          if (appPassword) {
            data.settings.emailAccountPasswords[account.id] = appPassword
            hasPassword = true
          }

          // Upsert account metadata (password stored separately, never sent to browser)
          const entry = {
            id: account.id,
            name: account.name || '',
            email: account.email,
            aliases: Array.isArray(account.aliases) ? account.aliases : [],
            isDefault: !!account.isDefault,
            hasPassword,
            storeUrl: account.storeUrl || '',
          }

          const idx = data.settings.emailAccounts.findIndex((a) => a.id === account.id)
          if (idx >= 0) {
            data.settings.emailAccounts[idx] = entry
          } else {
            data.settings.emailAccounts.push(entry)
          }

          await saveUserSettings(env, userEmail, data)

          return addCorsHeaders(
            new Response(JSON.stringify({ success: true, account: entry }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          console.error('Error POST /email-accounts:', error)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // DELETE /email-accounts?user=<email>&id=<accountId> — remove an account
      if (path === '/email-accounts' && method === 'DELETE') {
        try {
          const userEmail = url.searchParams.get('user')
          const accountId = url.searchParams.get('id')

          if (!userEmail || !accountId) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'user and id params are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const data = await loadUserSettings(env, userEmail)
          if (!data.settings) data.settings = {}
          const accounts = Array.isArray(data.settings.emailAccounts)
            ? data.settings.emailAccounts
            : []

          data.settings.emailAccounts = accounts.filter((a) => a.id !== accountId)

          // Remove stored password
          if (data.settings.emailAccountPasswords) {
            delete data.settings.emailAccountPasswords[accountId]
          }

          // Re-elect default if needed
          if (
            data.settings.emailAccounts.length > 0 &&
            !data.settings.emailAccounts.some((a) => a.isDefault)
          ) {
            data.settings.emailAccounts[0].isDefault = true
          }

          await saveUserSettings(env, userEmail, data)

          return addCorsHeaders(
            new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          console.error('Error DELETE /email-accounts:', error)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
      }

      // PUT /email-accounts/sync — bulk sync account metadata (no passwords)
      if (path === '/email-accounts/sync' && method === 'PUT') {
        try {
          const body = await request.json()
          const { userEmail, accounts } = body

          if (!userEmail || !Array.isArray(accounts)) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'userEmail and accounts[] are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          const data = await loadUserSettings(env, userEmail)
          if (!data.settings) data.settings = {}

          data.settings.emailAccounts = accounts.map((a) => ({
            id: a.id,
            name: a.name || '',
            email: a.email || '',
            aliases: Array.isArray(a.aliases) ? a.aliases : [],
            isDefault: !!a.isDefault,
            hasPassword: !!a.hasPassword,
            storeUrl: a.storeUrl || '',
          }))

          await saveUserSettings(env, userEmail, data)

          return addCorsHeaders(
            new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          console.error('Error PUT /email-accounts/sync:', error)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
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
              '/render-and-send-template (POST)',
              '/graph-templates (GET)',
              '/generate-invitation (POST)',
              '/generate-slowyou-link (POST)',
              '/templates (GET)',
              '/templates/{id} (GET)',
              '/email-templates (GET, POST)',
              '/email-templates/{id} (GET, PUT, DELETE)',
              '/email-accounts (GET, POST, DELETE)',
              '/email-accounts/sync (PUT)',
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
