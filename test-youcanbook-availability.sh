#!/bin/bash

# Test YouCanBook.me Availability API
# This checks available time slots for booking

echo "Testing YouCanBook.me Availability API..."
echo ""

curl -X POST 'https://api.vegvisr.org/api/youcanbook/availability' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Token: dvdte4d5678hbgf789jkloa221_lasdg' \
  -d '{
    "subdomain": "torarnehave",
    "timeZone": "Europe/Oslo"
  }' | jq '.'
