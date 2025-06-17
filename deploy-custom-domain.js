const fs = require('fs')
const { execSync } = require('child_process')
const path = require('path')

// Configuration
const WORKER_DIR = './sweet-worker'
const WRANGLER_TEMPLATE = `name = "{{WORKER_NAME}}"
main = "index.js"
compatibility_date = "2024-01-01"

[env.production]
routes = [
  { pattern = "{{CUSTOM_DOMAIN}}", custom_domain = true }
]

[env.development]
routes = [
  { pattern = "{{WORKER_SUBDOMAIN}}.torarnehave.workers.dev" }
]

workers_dev = true
`

function deployCustomDomain(customDomain) {
  // Generate a worker name from the domain
  const workerName =
    customDomain.replace(/\./g, '-').toLowerCase().substring(0, 20) + // Cloudflare has a length limit
    '-' +
    Math.random().toString(36).substring(2, 6)

  // Create temporary deployment directory
  const deployDir = path.join(WORKER_DIR, `deploy-${workerName}`)
  fs.mkdirSync(deployDir, { recursive: true })

  // Copy worker code
  fs.copyFileSync(path.join(WORKER_DIR, 'index.js'), path.join(deployDir, 'index.js'))

  // Generate wrangler.toml
  const wranglerConfig = WRANGLER_TEMPLATE.replace('{{WORKER_NAME}}', workerName)
    .replace('{{CUSTOM_DOMAIN}}', customDomain)
    .replace('{{WORKER_SUBDOMAIN}}', workerName)

  fs.writeFileSync(path.join(deployDir, 'wrangler.toml'), wranglerConfig)

  // Deploy the worker
  try {
    console.log(`\nDeploying worker for ${customDomain}...`)
    execSync('wrangler deploy --env production', {
      cwd: deployDir,
      stdio: 'inherit',
    })
    console.log(`\n✅ Successfully deployed worker for ${customDomain}`)
    console.log(`Worker name: ${workerName}`)

    // Save deployment info
    const deployments = JSON.parse(
      fs.readFileSync('custom-domain-deployments.json', { encoding: 'utf8', flag: 'a+' }) || '{}',
    )
    deployments[customDomain] = {
      workerName,
      deployedAt: new Date().toISOString(),
    }
    fs.writeFileSync('custom-domain-deployments.json', JSON.stringify(deployments, null, 2))
  } catch (error) {
    console.error(`\n❌ Failed to deploy worker for ${customDomain}:`, error.message)
  }

  // Cleanup
  fs.rmSync(deployDir, { recursive: true, force: true })
}

// If running directly
if (require.main === module) {
  const domain = process.argv[2]
  if (!domain) {
    console.log('Usage: node deploy-custom-domain.js <custom-domain>')
    console.log('Example: node deploy-custom-domain.js mybrand.example.com')
    process.exit(1)
  }
  deployCustomDomain(domain)
}

module.exports = { deployCustomDomain }
