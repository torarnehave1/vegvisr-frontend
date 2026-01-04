/**
 * SMS Gateway Worker (Cloudflare)
 *
 * Sends SMS messages via ClickSend (https://www.clicksend.com)
 *
 * Environment Variables Required:
 *   SMS_API_BASE_URL     - Base URL for SMS API
 *   CLICKSEND_USERNAME   - ClickSend account username (secret)
 *   CLICKSEND_API_KEY    - ClickSend API key (secret)
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return handleCORS()
    }

    const url = new URL(request.url)

    if (url.pathname === '/api/sms' && request.method === 'POST') {
      return handleSendSMS(request, env)
    }

    if (url.pathname === '/api/sms/history' && request.method === 'GET') {
      return handleGetSMSHistory(request, env)
    }

    // Recipient Lists endpoints
    if (url.pathname === '/api/lists' && request.method === 'GET') {
      return handleGetLists(request, env)
    }

    if (url.pathname === '/api/lists' && request.method === 'POST') {
      return handleCreateList(request, env)
    }

    if (url.pathname.startsWith('/api/lists/') && request.method === 'DELETE') {
      return handleDeleteList(request, env)
    }

    if (url.pathname.startsWith('/api/lists/') && url.pathname.endsWith('/recipients') && request.method === 'GET') {
      return handleGetRecipients(request, env)
    }

    if (url.pathname.startsWith('/api/lists/') && url.pathname.endsWith('/recipients') && request.method === 'POST') {
      return handleAddRecipient(request, env)
    }

    if (url.pathname.match(/^\/api\/lists\/[^/]+\/recipients\/[^/]+$/) && request.method === 'DELETE') {
      return handleDeleteRecipient(request, env)
    }

    // Phone Authentication endpoints
    if (url.pathname === '/api/auth/phone/status' && request.method === 'GET') {
      return handlePhoneStatus(request, env)
    }

    if (url.pathname === '/api/auth/phone/send-code' && request.method === 'POST') {
      return handleSendVerificationCode(request, env)
    }

    if (url.pathname === '/api/auth/phone/verify-code' && request.method === 'POST') {
      return handleVerifyCode(request, env)
    }

    if (url.pathname === '/api/auth/user/validate' && request.method === 'POST') {
      return handleUserValidate(request, env)
    }

    if (url.pathname === '/api/ai-chat' && request.method === 'POST') {
      return handleAiChat(request, env)
    }

    // Knowledge Graph endpoints (proxies to Knowledge Graph Worker)
    if (url.pathname === '/api/save-graph' && request.method === 'POST') {
      return handleSaveGraph(request, env)
    }

    if (url.pathname === '/api/my-graphs' && request.method === 'POST') {
      return handleMyGraphs(request, env)
    }

    if (url.pathname === '/api/delete-graph' && request.method === 'POST') {
      return handleDeleteGraph(request, env)
    }

    if (url.pathname === '/api/get-graph' && request.method === 'POST') {
      return handleGetGraph(request, env)
    }

    if (url.pathname === '/api/update-graph' && request.method === 'POST') {
      return handleUpdateGraph(request, env)
    }

    if (url.pathname === '/docs.json' || url.pathname === '/openapi.json') {
      return jsonResponse(getOpenAPISpec(url))
    }

    if (url.pathname === '/' || url.pathname === '/api') {
      return jsonResponse({
        success: true,
        message: 'SMS Gateway Worker - ClickSend',
        version: '3.1.0',
        timestamp: new Date().toISOString(),
        docs: `${url.origin}/docs.json`
      })
    }

    return jsonResponse({ error: 'Not found' }, 404)
  }
}

async function handleGetSMSHistory(request, env) {
  try {
    if (!env.CLICKSEND_USERNAME || !env.CLICKSEND_API_KEY) {
      return jsonResponse(
        { error: 'Missing ClickSend API credentials' },
        500
      )
    }

    const url = new URL(request.url)
    const page = url.searchParams.get('page') || '1'
    const status = url.searchParams.get('status') || 'all'

    const authString = btoa(`${env.CLICKSEND_USERNAME}:${env.CLICKSEND_API_KEY}`)

    let historyUrl = `https://rest.clicksend.com/v3/sms/history?page=${page}`
    if (status !== 'all') {
      historyUrl += `&status=${status}`
    }

    console.log('Fetching SMS history:', { page, status })

    const response = await fetch(historyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      }
    })

    const data = await response.json()

    console.log('ClickSend History Response:', {
      status: response.status,
      hasData: !!data
    })

    if (response.ok) {
      return jsonResponse({
        success: true,
        data: data.data || data,
        http_code: data.http_code
      })
    } else {
      return jsonResponse({
        success: false,
        error: data.response_msg || data.message || 'Failed to fetch history',
        http_code: data.http_code || response.status
      }, response.status)
    }

  } catch (error) {
    console.error('Error fetching SMS history:', error)
    return jsonResponse(
      { error: 'Internal server error', details: error.message },
      500
    )
  }
}

async function handleSendSMS(request, env) {
  try {
    if (!env.SMS_API_BASE_URL || !env.CLICKSEND_USERNAME || !env.CLICKSEND_API_KEY) {
      return jsonResponse(
        { error: 'Missing ClickSend API credentials' },
        500
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400)
    }

    if (!body.to && !body.recipients) {
      return jsonResponse(
        { error: 'Missing "to" or "recipients" field' },
        400
      )
    }

    if (!body.message) {
      return jsonResponse({ error: 'Missing "message" field' }, 400)
    }

    const phoneNumbers = body.recipients || body.to
    const recipients = normalizePhoneNumbers(phoneNumbers)

    if (recipients.length === 0) {
      return jsonResponse({ error: 'No valid phone numbers' }, 400)
    }

    const message = String(body.message).trim()
    if (!message) {
      return jsonResponse({ error: 'Message cannot be empty' }, 400)
    }

    let sender = body.sender || body.source || 'SMS'
    if (sender) {
      sender = String(sender).trim()
      if (sender.length > 11) {
        console.log(`Sender truncated: "${sender}" -> "${sender.substring(0, 11)}"`)
        sender = sender.substring(0, 11)
      }
    }

    const result = await sendSMSViaClickSend(recipients, message, sender, env)
    return jsonResponse(result, result.success ? 200 : 400)

  } catch (error) {
    console.error('Error in handleSendSMS:', error)
    return jsonResponse(
      { error: 'Internal server error', details: error.message },
      500
    )
  }
}

function normalizePhoneNumbers(input) {
  if (!input) return []

  if (Array.isArray(input)) {
    return input.map(item => {
      if (typeof item === 'object' && item !== null) {
        const phone = item.msisdn || item.phone || item.to || item.number
        if (phone) {
          return normalizePhoneNumber(phone)
        }
        return null
      }
      return normalizePhoneNumber(item)
    }).filter(num => num !== null)
  }

  return [normalizePhoneNumber(input)].filter(num => num !== null)
}

function normalizePhoneNumber(phone) {
  if (!phone) return null

  let phoneStr = String(phone).trim()
  if (!phoneStr) return null

  // Remove common separators
  const cleaned = phoneStr.replace(/[()\s-]/g, '')

  // Extract digits only for length checks
  const digits = cleaned.replace(/\D/g, '')

  // Handle international style starting with +
  if (cleaned.startsWith('+')) {
    // keep plus and digits
    if (cleaned.startsWith('+47')) {
      return '+' + digits
    }
    // Other country codes are not allowed in this system (only Norway)
    console.log(`Rejected non-Norwegian number (starts with +): ${phoneStr}`)
    return null
  }

  // Handle international 00 prefix (e.g., 0047...)
  if (cleaned.startsWith('00')) {
    const after00 = digits.replace(/^00/, '')
    if (after00.startsWith('47')) {
      return '+' + after00
    }
    console.log(`Rejected non-Norwegian number (00 prefix but not 47): ${phoneStr}`)
    return null
  }

  // If digits.length is 8 -> assume local Norwegian number and prepend +47
  if (digits.length === 8) {
    return '+47' + digits
  }

  // If digits length is 10 and starts with 47 -> add +
  if (digits.length === 10 && digits.startsWith('47')) {
    return '+' + digits
  }

  // If digits length matches other patterns, reject - we only support Norway (+47)
  console.log(`Rejected phone number (unsupported format): ${phoneStr}`)
  return null
}

async function sendSMSViaClickSend(recipients, message, sender, env) {
  const result = {
    success: false,
    totalRecipients: recipients.length,
    successfulSends: 0,
    messageIds: [],
    totalPrice: 0,
    currency: 'USD',
    messages: [],
    error: null
  }

  try {
    const messages = recipients.map(phoneNumber => ({
      source: sender,
      body: message,
      to: phoneNumber
    }))

    const payload = { messages: messages }

    console.log('ClickSend Request:', {
      recipients: recipients.length,
      sender: sender,
      messageLength: message.length
    })

    const authString = btoa(`${env.CLICKSEND_USERNAME}:${env.CLICKSEND_API_KEY}`)

    const response = await fetch(env.SMS_API_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const responseData = await response.json()

    console.log('ClickSend Response:', {
      status: response.status,
      data: responseData
    })

    if (response.ok && responseData.http_code === 200) {
      const data = responseData.data || {}
      const messageDetails = data.messages || []

      result.success = true
      result.successfulSends = data.total_count || recipients.length
      result.messageIds = messageDetails.map(msg => msg.message_id)
      result.totalPrice = data.total_price || 0

      // We only send to Norway (+47). Ensure we report currency as NOK for clarity
      // ClickSend may return USD; for the UI we force NOK label. No conversion is applied.
      result.currency = 'NOK'
      result.messages = messageDetails

      console.log(`✅ SMS sent: ${result.successfulSends} recipients, ${result.totalPrice} ${result.currency}`)
    } else {
      const errorMessage = responseData.response_msg || responseData.message || 'Unknown error'
      const errorCode = responseData.response_code || responseData.http_code || response.status

      result.error = {
        status: response.status,
        code: errorCode,
        message: errorMessage
      }

      console.error(`❌ SMS failed: ${errorCode} - ${errorMessage}`)
    }

  } catch (error) {
    console.error('Error calling ClickSend:', error)
    result.error = {
      type: 'network_error',
      message: error.message
    }
  }

  // Log the final recipient list for debugging
  try {
    console.log('Final recipients:', recipients)
  } catch {
    // ignore
  }

  return result
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}

function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  })
}

// ===== RECIPIENT LISTS HANDLERS =====

async function handleGetLists(request, env) {
  try {
    const url = new URL(request.url)
    const userEmail = url.searchParams.get('userEmail')

    if (!userEmail) {
      return jsonResponse({ error: 'userEmail parameter required' }, 400)
    }

    const { results } = await env.DB.prepare(
      'SELECT * FROM sms_recipient_lists WHERE user_email = ? ORDER BY updated_at DESC'
    ).bind(userEmail).all()

    return jsonResponse({ success: true, lists: results })
  } catch (error) {
    console.error('Error getting lists:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

async function handleCreateList(request, env) {
  try {
    const body = await request.json()
    const { userEmail, userId, name, description } = body

    if (!userEmail || !userId || !name) {
      return jsonResponse({ error: 'userEmail, userId, and name are required' }, 400)
    }

    const id = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    await env.DB.prepare(
      'INSERT INTO sms_recipient_lists (id, user_id, user_email, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, userId, userEmail, name, description || null, now, now).run()

    return jsonResponse({ success: true, id, name })
  } catch (error) {
    console.error('Error creating list:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

async function handleDeleteList(request, env) {
  try {
    const url = new URL(request.url)
    const listId = url.pathname.split('/')[3]

    if (!listId) {
      return jsonResponse({ error: 'List ID required' }, 400)
    }

    await env.DB.prepare('DELETE FROM sms_recipient_lists WHERE id = ?').bind(listId).run()

    return jsonResponse({ success: true })
  } catch (error) {
    console.error('Error deleting list:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

async function handleGetRecipients(request, env) {
  try {
    const url = new URL(request.url)
    const listId = url.pathname.split('/')[3]

    if (!listId) {
      return jsonResponse({ error: 'List ID required' }, 400)
    }

    const { results } = await env.DB.prepare(
      'SELECT * FROM sms_recipients WHERE list_id = ? ORDER BY created_at DESC'
    ).bind(listId).all()

    return jsonResponse({ success: true, recipients: results })
  } catch (error) {
    console.error('Error getting recipients:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

async function handleAddRecipient(request, env) {
  try {
    const url = new URL(request.url)
    const listId = url.pathname.split('/')[3]
    const body = await request.json()
    const { name, phoneNumber, notes } = body

    if (!listId || !phoneNumber) {
      return jsonResponse({ error: 'List ID and phoneNumber are required' }, 400)
    }

    const id = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    await env.DB.prepare(
      'INSERT INTO sms_recipients (id, list_id, name, phone_number, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, listId, name || null, phoneNumber, notes || null, now).run()

    return jsonResponse({ success: true, id })
  } catch (error) {
    console.error('Error adding recipient:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

async function handleDeleteRecipient(request, env) {
  try {
    const url = new URL(request.url)
    const parts = url.pathname.split('/')
    const recipientId = parts[5]

    if (!recipientId) {
      return jsonResponse({ error: 'Recipient ID required' }, 400)
    }

    await env.DB.prepare('DELETE FROM sms_recipients WHERE id = ?').bind(recipientId).run()

    return jsonResponse({ success: true })
  } catch (error) {
    console.error('Error deleting recipient:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

// ===== PHONE AUTHENTICATION HANDLERS =====

/**
 * Generate a random 6-digit verification code
 */
function generateVerificationCode() {
  const digits = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000
  return digits.toString().padStart(6, '0')
}

/**
 * Hash a string using SHA-256
 */
async function sha256Hex(input) {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * GET /api/auth/phone/status
 * Check if a user has a verified phone number
 */
async function handlePhoneStatus(request, env) {
  try {
    const url = new URL(request.url)
    const email = (url.searchParams.get('email') || '').trim().toLowerCase()
    const phone = url.searchParams.get('phone')

    if (!email && !phone) {
      return jsonResponse({ error: 'Email or phone parameter required' }, 400)
    }

    let row
    if (email) {
      row = await env.VEGVISR_DB.prepare(
        'SELECT email, phone, phone_verified_at FROM config WHERE email = ?'
      ).bind(email).first()
    } else if (phone) {
      const normalizedPhone = normalizePhoneNumber(phone)
      if (!normalizedPhone) {
        return jsonResponse({ error: 'Invalid phone number format' }, 400)
      }
      row = await env.VEGVISR_DB.prepare(
        'SELECT email, phone, phone_verified_at FROM config WHERE phone = ?'
      ).bind(normalizedPhone).first()
    }

    if (!row) {
      return jsonResponse({ success: false, error: 'User not found' }, 404)
    }

    return jsonResponse({
      success: true,
      email: row.email,
      phone: row.phone || null,
      phone_verified_at: row.phone_verified_at || null,
      verified: !!row.phone_verified_at
    })
  } catch (error) {
    console.error('Error in /api/auth/phone/status:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

/**
 * POST /api/auth/phone/send-code
 * Send a verification code to a phone number
 * Body: { email: string, phone: string } OR { phone: string } for phone-only login
 */
async function handleSendVerificationCode(request, env) {
  try {
    const body = await request.json()
    const email = (body.email || '').trim().toLowerCase()
    const phone = normalizePhoneNumber(body.phone)

    if (!phone) {
      return jsonResponse({ error: 'A valid Norwegian phone number is required' }, 400)
    }

    // Check if user exists - by email or phone
    let userRow
    if (email) {
      userRow = await env.VEGVISR_DB.prepare(
        'SELECT email, phone FROM config WHERE email = ?'
      ).bind(email).first()
    } else {
      // Phone-only login: lookup by phone
      userRow = await env.VEGVISR_DB.prepare(
        'SELECT email, phone FROM config WHERE phone = ?'
      ).bind(phone).first()
    }

    if (!userRow) {
      return jsonResponse({
        success: false,
        error: email ? 'User not found with this email' : 'No account registered with this phone number'
      }, 404)
    }

    // Generate verification code
    const code = generateVerificationCode()
    const codeHash = await sha256Hex(code)
    const expiresAt = Math.floor((Date.now() + 5 * 60 * 1000) / 1000) // 5 minutes

    // Update user record with verification code
    await env.VEGVISR_DB.prepare(
      'UPDATE config SET phone = ?, phone_verified_at = NULL, phone_verification_code = ?, phone_verification_expires_at = ? WHERE email = ?'
    ).bind(phone, codeHash, expiresAt, userRow.email).run()

    // Send SMS via ClickSend
    const smsResult = await sendSMSViaClickSend(
      [phone],
      `Your Vegvisr verification code is: ${code}`,
      'Vegvisr',
      env
    )

    if (!smsResult.success) {
      return jsonResponse({
        success: false,
        error: 'Failed to send verification SMS',
        details: smsResult.error
      }, 502)
    }

    console.log(`✅ Verification code sent to ${phone} for ${userRow.email}`)

    return jsonResponse({
      success: true,
      phone: phone,
      expires_at: expiresAt,
      message: 'Verification code sent'
    })
  } catch (error) {
    console.error('Error in /api/auth/phone/send-code:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

/**
 * POST /api/auth/phone/verify-code
 * Verify a phone verification code
 * Body: { email: string, code: string } OR { phone: string, code: string }
 */
async function handleVerifyCode(request, env) {
  try {
    const body = await request.json()
    const email = (body.email || '').trim().toLowerCase()
    const phone = body.phone ? normalizePhoneNumber(body.phone) : null
    const code = String(body.code || '').trim()

    if (!email && !phone) {
      return jsonResponse({ error: 'Email or phone is required' }, 400)
    }

    if (!code || !/^\d{6}$/.test(code)) {
      return jsonResponse({ error: 'A 6-digit code is required' }, 400)
    }

    // Lookup user (include user_id from config table)
    let row
    if (email) {
      row = await env.VEGVISR_DB.prepare(
        'SELECT user_id, email, phone, phone_verification_code, phone_verification_expires_at FROM config WHERE email = ?'
      ).bind(email).first()
    } else {
      row = await env.VEGVISR_DB.prepare(
        'SELECT user_id, email, phone, phone_verification_code, phone_verification_expires_at FROM config WHERE phone = ?'
      ).bind(phone).first()
    }

    if (!row || !row.phone) {
      return jsonResponse({ error: 'No phone on record for this user' }, 404)
    }

    if (!row.phone_verification_code || !row.phone_verification_expires_at) {
      return jsonResponse({ error: 'No active verification code. Please request a new one.' }, 400)
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000)
    if (row.phone_verification_expires_at < now) {
      return jsonResponse({ error: 'Verification code expired. Please request a new one.' }, 400)
    }

    // Verify code hash
    const codeHash = await sha256Hex(code)
    if (codeHash !== row.phone_verification_code) {
      return jsonResponse({ error: 'Invalid verification code' }, 401)
    }

    // Mark phone as verified
    await env.VEGVISR_DB.prepare(
      'UPDATE config SET phone_verified_at = ?, phone_verification_code = NULL, phone_verification_expires_at = NULL WHERE email = ?'
    ).bind(now, row.email).run()

    console.log(`✅ Phone verified for ${row.email}: ${row.phone} (user_id: ${row.user_id})`)

    return jsonResponse({
      success: true,
      user_id: row.user_id || null,
      email: row.email,
      phone: row.phone,
      verified_at: now
    })
  } catch (error) {
    console.error('Error in /api/auth/phone/verify-code:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

/**
 * POST /api/auth/user/validate
 * Validate user_id/email/phone against config and ensure phone is verified
 * Body: { user_id?: string, email?: string, phone?: string }
 */
async function handleUserValidate(request, env) {
  try {
    const body = await request.json()
    const userId = (body.user_id || '').trim()
    const email = (body.email || '').trim().toLowerCase()
    const phoneInput = body.phone ? String(body.phone) : ''
    const phone = phoneInput ? normalizePhoneNumber(phoneInput) : ''

    if (!userId && !email && !phoneInput) {
      return jsonResponse({ error: 'user_id, email, or phone required' }, 400)
    }

    if (phoneInput && !phone) {
      return jsonResponse({ error: 'Invalid phone number format' }, 400)
    }

    let row
    if (userId) {
      row = await env.VEGVISR_DB.prepare(
        'SELECT user_id, email, phone, phone_verified_at FROM config WHERE user_id = ?'
      ).bind(userId).first()
    } else if (email) {
      row = await env.VEGVISR_DB.prepare(
        'SELECT user_id, email, phone, phone_verified_at FROM config WHERE email = ?'
      ).bind(email).first()
    } else if (phone) {
      row = await env.VEGVISR_DB.prepare(
        'SELECT user_id, email, phone, phone_verified_at FROM config WHERE phone = ?'
      ).bind(phone).first()
    }

    if (!row) {
      return jsonResponse({ success: false, error: 'User not found' }, 404)
    }

    if (email && row.email !== email) {
      return jsonResponse({ success: false, error: 'Email does not match user' }, 401)
    }

    if (phone && row.phone !== phone) {
      return jsonResponse({ success: false, error: 'Phone does not match user' }, 401)
    }

    if (!row.phone_verified_at) {
      return jsonResponse({ success: false, error: 'Phone not verified' }, 401)
    }

    return jsonResponse({
      success: true,
      user_id: row.user_id || null,
      email: row.email,
      phone: row.phone || null,
      phone_verified_at: row.phone_verified_at
    })
  } catch (error) {
    console.error('Error in /api/auth/user/validate:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

// ===== KNOWLEDGE GRAPH SAVE (PROXY) =====

/**
 * Save content to Knowledge Graph
 * Validates phone authentication and proxies to Knowledge Graph Worker
 */
async function handleSaveGraph(request, env) {
  try {
    const payload = await request.json()
    const { phone, userId, title, content, youtubeUrl, publicEdit } = payload

    if (!phone) {
      return jsonResponse({ error: 'Phone number is required' }, 400)
    }

    if (!content) {
      return jsonResponse({ error: 'Content is required' }, 400)
    }

    // Verify phone is authenticated in our database
    const normalizedPhone = normalizePhoneNumber(phone)
    const row = await env.VEGVISR_DB.prepare(
      'SELECT email, phone, phone_verified_at FROM config WHERE phone = ? AND phone_verified_at IS NOT NULL'
    ).bind(normalizedPhone).first()

    if (!row) {
      return jsonResponse({ error: 'Phone not verified. Please log in again.' }, 401)
    }

    // Check if service binding is available
    if (!env.KNOWLEDGE_GRAPH_WORKER?.fetch) {
      return jsonResponse({ error: 'Knowledge Graph service not configured' }, 500)
    }

    // Generate IDs
    const graphId = `graph_${Date.now()}`
    const nodeId = crypto.randomUUID()
    const now = new Date().toISOString()
    const userIdentifier = row.email || normalizedPhone

    // Build nodes array
    const nodes = [
      {
        id: nodeId,
        color: '#4f6d7a',
        label: title || 'Hello Vegvisr',
        type: 'fulltext',
        info: `${content}\n\n---\n\n*Created by: ${userIdentifier}*\n\n*Created at: ${now}*`,
        bibl: ['https://hello.vegvisr.org'],
        imageWidth: null,
        imageHeight: null,
        visible: true,
        position: { x: 0, y: 0 },
        path: null
      }
    ]

    const edges = []

    // Add YouTube node if URL provided
    if (youtubeUrl) {
      const youtubeNodeId = crypto.randomUUID()
      nodes.push({
        id: youtubeNodeId,
        color: '#FF0000',
        label: `YouTube: ${title || 'Video'}`,
        type: 'youtube-video',
        info: `Video attached to: ${title || 'Hello Vegvisr Document'}\n\nCreated by: ${userIdentifier}\nCreated at: ${now}`,
        bibl: [youtubeUrl],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        position: { x: 200, y: 0 },
        path: youtubeUrl
      })

      edges.push({
        id: `edge_${Date.now()}`,
        source: nodeId,
        target: youtubeNodeId,
        label: 'has video'
      })
    }

    // Build graph data
    const graphData = {
      metadata: {
        title: title || 'Hello Vegvisr Document',
        description: `Markdown document created by ${userIdentifier} at ${now}${youtubeUrl ? ' (with YouTube video)' : ''}`,
        createdBy: 'hallo-vegvisr-flutter',
        userId: userId || null,
        version: 0,
        publicEdit: publicEdit === true
      },
      nodes: nodes,
      edges: edges
    }

    // Call Knowledge Graph Worker via service binding
    const kgResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
      'https://knowledge-graph-worker/saveGraphWithHistory',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: graphId,
          graphData: graphData,
          override: false
        })
      }
    )

    if (!kgResponse.ok) {
      const errorText = await kgResponse.text()
      console.error('Knowledge Graph error:', errorText)
      return jsonResponse({ error: 'Failed to save to Knowledge Graph', details: errorText }, 500)
    }

    const graphUrl = `https://www.vegvisr.org/gnew-viewer?graphId=${graphId}`

    return jsonResponse({
      success: true,
      graphId: graphId,
      nodeId: nodeId,
      graphUrl: graphUrl,
      message: 'Document saved to Knowledge Graph'
    })

  } catch (error) {
    console.error('Error in /api/save-graph:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

// ===== AI CHAT (PROXY) =====

/**
 * AI chat proxy
 * Validates phone authentication and proxies to Grok/OpenAI workers.
 */
async function handleAiChat(request, env) {
  try {
    const payload = await request.json()
    const {
      phone,
      userId,
      provider = 'grok',
      messages,
      model,
      temperature,
      max_tokens,
      max_completion_tokens
    } = payload

    if (!phone) {
      return jsonResponse({ error: 'Phone number is required' }, 400)
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: 'Messages array is required' }, 400)
    }

    const normalizedPhone = normalizePhoneNumber(phone)
    const row = await env.VEGVISR_DB.prepare(
      'SELECT user_id, email, phone, phone_verified_at FROM config WHERE phone = ? AND phone_verified_at IS NOT NULL'
    ).bind(normalizedPhone).first()

    if (!row) {
      return jsonResponse({ error: 'Phone not verified. Please log in again.' }, 401)
    }

    const effectiveUserId = userId || row.user_id || null
    const useOpenAI = provider === 'openai'
    const service = useOpenAI ? env.OPENAI_WORKER : env.GROK_WORKER
    const serviceUrl = useOpenAI
      ? 'https://openai-worker/chat'
      : 'https://grok-worker/chat'
    const publicUrl = useOpenAI
      ? 'https://openai.vegvisr.org/chat'
      : 'https://grok.vegvisr.org/chat'

    const body = {
      userId: effectiveUserId,
      messages
    }

    if (model) body.model = model
    if (temperature !== undefined) body.temperature = temperature
    if (max_completion_tokens !== undefined) {
      body.max_completion_tokens = max_completion_tokens
    } else if (max_tokens !== undefined) {
      body.max_tokens = max_tokens
    }

    const aiResponse = service?.fetch
      ? await service.fetch(serviceUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      : await fetch(publicUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      return jsonResponse({ error: 'AI request failed', details: errorText }, aiResponse.status)
    }

    const data = await aiResponse.json()
    const aiMessage = data?.choices?.[0]?.message?.content || ''

    return jsonResponse({
      success: true,
      message: aiMessage,
      model: data?.model,
      usage: data?.usage
    })
  } catch (error) {
    console.error('Error in /api/ai-chat:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

/**
 * Get graphs created by the authenticated user
 * Lists graphs filtered by the user's phone/email
 */
async function handleMyGraphs(request, env) {
  try {
    const payload = await request.json()
    const { phone, userId } = payload

    if (!phone) {
      return jsonResponse({ error: 'Phone number is required' }, 400)
    }

    // Verify phone is authenticated
    const normalizedPhone = normalizePhoneNumber(phone)
    const row = await env.VEGVISR_DB.prepare(
      'SELECT email, phone, phone_verified_at FROM config WHERE phone = ? AND phone_verified_at IS NOT NULL'
    ).bind(normalizedPhone).first()

    if (!row) {
      return jsonResponse({ error: 'Phone not verified. Please log in again.' }, 401)
    }

    // Check if service binding is available
    if (!env.KNOWLEDGE_GRAPH_WORKER?.fetch) {
      return jsonResponse({ error: 'Knowledge Graph service not configured' }, 500)
    }

    // If userId is available, use efficient direct SQL query via new endpoint
    if (userId) {
      const kgResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
        `https://knowledge-graph-worker/getGraphsByUser?userId=${encodeURIComponent(userId)}&sourceApp=hallo-vegvisr-flutter&limit=50`,
        { method: 'GET' }
      )

      if (kgResponse.ok) {
        const data = await kgResponse.json()
        if (data.success && data.graphs) {
          console.log(`Found ${data.graphs.length} graphs for user ${userId} via direct query`)
          return jsonResponse({
            success: true,
            graphs: data.graphs
          })
        }
      }
      // Fall through to legacy method if new endpoint fails
      console.log('Direct query failed, falling back to legacy method')
    }

    // Legacy fallback: scan graphs and check metadata (for graphs created before migration)
    const kgResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
      'https://knowledge-graph-worker/getknowgraphs',
      { method: 'GET' }
    )

    if (!kgResponse.ok) {
      const errorText = await kgResponse.text()
      console.error('Knowledge Graph error:', errorText)
      return jsonResponse({ error: 'Failed to fetch graphs' }, 500)
    }

    const responseData = await kgResponse.json()
    const allGraphs = responseData.results || responseData || []

    if (!Array.isArray(allGraphs)) {
      return jsonResponse({ success: true, graphs: [] })
    }

    // Filter graphs created by this user
    const userIdentifier = row.email || normalizedPhone
    const myGraphs = []

    // Only check graphs with graph_ prefix (created by Flutter app)
    const flutterGraphs = allGraphs.filter(g => g.id?.startsWith('graph_'))

    // Sort by ID descending (newest first)
    const sortedGraphs = [...flutterGraphs].sort((a, b) => {
      const timeA = parseInt(a.id?.replace('graph_', '') || '0')
      const timeB = parseInt(b.id?.replace('graph_', '') || '0')
      return timeB - timeA
    })

    // Check up to 50 most recent graphs for ownership
    const graphsToCheck = sortedGraphs.slice(0, 50)

    for (const graph of graphsToCheck) {
      try {
        const detailResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
          `https://knowledge-graph-worker/getknowgraph?id=${encodeURIComponent(graph.id)}`,
          { method: 'GET' }
        )

        if (detailResponse.ok) {
          const graphData = await detailResponse.json()
          const createdBy = graphData.metadata?.createdBy || ''
          const graphUserId = graphData.metadata?.userId || ''
          const description = graphData.metadata?.description || ''

          // Check ownership: prefer userId match, fallback to description match
          const isOwner = (userId && graphUserId === userId) ||
                          (createdBy === 'hallo-vegvisr-flutter' && description.includes(userIdentifier))

          if (isOwner) {
            myGraphs.push({
              id: graph.id,
              title: graphData.metadata?.title || graph.title || 'Untitled',
              description: description,
              createdAt: graph.id ? new Date(parseInt(graph.id.replace('graph_', ''))).toISOString() : null
            })
          }
        }
      } catch (e) {
        console.error(`Error fetching graph ${graph.id}:`, e)
      }
    }

    return jsonResponse({
      success: true,
      graphs: myGraphs
    })

  } catch (error) {
    console.error('Error in /api/my-graphs:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

/**
 * Delete a graph created by the authenticated user
 */
async function handleDeleteGraph(request, env) {
  try {
    const payload = await request.json()
    const { phone, userId, graphId } = payload

    if (!phone) {
      return jsonResponse({ error: 'Phone number is required' }, 400)
    }

    if (!graphId) {
      return jsonResponse({ error: 'Graph ID is required' }, 400)
    }

    // Verify phone is authenticated
    const normalizedPhone = normalizePhoneNumber(phone)
    const row = await env.VEGVISR_DB.prepare(
      'SELECT email, phone, phone_verified_at FROM config WHERE phone = ? AND phone_verified_at IS NOT NULL'
    ).bind(normalizedPhone).first()

    if (!row) {
      return jsonResponse({ error: 'Phone not verified. Please log in again.' }, 401)
    }

    // Check if service binding is available
    if (!env.KNOWLEDGE_GRAPH_WORKER?.fetch) {
      return jsonResponse({ error: 'Knowledge Graph service not configured' }, 500)
    }

    // First, verify the user owns this graph
    const getResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
      `https://knowledge-graph-worker/getknowgraph?id=${encodeURIComponent(graphId)}`,
      { method: 'GET' }
    )

    if (!getResponse.ok) {
      return jsonResponse({ error: 'Graph not found' }, 404)
    }

    const graph = await getResponse.json()
    const userIdentifier = row.email || normalizedPhone
    const createdBy = graph.metadata?.createdBy || ''
    const graphUserId = graph.metadata?.userId || ''
    const description = graph.metadata?.description || ''

    // Check ownership: prefer userId match, fallback to description match
    const isOwner = (userId && graphUserId === userId) ||
                    (createdBy === 'hallo-vegvisr-flutter' && description.includes(userIdentifier))

    if (!isOwner) {
      return jsonResponse({ error: 'You can only delete graphs you created' }, 403)
    }

    // Delete the graph
    const deleteResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
      'https://knowledge-graph-worker/deleteknowgraph',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: graphId })
      }
    )

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text()
      console.error('Delete error:', errorText)
      return jsonResponse({ error: 'Failed to delete graph' }, 500)
    }

    return jsonResponse({
      success: true,
      message: 'Graph deleted successfully'
    })

  } catch (error) {
    console.error('Error in /api/delete-graph:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

/**
 * Get a single graph's content for editing
 * Returns the graph data including nodes content
 */
async function handleGetGraph(request, env) {
  try {
    const payload = await request.json()
    const { phone, userId, graphId } = payload

    if (!phone) {
      return jsonResponse({ error: 'Phone number is required' }, 400)
    }

    if (!graphId) {
      return jsonResponse({ error: 'Graph ID is required' }, 400)
    }

    // Verify phone is authenticated
    const normalizedPhone = normalizePhoneNumber(phone)
    const row = await env.VEGVISR_DB.prepare(
      'SELECT email, phone, phone_verified_at FROM config WHERE phone = ? AND phone_verified_at IS NOT NULL'
    ).bind(normalizedPhone).first()

    if (!row) {
      return jsonResponse({ error: 'Phone not verified. Please log in again.' }, 401)
    }

    // Check if service binding is available
    if (!env.KNOWLEDGE_GRAPH_WORKER?.fetch) {
      return jsonResponse({ error: 'Knowledge Graph service not configured' }, 500)
    }

    // Fetch the graph
    const getResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
      `https://knowledge-graph-worker/getknowgraph?id=${encodeURIComponent(graphId)}`,
      { method: 'GET' }
    )

    if (!getResponse.ok) {
      return jsonResponse({ error: 'Graph not found' }, 404)
    }

    const graph = await getResponse.json()
    const userIdentifier = row.email || normalizedPhone
    const createdBy = graph.metadata?.createdBy || ''
    const graphUserId = graph.metadata?.userId || ''
    const description = graph.metadata?.description || ''
    const publicEdit =
      graph.metadata?.publicEdit === true || graph.metadata?.publicEdit === 'true'

    // Check ownership
    const isOwner = (userId && graphUserId === userId) ||
                    (createdBy === 'hallo-vegvisr-flutter' && description.includes(userIdentifier))

    if (!isOwner && !publicEdit) {
      return jsonResponse({ error: 'You can only view graphs you created' }, 403)
    }

    // Extract content from first fulltext node
    const fulltextNode = graph.nodes?.find(n => n.type === 'fulltext')
    const content = fulltextNode?.info || ''

    // Extract YouTube URL from youtube-video node if exists
    const youtubeNode = graph.nodes?.find(n => n.type === 'youtube-video')
    const youtubeUrl = youtubeNode?.path || youtubeNode?.bibl?.[0] || null

    return jsonResponse({
      success: true,
      graph: {
        id: graphId,
        title: graph.metadata?.title || 'Untitled',
        content: content,
        youtubeUrl: youtubeUrl,
        publicEdit: publicEdit,
        version: graph.metadata?.version || 0,
        createdAt: graph.created_date,
        updatedAt: graph.updated_at
      }
    })

  } catch (error) {
    console.error('Error in /api/get-graph:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

/**
 * Update an existing graph
 * Preserves the graph ID and updates content
 */
async function handleUpdateGraph(request, env) {
  try {
    const payload = await request.json()
    const { phone, userId, graphId, title, content, youtubeUrl, publicEdit } = payload

    if (!phone) {
      return jsonResponse({ error: 'Phone number is required' }, 400)
    }

    if (!graphId) {
      return jsonResponse({ error: 'Graph ID is required' }, 400)
    }

    if (!content) {
      return jsonResponse({ error: 'Content is required' }, 400)
    }

    // Verify phone is authenticated
    const normalizedPhone = normalizePhoneNumber(phone)
    const row = await env.VEGVISR_DB.prepare(
      'SELECT email, phone, phone_verified_at FROM config WHERE phone = ? AND phone_verified_at IS NOT NULL'
    ).bind(normalizedPhone).first()

    if (!row) {
      return jsonResponse({ error: 'Phone not verified. Please log in again.' }, 401)
    }

    // Check if service binding is available
    if (!env.KNOWLEDGE_GRAPH_WORKER?.fetch) {
      return jsonResponse({ error: 'Knowledge Graph service not configured' }, 500)
    }

    // First, verify the user owns this graph
    const getResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
      `https://knowledge-graph-worker/getknowgraph?id=${encodeURIComponent(graphId)}`,
      { method: 'GET' }
    )

    if (!getResponse.ok) {
      return jsonResponse({ error: 'Graph not found' }, 404)
    }

    const existingGraph = await getResponse.json()
    const userIdentifier = row.email || normalizedPhone
    const createdBy = existingGraph.metadata?.createdBy || ''
    const graphUserId = existingGraph.metadata?.userId || ''
    const description = existingGraph.metadata?.description || ''
    const existingPublicEdit = existingGraph.metadata?.publicEdit === true || existingGraph.metadata?.publicEdit === 'true'

    // Check ownership
    const isOwner = (userId && graphUserId === userId) ||
                    (createdBy === 'hallo-vegvisr-flutter' && description.includes(userIdentifier))

    if (!isOwner && !existingPublicEdit) {
      return jsonResponse({ error: 'You can only edit graphs you created' }, 403)
    }

    const now = new Date().toISOString()

    // Find existing node IDs to preserve them
    const existingFulltextNode = existingGraph.nodes?.find(n => n.type === 'fulltext')
    const existingYoutubeNode = existingGraph.nodes?.find(n => n.type === 'youtube-video')

    // Build updated nodes
    const nodes = [
      {
        id: existingFulltextNode?.id || crypto.randomUUID(),
        color: '#4f6d7a',
        label: title || 'Hello Vegvisr',
        type: 'fulltext',
        info: `${content}\n\n---\n\n*Created by: ${userIdentifier}*\n\n*Updated at: ${now}*`,
        bibl: existingFulltextNode?.bibl || ['https://hello.vegvisr.org'],
        imageWidth: null,
        imageHeight: null,
        visible: true,
        position: existingFulltextNode?.position || { x: 0, y: 0 },
        path: null
      }
    ]

    const edges = []

    // Handle YouTube node
    if (youtubeUrl) {
      const youtubeNodeId = existingYoutubeNode?.id || crypto.randomUUID()
      nodes.push({
        id: youtubeNodeId,
        color: '#FF0000',
        label: `YouTube: ${title || 'Video'}`,
        type: 'youtube-video',
        info: `Video attached to: ${title || 'Hello Vegvisr Document'}\n\nUpdated at: ${now}`,
        bibl: [youtubeUrl],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        position: existingYoutubeNode?.position || { x: 200, y: 0 },
        path: youtubeUrl
      })

      edges.push({
        id: `edge_${Date.now()}`,
        source: nodes[0].id,
        target: youtubeNodeId,
        label: 'has video'
      })
    }

    // Build updated graph data
    const graphData = {
      metadata: {
        title: title || existingGraph.metadata?.title || 'Hello Vegvisr Document',
        description: `Markdown document updated by ${userIdentifier} at ${now}${youtubeUrl ? ' (with YouTube video)' : ''}`,
        createdBy: 'hallo-vegvisr-flutter',
        userId: userId || existingGraph.metadata?.userId || null,
        version: existingGraph.metadata?.version || 0,
        publicEdit: isOwner ? publicEdit === true : existingPublicEdit
      },
      nodes: nodes,
      edges: edges
    }

    // Save with override to bypass version check
    const kgResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
      'https://knowledge-graph-worker/saveGraphWithHistory',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: graphId,
          graphData: graphData,
          override: true
        })
      }
    )

    if (!kgResponse.ok) {
      const errorText = await kgResponse.text()
      console.error('Knowledge Graph error:', errorText)
      return jsonResponse({ error: 'Failed to update graph', details: errorText }, 500)
    }

    const result = await kgResponse.json()

    return jsonResponse({
      success: true,
      graphId: graphId,
      newVersion: result.newVersion,
      message: 'Graph updated successfully'
    })

  } catch (error) {
    console.error('Error in /api/update-graph:', error)
    return jsonResponse({ error: error.message }, 500)
  }
}

// ===== OPENAPI SPECIFICATION =====

function getOpenAPISpec(url) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'SMS Gateway Worker API',
      description: 'SMS Gateway Worker using ClickSend for sending SMS messages. Supports Norwegian phone numbers (+47) only.',
      version: '3.1.0',
      contact: {
        name: 'Vegvisr',
        url: 'https://vegvisr.org'
      }
    },
    servers: [
      {
        url: url.origin,
        description: 'Current server'
      }
    ],
    paths: {
      '/': {
        get: {
          summary: 'Health check',
          description: 'Returns service status and version information',
          operationId: 'healthCheck',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'Service is running',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'SMS Gateway Worker - ClickSend' },
                      version: { type: 'string', example: '3.1.0' },
                      timestamp: { type: 'string', format: 'date-time' },
                      docs: { type: 'string', format: 'uri' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/sms': {
        post: {
          summary: 'Send SMS',
          description: 'Send SMS message to one or more Norwegian phone numbers via ClickSend',
          operationId: 'sendSMS',
          tags: ['SMS'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message'],
                  properties: {
                    to: {
                      oneOf: [
                        { type: 'string', description: 'Single phone number' },
                        { type: 'array', items: { type: 'string' }, description: 'Array of phone numbers' }
                      ],
                      description: 'Recipient phone number(s). Norwegian numbers only (+47).'
                    },
                    recipients: {
                      type: 'array',
                      items: {
                        oneOf: [
                          { type: 'string' },
                          {
                            type: 'object',
                            properties: {
                              msisdn: { type: 'string' },
                              phone: { type: 'string' },
                              to: { type: 'string' },
                              number: { type: 'string' }
                            }
                          }
                        ]
                      },
                      description: 'Alternative to "to" field. Array of recipients.'
                    },
                    message: { type: 'string', description: 'SMS message content' },
                    sender: { type: 'string', maxLength: 11, description: 'Sender ID (max 11 characters)' }
                  }
                },
                example: {
                  to: '+4712345678',
                  message: 'Hello from Vegvisr!',
                  sender: 'Vegvisr'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'SMS sent successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SMSResponse' }
                }
              }
            },
            '400': {
              description: 'Bad request',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            },
            '500': {
              description: 'Server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/api/sms/history': {
        get: {
          summary: 'Get SMS history',
          description: 'Retrieve SMS sending history from ClickSend',
          operationId: 'getSMSHistory',
          tags: ['SMS'],
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'string', default: '1' },
              description: 'Page number'
            },
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', default: 'all' },
              description: 'Filter by status'
            }
          ],
          responses: {
            '200': {
              description: 'SMS history retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'object' },
                      http_code: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/lists': {
        get: {
          summary: 'Get recipient lists',
          description: 'Get all recipient lists for a user',
          operationId: 'getLists',
          tags: ['Recipient Lists'],
          parameters: [
            {
              name: 'userEmail',
              in: 'query',
              required: true,
              schema: { type: 'string', format: 'email' },
              description: 'User email address'
            }
          ],
          responses: {
            '200': {
              description: 'Lists retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      lists: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/RecipientList' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Create recipient list',
          description: 'Create a new recipient list',
          operationId: 'createList',
          tags: ['Recipient Lists'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userEmail', 'userId', 'name'],
                  properties: {
                    userEmail: { type: 'string', format: 'email' },
                    userId: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'List created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      id: { type: 'string' },
                      name: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/lists/{listId}': {
        delete: {
          summary: 'Delete recipient list',
          description: 'Delete a recipient list by ID',
          operationId: 'deleteList',
          tags: ['Recipient Lists'],
          parameters: [
            {
              name: 'listId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'List ID'
            }
          ],
          responses: {
            '200': {
              description: 'List deleted',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessResponse' }
                }
              }
            }
          }
        }
      },
      '/api/lists/{listId}/recipients': {
        get: {
          summary: 'Get recipients',
          description: 'Get all recipients in a list',
          operationId: 'getRecipients',
          tags: ['Recipient Lists'],
          parameters: [
            {
              name: 'listId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'List ID'
            }
          ],
          responses: {
            '200': {
              description: 'Recipients retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      recipients: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Recipient' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Add recipient',
          description: 'Add a recipient to a list',
          operationId: 'addRecipient',
          tags: ['Recipient Lists'],
          parameters: [
            {
              name: 'listId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'List ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phoneNumber'],
                  properties: {
                    name: { type: 'string' },
                    phoneNumber: { type: 'string' },
                    notes: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Recipient added',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      id: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/lists/{listId}/recipients/{recipientId}': {
        delete: {
          summary: 'Delete recipient',
          description: 'Delete a recipient from a list',
          operationId: 'deleteRecipient',
          tags: ['Recipient Lists'],
          parameters: [
            {
              name: 'listId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'List ID'
            },
            {
              name: 'recipientId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Recipient ID'
            }
          ],
          responses: {
            '200': {
              description: 'Recipient deleted',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessResponse' }
                }
              }
            }
          }
        }
      },
      '/api/auth/phone/status': {
        get: {
          summary: 'Get phone verification status',
          description: 'Check if a user has a verified phone number',
          operationId: 'getPhoneStatus',
          tags: ['Phone Authentication'],
          parameters: [
            {
              name: 'email',
              in: 'query',
              schema: { type: 'string', format: 'email' },
              description: 'User email address'
            },
            {
              name: 'phone',
              in: 'query',
              schema: { type: 'string' },
              description: 'Phone number to check'
            }
          ],
          responses: {
            '200': {
              description: 'Status retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      email: { type: 'string' },
                      phone: { type: 'string', nullable: true },
                      phone_verified_at: { type: 'integer', nullable: true },
                      verified: { type: 'boolean' }
                    }
                  }
                }
              }
            },
            '404': {
              description: 'User not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/api/auth/phone/send-code': {
        post: {
          summary: 'Send verification code',
          description: 'Send a 6-digit verification code via SMS',
          operationId: 'sendVerificationCode',
          tags: ['Phone Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone'],
                  properties: {
                    email: { type: 'string', format: 'email', description: 'User email (optional for phone-only login)' },
                    phone: { type: 'string', description: 'Norwegian phone number to verify' }
                  }
                },
                example: {
                  email: 'user@example.com',
                  phone: '+4712345678'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Code sent',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      phone: { type: 'string' },
                      expires_at: { type: 'integer' },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            },
            '404': {
              description: 'User not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/api/auth/phone/verify-code': {
        post: {
          summary: 'Verify code',
          description: 'Verify the 6-digit SMS code',
          operationId: 'verifyCode',
          tags: ['Phone Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['code'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    code: { type: 'string', pattern: '^\\d{6}$', description: '6-digit verification code' }
                  }
                },
                example: {
                  email: 'user@example.com',
                  code: '123456'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Phone verified',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      email: { type: 'string' },
                      phone: { type: 'string' },
                      verified_at: { type: 'integer' }
                    }
                  }
                }
              }
            },
            '401': {
              description: 'Invalid code',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        SMSResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            totalRecipients: { type: 'integer' },
            successfulSends: { type: 'integer' },
            messageIds: { type: 'array', items: { type: 'string' } },
            totalPrice: { type: 'number' },
            currency: { type: 'string', example: 'NOK' },
            messages: { type: 'array', items: { type: 'object' } },
            error: { type: 'object', nullable: true }
          }
        },
        RecipientList: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            user_email: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            created_at: { type: 'integer' },
            updated_at: { type: 'integer' }
          }
        },
        Recipient: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            list_id: { type: 'string' },
            name: { type: 'string', nullable: true },
            phone_number: { type: 'string' },
            notes: { type: 'string', nullable: true },
            created_at: { type: 'integer' }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    },
    tags: [
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'SMS', description: 'SMS sending and history' },
      { name: 'Recipient Lists', description: 'Manage recipient lists and contacts' },
      { name: 'Phone Authentication', description: 'Phone number verification via SMS' }
    ]
  }
}
