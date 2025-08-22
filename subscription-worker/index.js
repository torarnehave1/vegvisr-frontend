// Helper function to call main-worker endpoints via service binding
async function callMainWorker(env, endpoint, params = {}) {
  const queryString = new URLSearchParams(params).toString()
  const url = `https://main-worker.internal${endpoint}${queryString ? `?${queryString}` : ''}`

  const request = new Request(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  try {
    const response = await env.MAIN_WORKER.fetch(request)
    console.log('Service binding call successful:', response.status)
    return response
  } catch (error) {
    console.error('Service binding error:', error.message)
    throw error
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    }

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // Route handling
      if (path === '/subscribe' && request.method === 'POST') {
        return await handleSubscribe(request, env, corsHeaders)
      } else if (path === '/unsubscribe' && request.method === 'POST') {
        return await handleUnsubscribe(request, env, corsHeaders)
      } else if (path === '/verify-subscription' && request.method === 'GET') {
        return await handleVerifySubscription(request, env, corsHeaders)
      } else if (path === '/list-subscriptions' && request.method === 'GET') {
        return await handleListSubscriptions(request, env, corsHeaders)
      } else if (path === '/health' && request.method === 'GET') {
        return new Response('Subscription Worker is healthy', {
          status: 200,
          headers: corsHeaders,
        })
      }

      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders,
      })
    } catch (error) {
      console.error('Worker error:', error)
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          details: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }
  },
}

// Subscribe to a graph, category, or meta area
async function handleSubscribe(request, env, corsHeaders) {
  try {
    const { email, subscription_type, target_id, target_title } = await request.json()

    // Validate input
    if (!email || !subscription_type || !target_id) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: email, subscription_type, target_id',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate subscription type
    const validTypes = ['category', 'meta_area', 'system_events', 'all_content', 'user_activity']
    if (!validTypes.includes(subscription_type)) {
      return new Response(
        JSON.stringify({
          error: `Invalid subscription_type. Must be one of: ${validTypes.join(', ')}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Generate unique ID and unsubscribe token
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const unsubscribeToken = crypto.randomUUID()

    // Check if user already exists in config table
    const existingUserQuery = `SELECT user_id, data FROM config WHERE email = ?`
    const existingUser = await env.vegvisr_org.prepare(existingUserQuery).bind(email).first()

    if (existingUser) {
      // User exists, update their subscription data
      const userData = JSON.parse(existingUser.data || '{}')
      if (!userData.subscriptions) userData.subscriptions = []

      // Check if this subscription already exists
      const existingSubscription = userData.subscriptions.find(
        (sub) => sub.subscription_type === subscription_type && sub.target_id === target_id,
      )

      if (existingSubscription) {
        // Reactivate existing subscription
        existingSubscription.status = 'active'
        existingSubscription.updated_at = new Date().toISOString()
      } else {
        // Add new subscription
        userData.subscriptions.push({
          id: subscriptionId,
          subscription_type,
          target_id,
          target_title,
          status: 'active',
          unsubscribe_token: unsubscribeToken,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }

      // Update user data
      const updateQuery = `UPDATE config SET data = ? WHERE email = ?`
      const updateResult = await env.vegvisr_org
        .prepare(updateQuery)
        .bind(JSON.stringify(userData), email)
        .run()

      if (!updateResult.success) {
        throw new Error('Failed to update subscription')
      }
    } else {
      // User doesn't exist, register them as subscriber
      const subscriptionData = {
        profile: {
          email: email,
        },
        settings: {
          darkMode: false,
          notifications: true,
          theme: 'light',
        },
        subscriptions: [
          {
            id: subscriptionId,
            subscription_type,
            target_id,
            target_title,
            status: 'active',
            unsubscribe_token: unsubscribeToken,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      }

      // Call the existing registration endpoint using service binding
      const registrationResponse = await callMainWorker(env, '/sve2', {
        email: email,
        role: 'Subscriber',
      })

      if (!registrationResponse.ok) {
        throw new Error('Failed to register subscriber')
      }

      // Wait briefly for database consistency after user creation
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Get the user_id that was created by main-worker to preserve it in the profile
      const userQuery = `SELECT user_id, data FROM config WHERE email = ?`
      let createdUser = null

      // Retry logic for database consistency
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          createdUser = await env.vegvisr_org.prepare(userQuery).bind(email).first()
          if (createdUser) break

          console.log(`User not found on attempt ${attempt}, retrying...`)
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
        } catch (dbError) {
          console.error(`Database query error on attempt ${attempt}:`, dbError)
          if (attempt === 3) throw dbError
        }
      }

      if (createdUser) {
        // Preserve the user_id in the profile section
        subscriptionData.profile.user_id = createdUser.user_id
      } else {
        console.warn('Could not find created user, proceeding without user_id preservation')
      }

      // Update the user's data with subscription information
      const updateQuery = `UPDATE config SET data = ? WHERE email = ?`
      const updateResult = await env.vegvisr_org
        .prepare(updateQuery)
        .bind(JSON.stringify(subscriptionData), email)
        .run()

      if (!updateResult.success) {
        throw new Error('Failed to save subscription data')
      }
    }

    // Notify external server (slowyou.io)
    try {
      await fetch('https://slowyou.io/api/subscription-created', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_id: subscriptionId,
          email,
          subscription_type,
          target_id,
          target_title,
          unsubscribe_token: unsubscribeToken,
        }),
      })
    } catch (externalError) {
      console.error('External server notification failed:', externalError)
      // Continue - don't fail the subscription if external server is down
    }

    // Determine user status for enhanced frontend messaging
    const userStatus = existingUser ? 'existing_user' : 'new_subscriber'

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription created successfully',
        subscription_id: subscriptionId,
        unsubscribe_token: unsubscribeToken,
        user_status: userStatus, // For frontend messaging logic
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Subscribe error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to create subscription',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

// Unsubscribe from notifications
async function handleUnsubscribe(request, env, corsHeaders) {
  try {
    const { email, unsubscribe_token } = await request.json()

    if (!email || !unsubscribe_token) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: email, unsubscribe_token',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Get user data from config table
    const getUserQuery = `SELECT data FROM config WHERE email = ?`
    const userResult = await env.vegvisr_org.prepare(getUserQuery).bind(email).first()

    if (!userResult) {
      return new Response(
        JSON.stringify({
          error: 'User not found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse user data and find subscription
    const userData = JSON.parse(userResult.data || '{}')
    if (!userData.subscriptions) userData.subscriptions = []

    // Find and update subscription
    const subscriptionIndex = userData.subscriptions.findIndex(
      (sub) => sub.unsubscribe_token === unsubscribe_token && sub.status === 'active',
    )

    if (subscriptionIndex === -1) {
      return new Response(
        JSON.stringify({
          error: 'Subscription not found or already unsubscribed',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Update subscription status
    userData.subscriptions[subscriptionIndex].status = 'unsubscribed'
    userData.subscriptions[subscriptionIndex].updated_at = new Date().toISOString()

    // Update user data in database
    const updateQuery = `UPDATE config SET data = ? WHERE email = ?`
    const updateResult = await env.vegvisr_org
      .prepare(updateQuery)
      .bind(JSON.stringify(userData), email)
      .run()

    if (!updateResult.success) {
      throw new Error('Failed to update subscription status')
    }

    // Notify external server
    try {
      await fetch('https://slowyou.io/api/subscription-cancelled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          unsubscribe_token,
        }),
      })
    } catch (externalError) {
      console.error('External server notification failed:', externalError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully unsubscribed',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to unsubscribe',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

// Verify if an email is subscribed to a target
async function handleVerifySubscription(request, env, corsHeaders) {
  try {
    const url = new URL(request.url)
    const email = url.searchParams.get('email')
    const subscription_type = url.searchParams.get('subscription_type')
    const target_id = url.searchParams.get('target_id')

    if (!email || !subscription_type || !target_id) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameters: email, subscription_type, target_id',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Get user data from config table
    const getUserQuery = `SELECT data FROM config WHERE email = ?`
    const userResult = await env.vegvisr_org.prepare(getUserQuery).bind(email).first()

    if (!userResult) {
      return new Response(
        JSON.stringify({
          subscribed: false,
          subscription: null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse user data and find subscription
    const userData = JSON.parse(userResult.data || '{}')
    if (!userData.subscriptions) userData.subscriptions = []

    // Find matching subscription
    const subscription = userData.subscriptions.find(
      (sub) =>
        sub.subscription_type === subscription_type &&
        sub.target_id === target_id &&
        sub.status === 'active',
    )

    return new Response(
      JSON.stringify({
        subscribed: !!subscription,
        subscription: subscription || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Verify subscription error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to verify subscription',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

// List all subscriptions for an email
async function handleListSubscriptions(request, env, corsHeaders) {
  try {
    const url = new URL(request.url)
    const email = url.searchParams.get('email')

    if (!email) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameter: email',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Get user data from config table
    const getUserQuery = `SELECT data FROM config WHERE email = ?`
    const userResult = await env.vegvisr_org.prepare(getUserQuery).bind(email).first()

    if (!userResult) {
      return new Response(
        JSON.stringify({
          subscriptions: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse user data and filter active subscriptions
    const userData = JSON.parse(userResult.data || '{}')
    const activeSubscriptions = (userData.subscriptions || []).filter(
      (sub) => sub.status === 'active',
    )

    // Sort by created_at descending
    activeSubscriptions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    return new Response(
      JSON.stringify({
        subscriptions: activeSubscriptions,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('List subscriptions error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to list subscriptions',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}
