// SMS API Backend Implementation Example
// Add this to your Cloudflare Worker or Express.js backend

// ============================================
// CLOUDFLARE WORKER IMPLEMENTATION (Recommended)
// ============================================

export default {
  async fetch(request, env) {
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Token'
        }
      });
    }

    if (request.method === 'POST' && new URL(request.url).pathname === '/api/sms/send') {
      return handleSMSSend(request, env);
    }

    return new Response('Not found', { status: 404 });
  }
};

async function handleSMSSend(request, env) {
  try {
    // 1. Verify API token
    const apiToken = request.headers.get('X-API-Token');
    if (!apiToken) {
      return jsonResponse({ success: false, error: 'API token required' }, 401);
    }

    // Verify token against your database
    const user = await verifyUserToken(apiToken, env.DB);
    if (!user) {
      return jsonResponse({ success: false, error: 'Invalid token' }, 401);
    }

    // 2. Parse request body
    const { to, message } = await request.json();

    // 3. Validate input
    if (!to || !message) {
      return jsonResponse({
        success: false,
        error: 'Phone number and message are required'
      }, 400);
    }

    // Validate phone format (basic)
    if (!to.match(/^\+?[1-9]\d{1,14}$/)) {
      return jsonResponse({
        success: false,
        error: 'Invalid phone number format. Use international format: +4712345678'
      }, 400);
    }

    // 4. Check rate limits
    const canSend = await checkRateLimit(user.user_id, env.SMS_RATE_LIMIT);
    if (!canSend) {
      return jsonResponse({
        success: false,
        error: 'Rate limit exceeded. Max 100 SMS per day.'
      }, 429);
    }

    // 5. Send SMS via Twilio (example)
    const twilioResponse = await sendViaTwilio(to, message, env);

    // 6. Log to database
    await logSMSToDatabase(env.DB, {
      user_id: user.user_id,
      to: to,
      message: message,
      message_id: twilioResponse.sid,
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    // 7. Increment rate limit counter
    await incrementRateLimit(user.user_id, env.SMS_RATE_LIMIT);

    return jsonResponse({
      success: true,
      messageId: twilioResponse.sid,
      to: to,
      status: 'sent'
    });

  } catch (error) {
    console.error('SMS send error:', error);
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// Send SMS via Twilio
async function sendViaTwilio(to, message, env) {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const fromNumber = env.TWILIO_FROM_NUMBER;

  const auth = btoa(`${accountSid}:${authToken}`);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: message
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Twilio API error');
  }

  return await response.json();
}

// Verify user token
async function verifyUserToken(token, db) {
  const result = await db.prepare(
    'SELECT user_id, email FROM users WHERE emailVerificationToken = ?'
  ).bind(token).first();

  return result;
}

// Check rate limit (100 SMS per day)
async function checkRateLimit(userId, kvStore) {
  const key = `sms_count_${userId}_${getCurrentDate()}`;
  const count = await kvStore.get(key);

  return !count || parseInt(count) < 100;
}

// Increment rate limit counter
async function incrementRateLimit(userId, kvStore) {
  const key = `sms_count_${userId}_${getCurrentDate()}`;
  const count = await kvStore.get(key) || '0';

  await kvStore.put(key, (parseInt(count) + 1).toString(), {
    expirationTtl: 86400 // Expire after 24 hours
  });
}

// Log SMS to database
async function logSMSToDatabase(db, data) {
  await db.prepare(`
    INSERT INTO sms_logs (user_id, recipient, message, message_id, status, sent_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    data.user_id,
    data.to,
    data.message,
    data.message_id,
    data.status,
    data.sent_at
  ).run();
}

function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// ============================================
// EXPRESS.JS IMPLEMENTATION (Alternative)
// ============================================

/*
const express = require('express');
const twilio = require('twilio');
const router = express.Router();

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

router.post('/api/sms/send', async (req, res) => {
  try {
    // Verify API token
    const apiToken = req.headers['x-api-token'];
    const user = await verifyUserToken(apiToken);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API token'
      });
    }

    const { to, message } = req.body;

    // Validate
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone and message required'
      });
    }

    // Check rate limit
    const canSend = await checkUserRateLimit(user.user_id);
    if (!canSend) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded'
      });
    }

    // Send SMS
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_FROM_NUMBER,
      to: to
    });

    // Log to database
    await logSMS(user.user_id, to, message, result.sid);

    res.json({
      success: true,
      messageId: result.sid,
      to: to,
      status: 'sent'
    });

  } catch (error) {
    console.error('SMS error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
*/

// ============================================
// DATABASE SCHEMA FOR SMS LOGS
// ============================================

/*
CREATE TABLE sms_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  recipient VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  message_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'sent',
  sent_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sms_logs_user ON sms_logs(user_id);
CREATE INDEX idx_sms_logs_sent_at ON sms_logs(sent_at);
*/

// ============================================
// ENVIRONMENT VARIABLES NEEDED
// ============================================

/*
# Twilio credentials (get from twilio.com)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+1234567890

# Alternative: Vonage/Nexmo
VONAGE_API_KEY=your_api_key
VONAGE_API_SECRET=your_api_secret
VONAGE_FROM_NUMBER=YOUR_BRAND_NAME

# Alternative: MessageBird
MESSAGEBIRD_API_KEY=your_api_key
*/

// ============================================
// TESTING THE ENDPOINT
// ============================================

/*
# Test with curl:
curl -X POST https://api.vegvisr.org/api/sms/send \
  -H "Content-Type: application/json" \
  -H "X-API-Token: your_user_token" \
  -d '{
    "to": "+4712345678",
    "message": "Test message from App Builder!"
  }'

# Expected response:
{
  "success": true,
  "messageId": "SM1234567890abcdef",
  "to": "+4712345678",
  "status": "sent"
}
*/
