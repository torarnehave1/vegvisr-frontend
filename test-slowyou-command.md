# Test Slowyou.io API Command

## Test Slowyou.io Registration Endpoint

```bash
curl -X POST "https://slowyou.io/api/reg-user-vegvisr?email=alivenesslab.org@gmail.com&role=subscriber" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_API_KEY_HERE"
```

## What This Tests

This command tests the slowyou.io API endpoint that the main-worker calls to send invitation emails. The error "error code: 1042" suggests slowyou.io is returning an error response.

## Expected Results

- **Success**: Should return a JSON response indicating the email was sent
- **Error**: Will show the actual error from slowyou.io (like "error code: 1042")

## API Token Source

The API token `YOUR_API_KEY_HERE` should be replaced with the actual token from `main-worker/wrangler.toml` in the `[vars]` section.
