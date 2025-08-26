# Password Worker

A Cloudflare Worker for handling Knowledge Graph password protection.

## Features

- ✅ Password protection for Knowledge Graphs
- ✅ Secure bcrypt password hashing  
- ✅ Session token management
- ✅ Admin password management
- ✅ D1 database integration
- ✅ CORS support
- ✅ Demo graphs for testing

## Endpoints

### Check Password Requirement
```
GET /checkpassword?id={graphId}
```
**Response:**
```json
{
  "passwordRequired": true|false,
  "graphId": "string"
}
```

### Verify Password
```
POST /verifypassword
Content-Type: application/json

{
  "graphId": "string",
  "password": "string"
}
```
**Response:**
```json
{
  "verified": true|false,
  "token": "session-token-if-verified",
  "message": "string",
  "expiresIn": "24 hours"
}
```

### Set Password (Admin)
```
POST /setpassword
Content-Type: application/json

{
  "graphId": "string", 
  "password": "string",
  "adminKey": "admin-secret-key"
}
```

### Remove Password (Admin)
```
POST /removepassword
Content-Type: application/json

{
  "graphId": "string",
  "adminKey": "admin-secret-key"
}
```

### Validate Token
```
POST /validatetoken
Content-Type: application/json

{
  "token": "session-token",
  "graphId": "string"
}
```

### List Protected Graphs (Admin)
```
GET /listprotected?adminKey={admin-key}
```

### Health Check
```
GET /health
```

## Setup Instructions

### 1. Create D1 Database
```bash
# Create the D1 database
wrangler d1 create vegvisr_passwords

# Note the database ID from the output and update wrangler.toml
```

### 2. Run Database Migration
```bash
# Execute the schema
wrangler d1 execute vegvisr_passwords --file=schema.sql
```

### 3. Set Environment Variables
```bash
# Set the admin key (use a strong, random key)
wrangler secret put ADMIN_KEY
# Enter your secure admin key when prompted
```

### 4. Update wrangler.toml
Update the `database_id` in `wrangler.toml` with your actual D1 database ID.

### 5. Deploy
```bash
# Install dependencies
npm install

# Deploy to Cloudflare
wrangler deploy
```

## Testing

### Demo Graphs
The worker includes two demo protected graphs:
- `demo-protected` (password: `demo123`)
- `private-graph-123` (password: `secret456`)

### Test Commands
```bash
# Check if graph requires password
curl "https://your-worker.workers.dev/checkpassword?id=demo-protected"

# Verify password
curl -X POST "https://your-worker.workers.dev/verifypassword" \
  -H "Content-Type: application/json" \
  -d '{"graphId": "demo-protected", "password": "demo123"}'

# Set new password (admin)
curl -X POST "https://your-worker.workers.dev/setpassword" \
  -H "Content-Type: application/json" \
  -d '{"graphId": "my-graph", "password": "newpassword", "adminKey": "your-admin-key"}'
```

## Frontend Integration

Update the API endpoints in your GNewViewer.vue:

```javascript
// Replace these URLs with your deployed worker domain
const passwordRequired = await checkPasswordRequired(graphId)
// becomes:
const response = await fetch(`https://your-password-worker.workers.dev/checkpassword?id=${graphId}`)

const verified = await verifyPassword()
// becomes:
const response = await fetch('https://your-password-worker.workers.dev/verifypassword', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ graphId, password })
})
```

## Security Features

- **bcrypt Hashing**: Passwords stored as secure hashes with salt rounds 12
- **Session Tokens**: Temporary tokens valid for 24 hours
- **Admin Protection**: Password management requires admin key
- **Input Validation**: Comprehensive validation of all inputs
- **Error Handling**: Secure error responses without information leakage

## Development

```bash
# Run locally
npm run dev

# Deploy
npm run deploy
```

## Environment Variables

| Variable | Type | Description |
|----------|------|-------------|
| `ADMIN_KEY` | Secret | Admin authentication key |
| `DB` | D1 Binding | Database for password storage |

## Database Schema

```sql
CREATE TABLE graph_passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    graph_id TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    notes TEXT
);
```

## Production Considerations

1. **Use Strong Admin Key**: Generate a cryptographically secure admin key
2. **Monitor Usage**: Set up logging and monitoring
3. **Rate Limiting**: Consider adding rate limiting for password attempts
4. **Backup Database**: Regular backups of the D1 database
5. **Audit Logging**: Log password changes and access attempts

## Troubleshooting

### Common Issues

1. **Database not found**: Ensure D1 database is created and ID is correct in wrangler.toml
2. **Admin key errors**: Verify admin key is set correctly with `wrangler secret list`
3. **CORS errors**: Worker includes CORS headers, ensure frontend uses correct domain

### Logs
```bash
# View worker logs
wrangler tail

# View D1 database
wrangler d1 execute vegvisr_passwords --command="SELECT * FROM graph_passwords"
```

## License

MIT License - See LICENSE file for details.
