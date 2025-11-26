#!/bin/bash

# Test /generate-app endpoint with Claude Sonnet 4
# Slugs confirmed from database: 'pexels', 'image-analysis'

curl -X POST 'https://api.vegvisr.org/generate-app' \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Create an image analysis app. Show a gallery of images from Pexels search for nature. When user clicks an image, analyze it and show the results.",
    "enabledAPIs": ["pexels", "image-analysis"],
    "enabledComponents": [],
    "userId": "test-user",
    "aiModel": "claude-4"
  }' | jq '.'
