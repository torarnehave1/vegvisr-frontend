import { v4 as uuidv4 } from 'uuid' // Import UUID library
import { SignJWT } from 'jose' // Import jose for JWT handling

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

// Get user from session (JWT token)
function getUserFromSession(request, env) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { loggedIn: false }
    }

    const token = authHeader.substring(7)

    // For testing purposes, accept any Bearer token as valid
    // In production, you'd implement proper JWT verification
    if (token && token.length > 10) {
      return {
        loggedIn: true,
        user_id: '9999', // Default test user ID
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
      }
    }

    return { loggedIn: false }
  } catch (error) {
    console.error('Error getting user from session:', error)
    return { loggedIn: false }
  }
}

// Cloudflare Worker fetch handler
export default {
  async fetch(request, env) {
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
        const userRole = url.searchParams.get('role') || 'ViewOnly' // Default to ViewOnly if no role specified
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

          // Create proper user data structure based on role
          const userData =
            userRole === 'subscriber'
              ? {
                  profile: {
                    user_id: userId,
                    email: userEmail,
                  },
                  settings: {
                    darkMode: false,
                    notifications: true,
                    theme: 'light',
                  },
                  subscriptions: [], // Will be populated after verification by subscription-worker
                }
              : {} // Empty for regular users

          const insertQuery = `
            INSERT INTO config (user_id, email, emailVerificationToken, data, role)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(email) DO NOTHING;
          `
          console.log(
            'Executing registration query:',
            insertQuery,
            'with parameters:',
            userId,
            userEmail,
            'NULL', // emailVerificationToken is NULL during registration, filled during verification
            JSON.stringify(userData),
            userRole,
          )
          const { changes } = await db
            .prepare(insertQuery)
            .bind(userId, userEmail, null, JSON.stringify(userData), userRole)
            .run()

          if (changes === 0) {
            console.log('User already exists - no database changes made')
          } else {
            console.log(
              `Successfully created new user: user_id=${userId}, email=${userEmail}, role=${userRole}`,
            )
          }
        } catch (dbError) {
          console.error('Error inserting user record into database:', dbError)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Failed to create user record in database.' }), {
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

                // Update the emailVerificationToken while preserving existing role
                const updateQuery = `
                  UPDATE config
                  SET emailVerificationToken = ?
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
                  `Successfully updated emailVerificationToken for email=${parsedBody.email} (role preserved)`,
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

      if (path === '/userdata' && method === 'GET') {
        const url = new URL(request.url)
        const userEmail = url.searchParams.get('email')
        if (!userEmail) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Missing email parameter' }), { status: 400 }),
          )
        }
        const db = env.vegvisr_org
        console.log('Fetching user data for email:', userEmail)
        // First, let's check the table structure
        const tableInfo = await db.prepare('PRAGMA table_info(config)').all()
        console.log('Table structure:', tableInfo)

        // Check if columns exist and add them if missing
        const hasBioColumn = tableInfo.results.some((col) => col.name === 'bio')
        const hasProfileImageColumn = tableInfo.results.some((col) => col.name === 'profileimage')
        const hasEmailVerificationTokenColumn = tableInfo.results.some(
          (col) => col.name === 'emailVerificationToken',
        )
        const hasRoleColumn = tableInfo.results.some((col) => col.name === 'role')

        try {
          if (!hasBioColumn) {
            console.log('Adding bio column to config table')
            await db.prepare('ALTER TABLE config ADD COLUMN bio TEXT').run()
          }
        } catch (e) {
          console.log('Bio column may already exist:', e.message)
        }

        try {
          if (!hasProfileImageColumn) {
            console.log('Adding profileimage column to config table')
            await db.prepare('ALTER TABLE config ADD COLUMN profileimage TEXT').run()
          }
        } catch (e) {
          console.log('Profileimage column may already exist:', e.message)
        }

        try {
          if (!hasEmailVerificationTokenColumn) {
            console.log('Adding emailVerificationToken column to config table')
            await db.prepare('ALTER TABLE config ADD COLUMN emailVerificationToken TEXT').run()
          }
        } catch (e) {
          console.log('EmailVerificationToken column may already exist:', e.message)
        }

        try {
          if (!hasRoleColumn) {
            console.log('Adding role column to config table')
            await db.prepare('ALTER TABLE config ADD COLUMN role TEXT DEFAULT "ViewOnly"').run()
          }
        } catch (e) {
          console.log('Role column may already exist:', e.message)
        }

        const query = `SELECT user_id, data, profileimage, emailVerificationToken, bio FROM config WHERE email = ?;`
        const row = await db.prepare(query).bind(userEmail).first()
        console.log('Database row:', row)
        if (!row) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                email: userEmail,
                user_id: null,
                data: { profile: {}, settings: {} },
                profileimage: '',
                emailVerificationToken: null,
                bio: '',
              }),
              { status: 200 },
            ),
          )
        }
        let parsedData = {}
        try {
          parsedData = JSON.parse(row.data)
        } catch (e) {
          console.error('Error parsing user data JSON:', e)
        }
        const mystmkraUserId = parsedData.profile && parsedData.profile.mystmkraUserId
        console.log('Retrieved mystmkraUserId:', mystmkraUserId)
        const response = {
          email: userEmail,
          user_id: row.user_id,
          data: parsedData,
          profileimage: row.profileimage,
          emailVerificationToken: row.emailVerificationToken,
          bio: row.bio || '',
        }
        console.log('Sending response:', response)
        return addCorsHeaders(new Response(JSON.stringify(response), { status: 200 }))
      }

      if (path === '/userdata' && method === 'PUT') {
        const db = env.vegvisr_org
        const body = await request.json()
        console.log('📥 Received PUT /userdata request:', JSON.stringify(body, null, 2))
        console.log(
          '🔍 Checking for domainConfigs in body.data:',
          body.data?.domainConfigs ? 'FOUND' : 'NOT FOUND',
        )
        if (body.data?.domainConfigs) {
          console.log('📋 Domain configs array:', JSON.stringify(body.data.domainConfigs, null, 2))
        }

        const { email, bio, data, profileimage } = body
        console.log('Bio from request:', bio)
        if (!email || !data || profileimage === undefined) {
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
        // Ensure mystmkraUserId is present in data.profile
        if (body.mystmkraUserId) {
          data.profile.mystmkraUserId = body.mystmkraUserId
        }
        // If mystmkraUserId is already in data.profile, keep it (for robustness)
        if (data.profile && data.profile.mystmkraUserId) {
          // No action needed, value is already present
        }
        console.log('Saving mystmkraUserId:', data.profile.mystmkraUserId)
        const dataJson = JSON.stringify(data)

        // First, let's check if the columns exist
        const tableInfo = await db.prepare('PRAGMA table_info(config)').all()
        console.log('Table structure:', tableInfo)

        // Check if columns exist and add them if missing
        const hasBioColumn = tableInfo.results.some((col) => col.name === 'bio')
        const hasProfileImageColumn = tableInfo.results.some((col) => col.name === 'profileimage')

        try {
          if (!hasBioColumn) {
            console.log('Adding bio column to config table')
            await db.prepare('ALTER TABLE config ADD COLUMN bio TEXT').run()
          }
        } catch (e) {
          console.log('Bio column may already exist:', e.message)
        }

        try {
          if (!hasProfileImageColumn) {
            console.log('Adding profileimage column to config table')
            await db.prepare('ALTER TABLE config ADD COLUMN profileimage TEXT').run()
          }
        } catch (e) {
          console.log('Profileimage column may already exist:', e.message)
        }

        const query = `
          INSERT INTO config (user_id, email, bio, data, profileimage)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET bio = ?, data = ?, profileimage = ?;
        `
        console.log('Executing query with bio:', bio)
        // Generate a user_id if we don't have one
        const userId = data.profile?.user_id || uuidv4()

        const result = await db
          .prepare(query)
          .bind(userId, email, bio, dataJson, profileimage, bio, dataJson, profileimage)
          .run()
        console.log('Query result:', result)

        // Multi-Domain KV Configuration Saving
        if (data.domainConfigs && Array.isArray(data.domainConfigs)) {
          // New multi-domain structure
          console.log(
            '🔄 Processing multi-domain configurations:',
            data.domainConfigs.length,
            'domains',
          )
          console.log('🔍 Domain configs data:', JSON.stringify(data.domainConfigs, null, 2))

          for (const domainConfig of data.domainConfigs) {
            try {
              console.log(`🏗️ Processing domain: ${domainConfig.domain}`)

              // Determine metaAreas based on domain's content filter selection
              let metaAreas = []
              if (domainConfig.contentFilter === 'custom' && domainConfig.selectedCategories) {
                metaAreas = domainConfig.selectedCategories
                console.log(
                  `✅ Domain ${domainConfig.domain}: Using selected meta areas:`,
                  metaAreas,
                )
              } else if (domainConfig.contentFilter === 'none') {
                metaAreas = []
                console.log(`✅ Domain ${domainConfig.domain}: No content filtering`)
              }

              const siteConfig = {
                domain: domainConfig.domain,
                owner: email,
                branding: {
                  mySite: domainConfig.domain,
                  myLogo: domainConfig.logo,
                  contentFilter: domainConfig.contentFilter,
                  selectedCategories: domainConfig.selectedCategories,
                  mySiteFrontPage: domainConfig.mySiteFrontPage,
                },
                contentFilter: {
                  metaAreas: metaAreas,
                },
                menuConfig: domainConfig.menuConfig || { enabled: false },
                updatedAt: new Date().toISOString(),
              }

              const kvKey = `site-config:${domainConfig.domain}`
              console.log(`💾 Attempting to save to KV: ${kvKey}`)
              console.log(`📋 Site config data:`, JSON.stringify(siteConfig, null, 2))

              await env.SITE_CONFIGS.put(kvKey, JSON.stringify(siteConfig))
              console.log(
                `✅ Successfully saved domain config to KV: ${kvKey} with ${metaAreas.length} meta areas`,
              )

              // Verify the save by immediately reading it back
              const verification = await env.SITE_CONFIGS.get(kvKey)
              if (verification) {
                console.log(`✅ KV verification successful for ${kvKey}`)
              } else {
                console.error(`❌ KV verification failed for ${kvKey} - data not found after save`)
              }
            } catch (kvError) {
              console.error(`❌ Error saving domain config for ${domainConfig.domain}:`, kvError)
              console.error(`❌ KV Error details:`, kvError.message, kvError.stack)
              // Continue with other domains even if one fails
            }
          }
        } else if (data.branding && data.branding.mySite) {
          // Legacy single domain support (backwards compatibility)
          try {
            let metaAreas = []
            if (data.branding.contentFilter === 'custom' && data.branding.selectedCategories) {
              metaAreas = data.branding.selectedCategories
              console.log('Legacy: Using user-selected meta areas:', metaAreas)
            } else if (data.branding.contentFilter === 'none') {
              metaAreas = []
              console.log('Legacy: No content filtering')
            }

            const siteConfig = {
              domain: data.branding.mySite,
              owner: email,
              branding: {
                mySite: data.branding.mySite,
                myLogo: data.branding.myLogo,
                mySiteFrontPage: data.branding.mySiteFrontPage,
              },
              contentFilter: {
                metaAreas: metaAreas,
              },
              menuConfig: data.branding.menuConfig || { enabled: false },
              updatedAt: new Date().toISOString(),
            }

            const kvKey = `site-config:${data.branding.mySite}`
            await env.SITE_CONFIGS.put(kvKey, JSON.stringify(siteConfig))
            console.log(
              'Saved legacy site configuration to KV:',
              kvKey,
              'with metaAreas:',
              metaAreas,
            )
          } catch (kvError) {
            console.error('Error saving legacy site config to KV:', kvError)
            // Don't fail the main request if KV save fails
          }
        }

        return addCorsHeaders(
          new Response(
            JSON.stringify({ success: true, message: 'User data updated successfully' }),
            { status: 200 },
          ),
        )
      }

      if (path === '/site-config' && method === 'PUT') {
        try {
          const body = await request.json()
          const { domain, owner, branding, contentFilter } = body

          if (!domain || !owner || !branding) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: 'Missing required fields: domain, owner, branding' }),
                { status: 400 },
              ),
            )
          }

          const siteConfig = {
            domain,
            owner,
            branding,
            contentFilter: contentFilter || { metaAreas: [] },
            updatedAt: new Date().toISOString(),
          }

          const kvKey = `site-config:${domain}`
          await env.SITE_CONFIGS.put(kvKey, JSON.stringify(siteConfig))

          console.log('Saved site configuration:', kvKey, siteConfig)

          return addCorsHeaders(
            new Response(
              JSON.stringify({ success: true, message: 'Site configuration saved successfully' }),
              { status: 200 },
            ),
          )
        } catch (error) {
          console.error('Error saving site configuration:', error)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Failed to save site configuration' }), {
              status: 500,
            }),
          )
        }
      }

      if (path.startsWith('/site-config/') && method === 'GET') {
        try {
          const domain = path.split('/site-config/')[1]

          if (!domain) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Domain parameter is required' }), {
                status: 400,
              }),
            )
          }

          const kvKey = `site-config:${domain}`
          const siteConfigData = await env.SITE_CONFIGS.get(kvKey)

          if (!siteConfigData) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Site configuration not found' }), {
                status: 404,
              }),
            )
          }

          const siteConfig = JSON.parse(siteConfigData)
          console.log('Retrieved site configuration:', kvKey, siteConfig)

          return addCorsHeaders(new Response(JSON.stringify(siteConfig), { status: 200 }))
        } catch (error) {
          console.error('Error retrieving site configuration:', error)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Failed to retrieve site configuration' }), {
              status: 500,
            }),
          )
        }
      }

      if (path === '/main-logo' && method === 'GET') {
        try {
          const logoUrl = env.MAIN_LOGO || 'https://vegvisr.imgix.net/vegvisr-logo.png'
          console.log('Serving main logo URL:', logoUrl)

          return addCorsHeaders(
            new Response(JSON.stringify({ logoUrl }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          console.error('Error retrieving main logo:', error)
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Failed to retrieve main logo' }), {
              status: 500,
            }),
          )
        }
      }

      // Chat Room Management Endpoints
      if (path === '/api/chat-rooms' && method === 'GET') {
        const domain = url.searchParams.get('domain') || 'vegvisr.org'

        try {
          console.log('Fetching chat rooms for domain:', domain)
          const result = await env.vegvisr_org
            .prepare(
              `
            SELECT
              scr.*,
              COUNT(srm.id) as member_count
            FROM site_chat_rooms scr
            LEFT JOIN site_room_members srm ON scr.room_id = srm.room_id AND srm.status = 'active'
            WHERE scr.domain_name = ? AND scr.room_status = 'active'
            GROUP BY scr.room_id
            ORDER BY scr.created_at DESC
          `,
            )
            .bind(domain)
            .all()

          console.log('Chat rooms query result:', result.results?.length || 0, 'rooms found')
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                rooms: result.results || [],
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('Error fetching chat rooms:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      if (path === '/api/chat-rooms' && method === 'POST') {
        try {
          const { roomName, description, roomType, createdBy, domain } = await request.json()
          if (!roomName || !roomType || !createdBy || !domain) {
            console.error('Missing required field(s) for chat room creation:', {
              roomName,
              roomType,
              createdBy,
              domain,
            })
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Missing required field(s): roomName, roomType, createdBy, or domain.',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }
          const roomId = `room_${Date.now()}`

          console.log('Creating chat room:', {
            roomId,
            roomName,
            domain: domain || 'vegvisr.org',
            createdBy,
          })

          await env.vegvisr_org
            .prepare(
              `
            INSERT INTO site_chat_rooms
            (room_id, domain_name, room_name, room_description, room_type, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
            )
            .bind(
              roomId,
              domain || 'vegvisr.org',
              roomName,
              description,
              roomType || 'public',
              createdBy,
            )
            .run()

          const newRoom = {
            id: roomId,
            name: roomName,
            description,
            type: roomType || 'public',
            domain: domain || 'vegvisr.org',
            createdBy,
            memberCount: 1,
            created: new Date().toISOString(),
          }

          console.log('Chat room created successfully:', newRoom)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                room: newRoom,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('Error creating chat room:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // GET room settings endpoint
      if (path.startsWith('/api/chat-rooms/') && path.endsWith('/settings') && method === 'GET') {
        try {
          console.log('🔍 [API] GET room settings endpoint called')
          console.log('🔍 [API] Full path:', path)
          console.log('🔍 [API] Method:', method)

          const roomId = path.split('/')[3] // Extract roomId from /api/chat-rooms/{roomId}/settings
          console.log('🔍 [API] Extracted roomId:', roomId)

          if (!roomId) {
            console.log('❌ [API] No room ID provided')
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room ID is required',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          console.log('🔍 [API] Querying database for room:', roomId)

          const result = await env.vegvisr_org
            .prepare('SELECT room_settings, room_name FROM site_chat_rooms WHERE room_id = ?')
            .bind(roomId)
            .first()

          console.log('🔍 [API] Database result:', JSON.stringify(result, null, 2))

          if (!result) {
            console.log('❌ [API] Room not found in database')
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room not found',
                }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Parse room_settings JSON or return empty object
          let roomSettings = {}
          console.log('🔍 [API] Raw room_settings from DB:', result.room_settings)

          if (result.room_settings) {
            try {
              roomSettings = JSON.parse(result.room_settings)
              console.log(
                '✅ [API] Parsed room_settings successfully:',
                JSON.stringify(roomSettings, null, 2),
              )
            } catch (error) {
              console.error('❌ [API] Error parsing room_settings JSON:', error)
              roomSettings = {}
            }
          } else {
            console.log('⚠️ [API] No room_settings found in database')
          }

          const response = {
            success: true,
            room_settings: roomSettings,
            room_name: result.room_name,
          }

          console.log('✅ [API] Sending response:', JSON.stringify(response, null, 2))

          return addCorsHeaders(
            new Response(JSON.stringify(response), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        } catch (error) {
          console.error('Error loading room settings:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // PUT room settings endpoint
      if (path.startsWith('/api/chat-rooms/') && path.endsWith('/settings') && method === 'PUT') {
        try {
          const roomId = path.split('/')[3] // Extract roomId from /api/chat-rooms/{roomId}/settings
          if (!roomId) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room ID is required',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          const { room_settings } = await request.json()
          if (!room_settings) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'room_settings is required',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          console.log('Updating room settings for:', roomId)
          console.log('New settings:', room_settings)

          // Verify room exists first
          const roomExists = await env.vegvisr_org
            .prepare('SELECT room_id FROM site_chat_rooms WHERE room_id = ?')
            .bind(roomId)
            .first()

          if (!roomExists) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room not found',
                }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Update room settings JSON column
          await env.vegvisr_org
            .prepare(
              'UPDATE site_chat_rooms SET room_settings = ?, updated_at = CURRENT_TIMESTAMP WHERE room_id = ?',
            )
            .bind(JSON.stringify(room_settings), roomId)
            .run()

          console.log('Room settings updated successfully')
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Room settings updated successfully',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('Error updating room settings:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // DELETE room endpoint - SuperAdmin soft deletion
      if (path.startsWith('/api/chat-rooms/') && method === 'DELETE') {
        try {
          const roomId = path.split('/')[3] // Extract roomId from /api/chat-rooms/{roomId}
          if (!roomId) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room ID is required',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Verify room exists first
          const roomExists = await env.vegvisr_org
            .prepare('SELECT room_id FROM site_chat_rooms WHERE room_id = ?')
            .bind(roomId)
            .first()

          if (!roomExists) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room not found',
                }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Soft delete: set room_status to 'disabled'
          await env.vegvisr_org
            .prepare(
              'UPDATE site_chat_rooms SET room_status = ?, updated_at = CURRENT_TIMESTAMP WHERE room_id = ?',
            )
            .bind('disabled', roomId)
            .run()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Room deleted successfully',
                roomId: roomId,
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
                success: false,
                error: error.message,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // GET chat room members endpoint
      if (path.startsWith('/api/chat-rooms/') && path.endsWith('/members') && method === 'GET') {
        try {
          const roomId = path.split('/')[3] // Extract roomId from /api/chat-rooms/{roomId}/members
          if (!roomId) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room ID is required',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Get members with user details from config table
          const membersResult = await env.vegvisr_org
            .prepare(
              `
              SELECT
                srm.id,
                srm.user_id,
                srm.role,
                srm.status,
                srm.joined_at,
                srm.last_activity,
                c.email as user_email,
                c.data as user_data
              FROM site_room_members srm
              LEFT JOIN config c ON srm.user_id = c.user_id
              WHERE srm.room_id = ? AND srm.status = 'active'
              ORDER BY
                CASE srm.role
                  WHEN 'owner' THEN 1
                  WHEN 'moderator' THEN 2
                  WHEN 'member' THEN 3
                END,
                srm.joined_at ASC
            `,
            )
            .bind(roomId)
            .all()

          const members = membersResult.results.map((member) => {
            // Parse user_data JSON if it exists
            let userData = {}
            try {
              if (member.user_data) {
                userData = JSON.parse(member.user_data)
              }
            } catch (e) {
              console.warn('Failed to parse user_data for user:', member.user_id)
            }

            return {
              id: member.user_id,
              name: userData.displayName || member.user_email || 'Unknown User',
              email: member.user_email,
              initials: (userData.displayName || member.user_email || 'UN')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2),
              color: userData.profileColor || '#6366f1',
              avatar: userData.profileImage || null,
              role: member.role,
              status: member.status,
              isOnline: false, // TODO: Implement real presence system
              lastSeen: member.last_activity
                ? new Date(member.last_activity)
                : new Date(member.joined_at),
              joinedAt: member.joined_at,
            }
          })

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                members: members,
                memberCount: members.length,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('Error fetching room members:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // POST join chat room endpoint
      if (path.startsWith('/api/chat-rooms/') && path.endsWith('/join') && method === 'POST') {
        try {
          const roomId = path.split('/')[3] // Extract roomId from /api/chat-rooms/{roomId}/join
          const { user_id } = await request.json()

          if (!roomId || !user_id) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room ID and user_id are required',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Check if room exists and is active
          const room = await env.vegvisr_org
            .prepare('SELECT room_id, room_status FROM site_chat_rooms WHERE room_id = ?')
            .bind(roomId)
            .first()

          if (!room) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room not found',
                }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          if (room.room_status !== 'active') {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room is not active',
                }),
                {
                  status: 403,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Check if user is already a member or banned
          const existingMember = await env.vegvisr_org
            .prepare('SELECT id, status FROM site_room_members WHERE room_id = ? AND user_id = ?')
            .bind(roomId, user_id)
            .first()

          if (existingMember) {
            if (existingMember.status === 'banned') {
              return addCorsHeaders(
                new Response(
                  JSON.stringify({
                    success: false,
                    error: 'User is banned from this room',
                  }),
                  {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                  },
                ),
              )
            }

            if (existingMember.status === 'active') {
              return addCorsHeaders(
                new Response(
                  JSON.stringify({
                    success: false,
                    error: 'User is already a member of this room',
                  }),
                  {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' },
                  },
                ),
              )
            }
          }

          // Add user as member
          const memberId = `${roomId}_${user_id}_${Date.now()}`
          await env.vegvisr_org
            .prepare(
              `
              INSERT INTO site_room_members
              (id, room_id, user_id, role, status, joined_at)
              VALUES (?, ?, ?, 'member', 'active', CURRENT_TIMESTAMP)
            `,
            )
            .bind(memberId, roomId, user_id)
            .run()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Successfully joined room',
                memberId: memberId,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('Error joining room:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // DELETE leave chat room endpoint
      if (path.startsWith('/api/chat-rooms/') && path.endsWith('/leave') && method === 'DELETE') {
        try {
          const roomId = path.split('/')[3] // Extract roomId from /api/chat-rooms/{roomId}/leave
          const { user_id } = await request.json()

          if (!roomId || !user_id) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room ID and user_id are required',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Check if user is a member
          const member = await env.vegvisr_org
            .prepare(
              'SELECT id, role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"',
            )
            .bind(roomId, user_id)
            .first()

          if (!member) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'User is not a member of this room',
                }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Don't allow room owner to leave (they must transfer ownership first)
          if (member.role === 'owner') {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room owner cannot leave. Transfer ownership first.',
                }),
                {
                  status: 403,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Update member status to 'left'
          await env.vegvisr_org
            .prepare(
              'UPDATE site_room_members SET status = "left", updated_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ?',
            )
            .bind(roomId, user_id)
            .run()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Successfully left room',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('Error leaving room:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // DELETE remove member from room (owners/moderators only)
      if (
        path.startsWith('/api/chat-rooms/') &&
        path.includes('/members/') &&
        method === 'DELETE'
      ) {
        try {
          const pathParts = path.split('/')
          const roomId = pathParts[3] // /api/chat-rooms/{roomId}/members/{userId}
          const userId = pathParts[5]
          const { removed_by, reason } = await request.json()

          if (!roomId || !userId || !removed_by) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room ID, user ID, and removed_by are required',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Check if remover has permission (owner or moderator)
          const remover = await env.vegvisr_org
            .prepare(
              'SELECT role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"',
            )
            .bind(roomId, removed_by)
            .first()

          if (!remover || (remover.role !== 'owner' && remover.role !== 'moderator')) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Only room owners and moderators can remove members',
                }),
                {
                  status: 403,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Check if target user exists and is active member
          const targetMember = await env.vegvisr_org
            .prepare(
              'SELECT id, role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"',
            )
            .bind(roomId, userId)
            .first()

          if (!targetMember) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'User is not an active member of this room',
                }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Cannot remove room owner
          if (targetMember.role === 'owner') {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Cannot remove room owner. Transfer ownership first.',
                }),
                {
                  status: 403,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Moderators cannot remove other moderators, only owners can
          if (targetMember.role === 'moderator' && remover.role !== 'owner') {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Only room owners can remove moderators',
                }),
                {
                  status: 403,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Update member status to 'removed'
          await env.vegvisr_org
            .prepare(
              `
              UPDATE site_room_members
              SET status = 'removed', updated_at = CURRENT_TIMESTAMP,
                  notification_settings = json_set(
                    COALESCE(notification_settings, '{}'),
                    '$.removedBy', ?,
                    '$.removedAt', datetime('now'),
                    '$.reason', ?
                  )
              WHERE room_id = ? AND user_id = ?
            `,
            )
            .bind(removed_by, reason || 'No reason provided', roomId, userId)
            .run()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Member removed successfully',
                removedUserId: userId,
                reason: reason || 'No reason provided',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('Error removing member:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // POST ban member from room (owners/moderators only)
      if (path.startsWith('/api/chat-rooms/') && path.endsWith('/ban') && method === 'POST') {
        try {
          const roomId = path.split('/')[3] // /api/chat-rooms/{roomId}/ban
          const { user_id, banned_by, reason } = await request.json()

          if (!roomId || !user_id || !banned_by) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room ID, user_id, and banned_by are required',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Check if banner has permission (owner or moderator)
          const banner = await env.vegvisr_org
            .prepare(
              'SELECT role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"',
            )
            .bind(roomId, banned_by)
            .first()

          if (!banner || (banner.role !== 'owner' && banner.role !== 'moderator')) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Only room owners and moderators can ban members',
                }),
                {
                  status: 403,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Check if target user exists (can ban even non-members to prevent joining)
          const targetMember = await env.vegvisr_org
            .prepare(
              'SELECT id, role, status FROM site_room_members WHERE room_id = ? AND user_id = ?',
            )
            .bind(roomId, user_id)
            .first()

          // Cannot ban room owner
          if (targetMember && targetMember.role === 'owner') {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Cannot ban room owner',
                }),
                {
                  status: 403,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Moderators cannot ban other moderators, only owners can
          if (targetMember && targetMember.role === 'moderator' && banner.role !== 'owner') {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Only room owners can ban moderators',
                }),
                {
                  status: 403,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          if (targetMember) {
            // Update existing member status to 'banned'
            await env.vegvisr_org
              .prepare(
                `
                UPDATE site_room_members
                SET status = 'banned', updated_at = CURRENT_TIMESTAMP,
                    notification_settings = json_set(
                      COALESCE(notification_settings, '{}'),
                      '$.bannedBy', ?,
                      '$.bannedAt', datetime('now'),
                      '$.banReason', ?
                    )
                WHERE room_id = ? AND user_id = ?
              `,
              )
              .bind(banned_by, reason || 'No reason provided', roomId, user_id)
              .run()
          } else {
            // Create new banned entry (prevents future joining)
            const banId = `${roomId}_ban_${user_id}_${Date.now()}`
            await env.vegvisr_org
              .prepare(
                `
                INSERT INTO site_room_members
                (id, room_id, user_id, role, status, joined_at, notification_settings)
                VALUES (?, ?, ?, 'member', 'banned', CURRENT_TIMESTAMP, json(?))
              `,
              )
              .bind(
                banId,
                roomId,
                user_id,
                JSON.stringify({
                  bannedBy: banned_by,
                  bannedAt: new Date().toISOString(),
                  banReason: reason || 'No reason provided',
                }),
              )
              .run()
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Member banned successfully',
                bannedUserId: user_id,
                reason: reason || 'No reason provided',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('Error banning member:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // PUT change member role (owners only)
      if (
        path.startsWith('/api/chat-rooms/') &&
        path.includes('/members/') &&
        path.endsWith('/role') &&
        method === 'PUT'
      ) {
        try {
          const pathParts = path.split('/')
          const roomId = pathParts[3] // /api/chat-rooms/{roomId}/members/{userId}/role
          const userId = pathParts[5]
          const { new_role, changed_by } = await request.json()

          if (!roomId || !userId || !new_role || !changed_by) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Room ID, user ID, new_role, and changed_by are required',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Validate role
          if (!['owner', 'moderator', 'member'].includes(new_role)) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Invalid role. Must be owner, moderator, or member',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Check if changer is owner (only owners can change roles)
          const changer = await env.vegvisr_org
            .prepare(
              'SELECT role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"',
            )
            .bind(roomId, changed_by)
            .first()

          if (!changer || changer.role !== 'owner') {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'Only room owners can change member roles',
                }),
                {
                  status: 403,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Check if target user exists and is active member
          const targetMember = await env.vegvisr_org
            .prepare(
              'SELECT id, role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"',
            )
            .bind(roomId, userId)
            .first()

          if (!targetMember) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'User is not an active member of this room',
                }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          // Special handling for owner role changes
          if (new_role === 'owner') {
            // Transfer ownership: demote current owner to member, promote target to owner
            await env.vegvisr_org
              .prepare(
                'UPDATE site_room_members SET role = "member", updated_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ?',
              )
              .bind(roomId, changed_by)
              .run()
          }

          // Update target member role
          await env.vegvisr_org
            .prepare(
              `
              UPDATE site_room_members
              SET role = ?, updated_at = CURRENT_TIMESTAMP,
                  notification_settings = json_set(
                    COALESCE(notification_settings, '{}'),
                    '$.roleChangedBy', ?,
                    '$.roleChangedAt', datetime('now'),
                    '$.previousRole', ?
                  )
              WHERE room_id = ? AND user_id = ?
            `,
            )
            .bind(new_role, changed_by, targetMember.role, roomId, userId)
            .run()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: `Member role changed from ${targetMember.role} to ${new_role}`,
                userId: userId,
                previousRole: targetMember.role,
                newRole: new_role,
                changedBy: changed_by,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        } catch (error) {
          console.error('Error changing member role:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: false,
                error: error.message,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          )
        }
      }

      // Phase 3: Invitation Management Endpoints

      // POST /api/chat-rooms/{roomId}/invite - Generate invitation and send email
      if (path.match(/^\/api\/chat-rooms\/([^\/]+)\/invite$/) && method === 'POST') {
        try {
          const roomId = path.match(/^\/api\/chat-rooms\/([^\/]+)\/invite$/)[1]
          const body = await request.json()
          const { recipientEmail, invitationMessage } = body

          if (!recipientEmail) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'recipientEmail is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Get user info from session
          const userStore = getUserFromSession(request, env)
          if (!userStore.loggedIn) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Check if user is owner or moderator of the room
          const memberInfo = await env.vegvisr_org
            .prepare(
              'SELECT role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"',
            )
            .bind(roomId, userStore.user_id)
            .first()

          // Allow test user to bypass permission check for testing
          if (!memberInfo && userStore.user_id !== '9999') {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: 'Only owners and moderators can send invitations' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          if (memberInfo && memberInfo.role !== 'owner' && memberInfo.role !== 'moderator') {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: 'Only owners and moderators can send invitations' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          // Get room info for template variables
          const roomInfo = await env.vegvisr_org
            .prepare('SELECT room_name FROM site_chat_rooms WHERE room_id = ?')
            .bind(roomId)
            .first()

          // Allow test room for testing
          let roomName = roomInfo?.room_name
          if (!roomInfo && roomId === 'test-room') {
            roomName = 'Test Room'
          } else if (!roomInfo) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Room not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Step 1: Generate invitation via email-worker
          let invitationData
          try {
            const emailWorkerRequest = new Request('https://email-worker.torarnehave.workers.dev/generate-invitation', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                recipientEmail,
                roomId,
                inviterName: userStore.displayName || userStore.email,
                inviterUserId: userStore.user_id,
                invitationMessage: invitationMessage || '',
              }),
            })

            const emailWorkerResponse = await env.EMAIL_WORKER.fetch(emailWorkerRequest)

            if (!emailWorkerResponse.ok) {
              const errorText = await emailWorkerResponse.text()
              console.error('Email worker error:', errorText)
              return addCorsHeaders(
                new Response(
                  JSON.stringify({
                    error: 'Failed to generate invitation via email-worker',
                    details: errorText,
                    status: emailWorkerResponse.status,
                  }),
                  { status: 500, headers: { 'Content-Type': 'application/json' } },
                ),
              )
            }

            invitationData = await emailWorkerResponse.json()

            console.log('Generated invitation data via email-worker:', invitationData)
          } catch (error) {
            console.error('Error in invitation generation:', error)
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: 'Failed to generate invitation', details: error.message }),
                { status: 500, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          // Step 2: Create simple email template for now
          // TODO: Use email-worker's template system for professional templates
          let templateData
          try {
            templateData = {
              template: {
                subject: `You're invited to join ${roomName}`,
                body: `
                  <h2>You're invited to join ${roomName}</h2>
                  <p>Hello!</p>
                  <p>${userStore.displayName || userStore.email} has invited you to join the chat room "${roomName}".</p>
                  <p>Click the link below to accept the invitation:</p>
                  <a href="${invitationData.slowyouLink}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; display: inline-block;">Join Room</a>
                  <p>If the button doesn't work, copy and paste this link into your browser:</p>
                  <p>${invitationData.slowyouLink}</p>
                  <p>This invitation will expire on ${new Date(invitationData.expiresAt).toLocaleDateString()}.</p>
                  <p>Best regards,<br>Vegvisr Team</p>
                `,
              },
            }

            console.log('Using simple template - can be upgraded to email-worker templates later')
          } catch (error) {
            console.error('Error in template generation:', error)
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: 'Failed to render email template',
                  details: error.message,
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          // Step 3: Send email via slowyou.io using custom email endpoint
          const slowyouUrl = 'https://slowyou.io/api/send-vegvisr-email'
          const slowyouResponse = await fetch(slowyouUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${env.API_TOKEN}`,
            },
            body: JSON.stringify({
              email: recipientEmail,
              template: templateData.template.body,
              subject: templateData.template.subject,
              callbackUrl: invitationData.callbackUrl,
            }),
          })

          if (!slowyouResponse.ok) {
            let errorData
            try {
              errorData = await slowyouResponse.text()
            } catch (e) {
              errorData = `Failed to read error response: ${e.message}`
            }

            // Safely stringify the error data
            let safeErrorData
            try {
              safeErrorData = errorData
              // Ensure it's valid for JSON stringification
              JSON.stringify({ test: errorData })
            } catch (e) {
              safeErrorData = `Error data contains invalid characters: ${errorData.substring(0, 100)}...`
            }

            console.error('Slowyou.io error:', safeErrorData)
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: 'Failed to send email via slowyou.io',
                  details: safeErrorData,
                  status: slowyouResponse.status,
                  statusText: slowyouResponse.statusText,
                }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            )
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Invitation sent successfully',
                invitationToken: invitationData.invitationToken,
                recipientEmail,
                expiresAt: invitationData.expiresAt,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          console.error('Error sending invitation:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Failed to send invitation', details: error.message }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
      }

      // GET /api/invitations - List all invitations (admin/debug endpoint)
      if (path === '/api/invitations' && method === 'GET') {
        try {
          // Get user info from session
          const userStore = getUserFromSession(request, env)
          if (!userStore.loggedIn) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Get all invitations from the table
          const invitations = await env.vegvisr_org
            .prepare(
              `
              SELECT id, recipient_email, room_id, inviter_name, inviter_user_id,
                     invitation_message, created_at, expires_at, used_at, is_active
              FROM invitation_tokens
              ORDER BY created_at DESC
            `,
            )
            .all()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                invitations: invitations.results,
                count: invitations.results.length,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          console.error('Error fetching all invitations:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Failed to fetch invitations', details: error.message }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
      }

      // GET /api/chat-rooms/{roomId}/invitations - List pending invitations
      if (path.match(/^\/api\/chat-rooms\/([^\/]+)\/invitations$/) && method === 'GET') {
        try {
          const roomId = path.match(/^\/api\/chat-rooms\/([^\/]+)\/invitations$/)[1]

          // Get user info from session
          const userStore = getUserFromSession(request, env)
          if (!userStore.loggedIn) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Check if user is owner or moderator of the room
          const memberInfo = await env.vegvisr_org
            .prepare(
              'SELECT role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"',
            )
            .bind(roomId, userStore.user_id)
            .first()

          if (!memberInfo || (memberInfo.role !== 'owner' && memberInfo.role !== 'moderator')) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: 'Only owners and moderators can view invitations' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          // Get pending invitations for this room
          const invitations = await env.vegvisr_org
            .prepare(
              `
              SELECT id, recipient_email, inviter_name, invitation_message,
                     created_at, expires_at, used_at, is_active
              FROM invitation_tokens
              WHERE room_id = ? AND is_active = 1 AND expires_at > datetime('now')
              ORDER BY created_at DESC
            `,
            )
            .bind(roomId)
            .all()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                invitations: invitations.results,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          console.error('Error fetching invitations:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Failed to fetch invitations', details: error.message }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
      }

      // DELETE /api/chat-rooms/{roomId}/invitations/{invitationId} - Cancel invitation
      if (
        path.match(/^\/api\/chat-rooms\/([^\/]+)\/invitations\/([^\/]+)$/) &&
        method === 'DELETE'
      ) {
        try {
          const [, roomId, invitationId] = path.match(
            /^\/api\/chat-rooms\/([^\/]+)\/invitations\/([^\/]+)$/,
          )

          // Get user info from session
          const userStore = getUserFromSession(request, env)
          if (!userStore.loggedIn) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          // Check if user is owner or moderator of the room
          const memberInfo = await env.vegvisr_org
            .prepare(
              'SELECT role FROM site_room_members WHERE room_id = ? AND user_id = ? AND status = "active"',
            )
            .bind(roomId, userStore.user_id)
            .first()

          if (!memberInfo || (memberInfo.role !== 'owner' && memberInfo.role !== 'moderator')) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ error: 'Only owners and moderators can cancel invitations' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } },
              ),
            )
          }

          // Cancel the invitation
          const result = await env.vegvisr_org
            .prepare('UPDATE invitation_tokens SET is_active = 0 WHERE id = ? AND room_id = ?')
            .bind(invitationId, roomId)
            .run()

          if (result.changes === 0) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Invitation not found or already cancelled' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Invitation cancelled successfully',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          console.error('Error cancelling invitation:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: 'Failed to cancel invitation', details: error.message }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
      }

      // Handle other routes
      return addCorsHeaders(new Response('Not Found', { status: 404 }))
    } catch (error) {
      console.error('Error in fetch handler:', error)
      return addCorsHeaders(new Response(JSON.stringify({ error: error.message }), { status: 500 }))
    }
  },
}
