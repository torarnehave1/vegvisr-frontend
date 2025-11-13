/**
 * SMS Gateway Worker (Cloudflare)
 *
 * Sends SMS messages via SMSMobileAPI (https://api.smsmobileapi.com)
 *
 * Environment Variables Required:
 *   SMS_API_BASE_URL - Base URL for SMS API (e.g., "https://api.smsmobileapi.com/sendsms/")
 *   SMS_API_KEY      - API key for SMS service (set as Wrangler secret)
 */

// Main request handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS()
    }

    const url = new URL(request.url)

    // Route: POST /api/sms
    if (url.pathname === '/api/sms' && request.method === 'POST') {
      return handleSendSMS(request, env)
    }

    // Route not found
    return jsonResponse({ error: 'Not found' }, 404)
  }
}

/**
 * Handle SMS sending requests
 */
async function handleSendSMS(request, env) {
  try {
    // Validate environment variables
    if (!env.SMS_API_BASE_URL || !env.SMS_API_KEY) {
      console.error('Missing required environment variables')
      return jsonResponse(
        { error: 'Server configuration error: missing SMS API credentials' },
        500
      )
    }

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return jsonResponse(
        { error: 'Invalid JSON in request body' },
        400
      )
    }

    // Validate required fields
    if (!body.to || !body.message) {
      return jsonResponse(
        { error: 'Missing required fields: "to" and "message" are required' },
        400
      )
    }

    // Normalize phone numbers to array
    const recipients = normalizePhoneNumbers(body.to)

    if (recipients.length === 0) {
      return jsonResponse(
        { error: 'No valid phone numbers provided' },
        400
      )
    }

    // Validate message
    const message = String(body.message).trim()
    if (!message) {
      return jsonResponse(
        { error: 'Message cannot be empty' },
        400
      )
    }

    // Send SMS to all recipients
    const results = await sendBulkSMS(recipients, message, env)

    // Determine overall success
    const allSuccessful = results.every(r => r.ok)

    return jsonResponse({
      success: allSuccessful,
      totalRecipients: recipients.length,
      successfulSends: results.filter(r => r.ok).length,
      results: results
    })

  } catch (error) {
    console.error('Unexpected error in handleSendSMS:', error)
    return jsonResponse(
      { error: 'Internal server error', details: error.message },
      500
    )
  }
}

/**
 * Normalize phone numbers input to array
 * Handles both string and array inputs, trims whitespace
 */
function normalizePhoneNumbers(input) {
  if (!input) return []

  // Convert to array if string
  const numbers = Array.isArray(input) ? input : [input]

  // Filter and trim
  return numbers
    .map(num => String(num).trim())
    .filter(num => num.length > 0)
}

/**
 * Send SMS to multiple recipients
 * Sends one request per recipient
 */
async function sendBulkSMS(recipients, message, env) {
  const promises = recipients.map(phoneNumber =>
    sendSingleSMS(phoneNumber, message, env)
  )

  return await Promise.all(promises)
}

/**
 * Send SMS to a single recipient
 * Returns detailed result object
 */
async function sendSingleSMS(phoneNumber, message, env) {
  const result = {
    number: phoneNumber,
    ok: false,
    status: null,
    providerResponse: null
  }

  try {
    // Build provider URL with query parameters
    const providerUrl = new URL(env.SMS_API_BASE_URL)
    providerUrl.searchParams.set('recipients', phoneNumber)
    providerUrl.searchParams.set('message', message)
    providerUrl.searchParams.set('apikey', env.SMS_API_KEY)

    console.log(`Sending SMS to ${phoneNumber}`)

    // Call provider API
    const response = await fetch(providerUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Vegvisr-SMS-Gateway/1.0'
      }
    })

    result.status = response.status
    result.ok = response.ok

    // Try to parse response
    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      try {
        result.providerResponse = await response.json()
      } catch {
        result.providerResponse = await response.text()
      }
    } else {
      result.providerResponse = await response.text()
    }

    if (response.ok) {
      console.log(`✅ SMS sent successfully to ${phoneNumber}`)
    } else {
      console.error(`❌ SMS failed for ${phoneNumber}: ${response.status}`, result.providerResponse)
    }

  } catch (error) {
    console.error(`Error sending SMS to ${phoneNumber}:`, error)
    result.ok = false
    result.status = 0
    result.providerResponse = {
      error: 'Network error',
      details: error.message
    }
  }

  return result
}

/**
 * Create JSON response with CORS headers
 */
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

/**
 * Handle CORS preflight requests
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  })
}
