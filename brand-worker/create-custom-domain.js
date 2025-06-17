const createCustomDomain = async (subdomain) => {
  // Your Cloudflare API token should have DNS edit permissions
  const CF_API_TOKEN = process.env.CF_API_TOKEN
  const ZONE_ID = process.env.CF_ZONE_ID // Zone ID for norsegong.com

  if (!CF_API_TOKEN || !ZONE_ID) {
    throw new Error('CF_API_TOKEN and CF_ZONE_ID environment variables are required')
  }

  // First, create the DNS record
  const dnsResponse = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'CNAME',
        name: subdomain,
        content: 'brand-worker-production.torarnehave.workers.dev',
        proxied: true,
      }),
    },
  )

  const dnsResult = await dnsResponse.json()

  if (!dnsResult.success) {
    throw new Error(`Failed to create DNS record: ${JSON.stringify(dnsResult.errors)}`)
  }

  console.log(`✅ DNS record created for ${subdomain}.norsegong.com`)

  // Now add the custom domain to the worker
  const workerResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/workers/domains`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostname: `${subdomain}.norsegong.com`,
        service: 'brand-worker-production',
      }),
    },
  )

  const workerResult = await workerResponse.json()

  if (!workerResult.success) {
    throw new Error(`Failed to add custom domain to worker: ${JSON.stringify(workerResult.errors)}`)
  }

  console.log(`✅ Custom domain added to worker`)

  return {
    dns: dnsResult,
    worker: workerResult,
  }
}

// If running directly from command line
if (require.main === module) {
  const subdomain = process.argv[2]
  if (!subdomain) {
    console.log('Usage: node create-custom-domain.js <subdomain>')
    console.log('Example: node create-custom-domain.js salt')
    process.exit(1)
  }

  createCustomDomain(subdomain)
    .then(() => console.log('✨ Custom domain setup complete!'))
    .catch((error) => {
      console.error('❌ Error:', error.message)
      process.exit(1)
    })
}

module.exports = { createCustomDomain }
