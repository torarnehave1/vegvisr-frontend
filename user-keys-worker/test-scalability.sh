#!/bin/bash

# Test user-keys-worker scalability with multiple users
# This script creates, lists, and deletes API keys for 10 test users

API_URL="https://user-keys-worker.torarnehave.workers.dev"
PROVIDERS=("anthropic" "openai" "google" "grok")
NUM_USERS=10

echo "=== Testing user-keys-worker scalability ==="
echo "API URL: $API_URL"
echo "Number of test users: $NUM_USERS"
echo "Providers: ${PROVIDERS[@]}"
echo ""

# Store keys for multiple users
echo "📝 Storing API keys for $NUM_USERS users..."
for i in $(seq 1 $NUM_USERS); do
  userId="test-user-$i"
  for provider in "${PROVIDERS[@]}"; do
    echo "  - Storing $provider key for $userId"
    
    curl -s -X PUT "$API_URL/user-api-keys" \
      -H "Content-Type: application/json" \
      -d "{
        \"userId\": \"$userId\",
        \"provider\": \"$provider\",
        \"apiKey\": \"sk-test-$provider-key-$i\",
        \"metadata\": {\"keyName\": \"Test $provider Key #$i\"}
      }" | jq -r '.success // "ERROR"'
  done
done

echo ""
echo "✅ Stored keys for $NUM_USERS users across ${#PROVIDERS[@]} providers"
echo ""

# List keys for random users
echo "📋 Listing keys for sample users..."
for i in 1 3 5 7 10; do
  userId="test-user-$i"
  echo "  - User: $userId"
  
  response=$(curl -s "$API_URL/user-api-keys?userId=$userId")
  count=$(echo "$response" | jq -r '.count')
  echo "    Keys: $count"
  echo "$response" | jq -r '.keys[] | "    - \(.provider): \(.keyName)"'
  echo ""
done

# Delete all test keys
echo "🗑️  Deleting all test keys..."
for i in $(seq 1 $NUM_USERS); do
  userId="test-user-$i"
  for provider in "${PROVIDERS[@]}"; do
    echo "  - Deleting $provider key for $userId"
    
    curl -s -X DELETE "$API_URL/user-api-keys/$provider?userId=$userId" \
      | jq -r '.success // "ERROR"'
  done
done

echo ""
echo "✅ Deleted all test keys"
echo ""

# Verify cleanup
echo "🔍 Verifying cleanup..."
userId="test-user-1"
response=$(curl -s "$API_URL/user-api-keys?userId=$userId")
count=$(echo "$response" | jq -r '.count')

if [ "$count" = "0" ]; then
  echo "✅ Cleanup successful - no keys remaining"
else
  echo "⚠️  Warning: $count keys still present"
fi

echo ""
echo "=== Scalability test complete ==="
echo "Total operations: $((NUM_USERS * ${#PROVIDERS[@]} * 2)) (store + delete)"
