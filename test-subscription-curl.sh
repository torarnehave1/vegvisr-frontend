#!/bin/bash

# Subscription Worker CURL Test Script
# This script tests the subscription worker with fictive email addresses

echo "🧪 Testing Subscription Worker with CURL"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="https://subscription-worker.torarnehave.workers.dev"

# Test email
TEST_EMAIL="alice.test@example.com"

echo -e "${BLUE}Using test email: $TEST_EMAIL${NC}"
echo ""

# Function to make HTTP request and show response
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "Request: $method $endpoint"
    if [ ! -z "$data" ]; then
        echo "Data: $data"
    fi
    echo "Response:"
    
    if [ -z "$data" ]; then
        curl -s -w "\nHTTP Status: %{http_code}\n" \
             -X "$method" \
             "$BASE_URL$endpoint"
    else
        curl -s -w "\nHTTP Status: %{http_code}\n" \
             -X "$method" \
             -H "Content-Type: application/json" \
             -d "$data" \
             "$BASE_URL$endpoint"
    fi
    
    echo ""
    echo "---"
    echo ""
}

# Test 1: Subscribe to a meta area (ALIVENESSLAB)
echo -e "${GREEN}Test 1: Subscribe to ALIVENESSLAB meta area${NC}"
make_request "POST" "/subscribe" \
    '{"email":"'$TEST_EMAIL'","subscription_type":"meta_area","target_id":"ALIVENESSLAB","target_title":"Aliveness Lab Updates"}' \
    "Subscribe to meta area"

# Test 2: Subscribe to category
echo -e "${GREEN}Test 2: Subscribe to NORSEMYTHOLOGY category${NC}"
make_request "POST" "/subscribe" \
    '{"email":"'$TEST_EMAIL'","subscription_type":"category","target_id":"NORSEMYTHOLOGY","target_title":"Norse Mythology Content"}' \
    "Subscribe to category"

# Test 3: Subscribe to system events
echo -e "${GREEN}Test 3: Subscribe to system events${NC}"
make_request "POST" "/subscribe" \
    '{"email":"'$TEST_EMAIL'","subscription_type":"system_events","target_id":"global","target_title":"System Events"}' \
    "Subscribe to system events"

# Test 4: Subscribe to all content
echo -e "${GREEN}Test 4: Subscribe to all content${NC}"
make_request "POST" "/subscribe" \
    '{"email":"'$TEST_EMAIL'","subscription_type":"all_content","target_id":"global","target_title":"All Content Updates"}' \
    "Subscribe to all content"

# Test 5: List all subscriptions for the user
echo -e "${GREEN}Test 5: List subscriptions${NC}"
make_request "GET" "/list-subscriptions?email=$TEST_EMAIL" \
    "" \
    "List all subscriptions for user"

# Test 6: Verify specific subscription
echo -e "${GREEN}Test 6: Verify ALIVENESSLAB subscription${NC}"
make_request "GET" "/verify-subscription?email=$TEST_EMAIL&subscription_type=meta_area&target_id=ALIVENESSLAB" \
    "" \
    "Verify specific subscription"

# Test 7: Test invalid subscription type
echo -e "${GREEN}Test 7: Test invalid subscription type${NC}"
make_request "POST" "/subscribe" \
    '{"email":"'$TEST_EMAIL'","subscription_type":"invalid_type","target_id":"test","target_title":"Test"}' \
    "Test invalid subscription type (should fail)"

# Test 8: Test missing required fields
echo -e "${GREEN}Test 8: Test missing required fields${NC}"
make_request "POST" "/subscribe" \
    '{"email":"'$TEST_EMAIL'","subscription_type":"meta_area"}' \
    "Test missing target_id (should fail)"

# Test 9: Health check
echo -e "${GREEN}Test 9: Health check${NC}"
make_request "GET" "/health" \
    "" \
    "Worker health check"

# Test 10: Different email for comparison
OTHER_EMAIL="bob.test@example.com"
echo -e "${GREEN}Test 10: Subscribe different user${NC}"
make_request "POST" "/subscribe" \
    '{"email":"'$OTHER_EMAIL'","subscription_type":"meta_area","target_id":"TECHNOLOGY","target_title":"Technology Updates"}' \
    "Subscribe different email to TECHNOLOGY"

echo -e "${BLUE}====================${NC}"
echo -e "${BLUE}Test Suite Complete!${NC}"
echo -e "${BLUE}====================${NC}"
echo ""
echo "Summary of tests performed:"
echo "✅ Subscribe to meta area (ALIVENESSLAB)"
echo "✅ Subscribe to category (NORSEMYTHOLOGY)" 
echo "✅ Subscribe to system events"
echo "✅ Subscribe to all content"
echo "✅ List subscriptions"
echo "✅ Verify specific subscription"
echo "✅ Test invalid subscription type"
echo "✅ Test missing required fields"
echo "✅ Health check"
echo "✅ Subscribe different user"
echo ""
echo "Valid subscription types:"
echo "  • category"
echo "  • meta_area" 
echo "  • system_events"
echo "  • all_content"
echo "  • user_activity"
echo ""
echo "To run this test: chmod +x test-subscription-curl.sh && ./test-subscription-curl.sh"
