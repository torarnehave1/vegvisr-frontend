#!/bin/bash

echo "Testing Anthropic Worker..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
WORKER_URL="http://localhost:8787"  # Change after deployment
API_KEY="your-anthropic-api-key-here"

echo ""
echo "1. Testing health check..."
curl -s "$WORKER_URL/health" | jq '.'

echo ""
echo "2. Testing models endpoint..."
curl -s "$WORKER_URL/models" | jq '.'

echo ""
echo "3. Testing simple message..."
curl -s -X POST "$WORKER_URL/message" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Say hello in one sentence\",
    \"model\": \"claude-3-5-sonnet-20241022\",
    \"max_tokens\": 100,
    \"apiKey\": \"$API_KEY\"
  }" | jq '.'

echo ""
echo "4. Testing chat with conversation..."
curl -s -X POST "$WORKER_URL/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"messages\": [
      {\"role\": \"user\", \"content\": \"What is 2+2?\"}
    ],
    \"model\": \"claude-3-5-sonnet-20241022\",
    \"max_tokens\": 100,
    \"apiKey\": \"$API_KEY\"
  }" | jq '.'

echo ""
echo -e "${GREEN}Tests complete!${NC}"
