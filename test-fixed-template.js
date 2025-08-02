// Test Fixed Commission Template
const testFixedCommissionTemplate = async () => {
  console.log('🧪 Testing FIXED Commission Template After Fix\n')

  // Test with the exact data from our A2 test
  const fixedCommissionData = {
    recipientEmail: 'template-test-fixed@example.com',
    recipientName: 'Template Test Fixed User',
    senderName: 'Test Sender',
    siteName: 'Vegvisr.org',
    commissionType: 'fixed',
    commissionRate: 15,
    commissionAmount: 75,
    domain: 'vegvisr.org',
  }

  try {
    console.log('📨 Sending affiliate invitation with fixed commission...')
    console.log('Data:', JSON.stringify(fixedCommissionData, null, 2))

    const response = await fetch('https://test.vegvisr.org/send-affiliate-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixedCommissionData),
    })

    const result = await response.json()

    if (response.ok && result.success) {
      console.log('✅ SUCCESS! Invitation sent')
      console.log('Response:', JSON.stringify(result, null, 2))

      console.log('\n📧 Now testing email template rendering...')

      // Test the email template generation
      const emailWorkerUrl = 'https://email-worker.torarnehave.workers.dev'

      const templateTest = {
        templateId: 'affiliate_registration_invitation_simple',
        variables: {
          recipientName: fixedCommissionData.recipientName,
          recipientEmail: fixedCommissionData.recipientEmail,
          senderName: fixedCommissionData.senderName,
          siteName: fixedCommissionData.siteName,
          commissionRate: '15',
          commissionType: 'fixed',
          commissionAmount: '75',
          commissionDisplay: '$75 per Sale',
          commissionDetails: '$75 fixed amount',
          affiliateRegistrationUrl: `https://vegvisr.org/affiliate-register?token=${result.invitationToken}`,
        },
      }

      const emailResponse = await fetch(`${emailWorkerUrl}/render-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateTest),
      })

      const emailResult = await emailResponse.json()

      if (emailResponse.ok) {
        console.log('✅ Email template rendered successfully!')
        console.log('Subject:', emailResult.template.subject)

        // Check for commission display
        const body = emailResult.template.body
        if (body.includes('$75 per Sale')) {
          console.log('✅ Fixed commission properly displayed: $75 per Sale')
        } else if (body.includes('{{commissionDisplay}}')) {
          console.log('❌ Template variables not replaced')
        } else {
          console.log('⚠️ Commission display unclear in template')
        }

        // Check for commission details
        if (body.includes('$75 fixed amount')) {
          console.log('✅ Commission details properly displayed: $75 fixed amount')
        }
      } else {
        console.log('❌ Email template error:', emailResult)
      }
    } else {
      console.log('❌ Invitation sending failed:', result)
    }
  } catch (error) {
    console.log('❌ Error:', error.message)
  }
}

// Run the test
testFixedCommissionTemplate().catch(console.error)
