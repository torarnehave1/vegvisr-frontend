# Test New Slowyou.io Endpoint

## Test the New Custom Email Endpoint

```bash
curl -X POST "https://slowyou.io/api/send-vegvisr-email" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_API_KEY_HERE" -d '{"email":"alivenesslab.org@gmail.com","template":"<html><body><h1>Test Invitation</h1><p>This is a test invitation email from vegvisr.org</p><a href=\"https://www.vegvisr.org/join-room?invitation=test123\">Join Room</a></body></html>","subject":"Test Invitation from Vegvisr","callbackUrl":"https://www.vegvisr.org/join-room?invitation=test123"}'
```

## What This Tests

This command tests the new `/send-vegvisr-email` endpoint that accepts custom templates instead of using the hardcoded templates from `nb.json`.

## Expected Results

- **Success**: Should return `{"message":"Custom email sent successfully."}`
- **Error**: Will show any validation or authentication errors

## Key Differences from Old Endpoint

- **New URL**: `/api/send-vegvisr-email` instead of `/api/reg-user-vegvisr`
- **Custom Template**: Accepts `template` field with HTML content
- **Custom Subject**: Accepts `subject` field
- **No Role Logic**: Doesn't use role-based template selection
- **Same Auth**: Uses same API token authentication
