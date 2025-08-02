// Email Template Test - Commission Types
const testEmailCommissionTypes = async () => {
  const emailWorkerUrl = 'https://email-worker.torarnehave.workers.dev'

  // Test 1: Percentage Commission (matches our A1 test)
  const percentageTest = {
    templateId: 'affiliate_registration_invitation',
    variables: {
      recipientName: 'Test User Unique',
      recipientEmail: 'test-unique-20250802@example.com',
      senderName: 'Test Sender',
      siteName: 'Vegvisr.org',
      commissionRate: '20',
      commissionType: 'percentage',
      commissionAmount: '50',
      affiliateRegistrationUrl:
        'https://vegvisr.org/affiliate/register?token=e64c58c2-d804-4c1d-a5b8-9c2b3971db94',
    },
  }

  // Test 2: Fixed Commission (matches our A2 test)
  const fixedTest = {
    templateId: 'affiliate_registration_invitation',
    variables: {
      recipientName: 'Fixed Commission User',
      recipientEmail: 'fixed-test-20250802@example.com',
      senderName: 'Test Sender',
      siteName: 'Vegvisr.org',
      commissionRate: '15',
      commissionType: 'fixed',
      commissionAmount: '75',
      affiliateRegistrationUrl:
        'https://vegvisr.org/affiliate/register?token=ffd3d267-9e7b-4b43-a5bb-3838f7bdc54e',
    },
  }

  console.log('🧪 Testing Email Template Commission Display...\n')

  // Test Percentage Commission
  console.log('📊 TEST C1: Percentage Commission Template')
  console.log('Data:', JSON.stringify(percentageTest.variables, null, 2))

  try {
    const response1 = await fetch(`${emailWorkerUrl}/render-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(percentageTest),
    })

    const result1 = await response1.json()

    if (response1.ok) {
      console.log('✅ SUCCESS! Percentage template rendered')
      console.log('Subject:', result1.template.subject)

      // Extract commission text from body
      const body = result1.template.body
      const commissionMatch = body.match(/💰 Earn ([^<]+)</g)
      if (commissionMatch) {
        console.log('Commission Display:', commissionMatch[0])
      }

      // Check for percentage indicators
      if (body.includes('20%') || body.includes('percentage')) {
        console.log('✅ Percentage commission detected in template')
      } else {
        console.log('❌ Percentage commission NOT detected')
      }
    } else {
      console.log('❌ ERROR:', result1)
    }
  } catch (error) {
    console.log('❌ FETCH ERROR:', error.message)
  }

  console.log('\n💰 TEST C2: Fixed Commission Template')
  console.log('Data:', JSON.stringify(fixedTest.variables, null, 2))

  try {
    const response2 = await fetch(`${emailWorkerUrl}/render-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixedTest),
    })

    const result2 = await response2.json()

    if (response2.ok) {
      console.log('✅ SUCCESS! Fixed template rendered')
      console.log('Subject:', result2.template.subject)

      // Extract commission text from body
      const body = result2.template.body
      const commissionMatch = body.match(/💰 Earn ([^<]+)</g)
      if (commissionMatch) {
        console.log('Commission Display:', commissionMatch[0])
      }

      // Check for fixed amount indicators
      if (body.includes('$75') || body.includes('fixed')) {
        console.log('✅ Fixed commission detected in template')
      } else {
        console.log('❌ Fixed commission NOT detected')
      }
    } else {
      console.log('❌ ERROR:', result2)
    }
  } catch (error) {
    console.log('❌ FETCH ERROR:', error.message)
  }
}

// Run the tests
testEmailCommissionTypes().catch(console.error)
