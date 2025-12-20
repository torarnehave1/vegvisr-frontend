/**
 * Proff Worker - Norwegian Company Registry API Integration
 *
 * Provides secure access to Proff.no company data API.
 * Supports user-provided API keys stored encrypted in D1 database.
 *
 * Endpoints:
 * - GET /search?query=... - Search companies by name
 * - GET /company/:orgNr - Get detailed company info with financials
 * - GET /health - Health check
 * - GET /api/docs - API documentation
 */

/**
 * Decrypt an API key using AES-256-GCM
 * Same implementation as grok-worker for consistency
 */
async function decryptApiKey(encryptedBase64, masterKey) {
  const encoder = new TextEncoder()
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))

  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterKey),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('vegvisr-user-api-keys'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

/**
 * Get user's API key from D1 database
 */
async function getUserApiKey(userId, provider, env) {
  try {
    const result = await env.DB.prepare(`
      SELECT encrypted_key FROM user_api_keys
      WHERE user_id = ?1 AND provider = ?2 AND enabled = 1
    `).bind(userId, provider).first()

    if (!result || !result.encrypted_key) {
      return null
    }

    const plaintextApiKey = await decryptApiKey(result.encrypted_key, env.ENCRYPTION_MASTER_KEY)

    // Update last_used timestamp
    await env.DB.prepare(`
      UPDATE user_api_keys SET last_used = CURRENT_TIMESTAMP
      WHERE user_id = ?1 AND provider = ?2
    `).bind(userId, provider).run()

    return plaintextApiKey

  } catch (error) {
    console.error(`Failed to get user API key: ${error.message}`)
    return null
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role, X-API-Token, x-user-email, x-user-id',
  'Content-Type': 'application/json'
}

/**
 * Helper function to create JSON responses
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders
  })
}

/**
 * Search companies in Norwegian company registry
 */
async function handleSearch(request, env) {
  const url = new URL(request.url)
  const query = url.searchParams.get('query')
  const userId = url.searchParams.get('userId') || request.headers.get('x-user-id')

  if (!query) {
    return jsonResponse({ error: 'Missing query parameter' }, 400)
  }

  // Try to get user's API key first
  let apiKey = null
  if (userId && userId !== 'system') {
    apiKey = await getUserApiKey(userId, 'proff', env)
    if (apiKey) {
      console.log(`🔑 Using user's Proff API key for userId: ${userId}`)
    }
  }

  // Fallback to system key
  if (!apiKey) {
    apiKey = env.PROFF_API_TOKEN
    console.log('🔑 Using system Proff API key')
  }

  if (!apiKey) {
    return jsonResponse({
      error: 'Proff API key not configured',
      hint: 'Go to User Dashboard → API Keys to add your Proff API key, or contact admin for system access'
    }, 401)
  }

  console.log(`🏢 Proff search: "${query}"`)

  try {
    const proffResponse = await fetch(
      `https://api.proff.no/api/companies/register/NO?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Token ${apiKey}`
        }
      }
    )

    if (!proffResponse.ok) {
      const errorText = await proffResponse.text()
      console.error('❌ Proff API error:', errorText)
      return jsonResponse({
        error: `Proff API error: ${proffResponse.status}`,
        details: errorText
      }, proffResponse.status)
    }

    const data = await proffResponse.json()

    console.log(`✅ Found ${data.companies?.length || 0} companies`)

    return jsonResponse({
      success: true,
      query,
      companies: data.companies || [],
      totalResults: data.companies?.length || 0
    })

  } catch (error) {
    console.error('❌ Proff search error:', error)
    return jsonResponse({
      error: 'Proff search failed',
      message: error.message
    }, 500)
  }
}

/**
 * Get detailed company information by organization number
 */
async function handleCompanyDetails(orgNr, request, env) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') || request.headers.get('x-user-id')

  if (!orgNr || !/^\d+$/.test(orgNr)) {
    return jsonResponse({ error: 'Invalid organization number' }, 400)
  }

  // Try to get user's API key first
  let apiKey = null
  if (userId && userId !== 'system') {
    apiKey = await getUserApiKey(userId, 'proff', env)
    if (apiKey) {
      console.log(`🔑 Using user's Proff API key for userId: ${userId}`)
    }
  }

  // Fallback to system key
  if (!apiKey) {
    apiKey = env.PROFF_API_TOKEN
    console.log('🔑 Using system Proff API key')
  }

  if (!apiKey) {
    return jsonResponse({
      error: 'Proff API key not configured',
      hint: 'Go to User Dashboard → API Keys to add your Proff API key'
    }, 401)
  }

  console.log(`🏢 Fetching company details for org.nr: ${orgNr}`)

  try {
    const proffResponse = await fetch(
      `https://api.proff.no/api/companies/register/NO/${orgNr}`,
      {
        headers: {
          'Authorization': `Token ${apiKey}`
        }
      }
    )

    if (!proffResponse.ok) {
      const errorText = await proffResponse.text()
      console.error('❌ Proff API error:', errorText)
      return jsonResponse({
        error: `Proff API error: ${proffResponse.status}`,
        details: errorText
      }, proffResponse.status)
    }

    const data = await proffResponse.json()

    console.log(`✅ Got details for: ${data.name}`)

    // Parse financial data for easier consumption
    const financials = parseFinancials(data.companyAccounts || [])

    return jsonResponse({
      success: true,
      company: {
        // Basic info
        name: data.name,
        organisationNumber: data.organisationNumber,
        status: data.status,
        establishedDate: data.establishedDate,
        foundationDate: data.foundationDate,
        foundationYear: data.foundationYear,
        companyPurpose: data.companyPurpose,

        // Contact
        email: data.email,
        homePage: data.homePage,
        phoneNumbers: data.phoneNumbers,

        // Location
        postalAddress: data.postalAddress,
        visitorAddress: data.visitorAddress,
        location: data.location,

        // Industry
        naceCategories: data.naceCategories,
        sectorCode: data.sectorCode,

        // Employees
        numberOfEmployees: data.numberOfEmployees,
        empMin: data.empMin,
        empMax: data.empMax,

        // Financials (parsed)
        financials,

        // People
        contactPerson: data.contactPerson,
        personRoles: data.personRoles,
        shareholders: data.shareholders,
        signatories: data.signatories,

        // Raw accounts (for advanced users)
        companyAccounts: data.companyAccounts,

        // Other
        ehf: data.ehf,
        mortgages: data.mortgages,
        centralApproval: data.centralApproval
      }
    })

  } catch (error) {
    console.error('❌ Proff company details error:', error)
    return jsonResponse({
      error: 'Failed to fetch company details',
      message: error.message
    }, 500)
  }
}

/**
 * Parse financial accounts into a more readable format
 */
function parseFinancials(companyAccounts) {
  const codeNames = {
    'SI': 'Salgsinntekt',
    'SDI': 'Sum driftsinntekter',
    'SDK': 'Sum driftskostnader',
    'DR': 'Driftsresultat',
    'AARS': 'Årsresultat',
    'EBITDA': 'EBITDA',
    'SEK': 'Sum egenkapital',
    'SED': 'Sum eiendeler',
    'SGE': 'Sum gjeld og egenkapital',
    'LG': 'Langsiktig gjeld',
    'KBP': 'Kortsiktig gjeld',
    'AK': 'Aksjekapital',
    'EKA': 'Egenkapitalandel %',
    'TR': 'Totalrentabilitet %',
    'RG': 'Resultatgrad %',
    'LGR': 'Likviditetsgrad'
  }

  return companyAccounts.map(period => {
    const parsed = {
      year: period.year,
      period: period.period,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      currency: period.currency,
      figures: {}
    }

    // Parse key figures
    if (period.accounts) {
      for (const acc of period.accounts) {
        if (codeNames[acc.code]) {
          parsed.figures[acc.code] = {
            name: codeNames[acc.code],
            value: parseFloat(acc.amount),
            raw: acc.amount
          }
        }
      }
    }

    return parsed
  })
}

/**
 * Get simplified financial summary for AI consumption
 * Returns data in an easy-to-present format with actual NOK values
 */
async function handleFinancials(orgNr, request, env) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') || request.headers.get('x-user-id')

  if (!orgNr || !/^\d+$/.test(orgNr)) {
    return jsonResponse({ error: 'Invalid organization number' }, 400)
  }

  // Get API key
  let apiKey = null
  if (userId && userId !== 'system') {
    apiKey = await getUserApiKey(userId, 'proff', env)
  }
  if (!apiKey) {
    apiKey = env.PROFF_API_TOKEN
  }
  if (!apiKey) {
    return jsonResponse({ error: 'Proff API key not configured' }, 401)
  }

  try {
    const proffResponse = await fetch(
      `https://api.proff.no/api/companies/register/NO/${orgNr}`,
      { headers: { 'Authorization': `Token ${apiKey}` } }
    )

    if (!proffResponse.ok) {
      return jsonResponse({ error: `Proff API error: ${proffResponse.status}` }, proffResponse.status)
    }

    const data = await proffResponse.json()
    const accounts = data.companyAccounts || []

    // Build simplified financial table
    const financialYears = accounts.map(period => {
      const figures = {}
      if (period.accounts) {
        for (const acc of period.accounts) {
          // Convert from thousands to actual NOK
          figures[acc.code] = parseFloat(acc.amount) * 1000
        }
      }
      return {
        year: period.year,
        revenue_nok: figures['SI'] || figures['SDI'] || null,
        operating_result_nok: figures['DR'] || null,
        annual_result_nok: figures['AARS'] || null,
        ebitda_nok: figures['EBITDA'] || null,
        total_equity_nok: figures['SEK'] || null,
        total_assets_nok: figures['SED'] || null
      }
    }).sort((a, b) => parseInt(b.year) - parseInt(a.year)) // Sort newest first

    // Format as markdown table for easy display
    let markdownTable = `| År | Omsetning (NOK) | Driftsresultat | Årsresultat | EBITDA |\n`
    markdownTable += `|---:|---------------:|---------------:|------------:|-------:|\n`

    for (const year of financialYears) {
      const formatNum = (n) => n !== null ? n.toLocaleString('no-NO') : 'N/A'
      markdownTable += `| ${year.year} | ${formatNum(year.revenue_nok)} | ${formatNum(year.operating_result_nok)} | ${formatNum(year.annual_result_nok)} | ${formatNum(year.ebitda_nok)} |\n`
    }

    return jsonResponse({
      success: true,
      company_name: data.name,
      organisation_number: data.organisationNumber,
      years_available: financialYears.map(f => f.year),
      financial_data: financialYears,
      markdown_table: markdownTable,
      note: 'All monetary values are in NOK (Norwegian Kroner). Source: Brønnøysundregistrene via Proff.no'
    })

  } catch (error) {
    return jsonResponse({ error: error.message }, 500)
  }
}

/**
 * Find business network path between two persons
 * Shows the shortest connection path via shared companies/board positions
 */
async function handleBusinessNetwork(request, env) {
  const url = new URL(request.url)
  const fromPersonId = url.searchParams.get('from')
  const toPersonId = url.searchParams.get('to')
  const country = url.searchParams.get('country') || 'NO'
  const userId = url.searchParams.get('userId') || request.headers.get('x-user-id')

  if (!fromPersonId || !toPersonId) {
    return jsonResponse({
      error: 'Missing required parameters',
      hint: 'Provide both "from" and "to" Proff person IDs. Use person search to find IDs first.',
      example: '/network?from=12345&to=67890'
    }, 400)
  }

  // Get API key
  let apiKey = null
  if (userId && userId !== 'system') {
    apiKey = await getUserApiKey(userId, 'proff', env)
  }
  if (!apiKey) {
    apiKey = env.PROFF_API_TOKEN
  }
  if (!apiKey) {
    return jsonResponse({ error: 'Proff API key not configured' }, 401)
  }

  console.log(`🔗 Finding business network: ${fromPersonId} → ${toPersonId}`)

  try {
    const proffResponse = await fetch(
      `https://api.proff.no/api/persons/business/network/${country}?from=${fromPersonId}&to=${toPersonId}`,
      { headers: { 'Authorization': `Token ${apiKey}` } }
    )

    if (!proffResponse.ok) {
      const errorText = await proffResponse.text()
      console.error('❌ Proff network API error:', errorText)
      return jsonResponse({
        error: `Proff API error: ${proffResponse.status}`,
        details: errorText
      }, proffResponse.status)
    }

    const pathNodes = await proffResponse.json()

    // Parse the path into a readable format
    const path = []
    let degreesOfSeparation = 0

    for (const node of pathNodes) {
      // Check for person first (has personId)
      if (node.person) {
        const p = node.person
        path.push({
          type: 'person',
          name: p.name || p.Name,
          personId: p.personId || p.PersonId,
          age: p.age || p.Age,
          gender: p.gender || p.Gender,
          roles: (p.roles || p.Roles || []).map(r => ({
            company: r.companyName || r.CompanyName,
            role: r.roleName || r.RoleName
          })),
          numberOfRoles: p.numberOfRoles || p.NumberOfRoles,
          associatedCount: p.associatedCount || p.AssociatedCount
        })
      } else if (node.company) {
        // Company data - handle both camelCase and PascalCase
        const c = node.company
        path.push({
          type: 'company',
          name: c.name || c.Name,
          organisationNumber: c.organisationNumber || c.OrganisationNumber,
          email: c.email || c.Email,
          homePage: c.homePage || c.HomePage,
          address: c.visitorAddress || c.VisitorAddress || c.postalAddress || c.PostalAddress
        })
        degreesOfSeparation++
      } else if ((node.name || node.Name) && (node.organisationNumber || node.OrganisationNumber)) {
        // Company data might come directly without .company wrapper
        path.push({
          type: 'company',
          name: node.name || node.Name,
          organisationNumber: node.organisationNumber || node.OrganisationNumber,
          email: node.email || node.Email,
          homePage: node.homePage || node.HomePage,
          address: node.visitorAddress || node.VisitorAddress || node.postalAddress || node.PostalAddress
        })
        degreesOfSeparation++
      } else if ((node.name || node.Name) && (node.personId || node.PersonId)) {
        // Person data might come directly without .person wrapper
        path.push({
          type: 'person',
          name: node.name || node.Name,
          personId: node.personId || node.PersonId,
          age: node.age || node.Age,
          gender: node.gender || node.Gender,
          roles: (node.roles || node.Roles || []).map(r => ({
            company: r.companyName || r.CompanyName,
            role: r.roleName || r.RoleName
          })),
          numberOfRoles: node.numberOfRoles || node.NumberOfRoles,
          associatedCount: node.associatedCount || node.AssociatedCount
        })
      } else {
        // Unknown node - include raw for debugging
        path.push({
          type: 'unknown',
          raw: node
        })
      }
    }

    // Build a human-readable summary
    let pathDescription = ''
    for (let i = 0; i < path.length; i++) {
      const node = path[i]
      if (node.type === 'person') {
        pathDescription += `👤 **${node.name}**`
        if (node.roles && node.roles.length > 0) {
          const roles = node.roles.slice(0, 3).map(r => `${r.role} i ${r.company}`).join(', ')
          pathDescription += ` (${roles})`
        }
      } else {
        pathDescription += `🏢 **${node.name}** (${node.organisationNumber})`
      }
      if (i < path.length - 1) {
        pathDescription += ' → '
      }
    }

    return jsonResponse({
      success: true,
      fromPersonId,
      toPersonId,
      country,
      degreesOfSeparation,
      pathLength: path.length,
      path,
      pathDescription,
      note: `Found ${degreesOfSeparation} degree(s) of separation via shared company connections`
    })

  } catch (error) {
    console.error('❌ Business network error:', error)
    return jsonResponse({
      error: 'Business network lookup failed',
      message: error.message
    }, 500)
  }
}

/**
 * Get detailed person information by personId
 * Returns all roles, connected companies, industry connections etc.
 */
async function handlePersonDetails(personId, request, env) {
  const url = new URL(request.url)
  const country = url.searchParams.get('country') || 'NO'
  const userId = url.searchParams.get('userId') || request.headers.get('x-user-id')

  if (!personId) {
    return jsonResponse({ error: 'Missing personId parameter' }, 400)
  }

  // Get API key
  let apiKey = null
  if (userId && userId !== 'system') {
    apiKey = await getUserApiKey(userId, 'proff', env)
  }
  if (!apiKey) {
    apiKey = env.PROFF_API_TOKEN
  }
  if (!apiKey) {
    return jsonResponse({ error: 'Proff API key not configured' }, 401)
  }

  console.log(`👤 Fetching person details for ID: ${personId}`)

  try {
    const proffResponse = await fetch(
      `https://api.proff.no/api/persons/business/${country}/${personId}`,
      { headers: { 'Authorization': `Token ${apiKey}` } }
    )

    if (!proffResponse.ok) {
      const errorText = await proffResponse.text()
      return jsonResponse({
        error: `Proff API error: ${proffResponse.status}`,
        details: errorText
      }, proffResponse.status)
    }

    const p = await proffResponse.json()

    console.log(`✅ Got details for: ${p.name || p.Name}`)

    // Parse roles with company details
    const roles = (p.roles || p.Roles || []).map(r => ({
      roleName: r.roleName || r.RoleName,
      companyName: r.companyName || r.CompanyName,
      companyId: r.companyId || r.CompanyId,
      organisationNumber: r.company?.href?.split('/').pop() || null
    }))

    // Parse connections (other persons they're connected to)
    const connections = (p.connections || p.Connections || []).map(c => ({
      name: c.name || c.Name,
      personId: c.personId || c.PersonId,
      gender: c.gender || c.Gender,
      numberOfConnections: c.numberOfConnections || c.NumberOfConnections
    }))

    // Parse industry connections
    const industryConnections = (p.industryConnections || p.IndustryConnections || []).map(i => ({
      name: i.name || i.Name,
      industryCode: i.industryCode || i.IndustryCode
    }))

    // Build markdown summary of roles
    let rolesMarkdown = `## ${p.name || p.Name} - Roller i næringslivet\n\n`
    rolesMarkdown += `**Alder:** ${p.age || p.Age} år | **Antall roller:** ${p.numberOfRoles || p.NumberOfRoles} | **Tilknyttede virksomheter:** ${p.associatedCount || p.AssociatedCount}\n\n`

    if (roles.length > 0) {
      rolesMarkdown += `### Styrer og roller\n\n`
      rolesMarkdown += `| Selskap | Rolle |\n|---------|-------|\n`
      for (const role of roles) {
        rolesMarkdown += `| ${role.companyName} | ${role.roleName} |\n`
      }
    }

    if (industryConnections.length > 0) {
      rolesMarkdown += `\n### Bransjetilknytninger\n\n`
      for (const ind of industryConnections) {
        rolesMarkdown += `- ${ind.name}\n`
      }
    }

    return jsonResponse({
      success: true,
      person: {
        personId: p.personId || p.PersonId,
        name: p.name || p.Name,
        age: p.age || p.Age,
        gender: p.gender || p.Gender,
        yearOfBirth: p.yearOfBirth || p.YearOfBirth,
        numberOfRoles: p.numberOfRoles || p.NumberOfRoles,
        associatedCount: p.associatedCount || p.AssociatedCount,
        location: p.location || p.Location,
        postalAddress: p.postalAddress || p.PostalAddress,
        roles,
        connections,
        industryConnections
      },
      markdown_summary: rolesMarkdown
    })

  } catch (error) {
    console.error('❌ Person details error:', error)
    return jsonResponse({
      error: 'Person details lookup failed',
      message: error.message
    }, 500)
  }
}

/**
 * Search for persons by name (to get personId for network lookup)
 */
async function handlePersonSearch(request, env) {
  const url = new URL(request.url)
  const query = url.searchParams.get('query')
  const country = url.searchParams.get('country') || 'NO'
  const userId = url.searchParams.get('userId') || request.headers.get('x-user-id')

  if (!query) {
    return jsonResponse({ error: 'Missing query parameter' }, 400)
  }

  // Get API key
  let apiKey = null
  if (userId && userId !== 'system') {
    apiKey = await getUserApiKey(userId, 'proff', env)
  }
  if (!apiKey) {
    apiKey = env.PROFF_API_TOKEN
  }
  if (!apiKey) {
    return jsonResponse({ error: 'Proff API key not configured' }, 401)
  }

  console.log(`👤 Searching persons: "${query}"`)

  try {
    // Correct endpoint: /api/persons/business/{country}?query=...
    const proffResponse = await fetch(
      `https://api.proff.no/api/persons/business/${country}?query=${encodeURIComponent(query)}`,
      { headers: { 'Authorization': `Token ${apiKey}` } }
    )

    if (!proffResponse.ok) {
      const errorText = await proffResponse.text()
      return jsonResponse({
        error: `Proff API error: ${proffResponse.status}`,
        details: errorText
      }, proffResponse.status)
    }

    const data = await proffResponse.json()

    // The API returns a list directly, not nested under 'persons'
    // Handle both cases: array response or object with persons property
    const persons = Array.isArray(data) ? data : (data.persons || data.businessPersons || [])

    console.log(`✅ Found ${persons.length} persons`)

    return jsonResponse({
      success: true,
      query,
      persons: persons.map(p => ({
        personId: p.personId,
        name: p.name,
        age: p.age,
        gender: p.gender,
        yearOfBirth: p.yearOfBirth,
        numberOfRoles: p.numberOfRoles,
        associatedCount: p.associatedCount,
        location: p.location ? {
          municipality: p.location.municipality,
          county: p.location.county
        } : null
      })),
      totalResults: persons.length
    })

  } catch (error) {
    console.error('❌ Person search error:', error)
    return jsonResponse({
      error: 'Person search failed',
      message: error.message
    }, 500)
  }
}

/**
 * OpenAI Function Calling compatible tool definitions
 * This format allows AI assistants to understand and use these functions
 */
function getToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'proff_search_companies',
        description: 'Search for Norwegian companies by name. Returns a list of matching companies with their organization numbers. Use this first to find the org.nr before getting details.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Company name to search for (e.g., "Equinor", "Universi AS")'
            }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'proff_get_financials',
        description: 'Get financial history for a Norwegian company. Returns a ready-to-display markdown table with revenue, operating result, annual result, and EBITDA for all available years. Use this when asked about revenue (omsetning), profit, financial performance, or economic data.',
        parameters: {
          type: 'object',
          properties: {
            orgNr: {
              type: 'string',
              description: 'The 9-digit Norwegian organization number'
            }
          },
          required: ['orgNr']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'proff_get_company_details',
        description: 'Get company information like board members, shareholders, address, and contact details. Use this for ownership, management, or company structure questions.',
        parameters: {
          type: 'object',
          properties: {
            orgNr: {
              type: 'string',
              description: 'The 9-digit Norwegian organization number'
            }
          },
          required: ['orgNr']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'proff_search_persons',
        description: 'Search for persons (business executives, board members) by name in the Norwegian business registry. Returns personId which is needed for detailed lookups and network searches.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Person name to search for (e.g., "Anders Opedal", "Kjell Inge Røkke")'
            }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'proff_get_person_details',
        description: `Get detailed information about a business person including ALL their board positions, roles, and connected companies.

Use this tool when user wants to:
- See all companies a person is involved with
- List all board positions/roles for a person
- Understand someone's business network in detail
- "Dykke dypere" into a person's business connections

Returns a markdown summary with table of all roles.`,
        parameters: {
          type: 'object',
          properties: {
            personId: {
              type: 'string',
              description: 'Proff personId (get this from proff_search_persons first)'
            }
          },
          required: ['personId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'proff_find_business_network',
        description: 'Find the shortest business connection path between two persons through shared companies and board positions. Shows how two business people are connected (degrees of separation). You need personId for both persons - use proff_search_persons first to find their IDs.',
        parameters: {
          type: 'object',
          properties: {
            fromPersonId: {
              type: 'string',
              description: 'Proff personId of the first person'
            },
            toPersonId: {
              type: 'string',
              description: 'Proff personId of the second person'
            }
          },
          required: ['fromPersonId', 'toPersonId']
        }
      }
    }
  ]
}

/**
 * API Documentation - OpenAPI 3.0 compatible
 */
function handleApiDocs() {
  return jsonResponse({
    openapi: '3.0.0',
    info: {
      title: 'Proff Worker API',
      version: '1.0.0',
      description: 'Norwegian company registry API powered by Proff.no (Brønnøysundregistrene). Provides company search, detailed company information, financials, board members, shareholders, and more.'
    },
    servers: [
      {
        url: 'https://proff-worker.torarnehave.workers.dev',
        description: 'Workers.dev endpoint'
      },
      {
        url: 'https://proff.vegvisr.org',
        description: 'Production endpoint (when DNS configured)'
      }
    ],
    paths: {
      '/search': {
        get: {
          operationId: 'searchCompanies',
          summary: 'Search companies by name',
          description: 'Search for Norwegian companies by name in the Brønnøysund register.',
          parameters: [
            {
              name: 'query',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Company name or search term',
              example: 'Equinor'
            },
            {
              name: 'userId',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'User ID for user-specific API key'
            }
          ],
          responses: {
            '200': {
              description: 'Successful search',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      query: { type: 'string' },
                      companies: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            organisationNumber: { type: 'string' },
                            status: { type: 'object' },
                            location: { type: 'object' },
                            naceCategories: { type: 'array' }
                          }
                        }
                      },
                      totalResults: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/company/{orgNr}': {
        get: {
          operationId: 'getCompanyDetails',
          summary: 'Get detailed company information',
          description: 'Retrieve comprehensive company details including financials per year, board members, shareholders, and contact information.',
          parameters: [
            {
              name: 'orgNr',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Norwegian organization number (9 digits)',
              example: '931615696'
            },
            {
              name: 'userId',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'User ID for user-specific API key'
            }
          ],
          responses: {
            '200': {
              description: 'Company details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      company: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          organisationNumber: { type: 'string' },
                          status: { type: 'object' },
                          companyPurpose: { type: 'string' },
                          postalAddress: { type: 'object' },
                          visitorAddress: { type: 'object' },
                          location: { type: 'object' },
                          naceCategories: { type: 'array' },
                          numberOfEmployees: { type: 'string' },
                          financials: {
                            type: 'array',
                            description: 'Financial data per year',
                            items: {
                              type: 'object',
                              properties: {
                                year: { type: 'string' },
                                period: { type: 'string' },
                                figures: {
                                  type: 'object',
                                  description: 'Key figures: SI (revenue), DR (operating result), AARS (annual result), EBITDA, etc.'
                                }
                              }
                            }
                          },
                          personRoles: {
                            type: 'array',
                            description: 'Board members and management',
                            items: {
                              type: 'object',
                              properties: {
                                name: { type: 'string' },
                                title: { type: 'string' },
                                birthDate: { type: 'string' }
                              }
                            }
                          },
                          shareholders: {
                            type: 'array',
                            description: 'Company owners',
                            items: {
                              type: 'object',
                              properties: {
                                name: { type: 'string' },
                                share: { type: 'string' },
                                numberOfShares: { type: 'number' }
                              }
                            }
                          },
                          signatories: { type: 'array' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    // OpenAI Function Calling compatible tools
    'x-openai-tools': getToolDefinitions(),
    // Usage instructions for AI
    'x-ai-instructions': {
      description: 'Instructions for AI assistants on how to use this API',
      whenToUse: [
        'When user asks about Norwegian companies',
        'When user wants to find a company by name',
        'When user asks for financial information about a company',
        'When user wants to know who owns or manages a company',
        'When user mentions "org nr", "organisasjonsnummer", or a 9-digit number in Norwegian business context'
      ],
      howToUse: [
        '1. Use /search?query=NAME to find companies by name',
        '2. Use /company/ORGNR to get detailed info once you have the organization number',
        '3. Financial data is in company.financials[] with year-by-year breakdown',
        '4. Board/management in company.personRoles[], owners in company.shareholders[]'
      ],
      exampleQueries: [
        'Finn selskapet Equinor → /search?query=Equinor',
        'Hvem eier Norsk Vind Energi? → /company/977052300 → shareholders',
        'Hva er omsetningen til Aliveness Lab? → /company/931615696 → financials[].figures.SI'
      ]
    }
  })
}

/**
 * Get tool definitions for AI function calling
 */
function handleGetTools() {
  return jsonResponse({
    tools: getToolDefinitions(),
    usage: {
      description: 'Use these tools to look up Norwegian company information',
      provider: 'proff',
      baseUrl: 'https://proff-worker.torarnehave.workers.dev'
    }
  })
}

/**
 * Main worker handler
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      })
    }

    try {
      // Health check
      if (pathname === '/health' && request.method === 'GET') {
        return jsonResponse({
          status: 'healthy',
          worker: 'proff-worker',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        })
      }

      // API documentation (OpenAPI 3.0)
      if (pathname === '/api/docs' && request.method === 'GET') {
        return handleApiDocs()
      }

      // Tool definitions for AI function calling
      if (pathname === '/api/tools' && request.method === 'GET') {
        return handleGetTools()
      }

      // Search companies
      if (pathname === '/search' && request.method === 'GET') {
        return await handleSearch(request, env)
      }

      // Search persons (for network lookups)
      if (pathname === '/persons' && request.method === 'GET') {
        return await handlePersonSearch(request, env)
      }

      // Person details by personId
      if (pathname.startsWith('/person/') && request.method === 'GET') {
        const personId = pathname.split('/')[2]
        return await handlePersonDetails(personId, request, env)
      }

      // Business network between two persons
      if (pathname === '/network' && request.method === 'GET') {
        return await handleBusinessNetwork(request, env)
      }

      // Financial summary (simplified format for AI)
      if (pathname.startsWith('/financials/') && request.method === 'GET') {
        const orgNr = pathname.split('/')[2]
        return await handleFinancials(orgNr, request, env)
      }

      // Company details by org number
      if (pathname.startsWith('/company/') && request.method === 'GET') {
        const orgNr = pathname.split('/')[2]
        return await handleCompanyDetails(orgNr, request, env)
      }

      // 404
      return jsonResponse({
        error: 'Not Found',
        path: pathname,
        availableEndpoints: [
          'GET /search?query=...',
          'GET /company/:orgNr',
          'GET /financials/:orgNr',
          'GET /persons?query=...',
          'GET /person/:personId',
          'GET /network?from=personId&to=personId',
          'GET /health',
          'GET /api/docs',
          'GET /api/tools'
        ]
      }, 404)

    } catch (error) {
      console.error('Worker error:', error)
      return jsonResponse({
        error: 'Internal Server Error',
        message: error.message
      }, 500)
    }
  }
}
