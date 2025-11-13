/**
 * SMS Gateway Worker (Cloudflare)
 *
 * Sends SMS messages via GatewayAPI (https://gatewayapi.com)
 *
 * Environment Variables Required:
 *   SMS_API_BASE_URL - Base URL for SMS API (e.g., "https://gatewayapi.com/rest/mtsms")
 *   SMS_API_TOKEN    - API token for GatewayAPI (set as Wrangler secret)
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
    if (!env.SMS_API_BASE_URL || !env.SMS_API_TOKEN) {
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

    // Normalize and validate sender name (max 11 alphanumeric chars or 15 digits)
    let sender = body.sender || null
    if (sender) {
      sender = String(sender).trim()
      // Truncate to 11 characters for alphanumeric senders
      if (sender.length > 11) {
        console.log(`Sender name truncated from "${sender}" to "${sender.substring(0, 11)}"`)
        sender = sender.substring(0, 11)
      }
    }

    // Send SMS using GatewayAPI (single request for all recipients)
    const result = await sendSMSViaGatewayAPI(recipients, message, sender, env)

    return jsonResponse(result)

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
 * Send SMS via GatewayAPI
 * Uses GatewayAPI REST endpoint with Basic Authentication
 */
async function sendSMSViaGatewayAPI(recipients, message, sender, env) {
  const result = {
    success: false,
    totalRecipients: recipients.length,
    successfulSends: 0,
    messageIds: [],
    usage: null,
    error: null
  }

  try {
    // Convert phone numbers to GatewayAPI format (msisdn objects)
    const recipientsArray = recipients.map(phoneNumber => ({
      msisdn: parseInt(phoneNumber.replace(/\+/g, ''), 10) // Remove + and convert to integer
    }))

    // Build request payload
    const payload = {
      message: message,
      recipients: recipientsArray
    }

    // Add sender if provided (up to 11 alphanumeric chars or 15 digits)
    if (sender) {
      payload.sender = sender
    }

    console.log('Sending SMS via GatewayAPI:', {
      recipients: recipientsArray.length,
      sender: sender || 'default'
    })

    // Create Basic Auth header (format: "token:")
    const authString = btoa(`${env.SMS_API_TOKEN}:`)

    // Call GatewayAPI
    const response = await fetch(env.SMS_API_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Vegvisr-SMS-Gateway/2.0'
      },
      body: JSON.stringify(payload)
    })

    const responseData = await response.json()

    if (response.ok) {
      // Success response
      result.success = true
      result.successfulSends = recipients.length
      result.messageIds = responseData.ids || []
      result.usage = responseData.usage || null

      console.log(`✅ SMS sent successfully to ${recipients.length} recipient(s)`)
      console.log(`   Message IDs: ${result.messageIds.join(', ')}`)
      if (result.usage) {
        console.log(`   Cost: ${result.usage.total_cost} ${result.usage.currency}`)
      }
    } else {
      // Error response
      result.success = false
      result.error = {
        status: response.status,
        code: responseData.code || null,
        message: responseData.message || 'Unknown error',
        incident_uuid: responseData.incident_uuid || null
      }

      console.error(`❌ SMS failed: ${response.status}`, responseData)
    }

  } catch (error) {
    console.error('Error calling GatewayAPI:', error)
    result.success = false
    result.error = {
      type: 'network_error',
      message: error.message
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
