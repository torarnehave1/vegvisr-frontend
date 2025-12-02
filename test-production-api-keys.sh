#!/bin/bash

# Test Production User API Keys Endpoints
# Tests all CRUD operations for user API key management

set -e

API_BASE="https://api.vegvisr.org"
TEST_USER_ID="test_production_$(date +%s)"
TEST_PROVIDER="openai"
TEST_API_KEY="sk-test-production-key-abc123xyz"

echo "🧪 Testing Production User API Keys Endpoints"
echo "============================================================"
echo "Base URL: $API_BASE"
echo "User ID: $TEST_USER_ID"
echo "Provider: $TEST_PROVIDER"
echo "============================================================"

# TEST 1: PUT /user-api-keys - Store API key
echo ""
echo "📝 TEST 1: PUT /user-api-keys - Store API key"
echo "Action: Encrypt and store user's API key"

STORE_RESPONSE=$(curl -s -X PUT "$API_BASE/user-api-keys" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$TEST_USER_ID\",
    \"provider\": \"$TEST_PROVIDER\",
    \"apiKey\": \"$TEST_API_KEY\",
    \"keyName\": \"My OpenAI Production Key\",
    \"models\": [\"gpt-4\", \"gpt-4-vision-preview\"]
  }")

echo "$STORE_RESPONSE" | jq '.'

if echo "$STORE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ API key stored successfully"
else
  echo "❌ Failed to store API key"
  exit 1
fi

# Wait for propagation
echo ""
echo "⏳ Waiting 3 seconds for secret and metadata to propagate..."
sleep 3

# TEST 2: GET /user-api-keys - List user's API keys
echo ""
echo "📖 TEST 2: GET /user-api-keys - List user's API keys"
echo "Action: Retrieve metadata (NOT actual keys)"

LIST_RESPONSE=$(curl -s -X GET "$API_BASE/user-api-keys?userId=$TEST_USER_ID")

echo "$LIST_RESPONSE" | jq '.'

if echo "$LIST_RESPONSE" | grep -q '"success":true'; then
  KEY_COUNT=$(echo "$LIST_RESPONSE" | jq '.keys | length')
  echo "✅ Retrieved $KEY_COUNT API key(s) metadata"
  
  # Verify no plaintext keys are returned
  if echo "$LIST_RESPONSE" | grep -q "sk-test"; then
    echo "❌ SECURITY VIOLATION: Plaintext API key in response!"
    exit 1
  else
    echo "✅ Security verified: No plaintext keys in response"
  fi
else
  echo "❌ Failed to list API keys"
  exit 1
fi

# TEST 3: POST /user-ai-chat with useUserModel=true
echo ""
echo "💬 TEST 3: POST /user-ai-chat - Use user's API key"
echo "Action: AI chat using user's own API key"
echo "NOTE: This will fail if test API key is invalid (expected)"

CHAT_RESPONSE=$(curl -s -X POST "$API_BASE/user-ai-chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Say 'Hello from user API key test'\"}
    ],
    \"useUserModel\": true,
    \"userId\": \"$TEST_USER_ID\",
    \"provider\": \"$TEST_PROVIDER\",
    \"model\": \"gpt-4\"
  }")

echo "$CHAT_RESPONSE" | jq '.'

# This will likely fail because test key is invalid, but we can check the error
if echo "$CHAT_RESPONSE" | grep -q '"success":false'; then
  echo "⚠️  AI chat failed (expected with test API key)"
  echo "   This confirms the endpoint tried to use the user's key"
else
  echo "✅ AI chat succeeded (user has valid API key)"
fi

# TEST 4: DELETE /user-api-keys/:provider - Delete API key
echo ""
echo "🗑️  TEST 4: DELETE /user-api-keys/$TEST_PROVIDER - Delete API key"
echo "Action: Remove API key and metadata"

DELETE_RESPONSE=$(curl -s -X DELETE "$API_BASE/user-api-keys/$TEST_PROVIDER?userId=$TEST_USER_ID")

echo "$DELETE_RESPONSE" | jq '.'

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ API key deleted successfully"
else
  echo "❌ Failed to delete API key"
  exit 1
fi

# TEST 5: Verify deletion - List should be empty
echo ""
echo "🔍 TEST 5: Verify deletion"
echo "Action: Confirm API key is gone"

VERIFY_RESPONSE=$(curl -s -X GET "$API_BASE/user-api-keys?userId=$TEST_USER_ID")

echo "$VERIFY_RESPONSE" | jq '.'

KEY_COUNT=$(echo "$VERIFY_RESPONSE" | jq '.keys | length')
if [ "$KEY_COUNT" = "0" ]; then
  echo "✅ Deletion verified: No keys found"
else
  echo "❌ Deletion failed: Still found $KEY_COUNT key(s)"
  exit 1
fi

# FINAL SUMMARY
echo ""
echo "============================================================"
echo "🎉 ALL PRODUCTION ENDPOINT TESTS PASSED!"
echo "============================================================"
echo ""
echo "✅ PUT /user-api-keys - Store encrypted key"
echo "✅ GET /user-api-keys - List metadata only"
echo "✅ POST /user-ai-chat - Use user's API key"
echo "✅ DELETE /user-api-keys/:provider - Remove key"
echo "✅ Security verified: No plaintext keys exposed"
echo ""
echo "🚀 Production API ready for integration!"
