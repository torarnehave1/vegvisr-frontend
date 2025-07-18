# Subscription Worker

A Cloudflare Worker that handles subscription management for the Vegvisr.org knowledge graph platform. Allows non-registered users to subscribe to updates for specific knowledge graphs, categories, or meta areas.

## Features

- **Subscribe to Knowledge Graphs**: Users can subscribe to specific graphs
- **Subscribe to Categories**: Users can subscribe to all graphs in a category
- **Subscribe to Meta Areas**: Users can subscribe to all graphs in a meta area
- **User Registration**: Automatically registers subscribers as users with "subscriber" role
- **Secure Unsubscribe**: Token-based unsubscribe system
- **External Server Integration**: Notifies external sloyou.io server of subscription events
- **Integrated User System**: Uses existing config table and registration system

## API Endpoints

### POST /subscribe

Subscribe to a knowledge graph, category, or meta area.

**Request Body:**

```json
{
  "email": "user@example.com",
  "subscription_type": "graph|category|meta_area",
  "target_id": "graph_123|category_name|meta_area_name",
  "target_title": "Human-readable title"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Subscription created successfully",
  "subscription_id": "sub_1234567890_abcdef123",
  "unsubscribe_token": "uuid-token-here"
}
```

### POST /unsubscribe

Unsubscribe from notifications.

**Request Body:**

```json
{
  "email": "user@example.com",
  "unsubscribe_token": "uuid-token-here"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Successfully unsubscribed"
}
```

### GET /verify-subscription

Check if an email is subscribed to a specific target.

**Query Parameters:**

- `email`: User email address
- `subscription_type`: Type of subscription (graph, category, meta_area)
- `target_id`: ID of the target

**Response:**

```json
{
  "subscribed": true,
  "subscription": {
    "id": "sub_1234567890_abcdef123",
    "email": "user@example.com",
    "subscription_type": "graph",
    "target_id": "graph_123",
    "target_title": "My Knowledge Graph",
    "created_at": "2025-01-13T10:30:00Z",
    "status": "active"
  }
}
```

### GET /list-subscriptions

List all active subscriptions for an email.

**Query Parameters:**

- `email`: User email address

**Response:**

```json
{
  "subscriptions": [
    {
      "id": "sub_1234567890_abcdef123",
      "subscription_type": "graph",
      "target_id": "graph_123",
      "target_title": "My Knowledge Graph",
      "created_at": "2025-01-13T10:30:00Z",
      "status": "active"
    }
  ]
}
```

### GET /health

Health check endpoint.

**Response:**

```
Subscription Worker is healthy
```

## Database Schema

The worker uses the existing `config` table to store user and subscription data:

```sql
CREATE TABLE config (
  user_id TEXT,
  data TEXT NOT NULL, -- JSON containing subscription data
  profileimage TEXT,
  email TEXT PRIMARY KEY,
  emailVerificationToken TEXT,
  Role TEXT, -- 'subscriber' for subscription users
  bio TEXT
);
```

**Subscription Data Structure (stored in `data` field as JSON):**

```json
{
  "subscriptions": [
    {
      "id": "sub_1234567890_abcdef123",
      "subscription_type": "graph",
      "target_id": "graph_123",
      "target_title": "My Knowledge Graph",
      "status": "active",
      "unsubscribe_token": "uuid-token-here",
      "created_at": "2025-01-13T10:30:00Z",
      "updated_at": "2025-01-13T10:30:00Z"
    }
  ]
}
```

## Deployment

1. **Database Configuration**

   - Uses existing `vegvisr_org` database and `config` table
   - No additional database migrations needed
   - Integrates with existing user registration system

2. **Service Binding Configuration**

   - Configured in `wrangler.toml` with service binding to `main-worker`
   - Enables direct worker-to-worker communication
   - No HTTP overhead for internal communication

3. **Deploy the Worker**

   ```bash
   cd subscription-worker
   wrangler deploy
   ```

4. **Set Up Custom Domain** (if needed)

   - Configure DNS in Cloudflare dashboard
   - Update route in `wrangler.toml`

5. **Dependencies**
   - Requires `main-worker` to be deployed for user registration
   - Uses service binding to communicate with `main-worker`
   - Uses existing `config` table structure

## Service Binding Architecture

This worker uses Cloudflare Workers service bindings to communicate with the main-worker. The `callMainWorker()` helper function abstracts the service binding calls:

```javascript
// Clean, readable service binding call
const response = await callMainWorker(env, '/sve2', {
  email: email,
  role: 'subscriber',
})
```

The service binding is configured in `wrangler.toml`:

```toml
[[services]]
binding = "MAIN_WORKER"
service = "main-worker"
```

This approach provides:

- **Internal routing**: No external HTTP calls needed
- **Better performance**: Direct worker-to-worker communication
- **Clean code**: Readable function calls instead of URL manipulation
- **Type safety**: Proper parameter passing

## External Server Integration

The worker integrates with an external server (sloyou.io) by sending HTTP requests to:

- `POST https://sloyou.io/api/subscription-created` - When a new subscription is created
- `POST https://sloyou.io/api/subscription-cancelled` - When a subscription is cancelled

These calls are made asynchronously and don't affect the main subscription operation if they fail.

## Security Features

- **CORS enabled** for cross-origin requests
- **Token-based unsubscribe** prevents unauthorized unsubscriptions
- **Input validation** for all endpoints
- **Unique constraint** prevents duplicate subscriptions
- **SQL injection protection** through prepared statements

## Error Handling

The worker includes comprehensive error handling:

- Validates all input parameters
- Returns appropriate HTTP status codes
- Logs errors for debugging
- Fails gracefully when external services are unavailable

## Usage in Frontend

The subscription functionality is integrated into the Vegvisr.org frontend through the `GNewSubscriptionNode` component, which provides a user-friendly interface for managing subscriptions.

## Testing

Test the worker endpoints using curl:

```bash
# Subscribe to a graph
curl -X POST https://subscription-worker.torarnehave.workers.dev/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","subscription_type":"graph","target_id":"graph_123","target_title":"Test Graph"}'

# Verify subscription
curl "https://subscription-worker.torarnehave.workers.dev/verify-subscription?email=test@example.com&subscription_type=graph&target_id=graph_123"

# List subscriptions
curl "https://subscription-worker.torarnehave.workers.dev/list-subscriptions?email=test@example.com"

# Unsubscribe
curl -X POST https://subscription-worker.torarnehave.workers.dev/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","unsubscribe_token":"your-token-here"}'
```
