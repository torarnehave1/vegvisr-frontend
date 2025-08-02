// Test script for affiliate email template
const testAffiliateEmail = async () => {
  const emailWorkerUrl = 'https://email-worker.torarnehave.workers.dev'

  const testData = {
    templateId: 'affiliate_registration_invitation',
    variables: {
      recipientName: 'John Doe',
      recipientEmail: 'john@example.com',
      senderName: 'Jane Smith',
      siteName: 'Vegvisr',
      commissionRate: '10',
      affiliateRegistrationUrl: 'https://vegvisr.org/affiliate/register?token=abc123',
    },
  }

  try {
    console.log('Testing affiliate email template rendering...')
    console.log('Request data:', JSON.stringify(testData, null, 2))

    const response = await fetch(`${emailWorkerUrl}/render-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    })

    const result = await response.json()

    if (response.ok) {
      console.log('\n✅ SUCCESS! Template rendered successfully')
      console.log('\nRendered Subject:', result.template.subject)
      console.log('\nRendered Body Preview:', result.template.body.substring(0, 500) + '...')

      // Check if variables were replaced
      const hasUnreplacedVars =
        result.template.body.includes('{{') || result.template.subject.includes('{{')
      if (hasUnreplacedVars) {
        console.log('\n⚠️ WARNING: Some variables may not have been replaced properly')
      } else {
        console.log('\n✅ All variables appear to have been replaced correctly')
      }
    } else {
      console.error('\n❌ ERROR:', result)
    }
  } catch (error) {
    console.error('\n❌ FETCH ERROR:', error.message)
  }
}

testAffiliateEmail()
