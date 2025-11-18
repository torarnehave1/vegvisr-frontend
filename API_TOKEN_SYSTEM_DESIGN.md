# API Token System Design

## Overview
Create a dedicated API token management system for public APIs with proper authentication, rate limiting, and usage tracking.

## Database Schema

### Table: `api_tokens`
```sql
CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL,                  -- Reference to users table
  token TEXT UNIQUE NOT NULL,             -- The actual API token (hashed)
  token_name TEXT NOT NULL,               -- User-friendly name (e.g., "My App Token")
  token_prefix TEXT NOT NULL,             -- First 8 chars for display (e.g., "vv_12345...")
  scopes TEXT NOT NULL,                   -- JSON array of allowed scopes
  rate_limit INTEGER DEFAULT 1000,        -- Requests per hour
  expires_at TEXT,                        -- NULL for never expires
  last_used_at TEXT,                      -- Track last usage
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  metadata TEXT                           -- JSON for additional data
);

CREATE INDEX idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX idx_api_tokens_token ON api_tokens(token);
CREATE INDEX idx_api_tokens_is_active ON api_tokens(is_active);
```

### Table: `api_token_usage`
```sql
CREATE TABLE api_token_usage (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (token_id) REFERENCES api_tokens(id)
);

CREATE INDEX idx_api_token_usage_token_id ON api_token_usage(token_id);
CREATE INDEX idx_api_token_usage_created_at ON api_token_usage(created_at);
CREATE INDEX idx_api_token_usage_user_id ON api_token_usage(user_id);
```

## Token Scopes

### Available Scopes:
- `ai:chat` - Access to AI chat endpoints
- `graph:read` - Read knowledge graphs
- `graph:write` - Create/update knowledge graphs
- `node:create` - Create nodes
- `node:update` - Update nodes
- `node:delete` - Delete nodes
- `template:read` - Read templates
- `template:write` - Create templates
- `admin:all` - Full admin access

## Token Format

### Generation:
```
Format: vv_[environment]_[random_32_chars]
Example: vv_prod_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

- vv: Vegvisr prefix
- prod/dev/test: Environment
- 32 chars: Cryptographically secure random string
```

### Display:
```
Show only: vv_prod_a1b2c3d4...
Full token shown only once during creation
```

## API Endpoints

### 1. Create Token
```
POST /api/tokens/create
Headers: 
  - Authorization: Bearer <user_session_token>
Body:
{
  "name": "My App Token",
  "scopes": ["ai:chat", "node:create"],
  "expiresIn": 2592000,  // seconds (30 days), null for never
  "rateLimit": 1000
}

Response:
{
  "success": true,
  "token": {
    "id": "uuid",
    "name": "My App Token",
    "token": "vv_prod_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",  // Only shown once!
    "prefix": "vv_prod_a1b2c3d4",
    "scopes": ["ai:chat", "node:create"],
    "rateLimit": 1000,
    "expiresAt": "2025-12-18T10:30:00Z",
    "createdAt": "2025-11-18T10:30:00Z"
  },
  "warning": "Save this token now. You won't be able to see it again!"
}
```

### 2. List Tokens
```
GET /api/tokens/list
Headers: 
  - Authorization: Bearer <user_session_token>

Response:
{
  "success": true,
  "tokens": [
    {
      "id": "uuid",
      "name": "My App Token",
      "prefix": "vv_prod_a1b2c3d4",
      "scopes": ["ai:chat", "node:create"],
      "rateLimit": 1000,
      "isActive": true,
      "lastUsedAt": "2025-11-18T09:15:00Z",
      "expiresAt": "2025-12-18T10:30:00Z",
      "createdAt": "2025-11-18T10:30:00Z",
      "usageCount": 1250
    }
  ]
}
```

### 3. Revoke Token
```
DELETE /api/tokens/:tokenId
Headers: 
  - Authorization: Bearer <user_session_token>

Response:
{
  "success": true,
  "message": "Token revoked successfully"
}
```

### 4. Update Token
```
PATCH /api/tokens/:tokenId
Headers: 
  - Authorization: Bearer <user_session_token>
Body:
{
  "name": "Updated Name",
  "isActive": false,
  "rateLimit": 2000
}

Response:
{
  "success": true,
  "token": { ... }
}
```

### 5. Token Usage Stats
```
GET /api/tokens/:tokenId/usage
Headers: 
  - Authorization: Bearer <user_session_token>
Query:
  - startDate: ISO date
  - endDate: ISO date
  - limit: number

Response:
{
  "success": true,
  "stats": {
    "totalRequests": 1250,
    "successfulRequests": 1200,
    "failedRequests": 50,
    "averageResponseTime": 125,
    "requestsByEndpoint": {
      "/user-ai-chat": 800,
      "/addNode": 450
    },
    "requestsByDay": [
      { "date": "2025-11-18", "count": 150 },
      { "date": "2025-11-17", "count": 200 }
    ]
  },
  "recentUsage": [
    {
      "endpoint": "/user-ai-chat",
      "method": "POST",
      "statusCode": 200,
      "responseTime": 125,
      "timestamp": "2025-11-18T10:30:00Z"
    }
  ]
}
```

## Token Validation Middleware

### Worker Implementation:
```javascript
async function validateApiToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer vv_')) {
    return {
      valid: false,
      error: 'Invalid or missing API token'
    };
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  // Hash the token for lookup
  const tokenHash = await hashToken(token);
  
  // Look up token in database
  const query = `
    SELECT * FROM api_tokens 
    WHERE token = ? 
    AND is_active = 1 
    AND (expires_at IS NULL OR expires_at > datetime('now'))
  `;
  
  const tokenRecord = await env.vegvisr_org
    .prepare(query)
    .bind(tokenHash)
    .first();
  
  if (!tokenRecord) {
    return {
      valid: false,
      error: 'Invalid or expired token'
    };
  }
  
  // Check rate limit
  const rateLimitOk = await checkRateLimit(tokenRecord.id, tokenRecord.rate_limit, env);
  
  if (!rateLimitOk) {
    return {
      valid: false,
      error: 'Rate limit exceeded'
    };
  }
  
  // Update last used timestamp
  await env.vegvisr_org
    .prepare('UPDATE api_tokens SET last_used_at = datetime("now") WHERE id = ?')
    .bind(tokenRecord.id)
    .run();
  
  return {
    valid: true,
    tokenId: tokenRecord.id,
    userId: tokenRecord.user_id,
    scopes: JSON.parse(tokenRecord.scopes)
  };
}

async function checkRateLimit(tokenId, limit, env) {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  
  const query = `
    SELECT COUNT(*) as count 
    FROM api_token_usage 
    WHERE token_id = ? 
    AND created_at > ?
  `;
  
  const result = await env.vegvisr_org
    .prepare(query)
    .bind(tokenId, oneHourAgo)
    .first();
  
  return result.count < limit;
}

async function logTokenUsage(tokenId, userId, endpoint, method, statusCode, responseTime, request, env) {
  const query = `
    INSERT INTO api_token_usage (
      id, token_id, user_id, endpoint, method, 
      status_code, response_time_ms, ip_address, 
      user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `;
  
  await env.vegvisr_org
    .prepare(query)
    .bind(
      crypto.randomUUID(),
      tokenId,
      userId,
      endpoint,
      method,
      statusCode,
      responseTime,
      request.headers.get('CF-Connecting-IP'),
      request.headers.get('User-Agent')
    )
    .run();
}
```

## Frontend UI Components

### Token Management Dashboard
```vue
<template>
  <div class="api-tokens-dashboard">
    <div class="header">
      <h2>API Tokens</h2>
      <button @click="showCreateModal = true" class="btn btn-primary">
        <i class="bi bi-plus-circle"></i> Create New Token
      </button>
    </div>
    
    <div class="tokens-list">
      <div v-for="token in tokens" :key="token.id" class="token-card">
        <div class="token-header">
          <h3>{{ token.name }}</h3>
          <span class="token-status" :class="{ active: token.isActive }">
            {{ token.isActive ? 'Active' : 'Inactive' }}
          </span>
        </div>
        
        <div class="token-details">
          <div class="token-prefix">
            <code>{{ token.prefix }}...</code>
          </div>
          
          <div class="token-meta">
            <span><i class="bi bi-calendar"></i> Created: {{ formatDate(token.createdAt) }}</span>
            <span><i class="bi bi-clock"></i> Last used: {{ formatDate(token.lastUsedAt) }}</span>
            <span><i class="bi bi-speedometer"></i> Rate limit: {{ token.rateLimit }}/hour</span>
          </div>
          
          <div class="token-scopes">
            <span v-for="scope in token.scopes" :key="scope" class="scope-badge">
              {{ scope }}
            </span>
          </div>
          
          <div class="token-usage">
            <div class="usage-bar">
              <div 
                class="usage-fill" 
                :style="{ width: (token.usageCount / token.rateLimit * 100) + '%' }"
              ></div>
            </div>
            <span>{{ token.usageCount }} / {{ token.rateLimit }} requests</span>
          </div>
        </div>
        
        <div class="token-actions">
          <button @click="viewUsage(token)" class="btn btn-sm btn-info">
            <i class="bi bi-graph-up"></i> Usage
          </button>
          <button @click="editToken(token)" class="btn btn-sm btn-secondary">
            <i class="bi bi-pencil"></i> Edit
          </button>
          <button @click="revokeToken(token)" class="btn btn-sm btn-danger">
            <i class="bi bi-trash"></i> Revoke
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

## Security Considerations

### 1. Token Storage
- Store hashed tokens in database (use SHA-256)
- Never log full tokens
- Show full token only once during creation

### 2. Rate Limiting
- Per-token rate limits
- Global user rate limits
- Exponential backoff for violations

### 3. Scope Validation
- Check scopes on every request
- Fail closed (deny by default)
- Audit scope changes

### 4. Token Rotation
- Allow users to rotate tokens
- Support grace period during rotation
- Notify on suspicious activity

### 5. Monitoring
- Alert on unusual usage patterns
- Track failed authentication attempts
- Log all token operations

## Migration Plan

### Phase 1: Database Setup
1. Create tables in D1
2. Add indexes
3. Test migrations

### Phase 2: Backend Implementation
1. Create token generation service
2. Implement validation middleware
3. Add CRUD endpoints
4. Add usage logging

### Phase 3: Frontend UI
1. Create token management dashboard
2. Add token creation modal
3. Add usage statistics view
4. Add revocation flow

### Phase 4: Migration
1. Migrate existing emailVerificationToken users (optional)
2. Update documentation
3. Notify users of new system
4. Deprecate old auth method (with grace period)

### Phase 5: Launch
1. Enable for all users
2. Monitor usage
3. Gather feedback
4. Iterate

## Benefits

### For Users:
- ✅ Multiple tokens for different apps
- ✅ Fine-grained permissions (scopes)
- ✅ Usage tracking and analytics
- ✅ Easy token rotation
- ✅ Better security

### For Platform:
- ✅ Better rate limiting
- ✅ Usage analytics
- ✅ Easier to identify abuse
- ✅ Cleaner architecture
- ✅ Monetization ready (usage-based billing)

## Future Enhancements

1. **Webhooks**: Notify on token events
2. **IP Whitelisting**: Restrict tokens to specific IPs
3. **Team Tokens**: Share tokens across team members
4. **Usage Alerts**: Notify when approaching limits
5. **Token Marketplace**: Allow selling API access
6. **Automatic Rotation**: Scheduled token rotation
7. **Audit Logs**: Detailed security audit trail
