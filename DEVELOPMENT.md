# Local Development Guide

Step-by-step guide for developing StreamTrack locally.

## Prerequisites

- Node.js 20+ installed
- npm or pnpm installed

## Setup

### 1. Clone and Install Dependencies

```bash
# Clone repository (if not already done)
git clone git@github.com:dylanrichardson/tv-streaming-availability-tracker.git
cd tv-streaming-availability-tracker

# Install worker dependencies
cd worker
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Set Up Local D1 Database

Wrangler provides a local SQLite database for D1 development:

```bash
cd worker

# Create and seed local database
npx wrangler d1 execute streamtrack --local --file=./schema.sql
```

This creates `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` with a local SQLite database.

**Note**: The local database is separate from production. You can reset it anytime by:
```bash
rm -rf .wrangler/state
npx wrangler d1 execute streamtrack --local --file=./schema.sql
```

### 3. Run Backend Locally

```bash
cd worker
npx wrangler dev
```

This starts the Cloudflare Worker at **`http://127.0.0.1:8787`** (or similar port).

**Test it works:**
```bash
curl http://127.0.0.1:8787/api/titles
# Should return: {"titles":[]}

# Import a test title
curl -X POST http://127.0.0.1:8787/api/sync \
  -H "Content-Type: application/json" \
  -d '{"titles": ["Stranger Things"]}'
```

### 4. Configure Frontend for Local Development

Create a local config override:

```bash
cd frontend

# Option 1: Temporarily edit config.ts
# Change API_URL to 'http://127.0.0.1:8787'
```

**`frontend/src/config.ts`** (development):
```typescript
// API URL - update this after deploying the worker
export const API_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:8787'
  : 'https://streamtrack-api.dylanrichardson1996.workers.dev';
```

Or create an environment variable file:

**`frontend/.env.local`**:
```
VITE_API_URL=http://127.0.0.1:8787
```

**`frontend/src/config.ts`** (using env var):
```typescript
export const API_URL = import.meta.env.VITE_API_URL || 'https://streamtrack-api.dylanrichardson1996.workers.dev';
```

### 5. Run Frontend Locally

```bash
cd frontend
npm run dev
```

This starts Vite dev server at **`http://localhost:5173`** (or similar port).

Open http://localhost:5173 in your browser.

## Development Workflow

### Terminal Setup (Recommended)

Use 3 terminal windows/panes:

**Terminal 1: Backend**
```bash
cd worker
npx wrangler dev
# Watch mode: auto-reloads on file changes
```

**Terminal 2: Frontend**
```bash
cd frontend
npm run dev
# Hot reload: changes appear instantly
```

**Terminal 3: Testing**
```bash
# API testing
curl http://127.0.0.1:8787/api/titles

# Database inspection
cd worker
npx wrangler d1 execute streamtrack --local --command "SELECT * FROM titles"

# Worker logs
# Logs appear in Terminal 1 automatically
```

### Making Changes

1. **Edit worker code** (`worker/src/**`)
   - Wrangler auto-reloads on save
   - Check Terminal 1 for errors
   - Test with curl or browser

2. **Edit frontend code** (`frontend/src/**`)
   - Vite hot-reloads instantly
   - Browser updates automatically

3. **Edit database schema** (`worker/schema.sql`)
   - Reset local DB: `rm -rf worker/.wrangler/state`
   - Re-run: `npx wrangler d1 execute streamtrack --local --file=./schema.sql`

### Testing Locally

#### Manual Testing with Browser MCP

Use the browser MCP tool to test the local frontend:

```bash
# In Claude Code, use:
mcp__browsermcp__browser_navigate: http://localhost:5173
```

Then run through test scenarios from `TESTS.md`.

#### API Testing with curl

```bash
# Import titles
curl -X POST http://127.0.0.1:8787/api/sync \
  -H "Content-Type: application/json" \
  -d '{"titles": ["The Matrix", "Breaking Bad", "Succession"]}'

# List titles
curl http://127.0.0.1:8787/api/titles | jq

# Get history for title ID 1
curl http://127.0.0.1:8787/api/history/1 | jq

# Get service stats
curl http://127.0.0.1:8787/api/stats/services | jq

# Manually trigger availability check
curl -X POST http://127.0.0.1:8787/api/trigger-check
```

#### Database Inspection

```bash
cd worker

# List all titles
npx wrangler d1 execute streamtrack --local --command "SELECT * FROM titles"

# Check availability logs
npx wrangler d1 execute streamtrack --local --command "
  SELECT t.name, s.name as service, al.check_date, al.is_available
  FROM availability_logs al
  JOIN titles t ON al.title_id = t.id
  JOIN services s ON al.service_id = s.id
  ORDER BY al.check_date DESC
  LIMIT 20
"

# Count titles
npx wrangler d1 execute streamtrack --local --command "SELECT COUNT(*) FROM titles"
```

## Deployment

After testing locally, deploy to production:

```bash
# Deploy worker
cd worker
npx wrangler deploy

# Deploy frontend (via git push to GitHub Pages)
cd ..
git add .
git commit -m "Your changes"
git push
```

Frontend auto-deploys via GitHub Actions when you push to `main`.

## Troubleshooting

### Issue: "Cannot connect to API"

**Check:**
1. Is `npx wrangler dev` running? (Terminal 1)
2. Is the API URL correct in `frontend/src/config.ts`?
3. Check CORS: Worker should return `Access-Control-Allow-Origin: *`

**Fix:**
```bash
# Restart worker
cd worker
npx wrangler dev --port 8787
```

### Issue: "Database not found"

**Check:**
```bash
ls worker/.wrangler/state/v3/d1
```

**Fix:**
```bash
cd worker
npx wrangler d1 execute streamtrack --local --file=./schema.sql
```

### Issue: Frontend shows stale data

**Fix:**
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Clear localStorage: Open DevTools → Application → Local Storage → Clear

### Issue: JustWatch API failing

**Check worker logs** in Terminal 1 for error messages.

**Common causes:**
- Rate limiting (add delays between requests)
- API endpoint changed (check `worker/src/services/justwatch.ts`)
- Network issues

**Test directly:**
```bash
curl -X POST "https://apis.justwatch.com/graphql" \
  -H "Content-Type: application/json" \
  -H "App-Version: 3.13.0-web-web" \
  --data @/tmp/graphql-query.json
```

## Tips

### Fast Iteration

- Keep both terminals visible to see logs
- Use `jq` for pretty JSON: `curl ... | jq`
- Browser DevTools Network tab shows API calls
- Use browser MCP for automated testing

### Database Management

```bash
# Export local data
cd worker
npx wrangler d1 execute streamtrack --local --command \
  "SELECT * FROM titles" > titles.json

# Reset and start fresh
rm -rf .wrangler/state
npx wrangler d1 execute streamtrack --local --file=./schema.sql
```

### Debugging Worker

Add console.logs in `worker/src/**`:
```typescript
console.log('Debug:', { variable, anotherVar });
```

Logs appear in Terminal 1 (wrangler dev output).

### Hot Reload Not Working?

**Worker:**
- Restart `npx wrangler dev`
- Check for TypeScript errors

**Frontend:**
- Restart `npm run dev`
- Check for console errors in browser
- Clear browser cache

## Architecture Diagram

```
┌─────────────────────┐      ┌─────────────────────┐
│  localhost:5173     │─────▶│  localhost:8787     │
│  (Vite + React)     │      │  (Wrangler Dev)     │
│  Frontend           │      │  Worker API         │
└─────────────────────┘      └──────────┬──────────┘
                                        │
                                        ▼
                             ┌──────────────────────┐
                             │  .wrangler/state/    │
                             │  Local D1 (SQLite)   │
                             └──────────────────────┘
```

## Next Steps

- Read [TESTS.md](./TESTS.md) for test scenarios
- Read [CLAUDE.md](./CLAUDE.md) for AI development workflow
- See [README.md](./README.md) for production deployment
