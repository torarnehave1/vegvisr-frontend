#!/bin/bash

# Test Grok Image Generation Endpoint
# Usage: ./test-grok-images.sh [local|prod]

ENV=${1:-local}

if [ "$ENV" = "prod" ]; then
  BASE_URL="https://grok.vegvisr.org"
  echo "🌍 Testing PRODUCTION environment"
else
  BASE_URL="http://localhost:8787"
  echo "💻 Testing LOCAL environment"
fi

echo ""
echo "======================================"
echo "Grok Image Generation Tests"
echo "======================================"
echo ""

# Test 1: List image models
echo "📋 Test 1: List image models"
echo "GET $BASE_URL/image-models"
echo ""
curl -s "$BASE_URL/image-models" | jq '.'
echo ""

# Test 2: Generate image (basic)
echo "🖼️  Test 2: Generate image (basic with userId)"
echo "POST $BASE_URL/images"
echo ""
curl -s -X POST "$BASE_URL/images" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b",
    "prompt": "A beautiful Norwegian fjord at sunset",
    "size": "1024x1024"
  }' | jq '.'
echo ""

# Test 3: Generate image with userId (uses user API key from D1)
echo "👤 Test 3: Generate image with userId"
echo "POST $BASE_URL/images"
echo ""
curl -s -X POST "$BASE_URL/images" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b",
    "prompt": "A futuristic city with neon lights",
    "size": "1024x1792",
    "model": "grok-2-image-beta"
  }' | jq '.'
echo ""

# Test 4: Missing prompt (should return 400)
echo "❌ Test 4: Missing prompt validation"
echo "POST $BASE_URL/images"
echo ""
curl -s -X POST "$BASE_URL/images" \
  -H "Content-Type: application/json" \
  -d '{
    "size": "1024x1024"
  }' | jq '.'
echo ""

# Test 5: Different size - landscape
echo "🖼️  Test 5: Landscape format (1792x1024)"
echo "POST $BASE_URL/images"
echo ""
curl -s -X POST "$BASE_URL/images" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b",
    "prompt": "A wide panoramic view of mountains",
    "size": "1792x1024"
  }' | jq '.'
echo ""

# Test 6: Check API documentation
echo "📖 Test 6: Check API documentation"
echo "GET $BASE_URL/api/docs"
echo ""
curl -s "$BASE_URL/api/docs" | jq '.paths | keys | .[] | select(. | contains("image"))'
echo ""

echo "======================================"
echo "✅ Tests completed"
echo "======================================"
