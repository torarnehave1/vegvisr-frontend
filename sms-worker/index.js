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

    if (url.pathname === '/' || url.pathname === '/api') {
      return jsonResponse({
        success: true,
        message: 'SMS Gateway Worker - ClickSend',
        version: '3.0.0',
        timestamp: new Date().toISOString()
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  })
}
