# Deployment Guide

## Frontend Deployment Setup

This guide explains how to deploy the Vegvisr frontend application to Cloudflare Workers.

### Prerequisites

- Node.js (>= 20.11.1)
- npm
- Cloudflare account with Workers enabled
- Wrangler CLI (included in dependencies)

### Configuration

The deployment is configured via `wrangler.toml` in the root directory:

```toml
name = "vegvisr-frontend"
compatibility_date = "2025-01-13"

[assets]
directory = "./dist"

# Optional: Environment-specific configuration
[env.preview]
name = "vegvisr-frontend-preview"

[env.preview.assets]
directory = "./dist"
```

### Deployment Commands

#### Production Deployment
```bash
npm run deploy
```

#### Preview Deployment
```bash
npm run deploy:preview
```

#### Manual Deployment
```bash
# Build the application
npm run build

# Deploy to production
npx wrangler deploy --env=

# Deploy to preview
npx wrangler deploy --env preview
```

### Troubleshooting

#### Common Issues

1. **Missing entry-point error**: Ensure `wrangler.toml` exists with correct assets configuration
2. **Build failures**: Run `npm install` to ensure dependencies are installed
3. **Authentication issues**: Run `npx wrangler login` to authenticate with Cloudflare

#### Build Output

The build process generates:
- Static HTML, CSS, and JS files in `dist/` directory
- Optimized assets with content hashing
- Gzipped assets for faster loading

#### File Structure After Build
```
dist/
├── index.html
├── assets/
│   ├── *.js files
│   ├── *.css files
│   └── font files
├── images/
├── docs/
└── other static files
```

### Environment Variables

If your application requires environment variables, add them to your Cloudflare Workers environment:

```bash
npx wrangler secret put VARIABLE_NAME
```

### Performance Optimization

The build includes several optimizations:
- Code splitting for better load times
- Asset compression
- Tree shaking to remove unused code
- Minification of all assets

### Monitoring

Monitor your deployment at:
- Production: `https://vegvisr-frontend.your-domain.workers.dev`
- Preview: `https://vegvisr-frontend-preview.your-domain.workers.dev`

### Support

For issues with:
- Build process: Check Vite configuration in `vite.config.js`
- Deployment: Check Wrangler configuration in `wrangler.toml`
- Dependencies: Run `npm audit` to check for vulnerabilities