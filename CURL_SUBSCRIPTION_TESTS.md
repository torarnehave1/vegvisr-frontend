# Quick CURL Commands for Subscription Worker Testing

## Basic Subscribe Command (Copy & Paste Ready)

### Subscribe to ALIVENESSLAB Meta Area
```bash
curl -X POST https://subscription-worker.torarnehave.workers.dev/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"alice.test@example.com","subscription_type":"meta_area","target_id":"ALIVENESSLAB","target_title":"Aliveness Lab Updates"}'
```

### Subscribe to TECHNOLOGY Category  
```bash
curl -X POST https://subscription-worker.torarnehave.workers.dev/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"alice.test@example.com","subscription_type":"category","target_id":"TECHNOLOGY","target_title":"Technology Content"}'
```

### Subscribe to System Events
```bash
curl -X POST https://subscription-worker.torarnehave.workers.dev/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"alice.test@example.com","subscription_type":"system_events","target_id":"global","target_title":"System Events"}'
```

### Subscribe to All Content
```bash
curl -X POST https://subscription-worker.torarnehave.workers.dev/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"alice.test@example.com","subscription_type":"all_content","target_id":"global","target_title":"All Content Updates"}'
```

## Management Commands

### List All Subscriptions for User
```bash
curl "https://subscription-worker.torarnehave.workers.dev/list-subscriptions?email=alice.test@example.com"
```

### Verify Specific Subscription
```bash
curl "https://subscription-worker.torarnehave.workers.dev/verify-subscription?email=alice.test@example.com&subscription_type=meta_area&target_id=ALIVENESSLAB"
```

### Health Check
```bash
curl "https://subscription-worker.torarnehave.workers.dev/health"
```

## Error Testing

### Invalid Subscription Type (Should Fail)
```bash
curl -X POST https://subscription-worker.torarnehave.workers.dev/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"alice.test@example.com","subscription_type":"invalid_type","target_id":"test","target_title":"Test"}'
```

### Missing Required Fields (Should Fail)
```bash
curl -X POST https://subscription-worker.torarnehave.workers.dev/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"alice.test@example.com","subscription_type":"meta_area"}'
```

## Valid Subscription Types
- `category` - Content category subscriptions
- `meta_area` - Meta area subscriptions (ALIVENESSLAB, TECHNOLOGY, etc.)
- `system_events` - System notifications  
- `all_content` - All platform content
- `user_activity` - User activity notifications

## Expected Response Format
**Success Response:**
```json
{
  "success": true,
  "subscription_id": "uuid-here",
  "unsubscribe_token": "token-here",
  "message": "Subscription created successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Quick Test Commands

### One-liner test with response formatting:
```bash
curl -X POST https://subscription-worker.torarnehave.workers.dev/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"quicktest@example.com","subscription_type":"meta_area","target_id":"ALIVENESSLAB","target_title":"Quick Test"}' \
  | jq '.'
```

### Test with verbose output:
```bash
curl -v -X POST https://subscription-worker.torarnehave.workers.dev/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"verbose@example.com","subscription_type":"meta_area","target_id":"ALIVENESSLAB","target_title":"Verbose Test"}'
```

## Running the Full Test Suite
```bash
./test-subscription-curl.sh
```
