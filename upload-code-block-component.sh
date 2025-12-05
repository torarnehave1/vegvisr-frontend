#!/bin/bash

# Upload code-block component to Vegvisr Component Manager
# This script:
# 1. Uploads component JS to R2
# 2. Registers in web_components table
# 3. Syncs to apiForApps table

set -e # Exit on error

echo "🚀 Uploading code-block component to Vegvisr..."

# Step 1: Upload to R2
echo "📦 Step 1: Uploading code-block.js to R2..."
cd api-worker
npx wrangler r2 object put web-components/code-block.js \
  --file=components/code-block.js \
  --remote \
  --content-type=application/javascript

echo "✅ Uploaded to R2: web-components/code-block.js"

# Step 2: Register in database
echo "💾 Step 2: Registering component in database..."
cd ..
npx wrangler d1 execute vegvisr_org \
  --remote \
  --file=register-code-block-component.sql

echo "✅ Registered in web_components, component_versions, and apiForApps tables"

# Step 3: Sync to apiForApps (optional, for real-time updates)
echo "🔄 Step 3: Syncing components to API registry..."
curl -X POST https://api.vegvisr.org/api/components/sync \
  -H "Content-Type: application/json" \
  | jq .

echo ""
echo "✨ Component upload complete!"
echo "📖 View component: https://api.vegvisr.org/api/components/code-block"
echo "🎨 Test component: https://api.vegvisr.org/components/code-block.js"
echo ""
echo "Usage in HTML:"
echo '<script src="https://api.vegvisr.org/components/code-block.js"></script>'
echo '<code-block language="javascript" line-numbers>'
echo 'const hello = "world";'
echo '</code-block>'
