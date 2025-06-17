require('dotenv').config()
const { createCustomDomain } = require('./create-custom-domain')

// These values should be in your .env file
const requiredEnvVars = ['CF_API_TOKEN', 'CF_ZONE_ID', 'CF_ACCOUNT_ID']

// Check for missing environment variables
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '))
  console.error('\nCreate a .env file with the following variables:')
  console.error(`
CF_API_TOKEN=your_api_token_here
CF_ZONE_ID=your_zone_id_here
CF_ACCOUNT_ID=your_account_id_here
  `)
  process.exit(1)
}

// Get subdomain from command line
const subdomain = process.argv[2]
if (!subdomain) {
  console.error('Usage: node setup-domain.js <subdomain>')
  console.error('Example: node setup-domain.js salt')
  process.exit(1)
}

// Create the custom domain
createCustomDomain(subdomain)
  .then(() => {
    console.log(`
✨ Domain setup complete!
🌐 Your new domain ${subdomain}.norsegong.com has been configured
⏳ Please allow a few minutes for DNS propagation
    `)
  })
  .catch((error) => {
    console.error('❌ Error:', error.message)
    process.exit(1)
  })
