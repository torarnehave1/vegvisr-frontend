import { v4 as uuidv4 } from 'uuid' // Import UUID library
import { SignJWT } from 'jose' // Import jose for JWT handling

// Middleware to add CORS headers
function addCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

// Cloudflare Worker fetch handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method // Added declaration for request method

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
          const data = {
            email: responseBody.email,
            emailVerificationToken: responseBody.emailVerificationToken,
            emailVerified: true,
            role: 'ViewOnly',
          }
          const insertQuery = `
            INSERT INTO config (user_id, email, emailVerificationToken, data, role)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(email) DO NOTHING;
          `
          console.log(
            'Executing query:',
            insertQuery,
            'with parameters:',
            userId,
            data.email,
            data.emailVerificationToken,
            JSON.stringify({}),
            data.role,
          )
          const { changes } = await db
            .prepare(insertQuery)
            .bind(userId, data.email, data.emailVerificationToken, JSON.stringify({}), data.role)
            .run()
          if (changes === 0) {
            console.log('No changes made to the database - user might already exist')
          } else {
            console.log(
              `Inserted record into database: user_id=${userId}, email=${data.email}, emailVerificationToken=${data.emailVerificationToken}, data=${JSON.stringify({})}, role=${data.role}`,
            )
          }
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
              const existingUserQuery = `
                SELECT emailVerificationToken
                FROM config
                WHERE email = ?;
              `
              console.log('Checking if user exists in the database with query:', existingUserQuery)
              const existingUser = await db
                .prepare(existingUserQuery)
                .bind(parsedBody.email)
                .first()

              if (existingUser) {
                console.log(`User with email=${parsedBody.email} already exists in the database`)

                // Update the emailVerificationToken and set role to ViewOnly
                const updateQuery = `
                  UPDATE config
                  SET emailVerificationToken = ?, role = 'ViewOnly'
                  WHERE email = ?;
                `
                console.log(
                  'Executing update query:',
                  updateQuery,
                  'with parameters:',
                  parsedBody.emailVerificationToken,
                  parsedBody.email,
                )
                const updateResult = await db
                  .prepare(updateQuery)
                  .bind(parsedBody.emailVerificationToken, parsedBody.email)
                  .run()

                console.log('Update result:', updateResult)
                if (updateResult.changes === 0) {
                  console.warn(
                    `No rows were updated for email=${parsedBody.email}. This might indicate an issue.`,
                  )
                }

                console.log(
                  `Successfully updated emailVerificationToken for email=${parsedBody.email} in the database.`,
                )
              } else {
                console.log(`Creating new user with email=${parsedBody.email}`)
                const userId = uuidv4() // Generate a unique user ID
                const insertQuery = `
                  INSERT INTO config (user_id, email, emailVerificationToken, data, role)
                  VALUES (?, ?, ?, ?, ?);
                `
                const insertResult = await db
                  .prepare(insertQuery)
                  .bind(
                    userId,
                    parsedBody.email,
                    parsedBody.emailVerificationToken,
                    JSON.stringify({}),
                    'ViewOnly',
                  )
                  .run()

                if (insertResult.changes === 0) {
                  console.error(`Failed to create new user for email=${parsedBody.email}`)
                  return addCorsHeaders(
                    new Response(JSON.stringify({ error: 'Failed to create user in database.' }), {
                      status: 500,
                    }),
                  )
                }

                console.log(`Successfully created new user for email=${parsedBody.email}`)
              }

              // Set a JWT token for the user using the emailVerificationToken
              const jwtSecret = new TextEncoder().encode(env.JWT_SECRET) // Convert secret to Uint8Array
              const jwtToken = await new SignJWT({
                emailVerificationToken: parsedBody.emailVerificationToken,
              })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('730d') // Set expiration time to 2 years
                .sign(jwtSecret)

              console.log('Generated JWT Token:', jwtToken)

              // Redirect to login page with email and token in query parameters
              return addCorsHeaders(
                new Response(null, {
                  status: 302,
                  headers: {
                    Location: `https://www.vegvisr.org/login?email=${encodeURIComponent(
                      parsedBody.email,
                    )}&token=${encodeURIComponent(jwtToken)}`,
                  },
                }),
              )
            } catch (dbError) {
              console.error('Error updating emailVerificationToken in database:', dbError)
              return addCorsHeaders(
                new Response(
                  JSON.stringify({
                    error: 'Failed to update emailVerificationToken in database.',
                    details: dbError.message,
                  }),
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

      if (path === '/check-email' && method === 'GET') {
        console.log('Received GET /check-email request')

        const userEmail = url.searchParams.get('email')
        if (!userEmail) {
          console.error('Error in GET /check-email: Missing email parameter')
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Missing email parameter' }), { status: 400 }),
          )
        }

        const db = env.vegvisr_org // Access the D1 database binding

        try {
          // Case 1: User is registered and verified
          const queryVerified = `
            SELECT user_id
            FROM config
            WHERE email = ? AND emailVerificationToken IS NOT NULL;
          `
          const verifiedUser = await db.prepare(queryVerified).bind(userEmail).first()

          if (verifiedUser) {
            console.log(`User with email ${userEmail} is registered and verified`)
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  exists: true,
                  verified: true,
                  user_id: verifiedUser.user_id,
                }),
                { status: 200 },
              ),
            )
          }

          // Case 2: User is registered but not verified
          const queryNotVerified = `
            SELECT user_id
            FROM config
            WHERE email = ? AND emailVerificationToken IS NULL;
          `
          const notVerifiedUser = await db.prepare(queryNotVerified).bind(userEmail).first()

          if (notVerifiedUser) {
            console.log(`User with email ${userEmail} is registered but not verified`)
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  exists: true,
                  verified: false,
                  user_id: notVerifiedUser.user_id,
                }),
                { status: 200 },
              ),
            )
          }

          // Case 3: User is not found
          console.log(`User with email ${userEmail} does not exist in the database`)
          return addCorsHeaders(
            new Response(JSON.stringify({ exists: false, verified: false }), { status: 200 }),
          )
        } catch (dbError) {
          console.error('Error checking for existing user in database:', dbError)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Failed to check database for existing user.' }), {
              status: 500,
            }),
          )
        }
      }

      if (path === '/reset-registration' && method === 'POST') {
        console.log('Received POST /reset-registration request')

        const requestBody = await request.json()
        const userEmail = requestBody.email

        if (!userEmail) {
          console.error('Error in POST /reset-registration: Missing email parameter')
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Missing email parameter' }), { status: 400 }),
          )
        }

        const db = env.vegvisr_org // Access the D1 database binding

        try {
          const deleteQuery = `
            DELETE FROM config
            WHERE email = ?;
          `
          const deleteResult = await db.prepare(deleteQuery).bind(userEmail).run()

          console.log('Delete result:', deleteResult)

          if (deleteResult.changes > 0) {
            console.log(`User with email ${userEmail} deleted from the database`)
            return addCorsHeaders(
              new Response(JSON.stringify({ message: 'User registration reset successfully.' }), {
                status: 200,
              }),
            )
          } else {
            console.log(`User with email ${userEmail} not found in the database`)
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'User not found in the database.' }), {
                status: 404,
              }),
            )
          }
        } catch (dbError) {
          console.error('Error deleting user from database:', dbError)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Failed to delete user from database.' }), {
              status: 500,
            }),
          )
        }
      }

      if (path === '/set-jwt' && method === 'GET') {
        console.log('Received GET /set-jwt request')

        const userEmail = url.searchParams.get('email')
        if (!userEmail) {
          console.error('Error in GET /set-jwt: Missing email parameter')
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Missing email parameter' }), { status: 400 }),
          )
        }

        const db = env.vegvisr_org // Access the D1 database binding

        try {
          // Retrieve the emailVerificationToken for the given email
          const query = `
        SELECT emailVerificationToken
        FROM config
        WHERE email = ?;
          `
          const userRecord = await db.prepare(query).bind(userEmail).first()

          if (!userRecord || !userRecord.emailVerificationToken) {
            console.error(`No valid emailVerificationToken found for email=${userEmail}`)
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: 'No valid emailVerificationToken found for this email.' }),
                { status: 404 },
              ),
            )
          }

          // Generate a JWT token using the emailVerificationToken
          const jwtSecret = new TextEncoder().encode(env.JWT_SECRET) // Convert secret to Uint8Array
          const jwtToken = await new SignJWT({
            emailVerificationToken: userRecord.emailVerificationToken,
          })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('730d') // Set expiration time to 2 years
            .sign(jwtSecret)

          console.log('Generated JWT Token:', jwtToken)

          // Return the JWT token to the client
          return addCorsHeaders(
            new Response(JSON.stringify({ jwt: jwtToken }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (dbError) {
          console.error('Error retrieving emailVerificationToken from database:', dbError)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Failed to retrieve emailVerificationToken from database.' }),
              { status: 500 },
            ),
          )
        }
      }

      if (path === '/github/issues' && method === 'GET') {
        console.log('Received GET /github/issues request')

        try {
          const response = await fetch('https://www.slowyou.io/api/github/issues', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            },
          })

          if (!response.ok) {
            console.error(`Error fetching GitHub issues: ${response.status} ${response.statusText}`)
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `Failed to fetch GitHub issues. API returned status ${response.status}.`,
                }),
                { status: response.status },
              ),
            )
          }

          const issues = await response.json()
          return addCorsHeaders(
            new Response(JSON.stringify(issues), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          console.error('Error fetching GitHub issues:', error)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Failed to fetch GitHub issues.' }), {
              status: 500,
            }),
          )
        }
      }

      if (path === '/github/create-issue' && method === 'POST') {
        console.log('Received POST /github/create-issue request')

        try {
          const requestBody = await request.json()
          const { title, body, labels } = requestBody

          if (!title || !body) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Title and body are required fields.' }), {
                status: 400,
              }),
            )
          }

          const response = await fetch('https://www.slowyou.io/api/github/create-issue', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            },
            body: JSON.stringify({
              title,
              body,
              labels: labels || [],
            }),
          })

          if (!response.ok) {
            console.error(`Error creating GitHub issue: ${response.status} ${response.statusText}`)
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `Failed to create GitHub issue. API returned status ${response.status}.`,
                }),
                { status: response.status },
              ),
            )
          }

          const result = await response.json()
          return addCorsHeaders(
            new Response(JSON.stringify(result), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          console.error('Error creating GitHub issue:', error)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Failed to create GitHub issue.' }), {
              status: 500,
            }),
          )
        }
      }

      if (path === '/userdata' && method === 'PUT') {
        const db = env.vegvisr_org
        const body = await request.json()
        console.log('Received PUT /userdata request:', JSON.stringify(body, null, 2))
        const { email, bio, data, profileimage } = body
        if (!email || !data || !profileimage) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Missing required fields: email, data, or profileimage' }),
              { status: 400 },
            ),
          )
        }
        if (
          typeof data !== 'object' ||
          !data.profile ||
          !data.settings ||
          typeof data.profile !== 'object' ||
          typeof data.settings !== 'object'
        ) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Invalid data structure' }), { status: 400 }),
          )
        }
        const dataJson = JSON.stringify(data)
        const query = `
          INSERT INTO config (email, bio, data, profileimage)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET bio = ?, data = ?, profileimage = ?;
        `
        await db
          .prepare(query)
          .bind(email, bio, dataJson, profileimage, bio, dataJson, profileimage)
          .run()
        return addCorsHeaders(
          new Response(
            JSON.stringify({ success: true, message: 'User data updated successfully' }),
            { status: 200 },
          ),
        )
      }

      // Handle other routes
      return new Response('Not Found', { status: 404 })
    } catch (error) {
      console.error('Error in fetch handler:', error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
  },
}
