#!/bin/bash

# Test YouCanBook.me API directly
# Replace YOUR_API_KEY with actual value

ACCOUNT_ID="73263f2b-cae9-45e7-b994-290128c126b7"
API_KEY="ak_kRrsK28WjtJGmKnTAG9m7eEnxsaSp5CVDgocCn4WUApa6572dU"

echo "Testing YouCanBook.me API..."
echo "Account ID: ${ACCOUNT_ID:0:10}..."
echo ""

curl -v -u "${ACCOUNT_ID}:${API_KEY}" \
  "https://api.youcanbook.me/v1/accounts/${ACCOUNT_ID}/bookings/query?from=2024-01-01T00:00:00Z&direction=forwards&pageSize=20"
