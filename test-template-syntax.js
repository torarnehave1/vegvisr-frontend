// Email Template Syntax Comparison Test
const testTemplateSyntax = async () => {
  const emailWorkerUrl = 'https://email-worker.torarnehave.workers.dev'

  // Test 1: Chat template (simple syntax)
  const chatTest = {
    templateId: 'default-chat-invitation-en',
    variables: {
      recipientName: 'John Doe',
      inviterName: 'Jane Smith',
      roomName: 'Tech Discussion',
      invitationMessage: 'Join us for exciting tech talks!',
      invitationLink: 'https://vegvisr.org/room/tech-discussion?invite=abc123',
    },
  }

  // Test 2: Simple affiliate variables (ignoring conditionals)
  const simpleAffiliateTest = {
    templateId: 'affiliate_registration_invitation',
    variables: {
      recipientName: 'Test User',
      recipientEmail: 'test@example.com',
      senderName: 'Test Sender',
      siteName: 'Vegvisr.org',
      commissionRate: '20',
      commissionType: 'percentage',
      commissionAmount: '75',
      affiliateRegistrationUrl: 'https://vegvisr.org/affiliate/register?token=abc123',
    },
  }

  console.log('🔍 TEMPLATE SYNTAX INVESTIGATION\n')

  // Test Chat Template
  console.log('📨 TEST 1: Chat Template (Simple {variable} syntax)')
  try {
    const response1 = await fetch(`${emailWorkerUrl}/render-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatTest),
    })

    const result1 = await response1.json()

    if (response1.ok) {
      console.log('✅ Chat template SUCCESS')
      console.log('Subject:', result1.template.subject)

      // Check if variables were replaced
      const body = result1.template.body
      if (body.includes('{') || body.includes('}')) {
        console.log('❌ Chat template: Variables NOT replaced properly')
        console.log('Sample:', body.substring(0, 200) + '...')
      } else {
        console.log('✅ Chat template: All variables replaced correctly')
      }
    } else {
      console.log('❌ Chat template ERROR:', result1)
    }
  } catch (error) {
    console.log('❌ Chat template FETCH ERROR:', error.message)
  }

  console.log('\n💰 TEST 2: Affiliate Template (Handlebars {{variable}} syntax)')
  try {
    const response2 = await fetch(`${emailWorkerUrl}/render-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simpleAffiliateTest),
    })

    const result2 = await response2.json()

    if (response2.ok) {
      console.log('✅ Affiliate template SUCCESS')
      console.log('Subject:', result2.template.subject)

      // Check if variables were replaced
      const body = result2.template.body
      if (body.includes('{{') || body.includes('}}')) {
        console.log('❌ Affiliate template: Variables NOT replaced properly')
        console.log('Contains Handlebars syntax that needs proper renderer')

        // Show commission section specifically
        const commissionMatch = body.match(/💰 Earn[^<]+</g)
        if (commissionMatch) {
          console.log('Commission section:', commissionMatch[0])
        }
      } else {
        console.log('✅ Affiliate template: All variables replaced correctly')
      }
    } else {
      console.log('❌ Affiliate template ERROR:', result2)
    }
  } catch (error) {
    console.log('❌ Affiliate template FETCH ERROR:', error.message)
  }

  console.log('\n🔧 FINDINGS:')
  console.log('- Chat template uses {variable} (single braces)')
  console.log('- Affiliate template uses {{variable}} + Handlebars conditionals')
  console.log('- Current email system only handles simple replacements')
  console.log('- Need Handlebars renderer for affiliate template conditionals')
}

// Run the comparison test
testTemplateSyntax().catch(console.error)
