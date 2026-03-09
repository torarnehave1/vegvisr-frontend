# Vegvisr Project Instructions

## Proactive Analysis — MANDATORY

Before writing or modifying ANY code, complete this checklist:

### 1. Impact Analysis (BEFORE coding)
- **List every user interaction** affected by your change (clicks, inputs, navigation, API calls, dialogs)
- **Trace each interaction end-to-end**: what functions fire, what browser APIs are used, what network requests happen, what permissions are needed
- **Ask yourself**: "If I were a user clicking every button in this app, what would break?"
- **For iframes/sandboxes/workers**: list ALL browser APIs the hosted content uses (fetch, prompt, alert, localStorage, postMessage, window.open, etc.) and ensure ALL are permitted

### 2. Anticipate Failures (BEFORE coding)
- **For every new feature**: list 3-5 things that could go wrong
- **For every environment boundary** (iframe, worker, cross-origin): list every restriction and verify your code handles them all
- **For React/Vue state/closures**: verify that async callbacks, event handlers, and effects will see current values

### 3. Be PROACTIVE — Think Beyond the Immediate Task
PROACTIVE means: when you implement something, ask "where else does this principle apply?" and handle ALL of those places NOW — not one at a time across multiple sessions.

**Real example of FAILING to be proactive:**
Adding "mandatory console logging" only for NEW HTML creation. A proactive approach would also cover:
- When PATCHING existing HTML → add logging around the fix
- When READING existing HTML → notice missing logging and upgrade it
- When the agent debugs errors → add logging so the same class of error is never vague again
- Apply the principle everywhere it's relevant, not just the narrow place you were asked about

**What proactive looks like in practice:**
- When adding an iframe → list ALL browser APIs the content will use and add ALL sandbox permissions upfront (scripts, forms, same-origin, modals, popups) — not one at a time across 5 deploys
- When adding a feature → ask "what else in the system is affected?" and handle it in the same change
- When fixing a bug → ask "can this same bug exist anywhere else?" and check
- When finishing code → commit, push, deploy without being asked — close the loop
- Each deploy-test-fix cycle costs the user real time and money — your job is to minimize those cycles

### 4. Think Like the User, Not the Developer
- The user will test the FULL app, not just your new feature
- Existing functionality must keep working after your change
- Mentally run through the app as a user before committing

---

## How I Like to Work

### Documentation Philosophy
- **Knowledge graphs are the source of truth** - NOT markdown files, NOT wiki pages
- **Document as we build** - Add nodes to graphs during development, not after
- **Visual first** - Use mermaid-diagram nodes for architecture and flows
- **API-driven** - Use curl commands to interact with knowledge.vegvisr.org
- **Incremental updates** - Use /addNode, /removeNode, /patchNode (never download full graph)

### My Workflow Preferences

1. **Planning Complex Tasks**
   - Use `EnterPlanMode` for implementation tasks with multiple steps
   - Create architectural diagrams (C4, flowcharts) before coding
   - Document the plan in the knowledge graph

2. **Documentation Approach**
   - Main documentation graph: `graph_agent_sdk_architecture`
   - Always use `x-user-role: Superadmin` header
   - Prefer visual diagrams over text when possible
   - Use curl commands to verify changes immediately

3. **Code Changes**
   - Test changes with curl commands
   - Document new endpoints in the graph
   - Add examples as nodes
   - Update OpenAPI spec when adding endpoints

4. **Use Specialized Agents**
   - Use Task tool with `subagent_type: Explore` for codebase research
   - Use Task tool for complex multi-file analysis
   - Let agents do parallel work when possible

---

## Knowledge Graph Operations

### Base Configuration
```bash
BASE_URL="https://knowledge.vegvisr.org"
GRAPH_ID="graph_agent_sdk_architecture"
ROLE_HEADER="-H 'x-user-role: Superadmin'"
```

### Essential Commands

#### Check Current Graph State
```bash
# Get graph metadata and version
curl -s 'https://knowledge.vegvisr.org/getknowgraph?id=graph_agent_sdk_architecture' | jq '{version: .metadata.version, title: .metadata.title, nodeCount: (.nodes | length)}'

# List all nodes
curl -s 'https://knowledge.vegvisr.org/getknowgraph?id=graph_agent_sdk_architecture' | jq '.nodes[] | {id, label, type}'
```

#### Add a Node (Preferred Method)
```bash
curl -X POST 'https://knowledge.vegvisr.org/addNode' \
  -H 'Content-Type: application/json' \
  -H 'x-user-role: Superadmin' \
  --data '{
    "graphId": "graph_agent_sdk_architecture",
    "node": {
      "id": "node-unique-id",
      "label": "Node Title",
      "type": "fulltext",
      "color": "#4f6d7a",
      "info": "# Content here\n\nMarkdown supported",
      "bibl": ["https://source.com"],
      "position": { "x": 0, "y": 0 },
      "visible": true
    }
  }'
```

#### Update Node Fields
```bash
curl -X POST 'https://knowledge.vegvisr.org/patchNode' \
  -H 'Content-Type: application/json' \
  -H 'x-user-role: Superadmin' \
  --data '{
    "graphId": "graph_agent_sdk_architecture",
    "nodeId": "node-to-update",
    "fields": {
      "label": "Updated Title",
      "info": "Updated content",
      "color": "#ff0000"
    }
  }'
```

#### Remove a Node
```bash
curl -X POST 'https://knowledge.vegvisr.org/removeNode' \
  -H 'Content-Type: application/json' \
  -H 'x-user-role: Superadmin' \
  --data '{
    "graphId": "graph_agent_sdk_architecture",
    "nodeId": "node-to-remove",
    "removeEdges": true
  }'
```

---

## Node Types Reference

### fulltext (Documentation)
```json
{
  "type": "fulltext",
  "info": "# Markdown content\n\nSupports full markdown syntax"
}
```

### mermaid-diagram (Visual Diagrams)
**IMPORTANT**: Must include `path`, `imageWidth`, `imageHeight` fields!

```json
{
  "type": "mermaid-diagram",
  "info": "graph TB\n    A[Start] --> B[End]",
  "path": "https://vegvisr.imgix.net/mermaid.png",
  "imageWidth": "400",
  "imageHeight": "300",
  "color": "#0ea5e9"
}
```

### youtube-video (Tutorial Videos)
```json
{
  "type": "youtube-video",
  "path": "https://youtube.com/watch?v=VIDEO_ID",
  "info": "# Video description\n\nContext about the video",
  "imageWidth": "100%",
  "imageHeight": "100%",
  "color": "#FF0000"
}
```

### html-node (Full HTML Apps)
```json
{
  "type": "html-node",
  "info": "<!DOCTYPE html>\n<html>...</html>"
}
```

---

## Graph Templates

### Available Templates (62 total)
Query templates:
```bash
cd /Users/torarnehave/Documents/GitHub/vegvisr-frontend/dev-worker
wrangler d1 execute vegvisr_org --remote --command "SELECT id, name, category FROM graphTemplates ORDER BY category, name"
```

### Recommended Templates for Documentation
1. **FullTextNode** (`94409110-ebce-4c3a-85e2-18a822afd261`) - Core documentation
2. **FlowChart** (`0a9c2ce1-d788-4524-957a-59cebe5f0e8c`) - Process flows
3. **GanttChart** (`90b649b1-dcf5-4298-8f96-4ecbc61eb60e`) - Timelines
4. **TimeLine** (`74e137f0-5e08-4efe-a062-c806fa633813`) - Chronological events
5. **YouTube** (`303d26ab-6a71-466b-83fb-bb9a76321b8b`) - Tutorial videos
6. **HTML Page Node** (`a1b2c3d4-e5f6-7890-abcd-ef1234567890`) - Working examples

---

## Project Architecture

### Repositories
- **vegvisr-frontend** (Vue 3) - Main app with Agent SDK runtime
- **aichat-vegvisr** (React) - Chat interface
- **vegvisr-connect** - Connection utilities
- **spotlight-ts** - TypeScript utilities
- **photos-vegvisr** - Photo management
- **slowyou.io** - Landing site
- **login-vegvisr** - Authentication
- **vegvisr-ui-kit** - Shared UI components
- **vemail-vegvisr** - Email management

### Cloudflare Account
**ALL workers are in the SAME Cloudflare account: `e91711ab7a5bf10ef92e1b2a91d52148`**
- Do NOT assume workers are in different accounts
- Do NOT check/verify account separation — they share one account
- Service bindings work between ALL workers because they are co-located
- The `account_id` in some wrangler.toml files (e.g. `5d9b2060...`) is a legacy secondary account — ignore it for service binding purposes
- **Never refuse to add a service binding based on account mismatch assumptions**

### Cloudflare Workers (all same account)
- **knowledge-graph-worker** (dev-worker/) - Graph CRUD + history → knowledge.vegvisr.org
- **agent-worker** (Agent-Builder/worker/) - Agent execution → agent.vegvisr.org
- **anthropic-worker** - LLM proxy with encrypted keys
- **perplexity-worker** (perplexity-worker/) - Perplexity AI search → perplexity.vegvisr.org
- **auth-worker** - Authentication
- **email-worker** - Email handling
- **test-domain-worker** (domain-worker/) - Domain handling
- **test-brand-proxy-worker** (proxy-worker/) - Brand proxy

### Databases
- **D1**: vegvisr_org (graphs, templates, history, agent_configs, agent_contracts)
- **KV**: HTML_PAGES, BRAND_CONFIG, THEME_STUDIO, GOOGLE_CREDENTIALS

---

## Deployment Rules

### Workers (Use wrangler)
```bash
# Deploy worker
cd dev-worker
wrangler deploy

# NEVER deploy workers with git push
# Workers are NOT auto-deployed from GitHub
```

### Pages Apps (Use git push)
```bash
# Cloudflare Pages apps deploy automatically via GitHub integration:
# - vemail-vegvisr
# - aichat-vegvisr
# - photos-vegvisr

# Push to GitHub to deploy
git push origin main
```

### Pre-Deployment Checklist
- [ ] Check `wrangler.toml` has correct `account_id`
- [ ] Verify routes are configured for custom domains
- [ ] Test with `wrangler dev` first
- [ ] Use `--remote` flag for production KV operations

---

## Common Patterns

### Adding API Endpoint Documentation
When you add a new endpoint to knowledge-graph-worker:
1. Add the endpoint code to `dev-worker/index.js`
2. Update OpenAPI spec at `/openapi.json` endpoint
3. Deploy with `wrangler deploy`
4. Add/update node in documentation graph with curl example
5. Test the endpoint with curl

### Creating Visual Architecture Diagrams
```bash
# 1. Create mermaid diagram content
# 2. Add as mermaid-diagram node (MUST include path, imageWidth, imageHeight)
curl -X POST 'https://knowledge.vegvisr.org/addNode' \
  -H 'Content-Type: application/json' \
  -H 'x-user-role: Superadmin' \
  --data '{
    "graphId": "graph_agent_sdk_architecture",
    "node": {
      "id": "node-diagram-name",
      "label": "Diagram Title",
      "type": "mermaid-diagram",
      "info": "graph TB\n    ...",
      "path": "https://vegvisr.imgix.net/mermaid.png",
      "imageWidth": "400",
      "imageHeight": "300",
      "position": { "x": 0, "y": -300 },
      "visible": true
    }
  }'
```

---

## Key Lessons Learned

### Always Use --remote Flag with KV
```bash
# ❌ WRONG (uses local preview KV)
wrangler kv key get "key"

# ✅ CORRECT (uses production KV)
wrangler kv key get "key" --remote
```

### Check Routes Before Deploying Workers
```bash
# Always check wrangler.toml has routes for custom domains
# Common mistake: Deploy worker → test → 404 → realize route missing
# Correct flow: Check routes → deploy → test
```

### Node Types Matter
- Use `mermaid-diagram` (not `mermaid`) for visual diagrams
- Must include `path`, `imageWidth`, `imageHeight` for diagrams to render
- Use `fulltext` for markdown documentation

---

## Memory Location
Auto memory: `/Users/torarnehave/.claude/projects/-Users-torarnehave-Documents-GitHub-my-test-app/memory/MEMORY.md`

---

## Quick Reference: Current Graph State

```bash
# View graph
https://knowledge.vegvisr.org/public-graph?id=graph_agent_sdk_architecture

# API endpoint
https://knowledge.vegvisr.org/getknowgraph?id=graph_agent_sdk_architecture

# OpenAPI spec
https://knowledge.vegvisr.org/openapi.json
```

---

## Working with Mermaid Diagrams

### Fullscreen Feature
All mermaid-diagram nodes have a fullscreen button (🔲):
- Component: `GNewMermaidNode.vue`
- Click fullscreen button to expand diagram
- ESC key or button to exit
- Auto-centers and scales appropriately

---

## Starting a New Session

When starting a new chat, reference this file:
```
Continue working on the Vegvisr Agent SDK project.
Follow the workflow in CLAUDE.md.
Current focus: [describe what you're working on]
```

I'll automatically:
1. ✅ Read this CLAUDE.md file
2. ✅ Check auto memory
3. ✅ Understand your documentation preferences
4. ✅ Use curl + knowledge graphs for all documentation
5. ✅ Create visual diagrams as mermaid-diagram nodes
