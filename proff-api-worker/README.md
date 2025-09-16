# Proff API Worker

A Cloudflare Worker for professional API services, following the same structure as the api-worker.

## Structure

- `index.js` - Main worker script
- `wrangler.toml` - Cloudflare Worker configuration (git-ignored)

## Development

To run the worker in development mode:

```bash
npm run dev:proff-api-worker
```

This will start the worker on port 8790.

## Configuration

The `wrangler.toml` file needs to be configured with your Cloudflare account details:

```toml
name = "proff-api-worker"

main = "index.js"
account_id = "your-account-id"
workers_dev = true
compatibility_date = "2025-03-13"

[env.production]
route = "https://proff-api.vegvisr.org/*"
zone_id = "your-zone-id"
```

## Endpoints

- `GET /` - Service information
- `GET /health` - Health check

## Deployment

```bash
wrangler deploy --config proff-api-worker/wrangler.toml
```