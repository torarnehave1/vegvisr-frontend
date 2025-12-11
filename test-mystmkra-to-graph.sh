#!/bin/bash

# Test script for MystMkra to Knowledge Graph conversion
# This demonstrates the conversion flow from a MystMkra document to a Knowledge Graph

echo "========================================="
echo "MystMkra → Knowledge Graph Test"
echo "========================================="
echo ""

# Configuration
WORKER_URL="https://mystmkra-worker.torarnehave.workers.dev"
USER_EMAIL="test@vegvisr.org"
GENERATE_AI_METADATA=true

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Step 1: Fetching available documents..."
echo "----------------------------------------"

# Get first few documents
DOCS_RESPONSE=$(curl -s "${WORKER_URL}/files?limit=3")
echo "$DOCS_RESPONSE" | jq '.documents[] | {id, title, preview: (.content | .[0:100])}'

# Extract first document ID
DOC_ID=$(echo "$DOCS_RESPONSE" | jq -r '.documents[0].id')

if [ -z "$DOC_ID" ] || [ "$DOC_ID" = "null" ]; then
  echo -e "${RED}✗ No documents found${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✓ Found document: $DOC_ID${NC}"
echo ""

echo "Step 2: Converting document to Knowledge Graph..."
echo "----------------------------------------"
echo "Document ID: $DOC_ID"
echo "User Email: $USER_EMAIL"
echo "AI Metadata: $GENERATE_AI_METADATA"
echo ""

# Convert to graph
CONVERT_RESPONSE=$(curl -s -X POST "${WORKER_URL}/convert-to-graph" \
  -H "Content-Type: application/json" \
  -d "{
    \"documentId\": \"$DOC_ID\",
    \"userEmail\": \"$USER_EMAIL\",
    \"generateAIMetadata\": $GENERATE_AI_METADATA
  }")

# Check success
SUCCESS=$(echo "$CONVERT_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓ Conversion successful!${NC}"
  echo ""
  echo "Results:"
  echo "----------------------------------------"
  
  GRAPH_ID=$(echo "$CONVERT_RESPONSE" | jq -r '.graphId')
  TITLE=$(echo "$CONVERT_RESPONSE" | jq -r '.metadata.title')
  DESCRIPTION=$(echo "$CONVERT_RESPONSE" | jq -r '.metadata.description')
  CATEGORY=$(echo "$CONVERT_RESPONSE" | jq -r '.metadata.category')
  VIEW_URL=$(echo "$CONVERT_RESPONSE" | jq -r '.viewUrl')
  EDIT_URL=$(echo "$CONVERT_RESPONSE" | jq -r '.editUrl')
  
  echo "Graph ID: $GRAPH_ID"
  echo "Title: $TITLE"
  echo "Description: $DESCRIPTION"
  echo "Category: $CATEGORY"
  echo ""
  echo "URLs:"
  echo "  View: $VIEW_URL"
  echo "  Edit: $EDIT_URL"
  echo ""
  
  echo -e "${YELLOW}Open in browser:${NC}"
  echo "  open '$VIEW_URL'"
  
else
  ERROR=$(echo "$CONVERT_RESPONSE" | jq -r '.error')
  echo -e "${RED}✗ Conversion failed: $ERROR${NC}"
  echo ""
  echo "Full response:"
  echo "$CONVERT_RESPONSE" | jq '.'
  exit 1
fi

echo ""
echo "========================================="
echo "Test Complete!"
echo "========================================="
