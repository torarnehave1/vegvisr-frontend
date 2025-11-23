#!/bin/bash

echo "🧪 Testing Component Integration with AI Generation"
echo "===================================================="
echo ""

echo "1️⃣  Checking available components in database..."
curl -s "https://api.vegvisr.org/api/apis/list?type=component&status=active" | jq '.apis.components[] | {name, slug, capability_type}'
echo ""

echo "2️⃣  Testing generate-app WITH canvas component enabled..."
curl -X POST https://api.vegvisr.org/generate-app \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a simple drawing app",
    "aiModel": "grok",
    "enabledAPIs": [],
    "enabledComponents": ["canvas-drawing"]
  }' 2>&1 | jq -r '.code' | head -100

echo ""
echo "✅ Test complete! Check if the AI used the <canvas-drawing> component above."
