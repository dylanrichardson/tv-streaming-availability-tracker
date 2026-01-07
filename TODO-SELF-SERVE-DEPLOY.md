# TODO: Self-Serve 1-Click Deploy

## Goal

Allow other users to fork and deploy their own instance of StreamTrack with minimal setup.

**Why:**
- Share the project as a template others can use
- No hard-coded references to your personal deployments
- Users just authenticate with Wrangler and deploy
- Great for portfolio/showcase ("self-hostable")

---

## Current Blockers

### 1. Hardcoded Deployment URLs

**Frontend config:**
```typescript
// frontend/src/config.ts
export const API_URL = 'https://streamtrack-api.dylanrichardson1996.workers.dev';
```

**Problem:** Points to your specific worker deployment

**Solution:** Environment-based configuration
```typescript
// Auto-detect or use env var
export const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:8787'
    : `https://streamtrack-api.${import.meta.env.VITE_WORKER_NAME}.workers.dev`
  );
```

### 2. GitHub Pages Deployment

**Current:** Frontend deployed to `dylanrichardson.github.io/tv-streaming-availability-tracker/`

**Problem:** Requires GitHub Pages setup, specific repo name

**Solution:** Move to Cloudflare Pages (simpler, unified platform)
```bash
# Single command deployment
npx wrangler pages deploy frontend/dist
```

### 3. Database IDs

**Current:** `wrangler.toml` has hardcoded database ID
```toml
database_id = "e36fd369-7ba0-4b46-9ed6-08f67279d8a2"
```

**Problem:** Only works with your D1 instance

**Solution:** Use dynamic binding + setup script
```toml
# wrangler.toml (remove database_id)
[[d1_databases]]
binding = "DB"
database_name = "streamtrack"
# database_id is auto-populated by wrangler
```

### 4. CORS Configuration

**Current:** `CORS_ORIGIN = "*"` (allows all)

**Problem:** Should be configurable per deployment

**Solution:** Auto-detect or use env var
```typescript
const corsOrigin = env.CORS_ORIGIN || request.headers.get('Origin') || '*';
```

---

## Implementation Plan

### Phase 1: Remove Hardcoded Values

1. **Frontend API URL:**
   - Make configurable via `.env.production`
   - Auto-detect from hostname for Cloudflare Pages
   - Document how to configure

2. **Worker Database:**
   - Remove `database_id` from `wrangler.toml` (wrangler auto-populates)
   - Add to `.gitignore`: `wrangler.toml.local` (user-specific overrides)

3. **CORS:**
   - Make configurable
   - Default to request origin (safer)

### Phase 2: Simplify Deployment

**Option A: Cloudflare Pages for Frontend**

Pros:
- ✅ Same platform as worker (unified)
- ✅ Auto-deploy on git push
- ✅ Free tier is generous
- ✅ Better performance (edge deployment)
- ✅ No GitHub Pages config needed

Cons:
- ⚠️ Requires Cloudflare account
- ⚠️ Different URL structure

**Option B: Keep GitHub Pages but Simplify**

Pros:
- ✅ No migration needed
- ✅ Works with any static host
- ✅ Familiar to developers

Cons:
- ⚠️ Requires separate config
- ⚠️ Two platforms to manage

**Recommendation:** Move to Cloudflare Pages (simpler, unified)

### Phase 3: Create Setup Script

**`setup.sh`:**
```bash
#!/bin/bash
set -e

echo "🚀 StreamTrack Self-Serve Setup"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
  echo "❌ Wrangler not found. Install with: npm install -g wrangler"
  exit 1
fi

# Check if logged in
if ! wrangler whoami &> /dev/null; then
  echo "🔐 Please log in to Cloudflare:"
  wrangler login
fi

# Create D1 database
echo "📦 Creating D1 database..."
wrangler d1 create streamtrack

echo "⚠️  Copy the database_id from above and add to wrangler.toml"
echo ""

# Run migrations
echo "🗄️  Running database migrations..."
wrangler d1 execute streamtrack --remote --file=./worker/schema.sql

# Deploy worker
echo "☁️  Deploying worker..."
cd worker
wrangler deploy
WORKER_URL=$(wrangler deployments list --json | jq -r '.[0].url')
cd ..

echo ""
echo "✅ Worker deployed to: $WORKER_URL"
echo ""

# Configure frontend
echo "📝 Configuring frontend..."
echo "VITE_API_URL=$WORKER_URL" > frontend/.env.production

# Build frontend
echo "🏗️  Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Deploy to Cloudflare Pages
echo "🌐 Deploying frontend to Cloudflare Pages..."
wrangler pages deploy frontend/dist --project-name=streamtrack

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Visit your Cloudflare Pages URL"
echo "  2. Import some titles"
echo "  3. Wait for cron job to populate history"
```

### Phase 4: Documentation

**README.md updates:**

```markdown
## Deploy Your Own Instance

### Prerequisites
- Cloudflare account (free tier works)
- Node.js 20+
- Wrangler CLI: `npm install -g wrangler`

### One-Command Deploy

\`\`\`bash
./setup.sh
\`\`\`

This will:
1. Create D1 database
2. Deploy worker
3. Build and deploy frontend
4. Configure everything automatically

### Manual Setup

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step instructions.

### Configuration

All configuration is in `worker/wrangler.toml`:
- `MAX_TOTAL_TITLES`: Limit total tracked titles (default: 500)
- `CRON_INTERVAL_HOURS`: How often to check titles (default: 4)
- `TARGET_CHECK_FREQUENCY_DAYS`: Check each title every N days (default: 7)

### Costs

StreamTrack runs entirely on Cloudflare's free tier:
- Workers: 100,000 requests/day
- D1 Database: 5 GB storage, 5 million reads/day
- Pages: Unlimited bandwidth
- Cron Triggers: Free

**Typical usage:** ~60 API calls/day for 500 titles checked weekly.
\`\`\`

---

## Breaking Changes

**For existing deployments:**

1. **Frontend config change:**
   - Old: Hardcoded API URL
   - New: Environment variable
   - Migration: Set `VITE_API_URL` in build

2. **Cloudflare Pages migration:**
   - Old: GitHub Pages (`dylanrichardson.github.io`)
   - New: Cloudflare Pages (`streamtrack.pages.dev`)
   - Migration: One-time setup

3. **No functional changes:**
   - Database schema stays the same
   - API endpoints unchanged
   - Worker logic unchanged

---

## Testing Self-Serve Deploy

**Before release:**

1. Fork repo to test account
2. Run setup script from scratch
3. Verify everything works
4. Document any issues
5. Create video walkthrough (optional)

---

## Related: Multi-Tenant Support (Future)

If you wanted to host this for multiple users (without them self-deploying):

**Approach:**
- Single worker deployment
- Namespace titles by user/tenant
- Add `tenant_id` column to titles table
- Each user gets their own subdomain: `user1.streamtrack.com`

**But for now:** Self-serve deploy is simpler and aligns with your goals.

---

## Timeline

**Quick win (1-2 hours):**
- Remove hardcoded URLs
- Add environment variables
- Update docs

**Full setup (4-6 hours):**
- Create setup script
- Migrate to Cloudflare Pages
- Test end-to-end
- Write comprehensive docs
- Record demo video

**When to do this:**
- After spam prevention is in place
- After testing queue system in production
- When ready to share publicly
