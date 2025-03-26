app.get('/verify-email', async (c) => {
  try {
    const emailToken = c.req.query('token')

    if (!emailToken) {
      console.error('Missing token parameter')
      return c.json({ error: 'Missing token parameter' }, 400)
    }

    console.log('Email token received:', emailToken)

    const verifyResponse = await fetch(`https://slowyou.io/api/verify-email?token=${emailToken}`, {
      method: 'GET',
    })

    console.log('External API response status:', verifyResponse.status)

    if (!verifyResponse.ok) {
      console.error(
        `Error from external API: ${verifyResponse.status} ${verifyResponse.statusText}`,
      )
      return c.json({ error: 'Failed to verify email. Please try again later.' }, 500)
    }

    const verifyResponseBody = await verifyResponse.text()
    console.log('Response body from external API:', verifyResponseBody)

    let verifyResult
    try {
      verifyResult = verifyResponseBody ? JSON.parse(verifyResponseBody) : {}
    } catch (parseError) {
      console.error('Error parsing response body:', parseError)
      return c.json({ error: 'Invalid response from external API' }, 500)
    }

    console.log('Parsed response from external API:', verifyResult)

    // Validate the structure of the parsed response
    if (
      !verifyResult ||
      typeof verifyResult !== 'object' ||
      !verifyResult.email ||
      !verifyResult.emailVerificationToken
    ) {
      console.error('Invalid or incomplete response from external API:', verifyResult)
      return c.json({ error: 'Unexpected response structure from external API' }, 500)
    }

    const db = c.env.vegvisr_org
    const user_id = generateUniqueUsername()

    const data = {
      email: verifyResult.email,
      emailVerificationToken: verifyResult.emailVerificationToken,
      emailVerified: true,
    }

    console.log('Data to be inserted into the database:', data)

    try {
      const query = `
      INSERT INTO config (user_id, email, emailVerificationToken, data)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET emailVerificationToken = ?, data = ?;
      `
      const { changes } = await db
        .prepare(query)
        .bind(
          user_id,
          data.email,
          data.emailVerificationToken,
          JSON.stringify({}),
          data.emailVerificationToken,
          JSON.stringify({}),
        )
        .run()

      console.log('Database changes:', changes)

      if (changes === 0) {
        return c.json({ error: 'Email is already registered' }, 409)
      }
    } catch (error) {
      console.error('Error inserting into database:', error)
      return c.json({ error: 'An unexpected error occurred while saving data' }, 500)
    }

    const jwtSecret = c.env.JWT_SECRET
    const jwtToken = await generateJWT(
      {
        email: verifyResult.email,
        user_id,
        emailVerificationToken: verifyResult.emailVerificationToken,
      },
      jwtSecret,
    )

    console.log('Generated JWT token:', jwtToken)

    const loginUrl = `/login?email=${encodeURIComponent(verifyResult.email)}`
    return c.json({
      success: true,
      message: 'Email verified successfully',
      token: jwtToken,
      redirect: loginUrl,
    })
  } catch (error) {
    console.error('Error in GET /verify-email:', error)

    // Add specific handling for undefined or null values
    if (error.message.includes('Cannot read properties of undefined')) {
      console.error('Undefined property access detected. Check the response structure.')
      return c.json({ error: 'Unexpected response structure. Please try again later.' }, 500)
    }

    return c.json({ error: 'An unexpected error occurred. Please try again later.' }, 500)
  }
})
