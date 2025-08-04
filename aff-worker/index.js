/**
 * Affiliate Worker - Enhanced with Email Template Integration
 * Handles affiliate program management, tracking, and email invitations
 * Uses worker bindings for inter-worker communication
 */

// Helper function to update graph metadata with affiliate information
async function updateGraphAffiliateMetadata(graphId, env) {
  try {
    console.log(`📊 Updating affiliate metadata for graph ${graphId}`)

    // Count active affiliates for this graph
    const countResult = await env.vegvisr_org
      .prepare('SELECT COUNT(*) as count FROM affiliates WHERE deal_name = ? AND status = ?')
      .bind(graphId, 'active')
      .first()

    const affiliateCount = countResult.count || 0
    console.log(`📊 Found ${affiliateCount} active affiliates for graph ${graphId}`)

    // Fetch current graph data
    const graphResponse = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`)
    if (!graphResponse.ok) {
      console.error(`❌ Failed to fetch graph ${graphId} for metadata update`)
      return false
    }

    const currentGraph = await graphResponse.json()
    const existingMetadata = currentGraph.metadata || {}

    // Preserve existing metadata and add/update affiliate info
    const updatedMetadata = {
      ...existingMetadata,
      affiliates: {
        hasAffiliates: affiliateCount > 0,
        affiliateCount: affiliateCount,
        lastUpdated: new Date().toISOString(),
      },
    }

    // Update graph with new metadata using saveGraphWithHistory
    const updateResponse = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: graphId,
        graphData: {
          ...currentGraph,
          metadata: updatedMetadata,
        },
        override: false, // Create new version
      }),
    })

    if (updateResponse.ok) {
      console.log(`✅ Successfully updated affiliate metadata for graph ${graphId}`)
      return true
    } else {
      console.error(`❌ Failed to update graph metadata for ${graphId}:`, updateResponse.status)
      return false
    }
  } catch (error) {
    console.error(`❌ Error updating affiliate metadata for graph ${graphId}:`, error)
    return false
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    // CORS headers function
    function addCorsHeaders(response) {
      response.headers.set('Access-Control-Allow-Origin', '*')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      response.headers.set('Access-Control-Max-Age', '86400')
      return response
    }

    // Handle preflight requests
    if (method === 'OPTIONS') {
      return addCorsHeaders(new Response(null, { status: 204 }))
    }

    try {
      // ===========================================
      // AFFILIATE REGISTRATION & MANAGEMENT
      // ===========================================

      // Register new affiliate (Updated to integrate with existing user system + deal support)
      if (path === '/register-affiliate' && method === 'POST') {
        console.log('📝 Received POST /register-affiliate request')

        const {
          email,
          name,
          invitationToken,
          referredBy,
          domain,
          dealName,
          commissionType,
          commissionRate,
          commissionAmount,
        } = await request.json()

        if (!email || !name) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Email and name are required' }), {
              status: 400,
            }),
          )
        }

        const db = env.vegvisr_org
        const affiliateId = `aff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const referralCode = `${name.substring(0, 3).toUpperCase()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`

        try {
          // Check if user exists in config table
          const existingUser = await db
            .prepare('SELECT user_id, data FROM config WHERE email = ?')
            .bind(email)
            .first()

          if (!existingUser) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error:
                    'User must be registered first. Please complete user registration before becoming an affiliate.',
                  action: 'register_first',
                  registrationUrl: `https://vegvisr.org/register?email=${encodeURIComponent(email)}`,
                }),
                { status: 400 },
              ),
            )
          }

          // Check if already an affiliate for this specific deal
          const existingAffiliate = await db
            .prepare(
              'SELECT affiliate_id, deal_name FROM affiliates WHERE email = ? AND domain = ? AND deal_name = ?',
            )
            .bind(email, domain || 'vegvisr.org', dealName || 'default')
            .first()

          if (existingAffiliate) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `User is already registered as an affiliate for deal "${dealName || 'default'}" on domain "${domain || 'vegvisr.org'}"`,
                  affiliate: existingAffiliate,
                }),
                { status: 409 },
              ),
            )
          }

          // Check if user already exists as affiliate (for any deal) - if so, add new deal
          const anyExistingAffiliate = await db
            .prepare(
              'SELECT affiliate_id, email, name FROM affiliates WHERE email = ? AND domain = ? LIMIT 1',
            )
            .bind(email, domain || 'vegvisr.org')
            .first()

          if (anyExistingAffiliate) {
            // User exists but for different deal - we need to handle this as multi-deal scenario
            // For now, return success with existing affiliate info since DB constraint prevents multiple records
            console.log(
              `🔄 User ${email} already has affiliate account, cannot add new deal due to DB constraint`,
            )

            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: true,
                  affiliate: {
                    affiliateId: anyExistingAffiliate.affiliate_id,
                    email: email,
                    name: name,
                    referralCode:
                      anyExistingAffiliate.affiliate_id.split('_')[2]?.toUpperCase() || 'EXISTING',
                    domain: domain || 'vegvisr.org',
                    commissionRate: commissionRate || 15.0,
                    commissionType: commissionType || 'percentage',
                    commissionAmount: commissionAmount || null,
                    dealName: dealName || 'default',
                    status: 'active',
                    note: 'Using existing affiliate account - multiple deals not supported yet',
                  },
                }),
                { status: 201 },
              ),
            )
          }

          // Add affiliate record with deal support
          await db
            .prepare(
              `
            INSERT INTO affiliates (
              affiliate_id, email, name, referral_code, domain,
              referred_by, status, commission_rate, commission_type, commission_amount,
              deal_name, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, datetime('now'))
          `,
            )
            .bind(
              affiliateId,
              email,
              name,
              referralCode,
              domain || 'vegvisr.org',
              referredBy || null,
              commissionRate || 15.0,
              commissionType || 'percentage',
              commissionAmount || null,
              dealName || 'default',
            )
            .run()

          // Update user data to include affiliate flag
          const userData = JSON.parse(existingUser.data || '{}')
          userData.isAffiliate = true
          userData.affiliateId = affiliateId
          userData.referralCode = referralCode

          await db
            .prepare('UPDATE config SET data = ? WHERE email = ?')
            .bind(JSON.stringify(userData), email)
            .run()

          console.log(`✅ User ${email} is now an affiliate: ${affiliateId}`)

          // Update graph metadata with new affiliate information
          if (dealName && dealName !== 'default') {
            await updateGraphAffiliateMetadata(dealName, env)
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                affiliate: {
                  affiliateId,
                  email,
                  name,
                  referralCode,
                  domain: domain || 'vegvisr.org',
                  commissionRate: commissionRate || 15.0,
                  commissionType: commissionType || 'percentage',
                  commissionAmount: commissionAmount || null,
                  dealName: dealName || 'default',
                  status: 'active',
                },
              }),
              { status: 201 },
            ),
          )
        } catch (dbError) {
          console.error('❌ Database error registering affiliate:', dbError)
          console.error('❌ Error details:', dbError.message || dbError)
          console.error('❌ Stack trace:', dbError.stack || 'No stack trace')
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to register affiliate',
                details: dbError.message || 'Unknown database error',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // Get affiliate dashboard data
      if (path === '/affiliate-dashboard' && method === 'GET') {
        const affiliateId = url.searchParams.get('affiliateId')
        const email = url.searchParams.get('email')

        if (!affiliateId && !email) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Affiliate ID or email required' }), {
              status: 400,
            }),
          )
        }

        const db = env.vegvisr_org

        try {
          // Get ALL affiliate deals for this user (supporting multiple deals per user)
          let affiliates
          if (affiliateId) {
            affiliates = await db
              .prepare('SELECT * FROM affiliates WHERE affiliate_id = ?')
              .bind(affiliateId)
              .all()
          } else {
            affiliates = await db
              .prepare('SELECT * FROM affiliates WHERE email = ? AND status = "active"')
              .bind(email)
              .all()
          }

          if (!affiliates.results || affiliates.results.length === 0) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'No affiliate deals found' }), {
                status: 404,
              }),
            )
          }

          // Process each affiliate deal
          const deals = []
          let totalStats = {
            total_referrals: 0,
            converted_referrals: 0,
            total_earnings: 0,
            pending_earnings: 0,
          }

          for (const affiliate of affiliates.results) {
            // Get referral statistics for this specific deal
            const stats = await db
              .prepare(
                `
              SELECT
                COUNT(*) as total_referrals,
                COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_referrals,
                SUM(CASE WHEN status = 'converted' THEN commission_amount ELSE 0 END) as total_earnings,
                SUM(CASE WHEN status = 'converted' AND paid = 0 THEN commission_amount ELSE 0 END) as pending_earnings
              FROM referrals
              WHERE affiliate_id = ?
            `,
              )
              .bind(affiliate.affiliate_id)
              .first()

            // Add to total stats
            totalStats.total_referrals += stats?.total_referrals || 0
            totalStats.converted_referrals += stats?.converted_referrals || 0
            totalStats.total_earnings += stats?.total_earnings || 0
            totalStats.pending_earnings += stats?.pending_earnings || 0

            // Get recent referrals for this deal
            const recentReferrals = await db
              .prepare(
                `
              SELECT * FROM referrals
              WHERE affiliate_id = ?
              ORDER BY created_at DESC
              LIMIT 5
            `,
              )
              .bind(affiliate.affiliate_id)
              .all()

            deals.push({
              id: affiliate.affiliate_id,
              dealName: affiliate.deal_name,
              referralCode: affiliate.referral_code,
              commissionRate: affiliate.commission_rate,
              commissionType: affiliate.commission_type,
              domain: affiliate.domain,
              status: affiliate.status,
              createdAt: affiliate.created_at,
              statistics: {
                totalReferrals: stats?.total_referrals || 0,
                convertedReferrals: stats?.converted_referrals || 0,
                totalEarnings: stats?.total_earnings || 0,
                pendingEarnings: stats?.pending_earnings || 0,
                conversionRate:
                  stats?.total_referrals > 0
                    ? (((stats?.converted_referrals || 0) / stats.total_referrals) * 100).toFixed(2)
                    : '0.00',
              },
              recentReferrals: recentReferrals.results || [],
            })
          }

          // Use the first affiliate for general user info
          const primaryAffiliate = affiliates.results[0]

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                affiliate: {
                  name: primaryAffiliate.name,
                  email: primaryAffiliate.email,
                  totalDeals: deals.length,
                },
                deals: deals, // Array of all deals
                overallStatistics: {
                  totalReferrals: totalStats.total_referrals,
                  convertedReferrals: totalStats.converted_referrals,
                  totalEarnings: totalStats.total_earnings,
                  pendingEarnings: totalStats.pending_earnings,
                  conversionRate:
                    totalStats.total_referrals > 0
                      ? (
                          (totalStats.converted_referrals / totalStats.total_referrals) *
                          100
                        ).toFixed(2)
                      : '0.00',
                },
              }),
              { status: 200 },
            ),
          )
        } catch (error) {
          console.error('❌ Error fetching affiliate dashboard:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to fetch dashboard data',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // ===========================================
      // REFERRAL TRACKING
      // ===========================================

      // Track referral click
      if (path === '/track-referral' && method === 'POST') {
        const { referralCode, referredEmail, metadata } = await request.json()

        if (!referralCode) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Referral code required' }), {
              status: 400,
            }),
          )
        }

        const db = env.vegvisr_org

        try {
          // Find affiliate by referral code
          const affiliate = await db
            .prepare(
              'SELECT affiliate_id, commission_rate FROM affiliates WHERE referral_code = ? AND status = "active"',
            )
            .bind(referralCode)
            .first()

          if (!affiliate) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: 'Invalid referral code' }), {
                status: 404,
              }),
            )
          }

          // Check for existing referral
          if (referredEmail) {
            const existing = await db
              .prepare('SELECT id FROM referrals WHERE affiliate_id = ? AND referred_email = ?')
              .bind(affiliate.affiliate_id, referredEmail)
              .first()

            if (existing) {
              return addCorsHeaders(
                new Response(
                  JSON.stringify({
                    message: 'Referral already tracked',
                    referralId: existing.id,
                  }),
                  { status: 200 },
                ),
              )
            }
          }

          // Create new referral tracking record
          const referralId = `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

          await db
            .prepare(
              `
            INSERT INTO referrals (
              id, affiliate_id, referred_email, referral_code,
              status, commission_rate, metadata, created_at
            ) VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'))
          `,
            )
            .bind(
              referralId,
              affiliate.affiliate_id,
              referredEmail || null,
              referralCode,
              affiliate.commission_rate,
              JSON.stringify(metadata || {}),
            )
            .run()

          console.log(`✅ Referral tracked: ${referralId} for affiliate ${affiliate.affiliate_id}`)

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                referralId,
                affiliateId: affiliate.affiliate_id,
                commissionRate: affiliate.commission_rate,
              }),
              { status: 201 },
            ),
          )
        } catch (error) {
          console.error('❌ Error tracking referral:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to track referral',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // Convert referral (when user actually registers/purchases)
      if (path === '/convert-referral' && method === 'POST') {
        const { referredEmail, amount, orderId } = await request.json()

        if (!referredEmail) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Referred email required' }), {
              status: 400,
            }),
          )
        }

        const db = env.vegvisr_org

        try {
          // Find pending referral
          const referral = await db
            .prepare('SELECT * FROM referrals WHERE referred_email = ? AND status = "pending"')
            .bind(referredEmail)
            .first()

          if (!referral) {
            console.log(`⚠️ No pending referral found for email: ${referredEmail}`)
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  message: 'No pending referral found',
                }),
                { status: 404 },
              ),
            )
          }

          // Calculate commission
          const commissionAmount = amount ? amount * (referral.commission_rate / 100) : 0

          // Update referral status
          await db
            .prepare(
              `
            UPDATE referrals SET
              status = 'converted',
              commission_amount = ?,
              order_id = ?,
              converted_at = datetime('now')
            WHERE id = ?
          `,
            )
            .bind(commissionAmount, orderId || null, referral.id)
            .run()

          console.log(`✅ Referral converted: ${referral.id}, commission: $${commissionAmount}`)

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                referralId: referral.id,
                affiliateId: referral.affiliate_id,
                commissionAmount,
              }),
              { status: 200 },
            ),
          )
        } catch (error) {
          console.error('❌ Error converting referral:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to convert referral',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // ===========================================
      // EMAIL INVITATIONS WITH TEMPLATE INTEGRATION
      // ===========================================

      // List affiliate invitations (for Superadmin UI)
      if (path === '/list-invitations' && method === 'GET') {
        console.log('📋 Received GET /list-invitations request')

        try {
          const limit = parseInt(url.searchParams.get('limit')) || 10
          const offset = parseInt(url.searchParams.get('offset')) || 0

          const db = env.vegvisr_org

          // Get invitations with pagination
          const invitations = await db
            .prepare(
              `
              SELECT
                token, recipient_email, recipient_name, sender_name, site_name,
                commission_type, commission_rate, commission_amount,
                inviter_affiliate_id, domain, expires_at, created_at, status, used_at, used
              FROM affiliate_invitations
              ORDER BY created_at DESC
              LIMIT ? OFFSET ?
            `,
            )
            .bind(limit, offset)
            .all()

          // Get total count
          const totalCount = await db
            .prepare('SELECT COUNT(*) as count FROM affiliate_invitations')
            .first()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                invitations: invitations.results || [],
                totalCount: totalCount.count || 0,
                limit,
                offset,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        } catch (error) {
          console.error('❌ Error fetching affiliate invitations:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to fetch invitations',
                invitations: [],
              }),
              { status: 500 },
            ),
          )
        }
      }

      // Send affiliate invitation email
      if (path === '/send-affiliate-invitation' && method === 'POST') {
        console.log('📧 Received POST /send-affiliate-invitation request')

        const {
          recipientEmail,
          recipientName,
          senderName,
          siteName,
          commissionRate,
          commissionType,
          commissionAmount,
          domain,
          inviterAffiliateId,
          dealName, // New: Support for deal-specific invitations
        } = await request.json()

        if (!recipientEmail || !recipientName || !senderName) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'recipientEmail, recipientName, and senderName are required',
              }),
              { status: 400 },
            ),
          )
        }

        // Require dealName (graphId) - no more general affiliates
        if (!dealName) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error:
                  'dealName (graphId) is required. Every affiliate must be connected to a specific knowledge graph.',
              }),
              { status: 400 },
            ),
          )
        }

        try {
          // Generate invitation token for affiliate registration
          const invitationToken = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

          // Check if user already exists in the system
          const db = env.vegvisr_org
          const existingUser = await db
            .prepare('SELECT user_id, data FROM config WHERE email = ?')
            .bind(recipientEmail)
            .first()

          // Check if user is already an affiliate for this specific deal
          const existingAffiliate = await db
            .prepare(
              'SELECT affiliate_id, deal_name FROM affiliates WHERE email = ? AND domain = ? AND deal_name = ?',
            )
            .bind(recipientEmail, domain || 'vegvisr.org', dealName || 'default')
            .first()

          if (existingAffiliate) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `User is already registered as an affiliate for deal "${dealName || 'default'}" on domain "${domain || 'vegvisr.org'}"`,
                  affiliate: existingAffiliate,
                }),
                { status: 409 },
              ),
            )
          }

          // Determine user type for template selection
          const isExistingUser = !!existingUser

          // Store invitation in database with deal information
          await db
            .prepare(
              `
            INSERT INTO affiliate_invitations (
              token, recipient_email, recipient_name, sender_name,
              inviter_affiliate_id, domain, commission_rate, commission_type, commission_amount,
              deal_name, expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `,
            )
            .bind(
              invitationToken,
              recipientEmail,
              recipientName,
              senderName,
              inviterAffiliateId || null,
              domain || 'vegvisr.org',
              commissionRate || 15.0,
              commissionType || 'percentage',
              commissionAmount || null,
              dealName || 'default', // Now properly storing the deal_name/graphId
              expiresAt.toISOString(),
            )
            .run()

          // Create appropriate URLs based on user type
          const affiliateRegistrationUrl = isExistingUser
            ? `https://www.${domain || 'vegvisr.org'}/affiliate-accept?token=${invitationToken}`
            : `https://www.${domain || 'vegvisr.org'}/affiliate-register?token=${invitationToken}`

          // Prepare email template variables
          const templateVariables = {
            recipientName,
            recipientEmail,
            senderName,
            siteName: siteName || domain || 'Vegvisr',
            commissionRate: `${commissionRate || 15}`,
            commissionType: commissionType || 'percentage',
            commissionAmount: commissionAmount || '',
            affiliateRegistrationUrl,
            affiliateAcceptanceUrl: affiliateRegistrationUrl, // Same URL, different context
            // Pre-calculated commission display for email template
            commissionDisplay:
              commissionType === 'fixed'
                ? `$${commissionAmount || 50} per Sale`
                : `${commissionRate || 15}% Commission`,
            commissionDetails:
              commissionType === 'fixed'
                ? `$${commissionAmount || 50} fixed amount`
                : `${commissionRate || 15}% commission`,
          }

          // Get the appropriate email template based on user type
          const templateId = isExistingUser
            ? 'affiliate_invitation_existing_user'
            : 'affiliate_registration_invitation_simple'

          const template = await env.vegvisr_org
            .prepare('SELECT * FROM email_templates WHERE id = ? AND is_active = 1')
            .bind(templateId)
            .first()

          if (!template) {
            console.error(
              `❌ ${isExistingUser ? 'Existing user' : 'New user'} affiliate email template not found`,
            )
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `Email template not found for ${isExistingUser ? 'existing user' : 'new user'} flow`,
                  templateId,
                }),
                { status: 500 },
              ),
            )
          }

          // Get template - slowyou.io will handle variable replacement
          let emailBody = template.body
          let emailSubject = template.subject

          // Don't convert braces - let slowyou.io handle the variable replacement

          // Send email via slowyou.io following VEGVISR protocol with variables
          const slowyouUrl = 'https://slowyou.io/api/send-vegvisr-email'
          let emailResult = {
            success: false,
            message: 'Email sending attempted',
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: 'attempted',
            recipient: recipientEmail,
            subject: emailSubject,
            sentAt: new Date().toISOString(),
          }

          try {
            const slowyouResponse = await fetch(slowyouUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env.API_TOKEN}`,
              },
              body: JSON.stringify({
                email: recipientEmail,
                template: emailBody,
                subject: emailSubject,
                callbackUrl: affiliateRegistrationUrl,
                variables: templateVariables, // Pass variables to slowyou.io for processing
              }),
            })

            if (slowyouResponse.ok) {
              emailResult.success = true
              emailResult.message = 'Email sent successfully via slowyou.io'
              emailResult.status = 'sent'
            } else {
              let errorData
              try {
                errorData = await slowyouResponse.text()
              } catch (e) {
                errorData = `Failed to read error response: ${e.message}`
              }
              emailResult.error = errorData
              emailResult.status = 'failed'
              console.error('❌ Slowyou.io error:', errorData)
            }
          } catch (fetchError) {
            emailResult.error = fetchError.message
            emailResult.status = 'failed'
            console.error('❌ Slowyou.io fetch error:', fetchError)
          }

          console.log(
            `✅ Affiliate invitation sent to ${recipientEmail} with token ${invitationToken}`,
          )

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Affiliate invitation sent successfully',
                invitationToken,
                expiresAt: expiresAt.toISOString(),
                emailResult,
                // Debug information - what email content was generated
                debugInfo: {
                  isExistingUser,
                  templateId,
                  templateVariables,
                  processedEmailBody: emailBody,
                  processedEmailSubject: emailSubject,
                  slowyouApiCall: {
                    url: slowyouUrl,
                    payload: {
                      email: recipientEmail,
                      template: emailBody,
                      subject: emailSubject,
                      callbackUrl: affiliateRegistrationUrl,
                      variables: templateVariables,
                    },
                  },
                },
              }),
              { status: 200 },
            ),
          )
        } catch (error) {
          console.error('❌ Error sending affiliate invitation:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to send affiliate invitation',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // Validate affiliate invitation token
      if (path === '/validate-invitation' && method === 'GET') {
        const token = url.searchParams.get('token')

        if (!token) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Invitation token required' }), {
              status: 400,
            }),
          )
        }

        const db = env.vegvisr_org

        try {
          const invitation = await db
            .prepare(
              `
            SELECT * FROM affiliate_invitations
            WHERE token = ? AND expires_at > datetime('now') AND used = 0
          `,
            )
            .bind(token)
            .first()

          if (!invitation) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: 'Invalid or expired invitation token',
                }),
                { status: 404 },
              ),
            )
          }

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                invitation: {
                  token: invitation.token,
                  recipientEmail: invitation.recipient_email,
                  recipientName: invitation.recipient_name,
                  senderName: invitation.sender_name,
                  domain: invitation.domain,
                  commissionRate: invitation.commission_rate,
                  dealName: invitation.deal_name, // Include deal_name in response
                  expiresAt: invitation.expires_at,
                },
              }),
              { status: 200 },
            ),
          )
        } catch (error) {
          console.error('❌ Error validating invitation:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to validate invitation',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // Complete affiliate registration with invitation token
      if (path === '/complete-invitation-registration' && method === 'POST') {
        const { token, email, name, additionalInfo } = await request.json()

        if (!token || !email || !name) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Token, email, and name are required',
              }),
              { status: 400 },
            ),
          )
        }

        const db = env.vegvisr_org

        try {
          // Validate invitation token
          const invitation = await db
            .prepare(
              `
            SELECT * FROM affiliate_invitations
            WHERE token = ? AND expires_at > datetime('now') AND used = 0
          `,
            )
            .bind(token)
            .first()

          if (!invitation) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: 'Invalid or expired invitation token',
                }),
                { status: 404 },
              ),
            )
          }

          // Register affiliate directly (no HTTP call to avoid self-call issues)
          console.log('🔗 Processing affiliate registration for invitation acceptance')
          
          const affiliateId = `aff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const referralCode = `${name.substring(0, 3).toUpperCase()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`

          try {
            // Check if user exists in config table
            const existingUser = await db
              .prepare('SELECT user_id, data FROM config WHERE email = ?')
              .bind(email)
              .first()

            if (!existingUser) {
              return addCorsHeaders(
                new Response(
                  JSON.stringify({
                    error: 'User must be registered first. Please complete user registration before becoming an affiliate.',
                    action: 'register_first',
                    registrationUrl: `https://vegvisr.org/register?email=${encodeURIComponent(email)}`,
                  }),
                  { status: 400 },
                ),
              )
            }

            // Check if already an affiliate for this specific deal
            const existingAffiliate = await db
              .prepare(
                'SELECT affiliate_id, deal_name FROM affiliates WHERE email = ? AND domain = ? AND deal_name = ?',
              )
              .bind(email, invitation.domain || 'vegvisr.org', invitation.deal_name || 'default')
              .first()

            if (existingAffiliate) {
              console.log('✅ User is already an affiliate, marking invitation as completed')
              
              // Mark invitation as used and completed
              await db
                .prepare(
                  'UPDATE affiliate_invitations SET used = 1, used_at = datetime("now"), status = "completed" WHERE token = ?',
                )
                .bind(token)
                .run()

              return addCorsHeaders(
                new Response(
                  JSON.stringify({
                    success: true,
                    message: 'User is already an affiliate, invitation completed',
                    affiliate: {
                      affiliateId: existingAffiliate.affiliate_id,
                      email: email,
                      name: name,
                      dealName: existingAffiliate.deal_name,
                      status: 'active',
                    },
                  }),
                  { status: 200 },
                ),
              )
            }

            // Check if user already exists as affiliate (for any deal)
            const anyExistingAffiliate = await db
              .prepare(
                'SELECT affiliate_id, email, name FROM affiliates WHERE email = ? AND domain = ? LIMIT 1',
              )
              .bind(email, invitation.domain || 'vegvisr.org')
              .first()

            if (anyExistingAffiliate) {
              console.log('✅ User has existing affiliate account, marking invitation as completed')
              
              // Mark invitation as used and completed
              await db
                .prepare(
                  'UPDATE affiliate_invitations SET used = 1, used_at = datetime("now"), status = "completed" WHERE token = ?',
                )
                .bind(token)
                .run()

              return addCorsHeaders(
                new Response(
                  JSON.stringify({
                    success: true,
                    message: 'User has existing affiliate account, invitation completed',
                    affiliate: {
                      affiliateId: anyExistingAffiliate.affiliate_id,
                      email: email,
                      name: name,
                      referralCode: anyExistingAffiliate.affiliate_id.split('_')[2]?.toUpperCase() || 'EXISTING',
                      domain: invitation.domain || 'vegvisr.org',
                      commissionRate: invitation.commission_rate || 15.0,
                      commissionType: invitation.commission_type || 'percentage',
                      commissionAmount: invitation.commission_amount || null,
                      dealName: invitation.deal_name || 'default',
                      status: 'active',
                    },
                  }),
                  { status: 200 },
                ),
              )
            }

            // Add new affiliate record
            await db
              .prepare(
                `
              INSERT INTO affiliates (
                affiliate_id, email, name, referral_code, domain,
                referred_by, status, commission_rate, commission_type, commission_amount,
                deal_name, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, datetime('now'))
            `,
              )
              .bind(
                affiliateId,
                email,
                name,
                referralCode,
                invitation.domain || 'vegvisr.org',
                invitation.inviter_affiliate_id || null,
                invitation.commission_rate || 15.0,
                invitation.commission_type || 'percentage',
                invitation.commission_amount || null,
                invitation.deal_name || 'default',
              )
              .run()

            // Update user data to include affiliate flag
            const userData = JSON.parse(existingUser.data || '{}')
            userData.isAffiliate = true
            userData.affiliateId = affiliateId
            userData.referralCode = referralCode

            await db
              .prepare('UPDATE config SET data = ? WHERE email = ?')
              .bind(JSON.stringify(userData), email)
              .run()

            console.log(`✅ User ${email} is now an affiliate: ${affiliateId}`)

            // Update graph metadata with new affiliate information
            if (invitation.deal_name && invitation.deal_name !== 'default') {
              await updateGraphAffiliateMetadata(invitation.deal_name, env)
            }

            // Mark invitation as used and completed
            await db
              .prepare(
                'UPDATE affiliate_invitations SET used = 1, used_at = datetime("now"), status = "completed" WHERE token = ?',
              )
              .bind(token)
              .run()

            console.log(`✅ Affiliate registration completed via invitation: ${affiliateId}`)

            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: true,
                  message: 'Affiliate registration completed successfully',
                  affiliate: {
                    affiliateId,
                    email,
                    name,
                    referralCode,
                    domain: invitation.domain || 'vegvisr.org',
                    commissionRate: invitation.commission_rate || 15.0,
                    commissionType: invitation.commission_type || 'percentage',
                    commissionAmount: invitation.commission_amount || null,
                    dealName: invitation.deal_name || 'default',
                    status: 'active',
                  },
                }),
                { status: 201 },
              ),
            )

          } catch (registrationError) {
            console.error('❌ Database error during affiliate registration:', registrationError)
            console.error('❌ Registration error details:', registrationError.message || registrationError)
            
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: 'Failed to register affiliate',
                  details: registrationError.message || 'Database error during registration',
                }),
                { status: 500 },
              ),
            )
          }
        } catch (error) {
          console.error('❌ Error completing invitation registration:', error)
          console.error('❌ Error message:', error.message || error)
          console.error('❌ Error stack:', error.stack || 'No stack trace')
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to complete registration',
                details: error.message || 'Unknown error',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // ===========================================
      // ADMIN ENDPOINTS
      // ===========================================

      // Get all affiliates (admin only)
      if (path === '/admin/affiliates' && method === 'GET') {
        const db = env.vegvisr_org

        try {
          const affiliates = await db
            .prepare(
              `
            SELECT
              a.*,
              COUNT(r.id) as total_referrals,
              SUM(CASE WHEN r.status = 'converted' THEN r.commission_amount ELSE 0 END) as total_earnings
            FROM affiliates a
            LEFT JOIN referrals r ON a.affiliate_id = r.affiliate_id
            GROUP BY a.affiliate_id
            ORDER BY a.created_at DESC
          `,
            )
            .all()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                affiliates: affiliates.results || [],
              }),
              { status: 200 },
            ),
          )
        } catch (error) {
          console.error('❌ Error fetching affiliates:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to fetch affiliates',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // ===========================================
      // GRAPH AMBASSADOR ENDPOINTS (NEW)
      // ===========================================

      // Get affiliate deals by graph ID
      if (path === '/affiliate-deals-by-graph' && method === 'GET') {
        const graphId = url.searchParams.get('graphId')

        if (!graphId) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Graph ID required' }), {
              status: 400,
            }),
          )
        }

        const db = env.vegvisr_org

        try {
          // Get all affiliates for this graph (using deal_name as graphId)
          const affiliates = await db
            .prepare(
              `
              SELECT
                affiliate_id, email, name, commission_type, commission_amount, commission_rate,
                status, created_at
              FROM affiliates
              WHERE deal_name = ? AND status = 'active'
              ORDER BY created_at DESC
            `,
            )
            .bind(graphId)
            .all()

          // Get referral statistics for this graph
          const stats = await db
            .prepare(
              `
              SELECT
                COUNT(DISTINCT r.affiliate_id) as active_affiliates,
                COUNT(r.id) as total_referrals,
                COUNT(CASE WHEN r.status = 'converted' THEN 1 END) as converted_referrals,
                SUM(CASE WHEN r.status = 'converted' THEN r.commission_amount ELSE 0 END) as total_earnings
              FROM affiliates a
              LEFT JOIN referrals r ON a.affiliate_id = r.affiliate_id
              WHERE a.deal_name = ?
            `,
            )
            .bind(graphId)
            .first()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                graphId,
                ambassadors: affiliates.results || [],
                statistics: {
                  totalAmbassadors: (affiliates.results || []).length,
                  activeAffiliates: stats?.active_affiliates || 0,
                  totalReferrals: stats?.total_referrals || 0,
                  convertedReferrals: stats?.converted_referrals || 0,
                  totalEarnings: stats?.total_earnings || 0,
                  conversionRate:
                    stats?.total_referrals > 0
                      ? (((stats?.converted_referrals || 0) / stats.total_referrals) * 100).toFixed(
                          2,
                        )
                      : '0.00',
                },
              }),
              { status: 200 },
            ),
          )
        } catch (error) {
          console.error('❌ Error fetching affiliate deals by graph:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to fetch affiliate deals',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // Bulk check graph ambassador status
      if (path === '/graph-ambassador-status' && method === 'GET') {
        console.log('📊 Received GET /graph-ambassador-status request')

        const graphIds = url.searchParams.getAll('graphIds[]')

        if (!graphIds || graphIds.length === 0) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'At least one graph ID required' }), {
              status: 400,
            }),
          )
        }

        const db = env.vegvisr_org

        try {
          const ambassadorStatus = {}

          // Process each graph ID
          for (const graphId of graphIds) {
            // Get ambassador count and basic stats for this graph
            const stats = await db
              .prepare(
                `
                SELECT
                  COUNT(*) as ambassador_count,
                  SUM(CASE WHEN commission_type = 'fixed' THEN commission_amount ELSE 0 END) as total_fixed_commissions,
                  AVG(CASE WHEN commission_type = 'percentage' THEN commission_rate ELSE 0 END) as avg_percentage_rate
                FROM affiliates
                WHERE deal_name = ? AND status = 'active'
              `,
              )
              .bind(graphId)
              .first()

            // Get top affiliate for this graph (by creation date - could be enhanced later)
            const topAffiliate = await db
              .prepare(
                `
                SELECT name, email
                FROM affiliates
                WHERE deal_name = ? AND status = 'active'
                ORDER BY created_at ASC
                LIMIT 1
              `,
              )
              .bind(graphId)
              .first()

            const ambassadorCount = stats?.ambassador_count || 0
            const hasAmbassadors = ambassadorCount > 0

            ambassadorStatus[graphId] = {
              hasAmbassadors,
              affiliateCount: ambassadorCount,
              totalCommissions: stats?.total_fixed_commissions || '0.00',
              averageRate: stats?.avg_percentage_rate || 0,
              topAffiliate: topAffiliate ? `${topAffiliate.name} (${topAffiliate.email})` : null,
            }
          }

          console.log(`✅ Ambassador status checked for ${graphIds.length} graphs`)

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                ambassadorStatus,
                totalGraphsChecked: graphIds.length,
              }),
              { status: 200 },
            ),
          )
        } catch (error) {
          console.error('❌ Error checking graph ambassador status:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to check ambassador status',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // Get ambassador graphs for a specific affiliate
      if (path === '/affiliate-ambassador-graphs' && method === 'GET') {
        const affiliateId = url.searchParams.get('affiliateId')

        if (!affiliateId) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Affiliate ID required' }), {
              status: 400,
            }),
          )
        }

        const db = env.vegvisr_org

        try {
          // Get all graphs this affiliate is ambassador for
          const ambassadorDeals = await db
            .prepare(
              `
              SELECT
                deal_name as graph_id, commission_type, commission_amount, commission_rate,
                created_at, status
              FROM affiliates
              WHERE affiliate_id = ? AND status = 'active' AND deal_name != 'default'
              ORDER BY created_at DESC
            `,
            )
            .bind(affiliateId)
            .all()

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                affiliateId,
                ambassadorGraphs: ambassadorDeals.results || [],
                totalGraphs: (ambassadorDeals.results || []).length,
              }),
              { status: 200 },
            ),
          )
        } catch (error) {
          console.error('❌ Error fetching affiliate ambassador graphs:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to fetch ambassador graphs',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // Check if a graph has any affiliate partners
      if (path === '/check-affiliate-deal' && method === 'GET') {
        const dealName = url.searchParams.get('deal_name') // This is the graphId

        if (!dealName) {
          return addCorsHeaders(
            new Response(JSON.stringify({ error: 'deal_name is required' }), {
              status: 400,
            }),
          )
        }

        const db = env.vegvisr_org

        try {
          // Check if this graph has any active affiliate partners
          const affiliateCount = await db
            .prepare(
              `
              SELECT COUNT(*) as count
              FROM affiliates
              WHERE deal_name = ? AND status = 'active'
            `,
            )
            .bind(dealName)
            .first()

          const hasAffiliates = affiliateCount.count > 0

          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                hasAffiliates: hasAffiliates,
                affiliateCount: affiliateCount.count,
              }),
              { status: 200 },
            ),
          )
        } catch (error) {
          console.error('❌ Error checking affiliate deal:', error)
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: 'Failed to check affiliate deal',
              }),
              { status: 500 },
            ),
          )
        }
      }

      // 404 for unmatched routes
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Endpoint not found' }), {
          status: 404,
        }),
      )
    } catch (error) {
      console.error('❌ Affiliate Worker Error:', error)
      return addCorsHeaders(
        new Response(
          JSON.stringify({
            error: 'Internal server error',
          }),
          { status: 500 },
        ),
      )
    }
  },
}
