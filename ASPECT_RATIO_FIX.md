# Advertisement Worker Aspect Ratio Fix

## Problem

The advertisement-worker was not persisting the `aspect_ratio` field to the database.

## Root Cause

- Database schema had the `aspect_ratio` column (syntax was slightly malformed but fixable)
- Worker's INSERT and UPDATE SQL statements were missing the `aspect_ratio` field
- Frontend was sending the field correctly, but worker ignored it

## Fixed Files

### 1. Database Schema (fixed-advertisements-schema.sql)

```sql
CREATE TABLE advertisements (
  id TEXT PRIMARY KEY,
  knowledge_graph_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience TEXT,
  campaign_name TEXT,
  budget REAL,
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  aspect_ratio VARCHAR(20) DEFAULT 'default',
  FOREIGN KEY (knowledge_graph_id) REFERENCES knowledge_graphs(id)
);
```

### 2. Worker Code (advertisement-worker/index.js)

- Added `aspect_ratio` to INSERT statement
- Added `aspect_ratio` to UPDATE statement
- Added proper parameter binding for aspect_ratio

## Next Steps

1. **Deploy the Worker**: Upload the updated `advertisement-worker/index.js` to Cloudflare Workers
2. **Update Database Schema**: If needed, run the ALTER TABLE statement to add the column
3. **Test the Fix**: Use the test command below

## Test Commands

```powershell
# Test updating aspect_ratio
$body = '{"knowledge_graph_id":"graph_1752497085291","title":"Brilleland","content":"[FANCY | font-size: 3.5em; color: lightblue; background-image: url('"'"'https://images.pexels.com/photos/163142/glasses-notebook-wooden-business-163142.jpeg?auto=compress&cs=tinysrgb&h=350'"'"'); text-align: center]\nHvordan se dette ut på facebook da ?\n\n[END FANCY]","ad_type":"banner","target_audience":"z<cx<zc","budget":0,"status":"active","aspect_ratio":"hero-banner"}'

Invoke-RestMethod -Uri 'https://advertisement-worker.torarnehave.workers.dev/api/advertisements/ac71f283-c0dc-4b92-ac55-514a4f9c2c70' -Method Put -ContentType 'application/json' -Body $body

# Verify the update
Invoke-RestMethod -Uri 'https://advertisement-worker.torarnehave.workers.dev/api/advertisements?knowledge_graph_id=graph_1752497085291'
```

## Expected Result

After deploying, the aspect_ratio should persist as "hero-banner" instead of reverting to "default".
