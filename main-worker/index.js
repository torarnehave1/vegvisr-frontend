import { v4 as uuidv4 } from 'uuid' // Import UUID library

// Middleware to add CORS headers
function addCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

// Function to generate a unique file name
function generateUniqueFileName(user_id, fileExtension) {
  const uniqueId = uuidv4()
  return `${user_id}/profileimage_${uniqueId}.${fileExtension}`
}

// Cloudflare Worker fetch handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    // Handle CORS preflight requests
    if (method === 'OPTIONS') {
      return addCorsHeaders(new Response(null, { status: 204 }))
    }

    try {
      if (path === '/sve2' && method === 'GET') {
        console.log('Received GET /sve2 request')

        const userEmail = url.searchParams.get('email')
        const apiToken = env.API_TOKEN // Retrieve the token from the environment variable

        if (!apiToken) {
          console.error('Error in GET /sve2: Missing API token')
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Missing API token' }), { status: 500 }),
          )
        }

        if (!userEmail) {
          console.error('Error in GET /sve2: Missing email parameter')
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Missing email parameter' }), { status: 400 }),
          )
        }

        const db = env.vegvisr_org // Access the D1 database binding

        // Check if the user already exists in the database by checking if the email is already present
        try {
          const query = `
            SELECT user_id
            FROM config
            WHERE email = ?;
          `
          const existingUser = await db.prepare(query).bind(userEmail).first()
          if (existingUser) {
            console.log(`User with email ${userEmail} already exists in the database`)
            return addCorsHeaders(
              new Response(JSON.stringify({ message: 'User with this email already exists.' }), {
                status: 200,
              }),
            )
          }
        } catch (dbError) {
          console.error('Error checking for existing user in database:', dbError)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Failed to check database for existing user.' }), {
              status: 500,
            }),
          )
        }

        // Call the external API to register the user
        const apiUrl = `https://slowyou.io/api/reg-user-vegvisr?email=${encodeURIComponent(userEmail)}`
        console.log('API URL:', apiUrl)
        console.log('Authorization Header:', `Bearer ${apiToken}`)

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
        })

        console.log('Response status:', response.status)
        const rawBody = await response.text()
        console.log('Raw response body:', rawBody)

        if (!response.ok) {
          console.error(`Error from external API: ${response.status} ${response.statusText}`)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: `Failed to register user. External API returned status ${response.status}.`,
              }),
              { status: 500 },
            ),
          )
        }

        let responseBody
        try {
          responseBody = JSON.parse(rawBody)
        } catch (parseError) {
          console.error('Error parsing response body:', parseError)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Failed to parse response from external API.' }), {
              status: 500,
            }),
          )
        }

        // Insert the new user into the database
        try {
          const userId = uuidv4() // Generate a unique user ID
          const defaultData =
            '{"profile":{"username":"","email":"","bio":""},"settings":{"darkMode":false,"notifications":true,"theme":"dark"}}'
          const insertQuery = `
            INSERT INTO config (email, user_id, data)
            VALUES (?, ?, ?)
            ON CONFLICT(email) DO NOTHING;
          `
          console.log(
            'Executing query:',
            insertQuery,
            'with parameters:',
            userEmail,
            userId,
            defaultData,
          )
          await db.prepare(insertQuery).bind(userEmail, userId, defaultData).run()
          console.log(
            `Inserted record into database: email=${userEmail}, user_id=${userId}, data=${defaultData}`,
          )
        } catch (dbError) {
          console.error('Error inserting record into database:', dbError)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Failed to insert record into database.' }), {
              status: 500,
            }),
          )
        }

        return addCorsHeaders(
          new Response(JSON.stringify({ status: response.status, body: responseBody }), {
            status: 200,
          }),
        )
      }

      if (path === '/resend-verification' && method === 'POST') {
        console.log('Received POST /resend-verification request')

        const requestBody = await request.json()
        const userEmail = requestBody.email
        const apiToken = env.API_TOKEN // Retrieve the token from the environment variable

        if (!apiToken) {
          console.error('Error in POST /resend-verification: Missing API token')
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Missing API token' }), { status: 500 }),
          )
        }

        if (!userEmail) {
          console.error('Error in POST /resend-verification: Missing email parameter')
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Missing email parameter' }), { status: 400 }),
          )
        }

        // Call the external API to resend the verification email
        const apiUrl = `https://slowyou.io/api/resend-verification-email?email=${encodeURIComponent(
          userEmail,
        )}`
        console.log('API URL:', apiUrl)
        console.log('Authorization Header:', `Bearer ${apiToken}`)

        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiToken}`,
            },
          })

          console.log('Response status:', response.status)
          const rawBody = await response.text()
          console.log('Raw response body:', rawBody)

          if (!response.ok) {
            console.error(`Error from external API: ${response.status} ${response.statusText}`)
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `Failed to resend verification email. External API returned status ${response.status}.`,
                }),
                { status: 500 },
              ),
            )
          }

          return addCorsHeaders(
            new Response(JSON.stringify({ message: 'Verification email resent successfully.' }), {
              status: 200,
            }),
          )
        } catch (error) {
          console.error('Error calling external API:', error)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Failed to resend verification email.' }), {
              status: 500,
            }),
          )
        }
      }

      if (path === '/verify-email' && method === 'GET') {
        console.log('Received GET /verify-email request')

        const emailToken = url.searchParams.get('token')
        if (!emailToken) {
          console.error('Error in GET /verify-email: Missing token parameter')
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Missing token parameter' }), { status: 400 }),
          )
        }

        try {
          console.log('Sending request to external verification API with token:', emailToken)
          const verifyResponse = await fetch(
            `https://slowyou.io/api/verify-email?token=${emailToken}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )

          console.log('External API response status:', verifyResponse.status)
          if (!verifyResponse.ok) {
            console.error(
              `Error from external API: ${verifyResponse.status} ${verifyResponse.statusText}`,
            )
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `Failed to verify email. External API returned status ${verifyResponse.status}.`,
                }),
                { status: 500 },
              ),
            )
          }

          const rawBody = await verifyResponse.text()
          console.log('Response body from external API:', rawBody)

          let parsedBody
          try {
            parsedBody = JSON.parse(rawBody)
          } catch (parseError) {
            console.error('Error parsing response body:', parseError)
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: 'Failed to parse response from external API.' }),
                { status: 500 },
              ),
            )
          }

          if (
            parsedBody.message === 'Email verified successfully.' &&
            parsedBody.emailVerificationToken
          ) {
            const db = env.vegvisr_org // Access the D1 database binding
            try {
              const updateQuery = `
                UPDATE config
                SET emailVerificationToken = ?
                WHERE email = ?;
              `
              console.log(
                'Executing query:',
                updateQuery,
                'with parameters:',
                parsedBody.emailVerificationToken,
                parsedBody.email,
              )
              await db
                .prepare(updateQuery)
                .bind(parsedBody.emailVerificationToken, parsedBody.email)
                .run()
              console.log(
                `Updated emailVerificationToken for email=${parsedBody.email} in the database.`,
              )
            } catch (dbError) {
              console.error('Error updating emailVerificationToken in database:', dbError)
              return addCorsHeaders(
                new Response(
                  JSON.stringify({ error: 'Failed to update emailVerificationToken in database.' }),
                  { status: 500 },
                ),
              )
            }
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                status: verifyResponse.status,
                ok: verifyResponse.ok,
                body: parsedBody,
              }),
              { status: 200 },
            ),
          )
        } catch (error) {
          console.error('Error fetching from external API:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to contact verification API. Please try again later.',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // Handle other routes
      return new Response('Not Found', { status: 404 })
    } catch (error) {
      console.error('Error in fetch handler:', error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
  },
}
