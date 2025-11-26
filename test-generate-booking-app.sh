#!/bin/bash

# Test /generate-app endpoint with YouCanBook.me Availability API
# This will create a booking availability checker app

curl -X POST 'https://api.vegvisr.org/generate-app' \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Create a booking availability checker. Show available time slots for the next 7 days in Europe/Oslo timezone. Display slots in a nice grid with dates and times. When user clicks a slot, open the booking page.",
    "enabledAPIs": ["youcanbook-availability"],
    "enabledComponents": [],
    "userId": "test-user",
    "aiModel": "grok"
  }' | jq '.'
